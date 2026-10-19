import { useState } from 'react'
import { Check } from 'lucide-react'
import { initialData, validateData, type Data } from './finance'

const KEY = 'yohaku-money-v1'
function read(): Data {
  const raw = localStorage.getItem(KEY)
  if (!raw) return structuredClone(initialData)
  const value: unknown = JSON.parse(raw)
  if (!validateData(value)) throw new Error('保存済みの記録を読み込めません。家計簿の設定をご確認ください。')
  return value
}
export default function QuickSetup() {
  const [loaded] = useState(() => { try { return { data: read(), error: '' } } catch { return { data: null, error: '保存済みの記録を読み込めません。家計簿の設定をご確認ください。' } } })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(loaded.error)
  if (!loaded.data) return <p className="quick-setup-error" role="alert">{error}</p>
  const existing = loaded.data.settings.income > 0 || loaded.data.costs.length > 0
  if (saved || existing) return <p className="quick-setup-done"><Check size={15} />{saved ? '登録しました　次は使った額を入力' : '登録済み　変わったときだけ設定で修正'}</p>
  return <form className="quick-setup" onSubmit={event => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const income = Number(fields.get('income')), payday = Number(fields.get('payday'))
    if (!Number.isSafeInteger(income) || income <= 0 || income > 1000000000 || !Number.isInteger(payday) || payday < 1 || payday > 31) return
    try {
      // 他のタブで更新された記録を上書きしない。
      const latest = read()
      if (JSON.stringify(latest) !== JSON.stringify(loaded.data)) { setError('別の画面で記録が更新されました。開き直してください。'); return }
      const settings = { ...latest.settings, income, payday }
      const data = { ...latest, settings, setup: { paydayConfirmed: true, fixedCostsConfirmed: latest.setup?.fixedCostsConfirmed ?? false, dismissed: latest.setup?.dismissed ?? false } }
      localStorage.setItem(KEY, JSON.stringify(data))
      setSaved(true)
    } catch { setError('ブラウザに保存できませんでした。設定をご確認ください。') }
  }}>
    <div className="quick-fields"><label>手取り<div><input aria-label="毎月の手取り ボーナスと残業代を除く" name="income" type="number" inputMode="numeric" min="1" max="1000000000" step="1" placeholder="250000" required /><span>円</span></div></label><label>給料日<div><input name="payday" type="number" inputMode="numeric" min="1" max="31" step="1" defaultValue={loaded.data.settings.payday} required /><span>日</span></div></label><button type="submit" aria-label="設定を保存">保存</button></div>
    {error && <p className="quick-setup-error" role="alert">{error}</p>}
  </form>
}
