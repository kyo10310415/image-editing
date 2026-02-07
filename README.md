# 画像編集システム - Vertex AI Imagen版

## プロジェクト概要
- **名前**: 画像編集システム
- **目標**: キャンペーン画像の割引率と価格を自動的に変更するWebアプリケーション
- **AI画像生成**: Google Vertex AI Imagen 3 🆕
- **主な機能**: 
  - **複数画像の一括処理**
  - **カスタムキャンペーン名入力**
  - **画像URL入力対応**
  - 画像アップロード（ドラッグ&ドロップ対応）
  - 割引率の入力と価格の自動計算
  - **Vertex AI Imagen 3による高品質な画像生成** 🆕
  - 生成画像の個別/一括ダウンロード

## 🚀 セットアップガイド（Renderデプロイ）

### 前提条件
1. **Google Cloud アカウント**
2. **Render アカウント**
3. **GitHubアカウント**（リポジトリ: https://github.com/kyo10310415/image-editing）

### Step 1: Google Cloud Vertex AI設定

#### 1.1 Google Cloudプロジェクトの作成
```bash
# Google Cloud Consoleにアクセス
https://console.cloud.google.com/

# 新しいプロジェクトを作成
# プロジェクト名: image-editing-system（または任意の名前）
# プロジェクトIDをメモ: your-project-id
```

#### 1.2 Vertex AI APIの有効化
```bash
# Google Cloud Consoleで以下のAPIを有効化
1. Vertex AI API
2. Cloud AI Platform API

# または gcloud CLIで有効化
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage-api.googleapis.com
```

#### 1.3 サービスアカウントの作成
```bash
# 1. Google Cloud Console → IAMと管理 → サービスアカウント
# 2. 「サービスアカウントを作成」をクリック

# サービスアカウント名: image-editing-sa
# サービスアカウントID: image-editing-sa@your-project-id.iam.gserviceaccount.com

# 3. ロールの付与:
#    - Vertex AI User
#    - Storage Object Viewer（画像アクセス用）

# 4. JSONキーの作成:
#    - 「キー」タブ → 「鍵を追加」 → 「新しい鍵を作成」
#    - JSON形式を選択
#    - ダウンロードされたJSONファイルを保存: service-account-key.json
```

#### 1.4 JSONキーの内容確認
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "image-editing-sa@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### Step 2: Renderへのデプロイ

#### 2.1 Renderにログイン
```
https://dashboard.render.com/
```

#### 2.2 新しいWeb Serviceの作成
1. **「New +」** → **「Web Service」** をクリック
2. **GitHubリポジトリを接続**: `kyo10310415/image-editing`
3. 以下の設定を入力:

**基本設定:**
- **Name**: `image-editing-system`（または任意の名前）
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: `Free`

#### 2.3 環境変数の設定

Render Dashboardで以下の環境変数を追加:

| Key | Value | 説明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 本番環境モード |
| `PORT` | `3000` | サーバーポート（自動設定） |
| `GOOGLE_CLOUD_PROJECT` | `your-project-id` | あなたのGCPプロジェクトID |
| `GOOGLE_CLOUD_LOCATION` | `us-central1` | Vertex AIのリージョン |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/gcp-key.json` | サービスアカウントキーのパス |

#### 2.4 サービスアカウントキーの設定（重要）

**方法1: Renderのシークレットファイル機能を使用（推奨）**

1. Render Dashboard → あなたのサービス → **「Environment」** タブ
2. **「Secret Files」** セクションで **「Add Secret File」** をクリック
3. 以下を入力:
   - **Filename**: `/etc/secrets/gcp-key.json`
   - **Contents**: `service-account-key.json` の内容を貼り付け

**方法2: 環境変数として設定（代替案）**

JSONキーをBase64エンコードして環境変数に設定:

```bash
# ローカルでBase64エンコード
cat service-account-key.json | base64

# Render環境変数に追加:
# Key: GOOGLE_APPLICATION_CREDENTIALS_JSON
# Value: <Base64エンコードされた文字列>
```

そして、コードで以下のようにデコード:
```typescript
// src/imagen.ts で追加
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  const keyContent = Buffer.from(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 
    'base64'
  ).toString('utf-8');
  // 一時ファイルに書き出すか、直接認証情報として使用
}
```

#### 2.5 デプロイの実行
1. **「Create Web Service」** をクリック
2. 自動的にビルドとデプロイが開始されます
3. デプロイ完了後、URLが表示されます（例: `https://image-editing-system.onrender.com`）

### Step 3: 動作確認

```bash
# デプロイされたURLにアクセス
https://your-app-name.onrender.com

# 価格計算APIのテスト
curl -X POST https://your-app-name.onrender.com/api/calculate \
  -H "Content-Type: application/json" \
  -d '{"discountRate": 20}'

# レスポンス例:
# {
#   "discountRate": 20,
#   "prices": {
#     "regular": {"original": 4400, "discounted": 3520},
#     "hard": {"original": 4950, "discounted": 3960}
#   }
# }
```

### トラブルシューティング

#### エラー: "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set"
- Renderの環境変数設定を確認
- Secret Fileが正しく設定されているか確認
- パス `/etc/secrets/gcp-key.json` が正しいか確認

#### エラー: "Imagen API failed: Permission denied"
- サービスアカウントに `Vertex AI User` ロールが付与されているか確認
- Vertex AI APIが有効化されているか確認
- プロジェクトIDが正しいか確認

#### エラー: ビルド失敗
- `package.json` の `build` スクリプトを確認
- Node.jsバージョンを確認（推奨: v20以上）
- Render Build Logsでエラーメッセージを確認

#### エラー: タイムアウト
- Renderの無料プランでは、15分間アイドル状態後にスリープします
- 初回リクエストは起動に時間がかかります（コールドスタート）
- 有料プランにアップグレードすると常時稼働します

## ローカル開発環境のセットアップ

### 前提条件
- Node.js v20以上
- npm または yarn

### 1. リポジトリをクローン
```bash
git clone https://github.com/kyo10310415/image-editing.git
cd image-editing
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境変数の設定
```bash
# .envファイルを作成
cp .env.example .env

# .envファイルを編集
nano .env
```

```.env
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
PORT=3000
NODE_ENV=development
```

### 4. サービスアカウントキーを配置
```bash
# Google Cloudからダウンロードしたキーファイルをプロジェクトルートに配置
cp ~/Downloads/service-account-key.json ./
```

### 5. 開発サーバーの起動
```bash
# TypeScript開発モード（ホットリロード）
npm run dev

# または本番ビルド後に起動
npm run build
npm start
```

### 6. アクセス
```
http://localhost:3000
```

## 現在完成している機能

### ✅ 基本機能
1. **複数画像入力機能**
   - **方法1: ファイルアップロード**
     - 1枚または複数枚の画像を同時にアップロード
     - ドラッグ&ドロップ対応
     - **自動画像最適化機能**
       - 大きな画像（高解像度）は自動的にリサイズ（最大幅1920px）
       - 品質90%で圧縮してファイルサイズを削減
       - Base64エンコードエラーを防止
     - 画像プレビュー機能
     - 個別削除・一括クリア機能
     - PNG, JPG, JPEG形式対応
   - **方法2: 画像URL入力**
     - 画像URLを直接入力（複数対応）
     - 大きなファイルのアップロード問題を解決
     - 例: https://www.genspark.ai/api/files/s/gnHscP8A

2. **価格計算機能**
   - 割引率入力（0〜100%）
   - リアルタイム価格自動計算
   - コムレギュラー（元価格: ¥4,400）
   - コムハード（元価格: ¥4,950）

3. **キャンペーン設定機能**
   - 大感謝祭 限定キャンペーン
   - お買い物マラソン限定キャンペーン
   - **カスタムキャンペーン名入力**（独自のキャンペーン名を設定可能）

4. **AI画像一括生成** 🆕
   - **Vertex AI Imagen 3統合**
   - 複数画像の順次生成
   - 生成進捗表示
   - 元画像のレイアウト維持
   - 数値部分のみ変更
   - 高品質な画像出力

5. **画像ダウンロード機能**
   - 個別ダウンロード
   - **一括ダウンロード機能**
   - ファイル名自動設定

## API エンドポイント

### POST `/api/calculate`
価格計算API

**リクエスト:**
```json
{
  "discountRate": 20
}
```

**レスポンス:**
```json
{
  "discountRate": 20,
  "prices": {
    "regular": { "original": 4400, "discounted": 3520 },
    "hard": { "original": 4950, "discounted": 3960 }
  }
}
```

### POST `/api/generate-batch`
複数画像一括生成（ファイルアップロード）

**リクエスト:** FormData
- `image_0`: File
- `image_1`: File
- ...
- `discountRate`: string
- `campaignType`: string
- `customCampaignName`: string (optional)

**レスポンス:**
```json
{
  "success": true,
  "count": 2,
  "images": [
    { "prompt": "...", "imageUrl": "data:image/jpeg;base64,...", "originalName": "image1.jpg" },
    { "prompt": "...", "imageUrl": "data:image/jpeg;base64,...", "originalName": "image2.jpg" }
  ],
  "prices": { "regular": 3520, "hard": 3960 },
  "discountRate": 20,
  "campaignTitle": "大感謝祭 限定キャンペーン"
}
```

### POST `/api/generate-batch-url`
複数画像一括生成（URL指定）

**リクエスト:**
```json
{
  "imageUrls": ["url1", "url2"],
  "discountRate": 20,
  "campaignType": "thanksgiving",
  "customCampaignName": "春のセール"
}
```

**レスポンス:**
```json
{
  "success": true,
  "count": 2,
  "images": [
    { "prompt": "...", "imageUrl": "https://...", "originalName": "image_1" },
    { "prompt": "...", "imageUrl": "https://...", "originalName": "image_2" }
  ],
  "prices": { "regular": 3520, "hard": 3960 },
  "discountRate": 20,
  "campaignTitle": "大感謝祭 限定キャンペーン"
}
```

### POST `/api/execute-generation` 🆕
Vertex AI Imagen実行API

**リクエスト:**
```json
{
  "prompt": "生成用プロンプト",
  "imageUrl": "data:image/jpeg;base64,...",
  "discountRate": 20,
  "index": 0
}
```

**レスポンス:**
```json
{
  "success": true,
  "generated_images": [
    {
      "url": "data:image/png;base64,..."
    }
  ]
}
```

## URLs
- **本番環境**: https://your-app-name.onrender.com（デプロイ後）
- **GitHub**: https://github.com/kyo10310415/image-editing
- **Google Cloud Console**: https://console.cloud.google.com/

## 技術スタック

### フロントエンド
- HTML5
- TailwindCSS（CDN版）
- JavaScript (Vanilla)

### バックエンド
- **Node.js** (v20以上)
- **Hono** - 軽量Webフレームワーク
- **TypeScript**
- **Google Cloud Vertex AI SDK** - Imagen 3 API

### デプロイ
- **Render** - Web Service
- **Google Cloud Platform** - Vertex AI Imagen

### 開発ツール
- tsx（TypeScript実行）
- vite（ビルドツール）

## 使い方ガイド

### 基本的な使用方法

#### 方法1: ファイルアップロード
1. **「ファイルをアップロード」を選択**
2. **画像をアップロード**
   - 1枚または複数枚の画像をドラッグ&ドロップまたはクリックして選択
   - **大きな画像は自動的に最適化されます**（最大幅1920px、品質90%）
   - 選択した画像のプレビューが表示されます
   - 不要な画像は個別に削除可能
   
3. **設定を入力**
   - キャンペーンタイプを選択
     - 大感謝祭 限定キャンペーン
     - お買い物マラソン限定キャンペーン
     - **カスタム**（独自のキャンペーン名を入力）
   - 割引率を入力（例: 20, 25, 30）
   - 価格が自動計算されます

4. **画像を生成**
   - 「画像を生成」ボタンをクリック
   - **Vertex AI Imagen 3** でAI画像生成が開始
   - 複数画像の場合は順次処理
   - 進捗状況が表示されます（例: 画像 2/3 を生成中...）
   
5. **画像をダウンロード**
   - 生成された画像がグリッド形式で表示
   - 各画像を個別にダウンロード
   - または「すべてダウンロード」ボタンで一括ダウンロード

#### 方法2: 画像URL入力（推奨）
1. **「画像URLを入力」を選択**
2. **画像URLを入力**
   - テキストエリアに画像URLを1行に1つずつ入力
   - 例:
     ```
     https://www.genspark.ai/api/files/s/gnHscP8A
     https://www.genspark.ai/api/files/s/dUVrMxmY
     ```
   - 複数のURLを改行で区切って入力可能
   
3. **設定と生成**
   - キャンペーンタイプと割引率を設定
   - 「画像を生成」ボタンをクリック
   - 以降は方法1と同じ流れ

**💡 URL入力モードの利点:**
- 大きな画像ファイルでもエラーが発生しない
- アップロード時間が不要
- 外部ホスティングされた画像を直接使用可能

## 更新履歴

### v3.0.0 - 2026-02-07 🆕
- ✨ **Vertex AI Imagen 3統合**
- 🚀 **Renderデプロイ対応**
- 🔧 Node.jsサーバー環境への移行
- 📝 セットアップガイドの追加
- 🔐 Google Cloud認証設定の追加
- 🎨 環境変数管理の改善

### v2.2.0 - 2026-02-07
- ✨ **自動画像最適化機能**を追加（ローカルアップロード時）
- 🔧 大きな画像を自動的に最大幅1920px、品質90%に最適化
- 🐛 修正: 大きなファイルのBase64エンコードエラーを完全に解決

### v2.1.0 - 2026-02-07
- ✨ **画像URL入力機能**を追加
- 🔧 新しいAPIエンドポイント `/api/generate-batch-url` を追加

### v2.0.0 - 2026-02-07
- ✨ **複数画像一括処理機能**を追加
- ✨ **カスタムキャンペーン名入力機能**を追加

### v1.0.0 - 2026-02-07
- 🎉 初回リリース

## ライセンス
MIT

## 最終更新日
2026-02-07
