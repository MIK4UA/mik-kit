# Changelog

## 0.1.2 — 2026-10-26
- `check-headers --json`: one JSON array on stdout (`url`, `status`, `ok`, `problems`) for sensors — the LifeOS coherence sensor calls the kit instead of repeating the check. The lock file now carries the package version.

## 0.1.1 — 2026-10-26
- Connecting a product needs `.npmrc` with `allow-git=root`: npm 12 blocks git dependencies by default (found on the first install from GitHub). README and `Dockerfile.static` (copies `.npmrc`, installs git) updated.

## 0.1.0 — 2026-10-25
- Brand tokens generated from `wiki/brand-identity.md` (light + dark, Montserrat, type scale, weights); drift check.
- Self-hosted Montserrat 400/700/900.
- Security headers + CSP builder: Node object, nginx include, live audit; CLI `nginx-headers`, `check-headers`.
- Languages check generalized from mik4ua; CLI `check-i18n` with `mik-kit.config.mjs`.
- Coolify template: `Dockerfile.static` with healthcheck, `nginx.conf` with the headers include in every location.
