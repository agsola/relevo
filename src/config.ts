import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Lang } from './i18n/index.js';
import { CONFIG_FILE } from './paths.js';

export type ResetStrategy = 'same' | 'new' | 'ask';

export interface Config {
  /** % used (0-100) of the 5h or weekly window that triggers the wrap-up. */
  threshold: number;
  /** Above this % the usage is polled with `fastPollMin` instead of `slowPollMin`. */
  nearThreshold: number;
  slowPollMin: number;
  fastPollMin: number;
  /** Seconds the session must stay idle before Relevo considers it stopped. */
  settleSec: number;
  /** Extra minutes to wait after `resets_at` before resuming. */
  resetMarginMin: number;
  guard: { maxNudges: number; windowMin: number; maxNoProgress: number };
  /** Interface language; also the language of the messages typed into the conversation. */
  language?: Lang;
}

export const DEFAULT_CONFIG: Config = {
  threshold: 85,
  nearThreshold: 70,
  slowPollMin: 10,
  fastPollMin: 5,
  settleSec: 30,
  resetMarginMin: 2,
  guard: { maxNudges: 3, windowMin: 15, maxNoProgress: 2 },
};

export function loadConfig(): Config {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...raw, guard: { ...DEFAULT_CONFIG.guard, ...raw.guard } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
