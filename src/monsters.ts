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
