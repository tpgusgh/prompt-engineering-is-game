// A weapon is a Claude model family: a stronger model hits harder. The
// multiplier scales the prompt's damage. The family alias (haiku, sonnet,
// opus, fable) goes straight to the SDK, which picks that family's latest
// version — so no version numbers here to go stale.
export type Provider = 'claude' | 'codex' | 'grok' | 'gemini';
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
  // Grok (src/grok.ts): grok-4.6 fills the two light tiers, grok-4.7 the two heavy ones. Effort is the weapon.
  { model: 'grok:spark', name: '단검', flavor: '가벼운 Grok 4.6 · 낮은 effort', multiplier: 0.8, provider: 'grok' },
  { model: 'grok:kindle', name: '장검', flavor: 'Grok 4.6 · 높은 effort', multiplier: 1, provider: 'grok' },
  { model: 'grok:flare', name: '마검', flavor: 'Grok 4.7 · 보통 effort', multiplier: 1.25, provider: 'grok' },
  { model: 'grok:nova', name: '전설의 성검', flavor: 'Grok 4.7 · 높은 effort', multiplier: 1.5, provider: 'grok' },
  // Gemini (src/gemini.ts): the CLI's model aliases, each its newest model.
  { model: 'gemini:flash-lite', name: '단검', flavor: '가볍고 빠른 Gemini Flash-Lite', multiplier: 0.8, provider: 'gemini' },
  { model: 'gemini:flash', name: '장검', flavor: '균형 잡힌 Gemini Flash', multiplier: 1, provider: 'gemini' },
  { model: 'gemini:auto', name: '마검', flavor: 'Gemini Auto · 필요할 때 Pro', multiplier: 1.25, provider: 'gemini' },
  { model: 'gemini:pro', name: '전설의 성검', flavor: '가장 강한 Gemini Pro', multiplier: 1.5, provider: 'gemini' },
];

const TIERS: Record<Provider, readonly string[]> = {
  claude: ['haiku', 'sonnet', 'opus', 'fable'],
  codex: ['codex:luna', 'codex:terra', 'codex:sol', 'codex:astra'],
  grok: ['grok:spark', 'grok:kindle', 'grok:flare', 'grok:nova'],
  gemini: ['gemini:flash-lite', 'gemini:flash', 'gemini:auto', 'gemini:pro'],
};

export const providerOf = (model: string | undefined): Provider =>
  model?.startsWith('gemini:') ? 'gemini' : model?.startsWith('grok:') ? 'grok' : model?.startsWith('codex:') ? 'codex' : 'claude';

export function tierIndex(model: string | undefined): number {
  const family = modelFamily(model) ?? DEFAULT_WEAPON_ID;
  for (const list of Object.values(TIERS)) {
    const index = list.indexOf(family);
    if (index >= 0) return index;
  }
  return TIERS.claude.indexOf(DEFAULT_WEAPON_ID);
}

// The same tier on another AI (switching keeps how hard you hit).
export const sameTierOn = (model: string, provider: Provider): string => TIERS[provider][tierIndex(model)] ?? DEFAULT_WEAPON_ID;
// Class weapon names are by tier: Codex and Grok share their Claude twin's name.
export const nameFamily = (model: string | undefined) => TIERS.claude[tierIndex(model)];

export const DEFAULT_WEAPON_ID = 'sonnet';

// Saves and records from before used full versioned ids ("claude-opus-5-5").
export const modelFamily = (model: string | undefined) => WEAPONS.find((w) => model === w.model || model?.includes(`-${w.model}-`))?.model;

export function getWeapon(model: string | undefined): Weapon {
  const family = modelFamily(model) ?? DEFAULT_WEAPON_ID;
  return WEAPONS.find((w) => w.model === family)!;
}
