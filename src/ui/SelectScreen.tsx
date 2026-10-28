import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';
import { listSessions, type SessionInfo } from '../discovery/sessions.js';
import { kill } from '../host/tmux.js';
import { t } from '../i18n/index.js';
import { clearState, type Persisted } from '../store/state.js';
import { ago, Header, isYes, Keys, Panel, shortPath, truncate } from './common.js';
import { releasedMessage } from './Dashboard.js';

interface Props {
  resumable: Persisted | null;
  onPick: (s: SessionInfo) => void;
  onResumeWatch: () => void;
  onQuit: (message?: string) => void;
}

export function SelectScreen({ resumable, onPick, onResumeWatch, onQuit }: Props) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const msg = t().select;

  const load = () => {
    setSessions(null);
    // Let Ink paint "Looking…" before the synchronous scan.
    setTimeout(() => setSessions(listSessions()), 10);
  };
  useEffect(load, []);

  useInput((input, key) => {
    if (confirmRelease && resumable) {
      if (isYes(input)) {
        void kill(resumable.watched.tmuxName).then(() => {
          clearState();
          onQuit(releasedMessage(resumable.watched));
        });
      }
      if (input === 'n' || key.escape) setConfirmRelease(false);
      return;
    }
    if (input === 'x' && resumable) return setConfirmRelease(true);
    if (input === 'q' || key.escape) return onQuit();
    if (input === 'r') return load();
    if (input === 'c' && resumable) return onResumeWatch();
    if (!sessions?.length) return;
    if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
    if (key.downArrow) setCursor((c) => Math.min(sessions.length - 1, c + 1));
    if (key.return) onPick(sessions[cursor]!);
  });

  const running = sessions?.filter((s) => s.running) ?? [];
  const recent = sessions?.filter((s) => !s.running) ?? [];

  const row = (s: SessionInfo, index: number) => {
    const selected = index === cursor;
    const status = s.running ? (s.status === 'busy' ? msg.statusWorking : msg.statusIdle) : msg.statusClosed;
    return (
      <Box key={s.sessionId}>
        <Text color={selected ? 'cyan' : undefined} bold={selected}>
          {selected ? '❯ ' : '  '}
          {truncate(s.title, 42).padEnd(42)}
        </Text>
        <Text dimColor> {shortPath(s.cwd, 28).padEnd(28)}</Text>
        <Text> {s.origin.padEnd(7)}</Text>
        <Text color={s.remoteControl ? 'green' : 'gray'}>{s.remoteControl ? ' RC ' : ' -- '}</Text>
        <Text> {truncate(s.model ?? '?', 18).padEnd(18)}</Text>
        <Text color={s.status === 'busy' ? 'yellow' : undefined}> {status.padEnd(10)}</Text>
        <Text dimColor> {ago(s.lastActivity)}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Header subtitle={msg.subtitle} />
      {resumable ? (
        <Panel color="green">
          <Text>
            {msg.watchedBanner} <Text bold>{resumable.watched.title}</Text>{' '}
            {msg.watchedState(t().dashboard.phases[resumable.machine.phase].label.toLowerCase())}
          </Text>
          <Text dimColor>{msg.watchedHelp}</Text>
          {confirmRelease ? (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">{msg.releaseConfirm(resumable.watched.tmuxName)}</Text>
              <Text bold>{msg.releaseQuestion}</Text>
            </Box>
          ) : null}
        </Panel>
      ) : null}
      {sessions === null ? (
        <Text dimColor>{msg.searching}</Text>
      ) : sessions.length === 0 ? (
        <Text>{msg.empty}</Text>
      ) : (
        <Box flexDirection="column">
          <Text bold>{msg.running(running.length)}</Text>
          {running.length ? running.map((s, i) => row(s, i)) : <Text dimColor>{msg.none}</Text>}
          <Box marginTop={1}>
            <Text bold>{msg.recent(recent.length)}</Text>
          </Box>
          {recent.length ? recent.map((s, i) => row(s, running.length + i)) : <Text dimColor>{msg.none}</Text>}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{msg.footer}</Text>
      </Box>
      <Keys
        items={[
          ['↑↓', msg.keys.move],
          ['⏎', msg.keys.pick],
          ['r', msg.keys.reload],
          ...(resumable
            ? ([
                ['c', msg.keys.resumeWatch],
                ['x', msg.keys.release],
              ] as [string, string][])
            : []),
          ['q', msg.keys.quit],
        ]}
      />
    </Box>
  );
}
