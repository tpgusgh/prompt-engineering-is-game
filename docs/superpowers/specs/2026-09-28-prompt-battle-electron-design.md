# Prompt Battle Electron App — Design Spec

Date: 2026-09-28
Repo: https://github.com/tpgusgh/prompt-engineering-is-game

## Purpose

Ship `promptbattle` as a downloadable macOS app (`.dmg`), not just a CLI you clone and `npm link`. Same game (turn-based RPG wrapping real AI coding), same rules (longer/keyword-rich prompts hit harder, real file/bash work happens for real), but with a real graphical window instead of a terminal: a colored HP bar as an actual element, a monster panel, a scrolling battle log, and a prompt input box — instead of ASCII art and `[███---]` bars in a terminal.

Success criteria: double-click the built `.app` (or open the `.dmg` and drag it to Applications), pick a project folder and difficulty from the window, fight the same infinite dungeon the CLI has, with the same session-resume/live-streaming/damage rules, and see it rendered as a real GUI.

## Architecture

Electron, not Tauri: pure JS/Node, no Rust toolchain, and the app's main process can `import` the existing `.ts` game-logic modules directly (Electron bundles Node — the same native-TypeScript-execution property the CLI relies on carries over unchanged).

Electron's two-process model maps directly onto the existing `BattleDeps` dependency-injection seam the CLI already uses:
- **Main process** owns the real game state: it calls `runDungeon()` (from `src/battle.ts`, reused unchanged in its exported logic) with a `BattleDeps` implementation backed by IPC instead of terminal I/O.
- **Renderer process** (a plain HTML/CSS/TS page, no framework) is a dumb view: it renders whatever structured events the main process sends it, and sends back the player's typed prompt or a flee/quit action.
- **Preload script** exposes a minimal, explicit `contextBridge` API between them — the renderer never gets raw Node/IPC access.

This reuses 100% of the existing damage math, monster data, session-resume logic, SDK wrapping, and profile persistence untouched. The CLI (`src/cli.ts`) keeps working exactly as it does today.

## The one required refactor: `battle.ts` moves from printed text to structured events

Today, `BattleDeps.write(text: string)` receives pre-formatted ANSI strings — fine for a terminal, useless for a GUI that wants to draw a real `<div>` HP bar instead of parsing `[███---] 70/100` back out of a string. `runDungeon()`'s actual game logic already computes every number the GUI needs (damage, HP, crit, floor, XP) — it just currently throws that data away into a formatted string before anyone outside `battle.ts` can see it.

Fix: `BattleDeps.write` becomes `BattleDeps.onBattleEvent(event: BattleEvent)`, where `BattleEvent` is a typed union carrying the raw data for every game moment (floor start, hesitate, attack landed, agent file/command activity, agent error, floor cleared, run ended). `runDungeon()`'s control flow is otherwise unchanged — same loop, same session-id threading, same floor/damage/XP math, same tests' worth of behavior, just emitting structured events instead of strings.

The CLI gets a new small module, `src/cli-render.ts`, exporting `formatBattleEvent(event: BattleEvent): string` — a pure function that reproduces today's exact printed output from the event stream. `cli.ts` becomes: `onBattleEvent: (event) => stdout.write(formatBattleEvent(event))`. The `"> "` prompt affordance moves into `cli.ts`'s own `readInput` closure (it's a terminal-only concept, not game state, so it doesn't belong in `battle.ts` at all — the GUI's `readInput` never needs to print anything, it just resolves when the player clicks Attack).

The Electron renderer consumes the identical `BattleEvent` stream and draws DOM updates instead of formatting text.

```typescript
// src/battle.ts (types, not full implementation)
export type BattleEvent =
  | { type: 'floorStart'; floor: number; monsterName: string; monsterArt: string; maxHp: number }
  | { type: 'hesitate' }
  | { type: 'attack'; damage: number; crit: boolean; matchedKeywords: string[] }
  | { type: 'agentEvent'; agentEvent: AgentEvent } // re-exported from agent.ts: file/command live activity
  | { type: 'agentError'; error: string }
  | { type: 'agentSummary'; summary: string }
  | { type: 'hpChanged'; hp: number; maxHp: number }
  | { type: 'floorCleared'; monsterName: string; xpGained: number }
  | { type: 'runEnded'; floorsCleared: number; floorsEngaged: number; xpGained: number };

export interface BattleDeps {
  runTurn: (prompt: string, cwd: string, sessionId?: string, onEvent?: (event: AgentEvent) => void) => Promise<TurnResult>;
  readInput: () => Promise<string | null>;
  onBattleEvent: (event: BattleEvent) => void;
  cwd: string;
  difficulty: Difficulty;
}
```

## Components

### Reused, unchanged in behavior
- `src/damage.ts`, `src/monsters.ts`, `src/profile.ts`, `src/agent.ts`, `src/args.ts` — no changes.
- `src/battle.ts` — refactored per above (same tested control flow, new event shape).
- `src/ui.ts` (`colorize`, `renderHpBar`) — used only by `cli-render.ts` now, not by `battle.ts` directly.

### New: CLI-side formatter
- `src/cli-render.ts` — `formatBattleEvent(event: BattleEvent): string`, reproduces today's exact CLI output.
- `src/cli.ts` — updated to use `onBattleEvent` + `formatBattleEvent`, prints its own `"> "` prompt in `readInput`.

### New: Electron app (`electron/` directory, separate from the CLI's `src/`)
- `electron/main.ts` — app lifecycle (`app.whenReady`, window creation), IPC handlers:
  - `pick-folder`: opens a native folder-picker (`dialog.showOpenDialog`), returns the chosen path.
  - `start-run`: given `{ cwd, difficulty }`, starts `runDungeon()` with an IPC-backed `BattleDeps`; every `onBattleEvent` call is forwarded to the renderer via `webContents.send('battle-event', event)`.
  - `submit-prompt` / `flee`: resolves the pending `readInput()` promise with the player's text or `'/flee'`.
  - `load-profile` / on-run-end: reuses `profile.ts`'s `loadProfile`/`saveProfile`/`addXp` exactly as `cli.ts` does, sends the updated profile to the renderer.
- `electron/preload.ts` — `contextBridge.exposeInMainWorld('promptBattle', { pickFolder, startRun, submitPrompt, flee, onBattleEvent, onProfileUpdate })`. No direct `ipcRenderer`/`require` exposure to the page.
- `electron/renderer/index.html` — three screens in one page, toggled by `hidden`: (1) setup (folder picker button + difficulty radio buttons + Start), (2) dungeon (monster panel with art + a real HP bar div + colored fill, scrolling log list, prompt `<input>` + Attack button + Flee button), (3) run-complete summary (floors cleared, XP, new level).
- `electron/renderer/renderer.ts` — wires the three screens to the preload API; renders each incoming `BattleEvent` into the log/HP-bar/monster-panel DOM (a small `renderEvent(event)` switch, the GUI analogue of `cli-render.ts`).
- `electron/renderer/style.css` — dark fantasy/terminal-hybrid look: monospace for the log (keeps monster ASCII art legible), a real gradient/colored HP bar div, minimal chrome. No design system dependency — plain CSS.

### Packaging
- `package.json` gains `electron` and `electron-builder` as devDependencies, an `electron:start` script (`electron electron/main.ts` — Electron also runs `.ts` directly via the same Node runtime it embeds, so no separate build/compile step here either), and a `build` config block for `electron-builder` (mac target `dmg`, `appId`, `productName: "Prompt Battle"`, `mac.category`).
- A minimal generated app icon (simple, not commissioned art — a `.icns` built from one small SVG/PNG via `electron-builder`'s own icon pipeline).
- No `mac.identity`/notarization config: `electron-builder` ad-hoc-signs by default at no cost (no paid Apple Developer account), which is real code signing but isn't notarized — macOS Gatekeeper still blocks the first open with "unidentified developer." README documents the one-time right-click → Open workaround.
- CLI installation (`npm link`) and the Electron app are two separate install paths from the same repo; the CLI's own `bin`/`engines` stay untouched.

## Data flow

```
Renderer (setup screen)
   → pickFolder() / choose difficulty → startRun({cwd, difficulty})  [preload → IPC → main]
                                              ↓
                                    main.ts calls runDungeon({
                                      runTurn: runAgentTurn,          (unchanged, src/agent.ts)
                                      cwd, difficulty,
                                      onBattleEvent: e => send to renderer,
                                      readInput: () => a Promise resolved by the next
                                                       submit-prompt/flee IPC message
                                    })
                                              ↓
   ← 'battle-event' IPC messages ──────────────┘   (renderer draws HP bar / log / monster panel)
Renderer (dungeon screen, player types + Attack)
   → submitPrompt(text)  [preload → IPC → main]  → resolves the pending readInput() promise
                                              ↓
                              (loop continues inside runDungeon, same as the CLI)
                                              ↓
   ← run ends → main.ts loads/updates/saves Profile (src/profile.ts, unchanged) → sends
     final profile + BattleSummary to renderer → renderer shows the run-complete screen
```

No coupling changes: damage is still purely prompt-shape-based, agent errors still leave HP unchanged, session resume and live tool-use streaming both flow through unchanged — the GUI is a new set of eyes on the exact same `runDungeon()` loop the CLI drives.

## Error handling

- No API key / not logged in: identical to the CLI — the first turn's agent call fails, surfaces as an `agentError` event, rendered in the GUI log as a red "fizzle" line. No separate preflight dialog (matches CLI behavior, avoids building a second auth-state UI).
- Folder-picker cancelled: setup screen stays put, no run starts.
- IPC/main-process crash mid-run: caught the same way `cli.ts`'s `main().catch()` catches it — shown as an error screen in the renderer rather than a silent hang; profile is saved if the crash happens after `runDungeon()` returns, lost otherwise (same limitation the CLI already documents for its own crash case).

## Testing

- `src/battle.ts`'s refactored `runDungeon()` keeps the exact same test shape as today (dependency-injected, no real I/O) — `test/battle.test.ts` updates its fake `onBattleEvent` collector to assert on event objects instead of formatted strings, which is more precise, not less.
- New `test/cli-render.test.ts`: pure-function tests for `formatBattleEvent`, one per event type, pinned to today's exact CLI wording so the refactor is provably behavior-preserving for the terminal.
- Electron's main-process IPC wiring is thin glue (folder dialog, IPC forwarding, calling the already-tested `runDungeon`) — not unit-tested beyond a manual smoke-test step in the implementation plan (build the app, launch it, play one floor for real), the same way the CLI's `runAgentTurn` network path was manually verified rather than unit-tested. No Playwright/Spectron harness for v1 — out of scope, YAGNI.

## Out of scope for v1 (explicitly deferred)

- Windows/Linux builds (Mac only, per the request).
- Code-signing/notarization with a paid Apple Developer account.
- Any visual asset beyond a minimal generated icon (no commissioned art, no sprite animations).
- Automated end-to-end GUI tests (Playwright/Spectron).
- npm registry publish for the CLI (already deferred from v1).
- Player HP / lose condition (already deferred from v1).
