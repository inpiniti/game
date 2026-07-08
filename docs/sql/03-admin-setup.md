# 관리자 등록 (최초 1회)

관리자는 **한 명만** 둔다. 별도 가입 경로는 없고, 일반 가입한 계정을 SQL로 승격한다.

`profiles.role` 컬럼은 클라이언트에서 수정할 수 없게 컬럼 권한으로 막혀 있으므로
(01-init.sql의 `grant update (nickname, country)` 참고), 승격·강등은 항상 여기 SQL로만 한다.

## 절차

1. 앱에서 관리자로 쓸 계정을 **일반 회원가입**한다.
2. Supabase 대시보드 → **SQL Editor**에서 아래를 실행한다 (이메일만 바꿔서):

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = '관리자이메일@example.com');
```

3. 확인:

```sql
select u.email, p.nickname, p.country, p.role
from profiles p join auth.users u on u.id = p.id
where p.role = 'admin';
```

→ 1행이 나와야 한다.

4. 앱에서 재로그인(또는 새로고침) → 헤더에 **"관리" 메뉴**가 보이면 완료.

## 참고

- **강등** (관리자 교체 시 기존 계정 먼저 강등):

```sql
update profiles set role = 'user'
where id = (select id from auth.users where email = '기존관리자@example.com');
```

- 프론트의 관리자 메뉴 가드는 UX용일 뿐이고, 실제 권한 경계는 RLS의 `is_admin()`이다.
  role이 'user'인 계정은 URL을 직접 쳐서 관리자 화면에 들어가도 공식 문제집을 쓰지 못한다.
