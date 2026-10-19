// 開発時もポートを分け、本番と同じようにオリジンを分離する。
export const isAppBuild = import.meta.env.MODE === 'app'
const devUrl = (port: number) => `${window.location.protocol}//${window.location.hostname}:${port}/`
export const appUrl = isAppBuild ? '/' : import.meta.env.DEV ? devUrl(5174) : (import.meta.env.VITE_APP_URL || 'https://app.nokosu-kakebo.workers.dev/')
export const siteUrl = isAppBuild ? import.meta.env.DEV ? devUrl(5173) : (import.meta.env.VITE_SITE_URL || 'https://www.nokosu-kakebo.workers.dev/') : '/'
