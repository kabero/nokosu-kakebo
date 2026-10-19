import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const appCsp = "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'"
export default defineConfig(({ mode }) => {
  const app = mode === 'app'
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const client = app ? '' : env.VITE_ADSENSE_CLIENT?.trim() ?? ''
  const slot = env.VITE_ADSENSE_LP_SLOT?.trim() ?? ''
  const validClient = /^ca-pub-\d{16}$/.test(client)
  if (client && !validClient) throw new Error('VITE_ADSENSE_CLIENT は ca-pub- と16桁の数字で設定してください')
  if (!app && env.VITE_ADSENSE_ENABLED === 'true' && (!validClient || !/^\d{10}$/.test(slot))) throw new Error('広告の有効化にはパブリッシャーIDと10桁の広告ユニットIDが必要です')
  const appUrl = new URL(env.VITE_APP_URL || 'https://app.nokosu-kakebo.workers.dev/')
  const siteUrl = new URL(env.VITE_SITE_URL || 'https://www.nokosu-kakebo.workers.dev/')
  if (appUrl.protocol !== 'https:' || siteUrl.protocol !== 'https:' || appUrl.origin === siteUrl.origin || appUrl.pathname !== '/' || siteUrl.pathname !== '/' || appUrl.search || siteUrl.search || appUrl.hash || siteUrl.hash || appUrl.username || siteUrl.username || appUrl.password || siteUrl.password) throw new Error('家計簿と紹介ページには異なるHTTPSオリジンのルートURLを指定してください')
  return {
    define: app ? { 'import.meta.env.VITE_ADSENSE_ENABLED': JSON.stringify('false'), 'import.meta.env.VITE_ADSENSE_CLIENT': JSON.stringify(''), 'import.meta.env.VITE_ADSENSE_LP_SLOT': JSON.stringify('') } : {},
    plugins: [react(), {
      name: 'separate-origins',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return app ? html.replace('/src/main.tsx', '/src/app-main.tsx').replace('<title>のこす家計簿｜ざっくりつけて、ちゃんと残す。</title>', '<title>家計簿｜のこす家計簿</title>').replace('width=device-width, initial-scale=1.0"', 'width=device-width, initial-scale=1.0, viewport-fit=cover"') : html
        },
      },
      generateBundle() {
        const commonHeaders = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8')
        const privateHeaders = `\n/*\n  Content-Security-Policy: ${appCsp}\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n`
        // 移行元の記録を扱う旧URLにも広告や外部コードを許可しない。
        const migrationHeaders = `\n/app\n  Content-Security-Policy: ${appCsp}\n\n/app/*\n  Content-Security-Policy: ${appCsp}\n`
        this.emitFile({ type: 'asset', fileName: '_headers', source: commonHeaders + (app ? privateHeaders : migrationHeaders) })
        const manifest = JSON.parse(readFileSync(new URL('./public/manifest.webmanifest', import.meta.url), 'utf8'))
        if (app) manifest.start_url = '/'
        this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest, null, 2) })
      },
    }, {
      name: 'adsense-site-verification',
      transformIndexHtml: {
        order: 'post',
        handler(_, context) {
          if (!validClient || !['/index.html', '/about/index.html'].includes(context.path)) return []
          return [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: client }, injectTo: 'head' as const }]
        },
      },
      generateBundle() {
        if (validClient) this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n` })
      },
    }, {
      name: 'offline-app-shell',
      generateBundle(_, bundle) {
        if (!app) {
          this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nokori-shell-')).map(key => caches.delete(key)))).then(() => self.registration.unregister())));
` })
          return
        }
        const assets = Object.keys(bundle).filter(name => name.startsWith('assets/'))
        const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12)
        const urls = ['/', '/index.html', '/app/', '/privacy/', '/tips/', ...assets.map(name => '/' + name), '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.svg']
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'nokori-shell-${version}';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(${JSON.stringify(urls)}))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nokori-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    const routes = {'/': '/', '/index.html': '/', '/app': '/app/', '/app/': '/app/', '/app/index.html': '/app/', '/privacy': '/privacy/', '/privacy/': '/privacy/', '/tips': '/tips/', '/tips/': '/tips/'};
    const route = routes[url.pathname];
    if (route) event.respondWith(caches.open(CACHE).then(cache => cache.match(route)).then(hit => hit || fetch(event.request)));
  } else if (${JSON.stringify(urls)}.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));
  }
});` })
      },
    }],
    build: { outDir: app ? 'dist-app' : 'dist', rollupOptions: { input: {
      landing: fileURLToPath(new URL('./index.html', import.meta.url)),
      app: fileURLToPath(new URL('./app/index.html', import.meta.url)),
      ...(!app ? { about: fileURLToPath(new URL('./about/index.html', import.meta.url)) } : {}),
      tips: fileURLToPath(new URL('./tips/index.html', import.meta.url)),
      privacy: fileURLToPath(new URL('./privacy/index.html', import.meta.url)),
    } } },
  }
})
