/** English strings. `es.ts` must provide the same shape (enforced by its type). */

const TAG_RULES =
  'ALWAYS end your reply with one of these tags: ' +
  '<relevo>DONE</relevo> if the whole task is finished, ' +
  '<relevo>CONTINUE</relevo> if there is work left that can move forward, or ' +
  '<relevo>BLOCKED</relevo> if all that is left needs a decision or information from the user.';

const PENDING_FILE = 'RELEVO_PENDING.md';

const PENDING_RULES =
  `If something needs a decision or information from the user, do not stop: write it down in ${PENDING_FILE} ` +
  '(at the project root) and keep going with everything that can move forward without it.';

export const en = {
  locale: 'en-GB',
  yesKey: 'y',
  pendingFile: PENDING_FILE,

  prompts: {
    wrapWithAgents:
      '[Relevo] The usage quota is running out. Let the running agent(s) finish, and once they are done, ' +
      'do not launch new ones, document the current state well, and give me a prompt to continue later.\n' +
      'The prompt must be between these tags <prompt></prompt>.',
    wrap:
      '[Relevo] The usage quota is running out. Stop the task you are doing, and when you are done, ' +
      'document the current state well, and give me a prompt to continue later.\n' +
      'The prompt must be between these tags <prompt></prompt>.',
    wrapRetry:
      '[Relevo] I cannot find the continuation prompt in your reply. ' +
      'Write it in full between the tags <prompt></prompt>, and do nothing else.',
    nudge: `[Relevo] You have stopped. Have you finished the whole task? ${PENDING_RULES}\n${TAG_RULES}`,
    continue: `[Relevo] Keep going with whatever can move forward. ${PENDING_RULES}\n${TAG_RULES}`,
    resume: (handoff: string) =>
      '[Relevo] The usage window has reset. Continue the task following this continuation prompt ' +
      `you left before the pause:\n\n${handoff}\n\n${PENDING_RULES}\n${TAG_RULES}`,
    resumeGeneric:
      '[Relevo] The usage window has reset. Pick the task up where you left it: first check where it stopped, ' +
      `then carry on. ${PENDING_RULES}\n${TAG_RULES}`,
    freshStart: (handoff: string) =>
      `[Relevo] Continuation of a long task that was paused because of the usage quota:\n\n${handoff}\n\n${PENDING_RULES}\n${TAG_RULES}`,
    freshStartFallback: 'Check the state of the project and continue the task where it stopped.',
  },

  time: {
    secondsAgo: (s: number) => `${s}s ago`,
    minutesAgo: (m: number) => `${m} min ago`,
    hoursAgo: (h: number, m: number) => `${h} h ${m} min ago`,
    seconds: (s: number) => `${s}s`,
    minutes: (m: number) => `${m} min`,
    hours: (h: number, m: number) => `${h} h ${m} min`,
  },

  machine: {
    sessionClosed: 'The Claude session has closed (the process is no longer in tmux).',
    waitingUserDefault: 'Claude is waiting for an answer from you (probably a permission)',
    waitingUserTitle: 'Relevo: needs your answer',
    waitingUserBody: (why: string) => `${why}. Answer it through Remote Control or with tmux attach.`,
    waitingUserLog: (why: string) => `Waiting for the user: ${why}`,
    wrapTitle: 'Relevo: wrapping up before the limit',
    wrapBody: (win: string, pct: number) => `${win} usage at ${pct}%. I asked it to document its state and leave a continuation prompt.`,
    doneReason: 'Claude says the task is finished.',
    doneTitle: 'Relevo: task finished',
    doneLog: 'DONE tag: finished.',
    blockedReason: `All that is left needs your decisions (see ${PENDING_FILE} in the project).`,
    blockedTitle: 'Relevo: needs your decisions',
    blockedLog: 'BLOCKED tag: stopping.',
    noTag: 'no tag',
    turnEnded: (tag: string, tools: number) => `Turn ended with ${tag} and ${tools} tool call(s): asking it to continue.`,
    stoppedLog: 'The conversation has stopped: asking whether it has finished.',
    handoffSaved: 'Continuation prompt saved.',
    noPromptRetry: 'No <prompt> in the reply: asking again.',
    noPromptGiveUp: 'Could not get a continuation prompt: when resuming I will ask it to pick up where it left off.',
    stillOver: (win: string, at: string) => `Still above the threshold (${win}); new wait until ${at}.`,
    renewedTitle: 'Relevo: quota renewed',
    renewedAskBody: 'Confirm in Relevo to resume the task.',
    messageLost: 'The message does not show up in the conversation after resending it. Check the session with tmux attach.',
    messageResent: 'The message did not reach the conversation: resending it.',
    guardNudges: (n: number, min: number) => `I have already asked it to continue ${n} times in ${min} min. Stopping so the quota is not spent in a loop.`,
    guardNoProgress: (n: number) => `${n} turns in a row without using any tool: it does not seem to be making progress. Stopping.`,
    whenAt: (at: string) => `at ${at}`,
    whenUsageDrops: 'when usage drops',
    waitingResetLog: (msg: string, win: string, when: string) => `${msg} Waiting for the ${win} window to reset ${when}.`,
    waitingResetTitle: 'Relevo: paused until the reset',
    waitingResetBody: (msg: string, when: string) => `${msg} I will resume ${when}.`,
    resumeNewLog: 'Quota renewed: opening a new conversation with the continuation prompt.',
    resumeSameLog: 'Quota renewed: resuming the conversation.',
    resumingTitle: 'Relevo: resuming',
    resumingBody: 'The usage window has reset and the task continues.',
    haltedTitle: 'Relevo: stopped',
    haltedLog: (reason: string) => `Stopped: ${reason}`,
  },

  controller: {
    watching: (title: string, tmux: string) => `Watching “${title}” in tmux (${tmux}).`,
    manualCommand: (cmd: string) => `Manual command: ${cmd}`,
    checkError: (msg: string) => `Error while checking: ${msg}`,
    toolWithoutResult: 'A tool has had no result for more than a minute (a permission prompt?)',
    sent: (kind: string, first: string) => `→ Sent (${kind}): ${first}…`,
    handoffSavedAt: (file: string) => `Continuation prompt saved to ${file}`,
    newDidNotStart: 'The new conversation did not start (check it with tmux attach).',
    newConversation: (id: string, tmux: string) => `New conversation ${id} in tmux ${tmux}.`,
    released: 'Conversation handed back: Relevo no longer watches it and its tmux process is closed.',
    willRelease: 'I will hand the conversation back as soon as it finishes what it is doing.',
    noTranscript: (id: string) => `The transcript of ${id} does not show up`,
    claudeExited: (screen: string) => `claude exited while resuming:\n${screen}`,
    didNotStart: (secs: number, cmd: string) => `The session did not start within ${secs}s. Check it with: ${cmd}`,
  },

  tmux: {
    dialogTrust: 'Claude asks you to confirm that you trust the folder',
    dialogPermission: 'Claude is asking for a permission',
    dialogResume: 'Claude asks how to resume the session',
    failed: (cmd: string, err: string) => `tmux ${cmd} failed: ${err}`,
  },

  usage: {
    noCredentials: 'Claude Code credentials not found in the keychain',
    noAccessToken: 'The keychain credentials have no accessToken',
  },

  ui: {
    untitled: '(untitled)',
    unknown: '?',
    defaultPermissions: 'default',
    noData: 'no data',
    resetsAt: (at: string, inTime: string) => `· resets at ${at} (${inTime})`,
    yesNo: '(y/n)',
  },

  select: {
    subtitle: 'choose the conversation you want to keep alive',
    watchedBanner: 'A task is already being watched:',
    watchedState: (state: string) => `(state: ${state}).`,
    watchedHelp:
      'While Relevo was closed, the conversation kept running in tmux. Press c to keep watching it, or x to hand it back and continue in VSCode or elsewhere.',
    releaseConfirm: (tmux: string) =>
      `Hand it back: I close its Claude process in tmux (${tmux}) and Relevo forgets it. If it was working, whatever it was doing is cut short; the history is not lost. Afterwards you can open it in VSCode, Desktop or with claude --resume.`,
    releaseQuestion: 'Hand it back? (y/n)',
    searching: 'Looking for conversations…',
    empty: 'There are no running conversations and none used in the last hour.',
    running: (n: number) => `Running (${n})`,
    recent: (n: number) => `Recent, last hour (${n})`,
    none: '  none',
    statusWorking: 'working',
    statusIdle: 'idle',
    statusClosed: 'closed',
    footer: 'RC = has Remote Control. When you pick one, you will see what is going to happen before Relevo does anything.',
    keys: {
      move: 'move',
      pick: 'pick',
      reload: 'reload',
      resumeWatch: 'keep watching the one above',
      release: 'hand it back (continue in VSCode or elsewhere)',
      quit: 'quit',
    },
  },

  setup: {
    subtitle: 'before starting',
    strategies: {
      same: {
        label: 'Continue in the same conversation',
        help: 'After the reset I type the continuation prompt into this same conversation. It keeps all the context (and the Remote Control link), but the context keeps growing.',
      },
      new: {
        label: 'Start a new conversation',
        help: 'After the reset I open a new conversation in the same folder and with the same model, starting with the continuation prompt. Clean context; the old conversation is closed (its history is kept).',
      },
      ask: {
        label: 'Ask me first',
        help: 'When the quota resets I notify you and wait until you confirm in Relevo (key r) before continuing.',
      },
    },
    model: 'model',
    effort: 'effort',
    permissions: 'permissions',
    whatHappens: 'What is going to happen',
    step1Close: (origin: string, pid: number | undefined) =>
      `1. You will have to close the conversation in ${origin} (pid ${pid}). A conversation can only be open in one place; otherwise two processes would be writing to it.`,
    step1Free: '1. The conversation is not open anywhere else, so there is nothing to close.',
    step2:
      '2. Relevo reopens it in a tmux session with the same ID, model, effort and permission mode, and with Remote Control on: you can follow it and reply from claude.ai or your phone, or with tmux attach.',
    step3: (slow: number, fast: number, near: number, threshold: number) =>
      `3. I check usage every ${slow} min (every ${fast} min from ${near}%). When the 5-hour or the weekly window reaches ${threshold}%, I ask it to wrap up properly and leave me a continuation prompt.`,
    step4: (file: string, max: number, win: number, noProgress: number) =>
      `4. If it stops earlier, I ask whether it has finished: if not, to keep going with whatever does not need your decisions and to write those down in ${file}. If I have to push it more than ${max} times in ${win} min, or ${noProgress} times in a row without progress, I stop and let you know.`,
    permissionNote: 'If it ends up waiting for a permission, I do not answer it: I notify you so you approve it yourself.',
    options: 'Options',
    onReset: 'When the quota resets:',
    wrapAt: 'Wrap up at:',
    ofUsage: 'usage',
    thresholdHelp: 'The lower it is, the more room it has to document, but the less of each window is used.',
    start: '[ Start ]',
    keys: { field: 'field', change: 'change value', confirm: 'confirm', back: 'back' },
  },

  adopt: {
    subtitle: (title: string) => `adopting “${title}”`,
    closeTitle: (origin: string) => `Close the conversation in ${origin}`,
    closeBody: (pid: number) =>
      `It is still open (pid ${pid}). Close it there: in VSCode, close the Claude tab of that conversation; in Desktop, close it; in a terminal, quit with /exit or Ctrl+C twice.`,
    closeAuto: 'As soon as it is closed, I reopen it automatically.',
    killConfirm: (pid: number) =>
      `Shall I close process ${pid} (SIGTERM)? Whatever it is doing right now is interrupted; the history is not lost. (y/n)`,
    killHint: 'Or press k and I will close it.',
    launching: (tmux: string) => `Reopening the conversation in tmux (${tmux})…`,
    dialogTitle: 'Claude needs an answer to start',
    dialogHelp: 'Answer it in another terminal with',
    dialogDetach: 'and leave with Ctrl+B and then D.',
    failedTitle: 'Could not adopt it',
    ready: 'Ready.',
    keys: { back: 'back', cancel: 'cancel' },
  },

  dashboard: {
    phases: {
      running: { label: 'Watching', help: 'The task is moving. If it stops, I will ask whether it has finished.' },
      wrapping: { label: 'Wrapping up', help: 'I asked it to document its state and leave a continuation prompt.' },
      waiting_reset: { label: 'Waiting for reset', help: 'Quota exhausted. I will resume when the usage window resets.' },
      awaiting_confirm: { label: 'Waiting for your confirmation', help: 'The quota has been renewed. Press r to resume.' },
      paused: { label: 'Paused', help: 'I send nothing while paused (the conversation carries on by itself).' },
      done: { label: 'Finished', help: 'Claude says the task is finished.' },
      blocked: { label: 'Blocked', help: 'All that is left needs your decisions.' },
      halted: { label: 'Stopped', help: 'I stopped so the quota is not spent for nothing.' },
    },
    sendLabels: {
      nudge: 'have you finished?',
      continue: 'continue',
      wrap: 'document and give me a prompt',
      wrap_retry: 'repeat the prompt',
      resume: 'resume the task',
    },
    activity: { closed: 'closed', waiting: 'waiting for you', working: 'working', idle: 'stopped', settling: 'idle' },
    manual: {
      n: { title: 'Push now', help: 'I type this message right away, even if it has not stopped.' },
      r: {
        title: 'Resume before the reset',
        help: 'The usage window has not reset yet. If usage is still above the threshold, as soon as I resume I will ask it to wrap up again.',
      },
      w: { title: 'Wrap up now', help: 'I ask it to document and leave a continuation prompt now. Afterwards I will wait for you to confirm (r) before continuing.' },
    },
    resumeAt: (at: string, inTime: string, win: string) => `Resuming at ${at} (in ${inTime}), ${win} window.`,
    haveHandoff: 'I have the continuation prompt.',
    noHandoff: 'No continuation prompt.',
    conversation: 'Conversation:',
    subagents: (n: number) => ` · ${n} subagent(s) running`,
    awaitingReply: (label: string) => ` · waiting for its reply to “${label}”`,
    recentNudges: (n: number, max: number) => ` · recent pushes: ${n}/${max}`,
    usageTitle: 'Account usage',
    threshold: (pct: number) => `Threshold ${pct}% (┊).`,
    readAt: (at: string, cached: boolean) => `Read at ${at}${cached ? ' (cached copy, may be out of date)' : ''}. `,
    nextRead: (inTime: string) => `Next read in ${inTime}.`,
    usageError: (err: string) => `Could not read usage: ${err}`,
    whereTitle: 'Where to see it',
    waitingLink: 'waiting for link…',
    detachHint: '(leave with Ctrl+B and then D; do not close it with Ctrl+C)',
    permissions: 'permissions',
    runsInTmux: 'Relevo is running it in tmux right now. Do not open it in VSCode or elsewhere at the same time: to continue there, press x first.',
    releasingTitle: 'Handing the conversation back',
    releasingBody: 'Waiting for it to finish what it is doing before closing its tmux process. Meanwhile I send it nothing.',
    releasingCancel: 'Press c to cancel and keep watching it.',
    releaseTitle: 'Hand the conversation back to continue elsewhere (VSCode, Desktop or another terminal)',
    releaseStop: '· Relevo stops watching it: it will not check usage or send it any more messages.',
    releaseClose: (tmux: string) => `· I close the Claude process running it in tmux (${tmux}). The history is not lost: it is saved on disk.`,
    releaseAfter: '· Afterwards you can open it in VSCode (conversation history in the Claude panel), in Desktop or with claude --resume.',
    releaseBusy: 'It is working right now: if I close it now, whatever it is doing is cut short.',
    releaseBusyOptions: 'w wait until it finishes and hand it back (recommended) · y close it now · n cancel',
    releaseWaitKey: 'w',
    releaseQuestion: 'Hand it back? (y/n)',
    quitTitle: 'Quit Relevo',
    quitKeepsRunning1: '· The conversation ',
    quitKeepsRunningBold: 'keeps running in tmux, but unwatched',
    quitKeepsRunning2: ': nobody will check usage, wrap it up before the limit, or resume it after the reset.',
    quitResume: '· To resume watching, open relevo again and press c.',
    quitUseX: '· If what you want is to continue it in VSCode or elsewhere, use x instead of q.',
    quitQuestion: 'Quit? (y/n)',
    sendQuestion: 'Send it?',
    continueQuestion: 'Go ahead?',
    activityTitle: 'Activity',
    keys: {
      push: 'push now',
      wrap: 'wrap up now',
      pause: 'pause',
      unpause: 'resume watching',
      resume: 'resume task',
      usage: 'read usage',
      release: 'hand back (continue in VSCode or elsewhere)',
      quit: 'quit Relevo (keeps running in tmux, unwatched)',
    },
  },

  released: (title: string, cwd: string, sessionId: string) =>
    [
      `Conversation “${title}” handed back.`,
      'Relevo no longer watches it and its tmux process is closed. The full history is still saved.',
      '',
      'To continue with it:',
      `  · VSCode: Claude panel → conversation history → “${title}”`,
      '  · Claude Desktop: open it from its Code conversation history',
      `  · Terminal: cd ${cwd} && claude --resume ${sessionId}`,
    ].join('\n'),

  stillInTmux: (title: string) =>
    `“${title}” keeps running in tmux, unwatched.\n` +
    '  · To resume watching: relevo, then press c.\n' +
    '  · To continue it in VSCode or elsewhere: relevo, then press x on the start screen (hand it back).',

  cli: {
    help: (dir: string, config: string) => `Relevo — keeps a long Claude Code conversation alive across usage-quota resets.

Usage:
  relevo                  open the interface
  relevo doctor           check that everything needed is available
  relevo --lang en|es     interface language (also RELEVO_LANG, or "language" in config.json)
  relevo --help           this help

Data in ${dir} (configuration in ${config}).`,
    unknownArg: (arg: string) => `Unknown argument: ${arg}`,
    needsTmux: 'Relevo needs tmux. Install it with: brew install tmux',
    doctor: {
      installTmux: 'install it with: brew install tmux',
      claudeCli: 'claude CLI',
      keychain: 'Claude Code credentials in the keychain',
      signIn: 'sign in to claude',
      usage: 'usage reading',
      usageDetail: (five: string, seven: string, source: string) => `5h ${five}, 7d ${seven} (${source})`,
      conversations: 'conversations',
      conversationsDetail: (running: number, recent: number) => `${running} running, ${recent} recent`,
      watched: (title: string, phase: string, alive: boolean) => `ℹ watched task: “${title}” (${phase}), tmux ${alive ? 'running' : 'closed'}`,
      notifyBody: 'Test notification from relevo doctor',
      notifySent: 'ℹ a test notification was sent (if you do not see it, allow notifications for your terminal or Script Editor)',
    },
  },
};

export type Messages = typeof en;
