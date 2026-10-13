import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Serves the built harness itself, so the check needs nothing but Node and a browser.
const root = new URL('../.harness-dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const file = join(root, normalize(new URL(req.url, 'http://x').pathname));
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(4173, r));
const require = createRequire(process.env.PLAYWRIGHT_MODULES || '/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const results = [];
for (const width of [390, 360, 640, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.goto('http://localhost:4173/index.html');
  await page.waitForSelector('table');
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    headVisible: getComputedStyle(document.querySelector('thead')).display,
    visibleCellsFirstRow: Array.from(document.querySelector('#handover tbody tr').children).filter((td) => getComputedStyle(td).display !== 'none').length,
    labelled: document.querySelector('#handover tbody tr td').getAttribute('data-label'),
  }));
  let afterTap = null;
  if (width <= 640) {
    await page.click('#handover tbody tr td:first-child');
    afterTap = await page.evaluate(() => Array.from(document.querySelector('#handover tbody tr').children).filter((td) => getComputedStyle(td).display !== 'none').length);
    const before = await page.evaluate(() => document.querySelector('#handover tbody tr').hasAttribute('data-open'));
    await page.click('#handover tbody tr:nth-child(2) a');
    const linkDidNotToggle = await page.evaluate(() => !document.querySelector('#handover tbody tr:nth-child(2)').hasAttribute('data-open'));
    results.push({ width, ...m, afterTapVisible: afterTap, openAfterTap: before, linkDidNotToggle });
  } else results.push({ width, ...m });
  await page.close();
}
await browser.close();
server.close();
console.log(JSON.stringify(results, null, 1));
// Fails when a phone page scrolls sideways, or a table does not stack on a phone.
const bad = results.filter((r) => r.scrollWidth > r.clientWidth || (r.width <= 640 && (r.headVisible !== 'none' || r.visibleCellsFirstRow !== 4 || !r.linkDidNotToggle)));
if (bad.length) { console.error('Phone layout check failed for widths:', bad.map((r) => r.width).join(', ')); process.exit(1); }
console.log('Phone layout check passed.');
