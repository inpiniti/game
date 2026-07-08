import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// public/ 는 기본값으로 정적 서빙 (assets/, map/ → /assets, /map)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
