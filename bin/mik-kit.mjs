#!/usr/bin/env node
// mik-kit CLI — the same checks for every MIK product, whoever (or whichever agent) wrote it.
//   mik-kit check-i18n     [--config mik-kit.config.mjs]   languages check, run in prebuild
//   mik-kit nginx-headers  [--config mik-kit.config.mjs]   print the nginx include with headers + CSP
//   mik-kit check-headers  <url> [<url>...] [--json]       live check: headers + CSP on real responses
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkI18n } from '../lib/i18n.mjs';
import { nginxHeaders, auditHeaders } from '../lib/security.mjs';

const [cmd, ...args] = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

async function loadConfig() {
  const file = resolve(opt('--config') ?? 'mik-kit.config.mjs');
  if (!existsSync(file)) throw new Error(`config not found: ${file}`);
  const cfg = (await import(pathToFileURL(file).href)).default ?? {};
  return { cfg, dir: dirname(file) };
}

const commands = {
  async 'check-i18n'() {
    const { cfg, dir } = await loadConfig();
    const i18n = typeof cfg.i18n === 'function' ? await cfg.i18n() : cfg.i18n;
    if (!i18n) throw new Error('config has no i18n section');
    const r = checkI18n({ root: dir, ...i18n, sourceDirs: (i18n.sourceDirs ?? []).map(d => resolve(dir, d)) });
    if (r.errors.length) {
      console.error(`[check-i18n] ${r.errors.length} problem(s):\n  ` + r.errors.join('\n  '));
      return 1;
    }
    console.log(`[check-i18n] OK — ${r.keys} keys × ${r.langs} languages, data and ${r.files} component files clean`);
    return 0;
  },
  async 'nginx-headers'() {
    const { cfg } = await loadConfig();
    process.stdout.write(nginxHeaders({ csp: cfg.csp, hsts: cfg.hsts }));
    return 0;
  },
  async 'check-headers'() {
    const urls = args.filter(a => !a.startsWith('--'));
    if (!urls.length) throw new Error('give at least one URL');
    const json = args.includes('--json');   // for sensors (LifeOS coherence sensor): one array on stdout
    const results = [];
    for (const url of urls) {
      let problems, status = 0;
      try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        status = res.status;
        problems = auditHeaders(res.headers);
        if (res.status >= 400) problems.unshift(`HTTP ${res.status}`);
      } catch (e) { problems = [`request failed: ${e.message}`]; }
      results.push({ url, status, ok: !problems.length, problems });
      if (json) continue;
      if (problems.length) console.error(`[check-headers] FAIL ${url}\n  ` + problems.join('\n  '));
      else console.log(`[check-headers] OK   ${url}`);
    }
    if (json) console.log(JSON.stringify(results));
    return results.some(r => !r.ok) ? 1 : 0;
  },
};

if (!commands[cmd]) {
  console.error(`usage: mik-kit <${Object.keys(commands).join('|')}> [...]`);
  process.exit(2);
}
try { process.exit(await commands[cmd]()); }
catch (e) { console.error(`[mik-kit ${cmd}] ${e.message}`); process.exit(1); }
