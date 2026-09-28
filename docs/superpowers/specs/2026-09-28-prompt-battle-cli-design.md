# Prompt Battle CLI — Design Spec

Date: 2026-09-28
Repo: https://github.com/tpgusgh/prompt-engineering-is-game

## Purpose

An installable CLI tool that replaces day-to-day use of `claude` CLI for coding tasks, wrapped in a turn-based RPG. Each prompt the user types is an "attack": longer/better prompts hit harder. The coding work is real — the agent actually reads/writes files and runs commands in the current project via the Claude Agent SDK. The RPG layer (HP bars, monsters, damage numbers, floors) is flavor on top of real dev work, not a separate simulation.

Success criteria: `npm install -g` (or `npm link`) the package, run `promptbattle` in any project directory, type a real coding instruction, watch a monster take damage while the SDK actually edits files / runs commands, keep fighting an endless dungeon until `/quit`.

## Architecture

Node.js + TypeScript CLI, single package, no server, no DB.

Real coding execution: `@anthropic-ai/claude-agent-sdk` (`query()`), which already provides file read/write/edit and bash-execution tools plus streaming. The game layer is a thin wrapper around it — it does not reimplement agentic tooling.

Requires `ANTHROPIC_API_KEY` in the environment. Checked at startup, fails fast with a clear message if missing.

## Components

- `src/cli.ts` — entrypoint (bin `promptbattle`). Parses `--difficulty <easy|normal|hard>` (default normal). Checks for API key, then starts `runDungeon()`.
- `src/damage.ts` — pure function, no I/O:
  ```ts
  function calculateDamage(prompt: string): { damage: number; crit: boolean; matchedKeywords: string[] }
  ```
  - `base = 10 + floor(promptLength / 5)`, clamped to `[10, 150]`
  - keyword set (case-insensitive substring match): `step by step`, `test`, `edge case`, `refactor`, `why`, `example` — each matched keyword recorded in `matchedKeywords`
  - `crit = matchedKeywords.length >= 2`, crit multiplies final damage by `1.5` (applied after clamp)
- `src/agent.ts` — wraps SDK `query()` for the current working directory. Streams tool-use events (file edits, bash commands) and returns `{ summary: string, filesChanged: string[], commandsRun: string[], error?: string }`.
- `src/monsters.ts` — fixed bug-themed monster list with ASCII art + base HP, e.g. Bug Goblin, Null Pointer Wraith, Legacy Code Dragon, Type Error Slime, Race Condition Phantom, Merge Conflict Hydra. Floor N picks `monsters[N % monsters.length]` (or similar), HP scales with floor: `hp = baseHp + floor * scalingFactor`.
- `src/battle.ts` — the dungeon loop:
  1. Enter floor N → spawn monster (HP scaled to floor + difficulty multiplier)
  2. Render monster ASCII art + colored HP bar
  3. Prompt user for input (`>`); `/quit` or `/flee` ends the run
  4. `calculateDamage(prompt)` for the number; in parallel, `agent.ts` actually runs the prompt against the real project
  5. Render combat log (damage number, crit flag, files changed / commands run from the agent result); on agent error, render a "miss/fizzle" line with the real error text — HP unaffected, loop continues
  6. Subtract damage from monster HP; if HP ≤ 0 → victory flavor, XP awarded, advance to floor N+1
  7. Loop until `/quit`/`/flee`, then print run summary (floors cleared, total XP) and persist
- `src/profile.ts` — load/save `~/.promptbattle/profile.json`: `{ level, xp, totalWins, totalBattles }`. Simple XP→level curve (e.g. `level = floor(xp / 100) + 1`).
- `src/ui.ts` — ANSI helpers only (raw escape codes, no dependency): colored text, HP bar renderer (`[███████---] 70/100`).

## Data flow

```
user prompt text
   ├─→ damage.ts (calculateDamage)         → damage number, crit
   └─→ agent.ts  (real SDK query on cwd)   → real file/command changes + summary
                     ↓
              battle.ts merges both into one turn render
                     ↓
              monster HP -= damage → floor cleared? → next monster
                     ↓ (on /quit)
              profile.ts persists XP/level, prints run summary
```

No coupling between "did the AI actually fix the bug" and damage dealt — damage is purely prompt-shape-based, by design (this is the core rule the user asked for). The real agent execution is genuine dev work happening alongside the game, not gated by it.

## Error handling

- Missing `ANTHROPIC_API_KEY` → fail fast before any battle starts, print setup instructions.
- Agent turn throws (bad bash command, API error, rate limit) → caught in `battle.ts`, shown as a flavored miss + the real error text, monster HP unchanged, loop continues (never crashes the run).
- Malformed/empty prompt (just hits enter) → treated as a 0-damage "hesitate" turn, no agent call made.

## Persistence

`~/.promptbattle/profile.json`, created on first win if missing. Example shape:
```json
{ "level": 3, "xp": 240, "totalWins": 12, "totalBattles": 14 }
```
No player HP / no lose condition (not requested — YAGNI).

## Distribution

`package.json` with `"bin": { "promptbattle": "./dist/cli.js" }`. README covers `npm install` + `npm link` (or global install) for local use, and `ANTHROPIC_API_KEY` setup. Publishing to the npm registry is out of scope for v1 — repo install only.

## Testing

`node:test` + `node:assert`, zero test-framework dependency. Single `test/damage.test.ts` covering `calculateDamage`: length scaling, clamp bounds, crit threshold. This is the only non-trivial pure logic in the system; everything else is thin I/O orchestration around the SDK.

## Out of scope for v1 (explicitly deferred)

- Player HP / lose condition
- Fixed-length dungeons, difficulty curves beyond a flat multiplier
- npm registry publish
- Multiplayer / leaderboards
- Non-ASCII/graphical UI (TUI framework like Ink/blessed)
