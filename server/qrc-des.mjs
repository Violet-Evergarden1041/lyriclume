/**
 * QQ 音乐 QRC 解密 —— 魔改 3DES 的 JS 移植
 * 原实现 (Python): chenmozhijin/LDDC  (GPL-3.0)
 * 解密链路: hex → 3DES(ECB, 无填充) → zlib 解压 → QRC/XML
 */

const SBOX = [
  [14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
  [15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
  [10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
  [7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14],
  [2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
  [12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
  [4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
  [13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11],
];

const KPC = [56,48,40,32,24,16,8,0,57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35];
const KPD = [62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,60,52,44,36,28,20,12,4,27,19,11,3];
const KC  = [13,16,10,23,0,4,2,27,14,5,20,9,22,18,11,3,25,7,15,6,26,19,12,1,
             40,51,30,36,46,54,29,39,50,44,32,47,43,48,38,55,33,52,45,41,49,35,28,31];
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];

const ENCRYPT = 1;
const DECRYPT = 0;

function bitnum(a, b, c) {
  return ((a[(((b / 32) | 0) * 4) + 3 - (((b % 32) / 8) | 0)] >>> (7 - (b % 8))) & 1) << c;
}
function bitnumIntr(a, b, c) {
  return (((a >>> (31 - b)) & 1) << c) >>> 0;
}
function bitnumIntl(a, b, c) {
  return (((a << b) & 0x80000000) >>> c);
}
function sboxBit(a) {
  return (a & 32) | ((a & 31) >> 1) | ((a & 1) << 4);
}

function initialPermutation(input) {
  const s0 = (bitnum(input, 57, 31) | bitnum(input, 49, 30) | bitnum(input, 41, 29)
    | bitnum(input, 33, 28) | bitnum(input, 25, 27) | bitnum(input, 17, 26)
    | bitnum(input, 9, 25) | bitnum(input, 1, 24) | bitnum(input, 59, 23)
    | bitnum(input, 51, 22) | bitnum(input, 43, 21) | bitnum(input, 35, 20)
    | bitnum(input, 27, 19) | bitnum(input, 19, 18) | bitnum(input, 11, 17)
    | bitnum(input, 3, 16) | bitnum(input, 61, 15) | bitnum(input, 53, 14)
    | bitnum(input, 45, 13) | bitnum(input, 37, 12) | bitnum(input, 29, 11)
    | bitnum(input, 21, 10) | bitnum(input, 13, 9) | bitnum(input, 5, 8)
    | bitnum(input, 63, 7) | bitnum(input, 55, 6) | bitnum(input, 47, 5)
    | bitnum(input, 39, 4) | bitnum(input, 31, 3) | bitnum(input, 23, 2)
    | bitnum(input, 15, 1) | bitnum(input, 7, 0)) >>> 0;

  const s1 = (bitnum(input, 56, 31) | bitnum(input, 48, 30) | bitnum(input, 40, 29)
    | bitnum(input, 32, 28) | bitnum(input, 24, 27) | bitnum(input, 16, 26)
    | bitnum(input, 8, 25) | bitnum(input, 0, 24) | bitnum(input, 58, 23)
    | bitnum(input, 50, 22) | bitnum(input, 42, 21) | bitnum(input, 34, 20)
    | bitnum(input, 26, 19) | bitnum(input, 18, 18) | bitnum(input, 10, 17)
    | bitnum(input, 2, 16) | bitnum(input, 60, 15) | bitnum(input, 52, 14)
    | bitnum(input, 44, 13) | bitnum(input, 36, 12) | bitnum(input, 28, 11)
    | bitnum(input, 20, 10) | bitnum(input, 12, 9) | bitnum(input, 4, 8)
    | bitnum(input, 62, 7) | bitnum(input, 54, 6) | bitnum(input, 46, 5)
    | bitnum(input, 38, 4) | bitnum(input, 30, 3) | bitnum(input, 22, 2)
    | bitnum(input, 14, 1) | bitnum(input, 6, 0)) >>> 0;

  return [s0, s1];
}

function inversePermutation(s0, s1) {
  const d = new Uint8Array(8);
  d[3] = (bitnumIntr(s1, 7, 7) | bitnumIntr(s0, 7, 6) | bitnumIntr(s1, 15, 5)
        | bitnumIntr(s0, 15, 4) | bitnumIntr(s1, 23, 3) | bitnumIntr(s0, 23, 2)
        | bitnumIntr(s1, 31, 1) | bitnumIntr(s0, 31, 0)) & 0xFF;
  d[2] = (bitnumIntr(s1, 6, 7) | bitnumIntr(s0, 6, 6) | bitnumIntr(s1, 14, 5)
        | bitnumIntr(s0, 14, 4) | bitnumIntr(s1, 22, 3) | bitnumIntr(s0, 22, 2)
        | bitnumIntr(s1, 30, 1) | bitnumIntr(s0, 30, 0)) & 0xFF;
  d[1] = (bitnumIntr(s1, 5, 7) | bitnumIntr(s0, 5, 6) | bitnumIntr(s1, 13, 5)
        | bitnumIntr(s0, 13, 4) | bitnumIntr(s1, 21, 3) | bitnumIntr(s0, 21, 2)
        | bitnumIntr(s1, 29, 1) | bitnumIntr(s0, 29, 0)) & 0xFF;
  d[0] = (bitnumIntr(s1, 4, 7) | bitnumIntr(s0, 4, 6) | bitnumIntr(s1, 12, 5)
        | bitnumIntr(s0, 12, 4) | bitnumIntr(s1, 20, 3) | bitnumIntr(s0, 20, 2)
        | bitnumIntr(s1, 28, 1) | bitnumIntr(s0, 28, 0)) & 0xFF;
  d[7] = (bitnumIntr(s1, 3, 7) | bitnumIntr(s0, 3, 6) | bitnumIntr(s1, 11, 5)
        | bitnumIntr(s0, 11, 4) | bitnumIntr(s1, 19, 3) | bitnumIntr(s0, 19, 2)
        | bitnumIntr(s1, 27, 1) | bitnumIntr(s0, 27, 0)) & 0xFF;
  d[6] = (bitnumIntr(s1, 2, 7) | bitnumIntr(s0, 2, 6) | bitnumIntr(s1, 10, 5)
        | bitnumIntr(s0, 10, 4) | bitnumIntr(s1, 18, 3) | bitnumIntr(s0, 18, 2)
        | bitnumIntr(s1, 26, 1) | bitnumIntr(s0, 26, 0)) & 0xFF;
  d[5] = (bitnumIntr(s1, 1, 7) | bitnumIntr(s0, 1, 6) | bitnumIntr(s1, 9, 5)
        | bitnumIntr(s0, 9, 4) | bitnumIntr(s1, 17, 3) | bitnumIntr(s0, 17, 2)
        | bitnumIntr(s1, 25, 1) | bitnumIntr(s0, 25, 0)) & 0xFF;
  d[4] = (bitnumIntr(s1, 0, 7) | bitnumIntr(s0, 0, 6) | bitnumIntr(s1, 8, 5)
        | bitnumIntr(s0, 8, 4) | bitnumIntr(s1, 16, 3) | bitnumIntr(s0, 16, 2)
        | bitnumIntr(s1, 24, 1) | bitnumIntr(s0, 24, 0)) & 0xFF;
  return d;
}

function f(state, key) {
  const t1 = (bitnumIntl(state, 31, 0) | ((state & 0xF0000000) >>> 1) | bitnumIntl(state, 4, 5)
    | bitnumIntl(state, 3, 6) | ((state & 0x0F000000) >>> 3) | bitnumIntl(state, 8, 11)
    | bitnumIntl(state, 7, 12) | ((state & 0x00F00000) >>> 5) | bitnumIntl(state, 12, 17)
    | bitnumIntl(state, 11, 18) | ((state & 0x000F0000) >>> 7) | bitnumIntl(state, 16, 23)) >>> 0;

  const t2 = (bitnumIntl(state, 15, 0) | ((state & 0x0000F000) << 15) | bitnumIntl(state, 20, 5)
    | bitnumIntl(state, 19, 6) | ((state & 0x00000F00) << 13) | bitnumIntl(state, 24, 11)
    | bitnumIntl(state, 23, 12) | ((state & 0x000000F0) << 11) | bitnumIntl(state, 28, 17)
    | bitnumIntl(state, 27, 18) | ((state & 0x0000000F) << 9) | bitnumIntl(state, 0, 23)) >>> 0;

  const lg = [
    (t1 >>> 24) & 0xFF, (t1 >>> 16) & 0xFF, (t1 >>> 8) & 0xFF,
    (t2 >>> 24) & 0xFF, (t2 >>> 16) & 0xFF, (t2 >>> 8) & 0xFF,
  ];
  const st = [lg[0] ^ key[0], lg[1] ^ key[1], lg[2] ^ key[2],
              lg[3] ^ key[3], lg[4] ^ key[4], lg[5] ^ key[5]];

  const out = ((SBOX[0][sboxBit(st[0] >> 2)] << 28)
    | (SBOX[1][sboxBit(((st[0] & 0x03) << 4) | (st[1] >> 4))] << 24)
    | (SBOX[2][sboxBit(((st[1] & 0x0F) << 2) | (st[2] >> 6))] << 20)
    | (SBOX[3][sboxBit(st[2] & 0x3F)] << 16)
    | (SBOX[4][sboxBit(st[3] >> 2)] << 12)
    | (SBOX[5][sboxBit(((st[3] & 0x03) << 4) | (st[4] >> 4))] << 8)
    | (SBOX[6][sboxBit(((st[4] & 0x0F) << 2) | (st[5] >> 6))] << 4)
    | SBOX[7][sboxBit(st[5] & 0x3F)]) >>> 0;

  return (bitnumIntl(out, 15, 0) | bitnumIntl(out, 6, 1) | bitnumIntl(out, 19, 2)
    | bitnumIntl(out, 20, 3) | bitnumIntl(out, 28, 4) | bitnumIntl(out, 11, 5)
    | bitnumIntl(out, 27, 6) | bitnumIntl(out, 16, 7) | bitnumIntl(out, 0, 8)
    | bitnumIntl(out, 14, 9) | bitnumIntl(out, 22, 10) | bitnumIntl(out, 25, 11)
    | bitnumIntl(out, 4, 12) | bitnumIntl(out, 17, 13) | bitnumIntl(out, 30, 14)
    | bitnumIntl(out, 9, 15) | bitnumIntl(out, 1, 16) | bitnumIntl(out, 7, 17)
    | bitnumIntl(out, 23, 18) | bitnumIntl(out, 13, 19) | bitnumIntl(out, 31, 20)
    | bitnumIntl(out, 26, 21) | bitnumIntl(out, 2, 22) | bitnumIntl(out, 8, 23)
    | bitnumIntl(out, 18, 24) | bitnumIntl(out, 12, 25) | bitnumIntl(out, 29, 26)
    | bitnumIntl(out, 5, 27) | bitnumIntl(out, 21, 28) | bitnumIntl(out, 10, 29)
    | bitnumIntl(out, 3, 30) | bitnumIntl(out, 24, 31)) >>> 0;
}

function crypt(input, key) {
  let [s0, s1] = initialPermutation(input);
  for (let i = 0; i < 15; i++) {
    const prev = s1;
    s1 = (f(s1, key[i]) ^ s0) >>> 0;
    s0 = prev;
  }
  s0 = (f(s1, key[15]) ^ s0) >>> 0;
  return inversePermutation(s0, s1);
}

function keySchedule(key, mode) {
  const schedule = Array.from({ length: 16 }, () => new Array(6).fill(0));
  let c = 0, d = 0;
  for (let i = 0; i < 28; i++) c = (c | bitnum(key, KPC[i], 31 - i)) >>> 0;
  for (let i = 0; i < 28; i++) d = (d | bitnum(key, KPD[i], 31 - i)) >>> 0;

  for (let i = 0; i < 16; i++) {
    const sh = SHIFTS[i];
    c = (((c << sh) | (c >>> (28 - sh))) & 0xFFFFFFF0) >>> 0;
    d = (((d << sh) | (d >>> (28 - sh))) & 0xFFFFFFF0) >>> 0;

    const togen = mode === DECRYPT ? 15 - i : i;
    schedule[togen].fill(0);
    for (let j = 0; j < 24; j++) schedule[togen][j >> 3] |= bitnumIntr(c, KC[j], 7 - (j % 8));
    for (let j = 24; j < 48; j++) schedule[togen][j >> 3] |= bitnumIntr(d, KC[j] - 27, 7 - (j % 8));
  }
  return schedule;
}

function tripledesKeySetup(key, mode) {
  if (mode === ENCRYPT) {
    return [keySchedule(key.slice(0, 8), ENCRYPT), keySchedule(key.slice(8, 16), DECRYPT), keySchedule(key.slice(16, 24), ENCRYPT)];
  }
  return [keySchedule(key.slice(16, 24), DECRYPT), keySchedule(key.slice(8, 16), ENCRYPT), keySchedule(key.slice(0, 8), DECRYPT)];
}

function tripledesCrypt(data, ks) {
  let out = data;
  for (let i = 0; i < 3; i++) out = crypt(out, ks[i]);
  return out;
}

export const QRC_KEY = '!@#)(*$%123ZXC!@!@#)(NHL';

export function hexToBytes(hex) {
  const h = hex.trim();
  const n = h.length >> 1;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

/** 解密 QRC 密文（hex 字符串），返回解压后的明文字节 */
export function qrcDecrypt(hex, keyString = QRC_KEY) {
  const data = hexToBytes(hex);
  const key = new Uint8Array(keyString.length);
  for (let i = 0; i < keyString.length; i++) key[i] = keyString.charCodeAt(i) & 0xFF;

  const ks = tripledesKeySetup(key, DECRYPT);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 8) {
    out.set(tripledesCrypt(data.subarray(i, i + 8), ks), i);
  }
  return out;
}

/**
 * 解压（zlib）。浏览器 / Node 都能用。
 * 密文按 8 字节分块，解出来的明文末尾带着几个字节的填充垃圾，
 * 而 DecompressionStream 遇到多余尾巴会报错，所以从尾部逐字节往回试。
 */
export async function inflateZlib(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    const { inflateSync, constants } = await import('node:zlib');
    return new Uint8Array(inflateSync(Buffer.from(bytes), { finishFlush: constants.Z_SYNC_FLUSH }));
  }

  let lastErr;
  const maxCut = Math.min(16, bytes.length - 8);
  for (let cut = 0; cut <= maxCut; cut++) {
    const slice = cut === 0 ? bytes : bytes.subarray(0, bytes.length - cut);
    try {
      const ds = new DecompressionStream('deflate');
      const stream = new Blob([slice]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** 一步到位：hex 密文 → QRC 明文（字符串） */
export async function decryptQrc(hex) {
  const raw = qrcDecrypt(hex);
  const plain = await inflateZlib(raw);
  return new TextDecoder('utf-8').decode(plain);
}
