#!/usr/bin/env node
// src/cli.ts
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { runDungeon, type BattleSummary } from './battle.ts';
import { runAgentTurn } from './agent.ts';
import { loadProfile, saveProfile, addXp } from './profile.ts';
import { parseDifficulty } from './args.ts';
import { colorize } from './ui.ts';
import { formatBattleEvent } from './cli-render.ts';

async function main(): Promise<void> {
  // No API key required: the Claude Agent SDK falls back to the local Claude
  // Code CLI's own login (an active `claude` session, e.g. a Claude
  // subscription) when ANTHROPIC_API_KEY isn't set. If that's not logged in
  // either, the first turn's agent call fails and surfaces through the
  // normal in-battle "fizzle" error path — no separate preflight needed.
  const difficulty = parseDifficulty(process.argv.slice(2));
  const profile = await loadProfile();
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const lines = rl[Symbol.asyncIterator]();

  console.log(colorize(`Welcome back, level ${profile.level} adventurer. Difficulty: ${difficulty}.`, 'cyan'));

  let summary: BattleSummary;
  try {
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
  } finally {
    rl.close();
  }

  const updated = addXp(profile, summary.xpGained);
  updated.totalWins += summary.floorsCleared;
  updated.totalBattles += summary.floorsEngaged;
  await saveProfile(updated);

  console.log(
    colorize(
      `\nRun complete: ${summary.floorsCleared} floor(s) cleared, +${summary.xpGained} XP. Now level ${updated.level} (${updated.xp} total XP).`,
      'bold',
    ),
  );
}

main().catch((err) => {
  console.error(colorize(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`, 'red'));
  process.exitCode = 1;
});
