import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../entities/user'
import { UploadQuizSetForm } from '../../features/upload-quiz-set'
import styles from './AdminUploadPage.module.css'

// 관리 · 업로드 `/admin/upload` (screens-v3 §13) — UploadQuizSetForm을 official 모드로 재사용해
// 국가 지정 + is_official=true로 공식 문제집을 등록한다. 성공하면 목록에서 바로 확인하도록 /admin/sets로 이동.
export function AdminUploadPage() {
  const navigate = useNavigate()
  const { session } = useCurrentUser()
  const userId = session?.user.id

  const handleSuccess = () => {
    navigate('/admin/sets')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/admin/sets" className={styles.backLink}>
          ← 관리로 돌아가기
        </Link>
        <h1 className={styles.title}>공식 문제집 업로드</h1>
        <p className={styles.desc}>국가를 지정하면 그 국가의 모든 유저가 플레이할 수 있는 공식 문제집이 돼요.</p>
      </header>

      {userId ? (
        <UploadQuizSetForm userId={userId} onSuccess={handleSuccess} official />
      ) : (
        <p className={styles.notice}>사용자 정보를 불러오는 중이에요…</p>
      )}
    </div>
  )
}
