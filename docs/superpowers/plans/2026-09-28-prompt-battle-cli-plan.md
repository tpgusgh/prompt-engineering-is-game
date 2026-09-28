# Prompt Battle CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable CLI (`promptbattle`) that turns real, agentic AI coding (via the Claude Agent SDK) into a turn-based RPG where longer/better prompts deal more damage to bug-themed monsters in an infinite dungeon.

**Architecture:** A thin game layer (damage math, monster data, HP bar rendering, dungeon loop, local profile persistence) wraps `@anthropic-ai/claude-agent-sdk`'s `query()`, which does all the real file/command work. No build step: Node's native TypeScript type-stripping runs `.ts` files directly.

**Tech Stack:** Node.js >= 22.6.0, TypeScript (type-stripped, no compiler), `@anthropic-ai/claude-agent-sdk`, `node:test` + `node:assert/strict` for tests. Zero other dependencies.

**Spec:** [docs/superpowers/specs/2026-09-28-prompt-battle-cli-design.md](../specs/2026-09-28-prompt-battle-cli-design.md)

## Global Constraints

- Node.js >= 22.6.0 required (native TypeScript type-stripping) — no `tsc`, no build step, no `dist/` folder; `.ts` files run and are imported directly.
- Real coding execution goes only through `@anthropic-ai/claude-agent-sdk`'s `query()` — never reimplement file/bash tool execution.
- Requires `ANTHROPIC_API_KEY` env var at runtime; checked before any battle starts, fails fast with a setup message if absent.
- Damage formula (exact): `base = clamp(10 + floor(promptLength / 5), 10, 150)`; keyword set `['step by step', 'test', 'edge case', 'refactor', 'why', 'example']` (case-insensitive substring match); crit (`x1.5`, applied after clamp, then rounded) when `matchedKeywords.length >= 2`.
- Persistence file: `~/.promptbattle/profile.json` shaped `{ level: number, xp: number, totalWins: number, totalBattles: number }`.
- No player HP / no lose condition in v1 (explicitly out of scope).
- Dungeon is infinite; ends only on `/quit`, `/flee`, or EOF (Ctrl+D).
- Tests use only `node:test` + `node:assert/strict` — no test framework dependency.
- No external UI dependency — HP bars/colors via raw ANSI escape codes only.

## Review Focus

- Empty or whitespace-only prompt input must not crash, must not call the agent, and must deal 0 damage ("hesitate" turn) — covered in Task 7 (battle loop).
- Missing `ANTHROPIC_API_KEY` must fail fast with an actionable message before any battle/loop starts, not fail deep inside an agent call — covered in Task 9 (cli entrypoint).
- An agent turn that throws (bad bash exit, network/API error, malformed tool input) must not crash the process; the dungeon loop must continue to the next turn — covered in Task 7 (battle loop, via a fake `runTurn` that rejects).
- An extremely long prompt (thousands of characters) must clamp damage to the documented max (150, or 225 on crit) and must never render a negative or overflowing HP bar — covered in Task 2 (damage) and Task 3 (HP bar rendering).
- Corrupted or unreadable `~/.promptbattle/profile.json` (invalid JSON) on load must not crash startup; it must fall back to the default profile — covered in Task 5 (profile).

---

## File Structure

```
package.json
.gitignore
README.md
src/
  damage.ts     — pure damage calculation
  ui.ts         — ANSI color + HP bar rendering
  monsters.ts   — monster data + HP scaling
  profile.ts    — load/save ~/.promptbattle/profile.json, XP/level math
  agent.ts      — wraps @anthropic-ai/claude-agent-sdk query()
  battle.ts     — the dungeon loop (dependency-injected for testability)
  args.ts       — CLI arg parsing (--difficulty)
  cli.ts        — entrypoint (bin), wires everything to real stdin/stdout
test/
  damage.test.ts
  ui.test.ts
  monsters.test.ts
  profile.test.ts
  agent.test.ts
  battle.test.ts
  args.test.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/` (empty dir, populated by later tasks)
- Create: `test/` (empty dir, populated by later tasks)

**Interfaces:**
- Produces: an installable npm package named `prompt-engineering-is-game` with a `promptbattle` bin, `@anthropic-ai/claude-agent-sdk` as a declared dependency, and `npm test` wired to `node --test`.

- [ ] **Step 1: Verify Node version supports native TypeScript**

Run: `node -v`
Expected: version `v22.6.0` or higher (this environment has `v26.5.0`, confirmed working).

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
*.log
.DS_Store
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "prompt-engineering-is-game",
  "version": "0.1.0",
  "description": "Turn-based RPG wrapper around real AI coding — longer prompts hit harder.",
  "type": "module",
  "bin": {
    "promptbattle": "./src/cli.ts"
  },
  "engines": {
    "node": ">=22.6.0"
  },
  "scripts": {
    "test": "node --test test/*.test.ts"
  },
  "license": "MIT"
}
```

- [ ] **Step 4: Install the Claude Agent SDK dependency**

Run: `npm install @anthropic-ai/claude-agent-sdk`
Expected: `package.json` gains a `dependencies` entry, `package-lock.json` and `node_modules/` are created, install succeeds with no errors.

- [ ] **Step 5: Confirm the test script runs with zero tests (no test files yet)**

Run: `npm test`
Expected: `node --test` reports `tests 0` (no test files exist yet) and exits 0 — confirms the script wiring itself is correct before any test files exist.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold npm package, install claude-agent-sdk"
```

---

### Task 2: Damage calculation

**Files:**
- Create: `src/damage.ts`
- Test: `test/damage.test.ts`

**Interfaces:**
- Produces: `calculateDamage(prompt: string): { damage: number; crit: boolean; matchedKeywords: string[] }` — consumed by Task 7 (`battle.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/damage.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage } from '../src/damage.ts';

test('short prompt deals minimum damage', () => {
  const result = calculateDamage('fix it');
  assert.equal(result.damage, 10);
  assert.equal(result.crit, false);
  assert.deepEqual(result.matchedKeywords, []);
});

test('damage scales with length up to the cap', () => {
  const medium = calculateDamage('x'.repeat(100));
  assert.equal(medium.damage, 10 + Math.floor(100 / 5));

  const huge = calculateDamage('x'.repeat(10000));
  assert.equal(huge.damage, 150, 'damage must clamp at 150 for non-crit prompts');
});

test('two or more matched keywords trigger a 1.5x crit', () => {
  const prompt = 'please refactor this step by step and add a test for the edge case';
  const result = calculateDamage(prompt);
  assert.equal(result.crit, true);
  assert.ok(result.matchedKeywords.includes('refactor'));
  assert.ok(result.matchedKeywords.includes('test'));
  const base = Math.min(150, Math.max(10, 10 + Math.floor(prompt.length / 5)));
  assert.equal(result.damage, Math.round(base * 1.5));
});

test('a single matched keyword does not crit', () => {
  const result = calculateDamage('please refactor this quickly');
  assert.equal(result.matchedKeywords.length, 1);
  assert.equal(result.crit, false);
});

test('an extremely long prompt with keywords still clamps before the crit multiplier, never exceeding 225', () => {
  const prompt = 'test refactor ' + 'x'.repeat(50000);
  const result = calculateDamage(prompt);
  assert.equal(result.crit, true);
  assert.equal(result.damage, 225);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/damage.test.ts`
Expected: FAIL — `src/damage.ts` does not exist yet (module not found).

- [ ] **Step 3: Write the implementation**

```typescript
// src/damage.ts
export interface DamageResult {
  damage: number;
  crit: boolean;
  matchedKeywords: string[];
}

const KEYWORDS = ['step by step', 'test', 'edge case', 'refactor', 'why', 'example'];

export function calculateDamage(prompt: string): DamageResult {
  const length = prompt.length;
  const base = Math.min(150, Math.max(10, 10 + Math.floor(length / 5)));
  const lower = prompt.toLowerCase();
  const matchedKeywords = KEYWORDS.filter((keyword) => lower.includes(keyword));
  const crit = matchedKeywords.length >= 2;
  const damage = crit ? Math.round(base * 1.5) : base;
  return { damage, crit, matchedKeywords };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/damage.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/damage.ts test/damage.test.ts
git commit -m "feat: add prompt damage calculation"
```

---

### Task 3: ANSI UI helpers

**Files:**
- Create: `src/ui.ts`
- Test: `test/ui.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `colorize(text: string, color: 'red'|'green'|'yellow'|'cyan'|'bold'): string` and `renderHpBar(current: number, max: number, width?: number): string` — consumed by Task 7 (`battle.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/ui.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorize, renderHpBar } from '../src/ui.ts';

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

test('colorize wraps text in ansi codes and resets', () => {
  const result = colorize('hi', 'red');
  assert.ok(result.includes('hi'));
  assert.ok(result.startsWith('\x1b['));
  assert.ok(result.endsWith('\x1b[0m'));
  assert.equal(stripAnsi(result), 'hi');
});

test('renderHpBar shows a full bar at max health', () => {
  const bar = stripAnsi(renderHpBar(100, 100, 10));
  assert.equal(bar, '[██████████] 100/100');
});

test('renderHpBar shows an empty bar at zero health', () => {
  const bar = stripAnsi(renderHpBar(0, 100, 10));
  assert.equal(bar, '[----------] 0/100');
});

test('renderHpBar clamps current above max and below zero', () => {
  const over = stripAnsi(renderHpBar(500, 100, 10));
  assert.equal(over, '[██████████] 100/100');
  const under = stripAnsi(renderHpBar(-50, 100, 10));
  assert.equal(under, '[----------] 0/100');
});

test('renderHpBar never divides by zero when max is 0', () => {
  const bar = stripAnsi(renderHpBar(0, 0, 10));
  assert.equal(bar, '[----------] 0/1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ui.test.ts`
Expected: FAIL — `src/ui.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/ui.ts
const RESET = '\x1b[0m';

const COLORS = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
} as const;

export type Color = keyof typeof COLORS;

export function colorize(text: string, color: Color): string {
  return `${COLORS[color]}${text}${RESET}`;
}

export function renderHpBar(current: number, max: number, width = 20): string {
  const safeMax = Math.max(1, max);
  const clampedCurrent = Math.max(0, Math.min(current, safeMax));
  const ratio = clampedCurrent / safeMax;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '-'.repeat(empty);
  const color: Color = ratio > 0.5 ? 'green' : ratio > 0.2 ? 'yellow' : 'red';
  return `[${colorize(bar, color)}] ${clampedCurrent}/${safeMax}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ui.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/ui.ts test/ui.test.ts
git commit -m "feat: add ANSI color and HP bar rendering"
```

---

### Task 4: Monster data and HP scaling

**Files:**
- Create: `src/monsters.ts`
- Test: `test/monsters.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Difficulty = 'easy' | 'normal' | 'hard'`, `spawnMonster(floor: number, difficulty: Difficulty): { name: string; art: string; maxHp: number }` — consumed by Task 7 (`battle.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/monsters.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnMonster } from '../src/monsters.ts';

test('floor 0 on normal difficulty uses the first monster at its base HP', () => {
  const monster = spawnMonster(0, 'normal');
  assert.equal(monster.name, 'Bug Goblin');
  assert.equal(monster.maxHp, 60);
  assert.ok(monster.art.length > 0);
});

test('HP increases as the floor number increases', () => {
  const floor0 = spawnMonster(0, 'normal');
  const floor5 = spawnMonster(5, 'normal');
  assert.ok(floor5.maxHp > floor0.maxHp);
});

test('hard difficulty deals more HP than easy at the same floor', () => {
  const easy = spawnMonster(2, 'easy');
  const hard = spawnMonster(2, 'hard');
  assert.ok(hard.maxHp > easy.maxHp);
});

test('monster rotation cycles back to the first monster', () => {
  const first = spawnMonster(0, 'normal');
  const wrapped = spawnMonster(6, 'normal'); // 6 monsters in the list, so floor 6 wraps to index 0
  assert.equal(wrapped.name, first.name);
  assert.ok(wrapped.maxHp > first.maxHp, 'wrapped floor still scales HP up even with the same monster');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/monsters.test.ts`
Expected: FAIL — `src/monsters.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/monsters.ts
export type Difficulty = 'easy' | 'normal' | 'hard';

interface MonsterTemplate {
  name: string;
  art: string;
  baseHp: number;
}

const MONSTERS: MonsterTemplate[] = [
  { name: 'Bug Goblin', art: '  (o_o)\n  <)  )╯\n  /   \\', baseHp: 60 },
  { name: 'Type Error Slime', art: '  .-\'\'-.\n (  ~~  )\n  `-..-`', baseHp: 80 },
  { name: 'Null Pointer Wraith', art: '  ,---.\n ( 0 0 )\n  `-v-`  undefined', baseHp: 100 },
  { name: 'Race Condition Phantom', art: '  <o><o>\n ~~~~~~~~ (blinking)', baseHp: 130 },
  { name: 'Merge Conflict Hydra', art: '  <<<<<<<\n  =======\n  >>>>>>>', baseHp: 160 },
  { name: 'Legacy Code Dragon', art: '  /^^^^^\\\n <( o o )>\n  \\_===_/', baseHp: 220 },
];

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.7,
  normal: 1,
  hard: 1.4,
};

const HP_GROWTH_PER_FLOOR = 0.25;

export function spawnMonster(floor: number, difficulty: Difficulty): { name: string; art: string; maxHp: number } {
  const template = MONSTERS[floor % MONSTERS.length];
  const floorScaling = 1 + floor * HP_GROWTH_PER_FLOOR;
  const maxHp = Math.round(template.baseHp * floorScaling * DIFFICULTY_MULTIPLIER[difficulty]);
  return { name: template.name, art: template.art, maxHp };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/monsters.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/monsters.ts test/monsters.test.ts
git commit -m "feat: add monster roster and HP scaling"
```

---

### Task 5: Profile persistence

**Files:**
- Create: `src/profile.ts`
- Test: `test/profile.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface Profile { level: number; xp: number; totalWins: number; totalBattles: number }`, `loadProfile(homeDir?: string): Promise<Profile>`, `saveProfile(profile: Profile, homeDir?: string): Promise<void>`, `levelForXp(xp: number): number`, `addXp(profile: Profile, gained: number): Profile` — consumed by Task 9 (`cli.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/profile.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProfile, saveProfile, levelForXp, addXp } from '../src/profile.ts';

test('loadProfile returns defaults when no file exists', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0 });
});

test('saveProfile then loadProfile round-trips', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await saveProfile({ level: 3, xp: 250, totalWins: 5, totalBattles: 6 }, dir);
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 3, xp: 250, totalWins: 5, totalBattles: 6 });
});

test('loadProfile falls back to defaults on corrupted JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'promptbattle-'));
  await mkdir(path.join(dir, '.promptbattle'), { recursive: true });
  await writeFile(path.join(dir, '.promptbattle', 'profile.json'), '{ not valid json', 'utf-8');
  const profile = await loadProfile(dir);
  assert.deepEqual(profile, { level: 1, xp: 0, totalWins: 0, totalBattles: 0 });
});

test('levelForXp follows a flat 100-xp-per-level curve', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(349), 4);
});

test('addXp updates both xp and level', () => {
  const updated = addXp({ level: 1, xp: 80, totalWins: 0, totalBattles: 0 }, 30);
  assert.equal(updated.xp, 110);
  assert.equal(updated.level, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/profile.test.ts`
Expected: FAIL — `src/profile.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/profile.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Profile {
  level: number;
  xp: number;
  totalWins: number;
  totalBattles: number;
}

const DEFAULT_PROFILE: Profile = { level: 1, xp: 0, totalWins: 0, totalBattles: 0 };

function profilePath(homeDir: string): string {
  return path.join(homeDir, '.promptbattle', 'profile.json');
}

export async function loadProfile(homeDir: string = os.homedir()): Promise<Profile> {
  try {
    const raw = await fs.readFile(profilePath(homeDir), 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: Profile, homeDir: string = os.homedir()): Promise<void> {
  const filePath = profilePath(homeDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
}

export function levelForXp(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function addXp(profile: Profile, gained: number): Profile {
  const xp = profile.xp + gained;
  return { ...profile, xp, level: levelForXp(xp) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/profile.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/profile.ts test/profile.test.ts
git commit -m "feat: add profile persistence and XP/level math"
```

---

### Task 6: Claude Agent SDK wrapper

**Files:**
- Create: `src/agent.ts`
- Test: `test/agent.test.ts`

**Interfaces:**
- Consumes: `query` from `@anthropic-ai/claude-agent-sdk` (installed in Task 1).
- Produces: `interface TurnResult { summary: string; filesChanged: string[]; commandsRun: string[]; error?: string }`, `extractToolInfo(message: unknown): { filesChanged: string[]; commandsRun: string[]; text: string; finalResult?: string }`, `runAgentTurn(prompt: string, cwd: string): Promise<TurnResult>` — consumed by Task 7 (`battle.ts`) and Task 9 (`cli.ts`).

- [ ] **Step 1: Confirm the installed SDK's message shape**

Run: `grep -rn "SDKAssistantMessage\|SDKResultMessage\|tool_use" node_modules/@anthropic-ai/claude-agent-sdk/**/*.d.ts 2>/dev/null | head -50`

Expected: output showing the shape of assistant messages (a `message.content` array of blocks with `type: 'tool_use' | 'text'`, tool blocks carrying `name` and `input`) and result messages (a `type: 'result'`, `subtype`, `result` string field). If the actual field names differ from the implementation below, adjust `extractToolInfo` in Step 3 to match the real types before writing the test — the test in Step 2 must describe the real shape, not a guess.

- [ ] **Step 2: Write the failing test**

```typescript
// test/agent.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractToolInfo } from '../src/agent.ts';

test('extracts a bash command from an assistant tool_use message', () => {
  const message = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] },
  };
  const info = extractToolInfo(message);
  assert.deepEqual(info.commandsRun, ['npm test']);
  assert.deepEqual(info.filesChanged, []);
});

test('extracts a changed file path from a Write or Edit tool_use message', () => {
  const writeMessage = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: '/tmp/foo.ts' } }] },
  };
  const editMessage = {
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/tmp/bar.ts' } }] },
  };
  assert.deepEqual(extractToolInfo(writeMessage).filesChanged, ['/tmp/foo.ts']);
  assert.deepEqual(extractToolInfo(editMessage).filesChanged, ['/tmp/bar.ts']);
});

test('accumulates assistant text blocks', () => {
  const message = {
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'done: ' }, { type: 'text', text: 'fixed the bug' }] },
  };
  const info = extractToolInfo(message);
  assert.equal(info.text, 'done: fixed the bug');
});

test('reads the final result string from a successful result message', () => {
  const message = { type: 'result', subtype: 'success', result: 'All tests pass.' };
  const info = extractToolInfo(message);
  assert.equal(info.finalResult, 'All tests pass.');
});

test('unknown or malformed messages extract to empty, never throw', () => {
  assert.doesNotThrow(() => extractToolInfo(null));
  assert.doesNotThrow(() => extractToolInfo({}));
  assert.doesNotThrow(() => extractToolInfo({ type: 'system' }));
  const info = extractToolInfo({ type: 'system' });
  assert.deepEqual(info.filesChanged, []);
  assert.deepEqual(info.commandsRun, []);
  assert.equal(info.text, '');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/agent.test.ts`
Expected: FAIL — `src/agent.ts` does not exist yet.

- [ ] **Step 4: Write the implementation**

```typescript
// src/agent.ts
import { query } from '@anthropic-ai/claude-agent-sdk';

export interface TurnResult {
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  error?: string;
}

export interface ExtractedInfo {
  filesChanged: string[];
  commandsRun: string[];
  text: string;
  finalResult?: string;
}

export function extractToolInfo(message: unknown): ExtractedInfo {
  const filesChanged: string[] = [];
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;

  const m = message as any;

  if (m?.type === 'assistant' && Array.isArray(m.message?.content)) {
    for (const block of m.message.content) {
      if (block?.type === 'tool_use') {
        if (block.name === 'Bash' && typeof block.input?.command === 'string') {
          commandsRun.push(block.input.command);
        }
        if ((block.name === 'Write' || block.name === 'Edit') && typeof block.input?.file_path === 'string') {
          filesChanged.push(block.input.file_path);
        }
      }
      if (block?.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }
  }

  if (m?.type === 'result' && m.subtype === 'success' && typeof m.result === 'string') {
    finalResult = m.result;
  }

  return { filesChanged, commandsRun, text, finalResult };
}

export async function runAgentTurn(prompt: string, cwd: string): Promise<TurnResult> {
  const filesChanged = new Set<string>();
  const commandsRun: string[] = [];
  let text = '';
  let finalResult: string | undefined;

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd,
        permissionMode: 'bypassPermissions',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      },
    })) {
      const info = extractToolInfo(message);
      info.filesChanged.forEach((f) => filesChanged.add(f));
      commandsRun.push(...info.commandsRun);
      text += info.text;
      if (info.finalResult) finalResult = info.finalResult;
    }
    return { summary: (finalResult ?? text).trim(), filesChanged: [...filesChanged], commandsRun };
  } catch (err) {
    return {
      summary: '',
      filesChanged: [...filesChanged],
      commandsRun,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/agent.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 6: Manual verification note (cannot be automated in this environment)**

This sandbox has no `ANTHROPIC_API_KEY`, so `runAgentTurn`'s real network path cannot be exercised here. Once installed with a real key, verify manually:

Run: `ANTHROPIC_API_KEY=sk-... node -e "import('./src/agent.ts').then(m => m.runAgentTurn('create a file named hello.txt containing the word hi', process.cwd()).then(r => console.log(JSON.stringify(r, null, 2))))"`
Expected: a `hello.txt` file appears in the current directory containing "hi", and the printed `TurnResult` has `filesChanged` including `hello.txt` and no `error` field.

- [ ] **Step 7: Commit**

```bash
git add src/agent.ts test/agent.test.ts
git commit -m "feat: wrap claude-agent-sdk query() for real coding turns"
```

---

### Task 7: Dungeon battle loop

**Files:**
- Create: `src/battle.ts`
- Test: `test/battle.test.ts`

**Interfaces:**
- Consumes: `calculateDamage` (Task 2), `renderHpBar`/`colorize` (Task 3), `spawnMonster`/`Difficulty` (Task 4), `TurnResult` (Task 6).
- Produces: `interface BattleDeps { runTurn: (prompt: string, cwd: string) => Promise<TurnResult>; readInput: () => Promise<string | null>; write: (text: string) => void; cwd: string; difficulty: Difficulty }`, `interface BattleSummary { floorsCleared: number; xpGained: number }`, `runDungeon(deps: BattleDeps): Promise<BattleSummary>` — consumed by Task 9 (`cli.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/battle.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDungeon } from '../src/battle.ts';
import type { TurnResult } from '../src/agent.ts';

const ONE_SHOT_PROMPT = 'test refactor ' + 'x'.repeat(700); // crits at 225 damage, one-shots floors 0-2

function makeFakeDeps(inputs: string[], turnResult: TurnResult = { summary: 'ok', filesChanged: [], commandsRun: [] }) {
  let i = 0;
  const written: string[] = [];
  const runTurnCalls: string[] = [];
  return {
    deps: {
      runTurn: async (prompt: string) => {
        runTurnCalls.push(prompt);
        return turnResult;
      },
      readInput: async () => (i < inputs.length ? inputs[i++] : null),
      write: (text: string) => written.push(text),
      cwd: '/fake/cwd',
      difficulty: 'normal' as const,
    },
    written,
    runTurnCalls,
  };
}

test('clears three floors with one-shot crits, then quits', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 3);
  assert.equal(summary.xpGained, 20 + 25 + 30);
  assert.equal(runTurnCalls.length, 3);
});

test('empty input is a free hesitate turn: no agent call, no damage, loop continues', async () => {
  const { deps, runTurnCalls } = makeFakeDeps(['', ONE_SHOT_PROMPT, '/quit']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
  assert.equal(runTurnCalls.length, 1);
});

test('EOF (null input) ends the run immediately with no floors cleared', async () => {
  const { deps, runTurnCalls } = makeFakeDeps([]);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 0);
  assert.equal(summary.xpGained, 0);
  assert.equal(runTurnCalls.length, 0);
});

test('/flee behaves the same as /quit', async () => {
  const { deps } = makeFakeDeps([ONE_SHOT_PROMPT, '/flee']);
  const summary = await runDungeon(deps);
  assert.equal(summary.floorsCleared, 1);
});

test('an agent turn that throws does not crash the loop and deals no bonus/penalty', async () => {
  let calls = 0;
  const deps = {
    runTurn: async () => {
      calls += 1;
      throw new Error('bash exited 1');
    },
    readInput: (() => {
      const inputs = [ONE_SHOT_PROMPT, '/quit'];
      let i = 0;
      return async () => (i < inputs.length ? inputs[i++] : null);
    })(),
    write: () => {},
    cwd: '/fake/cwd',
    difficulty: 'normal' as const,
  };
  const summary = await runDungeon(deps);
  assert.equal(calls, 1);
  assert.equal(summary.floorsCleared, 1, 'damage still applies from the prompt even though the agent call failed');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/battle.test.ts`
Expected: FAIL — `src/battle.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/battle.ts
import { calculateDamage } from './damage.ts';
import { renderHpBar, colorize } from './ui.ts';
import { spawnMonster, type Difficulty } from './monsters.ts';
import type { TurnResult } from './agent.ts';

export interface BattleDeps {
  runTurn: (prompt: string, cwd: string) => Promise<TurnResult>;
  readInput: () => Promise<string | null>;
  write: (text: string) => void;
  cwd: string;
  difficulty: Difficulty;
}

export interface BattleSummary {
  floorsCleared: number;
  xpGained: number;
}

function xpForFloor(floor: number): number {
  return 20 + floor * 5;
}

export async function runDungeon(deps: BattleDeps): Promise<BattleSummary> {
  let floor = 0;
  let floorsCleared = 0;
  let xpGained = 0;

  while (true) {
    const monster = spawnMonster(floor, deps.difficulty);
    let hp = monster.maxHp;
    deps.write(`\n${colorize(`Floor ${floor + 1}: ${monster.name} appears!`, 'bold')}\n${monster.art}\n${renderHpBar(hp, monster.maxHp)}\n`);

    let left = false;
    while (hp > 0) {
      deps.write('\n> ');
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
        deps.write(colorize('You hesitate. No attack this turn.', 'yellow') + '\n');
        continue;
      }

      const { damage, crit, matchedKeywords } = calculateDamage(prompt);
      let turn: TurnResult;
      try {
        turn = await deps.runTurn(prompt, deps.cwd);
      } catch (err) {
        turn = { summary: '', filesChanged: [], commandsRun: [], error: err instanceof Error ? err.message : String(err) };
      }

      hp = Math.max(0, hp - damage);
      const critLabel = crit ? colorize(' CRITICAL HIT!', 'red') : '';
      deps.write(`You attack for ${damage} damage!${critLabel}\n`);
      if (matchedKeywords.length > 0) {
        deps.write(`(keywords: ${matchedKeywords.join(', ')})\n`);
      }
      if (turn.error) {
        deps.write(colorize(`The spell fizzles: ${turn.error}`, 'red') + '\n');
      } else {
        if (turn.filesChanged.length > 0) deps.write(`Files changed: ${turn.filesChanged.join(', ')}\n`);
        if (turn.commandsRun.length > 0) deps.write(`Commands run: ${turn.commandsRun.join(', ')}\n`);
        if (turn.summary) deps.write(`${turn.summary}\n`);
      }
      deps.write(renderHpBar(hp, monster.maxHp) + '\n');
    }

    if (left) break;

    const gained = xpForFloor(floor);
    xpGained += gained;
    floorsCleared += 1;
    deps.write(colorize(`\n${monster.name} defeated! +${gained} XP\n`, 'green'));
    floor += 1;
  }

  return { floorsCleared, xpGained };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/battle.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/battle.ts test/battle.test.ts
git commit -m "feat: add infinite dungeon battle loop"
```

---

### Task 8: CLI argument parsing

**Files:**
- Create: `src/args.ts`
- Test: `test/args.test.ts`

**Interfaces:**
- Consumes: `type Difficulty` (Task 4).
- Produces: `parseDifficulty(argv: string[]): Difficulty` — consumed by Task 9 (`cli.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// test/args.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDifficulty } from '../src/args.ts';

test('defaults to normal with no flag', () => {
  assert.equal(parseDifficulty([]), 'normal');
});

test('reads a valid --difficulty value', () => {
  assert.equal(parseDifficulty(['--difficulty', 'hard']), 'hard');
  assert.equal(parseDifficulty(['--difficulty', 'easy']), 'easy');
});

test('falls back to normal for an unknown value', () => {
  assert.equal(parseDifficulty(['--difficulty', 'nightmare']), 'normal');
});

test('falls back to normal when --difficulty has no value', () => {
  assert.equal(parseDifficulty(['--difficulty']), 'normal');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/args.test.ts`
Expected: FAIL — `src/args.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/args.ts
import type { Difficulty } from './monsters.ts';

export function parseDifficulty(argv: string[]): Difficulty {
  const idx = argv.indexOf('--difficulty');
  if (idx === -1) return 'normal';
  const value = argv[idx + 1];
  if (value === 'easy' || value === 'normal' || value === 'hard') return value;
  return 'normal';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/args.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/args.ts test/args.test.ts
git commit -m "feat: add --difficulty CLI argument parsing"
```

---

### Task 9: CLI entrypoint, wiring, and README

**Files:**
- Create: `src/cli.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: `parseDifficulty` (Task 8), `runDungeon` (Task 7), `runAgentTurn` (Task 6), `loadProfile`/`saveProfile`/`addXp` (Task 5).
- Produces: the `promptbattle` executable.

- [ ] **Step 1: Write `src/cli.ts`**

```typescript
#!/usr/bin/env node
// src/cli.ts
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { runDungeon } from './battle.ts';
import { runAgentTurn } from './agent.ts';
import { loadProfile, saveProfile, addXp } from './profile.ts';
import { parseDifficulty } from './args.ts';
import { colorize } from './ui.ts';

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      colorize(
        'ANTHROPIC_API_KEY is not set. Get a key at https://console.anthropic.com and run:\n  export ANTHROPIC_API_KEY=sk-...',
        'red',
      ),
    );
    process.exitCode = 1;
    return;
  }

  const difficulty = parseDifficulty(process.argv.slice(2));
  const profile = await loadProfile();
  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.log(colorize(`Welcome back, level ${profile.level} adventurer. Difficulty: ${difficulty}.`, 'cyan'));

  const summary = await runDungeon({
    runTurn: runAgentTurn,
    cwd: process.cwd(),
    difficulty,
    write: (text: string) => stdout.write(text),
    readInput: async () => {
      try {
        return await rl.question('');
      } catch {
        return null;
      }
    },
  });

  rl.close();

  const updated = addXp(profile, summary.xpGained);
  updated.totalWins += summary.floorsCleared;
  updated.totalBattles += 1;
  await saveProfile(updated);

  console.log(
    colorize(
      `\nRun complete: ${summary.floorsCleared} floor(s) cleared, +${summary.xpGained} XP. Now level ${updated.level} (${updated.xp} total XP).`,
      'bold',
    ),
  );
}

main();
```

- [ ] **Step 2: Make the entrypoint executable**

Run: `chmod +x src/cli.ts`
Expected: `ls -l src/cli.ts` shows the executable bit set.

- [ ] **Step 3: Link the package locally and smoke-test the failure path**

Run: `npm link && unset ANTHROPIC_API_KEY && promptbattle`
Expected: prints the red "ANTHROPIC_API_KEY is not set" message and exits with a non-zero status — confirms the bin wiring, shebang, and native `.ts` execution all work end to end without a build step.

- [ ] **Step 4: Write `README.md`**

```markdown
# Prompt Battle

A turn-based RPG wrapped around real AI coding. Every prompt you type is an attack — longer, more specific prompts hit harder — while `promptbattle` actually reads/writes files and runs commands in your project via the Claude Agent SDK.

## Install

\`\`\`bash
git clone https://github.com/tpgusgh/prompt-engineering-is-game.git
cd prompt-engineering-is-game
npm install
npm link
\`\`\`

Requires Node.js >= 22.6.0 (uses native TypeScript execution — no build step).

## Setup

\`\`\`bash
export ANTHROPIC_API_KEY=sk-...
\`\`\`

## Play

Run `promptbattle` inside any project directory you want to work on:

\`\`\`bash
promptbattle --difficulty normal
\`\`\`

Type real coding instructions at the `>` prompt. Longer prompts, and prompts using words like "step by step", "test", "edge case", "refactor", "why", or "example", deal more damage. The agent actually performs the work in your current directory — file edits and commands are real. Type `/quit` or `/flee` to leave the dungeon; your XP and level are saved to `~/.promptbattle/profile.json`.

## Safety

`promptbattle` runs with full autonomous file/command permissions (no per-action confirmation) so a turn resolves in one shot. Only run it inside projects you trust, the same way you would with `claude --dangerously-skip-permissions`.

## Limitations (v1)

- No player HP / lose condition — the dungeon is endless until you leave.
- Ctrl+C exits immediately without saving the current run's progress; use `/quit` to save.
- No npm registry publish yet — install from the repo.
\`\`\`

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all test files pass (damage, ui, monsters, profile, agent, battle, args — 28 tests total), 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts README.md
git commit -m "feat: add CLI entrypoint and README"
```

---

## After implementation

Pushing to `https://github.com/tpgusgh/prompt-engineering-is-game.git` is a separate, explicit step outside this plan — confirm with the user before adding the remote and pushing, since it publishes the repo.
