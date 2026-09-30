// electron/renderer/story.js
// Story. Each theme is a chain of chapters (one per monster roster, in the
// order src/themes.ts gives); every chapter ends in a boss. Beyond the
// written chapters the story keeps going with generated ones — a project
// rarely ends just because one boss fell.
export const THEMES = [
  {
    id: 'adventure',
    title: '모험을 떠나기',
    chapters: [
      { title: '고대 유적의 입구', intro: '전설의 모험가가 되어, 미지의 유적에 첫 발을 내딛는다...', boss: '유적의 수호룡', outro: '수호룡이 쓰러지자, 유적 깊은 곳으로 이어지는 계단이 드러났다.' },
      { title: '잊혀진 지하 도시', intro: '계단 아래에는 수백 년 전 버려진 도시가 잠들어 있었다...', boss: '심연의 파수꾼', outro: '파수꾼의 눈빛이 꺼지고, 도시 끝에서 오래된 신전의 문이 열렸다.' },
      { title: '버전 없는 신전', intro: '버전 관리가 생기기 전 시대의 유물이 잠든 신전. 벽마다 "진짜_최종.zip"이 새겨져 있다...', boss: 'final_final_v2의 고대신', outro: '고대신이 git log 속으로 사라지고, 신전 천장의 틈 사이로 별빛이 쏟아진다.' },
      { title: '별이 떨어진 산맥', intro: '별빛을 따라 오른 산맥, 문법이 뒤엉킨 숲이 길을 막는다...', boss: '별을 삼킨 거인', outro: '거인이 무너지며 삼켰던 별을 토해 냈다. 별은 미궁을 가리키고 있다.' },
      { title: '논리의 미궁', intro: '한 칸씩 어긋난 길, 영원히 도는 시계. 논리가 비틀린 미궁이다...', boss: '미궁의 리치', outro: '리치의 부채가 모두 청산되었다. 미궁 너머로 끝없는 황야가 펼쳐진다.' },
      { title: '네트워크의 황야', intro: '찾을 수 없는 길(404)과 출처를 묻는 문지기들이 황야를 떠돈다...', boss: '환각의 키메라', outro: '키메라의 거짓말이 걷히자, 지도의 마지막 빈칸이 채워졌다. 그리고 새 지도가 펼쳐진다.' },
    ],
  },
  {
    id: 'demon-king',
    title: '마왕 잡으러 가기',
    chapters: [
      { title: '마왕성 외곽', intro: '세상을 위협하는 마왕을 물리치기 위해 검을 뽑아 든다. 성 밖엔 마왕군이 진을 쳤다...', boss: '마왕', outro: '마왕이 쓰러졌다! ...그런데 왕좌 뒤편에서 더 짙은 어둠이 꿈틀거린다.' },
      { title: '흑막의 부활', intro: '마왕은 꼭두각시에 불과했다. 진짜 흑막, 마신이 깨어났다...', boss: '마신', outro: '마신이 소멸하며 남긴 균열이 다른 차원으로 이어져 있다.' },
      { title: '차원의 틈', intro: '균열 너머, 모든 세계를 집어삼키려는 존재가 기다린다...', boss: '차원의 군주', outro: '군주가 쓰러지자 차원의 틈 너머로 거짓 예언을 속삭이는 탑이 보인다.' },
      { title: '거짓 예언의 탑', intro: '탑 꼭대기의 예언자는 확신에 찬 목소리로 없는 미래를 지어낸다...', boss: '예언의 키메라', outro: '거짓 예언이 깨지고, 진짜 마지막 성채가 모습을 드러낸다.' },
      { title: '최후의 성채', intro: '마왕군의 마지막 거점. 거대한 성채 자체가 하나의 괴물이다...', boss: '성채의 거인', outro: '세계는 구해졌다. 하지만 어딘가에서 새 마왕이 루트 권한을 얻었다는 소문이 들린다.' },
    ],
  },
  {
    id: 'debug-quest',
    title: '버그 소탕전',
    chapters: [
      { title: '레거시 모놀리스', intro: '코드 속 깊은 곳에 숨은 버그들을 소탕하러 던전에 들어선다...', boss: '레거시 코드 드래곤', outro: '드래곤을 리팩터링했다! ...그 순간 코드 곳곳에서 무언가 기어 나온다.' },
      { title: '벌레 굴', intro: '릴리스를 하루 앞둔 밤. 보려고 하면 사라지는 벌레들이 굴을 파고 있다...', boss: '릴리스 전날의 버그 여왕', outro: '여왕이 쓰러지고 릴리스 버튼이 초록색으로 빛난다. 이제 미뤄 둔 마이그레이션 차례다.' },
      { title: '끝나지 않는 마이그레이션', intro: '스키마 v1에서 v47까지, 수많은 마이그레이션이 길을 막는다...', boss: '끝나지 않는 마이그레이션', outro: '마이그레이션 완료. 그런데 AI가 리뷰 코멘트를 달기 시작했다.' },
      { title: '환각의 코드 리뷰', intro: '존재하지 않는 함수를 추천하는 리뷰어, 깨진 인코딩, 깜빡이는 테스트...', boss: 'AI 환각 키메라', outro: '리뷰가 승인되었다. 배포 직후, 모니터링 대시보드가 붉게 물든다.' },
      { title: '새벽 3시의 장애', intro: '배포 직후 알람이 울린다. 온콜은 바로 당신이다...', boss: '새벽 3시의 장애 드래곤', outro: '장애가 복구됐다. 포스트모템을 쓰고 나면... 백로그에는 아직 티켓이 남아 있다.' },
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
