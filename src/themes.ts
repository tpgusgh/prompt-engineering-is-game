// What makes each story theme play differently: which monster rosters its
// chapters use (in order, then repeating — each theme has one roster of its
// own), and a rule set. The story text itself lives in the renderer
// (electron/renderer/story.js).

export interface ThemeRules {
  id: string;
  // Roster index per chapter (see ROSTERS in src/monsters.ts).
  rosters: number[];
  // Merchant / blacksmith appearance multiplier.
  shopChance: number;
  bossHp: number; // extra boss HP multiplier
  rewards: number; // coins and XP multiplier
  testBonus: number; // closing blow multiplier on a turn whose tests passed
  failCounter: number; // counterattack multiplier after a turn with a failed tool call
  perks: string[]; // shown when the theme is picked
  stars: number; // how hard the theme is, 1..3
}

const BASE = { shopChance: 1, bossHp: 1, rewards: 1, testBonus: 1, failCounter: 1 };

export const THEME_RULES: ThemeRules[] = [
  {
    id: 'adventure',
    rosters: [0, 1, 5, 2, 3, 4, 8, 11, 9, 12, 10],
    ...BASE,
    shopChance: 1.5,
    stars: 1,
    perks: ['균형 잡힌 모험: 모든 구역을 차례로 돈다', '상인과 대장장이가 1.5배 자주 나타난다', '전용 구역: 고대 신전 · 잊힌 해적섬 · 하늘섬 도서관'],
  },
  {
    id: 'demon-king',
    rosters: [6, 1, 3, 4, 2, 13, 8, 14, 9, 10],
    ...BASE,
    bossHp: 1.3,
    rewards: 1.5,
    stars: 3,
    perks: ['첫 챕터부터 마왕군과 싸운다', '보스 HP +30%', '코인과 경험치 1.5배', '전용 구역: 마왕군 · 마왕군 정예 · 마계 서버실'],
  },
  {
    id: 'debug-quest',
    rosters: [0, 7, 3, 4, 1, 15, 8, 9, 16, 10],
    ...BASE,
    testBonus: 1.25,
    failCounter: 1.2,
    stars: 2,
    perks: ['버그 계열 몬스터 위주', '테스트가 통과한 턴은 마무리 일격 +25%', '작업이 실패한 턴은 반격 +20%', '전용 구역: 벌레 굴 · 컴파일 화산 · 테스트 늪'],
  },
];

export const DEFAULT_THEME_ID = 'adventure';

// No theme (the CLI, older saves): the first theme's rosters, no bonuses.
const NEUTRAL: ThemeRules = { ...THEME_RULES[0], ...BASE, id: 'none', perks: [], stars: 1 };

export function themeRules(themeId: string | undefined): ThemeRules {
  return THEME_RULES.find((t) => t.id === themeId) ?? NEUTRAL;
}

// Roster for a chapter (1-based) of a theme.
export function rosterFor(themeId: string | undefined, chapter: number): number {
  const { rosters } = themeRules(themeId);
  return rosters[(chapter - 1) % rosters.length];
}
