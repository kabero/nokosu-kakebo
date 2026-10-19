export type Expense = { id: string; date: string; amount: number; note: string; category?: string }
export type Cost = { id: string; name: string; amount: number; kind: 'fixed' | 'extra'; period?: string }
export type Settings = { income: number; payday: number; holidays: boolean }
export type Draft = { expression: string; mode: 'add' | 'total'; updatedAt: number }
export type Data = { version: 1; settings: Settings; expenses: Expense[]; costs: Cost[]; loggedDates: string[]; drafts?: Record<string, Draft>; fixedCostPeriods?: string[]; setup?: { paydayConfirmed: boolean; fixedCostsConfirmed: boolean; dismissed: boolean } }
export const initialData: Data = {
  version: 1,
  settings: { income: 0, payday: 25, holidays: true },
  expenses: [], costs: [], loggedDates: [],
  setup: { paydayConfirmed: false, fixedCostsConfirmed: false, dismissed: false },
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseDate(value: string): Date { return new Date(`${value}T12:00:00`) }
export function addDays(date: Date, n: number): Date { const d = new Date(date); d.setDate(d.getDate() + n); return d }
export function dayCount(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)
}
export function countdownTo(date: string, now: number) {
  const total = Math.max(0, Math.ceil((new Date(`${date}T00:00:00`).getTime() - now) / 1000))
  return { days: Math.floor(total / 86400), hours: Math.floor(total % 86400 / 3600), minutes: Math.floor(total % 3600 / 60), seconds: total % 60 }
}
const holidayCache = new Map<number, Set<string>>()
// 現行の日本の祝日規則（2000〜2099年）。2020・2021年の移動も反映。
export function japaneseHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const days = new Set<string>()
  const put = (m: number, d: number) => days.add(dateKey(new Date(year, m - 1, d, 12)))
  const monday = (m: number, nth: number) => 1 + (8 - new Date(year, m - 1, 1).getDay()) % 7 + (nth - 1) * 7
  put(1, 1); put(1, monday(1, 2)); put(2, 11)
  if (year >= 2020) put(2, 23)
  if (year <= 2018) put(12, 23)
  put(3, Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)))
  put(4, 29); put(5, 3); put(5, 4); put(5, 5)
  if (year === 2020) { put(7, 23); put(7, 24); put(8, 10) }
  else if (year === 2021) { put(7, 22); put(7, 23); put(8, 8) }
  else {
    put(7, year >= 2003 ? monday(7, 3) : 20)
    if (year >= 2016) put(8, 11)
    put(10, year >= 2000 ? monday(10, 2) : 10)
  }
  put(9, year >= 2003 ? monday(9, 3) : 15)
  put(9, Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)))
  put(11, 3); put(11, 23)
  if (year === 2019) { put(5, 1); put(10, 22) }
  // 国民の休日を先に確定し、その後に振替休日を追加する。
  for (let d = new Date(year, 0, 2, 12); d.getFullYear() === year; d = addDays(d, 1)) {
    if (d.getDay() !== 0 && !days.has(dateKey(d)) && days.has(dateKey(addDays(d, -1))) && days.has(dateKey(addDays(d, 1)))) days.add(dateKey(d))
  }
  for (const key of [...days].sort()) {
    const d = parseDate(key)
    if (d.getDay() === 0) {
      let next = addDays(d, 1)
      while (days.has(dateKey(next))) next = addDays(next, 1)
      days.add(dateKey(next))
    }
  }
  holidayCache.set(year, days)
  return days
}
export function payday(year: number, month: number, settings: Settings): Date {
  const last = new Date(year, month + 1, 0).getDate()
  let d = new Date(year, month, Math.min(settings.payday, last), 12)
  while (d.getDay() === 0 || d.getDay() === 6 || (settings.holidays && japaneseHolidays(d.getFullYear()).has(dateKey(d)))) d = addDays(d, -1)
  return d
}
export function getPeriod(today: Date, settings: Settings, offset = 0) {
  let month = today.getMonth()
  const year = today.getFullYear()
  if (dateKey(today) < dateKey(payday(year, month, settings))) month--
  // 翌月の給料日が前月末に前倒しされる場合、その日から翌月期に入る。
  while (dateKey(today) >= dateKey(payday(year, month + 1, settings))) month++
  const nominal = new Date(year, month + offset, 1, 12)
  const start = payday(year, month + offset, settings)
  const next = payday(year, month + offset + 1, settings)
  return { start, end: addDays(next, -1), next, key: dateKey(start), year: nominal.getFullYear(), month: nominal.getMonth() + 1, totalDays: dayCount(start, next) }
}
export function summarize(data: Data, period: ReturnType<typeof getPeriod>) {
  const start = dateKey(period.start), end = dateKey(period.end)
  const expenses = data.expenses.filter(e => e.date >= start && e.date <= end)
  const costs = data.costs.filter(c => c.period === period.key)
  const fixed = costs.filter(c => c.kind === 'fixed').reduce((s, c) => s + c.amount, 0)
  const extra = costs.filter(c => c.kind === 'extra').reduce((s, c) => s + c.amount, 0)
  const spent = expenses.reduce((s, e) => s + e.amount, 0)
  const recorded = new Set([...data.loggedDates, ...expenses.map(e => e.date)].filter(d => d >= start && d <= end)).size
  const average = recorded ? spent / recorded : null
  const remainingBalance = data.settings.income - fixed - extra - spent
  return { expenses, costs, fixed, extra, spent, recorded, average, remainingBalance }
}
export function migrateLegacyCosts(data: Data, today: Date): Data {
  const period = getPeriod(today, data.settings).key
  return { ...data, costs: data.costs.map(c => c.kind === 'fixed' && !c.period ? { ...c, period } : c) }
}
export function forecastSavings(data: Data, period: ReturnType<typeof getPeriod>, today: Date) {
  const summary = summarize(data, period)
  const todayKey = dateKey(today)
  const first = todayKey < period.key ? period.start : today
  const todayRecorded = data.loggedDates.includes(todayKey) || summary.expenses.some(e => e.date === todayKey)
  const days = Math.max(0, dayCount(first, period.next) - (todayRecorded && todayKey >= period.key && todayKey <= dateKey(period.end) ? 1 : 0))
  // 今日を記録済みなら、その日の支出は実績に含まれるため再度見積もらない。
  const amount = !data.settings.income || summary.average === null ? null : Math.floor(summary.remainingBalance - summary.average * days)
  return { amount, days }
}
export function copyFixedCosts(data: Data, from: string, to: string): Data {
  if (from === to || data.costs.some(c => c.kind === 'fixed' && c.period === to)) return data
  const copied = data.costs.filter(c => c.kind === 'fixed' && c.period === from).map(c => ({ ...c, id: crypto.randomUUID(), period: to }))
  return markFixedCostPeriod({ ...data, costs: [...data.costs, ...copied] }, to)
}
export function markFixedCostPeriod(data: Data, period: string): Data {
  return data.fixedCostPeriods?.includes(period) ? data : { ...data, fixedCostPeriods: [...(data.fixedCostPeriods ?? []), period] }
}
export function carryForwardFixedCosts(data: Data, today: Date): Data {
  const current = getPeriod(today, data.settings).key
  // 空にした月期も記憶し、削除した固定費を再作成しない。
  const periods = [...new Set([...(data.fixedCostPeriods ?? []), ...data.costs.filter(c => c.kind === 'fixed' && c.period).map(c => c.period!)])].sort()
  let result = periods.length === (data.fixedCostPeriods ?? []).length ? data : { ...data, fixedCostPeriods: periods }
  if (periods.includes(current)) return result
  // しばらく使っていなかった場合も、最後に設定した月期から引き継ぐ。
  const previous = periods.filter(key => key < current).at(-1)
  if (!previous) return result
  result = copyFixedCosts(result, previous, current)
  return result
}
export function saveDailyTotal(data: Data, date: string, amount: number): Data {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) return data
  const entries = data.expenses.filter(e => e.date === date)
  const total = entries.reduce((sum, e) => sum + e.amount, 0)
  const expenses = amount === total ? data.expenses : [
    ...data.expenses.filter(e => e.date !== date),
    ...(amount > 0 ? [{ id: entries[0]?.id || crypto.randomUUID(), date, amount, note: entries.map(e => e.note).filter(Boolean).join(' / ').slice(0, 500) }] : []),
  ]
  return { ...data, expenses, loggedDates: [...new Set([...data.loggedDates, date])] }
}
export function calculateAmount(expression: string): number | null {
  const normalized = expression.replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10)).replace(/＋/g, '+').replace(/[\s,，￥¥]/g, '')
  if (!/^\d+(\+\d+)*$/.test(normalized) || expression.length > 500) return null
  const amount = normalized.split('+').reduce((sum, n) => sum + Number(n), 0)
  return Number.isSafeInteger(amount) && amount <= 1000000000 ? amount : null
}
export function recordDailyAmount(data: Data, date: string, amount: number, mode: Draft['mode']): Data {
  const total = data.expenses.filter(e => e.date === date).reduce((sum, e) => sum + e.amount, 0)
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000 || (mode === 'add' && total + amount > 1000000000)) return data
  const updated = mode === 'total' ? saveDailyTotal(data, date, amount) : {
    ...data,
    expenses: amount > 0 ? [...data.expenses, { id: crypto.randomUUID(), date, amount, note: '' }] : data.expenses,
    loggedDates: [...new Set([...data.loggedDates, date])],
  }
  return { ...updated, drafts: Object.fromEntries(Object.entries(data.drafts ?? {}).filter(([key]) => key !== date)) }
}
export function validateData(value: unknown): value is Data {
  if (!value || typeof value !== 'object') return false
  const d = value as Data
  const money = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1000000000
  const str = (s: unknown) => typeof s === 'string' && s.length <= 500
  const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(parseDate(s).getTime()) && dateKey(parseDate(s)) === s
  return d.version === 1 && !!d.settings && money(d.settings.income)
    && (d.drafts === undefined || (!!d.drafts && typeof d.drafts === 'object' && !Array.isArray(d.drafts) && Object.entries(d.drafts).every(([key, draft]) => date(key) && draft && str(draft.expression) && (draft.mode === 'add' || draft.mode === 'total') && Number.isSafeInteger(draft.updatedAt) && draft.updatedAt >= 0)))
    && (d.fixedCostPeriods === undefined || (Array.isArray(d.fixedCostPeriods) && d.fixedCostPeriods.every(date)))
    && (d.setup === undefined || (!!d.setup && typeof d.setup.paydayConfirmed === 'boolean' && typeof d.setup.fixedCostsConfirmed === 'boolean' && typeof d.setup.dismissed === 'boolean'))
    && Number.isInteger(d.settings.payday) && d.settings.payday >= 1 && d.settings.payday <= 31 && typeof d.settings.holidays === 'boolean'
    && Array.isArray(d.expenses) && d.expenses.every(e => e && str(e.id) && date(e.date) && money(e.amount) && str(e.note) && (e.category === undefined || str(e.category)))
    && Array.isArray(d.costs) && d.costs.every(c => c && str(c.id) && str(c.name) && money(c.amount) && ((c.kind === 'fixed' && (c.period === undefined || date(c.period))) || (c.kind === 'extra' && date(c.period))))
    && Array.isArray(d.loggedDates) && d.loggedDates.every(date)
}
