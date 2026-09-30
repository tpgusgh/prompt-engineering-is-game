// Goods sold by the merchant goblin (5 at a time, rotating each visit) and
// found in treasure chests. Everything but the life crystal and the coin
// charm goes into the bag and is used with `/use <id>` as a free action.
export type ItemId =
  | 'bandage' | 'potion' | 'whetstone' | 'amulet' | 'smoke' | 'crystal'
  | 'elixir' | 'bomb' | 'scroll' | 'contract' | 'devilContract' | 'coinCharm';

export interface Item {
  id: ItemId;
  name: string;
  price: number;
  description: string;
}

export const ITEMS: Item[] = [
  { id: 'bandage', name: '붕대', price: 12, description: 'HP 15 회복 (싸고 가벼운 응급처치)' },
  { id: 'potion', name: '회복 물약', price: 30, description: 'HP 40 회복' },
  { id: 'whetstone', name: '숫돌', price: 40, description: '다음 공격 피해 2배' },
  { id: 'amulet', name: '수호의 부적', price: 35, description: '몬스터의 다음 반격 1회 무효' },
  { id: 'smoke', name: '연막탄', price: 25, description: '도망 100% 성공 (보스 제외)' },
  { id: 'crystal', name: '생명의 결정', price: 80, description: '최대 HP +10 (이번 판 동안, 즉시 적용)' },
  { id: 'elixir', name: '엘릭서', price: 70, description: 'HP 완전 회복' },
  { id: 'bomb', name: '폭탄', price: 45, description: '몬스터 최대 HP의 20% 피해 (보스는 5%, 최소 30)' },
  { id: 'scroll', name: '지혜의 두루마리', price: 50, description: '경험치 +30' },
  { id: 'contract', name: '계약서', price: 120, description: '6원소신 중 하나와 무작위 계약 — 모든 타격 +1과 신의 특성. 계약이 있으면 모두 깨지고 최대 HP 영구 -10' },
  { id: 'devilContract', name: '악마의 계약서', price: 90, description: '7대 악마 중 하나와 무작위 계약 — 서명에 최대 HP 일부를 바치고 악마의 특성. 계약이 있으면 모두 깨지고 최대 HP 영구 -10' },
  { id: 'coinCharm', name: '코인의 부적', price: 150, description: '얻는 코인 영구 +25% (단 한 번만 살 수 있다)' },
];

export const SHOP_SIZE = 5;

// What the merchant pays for an item from the bag.
export const sellPrice = (item: Item) => Math.floor(item.price / 2);
export const COIN_CHARM_BONUS = 1.25;
export const BOMB_DAMAGE = 30; // the floor: early monsters
export const BOMB_RATIO = 0.2; // of the monster's max HP, so bombs keep up with deep floors
export const BOMB_BOSS_RATIO = 0.05; // bosses shrug most of it off
export const bombDamage = (monsterMaxHp: number, isBoss = false) =>
  Math.max(BOMB_DAMAGE, Math.round(monsterMaxHp * (isBoss ? BOMB_BOSS_RATIO : BOMB_RATIO)));
export const SCROLL_XP = 30;

// The merchant's shelf on a visit: SHOP_SIZE items, rotating through the
// stock visit by visit; owned relics (the coin charm) aren't sold again.
export function shopOffer(visit: number, relics: string[]): Item[] {
  const stock = ITEMS.filter((i) => !relics.includes(i.id));
  const start = (visit * SHOP_SIZE) % stock.length;
  return Array.from({ length: Math.min(SHOP_SIZE, stock.length) }, (_, k) => stock[(start + k) % stock.length]);
}

// Chest loot: coins always; an item only by chance, better chests more often
// and from a better table.
const DROP_CHANCE = { wood: 0.05, iron: 0.15, silver: 0.3, gold: 0.5, platinum: 0.6, diamond: 0.7, legend: 0.8, mythic: 0.95 } as const;
const DROP_TABLE: Record<keyof typeof DROP_CHANCE, ItemId[]> = {
  wood: ['bandage'],
  iron: ['bandage', 'smoke', 'bomb'],
  silver: ['potion', 'bomb', 'scroll', 'whetstone'],
  gold: ['whetstone', 'amulet', 'elixir', 'scroll', 'contract', 'devilContract'],
  platinum: ['elixir', 'amulet', 'scroll', 'contract', 'devilContract'],
  diamond: ['elixir', 'crystal', 'contract', 'devilContract'],
  legend: ['elixir', 'crystal', 'contract', 'devilContract', 'amulet'],
  mythic: ['crystal', 'elixir', 'contract', 'devilContract'],
};
export function rollChestItem(grade: keyof typeof DROP_CHANCE, random: () => number): Item | null {
  if (random() >= DROP_CHANCE[grade]) return null;
  const table = DROP_TABLE[grade];
  return getItem(table[Math.min(table.length - 1, Math.floor(random() * table.length))]) ?? null;
}

export const POTION_HEAL = 40;
export const BANDAGE_HEAL = 15;
export const CRYSTAL_MAX_HP = 10;

export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}
