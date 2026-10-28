import { describe, expect, it } from 'vitest';
import { TranscriptReader } from '../src/discovery/transcript.js';

const T0 = Date.parse('2026-10-27T22:00:00Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

// Shapes copied from real Claude Code 2.1.308 transcripts (trimmed).
const lines = {
  perm: { type: 'permission-mode', permissionMode: 'auto', sessionId: 's' },
  title: { type: 'ai-title', aiTitle: 'Migrar la base de datos', sessionId: 's' },
  prompt: (s: number, text: string) => ({ type: 'user', isSidechain: false, timestamp: at(s), cwd: '/p', permissionMode: 'auto', message: { role: 'user', content: text } }),
  toolUse: (s: number, id: string) => ({
    type: 'assistant', isSidechain: false, timestamp: at(s), requestedModel: 'claude-opus-5-5', effort: 'high',
    message: { model: 'claude-opus-5-5', stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name: 'Bash', input: {} }] },
  }),
  toolResult: (s: number, id: string) => ({ type: 'user', isSidechain: false, timestamp: at(s), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } }),
  text: (s: number, text: string, stop: string | null = 'end_turn') => ({
    type: 'assistant', isSidechain: false, timestamp: at(s), message: { model: 'claude-opus-5-5', stop_reason: stop, content: [{ type: 'text', text }] },
  }),
  sidechain: (s: number) => ({ type: 'assistant', isSidechain: true, timestamp: at(s), message: { model: 'claude-haiku-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'sub' }] } }),
  turnEnd: (s: number) => ({ type: 'system', subtype: 'turn_duration', isSidechain: false, timestamp: at(s), durationMs: 1000 }),
};

const feed = (r: TranscriptReader, recs: object[]) => r.ingest(recs.map((x) => JSON.stringify(x)).join('\n') + '\n');

describe('TranscriptReader', () => {
  it('extracts metadata from the main chain', () => {
    const r = new TranscriptReader('/dev/null');
    feed(r, [lines.perm, lines.title, lines.prompt(0, 'hola'), lines.toolUse(1, 't1'), lines.sidechain(2)]);
    expect(r.model).toBe('claude-opus-5-5');
    expect(r.effort).toBe('high');
    expect(r.permissionMode).toBe('auto');
    expect(r.title).toBe('Migrar la base de datos');
    expect(r.cwd).toBe('/p');
    expect(r.pendingToolUses).toBe(1);
    expect(r.lastTurnEnded).toBe(false);
  });

  it('knows when a turn has ended', () => {
    const r = new TranscriptReader('/dev/null');
    feed(r, [lines.prompt(0, 'hola'), lines.toolUse(1, 't1'), lines.toolResult(2, 't1')]);
    expect(r.lastTurnEnded).toBe(false);
    feed(r, [lines.text(3, 'listo')]);
    expect(r.lastTurnEnded).toBe(true);
    feed(r, [lines.prompt(4, 'otra')]);
    expect(r.lastTurnEnded).toBe(false);
    feed(r, [lines.text(5, 'pensando', null), lines.turnEnd(6)]);
    expect(r.lastTurnEnded).toBe(true);
  });

  it('summarizes the turn that answers a message', () => {
    const r = new TranscriptReader('/dev/null');
    feed(r, [lines.prompt(0, 'vieja'), lines.text(1, '<relevo>TERMINADO</relevo> de antes')]);
    expect(r.turnSince(T0 + 10_000).started).toBe(false);
    feed(r, [lines.prompt(10, '[Relevo] ...'), lines.toolUse(11, 'a'), lines.toolResult(12, 'a'), lines.text(13, 'hecho <relevo>CONTINUAR</relevo>')]);
    const turn = r.turnSince(T0 + 10_000);
    expect(turn).toMatchObject({ started: true, ended: true, toolUses: 1 });
    expect(turn.text).toContain('CONTINUAR');
    expect(turn.text).not.toContain('TERMINADO');
  });

  it('survives partial lines across chunks', () => {
    const r = new TranscriptReader('/dev/null');
    const line = JSON.stringify(lines.title);
    r.ingest(line.slice(0, 10));
    expect(r.title).toBeNull();
    r.ingest(line.slice(10) + '\n');
    expect(r.title).toBe('Migrar la base de datos');
  });
});
