import { carryForwardFixedCosts, initialData, migrateLegacyCosts, validateData, type Data } from './finance'

export const MAX_BACKUP_BYTES = 16_000_000
export const STORAGE_KEY = 'yohaku-money-v1'
export const PREVIOUS_KEY = `${STORAGE_KEY}:previous`
export const UNREADABLE_KEY = `${STORAGE_KEY}:unreadable`
export const STORAGE_LOCK = 'nokosu-household-storage'
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type LockRunner = <T>(task: () => T) => Promise<T>
export const storageMessages = {
  unreadable: '保存データを読み込めませんでした。元の記録を上書きしないよう保存を停止しています。バックアップを読み込むか、設定から新しく始めてください。',
  conflict: '別の画面で記録が変更されました。この画面の保存を停止しています。入力中の内容はバックアップに書き出し、再読み込みして記録を確認してください。',
  write: 'ブラウザに保存できませんでした。元の記録は残しています。今の内容をバックアップに書き出してください。',
  invalid: '記録の形式を確認できなかったため保存を停止しました。元の記録は上書きしていません。',
  lock: '安全に保存するための機能が利用できません。最新のブラウザでHTTPSのURLを開いてください。入力中の内容はバックアップに書き出せます。',
}
export type SaveResult = { ok: true; skipped?: boolean } | { ok: false; error: string }
function parse(raw: string): Data {
  const parsed: unknown = JSON.parse(raw)
  if (!validateData(parsed)) throw new Error('Invalid data')
  return parsed
}
export function prepareData(raw: string, today: Date): Data {
  return carryForwardFixedCosts(migrateLegacyCosts(parse(raw), today), today)
}
export function parseBackup(raw: string, today: Date): Data {
  if (new Blob([raw]).size > MAX_BACKUP_BYTES) throw new Error('Backup too large')
  return prepareData(raw, today)
}

// 書き込み先はこのクラスだけに集約する。読み込み失敗や他タブの変更を検出したら停止する。
export class DataStorage {
  private expected: string | null | undefined
  private blocked = ''
  private unreadableSource = false
  private intent = 0
  readonly loaded: { data: Data; error: string }
  constructor(private readonly getStorage: () => StorageAccess, private readonly withLock: LockRunner | null, today: Date) {
    let data = structuredClone(initialData)
    try {
      const storage = getStorage()
      this.expected = storage.getItem(STORAGE_KEY)
      if (this.expected !== null) data = prepareData(this.expected, today)
      else if (storage.getItem(PREVIOUS_KEY) !== null) throw new Error('Primary data missing')
    } catch {
      this.blocked = storageMessages.unreadable
      this.unreadableSource = true
    }
    this.loaded = { data, error: this.blocked }
  }
  previousText(): string | null {
    try {
      const raw = this.getStorage().getItem(PREVIOUS_KEY)
      if (raw === null) return null
      parse(raw)
      return raw
    } catch { return null }
  }
  exportText(data: Data): string {
    // 読み込めなかった記録を、初期値のバックアップにすり替えない。
    if (this.unreadableSource) {
      if (typeof this.expected === 'string') return this.expected
      const previous = this.previousText()
      if (previous !== null) return previous
      throw new Error(storageMessages.unreadable)
    }
    const raw = JSON.stringify(data, null, 2)
    parse(raw)
    return raw
  }
  hasUnsavedChanges(data: Data): boolean {
    try {
      const baseline = this.unreadableSource || this.expected === undefined || this.expected === null ? this.loaded.data : parse(this.expected)
      return JSON.stringify(data) !== JSON.stringify(baseline)
    } catch { return true }
  }
  checkForExternalChange(): string {
    try {
      if (this.getStorage().getItem(STORAGE_KEY) !== this.expected) this.blocked = storageMessages.conflict
    } catch { this.blocked = storageMessages.unreadable }
    return this.blocked
  }
  save(data: Data): Promise<SaveResult> { return this.persist(data, false) }
  replace(data: Data): Promise<SaveResult> { return this.persist(data, true) }
  private async persist(data: Data, replace: boolean): Promise<SaveResult> {
    const request = ++this.intent
    let raw: string
    try { raw = JSON.stringify(data); parse(raw) }
    catch { this.blocked = storageMessages.invalid; return { ok: false, error: this.blocked } }
    if (this.blocked && !replace) return { ok: false, error: this.blocked }
    if (!this.withLock) { this.blocked = storageMessages.lock; return { ok: false, error: this.blocked } }
    try {
      return await this.withLock((): SaveResult => {
        if (request !== this.intent) return { ok: true, skipped: true }
        const storage = this.getStorage()
        const current = storage.getItem(STORAGE_KEY)
        if (this.expected === undefined || current !== this.expected) {
          this.blocked = storageMessages.conflict
          return { ok: false, error: this.blocked }
        }
        if (this.blocked && !replace) return { ok: false, error: this.blocked }
        if (raw !== current) {
          if (current !== null) {
            let backupKey = PREVIOUS_KEY
            try { parse(current) } catch { backupKey = UNREADABLE_KEY }
            // 元データの退避に失敗した場合も、本体は上書きしない。
            storage.setItem(backupKey, current)
          }
          storage.setItem(STORAGE_KEY, raw)
          this.expected = raw
        }
        this.blocked = ''; this.unreadableSource = false
        return { ok: true }
      })
    } catch {
      this.blocked = storageMessages.write
      return { ok: false, error: this.blocked }
    }
  }
}
