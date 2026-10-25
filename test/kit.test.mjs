import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseBrand, renderCss } from '../lib/tokens.mjs';
import { buildCsp, securityHeaders, nginxHeaders, auditHeaders } from '../lib/security.mjs';
import { checkI18n } from '../lib/i18n.mjs';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = readFileSync(join(kit, 'test', 'fixtures', 'brand.md'), 'utf8');
const run = promisify(execFile);

test('tokens: parsed from the brand book tables', () => {
  const b = parseBrand(fixture);
  assert.equal(b.primitives.orange, '#F76A0C');
  assert.equal(b.primitives['neutral-2'], '#EEEEEE');
  assert.equal(b.light['--text-muted'], '#464646');
  assert.equal(b.dark['--bg'], '#0E1B22');
  assert.deepEqual(b.type.scale, { body: 16, h3: 18, h2: 20, h1: 24, display: 32, stat: 48 });
  assert.equal(b.type.stack, '"Montserrat", -apple-system, "Segoe UI", Roboto, sans-serif');
  const css = renderCss(b);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /--mik-fs-body: 16px;/);
});

test('tokens: a broken table fails loudly instead of half-parsing', () => {
  const broken = fixture.replace('| `#1A1A1A` / `#464646` |', '| `#1A1A1A` |');
  assert.throws(() => parseBrand(broken), /have 1 values/);
});

test('tokens: committed tokens.css matches the real brand book (drift)', (t) => {
  const real = join(kit, '..', '..', '..', 'wiki', 'brand-identity.md');
  if (!existsSync(real)) return t.skip('kit cloned outside the LifeOS instance');
  const want = renderCss(parseBrand(readFileSync(real, 'utf8')));
  assert.equal(readFileSync(join(kit, 'brand', 'tokens.css'), 'utf8'), want, 'run: npm run tokens');
});

test('security: CSP starts from the MIK base and only adds sources', () => {
  const csp = buildCsp({ 'connect-src': ['https://n8n.mik4ua.pp.ua'], 'img-src': 'https://img.example' });
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /img-src 'self' data: https:\/\/img\.example/);
  assert.match(csp, /connect-src https:\/\/n8n\.mik4ua\.pp\.ua/);
  assert.throws(() => buildCsp({ 'script-src': ["'self'; evil"] }), /bad source/);
});

test('security: nginx include sets every header with always', () => {
  const conf = nginxHeaders();
  for (const h of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']) {
    assert.match(conf, new RegExp(`^add_header ${h} ".+" always;$`, 'm'));
  }
  assert.doesNotMatch(conf, /Strict-Transport-Security/);
  assert.match(nginxHeaders({ hsts: true }), /Strict-Transport-Security/);
});

test('security: audit passes our headers and names what is missing', () => {
  const ours = Object.fromEntries(Object.entries(securityHeaders()).map(([k, v]) => [k.toLowerCase(), v]));
  assert.deepEqual(auditHeaders(ours), []);
  const p = auditHeaders({ 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': "default-src 'self'" });
  assert.ok(p.includes('missing x-content-type-options'));
  assert.ok(p.some(x => x.startsWith('x-frame-options is "SAMEORIGIN"')));
  assert.ok(p.includes("csp: frame-ancestors must include 'none'"));
});

test('i18n: missing language, hardcoded Cyrillic and unknown keys are caught', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mik-kit-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'A.jsx'), "export const A = () => <b>{t('hello')}{t('nope')}</b>;\n");
  writeFileSync(join(dir, 'src', 'B.jsx'), 'export const B = () => <b>Привіт</b>;\n');
  const r = checkI18n({
    root: dir,
    dictionaries: { strings: { hello: { uk: 'Привіт', ru: 'Привет', en: '' } } },
    data: { meta: { uk: { title: 'Т' }, ru: { title: 'Т' }, en: {} }, list: ['ok', 'Текст'] },
    sourceDirs: [join(dir, 'src')],
  });
  assert.ok(r.errors.includes('strings hello: missing "en"'));
  assert.ok(r.errors.includes('meta.title: missing "en"'));
  assert.ok(r.errors.some(e => e.startsWith('list[1]: untranslated')));
  assert.ok(r.errors.includes('src/B.jsx:1: hardcoded text — move it to the dictionary'));
  assert.ok(r.errors.includes('src/A.jsx: unknown key nope'));
  assert.equal(r.errors.length, 5);
});

test('cli: check-headers reads a live response', async () => {
  const good = securityHeaders();
  const srv = createServer((req, res) => {
    if (req.url === '/good') res.writeHead(200, good); else res.writeHead(200, { 'X-Frame-Options': 'SAMEORIGIN' });
    res.end('<!doctype html>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const cli = join(kit, 'bin', 'mik-kit.mjs');
  try {
    const ok = await run(process.execPath, [cli, 'check-headers', `${base}/good`]);
    assert.match(ok.stdout, /OK/);
    await assert.rejects(run(process.execPath, [cli, 'check-headers', `${base}/good`, `${base}/bad`]),
      (e) => e.code === 1 && /FAIL .*\/bad/.test(e.stderr));
    await assert.rejects(run(process.execPath, [cli, 'check-headers', '--json', `${base}/good`, `${base}/bad`]), (e) => {
      const [g, b] = JSON.parse(e.stdout);
      return e.code === 1 && g.ok && g.status === 200 && !b.ok && b.problems.length > 0;
    });
  } finally { srv.close(); }
});
