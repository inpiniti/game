# Supabase SQL 실행 가이드

모든 SQL은 **Supabase 대시보드 → SQL Editor**에서 실행한다. (notepad와 동일한 운영 방식 — CLI 마이그레이션 없음)

설계 배경: [docs/design/supabase-quiz-fsd-v8.md](../design/supabase-quiz-fsd-v8.md)

## 실행 순서

| 순서 | 파일 | 내용 | 실행 시점 |
|---|---|---|---|
| 1 | [01-init.sql](./01-init.sql) | 전체 스키마 + RLS + 랭킹 함수 | 프로젝트 생성 직후 **1회** |
| 2 | [02-seed.sql](./02-seed.sql) | 기초 영단어 공식 문제집 시드 | 01 직후 **1회** |
| 3 | [03-admin-setup.md](./03-admin-setup.md) | 관리자(1명) 등록 절차 | 관리자로 쓸 계정을 앱에서 가입한 뒤 |

## 주의

- **01·02는 멱등이 아니다** — 재실행하면 중복 데이터나 "already exists" 에러가 난다.
  처음부터 다시 만들려면 프로젝트를 새로 파거나 테이블을 직접 drop 한다.
- 스키마를 변경할 때는 기존 파일을 고치지 말고 **새 번호 파일(04-xxx.sql, 05-xxx.sql)로 추가**하고,
  이 표에 실행 이력을 한 줄 추가한다. (이미 실행된 SQL과 파일 내용이 어긋나는 것을 방지)
- 환경변수는 앱 쪽 `.env.local`에 설정: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (대시보드 → Settings → API에서 확인)
