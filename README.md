# Prompt Battle

A turn-based RPG wrapped around real AI coding. Every prompt you type is an attack — longer, more specific prompts hit harder — while `promptbattle` actually reads/writes files and runs commands in your project via the Claude Agent SDK.

## Install

```bash
git clone https://github.com/tpgusgh/prompt-engineering-is-game.git
cd prompt-engineering-is-game
npm install
npm link
```

Requires Node.js >= 22.18.0 (native TypeScript type-stripping is flag-gated below that — `--experimental-strip-types` — and this package's bin has no way to pass that flag, so older Node versions won't run it).

A real `npm install -g` of a published/tarball copy of this package will **not** work: Node refuses to type-strip `.ts` files located under `node_modules`. `npm link` from a git clone (above) is the supported install path.

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
- Ctrl+C ends the run and saves progress like `/quit` — but if it happens while the agent is mid-turn, that turn keeps running to completion first (with full file/bash permissions) before the process exits. A second Ctrl+C force-kills the process immediately without saving.
- No npm registry publish yet — install from the repo.
