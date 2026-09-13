/**
 * Dev-only visual harness. Renders the app's routes at several viewports and
 * writes PNGs to _scratch/shots, and reports console errors / horizontal overflow.
 *
 * Usage: bun run scripts/shoot.ts [--base http://127.0.0.1:5174] [--seed]
 * `--seed` first walks the test flow to produce a real result, then screenshots it.
 */
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const baseArg = process.argv.find((a) => a.startsWith('--base='));
const BASE = baseArg ? baseArg.split('=')[1] : 'http://127.0.0.1:5174';
const SEED = process.argv.includes('--seed');
const OUT = new URL('../_scratch/shots/', import.meta.url).pathname;

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const ROUTES = [
  ['landing', '#/'],
  ['library', '#/library'],
  ['atlas', '#/atlas'],
  ['detail', '#/ideology/intelligence-commons'],
  ['detail-pause', '#/ideology/pause'],
  ['detail-arms', '#/ideology/arms-race'],
];

async function audit(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  const bad = overflow.scrollW > overflow.clientW + 1;
  if (bad) console.log(`  OVERFLOW ${label}: ${overflow.scrollW} > ${overflow.clientW}`);
  return bad;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, hash] of ROUTES) {
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}${name}-${vp.name}.png`, fullPage: false });
    if (await audit(page, `${name}@${vp.name}`)) problems++;
  }
  if (errors.length) { problems += errors.length; console.log(`  JS ERRORS @${vp.name}:`, errors.slice(0, 5)); }
  await page.close();
  console.log(`done ${vp.name}`);
}

if (SEED) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/#/test`, { waitUntil: 'networkidle' });
  // answer each core question with option A, then each adaptive with option A
  for (let i = 0; i < 120; i++) {
    const meta = await page.locator('#test-meta').textContent().catch(() => null);
    if (!meta) break;
    const opt = page.locator('#test-opts .opt').first();
    if (await opt.count()) { await opt.click(); await page.waitForTimeout(30); }
    const next = page.locator('[data-act="next"]');
    if (await next.isDisabled().catch(() => true)) break;
    await next.click();
    await page.waitForTimeout(40);
    if (await page.locator('.computing').count()) break;
    if (await page.locator('.empty').count()) break;
  }
  await page.waitForTimeout(4200);
  await page.goto(`${BASE}/#/result`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}result-desktop-1440.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}result-hero.png`, fullPage: false });
  // share modal
  await page.locator('[data-act="share"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}result-share-modal.png`, fullPage: false });
  console.log('seeded result captured; errors:', errors.slice(0, 3));
  await page.close();
}

console.log(problems ? `PROBLEMS: ${problems}` : 'no overflow / console errors');
await browser.close();
