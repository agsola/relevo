import { en, type Messages } from './en.js';
import { es } from './es.js';

export type Lang = 'en' | 'es';

const catalogs: Record<Lang, Messages> = { en, es };
let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Messages in the current language. */
export function t(): Messages {
  return catalogs[current];
}

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'es';

/**
 * Picks the interface language: `--lang`, then `RELEVO_LANG`, then `language` in config.json,
 * then the system locale (Spanish locales get Spanish). English otherwise.
 */
export function detectLang(argLang: string | undefined, configLang: string | undefined, env = process.env): Lang {
  for (const candidate of [argLang, env.RELEVO_LANG, configLang]) {
    if (isLang(candidate)) return candidate;
  }
  const locale = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
  return /^es\b|^es[_-]/i.test(locale ?? '') ? 'es' : 'en';
}
