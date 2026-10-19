import { useRef, useState } from 'react'
import { Check, Copy, Share2, X } from 'lucide-react'

export default function ReportShare({ title, text }: { title: string; text: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const nativeShare = typeof navigator.share === 'function'
  async function share() {
    setBusy(true); setMessage('')
    try { await navigator.share({ title, text }); dialog.current?.close() }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('共有できませんでした　コピーして送れます') }
    finally { setBusy(false) }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true); setMessage('コピーしました')
    } catch {
      preview.current?.focus(); preview.current?.select()
      setMessage('選択した文章をコピーしてください')
    }
  }
  return <>
    <button className="outline-button" onClick={() => { setCopied(false); setMessage(''); dialog.current?.showModal() }}><Share2 size={16} />シェア</button>
    <dialog className="report-share-dialog" ref={dialog} aria-labelledby="report-share-title" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close() }}>
      <div className="report-share-content"><div className="section-heading"><h2 id="report-share-title">レポートをシェア</h2><button className="icon-button" aria-label="閉じる" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <p className="report-share-privacy">手取り・固定費の情報は含まれません</p><textarea ref={preview} aria-label="共有する内容" value={text} readOnly rows={7} />
        <div className="report-share-actions">{nativeShare && <button className="primary-button" disabled={busy} onClick={share}><Share2 size={16} />共有</button>}<button className="outline-button" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'コピー済み' : 'コピー'}</button></div>
        <p className="report-share-status" role="status">{message}</p>
      </div>
    </dialog>
  </>
}
