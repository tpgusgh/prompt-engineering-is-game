// Pets (동료): found rarely in good treasure chests, kept for good in the
// profile. One rides along at a time and helps at the end of every turn.
export type PetId = 'slime' | 'drake' | 'owl';

export interface Pet {
  id: PetId;
  name: string;
  text: string;
}

export const PETS: Pet[] = [
  { id: 'slime', name: '힐링 슬라임', text: '매 턴 끝에 용사 최대 HP의 5%를 회복시켜 준다' },
  { id: 'drake', name: '아기 드래곤', text: '매 턴 끝에 몬스터에게 최대 HP의 3% 불꽃을 뿜는다' },
  { id: 'owl', name: '지혜의 부엉이', text: '층을 깰 때 얻는 경험치 +20%' },
];

export const PET_HEAL_RATIO = 0.05;
export const PET_FIRE_RATIO = 0.03;
export const PET_XP_BONUS = 1.2;

// Chance a chest of this grade also holds a pet (only ones not yet owned).
export const PET_CHANCE: Record<string, number> = { gold: 0.03, platinum: 0.05, diamond: 0.08, legend: 0.12, mythic: 0.2 };

export const isPetId = (id: unknown): id is PetId => PETS.some((p) => p.id === id);
export const getPet = (id: string | undefined) => PETS.find((p) => p.id === id);

export function rollPet(grade: string, owned: string[], random: () => number): PetId | null {
  const left = PETS.filter((p) => !owned.includes(p.id));
  if (!left.length || random() >= (PET_CHANCE[grade] ?? 0)) return null;
  return left[Math.min(left.length - 1, Math.floor(random() * left.length))].id;
}
