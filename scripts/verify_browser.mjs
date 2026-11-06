#!/usr/bin/env node
// Installed headful Google Chrome on loopback or the exact public URL, desktop viewport only; not a phone test.
// Loads level 1 with the explicit start button, then every other level through the level select in the same session, and
// records the viewer probe, console/page/request errors, part requests and canvas captures of the reset and quarter views.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const value = (flag) => args[args.indexOf(flag) + 1];
if (!args.includes('--url') || !args.includes('--out-dir')) throw new Error('Usage: verify_browser.mjs --url URL --out-dir NEW_DIR');
const base = value('--url');
const out = path.resolve(value('--out-dir'));
const localPattern = /^http:\/\/127\.0\.0\.1:\d+\/white-walker-review\/$/;
const publicUrl = 'https://bitz3d.github.io/white-walker-review/';
if (!localPattern.test(base) && base !== publicUrl) throw new Error(`URL must be loopback /white-walker-review/ or exactly ${publicUrl}`);
if (fs.existsSync(out) || !fs.existsSync(path.dirname(out)) || !fs.statSync(path.dirname(out)).isDirectory()) throw new Error('Output directory must be new and its parent must exist');
const playwrightPackage = process.env.PLAYWRIGHT_PACKAGE;
if (!playwrightPackage) throw new Error('Set PLAYWRIGHT_PACKAGE to an existing local package.json that can resolve Playwright');
fs.mkdirSync(out);
const { chromium } = createRequire(path.resolve(playwrightPackage))('playwright');

const manifest = await (await fetch(new URL('models.json', base), { cache: 'no-store' })).json();
const models = [...manifest.models].sort((a, b) => a.id.localeCompare(b.id));
const record = {
  status: 'running', base, startedUtc: new Date().toISOString(),
  environment: 'Installed headful Google Chrome via Playwright, 1440x900 CSS px, DPR 1 (site renders at DPR 1); desktop only, not a phone',
  levels: {}, errors: [], partRequests: [], failedRequests: [],
};
const save = () => fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(record, null, 2) + '\n');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false });
record.browserVersion = browser.version();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') record.errors.push({ kind: 'console', text: message.text() }); });
  page.on('pageerror', (error) => record.errors.push({ kind: 'pageerror', text: String(error) }));
  page.on('requestfailed', (request) => record.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? null }));
  page.on('request', (request) => { if (request.url().includes('/models/')) record.partRequests.push({ url: request.url(), atMs: Date.now() }); });
  const probe = () => page.evaluate(() => (window).__modelReviewProbe?.() ?? null);
  const waitFor = async (predicate, timeoutMs, label) => {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const current = await probe();
      if (current?.loadState?.kind === 'error') throw new Error(`${label}: ${current.loadState.message}`);
      if (predicate(current)) return current;
      await page.waitForTimeout(250);
    }
    throw new Error(`${label}: timed out`);
  };
  const frameAfter = async (previousFrame, label) => waitFor((p) => p?.viewer && p.viewer.renderFrame > previousFrame, 20000, label);

  for (const [index, model] of models.entries()) {
    const level = model.id.split('-').pop();
    const started = Date.now();
    if (index === 0) {
      await page.goto(`${base}?model=${model.id}`, { waitUntil: 'load' });
      await page.locator('[data-testid="start-3d"]').click();
    } else {
      await page.locator('[data-testid="level-select"]').selectOption(level);
    }
    const ready = await waitFor((p) => p?.loadState?.kind === 'ready' && p.loadedModelId === model.id && p.viewer?.renderFrame > 0, 240000, model.id);
    const entry = { id: model.id, readyMs: Date.now() - started, decodedSha256Matches: ready.loadState.decodedSha256 === model.transport.decodedSha256, views: {} };
    let frame = ready.viewer.renderFrame;
    for (const view of ['reset', 'quarter']) {
      if (view === 'reset') await page.locator('[data-testid="preset-reset"]').click();
      else await page.locator('[data-testid="view-preset"]').selectOption(view);
      const shown = await frameAfter(frame, `${model.id} ${view}`);
      frame = shown.viewer.renderFrame;
      const file = `level-${level}-${view}.png`;
      await page.locator('[data-testid="model-canvas"]').screenshot({ path: path.join(out, file) });
      entry.views[view] = { file, triangles: shown.viewer.triangles, drawCalls: shown.viewer.drawCalls, textures: shown.viewer.textures,
        contextLost: shown.viewer.contextLost, camera: shown.viewer.camera, canvasCss: shown.viewer.dimensions.canvasCss,
        dpr: shown.viewer.dimensions.dpr, intendedBounds: shown.viewer.intendedBounds };
    }
    entry.expectedTriangles = model.triangles;
    entry.resetTrianglesEqualExpected = entry.views.reset.triangles === model.triangles;
    entry.diagnostics = ready.diagnostics;
    if (index === 0) await page.screenshot({ path: path.join(out, 'page-level-1.png'), fullPage: false });
    record.levels[level] = entry;
    save();
  }
  const final = await probe();
  record.finalDiagnostics = final?.diagnostics ?? null;
  record.status = record.errors.length || record.failedRequests.length || Object.values(record.levels).some((l) => !l.decodedSha256Matches || l.views.reset.contextLost) ? 'failed' : 'passed';
} catch (error) {
  record.status = 'failed';
  record.errors.push({ kind: 'runner', text: String(error?.stack ?? error) });
} finally {
  record.finishedUtc = new Date().toISOString();
  save();
  await browser.close();
}
console.log(JSON.stringify({ status: record.status, levels: Object.fromEntries(Object.entries(record.levels).map(([k, v]) => [k, { readyMs: v.readyMs, triangles: v.views.reset?.triangles, expected: v.expectedTriangles }])), errors: record.errors.length }, null, 1));
process.exit(record.status === 'passed' ? 0 : 1);
