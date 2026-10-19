import { ArrowLeft, ArrowRight } from 'lucide-react'
import BrandMark from './BrandMark'
import { siteInfo } from './siteInfo'
import './privacy.css'
import { adsEnabled } from './ads'

export default function Privacy() {
  return <div className="privacy-page">
    <header className="privacy-header"><a href="/about/" className="privacy-brand"><BrandMark /><span>のこす家計簿</span></a><a href="/">家計簿を開く <ArrowRight size={16} /></a></header>
    <main className="privacy-main">
      <a className="privacy-back" href="/about/"><ArrowLeft size={15} />のこす家計簿について</a>
      <h1>プライバシーポリシー</h1>
      <p className="privacy-date">制定：2026年10月19日／最終更新：2026年10月20日</p>
      <p className="privacy-lead">のこす家計簿（以下「本サービス」）は、入力した家計データを、お使いのブラウザにのみ保存する家計簿です。このページでは、保存する情報とその取り扱いについて説明します。</p>
      <div className="privacy-summary"><strong>入力した家計データは、お使いのブラウザにのみ保存します。</strong><p>運営者が手取り・支出・メモなどを受け取ったり、運営サーバーに保管したりすることはありません。ご自身で書き出したバックアップはファイルとして保存されます。</p></div>

      <section><h2>1. ブラウザに保存する情報</h2><p>家計の表示・計算・記録を行うため、次の情報を利用中のブラウザに保存します。</p><ul><li>手取り額、給料日、休日の取り扱いなどの設定</li><li>支出の金額・日付・メモ、固定費・臨時支出</li><li>支出がなかった日の記録、入力途中の下書き</li><li>初期設定の進み具合、ホーム画面への追加案内を表示・閉じた状態など、操作に関する情報</li></ul><p>これらは本サービスの画面表示や計算のために、ブラウザ内で使用します。家計情報を外部へ自動送信する機能はありません。</p></section>
      <section><h2>2. 登録や銀行へのログインについて</h2><p>本サービスは会員登録なしで利用できます。銀行口座との連携も行っておらず、銀行のID・パスワード、クレジットカード番号の入力を求めることはありません。</p></section>
      <section><h2>3. ページを開く際の通信</h2><p>ページや画像などを表示するために、配信元との通信が発生します。その際、配信元にはIPアドレス、閲覧日時、利用するブラウザなどの接続情報が伝わり、配信元が保守や不正利用の防止のために記録する場合があります。</p><p>手取り、支出、メモ、下書きなどの家計情報を、この通信に含めることはありません。文字の表示には端末のフォントを使い、外部のフォント配信サービスへの通信も行いません。</p></section>
      <section><h2>4. アクセス解析・広告・Cookie</h2><p>Google Analyticsなどのアクセス解析サービスは利用していません。</p>{adsEnabled ? <><p>紹介ページでは、Google LLCが提供するGoogle AdSenseを利用して広告を掲載します。家計の入力画面では広告コードを読み込みません。</p><p>Googleおよび第三者の広告配信事業者は、Cookie・ウェブビーコンなどを利用し、IPアドレス、ブラウザや端末の情報、識別子、閲覧したページ、広告の表示・操作に関する情報などを取得・利用する場合があります。広告の配信、パーソナライズ、効果測定、不正利用の防止などに使用されます。当サイトから手取り・支出・メモ・下書きを広告パラメータとして渡す処理は行いません。</p><table className="privacy-ad-table"><thead><tr><th>送信先</th><th>情報・目的</th></tr></thead><tbody><tr><td>Google LLC等の広告配信事業者</td><td>上記の接続・端末・閲覧・広告に関する情報。広告配信、効果測定、不正利用防止など。</td></tr></tbody></table><p>詳細は<a href="https://policies.google.com/technologies/partner-sites?hl=ja">Googleのパートナーサイトでの情報の利用</a>および<a href="https://business.safety.google/adscookies/">広告で使用される技術</a>をご確認ください。第三者配信事業者や広告ネットワークがCookieを設定・参照する場合があります。</p><p><a href="https://myadcenter.google.com/">マイ アド センター</a>でGoogleのパーソナライズ広告を管理できます。第三者事業者による広告の設定は<a href="https://www.aboutads.info/choices/">業界のオプトアウトページ</a>でも確認できます。ブラウザの設定からCookieを削除・制限することもできます。設定を変更しても広告そのものが非表示になるとは限りません。</p></> : <p>現在、広告配信サービスは利用していません。広告や利用状況の追跡を目的とするCookieも発行していません。広告を導入する際は、利用するサービス、送信する情報、利用目的や設定方法を本ページに掲載します。</p>}</section>
      <section><h2>5. 家計情報の第三者への提供</h2><p>運営者は入力された家計情報を受け取らないため、その情報を第三者へ提供・販売することはありません。利用者ご自身がバックアップファイルを他の人へ渡す場合は、そのファイルに含まれる情報も共有されます。レポートのシェアでは、確認画面の集計内容を、選んだ共有先へ渡します。コピーした内容や保存したPDFも、ご自身で送信・共有できます。</p></section>
      <section><h2>6. バックアップと端末の変更</h2><p>設定画面から、記録のバックアップを書き出したり、読み込んだりできます。書き出したファイルには家計情報が含まれます。共有する相手や保存場所にご注意ください。</p><p>端末やブラウザが変わっても、記録は自動で移りません。新しい端末・ブラウザでバックアップを読み込むことで移せます。バックアップの書き出し・読み込みは、利用中の端末内で行います。</p></section>
      <section><h2>7. 記録の削除・保存期間</h2><p>支出の明細や下書きは、アプリから個別に削除できます。すべての記録と設定を消す場合は、設定画面の「すべてのデータを初期化」を使用してください。ブラウザの機能から、本サービスの保存内容を削除することもできます。</p><p>本サービスでは保存内容の有効期限を設定していません。ただし、ブラウザの設定や自動削除、プライベートブラウズの終了などによって記録が失われる場合があります。アプリ内の記録を削除しても、書き出したバックアップファイルは削除されません。</p><p>運営者はブラウザ内の記録にアクセスできないため、記録の復元や削除の代行はできません。</p></section>
      <section><h2>8. 利用する端末について</h2><p>本サービスには、記録専用のパスワードロックはありません。同じ端末・ブラウザを使う人が記録を見られる場合があります。端末のロックを利用し、共用する端末では保存内容やバックアップの取り扱いにご注意ください。</p></section>
      <section><h2>9. このポリシーの変更</h2><p>機能や情報の取り扱いを変更する場合は、その内容に合わせて本ページを更新し、更新日を記載します。重要な変更がある場合は、本サービス上でお知らせします。</p></section>
      {(siteInfo.operatorName || siteInfo.contactEmail || siteInfo.contactUrl) && <section><h2>10. 運営者・お問い合わせ</h2>{siteInfo.operatorName && <p>運営者：{siteInfo.operatorName}</p>}{siteInfo.contactEmail && <p><a href={`mailto:${siteInfo.contactEmail}`}>{siteInfo.contactEmail}</a></p>}{siteInfo.contactUrl && <p><a href={siteInfo.contactUrl}>お問い合わせ</a></p>}</section>}
      <a className="privacy-return" href="/">家計簿を開く <ArrowRight size={17} /></a>
    </main>
    <footer className="privacy-footer"><a href="/about/">のこす家計簿</a><span>プライバシーポリシー</span></footer>
  </div>
}
