import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const client = env.VITE_ADSENSE_CLIENT?.trim() ?? ''
  const slot = env.VITE_ADSENSE_LP_SLOT?.trim() ?? ''
  const validClient = /^ca-pub-\d{16}$/.test(client)
  if (client && !validClient) throw new Error('VITE_ADSENSE_CLIENT は ca-pub- と16桁の数字で設定してください')
  if (env.VITE_ADSENSE_ENABLED === 'true' && (!validClient || !/^\d{10}$/.test(slot))) throw new Error('広告の有効化にはパブリッシャーIDと10桁の広告ユニットIDが必要です')
  return {
  plugins: [react(), {
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
      const assets = Object.keys(bundle).filter(name => name.startsWith('assets/'))
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12)
      const urls = ['/', '/index.html', '/about/', '/privacy/', '/tips/', ...assets.map(name => '/' + name), '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon.svg']
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'nokori-shell-${version}';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(${JSON.stringify(urls)}))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nokori-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    const routes = {'/': '/', '/index.html': '/', '/about': '/about/', '/about/': '/about/', '/privacy': '/privacy/', '/privacy/': '/privacy/', '/tips': '/tips/', '/tips/': '/tips/'};
    const route = routes[url.pathname];
    if (route) event.respondWith(caches.open(CACHE).then(cache => cache.match(route)).then(hit => hit || fetch(event.request)));
  } else if (${JSON.stringify(urls)}.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));
  }
});` })
    },
  }],
  build: { rollupOptions: { input: {
    app: fileURLToPath(new URL('./index.html', import.meta.url)),
    about: fileURLToPath(new URL('./about/index.html', import.meta.url)),
    tips: fileURLToPath(new URL('./tips/index.html', import.meta.url)),
    privacy: fileURLToPath(new URL('./privacy/index.html', import.meta.url)),
  } } },
  }
})
