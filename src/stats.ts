// Stats rise for free: every monster defeated grants one point, spent with
// `/stat <id>` (a free action). Each stat caps at STAT_MAX_LEVEL.
export type StatId = 'attack' | 'defense' | 'vitality';
export type Stats = Record<StatId, number>;

export interface StatDef {
  id: StatId;
  name: string;
  effect: string;
}

export const STAT_MAX_LEVEL = 10;
export const VITALITY_RATE = 0.1; // of the current max HP, so it compounds

export const STATS: StatDef[] = [
  { id: 'attack', name: '공격력', effect: '레벨당 피해 +10%' },
  { id: 'defense', name: '방어력', effect: '레벨당 받는 반격 -5%' },
  { id: 'vitality', name: '체력', effect: '레벨당 최대 HP +10%' },
];

export const EMPTY_STATS: Stats = { attack: 0, defense: 0, vitality: 0 };

export function isStatId(id: string): id is StatId {
  return STATS.some((s) => s.id === id);
}

// The raised stats, or null when the stat is already maxed.
export function raiseStat(stats: Stats, id: StatId): Stats | null {
  return stats[id] >= STAT_MAX_LEVEL ? null : { ...stats, [id]: stats[id] + 1 };
}

export function allMaxed(stats: Stats): boolean {
  return STATS.every((s) => stats[s.id] >= STAT_MAX_LEVEL);
}

export function attackMultiplier(stats: Stats): number {
  return Math.round((1 + stats.attack * 0.1) * 100) / 100;
}

export function defenseReduction(stats: Stats): number {
  return Math.round(stats.defense * 0.05 * 100) / 100;
}
