import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/api/supabase'

// 단계 3 임시 로비 — 첫 문제집으로 바로 플레이(퀴즈 브리지 검증용).
// 단계 5에서 문제집 선택/최근 기록이 있는 정식 로비로 교체.
function useFirstSet() {
  return useQuery({
    queryKey: ['lobby', 'first-set'],
    queryFn: async (): Promise<{ id: string; title: string } | null> => {
      const { data, error } = await supabase
        .from('quiz_sets')
        .select('id, title, is_official, created_at')
        .order('is_official', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ? { id: data.id, title: data.title } : null
    },
  })
}

export function LobbyPage() {
  const navigate = useNavigate()
  const { data: set, isLoading } = useFirstSet()

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        minHeight: '70vh',
        gap: 16,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 40, margin: 0 }}>🍓 딸기 서바이벌</h1>
      <p style={{ color: 'var(--muted)', margin: 0 }}>몬스터를 피하고 퀴즈를 맞혀 강해지세요</p>

      <button
        type="button"
        disabled={isLoading || !set}
        onClick={() => set && navigate(`/play/${set.id}`)}
        style={{
          padding: '14px 28px',
          border: 'none',
          background: set ? 'var(--primary)' : 'var(--surface-2)',
          color: '#fff',
          borderRadius: 'var(--radius)',
          fontWeight: 700,
          fontSize: 18,
          cursor: set ? 'pointer' : 'default',
        }}
      >
        {isLoading ? '불러오는 중…' : set ? `게임 시작 · ${set.title}` : '문제집이 없어요'}
      </button>

      <small style={{ color: 'var(--muted)' }}>
        단계 3 임시 로비 · 문제집 선택/기록은 이후 단계에서
      </small>
    </div>
  )
}
