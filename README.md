# kintone予約システム 開発手順書

## 概要

kintoneからGitHub Actions経由でLIFF予約フォームを自動生成・デプロイするシステムの構築手順です。

## 前提条件

### 必要なアカウント・サービス
```yaml
必須アカウント:
  ✅ kintone（サイボウズ）
  ✅ GitHub（Organization推奨）
  ✅ Cloudflare（Pages機能）
  ✅ LINE Developers（LIFF用）
  ✅ Google Cloud Platform（GAS・Calendar用）

準備するもの:
  - ドメイン（Cloudflare管理推奨）
  - 既存の予約フォーム（テンプレート）
  - 店舗設定データ（JSON形式）
```

## プロジェクト構成

```
line-forms/
├── .github/
│   └── workflows/
│       └── deploy-form.yml     # GitHub Actions デプロイメント設定
├── templates/
│   ├── index.hbs              # LIFF予約フォームテンプレート
│   ├── style.css              # 予約フォーム用スタイルシート
│   └── script.js              # LIFF連携・予約処理JavaScript
├── dist/                      # 生成されたフォーム出力
│   └── {store_id}/           # 店舗別フォーム
├── docs/                      # 設定・運用ドキュメント
└── README.md                  # このファイル
```

---

## Phase 1: kintone環境構築

### 1.1 アプリ作成

#### フィールド設定
```yaml
アプリ名: Store Management System
アプリ種別: データベース型

フィールド設定:
  - store_id: 文字列（一行）【必須・重複禁止】
  - store_name: 文字列（一行）【必須】
  - phone: 文字列（一行）
  - email: 文字列（一行）
  - liff_id: 文字列（一行）【必須】
  - form_url: リンク【読み取り専用】
  - status: ドロップダウン
    選択肢: pending/processing/active/error
    初期値: pending
  - menu_config: 文字列（複数行）
  - business_hours: 文字列（複数行）
  - primary_color: 文字列（一行）
  - error_message: 文字列（複数行）【読み取り専用】
  - updated_at: 日時【読み取り専用】
```

### 1.2 GitHub Secrets設定

#### 必要なシークレット
```bash
KINTONE_API_TOKEN: "kintoneで生成したAPIトークン"
KINTONE_APP_ID: "店舗管理アプリのID"
KINTONE_DOMAIN: "your-domain.cybozu.com"

CLOUDFLARE_API_TOKEN: "Cloudflare APIトークン"
CLOUDFLARE_ACCOUNT_ID: "CloudflareアカウントID"
CLOUDFLARE_ZONE_ID: "ドメインのZone ID"
```

---

## Phase 2: システム機能

### 2.1 フォーム機能
- **LIFF統合**: LINE内ブラウザでの動作
- **レスポンシブデザイン**: モバイル最適化
- **リアルタイム予約状況**: Google Calendar連携
- **自動メッセージ送信**: LINE トークへの予約内容送信

### 2.2 予約フロー
1. 来店回数選択（初回/リピート）
2. メニュー選択
3. 日時選択（空き状況確認）
4. 顧客情報入力
5. 予約内容確認
6. LINE送信・Calendar登録

### 2.3 技術仕様
- **テンプレートエンジン**: Handlebars.js
- **LIFF SDK**: v2.1
- **デプロイ**: GitHub Actions + Cloudflare Pages
- **API連携**: Google Apps Script

---

## Phase 3: 導入・運用

### 3.1 セットアップ手順
1. kintoneアプリ作成・設定
2. GitHub リポジトリフォーク・Secrets設定
3. Cloudflare Pages設定
4. LINE LIFF アプリ作成
5. Google Apps Script デプロイ

### 3.2 店舗追加フロー
1. kintoneで新規レコード作成
2. 必須フィールド入力（store_id、store_name、liff_id等）
3. レコード保存でWebhook自動実行
4. GitHub Actions でフォーム生成・デプロイ
5. form_url 自動更新・status を active に変更

### 3.3 運用監視
- ワークフロー実行状況監視
- エラー状態レコードアラート
- 予約データ分析・レポート

---

## カスタマイズ例

### 店舗データ例
```json
{
  "store_id": "beauty-salon-shibuya",
  "store_name": "Beauty Salon Shibuya",
  "phone": "03-1234-5678",
  "liff_id": "1234567890-abcdefgh",
  "menu": [
    {"id": "cut", "name": "カット", "time": 60, "price": 5000},
    {"id": "color", "name": "カラー", "time": 120, "price": 8000},
    {"id": "perm", "name": "パーマ", "time": 150, "price": 12000}
  ],
  "business_hours": {
    "月": "9:00-18:00",
    "火": "9:00-18:00", 
    "水": "休み",
    "木": "9:00-18:00",
    "金": "9:00-18:00",
    "土": "9:00-17:00",
    "日": "10:00-16:00"
  },
  "primary_color": "#ff6b6b"
}
```

### デプロイ結果
- **生成URL**: `https://{store_id}-booking.pages.dev`
- **LIFF対応**: LINE内ブラウザで最適表示
- **自動更新**: kintoneレコード更新で再デプロイ

---

## 拡張計画

### Short-term（1-3ヶ月）
- 複数店舗グループ管理
- 予約状況リアルタイム同期
- 顧客管理機能

### Mid-term（3-6ヶ月）
- 売上レポート・分析
- スタッフ管理機能
- 自動リマインダー

### Long-term（6ヶ月以上）
- AI による最適予約提案
- 多言語対応
- 外部システム連携API

---

## サポート

### トラブルシューティング
- GitHub Actionsログ確認
- kintone Webhook履歴確認
- LIFF動作テスト手順

### 開発・カスタマイズ
- テンプレート編集方法
- 新機能追加手順
- セキュリティベストプラクティス

ご質問やサポートが必要な場合は、GitHubのIssuesページでお知らせください。
