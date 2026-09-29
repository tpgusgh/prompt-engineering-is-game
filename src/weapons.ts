// A weapon is a Claude model: a stronger model hits harder. The multiplier
// scales the prompt's damage; the model id is passed straight to the SDK.
export interface Weapon {
  model: string;
  name: string;
  flavor: string;
  multiplier: number;
}

export const WEAPONS: Weapon[] = [
  { model: 'claude-haiku-4-5-20251001', name: '단검', flavor: '가볍고 빠른 Haiku의 단검', multiplier: 0.8 },
  { model: 'claude-sonnet-5', name: '장검', flavor: '균형 잡힌 Sonnet의 장검', multiplier: 1 },
  { model: 'claude-opus-5-5', name: '마검', flavor: '묵직한 Opus의 마검', multiplier: 1.25 },
  { model: 'claude-fable-5-1', name: '전설의 성검', flavor: '최강의 Fable이 깃든 성검', multiplier: 1.5 },
];

export const DEFAULT_WEAPON_ID = 'claude-sonnet-5';

export function getWeapon(model: string | undefined): Weapon {
  return WEAPONS.find((w) => w.model === model) ?? WEAPONS.find((w) => w.model === DEFAULT_WEAPON_ID)!;
}
