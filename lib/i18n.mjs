// Languages check (core.md B2): every text exists in every language, no Cyrillic left in components,
// every used key is defined. Generalized from mik4ua scripts/check-i18n.mjs (24.10.2026).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

export const DEFAULT_LANGS = ['uk', 'ru', 'en'];
const CYRILLIC = /[А-Яа-яЁёІіЇїЄєҐґ]/;

// Flatten an object into { 'a.b': 'text' } so two language versions of a nested object can be compared
const leaves = (o, p = '') => (typeof o === 'string' ? { [p]: o }
  : Object.assign({}, ...Object.entries(o ?? {}).map(([k, v]) => leaves(v, p ? `${p}.${k}` : k))));

function filesIn(dir, exts) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : filesIn(full, exts);
    return exts.includes(extname(name)) ? [full] : [];
  });
}

/**
 * @param {object} o
 * @param {string[]} [o.langs]          language codes, default uk/ru/en
 * @param {object}   [o.dictionaries]   { name: { key: { uk, ru, en } } } — UI strings
 * @param {object}   [o.data]           { name: any } — data where any Cyrillic text must sit in a { uk, ru, en } object
 * @param {string[]} [o.sourceDirs]     component folders, scanned recursively
 * @param {string[]} [o.extensions]     default ['.jsx', '.tsx']
 * @param {RegExp}   [o.keyPattern]     how components use keys, default t('key'); group 1 = key
 * @param {string}   [o.root]           for readable paths in messages
 */
export function checkI18n({ langs = DEFAULT_LANGS, dictionaries = {}, data = {}, sourceDirs = [],
  extensions = ['.jsx', '.tsx'], keyPattern = /\bt\('([^']+)'\)/g, root = process.cwd() } = {}) {
  const errors = [];
  const isLocalized = (o) => o && typeof o === 'object' && !Array.isArray(o) && langs.some(c => c in o);
  const checkLocalized = (o, where) => {
    const shape = Object.keys(leaves(o[langs.find(c => c in o)]));
    for (const c of langs) {
      const l = leaves(o[c]);
      for (const k of shape) if (typeof l[k] !== 'string' || !l[k].trim()) errors.push(`${where}${k ? '.' + k : ''}: missing "${c}"`);
    }
  };
  const walk = (value, where) => {
    if (isLocalized(value)) return checkLocalized(value, where);
    if (typeof value === 'string') { if (CYRILLIC.test(value)) errors.push(`${where}: untranslated text "${value.slice(0, 50)}"`); }
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${where}.${k}`);
  };

  const keys = new Set();
  for (const [name, dict] of Object.entries(dictionaries)) {
    for (const [key, entry] of Object.entries(dict)) {
      keys.add(key);
      if (!isLocalized(entry)) errors.push(`${name} ${key}: not a { ${langs.join(', ')} } entry`);
      else checkLocalized(entry, `${name} ${key}`);
    }
  }
  for (const [name, value] of Object.entries(data)) walk(value, name);

  const files = sourceDirs.flatMap(d => filesIn(d, extensions));
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (CYRILLIC.test(line)) errors.push(`${rel}:${i + 1}: hardcoded text — move it to the dictionary`);
    });
    if (Object.keys(dictionaries).length) {
      for (const [, key] of text.matchAll(new RegExp(keyPattern.source, 'g'))) {
        if (!keys.has(key)) errors.push(`${rel}: unknown key ${key}`);
      }
    }
  }
  return { errors, keys: keys.size, langs: langs.length, files: files.length };
}
