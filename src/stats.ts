import type { Profile } from './profile.ts';

// Permanent upgrades bought with coins between runs (setup screen).
export type StatId = 'attack' | 'defense' | 'vitality';
export type Stats = Record<StatId, number>;

export interface StatDef {
  id: StatId;
  name: string;
  effect: string;
  maxLevel: number;
  baseCost: number;
}

export const STATS: StatDef[] = [
  { id: 'attack', name: '공격력', effect: '레벨당 피해 +10%', maxLevel: 10, baseCost: 50 },
  { id: 'defense', name: '방어력', effect: '레벨당 받는 반격 -10%', maxLevel: 5, baseCost: 40 },
  { id: 'vitality', name: '체력', effect: '레벨당 최대 HP +10', maxLevel: 10, baseCost: 30 },
];

export const EMPTY_STATS: Stats = { attack: 0, defense: 0, vitality: 0 };
const VITALITY_HP = 10;

function def(id: StatId): StatDef {
  return STATS.find((s) => s.id === id)!;
}

export function upgradeCost(id: StatId, currentLevel: number): number {
  return def(id).baseCost * (currentLevel + 1);
}

export function upgradeStat(
  profile: Profile,
  id: StatId,
): { ok: true; profile: Profile } | { ok: false; reason: string } {
  const stat = STATS.find((s) => s.id === id);
  if (!stat) return { ok: false, reason: '그런 능력치는 없다' };
  const level = profile.stats[id];
  if (level >= stat.maxLevel) return { ok: false, reason: `${stat.name}은(는) 이미 최대 레벨이다` };
  const cost = upgradeCost(id, level);
  if (profile.coins < cost) return { ok: false, reason: `코인이 부족하다 (${cost} 필요)` };
  return {
    ok: true,
    profile: {
      ...profile,
      coins: profile.coins - cost,
      stats: { ...profile.stats, [id]: level + 1 },
      maxHp: id === 'vitality' ? profile.maxHp + VITALITY_HP : profile.maxHp,
    },
  };
}

export function attackMultiplier(stats: Stats): number {
  return Math.round((1 + stats.attack * 0.1) * 100) / 100;
}

export function defenseReduction(stats: Stats): number {
  return Math.min(0.5, Math.round(stats.defense * 0.1 * 100) / 100);
}
