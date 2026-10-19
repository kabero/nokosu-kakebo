import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const root = new URL('../dist/', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const pages = ['index.html', 'app/index.html', 'about/index.html', 'privacy/index.html', 'tips/index.html']
for (const page of pages) {
  const html = await read(page)
  assert.match(html, /<html lang="ja">/, `${page}: Japanese HTML missing`)
  assert.match(html, /manifest\.webmanifest/, `${page}: manifest missing`)
  const scripts = [...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)]
  assert.ok(scripts.length, `${page}: built script missing`)
  for (const [, path] of scripts) await access(new URL(path.slice(1), root))
}
const manifest = JSON.parse(await read('manifest.webmanifest'))
assert.equal(manifest.start_url, '/app/')
assert.equal(manifest.display, 'standalone')
for (const icon of manifest.icons) await access(new URL(icon.src.slice(1), root))
const worker = await read('sw.js')
for (const route of ['/', '/app/', '/about/', '/privacy/', '/tips/']) assert.ok(worker.includes(JSON.stringify(route)) || worker.includes(`'${route}'`), `Service worker missing ${route}`)
assert.match(await read('_headers'), /\/sw\.js\s+Cache-Control: no-cache/)
console.log('Static output verified: 5 pages, PWA assets, offline routes, cache headers')
