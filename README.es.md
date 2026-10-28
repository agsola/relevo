# Relevo

[English](README.md) · **Español**

Mantén en marcha una tarea larga de Claude Code a través de los reinicios del límite de uso.

Relevo vigila una conversación de Claude Code y el uso de tu cuenta de Claude. Antes de que se agote la ventana de uso de 5 horas o la semanal, le pide a Claude que cierre ordenadamente y deje un prompt de continuación. Después espera a que se reinicie la ventana y reanuda la tarea. Si Claude se para antes, Relevo le pregunta si ha terminado y hace que siga con todo lo que no necesite de ti.

Funciona en la terminal de macOS y maneja la CLI oficial `claude`. No hace ninguna llamada propia a APIs de IA.

> **No oficial.** Relevo es un proyecto personal, sin relación ni respaldo de Anthropic. Depende de partes de Claude Code que no están documentadas (ver [Limitaciones](#limitaciones)).

## Para qué sirve

En los planes de suscripción de Claude (Pro, Max, Team), el uso está limitado por ventanas de 5 horas y por semana. Una tarea larga se corta donde esté cuando llega el límite, muchas veces a mitad de un cambio y sin nada apuntado sobre dónde iba. Luego tienes que volver tras el reinicio, averiguar en qué estado quedó y ponerla en marcha otra vez.

Relevo hace ese trabajo de niñera por ti:

- **Para con orden.** Al 85 % de uso (configurable), le pide a Claude que termine el paso en curso, deje acabar a los subagentes que haya, documente el estado y entregue un prompt de continuación.
- **Reanuda solo.** Cuando se reinicia la ventana, envía el prompt de continuación. Tú eliges si va a la misma conversación, a una nueva, o si espera a que lo confirmes.
- **Mantiene el ritmo.** Si Claude se para y espera, Relevo le pregunta si ha terminado. Si necesita decisiones tuyas, Claude las apunta en `RELEVO_PENDIENTES.md` y sigue con el resto.
- **Sabe cuándo parar.** Se detiene y te avisa si tiene que empujar más de 3 veces en 15 minutos, si dos empujones seguidos no avanzan, si Claude pide un permiso, o si la tarea está terminada o bloqueada esperándote.

## Requisitos

- macOS (usa el llavero y las notificaciones de macOS)
- Node.js 22 o posterior, y pnpm (o npm)
- [tmux](https://github.com/tmux/tmux): `brew install tmux`
- [Claude Code](https://code.claude.com) (`claude` en el `PATH`), con la sesión iniciada en una suscripción de Claude

## Instalación

### Sin clonar (recomendado)

Instala el paquete ya compilado desde la [última versión publicada](https://github.com/agsola/relevo/releases/latest):

```sh
npm install -g https://github.com/agsola/relevo/releases/download/v0.1.0/relevo-0.1.0.tgz
relevo doctor
```

### Desde el código fuente

```sh
git clone https://github.com/agsola/relevo.git
cd relevo
pnpm install          # también compila
pnpm link --global    # opcional: deja el comando `relevo` disponible en cualquier sitio
relevo doctor         # comprueba tmux, claude, credenciales, lectura del uso y notificaciones
```

Sin `pnpm link`, ejecútalo con `node bin/relevo.js` desde la carpeta del repositorio.

## Uso

```sh
relevo
```

1. **Elige una conversación.** Relevo lista las conversaciones en ejecución (CLI, VS Code, Claude Desktop) y, debajo, las usadas en la última hora. `RC` marca las que tienen Remote Control.
2. **Lee lo que va a pasar y elige las opciones.** La pantalla de configuración explica cada paso antes de hacer nada. Eliges qué hacer cuando se reinicie la cuota y en qué porcentaje cerrar.
3. **Cierra la conversación donde esté abierta.** Una conversación solo la puede llevar un proceso a la vez. Relevo espera a que la cierres en VS Code, Desktop o la terminal, o puede cerrarla él (`k`) si lo confirmas.
4. **Relevo toma el control.** Reabre la conversación en una sesión de tmux, con el mismo ID, modelo, esfuerzo y modo de permisos, y con Remote Control activo. Puedes seguirla y contestarle desde claude.ai o la app del móvil, o con `tmux attach -t relevo-<id>`. Para salir de tmux sin pararla, pulsa Ctrl+B y luego D.

### Teclas del panel

| Tecla | Qué hace |
|---|---|
| `n` | Empujar ya: decirle que siga, aunque no se haya parado |
| `w` | Cerrar ya: pedirle el estado y un prompt de continuación |
| `p` | Pausar o reanudar Relevo (la conversación sigue a lo suyo) |
| `r` | Reanudar la tarea, o volver a vigilar tras una parada |
| `u` | Leer el uso ahora |
| `x` | **Devolverla**, para seguir en VS Code, Desktop u otra terminal |
| `q` | Salir de Relevo. La conversación **sigue en tmux, sin vigilar** |

Cada tecla que envía o cierra algo explica primero lo que implica y pide confirmación.

### Salir o devolver

- **`q` solo cierra Relevo.** La conversación sigue funcionando en tmux, pero ya nadie mira el uso. Vuelve a abrir `relevo` y pulsa `c` para retomar la vigilancia.
- **`x` devuelve la conversación.** Relevo deja de vigilarla y cierra su proceso en tmux. Si está a mitad de algo, puede esperar a que termine el turno. Después te indica cómo reabrirla: desde el historial de conversaciones de VS Code o Desktop, o con `claude --resume <id>`. Si saliste con `q`, también tienes `x` en la pantalla inicial.

No abras la conversación en VS Code mientras Relevo la tiene en tmux: habría dos procesos escribiendo en la misma conversación.

### Idioma

La interfaz sigue el idioma del sistema (español o inglés; inglés por defecto). Los mensajes que Relevo escribe en la conversación van en el mismo idioma. Para cambiarlo, usa `relevo --lang en|es`, la variable `RELEVO_LANG` o `"language"` en el archivo de configuración. Relevo entiende las etiquetas de respuesta en los dos idiomas.

## Cómo funciona

En resumen:

- Una conversación de Claude Code es un archivo de historial en disco (`~/.claude/projects/<carpeta>/<id-de-sesión>.jsonl`), no un programa en marcha. VS Code, Claude Desktop y la CLI ejecutan el mismo agente `claude`, que carga ese archivo, habla con el modelo y añade cada paso al archivo.
- Al cerrar la conversación en VS Code, su proceso termina y no queda nada ejecutándose. Relevo arranca entonces la CLI con `claude --resume <id> --remote-control` dentro de tmux. Ese proceso nuevo carga el mismo historial y sigue. Es un relevo entre procesos, no una migración en vivo, y por eso solo uno puede tener la conversación abierta a la vez.
- Relevo lee el estado de la sesión de los archivos locales de Claude Code, y el uso del mismo endpoint que usa el comando `/usage`. Envía los mensajes pegándolos en la terminal de tmux, igual que si los escribieras tú.

La explicación completa está en [docs/how-it-works.es.md](docs/how-it-works.es.md). Cubre qué le pasa al agente cuando cierras VS Code, dónde se ejecuta mientras lo tiene Relevo, cómo encaja Remote Control, la máquina de estados y las fuentes de datos.

## Configuración y datos

Todo se guarda en `~/.relevo/`. Usa `RELEVO_HOME` para cambiar la carpeta.

| Archivo | Contenido |
|---|---|
| `config.json` | Umbral, intervalos de consulta, anti-bucle, idioma |
| `state.json` | La conversación vigilada y el estado de Relevo, para poder cerrarlo y volver |
| `handoffs/*.md` | Cada prompt de continuación que entregó Claude |
| `events.log` | Todo lo que hizo Relevo, con hora |

Valores por defecto de `config.json`:

```json
{
  "threshold": 85,
  "nearThreshold": 70,
  "slowPollMin": 10,
  "fastPollMin": 5,
  "settleSec": 30,
  "resetMarginMin": 2,
  "guard": { "maxNudges": 3, "windowMin": 15, "maxNoProgress": 2 },
  "language": "es"
}
```

| Clave | Significado |
|---|---|
| `threshold` | Porcentaje de cualquiera de las dos ventanas al que Relevo pide cerrar |
| `slowPollMin`, `fastPollMin` | Minutos entre consultas de uso; el ritmo rápido se aplica a partir de `nearThreshold` % |
| `settleSec` | Segundos de silencio para dar una conversación por parada |
| `resetMarginMin` | Minutos de margen tras la hora de reinicio antes de reanudar |
| `guard` | Anti-bucle: parar tras `maxNudges` empujones en `windowMin` minutos, o tras `maxNoProgress` turnos seguidos sin usar herramientas |

## Limitaciones

- **Partes internas no documentadas.** Relevo depende de partes de Claude Code que no son una API pública: el formato del historial, el registro de sesiones en `~/.claude/sessions/` y el endpoint de uso que hay detrás de `/usage`. Se hizo y se probó con Claude Code 2.1.x. Una versión futura puede cambiarlas; si algo falla, empieza por `relevo doctor`.
- **Solo macOS** de momento (llavero, notificaciones con `osascript`).
- **Una conversación a la vez.** Todas tiran de la misma cuota de la cuenta, así que vigilar varias exigiría coordinar las paradas.
- **Tu Mac tiene que estar despierto.** El agente se ejecuta en tu máquina. Si se duerme, la tarea se queda en pausa hasta que despierte. Para tareas de noche, usa `caffeinate -i` o ajusta la configuración de energía.
- **No contesta permisos.** Si Claude pide un permiso, Relevo te avisa y lo apruebas tú, por Remote Control o con `tmux attach`.

## Preguntas frecuentes

**¿Usa mi API key o llama a algún modelo de IA?**
No. Solo maneja la CLI `claude` que ya usas. Los tokens que se gastan son los que gasta la propia conversación cuando Relevo le envía un mensaje.

**¿Por qué no enviar los mensajes con `claude -p --resume <id>`?**
Si la conversación sigue abierta en otro proceso, un proceso aparte escribe una rama paralela en el historial y la sesión viva nunca ve el mensaje. Ver [docs/how-it-works.es.md](docs/how-it-works.es.md#por-que-adoptar).

**¿Puedo seguir usando la conversación desde el móvil?**
Sí. Relevo la arranca con Remote Control activo, y el enlace sigue siendo el mismo.

**¿Y si Claude Code cambia y algo se rompe?**
Ejecuta `relevo doctor` y luego `pnpm test`. El parser del historial y el del uso son los sitios que más probablemente necesiten un ajuste.

## Desarrollo

```sh
pnpm install
pnpm test        # vitest: parser del historial, etiquetas, lectura del uso, i18n, máquina de estados (reloj simulado)
pnpm typecheck
pnpm dev         # ejecuta desde el código fuente con tsx
```

La lógica de decisión está en `src/engine/machine.ts`. Es una función pura, `step(estado, observación) → { estado, acciones }`, que se puede probar sin tmux ni una sesión real. Toda la E/S está en `src/controller.ts`. Los textos de la interfaz están en `src/i18n/en.ts` y `src/i18n/es.ts`.

## Licencia

[MIT](LICENSE)
