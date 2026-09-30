export type Difficulty = 'easy' | 'normal' | 'hard';

interface MonsterTemplate {
  name: string;
  art: string;
  baseHp: number;
}

// Rosters of one chapter each (5 monsters + the boss last); chapters cycle
// through them in order. Art/lines in the renderer follow this order.
const ROSTERS: MonsterTemplate[][] = [[
  { name: '버그 고블린', art: '  (o_o)\n  <)  )╯\n  /   \\', baseHp: 60 },
  { name: '타입 에러 슬라임', art: '  .-\'\'-.\n (  ~~  )\n  `-..-`', baseHp: 80 },
  { name: '널 포인터 레이스', art: '  ,---.\n ( 0 0 )\n  `-v-`  undefined', baseHp: 100 },
  { name: '경쟁 상태 팬텀', art: '  <o><o>\n ~~~~~~~~ (blinking)', baseHp: 130 },
  { name: '머지 컨플릭트 히드라', art: '  <<<<<<<\n  =======\n  >>>>>>>', baseHp: 160 },
  { name: '레거시 코드 드래곤', art: '  /^^^^^\\\n <( o o )>\n  \\_===_/', baseHp: 220 },
], [
  { name: '메모리 릭 젤리', art: '  .~~~~.\n ( o  o )\n  ~~vv~~  4.2GB', baseHp: 70 },
  { name: '무한 루프 뱀', art: '   ,-.\n  ( @ )~~>\n   `-\'  while(true)', baseHp: 90 },
  { name: '스택 오버플로 골렘', art: '  [####]\n  [####]\n  [####] ...', baseHp: 110 },
  { name: '의존성 지옥 거미', art: ' /\\(oo)/\\\n //\\||//\\\n node_modules', baseHp: 135 },
  { name: '캐시 무효화 유령', art: '  .---.\n ( o o )\n  \\_~_/  stale', baseHp: 165 },
  { name: '프로덕션 장애 타이탄', art: '  [!500!]\n <|#####|>\n   |   |', baseHp: 230 },
], [
  { name: '세미콜론 요정', art: '  \\(^o^)/\n    ;;\n   missing ;', baseHp: 75 },
  { name: '인덴트 트롤', art: '  (>_<)\n  |\\t|  |', baseHp: 95 },
  { name: '매직 넘버 박쥐', art: ' /\\(42)/\\\n   86400', baseHp: 115 },
  { name: '데드락 쌍둥이 기사', art: ' [#]<->[#]\n  lock lock', baseHp: 140 },
  { name: 'SQL 인젝션 뱀파이어', art: "  (\\/)\n ('; --)\n  /||\\", baseHp: 170 },
  { name: '모놀리스 거인', art: '  [======]\n  [ app  ]\n  [======]', baseHp: 240 },
], [
  { name: '오프바이원 도깨비', art: '  (o^o)\n  i <= len', baseHp: 80 },
  { name: '시간대 버그 시계괴물', art: '   .-.\n  ( 9 )  UTC?\n   `-`', baseHp: 100 },
  { name: '부동소수점 유령', art: '  .--.\n ( .1+.2 )\n  0.30000000000000004', baseHp: 120 },
  { name: '정규식 미궁 미노타우로스', art: ' (\\__/)\n ^(a+)+$', baseHp: 145 },
  { name: '좀비 프로세스', art: '  [x_x]\n  <defunct>', baseHp: 175 },
  { name: '기술부채 리치', art: '  ,^^^,\n ( o o )  +interest\n  /|||\\', baseHp: 250 },
], [
  { name: '404 도둑 고양이', art: '  /\\_/\\\n ( 404 )\n  > ^ <', baseHp: 85 },
  { name: 'CORS 문지기', art: '  [|=|]\n   |||  Origin?', baseHp: 105 },
  { name: '인코딩 깨짐 모지바케', art: '  ì•ˆë…•\n  (????)', baseHp: 125 },
  { name: '플래키 테스트 카멜레온', art: '  (o.o)~\n PASS/FAIL', baseHp: 150 },
  { name: '핫픽스 폭탄병', art: '   *\n  (O)~  push -f', baseHp: 180 },
  { name: 'AI 환각 키메라', art: ' <(@@)>\n  /||\\  "trust me"', baseHp: 260 },
]];
export const ROSTER_COUNT = ROSTERS.length;

// One chapter = one full cycle through the roster; its last floor (the
// dragon) is the chapter boss.
export const MONSTER_COUNT = ROSTERS[0].length;

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.7,
  normal: 1,
  hard: 1.4,
};

const HP_GROWTH_PER_FLOOR = 0.25;

export function spawnMonster(floor: number, difficulty: Difficulty): { name: string; art: string; maxHp: number; index: number } {
  const roster = Math.floor(floor / MONSTER_COUNT) % ROSTERS.length;
  const slot = floor % MONSTER_COUNT;
  const template = ROSTERS[roster][slot];
  const floorScaling = 1 + floor * HP_GROWTH_PER_FLOOR;
  const maxHp = Math.round(template.baseHp * floorScaling * DIFFICULTY_MULTIPLIER[difficulty]);
  return { name: template.name, art: template.art, maxHp, index: roster * MONSTER_COUNT + slot };
}

// Every monster (for the bestiary): what it is at its first appearance on
// normal difficulty, when roster R is chapter R+1.
export function listMonsters(): { index: number; name: string; roster: number; isBoss: boolean; firstFloor: number; baseHp: number }[] {
  return ROSTERS.flatMap((roster, r) =>
    roster.map((m, slot) => ({ index: r * MONSTER_COUNT + slot, name: m.name, roster: r, isBoss: slot === MONSTER_COUNT - 1, firstFloor: r * MONSTER_COUNT + slot, baseHp: m.baseHp })),
  );
}
