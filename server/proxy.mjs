/**
 * QQLyrics 本地代理
 * 只为解决 CORS：把 QQ 音乐接口转发到 http://127.0.0.1:8787
 * 只监听本机，不对外暴露。
 */
import http from 'node:http';
import { searchSongs, getSongLyrics, matchTrack } from './qq.mjs';

const PORT = 8787;
const HOST = '127.0.0.1';

/* 简单内存缓存，避免同一首歌反复请求 */
const cache = new Map();
const CACHE_MAX = 200;

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  const u = new URL(req.url, `http://${HOST}:${PORT}`);

  try {
    if (u.pathname === '/health') {
      return json(res, 200, { ok: true, name: 'qqlyrics-proxy', version: 1 });
    }

    if (u.pathname === '/search') {
      const w = u.searchParams.get('w') || '';
      if (!w) return json(res, 400, { error: 'missing w' });
      const key = 's:' + w;
      if (cache.has(key)) return json(res, 200, cache.get(key));
      const list = await searchSongs(w, 10);
      cache.set(key, list);
      return json(res, 200, list);
    }

    if (u.pathname === '/lyric') {
      const mid = u.searchParams.get('mid');
      const id = u.searchParams.get('id');
      if (!mid || !id) return json(res, 400, { error: 'missing mid/id' });
      const key = `l:${mid}:${id}`;
      if (cache.has(key)) return json(res, 200, cache.get(key));
      const data = await getSongLyrics(mid, id);
      if (cache.size > CACHE_MAX) cache.clear();
      cache.set(key, data);
      return json(res, 200, data);
    }

    if (u.pathname === '/match') {
      const track = JSON.parse(u.searchParams.get('track') || '{}');
      const m = await matchTrack(track);
      return json(res, 200, m);
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('[proxy]', u.pathname, e);
    return json(res, 500, { error: String(e && e.message || e) });
  }
});

server.on('error', e => {
  // 端口已被占用 = 已经有一个在跑，直接安静退出
  if (e && e.code === 'EADDRINUSE') process.exit(0);
  console.error('[proxy]', e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`QQLyrics proxy listening on http://${HOST}:${PORT}`);
});

