import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './app/styles/global.css'
import './shared/i18n' // 렌더 전에 i18next 초기화 (언어 resolve 포함)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
