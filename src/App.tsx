import { useEffect, useRef, useState } from 'react'
import { ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Download, House, LayoutDashboard, Plus, ReceiptText, Settings as SettingsIcon, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { dateKey, dayCount, getPeriod, initialData, parseDate, summarize, forecastSavings, validateData, migrateLegacyCosts, copyFixedCosts, carryForwardFixedCosts, markFixedCostPeriod, type Cost, type Data, type Expense, recordDailyAmount, type Draft } from './finance'

import ExpenseCalendar from './ExpenseCalendar'
import SetupSteps from './SetupSteps'
import BrandMark from './BrandMark'
import PaydayCountdown from './PaydayCountdown'
import InstallPrompt from './InstallPrompt'
import Charts from './Charts'
import AiCopy from './AssistantCopy'
import CardImage from './CardImage'

// アプリ名の変更後も既存の記録を引き継ぐため、保存キーは維持する。
const STORAGE_KEY = 'yohaku-money-v1'
const yen = (n: number) => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n)
const shortDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
const longDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`
type View = 'overview' | 'history' | 'costs' | 'charts' | 'settings'
type Modal = { type: 'expense'; expense?: Expense } | { type: 'cost'; kind: 'fixed' | 'extra'; cost?: Cost } | null

function loadData(): { data: Data; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { data: initialData, error: '' }
    const parsed: unknown = JSON.parse(saved)
    if (!validateData(parsed)) throw new Error()
    return { data: carryForwardFixedCosts(migrateLegacyCosts(parsed, new Date()), new Date()), error: '' }
  } catch { return { data: initialData, error: '保存データを読み込めませんでした。元のデータを上書きしないよう、保存を停止しています。バックアップを読み込むか、設定から新しく始めてください。' } }
}

export default function App() {
  const [loaded] = useState(loadData)
  const [data, setData] = useState<Data>(loaded.data)
  const [storageBlocked, setStorageBlocked] = useState(!!loaded.error)
  const [error, setError] = useState(loaded.error)
  const [view, setView] = useState<View>(() => window.location.hash === '#usage' ? 'settings' : 'overview')
  useEffect(() => { window.scrollTo({ top: 0 }) }, [view])
  const [offset, setOffset] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [calendarDate, setCalendarDate] = useState<string | null>(null)
  const [setupField, setSetupField] = useState<'income' | 'payday' | null>(null)
  const incomeInput = useRef<HTMLInputElement>(null)
  const paydayInput = useRef<HTMLInputElement>(null)
  const [today, setToday] = useState(() => parseDate(dateKey(new Date())))
  const fileInput = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const period = getPeriod(today, data.settings, offset)
  const periodLabel = `${period.month}月期`
  const summary = summarize(data, period)
  const forecast = forecastSavings(data, period, today)
  const setup = data.setup ?? { paydayConfirmed: data.settings.income > 0, fixedCostsConfirmed: data.costs.some(c => c.kind === 'fixed'), dismissed: false }
  const setupComplete = data.settings.income > 0 && setup.paydayConfirmed && setup.fixedCostsConfirmed
  const fixedCosts = summary.costs.filter(c => c.kind === 'fixed')
  const previousPeriod = getPeriod(today, data.settings, offset - 1)
  const previousFixedCosts = data.costs.filter(c => c.kind === 'fixed' && c.period === previousPeriod.key)
  useEffect(() => {
    if (view === 'settings' && setupField) (setupField === 'income' ? incomeInput : paydayInput).current?.focus()
  }, [view, setupField])
  const todayKey = dateKey(today)
  const todayExpenses = data.expenses.filter(e => e.date === todayKey)
  const todayTotal = todayExpenses.reduce((s, e) => s + e.amount, 0)
  const todayLogged = data.loggedDates.includes(todayKey) || todayExpenses.length > 0
  const resumeDraft = Object.entries(data.drafts ?? {}).filter(([key]) => key <= todayKey).sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0]
  const completed = Math.min(period.totalDays, Math.max(0, dayCount(period.start, today)))
  const notify = (message: string) => setToast(message)
  useEffect(() => { setData(d => carryForwardFixedCosts(d, today)) }, [data, today])
  useEffect(() => {
    if (storageBlocked) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setError('') }
    catch { setError('ブラウザに保存できません。バックアップを書き出してデータを保管してください。') }
  }, [data, storageBlocked])
  useEffect(() => {
    const update = () => {
      const key = dateKey(new Date())
      setToday(previous => dateKey(previous) === key ? previous : parseDate(key))
    }
    const timer = setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => {
    if (modal) { openerRef.current = document.activeElement as HTMLElement; dialogRef.current?.showModal() }
    else { dialogRef.current?.close(); openerRef.current?.focus() }
  }, [modal])

  function openCalendar(date = offset === 0 ? todayKey : dateKey(period.end)) {
    const target = getPeriod(parseDate(date), data.settings)
    const current = getPeriod(today, data.settings)
    setOffset((target.year - current.year) * 12 + target.month - current.month)
    setCalendarDate(date)
    setView('history')
  }
  function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const expense: Expense = { id: modal?.type === 'expense' && modal.expense ? modal.expense.id : crypto.randomUUID(), date: String(form.get('date')), amount: Number(form.get('amount')), note: String(form.get('note')).trim() }
    if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0 || expense.amount > 1000000000 || expense.date > todayKey) return
    setData(d => ({ ...d, expenses: [...d.expenses.filter(e => e.id !== expense.id), expense], loggedDates: [...new Set([...d.loggedDates, expense.date])] }))
    setModal(null); notify('金額を入力しました')
  }
  function saveCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (modal?.type !== 'cost') return
    const form = new FormData(event.currentTarget)
    const cost: Cost = { id: modal.cost?.id || crypto.randomUUID(), name: String(form.get('name')).trim(), amount: Number(form.get('amount')), kind: modal.kind, period: period.key }
    if (!cost.name || !Number.isSafeInteger(cost.amount) || cost.amount < 1 || cost.amount > 1000000000) return
    setData(d => { const updated = { ...d, costs: [...d.costs.filter(c => c.id !== cost.id), cost] }; return cost.kind === 'fixed' ? markFixedCostPeriod(updated, period.key) : updated }); setModal(null); notify('支出を保存しました')
  }
  function removeExpense(id: string) {
    if (!confirm('この支出を削除しますか？ この日は記録済みのままになります。')) return
    setData(d => ({ ...d, expenses: d.expenses.filter(e => e.id !== id) })); notify('支出を削除しました')
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `nokosu-kakeibo-${todayKey}.json`; a.click(); URL.revokeObjectURL(url)
    notify('バックアップを書き出しました')
  }
  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try {
      if (file.size > 5000000) throw new Error()
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateData(parsed)) throw new Error()
      if (!confirm('現在のデータをバックアップの内容で置き換えますか？')) return
      setStorageBlocked(false); setData(carryForwardFixedCosts(migrateLegacyCosts(parsed, today), today)); setOffset(0); notify('バックアップを読み込みました')
    } catch { setError('読み込めませんでした。のこす家計簿から書き出した有効な JSON ファイル（5 MB 以下）を選んでください。') }
  }
  const expenseList = (expenses: Expense[], limit?: number) => expenses.length ? <div className="expense-list">{[...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map(e => <div className="expense-row" key={e.id}>
    <button className="expense-description" onClick={() => setModal({ type: 'expense', expense: e })}><strong>{e.note || '生活費'}</strong><span>{shortDate(parseDate(e.date))}</span></button>
    <strong className="expense-amount">{yen(e.amount)}</strong><button className="icon-button delete-expense" aria-label={`${e.note || '生活費'}を削除`} onClick={() => removeExpense(e.id)}><Trash2 size={15} /></button>
  </div>)}</div> : <div className="empty-state">支出の記録がありません</div>

  const aboutUrl = (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) ? '/about/' : '/'

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href={aboutUrl}><BrandMark className="brand-mark" /><span>のこす<span className="brand-name-tail">家計簿</span></span></a>
      <div className="nav-label">家計簿</div>
      <nav aria-label="メインメニュー">{([
        ['overview', LayoutDashboard, '残せるお金'], ['history', ReceiptText, '支出の記録'], ['costs', House, '固定費・臨時支出'], ['charts', ChartNoAxesCombined, 'レポート'], ['settings', SettingsIcon, '設定'],
      ] as const).map(([id, Icon, label]) => <button key={id} className={`nav-item ${id === 'settings' ? 'mobile-settings' : ''} ${view === id ? 'active' : ''}`} aria-label={label} onClick={() => { setCalendarDate(null); setView(id) }}><Icon size={19} strokeWidth={1.7} /><span className="nav-label-full">{label}</span>{id === 'costs' && <span className="nav-label-short" aria-hidden="true">固定費・臨時</span>}{view === id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-utilities"><button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => { setCalendarDate(null); setView('settings') }}><SettingsIcon size={17} strokeWidth={1.7} />設定</button><a href="/tips/">効果的な使い方 <ChevronRight size={14} /></a><a href={aboutUrl}>このアプリについて <ChevronRight size={14} /></a><a href="/privacy/">プライバシーポリシー <ChevronRight size={14} /></a></div><span><ShieldCheck size={13} /> このブラウザに自動保存</span></div>
    </aside>
    <main>
      <header className="topbar"><a className="topbar-brand" href={aboutUrl}><BrandMark className="topbar-mark" /><span><strong>のこす家計簿</strong><span className="brand-tagline">ざっくりつけて、ちゃんと残す。</span></span></a><div className="topbar-links"><span className="today-date">{today.getFullYear()}年{longDate(today)}</span></div></header>
      <div className="page-content">
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="page-heading"><div><h1>{view === 'overview' ? '残せるお金' : view === 'history' ? '支出の記録' : view === 'costs' ? '固定費・臨時支出' : view === 'charts' ? 'レポート' : '設定'}</h1></div></div>
        {(!setupComplete || !setup.dismissed) && <details className="setup-disclosure" open={!setupComplete || view === 'settings' || view === 'costs'}><summary>初期設定 <span>{setupComplete ? '完了' : `残り${[data.settings.income > 0, setup.paydayConfirmed, setup.fixedCostsConfirmed].filter(value => !value).length}項目`}</span><ChevronRight size={17} /></summary><SetupSteps steps={[
          { label: '毎月の手取り', value: data.settings.income > 0 ? yen(data.settings.income) : '未設定', done: data.settings.income > 0, onClick: () => { setView('settings'); setSetupField('income') } },
          { label: '給料日', value: `毎月${data.settings.payday}日${setup.paydayConfirmed ? '' : '（要確認）'}`, done: setup.paydayConfirmed, onClick: () => { setView('settings'); setSetupField('payday') } },
          { label: '固定費', value: setup.fixedCostsConfirmed ? fixedCosts.length ? `${fixedCosts.length}件 · ${yen(summary.fixed)}` : '固定費なし' : '登録、または「なし」', done: setup.fixedCostsConfirmed, onClick: () => setView('costs') },
        ]} onDismiss={() => setData(d => ({ ...d, setup: { ...setup, dismissed: true } }))} /></details>}
        {view !== 'settings' && <div className="period-bar period-selector"><div className="period-info"><div className="period-title"><span>{period.year}年</span><strong>{periodLabel}</strong></div><div className="period-range"><span>{shortDate(period.start)} – {shortDate(period.end)}</span>{offset === 0 && <span className="period-current">今の月期</span>}</div>{offset < 0 && <button className="period-return" onClick={() => { setCalendarDate(null); setOffset(0) }}>今の月期に戻る</button>}</div><div className="period-arrows" role="group" aria-label="月期を切り替える"><button disabled={period.start.getFullYear() <= 2020} onClick={() => { setCalendarDate(null); setOffset(o => o - 1) }} aria-label="前の期間"><ChevronLeft size={20} /></button><button disabled={offset >= 0} onClick={() => { setCalendarDate(null); setOffset(o => o + 1) }} aria-label="次の期間"><ChevronRight size={20} /></button></div></div>}
        {view === 'overview' && <>
          <section className="savings-card">
            <details className="inline-help hero-help"><summary>残せるお金 <span>最大</span><ChevronRight size={14} /></summary><p>手取り − 固定費・臨時支出 − 記録済みの生活費。これからの生活費と未記録の支出は、まだ差し引いていません。</p></details>
            <div className="hero-amount">{data.settings.income ? yen(summary.remainingBalance) : <button className="hero-setup-button" onClick={() => { setView('settings'); setSetupField('income') }}>手取りを設定 <ChevronRight size={21} /></button>}</div>
            {offset === 0 && <details className="inline-help forecast-help"><summary><span>このペースで残せるお金</span><strong>{forecast.amount === null ? '—' : yen(forecast.amount)}</strong><ChevronRight size={14} /></summary><p>最大値 − 記録した日の1日平均支出 × これからの日数。0円の記録も平均に含み、未記録の日は含みません。今日を記録済みなら明日から、未記録なら今日から見積もります。記録がない間は表示しません。未記録の過去の支出は反映されません。</p></details>}
            <PaydayCountdown date={dateKey(period.next)} past={offset < 0} />
            <div className="period-progress"><div role="progressbar" aria-label="給与期間の経過" aria-valuemin={0} aria-valuemax={period.totalDays} aria-valuenow={completed}><i style={{ width: `${completed / period.totalDays * 100}%` }} /></div><span>{completed} / {period.totalDays}日</span></div>
            <div className="hero-statistics"><div><span>使った金額</span><strong>{yen(summary.spent)}</strong></div><div><span>1日平均</span><strong>{summary.average === null ? '—' : yen(Math.round(summary.average))}</strong></div></div>
          </section>
          <div className="overview-card-actions">{offset === 0 && <AiCopy compact data={data} period={period} today={today} />}<CardImage period={`${period.year}年${periodLabel}`} range={`${shortDate(period.start)} – ${shortDate(period.end)}`} maximum={data.settings.income ? summary.remainingBalance : null} forecast={forecast.amount} spent={summary.spent} average={summary.average} completed={completed} totalDays={period.totalDays} current={offset === 0} /></div>
          {resumeDraft && resumeDraft[0] !== todayKey && <button className="draft-resume" onClick={() => openCalendar(resumeDraft[0])}>{shortDate(parseDate(resumeDraft[0]))}の入力を再開 <ChevronRight size={17} /></button>}
          <section className="today-entry" aria-label="今日の記録">
            <div className="today-entry-heading"><h2>今日 <span>{shortDate(today)}</span></h2><strong>{todayLogged ? yen(todayTotal) : '未記録'}</strong></div>
            <div className="today-entry-actions"><button className="primary-button" onClick={() => { setOffset(0); setCalendarDate(todayKey); setView('history') }}>{data.drafts?.[todayKey] ? '今日の入力を再開' : todayLogged ? '今日の金額を追加' : '今日の金額を入力'}</button><button className="text-button" onClick={() => openCalendar()}>カレンダーを見る <ChevronRight size={16} /></button></div>
          </section>

        </>}
        {view === 'charts' && <Charts key={period.key} data={data} period={period} today={today} />}
        {view === 'history' && <>
          <ExpenseCalendar key={period.key} period={period} today={todayKey} initialDate={calendarDate} expenses={summary.expenses} loggedDates={data.loggedDates} drafts={data.drafts ?? {}} onDraftChange={(date: string, draft: Draft | null) => setData(d => ({ ...d, drafts: draft ? { ...d.drafts, [date]: draft } : Object.fromEntries(Object.entries(d.drafts ?? {}).filter(([key]) => key !== date)) }))} onSave={(date, amount, mode) => { setData(d => recordDailyAmount(d, date, amount, mode)); notify(`${shortDate(parseDate(date))}を保存しました`); if (date === todayKey) { setOffset(0); setCalendarDate(null); setView('overview') } }} onClear={date => { setData(d => ({ ...d, expenses: d.expenses.filter(e => e.date !== date), loggedDates: d.loggedDates.filter(key => key !== date), drafts: Object.fromEntries(Object.entries(d.drafts ?? {}).filter(([key]) => key !== date)) })); notify('未記録に戻しました') }} />
          {summary.expenses.length > 0 && <details className="entry-details"><summary>明細 <span>{summary.expenses.length}件</span><ChevronRight size={17} /></summary>{expenseList(summary.expenses)}</details>}
        </>}
        {view === 'costs' && <>{!setup.fixedCostsConfirmed && <div className="setup-cost-confirm"><button className="outline-button" onClick={() => { setData(d => markFixedCostPeriod({ ...d, setup: { ...setup, fixedCostsConfirmed: true } }, period.key)); notify('固定費の設定を完了しました') }}><Check size={16} />{fixedCosts.length ? '固定費の設定を完了' : '固定費なしで完了'}</button></div>}<div className="cost-grid">{(['fixed', 'extra'] as const).map(kind => <section className="panel" key={kind}><div className="section-heading"><h2>{kind === 'fixed' ? '固定費' : '臨時支出'}</h2><span>{yen(kind === 'fixed' ? summary.fixed : summary.extra)}</span></div><div className="cost-list">{summary.costs.filter(c => c.kind === kind).map(c => <div className="cost-row" key={c.id}><button className="cost-edit" onClick={() => setModal({ type: 'cost', kind, cost: c })} aria-label={`${c.name}を編集`}>{c.name}</button><span>{yen(c.amount)}</span><button className="icon-button cost-delete" aria-label={`${c.name}を削除`} onClick={() => { if (confirm(`${periodLabel}の${c.name}を削除しますか？`)) setData(d => ({ ...d, costs: d.costs.filter(x => x.id !== c.id) })) }}><Trash2 size={16} /></button></div>)}{!summary.costs.some(c => c.kind === kind) && <div className="cost-empty">まだ登録されていません{kind === 'fixed' && previousFixedCosts.length > 0 && <button className="outline-button copy-fixed-button" onClick={() => { setData(d => copyFixedCosts(d, previousPeriod.key, period.key)); notify(`${previousPeriod.month}月期の固定費をコピーしました`) }}>{previousPeriod.month}月期の固定費をコピー</button>}</div>}</div><button className="outline-button full-width" onClick={() => setModal({ type: 'cost', kind })}><Plus size={16} />{kind === 'fixed' ? '固定費を追加' : '臨時支出を追加'}</button></section>)}</div></>}
        {view === 'settings' && <div className="settings-grid"><section className="panel"><div className="section-heading"><h2>給料の設定</h2>{setup.dismissed && <button className="text-button" onClick={() => setData(d => ({ ...d, setup: { ...setup, dismissed: false } }))}>初期設定を表示</button>}</div><form className="settings-form" key={JSON.stringify(data.settings)} onSubmit={e => {
          e.preventDefault(); const f = new FormData(e.currentTarget)
          setData(d => ({ ...d, settings: { income: Number(f.get('income')), payday: Number(f.get('payday')), holidays: f.get('holidays') === 'on' }, setup: { ...setup, paydayConfirmed: true } })); setOffset(0); notify('設定を保存しました')
        }}><label>毎月の手取り額（ボーナス・残業代を除く）<div className="input-with-unit"><input ref={incomeInput} name="income" type="number" min="0" max="1000000000" step="1" defaultValue={data.settings.income} required /><span>円</span></div></label><label>給料日<div className="input-with-unit"><input ref={paydayInput} name="payday" type="number" min="1" max="31" step="1" defaultValue={data.settings.payday} required /><span>日</span></div></label><label className="checkbox-label"><input name="holidays" type="checkbox" defaultChecked={data.settings.holidays} />日本の祝日も避けて前倒しする</label><button className="primary-button" type="submit"><Check size={17} />設定を保存</button></form></section><div><section className="panel storage-panel"><div className="section-heading"><h2>データの保管</h2><ShieldCheck size={20} /></div><button className="outline-button full-width" onClick={exportData}><Download size={17} />バックアップを書き出す</button><button className="outline-button full-width import-button" onClick={() => fileInput.current?.click()}><Upload size={17} />バックアップを読み込む</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importData} /></section><a className="about-link" id="usage" href="/tips/">効果的な使い方 <ChevronRight size={16} /></a><a className="about-link" href={aboutUrl}>のこす家計簿について <ChevronRight size={16} /></a><a className="about-link" href="/privacy/">プライバシーポリシー <ChevronRight size={16} /></a><button className="reset-button" onClick={() => { if (confirm('支出・固定費・設定をすべて消去して、初期状態に戻しますか？ この操作は取り消せません。')) { setData(structuredClone(initialData)); setStorageBlocked(false); setOffset(0); notify('データを初期化しました') } }}>すべてのデータを初期化</button></div></div>}

        <InstallPrompt recorded={data.loggedDates.length > 0 || data.expenses.length > 0} showEntry={view === 'settings' || view === 'overview'} />
      </div>
    </main>
    <dialog ref={dialogRef} onCancel={() => setModal(null)} onClick={e => { if (e.target === e.currentTarget) setModal(null) }} aria-labelledby="dialog-title">{modal && <div className="modal-content"><div className="section-heading"><h2 id="dialog-title">{modal.type === 'expense' ? modal.expense ? '支出を編集' : '金額を入力' : modal.kind === 'fixed' ? modal.cost ? '固定費を編集' : '固定費を追加' : modal.cost ? '臨時支出を編集' : '臨時支出を追加'}</h2><button className="icon-button" onClick={() => setModal(null)} aria-label="閉じる"><X size={20} /></button></div><form className="entry-form" onSubmit={modal.type === 'expense' ? saveExpense : saveCost}>
      {modal.type === 'expense' ? <><label>日付<input name="date" type="date" min="2020-01-01" max={todayKey} defaultValue={modal.expense?.date || (offset === 0 ? todayKey : dateKey(period.end))} required /></label><label>使った金額<div className="input-with-unit"><input autoFocus name="amount" type="number" min="1" max="1000000000" step="1" placeholder="0" defaultValue={modal.expense?.amount} required /><span>円</span></div></label><label>メモ <span className="optional">任意</span><input name="note" maxLength={100} placeholder="例：ランチ、おやつ、帰りの電車" defaultValue={modal.expense?.note} /></label></> : <><details className="inline-help"><summary>日々の支出との分け方 <ChevronRight size={16} /></summary><p>ここに登録した分は、日々の支出に重ねて入力しません。二重に引かれて、残せる額が少なくなるためです。</p></details><label>項目名<input autoFocus name="name" defaultValue={modal.cost?.name} required maxLength={100} placeholder={modal.kind === 'fixed' ? '例：家賃、電気代' : '例：友人へのプレゼント'} /></label><label>金額<div className="input-with-unit"><input name="amount" defaultValue={modal.cost?.amount} type="number" min="1" max="1000000000" step="1" placeholder="0" required /><span>円</span></div></label></>}
      <button className="primary-button full-width" type="submit"><Check size={17} />{modal.type === 'expense' ? '記録を保存' : '支出を保存'}</button></form></div>}</dialog>
    {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
  </div>
}
