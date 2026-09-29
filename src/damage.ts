export interface DamageResult {
  damage: number;
  crit: boolean;
  matchedKeywords: string[];
}

// Each group counts once toward crit; the first form found is reported.
const KEYWORD_GROUPS = [
  ['step by step', '단계별', '차근차근', '순서대로', '하나씩'],
  ['test', '테스트', '검증'],
  ['edge case', '엣지 케이스', '엣지케이스', '예외 상황', '예외 케이스', '경계값'],
  ['refactor', '리팩토링', '리팩터링', '리팩터'],
  ['why', '왜', '이유'],
  ['example', '예시', '예제'],
];

export function calculateDamage(prompt: string): DamageResult {
  const length = prompt.length;
  const base = Math.min(150, Math.max(10, 10 + Math.floor(length / 5)));
  const lower = prompt.toLowerCase();
  const matchedKeywords = KEYWORD_GROUPS
    .map((group) => group.find((keyword) => lower.includes(keyword)))
    .filter((keyword): keyword is string => keyword !== undefined);
  const crit = matchedKeywords.length >= 2;
  const damage = crit ? Math.round(base * 1.5) : base;
  return { damage, crit, matchedKeywords };
}
