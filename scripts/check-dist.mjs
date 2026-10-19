import assert from 'node:assert/strict'
import { readFile, access, readdir } from 'node:fs/promises'

for (const app of [false, true]) {
  const root = new URL(app ? '../dist-app/' : '../dist/', import.meta.url)
  const read = path => readFile(new URL(path, root), 'utf8')
  const pages = ['index.html', 'app/index.html', 'privacy/index.html', 'tips/index.html', ...(!app ? ['about/index.html'] : [])]
  for (const page of pages) {
    const html = await read(page)
    assert.match(html, /<html lang="ja">/, `${page}: Japanese HTML missing`)
    assert.match(html, /manifest\.webmanifest/, `${page}: manifest missing`)
    const scripts = [...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)]
    assert.ok(scripts.length, `${page}: built script missing`)
    for (const [, path] of scripts) await access(new URL(path.slice(1), root))
    if (app) assert.ok(!html.includes('google-adsense-account'))
  }
  const manifest = JSON.parse(await read('manifest.webmanifest'))
  assert.equal(manifest.start_url, app ? '/' : '/app/')
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) await access(new URL(icon.src.slice(1), root))
  const headers = await read('_headers')
  assert.match(headers, /\/sw\.js\s+Cache-Control: no-cache/)
  assert.match(headers, /script-src 'self';/)
  assert.ok(!headers.includes("script-src 'self' 'unsafe-inline'"))
  const worker = await read('sw.js')
  if (app) {
    for (const route of ['/', '/app/', '/privacy/', '/tips/']) assert.ok(worker.includes(JSON.stringify(route)) || worker.includes(`'${route}'`), `Service worker missing ${route}`)
    assert.match(headers, /\n\/\*\n  Content-Security-Policy:/)
    for (const filename of (await readdir(new URL('assets/', root))).filter(name => name.endsWith('.js'))) {
      const script = await read('assets/' + filename)
      for (const forbidden of ['pagead2.googlesyndication.com', 'adsbygoogle', 'google-analytics.com', 'googletagmanager.com']) assert.ok(!script.includes(forbidden), `External script code in app: ${forbidden}`)
    }
    await assert.rejects(access(new URL('ads.txt', root)))
  } else {
    assert.match(worker, /registration\.unregister/)
    assert.ok(!worker.includes("addEventListener('fetch'"))
  }
  console.log(`${app ? 'App' : 'Site'} output verified: HTML, manifest, service worker, CSP${app ? ', no advertising code' : ''}`)
}
