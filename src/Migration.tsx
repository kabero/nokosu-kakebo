import { useState } from 'react'
import { ArrowRight, Download, Trash2 } from 'lucide-react'
import { appUrl } from './siteUrls'
import BrandMark from './BrandMark'
import './privacy.css'

const KEY = 'yohaku-money-v1'
export function hasLegacyData() {
  try { return localStorage.getItem(KEY) !== null } catch { return false }
}
export default function Migration() {
  const [hasData, setHasData] = useState(hasLegacyData)
  const [exported, setExported] = useState(false)
  const [message, setMessage] = useState('')
  function download() {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw === null) { setHasData(false); return }
      // 読み込みや変換で元データを壊さないよう、保存内容をそのまま書き出す。
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'nokosu-kakebo-backup.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setExported(true); setMessage('新しい家計簿の「設定」でファイルを読み込んでください')
    } catch { setMessage('書き出せませんでした ブラウザの設定をご確認ください') }
  }
  return <div className="privacy-page"><header className="privacy-header"><a className="privacy-brand" href="/"><BrandMark /><span>のこす家計簿</span></a></header><main className="privacy-main"><h1>家計簿のURLが変わりました</h1><p className="privacy-lead">家計の記録と紹介ページを分けました。これからは新しい家計簿をお使いください。</p>
    {hasData ? <section><h2>このブラウザの記録を移す</h2><ol><li>バックアップを書き出す</li><li>新しい家計簿の「設定」で読み込む</li><li>移せたことを確認して このURLの記録を削除する</li></ol><button className="outline-button" onClick={download}><Download size={17} />バックアップを書き出す</button><p>ホーム画面に追加していた場合は、そのアイコンからも書き出してください。移行前にアイコンやブラウザのデータを削除しないでください。</p></section> : <p className="privacy-lead">このブラウザには以前の記録がありません。</p>}
    <a className="privacy-return" href={appUrl} target="_blank" rel="noopener noreferrer">新しい家計簿を開く <ArrowRight size={17} /></a>
    {hasData && exported && <section><h2>移行できたら</h2><p>新しい家計簿に記録が揃っていることを確認してください。削除するまで以前の記録はこのURLにも残ります。</p><button className="reset-button" onClick={() => { if (!confirm('新しい家計簿への移行を確認しましたか？ このURLに残る記録を削除します。取り消せません。')) return; try { localStorage.removeItem(KEY); localStorage.removeItem('nokori-install-v1'); setHasData(false); setMessage('このURLの記録を削除しました') } catch { setMessage('削除できませんでした') } }}><Trash2 size={16} />移行元の記録を削除</button></section>}
    {message && <p role="status">{message}</p>}
  </main></div>
}
