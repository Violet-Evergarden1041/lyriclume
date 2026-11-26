/**
 * 网易云音乐歌词抓取（匿名，无需登录）
 * 走网页版公开接口：搜索 + 歌词（含翻译）
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HDR = {
  'User-Agent': UA,
  'Referer': 'https://music.163.com/',
  'Cookie': 'NMTID=00O0',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 版权 / 制作信息行 */
const CREDIT_RE = /^\s*(作词|作曲|编曲|制作人|监制|混音|母带|录音|和声|吉他|贝斯|鼓|键盘|弦乐|OP|SP|出品|发行|策划|统筹|文案|封面|演唱|原唱|翻唱|词|曲)\s*[:：]/;

function isCredit(text) {
  const s = (text || '').trim();
  if (!s) return true;
  if (CREDIT_RE.test(s)) return true;
  if (/^(作词|作曲|编曲)\s*:/.test(s)) return true;
  return false;
}

/* ---------------- 搜索 ---------------- */

export async function searchNetease(keyword, limit = 10) {
  const url = 'https://music.163.com/api/search/get/web?csrf_token=&type=1&offset=0&total=true'
    + '&limit=' + limit + '&s=' + encodeURIComponent(keyword);
  const res = await fetch(url, { headers: HDR });
  if (!res.ok) throw new Error('netease search HTTP ' + res.status);
  const j = await res.json();
  const list = (j && j.result && j.result.songs) || [];
  return list.map(s => ({
    id: s.id,
    name: s.name,
    artist: (s.artists || []).map(a => a.name).join('/'),
    album: (s.album && s.album.name) || '',
    duration: Math.round((s.duration || 0) / 1000),
  })).filter(x => x.id && x.name);
}

/* ---------------- 歌词 ---------------- */

function parseLrcTime(line) {
  const m = line.match(/^\[(\d+):(\d+)(?:[.:](\d+))?\]/);
  if (!m) return null;
  const min = +m[1], sec = +m[2];
  const frac = m[3] ? +('0.' + m[3]) : 0;
  return min * 60 + sec + frac;
}

function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = parseLrcTime(raw);
    if (t === null) continue;
    const body = raw.replace(/^\[[^\]]*\]/, '').trim();
    if (!body) continue;
    out.push({ t: Math.round(t * 1000), text: body });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** 把整行文本切成逐字 token，按行时长均分，保证染色仍然是逐字推进 */
function toTokens(text, startMs, endMs) {
  const chars = Array.from(text);
  const n = chars.length || 1;
  const span = Math.max(300, (endMs || startMs + n * 320) - startMs);
  const per = span / n;
  return chars.map((ch, i) => ({
    w: ch,
    t: Math.round(startMs + i * per),
    d: Math.round(per),
  }));
}

export async function getNeteaseLyrics(id) {
  const url = 'https://music.163.com/api/song/lyric?id=' + encodeURIComponent(id) + '&lv=-1&kv=-1&tv=-1';
  const res = await fetch(url, { headers: HDR });
  if (!res.ok) throw new Error('netease lyric HTTP ' + res.status);
  const j = await res.json();

  const lrc = parseLrc(j && j.lrc && j.lrc.lyric);
  if (!lrc.length) return { lines: [], hasTrans: false };

  const trans = parseLrc(j && j.tlyric && j.tlyric.lyric);

  // 过滤版权行，再补全行时长
  const kept = lrc.filter(x => !isCredit(x.text));
  const merged = [];
  let ti = 0;
  for (let i = 0; i < kept.length; i++) {
    const cur = kept[i];
    const nextT = i + 1 < kept.length ? kept[i + 1].t : cur.t + Math.max(1200, cur.text.length * 320);
    let tr = '';
    if (trans.length) {
      while (ti + 1 < trans.length && Math.abs(trans[ti + 1].t - cur.t) <= Math.abs(trans[ti].t - cur.t)) ti++;
      if (Math.abs(trans[ti].t - cur.t) <= 900) tr = trans[ti].text;
    }
    merged.push({
      t: cur.t,
      dur: Math.max(300, nextT - cur.t),
      tokens: toTokens(cur.text, cur.t, nextT),
      tr,
    });
  }
  return { lines: merged, hasTrans: merged.some(l => l.tr) };
}

/* ---------------- 匹配 ---------------- */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[（(【\[].*?[)）】\]]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function similarity(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.85;
  const sa = new Set(A.replace(/\s/g, ''));
  const sb = new Set(B.replace(/\s/g, ''));
  let inter = 0;
  for (const c of sa) if (sb.has(c)) inter++;
  return inter / Math.max(sa.size, sb.size);
}

export async function matchNetease(track) {
  const queries = [];
  const push = q => { const s = String(q || '').trim(); if (s && !queries.includes(s)) queries.push(s); };
  push(`${track.title} ${track.artist}`);
  push(track.artist);

  const seen = new Map();
  let ok = 0;
  for (const q of queries) {
    let list = [];
    try { list = await searchNetease(q, 10); ok++; } catch { list = []; }
    for (const c of list) if (!seen.has(c.id)) seen.set(c.id, c);
    if (seen.size >= 6) break;
    await sleep(600);
  }
  if (ok === 0) throw new Error('netease search unavailable');

  const target = track.durationMs ? track.durationMs / 1000 : 0;
  const scored = [...seen.values()].map(c => {
    const dt = target ? Math.abs(c.duration - target) : 0;
    const tS = similarity(c.name, track.title);
    const aS = similarity(c.artist, track.artist);
    let score = tS * 60 + aS * 40;
    if (target) {
      if (dt <= 2) score += 60;
      else if (dt <= 4) score += 42;
      else if (dt <= 8) score += 15;
      else score -= 40;
    }
    if (target && dt <= 3 && aS >= 0.6) score = Math.max(score, 88);
    return { ...c, score: Math.round(score), durationDiff: Math.round(dt) };
  }).sort((a, b) => b.score - a.score);

  return { best: scored[0] || null, candidates: scored };
}
