// A weapon is a Claude model family: a stronger model hits harder. The
// multiplier scales the prompt's damage. The family alias (haiku, sonnet,
// opus, fable) goes straight to the SDK, which picks that family's latest
// version — so no version numbers here to go stale.
export interface Weapon {
  model: string;
  name: string;
  flavor: string;
  multiplier: number;
}

export const WEAPONS: Weapon[] = [
  { model: 'haiku', name: '단검', flavor: '가볍고 빠른 Haiku의 단검', multiplier: 0.8 },
  { model: 'sonnet', name: '장검', flavor: '균형 잡힌 Sonnet의 장검', multiplier: 1 },
  { model: 'opus', name: '마검', flavor: '묵직한 Opus의 마검', multiplier: 1.25 },
  { model: 'fable', name: '전설의 성검', flavor: '최강의 Fable이 깃든 성검', multiplier: 1.5 },
];

export const DEFAULT_WEAPON_ID = 'sonnet';

// Saves and records from before used full versioned ids ("claude-opus-5-5").
export const modelFamily = (model: string | undefined) => WEAPONS.find((w) => model === w.model || model?.includes(`-${w.model}-`))?.model;

export function getWeapon(model: string | undefined): Weapon {
  const family = modelFamily(model) ?? DEFAULT_WEAPON_ID;
  return WEAPONS.find((w) => w.model === family)!;
}
