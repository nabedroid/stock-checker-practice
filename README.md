# 概要
ステラソラの物資画面のスクリーンショットから素材数を解析し、
各素材の所持数を表示する。

# 開発環境
- Windows 11
- Docker

# 使い方
準備中

## ローカルでの実行

1. Docker がインストールされた Windows の ターミナル（powershell）で以下のコマンドを実行

```
# ビルド及び開発サーバーでアプリが起動します
# ホットリロードが必要なら --watch を付けて起動
docker compose up main
# マスターデータを自作する場合
docker compose up manager
```

2. ブラウザで http://localhost:3000/ にアクセス（manager を起動した場合は 3001）
