import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, dateKey, getPeriod, initialData, japaneseHolidays, parseDate, payday, summarize, forecastSavings, validateData, saveDailyTotal, migrateLegacyCosts, copyFixedCosts, carryForwardFixedCosts, markFixedCostPeriod, countdownTo, calculateAmount, recordDailyAmount } from './finance'

const settings = initialData.settings
test('足し算は全角・カンマにも対応し、不正な式や小数を受け付けない', () => {
  assert.equal(calculateAmount('580＋920'), 1500)
  assert.equal(calculateAmount('￥１，０００ + 200'), 1200)
  assert.equal(calculateAmount('0'), 0)
  for (const value of ['', '1+', '1-2', '1.5', 'alert(1)', '1000000001']) assert.equal(calculateAmount(value), null)
})
test('追加記録は元の明細を維持し、保存した日付の下書きだけを削除する', () => {
  const data = structuredClone(initialData)
  data.expenses = [{ id: 'a', date: '2026-10-18', amount: 1500, note: '昼食' }]
  data.drafts = { '2026-10-18': { expression: '300', mode: 'add', updatedAt: 1 }, '2026-10-17': { expression: '100+', mode: 'total', updatedAt: 2 } }
  const result = recordDailyAmount(data, '2026-10-18', 300, 'add')
  assert.equal(result.expenses.reduce((s, e) => s + e.amount, 0), 1800)
  assert.equal(result.expenses[0].note, '昼食')
  assert.equal(result.expenses.length, 2)
  assert.equal(result.drafts?.['2026-10-18'], undefined)
  assert.ok(result.drafts?.['2026-10-17'])
  assert.ok(validateData(result))
  assert.equal(recordDailyAmount(result, '2026-10-18', 1000000000, 'add'), result)
  const total = recordDailyAmount(result, '2026-10-18', 500, 'total')
  assert.equal(total.expenses.reduce((s, e) => s + e.amount, 0), 500)
})
test('下書きと旧設定を含むバックアップを読み込み、不正な下書きを拒否する', () => {
  assert.ok(validateData({ ...initialData, drafts: { '2026-10-18': { expression: '580+', mode: 'add', updatedAt: Date.now() } }, preferences: { countdownPaused: true } }))
  assert.ok(!validateData({ ...initialData, drafts: { bad: { expression: '500', mode: 'add', updatedAt: 1 } } }))
  assert.ok(!validateData({ ...initialData, drafts: { '2026-10-18': { expression: '500', mode: 'bad', updatedAt: 1 } } }))
})
test('給料日の午前0時までの残り時間を秒単位で計算し、負数にしない', () => {
  assert.deepEqual(countdownTo('2026-10-23', new Date('2026-10-18T12:34:56').getTime()), { days: 4, hours: 11, minutes: 25, seconds: 4 })
  assert.deepEqual(countdownTo('2026-10-23', new Date('2026-10-22T23:59:59').getTime()), { days: 0, hours: 0, minutes: 0, seconds: 1 })
  assert.deepEqual(countdownTo('2026-10-23', new Date('2026-10-22T23:59:59.750').getTime()), { days: 0, hours: 0, minutes: 0, seconds: 1 })
  assert.deepEqual(countdownTo('2026-10-23', new Date('2026-10-23T00:00:00').getTime()), { days: 0, hours: 0, minutes: 0, seconds: 0 })
  assert.deepEqual(countdownTo('2026-10-23', new Date('2026-10-24T00:00:00').getTime()), { days: 0, hours: 0, minutes: 0, seconds: 0 })
})
test('給料日が日曜なら直前の金曜、給料日当日に期間が切り替わる', () => {
  assert.equal(dateKey(payday(2026, 9, settings)), '2026-10-23')
  assert.equal(getPeriod(parseDate('2026-10-22'), settings).key, '2026-09-25')
  assert.equal(getPeriod(parseDate('2026-10-23'), settings).key, '2026-10-23')
  assert.equal(dateKey(getPeriod(parseDate('2026-10-23'), settings).end), '2026-11-24')
})
test('祝日、振替休日、国民の休日と年またぎを扱う', () => {
  assert.equal(dateKey(payday(2026, 10, { ...settings, payday: 23 })), '2026-11-20')
  assert.equal(dateKey(payday(2026, 4, { ...settings, payday: 6 })), '2026-05-01')
  assert.equal(japaneseHolidays(2026).has('2026-09-22'), true)
  assert.equal(dateKey(payday(2026, 0, { ...settings, payday: 1 })), '2025-12-31')
  const january = getPeriod(parseDate('2025-12-31'), { ...settings, payday: 1 })
  assert.equal(january.key, '2025-12-31')
  assert.equal(january.year, 2026)
  assert.equal(january.month, 1)
  assert.equal(dateKey(payday(2026, 10, { ...settings, payday: 23, holidays: false })), '2026-11-23')
})
test('月末のない日付とうるう年を扱う', () => {
  assert.equal(dateKey(payday(2024, 1, { ...settings, payday: 31 })), '2024-02-29')
  assert.equal(dateKey(payday(2026, 1, { ...settings, payday: 31 })), '2026-02-27')
})
test('連続する給与期間に空白や重複がなく、すべて平日になる', () => {
  for (let year = 2025; year <= 2028; year++) for (let month = 0; month < 12; month++) {
    const period = getPeriod(payday(year, month, settings), settings)
    assert.equal(dateKey(addDays(period.end, 1)), dateKey(period.next))
    assert.ok(![0, 6].includes(period.start.getDay()))
    assert.ok(!japaneseHolidays(period.start.getFullYear()).has(period.key))
    assert.ok(period.totalDays >= 25 && period.totalDays <= 35)
  }
})
test('支出なしの日を平均に含め、固定費と期間限定の臨時支出を別枠で引く', () => {
  const period = getPeriod(parseDate('2026-10-18'), settings)
  const data = structuredClone(initialData)
  data.settings.income = 300000
  data.expenses = [{ id: 'a', date: '2026-10-01', amount: 4000, note: '', category: '食費' }]
  data.loggedDates = ['2026-10-01', '2026-10-02', '2026-09-01']
  data.costs = [
    { id: 'b', name: '家賃', kind: 'fixed', period: period.key, amount: 80000 },
    { id: 'c', name: '旅行', kind: 'extra', period: period.key, amount: 10000 },
    { id: 'd', name: '過去の出費', kind: 'extra', period: '2026-08-25', amount: 50000 },
  ]
  const result = summarize(data, period)
  assert.equal(result.recorded, 2)
  assert.equal(result.average, 2000)
  assert.equal(result.remainingBalance, 206000)
})
test('旧固定費を現在の月期に移し、コピー後の変更が元の月期に影響しない', () => {
  const data = structuredClone(initialData)
  data.costs = [{ id: 'rent', name: '家賃', amount: 80000, kind: 'fixed' }]
  const previous = getPeriod(parseDate('2026-09-25'), settings)
  const current = getPeriod(parseDate('2026-10-23'), settings)
  const migrated = migrateLegacyCosts(data, parseDate('2026-09-25'))
  assert.equal(summarize(migrated, previous).fixed, 80000)
  assert.equal(summarize(migrated, current).fixed, 0)
  const copied = copyFixedCosts(migrated, previous.key, current.key)
  const entry = copied.costs.find(c => c.period === current.key)!
  assert.notEqual(entry.id, 'rent')
  entry.amount = 85000
  assert.equal(summarize(copied, previous).fixed, 80000)
  assert.equal(summarize(copied, current).fixed, 85000)
  assert.equal(copyFixedCosts(copied, previous.key, current.key).costs.length, 2)
  assert.ok(validateData(copied))
  assert.equal(migrateLegacyCosts(copied, parseDate('2026-11-25')).costs[0].period, previous.key)
})
test('残額は未記録日を推測せず、0円の記録と赤字も扱える', () => {
  const period = getPeriod(parseDate('2026-10-18'), settings)
  const data = structuredClone(initialData)
  data.settings.income = 10000
  const empty = summarize(data, period)
  assert.equal(empty.average, null)
  assert.equal(empty.remainingBalance, 10000)
  const zero = summarize(saveDailyTotal(data, '2026-10-01', 0), period)
  assert.equal(zero.average, 0)
  assert.equal(zero.remainingBalance, 10000)
  const deficit = summarize(saveDailyTotal(data, '2026-10-01', 12000), period)
  assert.equal(deficit.remainingBalance, -2000)
})
test('新しい月期に固定費だけを一度引き継ぎ、編集・削除した状態を維持する', () => {
  const data = structuredClone(initialData)
  data.costs = [
    { id: 'rent', name: '家賃', amount: 80000, kind: 'fixed', period: '2026-09-25' },
    { id: 'trip', name: '旅行', amount: 10000, kind: 'extra', period: '2026-09-25' },
  ]
  const currentDate = parseDate('2026-10-23')
  const current = getPeriod(currentDate, settings)
  const carried = carryForwardFixedCosts(data, currentDate)
  assert.equal(summarize(carried, current).fixed, 80000)
  assert.equal(summarize(carried, current).extra, 0)
  assert.equal(carryForwardFixedCosts(carried, currentDate), carried)
  const changed = { ...carried, costs: carried.costs.map(c => c.period === current.key ? { ...c, amount: 90000 } : c) }
  assert.equal(summarize(carryForwardFixedCosts(changed, currentDate), current).fixed, 90000)
  const deleted = { ...carried, costs: carried.costs.filter(c => c.period !== current.key) }
  assert.equal(summarize(carryForwardFixedCosts(deleted, currentDate), current).fixed, 0)
  const nextDate = parseDate('2026-11-25')
  const next = carryForwardFixedCosts(deleted, nextDate)
  assert.equal(summarize(next, getPeriod(nextDate, settings)).fixed, 0)
  assert.ok(next.fixedCostPeriods?.includes('2026-11-25'))
  assert.ok(validateData(next))
})
test('数か月後の再開でも最後の固定費を引き継ぎ、既存の固定費は上書きしない', () => {
  const data = structuredClone(initialData)
  data.costs = [{ id: 'a', name: '家賃', amount: 80000, kind: 'fixed', period: '2026-06-25' }]
  const today = parseDate('2026-10-23')
  const period = getPeriod(today, settings)
  const carried = carryForwardFixedCosts(data, today)
  assert.equal(summarize(carried, period).fixed, 80000)
  const explicitEmpty = markFixedCostPeriod(data, period.key)
  assert.equal(summarize(carryForwardFixedCosts(explicitEmpty, today), period).fixed, 0)
  assert.equal(summarize(carryForwardFixedCosts(carried, today), getPeriod(today, settings, -1)).fixed, 0)
})
test('バックアップを検証し、不正な金額や日付を拒否する', () => {
  assert.ok(validateData(initialData))
  // 目標機能があった旧バージョンの保存データもそのまま読み込める。
  assert.ok(validateData({ ...initialData, settings: { ...settings, target: 50000, dailyBudget: 2000 } }))
  assert.ok(!validateData({ ...initialData, settings: { ...settings, payday: 0 } }))
  assert.ok(!validateData({ ...initialData, loggedDates: ['2026-02-30'] }))
  assert.ok(!validateData({ ...initialData, costs: [{ id: 'a', name: 'x', kind: 'extra', amount: -100, period: '2026-10-01' }] }))
  assert.ok(!validateData(null))
})
test('カレンダーの合計編集は二重計上せず、0円と未記録を区別する', () => {
  const data = structuredClone(initialData)
  data.expenses = [
    { id: 'a', date: '2026-10-01', amount: 1000, note: '昼食', category: '食費' },
    { id: 'b', date: '2026-10-01', amount: 500, note: 'コーヒー' },
    { id: 'c', date: '2026-10-02', amount: 800, note: '' },
  ]
  const unchanged = saveDailyTotal(data, '2026-10-01', 1500)
  assert.equal(unchanged.expenses.length, 3)
  const edited = saveDailyTotal(data, '2026-10-01', 2000)
  assert.equal(edited.expenses.length, 2)
  assert.equal(edited.expenses.find(e => e.date === '2026-10-01')?.note, '昼食 / コーヒー')
  assert.equal(edited.expenses.reduce((s, e) => s + e.amount, 0), 2800)
  const zero = saveDailyTotal(edited, '2026-10-01', 0)
  assert.equal(zero.expenses.length, 1)
  assert.ok(zero.loggedDates.includes('2026-10-01'))
  assert.ok(validateData(zero))
  assert.equal(saveDailyTotal(data, '2026-10-01', -1), data)
})


test('予測は記録日の平均を使い、0円と今日の記録を反映する', () => {
  const data = structuredClone(initialData)
  data.settings.income = 100000
  const today = parseDate('2026-10-20')
  const period = getPeriod(today, data.settings)
  assert.equal(forecastSavings(data, period, today).amount, null)
  data.expenses = [{ id: 'a', date: '2026-10-18', amount: 2000, note: '' }]
  data.loggedDates = ['2026-10-18', '2026-10-19']
  data.drafts = { '2026-10-20': { expression: '999', mode: 'total', updatedAt: 1 } }
  assert.deepEqual(forecastSavings(data, period, today), { amount: 95000, days: 3 })
  data.loggedDates.push('2026-10-20')
  assert.deepEqual(forecastSavings(data, period, today), { amount: 96666, days: 2 })
  assert.equal(forecastSavings(data, period, period.next).amount, 98000)
  data.settings.income = 1000
  assert.ok(forecastSavings(data, period, today).amount! < 0)
  data.settings.income = 0
  assert.equal(forecastSavings(data, period, today).amount, null)
})
