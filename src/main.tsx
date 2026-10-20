import React from 'react'
import ReactDOM from 'react-dom/client'
import Landing from './Landing'
import Privacy from './Privacy'
import Tips from './Tips'
import Migration from './Migration'
import './style.css'
import './surfaces.css'
import './landing.css'
import './print.css'

const path = window.location.pathname
const content = /^\/app(?:\/index\.html|\/)?$/.test(path) ? <Migration /> : /^\/tips\/?$/.test(path) ? <Tips /> : /^\/privacy\/?$/.test(path) ? <Privacy /> : <Landing />
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{content}</React.StrictMode>)
// 旧版のキャッシュを解除する更新用Service Worker。家計データは消さない。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
