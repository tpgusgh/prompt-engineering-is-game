import { WEAPONS, DEFAULT_WEAPON_ID } from './weapons.ts';
import { SWORD_MAX_LEVEL } from './forge.ts';

// The hero's class decides what each weapon (Claude model) is called and how
// an enhanced one is described: modifiers[level] is the prefix at +level.
export type HeroClassId = 'swordsman' | 'wizard' | 'archer';

export interface HeroClass {
  id: HeroClassId;
  name: string;
  icon: string;
  weapons: Record<string, { name: string; flavor: string }>;
  modifiers: string[];
}

const COMMON_LOW = ['초라한', '그냥', '쓸만한', '제법 좋은'];
const COMMON_HIGH = ['찬란한', '전설의', '신화의'];

export const HERO_CLASSES: HeroClass[] = [
  {
    id: 'swordsman',
    name: '검사',
    icon: '🗡',
    weapons: {
      'claude-haiku-4-5-20251001': { name: '단검', flavor: '가볍고 빠른 Haiku의 단검' },
      'claude-sonnet-5': { name: '장검', flavor: '균형 잡힌 Sonnet의 장검' },
      'claude-opus-5-5': { name: '마검', flavor: '묵직한 Opus의 마검' },
      'claude-fable-5-1': { name: '성검', flavor: '최강의 Fable이 깃든 성검' },
    },
    modifiers: [...COMMON_LOW, '단단한', '예리한', '빛나는', '영롱한', ...COMMON_HIGH],
  },
  {
    id: 'wizard',
    name: '마법사',
    icon: '🧙',
    weapons: {
      'claude-haiku-4-5-20251001': { name: '나무 완드', flavor: '가볍고 빠른 Haiku의 완드' },
      'claude-sonnet-5': { name: '마법지팡이', flavor: '균형 잡힌 Sonnet의 마법지팡이' },
      'claude-opus-5-5': { name: '현자의 지팡이', flavor: '묵직한 Opus의 지혜가 담긴 지팡이' },
      'claude-fable-5-1': { name: '대마도사의 오브', flavor: '최강의 Fable이 깃든 오브' },
    },
    modifiers: [...COMMON_LOW, '마력이 흐르는', '마력이 깃든', '빛나는', '별빛이 서린', ...COMMON_HIGH],
  },
  {
    id: 'archer',
    name: '궁수',
    icon: '🏹',
    weapons: {
      'claude-haiku-4-5-20251001': { name: '단궁', flavor: '가볍고 빠른 Haiku의 단궁' },
      'claude-sonnet-5': { name: '장궁', flavor: '균형 잡힌 Sonnet의 장궁' },
      'claude-opus-5-5': { name: '마궁', flavor: '묵직한 Opus의 마궁' },
      'claude-fable-5-1': { name: '천궁', flavor: '최강의 Fable이 깃든 천궁' },
    },
    modifiers: [...COMMON_LOW, '팽팽한', '바람을 가르는', '빛나는', '매의 눈이 깃든', ...COMMON_HIGH],
  },
];

export const DEFAULT_CLASS_ID: HeroClassId = 'swordsman';

export function getHeroClass(id: string | undefined): HeroClass {
  return HERO_CLASSES.find((c) => c.id === id) ?? HERO_CLASSES.find((c) => c.id === DEFAULT_CLASS_ID)!;
}

// e.g. wizard + Sonnet at +1 → "그냥 마법지팡이".
export function weaponDisplayName(classId: string | undefined, model: string | undefined, level: number): string {
  const hero = getHeroClass(classId);
  const weapon = hero.weapons[model ?? ''] ?? hero.weapons[DEFAULT_WEAPON_ID];
  const prefix = hero.modifiers[Math.max(0, Math.min(SWORD_MAX_LEVEL, level))];
  return `${prefix} ${weapon.name}`;
}

// Keep the class tables and the weapon list in step.
for (const c of HERO_CLASSES) {
  for (const w of WEAPONS) if (!c.weapons[w.model]) throw new Error(`${c.id} is missing a name for ${w.model}`);
}
