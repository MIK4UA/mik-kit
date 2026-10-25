# mik-kit

Shared base for every MIK site and service on own code. Products **connect** it, they don't copy it: a change here reaches every product on its next version bump (inheritance in code — LAW 3, ADR 2026-10-24, TZ `docs/tz/2026-10-24-system-unity.md` Ф2).

| Part | What | Baseline |
|---|---|---|
| `brand/tokens.css`, `tokens.json` | MIK palette, light + dark theme, Montserrat stack, type scale — **generated** from `wiki/brand-identity.md`, never edited by hand | B1 |
| `brand/fonts.css` | Montserrat 400/700/900 self-hosted (Cyrillic + Latin) | B1, B3 (CSP `font-src 'self'`) |
| `lib/security.mjs` | headers + CSP builder → Node object, nginx include, live audit | B3 |
| `lib/i18n.mjs` | languages check (UK/RU/EN, no Cyrillic in components, every key defined) | B2 |
| `coolify/` | `Dockerfile.static` + `nginx.conf` for a Coolify Application from git, with healthcheck | B6 |
| `bin/mik-kit.mjs` | CLI: `check-i18n`, `nginx-headers`, `check-headers <url>…` | B2, B3 |

Later: MIK ID client (B4, Ф5).

## Connect a product

```json
"dependencies": { "mik-kit": "github:MIK4UA/mik-kit#v0.1.0" },
"scripts": { "prebuild": "mik-kit check-i18n" }
```

```js
// main.jsx
import 'mik-kit/fonts.css';
import 'mik-kit/tokens.css';   // then use var(--accent), var(--bg), var(--mik-font), var(--mik-fs-h1)…
```

`mik-kit.config.mjs` in the product root:

```js
import { STRINGS } from './src/i18n/strings.js';
export default {
  i18n: { dictionaries: { strings: STRINGS }, data: {}, sourceDirs: ['src'] },
  csp: { 'connect-src': ['https://n8n.mik4ua.pp.ua'] },   // only ADD sources, after grepping the bundle
};
```

Node server instead of nginx:

```js
import { securityHeaders } from 'mik-kit/security';
const headers = securityHeaders({ csp: { 'style-src': ["'self'", "'unsafe-inline'"] } });
app.use((req, res, next) => { res.set(headers); next(); });
```

Static site: copy `coolify/Dockerfile.static` → `Dockerfile` and `coolify/nginx.conf` → `nginx.conf`. Keep the include in every `location` that has its own `add_header`.

## Check a live site

```
npx mik-kit check-headers https://mik4ua.pp.ua/ https://mik4ua.pp.ua/ru/ https://mik4ua.pp.ua/en/
```

## Change the brand

Edit `wiki/brand-identity.md` (the only source), then in this folder: `npm run tokens`, `npm test`, bump the version, tag, push. `npm run tokens:check` fails when the committed tokens drifted from the book.

## Develop

`npm test` (node:test, no dependencies). Lives in the LifeOS instance at `mikhail/products/mik-kit/` as its own git repo (gitignored by the instance, like mik-toolkit).
