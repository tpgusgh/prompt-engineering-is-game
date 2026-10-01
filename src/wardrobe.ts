// 꾸미기: cosmetics bought with the profile's coins (from achievements and
// finished adventures) and worn on the hero's avatar. Items, slots and prices
// come from electron/renderer/avatar/catalog.json (scripts/build-avatar.mjs).
import type { Profile } from './profile.ts';

export interface CosmeticItem {
  id: string; // "hair/hair_afro_black"
  slot: string;
  price: number;
}
export type Avatar = Record<string, string>;
export const OPTIONAL_SLOTS = new Set(['hat', 'face', 'weapon', 'pet', 'socks', 'shoes']);
const ID = /^[a-z]+\/[a-z0-9_]+$/;

const owns = (profile: Profile, item: CosmeticItem) => item.price === 0 || (profile.wardrobe ?? []).includes(item.id);

export function buyCosmetic(profile: Profile, catalog: CosmeticItem[], id: string): { profile: Profile } | { error: string } {
  const item = catalog.find((i) => i.id === id);
  if (!item) return { error: '그런 물건은 없다' };
  if (owns(profile, item)) return { error: '이미 가지고 있다' };
  if (profile.coins < item.price) return { error: `코인이 부족하다 (${item.price} 필요)` };
  return { profile: { ...profile, coins: profile.coins - item.price, wardrobe: [...(profile.wardrobe ?? []), item.id] } };
}

// Wear an owned (or free) item; null takes an optional slot off.
export function wearCosmetic(profile: Profile, catalog: CosmeticItem[], slot: string, id: string | null): { profile: Profile } | { error: string } {
  const avatar = { ...(profile.avatar ?? {}) };
  if (id === null) {
    if (!OPTIONAL_SLOTS.has(slot)) return { error: '이 칸은 비울 수 없다' };
    delete avatar[slot];
    return { profile: { ...profile, avatar } };
  }
  const item = catalog.find((i) => i.id === id);
  if (!item || item.slot !== slot) return { error: '그런 물건은 없다' };
  if (!owns(profile, item)) return { error: '먼저 사야 한다' };
  avatar[slot] = id;
  return { profile: { ...profile, avatar } };
}

// What the ranking server keeps of a look: just valid slot → id pairs.
export function cleanAvatar(v: unknown): Avatar {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Avatar = {};
  for (const [slot, id] of Object.entries(v as Record<string, unknown>).slice(0, 12)) {
    if (/^[a-z]{2,8}$/.test(slot) && typeof id === 'string' && id.length <= 64 && ID.test(id)) out[slot] = id;
  }
  return out;
}
