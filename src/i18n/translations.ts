/* eslint-disable global-require */
import { sanitizeTranslationDictionary } from './brand-i18n';
import { APP_LOCALES } from './languages';

export default function generatedTranslations() {
  const translations = [];
  for (const key of Object.keys(APP_LOCALES)) {
    try {
      // eslint-disable-next-line import/no-dynamic-require
      const translation = require(`./locales/${key}.json`);
      // Neutralize upstream brand tokens (name, website, GitHub links, e-mail)
      // that upstream bakes into locale values, without forking each locale file.
      translations[key] = sanitizeTranslationDictionary(translation);
    } catch {
      console.warn(`Can't find translations for ${key}`);
    }
  }
  return translations;
}
