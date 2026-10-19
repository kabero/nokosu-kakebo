// 本番では家計簿と紹介ページを別オリジンに置く。
export const isAppBuild = import.meta.env.MODE === 'app'
export const appUrl = isAppBuild ? '/' : import.meta.env.DEV ? '/app/' : (import.meta.env.VITE_APP_URL || 'https://app.nokosu-kakebo.workers.dev/')
export const siteUrl = isAppBuild ? (import.meta.env.VITE_SITE_URL || 'https://www.nokosu-kakebo.workers.dev/') : '/'
