/**
 * public/assets 의 PNG 를 WebP 로 변환한다.
 *
 *   node scripts/optimize-assets.mjs           # 변환만 (원본 PNG 유지)
 *   node scripts/optimize-assets.mjs --delete  # 변환 후 원본 PNG 삭제
 *
 * 게임 아트가 대부분 회화풍이라 lossy q90 에서 육안 차이 없이 90% 이상 줄어든다.
 * 새 PNG 에셋을 추가한 뒤 다시 실행하면 된다.
 */
import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'public/assets';
const QUALITY = 90;
const shouldDelete = process.argv.includes('--delete');

async function collectPngs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectPngs(full)));
    else if (entry.name.toLowerCase().endsWith('.png')) out.push(full);
  }
  return out;
}

const kb = (n) => (n / 1024).toFixed(0).padStart(6) + ' KB';
const mb = (n) => (n / 1048576).toFixed(1);

const pngs = (await collectPngs(ROOT)).sort();
let before = 0;
let after = 0;

for (const png of pngs) {
  const webp = png.replace(/\.png$/i, '.webp');
  const src = await stat(png);
  await sharp(png)
    .webp({ quality: QUALITY, alphaQuality: 100, effort: 6 })
    .toFile(webp);
  const dst = await stat(webp);

  before += src.size;
  after += dst.size;
  const pct = (100 - (dst.size / src.size) * 100).toFixed(0);
  console.log(`${kb(src.size)} -> ${kb(dst.size)}  (-${pct.padStart(2)}%)  ${relative(ROOT, png)}`);

  if (shouldDelete) await unlink(png);
}

console.log(
  `\n${pngs.length} files: ${mb(before)} MB -> ${mb(after)} MB  (-${(100 - (after / before) * 100).toFixed(1)}%)`,
);
