// The blacksmith's sword enhancement (+N강). Each try costs coins; the higher
// the level, the lower the success chance, and from +3 a failure may break
// the sword back to +0.
export const SWORD_MAX_LEVEL = 10;

export interface EnhanceOdds {
  cost: number;
  successChance: number;
  // Chance, given a failure, that the sword breaks.
  breakChance: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function enhanceOdds(level: number): EnhanceOdds {
  return {
    cost: 20 + level * 15,
    successChance: round2(Math.max(0.1, 0.95 - level * 0.09)),
    breakChance: level < 3 ? 0 : round2(Math.min(0.5, 0.05 * (level - 1))),
  };
}

export function swordMultiplier(level: number): number {
  return round2(1 + level * 0.1);
}
