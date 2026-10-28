import { readFileSync } from 'node:fs';
import { run } from '../exec.js';
import { t } from '../i18n/index.js';
import { CLAUDE_JSON } from '../paths.js';

export interface UsageWindow {
  /** % used, 0-100. */
  pct: number;
  /** Epoch ms when the window resets, if known. */
  resetsAt: number | null;
}

export interface Usage {
  fiveHour: UsageWindow | null;
  sevenDay: UsageWindow | null;
  fetchedAt: number;
  /** `api` = fresh from the endpoint; `cache` = Claude Code's own cached copy (may be old). */
  source: 'api' | 'cache';
  error?: string;
}

export interface UsageProvider {
  get(): Promise<Usage>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWindow(raw: any): UsageWindow | null {
  if (!raw || typeof raw.utilization !== 'number') return null;
  const resetsAt = raw.resets_at ? Date.parse(raw.resets_at) : NaN;
  return { pct: raw.utilization, resetsAt: Number.isFinite(resetsAt) ? resetsAt : null };
}

function maxWindow(...windows: (UsageWindow | null)[]): UsageWindow | null {
  return windows.reduce<UsageWindow | null>((acc, w) => (w && (!acc || w.pct > acc.pct) ? w : acc), null);
}

/**
 * Normalizes the `/api/oauth/usage` payload. The weekly figure is the highest of the
 * general weekly window and the one specific to the model family in use.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseUsage(raw: any, model: string | null, fetchedAt: number, source: Usage['source']): Usage {
  const family = model?.match(/opus|sonnet|haiku/)?.[0];
  const familyWeekly = family ? toWindow(raw?.[`seven_day_${family}`]) : null;
  return {
    fiveHour: toWindow(raw?.five_hour),
    sevenDay: maxWindow(toWindow(raw?.seven_day), familyWeekly),
    fetchedAt,
    source,
  };
}

async function readAccessToken(): Promise<string> {
  const res = await run('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { timeoutMs: 10_000 });
  if (res.code !== 0) throw new Error(t().usage.noCredentials);
  const creds = JSON.parse(res.stdout.trim());
  const token = creds?.claudeAiOauth?.accessToken;
  if (!token) throw new Error(t().usage.noAccessToken);
  return token;
}

/** Same data `/usage` shows. Undocumented endpoint: falls back to the copy in `~/.claude.json`. */
export class OAuthUsageProvider implements UsageProvider {
  constructor(private readonly model: () => string | null) {}

  async get(): Promise<Usage> {
    try {
      const token = await readAccessToken();
      const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
        headers: {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseUsage(await res.json(), this.model(), Date.now(), 'api');
    } catch (err) {
      const cached = readCachedUsage(this.model());
      if (cached) return { ...cached, error: String((err as Error).message ?? err) };
      throw err;
    }
  }
}

export function readCachedUsage(model: string | null): Usage | null {
  try {
    const cache = JSON.parse(readFileSync(CLAUDE_JSON, 'utf8')).cachedUsageUtilization;
    if (!cache?.utilization) return null;
    return parseUsage(cache.utilization, model, cache.fetchedAtMs ?? 0, 'cache');
  } catch {
    return null;
  }
}

/** Highest-used window and its name, for display and for the threshold check. */
export function worstWindow(usage: Usage): { name: '5h' | '7d'; window: UsageWindow } | null {
  const candidates: { name: '5h' | '7d'; window: UsageWindow }[] = [];
  if (usage.fiveHour) candidates.push({ name: '5h', window: usage.fiveHour });
  if (usage.sevenDay) candidates.push({ name: '7d', window: usage.sevenDay });
  return candidates.sort((a, b) => b.window.pct - a.window.pct)[0] ?? null;
}
