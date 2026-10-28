import { describe, expect, it } from 'vitest';
import { extractPrompt, extractTag, looksRateLimited } from '../src/engine/prompts.js';
import { parseUsage, worstWindow } from '../src/usage/usage.js';

describe('extractTag', () => {
  it('takes the last tag, case-insensitive, in English or Spanish', () => {
    expect(extractTag('first <relevo>CONTINUE</relevo> and finally <relevo>done</relevo>')).toBe('done');
    expect(extractTag('voy a <relevo>CONTINUAR</relevo> y al final <relevo>BLOQUEADO</relevo>')).toBe('blocked');
    expect(extractTag('<relevo> terminado </relevo>')).toBe('done');
    expect(extractTag('no tag')).toBeNull();
  });
});

describe('extractPrompt', () => {
  it('returns the last non-empty prompt block', () => {
    expect(extractPrompt('usa <prompt></prompt> así\n<prompt>\n  Sigue con el paso 3.\n</prompt>')).toBe('Sigue con el paso 3.');
    expect(extractPrompt('nada')).toBeNull();
  });
});

describe('looksRateLimited', () => {
  it('spots usage-limit errors', () => {
    expect(looksRateLimited("You've hit your usage limit · resets 3am")).toBe(true);
    expect(looksRateLimited('todo bien')).toBe(false);
  });
});

describe('parseUsage', () => {
  // Trimmed real payload from /api/oauth/usage on a Team account.
  const raw = {
    five_hour: { utilization: 7.0, resets_at: '2026-10-28T01:50:00.501083+00:00' },
    seven_day: { utilization: 40, resets_at: '2026-11-01T00:00:00+00:00' },
    seven_day_opus: { utilization: 91, resets_at: '2026-11-01T00:00:00+00:00' },
    seven_day_sonnet: null,
  };

  it('uses the model-specific weekly window when it is higher', () => {
    const u = parseUsage(raw, 'claude-opus-5-5', 0, 'api');
    expect(u.fiveHour).toEqual({ pct: 7, resetsAt: Date.parse('2026-10-28T01:50:00.501Z') });
    expect(u.sevenDay?.pct).toBe(91);
    expect(worstWindow(u)?.name).toBe('7d');
  });

  it('ignores other families and missing windows', () => {
    const u = parseUsage({ ...raw, seven_day: null }, 'claude-sonnet-5-5', 0, 'api');
    expect(u.sevenDay).toBeNull();
    expect(worstWindow(u)?.name).toBe('5h');
  });
});
