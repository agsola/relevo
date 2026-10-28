import { run } from '../exec.js';
import { t } from '../i18n/index.js';

/**
 * Variables Claude Code sets for its own child processes. If Relevo is launched from
 * inside a Claude session (or the tmux server was), the adopted session would inherit
 * them and believe it is a child of another session.
 */
function inheritedClaudeVars(): string[] {
  const known = [
    'CLAUDECODE', 'CLAUDE_PID', 'CLAUDE_EFFORT', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_MESSAGING_SOCKET', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_CODE_CHILD_SESSION',
  ];
  const fromEnv = Object.keys(process.env).filter((k) => k.startsWith('CLAUDE_CODE_'));
  return [...new Set([...known, ...fromEnv])];
}

export interface LaunchOptions {
  cwd: string;
  resumeSessionId?: string;
  model?: string | null;
  effort?: string | null;
  permissionMode?: string | null;
  remoteControlName?: string;
  /** Initial prompt for a brand-new conversation. */
  prompt?: string;
}

export function claudeArgs(opts: LaunchOptions): string[] {
  const args: string[] = [];
  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  args.push('--remote-control');
  if (opts.remoteControlName) args.push(opts.remoteControlName);
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  if (opts.permissionMode === 'bypassPermissions') args.push('--dangerously-skip-permissions');
  else if (opts.permissionMode) args.push('--permission-mode', opts.permissionMode);
  // `--remote-control [name]` would swallow a bare prompt as its name, so a name always goes first.
  if (opts.prompt) {
    if (!opts.remoteControlName) args.splice(args.indexOf('--remote-control') + 1, 0, 'Relevo');
    args.push(opts.prompt);
  }
  return args;
}

export async function tmuxAvailable(): Promise<boolean> {
  return (await run('tmux', ['-V'])).code === 0;
}

export async function hasSession(name: string): Promise<boolean> {
  return (await run('tmux', ['has-session', '-t', `=${name}`])).code === 0;
}

export async function launch(name: string, opts: LaunchOptions): Promise<void> {
  const unset = inheritedClaudeVars().flatMap((v) => ['-u', v]);
  const res = await run('tmux', [
    'new-session', '-d', '-s', name, '-x', '200', '-y', '50', '-c', opts.cwd,
    'env', ...unset, 'claude', ...claudeArgs(opts),
  ]);
  if (res.code !== 0) throw new Error(t().tmux.failed('new-session', res.stderr.trim()));
  // Keep the pane after claude exits so the user can read why it ended.
  await run('tmux', ['set-option', '-t', name, 'remain-on-exit', 'on']);
}

/** Types `text` into the session as one bracketed paste and submits it. */
export async function send(name: string, text: string): Promise<void> {
  const buffer = `relevo-${process.pid}`;
  let res = await run('tmux', ['load-buffer', '-b', buffer, '-'], { input: text });
  if (res.code !== 0) throw new Error(t().tmux.failed('load-buffer', res.stderr.trim()));
  res = await run('tmux', ['paste-buffer', '-p', '-d', '-b', buffer, '-t', name]);
  if (res.code !== 0) throw new Error(t().tmux.failed('paste-buffer', res.stderr.trim()));
  // Give the TUI a moment to absorb the paste before Enter.
  await new Promise((r) => setTimeout(r, 400));
  await run('tmux', ['send-keys', '-t', name, 'Enter']);
}

export async function capture(name: string): Promise<string> {
  const res = await run('tmux', ['capture-pane', '-p', '-t', name]);
  return res.code === 0 ? res.stdout : '';
}

export async function paneDead(name: string): Promise<boolean> {
  const res = await run('tmux', ['display-message', '-p', '-t', name, '#{pane_dead}']);
  return res.code !== 0 || res.stdout.trim() === '1';
}

export async function kill(name: string): Promise<void> {
  await run('tmux', ['kill-session', '-t', `=${name}`]);
}

/** Dialogs that block the session and need the user (shown via `tmux attach`). */
export function blockingDialog(screen: string): string | null {
  if (/trust this folder|confías en esta carpeta/i.test(screen)) return t().tmux.dialogTrust;
  if (/Do you want to (proceed|make this edit|create)|¿Quieres/i.test(screen)) return t().tmux.dialogPermission;
  if (/Resume from summary|resume the full session/i.test(screen)) return t().tmux.dialogResume;
  return null;
}

export const sessionNameFor = (sessionId: string) => `relevo-${sessionId.slice(0, 8)}`;
export const attachCommand = (name: string) => `tmux attach -t ${name}`;
