import { useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, RotateCcw, ShieldCheck, X } from 'lucide-react'
import BrandMark from './BrandMark'
import AdSlot from './AdSlot'
import QuickSetup from './QuickSetup'
import { adsEnabled } from './ads'
import { calculateAmount } from './finance'
import './landing.css'

const yen = (amount: number) => `¥${amount.toLocaleString('ja-JP')}`

function ProductDemo() {
  const [expression, setExpression] = useState('1500')
  const [spent, setSpent] = useState(73600)
  const [saved, setSaved] = useState(false)
  const amount = calculateAmount(expression)
  return <div className="lp-demo" aria-label="家計簿の操作サンプル">
    <div className="lp-demo-toolbar"><span><i /><i /><i /></span><span>操作サンプル</span><button onClick={() => { setSpent(73600); setExpression('1500'); setSaved(false) }} aria-label="サンプルをリセット"><RotateCcw size={14} /></button></div>
    <div className="lp-demo-body"><div className="lp-demo-period">10月期 <span>10/23–11/24</span></div>
      <div className="lp-demo-money"><span>残せるお金 <small>最大</small></span><strong aria-live="polite">{yen(250000 - 80000 - 10000 - spent)}</strong><div><span>このペースで残せるお金</span><b>{yen(Math.floor(250000 - 80000 - 10000 - spent - spent / 23 * 10))}</b></div><div><span>使った金額</span><b>{yen(spent)}</b></div></div>
      <form className="lp-demo-input" onSubmit={event => { event.preventDefault(); if (amount === null || amount > 1000000) return; setSpent(value => value + amount); setExpression(''); setSaved(true) }}>
        <label htmlFor="sample-amount">使った金額</label><div><input id="sample-amount" aria-label="サンプルの金額" value={expression} onChange={event => { setExpression(event.target.value); setSaved(false) }} placeholder="1500" maxLength={30} autoComplete="off" /><span>円</span><button disabled={amount === null || amount > 1000000} type="submit">{saved ? <Check size={17} /> : '記録'}</button></div>
        <span className="lp-demo-status" role="status">{saved ? '記録しました' : amount !== null ? `合計 ${yen(amount)}` : '\u00a0'}</span>
      </form>
    </div>
  </div>
}

export default function Landing() {
  const quickGuide = useRef<HTMLDialogElement>(null)
  const [guideSession, setGuideSession] = useState(0)
  const openGuide = () => { setGuideSession(value => value + 1); quickGuide.current?.showModal() }
  return <div className="landing">
    <header className="lp-header"><a href="/about/" className="lp-brand"><BrandMark /><span>のこす家計簿</span></a><nav aria-label="紹介ページのメニュー"><a href="#design">使いやすさ</a><a href="#privacy">プライバシー</a><a href="/" className="lp-nav-start">家計簿を開く <ArrowRight size={16} /></a></nav></header>
    <main className="lp-main">
      <section className="lp-hero"><div className="lp-hero-copy"><h1>ざっくりつけて、<br /><span>ちゃんと残す。</span></h1><p className="lp-intro">使った額を入れる。<br />残せる額を見て、使うか決める。</p><a className="lp-cta" href="/">家計簿をはじめる <ArrowRight size={19} /></a><button className="lp-quick-trigger" onClick={openGuide}>ズボラな人向けの説明 <ArrowRight size={14} /></button><span className="lp-start-note">無料・アカウント登録不要</span><a className="lp-privacy-promise" href="#privacy"><ShieldCheck size={16} />家計データは、ブラウザにのみ保存。<ArrowRight size={14} /></a></div><div className="lp-hero-product"><ProductDemo /></div></section>
      <div className="lp-principles"><span>銀行へのログイン・会員登録なし</span><span>金額だけを入力</span><span>家計データを運営者に送信しない</span></div>

      <section className="lp-use"><div className="lp-use-heading"><h2>これを買ったら、<br className="mobile-break" />いくら残せる？</h2><p>使い道を細かく振り返るより、次に使うお金を決めるために。</p></div><ol className="lp-use-steps"><li><h3>使った額を入れる</h3><p>その日の合計だけ。<br />分類もメモもいりません。</p></li><li><h3>残せる額を見る</h3><p>次の給料日までの見通しを、<br />ひと目で確認。</p></li><li><h3>使うか、残すか決める</h3><p>買い物の前にひと呼吸。<br />残したいお金を見てから判断。</p></li></ol><a href="/" className="lp-text-link">使った金額を記録してみる <ArrowRight size={16} /></a></section>

      <section id="design" className="lp-section lp-design"><div className="lp-section-heading"><h2>やることが少ない。<br />だから、続けやすい。</h2></div><div className="lp-reasons">
        <article><div><h3>分類しないから、合計だけでいい。</h3><p>使い道を分けずに、その日の合計を記録。</p></div></article>
        <article><div><h3>一度で終えなくていいから、戻ってこられる。</h3><p>途中で閉じても、続きから再開できます。</p></div></article>
        <article><div><h3>設定を繰り返さないから、直すのは変更分だけ。</h3><p>家賃やサブスクなどの固定費は、次の月期に引き継ぎます。光熱費は概算で始めて、わかったら修正。</p></div></article>
        <article><div><h3>月末で区切らないから、給料日までが見える。</h3><p>自分の給料日から次の給料日の前日まで。「次にお金が入るまで」で生活を考えられます。</p></div></article>
      </div></section>

      <section className="lp-essentials"><div className="lp-section-heading"><h2>収入は控えめに。<br />支出は、少し多めに。</h2><p>ボーナス・残業代は、使うお金に含めない。<br />金額が曖昧な支出は、少し多めに丸める。<br />細かく合わせる手間を減らしながら、<br />使えるお金を多く見積もりにくくします。</p><p>見るのは「残せるお金」。<br />今の支出ペースで残る額を目安に、<br />それ以上を残すことを目指します。</p></div><div className="lp-equation" aria-label="最大値と予測値の計算例"><div><span>毎月の手取り</span><strong>¥250,000</strong></div><div><span><i>−</i>固定費・臨時支出</span><strong>¥90,000</strong></div><div><span><i>−</i>使った金額</span><strong>¥73,600</strong></div><div className="lp-equation-result"><span>残せるお金 <small>最大</small></span><strong>¥86,400</strong></div><div><span><i>−</i>1日平均 ¥3,200 × 残り10日</span><strong>¥32,000</strong></div><div className="lp-equation-result"><span>このペースで残せるお金</span><strong>¥54,400</strong></div><p>「最大」は、これから生活費を使わなければ残る額。「このペース」は、記録した日の平均で見積もる額です。未記録の支出は含まれません。</p></div></section>

      <section id="privacy" className="lp-privacy"><div className="lp-privacy-icon"><ShieldCheck size={36} strokeWidth={1.4} /></div><h2>家計データは、<br />お使いのブラウザにのみ保存。</h2><p>入力した家計データを、運営者に送信しません。<br />書き出したバックアップは、ご自身で保管できます。</p>
        <div className="lp-privacy-facts">
          <article><h3>同期しないから、運営者に記録を渡さない。</h3><p>手取りも支出も下書きも、使っているブラウザの中に。端末間の自動同期はせず、別の端末へはバックアップで移せます。</p></article>
          <article><h3>銀行とつながないから、ログイン情報も不要。</h3><p>銀行のID・パスワードを入力せずに使えます。口座を登録せず、自分が使った金額だけで管理できます。</p></article>
          <article><h3>会員登録なし。すぐに始められる。</h3><p>{adsEnabled ? '紹介ページにはGoogleの広告を掲載しています。家計の入力画面では広告を読み込みません。広告に伴う情報の取り扱いはプライバシーポリシーで確認できます。' : 'メールアドレスの登録やパスワード作成は不要です。現在、外部のアクセス解析サービスや広告も利用していません。'}</p></article>
        </div>
        <details><summary>保存した記録について <ChevronDown size={16} /></summary><div><p>記録は、今お使いのブラウザに保存します。同じ端末でも、ブラウザが違えば別の記録です。バックアップで移した後の変更も自動では揃いません。ブラウザの保存内容を消すと記録も消え、運営者は復元できません。機種変更やデータ削除の前に、設定からバックアップを書き出してください。</p><p>スマートフォンやパソコンを共用している場合、同じブラウザを使う人が記録を見られることがあります。バックアップにも家計情報が含まれますので、大切に保管してください。</p><p>ページを開く際には通信が発生し、配信元にIPアドレスなどの接続情報が残る場合があります。手取りや支出など、入力した家計情報がその際に送られることはありません。</p></div></details></section>

      <section className="lp-section lp-questions"><div className="lp-section-heading"><h2>気になること。</h2></div><div className="lp-faq-list">
        <details><summary>金額が曖昧でも使えますか？ <ChevronDown size={18} /></summary><p>細かな明細の入力は不要です。その日に使った合計を、曖昧なら少し多めに。光熱費なども概算で始めて、わかったら直せます。固定費・臨時支出に入れた分は重ねて記録しません。</p></details><details><summary>予測はどう計算しますか？ <ChevronDown size={18} /></summary><p>最大値から、記録した日の1日平均支出にこれからの日数を掛けた額を引きます。0円の記録も含めますが、未記録の日と下書きは含めません。今日を記録済みなら明日から見積もります。記録がない間は予測を表示しません。未記録の過去の支出は反映されないため、入力が少ない時期は目安として確認してください。</p></details><details><summary>ボーナスや残業代は？ <ChevronDown size={18} /></summary><p>貯金する前提で、手取りには含めません。予測は毎月の基本の手取りで計算し、追加の収入は貯金の上乗せとして扱います。口座の貯金総額や前期からの繰越を管理するものではありません。</p></details><details><summary>給料日が25日でなくても使えますか？ <ChevronDown size={18} /></summary><p>1〜31日から設定できます。土日は前の平日に前倒しし、日本の祝日も避ける設定に対応しています。</p></details>
        <details><summary>1日に何回か入力しても大丈夫？ <ChevronDown size={18} /></summary><p>はい。あとで使った分も、同じ日に追加できます。</p></details>
        <details><summary>機種変更したら記録はどうなりますか？ <ChevronDown size={18} /></summary><p>設定からバックアップを書き出し、新しい端末で読み込めます。ブラウザを変更する場合も同じ手順で移せます。</p></details>
      </div></section>

      <AdSlot />
      <section className="lp-final"><BrandMark /><h2>のこす家計簿</h2><p>使った額を入れる。残せる額を見て決める。</p><a className="lp-cta" href="/">家計簿をはじめる <ArrowRight size={19} /></a><span className="lp-start-note">無料・アカウント登録不要</span></section>
    </main>
    <dialog className="lp-quick-dialog" ref={quickGuide} aria-labelledby="quick-guide-title" onClick={event => { if (event.target === event.currentTarget) quickGuide.current?.close() }}>
      <div className="lp-quick-content"><button className="lp-quick-close" aria-label="閉じる" onClick={() => quickGuide.current?.close()}><X size={20} /></button><h2 id="quick-guide-title">やることはこれだけ</h2><ol><li className="quick-setup-step"><strong className="quick-setup-title">初期設定</strong>{guideSession > 0 && <QuickSetup key={guideSession} />}</li><li><strong>思い出した時に使った額を入れる</strong></li><li><strong>残せる額を見て使うか決める</strong></li></ol><a className="lp-cta" href="/">家計簿をはじめる <ArrowRight size={18} /></a></div>
    </dialog>
    <footer className="lp-footer lp-site-footer"><div className="lp-footer-top"><div><a href="/about/" className="lp-brand"><BrandMark /><span>のこす家計簿</span></a><p>ざっくりつけて、ちゃんと残す。</p></div><nav aria-label="フッターメニュー"><a href="#design">使いやすさ</a><a href="#privacy">家計情報の取り扱い</a><button onClick={openGuide}>ズボラな人向けの説明</button><a href="/tips/">効果的な使い方</a><a href="/privacy/">プライバシーポリシー</a><a href="/">家計簿を開く <ArrowRight size={14} /></a></nav></div><div className="lp-footer-bottom"><span>無料・アカウント登録不要</span><small>© {new Date().getFullYear()} のこす家計簿</small></div></footer>
  </div>
}
