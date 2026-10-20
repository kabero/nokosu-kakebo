import { dateKey, dayCount, forecastSavings, summarize, type Data, type getPeriod } from './finance'

type Options = { data: Data; period: ReturnType<typeof getPeriod>; today: Date; includeDaily?: boolean }
const yen = (value: number) => `${Math.round(value).toLocaleString('ja-JP')}円`

export function consultationText({ data, period, today, includeDaily = false }: Options) {
  const summary = summarize(data, period)
  const current = dateKey(today) >= period.key && dateKey(today) <= dateKey(period.end)
  const forecast = forecastSavings(data, period, today)
  const lines = [
    `対象：${period.year}年${period.month}月期（${dateKey(period.start)}〜${dateKey(period.end)}）`,
    `固定費の合計：${yen(summary.fixed)}`,
    `記録した生活費：${yen(summary.spent)}`,
    `記録日数：${summary.recorded}日（0円の記録を含む）`,
    `記録した日の1日平均：${summary.average === null ? '記録なし' : yen(summary.average)}`,
  ]
  lines.push(`残せるお金の最大値：${data.settings.income ? yen(summary.remainingBalance) : '手取り未設定のため算出不可'}`)
  if (current) lines.push(`次の給料日：${dateKey(period.next)}`, `今日を含む残り日数：${Math.max(0, dayCount(today, period.next))}日`, `今の支出ペースで残せる額：${forecast.amount === null ? '記録または設定不足で算出不可' : yen(forecast.amount)}`)
  else lines.push('対象は終了した月期です。現在の残額ではありません。')
  if (includeDaily) {
    const days = [...new Set([...data.loggedDates, ...summary.expenses.map(e => e.date)])].filter(key => key >= period.key && key <= dateKey(period.end) && key <= dateKey(today)).sort()
    lines.push('', '【記録した日ごとの生活費】', ...days.map(key => `${key}：${yen(summary.expenses.filter(e => e.date === key).reduce((sum, e) => sum + e.amount, 0))}`))
  }
  lines.push('', '※最大値は今後の生活費を引く前の額です。ペースからの見積もりは記録日の平均を使っています（未記録日は除外）。', '※記録は概算です。ボーナス・残業代は貯金に回します。不明な情報は推測せず確認してください。')
  return lines.join('\n')
}
