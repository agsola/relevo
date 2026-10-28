import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { command, initialState, type MachineState, type Observation, type SessionObs, step } from '../src/engine/machine.js';
import { setLang } from '../src/i18n/index.js';
import type { Usage } from '../src/usage/usage.js';

const MIN = 60_000;
const cfg = DEFAULT_CONFIG;

const usage = (pct: number, at: number, resetsAt: number | null = at + 60 * MIN): Usage => ({
  fiveHour: { pct, resetsAt },
  sevenDay: { pct: 10, resetsAt: at + 5 * 24 * 60 * MIN },
  fetchedAt: at,
  source: 'api',
});

const idle = (turn: SessionObs['turn'] = null, subagents = 0): SessionObs => ({ alive: true, activity: 'idle', subagents, turn });
const busy = (turn: SessionObs['turn'] = null, subagents = 0): SessionObs => ({ alive: true, activity: 'busy', subagents, turn });
const answered = (text: string, toolUses = 1) => ({ started: true, ended: true, text, toolUses });

/** Runs a step and returns the new state plus the kinds of the messages sent. */
function go(s: MachineState, obs: Observation) {
  const r = step(s, obs, cfg);
  const sends = r.actions.filter((a) => a.type === 'send').map((a) => (a.type === 'send' ? a.kind : ''));
  return { s: r.state, sends, actions: r.actions };
}

describe('state machine', () => {
  beforeEach(() => setLang('en'));

  it('does nothing while the conversation works under the threshold', () => {
    const r = go(initialState('same'), { now: 0, usage: usage(40, 0), session: busy() });
    expect(r.s.phase).toBe('running');
    expect(r.sends).toEqual([]);
  });

  it('nudges when it stops, and stops on TERMINADO', () => {
    let r = go(initialState('same'), { now: 0, usage: usage(40, 0), session: idle() });
    expect(r.sends).toEqual(['nudge']);
    r = go(r.s, { now: MIN, usage: usage(40, 0), session: busy(answered('', 0)) });
    expect(r.sends).toEqual([]);
    r = go(r.s, { now: 2 * MIN, usage: usage(40, 0), session: idle(answered('All done. <relevo>DONE</relevo>')) });
    expect(r.s.phase).toBe('done');
    expect(r.actions.some((a) => a.type === 'notify')).toBe(true);
  });

  it('stops on BLOQUEADO', () => {
    let r = go(initialState('same'), { now: 0, usage: null, session: idle() });
    r = go(r.s, { now: MIN, usage: null, session: idle(answered('<relevo>BLOCKED</relevo>')) });
    expect(r.s.phase).toBe('blocked');
  });

  it('keeps pushing on CONTINUAR until the loop guard trips', () => {
    let r = go(initialState('same'), { now: 0, usage: usage(40, 0), session: idle() });
    const sent = [...r.sends];
    for (let i = 1; i <= 4; i++) {
      r = go(r.s, { now: i * MIN, usage: usage(40, 0), session: idle(answered('moving on <relevo>CONTINUE</relevo>')) });
      sent.push(...r.sends);
    }
    expect(sent).toEqual(['nudge', 'continue', 'continue']);
    expect(r.s.phase).toBe('halted');
    expect(r.s.reason).toMatch(/3 times in 15 min/);
  });

  it('halts after consecutive turns without tool use', () => {
    let r = go(initialState('same'), { now: 0, usage: null, session: idle() });
    r = go(r.s, { now: 10 * MIN, usage: null, session: idle(answered('nada', 0)) });
    expect(r.sends).toEqual(['continue']);
    r = go(r.s, { now: 30 * MIN, usage: null, session: idle(answered('nada', 0)) });
    expect(r.s.phase).toBe('halted');
    expect(r.s.reason).toMatch(/without using any tool/);
  });

  it('wraps up at the threshold, waits for the reset and resumes with the handoff', () => {
    const resetsAt = 60 * MIN;
    let r = go(initialState('same'), { now: 0, usage: usage(86, 0, resetsAt), session: busy(null, 2) });
    expect(r.s.phase).toBe('wrapping');
    expect(r.actions.find((a) => a.type === 'send')).toMatchObject({ text: expect.stringContaining('Let the running agent(s) finish') });

    // Agents still running: keep waiting even though the turn text arrived.
    r = go(r.s, { now: 5 * MIN, usage: usage(90, 0, resetsAt), session: idle(answered('<prompt>Sigue con X</prompt>'), 1) });
    expect(r.s.phase).toBe('wrapping');

    r = go(r.s, { now: 6 * MIN, usage: usage(90, 0, resetsAt), session: idle(answered('Estado documentado.\n<prompt>Sigue con X</prompt>')) });
    expect(r.s.phase).toBe('waiting_reset');
    expect(r.actions).toContainEqual({ type: 'saveHandoff', text: 'Sigue con X' });

    // Stale reading taken before the reset: no resume.
    r = go(r.s, { now: 61 * MIN, usage: usage(90, 6 * MIN, resetsAt), session: idle() });
    expect(r.s.phase).toBe('waiting_reset');

    r = go(r.s, { now: 63 * MIN, usage: usage(1, 63 * MIN, resetsAt + 300 * MIN), session: idle() });
    expect(r.s.phase).toBe('running');
    expect(r.sends).toEqual(['resume']);
    expect(r.actions.find((a) => a.type === 'send')).toMatchObject({ text: expect.stringContaining('Sigue con X') });
  });

  it('uses the plain wrap message without agents and retries once when the prompt is missing', () => {
    let r = go(initialState('same'), { now: 0, usage: usage(85, 0), session: busy() });
    expect(r.actions.find((a) => a.type === 'send')).toMatchObject({ text: expect.stringContaining('Stop the task you are doing') });
    r = go(r.s, { now: MIN, usage: usage(88, 0), session: idle(answered('olvidé el prompt')) });
    expect(r.sends).toEqual(['wrap_retry']);
    r = go(r.s, { now: 2 * MIN, usage: usage(88, 0), session: idle(answered('otra vez nada')) });
    expect(r.s.phase).toBe('waiting_reset');
    expect(r.s.handoff).toBeNull();
  });

  it('with strategy "new" spawns a new conversation after the reset', () => {
    let r = go(initialState('new'), { now: 0, usage: usage(90, 0, 10 * MIN), session: busy() });
    r = go(r.s, { now: MIN, usage: usage(90, 0, 10 * MIN), session: idle(answered('<prompt>P</prompt>')) });
    r = go(r.s, { now: 13 * MIN, usage: usage(0, 13 * MIN), session: idle() });
    expect(r.actions.find((a) => a.type === 'spawnNew')).toMatchObject({ prompt: expect.stringContaining('P') });
    expect(r.sends).toEqual([]);
  });

  it('with strategy "ask" waits for confirmation', () => {
    let r = go(initialState('ask'), { now: 0, usage: usage(90, 0, 10 * MIN), session: busy() });
    r = go(r.s, { now: MIN, usage: usage(90, 0, 10 * MIN), session: idle(answered('<prompt>P</prompt>')) });
    r = go(r.s, { now: 13 * MIN, usage: usage(0, 13 * MIN), session: idle() });
    expect(r.s.phase).toBe('awaiting_confirm');
    const c = command(r.s, 'confirmResume', 14 * MIN);
    expect(c.state.phase).toBe('running');
    expect(c.actions.some((a) => a.type === 'send' && a.kind === 'resume')).toBe(true);
  });

  it('notifies once when the session waits for the user and does not nudge', () => {
    const waiting: SessionObs = { alive: true, activity: 'waiting_user', subagents: 0, turn: null, waitingReason: 'Permiso' };
    let r = go(initialState('same'), { now: 0, usage: null, session: waiting });
    expect(r.actions.filter((a) => a.type === 'notify')).toHaveLength(1);
    expect(r.sends).toEqual([]);
    r = go(r.s, { now: MIN, usage: null, session: waiting });
    expect(r.actions.filter((a) => a.type === 'notify')).toHaveLength(0);
  });

  it('resends a lost message once, then halts', () => {
    let r = go(initialState('same'), { now: 0, usage: null, session: idle() });
    const notStarted = { started: false, ended: false, text: '', toolUses: 0 };
    r = go(r.s, { now: 4 * MIN, usage: null, session: idle(notStarted) });
    expect(r.sends).toEqual(['nudge']);
    r = go(r.s, { now: 8 * MIN, usage: null, session: idle(notStarted) });
    expect(r.s.phase).toBe('halted');
  });

  it('halts when the session dies', () => {
    const r = go(initialState('same'), { now: 0, usage: null, session: { alive: false, activity: 'busy', subagents: 0, turn: null } });
    expect(r.s.phase).toBe('halted');
  });

  it('manual wrap waits for confirmation instead of resuming right away', () => {
    let { state } = command(initialState('same'), 'wrapNow', 0);
    let r = go(state, { now: MIN, usage: usage(20, MIN), session: idle(answered('<prompt>P</prompt>')) });
    expect(r.s.phase).toBe('waiting_reset');
    r = go(r.s, { now: 2 * MIN, usage: usage(20, 2 * MIN), session: idle() });
    expect(r.s.phase).toBe('awaiting_confirm');
    state = command(r.s, 'pause', 3 * MIN).state;
    expect(command(state, 'unpause', 4 * MIN).state.phase).toBe('awaiting_confirm');
  });

  it('speaks Spanish when the interface is in Spanish, and understands Spanish tags', () => {
    setLang('es');
    let r = go(initialState('same'), { now: 0, usage: usage(86, 0), session: busy(null, 1) });
    expect(r.actions.find((a) => a.type === 'send')).toMatchObject({ text: expect.stringContaining('Deja que termine el o los agentes') });
    r = go(initialState('same'), { now: 0, usage: null, session: idle() });
    r = go(r.s, { now: MIN, usage: null, session: idle(answered('Hecho. <relevo>TERMINADO</relevo>')) });
    expect(r.s.phase).toBe('done');
  });
});
