import type { Difficulty } from './monsters.ts';

export function parseDifficulty(argv: string[]): Difficulty {
  const idx = argv.indexOf('--difficulty');
  if (idx === -1) return 'normal';
  const value = argv[idx + 1];
  if (value === 'easy' || value === 'normal' || value === 'hard') return value;
  return 'normal';
}
