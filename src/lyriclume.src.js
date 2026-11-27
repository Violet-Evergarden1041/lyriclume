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
  const CACHE_PREFIX = 'qql.lyric2.';

  /* ---------- 歌词缓存管理 ----------
   * localStorage 只有 5~10MB，一首歌大约 10~25KB，
   * 所以：限制条数（LRU）+ 30 天过期 + 配额满了自动清理。 */
  const CACHE_MAX = 240;
  const CACHE_TTL = 30 * 24 * 3600 * 1000;

  function cacheKeys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('qql.lyric') === 0) out.push(k);
    }
    return out;
  }

  function cacheGet(uri) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + uri);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (o && o.savedAt && Date.now() - o.savedAt > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + uri);
        return null;
      }
      return o;
    } catch (e) {
      return null;
    }
  }

  function cacheHas(uri) {
    return !!localStorage.getItem(CACHE_PREFIX + uri);
  }

  /** 清掉 v1 老缓存 + 过期条目；dropCount > 0 时再按时间删掉最旧的一批 */
  function cacheSweep(dropCount) {
    const now = Date.now();
    const alive = [];
    for (const k of cacheKeys()) {
      if (k.indexOf(CACHE_PREFIX) !== 0) {     // qql.lyric.* 旧版本，直接删
        localStorage.removeItem(k);
        continue;
      }
      let t = 0;
      try { t = (JSON.parse(localStorage.getItem(k)) || {}).savedAt || 0; } catch (e) {}
      if (t && now - t > CACHE_TTL) { localStorage.removeItem(k); continue; }
      alive.push({ k, t });
    }
    const need = alive.length - CACHE_MAX + (dropCount || 0);
    if (need > 0) {
      alive.sort((a, b) => a.t - b.t);
      for (let i = 0; i < need && i < alive.length; i++) localStorage.removeItem(alive[i].k);
    }
  }

  function cacheSet(uri, obj) {
    const payload = JSON.stringify({
      savedAt: Date.now(),
      lines: obj.lines,
      source: obj.source,
      hasTrans: obj.hasTrans,
    });
    try {
      localStorage.setItem(CACHE_PREFIX + uri, payload);
    } catch (e) {
      // 配额满了：清掉最旧的一半再试一次
      try {
        cacheSweep(Math.ceil(CACHE_MAX / 2));
        localStorage.setItem(CACHE_PREFIX + uri, payload);
      } catch (e2) { return; }
    }
    if (cacheKeys().length > CACHE_MAX) cacheSweep(0);
  }

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

  const css = __QQL_CSS__;

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

  /* ================= 入口按钮：只保留播放栏一个 ================= */
  let barPill = null;

  function makeEntry() {
    const b = document.createElement('button');
    b.className = 'qql-pillbar';
    b.title = `打开 ${APP_NAME}（Ctrl+Shift+L）`;
    b.textContent = APP_NAME;
    b.addEventListener('click', e => {
      e.stopPropagation();
      open(b);
    });
    return b;
  }

  /** 按钮紧跟在「歌名 + 勾选」后面，垂直居中 */
  function injectBarEntry() {
    const left = document.querySelector('.main-nowPlayingBar-left');
    if (!left) return;

    let hasTrack = false;
    try { hasTrack = !!(Spicetify.Player.data && Spicetify.Player.data.item); } catch (e) {}
    if (!hasTrack) {
      if (barPill) barPill.style.display = 'none';
      return;
    }

    if (!barPill) barPill = makeEntry();
    if (getComputedStyle(left).position === 'static') left.style.position = 'relative';
    if (barPill.parentElement !== left) left.appendChild(barPill);

    // 锚点：正在播放组件的最后一个子元素（通常是勾选按钮）
    const widget = left.querySelector('[data-testid="now-playing-widget-v2"]');
    const kids = widget ? [...widget.children] : [];
    const anchor = kids.length ? kids[kids.length - 1] : null;
    if (anchor) {
      const lr = left.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      barPill.style.left = Math.round(ar.right - lr.left + 12) + 'px';
      barPill.style.right = 'auto';
    }
    barPill.style.display = '';
  }

  setInterval(injectBarEntry, 1500);
  setInterval(updateFabs, 300);   // 右上角浮动按钮的位置与显隐
  try { cacheSweep(0); } catch (e) {}   // 启动时清 v1 老缓存 + 过期条目
  setTimeout(prefetchQueue, 4000);
  setInterval(prefetchQueue, 5000);   // 队列变化（手动加歌等）也能覆盖
  injectBarEntry();

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

    const cached = cacheGet(uri);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        const nrm0 = s => (s || '').replace(/\s+/g, '').toLowerCase();
        const tN0 = nrm0(title);
        const usable0 = (c.lines || []).filter(ln => {
          const txt = nrm0((ln.tokens || []).map(t => t.w).join(''));
          if (!txt) return false;
          if (tN0.length >= 1 && txt.startsWith(tN0) && txt.length > tN0.length + 4) return false;
          return true;
        });
        if (usable0.length >= 2) {
          current = Object.assign({}, c, { uri });
          buildLyrics();
          return;
        }
        localStorage.removeItem(CACHE_PREFIX + uri);   // 坏缓存，丢掉重取
      } catch (e) {
        localStorage.removeItem(CACHE_PREFIX + uri);
      }
    }

    setMsg('正在加载歌词…');
    try {
      const q = new URLSearchParams({ track: JSON.stringify({ title, artist, durationMs }) });
      // 服务端统一处理：网易云优先，失败自动退回 QQ
      const data = await fetchRetry(`${PROXY}/resolve?${q}`, 2, 2500).then(r => r.json());
      if (!data || !data.source || !(data.lines || []).length) {
        setMsg('无法加载歌词');
        current = null;
        return;
      }
      current = { lines: data.lines, uri, source: data.source, match: data.match, hasTrans: data.hasTrans };
      cacheSet(uri, current);
      buildLyrics();
    } catch (e) {
      setMsg('无法加载歌词');
    }
  }

  /* ---- 预加载：队列里接下来的 9 首 ---- */
  const prefetching = new Set();
  let lastPrefetchAt = 0;

  // 预加载窗口：开始 10 首；同一个列表连续播放、窗口内全都有缓存后收缩到 5 首
  const PREFETCH_START = 10;
  const PREFETCH_MIN = 5;
  let prefetchDepth = PREFETCH_START;
  let prefetchSatisfied = 0;

  function currentContextUri() {
    try {
      const it = Spicetify.Player.data && Spicetify.Player.data.item;
      return (it && it.metadata && it.metadata.context_uri) || '';
    } catch (e) { return ''; }
  }

  async function prefetchQueue() {
    let items = [];
    try {
      const q = await Spicetify.Platform.PlayerAPI.getQueue();
      items = [...(q.nextUp || []), ...(q.queued || [])];
    } catch (e) {}
    if (!items.length) {
      try {
        const st = Spicetify.Platform.PlayerAPI.getState();
        items = (st.nextItems || []).map(x => (x && x.item) ? x.item : x).filter(Boolean);
      } catch (e) {}
    }

    const list = items.map(it => ({
      uri: it.uri,
      title: it.name || (it.metadata && it.metadata.title) || '',
      artist: (it.artists && it.artists[0] && it.artists[0].name) || (it.metadata && it.metadata.artist_name) || '',
      durationMs: (it.duration && it.duration.milliseconds) || 0,
    }))
      .filter(t => t.uri && t.uri.indexOf('spotify:track:') === 0 && t.title)
      .slice(0, prefetchDepth);

    // 同一个列表里，窗口内已经全部有缓存 → 把窗口从 10 收缩到 5
    const missing = list.filter(t => !cacheHas(t.uri) && !prefetching.has(t.uri));
    if (list.length >= 5 && !missing.length) {
      prefetchSatisfied++;
      if (prefetchSatisfied >= 2 && prefetchDepth > PREFETCH_MIN) prefetchDepth = PREFETCH_MIN;
    } else if (missing.length) {
      prefetchSatisfied = 0;
    }

    for (const t of list) {
      if (prefetching.has(t.uri)) continue;
      if (cacheHas(t.uri)) continue;
      prefetching.add(t.uri);
      try {
        const q = new URLSearchParams({ track: JSON.stringify({ title: t.title, artist: t.artist, durationMs: t.durationMs }) });
        const data = await fetchRetry(`${PROXY}/resolve?${q}`, 1, 800).then(r => r.json());
        if (data && data.source && (data.lines || []).length) {
          cacheSet(t.uri, { lines: data.lines, source: data.source, hasTrans: data.hasTrans });
        }
      } catch (e) { /* 单首失败不影响其他 */ }
      prefetching.delete(t.uri);
      await new Promise(r => setTimeout(r, 900));   // 放慢，避免被源站限流
    }
  }

/* ================= 右上角浮动按钮 ================= */
  const JUMP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  const TOP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16"/><path d="M12 20V9"/><path d="M6 14l6-6 6 6"/></svg>';

  let jumpBtn = null;
  let topBtn = null;
  let fabPlaced = false;

  function listScrollNode() {
    const page = document.querySelector('[data-testid="playlist-page"], [data-testid="album-page"]');
    if (!page) return null;
    let p = page;
    for (let i = 0; i < 8 && p; i++) {
      const s = getComputedStyle(p);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 50) return p;
      p = p.parentElement;
    }
    return null;
  }

  function fabAnchor() {
    const sc = listScrollNode();
    if (!sc) return null;
    const tb = document.querySelector('[data-testid="topbar"]');
    if (!tb) return null;
    const r = tb.getBoundingClientRect();
    if (!r.width) return null;
    return { sc, x: r.right - 42, y: r.top + r.height / 2 - 16 };
  }

  /** Spotify 的滚动容器会忽略 scrollTo({behavior:'smooth'})，只能自己补间 */
  function smoothScrollTo(sc, target, dur) {
    const from = sc.scrollTop;
    const delta = target - from;
    if (Math.abs(delta) < 2) return;
    const t0 = performance.now();
    const total = dur || 340;
    // 用 setInterval：窗口被遮挡时 requestAnimationFrame 不触发，滚动会静默失效
    const timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / total);
      const e = 1 - Math.pow(1 - p, 3);
      sc.scrollTop = from + delta * e;
      if (p >= 1) clearInterval(timer);
    }, 16);
  }

  function makeFab(id, title, icon, onClick) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'qql-fab';
    b.title = title;
    b.innerHTML = icon;
    b.style.opacity = '0';
    b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    document.body.appendChild(b);
    return b;
  }

  function ensureFabs() {
    if (!jumpBtn || !document.body.contains(jumpBtn)) {
      jumpBtn = makeFab('qql-jump', '回到正在播放', JUMP_ICON, () => jumpToPlaying());
    }
    if (!topBtn || !document.body.contains(topBtn)) {
      topBtn = makeFab('qql-top', '回到顶部', TOP_ICON, () => {
        const sc = listScrollNode();
        if (sc) smoothScrollTo(sc, 0);
      });
    }
  }

function updateFabs() {
    ensureFabs();

    // 译光面板打开时，这两个按钮要让位
    const rootEl = document.querySelector('.qql-root');
    if (rootEl && rootEl.classList.contains('qql-open')) {
      jumpBtn.style.opacity = '0';
      topBtn.style.opacity = '0';
      jumpBtn.style.pointerEvents = 'none';
      topBtn.style.pointerEvents = 'none';
      return;
    }

    const a = fabAnchor();
    if (!a) {
      // 还在列表页、只是顶栏一瞬间没渲染出来：保持原位，避免按钮闪烁导致点不中
      if (fabPlaced && listScrollNode()) {
        jumpBtn.style.opacity = '1';
        topBtn.style.opacity = '1';
        jumpBtn.style.pointerEvents = 'auto';
        topBtn.style.pointerEvents = 'auto';
        return;
      }
      jumpBtn.style.opacity = '0';
      topBtn.style.opacity = '0';
      jumpBtn.style.pointerEvents = 'none';
      topBtn.style.pointerEvents = 'none';
      fabPlaced = false;
      return;
    }
    jumpBtn.style.pointerEvents = 'auto';
    topBtn.style.pointerEvents = 'auto';
    jumpBtn.style.left = Math.round(a.x) + 'px';
    jumpBtn.style.top = Math.round(a.y) + 'px';
    topBtn.style.left = Math.round(a.x - 40) + 'px';
    topBtn.style.top = Math.round(a.y) + 'px';
    jumpBtn.style.opacity = '1';
    topBtn.style.opacity = a.sc.scrollTop > 80 ? '1' : '.3';
    fabPlaced = true;
  }

  function currentTrackTitle() {
    try {
      const it = Spicetify.Player.data && Spicetify.Player.data.item;
      return (it && it.metadata && it.metadata.title) || '';
    } catch (e) { return ''; }
  }

  function findPlayingRow(sc) {
    const icon = document.querySelector('[data-testid="playing-icon"], .main-trackList-playingIcon');
    if (icon) {
      const r = icon.closest('[role="row"]');
      if (r) return r;
    }
    const title = currentTrackTitle();
    if (!title) return null;
    for (const r of sc.querySelectorAll('[role="row"]')) {
      if (r.getAttribute('aria-rowindex') === '1') continue;
      if ((r.innerText || '').indexOf(title) >= 0) return r;
    }
    return null;
  }

  function flashFab(btn) {
    if (!btn) return;
    btn.classList.add('qql-fab-nope');
    setTimeout(() => btn.classList.remove('qql-fab-nope'), 420);
  }

  function jumpToPlaying() {
    const sc = listScrollNode();
    if (!sc) { flashFab(jumpBtn); return; }

    const row = findPlayingRow(sc);
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    // 列表虚拟滚动，远处的行还没渲染：按曲目序号估算
    let idx = -1;
    try {
      const raw = Spicetify.Platform.PlayerAPI.getState().index;
      if (typeof raw === 'number') idx = raw;
      else if (raw && typeof raw.itemIndex === 'number') idx = raw.itemIndex;
    } catch (e) {}
    if (idx < 0) { flashFab(jumpBtn); return; }

    const rows = [...sc.querySelectorAll('[role="row"]')].filter(r => r.getAttribute('aria-rowindex') !== '1');
    if (!rows.length) { flashFab(jumpBtn); return; }
    const first = rows[0];
    const firstIdx = Math.max(0, (+first.getAttribute('aria-rowindex') || 2) - 2);
    const rowH = first.getBoundingClientRect().height || 56;
    const scRect = sc.getBoundingClientRect();
    const absFirst = first.getBoundingClientRect().top - scRect.top + sc.scrollTop;
    const absTarget = absFirst + (idx - firstIdx) * rowH;
    smoothScrollTo(sc, Math.max(0, absTarget - sc.clientHeight / 2 + rowH / 2));
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

    // 过滤掉「歌名 - 歌手」这类元信息行，以及时间超出歌曲长度的行
    const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
    let metaDur = 0;
    try { metaDur = Spicetify.Player.getDuration ? Spicetify.Player.getDuration() : 0; } catch (e) {}
    const tNorm = norm(titleEl.textContent);
    const aNorm = norm(subEl.textContent);
    const keep = ln => {
      const txt = norm(ln.tokens.map(t => t.w).join(''));
      if (!txt) return false;
      if (metaDur && ln.t > metaDur + 5000) return false;
      if (txt === tNorm) return false;
      if (tNorm.length >= 1 && aNorm && txt.includes(tNorm) && txt.includes(aNorm)) return false;
      if (tNorm.length >= 1 && txt.startsWith(tNorm) && txt.length > tNorm.length + 3) return false;   // 歌名 - 歌手
      return true;
    };

    lines.filter(keep).forEach(ln => {
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

    // 兜底：如果过滤规则把整首歌词都干掉了，就直接显示原始行，别让用户看到空白
    if (!items.length) {
      trackEl.innerHTML = '';
      const rawItems = [];
      lines.forEach(ln => {
        const txt = (ln.tokens || []).map(t => t.w).join('');
        if (!txt.trim()) return;
        const el = document.createElement('div');
        el.className = 'qql-line';
        const o = document.createElement('div');
        o.className = 'qql-row';
        const os = document.createElement('span');
        os.className = 'qql-o';
        os.textContent = txt;
        o.appendChild(os);
        el.appendChild(o);
        if (ln.tr) {
          const t2 = document.createElement('div');
          t2.className = 'qql-row qql-row-t';
          const ts = document.createElement('span');
          ts.className = 'qql-t';
          ts.textContent = ln.tr;
          t2.appendChild(ts);
          el.appendChild(t2);
        }
        trackEl.appendChild(el);
        rawItems.push(null);
      });
      if (!rawItems.length) { setMsg('无法加载歌词'); return; }
      rendered = { items: [], lines, hasTrans, raw: true };
      return;
    }

    rendered = { items, lines, hasTrans };
    activeIdx = -99;
    autoOff = 0;
    manual = 0;
    requestAnimationFrame(() => { try { updateFrame(nowMs() + settings.offset, true); } catch (e) {} });
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
    // 播放图标放在最前面：即使后面任何一步抛错，图标也能正确刷新
    try {
      const isPlayingNow = !!(Spicetify.Player.isPlaying && Spicetify.Player.isPlaying());
      // 只在状态变化时替换图标：每帧重建会把 SVG 换掉，
      // 导致按下瞬间目标元素被销毁，click 事件丢失（表现为「点不动」）
      if (isPlayingNow !== lastPlayingState) {
        lastPlayingState = isPlayingNow;
        playBtn.innerHTML = isPlayingNow ? ICON.pause : ICON.play;
      }
    } catch (e) {}

    // 进度条
    try {
      const dur = Spicetify.Player.getDuration ? Spicetify.Player.getDuration() : 0;
      durEl.textContent = fmt(dur);
      if (!scrubbing) {
        const pct = dur ? Math.min(100, (t / dur) * 100) : 0;
        curEl.textContent = fmt(t);
        barFill.style.width = pct + '%';
        barKnob.style.left = pct + '%';
      }
    } catch (e) {}

    // 快播完了就立刻补拉队列（不用等定时器）
    try {
      if (dur && t > 0 && dur - t < 45000 && performance.now() - lastPrefetchAt > 4000) {
        lastPrefetchAt = performance.now();
        prefetchQueue();
      }
    } catch (e) {}

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
    // 延后到下一帧：先让展开动画拿到第一帧，避免点击瞬间卡住
    setTimeout(() => { if (opened && item) loadForTrack(item); }, 24);
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
    if (!rendered) return;   // 没有歌词时不允许滚动
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
      const item = Spicetify.Player.data && Spicetify.Player.data.item;
      if (item) loadForTrack(item);
      // 换了播放列表就把预加载窗口重置回 10 首
      const ctx = currentContextUri();
      if (ctx && ctx !== lastContextUri) {
        lastContextUri = ctx;
        prefetchDepth = PREFETCH_START;
        prefetchSatisfied = 0;
      }
      setTimeout(prefetchQueue, 1500);
    });
    Spicetify.Player.addEventListener('onplaypause', () => {
      if (opened) updateFrame(nowMs(), true);
    });
  }

  console.log('[QQLyrics] v3 已加载');
})();
