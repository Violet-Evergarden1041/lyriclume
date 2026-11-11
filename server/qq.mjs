/**
 * QQ 音乐歌词抓取 + 解析 + 匹配
 * 只读接口，纯本地，不需要登录、不需要 Key。
 */
import { decryptQrc } from './qrc-des.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HDR = {
  'User-Agent': UA,
  'Referer': 'https://y.qq.com/',
};

const SEARCH_URL = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
const LYRIC_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

/* ---------------- 搜索 ---------------- */

export async function searchSongs(keyword, limit = 8) {
  const url = `${SEARCH_URL}?p=1&n=${limit}&format=json&w=${encodeURIComponent(keyword)}`;
  const res = await fetch(url, { headers: HDR });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json = await res.json();
  const list = json?.data?.song?.list || [];
  return list.map(s => ({
    songmid: s.songmid,
    songid: s.songid,
    name: s.songname,
    artist: (s.singer || []).map(x => x.name).join('/'),
    album: s.albumname,
    duration: s.interval,          // 秒
  }));
}

/* ---------------- 原始歌词 ---------------- */

export async function fetchRawLyrics(songmid, songid) {
  const body = {
    comm: { ct: 11, cv: '1003006', uin: '0', format: 'json' },
    req_1: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: { songMID: String(songmid), songID: Number(songid), lrctype: 1, qrc: 1, trans: 1, roma: 1 },
    },
  };
  const res = await fetch(LYRIC_URL, {
    method: 'POST',
    headers: { ...HDR, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`lyric HTTP ${res.status}`);
  const json = await res.json();
  const d = json?.req_1?.data;
  if (!d) throw new Error('lyric: no data');
  return d; // { lyric, trans, roma, qrc(0|1), trans_t, ... }
}

/* ---------------- 解析 ---------------- */

const ENTITIES = { '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const unescapeXml = s => s.replace(/&(quot|apos|lt|gt|amp);/g, m => ENTITIES[m]);

/** 制作人员信息行，比如「曲：米津玄師」「编曲：xxx」 */
const META_RE = /^\s*(作词|作曲|编曲|词|曲|制作人|监制|录音|混音|母带|吉他|贝斯|鼓|和声|弦乐|键盘|词曲|出品|发行|Produced|Composed|Arranged|Written|Lyrics|Music|Mixed|Mastered|Guitar|Bass|Drums|Recorded)\s*[:：]/i;

export function isMetaLine(text) {
  const s = (text || '').trim();
  return META_RE.test(s) || !/[\p{L}\p{N}]/u.test(s);
}

/** 从 QRC XML 里取出 LyricContent 文本 */
export function extractQrcContent(xml) {
  const key = 'LyricContent="';
  const i = xml.indexOf(key);
  if (i < 0) return null;
  const start = i + key.length;
  const end = xml.indexOf('"/>', start);
  if (end < 0) return null;
  return unescapeXml(xml.slice(start, end));
}

/**
 * 解析 QRC 逐字歌词
 * 行: [起始ms,时长ms]字(起始ms,时长ms)字(起始ms,时长ms)...
 */
export function parseQrc(text) {
  const lines = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[(\d+),(\d+)\](.*)$/);
    if (!m) continue;                       // 跳过 [ti:] [kana:] 等元信息
    const t = +m[1];
    const dur = +m[2];
    const body = m[3];
    const tokens = [];
    const re = /([^()]+?)\((\d+),(\d+)\)/g;
    let mm;
    while ((mm = re.exec(body))) {
      const w = mm[1];
      if (!w.trim()) continue;
      tokens.push({ w, t: +mm[2], d: +mm[3] });
    }
    if (!tokens.length) continue;
    if (isMetaLine(tokens.map(x => x.w).join(''))) continue;
    lines.push({ t, dur, tokens, tr: '' });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

/** 解析普通 LRC（用于翻译），返回 [{t, text}] */
export function parseLrc(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[(\d+):(\d+)(?:[.:](\d+))?\](.*)$/);
    if (!m) continue;
    const ms = (+m[1]) * 60000 + (+m[2]) * 1000 + (m[3] ? +(m[3].padEnd(3, '0')) : 0);
    let body = m[4].trim();
    if (!body || body === '//' || body === '///') body = '';
    out.push({ t: ms, text: body });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/** 把翻译按时间贴到 QRC 行上 */
export function attachTranslations(qrcLines, transLines, tolerance = 300) {
  if (!transLines.length) return qrcLines;
  let j = 0;
  for (const ln of qrcLines) {
    while (j + 1 < transLines.length && Math.abs(transLines[j + 1].t - ln.t) <= Math.abs(transLines[j].t - ln.t)) j++;
    const cur = transLines[j];
    if (cur && Math.abs(cur.t - ln.t) <= tolerance) ln.tr = cur.text;
  }
  return qrcLines;
}

/** 没有 QRC 时，退回整行 LRC（无逐字时间） */
export function lrcToLines(text) {
  return parseLrc(text)
    .filter(x => x.text && !isMetaLine(x.text))
    .map(x => ({ t: x.t, dur: 0, tokens: [{ w: x.text, t: x.t, d: 0 }], tr: '' }));
}

/* ---------------- 组合 ---------------- */

export async function getSongLyrics(songmid, songid) {
  const d = await fetchRawLyrics(songmid, songid);

  const b64 = s => (s ? new TextDecoder('utf-8').decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))) : '');
  const rawLyric = d.lyric || '';
  const rawTrans = d.trans || '';

  // qrc=1 时 lyric 直接就是 hex 密文；否则是 base64 的 LRC
  const isHex = rawLyric.length > 200 && /^[0-9A-Fa-f]+$/.test(rawLyric);
  const lrcText = isHex ? rawLyric : b64(rawLyric);
  const transText = b64(rawTrans);

  const transLines = transText ? parseLrc(transText) : [];

  let lines = null;
  let wordLevel = false;

  if (isHex) {
    try {
      const xml = await decryptQrc(lrcText);
      const content = extractQrcContent(xml);
      if (content) {
        lines = parseQrc(content);
        wordLevel = lines.length > 0;
      }
    } catch (e) {
      console.warn('QRC 解密失败，退回整行 LRC', e);
    }
  }

  if (!lines || !lines.length) {
    lines = lrcToLines(lrcText);
    wordLevel = false;
  }

  attachTranslations(lines, transLines);

  // 丢掉版权 / 来源说明行（TME享有本翻译作品的著作权 之类）
  const CREDIT_RE = /(TME|QQ\s*音乐|腾讯音乐|酷狗|酷我|网易云|虾米|咪咕).{0,30}(翻译|著作权|版权|提供|制作|出品)|本(翻译|歌词|歌曲).{0,14}(著作权|版权|所有)|(翻译|歌词).{0,10}(由|来自).{0,12}(提供|翻译)/i;
  lines = lines.filter(l => {
    const o = l.tokens.map(t => t.w).join('');
    return !CREDIT_RE.test(o) && !CREDIT_RE.test(l.tr || '');
  });

  // 补齐行时长
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].dur) {
      const next = lines[i + 1];
      lines[i].dur = next ? Math.max(0, next.t - lines[i].t) : 0;
    }
  }

  return { lines, wordLevel, hasTrans: lines.some(x => x.tr) };
}

/* ---------------- 匹配 Spotify 曲目 ---------------- */

const strip = s => (s || '')
  .toLowerCase()
  .replace(/\(.*?\)|\[.*?\]|（.*?）|【.*?】/g, ' ')   // 去掉 (Remastered) 之类
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

function similarity(a, b) {
  const A = strip(a);
  const B = strip(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.85;
  const sa = new Set(A.replace(/\s/g, ''));
  const sb = new Set(B.replace(/\s/g, ''));
  let inter = 0;
  for (const c of sa) if (sb.has(c)) inter++;
  return inter / Math.max(sa.size, sb.size);
}

/**
 * track: { title, artist, durationMs }
 * 返回 { best, candidates }
 */
export async function matchTrack(track) {
  const queries = [
    `${track.title} ${track.artist}`,
    `${track.title}`,
  ];

  const seen = new Map();
  for (const q of queries) {
    let list = [];
    try { list = await searchSongs(q, 10); } catch { list = []; }
    for (const c of list) if (!seen.has(c.songmid)) seen.set(c.songmid, c);
    if (seen.size >= 10) break;
  }

  const target = track.durationMs ? track.durationMs / 1000 : 0;
  const scored = [...seen.values()].map(c => {
    const dt = target ? Math.abs(c.duration - target) : 0;
    let score = similarity(c.name, track.title) * 60 + similarity(c.artist, track.artist) * 40;
    if (target) {
      if (dt <= 2) score += 60;
      else if (dt <= 4) score += 30;
      else if (dt <= 8) score += 10;
      else score -= 40;
    }
    return { ...c, score: Math.round(score), durationDiff: Math.round(dt) };
  }).sort((a, b) => b.score - a.score);

  return { best: scored[0] || null, candidates: scored };
}
