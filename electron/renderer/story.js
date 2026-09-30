// electron/renderer/story.js
// Story. Each theme is a chain of chapters; every chapter ends in a boss
// (the 6th floor of the cycle, see src/battle.ts). Beyond the written
// chapters the story keeps going with generated ones — a project rarely ends
// just because one boss fell.
export const THEMES = [
  {
    id: 'adventure',
    title: '모험을 떠나기',
    chapters: [
      { title: '고대 유적의 입구', intro: '전설의 모험가가 되어, 미지의 유적에 첫 발을 내딛는다...', boss: '유적의 수호룡', outro: '수호룡이 쓰러지자, 유적 깊은 곳으로 이어지는 계단이 드러났다.' },
      { title: '잊혀진 지하 도시', intro: '계단 아래에는 수백 년 전 버려진 도시가 잠들어 있었다...', boss: '심연의 파수꾼', outro: '파수꾼의 눈빛이 꺼지고, 천장의 틈 사이로 별빛이 쏟아진다.' },
      { title: '별이 떨어진 산맥', intro: '별빛을 따라 오른 산맥 꼭대기, 하늘이 갈라져 있다...', boss: '별을 삼킨 용', outro: '마침내 별이 제자리로 돌아갔다. 하지만 지도 끝에는 아직 빈칸이 남아 있다.' },
    ],
  },
  {
    id: 'demon-king',
    title: '마왕 잡으러 가기',
    chapters: [
      { title: '마왕성 외곽', intro: '세상을 위협하는 마왕을 물리치기 위해 검을 뽑아 든다...', boss: '마왕', outro: '마왕이 쓰러졌다! ...그런데 왕좌 뒤편에서 더 짙은 어둠이 꿈틀거린다.' },
      { title: '흑막의 부활', intro: '마왕은 꼭두각시에 불과했다. 진짜 흑막, 마신이 깨어났다...', boss: '마신', outro: '마신이 소멸하며 남긴 균열이 다른 차원으로 이어져 있다.' },
      { title: '차원의 틈', intro: '균열 너머, 모든 세계를 집어삼키려는 존재가 기다린다...', boss: '차원의 군주', outro: '세계는 구해졌다. 하지만 용사의 여정은 아직 끝나지 않았다.' },
    ],
  },
  {
    id: 'debug-quest',
    title: '버그 소탕전',
    chapters: [
      { title: '레거시 모놀리스', intro: '코드 속 깊은 곳에 숨은 버그들을 소탕하러 던전에 들어선다...', boss: '레거시 코드 드래곤', outro: '드래곤을 리팩터링했다! ...그 순간 프로덕션 알람이 울린다.' },
      { title: '새벽 3시의 장애', intro: '배포 직후, 모니터링 대시보드가 붉게 물든다...', boss: '새벽 3시의 장애 드래곤', outro: '장애가 복구됐다. 이제 미뤄둔 마이그레이션을 마주할 차례다.' },
      { title: '끝나지 않는 마이그레이션', intro: '스키마 v1에서 v47까지, 수많은 마이그레이션이 길을 막는다...', boss: '끝나지 않는 마이그레이션', outro: '마이그레이션 완료. 백로그에는 아직 티켓이 남아 있다.' },
    ],
  },
];

export function chapterInfo(theme, chapter) {
  const written = theme.chapters[chapter - 1];
  if (written) return written;
  return {
    title: `더 깊은 곳 (챕터 ${chapter})`,
    intro: `이야기는 계속된다. 챕터 ${chapter}, 더 강한 적들이 기다리고 있다...`,
    boss: `${chapter}번째 군주`,
    outro: `챕터 ${chapter}의 군주가 쓰러졌다. 여정은 계속된다.`,
  };
}
