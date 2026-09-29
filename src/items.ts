// Goods sold by the merchant goblin. Everything except the life crystal goes
// into the bag and is used with `/use <id>` as a free action (no turn spent).
export type ItemId = 'bandage' | 'potion' | 'whetstone' | 'amulet' | 'smoke' | 'crystal';

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
  { id: 'crystal', name: '생명의 결정', price: 80, description: '최대 HP +10 (영구, 즉시 적용)' },
];

export const POTION_HEAL = 40;
export const BANDAGE_HEAL = 15;
export const CRYSTAL_MAX_HP = 10;

export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}
