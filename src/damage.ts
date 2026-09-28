export interface DamageResult {
  damage: number;
  crit: boolean;
  matchedKeywords: string[];
}

const KEYWORDS = ['step by step', 'test', 'edge case', 'refactor', 'why', 'example'];

export function calculateDamage(prompt: string): DamageResult {
  const length = prompt.length;
  const base = Math.min(150, Math.max(10, 10 + Math.floor(length / 5)));
  const lower = prompt.toLowerCase();
  const matchedKeywords = KEYWORDS.filter((keyword) => lower.includes(keyword));
  const crit = matchedKeywords.length >= 2;
  const damage = crit ? Math.round(base * 1.5) : base;
  return { damage, crit, matchedKeywords };
}
