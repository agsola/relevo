import { homedir } from 'node:os';
import { join } from 'node:path';

export const CLAUDE_DIR = process.env.RELEVO_CLAUDE_DIR ?? join(homedir(), '.claude');
export const CLAUDE_JSON = join(homedir(), '.claude.json');
export const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions');
export const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

export const RELEVO_DIR = process.env.RELEVO_HOME ?? join(homedir(), '.relevo');
export const STATE_FILE = join(RELEVO_DIR, 'state.json');
export const CONFIG_FILE = join(RELEVO_DIR, 'config.json');
export const EVENTS_LOG = join(RELEVO_DIR, 'events.log');
export const HANDOFFS_DIR = join(RELEVO_DIR, 'handoffs');

export const remoteControlUrl = (bridgeSessionId: string) =>
  `https://claude.ai/code/${bridgeSessionId.replace(/^cse_/, 'session_')}`;
