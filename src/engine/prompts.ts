import { t } from '../i18n/index.js';

/** Messages Relevo types into the conversation, in the interface language. All start with [Relevo]. */
export const prompts = () => t().prompts;

export type RelevoTag = 'done' | 'continue' | 'blocked';

const TAG_WORDS: Record<string, RelevoTag> = {
  DONE: 'done',
  TERMINADO: 'done',
  CONTINUE: 'continue',
  CONTINUAR: 'continue',
  BLOCKED: 'blocked',
  BLOQUEADO: 'blocked',
};

/** Last <relevo>…</relevo> tag in the text. Accepts the English and Spanish words. */
export function extractTag(text: string): RelevoTag | null {
  const words = Object.keys(TAG_WORDS).join('|');
  const matches = [...text.matchAll(new RegExp(`<relevo>\\s*(${words})\\s*</relevo>`, 'gi'))];
  const last = matches.at(-1)?.[1]?.toUpperCase();
  return last ? (TAG_WORDS[last] ?? null) : null;
}

/** Content of the last non-empty <prompt>…</prompt> block. */
export function extractPrompt(text: string): string | null {
  const matches = [...text.matchAll(/<prompt>([\s\S]*?)<\/prompt>/gi)]
    .map((m) => m[1]!.trim())
    .filter(Boolean);
  return matches.at(-1) ?? null;
}

/** Heuristic for "the turn died because the usage limit was hit". */
export function looksRateLimited(text: string): boolean {
  return /usage limit|limit reached|rate limit|has alcanzado el límite|límite de uso/i.test(text);
}
