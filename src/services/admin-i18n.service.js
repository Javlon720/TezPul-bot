import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED = ['uz', 'ru', 'en'];

function loadLocales() {
  const result = {};
  for (const lang of SUPPORTED) {
    const filePath = path.join(__dirname, '../../locales/admin', `${lang}.json`);
    result[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return result;
}

const locales = loadLocales();

export function ta(key, lang = 'uz', vars = {}) {
  const l = SUPPORTED.includes(lang) ? lang : 'uz';
  const translations = locales[l];
  const value = translations[key] ?? locales['uz'][key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}
