import { useEffect, useRef, useState } from 'react'
import { Download, ImageDown, Share2, X } from 'lucide-react'
import './card-image.css'

type Props = {
  period: string; range: string; maximum: number | null; forecast: number | null
  spent: number; average: number | null; completed: number; totalDays: number; current: boolean
}
const yen = (value: number | null) => value === null ? '—' : `¥${Math.round(value).toLocaleString('ja-JP')}`

async function createImage(data: Props) {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 1080; canvas.height = data.current ? 1040 : 880
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const font = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif'
  const text = (value: string, x: number, y: number, size: number, color = '#fff', bold = false, maxWidth = 928) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${font}`
    while (ctx.measureText(value).width > maxWidth && size > 16) { size -= 1; ctx.font = `${bold ? 700 : 400} ${size}px ${font}` }
    ctx.fillStyle = color; ctx.fillText(value, x, y)
  }
  ctx.fillStyle = '#275f49'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  text('のこす家計簿', 76, 86, 29, '#e0ecd7', true)
  text(data.period, 76, 168, 42, '#fff', true)
  text(data.range, 76, 216, 28, '#e0ecd7')
  text('残せるお金　最大', 76, 310, 33)
  text(yen(data.maximum), 76, 428, 104, '#fff', true)
  let y = 490
  if (data.current) {
    text('このペースで残せるお金', 76, 510, 30, '#e0ecd7')
    text(yen(data.forecast), 76, 584, 58, '#fff', true)
    y = 650
  }
  text(data.current ? `給料日まで あと${Math.max(0, data.totalDays - data.completed)}日` : '終了した月期', 76, y, 27, '#e0ecd7')
  ctx.fillStyle = '#ffffff25'; ctx.fillRect(76, y + 30, 928, 9)
  ctx.fillStyle = '#a5bd6a'; ctx.fillRect(76, y + 30, 928 * Math.min(1, data.completed / data.totalDays), 9)
  text(`${data.completed} / ${data.totalDays}日`, 76, y + 80, 25, '#e0ecd7')
  text('使った金額', 76, y + 156, 28, '#e0ecd7')
  text('1日平均', 580, y + 156, 28, '#e0ecd7')
  text(yen(data.spent), 76, y + 220, 52, '#fff', true, 440)
  text(yen(data.average), 580, y + 220, 52, '#fff', true, 424)
  text('最大額は今後の生活費・未記録の支出を引く前の金額', 76, canvas.height - 64, 23, '#e0ecd7')
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image unavailable')), 'image/png'))
}

export default function CardImage(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const imageUrl = useRef('')
  const [image, setImage] = useState<{ url: string; file: File } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => () => { if (imageUrl.current) URL.revokeObjectURL(imageUrl.current) }, [])
  async function open() {
    setBusy(true); setMessage(''); setImage(null); dialog.current?.showModal()
    try {
      const blob = await createImage(props)
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current)
      imageUrl.current = URL.createObjectURL(blob)
      setImage({ url: imageUrl.current, file: new File([blob], `のこす家計簿-${props.period}.png`, { type: 'image/png' }) })
    } catch { setMessage('画像を作成できませんでした もう一度お試しください') }
    finally { setBusy(false) }
  }
  async function share() {
    if (!image) return
    setBusy(true); setMessage('')
    try { await navigator.share({ files: [image.file] }) }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('共有できませんでした') }
    finally { setBusy(false) }
  }
  const canShare = image && typeof navigator.share === 'function' && navigator.canShare?.({ files: [image.file] })
  return <>
    <button className="text-button card-image-entry" disabled={busy} onClick={open}><ImageDown size={16} />画像で保存</button>
    <dialog ref={dialog} className="card-image-dialog" aria-labelledby="card-image-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="card-image-content"><div className="section-heading"><h2 id="card-image-title">カードを画像で保存</h2><button className="icon-button" aria-label="閉じる" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        {image ? <><img src={image.url} alt="保存する残せるお金のカード" /><div className="card-image-actions">{canShare && <button className="primary-button" disabled={busy} onClick={share}><Share2 size={16} />共有・写真に保存</button>}<a className="outline-button card-image-download" href={image.url} download={image.file.name}><Download size={16} />画像を保存</a></div></> : busy && <p role="status">画像を作成中</p>}
        {message && <p role="status">{message}</p>}
      </div>
    </dialog>
  </>
}
