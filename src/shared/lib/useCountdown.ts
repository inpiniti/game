import { useCallback, useEffect, useState } from 'react'

/**
 * 초 단위 카운트다운. start()를 부르면 seconds 부터 1초씩 줄어들다 0에서 멈춘다.
 * 이메일 재전송 등 연타 방지 쿨다운 표시에 사용.
 */
export function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const start = useCallback(() => setRemaining(seconds), [seconds])

  return { remaining, start, isActive: remaining > 0 }
}
