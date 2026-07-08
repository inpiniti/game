import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '../pages/login/LoginPage'
import { SignupPage } from '../pages/signup/SignupPage'
import { VerifyEmailPage } from '../pages/verify-email/VerifyEmailPage'
import { LobbyPage } from '../pages/lobby/LobbyPage'
import { QuizSetListPage } from '../pages/quiz-set-list/QuizSetListPage'
import { QuizSetDetailPage } from '../pages/quiz-set-detail/QuizSetDetailPage'
import { PlayPage } from '../pages/play/PlayPage'
import { ResultPage } from '../pages/result/ResultPage'
import { RankingPage } from '../pages/ranking/RankingPage'
import { HistoryPage } from '../pages/history/HistoryPage'
import { AdminSetsPage } from '../pages/admin-sets/AdminSetsPage'
import { AdminUploadPage } from '../pages/admin-upload/AdminUploadPage'
import { RequireAuth } from './RequireAuth'
import { RequireAdmin } from './RequireAdmin'
import { RequireGuest } from './RequireGuest'
import { AppLayout } from './AppLayout'

// 단계 2: 인증 게이트 배선. screens-v3 §1 라우트 매핑 기준.
export function AppRouter() {
  return (
    <Routes>
      {/* 비로그인 전용 — 로그인 상태면 RequireGuest가 "/"로 되돌린다. 헤더·탭바 없음. */}
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* 로그인 필요 */}
      <Route element={<RequireAuth />}>
        {/* 서바이벌 플레이 · 결과는 전체화면 — 헤더/탭바 레이아웃 바깥에서 렌더 (플레이→결과 몰입) */}
        <Route path="/play/:setId" element={<PlayPage />} />
        <Route path="/result" element={<ResultPage />} />

        {/* 헤더/탭바가 있는 레이아웃 */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/sets" element={<QuizSetListPage />} />
          <Route path="/sets/:setId" element={<QuizSetDetailPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/history" element={<HistoryPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="/admin/sets" element={<AdminSetsPage />} />
            <Route path="/admin/upload" element={<AdminUploadPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
