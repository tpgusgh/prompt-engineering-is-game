import { PROMPT_CRITERIA, CRITERIA_BONUS, CRIT_AT, FULL_BONUS_AT } from '../electron/renderer/prompt-criteria.js';

export interface DamageResult {
  damage: number;
  crit: boolean;
  // The prompt criteria met (electron/renderer/prompt-criteria.js), by label.
  matchedKeywords: string[];
  // Under FULL_BONUS_AT characters: the criteria count half, no crit.
  short: boolean;
}

// Length sets a base (10 + 1 per 8 characters, up to 40); each criterion met
// adds +50%; three or more crit (x1.5). Under 50 characters the criteria
// count half and never crit.
export function calculateDamage(prompt: string): DamageResult {
  const base = Math.min(40, 10 + Math.floor(prompt.length / 8));
  const matchedKeywords = PROMPT_CRITERIA.filter((c) => c.test.test(prompt)).map((c) => c.label);
  const short = prompt.length < FULL_BONUS_AT;
  const crit = !short && matchedKeywords.length >= CRIT_AT;
  const bonus = CRITERIA_BONUS * (short ? 0.5 : 1) * matchedKeywords.length;
  const damage = Math.round(base * (1 + bonus) * (crit ? 1.5 : 1));
  return { damage, crit, matchedKeywords, short };
}
