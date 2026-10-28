import { EventEmitter } from 'node:events';
import type { Config, ResetStrategy } from './config.js';
import { type RegistryEntry, registryFor, readRegistry, type SessionInfo } from './discovery/sessions.js';
import { findTranscript, runningSubagents, TranscriptReader } from './discovery/transcript.js';
import { type Action, type Command, command, initialState, type MachineState, type SessionObs, step } from './engine/machine.js';
import { isPidAlive } from './exec.js';
import * as tmux from './host/tmux.js';
import { t } from './i18n/index.js';
import { notify } from './notify.js';
import { remoteControlUrl } from './paths.js';
import { appendEvent, clearState, type Persisted, saveHandoff, saveState, type Watched } from './store/state.js';
import { type Usage, type UsageProvider, worstWindow } from './usage/usage.js';

const SESSION_POLL_MS = 10_000;
const PERMISSION_QUIET_MS = 60_000;
const READY_TIMEOUT_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type AdoptStage =
  | { kind: 'waiting_close'; pid: number; origin: string }
  | { kind: 'launching' }
  | { kind: 'dialog'; text: string }
  | { kind: 'ready' }
  | { kind: 'failed'; error: string };

export interface LogLine {
  at: number;
  msg: string;
}

/**
 * Glues the pure state machine to the outside world: tmux, transcript, registry,
 * usage endpoint and notifications. Emits `update` whenever something visible changes.
 */
export class Controller extends EventEmitter {
  machine: MachineState;
  usage: Usage | null = null;
  usageError: string | null = null;
  nextUsageAt = 0;
  lastObs: SessionObs | null = null;
  log: LogLine[] = [];
  private reader: TranscriptReader;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  /** Set by `releaseWhenIdle`: hand the conversation back as soon as the current turn ends. */
  releasing = false;
  released = false;

  constructor(
    public watched: Watched,
    private readonly cfg: Config,
    private readonly usageProvider: UsageProvider,
    machine?: MachineState,
    strategy: ResetStrategy = 'same',
  ) {
    super();
    this.machine = machine ?? initialState(strategy);
    this.reader = new TranscriptReader(watched.transcriptPath);
  }

  get remoteControlUrl(): string | null {
    return this.watched.bridgeSessionId ? remoteControlUrl(this.watched.bridgeSessionId) : null;
  }

  get attachCommand(): string {
    return tmux.attachCommand(this.watched.tmuxName);
  }

  start(): void {
    this.addLog(t().controller.watching(this.watched.title, this.watched.tmuxName));
    void this.tick();
    this.timer = setInterval(() => void this.tick(), SESSION_POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async run(cmd: Command): Promise<void> {
    const { state, actions } = command(this.machine, cmd, Date.now(), this.lastObs?.subagents ?? 0);
    this.machine = state;
    this.addLog(t().controller.manualCommand(cmd));
    await this.execute(actions);
    this.persist();
    this.emit('update');
  }

  /** Forces a usage refresh on the next tick. */
  refreshUsage(): void {
    this.nextUsageAt = 0;
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = Date.now();
      if (now >= this.nextUsageAt) await this.pollUsage(now);
      const session = await this.observe(now);
      this.lastObs = session;
      if (this.releasing && (!session.alive || (!session.working && session.subagents === 0))) {
        await this.release();
        return;
      }
      const { state, actions } = step(this.machine, { now, usage: this.usage, session }, this.cfg);
      this.machine = state;
      await this.execute(actions);
      this.persist();
    } catch (err) {
      this.addLog(t().controller.checkError((err as Error).message));
    } finally {
      this.ticking = false;
      this.emit('update');
    }
  }

  private async pollUsage(now: number): Promise<void> {
    try {
      this.usage = await this.usageProvider.get();
      this.usageError = this.usage.error ?? null;
    } catch (err) {
      this.usageError = (err as Error).message;
    }
    const pct = this.usage ? (worstWindow(this.usage)?.window.pct ?? 0) : 0;
    const minutes = pct >= this.cfg.nearThreshold ? this.cfg.fastPollMin : this.cfg.slowPollMin;
    let next = now + minutes * 60_000;
    // While waiting for a reset, check right after it instead of up to `minutes` late.
    const resetAt = this.machine.resetAt;
    if (this.machine.phase === 'waiting_reset' && resetAt) {
      const readyAt = resetAt + this.cfg.resetMarginMin * 60_000;
      if (readyAt > now) next = Math.min(next, readyAt);
    }
    this.nextUsageAt = next;
  }

  private async observe(now: number): Promise<SessionObs> {
    this.reader.update();
    const reg = registryFor(this.watched.sessionId);
    if (reg?.bridgeSessionId && reg.bridgeSessionId !== this.watched.bridgeSessionId) {
      this.watched.bridgeSessionId = reg.bridgeSessionId;
      this.addLog(`Remote Control: ${this.remoteControlUrl}`);
    }
    const alive = (await tmux.hasSession(this.watched.tmuxName)) && !(await tmux.paneDead(this.watched.tmuxName));
    const subagents = runningSubagents(this.watched.transcriptPath, undefined, now);
    const pending = this.machine.pending;
    const turn = pending ? this.reader.turnSince(pending.sentAt - 2_000) : null;
    if (!alive) return { alive, activity: 'busy', subagents, turn };

    const screen = await tmux.capture(this.watched.tmuxName);
    const dialog = tmux.blockingDialog(screen.split('\n').slice(-25).join('\n'));
    const lastChange = Math.max(this.reader.lastActivity, reg?.statusUpdatedAt ?? 0);
    const quietFor = now - lastChange;
    const registryIdle = reg?.status !== 'busy';
    const working = !registryIdle || !this.reader.lastTurnEnded;

    let activity: SessionObs['activity'] = 'busy';
    let waitingReason: string | undefined;
    if (dialog) {
      activity = 'waiting_user';
      waitingReason = dialog;
    } else if (reg?.status === 'waiting') {
      activity = 'waiting_user';
    } else if (registryIdle && this.reader.pendingToolUses > 0 && quietFor > PERMISSION_QUIET_MS) {
      activity = 'waiting_user';
      waitingReason = t().controller.toolWithoutResult;
    } else if (registryIdle && this.reader.lastTurnEnded && quietFor >= this.cfg.settleSec * 1000) {
      activity = 'idle';
    }
    return { alive, activity, subagents, turn, waitingReason, working: working && activity !== 'waiting_user' };
  }

  private async execute(actions: Action[]): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'send':
          await tmux.send(this.watched.tmuxName, action.text);
          this.addLog(t().controller.sent(action.kind, action.text.split('\n')[0]!.slice(0, 110)));
          break;
        case 'notify':
          await notify(action.title, action.body);
          break;
        case 'saveHandoff': {
          const file = saveHandoff(this.watched.sessionId, action.text);
          this.addLog(t().controller.handoffSavedAt(file));
          break;
        }
        case 'spawnNew':
          await this.spawnNew(action.prompt);
          break;
        case 'log':
          this.addLog(action.msg);
          break;
      }
    }
  }

  /** Strategy "new": a fresh conversation in the same folder, same model; the old one is closed. */
  private async spawnNew(prompt: string): Promise<void> {
    const oldName = this.watched.tmuxName;
    const name = `relevo-n${Date.now().toString(36)}`;
    await tmux.launch(name, {
      cwd: this.watched.cwd,
      model: this.watched.model,
      effort: this.watched.effort,
      permissionMode: this.watched.permissionMode,
      remoteControlName: `Relevo: ${this.watched.title}`.slice(0, 60),
      prompt,
    });
    const entry = await waitForRegistry((e) => Boolean(e.tmux?.startsWith(`${name}:`)), READY_TIMEOUT_MS);
    if (!entry) throw new Error(t().controller.newDidNotStart);
    const transcriptPath = await waitForTranscript(entry.sessionId, entry.cwd);
    this.watched = { ...this.watched, sessionId: entry.sessionId, tmuxName: name, transcriptPath, bridgeSessionId: entry.bridgeSessionId };
    this.reader = new TranscriptReader(transcriptPath);
    await tmux.kill(oldName);
    this.addLog(t().controller.newConversation(entry.sessionId, name));
  }

  /**
   * Hands the conversation back so it can be opened elsewhere (VSCode, Desktop, another terminal):
   * stops watching, ends the claude process in tmux and forgets the task. The history stays in the transcript.
   */
  async release(): Promise<void> {
    this.stop();
    this.releasing = false;
    await tmux.kill(this.watched.tmuxName);
    clearState();
    this.released = true;
    this.addLog(t().controller.released);
    this.emit('released');
  }

  /** Like `release`, but first lets the current turn (and its subagents) finish. Pauses Relevo meanwhile. */
  async releaseWhenIdle(): Promise<void> {
    if (this.machine.phase !== 'paused') await this.run('pause');
    this.releasing = true;
    this.addLog(t().controller.willRelease);
    void this.tick();
  }

  private persist(): void {
    if (this.released) return;
    const data: Persisted = { version: 1, watched: this.watched, machine: this.machine };
    saveState(data);
  }

  addLog(msg: string): void {
    this.log.push({ at: Date.now(), msg });
    if (this.log.length > 200) this.log.shift();
    appendEvent(`[${this.watched.sessionId.slice(0, 8)}] ${msg}`);
    this.emit('update');
  }
}

async function waitForRegistry(match: (e: RegistryEntry) => boolean, timeoutMs: number): Promise<RegistryEntry | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const entry = readRegistry().find(match);
    if (entry) return entry;
    await sleep(1_000);
  }
  return null;
}

async function waitForTranscript(sessionId: string, cwd: string, timeoutMs = 60_000): Promise<string> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const path = findTranscript(sessionId, cwd);
    if (path) return path;
    await sleep(1_000);
  }
  throw new Error(t().controller.noTranscript(sessionId));
}

/**
 * Moves a conversation into a Relevo-owned tmux session. If it is still open elsewhere,
 * waits (reporting `waiting_close`) until the user closes it. Cancel with the signal.
 */
export async function adopt(
  info: SessionInfo,
  onStage: (stage: AdoptStage) => void,
  signal: AbortSignal,
): Promise<Watched | null> {
  const name = tmux.sessionNameFor(info.sessionId);
  const alreadyOurs = Boolean(info.tmux?.startsWith(`${name}:`)) && (await tmux.hasSession(name)) && !(await tmux.paneDead(name));

  if (!alreadyOurs) {
    for (;;) {
      if (signal.aborted) return null;
      const live = registryFor(info.sessionId);
      if (!live) break;
      onStage({ kind: 'waiting_close', pid: live.pid, origin: info.origin });
      await sleep(1_500);
    }
    if (await tmux.hasSession(name)) await tmux.kill(name);
    onStage({ kind: 'launching' });
    await tmux.launch(name, {
      cwd: info.cwd,
      resumeSessionId: info.sessionId,
      model: info.model,
      effort: info.effort,
      permissionMode: info.permissionMode,
    });
  }

  const until = Date.now() + READY_TIMEOUT_MS;
  let entry: RegistryEntry | undefined;
  while (Date.now() < until) {
    if (signal.aborted) return null;
    entry = registryFor(info.sessionId);
    if (entry?.tmux?.startsWith(`${name}:`)) break;
    entry = undefined;
    if (await tmux.paneDead(name)) {
      const screen = await tmux.capture(name);
      onStage({ kind: 'failed', error: t().controller.claudeExited(screen.trim().split('\n').slice(-8).join('\n')) });
      return null;
    }
    const dialog = tmux.blockingDialog(await tmux.capture(name));
    if (dialog) onStage({ kind: 'dialog', text: dialog });
    await sleep(1_000);
  }
  if (!entry) {
    onStage({ kind: 'failed', error: t().controller.didNotStart(READY_TIMEOUT_MS / 1000, tmux.attachCommand(name)) });
    return null;
  }
  onStage({ kind: 'ready' });
  return {
    sessionId: info.sessionId,
    title: info.title,
    cwd: info.cwd,
    tmuxName: name,
    model: info.model,
    effort: info.effort,
    permissionMode: info.permissionMode,
    transcriptPath: info.transcriptPath ?? (await waitForTranscript(info.sessionId, info.cwd)),
    bridgeSessionId: entry.bridgeSessionId,
  };
}

/** Sends SIGTERM to the process that has the conversation open elsewhere (after the user confirms). */
export function closeOriginal(pid: number): boolean {
  if (!isPidAlive(pid)) return true;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}
