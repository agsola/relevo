import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';
import type { Config } from '../config.js';
import type { Controller } from '../controller.js';
import type { Command, Phase } from '../engine/machine.js';
import { prompts } from '../engine/prompts.js';
import { t } from '../i18n/index.js';
import type { Watched } from '../store/state.js';
import { clock, Header, isYes, Keys, Panel, shortPath, until, UsageBar } from './common.js';

const PHASE_COLORS: Record<Phase, string> = {
  running: 'green',
  wrapping: 'yellow',
  waiting_reset: 'blue',
  awaiting_confirm: 'magenta',
  paused: 'gray',
  done: 'green',
  blocked: 'red',
  halted: 'red',
};

function activityLabel(o: NonNullable<Controller['lastObs']>): string {
  const a = t().dashboard.activity;
  if (!o.alive) return a.closed;
  if (o.activity === 'waiting_user') return a.waiting;
  if (o.working) return a.working;
  return o.activity === 'idle' ? a.idle : a.settling;
}

/** Manual commands that need a confirmation, keyed by their shortcut. */
const MANUAL: Record<'n' | 'r' | 'w', { cmd: Command; text?: () => string }> = {
  n: { cmd: 'nudgeNow', text: () => prompts().continue },
  r: { cmd: 'confirmResume' },
  w: { cmd: 'wrapNow', text: () => prompts().wrap },
};

type Confirm = keyof typeof MANUAL | 'x' | 'q';

const shellQuote = (s: string) => (/^[\w./~-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);

/** Printed in the terminal after handing a conversation back. */
export const releasedMessage = (w: Watched) => t().released(w.title, shellQuote(w.cwd), w.sessionId);

interface Props {
  controller: Controller;
  config: Config;
  /** `message` is printed in the terminal after Relevo closes. */
  onQuit: (message?: string) => void;
}

export function Dashboard({ controller, config, onQuit }: Props) {
  const [, force] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const msg = t().dashboard;

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    const released = () => onQuit(releasedMessage(controller.watched));
    controller.on('update', rerender);
    controller.on('released', released);
    const clockTimer = setInterval(rerender, 1000);
    return () => {
      controller.off('update', rerender);
      controller.off('released', released);
      clearInterval(clockTimer);
    };
  }, [controller]);

  const m = controller.machine;
  const busy = Boolean(controller.lastObs?.working || controller.lastObs?.subagents);

  useInput((input, key) => {
    const cancel = input === 'n' || key.escape;
    if (confirm === 'x') {
      if (isYes(input)) void controller.release();
      // "wait": `w` in English, `e` (esperar) in Spanish.
      const wait = busy && (input === 'w' || input === 'e');
      if (wait) void controller.releaseWhenIdle();
      if (isYes(input) || wait || cancel) setConfirm(null);
      return;
    }
    if (confirm === 'q') {
      if (isYes(input)) onQuit();
      if (isYes(input) || cancel) setConfirm(null);
      return;
    }
    if (confirm) {
      if (isYes(input)) void controller.run(MANUAL[confirm].cmd);
      if (isYes(input) || cancel) setConfirm(null);
      return;
    }
    if (controller.releasing) {
      if (input === 'c') {
        controller.releasing = false;
        void controller.run('unpause');
      }
      return;
    }
    if (input === 'q' || input === 'x' || input === 'n' || input === 'w') return setConfirm(input);
    if (input === 'p') return void controller.run(m.phase === 'paused' ? 'unpause' : 'pause');
    if (input === 'u') return controller.refreshUsage();
    if (input === 'r') {
      if (m.phase === 'waiting_reset') return setConfirm('r');
      if (m.phase === 'awaiting_confirm') return void controller.run('confirmResume');
      if (m.phase === 'halted' || m.phase === 'blocked' || m.phase === 'done') return void controller.run('unpause');
    }
  });

  const phase = { ...msg.phases[m.phase], color: PHASE_COLORS[m.phase] };
  const obs = controller.lastObs;
  const w = controller.watched;
  const usage = controller.usage;
  const resumeAt = m.resetAt ? m.resetAt + config.resetMarginMin * 60_000 : null;

  return (
    <Box flexDirection="column">
      <Header subtitle={w.title} />
      <Panel>
        <Text>
          <Text bold color={phase.color}>
            ● {phase.label}
          </Text>
          <Text dimColor> — {phase.help}</Text>
        </Text>
        {m.reason && (m.phase === 'halted' || m.phase === 'blocked' || m.phase === 'done') ? <Text color={phase.color}>{m.reason}</Text> : null}
        {m.phase === 'waiting_reset' && resumeAt ? (
          <Text>
            {msg.resumeAt(clock(resumeAt), until(resumeAt), m.resetWindow ?? '')} {m.handoff ? msg.haveHandoff : msg.noHandoff}
          </Text>
        ) : null}
        <Text>
          {msg.conversation} <Text bold>{obs ? activityLabel(obs) : '…'}</Text>
          {obs?.subagents ? <Text>{msg.subagents(obs.subagents)}</Text> : null}
          {m.pending ? <Text dimColor>{msg.awaitingReply(msg.sendLabels[m.pending.kind])}</Text> : null}
          {m.nudges.length ? <Text dimColor>{msg.recentNudges(m.nudges.length, config.guard.maxNudges)}</Text> : null}
        </Text>
        {obs?.waitingReason && obs.activity === 'waiting_user' ? <Text color="yellow">{obs.waitingReason}</Text> : null}
      </Panel>

      <Panel title={msg.usageTitle}>
        <UsageBar label="5h" pct={usage?.fiveHour?.pct ?? null} threshold={config.threshold} resetsAt={usage?.fiveHour?.resetsAt} />
        <UsageBar label="7d" pct={usage?.sevenDay?.pct ?? null} threshold={config.threshold} resetsAt={usage?.sevenDay?.resetsAt} />
        <Text dimColor>
          {msg.threshold(config.threshold)} {usage ? msg.readAt(clock(usage.fetchedAt), usage.source === 'cache') : ''}
          {msg.nextRead(until(controller.nextUsageAt))}
        </Text>
        {controller.usageError ? <Text color="yellow">{msg.usageError(controller.usageError)}</Text> : null}
      </Panel>

      <Panel title={msg.whereTitle}>
        <Text>
          Remote Control: <Text color="cyan">{controller.remoteControlUrl ?? msg.waitingLink}</Text>
        </Text>
        <Text>
          Terminal: <Text color="cyan">{controller.attachCommand}</Text> <Text dimColor>{msg.detachHint}</Text>
        </Text>
        <Text dimColor>
          {shortPath(w.cwd, 60)} · {w.model ?? '?'} · {msg.permissions} {w.permissionMode ?? t().ui.defaultPermissions}
        </Text>
        <Text dimColor>{msg.runsInTmux}</Text>
      </Panel>

      {controller.releasing ? (
        <Panel color="yellow" title={msg.releasingTitle}>
          <Text>{msg.releasingBody}</Text>
          <Text dimColor>{msg.releasingCancel}</Text>
        </Panel>
      ) : null}

      {confirm === 'x' ? (
        <Panel color="yellow" title={msg.releaseTitle}>
          <Text>{msg.releaseStop}</Text>
          <Text>{msg.releaseClose(w.tmuxName)}</Text>
          <Text>{msg.releaseAfter}</Text>
          {busy ? (
            <>
              <Text color="yellow">{msg.releaseBusy}</Text>
              <Text bold>{msg.releaseBusyOptions}</Text>
            </>
          ) : (
            <Text bold>{msg.releaseQuestion}</Text>
          )}
        </Panel>
      ) : confirm === 'q' ? (
        <Panel color="yellow" title={msg.quitTitle}>
          <Text>
            {msg.quitKeepsRunning1}
            <Text bold>{msg.quitKeepsRunningBold}</Text>
            {msg.quitKeepsRunning2}
          </Text>
          <Text>{msg.quitResume}</Text>
          <Text>{msg.quitUseX}</Text>
          <Text bold>{msg.quitQuestion}</Text>
        </Panel>
      ) : confirm ? (
        <Panel color="yellow" title={msg.manual[confirm].title}>
          <Text dimColor>{msg.manual[confirm].help}</Text>
          {MANUAL[confirm].text ? <Text>{MANUAL[confirm].text!()}</Text> : null}
          <Text bold>
            {MANUAL[confirm].text ? msg.sendQuestion : msg.continueQuestion} {t().ui.yesNo}
          </Text>
        </Panel>
      ) : (
        <Panel title={msg.activityTitle}>
          {controller.log.slice(-10).map((l, i) => (
            <Text key={i} wrap="truncate-end">
              <Text dimColor>{clock(l.at)}</Text> {l.msg}
            </Text>
          ))}
        </Panel>
      )}

      <Keys
        items={[
          ['n', msg.keys.push],
          ['w', msg.keys.wrap],
          ['p', m.phase === 'paused' ? msg.keys.unpause : msg.keys.pause],
          ['r', msg.keys.resume],
          ['u', msg.keys.usage],
          ['x', msg.keys.release],
          ['q', msg.keys.quit],
        ]}
      />
    </Box>
  );
}
