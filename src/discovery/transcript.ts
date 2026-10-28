import { closeSync, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { PROJECTS_DIR } from '../paths.js';

/** Main-chain events extracted from a Claude Code transcript (`~/.claude/projects/<dir>/<session>.jsonl`). */
export type TranscriptEvent =
  | { kind: 'prompt'; ts: number; text: string }
  | { kind: 'assistant'; ts: number; text: string; toolUseIds: string[]; stop: string | null }
  | { kind: 'tool_result'; ts: number; ids: string[] }
  | { kind: 'turn_end'; ts: number };

export interface TurnSummary {
  /** A user prompt was recorded at or after the requested time. */
  started: boolean;
  /** The last turn finished (turn_duration record or end_turn without pending tools). */
  ended: boolean;
  /** Concatenated assistant text since that prompt. */
  text: string;
  toolUses: number;
}

const MAX_EVENTS = 2000;

export class TranscriptReader {
  readonly path: string;
  private offset = 0;
  private partial = '';
  events: TranscriptEvent[] = [];
  model: string | null = null;
  effort: string | null = null;
  permissionMode: string | null = null;
  title: string | null = null;
  cwd: string | null = null;
  entrypoint: string | null = null;
  /** `turnOrigin` of the prompts seen: `human` for typed ones, `sdk` for headless `-p` runs. */
  promptOrigins = new Set<string>();
  lastActivity = 0;
  private pendingTools = new Set<string>();

  constructor(path: string) {
    this.path = path;
  }

  /** Reads whatever was appended since the last call. */
  update(): void {
    if (!existsSync(this.path)) return;
    const fd = openSync(this.path, 'r');
    try {
      const size = fstatSync(fd).size;
      if (size < this.offset) {
        // Rewritten from scratch: start over.
        this.offset = 0;
        this.partial = '';
        this.events = [];
        this.pendingTools.clear();
      }
      if (size === this.offset) return;
      const buf = Buffer.alloc(size - this.offset);
      readSync(fd, buf, 0, buf.length, this.offset);
      this.offset = size;
      this.ingest(buf.toString('utf8'));
    } finally {
      closeSync(fd);
    }
  }

  ingest(chunk: string): void {
    const lines = (this.partial + chunk).split('\n');
    this.partial = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.handle(JSON.parse(line));
      } catch {
        // Ignore malformed lines; the format is internal and may change.
      }
    }
    if (this.events.length > MAX_EVENTS) this.events = this.events.slice(-MAX_EVENTS);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(rec: any): void {
    const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
    if (Number.isFinite(ts)) this.lastActivity = Math.max(this.lastActivity, ts);
    if (typeof rec.cwd === 'string') this.cwd = rec.cwd;
    if (typeof rec.entrypoint === 'string') this.entrypoint = rec.entrypoint;

    switch (rec.type) {
      case 'ai-title':
        if (rec.aiTitle) this.title = rec.aiTitle;
        return;
      case 'custom-title':
        if (rec.customTitle) this.title = rec.customTitle;
        return;
      case 'permission-mode':
        if (rec.permissionMode) this.permissionMode = rec.permissionMode;
        return;
      case 'system':
        if (rec.subtype === 'turn_duration' && !rec.isSidechain) this.events.push({ kind: 'turn_end', ts });
        return;
      case 'user':
        if (!rec.isSidechain) this.handleUser(rec, ts);
        return;
      case 'assistant':
        if (!rec.isSidechain) this.handleAssistant(rec, ts);
        return;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleUser(rec: any, ts: number): void {
    if (rec.permissionMode) this.permissionMode = rec.permissionMode;
    if (typeof rec.turnOrigin === 'string') this.promptOrigins.add(rec.turnOrigin);
    const content = rec.message?.content;
    if (typeof content === 'string') {
      if (!rec.isMeta && !rec.isCompactSummary) this.events.push({ kind: 'prompt', ts, text: content });
      return;
    }
    if (!Array.isArray(content)) return;
    const results = content.filter((b) => b?.type === 'tool_result').map((b) => String(b.tool_use_id));
    if (results.length) {
      for (const id of results) this.pendingTools.delete(id);
      this.events.push({ kind: 'tool_result', ts, ids: results });
      return;
    }
    if (rec.isMeta || rec.isCompactSummary) return;
    const text = content
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n');
    if (text) this.events.push({ kind: 'prompt', ts, text });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleAssistant(rec: any, ts: number): void {
    const msg = rec.message ?? {};
    const model = rec.requestedModel ?? msg.model;
    if (model && model !== '<synthetic>') this.model = model;
    if (rec.effort) this.effort = rec.effort;
    const content: any[] = Array.isArray(msg.content) ? msg.content : [];
    const text = content
      .filter((b) => b?.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const toolUseIds = content.filter((b) => b?.type === 'tool_use').map((b) => String(b.id));
    for (const id of toolUseIds) this.pendingTools.add(id);
    this.events.push({ kind: 'assistant', ts, text, toolUseIds, stop: msg.stop_reason ?? null });
  }

  get pendingToolUses(): number {
    return this.pendingTools.size;
  }

  /** Whether the last turn has finished, regardless of who started it. */
  get lastTurnEnded(): boolean {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i]!;
      if (ev.kind === 'turn_end') return true;
      if (ev.kind === 'assistant') return ev.stop === 'end_turn' && this.pendingTools.size === 0;
      if (ev.kind === 'prompt' || ev.kind === 'tool_result') return false;
    }
    return true;
  }

  /** Summary of everything since the first prompt recorded at or after `sinceTs`. */
  turnSince(sinceTs: number): TurnSummary {
    const start = this.events.findIndex((e) => e.kind === 'prompt' && e.ts >= sinceTs);
    if (start === -1) return { started: false, ended: false, text: '', toolUses: 0 };
    const texts: string[] = [];
    let toolUses = 0;
    for (const ev of this.events.slice(start + 1)) {
      if (ev.kind !== 'assistant') continue;
      if (ev.text) texts.push(ev.text);
      toolUses += ev.toolUseIds.length;
    }
    return { started: true, ended: this.lastTurnEnded, text: texts.join('\n'), toolUses };
  }
}

/** Finds the transcript of a session without having to reproduce the project-dir encoding. */
export function findTranscript(sessionId: string, cwd?: string): string | null {
  if (cwd) {
    const guess = join(PROJECTS_DIR, cwd.replace(/[^A-Za-z0-9]/g, '-'), `${sessionId}.jsonl`);
    if (existsSync(guess)) return guess;
  }
  if (!existsSync(PROJECTS_DIR)) return null;
  for (const dir of readdirSync(PROJECTS_DIR)) {
    const p = join(PROJECTS_DIR, dir, `${sessionId}.jsonl`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Subagents of a session that have not finished and whose transcript moved recently. */
export function runningSubagents(transcriptPath: string, staleMs = 10 * 60_000, now = Date.now()): number {
  const dir = join(dirname(transcriptPath), basename(transcriptPath, '.jsonl'), 'subagents');
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.meta.json')) continue;
    try {
      const meta = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (meta.finished) continue;
      const log = join(dir, f.replace(/\.meta\.json$/, '.jsonl'));
      const mtime = existsSync(log) ? statSync(log).mtimeMs : statSync(join(dir, f)).mtimeMs;
      if (now - mtime < staleMs) count++;
    } catch {
      // Being written right now; next poll will see it.
    }
  }
  return count;
}

/** Reads only the tail of a transcript: enough for title/model/cwd in listings. */
export function peekTranscript(path: string, bytes = 512 * 1024): TranscriptReader {
  const reader = new TranscriptReader(path);
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    const text = buf.toString('utf8');
    // Drop the first (probably cut) line when not reading from the beginning.
    reader.ingest(start === 0 ? text : text.slice(text.indexOf('\n') + 1));
  } finally {
    closeSync(fd);
  }
  return reader;
}
