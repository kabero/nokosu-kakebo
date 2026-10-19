# Cloudflare Workersへの公開

GitHub: https://github.com/kabero/nokosu-kakebo

このリポジトリはReact/Viteの静的サイトです。Cloudflare WorkersとGitHubを直接連携して公開します。Workersのサーバー処理、データベース、GitHub Actions用のデプロイトークンは不要です。

## Cloudflareの設定

Cloudflareで **Workers & Pages → アプリケーションを作成 → Gitリポジトリを接続** を選び、`kabero/nokosu-kakebo` を接続します。静的ファイルの配信にはWorkers Static Assetsを使用します。

| 設定 | 値 |
| --- | --- |
| プロジェクト名 | `nokosu-kakebo` |
| 本番ブランチ | `master`（現在のローカルブランチ） |
| デプロイコマンド | `npx wrangler deploy` |
| ビルドコマンド | `npm run check` |
| 静的ファイルの出力先 | `dist`（`wrangler.toml`で指定） |
| ルートディレクトリ | リポジトリのルート |
| Node.js | 環境変数 `NODE_VERSION=22` |

`wrangler.toml` にWorkersの名前・出力先を保存しています。別のプロジェクト名を使う場合は同ファイルの `name` も合わせて変更します。

通常の依存関係インストールはCloudflareが行います。`npm run check` は計算テスト → ビルド → 公開ファイル検査の順で実行し、失敗するとデプロイを止めます。ビルド環境変数に `NODE_VERSION=22` を指定します。それ以外の環境変数は現時点では不要です。AdSenseはIDを設定して有効化するまで通信しません（[手順](ADSENSE.md)）。

初回のデプロイ後は本番ブランチへのpushで更新されます。ブランチ名を `main` に変更する場合は、Cloudflareの本番ブランチも `main` に合わせます。

## 公開するファイル

- `/`：家計簿
- `/about/`：紹介ページ
- `/tips/`：効果的な使い方
- `/privacy/`：プライバシーポリシー
- `/manifest.webmanifest`・`/sw.js`・PNGアイコン：PWA
- `public/_headers`：Cloudflare用のヘッダー。ビルド時に `dist/_headers` へコピー

公開するのは `dist` だけです。リポジトリ全体やバックアップJSONをアップロードしません。秘密情報を `VITE_` 環境変数に入れると、ブラウザ向けJavaScriptに含まれるため使用しないでください。

## 公開後の確認

- 上記4ページの直接アクセス・再読み込みができること。
- 設定と支出を保存し、再読み込みしても残ること。
- 「ホーム画面に追加」の案内と、アイコンからの起動を確認すること。
- 初回読み込み後にオフラインで家計簿が開くこと。
- PDF・印刷、シェアが利用できること（OSやブラウザによって対応が異なります）。
- 広告未設定時はGoogleの広告スクリプトに通信しないこと。
- `src/siteInfo.ts` に掲載する運営者・問い合わせ先が決まったら設定し、実際の運営に合わせてプライバシーポリシーを確認すること。

ローカルの最終確認：

```sh
npm ci
npm run check
npm run preview
```

## データ移行とPWAの更新

データはURLのオリジン（スキーム・ホスト・ポート）ごとに保存されます。localhost・workers.dev・独自ドメインでは共有されません。移行元の設定でバックアップを書き出し、公開先で読み込んでください。継続利用するURLが決まっていれば、ホーム画面への追加もそのURLで行います。

Service Workerは同一オリジンの画面・静的ファイルだけをキャッシュします。家計データはlocalStorageに保存し、広告はキャッシュしません。`sw.js` とアイコン等は再検証し、ファイル名にハッシュがある `/assets/` のみ長期キャッシュします。

新バージョンが待機中の場合は、そのサイトのタブとPWAウィンドウを閉じて開き直すと切り替わります。更新のためにブラウザの保存データを消す必要はありません。

公式資料：
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/workers/static-assets/headers/
