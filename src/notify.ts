import { run } from './exec.js';

/** Native macOS notification. Arguments go through argv, so no AppleScript escaping is needed. */
export async function notify(title: string, body: string): Promise<void> {
  await run('osascript', [
    '-e', 'on run argv',
    '-e', 'display notification (item 2 of argv) with title (item 1 of argv)',
    '-e', 'end run',
    title, body,
  ], { timeoutMs: 5_000 });
}
