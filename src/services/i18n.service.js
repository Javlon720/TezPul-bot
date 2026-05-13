
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supported = ['uz', 'ru', 'en'];
const locales = {};

async function loadLocale(lang) {
  if (locales[lang]) {
    return locales[lang];
  }
  const filePath = path.join(__dirname, '../../locales', `${lang}.json`);
  const content = await fs.readFile(filePath, 'utf8');
  locales[lang] = JSON.parse(content);
  return locales[lang];
}

export async function t(key, lang = 'uz', vars = {}) {
  const language = supported.includes(lang) ? lang : 'en';
  const translation = await loadLocale(language);
  let value = translation[key] || translation[key] || key;
  return value.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? ''));
}

export async function getSupportedLanguages() {
  return supported;
}
