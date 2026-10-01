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
], [
  // 8: 클라우드 상공
  { name: '서버리스 콜드스타트 요정', art: '  ~(-_-)~\n  zzZ 3.2s', baseHp: 95, trait: 'frail' },
  { name: '오토스케일링 슬라임', art: '  (o_o)(o_o)\n  x2 x4 x8', baseHp: 115, trait: 'regen' },
  { name: '청구서 폭탄 유령', art: '  .---.\n ( $ $ )\n  ~~~~~ $48,210', baseHp: 135, trait: 'thorns' },
  { name: '파드 크라켄', art: '  (@@)\n /|||||\\\n CrashLoopBackOff', baseHp: 160, trait: 'armor' },
  { name: '리전 장애 폭풍정령', art: '  ~~~@~~~\n  us-east-1 DOWN', baseHp: 185, trait: 'fierce' },
  { name: '멀티클라우드 천공룡', art: '  <<(O O)>>\n  AWS+GCP+Azure', baseHp: 275, trait: 'keywordWeak' },
], [
  // 9: 데이터 심해
  { name: '널 가득한 CSV 해파리', art: '  .~~~.\n  ,,,,,,\n  null,null', baseHp: 100, trait: 'frail' },
  { name: 'N+1 쿼리 문어', art: '  (oo)\n /||||\\\n SELECT x 1001', baseHp: 120, trait: 'fierce' },
  { name: '인덱스 없는 테이블 거북', art: '  _____\n (_____)  FULL SCAN\n  ^  ^', baseHp: 140, trait: 'armor' },
  { name: '캐시 스탬피드 들소 떼', art: '  M M M M\n  ~~stampede~~', baseHp: 165, trait: 'thorns' },
  { name: '스키마 없는 몽구스', art: '  (o.o)\n  { ??? }', baseHp: 190, trait: 'regen' },
  { name: '데이터 레이크 리바이어던', art: '  <~~(O)~~>\n  3PB, 아무도 안 봄', baseHp: 280, trait: 'testWeak' },
], [
  // 10: 프론트엔드 도시
  { name: 'CSS 중앙정렬 망령', art: '  [   ?   ]\n  margin:auto', baseHp: 105, trait: 'frail' },
  { name: 'z-index 9999 탑', art: '  [9999]\n  [ 999]\n  [  99]', baseHp: 125, trait: 'armor' },
  { name: '무한 리렌더 햄스터', art: '  (o.o)@\n  render ×∞', baseHp: 145, trait: 'regen' },
  { name: '번들 비대 두꺼비', art: '  (O  O)\n  bundle.js 14MB', baseHp: 170, trait: 'fierce' },
  { name: '하이드레이션 불일치 도플갱어', art: '  (o_o) ≠ (o_o)\n  server ≠ client', baseHp: 195, trait: 'thorns' },
  { name: 'node_modules 블랙홀', art: '  (  ●  )\n  1.2GB · 1,284 pkgs', baseHp: 285, trait: 'keywordWeak' },
], [
  // 11: 잊힌 해적섬
  { name: '리베이스 해적', art: '  (x_o)\n  /|\\  rebase -i', baseHp: 110, trait: 'fierce' },
  { name: '체리픽 앵무새', art: '  (o>\n  //) cherry-pick!', baseHp: 125, trait: 'frail' },
  { name: '스태시 보물상자 미믹', art: '  [=$=]\n  stash@{7}', baseHp: 145, trait: 'armor' },
  { name: '분리된 HEAD 유령선원', art: '  (o o)\n  HEAD detached', baseHp: 170, trait: 'thorns' },
  { name: '서브모듈 크라켄', art: '  (@@)\n  submodule update --init', baseHp: 195, trait: 'regen' },
  { name: '포스 푸시 선장', art: '  \\(ò_ó)/\n  push --force', baseHp: 290, trait: 'keywordWeak' },
], [
  // 12: 하늘섬 도서관
  { name: '복붙 까마귀', art: '  (o>\n  Ctrl+C Ctrl+V', baseHp: 115, trait: 'frail' },
  { name: '튜토리얼 지옥 미로벌레', art: '  @@@@@\n  "Todo 앱 만들기 #47"', baseHp: 135, trait: 'regen' },
  { name: '버전 안 맞는 예제 골렘', art: '  [v2.x]\n  [v5.x]', baseHp: 155, trait: 'armor' },
  { name: '린터 경고 요정 무리', art: '  * * * *\n  ⚠ 1,842 warnings', baseHp: 180, trait: 'thorns' },
  { name: '설명 없는 PR 스핑크스', art: '  /^\\\n (o o)  "fix"', baseHp: 205, trait: 'testWeak' },
  { name: '전지적 코드리뷰어', art: '  (◉ ◉)\n  "nit:" ×248', baseHp: 295, trait: 'fierce' },
], [
  // 13: 마왕군 정예
  { name: '스팸봇 임프', art: '  (^v^)\n  [광고] 당첨!!', baseHp: 120, trait: 'frail' },
  { name: '피싱 세이렌', art: '  ~(o o)~\n  "비밀번호를 확인하세요"', baseHp: 140, trait: 'thorns' },
  { name: '크립토재커 흡혈귀', art: '  (\\/)\n  CPU 100% ⛏', baseHp: 160, trait: 'regen' },
  { name: '키로거 그림자', art: '  [ . . ]\n  q w e r t y', baseHp: 180, trait: 'armor' },
  { name: '봇 탐지 회피 변신술사', art: '  (?_?) → (o_o)\n  "저는 사람입니다"', baseHp: 205, trait: 'fierce' },
  { name: '다크웹 브로커 대악마', art: '  }>(O O)<{\n  "뭐든 팝니다"', baseHp: 300, trait: 'keywordWeak' },
], [
  // 14: 마계 서버실
  { name: '과열 서버 화염정령', art: '  ~^~^~\n  CPU 98°C', baseHp: 130, trait: 'fierce' },
  { name: 'UPS 방전 골렘', art: '  [▯▯▯▯]\n  battery 3%', baseHp: 150, trait: 'armor' },
  { name: '케이블 스파게티 히드라', art: '  ~~S~~S~~S~~\n  (어느 게 어느 선?)', baseHp: 170, trait: 'regen' },
  { name: '권한 상승 가고일', art: '  /\\(ò ó)/\\\n  sudo !!', baseHp: 195, trait: 'thorns' },
  { name: '로그 삭제 망령', art: '  .---.\n ( - - )  > /dev/null', baseHp: 215, trait: 'frail' },
  { name: '루트 권한의 마황제', art: '  \\\\[#ROOT#]//\n  <(O   O)>', baseHp: 310, trait: 'testWeak' },
], [
  // 15: 컴파일 화산
  { name: '링커 에러 도롱뇽', art: '  ~<o.o>~\n  undefined reference', baseHp: 120, trait: 'armor' },
  { name: '템플릿 에러 3천줄 뱀', art: '  ~~~~~~~~~~>\n  error: (3,000 lines)', baseHp: 140, trait: 'fierce' },
  { name: '순환 import 도마뱀', art: '  <@~~~@>\n  a→b→c→a', baseHp: 160, trait: 'regen' },
  { name: '경고 무시 불도마뱀', art: '  ~(*v*)~\n  -w (warnings off)', baseHp: 180, trait: 'thorns' },
  { name: '빌드 캐시 오염 골렘', art: '  [##??##]\n  stale cache', baseHp: 205, trait: 'frail' },
  { name: '빌드 40분 화산룡', art: '  /\\^^/\\\n <(o  o)> 40:00', baseHp: 305, trait: 'testWeak' },
], [
  // 16: 테스트 늪
  { name: '목(mock) 인형', art: '  [o_o]\n  mocked()', baseHp: 125, trait: 'frail' },
  { name: '스냅샷 망령', art: '  .---.\n ( u u )  -1 +1', baseHp: 145, trait: 'regen' },
  { name: '커버리지 100% 허수아비', art: '  \\(-_-)/\n  coverage 100%', baseHp: 165, trait: 'armor' },
  { name: '타임아웃 거북', art: '  _____\n (_____)  5000ms+', baseHp: 185, trait: 'fierce' },
  { name: '테스트 순서 의존 쌍둥이', art: '  (o_o)(o_o)\n  A 먼저, 그다음 B', baseHp: 210, trait: 'thorns' },
  { name: '프로덕션에서만 터지는 버그신', art: '  <\\(!!!)/>\n  "works on my machine"', baseHp: 315, trait: 'keywordWeak' },
]];

// What each roster (chapter set) is called in the bestiary.
export const ROSTER_NAMES = ['버그 소굴', '런타임 늪', '문법 숲', '논리의 미궁', '네트워크 황야', '고대 신전', '마왕군', '벌레 굴', '클라우드 상공', '데이터 심해', '프론트엔드 도시', '잊힌 해적섬', '하늘섬 도서관', '마왕군 정예', '마계 서버실', '컴파일 화산', '테스트 늪'];
export const ROSTER_COUNT = ROSTERS.length;

// One chapter = one full cycle through the roster; its last floor (the
// dragon) is the chapter boss.
export const MONSTER_COUNT = ROSTERS[0].length;

// Coins and XP per difficulty: harder fights pay more.
export const DIFFICULTY_REWARD: Record<Difficulty, number> = { easy: 0.7, normal: 1, hard: 1.5 };

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.7,
  normal: 1,
  hard: 1.4,
};

// HP multiplier by floor: linear early, steeper later (the hero's power
// multiplies — stats, sword, weapon, skill — so monsters must keep up).
const HP_GROWTH_PER_FLOOR = 0.25;
const HP_GROWTH_SQUARED = 0.01;

export function spawnMonster(floor: number, difficulty: Difficulty, themeId?: string, rosters?: number[]): { name: string; art: string; maxHp: number; index: number; trait: TraitId } {
  const chapter = Math.floor(floor / MONSTER_COUNT) + 1;
  // rosters: a fixed area per chapter (the daily dungeon) instead of the theme's.
  const roster = rosters?.length ? rosters[(chapter - 1) % rosters.length] : rosterFor(themeId, chapter);
  const slot = floor % MONSTER_COUNT;
  const template = ROSTERS[roster][slot];
  const floorScaling = 1 + floor * HP_GROWTH_PER_FLOOR + floor * floor * HP_GROWTH_SQUARED;
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
