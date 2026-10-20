import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { largeHistory, historyToday } from '../tests/fixtures/largeHistory'
import { DataStorage, STORAGE_KEY, PREVIOUS_KEY, parseBackup, type LockRunner } from './storage'
import { recordDailyAmount, getPeriod, summarize } from './finance'

const lock: LockRunner = async task => task()
class QuotaStorage {
  values = new Map<string, string>()
  quota = Infinity
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) {
    const next = new Map(this.values); next.set(key, value)
    const bytes = [...next].reduce((sum, [k, v]) => sum + (k.length + v.length) * 2, 0)
    if (bytes > this.quota) throw new DOMException('Full', 'QuotaExceededError')
    this.values = next
  }
}

test('30年分・約3万件を読み込み、編集・退避・再読込・バックアップ往復で古い記録を欠落させない', async t => {
  const data = largeHistory(), raw = JSON.stringify(data)
  assert.ok(data.expenses.length > 29000)
  const storage = new QuotaStorage(); storage.setItem(STORAGE_KEY, raw)
  const start = performance.now()
  const session = new DataStorage(() => storage, lock, historyToday)
  assert.equal(session.loaded.error, '')
  assert.deepEqual(session.loaded.data, data)
  const period = getPeriod(historyToday, data.settings)
  const expectedSpend = data.expenses.filter(e => e.date >= period.key && e.date <= '2026-10-20').reduce((sum, e) => sum + e.amount, 0)
  assert.equal(summarize(session.loaded.data, period).spent, expectedSpend)
  const next = recordDailyAmount(session.loaded.data, '2026-10-20', 1234, 'add')
  assert.equal((await session.save(next)).ok, true)
  assert.equal(storage.getItem(PREVIOUS_KEY), raw)
  assert.deepEqual(next.expenses.filter(e => e.date !== '2026-10-20'), data.expenses.filter(e => e.date !== '2026-10-20'))
  const reloaded = new DataStorage(() => storage, lock, historyToday)
  assert.deepEqual(reloaded.loaded.data, next)
  const backup = session.exportText(next)
  assert.deepEqual(parseBackup(backup, historyToday), next)
  const destination = new QuotaStorage()
  assert.equal((await new DataStorage(() => destination, lock, historyToday).replace(parseBackup(backup, historyToday))).ok, true)
  assert.deepEqual(new DataStorage(() => destination, lock, historyToday).loaded.data, next)
  t.diagnostic(`${data.expenses.length} expenses, ${data.costs.length} costs, ${new Blob([raw]).size} stored UTF-8 bytes, ${new Blob([backup]).size} export bytes; round trip ${Math.round(performance.now() - start)} ms (diagnostic only)`)
})

test('長い日本語メモが10年分ある場合も、自分で書き出したバックアップを読み込める', () => {
  const data = largeHistory(10, 1, 480)
  const storage = new QuotaStorage(); storage.setItem(STORAGE_KEY, JSON.stringify(data))
  const session = new DataStorage(() => storage, lock, historyToday)
  const backup = session.exportText(data)
  assert.ok(new Blob([backup]).size > 5_000_000)
  assert.deepEqual(parseBackup(backup, historyToday), data)
})

for (const stage of ['backup', 'primary']) {
  test(`大量データで${stage}の容量上限に達しても既存の全履歴を保持し、未保存分を取り出せる`, async () => {
    const data = largeHistory(10), raw = JSON.stringify(data)
    const storage = new QuotaStorage(); storage.setItem(STORAGE_KEY, raw)
    const next = recordDailyAmount(data, '2026-10-20', 9999, 'add'), nextRaw = JSON.stringify(next)
    const baseSize = (STORAGE_KEY.length + raw.length) * 2
    const backupSize = (PREVIOUS_KEY.length + raw.length) * 2
    // Exact UTF-16 budget for both keys: fail either the backup or the growth of the primary.
    storage.quota = stage === 'backup' ? baseSize + backupSize - 1 : baseSize + backupSize
    assert.ok(nextRaw.length > raw.length)
    const session = new DataStorage(() => storage, lock, historyToday)
    assert.equal((await session.save(next)).ok, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
    assert.equal(storage.getItem(PREVIOUS_KEY), stage === 'backup' ? null : raw)
    assert.deepEqual(parseBackup(session.exportText(next), historyToday), next)
    assert.deepEqual(new DataStorage(() => storage, lock, historyToday).loaded.data, data)
  })
}
