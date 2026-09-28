# Prompt Battle

A turn-based RPG wrapped around real AI coding. Every prompt you type is an attack — longer, more specific prompts hit harder — while `promptbattle` actually reads/writes files and runs commands in your project via the Claude Agent SDK.

## Install

```bash
git clone https://github.com/tpgusgh/prompt-engineering-is-game.git
cd prompt-engineering-is-game
npm install
npm link
```

Requires Node.js >= 22.6.0 (uses native TypeScript execution — no build step).

## Setup

```bash
export ANTHROPIC_API_KEY=sk-...
```

## Play

Run `promptbattle` inside any project directory you want to work on:

```bash
promptbattle --difficulty normal
```

Type real coding instructions at the `>` prompt. Longer prompts, and prompts using words like "step by step", "test", "edge case", "refactor", "why", or "example", deal more damage. The agent actually performs the work in your current directory — file edits and commands are real. Type `/quit` or `/flee` to leave the dungeon; your XP and level are saved to `~/.promptbattle/profile.json`.

## Safety

`promptbattle` runs with full autonomous file/command permissions (no per-action confirmation) so a turn resolves in one shot. Only run it inside projects you trust, the same way you would with `claude --dangerously-skip-permissions`.

## Limitations (v1)

- No player HP / lose condition — the dungeon is endless until you leave.
- Ctrl+C exits immediately without saving the current run's progress; use `/quit` to save.
- No npm registry publish yet — install from the repo.
