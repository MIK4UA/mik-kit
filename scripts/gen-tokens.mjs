#!/usr/bin/env node
// Generates brand/tokens.css + brand/tokens.json from wiki/brand-identity.md (the single source, LAW 3).
// Usage (from the instance): node scripts/gen-tokens.mjs [path/to/brand-identity.md] [--check]
// --check: exit 1 if the committed files differ from what the brand book gives now (drift sensor).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBrand, renderCss } from '../lib/tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const kit = join(here, '..');
const args = process.argv.slice(2);
const check = args.includes('--check');
const src = args.find(a => !a.startsWith('--')) ?? join(kit, '..', '..', '..', 'wiki', 'brand-identity.md');

if (!existsSync(src)) {
  console.error(`[gen-tokens] brand book not found: ${src}`);
  process.exit(1);
}
const brand = parseBrand(readFileSync(src, 'utf8'));
const out = {
  [join(kit, 'brand', 'tokens.css')]: renderCss(brand),
  [join(kit, 'brand', 'tokens.json')]: JSON.stringify(brand, null, 2) + '\n',
};

let drift = 0;
for (const [file, text] of Object.entries(out)) {
  const now = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (now === text) continue;
  if (check) { console.error(`[gen-tokens] DRIFT: ${file} differs from the brand book`); drift++; }
  else { writeFileSync(file, text, 'utf8'); console.log(`[gen-tokens] wrote ${file}`); }
}
if (check && drift) process.exit(1);
console.log(`[gen-tokens] OK — ${Object.keys(brand.primitives).length} primitives, ${Object.keys(brand.light).length} light / ${Object.keys(brand.dark).length} dark semantic tokens`);
