// Contracts, signed with the 계약서 (one of 6 elemental gods) or the 악마의
// 계약서 (one of the 7 deadly-sin demons, which costs a share of max HP to
// sign). The hero holds at most one; signing another — of either kind —
// breaks them all and takes 10 max HP for good. Kept in the profile.

export type ContractKind = 'god' | 'demon';
export interface Contract {
  kind: ContractKind;
  id: string;
}

// Everything a contract can change in battle; NO_CONTRACT_MODS is neutral.
export interface ContractMods {
  flat: number; // added to every hit
  actionBonus: number; // added to each work hit
  noActionHits: boolean; // work hits deal nothing
  closingMult: number;
  critMult: number; // closing blow multiplier on a crit
  lowHpMult: number; // damage multiplier while at half HP or less
  bossMult: number;
  counterMult: number; // counterattacks taken
  reflect: number; // share of a counter dealt back to the monster
  fleeChance?: number;
  typingDamage: number;
  coinMult: number;
  clearHealMult: number;
  clearHealBonus: number;
  healPerTurn: number;
}

export const NO_CONTRACT_MODS: ContractMods = {
  flat: 0, actionBonus: 0, noActionHits: false, closingMult: 1, critMult: 1, lowHpMult: 1, bossMult: 1,
  counterMult: 1, reflect: 0, typingDamage: 1, coinMult: 1, clearHealMult: 1, clearHealBonus: 0, healPerTurn: 0,
};

interface Pact {
  id: string;
  name: string;
  text: string;
  mods: Partial<ContractMods>;
}
export type Demon = Pact & { hpCost: number };

export const GODS: Pact[] = [
  { id: 'fire', name: '화염신 이그니스', text: '크리티컬 피해 +30%', mods: { critMult: 1.3 } },
  { id: 'water', name: '수신 운디네', text: '매 턴이 끝날 때 HP 3 회복', mods: { healPerTurn: 3 } },
  { id: 'wind', name: '풍신 실프', text: '도망 성공률 75%, 작업 타격 +1', mods: { fleeChance: 0.75, actionBonus: 1 } },
  { id: 'earth', name: '지신 노움', text: '받는 반격 -15%', mods: { counterMult: 0.85 } },
  { id: 'thunder', name: '뇌신 라이쥬', text: '작업 타격 +2', mods: { actionBonus: 2 } },
  { id: 'light', name: '광신 루멘', text: '층 클리어 회복 2배, 보스에게 주는 피해 +20%', mods: { clearHealMult: 2, bossMult: 1.2 } },
];

export const DEMONS: Demon[] = [
  { id: 'pride', name: '교만의 루시퍼', hpCost: 0.3, text: '마무리 일격 +40%, 대신 받는 반격 +10%', mods: { closingMult: 1.4, counterMult: 1.1 } },
  { id: 'greed', name: '탐욕의 마몬', hpCost: 0.15, text: '얻는 코인 +50%', mods: { coinMult: 1.5 } },
  { id: 'wrath', name: '분노의 사탄', hpCost: 0.2, text: 'HP가 절반 이하일 때 주는 피해 +60%', mods: { lowHpMult: 1.6 } },
  { id: 'envy', name: '질투의 레비아탄', hpCost: 0.2, text: '받은 반격의 30%를 몬스터에게 되돌려 준다', mods: { reflect: 0.3 } },
  { id: 'lust', name: '색욕의 아스모데우스', hpCost: 0.1, text: '코딩 타자 한 줄이 3 피해', mods: { typingDamage: 3 } },
  { id: 'gluttony', name: '폭식의 벨제붑', hpCost: 0.15, text: '층을 클리어할 때마다 HP 20 추가 회복', mods: { clearHealBonus: 20 } },
  { id: 'sloth', name: '나태의 벨페고르', hpCost: 0.1, text: '작업 타격이 사라지는 대신 마무리 일격 2배', mods: { noActionHits: true, closingMult: 2 } },
];

export const BREAK_PENALTY = 10; // max HP lost for good when contracts break

export function pactOf(contract: Contract | null | undefined): Pact | Demon | undefined {
  if (!contract) return undefined;
  return (contract.kind === 'god' ? GODS : DEMONS).find((p) => p.id === contract.id);
}

export function contractMods(contract: Contract | null | undefined): ContractMods {
  const pact = pactOf(contract);
  if (!pact) return NO_CONTRACT_MODS;
  return { ...NO_CONTRACT_MODS, ...(contract!.kind === 'god' ? { flat: 1 } : {}), ...pact.mods };
}

// Using a contract scroll: a fresh pact if none is held, otherwise all break.
export function signContract(current: Contract | null | undefined, kind: ContractKind, random: () => number): { contract: Contract | null; broken: boolean } {
  if (current) return { contract: null, broken: true };
  const pool = kind === 'god' ? GODS : DEMONS;
  const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { contract: { kind, id: pick.id }, broken: false };
}

export function coerceContract(value: unknown): Contract | undefined {
  const v = value as Partial<Contract> | undefined;
  if (!v || (v.kind !== 'god' && v.kind !== 'demon') || typeof v.id !== 'string') return undefined;
  return pactOf(v as Contract) ? { kind: v.kind, id: v.id } : undefined;
}
