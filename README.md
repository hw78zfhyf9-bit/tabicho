# 旅帖

ふたりで、みんなで使う旅行アプリ。日程、地図、持ち物、思い出を共有できます。
サーバーを持たない静的サイト(GitHub Pages)と Supabase だけで動きます。

## セットアップ (初回だけ)

1. **Supabase にデータベースを作る**
   Supabase の左メニュー「SQL Editor」を開き、`supabase/schema.sql` の中身を全部貼り付けて Run を押す。
2. **匿名ログインをオンにする**
   Authentication → Sign In / Providers → 「Allow anonymous sign-ins」をオン。
3. **GitHub Pages を有効にする**
   リポジトリの Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `/ (root)` にして Save。
   数分後に `https://<ユーザー名>.github.io/tabicho/` で開けます。
4. **一時停止を防ぐ (任意)**
   `.github/workflows/keepalive.yml` が、週に1回 Supabase を呼び出します。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | 入口 |
| `css/` | 見た目 |
| `js/config.js` | Supabase の接続先 (publishable キーのみ。secret は書かない) |
| `js/api.js` | Supabase・為替・場所検索との通信 |
| `js/views*.js` | 画面の描画 |
| `js/map.js` | 地図 (Leaflet + OpenStreetMap) |
| `js/main*.js` | 操作と起動 |
| `supabase/schema.sql` | テーブル、権限、写真の保存先 |

## 無料枠の注意

- Supabase 無料プロジェクトは、1週間まったく使われないと一時停止します。
- GitHub は、公開リポジトリで60日間まったく更新がないと、定期実行を止めることがあります。
- OpenStreetMap の地図と検索は、小さなアプリ向けです。検索は1秒に1回まで、入力中の自動検索は禁止です。
