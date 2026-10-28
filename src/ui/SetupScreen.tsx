import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { Config, ResetStrategy } from '../config.js';
import type { SessionInfo } from '../discovery/sessions.js';
import { t } from '../i18n/index.js';
import { Header, Keys, Panel, shortPath } from './common.js';

const STRATEGIES: ResetStrategy[] = ['same', 'new', 'ask'];

interface Props {
  session: SessionInfo;
  config: Config;
  onConfirm: (strategy: ResetStrategy, config: Config) => void;
  onBack: () => void;
}

type Field = 'strategy' | 'threshold' | 'go';

export function SetupScreen({ session, config, onConfirm, onBack }: Props) {
  const [strategyIndex, setStrategyIndex] = useState(0);
  const [threshold, setThreshold] = useState(config.threshold);
  const [field, setField] = useState<Field>('strategy');
  const fields: Field[] = ['strategy', 'threshold', 'go'];
  const msg = t().setup;
  const strategy = STRATEGIES[strategyIndex]!;
  const strategyText = msg.strategies[strategy];

  useInput((input, key) => {
    if (key.escape || input === 'b') return onBack();
    if (key.upArrow || key.downArrow) {
      const i = fields.indexOf(field) + (key.downArrow ? 1 : -1);
      setField(fields[Math.max(0, Math.min(fields.length - 1, i))]!);
      return;
    }
    if (key.leftArrow || key.rightArrow) {
      const d = key.rightArrow ? 1 : -1;
      if (field === 'strategy') setStrategyIndex((i) => (i + d + STRATEGIES.length) % STRATEGIES.length);
      if (field === 'threshold') setThreshold((v) => Math.max(50, Math.min(98, v + d * 5)));
      return;
    }
    if (key.return && field === 'go') onConfirm(strategy, { ...config, threshold });
    else if (key.return) setField('go');
  });

  const focus = (f: Field) => (field === f ? 'cyan' : undefined);
  const openElsewhere = session.running && !session.tmux?.startsWith('relevo-');

  return (
    <Box flexDirection="column">
      <Header subtitle={msg.subtitle} />
      <Panel title={session.title}>
        <Text dimColor>
          {shortPath(session.cwd, 70)} · {session.origin} · {msg.model} <Text bold>{session.model ?? '?'}</Text>
          {session.effort ? ` · ${msg.effort} ${session.effort}` : ''} · {msg.permissions}{' '}
          <Text bold>{session.permissionMode ?? t().ui.defaultPermissions}</Text>
        </Text>
      </Panel>

      <Box marginTop={1} flexDirection="column">
        <Text bold>{msg.whatHappens}</Text>
        <Text color={openElsewhere ? 'yellow' : undefined}>{openElsewhere ? msg.step1Close(session.origin, session.pid) : msg.step1Free}</Text>
        <Text>{msg.step2}</Text>
        <Text>{msg.step3(config.slowPollMin, config.fastPollMin, config.nearThreshold, threshold)}</Text>
        <Text>{msg.step4(t().pendingFile, config.guard.maxNudges, config.guard.windowMin, config.guard.maxNoProgress)}</Text>
        <Text dimColor>{msg.permissionNote}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>{msg.options}</Text>
        <Text color={focus('strategy')}>
          {field === 'strategy' ? '❯ ' : '  '}
          {msg.onReset} ◂ <Text bold>{strategyText.label}</Text> ▸
        </Text>
        {field === 'strategy' ? <Text dimColor>    {strategyText.help}</Text> : null}
        <Text color={focus('threshold')}>
          {field === 'threshold' ? '❯ ' : '  '}
          {msg.wrapAt} ◂ <Text bold>{threshold} %</Text> ▸ {msg.ofUsage}
        </Text>
        {field === 'threshold' ? <Text dimColor>    {msg.thresholdHelp}</Text> : null}
        <Box marginTop={1}>
          <Text color={field === 'go' ? 'green' : undefined} bold={field === 'go'}>
            {field === 'go' ? '❯ ' : '  '}
            {msg.start}
          </Text>
        </Box>
      </Box>

      <Keys
        items={[
          ['↑↓', msg.keys.field],
          ['◂ ▸', msg.keys.change],
          ['⏎', msg.keys.confirm],
          ['esc', msg.keys.back],
        ]}
      />
    </Box>
  );
}
