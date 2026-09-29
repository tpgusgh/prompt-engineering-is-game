export type Difficulty = 'easy' | 'normal' | 'hard';

interface MonsterTemplate {
  name: string;
  art: string;
  baseHp: number;
}

const MONSTERS: MonsterTemplate[] = [
  { name: '버그 고블린', art: '  (o_o)\n  <)  )╯\n  /   \\', baseHp: 60 },
  { name: '타입 에러 슬라임', art: '  .-\'\'-.\n (  ~~  )\n  `-..-`', baseHp: 80 },
  { name: '널 포인터 레이스', art: '  ,---.\n ( 0 0 )\n  `-v-`  undefined', baseHp: 100 },
  { name: '경쟁 상태 팬텀', art: '  <o><o>\n ~~~~~~~~ (blinking)', baseHp: 130 },
  { name: '머지 컨플릭트 히드라', art: '  <<<<<<<\n  =======\n  >>>>>>>', baseHp: 160 },
  { name: '레거시 코드 드래곤', art: '  /^^^^^\\\n <( o o )>\n  \\_===_/', baseHp: 220 },
];

// One chapter = one full cycle through the roster; its last floor (the
// dragon) is the chapter boss.
export const MONSTER_COUNT = MONSTERS.length;

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
