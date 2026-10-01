// Goods sold by the merchant goblin (5 at a time, rotating each visit) and
// found in treasure chests. Everything but the life crystal and the coin
// charm goes into the bag and is used with `/use <id>` as a free action.
export type ItemId =
  | 'bandage' | 'potion' | 'whetstone' | 'amulet' | 'smoke' | 'crystal'
  | 'elixir' | 'bomb' | 'scroll' | 'contract' | 'devilContract' | 'coinCharm'
  | `boss-${number}`;

// Boss relics' effects: power = next attack xN, shield = block N counters,
// heal = share of max HP, blast = share of the monster's max HP (a quarter on
// bosses), xp / coins = a flat gain.
export type ItemEffect =
  | { kind: 'power'; value: number }
  | { kind: 'shield'; value: number }
  | { kind: 'heal'; value: number }
  | { kind: 'blast'; value: number }
  | { kind: 'xp'; value: number }
  | { kind: 'coins'; value: number };

export interface Item {
  id: ItemId;
  name: string;
  price: number;
  description: string;
  effect?: ItemEffect;
  boss?: number; // the area (roster) whose boss drops it
}

export const ITEMS: Item[] = [
  { id: 'bandage', name: '붕대', price: 12, description: '최대 HP의 15% 회복 (싸고 가벼운 응급처치)' },
  { id: 'potion', name: '회복 물약', price: 30, description: '최대 HP의 40% 회복' },
  { id: 'whetstone', name: '숫돌', price: 40, description: '다음 공격 피해 2배' },
  { id: 'amulet', name: '수호의 부적', price: 35, description: '몬스터의 다음 반격 1회 무효' },
  { id: 'smoke', name: '연막탄', price: 25, description: '도망 100% 성공 (보스 제외)' },
  { id: 'crystal', name: '생명의 결정', price: 80, description: '최대 HP +10% (이번 판 동안, 즉시 적용)' },
  { id: 'elixir', name: '엘릭서', price: 110, description: 'HP 완전 회복' },
  { id: 'bomb', name: '폭탄', price: 45, description: '몬스터 최대 HP의 20% 피해 (보스는 5%, 최소 30)' },
  { id: 'scroll', name: '지혜의 두루마리', price: 50, description: '경험치 +30' },
  { id: 'contract', name: '계약서', price: 120, description: '6원소신 중 하나와 무작위 계약 — 모든 타격 +5%와 신의 특성. 계약이 있으면 모두 깨지고 최대 HP 영구 -10' },
  { id: 'devilContract', name: '악마의 계약서', price: 90, description: '7대 악마 중 하나와 무작위 계약 — 서명에 최대 HP 일부를 바치고 악마의 특성. 계약이 있으면 모두 깨지고 최대 HP 영구 -10' },
  { id: 'coinCharm', name: '코인의 부적', price: 150, description: '얻는 코인 영구 +25% (단 한 번만 살 수 있다)' },
];

// One relic per area boss (roster index), dropped BOSS_DROP_CHANCE of the time;
// never sold, only found. Selling one pays half its price.
export const BOSS_DROP_CHANCE = 0.3;
const relic = (boss: number, name: string, effect: ItemEffect, description: string, price = 300): Item => ({ id: `boss-${boss}`, boss, name, effect, description, price });
export const BOSS_ITEMS: Item[] = [
  relic(0, '역린의 비늘', { kind: 'power', value: 3 }, '레거시 코드 드래곤의 비늘 — 다음 공격 피해 3배'),
  relic(1, '장애 회고록', { kind: 'shield', value: 2 }, '프로덕션 장애 타이탄의 기록 — 몬스터의 반격 2회 무효'),
  relic(2, '모놀리스 핵', { kind: 'heal', value: 0.6 }, '모놀리스 거인의 심장 — 최대 HP의 60% 회복'),
  relic(3, '리치의 이자 장부', { kind: 'coins', value: 200 }, '기술부채 리치가 모은 이자 — 코인 +200'),
  relic(4, '환각의 눈', { kind: 'blast', value: 0.3 }, 'AI 환각 키메라의 눈 — 몬스터 최대 HP의 30% 피해 (보스는 1/4)'),
  relic(5, '고대신의 유물', { kind: 'xp', value: 100 }, 'final_final_v2의 고대신이 남긴 것 — 경험치 +100'),
  relic(6, '루트 권한 열쇠', { kind: 'power', value: 2.5 }, '마왕 루트킷의 열쇠 — 다음 공격 피해 2.5배'),
  relic(7, '여왕의 알', { kind: 'shield', value: 3 }, '릴리스 전날의 버그 여왕의 알 — 반격 3회 무효'),
  relic(8, '천공의 깃털', { kind: 'heal', value: 1 }, '멀티클라우드 천공룡의 깃털 — HP 완전 회복'),
  relic(9, '심해의 진주', { kind: 'coins', value: 350 }, '데이터 레이크 리바이어던의 진주 — 코인 +350', 400),
  relic(10, '블랙홀 조각', { kind: 'blast', value: 0.4 }, 'node_modules 블랙홀의 파편 — 몬스터 최대 HP의 40% 피해 (보스는 1/4)'),
  relic(11, '포스 푸시 깃발', { kind: 'power', value: 3 }, '포스 푸시 선장의 깃발 — 다음 공격 피해 3배'),
  relic(12, 'LGTM 도장', { kind: 'xp', value: 150 }, '전지적 코드리뷰어의 승인 도장 — 경험치 +150'),
  relic(13, '악마 브로커의 인장', { kind: 'shield', value: 3 }, '다크웹 브로커 대악마의 인장 — 반격 3회 무효'),
  relic(14, 'sudo 왕관', { kind: 'power', value: 4 }, '루트 권한의 마황제의 왕관 — 다음 공격 피해 4배', 400),
  relic(15, '용암 심장', { kind: 'blast', value: 0.5 }, '빌드 40분 화산룡의 심장 — 몬스터 최대 HP의 50% 피해 (보스는 1/4)', 400),
  relic(16, '버그신의 눈물', { kind: 'heal', value: 1 }, '프로덕션에서만 터지는 버그신의 눈물 — HP 완전 회복', 400),
];
export const bossItemFor = (roster: number) => BOSS_ITEMS.find((i) => i.boss === roster);

export const SHOP_SIZE = 4;
// How many of each the merchant sells you per visit.
export const MERCHANT_LIMIT: Partial<Record<ItemId, number>> = {
  bandage: 5, potion: 3, bomb: 3, whetstone: 2, amulet: 2, smoke: 2, scroll: 2,
  crystal: 1, elixir: 1, contract: 1, devilContract: 1, coinCharm: 1,
};
export const merchantLimit = (id: ItemId) => MERCHANT_LIMIT[id] ?? 1;

// 야시장: a rare stall of NIGHT_MARKET_SIZE different goods — boss relics and
// contracts included — each 30-70% off today's price, one of each.
export const NIGHT_MARKET_SIZE = 4;
export type NightGood = Item & { original: number; discount: number };
export function nightMarketOffer(floor: number, random: () => number): NightGood[] {
  const pool = [...ITEMS.filter((i) => i.id !== 'coinCharm'), ...BOSS_ITEMS];
  const picks: NightGood[] = [];
  while (picks.length < NIGHT_MARKET_SIZE && pool.length) {
    const [item] = pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1);
    const discount = Math.round((0.3 + random() * 0.4) * 20) / 20; // 5% steps
    const original = priceAt(item, floor);
    picks.push({ ...item, original, discount, price: Math.round(original * (1 - discount)) });
  }
  return picks;
}

// Prices climb with depth: +PRICE_GROWTH per floor (floor 10 = double).
export const PRICE_GROWTH = 0.1;
export const priceMultiplier = (floor: number) => Math.round((1 + PRICE_GROWTH * Math.max(0, floor)) * 100) / 100;
export const priceAt = (item: Item, floor: number) => Math.round(item.price * priceMultiplier(floor));
// What the merchant pays for an item from the bag: half today's price.
export const sellPrice = (item: Item, floor = 0) => Math.floor(priceAt(item, floor) / 2);
export const COIN_CHARM_BONUS = 1.25;
export const BOMB_DAMAGE = 30; // the floor: early monsters
export const BOMB_RATIO = 0.2; // of the monster's max HP, so bombs keep up with deep floors
export const BOMB_BOSS_RATIO = 0.05; // bosses shrug most of it off
export const bombDamage = (monsterMaxHp: number, isBoss = false) =>
  Math.max(BOMB_DAMAGE, Math.round(monsterMaxHp * (isBoss ? BOMB_BOSS_RATIO : BOMB_RATIO)));
export const SCROLL_XP = 30;

// The merchant's shelf on a visit: SHOP_SIZE items, rotating through the
// stock visit by visit; owned relics (the coin charm) aren't sold again.
// Contracts are off the rotation: rare, CONTRACT_SHOP_CHANCE a visit for one
// (god or devil, even odds) on the last slot.
export const CONTRACT_SHOP_CHANCE = 0.1;
const CONTRACT_IDS = ['contract', 'devilContract'];
export function shopOffer(visit: number, relics: string[], random: () => number = Math.random): Item[] {
  const stock = ITEMS.filter((i) => !relics.includes(i.id) && !CONTRACT_IDS.includes(i.id));
  const start = (visit * SHOP_SIZE) % stock.length;
  const shelf = Array.from({ length: Math.min(SHOP_SIZE, stock.length) }, (_, k) => stock[(start + k) % stock.length]);
  if (random() < CONTRACT_SHOP_CHANCE) shelf[shelf.length - 1] = getItem(random() < 0.5 ? 'contract' : 'devilContract')!;
  return shelf;
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

// Heals, as a share of max HP (so they keep up with vitality and crystals).
export const POTION_HEAL = 0.4;
export const BANDAGE_HEAL = 0.15;
export const CRYSTAL_MAX_HP = 0.1; // of the current max HP

export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id) ?? BOSS_ITEMS.find((item) => item.id === id);
}
