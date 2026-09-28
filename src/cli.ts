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
