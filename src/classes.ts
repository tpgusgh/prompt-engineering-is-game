import { modelFamily, WEAPONS, DEFAULT_WEAPON_ID } from './weapons.ts';
import { SWORD_MAX_LEVEL } from './forge.ts';
import type { EffortLevel } from './claude-settings.ts';

// The hero's class decides what each weapon (Claude model) is called and how
// an enhanced one is described: modifiers[level] is the prefix at +level.
export type HeroClassId = 'swordsman' | 'wizard' | 'archer';

export interface HeroClass {
  id: HeroClassId;
  name: string;
  icon: string;
  weapons: Record<string, { name: string; flavor: string }>;
  modifiers: string[];
  // Effort = the skill the hero attacks with: deeper thinking, a stronger
  // (slower) skill. Keyed low → max.
  skills: Record<EffortLevel, { name: string; text: string }>;
}

const COMMON_LOW = ['초라한', '그냥', '쓸만한', '제법 좋은'];
const COMMON_HIGH = ['찬란한', '전설의', '신화의'];

export const HERO_CLASSES: HeroClass[] = [
  {
    id: 'swordsman',
    name: '검사',
    icon: '🗡',
    weapons: {
      haiku: { name: '단검', flavor: '가볍고 빠른 Haiku의 단검' },
      sonnet: { name: '장검', flavor: '균형 잡힌 Sonnet의 장검' },
      opus: { name: '마검', flavor: '묵직한 Opus의 마검' },
      fable: { name: '성검', flavor: '최강의 Fable이 깃든 성검' },
    },
    modifiers: [...COMMON_LOW, '단단한', '예리한', '빛나는', '영롱한', ...COMMON_HIGH],
    skills: {
      low: { name: '빠른 베기', text: '생각보다 손이 먼저 나가는 가벼운 일격' },
      medium: { name: '연속 베기', text: '두세 번 이어 베는 기본기' },
      high: { name: '회전 베기', text: '몸을 돌려 주위를 쓸어버리는 정석 기술' },
      xhigh: { name: '검기 폭풍', text: '검기를 폭풍처럼 날려 보내는 상급 기술' },
      max: { name: '천검', text: '하늘을 가르는 궁극의 일격' },
    },
  },
  {
    id: 'wizard',
    name: '마법사',
    icon: '🧙',
    weapons: {
      haiku: { name: '나무 완드', flavor: '가볍고 빠른 Haiku의 완드' },
      sonnet: { name: '마법지팡이', flavor: '균형 잡힌 Sonnet의 마법지팡이' },
      opus: { name: '현자의 지팡이', flavor: '묵직한 Opus의 지혜가 담긴 지팡이' },
      fable: { name: '대마도사의 오브', flavor: '최강의 Fable이 깃든 오브' },
    },
    modifiers: [...COMMON_LOW, '마력이 흐르는', '마력이 깃든', '빛나는', '별빛이 서린', ...COMMON_HIGH],
    skills: {
      low: { name: '매직 미사일', text: '영창 없이 바로 쏘는 마력탄' },
      medium: { name: '파이어볼', text: '짧은 영창으로 던지는 화염구' },
      high: { name: '체인 라이트닝', text: '적 사이를 튀어 다니는 번개' },
      xhigh: { name: '블리자드', text: '긴 영창 끝에 몰아치는 눈보라' },
      max: { name: '메테오', text: '하늘에서 운석을 떨어뜨리는 최상위 마법' },
    },
  },
  {
    id: 'archer',
    name: '궁수',
    icon: '🏹',
    weapons: {
      haiku: { name: '단궁', flavor: '가볍고 빠른 Haiku의 단궁' },
      sonnet: { name: '장궁', flavor: '균형 잡힌 Sonnet의 장궁' },
      opus: { name: '마궁', flavor: '묵직한 Opus의 마궁' },
      fable: { name: '천궁', flavor: '최강의 Fable이 깃든 천궁' },
    },
    modifiers: [...COMMON_LOW, '팽팽한', '바람을 가르는', '빛나는', '매의 눈이 깃든', ...COMMON_HIGH],
    skills: {
      low: { name: '속사', text: '조준 없이 재빨리 쏘는 한 발' },
      medium: { name: '관통 화살', text: '방어를 꿰뚫는 화살' },
      high: { name: '연발 사격', text: '숨 고를 틈 없이 이어 쏘는 화살' },
      xhigh: { name: '화살비', text: '하늘을 덮는 화살 세례' },
      max: { name: '천공의 화살', text: '구름을 꿰뚫고 떨어지는 궁극의 한 발' },
    },
  },
];

export const DEFAULT_CLASS_ID: HeroClassId = 'swordsman';

export function getHeroClass(id: string | undefined): HeroClass {
  return HERO_CLASSES.find((c) => c.id === id) ?? HERO_CLASSES.find((c) => c.id === DEFAULT_CLASS_ID)!;
}

// e.g. wizard + Sonnet at +1 → "그냥 마법지팡이".
export function weaponDisplayName(classId: string | undefined, model: string | undefined, level: number): string {
  const hero = getHeroClass(classId);
  const weapon = hero.weapons[modelFamily(model) ?? ''] ?? hero.weapons[DEFAULT_WEAPON_ID];
  const prefix = hero.modifiers[Math.max(0, Math.min(SWORD_MAX_LEVEL, level))];
  return `${prefix} ${weapon.name}`;
}

// Keep the class tables and the weapon list in step.
for (const c of HERO_CLASSES) {
  for (const w of WEAPONS) if (!c.weapons[w.model]) throw new Error(`${c.id} is missing a name for ${w.model}`);
}
