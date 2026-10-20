import test from 'node:test'
import assert from 'node:assert/strict'
import { consultationText } from './consultation'
import { initialData, getPeriod, parseDate } from './finance'

test('相談文は対象月期の固定費合計のみ含め、手取り・内訳・メモは含めない', () => {
  const data = structuredClone(initialData)
  const today = parseDate('2026-10-20'), period = getPeriod(today, data.settings)
  data.settings.income = 987654
  data.costs = [
    { id: 'c', name: 'PRIVATE_FIXED_NAME', kind: 'fixed', amount: 76543, period: period.key },
    { id: 'c2', name: 'PRIVATE_FIXED_OTHER', kind: 'fixed', amount: 1234, period: period.key },
    { id: 'c3', name: 'PRIVATE_EXTRA', kind: 'extra', amount: 4567, period: period.key },
    { id: 'c4', name: 'PRIVATE_PAST', kind: 'fixed', amount: 8901, period: '2026-08-25' },
  ]
  data.expenses = [{ id: 'e', date: '2026-10-19', amount: 1200, note: 'PRIVATE_NOTE' }]
  data.loggedDates = ['2026-10-19', '2026-10-18']
  const options = { data, period, today }
  const text = consultationText(options)
  for (const value of ['987654', '987,654', '76543', '76,543', '1,234', '4,567', '8,901', 'PRIVATE_FIXED_NAME', 'PRIVATE_FIXED_OTHER', 'PRIVATE_EXTRA', 'PRIVATE_PAST', 'PRIVATE_NOTE', '2026-10-19：']) assert.ok(!text.includes(value))
  assert.ok(text.includes('固定費の合計：77,777円'))
  assert.ok(text.includes('600円'))
  const detailed = consultationText({ ...options, includeDaily: true })
  assert.ok(detailed.includes('固定費の合計：77,777円'))
  assert.ok(detailed.includes('2026-10-19：1,200円'))
  assert.ok(detailed.includes('2026-10-18：0円'))
})
test('未設定の相談文では残額を捏造せず、終了した月期を現在の判断に使わせない', () => {
  const data = structuredClone(initialData), today = parseDate('2026-10-20')
  const current = consultationText({ data, today, period: getPeriod(today, data.settings) })
  assert.ok(current.includes('手取り未設定のため算出不可'))
  assert.ok(current.includes('固定費の合計：0円'))
  assert.ok(!current.includes('買いたいもの'))
  assert.ok(!current.includes('迷っている買い物'))
  const past = consultationText({ data, today, period: getPeriod(today, data.settings, -1) })
  assert.ok(past.includes('対象は終了した月期'))
  assert.ok(!past.includes('今の支出ペースで残せる額：'))
})
