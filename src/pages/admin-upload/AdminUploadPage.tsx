import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../../entities/user'
import { UploadQuizSetForm } from '../../features/upload-quiz-set'
import styles from './AdminUploadPage.module.css'

// 관리 · 업로드 `/admin/upload` (screens-v3 §13) — UploadQuizSetForm을 official 모드로 재사용해
// 국가 지정 + is_official=true로 공식 문제집을 등록한다. 성공하면 목록에서 바로 확인하도록 /admin/sets로 이동.
export function AdminUploadPage() {
  const { t } = useTranslation()
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
          {t('adminUpload.backLink')}
        </Link>
        <h1 className={styles.title}>{t('adminUpload.title')}</h1>
        <p className={styles.desc}>{t('adminUpload.desc')}</p>
      </header>

      {userId ? (
        <UploadQuizSetForm userId={userId} onSuccess={handleSuccess} official />
      ) : (
        <p className={styles.notice}>{t('adminUpload.loadingUser')}</p>
      )}
    </div>
  )
}
