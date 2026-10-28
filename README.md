# Relevo

**English** · [Español](README.es.md)

Keep a long Claude Code task running across usage-limit resets.

Relevo watches one Claude Code conversation and the usage of your Claude account. Before the 5-hour or weekly usage window runs out, it asks Claude to wrap up properly and leave a continuation prompt. It then waits for the window to reset and resumes the task. If Claude stops early, Relevo asks whether the task is finished, and keeps it going on everything that doesn't need you.

It runs in your terminal on macOS and drives the official `claude` CLI. It makes no AI API calls of its own.

> *Relevo* is Spanish for "relay", as in a relay race: the task passes the baton from one usage window to the next.

> **Unofficial.** Relevo is a personal project, not affiliated with or endorsed by Anthropic. It relies on parts of Claude Code that are not documented (see [Limitations](#limitations)).

## Why

On Claude subscription plans (Pro, Max, Team), usage is limited per 5-hour window and per week. A long agentic task stops wherever it is when the limit hits, often in the middle of a change and with nothing written down about where it was. You then have to come back after the reset, work out what state it was left in, and get it going again.

Relevo does that babysitting for you:

- **Stops cleanly.** At 85 % used (configurable), it asks Claude to finish the current step, let any running subagents complete, document the state and hand over a continuation prompt.
- **Resumes on its own.** When the window resets, it sends the continuation prompt. You choose whether it goes into the same conversation, starts a fresh one, or waits for your confirmation.
- **Keeps it moving.** If Claude stops and waits, Relevo asks whether the task is done. If it needs decisions from you, Claude writes them down in `RELEVO_PENDING.md` and carries on with the rest.
- **Knows when to stop.** It stops and notifies you if it has to push more than 3 times in 15 minutes, if 2 pushes in a row make no progress, if Claude asks for a permission, or if the task is finished or blocked on you.

## Requirements

- macOS (it uses the Keychain and macOS notifications)
- Node.js 22 or later, and pnpm (or npm)
- [tmux](https://github.com/tmux/tmux): `brew install tmux`
- [Claude Code](https://code.claude.com) (`claude` on your `PATH`), logged in with a Claude subscription

## Install

### Without cloning (recommended)

Install the ready-built package from the [latest release](https://github.com/agsola/relevo/releases/latest):

```sh
npm install -g https://github.com/agsola/relevo/releases/download/v0.1.0/relevo-0.1.0.tgz
relevo doctor
```

### From source

```sh
git clone https://github.com/agsola/relevo.git
cd relevo
pnpm install          # also builds
pnpm link --global    # optional: makes the `relevo` command available everywhere
relevo doctor         # checks tmux, claude, credentials, usage reading and notifications
```

Without `pnpm link`, run it as `node bin/relevo.js` from the repository folder.

## Usage

```sh
relevo
```

1. **Pick a conversation.** Relevo lists the conversations that are running now (CLI, VS Code, Claude Desktop) and, below them, the ones used in the last hour. `RC` marks the ones with Remote Control.
2. **Read what will happen and choose the options.** The setup screen explains every step before anything happens. You choose what to do when the quota resets and at which percentage to wrap up.
3. **Close the conversation where it is open.** A conversation can only be driven by one process at a time. Relevo waits until you close it in VS Code, Desktop or the terminal, or it can close it for you (`k`) if you confirm.
4. **Relevo takes over.** It reopens the conversation inside a tmux session, with the same ID, model, effort and permission mode, and with Remote Control on. You can keep following it and replying from claude.ai or the Claude mobile app, or with `tmux attach -t relevo-<id>`. To detach from tmux without stopping it, press Ctrl+B and then D.

### Dashboard keys

| Key | What it does |
|---|---|
| `n` | Push now: tell it to keep going, even if it hasn't stopped |
| `w` | Wrap up now: ask for the state and a continuation prompt |
| `p` | Pause or unpause Relevo (the conversation carries on by itself) |
| `r` | Resume the task, or start watching again after a stop |
| `u` | Read the usage now |
| `x` | **Hand it back**, to continue in VS Code, Desktop or another terminal |
| `q` | Quit Relevo. The conversation **keeps running in tmux, unwatched** |

Every key that sends something or closes something shows what it means and asks for confirmation first.

### Quitting vs handing back

- **`q` quits Relevo only.** The conversation keeps running in tmux, but nothing watches the usage anymore. Open `relevo` again and press `c` to resume watching.
- **`x` hands the conversation back.** Relevo stops watching it and closes its process in tmux. If it is in the middle of something, Relevo can wait for the turn to finish first. It then prints how to reopen it: from the conversation history in VS Code or Desktop, or with `claude --resume <id>`. If you quit with `q`, `x` is also available on the start screen.

Do not open the conversation in VS Code while Relevo is running it in tmux: two processes would be writing to the same conversation.

### Language

The interface follows your system locale (Spanish or English, English by default). The messages Relevo types into the conversation use the same language. To override it, use `relevo --lang en|es`, the `RELEVO_LANG` environment variable, or `"language"` in the config file. Relevo understands the response tags in both languages.

## How it works

The short version:

- A Claude Code conversation is a history file on disk (`~/.claude/projects/<folder>/<session-id>.jsonl`), not a running program. VS Code, Claude Desktop and the CLI all run the same `claude` agent, which loads that file, talks to the model and appends to the file.
- When you close the conversation in VS Code, its process ends and nothing keeps running. Relevo then starts the CLI with `claude --resume <id> --remote-control` inside tmux. That new process loads the same history and carries on. It is a relay between processes, not a live migration, which is why only one of them may have the conversation open at a time.
- Relevo reads the session's state from Claude Code's local files and the usage from the same endpoint the `/usage` command uses. It sends messages by pasting them into the tmux terminal, exactly as if you typed them.

The full explanation is in [docs/how-it-works.md](docs/how-it-works.md). It covers what happens to the agent when you close VS Code, where it runs while Relevo has it, how Remote Control fits in, the state machine and the data sources.

## Configuration and data

Everything is stored in `~/.relevo/`. Set `RELEVO_HOME` to use another folder.

| File | Contents |
|---|---|
| `config.json` | Threshold, polling intervals, loop guard, language |
| `state.json` | The conversation being watched and Relevo's state, so you can close Relevo and come back |
| `handoffs/*.md` | Every continuation prompt Claude handed over |
| `events.log` | Everything Relevo did, with timestamps |

Default `config.json` values:

```json
{
  "threshold": 85,
  "nearThreshold": 70,
  "slowPollMin": 10,
  "fastPollMin": 5,
  "settleSec": 30,
  "resetMarginMin": 2,
  "guard": { "maxNudges": 3, "windowMin": 15, "maxNoProgress": 2 },
  "language": "en"
}
```

| Key | Meaning |
|---|---|
| `threshold` | Percentage of either usage window at which Relevo asks for a wrap-up |
| `slowPollMin`, `fastPollMin` | Minutes between usage checks; the fast rate applies from `nearThreshold` % |
| `settleSec` | Seconds of silence before a conversation counts as stopped |
| `resetMarginMin` | Extra minutes to wait after the reset time before resuming |
| `guard` | Loop protection: stop after `maxNudges` pushes in `windowMin` minutes, or after `maxNoProgress` turns in a row without tool use |

## Limitations

- **Undocumented internals.** Relevo relies on Claude Code internals that are not a public API: the transcript format, the session registry in `~/.claude/sessions/`, and the usage endpoint behind `/usage`. It was built and tested against Claude Code 2.1.x. A future release may change these; if something breaks, start with `relevo doctor`.
- **macOS only** for now (Keychain, `osascript` notifications).
- **One conversation at a time.** All conversations draw from the same account quota, so watching several would need coordinated stops.
- **Your Mac has to stay awake.** The agent runs on your machine. If it sleeps, the task pauses until it wakes. For overnight runs, use `caffeinate -i` or adjust Energy settings.
- **No automatic permission answers.** If Claude asks for a permission, Relevo notifies you and you approve it, via Remote Control or `tmux attach`.

## FAQ

**Does Relevo use my API key or call any AI model?**
No. It only drives the `claude` CLI you already use. The tokens spent are the ones the conversation itself spends when Relevo sends it a message.

**Why not just send messages with `claude -p --resume <id>`?**
If the conversation is still open in another process, a separate process writes a parallel branch into the history, and the live session never sees the message. See [docs/how-it-works.md](docs/how-it-works.md#why-adoption).

**Can I keep using the conversation from my phone?**
Yes. Relevo starts it with Remote Control on, and the link stays the same as before.

**What if Claude Code changes and something breaks?**
Run `relevo doctor`, then `pnpm test`. The transcript parser and the usage parser are the most likely places to need an update.

## Development

```sh
pnpm install
pnpm test        # vitest: transcript parser, tags, usage parsing, i18n, state machine (simulated clock)
pnpm typecheck
pnpm dev         # runs from source with tsx
```

The decision logic lives in `src/engine/machine.ts`. It is a pure function, `step(state, observation) → { state, actions }`, so it can be tested without tmux or a real session. All I/O is in `src/controller.ts`. User-facing text is in `src/i18n/en.ts` and `src/i18n/es.ts`.

```
src/
  cli.tsx              entry point, `relevo doctor`, language detection
  controller.ts        connects the state machine to tmux, transcript, usage and notifications
  engine/              state machine (pure) and prompt/tag handling
  discovery/           running sessions and transcript parsing
  usage/               usage-limit reading
  host/tmux.ts         adopting a conversation and typing into it
  store/               persisted state, handoffs and event log
  i18n/                English and Spanish text
  ui/                  Ink screens
```

## License

[MIT](LICENSE)
