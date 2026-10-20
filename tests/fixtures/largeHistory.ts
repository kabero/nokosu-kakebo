import { addDays, dateKey, getPeriod, initialData, parseDate, type Data } from '../../src/finance'

export const historyToday = parseDate('2026-10-20')
// Deterministic synthetic records only. Include leap days, zero-spend days and Japanese notes.
export function largeHistory(years = 30, entriesPerDay = 3, noteLength = 12): Data {
  const data = structuredClone(initialData)
  data.settings.income = 300000
  data.setup = { paydayConfirmed: true, fixedCostsConfirmed: true, dismissed: true }
  data.fixedCostPeriods = []
  const start = new Date(historyToday); start.setFullYear(start.getFullYear() - years)
  for (let day = start, index = 0; day <= historyToday; day = addDays(day, 1), index++) {
    const key = dateKey(day)
    data.loggedDates.push(key)
    if (index % 11 !== 0) for (let entry = 0; entry < entriesPerDay; entry++) {
      data.expenses.push({ id: `expense-${key}-${entry}`, date: key, amount: 100 + (index * 17 + entry * 31) % 2000, note: '食費交通費日用品'.repeat(Math.ceil(noteLength / 8)).slice(0, noteLength) })
    }
  }
  for (let month = 0; month <= years * 12; month++) {
    const period = getPeriod(new Date(start.getFullYear(), start.getMonth() + month, 28, 12), data.settings)
    if (period.key > dateKey(historyToday)) continue
    data.fixedCostPeriods.push(period.key)
    for (let item = 0; item < 8; item++) data.costs.push({ id: `fixed-${month}-${item}`, period: period.key, name: `固定費${item}`, kind: 'fixed', amount: 3000 + item * 1000 })
    data.costs.push({ id: `extra-${month}`, period: period.key, name: '臨時支出', kind: 'extra', amount: 2300 })
  }
  data.drafts = { '2026-10-19': { expression: '580＋920＋', mode: 'add', updatedAt: 123 } }
  return data
}
