# 프롬프트 배틀

**한국어** | [English](README.en.md)

실제 AI 코딩을 턴제 RPG로 감싼 게임. 입력하는 프롬프트가 곧 공격이다 — 길고 구체적일수록 더 세게 때린다. 그리고 게임 속에서 AI가 Claude Agent SDK로 내 프로젝트의 파일을 실제로 읽고, 고치고, 명령어를 실행한다.

## 기능

- **프롬프트 = 공격** — 길수록, 키워드("step by step", "test", "edge case", "refactor", "why", "example")가 들어갈수록 데미지 증가. 키워드 2개 이상이면 크리티컬.
- **실시간 타격** — AI가 명령어를 실행하거나 파일을 수정할 때마다 그 순간 데미지가 들어간다. 건드린 파일은 실제 파일 아이콘이 몬스터에게 날아간다.
- **플레이어 HP** — 턴이 끝나도 살아남은 몬스터는 반격한다 (망설이거나 공격이 실패하면 더 아프게). HP 0이면 패배. 층을 클리어하면 체력 회복.
- **무기 = Claude 모델** — Haiku 단검 (x0.8), Sonnet 장검 (x1), Opus 마검 (x1.25), Fable 전설의 성검 (x1.5). 전투 중에도 언제든 교체 가능.
- **스토리 테마와 챕터** — 모험을 떠나기 / 마왕 잡으러 가기 / 버그 소탕전. 6층마다 챕터 보스가 등장하고, 쓰러뜨리면 다음 이야기가 이어진다. 진행 상황이 저장돼서 다음에 켜면 이어서 할 수 있다.
- **인벤토리** — 사이드바에 프로젝트 파일 트리가 보이고, 파일을 열어서 보거나 직접 수정해서 저장할 수 있다 (프로젝트 폴더 안의 파일만 저장 가능).
- **보기 편한 AI 응답** — 마크다운으로 렌더링되고, AI가 질문 + 목록으로 물어보면 클릭 가능한 선택지로 바뀐다.
- **세션 관리** — 게임을 시작할 때마다 항상 새 Claude 세션으로 시작. 컨텍스트가 80%를 넘으면 새 세션으로 이어갈 수 있는 `/new ...` 프롬프트를 띄워준다.

## Mac 앱

```bash
git clone https://github.com/tpgusgh/prompt-engineering-is-game.git
cd prompt-engineering-is-game
npm install
npm run electron:build
```

`release/` 폴더에 `.dmg`가 생긴다. 열어서 프롬프트 배틀을 응용 프로그램 폴더로 드래그하거나, 빌드된 `.app`을 바로 실행하면 된다.

**처음 실행할 때:** macOS가 "확인되지 않은 개발자" 경고를 띄울 수 있다 — 공증(notarization)을 받지 않은 앱이라서 그렇다 (유료 Apple Developer 계정 필요). 앱을 우클릭 → 열기 → 확인. 한 번만 하면 된다. (Mac에 Apple Development 서명 인증서가 있으면 `electron-builder`가 자동으로 사용해서 경고가 안 뜰 수도 있다.) 현재는 Apple Silicon(arm64)만 지원.

## CLI

```bash
npm install
npm link
promptbattle --difficulty normal
```

작업할 프로젝트 폴더 안에서 실행. `/quit` 또는 `/flee`로 나가기, `/new <프롬프트>`로 새 세션 시작. Node.js 22.18.0 이상 필요 (TypeScript를 빌드 없이 바로 실행). npm에 배포된 패키지를 `npm install -g`로 설치하면 동작하지 않는다 — Node가 `node_modules` 안의 `.ts`는 실행하지 않기 때문. clone 후 `npm link`로 설치할 것.

## 설정

API 키 필요 없음: 이미 로그인된 Claude Code 계정(예: Claude 구독)을 그대로 사용한다. API 키를 쓰고 싶다면 `ANTHROPIC_API_KEY`를 설정하면 SDK가 그걸 사용한다. 단, Finder에서 실행한 앱은 쉘 환경변수를 물려받지 않으니 Mac 앱에서는 Claude Code 로그인 방식이 확실하다.

## 주의사항

AI는 파일/명령어 실행을 매번 확인받지 않고 완전 자율로 수행한다 (`claude --dangerously-skip-permissions`와 같음). 믿을 수 있는 프로젝트에서만 사용할 것. 사용 가능한 도구는 Read/Write/Edit/Bash/Glob/Grep으로 제한된다. 한 판은 하나의 이어지는 Claude Code 세션이라, 층이 올라갈수록 긴 `claude` 세션처럼 컨텍스트와 비용이 늘어난다.

## 한계

- CLI에서 Ctrl+C를 누르면 `/quit`처럼 저장하고 끝나지만, 이미 진행 중인 턴은 (전체 권한으로) 끝까지 실행된 뒤 종료된다.
- 아직 npm 레지스트리 배포는 안 함 — 저장소에서 설치.
