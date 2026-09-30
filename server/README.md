# 프롬프트 배틀 랭킹 서버 (Vercel)

`GET /api/ranking` — 상위 100명 · `POST /api/ranking?action=start` — 판 시작 토큰 · `POST /api/ranking` — 점수 등록.
의존성 없음 (Upstash Redis REST를 fetch로 호출).

## 배포

1. Vercel에서 새 프로젝트를 만들고 **Root Directory를 `server`** 로 지정해 이 저장소를 연결한다 (또는 `cd server && npx vercel`).
2. 프로젝트 → Storage(Marketplace)에서 **Upstash Redis** 를 추가하고 프로젝트에 연결한다. `KV_REST_API_URL` / `KV_REST_API_TOKEN` (또는 `UPSTASH_REDIS_REST_*`) 환경 변수가 자동으로 생긴다.
3. 환경 변수 두 개를 직접 추가한다 (아무도 모르는 긴 랜덤 문자열, 예: `openssl rand -hex 32`):
   - `RANKING_APP_SECRET` — 앱이 요청에 서명하는 키. **GitHub 저장소 Secret에도 같은 값으로** 넣는다 (아래).
   - `RANKING_SERVER_SECRET` — 서버만 아는 키 (판 토큰 서명용). 다른 곳에 넣지 않는다.
4. 배포 후 주소(예: `https://prompt-battle-ranking.vercel.app`)를 확인한다.

## 앱에 연결 (GitHub 저장소 설정)

Settings → Secrets and variables → Actions 에서:
- Secret `RANKING_APP_SECRET` = 3번의 값
- Variable `RANKING_URL` = 4번의 주소

이후 릴리스 빌드에만 키가 들어간다 (`scripts/inject-ranking-config.mjs`). 저장소 코드에는 키가 없어서, 소스에서 직접 빌드한 앱이나 손으로 만든 요청은 등록할 수 없다.

## 막는 것 / 못 막는 것

- 서명 없는 요청(curl 등), 키가 틀린 요청, 서명 뒤 내용을 바꾼 요청, 5분 지난 요청 → 거절
- 판 토큰은 서버가 발급·서명하고 한 번만 쓸 수 있다 (재전송 불가), 판 시작 30초 이내 제출 불가
- 점수는 서버가 전투 기록(층·보스·경험치·난이도)으로 다시 계산해 맞아야 한다. 경과 시간에 비해 너무 많이 깬 기록은 거절
- 같은 IP는 20초에 한 번
- 한계: 게임은 사용자 컴퓨터에서 돌기 때문에, 앱 파일을 뜯어 키를 꺼낸 사람이 그럴듯한 기록을 만드는 것까지는 완전히 막을 수 없다. 키가 새면 `RANKING_APP_SECRET` 를 바꾸고 새 버전을 릴리스하면 이전 앱의 등록이 막힌다.
