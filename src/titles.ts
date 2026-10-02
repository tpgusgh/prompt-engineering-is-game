// 칭호 상점: buy titles with the profile's coins and wear one; the worn one
// (profile.badge) is shown in the ranking instead of the level title.
// The list lives in electron/renderer/title-shop.js.
import type { Profile } from './profile.ts';

export interface ShopTitle {
  id: string;
  price: number;
  requires?: string; // an achievement id
}
export const BADGE_ID = /^[a-z0-9-]{1,24}$/;

export function buyTitle(profile: Profile, shop: ShopTitle[], id: string): { profile: Profile } | { error: string } {
  const title = shop.find((t) => t.id === id);
  if (!title) return { error: '그런 칭호는 없다' };
  if ((profile.titles ?? []).includes(id)) return { error: '이미 가지고 있다' };
  if (title.requires && !profile.achievements?.includes(title.requires)) return { error: '먼저 업적을 달성해야 살 수 있다' };
  if (profile.coins < title.price) return { error: `코인이 부족하다 (${title.price} 필요)` };
  return { profile: { ...profile, coins: profile.coins - title.price, titles: [...(profile.titles ?? []), id] } };
}

// Wear an owned title; null goes back to the level title.
export function wearTitle(profile: Profile, id: string | null): { profile: Profile } | { error: string } {
  if (id === null) {
    const { badge: _, ...rest } = profile;
    return { profile: rest };
  }
  if (!(profile.titles ?? []).includes(id)) return { error: '먼저 사야 한다' };
  return { profile: { ...profile, badge: id } };
}

// What the ranking keeps: a title id, or nothing.
export const cleanBadge = (v: unknown): string | undefined => (typeof v === 'string' && BADGE_ID.test(v) ? v : undefined);
