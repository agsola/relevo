import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MachineState } from '../engine/machine.js';
import { EVENTS_LOG, HANDOFFS_DIR, RELEVO_DIR, STATE_FILE } from '../paths.js';

export interface Watched {
  sessionId: string;
  title: string;
  cwd: string;
  tmuxName: string;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  transcriptPath: string;
  bridgeSessionId?: string;
}

export interface Persisted {
  version: 1;
  watched: Watched;
  machine: MachineState;
}

export function loadState(): Persisted | null {
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Persisted;
    return data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function saveState(data: Persisted): void {
  mkdirSync(RELEVO_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  // Atomic replace so a crash never leaves half a file.
  renameSync(tmp, STATE_FILE);
}

export function clearState(): void {
  rmSync(STATE_FILE, { force: true });
}

export function appendEvent(line: string): void {
  mkdirSync(RELEVO_DIR, { recursive: true });
  appendFileSync(EVENTS_LOG, `${new Date().toISOString()} ${line}\n`);
}

export function saveHandoff(sessionId: string, text: string): string {
  mkdirSync(HANDOFFS_DIR, { recursive: true });
  const file = join(HANDOFFS_DIR, `${sessionId}-${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  writeFileSync(file, text);
  return file;
}
