import test from 'node:test'
import assert from 'node:assert/strict'
import { initialData, validateData, recordDailyAmount, saveDailyTotal, summarize, getPeriod, parseDate, carryForwardFixedCosts, migrateLegacyCosts, type Data, type Draft } from './finance'

const fresh = (): Data => structuredClone(initialData)
const expense = { id: 'e', date: '2026-10-19', amount: 123, note: 'メモ' }
const cost = { id: 'c', name: '家賃', amount: 70000, kind: 'fixed' as const, period: '2026-09-25' }
const invalid: [string, (d: Data) => unknown][] = [
  ...[null, false, 1, 'data', []].map((value, i): [string, () => unknown] => [`トップレベル${i}`, () => value]),
  ['バージョンなし', d => ({ ...d, version: undefined })],
  ['未知バージョン', d => ({ ...d, version: 2 })],
  ['設定なし', d => ({ ...d, settings: null })],
  ['設定が配列', d => ({ ...d, settings: [] })],
  ...[NaN, Infinity, -Infinity, -1, 0.5, 1000000001, '100', null].map((income, i): [string, (d: Data) => unknown] => [`手取り境界${i}`, d => ({ ...d, settings: { ...d.settings, income } })]),
  ...[0, 32, 1.5, '25', NaN].map((payday, i): [string, (d: Data) => unknown] => [`給料日境界${i}`, d => ({ ...d, settings: { ...d.settings, payday } })]),
  ['休日フラグ文字列', d => ({ ...d, settings: { ...d.settings, holidays: 'true' } })],
  ['支出なし', d => ({ ...d, expenses: null })],
  ['支出要素null', d => ({ ...d, expenses: [null] })],
  ['支出ID空', d => ({ ...d, expenses: [{ ...expense, id: '' }] })],
  ['支出ID重複', d => ({ ...d, expenses: [expense, { ...expense, date: '2026-10-18' }] })],
  ...[-1, 1.1, NaN, Infinity, 1000000001, '200'].map((amount, i): [string, (d: Data) => unknown] => [`支出額境界${i}`, d => ({ ...d, expenses: [{ ...expense, amount }] })]),
  ...['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01', '2026-10-20T00:00:00', '__proto__', 'x'].map((date, i): [string, (d: Data) => unknown] => [`支出日付境界${i}`, d => ({ ...d, expenses: [{ ...expense, date }] })]),
  ['メモがオブジェクト', d => ({ ...d, expenses: [{ ...expense, note: {} }] })],
  ['メモ長すぎ', d => ({ ...d, expenses: [{ ...expense, note: 'x'.repeat(501) }] })],
  ['旧カテゴリ不正', d => ({ ...d, expenses: [{ ...expense, category: 1 }] })],
  ['費用なし', d => ({ ...d, costs: null })],
  ['費用ID重複', d => ({ ...d, costs: [cost, cost] })],
  ['費用ID空', d => ({ ...d, costs: [{ ...cost, id: '' }] })],
  ['費用種別不正', d => ({ ...d, costs: [{ ...cost, kind: 'income' }] })],
  ['臨時支出の期間なし', d => ({ ...d, costs: [{ ...cost, kind: 'extra', period: undefined }] })],
  ['費用額負数', d => ({ ...d, costs: [{ ...cost, amount: -1 }] })],
  ['費用期間不正', d => ({ ...d, costs: [{ ...cost, period: '2026-02-30' }] })],
  ['記録日なし', d => ({ ...d, loggedDates: null })],
  ['記録日が不正', d => ({ ...d, loggedDates: ['not-a-date'] })],
  ['下書き配列', d => ({ ...d, drafts: [] })],
  ['下書きnull', d => ({ ...d, drafts: null })],
  ['下書き値null', d => ({ ...d, drafts: { '2026-10-19': null } })],
  ['下書き式が数値', d => ({ ...d, drafts: { '2026-10-19': { expression: 123, mode: 'add', updatedAt: 1 } } })],
  ['下書き種別不正', d => ({ ...d, drafts: { '2026-10-19': { expression: '1', mode: 'other', updatedAt: 1 } } })],
  ['下書き日時負数', d => ({ ...d, drafts: { '2026-10-19': { expression: '1', mode: 'add', updatedAt: -1 } } })],
  ['下書き日時Infinity', d => ({ ...d, drafts: { '2026-10-19': { expression: '1', mode: 'add', updatedAt: Infinity } } })],
  ['下書き日付不正', d => ({ ...d, drafts: { '__proto__': { expression: '1', mode: 'add', updatedAt: 1 }, bad: null } })],
  ['固定費マーカー形式', d => ({ ...d, fixedCostPeriods: {} })],
  ['固定費マーカー日付', d => ({ ...d, fixedCostPeriods: ['2026-02-30'] })],
  ['初期設定null', d => ({ ...d, setup: null })],
  ['初期設定フラグ不足', d => ({ ...d, setup: { paydayConfirmed: true } })],
]
for (const [label, mutate] of invalid) test(`不正な保存データを拒否し例外を出さない: ${label}`, () => {
  const value = mutate(fresh())
  assert.equal(validateData(value), false)
})
test('疎な配列・例外を投げるオブジェクトも保存可能と判定しない', () => {
  assert.equal(validateData({ ...fresh(), expenses: Array(1) }), false)
  assert.equal(validateData(new Proxy({}, { get() { throw new Error('Getter') } })), false)
})
test('有効な上限・ゼロ・うるう日・旧追加フィールドを読み込める', () => {
  const data = { ...fresh(), settings: { income: 1000000000, payday: 31, holidays: false, target: 1 }, expenses: [{ ...expense, amount: 0, date: '2024-02-29' }], costs: [{ ...cost, amount: 1000000000 }], drafts: { '2026-10-19': { expression: '1+'.repeat(250), mode: 'total', updatedAt: 0 } } }
  assert.ok(validateData(data))
  assert.ok(validateData(JSON.parse(JSON.stringify(data))))
  assert.ok(validateData({ ...fresh(), setup: undefined, drafts: undefined, fixedCostPeriods: undefined }))
})
test('無効な操作は支出・他の日の下書き・設定を変えない', () => {
  const data = { ...fresh(), expenses: [expense], drafts: { '2026-10-19': { expression: '99', mode: 'add' as const, updatedAt: 1 } } }
  const before = JSON.stringify(data)
  for (const date of ['bad', '2026-02-30', '2026-10-20T00:00:00']) {
    assert.equal(saveDailyTotal(data, date, 100), data)
    assert.equal(recordDailyAmount(data, date, 100, 'add'), data)
  }
  for (const amount of [-1, 0.1, NaN, Infinity, 1000000001]) {
    assert.equal(saveDailyTotal(data, '2026-10-19', amount), data)
    assert.equal(recordDailyAmount(data, '2026-10-19', amount, 'total'), data)
  }
  assert.equal(recordDailyAmount(data, '2026-10-19', 100, 'invalid' as Draft['mode']), data)
  assert.equal(JSON.stringify(data), before)
})
test('1,500回の追加・合計変更・0円記録で別の日を壊さず、独立した台帳モデルと一致する', () => {
  let seed = 20261020
  const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max }
  let data = fresh()
  data.settings.income = 300000
  data.costs = [cost]
  const ledger = new Map<string, number>()
  for (let i = 0; i < 1500; i++) {
    const day = `2026-10-${String(1 + random(20)).padStart(2, '0')}`, amount = random(10000), mode = random(2) ? 'add' : 'total'
    const before = JSON.stringify(data)
    const previous = data
    const untouched = previous.expenses.filter(entry => entry.date !== day)
    data = recordDailyAmount(data, day, amount, mode)
    ledger.set(day, mode === 'add' ? (ledger.get(day) ?? 0) + amount : amount)
    assert.equal(JSON.stringify(previous), before, `input mutated at ${i}`)
    assert.deepEqual(data.expenses.filter(entry => entry.date !== day), untouched)
    assert.ok(validateData(data), `invalid result at ${i}`)
    assert.deepEqual(JSON.parse(JSON.stringify(data)), data)
    for (const [key, total] of ledger) assert.equal(data.expenses.filter(entry => entry.date === key).reduce((sum, entry) => sum + entry.amount, 0), total)
    const summary = summarize(data, getPeriod(parseDate('2026-10-20'), data.settings))
    assert.equal(summary.spent, [...ledger.values()].reduce((sum, value) => sum + value, 0))
    assert.equal(summary.recorded, ledger.size)
    assert.deepEqual(data.costs, [cost])
  }
})
test('月をまたぐ移行を繰り返しても既存の支出・メモ・下書きを失わない', () => {
  let data: Data = { ...fresh(), expenses: [expense], costs: [cost], loggedDates: [expense.date], drafts: { '2026-10-18': { expression: '999＋', mode: 'add', updatedAt: 1 } } }
  const original = structuredClone(data)
  for (const key of ['2026-10-23', '2026-11-25', '2027-01-25', '2027-01-25', '2027-02-25']) {
    data = carryForwardFixedCosts(migrateLegacyCosts(data, parseDate(key)), parseDate(key))
    assert.ok(validateData(data))
    assert.deepEqual(data.expenses, original.expenses)
    assert.deepEqual(data.drafts, original.drafts)
    assert.deepEqual(data.loggedDates, original.loggedDates)
    assert.deepEqual(data.settings, original.settings)
    assert.deepEqual(carryForwardFixedCosts(data, parseDate(key)), data)
  }
})
