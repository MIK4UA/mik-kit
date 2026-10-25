// mik-kit — shared base for every MIK site and service on own code (core.md B1–B3, site-standards.md §0.1)
export { securityHeaders, buildCsp, nginxHeaders, auditHeaders, REQUIRED_HEADERS, REQUIRED_CSP } from './security.mjs';
export { checkI18n, DEFAULT_LANGS } from './i18n.mjs';
export { parseBrand, renderCss } from './tokens.mjs';
