// 칭호 상점: titles bought with coins (from achievements and finished
// adventures). The one worn replaces the level title in the ranking.
// Shared by the page and electron/main.ts (prices are checked there).
// tier colors the title in the ranking; requires = an achievement id that
// must be unlocked before the title can be bought.
export const TITLE_SHOP = [
  { id: 'coffee', name: '카페인 중독자', price: 200, tier: 'common' },
  { id: 'bug-hunter', name: '버그 사냥꾼', price: 300, tier: 'common' },
  { id: 'night-coder', name: '새벽 3시의 코더', price: 400, tier: 'common' },
  { id: 'prompt-poet', name: '프롬프트 시인', price: 500, tier: 'common' },
  { id: 'refactorer', name: '리팩토링 장인', price: 600, tier: 'rare' },
  { id: 'test-zealot', name: '테스트 광신도', price: 700, tier: 'rare' },
  { id: 'merge-survivor', name: '머지 충돌 생존자', price: 800, tier: 'rare' },
  { id: 'force-push', name: '포스 푸시의 악몽', price: 900, tier: 'rare' },
  { id: 'one-shot', name: '한 방 프롬프터', price: 1000, tier: 'rare' },
  { id: 'goblin-vip', name: '고블린 상점 VIP', price: 1200, tier: 'rare' },
  { id: 'devil-dealer', name: '악마와 거래한 자', price: 1500, tier: 'epic' },
  { id: 'dragon-friend', name: '용의 친구', price: 2000, tier: 'epic' },
  { id: 'ai-tamer', name: 'AI 조련사', price: 3000, tier: 'epic' },
  { id: 'living-legend', name: '살아있는 전설', price: 5000, tier: 'legend' },
  { id: 'pact-survivor', name: '계약의 생존자', price: 1200, tier: 'rare', requires: 'pact-breaker' },
  { id: 'dragon-slayer', name: '용을 쓰러뜨린 자', price: 1500, tier: 'epic', requires: 'boss-3' },
  { id: 'token-millionaire', name: '토큰 백만장자', price: 2000, tier: 'epic', requires: 'million' },
  { id: 'legend-smith', name: '전설의 대장장이', price: 2500, tier: 'epic', requires: 'sword-5' },
  { id: 'keyboard-god', name: '키보드 위의 신', price: 2500, tier: 'epic', requires: 'typing-god' },
  { id: 'monster-doctor', name: '몬스터 박사', price: 3000, tier: 'legend', requires: 'bestiary-all' },
  { id: 'bought-it', name: '돈으로 산 칭호', price: 10000, tier: 'legend' },
];

export const TIER_NAME = { common: '일반', rare: '희귀', epic: '영웅', legend: '전설' };
