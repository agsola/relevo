import { render } from 'ink';
import { loadConfig } from './config.js';
import { listSessions } from './discovery/sessions.js';
import { run } from './exec.js';
import { hasSession, paneDead, tmuxAvailable } from './host/tmux.js';
import { detectLang, setLang, t } from './i18n/index.js';
import { notify } from './notify.js';
import { CONFIG_FILE, RELEVO_DIR } from './paths.js';
import { loadState } from './store/state.js';
import { App } from './ui/App.js';
import { OAuthUsageProvider } from './usage/usage.js';

async function doctor(): Promise<number> {
  const msg = t().cli.doctor;
  let failures = 0;
  const check = (ok: boolean, label: string, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  const tmuxOk = await tmuxAvailable();
  check(tmuxOk, 'tmux', tmuxOk ? '' : msg.installTmux);
  const claude = await run('claude', ['--version'], { timeoutMs: 15_000 });
  check(claude.code === 0, msg.claudeCli, claude.stdout.trim() || claude.stderr.trim());
  const keychain = await run('security', ['find-generic-password', '-s', 'Claude Code-credentials']);
  check(keychain.code === 0, msg.keychain, keychain.code === 0 ? '' : msg.signIn);
  try {
    const usage = await new OAuthUsageProvider(() => null).get();
    const fmt = (w: typeof usage.fiveHour) => (w ? `${Math.round(w.pct)}%` : t().ui.noData);
    const source = `${usage.source}${usage.error ? `: ${usage.error}` : ''}`;
    check(usage.source === 'api', msg.usage, msg.usageDetail(fmt(usage.fiveHour), fmt(usage.sevenDay), source));
  } catch (err) {
    check(false, msg.usage, (err as Error).message);
  }
  const sessions = listSessions();
  check(true, msg.conversations, msg.conversationsDetail(sessions.filter((s) => s.running).length, sessions.filter((s) => !s.running).length));
  const saved = loadState();
  if (saved) {
    const alive = (await hasSession(saved.watched.tmuxName)) && !(await paneDead(saved.watched.tmuxName));
    console.log(msg.watched(saved.watched.title, saved.machine.phase, alive));
  }
  await notify('Relevo', msg.notifyBody);
  console.log(msg.notifySent);
  return failures ? 1 : 0;
}

/** Splits `--lang xx` / `--lang=xx` out of the arguments. */
function parseArgs(argv: string[]): { lang?: string; rest: string[] } {
  const rest: string[] = [];
  let lang: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--lang') lang = argv[++i];
    else if (arg.startsWith('--lang=')) lang = arg.slice('--lang='.length);
    else rest.push(arg);
  }
  return { lang, rest };
}

async function main() {
  const { lang, rest } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  setLang(detectLang(lang, config.language));
  const help = t().cli.help(RELEVO_DIR, CONFIG_FILE);

  const arg = rest[0];
  if (arg === '--help' || arg === '-h') return console.log(help);
  if (arg === 'doctor') process.exit(await doctor());
  if (arg) {
    console.error(`${t().cli.unknownArg(arg)}\n\n${help}`);
    process.exit(2);
  }
  if (!(await tmuxAvailable())) {
    console.error(t().cli.needsTmux);
    process.exit(1);
  }
  const previous = loadState();
  const resumable = previous && (await hasSession(previous.watched.tmuxName)) ? previous : null;
  let exitMessage: string | null = null;
  const { waitUntilExit } = render(<App config={config} resumable={resumable} onExitMessage={(m) => (exitMessage = m)} />);
  await waitUntilExit();
  const saved = loadState();
  if (exitMessage) console.log(exitMessage);
  else if (saved && (await hasSession(saved.watched.tmuxName))) console.log(t().stillInTmux(saved.watched.title));
}

void main();
