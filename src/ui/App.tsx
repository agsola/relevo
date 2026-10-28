import { useApp } from 'ink';
import { useEffect, useState } from 'react';
import { type Config, saveConfig } from '../config.js';
import { Controller } from '../controller.js';
import type { SessionInfo } from '../discovery/sessions.js';
import { initialState } from '../engine/machine.js';
import { loadState, type Persisted } from '../store/state.js';
import { OAuthUsageProvider } from '../usage/usage.js';
import { AdoptScreen } from './AdoptScreen.js';
import { Dashboard } from './Dashboard.js';
import { SelectScreen } from './SelectScreen.js';
import { SetupScreen } from './SetupScreen.js';

type Screen =
  | { name: 'select' }
  | { name: 'setup'; session: SessionInfo }
  | { name: 'adopt'; session: SessionInfo; config: Config; strategy: Parameters<typeof initialState>[0] }
  | { name: 'dashboard'; controller: Controller; config: Config };

interface Props {
  config: Config;
  resumable: Persisted | null;
  /** Text to print in the terminal once Relevo has closed. */
  onExitMessage: (message: string) => void;
}

export function App({ config, resumable, onExitMessage }: Props) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>({ name: 'select' });

  const startController = (c: Controller, cfg: Config) => {
    c.start();
    setScreen({ name: 'dashboard', controller: c, config: cfg });
  };

  useEffect(() => () => {
    if (screen.name === 'dashboard') screen.controller.stop();
  }, [screen]);

  const quit = (message?: string) => {
    if (screen.name === 'dashboard') screen.controller.stop();
    if (message) onExitMessage(message);
    exit();
  };

  switch (screen.name) {
    case 'select':
      return (
        <SelectScreen
          resumable={resumable}
          onQuit={quit}
          onPick={(session) => setScreen({ name: 'setup', session })}
          onResumeWatch={() => {
            const saved = loadState() ?? resumable!;
            const c = new Controller(saved.watched, config, new OAuthUsageProvider(() => saved.watched.model), saved.machine);
            startController(c, config);
          }}
        />
      );
    case 'setup':
      return (
        <SetupScreen
          session={screen.session}
          config={config}
          onBack={() => setScreen({ name: 'select' })}
          onConfirm={(strategy, cfg) => {
            saveConfig(cfg);
            setScreen({ name: 'adopt', session: screen.session, config: cfg, strategy });
          }}
        />
      );
    case 'adopt':
      return (
        <AdoptScreen
          session={screen.session}
          onCancel={() => setScreen({ name: 'select' })}
          onReady={(watched) => {
            const c = new Controller(watched, screen.config, new OAuthUsageProvider(() => watched.model), undefined, screen.strategy);
            startController(c, screen.config);
          }}
        />
      );
    case 'dashboard':
      return <Dashboard controller={screen.controller} config={screen.config} onQuit={quit} />;
  }
}
