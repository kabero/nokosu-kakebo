import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { addDays, calculateAmount, dateKey, parseDate, type Draft, type Expense, type getPeriod } from './finance'

type Props = {
  period: ReturnType<typeof getPeriod>
  today: string
  initialDate?: string | null
  expenses: Expense[]
  loggedDates: string[]
  drafts: Record<string, Draft>
  onDraftChange: (date: string, draft: Draft | null) => void
  onSave: (date: string, amount: number, mode: Draft['mode']) => void
  onClear: (date: string) => void
}
const yen = (amount: number) => `¥${amount.toLocaleString('ja-JP')}`
const label = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`

export default function ExpenseCalendar({ period, today, initialDate, expenses, loggedDates, drafts = {}, onDraftChange, onSave, onClear }: Props) {
  const entriesFor = (key: string) => expenses.filter(e => e.date === key)
  const totalFor = (key: string) => entriesFor(key).reduce((s, e) => s + e.amount, 0)
  const isLogged = (key: string) => loggedDates.includes(key) || entriesFor(key).length > 0
  const start = initialDate && initialDate >= period.key && initialDate <= dateKey(period.end) && initialDate <= today ? initialDate : null
  const [selected, setSelected] = useState<string | null>(start)
  const [expression, setExpression] = useState(() => start ? drafts[start]?.expression ?? '' : '')
  const [mode, setMode] = useState<Draft['mode']>(() => start ? drafts[start]?.mode ?? (isLogged(start) ? 'add' : 'total') : 'total')
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const calendar = useRef<HTMLDivElement>(null)
  const lastSelected = useRef(start)
  const amount = calculateAmount(expression)
  const existingTotal = selected ? totalFor(selected) : 0
  const resultingTotal = amount === null ? null : mode === 'add' ? existingTotal + amount : amount
  const valid = resultingTotal !== null && resultingTotal <= 1000000000
  useEffect(() => {
    if (selected) {
      lastSelected.current = selected
      dialog.current?.showModal()
      input.current?.focus(); input.current?.select()
    } else {
      dialog.current?.close()
      if (lastSelected.current) calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${lastSelected.current}"]`)?.focus({ preventScroll: true })
    }
  }, [selected])
  function selectDay(key: string | null) {
    setSelected(key)
    setExpression(key ? drafts[key]?.expression ?? '' : '')
    setMode(key ? drafts[key]?.mode ?? (isLogged(key) ? 'add' : 'total') : 'total')
  }
  function updateExpression(value: string, nextMode = mode) {
    setExpression(value); setMode(nextMode)
    if (selected) onDraftChange(selected, value.trim() ? { expression: value, mode: nextMode, updatedAt: Date.now() } : null)
  }
  function save() {
    if (!selected || !valid || amount === null) return
    onSave(selected, amount, mode)
    setSelected(null); setExpression('')
  }
  return <section className="calendar-panel">
    <div className="calendar-total"><span>使った金額 <strong>{yen(expenses.reduce((sum, e) => sum + e.amount, 0))}</strong></span><span>{new Set([...loggedDates, ...expenses.map(e => e.date)].filter(key => key >= period.key && key <= dateKey(period.end))).size}日分を記録</span></div>
    <div ref={calendar} className="expense-calendar" aria-label={`${period.month}月期の支出カレンダー`}>
      {'日月火水木金土'.split('').map((day, i) => <div key={day} className={`weekday ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}>{day}</div>)}
      {Array.from({ length: period.start.getDay() }, (_, i) => <div className="calendar-blank" key={`blank-${i}`} />)}
      {Array.from({ length: period.totalDays }, (_, i) => addDays(period.start, i)).map(date => {
        const key = dateKey(date), logged = isLogged(key), future = key > today, hasDraft = !!drafts[key]
        return <button type="button" key={key} data-date={key} disabled={future} className={`calendar-day ${logged ? 'recorded' : ''} ${selected === key ? 'selected' : ''} ${key === today ? 'is-today' : ''}`} aria-label={`${key === today ? '今日 ' : ''}${label(date)} ${logged ? yen(totalFor(key)) : future ? '入力できません' : '未記録'}${hasDraft ? ' 下書き' : ''}`} aria-current={key === today ? 'date' : undefined} aria-pressed={selected === key} onClick={() => selectDay(key)}>
          {key === today && <span className="calendar-today-badge">今日</span>}
          <span className={`calendar-date ${date.getDay() === 0 ? 'sunday' : date.getDay() === 6 ? 'saturday' : ''}`}>{label(date)}</span>
          <strong>{logged ? yen(totalFor(key)) : future ? '—' : <span className="calendar-add">＋</span>}</strong>
          {hasDraft ? <span className="calendar-draft-label">下書き</span> : logged && <Check className="calendar-check" size={12} />}
        </button>
      })}
    </div>
    <dialog ref={dialog} className="calendar-dialog" aria-labelledby="daily-editor-title" onCancel={event => { event.preventDefault(); selectDay(null) }} onClick={event => { if (event.target === event.currentTarget) selectDay(null) }}>{selected && <form className="calendar-editor" key={selected} onSubmit={event => { event.preventDefault(); save() }}>
      <div className="section-heading"><h2 id="daily-editor-title">{label(parseDate(selected))}（{'日月火水木金土'[parseDate(selected).getDay()]}）</h2><button type="button" className="icon-button" aria-label="入力欄を閉じる" onClick={() => selectDay(null)}><X size={20} /></button></div>
      {isLogged(selected) && <div className="entry-mode" role="group" aria-label="記録方法"><button type="button" aria-pressed={mode === 'add'} onClick={() => { updateExpression('', 'add'); input.current?.focus() }}>金額を追加</button><button type="button" aria-pressed={mode === 'total'} onClick={() => { updateExpression(String(existingTotal), 'total'); input.current?.focus(); input.current?.select() }}>合計を変更</button></div>}
      <label>{mode === 'add' ? '追加する金額' : '使った金額'}<div className="expression-input"><div className="input-with-unit"><input ref={input} name="dailyAmount" inputMode="text" type="text" maxLength={500} autoComplete="off" required placeholder="例：580＋920" value={expression} onChange={event => updateExpression(event.target.value)} /><span>円</span></div></div></label>
      <div className="amount-result" aria-live="polite">{resultingTotal !== null && valid && <><span>この日の合計</span><strong>{yen(resultingTotal)}</strong></>}{expression.trim() && !valid && !/[+＋]\s*$/.test(expression) && <span className="input-error">{resultingTotal !== null ? '金額が大きすぎます' : '数字と＋で入力してください'}</span>}</div>
      <div className="calendar-editor-actions"><button type="submit" className="primary-button" disabled={!valid}><Check size={16} />保存</button></div>

      {drafts[selected] && <button type="button" className="text-button discard-draft" onClick={() => { onDraftChange(selected, null); setExpression('') }}>下書きを削除</button>}
      {isLogged(selected) && <button type="button" className="text-button clear-day" onClick={() => { if (confirm(`${label(parseDate(selected))}の支出と記録を削除し、未記録に戻しますか？`)) { onClear(selected); setSelected(null); setExpression('') } }}>この日を未記録に戻す</button>}
    </form>}</dialog>
  </section>
}
