// 公開される識別子です。APIキーや秘密情報は設定しません。
export const adClient = import.meta.env.VITE_ADSENSE_CLIENT?.trim() ?? ''
export const adSlot = import.meta.env.VITE_ADSENSE_LP_SLOT?.trim() ?? ''
const legacyDataPresent = (() => { try { return localStorage.getItem('yohaku-money-v1') !== null } catch { return true } })()
export const adsEnabled = import.meta.env.MODE !== 'app' && !legacyDataPresent && import.meta.env.PROD && import.meta.env.VITE_ADSENSE_ENABLED === 'true' && /^ca-pub-\d{16}$/.test(adClient) && /^\d{10}$/.test(adSlot)
