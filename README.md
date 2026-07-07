# RilyBox Game

Phaser v3 기반 2D 게임 프로젝트 (VS Code + Live Server).

## 실행 방법 (3단계)

1. **Live Server 설치** — VS Code 왼쪽 확장(Extensions) 메뉴에서 `Live Server` 검색 후 설치
   (이 프로젝트를 열면 자동으로 설치를 추천합니다.)
2. VS Code로 이 폴더(`rilybox-game`)를 엽니다.
3. VS Code 오른쪽 아래 **`Go Live`** 버튼을 클릭 → 브라우저가 열리며 게임이 실행됩니다.

> ⚠️ Phaser는 보안 정책상 `file://` (파일 더블클릭)로 열면 이미지 로딩 에러가 납니다.
> 반드시 Live Server 같은 로컬 서버로 실행해야 합니다.

현재 예제: **초록 사각형(플레이어)** 을 방향키로 움직이고, **갈색 사각형(나무)** 에 부딪히면 막힙니다.

## 폴더 구조

```
rilybox-game/
├── index.html          # 진입점 — Phaser CDN + 스크립트 로드
├── js/
│   ├── main.js         # 게임 전역 설정(config) + 부팅
│   └── scenes/
│       └── MainScene.js  # 메인 화면(씬): preload/create/update
├── assets/             # 이미지·사운드 등 게임 자산을 여기에 넣습니다
└── .vscode/            # 권장 확장 프로그램 설정
```

## 추천 확장 프로그램

| 확장 | 용도 |
|---|---|
| **Live Server** (`ritwickdey.LiveServer`) | 로컬 서버 + 저장 시 자동 새로고침 (필수) |
| Phaser 3 Snippets | Phaser 코드 자동완성 (선택 — 확장 메뉴에서 검색) |

디버깅은 브라우저 개발자 도구(**F12** → Console 탭)로 콘솔 로그와 에러를 확인합니다.

## 자산(그림) 만드는 워크플로우

Claude(코드 AI)는 **이미지를 직접 그리지는 못합니다.** 코드만 작성합니다.
그림은 아래처럼 역할을 나눠서 만듭니다.

1. **그림 AI로 이미지 생성** — PixelLab.ai, Scenario.gg 등에서 프롬프트로 타일/캐릭터 PNG를 뽑거나,
   [itch.io Free Assets](https://itch.io/game-assets/free)에서 무료 타일셋을 받습니다.
2. 받은 PNG를 `assets/` 폴더에 넣습니다.
3. **Claude에게 코딩 요청** — "이 이미지를 게임에 불러와서 움직이게 해줘" 처럼 배치·동작 코드를 맡깁니다.

## 다음 단계 아이디어

- `assets/`에 캐릭터 이미지를 넣고 `MainScene.preload()`에서 `this.load.image(...)`로 로드
- 여러 화면 전환(예: 타이틀 → 게임 → 결과)을 위해 씬 추가
- Tiled 맵 에디터로 만든 타일맵 불러오기
