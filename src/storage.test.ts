import test from 'node:test'
import assert from 'node:assert/strict'
import { DataStorage, PREVIOUS_KEY, STORAGE_KEY, UNREADABLE_KEY, parseBackup, prepareData, storageMessages, type LockRunner } from './storage'
import { initialData, parseDate, validateData } from './finance'

const today = parseDate('2026-10-20')
const fixture = () => ({ ...structuredClone(initialData), settings: { ...initialData.settings, income: 250000 }, expenses: [{ id: 'e1', date: '2026-10-19', amount: 1234, note: '残しておく記録' }], costs: [{ id: 'c1', kind: 'fixed' as const, period: '2026-09-25', amount: 75000, name: '家賃' }], loggedDates: ['2026-10-19'], drafts: { '2026-10-18': { expression: '580＋', mode: 'add' as const, updatedAt: 123 } } })
class MemoryStorage {
  values = new Map<string, string>()
  writes: [string, string][] = []
  failRead = false
  failKey = ''
  getItem(key: string) { if (this.failRead) throw new DOMException('Denied', 'SecurityError'); return this.values.get(key) ?? null }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new DOMException('Full', 'QuotaExceededError')
    this.writes.push([key, value]); this.values.set(key, value)
  }
}
function mutex(): LockRunner {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(task: () => T) => { const result = tail.then(task); tail = result.catch(() => {}); return result }
}
function setup(raw: string | null = JSON.stringify(fixture())) {
  const storage = new MemoryStorage()
  if (raw !== null) storage.values.set(STORAGE_KEY, raw)
  const locks = mutex()
  return { storage, locks, session: new DataStorage(() => storage, locks, today), raw }
}

test('新規起動は読み込みだけでは書かず、安全な保存時に初期値を書き込む', async () => {
  const { storage, session } = setup(null)
  assert.deepEqual(session.loaded, { data: initialData, error: '' })
  assert.equal(storage.writes.length, 0)
  assert.equal((await session.save(session.loaded.data)).ok, true)
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!), initialData)
})
for (const raw of ['', '{broken', 'null', '[]', '{}', JSON.stringify({ ...fixture(), version: 2 }), JSON.stringify({ ...fixture(), expenses: [fixture().expenses[0], fixture().expenses[0]] })]) {
  test(`読めない既存記録を初期値で上書きしない: ${raw.slice(0, 35)}`, async () => {
    const { storage, session } = setup(raw)
    assert.ok(session.loaded.error)
    assert.equal((await session.save(initialData)).ok, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
    assert.equal(session.exportText(initialData), raw)
    assert.equal(storage.writes.length, 0)
  })
}
test('保存領域自体が取得できない場合も書き込まず、空のバックアップを作らない', async () => {
  const session = new DataStorage(() => { throw new DOMException('Denied', 'SecurityError') }, mutex(), today)
  assert.ok(session.loaded.error)
  assert.equal((await session.save(initialData)).ok, false)
  assert.throws(() => session.exportText(initialData))
})
test('getItem失敗後にアクセスが戻っても、再読み込み前には上書きしない', async () => {
  const { storage, locks, raw } = setup()
  storage.failRead = true
  const session = new DataStorage(() => storage, locks, today)
  storage.failRead = false
  assert.equal((await session.replace(initialData)).ok, false)
  assert.equal(storage.getItem(STORAGE_KEY), raw)
})
test('同じ内容の再保存は本体も退避も書き換えない', async () => {
  const { storage, session } = setup(JSON.stringify(initialData))
  assert.deepEqual(await session.save(initialData), { ok: true })
  assert.equal(storage.writes.length, 0)
})
test('更新前の完全な記録を先に退避し、設定・メモ・下書きを保持する', async () => {
  const { storage, session, raw } = setup()
  const next = { ...session.loaded.data, settings: { ...session.loaded.data.settings, income: 260000 } }
  assert.equal((await session.save(next)).ok, true)
  assert.equal(storage.getItem(PREVIOUS_KEY), raw)
  assert.equal(storage.writes[0][0], PREVIOUS_KEY)
  assert.equal(storage.writes[1][0], STORAGE_KEY)
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!), next)
  assert.equal(new DataStorage(() => storage, mutex(), today).loaded.data.expenses[0].note, '残しておく記録')
})
for (const failedKey of [STORAGE_KEY, PREVIOUS_KEY]) {
  test(`容量不足で書き込みに失敗しても元の記録が残る: ${failedKey}`, async () => {
    const { storage, session, raw } = setup()
    storage.values.set(PREVIOUS_KEY, 'older-backup')
    storage.failKey = failedKey
    const next = { ...session.loaded.data, settings: { ...session.loaded.data.settings, income: 300000 } }
    assert.equal((await session.save(next)).ok, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
    if (failedKey === PREVIOUS_KEY) assert.equal(storage.getItem(PREVIOUS_KEY), 'older-backup')
    assert.deepEqual(JSON.parse(session.exportText(next)), next)
    storage.failKey = ''
    assert.equal((await session.save(initialData)).ok, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
  })
}
test('保存前の読み込み失敗でも本体・退避を変更しない', async () => {
  const { storage, session, raw } = setup()
  storage.failRead = true
  assert.equal((await session.save(initialData)).ok, false)
  storage.failRead = false
  assert.equal(storage.getItem(STORAGE_KEY), raw)
  assert.equal(storage.writes.length, 0)
})
test('別タブの新しい記録を古い画面から上書きしない', async () => {
  const { storage, session, locks } = setup()
  const other = new DataStorage(() => storage, locks, today)
  const newer = { ...other.loaded.data, expenses: [...other.loaded.data.expenses, { id: 'new', date: '2026-10-20', amount: 2000, note: '' }] }
  assert.equal((await other.save(newer)).ok, true)
  const latest = storage.getItem(STORAGE_KEY)
  assert.equal(session.checkForExternalChange(), storageMessages.conflict)
  assert.equal((await session.save(session.loaded.data)).ok, false)
  assert.equal((await session.replace(initialData)).ok, false)
  assert.equal(storage.getItem(STORAGE_KEY), latest)
  assert.deepEqual(JSON.parse(session.exportText(session.loaded.data)), session.loaded.data)
})
test('同時に保存を要求した2画面は1画面だけ成功し、もう一方は競合で停止する', async () => {
  const { storage, locks } = setup()
  const a = new DataStorage(() => storage, locks, today), b = new DataStorage(() => storage, locks, today)
  const first = { ...a.loaded.data, settings: { ...a.loaded.data.settings, income: 111111 } }
  const second = { ...b.loaded.data, settings: { ...b.loaded.data.settings, income: 222222 } }
  const results = await Promise.all([a.save(first), b.save(second)])
  assert.deepEqual(results.map(result => result.ok), [true, false])
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!), first)
})
test('同一画面で連続入力した場合、古い保存要求が新しい内容へ巻き戻さない', async () => {
  const { storage, session } = setup()
  const a = { ...session.loaded.data, drafts: { '2026-10-20': { expression: '1', mode: 'total' as const, updatedAt: 1 } } }
  const b = { ...a, drafts: { '2026-10-20': { expression: '123', mode: 'total' as const, updatedAt: 2 } } }
  const results = await Promise.all([session.save(a), session.save(b)])
  assert.deepEqual(results[0], { ok: true, skipped: true })
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!), b)
})
test('外部で削除された記録を古いタブが復活させない', async () => {
  const { storage, session } = setup()
  storage.values.delete(STORAGE_KEY)
  assert.equal((await session.save(session.loaded.data)).ok, false)
  assert.equal(storage.getItem(STORAGE_KEY), null)
})
test('本体だけが消えて退避が残った場合、新規データ扱いで自動保存しない', async () => {
  const { storage, locks, raw } = setup(null)
  storage.values.set(PREVIOUS_KEY, JSON.stringify(fixture()))
  const session = new DataStorage(() => storage, locks, today)
  assert.ok(session.loaded.error)
  assert.equal((await session.save(initialData)).ok, false)
  assert.equal(storage.getItem(STORAGE_KEY), raw)
  assert.deepEqual(JSON.parse(session.exportText(initialData)), fixture())
})
test('読み込めない本体を明示的に置き換えるときも元の生データと有効な退避を保持する', async () => {
  const { storage, session } = setup('{broken-original')
  const backup = JSON.stringify(fixture())
  storage.values.set(PREVIOUS_KEY, backup)
  assert.equal((await session.replace(fixture())).ok, true)
  assert.equal(storage.getItem(UNREADABLE_KEY), '{broken-original')
  assert.equal(storage.getItem(PREVIOUS_KEY), backup)
  assert.deepEqual(JSON.parse(session.exportText(fixture())), fixture())
})
test('明示的な初期化も元の記録を退避し、関係ないブラウザの値を消さない', async () => {
  const { storage, session, raw } = setup()
  storage.values.set('unrelated', 'keep')
  assert.equal((await session.replace(structuredClone(initialData))).ok, true)
  assert.equal(storage.getItem(PREVIOUS_KEY), raw)
  assert.equal(storage.getItem('unrelated'), 'keep')
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)!), initialData)
})
test('排他制御が使えない環境では無断で非排他保存へ切り替えない', async () => {
  const { storage, raw } = setup()
  const session = new DataStorage(() => storage, null, today)
  assert.deepEqual(await session.save(initialData), { ok: false, error: storageMessages.lock })
  assert.equal(storage.getItem(STORAGE_KEY), raw)
})
test('ロックの取得に失敗した場合は書かない', async () => {
  const { storage, raw } = setup()
  const session = new DataStorage(() => storage, async () => { throw new Error('Lock failed') }, today)
  assert.equal((await session.save(initialData)).ok, false)
  assert.equal(storage.getItem(STORAGE_KEY), raw)
})
test('不正な保存候補・循環参照・BigIntは保存前に拒否する', async () => {
  for (const bad of [{ ...fixture(), settings: { ...initialData.settings, income: NaN } }, { ...fixture(), extra: 1n }, Object.assign(fixture(), { self: null })]) {
    if ('self' in bad) bad.self = bad as never
    const { storage, session, raw } = setup()
    assert.equal((await session.save(bad)).ok, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
    assert.equal(storage.writes.length, 0)
  }
})
test('古い形式の移行はメモ・下書き・未知の追加フィールドを残し、繰り返しても増殖しない', () => {
  const legacy = { ...fixture(), settings: { ...fixture().settings, target: 10000, dailyBudget: 2000 }, costs: [{ id: 'old', name: '家賃', amount: 75000, kind: 'fixed' }], preferences: { countdownPaused: true } }
  const original = JSON.stringify(legacy)
  const once = prepareData(original, today), twice = prepareData(JSON.stringify(once), today)
  assert.deepEqual(twice, once)
  assert.equal(once.costs.length, 1)
  assert.equal(once.costs[0].period, '2026-09-25')
  assert.deepEqual(once.drafts, legacy.drafts)
  assert.deepEqual(once.settings, legacy.settings)
  assert.equal(JSON.stringify(legacy), original)
  assert.ok(validateData(once))
})
test('バックアップのJSON往復で全項目が保持され、壊れたファイルは拒否する', () => {
  const data = prepareData(JSON.stringify(fixture()), today)
  assert.deepEqual(parseBackup(JSON.stringify(data), today), data)
  for (const bad of ['', '\uFEFF{}', '{', 'null', JSON.stringify({ ...fixture(), version: 999 })]) assert.throws(() => parseBackup(bad, today))
  assert.throws(() => parseBackup(JSON.stringify({ ...fixture(), padding: 'x'.repeat(5_000_000) }), today))
  const multibyte = JSON.stringify({ ...fixture(), padding: 'あ'.repeat(1_700_000) })
  assert.ok(multibyte.length < 5_000_000)
  assert.throws(() => parseBackup(multibyte, today))
})

test('未保存の入力がある間だけ離脱を検出し、保存成功後には解除する', async () => {
  const { session, storage } = setup()
  await session.save(session.loaded.data)
  assert.equal(session.hasUnsavedChanges(session.loaded.data), false)
  const next = { ...session.loaded.data, settings: { ...session.loaded.data.settings, income: 333333 } }
  assert.equal(session.hasUnsavedChanges(next), true)
  assert.equal((await session.save(next)).ok, true)
  assert.equal(session.hasUnsavedChanges(next), false)
  storage.failKey = STORAGE_KEY
  const unsaved = { ...next, expenses: [] }
  assert.equal((await session.save(unsaved)).ok, false)
  assert.equal(session.hasUnsavedChanges(unsaved), true)
})
test('読めない保存データがあるだけで未編集画面の離脱を妨げない', () => {
  const { session } = setup('{broken')
  assert.equal(session.hasUnsavedChanges(session.loaded.data), false)
  assert.equal(session.hasUnsavedChanges({ ...session.loaded.data, settings: { ...session.loaded.data.settings, income: 100 } }), true)
})
