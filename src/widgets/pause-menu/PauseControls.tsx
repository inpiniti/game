import { useState, type RefObject } from 'react'
import type Phaser from 'phaser'
import { BottomSheet } from '../../shared/ui/bottom-sheet/BottomSheet'
import styles from './PauseControls.module.css'

interface PauseControlsProps {
  // 게임 인스턴스는 React state가 아니라 ref로 들고 있다 — PlayPage가 game.events.emit(...)을
  // 호출할 수 있게 인스턴스를 그대로 넘겨준다 (씬이 'app:pause'/'app:resume'/'app:quit'을 구독).
  gameRef: RefObject<Phaser.Game | null>
  // 퀴즈 오버레이가 떠 있는 동안(current 존재)엔 true — 중복 일시정지 방지를 위해 버튼을 숨긴다.
  hidden: boolean
}

// 플레이 화면 우상단 [⏸] 버튼 + 일시정지 바텀시트.
// 그만하기는 게임오버로 이어지므로(씬이 내부적으로 onGameOver({reason:'quit'})를 호출) 여기서는
// 이벤트 emit만 하고 화면 전환은 PlayPage의 onGameOver 핸들러에 맡긴다.
export function PauseControls({ gameRef, hidden }: PauseControlsProps) {
  const [open, setOpen] = useState(false)

  function handlePauseClick() {
    gameRef.current?.events.emit('app:pause')
    setOpen(true)
  }

  // 딤 탭/Esc/[계속하기] 모두 이 핸들러로 통일 — "딤 탭·뒤로 = 계속하기" 규칙(screens-v3 §9)
  function handleResume() {
    gameRef.current?.events.emit('app:resume')
    setOpen(false)
  }

  function handleQuit() {
    gameRef.current?.events.emit('app:quit')
    setOpen(false)
  }

  return (
    <>
      {!hidden && (
        <button
          type="button"
          className={styles.pauseButton}
          onClick={handlePauseClick}
          aria-label="일시정지"
        >
          ⏸
        </button>
      )}

      <BottomSheet open={open} onClose={handleResume} title="일시정지">
        <div className={styles.menu}>
          <button type="button" className={styles.resumeButton} onClick={handleResume}>
            계속하기
          </button>
          <div className={styles.quitGroup}>
            <button type="button" className={styles.quitButton} onClick={handleQuit}>
              그만하기
            </button>
            <p className={styles.quitHint}>지금까지 점수로 기록돼요</p>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
