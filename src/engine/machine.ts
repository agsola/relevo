import type { Config, ResetStrategy } from '../config.js';
import type { TurnSummary } from '../discovery/transcript.js';
import { type Usage, worstWindow } from '../usage/usage.js';
import { t } from '../i18n/index.js';
import { extractPrompt, extractTag, looksRateLimited, prompts } from './prompts.js';

export type Phase =
  | 'running' // watching; nudges when it stops
  | 'wrapping' // asked to document and hand over a <prompt>
  | 'waiting_reset' // usage exhausted, waiting for the window to reset
  | 'awaiting_confirm' // reset happened, strategy "ask": waiting for the user
  | 'paused' // the user paused Relevo
  | 'done'
  | 'blocked'
  | 'halted';

export type SendKind = 'nudge' | 'continue' | 'wrap' | 'wrap_retry' | 'resume';

export interface Pending {
  kind: SendKind;
  text: string;
  sentAt: number;
  resent: boolean;
}

export interface MachineState {
  phase: Phase;
  strategy: ResetStrategy;
  pending: Pending | null;
  /** Times of nudge/continue sends, for the loop guard. */
  nudges: number[];
  /** Consecutive nudged turns that did not use a single tool. */
  noProgress: number;
  handoff: string | null;
  resetAt: number | null;
  resetWindow: '5h' | '7d' | null;
  reason: string | null;
  waitingUserNotified: boolean;
  /** Phase to return to after a pause. */
  pausedFrom: Phase | null;
  /** The wrap-up was requested by hand: after it, wait for confirmation instead of resuming. */
  manualWrap: boolean;
}

export interface SessionObs {
  alive: boolean;
  /** `idle` only once it has been quiet for `settleSec`. */
  activity: 'busy' | 'idle' | 'waiting_user';
  /** The model is in the middle of a turn right now (unlike `busy`, not just "recently active"). */
  working?: boolean;
  subagents: number;
  /** What happened since `pending.sentAt` (null when nothing is pending). */
  turn: TurnSummary | null;
  /** Why it is waiting for the user, when known. */
  waitingReason?: string;
}

export interface Observation {
  now: number;
  usage: Usage | null;
  session: SessionObs;
}

export type Action =
  | { type: 'send'; kind: SendKind; text: string }
  | { type: 'notify'; title: string; body: string }
  | { type: 'saveHandoff'; text: string }
  | { type: 'spawnNew'; prompt: string }
  | { type: 'log'; msg: string };

export type Command = 'nudgeNow' | 'wrapNow' | 'pause' | 'unpause' | 'confirmResume';

export function initialState(strategy: ResetStrategy): MachineState {
  return {
    phase: 'running',
    strategy,
    pending: null,
    nudges: [],
    noProgress: 0,
    handoff: null,
    resetAt: null,
    resetWindow: null,
    reason: null,
    waitingUserNotified: false,
    pausedFrom: null,
    manualWrap: false,
  };
}

const RESEND_AFTER_MS = 3 * 60_000;
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString(t().locale, { hour: '2-digit', minute: '2-digit' });

interface Step {
  state: MachineState;
  actions: Action[];
}

/** Pure transition function: everything it needs comes in `obs`, everything it wants done goes out as actions. */
export function step(prev: MachineState, obs: Observation, cfg: Config): Step {
  const s: MachineState = { ...prev, nudges: [...prev.nudges] };
  const actions: Action[] = [];
  const { now, session, usage } = obs;
  const msg = t().machine;

  if (s.phase === 'done' || s.phase === 'blocked' || s.phase === 'halted' || s.phase === 'paused') {
    return { state: s, actions };
  }

  if (!session.alive) {
    return halt(s, actions, msg.sessionClosed);
  }

  if (session.activity === 'waiting_user') {
    if (!s.waitingUserNotified) {
      s.waitingUserNotified = true;
      const why = session.waitingReason ?? msg.waitingUserDefault;
      actions.push({ type: 'notify', title: msg.waitingUserTitle, body: msg.waitingUserBody(why) });
      actions.push({ type: 'log', msg: msg.waitingUserLog(why) });
    }
    // Still allow the wrap-up below: the message queues until the dialog is answered.
  } else {
    s.waitingUserNotified = false;
  }

  const worst = usage ? worstWindow(usage) : null;
  const over = worst !== null && worst.window.pct >= cfg.threshold;

  switch (s.phase) {
    case 'running': {
      if (over && worst) {
        s.phase = 'wrapping';
        s.resetWindow = worst.name;
        s.resetAt = worst.window.resetsAt;
        const text = session.subagents > 0 ? prompts().wrapWithAgents : prompts().wrap;
        send(s, actions, 'wrap', text, now);
        actions.push({
          type: 'notify',
          title: msg.wrapTitle,
          body: msg.wrapBody(worst.name, Math.round(worst.window.pct)),
        });
        return { state: s, actions };
      }
      if (s.pending) {
        if (!awaitTurn(s, actions, session, now)) return { state: s, actions };
        const turn = session.turn!;
        const kind = s.pending.kind;
        s.pending = null;
        const tag = extractTag(turn.text);
        if (kind === 'resume') s.noProgress = 0;
        else s.noProgress = turn.toolUses > 0 ? 0 : s.noProgress + 1;

        if (tag === 'done') {
          s.phase = 'done';
          s.reason = msg.doneReason;
          actions.push({ type: 'notify', title: msg.doneTitle, body: s.reason });
          actions.push({ type: 'log', msg: msg.doneLog });
          return { state: s, actions };
        }
        if (tag === 'blocked') {
          s.phase = 'blocked';
          s.reason = msg.blockedReason;
          actions.push({ type: 'notify', title: msg.blockedTitle, body: s.reason });
          actions.push({ type: 'log', msg: msg.blockedLog });
          return { state: s, actions };
        }
        actions.push({ type: 'log', msg: msg.turnEnded(tag?.toUpperCase() ?? msg.noTag, turn.toolUses) });
        return nudge(s, actions, 'continue', now, cfg);
      }
      if (session.activity === 'idle' && session.subagents === 0) {
        actions.push({ type: 'log', msg: msg.stoppedLog });
        return nudge(s, actions, 'nudge', now, cfg);
      }
      return { state: s, actions };
    }

    case 'wrapping': {
      if (!s.pending) return { state: s, actions };
      if (!awaitTurn(s, actions, session, now)) return { state: s, actions };
      const turn = session.turn!;
      const kind = s.pending.kind;
      s.pending = null;
      const handoff = extractPrompt(turn.text);
      if (handoff) {
        s.handoff = handoff;
        actions.push({ type: 'saveHandoff', text: handoff });
        return toWaitingReset(s, actions, msg.handoffSaved);
      }
      if (kind === 'wrap' && !looksRateLimited(turn.text)) {
        send(s, actions, 'wrap_retry', prompts().wrapRetry, now);
        actions.push({ type: 'log', msg: msg.noPromptRetry });
        return { state: s, actions };
      }
      s.handoff = null;
      return toWaitingReset(s, actions, msg.noPromptGiveUp);
    }

    case 'waiting_reset': {
      if (!usage || !worst) return { state: s, actions };
      const readyAt = (s.resetAt ?? 0) + cfg.resetMarginMin * 60_000;
      if (usage.fetchedAt < readyAt) return { state: s, actions };
      if (over) {
        // Still exhausted (e.g. the weekly window): follow the new reset time.
        if (worst.window.resetsAt && worst.window.resetsAt !== s.resetAt) {
          s.resetAt = worst.window.resetsAt;
          s.resetWindow = worst.name;
          actions.push({ type: 'log', msg: msg.stillOver(worst.name, hhmm(s.resetAt)) });
        }
        return { state: s, actions };
      }
      if (s.strategy === 'ask' || s.manualWrap) {
        s.phase = 'awaiting_confirm';
        actions.push({ type: 'notify', title: msg.renewedTitle, body: msg.renewedAskBody });
        return { state: s, actions };
      }
      return resume(s, actions, now);
    }

    case 'awaiting_confirm':
      return { state: s, actions };
  }
}

/** Commands from the UI. */
export function command(prev: MachineState, cmd: Command, now: number, subagents = 0): Step {
  const s: MachineState = { ...prev, nudges: [...prev.nudges] };
  const actions: Action[] = [];
  switch (cmd) {
    case 'pause':
      if (s.phase !== 'paused') {
        s.pausedFrom = s.phase;
        s.phase = 'paused';
      }
      return { state: s, actions };
    case 'unpause':
      if (s.phase === 'paused') {
        s.phase = s.pausedFrom ?? 'running';
        s.pausedFrom = null;
      } else if (s.phase === 'halted' || s.phase === 'blocked' || s.phase === 'done') {
        // Explicit restart after a stop: forget the guard history.
        s.phase = 'running';
        s.reason = null;
        s.nudges = [];
        s.noProgress = 0;
        s.pending = null;
      }
      return { state: s, actions };
    case 'nudgeNow':
      s.phase = 'running';
      s.nudges = [];
      s.noProgress = 0;
      send(s, actions, 'continue', prompts().continue, now);
      return { state: s, actions };
    case 'wrapNow':
      s.phase = 'wrapping';
      s.resetAt = null;
      s.manualWrap = true;
      send(s, actions, 'wrap', subagents > 0 ? prompts().wrapWithAgents : prompts().wrap, now);
      return { state: s, actions };
    case 'confirmResume':
      if (s.phase !== 'awaiting_confirm' && s.phase !== 'waiting_reset') return { state: s, actions };
      return resume(s, actions, now);
  }
}

function send(s: MachineState, actions: Action[], kind: SendKind, text: string, now: number): void {
  s.pending = { kind, text, sentAt: now, resent: false };
  actions.push({ type: 'send', kind, text });
}

/** True when the turn that answers `s.pending` has finished. Handles lost messages. */
function awaitTurn(s: MachineState, actions: Action[], session: SessionObs, now: number): boolean {
  const pending = s.pending!;
  const turn = session.turn;
  if (!turn?.started) {
    if (session.activity === 'idle' && now - pending.sentAt > RESEND_AFTER_MS) {
      if (pending.resent) {
        halt(s, actions, t().machine.messageLost);
        return false;
      }
      s.pending = { ...pending, sentAt: now, resent: true };
      actions.push({ type: 'send', kind: pending.kind, text: pending.text });
      actions.push({ type: 'log', msg: t().machine.messageResent });
    }
    return false;
  }
  return turn.ended && session.activity === 'idle' && session.subagents === 0;
}

function nudge(s: MachineState, actions: Action[], kind: 'nudge' | 'continue', now: number, cfg: Config): Step {
  const windowMs = cfg.guard.windowMin * 60_000;
  s.nudges = s.nudges.filter((t) => now - t < windowMs);
  if (s.nudges.length >= cfg.guard.maxNudges) {
    return halt(s, actions, t().machine.guardNudges(s.nudges.length, cfg.guard.windowMin));
  }
  if (s.noProgress >= cfg.guard.maxNoProgress) {
    return halt(s, actions, t().machine.guardNoProgress(s.noProgress));
  }
  s.nudges.push(now);
  send(s, actions, kind, kind === 'nudge' ? prompts().nudge : prompts().continue, now);
  return { state: s, actions };
}

function toWaitingReset(s: MachineState, actions: Action[], text: string): Step {
  const msg = t().machine;
  s.phase = 'waiting_reset';
  const when = s.resetAt ? msg.whenAt(hhmm(s.resetAt)) : msg.whenUsageDrops;
  actions.push({ type: 'log', msg: msg.waitingResetLog(text, s.resetWindow ?? '', when) });
  actions.push({ type: 'notify', title: msg.waitingResetTitle, body: msg.waitingResetBody(text, when) });
  return { state: s, actions };
}

function resume(s: MachineState, actions: Action[], now: number): Step {
  s.phase = 'running';
  s.nudges = [];
  s.noProgress = 0;
  s.resetAt = null;
  s.resetWindow = null;
  s.manualWrap = false;
  const msg = t().machine;
  if (s.strategy === 'new') {
    const prompt = prompts().freshStart(s.handoff ?? prompts().freshStartFallback);
    s.pending = { kind: 'resume', text: prompt, sentAt: now, resent: true };
    actions.push({ type: 'spawnNew', prompt });
    actions.push({ type: 'log', msg: msg.resumeNewLog });
  } else {
    send(s, actions, 'resume', s.handoff ? prompts().resume(s.handoff) : prompts().resumeGeneric, now);
    actions.push({ type: 'log', msg: msg.resumeSameLog });
  }
  actions.push({ type: 'notify', title: msg.resumingTitle, body: msg.resumingBody });
  return { state: s, actions };
}

function halt(s: MachineState, actions: Action[], reason: string): Step {
  s.phase = 'halted';
  s.reason = reason;
  s.pending = null;
  actions.push({ type: 'notify', title: t().machine.haltedTitle, body: reason });
  actions.push({ type: 'log', msg: t().machine.haltedLog(reason) });
  return { state: s, actions };
}
