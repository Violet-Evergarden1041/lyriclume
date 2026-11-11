// QQLyrics v3 — Spotify 全屏歌词 + QQ 翻译 + 逐字染色
// 依赖：本地代理 http://127.0.0.1:8787
(function QQlyrics() {
  'use strict';

  if (typeof Spicetify === 'undefined' || !Spicetify.Player) {
    setTimeout(QQlyrics, 500);
    return;
  }
  if (window.__qqLyricsLoaded) return;
  window.__qqLyricsLoaded = true;

  const PROXY = 'http://127.0.0.1:8787';
  const LS_KEY = 'qql.settings.v3';
  const CACHE_PREFIX = 'qql.lyric.';

  const PRESETS = [
    ['#c8ff4d', '#4dd0ff'],
    ['#ffb15a', '#ff5f8f'],
    ['#ff9ecb', '#a78bfa'],
    ['#00ffa3', '#00c2ff'],
    ['#ffe066', '#ff6b35'],
    ['#9be7ff', '#3d5afe'],
    ['#ff2e88', '#00e5ff'],
    ['#ffffff', '#ff8fb1'],
    ['#39ff14', '#ffe600'],
  ];

  const settings = Object.assign(
    { showTrans: true, colors: PRESETS[0].slice(), offset: 0, colorIndex: 0 },
    JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  );
  const saveSettings = () => localStorage.setItem(LS_KEY, JSON.stringify(settings));

  const css = "\n  .qql-entry {\n    display: inline-flex; align-items: center; gap: 6px;\n    height: 26px; padding: 0 10px; margin-right: 8px;\n    border-radius: 13px; border: 1px solid rgba(30,215,96,.55);\n    background: rgba(30,215,96,.15); color: #1ed760;\n    font-size: 11.5px; font-weight: 700; font-family: inherit;\n    cursor: pointer; white-space: nowrap; -webkit-app-region: no-drag;\n    transition: background .18s, border-color .18s;\n    will-change: transform;\n  }\n  .qql-entry:hover { background: rgba(30,215,96,.3); border-color: #1ed760; }\n  .qql-entry > i {\n    width: 12px; height: 12px; border-radius: 50%;\n    background: linear-gradient(135deg,#c8ff4d,#4dd0ff); display: block;\n  }\n\n  .qql-root {\n    position: fixed !important; inset: 0 !important; z-index: 9999 !important;\n    display: none; background: #07080a !important; color: #fff !important;\n    font-family: \"Segoe UI\",\"PingFang SC\",\"Microsoft YaHei\",system-ui,sans-serif !important;\n    overflow: hidden; user-select: none;\n  }\n  .qql-root.qql-open { display: block !important; }\n  .qql-root * { box-sizing: border-box; }\n\n  .qql-bg {\n    position: absolute; inset: -25%; z-index: 0;\n    background-size: cover; background-position: center;\n    filter: blur(72px) saturate(1.9) brightness(.62);\n    transform: scale(1.15);\n  }\n  .qql-scrim { position: absolute; inset: 0; z-index: 1; background: rgba(0,0,0,.16); }\n\n  .qql-collapse {\n    position: absolute; left: 24px; top: 50px; z-index: 8;\n    width: 56px; height: 56px; border-radius: 50%; border: none;\n    background: #ffffff12; color: #e2e2e2; cursor: pointer;\n    display: grid; place-items: center;\n    transition: background .2s; -webkit-app-region: no-drag;\n  }\n  .qql-collapse:hover { background: #ffffff26; }\n\n  .qql-trans {\n    position: absolute; right: 190px; top: 21px; z-index: 8;\n    width: 52px; height: 52px; border-radius: 50%; border: none;\n    background: #ffffff14; color: #b9b9b9; font-size: 17px; font-weight: 700;\n    cursor: pointer; display: grid; place-items: center; font-family: inherit;\n    transition: background .2s, color .2s; -webkit-app-region: no-drag;\n  }\n  .qql-trans:hover { background: #ffffff26; }\n  .qql-trans.qql-on { background: #1ed760; color: #06240f; }\n\n  .qql-colors {\n    position: absolute; right: 40px; top: 118px; z-index: 8;\n    display: grid; grid-template-columns: repeat(3, 42px); grid-auto-rows: 42px; gap: 14px;\n    -webkit-app-region: no-drag;\n  }\n  .qql-color {\n    width: 42px; height: 42px; border-radius: 50%; border: 3px solid transparent;\n    cursor: pointer; padding: 0; transition: transform .15s, border-color .15s;\n  }\n  .qql-color:hover { transform: scale(1.1); }\n  .qql-color.qql-on { border-color: #fff; }\n\n  .qql-head {\n    position: absolute; left: 24px; top: 140px; z-index: 4;\n    display: flex; align-items: flex-start; gap: 18px;\n    transition: top .45s, left .45s;\n  }\n  .qql-art {\n    width: 155px; height: 155px; border-radius: 8px; flex: none; cursor: pointer;\n    background: linear-gradient(135deg,#2f6b3f,#7ee08a 60%,#f3f7a3);\n    background-size: cover; background-position: center;\n    box-shadow: 0 10px 34px #0009;\n    transition: width .45s cubic-bezier(.25,.85,.25,1),\n                height .45s cubic-bezier(.25,.85,.25,1),\n                border-radius .45s, box-shadow .45s;\n  }\n  .qql-meta { min-width: 0; padding-top: 4px; transition: opacity .28s; }\n  .qql-title { font-size: 20px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }\n  .qql-sub { font-size: 14.5px; color: #a2a2a2; margin-top: 6px; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n  .qql-root.qql-exp .qql-head { left: 16%; top: 24%; }\n  .qql-root.qql-exp .qql-art {\n    width: min(420px, 26vw); height: min(420px, 26vw); border-radius: 10px;\n    box-shadow: 0 30px 80px #000c;\n  }\n  .qql-root.qql-exp .qql-meta { opacity: 0; pointer-events: none; }\n\n  .qql-body {\n    position: absolute; z-index: 3; overflow: hidden; cursor: grab;\n    left: 0; right: 0; top: 12.5%; bottom: 16%;\n    transition: left .45s cubic-bezier(.25,.85,.25,1), right .45s cubic-bezier(.25,.85,.25,1),\n                top .45s, bottom .45s;\n    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 10%, #000 90%, transparent 100%);\n            mask-image: linear-gradient(to bottom, transparent 0, #000 10%, #000 90%, transparent 100%);\n  }\n  .qql-body.qql-drag { cursor: grabbing; }\n  .qql-root.qql-exp .qql-body { left: 50.6%; right: 13.4%; top: 14.6%; bottom: 16.5%; }\n  .qql-stage { height: 100%; transition: transform .45s cubic-bezier(.25,.85,.25,1); transform-origin: center center; }\n  .qql-root.qql-exp .qql-stage { transform: scale(.9); }\n  .qql-track { transition: transform .55s cubic-bezier(.25,.85,.25,1); }\n\n  .qql-line { padding: 10px 0; cursor: pointer; }\n  .qql-row { text-align: center; line-height: 0; }\n  .qql-row-t { margin-top: 9px; }\n  .qql-o, .qql-t { position: relative; display: inline-block; white-space: pre; }\n  .qql-o {\n    font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.45;\n    transition: font-size .3s cubic-bezier(.25,.85,.25,1), color .3s;\n  }\n  .qql-line.qql-past .qql-o { color: #e0e0e0; }\n  .qql-line.qql-now .qql-o { font-size: 34px; color: #ffffff; }\n  .qql-t {\n    font-size: 20px; font-weight: 500; color: #e6e6e6; line-height: 1.45;\n  }\n  .qql-line.qql-now .qql-t { color: #ffffff; }\n  .qql-line.qql-hasnot .qql-t { display: none; }\n  body:not(.qql-trans-on) .qql-t { display: none; }\n\n  .qql-fill {\n    position: absolute; inset: 0; pointer-events: none;\n    background-image: var(--qql-grad);\n    -webkit-background-clip: text; background-clip: text; color: transparent;\n    clip-path: inset(-35% calc(100% - var(--qql-x, 0px)) -35% 0);\n  }\n  .qql-line.qql-past .qql-fill { opacity: .45; }\n\n  .qql-tip {\n    position: absolute; left: 100%; top: 50%; margin-left: 14px;\n    transform: translateY(-50%);\n    display: flex; align-items: center; gap: 8px;\n    font-size: 12px; font-weight: 600; color: #9a9a9a; background: #ffffff10;\n    padding: 4px 10px 4px 4px; border-radius: 14px; opacity: 0; pointer-events: none;\n    transition: opacity .15s; white-space: nowrap;\n  }\n  .qql-line:hover .qql-tip { opacity: 1; }\n  .qql-jump {\n    pointer-events: auto; width: 24px; height: 24px; border-radius: 50%;\n    border: none; padding: 0; background: #ffffff24; color: #e8e8e8;\n    font-size: 10px; line-height: 1; display: grid; place-items: center;\n    cursor: pointer; transition: background .15s, color .15s;\n  }\n  .qql-jump:hover { background: #1ed760; color: #06240f; }\n\n  .qql-prog {\n    position: absolute; z-index: 6; left: 16%; right: 13.4%; bottom: 94px;\n    display: flex; align-items: center; gap: 14px;\n  }\n  .qql-time { font-size: 12px; color: #a2a2a2; font-variant-numeric: tabular-nums; min-width: 42px; }\n  .qql-time.qql-dur { text-align: right; }\n  .qql-bar { flex: 1; height: 5px; background: #ffffff30; border-radius: 3px; position: relative; cursor: pointer; }\n  .qql-bar > i { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: #fff; border-radius: 3px; }\n  .qql-bar::after { content: \"\"; position: absolute; inset: -9px 0; }\n  .qql-bar > b {\n    position: absolute; top: 50%; left: 0; width: 14px; height: 14px;\n    margin: -7px 0 0 -7px; border-radius: 50%; background: #fff;\n    box-shadow: 0 2px 8px #000a; opacity: 0; transition: opacity .12s;\n    pointer-events: none;\n  }\n  .qql-prog:hover .qql-bar > b, .qql-bar.qql-scrub > b { opacity: 1; }\n\n  .qql-ctrls {\n    position: absolute; z-index: 6; left: 0; right: 0; bottom: 16px;\n    display: flex; align-items: center; justify-content: center; gap: 40px;\n  }\n  .qql-ctrls button {\n    background: none; border: none; cursor: pointer; color: #e0e0e0;\n    padding: 8px; border-radius: 50%; line-height: 0;\n    transition: color .15s, background .15s, transform .15s; -webkit-app-region: no-drag;\n  }\n  .qql-ctrls button:hover { color: #fff; background: #ffffff16; }\n  .qql-ctrls button > svg { pointer-events: none; }   /* 点击永远落在 button 上 */\n  .qql-ctrls button:active { transform: scale(.93); }\n  .qql-ctrls .qql-play {\n    width: 64px; height: 64px; border-radius: 50%; background: #fff; color: #000;\n    display: grid; place-items: center;\n  }\n  .qql-ctrls .qql-on { color: #1ed760; }\n\n  .qql-volpop {\n    position: absolute; z-index: 20;\n    width: 62px; padding: 16px 0 12px; border-radius: 12px;\n    background: #1c1c1e; box-shadow: 0 16px 44px #000b;\n    display: none; flex-direction: column; align-items: center; gap: 10px;\n  }\n  .qql-volpop.qql-show { display: flex; }\n  .qql-volpop::after {\n    content: \"\"; position: absolute; bottom: -7px; left: 50%; margin-left: -7px;\n    width: 14px; height: 14px; background: #1c1c1e; transform: rotate(45deg);\n  }\n  .qql-voltrack {\n    position: relative; width: 6px; height: 150px; border-radius: 3px;\n    background: #ffffff2e; cursor: pointer;\n  }\n  .qql-voltrack > i {\n    position: absolute; left: 0; right: 0; bottom: 0; height: 70%;\n    background: #fff; border-radius: 3px;\n  }\n  .qql-voltrack > b {\n    position: absolute; left: 50%; width: 12px; height: 12px; margin-left: -6px;\n    border-radius: 50%; background: #fff; box-shadow: 0 1px 6px #000a; bottom: 70%; margin-bottom: -6px;\n  }\n  .qql-volnum { font-size: 12px; color: #d0d0d0; font-variant-numeric: tabular-nums; }\n  .qql-volico { color: #8f8f8f; line-height: 0; }\n\n  .qql-msg { text-align: center; color: #8a8a8a; font-size: 13px; line-height: 1.9; padding: 60px 20px; }\n  ";

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const ICON = {
    collapse: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4"/><path d="M15 20v-5h5"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="7" y="5" width="3.8" height="14" rx="1"/><rect x="13.2" y="5" width="3.8" height="14" rx="1"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="4.6" y="5" width="2.8" height="14" rx="1"/><path d="M19.4 5v14L8.6 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="16.6" y="5" width="2.8" height="14" rx="1"/><path d="M4.6 5v14l10.8-7z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
    listloop: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
    vol: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M4 9h3.5L13 4v16l-5.5-5H4z"/></svg>',
  };

  const APP_NAME = '译光';

  const root = document.createElement('div');
  root.className = 'qql-root';
  root.innerHTML = `
    <div class="qql-bg"></div>
    <div class="qql-scrim"></div>

    <button class="qql-collapse" title="收起歌词（Esc）">${ICON.collapse}</button>
    <button class="qql-trans" title="显示/隐藏翻译">译</button>

    <div class="qql-colors"></div>

    <div class="qql-head">
      <div class="qql-art" title="点一下放大封面"></div>
      <div class="qql-meta">
        <div class="qql-title">—</div>
        <div class="qql-sub">—</div>
      </div>
    </div>

    <div class="qql-body"><div class="qql-stage"><div class="qql-track"></div></div></div>

    <div class="qql-prog">
      <span class="qql-time qql-cur">0:00</span>
      <div class="qql-bar"><i></i><b></b></div>
      <span class="qql-time qql-dur">0:00</span>
    </div>

    <div class="qql-ctrls">
      <button class="qql-mode" title="播放顺序">${ICON.listloop}</button>
      <button class="qql-bprev" title="上一首">${ICON.prev}</button>
      <button class="qql-play" title="播放/暂停">${ICON.pause}</button>
      <button class="qql-bnext" title="下一首">${ICON.next}</button>
      <button class="qql-volbtn" title="音量">${ICON.vol}</button>
    </div>

    <div class="qql-volpop">
      <div class="qql-voltrack"><i></i><b></b></div>
      <div class="qql-volnum">70%</div>
      <div class="qql-volico">${ICON.vol}</div>
    </div>
  `;

  document.body.appendChild(root);

  /* ================= 入口按钮：注入原生歌词栏 ================= */
  let entryEl = null;
  let lastEntryX = null;

  function makeEntry() {
    const b = document.createElement('button');
    b.className = 'qql-entry';
    b.title = `打开 ${APP_NAME}（Ctrl+Shift+L）`;
    b.innerHTML = `<i></i>${APP_NAME}`;
    b.addEventListener('click', e => {
      e.stopPropagation();
      open(b);
    });
    return b;
  }

  function injectEntry() {
    const sec = document.querySelector('[data-testid="lyrics-npv-section"]');
    if (!sec) return;

    const head = sec.querySelector('.main-nowPlayingView-sectionHeader');
    if (!head) return;

    const h2 = head.querySelector('h2');
    const group = [...head.children].find(c => c !== h2);
    const useGroup = !!(group && group.querySelector('button'));
    const targetParent = useGroup ? group : head;

    // 已经在正确的位置就不动
    if (entryEl && entryEl.isConnected && entryEl.parentElement === targetParent) return;

    const reuse = entryEl && entryEl.isConnected;
    if (!reuse) {
      entryEl = makeEntry();
      lastEntryX = null;
    }

    if (useGroup) {
      group.insertBefore(entryEl, group.firstChild);
    } else {
      head.appendChild(entryEl);
    }

    // FLIP：从上一处位置滑到新位置
    const r = entryEl.getBoundingClientRect();
    if (lastEntryX !== null && Math.abs(lastEntryX - r.left) > 2) {
      const dx = lastEntryX - r.left;
      entryEl.style.transition = 'none';
      entryEl.style.transform = `translateX(${dx}px)`;
      void entryEl.offsetWidth;
      entryEl.style.transition = 'transform .38s cubic-bezier(.22,1,.36,1)';
      entryEl.style.transform = 'translateX(0)';
      setTimeout(() => {
        if (!entryEl) return;
        entryEl.style.transition = '';
        entryEl.style.transform = '';
      }, 420);
    }
    lastEntryX = r.left;
  }

  // 面板重新渲染时补回去
  const mo = new MutationObserver(() => {
    if (entryEl && entryEl.isConnected) return;
    clearTimeout(injectEntry._t);
    injectEntry._t = setTimeout(injectEntry, 250);
  });
  mo.observe(document.body, { childList: true, subtree: true });
  setInterval(injectEntry, 1500);

  const $ = s => root.querySelector(s);
  const bodyEl = $('.qql-body');
  const stageEl = $('.qql-stage');
  const trackEl = $('.qql-track');
  const titleEl = $('.qql-title');
  const subEl = $('.qql-sub');
  const artEl = $('.qql-art');
  const bgEl = $('.qql-bg');
  const barEl = $('.qql-bar');
  const barFill = $('.qql-bar > i');
  const barKnob = $('.qql-bar > b');
  let scrubbing = false;
  const curEl = $('.qql-cur');
  const durEl = $('.qql-dur');
  const playBtn = $('.qql-play');
  const modeBtn = $('.qql-mode');

  /* ================= 颜色 ================= */
  const colorsWrap = $('.qql-colors');
  PRESETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'qql-color';
    b.style.background = `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
    b.addEventListener('click', () => {
      settings.colors = p.slice();
      settings.colorIndex = i;
      saveSettings();
      applySettings();
    });
    colorsWrap.appendChild(b);
  });

  function applySettings() {
    document.documentElement.style.setProperty('--qql-grad', `linear-gradient(90deg, ${settings.colors.join(',')})`);
    document.body.classList.toggle('qql-trans-on', settings.showTrans);
    $('.qql-trans').classList.toggle('qql-on', settings.showTrans);
    [...colorsWrap.children].forEach((el, i) => el.classList.toggle('qql-on', i === settings.colorIndex));
  }
  applySettings();

  /* ================= 工具 ================= */
  const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const fmtTip = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}''`;
  };
  const getImage = m => m && (m.image_url || m.image_xlarge_url || m.image_large_url || m.image_small_url || '');

  /* ================= 数据 ================= */
  let current = null;
  let rendered = null;

  function setMsg(text) {
    trackEl.innerHTML = `<div class="qql-msg">${text}</div>`;
    rendered = null;
  }

  /** 代理可能刚被拉起，前几次请求失败就重试 */
  async function fetchRetry(url, tries = 4, gap = 1200) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url);
        if (r.ok) return r;
        lastErr = new Error('HTTP ' + r.status);
      } catch (e) { lastErr = e; }
      if (i < tries - 1) await new Promise(res => setTimeout(res, gap));
    }
    throw lastErr;
  }

  async function loadForTrack(item) {
    const uri = item.uri;
    const meta = item.metadata || {};
    const title = meta.title || '';
    const artist = meta.artist_name || '';
    const durationMs = Spicetify.Player.getDuration ? Spicetify.Player.getDuration() : 0;

    titleEl.textContent = title || '—';
    subEl.textContent = artist || '—';

    const img = getImage(meta);
    if (img) {
      artEl.style.backgroundImage = `url("${img}")`;
      bgEl.style.backgroundImage = `url("${img}")`;
    }

    if (!title) { setMsg('未在播放'); return; }

    const cached = localStorage.getItem(CACHE_PREFIX + uri);
    if (cached) {
      try {
        current = Object.assign({}, JSON.parse(cached), { uri });
        buildLyrics();
        return;
      } catch (e) {}
    }

    setMsg('正在从 QQ 音乐获取歌词…');
    try {
      const q = new URLSearchParams({ track: JSON.stringify({ title, artist, durationMs }) });
      const m = await fetchRetry(`${PROXY}/match?${q}`).then(r => r.json());
      if (!m || !m.best) { setMsg('QQ 音乐没搜到这首歌'); return; }

      const data = await fetchRetry(`${PROXY}/lyric?mid=${encodeURIComponent(m.best.songmid)}&id=${encodeURIComponent(m.best.songid)}`).then(r => r.json());
      if (!data || !data.lines || !data.lines.length) { setMsg('这首歌在 QQ 音乐没有歌词'); return; }

      current = Object.assign({}, data, { uri, match: m.best });
      try { localStorage.setItem(CACHE_PREFIX + uri, JSON.stringify(current)); } catch (e) {}
      buildLyrics();
    } catch (e) {
      setMsg('拿不到歌词<br><span style="font-size:11px;color:#666">本地代理没启动？<br>' + PROXY + '</span>');
    }
  }

  /* ================= 渲染 ================= */
  function allocate(tokens, n) {
    if (n <= 0) return tokens.map(() => [0, 0]);
    const total = tokens.reduce((a, x) => a + (x.d || 0), 0) || 1;
    const raw = tokens.map(x => n * (x.d || 0) / total);
    const base = raw.map(Math.floor);
    let rem = n - base.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < rem; k++) base[order[k % order.length][1]]++;
    let c = 0;
    return base.map(b => { const r = [c, c + b]; c += b; return r; });
  }

  /* 版权 / 来源说明行，例如「TME享有本翻译作品的著作权」 */
  const CREDIT_RE = /(TME|QQ\s*音乐|腾讯音乐|酷狗|酷我|网易云|虾米|咪咕).{0,30}(翻译|著作权|版权|提供|制作|出品)|本(翻译|歌词|歌曲).{0,14}(著作权|版权|所有)|(翻译|歌词).{0,10}(由|来自).{0,12}(提供|翻译)/i;
  const isCreditText = s => CREDIT_RE.test((s || '').trim());

  function buildLyrics() {
    if (!current) return;
    const lines = current.lines;
    trackEl.innerHTML = '';
    const items = [];
    const hasTrans = lines.some(l => l.tr && l.tr.trim());

    lines.forEach(ln => {
      const origText = ln.tokens.map(t => t.w).join('');
      if (isCreditText(origText) || isCreditText(ln.tr)) return;   // 丢掉版权/来源说明行

      const lineEl = document.createElement('div');
      lineEl.className = 'qql-line' + (hasTrans && ln.tr ? '' : ' qql-hasnot');

      const rowO = document.createElement('div');
      rowO.className = 'qql-row';
      const o = document.createElement('span');
      o.className = 'qql-o';

      const tip = document.createElement('span');
      tip.className = 'qql-tip';
      const jump = document.createElement('button');
      jump.className = 'qql-jump';
      jump.textContent = '▶';
      jump.title = '从这里播放';
      jump.addEventListener('click', ev => {
        ev.stopPropagation();
        manual = 0;
        manualUntil = 0;
        if (Spicetify.Player.seek) Spicetify.Player.seek(ln.t);
      });
      const tlabel = document.createElement('span');
      tlabel.textContent = fmtTip(ln.t);
      tip.appendChild(jump);
      tip.appendChild(tlabel);

      const oBase = document.createElement('span');
      const oFill = document.createElement('span');
      oFill.className = 'qql-fill';
      const tokEls = ln.tokens.map(tk => {
        const s = document.createElement('span');
        s.textContent = tk.w;
        oBase.appendChild(s);
        return s;
      });
      oFill.innerHTML = oBase.innerHTML;
      o.appendChild(oBase);
      o.appendChild(oFill);
      o.appendChild(tip);
      rowO.appendChild(o);
      lineEl.appendChild(rowO);

      const rowT = document.createElement('div');
      rowT.className = 'qql-row qql-row-t';
      const t = document.createElement('span');
      t.className = 'qql-t';
      const tBase = document.createElement('span');
      const tFill = document.createElement('span');
      tFill.className = 'qql-fill';
      const chars = Array.from(ln.tr || '');
      const visIdx = [];
      chars.forEach((ch, i) => { if (ch !== ' ') visIdx.push(i); });
      const charEls = chars.map(ch => {
        const s = document.createElement('span');
        s.textContent = ch === ' ' ? '\u00A0' : ch;
        tBase.appendChild(s);
        return s;
      });
      tFill.innerHTML = tBase.innerHTML;
      t.appendChild(tBase);
      t.appendChild(tFill);
      rowT.appendChild(t);
      lineEl.appendChild(rowT);

      trackEl.appendChild(lineEl);

      items.push({
        lineEl, oBase, oFill, tBase, tFill, tokEls, charEls, visIdx,
        ranges: allocate(ln.tokens, visIdx.length),
        start: ln.t,
        tokX: null, tokW: null, chX: null, chW: null, measuredW: -1,
      });
    });

    rendered = { items, lines, hasTrans };
    activeIdx = -99;
    autoOff = 0;
    manual = 0;
    updateFrame(0, true);
  }

  function measure(it) {
    const ob = it.oBase.getBoundingClientRect();
    it.tokX = []; it.tokW = [];
    it.tokEls.forEach(s => {
      const r = s.getBoundingClientRect();
      it.tokX.push(r.left - ob.left);
      it.tokW.push(r.width);
    });
    it.chX = []; it.chW = [];
    if (it.visIdx.length) {
      const tb = it.tBase.getBoundingClientRect();
      it.visIdx.forEach(i => {
        const r = it.charEls[i].getBoundingClientRect();
        it.chX.push(r.left - tb.left);
        it.chW.push(r.width);
      });
    }
    it.measuredW = ob.width;
  }

  /* ================= 进度 ================= */
  let lastProg = -1;
  let lastTick = performance.now();

  function nowMs() {
    const p = Spicetify.Player.getProgress ? Spicetify.Player.getProgress() : 0;
    const now = performance.now();
    if (p !== lastProg) { lastProg = p; lastTick = now; }
    const playing = Spicetify.Player.isPlaying ? Spicetify.Player.isPlaying() : false;
    if (!playing) return p;
    return p + Math.min(400, now - lastTick);
  }

  let activeIdx = -99;
  let autoOff = 0;
  let manual = 0;
  let manualUntil = 0;
  let rafId = 0;

  function applyScroll() {
    trackEl.style.transform = `translateY(${-autoOff + manual}px)`;
  }

  function updateFrame(t, force) {
    if (!rendered) return;
    const { items, lines } = rendered;

    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i].t) idx = i;

    const manualActive = performance.now() < manualUntil;

    if (idx !== activeIdx || force) {
      activeIdx = idx;
      items.forEach((it, i) => {
        it.lineEl.classList.toggle('qql-now', i === idx);
        it.lineEl.classList.toggle('qql-past', i < idx);
        const x = i < idx ? '9999px' : '0px';
        it.oFill.style.setProperty('--qql-x', x);
        it.tFill.style.setProperty('--qql-x', x);
      });

      const it = items[idx];
      if (it) {
        try { measure(it); } catch (e) {}
        autoOff = it.lineEl.offsetTop + it.lineEl.offsetHeight / 2 - bodyEl.clientHeight / 2;
        if (!manualActive) manual = 0;
        applyScroll();
      }
    } else if (!manualActive && manual !== 0) {
      manual = 0;
      applyScroll();
    }

    const it = items[idx];
    if (it) {
      if (it.tokX === null || Math.abs(it.oBase.getBoundingClientRect().width - it.measuredW) > 0.5) {
        try { measure(it); } catch (e) {}
      }
      const toks = lines[idx].tokens;
      let ti = -1;
      for (let i = 0; i < toks.length; i++) if (t >= toks[i].t) ti = i;

      if (ti >= 0) {
        const tk = toks[ti];
        const f = Math.min(1, Math.max(0, (t - tk.t) / Math.max(1, tk.d)));
        it.oFill.style.setProperty('--qql-x', ((it.tokX[ti] || 0) + (it.tokW[ti] || 0) * f) + 'px');

        if (it.chX && it.chX.length) {
          const [c0, c1] = it.ranges[ti];
          const pos = c0 + (c1 - c0) * f;
          const ci = Math.min(it.chX.length - 1, Math.max(0, Math.floor(pos)));
          const cf = pos - Math.floor(pos);
          it.tFill.style.setProperty('--qql-x', ((it.chX[ci] || 0) + (it.chW[ci] || 0) * cf) + 'px');
        }
      }
    }

    const dur = Spicetify.Player.getDuration ? Spicetify.Player.getDuration() : 0;
    durEl.textContent = fmt(dur);
    if (!scrubbing) {
      const pct = dur ? Math.min(100, (t / dur) * 100) : 0;
      curEl.textContent = fmt(t);
      barFill.style.width = pct + '%';
      barKnob.style.left = pct + '%';
    }
    const isPlayingNow = !!(Spicetify.Player.isPlaying && Spicetify.Player.isPlaying());
    // 只在状态变化时替换图标：每帧重建会把 SVG 换掉，
    // 导致按下瞬间目标元素被销毁，click 事件丢失（表现为「点不动」）
    if (isPlayingNow !== lastPlayingState) {
      lastPlayingState = isPlayingNow;
      playBtn.innerHTML = isPlayingNow ? ICON.pause : ICON.play;
    }
  }

  function loop() {
    if (!opened) return;
    try { updateFrame(nowMs() + settings.offset); }
    catch (e) { console.error('[QQLyrics]', e); }
    rafId = requestAnimationFrame(loop);
  }

  /* ================= 开关 ================= */
  let opened = false;
  let ox = 0, oy = 0, maxR = 0;

  function setOrigin(el) {
    const W = window.innerWidth, H = window.innerHeight;
    let cx = W / 2, cy = H / 2;
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.width) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    }
    ox = cx; oy = cy;
    maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 60;
  }

  function open(fromEl) {
    if (opened) return;
    opened = true;
    setOrigin(fromEl);
    trackEl.style.transition = '';   // 上次滚动可能残留 none

    root.style.transition = 'none';
    root.style.clipPath = `circle(0px at ${ox}px ${oy}px)`;
    root.classList.add('qql-open');
    void root.offsetWidth;
    root.style.transition = 'clip-path .55s cubic-bezier(.22,1,.36,1)';
    root.style.clipPath = `circle(${maxR}px at ${ox}px ${oy}px)`;

    const item = Spicetify.Player.data && Spicetify.Player.data.item;
    if (item) loadForTrack(item);
    lastProg = -1;
    rafId = requestAnimationFrame(loop);

    setTimeout(() => {
      root.style.transition = '';
      root.style.clipPath = 'none';
    }, 600);
  }

  function close() {
    if (!opened) return;
    opened = false;
    cancelAnimationFrame(rafId);
    root.classList.remove('qql-exp');

    root.style.transition = 'none';
    root.style.clipPath = `circle(${maxR}px at ${ox}px ${oy}px)`;
    void root.offsetWidth;
    root.style.transition = 'clip-path .45s cubic-bezier(.4,0,.7,.2)';
    root.style.clipPath = `circle(0px at ${ox}px ${oy}px)`;

    setTimeout(() => {
      root.classList.remove('qql-open');
      root.style.transition = '';
      root.style.clipPath = '';
    }, 470);
  }

  $('.qql-collapse').addEventListener('click', close);

  /* ================= 交互 ================= */
  $('.qql-trans').addEventListener('click', () => {
    settings.showTrans = !settings.showTrans;
    saveSettings();
    applySettings();
    if (rendered) { rendered.items.forEach(it => { it.measuredW = -1; }); activeIdx = -99; updateFrame(nowMs(), true); }
  });

  artEl.addEventListener('click', () => {
    root.classList.toggle('qql-exp');
    setTimeout(() => { activeIdx = -99; updateFrame(nowMs() + settings.offset, true); }, 500);
  });

  playBtn.addEventListener('click', () => Spicetify.Player.togglePlay && Spicetify.Player.togglePlay());
  $('.qql-bprev').addEventListener('click', () => Spicetify.Player.back && Spicetify.Player.back());
  $('.qql-bnext').addEventListener('click', () => Spicetify.Player.next && Spicetify.Player.next());

  let shuffleState = false;
  function refreshMode() {
    let on = shuffleState;
    try { if (Spicetify.Player.getShuffle) on = !!Spicetify.Player.getShuffle(); } catch (e) { on = shuffleState; }
    shuffleState = on;
    modeBtn.innerHTML = on ? ICON.shuffle : ICON.listloop;
    modeBtn.classList.toggle('qql-on', on);
    modeBtn.title = on ? '随机播放' : '列表循环';
  }
  modeBtn.addEventListener('click', () => {
    shuffleState = !shuffleState;
    try { if (Spicetify.Player.toggleShuffle) Spicetify.Player.toggleShuffle(); } catch (e) {}
    refreshMode();
    setTimeout(refreshMode, 400);
  });
  try { refreshMode(); } catch (e) {}

  /* 音量浮层 */
  const volPop = $('.qql-volpop');
  const volTrack = $('.qql-voltrack');
  const volFill = $('.qql-voltrack > i');
  const volKnob = $('.qql-voltrack > b');
  const volNum = $('.qql-volnum');
  const volBtn = $('.qql-volbtn');

  function paintVol() {
    let v = 0.7;
    try { if (Spicetify.Player.getVolume) v = Spicetify.Player.getVolume(); } catch (e) {}
    const pct = Math.round(v * 100);
    volFill.style.height = pct + '%';
    volKnob.style.bottom = pct + '%';
    volNum.textContent = pct + '%';
  }
  function setVolAt(clientY) {
    const r = volTrack.getBoundingClientRect();
    const p = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    Spicetify.Player.setVolume && Spicetify.Player.setVolume(p);
    paintVol();
  }
  volBtn.addEventListener('click', e => {
    e.stopPropagation();
    const r = volBtn.getBoundingClientRect();
    volPop.style.left = Math.round(r.left + r.width / 2 - 31) + 'px';
    volPop.style.bottom = Math.round(window.innerHeight - r.top + 14) + 'px';
    volPop.classList.toggle('qql-show');
    paintVol();
  });
  volTrack.addEventListener('mousedown', e => {
    e.stopPropagation();
    setVolAt(e.clientY);
    const mv = ev => setVolAt(ev.clientY);
    const up = () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  });
  root.addEventListener('click', e => {
    if (!e.target.closest('.qql-volpop') && !e.target.closest('.qql-volbtn')) volPop.classList.remove('qql-show');
  });

  function seekAt(clientX) {
    const r = barEl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const dur = Spicetify.Player.getDuration ? Spicetify.Player.getDuration() : 0;
    if (dur && Spicetify.Player.seek) Spicetify.Player.seek(p * dur);
    curEl.textContent = fmt(p * dur);
    barFill.style.width = (p * 100) + '%';
    barKnob.style.left = (p * 100) + '%';
  }
  barEl.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    scrubbing = true;
    barEl.classList.add('qql-scrub');
    seekAt(e.clientX);
  });
  window.addEventListener('mousemove', e => {
    if (scrubbing) seekAt(e.clientX);
  });
  window.addEventListener('mouseup', () => {
    if (!scrubbing) return;
    scrubbing = false;
    barEl.classList.remove('qql-scrub');
  });

  /* 滚轮：方向已反转
     这里临时关掉 transition 是为了滚动跟手，
     但必须在一小段时间后恢复，否则换句时的滚动动画会永久失效 */
  let wheelTimer = 0;
  let lastPlayingState = null;

  bodyEl.addEventListener('wheel', e => {
    e.preventDefault();
    manual -= e.deltaY;
    manual = Math.max(-3000, Math.min(3000, manual));
    manualUntil = performance.now() + 4000;
    trackEl.style.transition = 'none';
    applyScroll();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (!dragging) trackEl.style.transition = '';
    }, 260);
  }, { passive: false });

  /* 拖拽 */
  let dragging = false, dragStartY = 0, dragStartManual = 0, moved = 0;
  bodyEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragging = true;
    moved = 0;
    dragStartY = e.clientY;
    dragStartManual = manual;
    manualUntil = performance.now() + 4000;
    bodyEl.classList.add('qql-drag');
    trackEl.style.transition = 'none';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    moved = Math.abs(e.clientY - dragStartY);
    manual = dragStartManual + (e.clientY - dragStartY);
    manual = Math.max(-3000, Math.min(3000, manual));
    manualUntil = performance.now() + 4000;
    applyScroll();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    bodyEl.classList.remove('qql-drag');
    trackEl.style.transition = '';
    manualUntil = performance.now() + 4000;
  });

  /* 歌词区：只拖动/滚动，不再整行点击跳转 */

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      if (opened) close(); else open();
    }
    if (e.key === 'Escape' && opened) close();
  });

  if (Spicetify.Player.addEventListener) {
    Spicetify.Player.addEventListener('songchange', () => {
      if (!opened) return;
      const item = Spicetify.Player.data && Spicetify.Player.data.item;
      if (item) loadForTrack(item);
    });
    Spicetify.Player.addEventListener('onplaypause', () => {
      if (opened) updateFrame(nowMs(), true);
    });
  }

  console.log('[QQLyrics] v3 已加载');
})();
