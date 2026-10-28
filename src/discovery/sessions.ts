import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPidAlive } from '../exec.js';
import { t } from '../i18n/index.js';
import { PROJECTS_DIR, SESSIONS_DIR } from '../paths.js';
import { findTranscript, peekTranscript, type TranscriptReader } from './transcript.js';

/** Entry of `~/.claude/sessions/<pid>.json`, the registry of live Claude Code processes. */
export interface RegistryEntry {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind?: string;
  entrypoint?: string;
  name?: string;
  status?: string;
  statusUpdatedAt?: number;
  bridgeSessionId?: string;
  tmux?: string;
}

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  title: string;
  origin: string;
  running: boolean;
  pid?: number;
  status?: string;
  remoteControl: boolean;
  bridgeSessionId?: string;
  /** tmux target when the process runs inside tmux (e.g. `relevo-1234abcd:@0.%0`). */
  tmux?: string;
  model: string | null;
  effort: string | null;
  permissionMode: string | null;
  lastActivity: number;
  transcriptPath: string | null;
}

export function readRegistry(): RegistryEntry[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  const entries: RegistryEntry[] = [];
  for (const f of readdirSync(SESSIONS_DIR)) {
    if (!/^\d+\.json$/.test(f)) continue;
    try {
      const entry = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8')) as RegistryEntry;
      if (entry.sessionId && isPidAlive(entry.pid)) entries.push(entry);
    } catch {
      // Being rewritten; skip this round.
    }
  }
  return entries;
}

export function registryFor(sessionId: string): RegistryEntry | undefined {
  return readRegistry().find((e) => e.sessionId === sessionId);
}

export function originLabel(entrypoint?: string): string {
  if (!entrypoint) return '?';
  if (entrypoint === 'cli') return 'CLI';
  if (entrypoint.includes('vscode')) return 'VSCode';
  if (entrypoint.includes('desktop')) return 'Desktop';
  if (entrypoint.startsWith('sdk')) return 'SDK';
  return entrypoint;
}

function transcriptIndex(maxAgeMs: number, now: number): Map<string, { path: string; mtime: number }> {
  const index = new Map<string, { path: string; mtime: number }>();
  if (!existsSync(PROJECTS_DIR)) return index;
  for (const dir of readdirSync(PROJECTS_DIR)) {
    const full = join(PROJECTS_DIR, dir);
    let files: string[];
    try {
      files = readdirSync(full);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const path = join(full, f);
      const mtime = statSync(path).mtimeMs;
      if (now - mtime <= maxAgeMs) index.set(f.slice(0, -'.jsonl'.length), { path, mtime });
    }
  }
  return index;
}

/**
 * Running sessions first (newest activity first), then the ones whose transcript
 * changed in the last `recentMs` but have no live process.
 */
export function listSessions(recentMs = 60 * 60_000, now = Date.now()): SessionInfo[] {
  const registry = readRegistry();
  const transcripts = transcriptIndex(recentMs, now);
  const result: SessionInfo[] = [];
  const seen = new Set<string>();

  const describe = (
    sessionId: string,
    path: string | null,
    base: Partial<SessionInfo>,
    peek: TranscriptReader | null = path ? peekTranscript(path) : null,
  ): SessionInfo => {
    return {
      sessionId,
      cwd: base.cwd ?? peek?.cwd ?? '?',
      title: base.title || peek?.title || t().ui.untitled,
      origin: base.origin ?? originLabel(peek?.entrypoint ?? undefined),
      running: base.running ?? false,
      pid: base.pid,
      status: base.status,
      remoteControl: base.remoteControl ?? false,
      bridgeSessionId: base.bridgeSessionId,
      tmux: base.tmux,
      model: peek?.model ?? null,
      effort: peek?.effort ?? null,
      permissionMode: peek?.permissionMode ?? null,
      lastActivity: Math.max(peek?.lastActivity ?? 0, base.lastActivity ?? 0),
      transcriptPath: path,
    };
  };

  for (const entry of registry) {
    if (seen.has(entry.sessionId)) continue;
    seen.add(entry.sessionId);
    const path = transcripts.get(entry.sessionId)?.path ?? findTranscript(entry.sessionId, entry.cwd);
    const info = describe(entry.sessionId, path, {
      cwd: entry.cwd,
      origin: originLabel(entry.entrypoint),
      running: true,
      pid: entry.pid,
      status: entry.status,
      remoteControl: Boolean(entry.bridgeSessionId),
      bridgeSessionId: entry.bridgeSessionId,
      tmux: entry.tmux,
      lastActivity: entry.statusUpdatedAt,
    });
    // A registry name like "myproject-12" is auto-derived; prefer the AI title, keep explicit names.
    if (entry.name && (info.title === t().ui.untitled || !/-\d+$/.test(entry.name))) info.title = entry.name;
    result.push(info);
  }

  const recent: SessionInfo[] = [];
  for (const [sessionId, { path, mtime }] of transcripts) {
    if (seen.has(sessionId)) continue;
    const peek = peekTranscript(path);
    // Headless `-p` runs (only `sdk` prompts) and empty transcripts are not useful to adopt.
    if (!peek.model || peek.entrypoint?.startsWith('sdk')) continue;
    if (peek.promptOrigins.size && !peek.promptOrigins.has('human')) continue;
    const info = describe(sessionId, path, { lastActivity: mtime }, peek);
    recent.push(info);
  }

  const byActivity = (a: SessionInfo, b: SessionInfo) => b.lastActivity - a.lastActivity;
  return [...result.sort(byActivity), ...recent.sort(byActivity)];
}
