import { rosterFor } from './themes.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';

// Each monster fights with one trait (revealed in the bestiary once defeated).
export type TraitId = 'armor' | 'regen' | 'fierce' | 'thorns' | 'frail' | 'keywordWeak' | 'testWeak';
export const TRAITS: Record<TraitId, { name: string; text: string }> = {
  armor: { name: '갑옷', text: '작업 타격이 절반만 들어간다' },
  regen: { name: '재생', text: '매 턴이 끝날 때 최대 HP의 5%를 회복한다' },
  fierce: { name: '흉포', text: '반격 피해 +30%' },
  thorns: { name: '가시', text: 'AI의 작업이 실패할 때마다 용사가 2 피해를 입는다' },
  frail: { name: '허약', text: '마무리 일격 피해 +25%' },
  keywordWeak: { name: '키워드 약점', text: '크리티컬 피해 +30%' },
  testWeak: { name: '테스트 약점', text: '테스트가 통과한 턴의 마무리 일격 1.5배' },
};

interface MonsterTemplate {
  name: string;
  art: string;
  baseHp: number;
  trait: TraitId;
}

// Rosters of one chapter each (5 monsters + the boss last). Which roster a
// chapter uses depends on the theme (src/themes.ts). Art/lines/lore in the
// renderer follow this order (monster index = roster * 6 + slot).
const ROSTERS: MonsterTemplate[][] = [[
  { name: '버그 고블린', art: '  (o_o)\n  <)  )╯\n  /   \\', baseHp: 60, trait: 'thorns' },
  { name: '타입 에러 슬라임', art: '  .-\'\'-.\n (  ~~  )\n  `-..-`', baseHp: 80, trait: 'armor' },
  { name: '널 포인터 레이스', art: '  ,---.\n ( 0 0 )\n  `-v-`  undefined', baseHp: 100, trait: 'frail' },
  { name: '경쟁 상태 팬텀', art: '  <o><o>\n ~~~~~~~~ (blinking)', baseHp: 130, trait: 'fierce' },
  { name: '머지 컨플릭트 히드라', art: '  <<<<<<<\n  =======\n  >>>>>>>', baseHp: 160, trait: 'regen' },
  { name: '레거시 코드 드래곤', art: '  /^^^^^\\\n <( o o )>\n  \\_===_/', baseHp: 220, trait: 'fierce' },
], [
  { name: '메모리 릭 젤리', art: '  .~~~~.\n ( o  o )\n  ~~vv~~  4.2GB', baseHp: 70, trait: 'regen' },
  { name: '무한 루프 뱀', art: '   ,-.\n  ( @ )~~>\n   `-\'  while(true)', baseHp: 90, trait: 'fierce' },
  { name: '스택 오버플로 골렘', art: '  [####]\n  [####]\n  [####] ...', baseHp: 110, trait: 'armor' },
  { name: '의존성 지옥 거미', art: ' /\\(oo)/\\\n //\\||//\\\n node_modules', baseHp: 135, trait: 'thorns' },
  { name: '캐시 무효화 유령', art: '  .---.\n ( o o )\n  \\_~_/  stale', baseHp: 165, trait: 'frail' },
  { name: '프로덕션 장애 타이탄', art: '  [!500!]\n <|#####|>\n   |   |', baseHp: 230, trait: 'testWeak' },
], [
  { name: '세미콜론 요정', art: '  \\(^o^)/\n    ;;\n   missing ;', baseHp: 75, trait: 'frail' },
  { name: '인덴트 트롤', art: '  (>_<)\n  |\\t|  |', baseHp: 95, trait: 'armor' },
  { name: '매직 넘버 박쥐', art: ' /\\(42)/\\\n   86400', baseHp: 115, trait: 'keywordWeak' },
  { name: '데드락 쌍둥이 기사', art: ' [#]<->[#]\n  lock lock', baseHp: 140, trait: 'fierce' },
  { name: 'SQL 인젝션 뱀파이어', art: "  (\\/)\n ('; --)\n  /||\\", baseHp: 170, trait: 'regen' },
  { name: '모놀리스 거인', art: '  [======]\n  [ app  ]\n  [======]', baseHp: 240, trait: 'armor' },
], [
  { name: '오프바이원 도깨비', art: '  (o^o)\n  i <= len', baseHp: 80, trait: 'keywordWeak' },
  { name: '시간대 버그 시계괴물', art: '   .-.\n  ( 9 )  UTC?\n   `-`', baseHp: 100, trait: 'regen' },
  { name: '부동소수점 유령', art: '  .--.\n ( .1+.2 )\n  0.30000000000000004', baseHp: 120, trait: 'frail' },
  { name: '정규식 미궁 미노타우로스', art: ' (\\__/)\n ^(a+)+$', baseHp: 145, trait: 'fierce' },
  { name: '좀비 프로세스', art: '  [x_x]\n  <defunct>', baseHp: 175, trait: 'regen' },
  { name: '기술부채 리치', art: '  ,^^^,\n ( o o )  +interest\n  /|||\\', baseHp: 250, trait: 'thorns' },
], [
  { name: '404 도둑 고양이', art: '  /\\_/\\\n ( 404 )\n  > ^ <', baseHp: 85, trait: 'frail' },
  { name: 'CORS 문지기', art: '  [|=|]\n   |||  Origin?', baseHp: 105, trait: 'armor' },
  { name: '인코딩 깨짐 모지바케', art: '  ì•ˆë…•\n  (????)', baseHp: 125, trait: 'thorns' },
  { name: '플래키 테스트 카멜레온', art: '  (o.o)~\n PASS/FAIL', baseHp: 150, trait: 'testWeak' },
  { name: '핫픽스 폭탄병', art: '   *\n  (O)~  push -f', baseHp: 180, trait: 'fierce' },
  { name: 'AI 환각 키메라', art: ' <(@@)>\n  /||\\  "trust me"', baseHp: 260, trait: 'keywordWeak' },
], [
  // 5: adventure only — 고대 신전
  { name: '주석 처리된 미이라', art: '  [////]\n  (x_x) /* */', baseHp: 85, trait: 'armor' },
  { name: '폐기된 API 석상', art: '  [@deprecated]\n    ( - - )', baseHp: 105, trait: 'regen' },
  { name: '낡은 문서의 사서 유령', art: '  .---.\n ( o o ) v0.1 docs', baseHp: 125, trait: 'frail' },
  { name: 'YAML 미궁 골렘', art: '  key:\n    - value:\n      - ???', baseHp: 150, trait: 'fierce' },
  { name: '잊힌 크론잡 박쥐', art: ' /\\(* * * * *)/\\', baseHp: 170, trait: 'thorns' },
  { name: 'final_final_v2의 고대신', art: '  <[final_v2.zip]>\n   /|||||\\', baseHp: 250, trait: 'regen' },
], [
  // 6: demon-king only — 마왕군
  { name: '디도스 해골병사', art: '  (x_x)(x_x)(x_x)\n   ||   ||   ||', baseHp: 95, trait: 'fierce' },
  { name: '랜섬웨어 기사', art: '  [#LOCKED#]\n   /|  |\\', baseHp: 120, trait: 'armor' },
  { name: '제로데이 암살자', art: '   _.--._\n  (  0day )\n   `----`', baseHp: 135, trait: 'frail' },
  { name: '백도어 마법사', art: '  /\\ [door]\n (o.o)', baseHp: 160, trait: 'thorns' },
  { name: '봇넷 드래곤', art: '  <<o o o>>\n  1000 bots', baseHp: 190, trait: 'regen' },
  { name: '마왕 루트킷', art: '  \\[ROOT]/\n  <(#  #)>\n   /|##|\\', baseHp: 280, trait: 'fierce' },
], [
  // 7: debug-quest only — 벌레 굴
  { name: '하이젠버그 나방', art: '  \\(o.o)/\n   }  {  (보면 사라짐)', baseHp: 80, trait: 'frail' },
  { name: '메모리 오염 거머리', art: '  ~~(@)~~\n  0xDEADBEEF', baseHp: 100, trait: 'regen' },
  { name: '세그폴트 딱정벌레', art: '  (|##|)\n  SIGSEGV', baseHp: 125, trait: 'armor' },
  { name: '레이스 컨디션 개미 떼', art: ' .:.:.:.:.\n  ant ant ant', baseHp: 145, trait: 'thorns' },
  { name: '무한 재귀 지네', art: '  ((((((( )))))))\n   f(f(f(f(', baseHp: 170, trait: 'fierce' },
  { name: '릴리스 전날의 버그 여왕', art: '  <\\(QUEEN)/>\n   /|||||\\  x999', baseHp: 260, trait: 'testWeak' },
]];

// What each roster (chapter set) is called in the bestiary.
export const ROSTER_NAMES = ['버그 소굴', '런타임 늪', '문법 숲', '논리의 미궁', '네트워크 황야', '고대 신전', '마왕군', '벌레 굴'];
export const ROSTER_COUNT = ROSTERS.length;

// One chapter = one full cycle through the roster; its last floor (the
// dragon) is the chapter boss.
export const MONSTER_COUNT = ROSTERS[0].length;

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.7,
  normal: 1,
  hard: 1.4,
};

const HP_GROWTH_PER_FLOOR = 0.25;

export function spawnMonster(floor: number, difficulty: Difficulty, themeId?: string): { name: string; art: string; maxHp: number; index: number; trait: TraitId } {
  const roster = rosterFor(themeId, Math.floor(floor / MONSTER_COUNT) + 1);
  const slot = floor % MONSTER_COUNT;
  const template = ROSTERS[roster][slot];
  const floorScaling = 1 + floor * HP_GROWTH_PER_FLOOR;
  const maxHp = Math.round(template.baseHp * floorScaling * DIFFICULTY_MULTIPLIER[difficulty]);
  return { name: template.name, art: template.art, maxHp, index: roster * MONSTER_COUNT + slot, trait: template.trait };
}

// Every monster (for the bestiary): what it is at its first appearance on
// normal difficulty, when roster R is chapter R+1.
export function listMonsters(): { index: number; name: string; roster: number; isBoss: boolean; firstFloor: number; baseHp: number; trait: TraitId }[] {
  return ROSTERS.flatMap((roster, r) =>
    roster.map((m, slot) => ({ index: r * MONSTER_COUNT + slot, name: m.name, roster: r, isBoss: slot === MONSTER_COUNT - 1, firstFloor: r * MONSTER_COUNT + slot, baseHp: m.baseHp, trait: m.trait })),
  );
}
