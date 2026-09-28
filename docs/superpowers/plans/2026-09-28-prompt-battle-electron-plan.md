# Prompt Battle Electron App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `promptbattle` as a downloadable macOS app (`.dmg`) with a real GUI (colored HP bar, monster panel, scrolling log, prompt input) wrapping the exact same game logic the CLI already uses.

**Architecture:** Refactor `src/battle.ts`'s `runDungeon()` to emit a structured `BattleEvent` stream instead of pre-formatted text, so both the CLI (via a new `src/cli-render.ts` formatter) and a new Electron app can drive the same tested game loop. The Electron main process calls `runDungeon()` directly (it can `import` the project's `.ts` modules natively, same as the CLI) with an IPC-backed `BattleDeps`; the renderer is plain HTML/CSS/JS drawing DOM from the event stream.

**Tech Stack:** Electron + electron-builder (mac `.dmg`, ad-hoc signed, no paid Apple account). Main process stays TypeScript (native execution, reused from `src/`). Preload and renderer are plain JavaScript — see the Global Constraint below for why.

**Spec:** [docs/superpowers/specs/2026-09-28-prompt-battle-electron-design.md](../specs/2026-09-28-prompt-battle-electron-design.md)

## Global Constraints

- `BattleDeps.write(text)` is replaced by `BattleDeps.onBattleEvent(event: BattleEvent)`; `runDungeon()`'s control flow, session-id threading, and floor/damage/XP math are otherwise unchanged from the current implementation.
- The `"> "` terminal prompt affordance moves out of `battle.ts` entirely and into `cli.ts`'s own `readInput` closure (it's a terminal-only concept).
- **Preload and renderer are plain JavaScript, not TypeScript.** Confirmed empirically and via Electron's own docs: (a) the main process's bundled Node (tested at v24.21.0 here) natively type-strips `.ts` files exactly like the CLI's Node does — no build step there; (b) Electron's sandboxed preload scripts ignore `package.json`'s `"type": "module"` and run without an ESM context at all (Electron docs: "preload scripts will ignore `type: module`... you must use the `.mjs` extension" and "sandboxed preload scripts are run as plain JavaScript without an ESM context"); (c) the renderer runs in Chromium, which has no TypeScript support of any kind. So: `electron/main.ts` stays `.ts` (reuses `src/*.ts` directly); `electron/preload.cjs` and `electron/renderer/renderer.js` are plain JS. This is a real platform constraint, not a shortcut.
- No code-signing/notarization config — `electron-builder` ad-hoc-signs by default (free, no Apple Developer account); Gatekeeper will still block the first open, documented in the README.
- No custom app icon for v1 — ships with `electron-builder`'s default icon (deferred, trivial to add later by dropping an `.icns` at the configured path).
- Mac only for v1 (`electron-builder`'s `mac.target`), no Windows/Linux build config.
- No player HP / lose condition (unchanged from the CLI's v1 scope).
- Tests use only `node:test` + `node:assert/strict`, same as the CLI.

## Review Focus

- `battle.ts`'s refactor must not silently change game behavior for the CLI — every existing test scenario (three-floor clear, hesitate, EOF, `/flee`, agent-throws-no-damage, agent-error-no-damage, session threading, session survives a failed turn, live agent events before the attack line) must still hold under the new event shape, and `cli-render.ts` must reproduce today's exact printed CLI text.
- The IPC bridge between `readInput()` (an `await`ed `Promise<string|null>` inside `runDungeon`) and the renderer's Attack/Flee buttons must resolve exactly once per pending prompt — a double-submit or a submit with no pending prompt must not throw or hang the run.
- `pick-folder` returning `null` (user cancelled the dialog) must leave the setup screen usable, not silently disable the Start button forever or throw.
- The preload script's `contextBridge` surface must not leak `ipcRenderer`, `require`, or any other raw Node/Electron API to the renderer — only the six named functions in `PromptBattleApi`.
- The packaged `.dmg`/`.app` must actually launch and reach the setup screen on a real Mac — this can't be verified in this sandbox (no display), so it's a named manual verification step, not assumed from the source alone.
- If `start-run`'s IPC call rejects (an unexpected main-process error, not a normal agent-turn error — those are already caught inside `runDungeon` and never reject the call), the renderer must not be left stuck on the dungeon screen forever with no feedback — it must show an error state and let the player get back to the setup screen.

---

## File Structure

```
src/
  battle.ts       — MODIFIED: BattleEvent union, onBattleEvent instead of write
  cli-render.ts   — NEW: formatBattleEvent(event): string (CLI's exact wording)
  cli.ts          — MODIFIED: wires onBattleEvent + formatBattleEvent, owns the "> " prompt
test/
  battle.test.ts     — MODIFIED: asserts on BattleEvent objects instead of strings
  cli-render.test.ts — NEW: one test per BattleEvent variant
electron/
  main.ts               — NEW: app lifecycle, IPC handlers, runDungeon wiring
  preload.cjs            — NEW: contextBridge API (plain JS, see Global Constraints)
  renderer/
    index.html           — NEW: three screens (setup / dungeon / summary)
    style.css             — NEW
    renderer.js            — NEW: DOM wiring (plain JS)
package.json      — MODIFIED: main field, electron/electron-builder devDependencies,
                    electron:start/electron:build scripts, build config
README.md         — MODIFIED: Mac app download/install/Gatekeeper section
```

---

### Task 1: Refactor `battle.ts` to structured `BattleEvent`s

**Files:**
- Modify: `src/battle.ts`
- Modify: `test/battle.test.ts`

**Interfaces:**
- Consumes: `calculateDamage` (`src/damage.ts`), `spawnMonster`/`Difficulty` (`src/monsters.ts`), `TurnResult`/`AgentEvent` (`src/agent.ts`) — all unchanged.
- Produces: `export type BattleEvent = ...` (9 variants below), `BattleDeps` with `onBattleEvent` instead of `write`, `BattleSummary` (unchanged shape) — consumed by Task 2 (`cli-render.ts`/`cli.ts`) and Task 5 (`electron/main.ts`).

- [ ] **Step 1: Write the failing test (full rewrite of `test/battle.test.ts`)**

```typescript
// test/battle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDungeon, type BattleEvent } from '../src/battle.ts';
import type { TurnResult } from '../src/agent.ts';

const ONE_SHOT_PROMPT = 'test refactor ' + 'x'.repeat(700); // crits at 225 damage, one-shots floors 0-2

function makeFakeDeps(inputs: string[], turnResult: TurnResult = { summary: 'ok', filesChanged: [], commandsRun: [] }) {
  let i = 0;
  const events: BattleEvent[] = [];
  const runTurnCalls: string[] = [];
  return {
    deps: {
      runTurn: async (prompt: string) => {
        runTurnCalls.push(prompt);
        return turnResult;
      },
      readInput: async () => (i < inputs.length ? inputs[i++] : null),
      onBattleEvent: (event: BattleEvent) => events.push(event),
      cwd: '/fake/cwd',
      difficulty: 'normal' as const,
    },
    events,
    runTurnCalls,
  };
}

function drain(inputs: string[]) {
  let i = 0;
  return async () => (i < inputs.length ? inputs[i++] : null);
}

test('clears three floors with one-shot crits, then quits', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 3);
  assert.equal(summary.floorsEngaged, 3, 'quitting on a fresh floor before attacking does not count as engaging it');
  assert.equal(summary.xpGained, 20 + 25 + 30);
  assert.equal(runTurnCalls.length, 3);
});

test('empty input emits a hesitate event: no agent call, no damage, loop continues', async () => {
  const { deps, events, runTurnCalls } = makeFakeDeps(['', ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(summary.floorsEngaged, 1);
  assert.equal(runTurnCalls.length, 1);
  assert.ok(events.some((e) => e.type === 'hesitate'));
});

test('EOF (null input) ends the run immediately with no floors cleared or engaged', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([]);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 0);
  assert.equal(summary.floorsEngaged, 0);
  assert.equal(summary.xpGained, 0);
  assert.equal(runTurnCalls.length, 0);
});

test('/flee behaves the same as /quit', async () => {
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/flee']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(summary.floorsEngaged, 1);
});

test('an agent turn that throws emits an agentError event and deals no damage', async () => {
  let calls = 0;
  const events: BattleEvent[] = [];
  const deps = {
    runTurn: async () => {
      calls += 1;
      throw new Error('bash exited 1');
    },
    readInput: drain([ONE_SHOT_PROMPT, '/quit']),
    onBattleEvent: (event: BattleEvent) => events.push(event),
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  const summary = await runDungeon(deps);
  assert.equal(calls, 1);
  assert.equal(summary.floorsCleared, 0, 'no damage lands when the agent call failed, so the floor is not cleared');
  assert.equal(summary.floorsEngaged, 1, 'the floor was still engaged — a real attack was attempted, it just missed');
  const errorEvent = events.find((e) => e.type === 'agentError');
  assert.ok(errorEvent && errorEvent.type === 'agentError' && errorEvent.error === 'bash exited 1');
});

test('an agent turn that resolves with TurnResult.error set deals no damage either', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit'], {
    summary: '',
    filesChanged: [],
    commandsRun: [],
    error: 'invalid API key',
  });
  const summary = await runDungeon(deps);
  assert.equal(runTurnCalls.length, 1);
  assert.equal(summary.floorsCleared, 0, 'a result-level error (no thrown exception) still deals no damage');
  assert.equal(summary.floorsEngaged, 1);
});

test('threads sessionId returned from one turn into the next turn call, across floors, latest wins', async () => {
  const sessionIdsSeen: (string | undefined)[] = [];
  let turnCount = 0;
  const deps = {
    runTurn: async (_prompt: string, _cwd: string, sessionId?: string) => {
      sessionIdsSeen.push(sessionId);
      turnCount += 1;
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: `session-${turnCount}` };
    },
    readInput: drain([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']),
    onBattleEvent: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined, 'first turn of a run has no prior session to resume');
  assert.equal(sessionIdsSeen[1], 'session-1', "second turn (a new floor) still receives the first turn's session");
  assert.equal(sessionIdsSeen[2], 'session-2', 'third turn receives the most recent session, not the first');
});

test('a failed turn never poisons sessionId for later turns', async () => {
  const sessionIdsSeen: (string | undefined)[] = [];
  let turnCount = 0;
  const deps = {
    runTurn: async (_prompt: string, _cwd: string, sessionId?: string) => {
      sessionIdsSeen.push(sessionId);
      turnCount += 1;
      if (turnCount === 2) {
        return { summary: '', filesChanged: [], commandsRun: [], error: 'invalid API key', sessionId: 'broken-session' };
      }
      return { summary: '', filesChanged: [], commandsRun: [], sessionId: `session-${turnCount}` };
    },
    readInput: drain([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']),
    onBattleEvent: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  await runDungeon(deps);
  assert.equal(sessionIdsSeen[0], undefined);
  assert.equal(sessionIdsSeen[1], 'session-1', 'second (failing) turn still resumes the last good session');
  assert.equal(sessionIdsSeen[2], 'session-1', 'third turn resumes the last GOOD session, not the broken one the failed turn reported');
});

test('emits agentEvent for each live file/command event, before the attack event resolves', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  deps.runTurn = async (
    _prompt: string,
    _cwd: string,
    _sessionId?: string,
    onEvent?: (e: { type: 'command' | 'file'; value: string }) => void,
  ) => {
    onEvent?.({ type: 'command', value: 'npm test' });
    onEvent?.({ type: 'file', value: 'src/foo.ts' });
    return { summary: 'done', filesChanged: ['src/foo.ts'], commandsRun: ['npm test'] };
  };
  await runDungeon(deps);
  const agentEventIndices = events.map((e, i) => (e.type === 'agentEvent' ? i : -1)).filter((i) => i !== -1);
  const attackIndex = events.findIndex((e) => e.type === 'attack');
  assert.equal(agentEventIndices.length, 2, 'both live events were forwarded as agentEvent battle events');
  assert.ok(agentEventIndices.every((i) => i < attackIndex), 'agent events arrive before the attack/damage event, proving they are live, not buffered');
});

test('emits floorStart with the monster name/art/maxHp, hpChanged after the attack, and floorCleared', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  await runDungeon(deps);
  const floorStart = events.find((e) => e.type === 'floorStart');
  assert.ok(floorStart && floorStart.type === 'floorStart' && floorStart.monsterName === 'Bug Goblin' && floorStart.maxHp === 60);
  const hpChanged = events.find((e) => e.type === 'hpChanged');
  assert.ok(hpChanged && hpChanged.type === 'hpChanged' && hpChanged.hp === 0 && hpChanged.maxHp === 60);
  const floorCleared = events.find((e) => e.type === 'floorCleared');
  assert.ok(floorCleared && floorCleared.type === 'floorCleared' && floorCleared.xpGained === 20);
});

test('emits a final runEnded event matching the returned summary', async () => {
  const { deps, events } = makeFakeDeps([ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  const runEnded = events.find((e) => e.type === 'runEnded');
  assert.ok(runEnded && runEnded.type === 'runEnded');
  if (runEnded && runEnded.type === 'runEnded') {
    assert.deepEqual(
      { floorsCleared: runEnded.floorsCleared, floorsEngaged: runEnded.floorsEngaged, xpGained: runEnded.xpGained },
      summary,
    );
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/battle.test.ts`
Expected: FAIL — `BattleEvent` is not exported yet, `onBattleEvent` doesn't exist on the current `BattleDeps`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/battle.ts
import { calculateDamage } from './damage.ts';
import { spawnMonster, type Difficulty } from './monsters.ts';
import type { TurnResult, AgentEvent } from './agent.ts';

export type BattleEvent =
  | { type: 'floorStart'; floor: number; monsterName: string; monsterArt: string; maxHp: number }
  | { type: 'hesitate' }
  | { type: 'attack'; damage: number; crit: boolean; matchedKeywords: string[] }
  | { type: 'agentEvent'; agentEvent: AgentEvent }
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

export interface BattleSummary {
  floorsCleared: number;
  floorsEngaged: number;
  xpGained: number;
}

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  let floor = 0;
  let floorsCleared = 0;
  let floorsEngaged = 0;
  let xpGained = 0;
  let sessionId: string | undefined;

  while (true) {
    const monster = spawnMonster(floor, deps.difficulty);
    let hp = monster.maxHp;
    deps.onBattleEvent({ type: 'floorStart', floor, monsterName: monster.name, monsterArt: monster.art, maxHp: hp });

    let left = false;
    let currentFloorEngaged = false;
    while (hp > 0) {
      const raw = await deps.readInput();
      if (raw === null) {
        left = true;
        break;
      }
      const prompt = raw.trim();
      if (prompt === '/quit' || prompt === '/flee') {
        left = true;
        break;
      }
      if (prompt.length === 0) {
        deps.onBattleEvent({ type: 'hesitate' });
        continue;
      }

      currentFloorEngaged = true;
      const { damage, crit, matchedKeywords } = calculateDamage(prompt);
      let turn: TurnResult;
      try {
        turn = await deps.runTurn(prompt, deps.cwd, sessionId, (event) =>
          deps.onBattleEvent({ type: 'agentEvent', agentEvent: event }),
        );
      } catch (err) {
        turn = { summary: '', filesChanged: [], commandsRun: [], error: err instanceof Error ? err.message : String(err) };
      }
      // Only adopt a session id from a turn that actually succeeded — resuming
      // a session captured from a failed turn (a broken/never-saved session)
      // would make every later turn fail the same way for the rest of the run.
      if (!turn.error && turn.sessionId) sessionId = turn.sessionId;

      if (turn.error) {
        deps.onBattleEvent({ type: 'agentError', error: turn.error });
      } else {
        hp = Math.max(0, hp - damage);
        deps.onBattleEvent({ type: 'attack', damage, crit, matchedKeywords });
        if (turn.summary) deps.onBattleEvent({ type: 'agentSummary', summary: turn.summary });
      }
      deps.onBattleEvent({ type: 'hpChanged', hp, maxHp: monster.maxHp });
    }

    if (currentFloorEngaged) floorsEngaged += 1;
    if (left) break;

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.onBattleEvent({ type: 'floorCleared', monsterName: monster.name, xpGained: gained });
    floor += 1;
  }

  deps.onBattleEvent({ type: 'runEnded', floorsCleared, floorsEngaged, xpGained });
  return { floorsCleared, floorsEngaged, xpGained };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/battle.test.ts`
Expected: PASS, 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/battle.ts test/battle.test.ts
git commit -m "refactor: battle.ts emits structured BattleEvents instead of formatted text"
```

---

### Task 2: `cli-render.ts` and `cli.ts` update

**Files:**
- Create: `src/cli-render.ts`
- Test: `test/cli-render.test.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Consumes: `BattleEvent` (Task 1), `colorize`/`renderHpBar` (`src/ui.ts`, unchanged).
- Produces: `formatBattleEvent(event: BattleEvent): string` — consumed by `src/cli.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/cli-render.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBattleEvent } from '../src/cli-render.ts';
import type { BattleEvent } from '../src/battle.ts';

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

test('floorStart prints the floor header, art, and a full HP bar', () => {
  const event: BattleEvent = { type: 'floorStart', floor: 0, monsterName: 'Bug Goblin', monsterArt: '(o_o)', maxHp: 60 };
  const out = stripAnsi(formatBattleEvent(event));
  assert.equal(out, '\nFloor 1: Bug Goblin appears!\n(o_o)\n[████████████████████] 60/60\n');
});

test('hesitate prints the hesitate line', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'hesitate' }));
  assert.equal(out, 'You hesitate. No attack this turn.\n');
});

test('agentEvent formats a command differently from a file', () => {
  assert.equal(
    stripAnsi(formatBattleEvent({ type: 'agentEvent', agentEvent: { type: 'command', value: 'npm test' } })),
    '  → running: npm test\n',
  );
  assert.equal(
    stripAnsi(formatBattleEvent({ type: 'agentEvent', agentEvent: { type: 'file', value: 'src/foo.ts' } })),
    '  → editing: src/foo.ts\n',
  );
});

test('agentError prints the fizzle line with the real error text', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'agentError', error: 'invalid API key' }));
  assert.equal(out, 'Your attack misses! The spell fizzles: invalid API key\n');
});

test('attack prints damage, crit label, and matched keywords', () => {
  const plain = stripAnsi(formatBattleEvent({ type: 'attack', damage: 42, crit: false, matchedKeywords: [] }));
  assert.equal(plain, 'You attack for 42 damage!\n');
  const crit = stripAnsi(formatBattleEvent({ type: 'attack', damage: 225, crit: true, matchedKeywords: ['test', 'refactor'] }));
  assert.equal(crit, 'You attack for 225 damage! CRITICAL HIT!\n(keywords: test, refactor)\n');
});

test('agentSummary prints the summary text', () => {
  assert.equal(formatBattleEvent({ type: 'agentSummary', summary: 'Fixed the bug.' }), 'Fixed the bug.\n');
});

test('hpChanged prints the HP bar', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'hpChanged', hp: 30, maxHp: 60 }));
  assert.equal(out, '[██████████----------] 30/60\n');
});

test('floorCleared prints the victory line with XP', () => {
  const out = stripAnsi(formatBattleEvent({ type: 'floorCleared', monsterName: 'Bug Goblin', xpGained: 20 }));
  assert.equal(out, '\nBug Goblin defeated! +20 XP\n');
});

test('runEnded prints nothing (cli.ts prints its own final summary from the returned BattleSummary)', () => {
  assert.equal(formatBattleEvent({ type: 'runEnded', floorsCleared: 3, floorsEngaged: 3, xpGained: 75 }), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/cli-render.test.ts`
Expected: FAIL — `src/cli-render.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/cli-render.ts
import { colorize, renderHpBar } from './ui.ts';
import type { BattleEvent } from './battle.ts';

export function formatBattleEvent(event: BattleEvent): string {
  switch (event.type) {
    case 'floorStart':
      return `\n${colorize(`Floor ${event.floor + 1}: ${event.monsterName} appears!`, 'bold')}\n${event.monsterArt}\n${renderHpBar(event.maxHp, event.maxHp)}\n`;
    case 'hesitate':
      return colorize('You hesitate. No attack this turn.', 'yellow') + '\n';
    case 'agentEvent':
      return event.agentEvent.type === 'command'
        ? `  → running: ${event.agentEvent.value}\n`
        : `  → editing: ${event.agentEvent.value}\n`;
    case 'agentError':
      return colorize(`Your attack misses! The spell fizzles: ${event.error}`, 'red') + '\n';
    case 'attack': {
      const critLabel = event.crit ? colorize(' CRITICAL HIT!', 'red') : '';
      let out = `You attack for ${event.damage} damage!${critLabel}\n`;
      if (event.matchedKeywords.length > 0) out += `(keywords: ${event.matchedKeywords.join(', ')})\n`;
      return out;
    }
    case 'agentSummary':
      return `${event.summary}\n`;
    case 'hpChanged':
      return renderHpBar(event.hp, event.maxHp) + '\n';
    case 'floorCleared':
      return colorize(`\n${event.monsterName} defeated! +${event.xpGained} XP\n`, 'green');
    case 'runEnded':
      return '';
  }
}
```

Then update `src/cli.ts`'s `runDungeon()` call: replace `write: (text: string) => stdout.write(text)` with `onBattleEvent: (event) => stdout.write(formatBattleEvent(event))`, and move the `"> "` prompt into `readInput`:

```typescript
import { formatBattleEvent } from './cli-render.ts';
// ...
summary = await runDungeon({
  runTurn: runAgentTurn,
  cwd: process.cwd(),
  difficulty,
  onBattleEvent: (event) => stdout.write(formatBattleEvent(event)),
  readInput: async () => {
    stdout.write('\n> ');
    const next = await lines.next();
    return next.done ? null : next.value;
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/cli-render.test.ts`
Expected: PASS, 9 tests passing.

- [ ] **Step 5: Verify the CLI itself still behaves identically (automatable smoke test — no API key needed)**

Since `/quit` is sent before any real attack, this never calls the agent and works fully offline:

Run: `printf '/quit\n' | node src/cli.ts`
Expected: prints the welcome line, `Floor 1: Bug Goblin appears!`, the ASCII art, a full HP bar, then exits cleanly with a `Run complete: 0 floor(s) cleared...` line — no hang, no crash, no agent call.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass (should be 11 + 9 + the untouched suites from before = 20 new/changed plus the rest unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/cli-render.ts src/cli.ts test/cli-render.test.ts
git commit -m "feat: add cli-render.ts, wire cli.ts to the structured BattleEvent stream"
```

---

### Task 3: Electron scaffold

**Files:**
- Modify: `package.json`
- Create: `electron/` (empty dir, populated by later tasks)

**Interfaces:**
- Produces: `electron` + `electron-builder` devDependencies, `"main": "electron/main.ts"`, `npm run electron:start` / `npm run electron:build` scripts, a `build` config block for `electron-builder`.

- [ ] **Step 1: Install electron and electron-builder as devDependencies**

Run: `npm install --save-dev electron electron-builder`
Expected: `package.json` gains a `devDependencies` block, install succeeds.

- [ ] **Step 2: Add the `main` field, scripts, and build config to `package.json`**

```json
{
  "name": "prompt-engineering-is-game",
  "version": "0.1.0",
  "description": "Turn-based RPG wrapper around real AI coding — longer prompts hit harder.",
  "type": "module",
  "main": "electron/main.ts",
  "bin": {
    "promptbattle": "./src/cli.ts"
  },
  "engines": {
    "node": ">=22.18.0"
  },
  "scripts": {
    "test": "node --test test/*.test.ts",
    "electron:start": "electron .",
    "electron:build": "electron-builder"
  },
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.3.283"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.promptbattle.app",
    "productName": "Prompt Battle",
    "files": ["src/**/*.ts", "electron/**/*", "package.json", "!node_modules/**/*"],
    "mac": {
      "target": ["dmg"],
      "category": "public.app-category.developer-tools"
    },
    "directories": {
      "output": "release"
    }
  }
}
```

(Keep whatever exact `electron`/`electron-builder` versions Step 1's `npm install` actually resolved — edit the version numbers above to match `package.json` after install rather than pinning these placeholders.)

- [ ] **Step 3: Create the `electron/` directory**

Run: `mkdir -p electron/renderer`

- [ ] **Step 4: Verify Electron's bundled Node actually type-strips `.ts` the same way the CLI's Node does**

This is the load-bearing assumption behind skipping a build step for the main process — verify it directly rather than trusting the CLI's Node version alone.

Run:
```bash
printf 'const greeting: string = "electron main process ts works";\nconsole.log(greeting);\n' > /tmp/electron-ts-check.ts
./node_modules/.bin/electron /tmp/electron-ts-check.ts
```
Expected: prints `electron main process ts works` with no `SyntaxError`/`Unknown file extension` error (a `Warning: Failed to load the ES module` followed by a real crash would mean the assumption is wrong — investigate before continuing). A separate unrelated warning about a missing display/GPU context is fine and expected in a sandboxed/headless environment; only a TypeScript/module-loading error is a real problem here.

Run: `rm /tmp/electron-ts-check.ts` to clean up.

- [ ] **Step 5: Confirm the test suite is unaffected**

Run: `npm test`
Expected: still all passing — this task only adds devDependencies and config, no `src/` changes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: scaffold electron app (devDependencies, build config)"
```

---

### Task 4: Preload script (`electron/preload.cjs`)

**Files:**
- Create: `electron/preload.cjs`

**Interfaces:**
- Produces: `window.promptBattle` in the renderer with `{ pickFolder, startRun, submitPrompt, flee, onBattleEvent }` — consumed by Task 6 (`electron/renderer/renderer.js`). Wired into `BrowserWindow`'s `webPreferences.preload` in Task 5 (`electron/main.ts`).

This file is plain CommonJS JavaScript, not TypeScript — see the plan's Global Constraints for why (Electron's sandboxed preload scripts ignore `"type": "module"` and run without an ESM context).

- [ ] **Step 1: Write the file**

```javascript
// electron/preload.cjs
// Plain CommonJS, not TypeScript: Electron's sandboxed preload scripts ignore
// package.json's "type": "module" and run without an ESM context at all
// (https://www.electronjs.org/docs/latest/tutorial/esm — preload scripts need
// .mjs for ESM, and sandboxed preload has no ESM context). This is the one
// file in the project that isn't native-TS, because the platform doesn't
// support it here, not because it was skipped.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptBattle', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  startRun: (options) => ipcRenderer.invoke('start-run', options),
  submitPrompt: (text) => ipcRenderer.send('submit-prompt', text),
  flee: () => ipcRenderer.send('flee'),
  onBattleEvent: (callback) => {
    ipcRenderer.on('battle-event', (_event, data) => callback(data));
  },
});
```

- [ ] **Step 2: Syntax-check it standalone**

Run: `node --check electron/preload.cjs`
Expected: no output (valid syntax). This only checks JS syntax, not that `require('electron')` resolves outside an actual Electron process — that's verified end-to-end in Task 7's manual launch.

- [ ] **Step 3: Commit**

```bash
git add electron/preload.cjs
git commit -m "feat: add electron preload script (contextBridge API)"
```

---

### Task 5: Main process (`electron/main.ts`)

**Files:**
- Create: `electron/main.ts`

**Interfaces:**
- Consumes: `runDungeon`/`BattleEvent` (`src/battle.ts`, Task 1), `runAgentTurn` (`src/agent.ts`, unchanged), `loadProfile`/`saveProfile`/`addXp` (`src/profile.ts`, unchanged), `Difficulty` (`src/monsters.ts`, unchanged), `preload.cjs` (Task 4).
- Produces: the app's window + IPC handlers `pick-folder`, `start-run`, `submit-prompt`, `flee` — consumed by Task 4's preload bridge and, transitively, Task 6's renderer.

- [ ] **Step 1: Write the file**

```typescript
// electron/main.ts
import electron from 'electron';
const { app, BrowserWindow, ipcMain, dialog } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDungeon, type BattleEvent } from '../src/battle.ts';
import { runAgentTurn } from '../src/agent.ts';
import { loadProfile, saveProfile, addXp } from '../src/profile.ts';
import type { Difficulty } from '../src/monsters.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

// One dungeon run at a time, one window: a single pending resolver is enough.
// A multi-window/multi-run version would need a per-session map instead.
let pendingInputResolve: ((value: string | null) => void) | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pick-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('start-run', async (_event, options: { cwd: string; difficulty: Difficulty }) => {
  const profile = await loadProfile();

  const summary = await runDungeon({
    runTurn: runAgentTurn,
    cwd: options.cwd,
    difficulty: options.difficulty,
    onBattleEvent: (event: BattleEvent) => {
      mainWindow?.webContents.send('battle-event', event);
    },
    readInput: () =>
      new Promise<string | null>((resolve) => {
        pendingInputResolve = resolve;
      }),
  });

  const updated = addXp(profile, summary.xpGained);
  updated.totalWins += summary.floorsCleared;
  updated.totalBattles += summary.floorsEngaged;
  await saveProfile(updated);

  return { summary, profile: updated };
});

ipcMain.on('submit-prompt', (_event, text: string) => {
  if (pendingInputResolve) {
    const resolve = pendingInputResolve;
    pendingInputResolve = null;
    resolve(text);
  }
});

ipcMain.on('flee', () => {
  if (pendingInputResolve) {
    const resolve = pendingInputResolve;
    pendingInputResolve = null;
    resolve('/flee');
  }
});
```

- [ ] **Step 2: Syntax/type-sanity check by importing it standalone (no display needed)**

Run: `node -e "import('./electron/main.ts').catch(e => { console.error(e); process.exit(1); })"`
Expected: this will likely throw or hang partway through `app.whenReady()` in a non-Electron Node process (the `electron` module's exports are only meaningful when actually run by the `electron` binary) — that's fine and expected; the goal of this step is only to confirm there's no `SyntaxError` or unresolved-import error in the module's top-level code before Task 7's real launch. If it throws specifically about `app`/`dialog` being `undefined` when called, that confirms the imports and TypeScript resolved correctly and the failure is just "this isn't really Electron" — acceptable. If it throws about `../src/battle.ts` or any other project import not resolving, that's a real bug — fix it.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add electron main process (IPC handlers, runDungeon wiring)"
```

---

### Task 6: Renderer (`electron/renderer/`)

**Files:**
- Create: `electron/renderer/index.html`
- Create: `electron/renderer/style.css`
- Create: `electron/renderer/renderer.js`

**Interfaces:**
- Consumes: `window.promptBattle` (Task 4's preload API).
- Produces: the three-screen UI (setup / dungeon / summary) loaded by Task 5's `mainWindow.loadFile`.

This is plain JavaScript (browser context, no TypeScript support — see Global Constraints).

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Prompt Battle</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <section id="setup-screen">
      <h1>Prompt Battle</h1>
      <button id="pick-folder-btn">Choose Project Folder</button>
      <p id="folder-path"></p>
      <fieldset>
        <legend>Difficulty</legend>
        <label><input type="radio" name="difficulty" value="easy" /> Easy</label>
        <label><input type="radio" name="difficulty" value="normal" checked /> Normal</label>
        <label><input type="radio" name="difficulty" value="hard" /> Hard</label>
      </fieldset>
      <button id="start-btn" disabled>Enter the Dungeon</button>
      <p id="setup-error" class="error-text" hidden></p>
    </section>

    <section id="dungeon-screen" hidden>
      <div id="monster-panel">
        <h2 id="monster-name"></h2>
        <pre id="monster-art"></pre>
        <div class="hp-bar-track"><div id="hp-bar-fill" class="hp-bar-fill"></div></div>
        <p id="hp-label"></p>
      </div>
      <div id="log"></div>
      <form id="attack-form">
        <input id="prompt-input" type="text" placeholder="Type your attack..." autocomplete="off" />
        <button type="submit">Attack</button>
        <button type="button" id="flee-btn">Flee</button>
      </form>
    </section>

    <section id="summary-screen" hidden>
      <h2>Run Complete</h2>
      <p id="summary-text"></p>
      <button id="play-again-btn">Play Again</button>
    </section>

    <script type="module" src="renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `style.css`**

```css
:root {
  color-scheme: dark;
}
body {
  margin: 0;
  background: #0d0f14;
  color: #d8dee9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#setup-screen,
#summary-screen {
  max-width: 420px;
  margin: 80px auto;
  text-align: center;
}
#setup-screen h1 {
  font-size: 28px;
}
#setup-screen button,
#summary-screen button {
  margin-top: 16px;
  padding: 10px 20px;
  font-size: 14px;
  background: #3b4252;
  color: #e5e9f0;
  border: 1px solid #4c566a;
  border-radius: 6px;
  cursor: pointer;
}
#setup-screen fieldset {
  margin-top: 16px;
  border: 1px solid #4c566a;
  border-radius: 6px;
}
#dungeon-screen {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}
#monster-panel {
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #4c566a;
}
#monster-art {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 14px;
  white-space: pre;
  margin: 4px 0;
}
.hp-bar-track {
  width: 100%;
  max-width: 400px;
  height: 18px;
  margin: 8px auto 0;
  background: #2e3440;
  border-radius: 4px;
  overflow: hidden;
}
.hp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #a3be8c, #8fbcbb);
  transition: width 0.2s ease, background 0.2s ease;
}
.hp-bar-fill.warn {
  background: linear-gradient(90deg, #ebcb8b, #d08770);
}
.hp-bar-fill.danger {
  background: linear-gradient(90deg, #bf616a, #d08770);
}
#log {
  flex: 1;
  overflow-y: auto;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 13px;
  padding: 12px 4px;
  white-space: pre-wrap;
}
#log .crit {
  color: #bf616a;
  font-weight: bold;
}
#log .error {
  color: #bf616a;
}
#log .file,
#log .command {
  color: #81a1c1;
}
#log .victory {
  color: #a3be8c;
  font-weight: bold;
}
#attack-form {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #4c566a;
}
#prompt-input {
  flex: 1;
  padding: 8px;
  background: #2e3440;
  color: #e5e9f0;
  border: 1px solid #4c566a;
  border-radius: 4px;
  font-size: 14px;
}
#attack-form button {
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #4c566a;
  background: #3b4252;
  color: #e5e9f0;
  cursor: pointer;
}
.error-text {
  margin-top: 12px;
  color: #bf616a;
  font-size: 13px;
}
```

- [ ] **Step 3: Write `renderer.js`**

```javascript
// electron/renderer/renderer.js
const setupScreen = document.getElementById('setup-screen');
const dungeonScreen = document.getElementById('dungeon-screen');
const summaryScreen = document.getElementById('summary-screen');
const pickFolderBtn = document.getElementById('pick-folder-btn');
const folderPathEl = document.getElementById('folder-path');
const startBtn = document.getElementById('start-btn');
const monsterNameEl = document.getElementById('monster-name');
const monsterArtEl = document.getElementById('monster-art');
const hpBarFillEl = document.getElementById('hp-bar-fill');
const hpLabelEl = document.getElementById('hp-label');
const logEl = document.getElementById('log');
const attackForm = document.getElementById('attack-form');
const promptInput = document.getElementById('prompt-input');
const fleeBtn = document.getElementById('flee-btn');
const summaryTextEl = document.getElementById('summary-text');
const playAgainBtn = document.getElementById('play-again-btn');
const setupErrorEl = document.getElementById('setup-error');

let chosenFolder = null;

pickFolderBtn.addEventListener('click', async () => {
  const folder = await window.promptBattle.pickFolder();
  if (folder) {
    chosenFolder = folder;
    folderPathEl.textContent = folder;
    startBtn.disabled = false;
  }
});

function appendLog(text, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setHpBar(hp, maxHp) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(hp, safeMax)) / safeMax;
  hpBarFillEl.style.width = `${ratio * 100}%`;
  hpBarFillEl.classList.toggle('warn', ratio <= 0.5 && ratio > 0.2);
  hpBarFillEl.classList.toggle('danger', ratio <= 0.2);
  hpLabelEl.textContent = `${Math.max(0, hp)} / ${safeMax} HP`;
}

function renderBattleEvent(event) {
  switch (event.type) {
    case 'floorStart':
      monsterNameEl.textContent = `Floor ${event.floor + 1}: ${event.monsterName}`;
      monsterArtEl.textContent = event.monsterArt;
      setHpBar(event.maxHp, event.maxHp);
      appendLog(`${event.monsterName} appears!`);
      break;
    case 'hesitate':
      appendLog('You hesitate. No attack this turn.');
      break;
    case 'agentEvent':
      appendLog(
        event.agentEvent.type === 'command' ? `→ running: ${event.agentEvent.value}` : `→ editing: ${event.agentEvent.value}`,
        event.agentEvent.type,
      );
      break;
    case 'agentError':
      appendLog(`Your attack misses! The spell fizzles: ${event.error}`, 'error');
      break;
    case 'attack': {
      const label = event.crit ? ' CRITICAL HIT!' : '';
      appendLog(`You attack for ${event.damage} damage!${label}`, event.crit ? 'crit' : undefined);
      if (event.matchedKeywords.length > 0) appendLog(`(keywords: ${event.matchedKeywords.join(', ')})`);
      break;
    }
    case 'agentSummary':
      appendLog(event.summary);
      break;
    case 'hpChanged':
      setHpBar(event.hp, event.maxHp);
      break;
    case 'floorCleared':
      appendLog(`${event.monsterName} defeated! +${event.xpGained} XP`, 'victory');
      break;
    case 'runEnded':
      break;
  }
}

window.promptBattle.onBattleEvent(renderBattleEvent);

startBtn.addEventListener('click', async () => {
  if (!chosenFolder) return;
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  setupErrorEl.hidden = true;
  setupScreen.hidden = true;
  dungeonScreen.hidden = false;
  logEl.textContent = '';
  try {
    const result = await window.promptBattle.startRun({ cwd: chosenFolder, difficulty });
    dungeonScreen.hidden = true;
    summaryScreen.hidden = false;
    const { summary, profile } = result;
    summaryTextEl.textContent = `${summary.floorsCleared} floor(s) cleared, +${summary.xpGained} XP. Now level ${profile.level} (${profile.xp} total XP).`;
  } catch (err) {
    // An unexpected main-process error (not a normal agent-turn error — those
    // are already handled inside runDungeon and never reject this call).
    // Without this catch, a rejection here would leave the player stuck on
    // the dungeon screen forever with no feedback and no way back.
    dungeonScreen.hidden = true;
    setupScreen.hidden = false;
    setupErrorEl.textContent = `Something went wrong: ${err && err.message ? err.message : String(err)}`;
    setupErrorEl.hidden = false;
  }
});

attackForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = promptInput.value;
  promptInput.value = '';
  window.promptBattle.submitPrompt(text);
});

fleeBtn.addEventListener('click', () => {
  window.promptBattle.flee();
});

playAgainBtn.addEventListener('click', () => {
  summaryScreen.hidden = true;
  setupScreen.hidden = false;
  chosenFolder = null;
  folderPathEl.textContent = '';
  startBtn.disabled = true;
});
```

- [ ] **Step 4: Syntax-check the renderer script**

Run: `node --check electron/renderer/renderer.js`
Expected: no output (valid syntax). `window`/`document` are undefined outside a browser, so this only confirms syntax, not DOM behavior — real behavior is confirmed in Task 7's manual launch.

- [ ] **Step 5: Commit**

```bash
git add electron/renderer/
git commit -m "feat: add electron renderer (setup/dungeon/summary screens)"
```

---

### Task 7: Package the app and verify it actually launches

**Files:**
- No new files — this task builds and manually verifies what Tasks 3-6 produced.

**Interfaces:**
- Consumes: everything from Tasks 3-6.
- Produces: a built `.app`/`.dmg` under `release/`.

This task's real verification cannot be automated in a sandbox without a display — it must be run on an actual Mac with a screen.

- [ ] **Step 1: Run the dev build (unpackaged) first**

Run: `npm run electron:start`
Expected: a window titled "Prompt Battle" opens, showing the setup screen (title, "Choose Project Folder" button, difficulty radios, disabled "Enter the Dungeon" button).

- [ ] **Step 2: Manually play through one floor end to end**

1. Click "Choose Project Folder", pick any small test directory (e.g. a scratch folder, not this repo necessarily).
2. Leave difficulty on "Normal", click "Enter the Dungeon".
3. Confirm the monster panel shows a name, ASCII art, and a full green HP bar.
4. Type a short, real coding instruction (something harmless for the chosen folder, e.g. "create a file named hello.txt containing the word hi") and click Attack.
5. Confirm: a damage line appears in the log, live `→ running:`/`→ editing:` lines appear (if the agent used any tools) before the damage line settles, the HP bar visibly shrinks, and — if logged into Claude Code — the file really gets created in the chosen folder.
6. Click Flee. Confirm the summary screen shows floors cleared / XP / level, and that `~/.promptbattle/profile.json` was updated (`cat ~/.promptbattle/profile.json`).

Expected: no crash, no hang, no console errors in the DevTools console (View → Toggle Developer Tools) beyond expected network activity.

- [ ] **Step 3: Build the packaged app**

Run: `npm run electron:build`
Expected: `release/` contains a `.dmg` and an unpacked `.app` (exact filenames depend on `electron-builder`'s resolved version/config — check `release/` after the build).

- [ ] **Step 4: Launch the packaged app**

Run: `open release/*.app` (or double-click it in Finder)
Expected: same behavior as Step 2. The very first launch will likely show a Gatekeeper "cannot be opened because the developer cannot be verified" dialog (expected — no paid Apple Developer account, see the plan's Global Constraints) — right-click the `.app` → Open, confirm in the dialog that appears, and it should launch normally from then on.

- [ ] **Step 5: Note the result**

If any step fails, do not silently work around it — record what broke (which step, what error/behavior) so it can be fixed before this task is considered done. This is real end-to-end verification, not a formality.

- [ ] **Step 6: Commit** (only if Step 3's build step required any config fixes beyond what Task 3 already committed)

```bash
git add package.json package-lock.json
git commit -m "fix: adjust electron-builder config after a real build/launch pass"
```

---

### Task 8: README updates for the Mac app

**Files:**
- Modify: `README.md`

**Interfaces:**
- None — documentation only.

- [ ] **Step 1: Add a "Mac App" section to `README.md`**, after the existing "Install" section for the CLI, along these lines (adjust exact wording to match whatever Task 7 actually produced, e.g. the real `.dmg` filename):

```markdown
## Mac App

Prefer a real window over a terminal? Build the desktop app from the same repo:

\`\`\`bash
npm install
npm run electron:build
\`\`\`

This produces a `.dmg` under `release/`. Open it and drag Prompt Battle into Applications, or run the built `.app` directly.

**First launch:** macOS will say the app "cannot be opened because the developer cannot be verified" — this app isn't notarized (that requires a paid Apple Developer account). Right-click the app → Open, then confirm in the dialog. You only need to do this once.

The app has the same rules as the CLI (longer/keyword-rich prompts hit harder, real file/bash work happens for real, same Claude Code login, same full-permissions safety note above) — pick a project folder and a difficulty, then fight.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document the Mac app build/install/Gatekeeper steps"
```
