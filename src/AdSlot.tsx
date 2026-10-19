import { useEffect, useRef } from 'react'
import { adClient, adSlot, adsEnabled } from './ads'

declare global { interface Window { adsbygoogle?: { push(value: Record<string, never>): void } } }

export default function AdSlot() {
  const element = useRef<HTMLModElement>(null)
  useEffect(() => {
    if (!adsEnabled) return
    let script = document.querySelector<HTMLScriptElement>('script[data-zubora-adsense]')
    if (!script) {
      script = document.createElement('script')
      script.async = true
      script.crossOrigin = 'anonymous'
      script.dataset.zuboraAdsense = 'true'
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`
      document.head.appendChild(script)
    }
    // StrictModeや再レンダリングで同じ枠を二度初期化しない。
    if (element.current && !element.current.dataset.requested) {
      element.current.dataset.requested = 'true'
      try { (window.adsbygoogle = window.adsbygoogle || ([] as Record<string, never>[])).push({}) } catch { /* 広告が利用できなくても本文は表示する */ }
    }
  }, [])
  if (!adsEnabled) return null
  return <aside className="lp-ad" aria-label="広告"><span>広告</span><ins ref={element} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={adClient} data-ad-slot={adSlot} data-ad-format="auto" data-full-width-responsive="true" /></aside>
}
