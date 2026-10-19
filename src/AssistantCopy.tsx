import { useId, useRef, useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { consultationText } from './consultation'
import type { Data, getPeriod } from './finance'
import './ai-copy.css'

type Props = { data: Data; period: ReturnType<typeof getPeriod>; today: Date; compact?: boolean }
export default function AiCopy({ data, period, today, compact = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const [includeDaily, setIncludeDaily] = useState(false)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const text = consultationText({ data, period, today, includeDaily })
  function changed() { setCopied(false); setMessage('') }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setMessage('') }
    catch { preview.current?.focus(); preview.current?.select(); setMessage('選択した文章をコピーしてください') }
  }
  return <>
    <button className={compact ? 'text-button ai-copy-entry' : 'outline-button'} onClick={() => { changed(); dialog.current?.showModal() }}><Copy size={16} />AIに相談用コピー</button>
    <dialog ref={dialog} className="ai-copy-dialog" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="ai-copy-content"><div className="section-heading"><h2 id={titleId}>AIに渡す家計データ</h2><button className="icon-button" aria-label="閉じる" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <p className="ai-copy-privacy">手取り・固定費・メモは含みません<br />ご自身のAIに貼り付ける前に内容を確認してください</p>
        <label className="ai-copy-daily"><input type="checkbox" checked={includeDaily} onChange={event => { setIncludeDaily(event.target.checked); changed() }} />日別の生活費も含める</label>
        <textarea ref={preview} aria-label="AIに渡す家計データ" value={text} readOnly rows={9} />
        <button className="primary-button full-width" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'コピー済み' : 'コピー'}</button>
        {message && <p className="ai-copy-status" role="status">{message}</p>}
      </div>
    </dialog>
  </>
}
