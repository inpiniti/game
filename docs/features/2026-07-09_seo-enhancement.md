# 기능: game SEO + 로고 완성 + notepad 갭 보완 — 3개 프로젝트 SEO 통일

> 작성일: 2026-07-09 · 기준: [trends/index.html](../../../trends/index.html) (완성형 SEO 템플릿) · 분류: **중형**

## 1. 왜

trends는 SEO 풀세트(메타태그·구조화 데이터·robots·sitemap·Twitter Card)를 갖춘 완성형이나, **game은 백지, notepad는 canonical·Twitter Card 누락** 상태다:

| 항목 | notepad | trends | **game** |
|---|---|---|---|
| favicon | vite.svg (기본) | ✅ 딸기 favicon.svg | ❌ 없음 |
| title/description/keywords | ✅ | ✅ | ❌ title만 |
| canonical | ❌ | ✅ | ❌ |
| Open Graph | ✅ | ✅ | ❌ |
| Twitter Card | ❌ | ✅ | ❌ |
| JSON-LD 구조화 데이터 | ✅ WebSite | ✅ WebSite+WebApplication | ❌ |
| 숨김 SEO article | ✅ | ✅ | ❌ |
| robots.txt / sitemap.xml | ✅ | ✅ | ❌ |
| 구글 서치콘솔 인증 | ✅ | ✅ | ✅ (이미 있음) |

game도 검색 노출과 SNS 공유가 가능하도록 trends 패턴을 준용해 채운다. 로고도 자매 프로젝트와 동일한 딸기 아이덴티티(rose 배경 + 흰 딸기 SVG)로 맞춘다.

## 2. 핵심 설계 결정

| 항목 | 정책 | 비고 |
|---|---|---|
| **favicon** | trends의 [favicon.svg](../../../trends/public/favicon.svg)와 동일한 딸기 SVG를 `public/favicon.svg`로 복제 | 3개 프로젝트 브랜드 통일. 배경 rose(#f43f5e) 유지 |
| **canonical** | `https://ddalki-survival.vercel.app/` (self-referential) | SPA 단일 URL |
| **robots meta** | `index, follow` | trends 동일 |
| **hreflang** | `ko` + `x-default`만 | 30언어 i18n은 localStorage 기반(URL 분리 없음) → 언어별 hreflang 불가 |
| **title/문안** | "딸기 서바이벌 - Ddalki Survival" + 영단어 서바이벌 게임 키워드 | 게임 실제 콘텐츠(영단어 학습 게임, SRS 복습, 글로벌 랭킹) 기반으로 작성 |
| **JSON-LD** | `WebSite` + `WebApplication`(applicationCategory: GameApplication) 2개 | trends 패턴 준용, 게임이므로 GameApplication |
| **숨김 article** | `<div id="root">` 안에 display:none article (React 마운트 시 대체) | notepad·trends 동일 패턴 |
| **robots.txt / sitemap.xml** | trends 포맷 그대로, URL만 ddalki-survival로 | lastmod 2026-07-09 |
| **theme-color** | 기존 `#12121a` 유지 | game은 다크 테마 — 변경하지 않음 |

## 3. 화면 변경 (델타)

없음 — index.html `<head>`와 public/ 정적 파일만 추가. 앱 UI(헤더 🍓 이모지 로고)는 그대로 둔다 (브라우저 탭 파비콘만 신규).

## 4. 플랜 — 단계 × 스킬 × 모델

의존 순서: `(1 ∥ 2 ∥ N) → 3 → 4` (1·2·N 병렬 가능, game·notepad는 독립 저장소)

| 단계 | 작업 | 사용 스킬 | 에이전트 모델 (effort) | 완료 기준 |
|---|---|---|---|---|
| 1 | game `public/favicon.svg` 생성 (trends 딸기 SVG 복제) + `public/robots.txt`·`public/sitemap.xml` 생성 (ddalki-survival URL) | — | Haiku (low, thinking X) | public/에 3개 파일 존재, URL이 ddalki-survival.vercel.app |
| 2 | game `index.html` SEO 풀세트 작성 — favicon 링크, title 확장, description/keywords, canonical, robots, hreflang, OG, Twitter Card, JSON-LD(WebSite + WebApplication/GameApplication), 숨김 SEO article. 문안은 게임 실제 기능(영단어 서바이벌, SRS, 국가별 랭킹) 기반 | — | Sonnet (medium, thinking O) | index.html에 위 메타태그 전부 존재, 문안이 게임 콘텐츠와 일치 |
| N | notepad `index.html` 갭 보완 — canonical(ddalki-note) + Twitter Card(summary_large_image, 기존 title/description 재사용) 추가. 기존 태그·순서 유지, 누락분만 삽입 | — | Haiku (low, thinking X) | notepad index.html에 canonical·twitter:card·twitter:title·twitter:description 존재 |
| 3 | 검증: game `npm run build` 통과 + game·notepad JSON-LD/메타 문법 확인(json 파싱) + 파비콘 링크 경로 확인 | — | Haiku (low, thinking X) | 빌드 성공, JSON-LD 유효 JSON |
| 4 | 커밋 (game·notepad 각 저장소) | — | Haiku (low, thinking X) | 각 저장소 git log에 SEO 커밋 1건씩 |

> 스킬: 설치된 스킬·세션 스킬에 SEO 전용 스킬 없음. 기준 템플릿(trends/index.html)이 이미 완성형이라 외부 스킬 검색 없이 준용으로 충분 — 비워둠.

## 5. 하지 않는 것 (명시적 범위 제외)

- ❌ **og:image / twitter:image** — 기준인 notepad·trends에도 없음. SVG는 SNS 크롤러가 미지원이라 PNG 제작이 필요해 별도 작업으로 분리
- ❌ **notepad 딸기 파비콘 교체** (현재 vite.svg) — 이번 갭 보완은 canonical·Twitter Card만. 파비콘 교체는 별도
- ❌ **trends 손대기** — 이미 완성형. 기준 템플릿이므로 변경 없음
- ❌ **언어별 hreflang 30개** — URL이 언어를 구분하지 않아 적용 불가
- ❌ **헤더 UI 로고 변경** — 앱 내 🍓 이모지는 그대로. 이번 "로고"는 파비콘/브랜드 아이콘
- ❌ **네이버 서치어드바이저 인증** — notepad에만 있고 game 인증 키가 없음. 사용자가 키 발급 시 후속

## 6. 리스크

| 리스크 | 대응 |
|---|---|
| JSON-LD 문법 오류 → 구조화 데이터 무효 | 3단계에서 script 블록을 추출해 JSON 파싱 검증 |
| 숨김 article이 React 마운트 전 잠깐 보임 | display:none 인라인 스타일 — notepad·trends에서 이미 검증된 패턴 |
| game의 다크 theme-color(#12121a)와 rose 파비콘 부조화 | 파비콘은 자체 rose 배경을 가져 탭에서 독립적으로 보임 — 영향 없음 |
