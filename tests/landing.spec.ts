import { test, expect } from '@playwright/test'

const SITE = 'http://127.0.0.1:4180'
const KEY = 'yohaku-money-v1'

test('LPのサンプルは追加・リセットができ、家計データには保存しない', async ({ page }) => {
  await page.goto(SITE)
  await expect(page.locator('.lp-demo-amount')).toHaveText('54,400円')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.locator('.lp-demo-amount')).toHaveText('52,247円')
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull()
  await page.getByRole('button', { name: 'サンプルをリセット' }).click()
  await expect(page.locator('.lp-demo-amount')).toHaveText('54,400円')
})

test('ズボラな人向けの説明をヒーローとフッターから開ける', async ({ page }) => {
  await page.goto(SITE)
  const entries = page.getByRole('button', { name: 'ズボラな人向けの説明', exact: true })
  await expect(entries).toHaveCount(2)
  const dialog = page.getByRole('dialog', { name: 'やることはこれだけ' })
  for (const entry of [entries.first(), entries.last()]) {
    await entry.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('li')).toHaveCount(3)
    await expect(dialog.getByRole('link', { name: '家計簿で設定する' })).toHaveAttribute('href', /^(https?:\/\/[^/]+)?\/$/)
    await dialog.getByRole('button', { name: '閉じる', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(entry).toBeFocused()
  }
  await entries.first().click()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

for (const width of [320, 390, 1440]) {
  test(`LPと短い説明が幅${width}pxの画面内に収まる`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    await page.goto(SITE)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`landing-${width}.png`), fullPage: true })
    await page.locator('.lp-demo-details > summary').click()
    await expect(page.locator('.lp-demo-breakdown')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('.lp-demo-details > summary').click()
    await page.getByRole('button', { name: 'ズボラな人向けの説明', exact: true }).first().click()
    const dialog = page.getByRole('dialog', { name: 'やることはこれだけ' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    await page.screenshot({ path: info.outputPath(`quick-guide-${width}.png`) })
  })
}
