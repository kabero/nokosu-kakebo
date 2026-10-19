import { useState } from 'react'
import { Printer } from 'lucide-react'
import { addDays, dateKey, getPeriod, parseDate, summarize, type Data } from './finance'
import './charts.css'
import ReportShare from './ReportShare'

type Period = ReturnType<typeof getPeriod>
const yen = (n: number) => `¥${Math.round(n).toLocaleString('ja-JP')}`
const short = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
const colors = ['#275f49', '#8ba36c', '#d4b477']

export default function Charts({ data, period, today }: { data: Data; period: Period; today: Date }) {
  const [selected, setSelected] = useState<string | null>(null)
  const summary = summarize(data, period)
  const last = dateKey(period.end) < dateKey(today) ? period.end : today
  const daily = Array.from({ length: period.totalDays }, (_, i) => {
    const date = addDays(period.start, i), key = dateKey(date)
    const amount = summary.expenses.filter(e => e.date === key).reduce((s, e) => s + e.amount, 0)
    return { date, key, amount, recorded: key <= dateKey(last) && (data.loggedDates.includes(key) || summary.expenses.some(e => e.date === key)) }
  })
  const max = Math.max(1, ...daily.map(d => d.amount))
  const chosen = daily.find(d => d.key === selected)
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const day = (i + 1) % 7, records = daily.filter(d => d.recorded && d.date.getDay() === day)
    return { label: ['日', '月', '火', '水', '木', '金', '土'][day], value: records.length ? records.reduce((s, d) => s + d.amount, 0) / records.length : null, count: records.length }
  })
  const recent = Array.from({ length: 6 }, (_, i) => {
    const anchor = getPeriod(today, data.settings)
    const offset = (period.year - anchor.year) * 12 + period.month - anchor.month
    const p = getPeriod(today, data.settings, offset - 5 + i)
    const s = summarize(data, p)
    return { label: `${p.month}月期`, year: p.year, value: s.spent, recorded: s.recorded }
  })
  const portions = [{ label: '生活費', value: summary.spent }, { label: '固定費', value: summary.fixed }, { label: '臨時支出', value: summary.extra }]
  const total = portions.reduce((s, d) => s + d.value, 0)
  const ranges = [{ label: '0円', test: (n: number) => n === 0 }, { label: '1〜999円', test: (n: number) => n > 0 && n < 1000 }, { label: '1,000〜2,999円', test: (n: number) => n >= 1000 && n < 3000 }, { label: '3,000〜4,999円', test: (n: number) => n >= 3000 && n < 5000 }, { label: '5,000円以上', test: (n: number) => n >= 5000 }].map(r => ({ label: r.label, count: daily.filter(d => d.recorded && r.test(d.amount)).length }))
  let running = 0
  const cumulative = daily.filter(d => d.key <= dateKey(last)).map(d => ({ ...d, sum: running += d.amount }))
  const cumulativeMax = Math.max(1, running)
  const x = (i: number) => 42 + i / Math.max(1, daily.length - 1) * 544
  const y = (n: number, limit: number) => 158 - n / limit * 126
  const empty = <p className="chart-empty">この月期の記録はまだありません</p>
  return <div className="charts-page">
    <header className="report-print-heading"><span>のこす家計簿</span><h1>{period.year}年 {period.month}月期のレポート</h1><p>{dateKey(period.start)} – {dateKey(period.end)}</p></header>
    <div className="report-tools"><ReportShare title={`${period.year}年 ${period.month}月期のレポート｜のこす家計簿`} text={`${period.year}年 ${period.month}月期（${short(period.start)} – ${short(period.end)}）\n生活費 ${yen(summary.spent)}\n1日平均 ${summary.average === null ? '—' : yen(summary.average)}\n記録 ${summary.recorded}日\n\n記録済みの支出から集計\nのこす家計簿`} /><button className="outline-button" onClick={() => window.print()}><Printer size={16} />PDF・印刷</button></div><p className="report-sharing-note">シェアやPDFには手取り・固定費の情報は含まれません</p>
    <div className="chart-overview"><span>生活費 <strong>{yen(summary.spent)}</strong></span><span>記録 <strong>{summary.recorded}日</strong></span><span>1日平均 <strong>{summary.average === null ? '—' : yen(summary.average)}</strong></span></div>
    <div className="charts-grid"><div className="report-trends">
      <section className="chart-panel chart-wide"><h2>日ごとの生活費</h2><p className="chart-caption"><span className="report-screen-only">棒を選ぶと金額を表示。 </span>未記録は「—」、使わなかった日は「0」。</p>{summary.recorded ? <><div className="daily-bars">{daily.map(d => <button key={d.key} className={`daily-bar ${selected === d.key ? 'selected' : ''}`} aria-label={`${short(d.date)} ${d.recorded ? yen(d.amount) : '未記録'}`} aria-pressed={selected === d.key} disabled={d.key > dateKey(last)} onClick={() => setSelected(d.key)}><span className="bar-space">{d.recorded ? d.amount ? <i style={{ height: `${Math.max(2, d.amount / max * 100)}%` }} /> : <b>0</b> : <b>—</b>}</span><span className={d.date.getDay() === 0 ? 'chart-date sunday' : d.date.getDay() === 6 ? 'chart-date saturday' : 'chart-date'}>{d.date.getDate()}</span></button>)}</div><p className="chart-selection" aria-live="polite">{chosen ? `${short(chosen.date)}　${chosen.recorded ? yen(chosen.amount) : '未記録'}` : `1日最大 ${yen(Math.max(0, ...daily.filter(d => d.recorded).map(d => d.amount)))}`}</p></> : empty}</section>
      <section className="chart-panel chart-wide"><h2>生活費の積み上がり</h2><p className="chart-caption">記録した支出の累計。未記録分は含みません。</p>{summary.recorded ? <svg className="cumulative-chart" viewBox="0 0 610 195" role="img" aria-label={`記録済み生活費の累計 ${yen(running)}`}><title>記録済みの支出の累計</title>{[0, .5, 1].map(r => <g key={r}><line x1="42" x2="586" y1={y(r * cumulativeMax, cumulativeMax)} y2={y(r * cumulativeMax, cumulativeMax)} stroke="#e0e7de" /><text x="38" y={y(r * cumulativeMax, cumulativeMax) + 4} textAnchor="end">{Math.round(r * cumulativeMax).toLocaleString()}</text></g>)}<polyline points={cumulative.map((d, i) => `${x(i)},${y(d.sum, cumulativeMax)}`).join(' ')} fill="none" stroke="#275f49" strokeWidth="2.5" />{cumulative.filter(d => d.recorded).map(d => <circle key={d.key} cx={x(daily.findIndex(v => v.key === d.key))} cy={y(d.sum, cumulativeMax)} r="3.5" fill="#275f49"><title>{short(d.date)} 累計 {yen(d.sum)}</title></circle>)}<text x="42" y="183">{short(period.start)}</text><text x="586" y="183" textAnchor="end">{short(period.end)}</text></svg> : empty}</section>
      </div><div className="report-comparisons"><section className="chart-panel"><h2>6か月期の生活費</h2><p className="chart-caption">選択中の月期まで。進行中・記録途中の月期も含みます。</p><div className="horizontal-bars">{recent.map((d, i) => <div key={i}><span>{d.year}<br />{d.label}</span><div><i style={{ width: `${d.value / Math.max(1, ...recent.map(v => v.value)) * 100}%` }} /></div><strong>{d.recorded ? yen(d.value) : '—'}<small>{d.recorded}日記録</small></strong></div>)}</div></section>
      <section className="chart-panel report-private-breakdown"><h2>支出の内訳</h2><p className="chart-caption">登録済みの固定費・臨時支出と、記録済みの生活費。</p>{total ? <div className="composition"><svg viewBox="0 0 120 120" role="img" aria-label={portions.map(p => `${p.label} ${yen(p.value)}`).join('、')}><circle cx="60" cy="60" r="43" fill="none" stroke="#edf1e9" strokeWidth="17" />{portions.map((p, i) => <circle key={p.label} cx="60" cy="60" r="43" fill="none" stroke={colors[i]} strokeWidth="17" pathLength="100" strokeDasharray={`${p.value / total * 100} ${100 - p.value / total * 100}`} strokeDashoffset={-portions.slice(0, i).reduce((s, d) => s + d.value / total * 100, 0)} transform="rotate(-90 60 60)" />)}</svg><dl>{portions.map((p, i) => <div key={p.label}><dt><i style={{ background: colors[i] }} />{p.label}</dt><dd>{yen(p.value)}<small>{Math.round(p.value / total * 100)}%</small></dd></div>)}</dl></div> : <p className="chart-empty">支出の登録はまだありません</p>}</section>
      <section className="chart-panel"><h2>曜日ごとの1日平均</h2><p className="chart-caption">0円の日も含む、記録した日だけの平均。</p>{summary.recorded ? <div className="horizontal-bars weekdays">{weekdays.map(d => <div key={d.label} className={d.label === '土' ? 'weekday-saturday' : d.label === '日' ? 'weekday-sunday' : undefined}><span>{d.label}</span><div><i style={{ width: `${(d.value ?? 0) / Math.max(1, ...weekdays.map(v => v.value ?? 0)) * 100}%` }} /></div><strong>{d.value === null ? '—' : yen(d.value)}<small>{d.count}日記録</small></strong></div>)}</div> : empty}</section>
      <section className="chart-panel"><h2>1日の支出額の分布</h2><p className="chart-caption">どのくらい使う日が多いか。未記録の日は除きます。</p>{summary.recorded ? <div className="horizontal-bars distribution">{ranges.map(d => <div key={d.label}><span>{d.label}</span><div><i style={{ width: `${d.count / Math.max(1, ...ranges.map(v => v.count)) * 100}%` }} /></div><strong>{d.count}日</strong></div>)}</div> : empty}</section>
    </div></div>
  </div>
}
