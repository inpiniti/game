export type UserRole = 'user' | 'admin'

// docs/sql/01-init.sql `profiles` 테이블과 대응.
export interface Profile {
  id: string
  nickname: string
  country: string
  role: UserRole
}
