import { useRef, useState, type MouseEvent } from 'react'
import { ArrowRight, ChevronDown, RotateCcw, ShieldCheck, X } from 'lucide-react'
import BrandMark from './BrandMark'
import AdSlot from './AdSlot'
import { appUrl } from './siteUrls'
import { hasLegacyData } from './Migration'
import { adsEnabled } from './ads'
import { addDays, calculateAmount, dateKey, dayCount, forecastSavings, getPeriod, initialData, parseDate, recordDailyAmount, summarize, type Data } from './finance'

const demoToday = parseDate('2026-11-14')
function demoData(): Data {
  const settings = { income: 250000, payday: 25, holidays: true }
  const period = getPeriod(demoToday, settings)
  const dates = Array.from({ length: 23 }, (_, i) => dateKey(addDays(period.start, i)))
  return {
    ...structuredClone(initialData), settings,
    setup: { paydayConfirmed: true, fixedCostsConfirmed: true, dismissed: true },
    costs: [
      { id: 'demo-fixed', name: '固定費', kind: 'fixed', amount: 80000, period: period.key },
      { id: 'demo-extra', name: '臨時支出', kind: 'extra', amount: 10000, period: period.key },
    ],
    loggedDates: dates,
    expenses: dates.map((date, i) => ({ id: `demo-${i}`, date, amount: i === 22 ? 2000 : i === 0 ? 4400 : 3200, note: '' })),
  }
}

function ProductDemo() {
  const [data, setData] = useState(demoData)
  const [expression, setExpression] = useState('1500')
  const [message, setMessage] = useState('')
  const amount = calculateAmount(expression)
  const period = getPeriod(demoToday, data.settings)
  const summary = summarize(data, period)
  const forecast = forecastSavings(data, period, demoToday)
  const todayTotal = data.expenses.filter(expense => expense.date === dateKey(demoToday)).reduce((sum, expense) => sum + expense.amount, 0)
  const valid = amount !== null && amount <= 1000000 && todayTotal + amount <= 1000000000
  return <div className="lp-demo" aria-label="家計簿の操作サンプル">
    <div className="lp-demo-toolbar"><span>触ってみる · サンプル</span><button onClick={() => { setData(demoData()); setExpression('1500'); setMessage('サンプルを戻しました') }} aria-label="サンプルをリセット"><RotateCcw size={16} /></button></div>
    <div className="lp-demo-body">
      <section className="lp-demo-card" aria-label="サンプルの見通し">
        <p className="lp-demo-payday">次の給料日まで、あと{dayCount(demoToday, period.next)}日</p>
        <details className="lp-demo-details">
          <summary><span className="lp-demo-caption">{forecast.amount !== null && forecast.amount < 0 ? 'このペースだと赤字の見通し' : 'このペースなら残せそう'}<ChevronDown size={17} /></span><span className="lp-demo-amount">{forecast.amount?.toLocaleString('ja-JP')}<span>円</span></span><span className="lp-demo-basis">{summary.recorded}日分の記録からの目安</span></summary>
          <div className="lp-demo-breakdown"><dl>
            <div><dt>手取り</dt><dd>{data.settings.income.toLocaleString('ja-JP')}円</dd></div>
            <div><dt>固定費・臨時支出</dt><dd>−{(summary.fixed + summary.extra).toLocaleString('ja-JP')}円</dd></div>
            <div><dt>記録した生活費</dt><dd>−{summary.spent.toLocaleString('ja-JP')}円</dd></div>
            <div><dt>これからの生活費</dt><dd>−{Math.ceil((summary.average ?? 0) * forecast.days).toLocaleString('ja-JP')}円</dd></div>
          </dl><p>記録した日の平均で見積もります。未記録の支出は含まず、口座残高とは異なります。</p><p>今日の入力分まで反映し、明日からを見積もっています。記録すると平均も変わるため、見通しが増えることもあります。</p></div>
        </details>
        <div className="lp-demo-progress" aria-hidden="true"><i style={{ width: `${dayCount(period.start, demoToday) / period.totalDays * 100}%` }} /></div>
      </section>
      <form className="lp-demo-input" onSubmit={event => {
        event.preventDefault()
        if (!valid || amount === null) return
        setData(previous => recordDailyAmount(previous, dateKey(demoToday), amount, 'add'))
        setExpression('')
        setMessage(`${amount.toLocaleString('ja-JP')}円を追加しました`)
      }}>
        <label htmlFor="sample-amount">今日に追加する金額</label>
        <div><input id="sample-amount" inputMode="numeric" value={expression} onChange={event => { setExpression(event.target.value); setMessage('') }} placeholder="1500" maxLength={30} autoComplete="off" /><span>円</span><button disabled={!valid} type="submit">追加</button></div>
        <span className="lp-demo-status" role="status">{message || `今日の合計 ${todayTotal.toLocaleString('ja-JP')}円`}</span>
      </form>
      <p className="lp-demo-note">サンプルの数字です。自分の記録には入りません。</p>
    </div>
  </div>
}

export default function Landing() {
  const quickGuide = useRef<HTMLDialogElement>(null)
  const guideOpener = useRef<HTMLButtonElement>(null)
  const openGuide = (event: MouseEvent<HTMLButtonElement>) => {
    guideOpener.current = event.currentTarget
    quickGuide.current?.showModal()
  }
  return <div className="landing landing-simple">
    <header className="lp-header"><a href="/" className="lp-brand"><BrandMark /><span>のこす家計簿</span></a><nav aria-label="紹介ページのメニュー"><a href="#design">使い方</a><a href={appUrl} className="lp-nav-start">家計簿を開く <ArrowRight size={16} /></a></nav></header>
    <main className="lp-main">
      {hasLegacyData() && <aside className="lp-migration" aria-label="以前の家計データの移行"><span>このブラウザに以前の記録があります</span><a href="/app/">移行する <ArrowRight size={15} /></a></aside>}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>ざっくりつけて、<br /><span>ちゃんと残す。</span></h1>
          <p className="lp-intro">使った合計を入れるだけ。<br />次の給料日まで、いくら残せそう？</p>
          <a className="lp-cta" href={appUrl}>家計簿をはじめる <ArrowRight size={19} /></a>
          <span className="lp-start-note">無料・登録不要</span>
          <button className="lp-quick-trigger" onClick={openGuide}>ズボラな人向けの説明 <ArrowRight size={14} /></button>
        </div>
        <div className="lp-hero-product"><ProductDemo /></div>
      </section>

      <section id="design" className="lp-use">
        <div className="lp-use-heading"><h2>買う前に、ひと目。</h2><p>使うか、残すか。自分のペースで決めよう。</p></div>
        <ol className="lp-use-steps">
          <li><span>01</span><h3>最初に、いつもの家計を。</h3><p>手取り・給料日・固定費を設定。</p></li>
          <li><span>02</span><h3>使った合計を、ぽん。</h3><p>分類もメモも不要。あとから追加も。</p></li>
          <li><span>03</span><h3>残せそうな額を見る。</h3><p>買う前に開いて、ひと呼吸。</p></li>
        </ol>
        <p className="lp-mindset">収入は控えめに。曖昧な支出は、少し多めに。</p>
      </section>

      <section id="privacy" className="lp-privacy">
        <ShieldCheck size={28} strokeWidth={1.5} />
        <h2>記録は、このブラウザに。</h2>
        <p>銀行連携も、会員登録もいりません。<br />家計データを運営者に送ることもありません。</p>
        <details><summary>保存とバックアップについて <ChevronDown size={16} /></summary><div>
          <p>記録は端末・ブラウザごとに保存され、自動では同期しません。機種変更やブラウザのデータ削除の前に、設定からバックアップを書き出してください。保存データを失った場合、運営者は復元できません。</p>
          <p>共用のブラウザでは他の人が記録を見られることがあります。バックアップにも家計情報が含まれます。</p>
          <p>{adsEnabled ? '紹介ページにはGoogleの広告を掲載しています。家計簿の入力画面では広告を読み込みません。' : '現在、外部のアクセス解析サービスや広告は利用していません。'}ページ配信時には、配信元にIPアドレスなどの接続情報が残る場合があります。</p>
          <a href="/privacy/">プライバシーポリシー <ArrowRight size={14} /></a>
        </div></details>
      </section>

      <section className="lp-section lp-questions">
        <div className="lp-section-heading"><h2>気になったら。</h2></div>
        <div className="lp-faq-list">
          <details><summary>金額がざっくりでもいい？ <ChevronDown size={18} /></summary><p>はい。その日に使った合計を、曖昧なら少し多めに。固定費も概算から始めて、あとで直せます。</p></details>
          <details><summary>「残せそう」はどう計算する？ <ChevronDown size={18} /></summary><p>家計簿の「このペースで残せるお金」は、手取りから固定費・臨時支出・記録した生活費と、これからの生活費の見積もりを引いた額です。見積もりには記録した日の平均を使います。「最大」はこれからの生活費を引く前の額です。口座残高や、全部使ってよい金額ではありません。</p><p>今日は記録済みなら明日から、未記録なら今日から見積もります。入力すると平均も変わるので、見通しが増える場合もあります。</p></details>
          <details><summary>記録していない日があったら？ <ChevronDown size={18} /></summary><p>今日から再開できます。前の日は、わかる範囲で追記してください。未記録の支出は見通しに含まれません。使わなかった日は0円で記録すると、平均に含まれます。</p></details>
          <details><summary>固定費やカード払いも毎日入力する？ <ChevronDown size={18} /></summary><p>固定費・臨時支出に登録した分は、日々の記録に重ねません。カード払いは買った日に記録し、その分を引き落とし日にもう一度入れる必要はありません。</p></details>
          <details><summary>ボーナスや残業代は？ <ChevronDown size={18} /></summary><p>普段の手取りには含めず、貯金の上乗せとして考えます。この家計簿は給料日ごとの見通しを見るもので、口座の貯金総額や前期からの繰越は管理しません。</p></details>
          <details><summary>給料日や端末を変えたら？ <ChevronDown size={18} /></summary><p>給料日は設定から変更できます。期間が変わると固定費・臨時支出の再登録が必要になる場合があります。端末を変えるときは、設定からバックアップを書き出し、新しい端末で読み込んでください。</p></details>
        </div>
      </section>
      <AdSlot />
      <section className="lp-final"><BrandMark /><h2>今日の分から、はじめよう。</h2><a className="lp-cta" href={appUrl}>家計簿をはじめる <ArrowRight size={19} /></a><span className="lp-start-note">無料・登録不要</span></section>
    </main>
    <dialog className="lp-quick-dialog" ref={quickGuide} aria-labelledby="quick-guide-title" onClose={() => guideOpener.current?.focus()} onClick={event => { if (event.target === event.currentTarget) quickGuide.current?.close() }}>
      <div className="lp-quick-content"><button className="lp-quick-close" aria-label="閉じる" onClick={() => quickGuide.current?.close()}><X size={20} /></button><h2 id="quick-guide-title">やることはこれだけ</h2><ol><li><strong>初期設定</strong><a href={appUrl}>家計簿で設定する <ArrowRight size={14} /></a></li><li><strong>思い出した時に使った額を入れる</strong></li><li><strong>残せる額を見て使うか決める</strong></li></ol><a className="lp-cta" href={appUrl}>家計簿をはじめる <ArrowRight size={18} /></a></div>
    </dialog>
    <footer className="lp-footer lp-site-footer"><div className="lp-footer-top"><a href="/" className="lp-brand"><BrandMark /><span>のこす家計簿</span></a><nav aria-label="フッターメニュー"><button onClick={openGuide}>ズボラな人向けの説明</button><a href="/tips/">使い方</a><a href="/privacy/">プライバシーポリシー</a><a href="/app/">以前のデータを移す</a></nav></div><div className="lp-footer-bottom"><small>© {new Date().getFullYear()} のこす家計簿</small></div></footer>
  </div>
}
