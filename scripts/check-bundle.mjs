// R-02: the JavaScript needed to open the app must stay small on a phone.
// Reads dist/index.html, follows the entry script and its static imports, and
// fails when their combined gzip size passes the budget.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const BUDGET_KB = Number(process.env.ENTRY_BUDGET_KB || 250);
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const seen = new Set();
const queue = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const code = readFileSync(join(dist, file));
  total += gzipSync(code).length;
  // Only static imports count; lazy routes are loaded on demand.
  const text = code.toString('utf8');
  for (const m of text.matchAll(/(?:^|[;}\s])(?:import|export)\s*(?:[^'"()]*?from\s*)?"\.\/([^"]+\.js)"/g)) queue.push(join(dirname(file), m[1]));
}
const kb = Math.round(total / 1024);
console.log(`Entry JavaScript: ${kb} KB gzip (budget ${BUDGET_KB} KB, ${seen.size} files)`);
if (kb > BUDGET_KB) { console.error('Over budget.'); process.exit(1); }
