import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { t } from '../i18n/index.js';

/** "Yes" in any supported language, so muscle memory works whatever the interface language. */
export const isYes = (input: string) => input === 'y' || input === 's';

export function ago(ms: number, now = Date.now()): string {
  if (!ms) return '—';
  const time = t().time;
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return time.secondsAgo(s);
  const m = Math.round(s / 60);
  if (m < 60) return time.minutesAgo(m);
  return time.hoursAgo(Math.floor(m / 60), m % 60);
}

export function until(ms: number, now = Date.now()): string {
  const time = t().time;
  const s = Math.max(0, Math.round((ms - now) / 1000));
  if (s < 60) return time.seconds(s);
  const m = Math.floor(s / 60);
  if (m < 60) return time.minutes(m);
  return time.hours(Math.floor(m / 60), m % 60);
}

export const clock = (ms: number) => new Date(ms).toLocaleTimeString(t().locale, { hour: '2-digit', minute: '2-digit' });

export function shortPath(p: string, max = 34): string {
  const home = process.env.HOME ?? '';
  const s = home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  return s.length > max ? `…${s.slice(-(max - 1))}` : s;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function UsageBar({ label, pct, threshold, resetsAt }: { label: string; pct: number | null; threshold: number; resetsAt?: number | null }) {
  const width = 30;
  if (pct === null) {
    return (
      <Text>
        {label.padEnd(4)} <Text dimColor>{t().ui.noData}</Text>
      </Text>
    );
  }
  const filled = Math.round((Math.min(100, pct) / 100) * width);
  const mark = Math.round((threshold / 100) * width);
  const color = pct >= threshold ? 'red' : pct >= threshold - 15 ? 'yellow' : 'green';
  const cells = Array.from({ length: width }, (_, i) => (i < filled ? '█' : i === mark ? '┊' : '░')).join('');
  return (
    <Text>
      {label.padEnd(4)} <Text color={color}>{cells}</Text> {String(Math.round(pct)).padStart(3)} %
      {resetsAt ? <Text dimColor>  {t().ui.resetsAt(clock(resetsAt), until(resetsAt))}</Text> : null}
    </Text>
  );
}

export function Keys({ items }: { items: [string, string][] }) {
  return (
    <Box marginTop={1} flexWrap="wrap" columnGap={2}>
      {items.map(([k, label]) => (
        <Text key={k}>
          <Text color="cyan" bold>
            {k}
          </Text>{' '}
          <Text dimColor>{label}</Text>
        </Text>
      ))}
    </Box>
  );
}

export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <Box marginBottom={1}>
      <Text bold color="magenta">
        ⟳ Relevo
      </Text>
      {subtitle ? <Text dimColor> · {subtitle}</Text> : null}
    </Box>
  );
}

export function Panel({ title, children, color = 'gray' }: { title?: string; children: ReactNode; color?: string }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      {title ? <Text bold>{title}</Text> : null}
      {children}
    </Box>
  );
}
