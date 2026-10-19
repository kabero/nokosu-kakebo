# のこす家計簿

**ざっくりつけて、ちゃんと残す。**

使った額を記録して、次の給料日までに残せるお金を確認する家計簿です。
カテゴリ分けや銀行連携は不要。家計データはブラウザ内に保存します。

## 開発

Node.js 22を使用します。

```sh
npm ci
npm run dev
```

紹介ページは http://localhost:5173、家計簿は http://localhost:5174 で開きます。

## 確認

```sh
npm run check        # テスト・ビルド・公開ファイル検査
npm run preview:app  # 家計簿の本番ビルドを確認
npm run preview      # 紹介ページの本番ビルドを確認
```

## ドキュメント

- [公開設定・データ移行](DEPLOY.md)
- [計算・保存・開発ルール](docs/DEVELOPMENT.md)
- [AdSenseの設定](ADSENSE.md)
