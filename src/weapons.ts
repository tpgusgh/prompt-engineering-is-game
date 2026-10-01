// A weapon is a Claude model family: a stronger model hits harder. The
// multiplier scales the prompt's damage. The family alias (haiku, sonnet,
// opus, fable) goes straight to the SDK, which picks that family's latest
// version — so no version numbers here to go stale.
export type Provider = 'claude' | 'codex';
export interface Weapon {
  model: string;
  name: string;
  flavor: string;
  multiplier: number;
  provider: Provider;
}

export const WEAPONS: Weapon[] = [
  { model: 'haiku', name: '단검', flavor: '가볍고 빠른 Haiku의 단검', multiplier: 0.8, provider: 'claude' },
  { model: 'sonnet', name: '장검', flavor: '균형 잡힌 Sonnet의 장검', multiplier: 1, provider: 'claude' },
  { model: 'opus', name: '마검', flavor: '묵직한 Opus의 마검', multiplier: 1.25, provider: 'claude' },
  { model: 'fable', name: '전설의 성검', flavor: '최강의 Fable이 깃든 성검', multiplier: 1.5, provider: 'claude' },
  // Codex (src/codex.ts): the same four tiers, each family's newest model.
  { model: 'codex:luna', name: '단검', flavor: '빠르고 가벼운 Codex Luna', multiplier: 0.8, provider: 'codex' },
  { model: 'codex:terra', name: '장검', flavor: '균형 잡힌 Codex Terra', multiplier: 1, provider: 'codex' },
  { model: 'codex:sol', name: '마검', flavor: '코딩의 일꾼 Codex Sol', multiplier: 1.25, provider: 'codex' },
  { model: 'codex:astra', name: '전설의 성검', flavor: '최전선의 Codex Astra', multiplier: 1.5, provider: 'codex' },
];

export const providerOf = (model: string | undefined): Provider => (model?.startsWith('codex:') ? 'codex' : 'claude');
// The same tier on the other AI (switching keeps how hard you hit).
const TIER: Record<string, string> = { haiku: 'codex:luna', sonnet: 'codex:terra', opus: 'codex:sol', fable: 'codex:astra' };
export const sameTierOn = (model: string, provider: Provider): string => {
  const f = modelFamily(model) ?? DEFAULT_WEAPON_ID;
  if (providerOf(f) === provider) return f;
  return provider === 'codex' ? TIER[f] : Object.keys(TIER).find((k) => TIER[k] === f)!;
};
// Class weapon names are by tier: a Codex weapon shares its Claude twin's name.
export const nameFamily = (model: string | undefined) => {
  const f = modelFamily(model);
  return f && providerOf(f) === 'codex' ? Object.keys(TIER).find((k) => TIER[k] === f) : f;
};

export const DEFAULT_WEAPON_ID = 'sonnet';

// Saves and records from before used full versioned ids ("claude-opus-5-5").
export const modelFamily = (model: string | undefined) => WEAPONS.find((w) => model === w.model || model?.includes(`-${w.model}-`))?.model;

export function getWeapon(model: string | undefined): Weapon {
  const family = modelFamily(model) ?? DEFAULT_WEAPON_ID;
  return WEAPONS.find((w) => w.model === family)!;
}
