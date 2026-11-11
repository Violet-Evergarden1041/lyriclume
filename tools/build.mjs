// 构建脚本：把 src/style.css 内联进 src/lyriclume.src.js，输出 extension/lyriclume.js
// 用法: node tools/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lyriclume.src.js'), 'utf8');
const css = readFileSync(join(root, 'src/style.css'), 'utf8');

if (!src.includes('__QQL_CSS__')) {
  console.error('src/lyriclume.src.js 里没有 __QQL_CSS__ 占位符');
  process.exit(1);
}

const out = src.replace('__QQL_CSS__', JSON.stringify(css));
writeFileSync(join(root, 'extension/lyriclume.js'), out, 'utf8');

console.log(`built extension/lyriclume.js  (${out.length} bytes, css ${css.length})`);
