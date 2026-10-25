# Changelog

## 0.1.0 — 2026-10-25
- Brand tokens generated from `wiki/brand-identity.md` (light + dark, Montserrat, type scale, weights); drift check.
- Self-hosted Montserrat 400/700/900.
- Security headers + CSP builder: Node object, nginx include, live audit; CLI `nginx-headers`, `check-headers`.
- Languages check generalized from mik4ua; CLI `check-i18n` with `mik-kit.config.mjs`.
- Coolify template: `Dockerfile.static` with healthcheck, `nginx.conf` with the headers include in every location.
