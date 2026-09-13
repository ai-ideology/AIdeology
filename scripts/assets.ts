/**
 * Asset pipeline: reads the 26 source hero composites, derives each ideology's
 * accent color from the artwork, and emits web-optimized WebP variants:
 *   public/assets/hero/<slug>.webp  full composite (share cards)
 *   public/assets/char/<slug>.webp  right-side character crop (detail/result hero)
 *   public/assets/thumb/<slug>.webp small library thumbnail
 * Also writes src/content/derived-colors.json so the palette stays tied to art.
 */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = '/app/设计方案/AI意识形态26个图';
const OUT = '/app/public/assets';

// slug -> source file base name (matches the frozen v1 ideology names)
const MAP: Record<string, string> = {
  promethean: '普罗米修斯加速主义',
  'safe-progress': '安全进步主义',
  survival: '文明生存主义',
  pause: 'AI暂停主义',
  normalism: 'AI常态现实主义',
  'digital-humanism': '数字人文主义',
  transhumanism: '超人类主义',
  symbiosis: '人机共生主义',
  'human-primacy': '人类本位主义',
  'digital-life': '数字生命主义',
  augmentation: '人类增强主义',
  substitution: '机器替代主义',
  'work-humanism': '劳动人文主义',
  'post-work': '后劳动主义',
  'intelligence-capitalism': '智能资本主义',
  'social-dividend': 'AI社会红利主义',
  'intelligence-commons': '智能公共主义',
  'human-autonomy': '人类自主主义',
  'algorithmic-opt': '算法最优主义',
  'digital-democracy': '数字民主主义',
  'machine-technocracy': '机器技治主义',
  'open-intelligence': '开放智能主义',
  'controlled-intelligence': '智能管制主义',
  'ai-sovereignty': 'AI主权主义',
  'ai-internationalism': 'AI国际主义',
  'arms-race': '军备竞速主义',
};

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

/** Dominant vivid hue, ignoring near-white / near-black / washed pixels. */
async function accentColor(file: string): Promise<string> {
  const { data, info } = await sharp(file)
    .resize(220, 124, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bins = new Array(36).fill(0);
  let sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    if (s < 0.45 || l < 0.18 || l > 0.9) continue; // skip greys / whites / blacks
    const bin = Math.floor(h / 10) % 36;
    bins[bin]++;
    sr += r; sg += g; sb += b;
  }
  const total = bins.reduce((a, b) => a + b, 0);
  if (!total) return '#FF3B30';
  // weighted circular mean of the winning hue neighbourhood
  let best = 0;
  for (let i = 1; i < 36; i++) if (bins[i] > bins[best]) best = i;
  let x = 0, y = 0, wsum = 0, rr = 0, gg = 0, bb = 0;
  for (let i = 0; i < 36; i++) {
    const w = bins[i];
    if (!w) continue;
    const ang = (i * 10 + 5) * Math.PI / 180;
    x += w * Math.cos(ang); y += w * Math.sin(ang); wsum += w;
  }
  void x; void y; void wsum;
  // sample actual pixels near the winning hue for average rgb
  let n = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    if (s < 0.45 || l < 0.18 || l > 0.9) continue;
    if (Math.floor(h / 10) % 36 !== best) continue;
    rr += r; gg += g; bb += b; n++;
  }
  if (!n) return '#FF3B30';
  let R = Math.round(rr / n), G = Math.round(gg / n), B = Math.round(bb / n);
  // force display-saturated, legible-on-white accent
  const { h } = rgbToHsl(R, G, B);
  const hsl = `hsl(${h.toFixed(0)} 88% 46%)`;
  const out = await sharp({ create: { width: 2, height: 2, channels: 3, background: hsl } })
    .raw().toBuffer();
  void out;
  // manual hsl->rgb for stable hex
  const c = (1 - Math.abs(2 * 0.46 - 1)) * 0.88;
  const hp = h / 60;
  const X = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, X, 0];
  else if (hp < 2) [r1, g1, b1] = [X, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, X];
  else if (hp < 4) [r1, g1, b1] = [0, X, c];
  else if (hp < 5) [r1, g1, b1] = [X, 0, c];
  else [r1, g1, b1] = [c, 0, X];
  const m = 0.46 - c / 2;
  R = Math.round((r1 + m) * 255); G = Math.round((g1 + m) * 255); B = Math.round((b1 + m) * 255);
  return '#' + [R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const colors: Record<string, string> = {};
await mkdir(`${OUT}/hero`, { recursive: true });
await mkdir(`${OUT}/char`, { recursive: true });
await mkdir(`${OUT}/thumb`, { recursive: true });

for (const [slug, name] of Object.entries(MAP)) {
  const file = `${SRC}/${name}.png`;
  const meta = await sharp(file).metadata();
  const w = meta.width!, h = meta.height!;
  colors[slug] = await accentColor(file);
  await sharp(file).resize(1600).webp({ quality: 82 }).toFile(`${OUT}/hero/${slug}.webp`);
  // character crop: right 58% of the frame, keeping full height
  await sharp(file)
    .extract({ left: Math.round(w * 0.42), top: 0, width: Math.round(w * 0.58), height: h })
    .resize(1000)
    .webp({ quality: 82 })
    .toFile(`${OUT}/char/${slug}.webp`);
  await sharp(file).resize(480).webp({ quality: 72 }).toFile(`${OUT}/thumb/${slug}.webp`);
  console.log(slug, colors[slug]);
}

await Bun.write('/app/src/content/derived-colors.json', JSON.stringify(colors, null, 2) + '\n');
console.log('done', Object.keys(colors).length);
