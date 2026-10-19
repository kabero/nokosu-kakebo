import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Landing from './Landing'
import Privacy from './Privacy'
import './style.css'

if (/^\/tips\/?$/.test(window.location.pathname)) window.location.replace('/#usage')
const isLanding = /^\/about\/?$/.test(window.location.pathname)
const isPrivacy = /^\/privacy\/?$/.test(window.location.pathname)
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{isPrivacy ? <Privacy /> : isLanding ? <Landing /> : <App />}</React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* 通常のブラウザ利用は継続可能 */ }) })
}
