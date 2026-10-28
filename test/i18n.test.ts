import { afterEach, describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.js';
import { es } from '../src/i18n/es.js';
import { detectLang, setLang, t } from '../src/i18n/index.js';

describe('detectLang', () => {
  it('prefers the flag, then RELEVO_LANG, then config, then the locale', () => {
    expect(detectLang('es', 'en', { RELEVO_LANG: 'en' })).toBe('es');
    expect(detectLang(undefined, 'en', { RELEVO_LANG: 'es' })).toBe('es');
    expect(detectLang(undefined, 'es', {})).toBe('es');
    expect(detectLang(undefined, undefined, { LANG: 'es_ES.UTF-8' })).toBe('es');
    expect(detectLang(undefined, undefined, { LANG: 'en_US.UTF-8' })).toBe('en');
    expect(detectLang('fr', undefined, { LANG: 'fr_FR.UTF-8' })).toBe('en');
  });
});

describe('catalogs', () => {
  afterEach(() => setLang('en'));

  it('switches language', () => {
    expect(t().prompts.wrap).toBe(en.prompts.wrap);
    setLang('es');
    expect(t().prompts.wrap).toContain('Para la tarea que estés realizando');
  });

  it('have the same keys in both languages', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it('ask for tags that the parser understands', () => {
    for (const catalog of [en, es]) {
      for (const tag of catalog.prompts.nudge.matchAll(/<relevo>(\w+)<\/relevo>/g)) {
        expect(['DONE', 'CONTINUE', 'BLOCKED', 'TERMINADO', 'CONTINUAR', 'BLOQUEADO']).toContain(tag[1]);
      }
    }
  });
});
