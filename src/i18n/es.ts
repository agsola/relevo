import type { Messages } from './en.js';

const TAG_RULES =
  'Termina SIEMPRE tu respuesta con una de estas etiquetas: ' +
  '<relevo>TERMINADO</relevo> si la tarea completa está hecha, ' +
  '<relevo>CONTINUAR</relevo> si queda trabajo que se puede avanzar, o ' +
  '<relevo>BLOQUEADO</relevo> si solo queda lo que necesita una decisión o información del usuario.';

const PENDING_FILE = 'RELEVO_PENDIENTES.md';

const PENDING_RULES =
  `Si algo necesita una decisión o información del usuario, no te pares: anótalo en ${PENDING_FILE} ` +
  '(en la raíz del proyecto) y sigue con todo lo que se pueda avanzar sin ello.';

export const es: Messages = {
  locale: 'es-ES',
  yesKey: 's',
  pendingFile: PENDING_FILE,

  prompts: {
    wrapWithAgents:
      '[Relevo] Se está acabando la cuota de uso. Deja que termine el o los agentes que haya corriendo, y cuando terminen, ' +
      'no lances nuevos, documenta bien el estado actual, y dame un prompt para continuar más adelante.\n' +
      'El prompt debe estar entre estos tags <prompt></prompt>.',
    wrap:
      '[Relevo] Se está acabando la cuota de uso. Para la tarea que estés realizando, y cuando termines, ' +
      'documenta bien el estado actual, y dame un prompt para continuar más adelante.\n' +
      'El prompt debe estar entre estos tags <prompt></prompt>.',
    wrapRetry:
      '[Relevo] No encuentro el prompt de continuación en tu respuesta. ' +
      'Escríbelo completo entre los tags <prompt></prompt>, sin hacer nada más.',
    nudge: `[Relevo] Te has parado. ¿Has terminado la tarea completa? ${PENDING_RULES}\n${TAG_RULES}`,
    continue: `[Relevo] Continúa con lo que se pueda avanzar. ${PENDING_RULES}\n${TAG_RULES}`,
    resume: (handoff) =>
      '[Relevo] Se ha reiniciado la ventana de uso. Continúa la tarea siguiendo este prompt de continuación ' +
      `que dejaste antes de la pausa:\n\n${handoff}\n\n${PENDING_RULES}\n${TAG_RULES}`,
    resumeGeneric:
      '[Relevo] Se ha reiniciado la ventana de uso. Retoma la tarea donde la dejaste: primero revisa en qué punto quedó ' +
      `y luego continúa. ${PENDING_RULES}\n${TAG_RULES}`,
    freshStart: (handoff) =>
      `[Relevo] Continuación de una tarea larga que se pausó por la cuota de uso:\n\n${handoff}\n\n${PENDING_RULES}\n${TAG_RULES}`,
    freshStartFallback: 'Revisa el estado del proyecto y continúa la tarea donde se quedó.',
  },

  time: {
    secondsAgo: (s) => `hace ${s} s`,
    minutesAgo: (m) => `hace ${m} min`,
    hoursAgo: (h, m) => `hace ${h} h ${m} min`,
    seconds: (s) => `${s} s`,
    minutes: (m) => `${m} min`,
    hours: (h, m) => `${h} h ${m} min`,
  },

  machine: {
    sessionClosed: 'La sesión de Claude se ha cerrado (el proceso ya no está en tmux).',
    waitingUserDefault: 'Claude está esperando una respuesta tuya (probablemente un permiso)',
    waitingUserTitle: 'Relevo: necesita tu respuesta',
    waitingUserBody: (why) => `${why}. Respóndela por Remote Control o con tmux attach.`,
    waitingUserLog: (why) => `Esperando al usuario: ${why}`,
    wrapTitle: 'Relevo: cerrando antes del límite',
    wrapBody: (win, pct) => `Uso ${win} al ${pct} %. Le he pedido que documente y deje un prompt de continuación.`,
    doneReason: 'Claude dice que la tarea está terminada.',
    doneTitle: 'Relevo: tarea terminada',
    doneLog: 'Etiqueta TERMINADO: fin.',
    blockedReason: `Solo queda trabajo que necesita decisiones tuyas (mira ${PENDING_FILE} en el proyecto).`,
    blockedTitle: 'Relevo: necesita decisiones tuyas',
    blockedLog: 'Etiqueta BLOQUEADO: me detengo.',
    noTag: 'sin etiqueta',
    turnEnded: (tag, tools) => `Turno terminado con ${tag} y ${tools} herramientas: le pido que continúe.`,
    stoppedLog: 'La conversación se ha parado: le pregunto si ha terminado.',
    handoffSaved: 'Prompt de continuación guardado.',
    noPromptRetry: 'No hay <prompt> en la respuesta: lo pido otra vez.',
    noPromptGiveUp: 'No conseguí un prompt de continuación: al reanudar le pediré que retome donde lo dejó.',
    stillOver: (win, at) => `Sigue por encima del umbral (${win}); nueva espera hasta ${at}.`,
    renewedTitle: 'Relevo: cuota renovada',
    renewedAskBody: 'Confirma en Relevo para reanudar la tarea.',
    messageLost: 'El mensaje no aparece en la conversación tras reenviarlo. Revisa la sesión con tmux attach.',
    messageResent: 'El mensaje no llegó a la conversación: lo reenvío.',
    guardNudges: (n, min) => `Ya le he pedido continuar ${n} veces en ${min} min. Me detengo para no gastar cuota en bucle.`,
    guardNoProgress: (n) => `${n} turnos seguidos sin usar ninguna herramienta: parece que no avanza. Me detengo.`,
    whenAt: (at) => `a las ${at}`,
    whenUsageDrops: 'cuando baje el uso',
    waitingResetLog: (msg, win, when) => `${msg} Espero al reinicio de la ventana ${win} ${when}.`,
    waitingResetTitle: 'Relevo: en pausa hasta el reinicio',
    waitingResetBody: (msg, when) => `${msg} Reanudaré ${when}.`,
    resumeNewLog: 'Cuota renovada: abro una conversación nueva con el prompt de continuación.',
    resumeSameLog: 'Cuota renovada: reanudo la conversación.',
    resumingTitle: 'Relevo: reanudando',
    resumingBody: 'La ventana de uso se ha reiniciado y la tarea continúa.',
    haltedTitle: 'Relevo: detenido',
    haltedLog: (reason) => `Detenido: ${reason}`,
  },

  controller: {
    watching: (title, tmux) => `Vigilando «${title}» en tmux (${tmux}).`,
    manualCommand: (cmd) => `Orden manual: ${cmd}`,
    checkError: (msg) => `Error en la comprobación: ${msg}`,
    toolWithoutResult: 'Hay una herramienta sin resultado desde hace más de un minuto (¿un permiso?)',
    sent: (kind, first) => `→ Enviado (${kind}): ${first}…`,
    handoffSavedAt: (file) => `Prompt de continuación guardado en ${file}`,
    newDidNotStart: 'La conversación nueva no ha arrancado (revisa con tmux attach).',
    newConversation: (id, tmux) => `Conversación nueva ${id} en tmux ${tmux}.`,
    released: 'Conversación devuelta: Relevo ya no la vigila y su proceso en tmux está cerrado.',
    willRelease: 'Devolveré la conversación en cuanto termine lo que está haciendo.',
    noTranscript: (id) => `No aparece el transcript de ${id}`,
    claudeExited: (screen) => `claude se ha cerrado al reanudar:\n${screen}`,
    didNotStart: (secs, cmd) => `La sesión no ha arrancado en ${secs} s. Revisa con: ${cmd}`,
  },

  tmux: {
    dialogTrust: 'Claude pide confirmar que confías en la carpeta',
    dialogPermission: 'Claude está pidiendo un permiso',
    dialogResume: 'Claude pregunta cómo reanudar la sesión',
    failed: (cmd, err) => `tmux ${cmd} falló: ${err}`,
  },

  usage: {
    noCredentials: 'No encuentro las credenciales de Claude Code en el llavero',
    noAccessToken: 'Las credenciales del llavero no tienen accessToken',
  },

  ui: {
    untitled: '(sin título)',
    unknown: '?',
    defaultPermissions: 'por defecto',
    noData: 'sin datos',
    resetsAt: (at, inTime) => `· se reinicia a las ${at} (${inTime})`,
    yesNo: '(s/n)',
  },

  select: {
    subtitle: 'elige la conversación que quieres mantener viva',
    watchedBanner: 'Ya hay una tarea vigilada:',
    watchedState: (state) => `(estado: ${state}).`,
    watchedHelp:
      'Mientras Relevo estaba cerrado, la conversación siguió funcionando en tmux. Pulsa c para seguir vigilándola, o x para devolverla y seguir con ella en VSCode u otro sitio.',
    releaseConfirm: (tmux) =>
      `Devolverla: cierro su proceso de Claude en tmux (${tmux}) y Relevo la olvida. Si estaba trabajando, se corta lo que hiciera a medias; el historial no se pierde. Después podrás abrirla en VSCode, Desktop o con claude --resume.`,
    releaseQuestion: '¿La devuelvo? (s/n)',
    searching: 'Buscando conversaciones…',
    empty: 'No hay conversaciones en ejecución ni usadas en la última hora.',
    running: (n) => `En ejecución (${n})`,
    recent: (n) => `Recientes, última hora (${n})`,
    none: '  ninguna',
    statusWorking: 'trabajando',
    statusIdle: 'en espera',
    statusClosed: 'cerrada',
    footer: 'RC = tiene Remote Control. Al elegir una, verás qué va a pasar antes de que Relevo haga nada.',
    keys: {
      move: 'moverse',
      pick: 'elegir',
      reload: 'recargar',
      resumeWatch: 'seguir vigilando la de arriba',
      release: 'devolverla (seguir en VSCode u otro sitio)',
      quit: 'salir',
    },
  },

  setup: {
    subtitle: 'antes de empezar',
    strategies: {
      same: {
        label: 'Seguir en la misma conversación',
        help: 'Tras el reinicio le escribo el prompt de continuación en esta misma conversación. Conserva todo el contexto (y el enlace de Remote Control), pero el contexto sigue creciendo.',
      },
      new: {
        label: 'Empezar una conversación nueva',
        help: 'Tras el reinicio abro una conversación nueva en la misma carpeta y con el mismo modelo, empezando por el prompt de continuación. Contexto limpio; la conversación antigua se cierra (su historial se conserva).',
      },
      ask: {
        label: 'Preguntarme antes',
        help: 'Cuando se reinicie la cuota te aviso con una notificación y espero a que confirmes en Relevo (tecla r) antes de seguir.',
      },
    },
    model: 'modelo',
    effort: 'esfuerzo',
    permissions: 'permisos',
    whatHappens: 'Qué va a pasar',
    step1Close: (origin, pid) =>
      `1. Tendrás que cerrar la conversación en ${origin} (pid ${pid}). Una conversación solo puede estar abierta en un sitio; si no, habría dos procesos escribiendo en ella.`,
    step1Free: '1. La conversación no está abierta en ningún otro sitio, así que no hay que cerrar nada.',
    step2:
      '2. Relevo la reabre en una sesión de tmux con el mismo ID, modelo, esfuerzo y modo de permisos, y con Remote Control activo: podrás seguirla y contestarle desde claude.ai o el móvil, o con tmux attach.',
    step3: (slow, fast, near, threshold) =>
      `3. Vigilo el uso cada ${slow} min (cada ${fast} min a partir del ${near} %). Al llegar al ${threshold} % de la ventana de 5 h o de la semanal, le pido que cierre ordenadamente y me deje un prompt de continuación.`,
    step4: (file, max, win, noProgress) =>
      `4. Si se para antes, le pregunto si ha terminado: si no, que siga con lo que no necesite tus decisiones y las apunte en ${file}. Si tengo que empujarla más de ${max} veces en ${win} min, o ${noProgress} veces seguidas sin que avance, me detengo y te aviso.`,
    permissionNote: 'Si se queda esperando un permiso, no lo contesto yo: te aviso para que lo apruebes tú.',
    options: 'Opciones',
    onReset: 'Al reiniciarse la cuota:',
    wrapAt: 'Cerrar al llegar al:',
    ofUsage: 'de uso',
    thresholdHelp: 'Cuanto más bajo, más margen le queda para documentar, pero se aprovecha menos cada ventana.',
    start: '[ Empezar ]',
    keys: { field: 'campo', change: 'cambiar valor', confirm: 'confirmar', back: 'volver' },
  },

  adopt: {
    subtitle: (title) => `adoptando «${title}»`,
    closeTitle: (origin) => `Cierra la conversación en ${origin}`,
    closeBody: (pid) =>
      `Sigue abierta (pid ${pid}). Ciérrala allí: en VSCode, cierra la pestaña de Claude de esa conversación; en Desktop, ciérrala; en una terminal, sal con /exit o Ctrl+C dos veces.`,
    closeAuto: 'En cuanto se cierre, la reabro automáticamente.',
    killConfirm: (pid) =>
      `¿Cierro yo el proceso ${pid} (SIGTERM)? Lo que esté haciendo ahora mismo se interrumpe; el historial no se pierde. (s/n)`,
    killHint: 'O pulsa k para que lo cierre yo.',
    launching: (tmux) => `Reabriendo la conversación en tmux (${tmux})…`,
    dialogTitle: 'Claude necesita una respuesta para arrancar',
    dialogHelp: 'Contéstala en otra terminal con',
    dialogDetach: 'y sal con Ctrl+B y luego D.',
    failedTitle: 'No he podido adoptarla',
    ready: 'Lista.',
    keys: { back: 'volver', cancel: 'cancelar' },
  },

  dashboard: {
    phases: {
      running: { label: 'Vigilando', help: 'La tarea avanza. Si se para, le preguntaré si ha terminado.' },
      wrapping: { label: 'Cerrando', help: 'Le he pedido que documente el estado y deje un prompt de continuación.' },
      waiting_reset: { label: 'Esperando reinicio', help: 'Cuota agotada. Reanudaré cuando se reinicie la ventana de uso.' },
      awaiting_confirm: { label: 'Esperando tu confirmación', help: 'La cuota se ha renovado. Pulsa r para reanudar.' },
      paused: { label: 'En pausa', help: 'No envío nada mientras esté en pausa (la conversación sigue a lo suyo).' },
      done: { label: 'Terminada', help: 'Claude dice que la tarea está terminada.' },
      blocked: { label: 'Bloqueada', help: 'Solo queda trabajo que necesita tus decisiones.' },
      halted: { label: 'Detenido', help: 'Me he parado para no gastar cuota sin sentido.' },
    },
    sendLabels: {
      nudge: '¿has terminado?',
      continue: 'continúa',
      wrap: 'documenta y dame un prompt',
      wrap_retry: 'repite el prompt',
      resume: 'reanuda la tarea',
    },
    activity: { closed: 'cerrada', waiting: 'esperándote', working: 'trabajando', idle: 'parada', settling: 'en espera' },
    manual: {
      n: { title: 'Empujar ahora', help: 'Le escribo este mensaje ya, aunque no se haya parado.' },
      r: {
        title: 'Reanudar antes del reinicio',
        help: 'La ventana de uso todavía no se ha reiniciado. Si el uso sigue por encima del umbral, en cuanto reanude volveré a pedirle que cierre.',
      },
      w: { title: 'Cerrar ahora', help: 'Le pido que documente y deje un prompt de continuación ya. Después esperaré a que confirmes (r) para seguir.' },
    },
    resumeAt: (at, inTime, win) => `Reanudo a las ${at} (en ${inTime}), ventana ${win}.`,
    haveHandoff: 'Tengo el prompt de continuación.',
    noHandoff: 'Sin prompt de continuación.',
    conversation: 'Conversación:',
    subagents: (n) => ` · ${n} subagente(s) en marcha`,
    awaitingReply: (label) => ` · esperando su respuesta a «${label}»`,
    recentNudges: (n, max) => ` · empujones recientes: ${n}/${max}`,
    usageTitle: 'Uso de la cuenta',
    threshold: (pct) => `Umbral ${pct} % (┊).`,
    readAt: (at, cached) => `Leído a las ${at}${cached ? ' (copia en caché, puede estar desfasada)' : ''}. `,
    nextRead: (inTime) => `Próxima lectura en ${inTime}.`,
    usageError: (err) => `No he podido leer el uso: ${err}`,
    whereTitle: 'Dónde verla',
    waitingLink: 'esperando enlace…',
    detachHint: '(sal con Ctrl+B y luego D; no la cierres con Ctrl+C)',
    permissions: 'permisos',
    runsInTmux: 'Ahora la ejecuta Relevo en tmux. No la abras a la vez en VSCode u otro sitio: para seguir allí, pulsa x primero.',
    releasingTitle: 'Devolviendo la conversación',
    releasingBody: 'Esperando a que termine lo que está haciendo para cerrar su proceso en tmux. Mientras tanto no le envío nada.',
    releasingCancel: 'Pulsa c para cancelar y seguir vigilándola.',
    releaseTitle: 'Devolver la conversación para seguir en otro sitio (VSCode, Desktop u otra terminal)',
    releaseStop: '· Relevo deja de vigilarla: no mirará el uso ni le enviará más mensajes.',
    releaseClose: (tmux) => `· Cierro el proceso de Claude que la ejecuta en tmux (${tmux}). El historial no se pierde: está guardado en disco.`,
    releaseAfter: '· Después podrás abrirla en VSCode (historial de conversaciones del panel de Claude), en Desktop o con claude --resume.',
    releaseBusy: 'Ahora mismo está trabajando: si la cierro ya, se corta lo que esté haciendo a medias.',
    releaseBusyOptions: 'e esperar a que termine y devolverla (recomendado) · s cerrarla ya · n cancelar',
    releaseWaitKey: 'e',
    releaseQuestion: '¿La devuelvo? (s/n)',
    quitTitle: 'Salir de Relevo',
    quitKeepsRunning1: '· La conversación ',
    quitKeepsRunningBold: 'sigue funcionando en tmux, pero sin vigilancia',
    quitKeepsRunning2: ': nadie mirará el uso, ni la cerrará antes del límite, ni la reanudará tras el reinicio.',
    quitResume: '· Para retomar la vigilancia, vuelve a abrir relevo y pulsa c.',
    quitUseX: '· Si lo que quieres es seguir con ella en VSCode u otro sitio, usa x en lugar de q.',
    quitQuestion: '¿Salgo? (s/n)',
    sendQuestion: '¿Lo envío?',
    continueQuestion: '¿Sigo?',
    activityTitle: 'Actividad',
    keys: {
      push: 'empujar ya',
      wrap: 'cerrar ya',
      pause: 'pausar',
      unpause: 'reanudar vigilancia',
      resume: 'reanudar tarea',
      usage: 'leer uso',
      release: 'devolver (seguir en VSCode u otro sitio)',
      quit: 'salir de Relevo (sigue en tmux, sin vigilar)',
    },
  },

  released: (title, cwd, sessionId) =>
    [
      `Conversación «${title}» devuelta.`,
      'Relevo ya no la vigila y su proceso en tmux está cerrado. El historial completo sigue guardado.',
      '',
      'Para seguir con ella:',
      `  · VSCode: panel de Claude → historial de conversaciones → «${title}»`,
      '  · Claude Desktop: ábrela desde su historial de conversaciones de Code',
      `  · Terminal: cd ${cwd} && claude --resume ${sessionId}`,
    ].join('\n'),

  stillInTmux: (title) =>
    `«${title}» sigue funcionando en tmux, sin vigilancia.\n` +
    '  · Para retomar la vigilancia: relevo y pulsa c.\n' +
    '  · Para seguir con ella en VSCode u otro sitio: relevo, y en la pantalla inicial pulsa x (devolverla).',

  cli: {
    help: (dir, config) => `Relevo — mantiene viva una conversación larga de Claude Code a través de los reinicios de cuota.

Uso:
  relevo                  abre la interfaz
  relevo doctor           comprueba que todo lo necesario está disponible
  relevo --lang en|es     idioma de la interfaz (también RELEVO_LANG, o "language" en config.json)
  relevo --help           esta ayuda

Datos en ${dir} (configuración en ${config}).`,
    unknownArg: (arg) => `Argumento desconocido: ${arg}`,
    needsTmux: 'Relevo necesita tmux. Instálalo con: brew install tmux',
    doctor: {
      installTmux: 'instálalo con: brew install tmux',
      claudeCli: 'claude CLI',
      keychain: 'credenciales de Claude Code en el llavero',
      signIn: 'inicia sesión en claude',
      usage: 'lectura del uso',
      usageDetail: (five, seven, source) => `5 h ${five}, 7 d ${seven} (${source})`,
      conversations: 'conversaciones',
      conversationsDetail: (running, recent) => `${running} en ejecución, ${recent} recientes`,
      watched: (title, phase, alive) => `ℹ tarea vigilada: «${title}» (${phase}), tmux ${alive ? 'activo' : 'cerrado'}`,
      notifyBody: 'Prueba de notificación de relevo doctor',
      notifySent: 'ℹ se ha enviado una notificación de prueba (si no la ves, permite notificaciones para tu terminal o Script Editor)',
    },
  },
};
