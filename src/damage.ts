import { PROMPT_CRITERIA, CRITERIA_BONUS, CRIT_AT } from '../electron/renderer/prompt-criteria.js';

export interface DamageResult {
  damage: number;
  crit: boolean;
  // The prompt criteria met (electron/renderer/prompt-criteria.js), by label.
  matchedKeywords: string[];
}

// Length sets a base (10 + 1 per 8 characters, up to 40); each criterion met
// adds +50%; three or more crit (x1.5).
export function calculateDamage(prompt: string): DamageResult {
  const base = Math.min(40, 10 + Math.floor(prompt.length / 8));
  const matchedKeywords = PROMPT_CRITERIA.filter((c) => c.test.test(prompt)).map((c) => c.label);
  const crit = matchedKeywords.length >= CRIT_AT;
  const damage = Math.round(base * (1 + CRITERIA_BONUS * matchedKeywords.length) * (crit ? 1.5 : 1));
  return { damage, crit, matchedKeywords };
}
