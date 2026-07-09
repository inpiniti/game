import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// public/ 는 기본값으로 정적 서빙 (assets/, map/ → /assets, /map)
export default defineConfig({
  plugins: [react()],
  // notepad(5174) · trends(5173) 자매 프로젝트와 포트 충돌 방지
  server: { port: 5175 },
})
