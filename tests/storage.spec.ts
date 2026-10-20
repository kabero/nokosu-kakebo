import { test, expect, type Page } from '@playwright/test'
import { largeHistory } from './fixtures/largeHistory'
import { readFile } from 'node:fs/promises'

const KEY = 'yohaku-money-v1', PREVIOUS = `${KEY}:previous`, APP = 'http://127.0.0.1:4181', SITE = 'http://127.0.0.1:4180'
function fixture() {
  return { version: 1, settings: { income: 250000, payday: 25, holidays: true }, expenses: [{ id: 'e1', date: '2026-10-18', amount: 1200, note: '消さないメモ' }, { id: 'e2', date: '2026-10-19', amount: 800, note: '' }], costs: [{ id: 'c1', name: '家賃', kind: 'fixed', amount: 80000, period: '2026-09-25' }, { id: 'c2', name: '旅行', kind: 'extra', amount: 2000, period: '2026-09-25' }], loggedDates: ['2026-10-17', '2026-10-18', '2026-10-19'], drafts: { '2026-10-16': { expression: '580＋', mode: 'total', updatedAt: 1 } }, fixedCostPeriods: ['2026-09-25'], setup: { paydayConfirmed: true, fixedCostsConfirmed: true, dismissed: true } }
}
async function start(page: Page, raw: string | null = JSON.stringify(fixture()), extra?: [string, string]) {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00+09:00') })
  await page.addInitScript(({ raw, extra, KEY }) => {
    if (localStorage.getItem('__seeded') !== 'yes') {
      if (raw !== null) localStorage.setItem(KEY, raw)
      if (extra) localStorage.setItem(extra[0], extra[1])
      localStorage.setItem('nokori-install-v1', 'dismissed')
      localStorage.setItem('__seeded', 'yes')
    }
  }, { raw, extra, KEY })
  await page.goto('/')
  await expect(page.locator('.savings-card')).toBeVisible()
}
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), KEY)
const data = async (page: Page) => JSON.parse((await raw(page))!) as ReturnType<typeof fixture>
async function openSettings(page: Page) { await page.getByRole('button', { name: '設定', exact: true }).click() }
async function download(page: Page, button = 'バックアップを書き出す') {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: button, exact: true }).click()
  const file = await pending
  return readFile((await file.path())!, 'utf8')
}
async function inputToday(page: Page, value: string) {
  await page.getByRole('button', { name: /^今日の(金額を入力|金額を追加|入力を再開)$/ }).click()
  await page.locator('input[name=dailyAmount]').fill(value)
}
async function saveDay(page: Page) { await page.getByRole('button', { name: '保存', exact: true }).click() }
async function importFile(page: Page, text: string) {
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) })
}

test('再読み込みで設定・支出・固定費・メモ・0円日・下書きが完全に保持される', async ({ page }) => {
  await start(page)
  await expect.poll(() => data(page)).toEqual(fixture())
  await page.reload()
  await expect(page.locator('.hero-amount')).toContainText('166,000')
  expect(await data(page)).toEqual(fixture())
  await openSettings(page)
  expect(JSON.parse(await download(page))).toEqual(fixture())
})
for (const broken of ['', '{not-json', JSON.stringify({ ...fixture(), version: 2 }), JSON.stringify({ ...fixture(), expenses: [fixture().expenses[0], fixture().expenses[0]] })]) {
  test(`読めない既存データを操作や再読み込みで上書きしない: ${broken.slice(0, 20)}`, async ({ page }) => {
    await start(page, broken)
    await expect(page.getByRole('alert')).toContainText('保存を停止')
    await openSettings(page)
    await page.locator('input[name=income]').fill('300000')
    await page.getByRole('button', { name: '設定を保存', exact: true }).click()
    expect(await raw(page)).toBe(broken)
    expect(await download(page)).toBe(broken)
    page.once('dialog', dialog => dialog.accept())
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('保存を停止')
    expect(await raw(page)).toBe(broken)
  })
}
test('追加・合計変更・0円への変更で対象日だけ更新される', async ({ page }) => {
  await start(page)
  await inputToday(page, '580＋920')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses.filter(e => e.date === '2026-10-20').reduce((sum, e) => sum + e.amount, 0)).toBe(1500)
  await page.getByRole('button', { name: '今日の金額を追加', exact: true }).click()
  await page.locator('input[name=dailyAmount]').fill('500')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses.filter(e => e.date === '2026-10-20').reduce((sum, e) => sum + e.amount, 0)).toBe(2000)
  await page.getByRole('button', { name: '今日の金額を追加', exact: true }).click()
  await page.getByRole('button', { name: '合計を変更', exact: true }).click()
  await page.locator('input[name=dailyAmount]').fill('0')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses).toEqual(fixture().expenses)
  expect((await data(page)).loggedDates).toContain('2026-10-20')
  expect((await data(page)).drafts['2026-10-16']).toEqual(fixture().drafts['2026-10-16'])
})
test('途中の式を再開でき、保存後はその日の下書きだけが消える', async ({ page }) => {
  await start(page)
  await inputToday(page, '123＋')
  await expect.poll(async () => (await data(page)).drafts).toHaveProperty('2026-10-20.expression', '123＋')
  await page.reload()
  await page.getByRole('button', { name: '今日の入力を再開', exact: true }).click()
  await expect(page.locator('input[name=dailyAmount]')).toHaveValue('123＋')
  await page.locator('input[name=dailyAmount]').fill('123＋77')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).drafts).toEqual(fixture().drafts)
  expect((await data(page)).expenses.filter(e => e.date === '2026-10-20')[0].amount).toBe(200)
})
test('不正なバックアップと確認キャンセルは既存データを変えない', async ({ page }) => {
  await start(page)
  await openSettings(page)
  const before = await raw(page)
  await importFile(page, '{broken')
  await expect(page.getByRole('alert')).toContainText('読み込めませんでした')
  expect(await raw(page)).toBe(before)
  page.once('dialog', dialog => dialog.dismiss())
  await importFile(page, JSON.stringify({ ...fixture(), settings: { ...fixture().settings, income: 999999 } }))
  expect(await raw(page)).toBe(before)
})
test('有効なバックアップの置換は元データを退避してから反映する', async ({ page }) => {
  await start(page)
  await openSettings(page)
  const before = await raw(page)
  const next = { ...fixture(), settings: { ...fixture().settings, income: 222222 } }
  page.once('dialog', dialog => dialog.accept())
  await importFile(page, JSON.stringify(next))
  await expect.poll(() => data(page)).toEqual(next)
  expect(await page.evaluate(key => localStorage.getItem(key), PREVIOUS)).toBe(before)
  await page.reload()
  expect(await data(page)).toEqual(next)
})
test('リセットのキャンセルは何も変えず、確定時にも直前の記録を退避する', async ({ page }) => {
  await start(page)
  await openSettings(page)
  const before = await raw(page)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'すべてのデータを初期化', exact: true }).click()
  expect(await raw(page)).toBe(before)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'すべてのデータを初期化', exact: true }).click()
  await expect.poll(async () => (await data(page)).expenses).toEqual([])
  expect(await page.evaluate(key => localStorage.getItem(key), PREVIOUS)).toBe(before)
})
test('容量不足で保存できなくても本体が残り、入力分はバックアップで取り出せる', async ({ page }) => {
  await start(page)
  const before = await raw(page)
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, name, value) }
  }, KEY)
  await inputToday(page, '1500')
  await expect(page.getByRole('alert')).toContainText('保存できませんでした')
  await saveDay(page)
  expect(await raw(page)).toBe(before)
  await openSettings(page)
  const exported = JSON.parse(await download(page))
  expect(exported.expenses.find((e: { date: string }) => e.date === '2026-10-20').amount).toBe(1500)
  expect(exported.expenses.filter((e: { date: string }) => e.date !== '2026-10-20')).toEqual(fixture().expenses)
})
test('保存前の退避に失敗した場合も元データを上書きしない', async ({ page }) => {
  await start(page)
  const before = await raw(page)
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, name, value) }
  }, PREVIOUS)
  await inputToday(page, '500')
  await expect(page.getByRole('alert')).toContainText('保存できませんでした')
  expect(await raw(page)).toBe(before)
})
test('2つのタブでの編集が古い状態による上書きにならない', async ({ page, context }) => {
  await start(page)
  const other = await context.newPage()
  await other.clock.install({ time: new Date('2026-10-20T12:00:00+09:00') })
  await other.goto('/')
  await expect(other.locator('.savings-card')).toBeVisible()
  await inputToday(page, '1500')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses.some(e => e.date === '2026-10-20')).toBe(true)
  const newest = await raw(page)
  await expect(other.getByRole('alert')).toContainText('別の画面で記録が変更')
  await inputToday(other, '900')
  await saveDay(other)
  expect(await raw(other)).toBe(newest)
  await openSettings(other)
  const unsaved = JSON.parse(await download(other))
  expect(unsaved.expenses.find((e: { date: string }) => e.date === '2026-10-20').amount).toBe(900)
  other.once('dialog', dialog => dialog.accept())
  await other.reload()
  await expect.poll(() => raw(other)).toBe(newest)
})
test('読み込み失敗時に前回の正常な保存をファイルとして取り出せる', async ({ page }) => {
  const backup = JSON.stringify(fixture())
  await start(page, '{broken', [PREVIOUS, backup])
  await expect(page.getByRole('alert')).toContainText('保存を停止')
  expect(await download(page, '前回の保存を取り出す')).toBe(backup)
  expect(await raw(page)).toBe('{broken')
})
test('旧形式の固定費を繰り返し起動しても増殖させず、他の記録を保持する', async ({ page }) => {
  const legacy = { ...fixture(), costs: [{ id: 'legacy-rent', name: '家賃', kind: 'fixed', amount: 80000 }], fixedCostPeriods: undefined, settings: { ...fixture().settings, target: 50000 } }
  const original = JSON.stringify(legacy)
  await start(page, original)
  await expect.poll(async () => (await data(page)).costs[0].period).toBe('2026-09-25')
  const migrated = await raw(page)
  expect(await page.evaluate(key => localStorage.getItem(key), PREVIOUS)).toBe(original)
  await page.reload()
  await expect(page.locator('.savings-card')).toBeVisible()
  expect(await raw(page)).toBe(migrated)
  expect((await data(page)).expenses).toEqual(fixture().expenses)
  expect((await data(page)).drafts).toEqual(fixture().drafts)
})
test('排他制御がないブラウザでは元データを守って保存を停止する', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }))
  await start(page)
  await expect(page.getByRole('alert')).toContainText('安全に保存')
  expect(await raw(page)).toBe(JSON.stringify(fixture()))
})
test('CSPで通常の保存とPNG生成を妨げず、注入されたスクリプトを拒否する', async ({ page, context }) => {
  const headers = await readFile('dist-app/_headers', 'utf8')
  const csp = headers.match(/Content-Security-Policy: (.+)/)![1]
  await context.route(`${APP}/**`, async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } }) })
  await start(page)
  await inputToday(page, '777')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses.some(e => e.amount === 777)).toBe(true)
  await page.getByRole('button', { name: '画像で保存', exact: true }).click()
  await expect(page.getByRole('img', { name: '保存する残せるお金のカード' })).toBeVisible()
  const injected = await page.evaluate(() => {
    const el = document.createElement('script'); el.textContent = 'window.__injected = true'; document.body.append(el)
    return (window as unknown as { __injected?: boolean }).__injected
  })
  expect(injected).toBeUndefined()
})
test('別オリジンへの移行で書き出し・読み込み・旧記録の削除が独立する', async ({ page, context }) => {
  await start(page, null)
  const site = await context.newPage()
  await site.goto(SITE)
  await site.evaluate(({ KEY, value }) => localStorage.setItem(KEY, value), { KEY, value: JSON.stringify(fixture()) })
  await site.goto(`${SITE}/app/`)
  const backup = await download(site)
  await openSettings(page)
  page.once('dialog', dialog => dialog.accept())
  await importFile(page, backup)
  await expect.poll(() => data(page)).toEqual(fixture())
  site.once('dialog', dialog => dialog.accept())
  await site.getByRole('button', { name: '移行元の記録を削除', exact: true }).click()
  expect(await raw(site)).toBeNull()
  expect(await data(page)).toEqual(fixture())
})

test('読み取り権限エラー時に初期値で上書きしたり空のバックアップを出さない', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem
    Object.assign(window, { __originalGet: original })
    Storage.prototype.getItem = function (key) { if (key === 'yohaku-money-v1') throw new DOMException('Denied', 'SecurityError'); return original.call(this, key) }
  })
  await start(page)
  await expect(page.getByRole('alert')).toContainText('保存を停止')
  await openSettings(page)
  await page.getByRole('button', { name: 'バックアップを書き出す', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('記録を読み出せませんでした')
  const stored = await page.evaluate(key => (window as unknown as { __originalGet: typeof Storage.prototype.getItem }).__originalGet.call(localStorage, key), KEY)
  expect(stored).toBe(JSON.stringify(fixture()))
})
test('速い連続入力でも途中の古い式に巻き戻らず再開できる', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: /^今日の(金額を入力|金額を追加|入力を再開)$/ }).click()
  await page.locator('input[name=dailyAmount]').pressSequentially('580+920+150')
  await expect.poll(async () => (await data(page)).drafts).toHaveProperty('2026-10-20.expression', '580+920+150')
  await page.reload()
  await page.getByRole('button', { name: '今日の入力を再開', exact: true }).click()
  await expect(page.locator('input[name=dailyAmount]')).toHaveValue('580+920+150')
  expect((await data(page)).expenses).toEqual(fixture().expenses)
})
test('書き込み直前まで2タブを同時待機させても、排他制御下で古い全体データを上書きしない', async ({ page, context }) => {
  await start(page)
  const other = await context.newPage()
  await other.clock.install({ time: new Date('2026-10-20T12:00:00+09:00') })
  await other.goto('/')
  await expect(other.locator('.savings-card')).toBeVisible()
  await expect.poll(async () => page.evaluate(async () => (await navigator.locks.query()).held!.length)).toBe(0)
  await page.evaluate(() => {
    void navigator.locks.request('nokosu-household-storage', () => new Promise<void>(resolve => Object.assign(window, { __releaseLock: resolve })))
  })
  await expect.poll(async () => page.evaluate(async () => (await navigator.locks.query()).held!.length)).toBe(1)
  await inputToday(page, '1500')
  await inputToday(other, '900')
  await saveDay(page)
  await saveDay(other)
  await page.evaluate(() => (window as unknown as { __releaseLock: () => void }).__releaseLock())
  await expect.poll(async () => { const amounts = (await data(page)).expenses.filter(e => e.date === '2026-10-20').map(e => e.amount); return amounts.length === 1 && [1500, 900].includes(amounts[0]) }).toBe(true)
  const winner = (await data(page)).expenses.find(e => e.date === '2026-10-20')!.amount
  const loser = winner === 1500 ? other : page
  await expect(loser.getByRole('alert')).toContainText('別の画面で記録が変更')
  expect((await data(page)).expenses.filter(e => e.date !== '2026-10-20')).toEqual(fixture().expenses)
})
test.describe('オフライン保存', () => {
  test.use({ serviceWorkers: 'allow' })
  test('オフラインで追加した金額が再読み込み後も保持される', async ({ page, context }) => {
    await start(page)
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await context.setOffline(true)
    try {
      await page.reload()
      await inputToday(page, '888')
      await saveDay(page)
      await expect.poll(async () => (await data(page)).expenses.some(e => e.date === '2026-10-20' && e.amount === 888)).toBe(true)
      await page.reload()
      await expect(page.locator('.savings-card')).toBeVisible()
      expect((await data(page)).expenses.filter(e => e.date !== '2026-10-20')).toEqual(fixture().expenses)
      expect((await data(page)).expenses.find(e => e.date === '2026-10-20')!.amount).toBe(888)
    } finally { await context.setOffline(false) }
  })
})

test('保存失敗後の未保存分を捨てて閉じる前に確認が出る', async ({ page }) => {
  await start(page)
  await page.evaluate(key => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, name, value) }
  }, KEY)
  await inputToday(page, '1500')
  await expect(page.getByRole('alert')).toContainText('保存できませんでした')
  const warning = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const dialog = await warning
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  expect(page.isClosed()).toBe(false)
  await expect(page.locator('input[name=dailyAmount]')).toHaveValue('1500')
  expect((await data(page)).expenses).toEqual(fixture().expenses)
})

for (const mode of ['display-mode', 'ios-standalone']) {
  test(`PWAから紹介サイトを開いても移行ページへ転送しない: ${mode}`, async ({ page }) => {
    await page.addInitScript(mode => {
      if (mode === 'ios-standalone') Object.defineProperty(navigator, 'standalone', { value: true })
      else {
        const original = window.matchMedia.bind(window)
        window.matchMedia = query => query === '(display-mode: standalone)' ? Object.assign(original(query), { matches: true }) : original(query)
      }
    }, mode)
    await page.goto(SITE)
    await expect(page.locator('.lp-hero')).toBeVisible()
    await expect(page).toHaveURL(`${SITE}/`)
    await page.goto(`${SITE}/app/`)
    await expect(page.getByRole('heading', { name: '家計簿のURLが変わりました' })).toBeVisible()
  })
}

for (const width of [320, 375, 390]) {
  test(`スマホ幅${width}pxでもカレンダーの金額を1行で表示する`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const sample = fixture()
    sample.expenses[0].amount = 12345
    sample.expenses[1].amount = 123456
    await start(page, JSON.stringify(sample))
    await page.getByRole('button', { name: '支出の記録', exact: true }).click()
    for (const date of ['2026-10-18', '2026-10-19']) {
      const amount = page.locator(`[data-date="${date}"] > strong`)
      await expect(amount).toBeVisible()
      const metrics = await amount.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el)
        const text = range.getBoundingClientRect(), cell = el.parentElement!.getBoundingClientRect()
        return { lines: range.getClientRects().length, fits: text.left >= cell.left && text.right <= cell.right }
      })
      expect(metrics).toEqual({ lines: 1, fits: true })
    }
  })
}

test('金額の保存を取り消すと他の日を保ったまま元に戻り、再読み込みでも保持される', async ({ page }) => {
  await start(page)
  await inputToday(page, '1500')
  await saveDay(page)
  await page.getByRole('button', { name: '元に戻す', exact: true }).click()
  await expect.poll(async () => (await data(page)).expenses).toEqual(fixture().expenses)
  expect((await data(page)).loggedDates).toEqual(fixture().loggedDates)
  await page.reload()
  expect((await data(page)).expenses).toEqual(fixture().expenses)
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0)
})
test('固定費の削除を取り消すと名前・金額・月期が完全に復元される', async ({ page }) => {
  await start(page)
  await page.getByRole('button', { name: '固定費・臨時支出', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '家賃を削除', exact: true }).click()
  await expect.poll(async () => (await data(page)).costs.length).toBe(1)
  await page.getByRole('button', { name: '元に戻す', exact: true }).click()
  await expect.poll(async () => (await data(page)).costs).toEqual(fixture().costs)
})
test('取り消しは5秒後または新しい入力で解除され、過去の操作に戻らない', async ({ page }) => {
  await start(page)
  await inputToday(page, '1500')
  await saveDay(page)
  await page.clock.fastForward(5001)
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0)
  await inputToday(page, '200')
  await saveDay(page)
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeVisible()
  await inputToday(page, '300')
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toHaveCount(0)
})

test('キーボードで表示領域が縮んでも入力欄を隠さず、閉じると位置を戻す', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await start(page)
  await inputToday(page, '1234')
  await page.evaluate(() => {
    const viewport = window.visualViewport!
    Object.defineProperty(viewport, 'height', { configurable: true, value: 420 })
    viewport.dispatchEvent(new Event('resize'))
  })
  const editor = page.locator('.calendar-dialog')
  await expect(editor).toHaveCSS('bottom', '424px')
  const input = await page.locator('input[name=dailyAmount]').boundingBox()
  expect(input!.y).toBeGreaterThanOrEqual(0)
  expect(input!.y + input!.height).toBeLessThanOrEqual(420)
  await expect(page.locator('input[name=dailyAmount]')).toHaveValue('1234')
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 844 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect(editor).toHaveCSS('bottom', '0px')
})

for (const touch of [false, true]) {
  test(`通知の外を${touch ? 'タップ' : 'クリック'}すると取り消しが消え、移動先の操作も動く`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: touch, viewport: { width: 390, height: 844 }, baseURL: APP, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' })
    const page = await context.newPage()
    try {
      await start(page)
      await inputToday(page, '1500')
      await saveDay(page)
      await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeVisible()
      const navigation = page.getByRole('button', { name: '支出の記録', exact: true })
      if (touch) await navigation.tap()
      else await navigation.click()
      await expect(page.locator('.toast')).toHaveCount(0)
      await expect(page.locator('.expense-calendar')).toBeVisible()
      await expect.poll(async () => (await data(page)).expenses.some(e => e.amount === 1500)).toBe(true)
    } finally { await context.close() }
  })
}

test('30年分を実ブラウザで読み込み、追加・再読込・バックアップ復元で全履歴を保持する', async ({ page, browser }) => {
  test.setTimeout(60000)
  const history = largeHistory(30, 1)
  const started = Date.now()
  await start(page, JSON.stringify(history))
  expect(await data(page)).toEqual(history)
  await inputToday(page, '777')
  await saveDay(page)
  await expect.poll(async () => (await data(page)).expenses.length).toBe(history.expenses.length + 1)
  const saved = await data(page)
  expect(saved.expenses.slice(0, -1)).toEqual(history.expenses)
  expect(saved.costs).toEqual(history.costs)
  expect(saved.loggedDates).toEqual(history.loggedDates)
  expect(saved.drafts).toEqual(history.drafts)
  await page.getByRole('button', { name: '支出の記録', exact: true }).click()
  await expect(page.locator('.expense-calendar')).toBeVisible()
  await page.getByRole('button', { name: 'レポート', exact: true }).click()
  await expect(page.locator('.chart-panel').first()).toBeVisible()
  await page.reload()
  await expect(page.locator('.savings-card')).toBeVisible()
  expect(await data(page)).toEqual(saved)
  await openSettings(page)
  const backup = await download(page)
  expect(JSON.parse(backup)).toEqual(saved)
  const fresh = await browser.newContext({ baseURL: APP, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' })
  try {
    const target = await fresh.newPage()
    await start(target, null)
    await openSettings(target)
    target.once('dialog', dialog => dialog.accept())
    await importFile(target, backup)
    await expect.poll(async () => (await data(target)).expenses.length).toBe(saved.expenses.length)
    expect(await data(target)).toEqual(saved)
    await target.reload()
    await expect(target.locator('.savings-card')).toBeVisible()
    expect(await data(target)).toEqual(saved)
  } finally { await fresh.close() }
  test.info().annotations.push({ type: 'large-history', description: `${history.expenses.length} expenses, ${history.costs.length} costs, ${new Blob([backup]).size} export bytes; UI round trip ${Date.now() - started} ms (diagnostic only)` })
})


test('実際のブラウザ保存領域を満杯にしても30年分の本体を壊さず未保存分を取り出せる', async ({ page }) => {
  test.setTimeout(60000)
  const history = largeHistory(30, 1)
  await start(page, JSON.stringify(history))
  const original = await raw(page)
  const exhausted = await page.evaluate(() => {
    let value = '', chunk = 256 * 1024
    while (chunk >= 1 && value.length < 10 * 1024 * 1024) {
      try { localStorage.setItem('__quota_fill', value + 'x'.repeat(chunk)); value += 'x'.repeat(chunk) }
      catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error
        if (chunk === 1) return true
        chunk = Math.floor(chunk / 2)
      }
    }
    return false
  })
  expect(exhausted).toBe(true)
  await inputToday(page, '9999')
  await expect(page.getByRole('alert')).toContainText('保存できませんでした')
  await saveDay(page)
  expect(await raw(page)).toBe(original)
  await openSettings(page)
  const unsaved = JSON.parse(await download(page)) as typeof history
  expect(unsaved.expenses.length).toBe(history.expenses.length + 1)
  expect(unsaved.expenses.at(-1)!.amount).toBe(9999)
  expect(unsaved.expenses.slice(0, -1)).toEqual(history.expenses)
  expect(unsaved.costs).toEqual(history.costs)
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(page.locator('.savings-card')).toBeVisible()
  expect(await data(page)).toEqual(history)
})

test('5MB超の日本語メモ付きバックアップを実画面から書き出し、空のブラウザへ復元する', async ({ page, browser }) => {
  test.setTimeout(60000)
  const history = largeHistory(10, 1, 480)
  await start(page, JSON.stringify(history))
  await openSettings(page)
  const backup = await download(page)
  expect(Buffer.byteLength(backup, 'utf8')).toBeGreaterThan(5_000_000)
  expect(JSON.parse(backup)).toEqual(history)
  const fresh = await browser.newContext({ baseURL: APP, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' })
  try {
    const target = await fresh.newPage()
    await start(target, null)
    await openSettings(target)
    target.once('dialog', dialog => dialog.accept())
    await importFile(target, backup)
    await expect.poll(async () => (await data(target)).expenses.length).toBe(history.expenses.length)
    expect(await data(target)).toEqual(history)
    await target.reload()
    await expect(target.locator('.savings-card')).toBeVisible()
    expect(await data(target)).toEqual(history)
  } finally { await fresh.close() }
})
