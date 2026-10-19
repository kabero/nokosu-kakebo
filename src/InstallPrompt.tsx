import { useEffect, useRef, useState } from 'react'
import { Download, X, ChevronRight } from 'lucide-react'
import BrandMark from './BrandMark'
import './install-promotion.css'

type InstallEvent = Event & { prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }> }
const KEY = 'nokori-install-v1'
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: minimal-ui)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const write = (value: string) => { try { localStorage.setItem(KEY, value) } catch { /* 今回の表示状態はメモリにも保持する */ } }

export default function InstallPrompt({ recorded, showEntry, promoted = false }: { recorded: boolean; showEntry: boolean; promoted?: boolean }) {
  const [event, setEvent] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(() => standalone() || read() === 'installed')
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => read() === 'dismissed')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [firstSave, setFirstSave] = useState(false)
  const previous = useRef(recorded)
  const handled = useRef(!!read())
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    if (!previous.current && recorded) setFirstSave(true)
    previous.current = recorded
  }, [recorded])
  useEffect(() => {
    const ready = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); setInstalled(false) }
    const done = () => { write('installed'); setInstalled(true); setOpen(false); setEvent(null) }
    const mode = window.matchMedia('(display-mode: standalone)')
    const check = () => { if (standalone()) done() }
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', done)
    mode.addEventListener('change', check)
    check()
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done); mode.removeEventListener('change', check) }
  }, [])
  useEffect(() => {
    if (!firstSave || handled.current || installed || (!event && !ios)) return
    const timer = setTimeout(() => {
      if (document.querySelector('dialog[open]')) return
      handled.current = true; write('shown'); setOpen(true)
    }, 1200)
    return () => clearTimeout(timer)
  }, [firstSave, installed, event, ios])
  useEffect(() => {
    if (open) { opener.current = document.activeElement as HTMLElement; dialog.current?.showModal() }
    else { dialog.current?.close(); opener.current?.focus() }
  }, [open])
  function close() { setDismissed(true); handled.current = true; write(installed ? 'installed' : 'dismissed'); setOpen(false) }
  async function install() {
    if (!event) return
    setBusy(true)
    try {
      const result = await event.prompt()
      setEvent(null)
      if (result.outcome === 'accepted') { write('installed'); setInstalled(true); setOpen(false) }
      else close()
    } catch { setEvent(null); setMessage('ブラウザのメニューから追加できます。') }
    finally { setBusy(false) }
  }
  const showPromotion = promoted && !dismissed && (ios || !!event)
  const openGuide = () => { setMessage(''); setOpen(true) }
  return <>
    {showEntry && !installed && (showPromotion ? <section className="install-promotion" aria-label="ホーム画面から使う"><div className="install-promotion-icon"><BrandMark /></div><div className="install-promotion-copy"><strong>いつものアプリと同じように使える</strong><p>ホーム画面に置いて 専用の画面で記録できます</p><button className="primary-button" onClick={openGuide}>ホーム画面に追加 <ChevronRight size={15} /></button></div><button className="icon-button install-promotion-close" aria-label="追加の案内を閉じる" onClick={() => { setDismissed(true); handled.current = true; write('dismissed') }}><X size={17} /></button></section> : <button className="install-settings" onClick={openGuide}><Download size={16} />ホーム画面に追加 <ChevronRight size={16} /></button>)}
    <dialog className="install-dialog" ref={dialog} aria-labelledby="install-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className="install-content"><button className="icon-button install-close" aria-label="閉じる" onClick={close}><X size={19} /></button><BrandMark className="install-mark" /><h2 id="install-title">家計簿をホーム画面に</h2><p>アイコンから起動して 普通のアプリのように使えます</p>
        {event ? <button className="primary-button full-width" disabled={busy} onClick={install}><Download size={16} />ホーム画面に追加</button> : ios ? <><ol><li>ブラウザの共有メニューを開く</li><li>「ホーム画面に追加」を選ぶ</li><li>「追加」を押す</li></ol><p>項目が見つからない場合はSafariで開いてください。</p></> : <p>ブラウザのメニューにある「インストール」または「ホーム画面に追加」を選んでください。項目がない場合は、対応する別のブラウザでお試しください。</p>}
        {message && <p role="status">{message}</p>}
        <button className="text-button install-later" onClick={close}>閉じる</button>
      </div>
    </dialog>
  </>
}
