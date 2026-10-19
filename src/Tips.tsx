import { ArrowLeft, ArrowRight } from 'lucide-react'
import BrandMark from './BrandMark'
import './privacy.css'
import './tips.css'

export default function Tips() {
  return <div className="privacy-page tips-page">
    <header className="privacy-header"><a href="/about/" className="privacy-brand"><BrandMark /><span>のこす家計簿</span></a><a href="/">家計簿を開く <ArrowRight size={16} /></a></header>
    <main className="privacy-main tips-main">
      <a className="privacy-back" href="/"><ArrowLeft size={15} />家計簿に戻る</a>
      <h1>効果的な使い方</h1>
      <section className="tips-principal"><h2>残せる額を見て<br />使うか決める</h2><p>買う前に「このペースで残せるお金」を確認。その額以上を残すことを目指します。「最大」はこれから生活費を使わなければ残る額です。</p></section>
      <div className="tips-guides"><section><h2>収入は控えめに</h2><p>ボーナスや残業代は含めず、普段の給料で生活を考える。追加の収入は貯金の上乗せに。</p></section>
      <section><h2>曖昧な支出は少し多めに</h2><p>思い出した時に合計だけ入力。金額が曖昧なら少し多めに入れて、使えるお金を見積もりすぎない。</p></section>
      <section><h2>使わなかった日は0円で記録</h2><p>平均に含まれるのは記録した日だけ。使わなかった日も記録すると、実際のペースに近づきます。</p></section>
      <section><h2>払う予定のお金は先に登録</h2><p>家賃などは固定費、旅行などは臨時支出へ。登録した分や記録済みのカード払いは、日々の支出に重ねて入力しません。</p></section>
      </div>
      <p className="tips-limit">表示額は記録に応じて変わる目安です。未記録の支出は含まれません。</p>
      <a className="privacy-return" href="/">家計簿を開く <ArrowRight size={17} /></a>
    </main>
    <footer className="privacy-footer"><a href="/about/">のこす家計簿について</a><a href="/privacy/">プライバシーポリシー</a></footer>
  </div>
}
