import { Box, Text, useInput } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { type AdoptStage, adopt, closeOriginal } from '../controller.js';
import type { SessionInfo } from '../discovery/sessions.js';
import { attachCommand, sessionNameFor } from '../host/tmux.js';
import { t } from '../i18n/index.js';
import type { Watched } from '../store/state.js';
import { Header, isYes, Keys, Panel } from './common.js';

interface Props {
  session: SessionInfo;
  onReady: (w: Watched) => void;
  onCancel: () => void;
}

export function AdoptScreen({ session, onReady, onCancel }: Props) {
  const [stage, setStage] = useState<AdoptStage>({ kind: 'launching' });
  const [confirmKill, setConfirmKill] = useState(false);
  const abort = useRef(new AbortController());
  const msg = t().adopt;

  useEffect(() => {
    const ctrl = abort.current;
    adopt(session, setStage, ctrl.signal)
      .then((w) => w && onReady(w))
      .catch((err: Error) => setStage({ kind: 'failed', error: err.message }));
    return () => ctrl.abort();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      abort.current.abort();
      return onCancel();
    }
    if (stage.kind === 'waiting_close') {
      if (input === 'k') setConfirmKill(true);
      if (confirmKill && isYes(input)) {
        closeOriginal(stage.pid);
        setConfirmKill(false);
      }
      if (confirmKill && input === 'n') setConfirmKill(false);
    }
    if (stage.kind === 'failed' && key.return) onCancel();
  });

  const tmuxName = sessionNameFor(session.sessionId);

  return (
    <Box flexDirection="column">
      <Header subtitle={msg.subtitle(session.title)} />
      {stage.kind === 'waiting_close' ? (
        <Panel color="yellow" title={msg.closeTitle(stage.origin)}>
          <Text>{msg.closeBody(stage.pid)}</Text>
          <Text dimColor>{msg.closeAuto}</Text>
          {confirmKill ? <Text color="yellow">{msg.killConfirm(stage.pid)}</Text> : <Text dimColor>{msg.killHint}</Text>}
        </Panel>
      ) : null}
      {stage.kind === 'launching' ? <Text>{msg.launching(tmuxName)}</Text> : null}
      {stage.kind === 'dialog' ? (
        <Panel color="yellow" title={msg.dialogTitle}>
          <Text>{stage.text}.</Text>
          <Text>
            {msg.dialogHelp} <Text bold>{attachCommand(tmuxName)}</Text> {msg.dialogDetach}
          </Text>
        </Panel>
      ) : null}
      {stage.kind === 'failed' ? (
        <Panel color="red" title={msg.failedTitle}>
          <Text>{stage.error}</Text>
        </Panel>
      ) : null}
      {stage.kind === 'ready' ? <Text color="green">{msg.ready}</Text> : null}
      <Keys items={stage.kind === 'failed' ? [['⏎', msg.keys.back]] : [['esc', msg.keys.cancel]]} />
    </Box>
  );
}
