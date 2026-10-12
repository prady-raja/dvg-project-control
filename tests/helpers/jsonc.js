import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Read a Base44 entity schema (JSONC) without a dependency: strip comments, then parse. */
export function entitySchema(name) {
  const path = fileURLToPath(new URL(`../../base44/entities/${name}.jsonc`, import.meta.url));
  const text = readFileSync(path, 'utf8')
    .replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str || '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(text);
}
