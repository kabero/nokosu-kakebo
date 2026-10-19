# Cloudflare Workersへの公開

GitHub: https://github.com/kabero/nokosu-kakebo

紹介ページと家計簿を別オリジンに分離しています。同じリポジトリを、2つのWorkerにGit連携します。サーバーの計算処理・データベースは使いません。

| 用途 | URL | Worker名 | デプロイコマンド | 配信先 |
| --- | --- | --- | --- | --- |
| 紹介ページ | `https://www.nokosu-kakebo.workers.dev/` | `www` | `npx wrangler deploy` | `dist` |
| 家計簿 | `https://app.nokosu-kakebo.workers.dev/` | `app` | `npx wrangler deploy --config wrangler.app.toml` | `dist-app` |

## Cloudflare管理画面の設定

既存の `www` Workerはそのまま使います。**Workers & Pages → アプリケーションを作成 → Gitリポジトリを接続** から、同じ `kabero/nokosu-kakebo` を選び、`app` Workerを追加します。

両Worker共通：

| 設定 | 値 |
| --- | --- |
| 本番ブランチ | `master` |
| ビルドコマンド | `npm run check` |
| デプロイコマンド | 上の表の各コマンド |
| ルートディレクトリ | リポジトリのルート |
| ビルド環境変数 | `NODE_VERSION=22` |

`npm run check` はテスト → 両方のビルド → 公開ファイルの検査を行います。`app` Workerは `wrangler.app.toml` で `dist-app` を配信します。`www` には `wrangler.toml` を使います。非本番ブランチは本番へdeployしない設定にしてください。

家計簿用のビルドには広告コード・広告確認meta・ads.txtを含めません。AdSenseを使う場合、環境変数は `www` のみに設定します。家計簿側にCloudflare Web Analytics等のスクリプトも追加しないでください。

独自ドメインに変更するときは、両方のビルド環境で `VITE_APP_URL` と `VITE_SITE_URL` を異なるHTTPSオリジンのルートURLに揃えます。未指定なら上記のworkers.devを使います。変更後は保存データの移行も必要です。

## 公開されるページ

- `www/`・`www/about/`：紹介ページ
- `www/app/`：以前の保存データの移行画面。自動リダイレクトしません
- `app/`：家計簿（PWAの起動先）
- `app/app/`：家計簿の別名URL
- 両方の `/privacy/`・`/tips/`：プライバシーポリシー・使い方

LPの設定フォームは家計簿へのリンクに変更しています。新しい家計データは `app` 側にだけ保存します。ホストが異なるため、LPから家計簿のlocalStorageを直接読み取ることはできません。

## CSPとキャッシュ

家計簿の全ページにはビルドでCSPを追加します。スクリプト・通信先は同一オリジンに限定し、インラインスクリプト・eval・外部iframe等を許可しません。グラフのstyle属性に必要なインラインCSSと、カード画像のblob/data URLは許可します。CSPは不正コード対策の追加防御であり、同一オリジンの配信ファイル改ざんまで防ぐものではありません。

`www/app/` の移行画面にも同じCSPを設定します。旧データが残っているブラウザではLPの広告も無効にします。これは移行中の補助策で、新しい家計簿のオリジン分離の代わりではありません。

家計簿のService Workerは同一オリジンの静的ファイルだけをキャッシュします。LP側の `sw.js` は旧キャッシュを削除して登録を解除します。localStorageは削除しません。更新待ちの場合は同じURLのタブとPWAを閉じて開き直してください。

## 既存データの移行

1. 以前使っていたURLの `/app/` を開く（ホーム画面アイコンで使っていた場合はそのアイコンから開く）。
2. 移行画面からバックアップJSONを書き出す。
3. 新しい `https://app.nokosu-kakebo.workers.dev/` を開き、「設定」でJSONを読み込む。
4. 設定・固定費・支出・下書きが揃っていることを確認する。
5. 以前の家計簿のタブを閉じ、旧URLの移行画面で「移行元の記録を削除」を押す。
6. 新しいURLをホーム画面に追加する。旧アイコンは移行を確認してから削除する。

移行は自動ではありません。旧URLに記録を残したままだと、LPと同じオリジンに旧データが残ります。端末・ブラウザ・PWAごとに確認してください。記録を保存したことがある旧ホスト（`nokosu-kakebo.nokosu-kakebo.workers.dev`等）を削除・変更する前にもバックアップしてください。

バックアップは手取り・支出などを含むファイルです。運営者に送信せず、ご自身の端末で保管・読み込みします。

## 公開後の確認

- `app` のルートに直接アクセスすると家計簿、`www` のルートでは紹介ページが開くこと。
- LPの「家計簿を開く」が `app` に移動すること。
- `app` のレスポンスにCSPがあり、広告・解析ドメインへのリクエストがないこと。
- 設定・支出の保存と再読み込み、バックアップの書き出し・読み込み、カードPNG、PDF・共有を確認すること。
- 新しいURLをホーム画面に追加すると、家計簿が直接開くこと。
- 初回読み込み・Service Workerの有効化後、オフラインで家計簿が開くこと。
- `src/siteInfo.ts` に掲載する運営者・問い合わせ先が決まったら補うこと。

開発時はLPが `npm run dev`、家計簿が `npm run dev:app`。

ローカル確認：`npm run check`、LPは `npm run preview`、家計簿は `npm run preview:app`（4174番ポート）。Vite previewは `_headers` を適用しないのでCSPの最終確認は公開先で行います。

公式資料：
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/static-assets/headers/
