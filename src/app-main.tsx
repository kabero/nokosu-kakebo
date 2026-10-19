import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Privacy from './Privacy'
import Tips from './Tips'
import './style.css'
import './surfaces.css'
import './print.css'

const path = window.location.pathname
if (/^\/about\/?$/.test(path)) {
  window.location.replace(import.meta.env.VITE_SITE_URL || 'https://www.nokosu-kakebo.workers.dev/')
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{/^\/tips\/?$/.test(path) ? <Tips /> : /^\/privacy\/?$/.test(path) ? <Privacy /> : <App />}</React.StrictMode>)
}
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
