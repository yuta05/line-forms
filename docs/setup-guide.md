# セットアップガイド

## 1. kintone設定

### アプリ作成
1. kintoneにログイン
2. 「アプリ」→「作成」→「はじめから作成」
3. アプリ名: "Store Management System"

### フィールド設定
| フィールド名 | 種類 | 設定 |
|------------|------|------|
| store_id | 文字列（一行） | 必須、重複禁止 |
| store_name | 文字列（一行） | 必須 |
| phone | 文字列（一行） | - |
| email | 文字列（一行） | - |
| liff_id | 文字列（一行） | 必須 |
| form_url | リンク | 読み取り専用 |
| status | ドロップダウン | pending/processing/active/error |
| menu_config | 文字列（複数行） | - |
| business_hours | 文字列（複数行） | - |
| primary_color | 文字列（一行） | - |
| error_message | 文字列（複数行） | 読み取り専用 |
| updated_at | 日時 | 読み取り専用 |

### APIトークン生成
1. アプリ設定 → API → APIトークン
2. 「生成する」クリック
3. 権限設定: 閲覧・編集にチェック
4. トークンをコピー（GitHub Secretsで使用）

## 2. GitHub設定

### リポジトリフォーク
1. このリポジトリをフォーク
2. Settings → Secrets and variables → Actions

### Secrets設定
```
KINTONE_API_TOKEN: [kintoneのAPIトークン]
KINTONE_APP_ID: [アプリのID]
KINTONE_DOMAIN: [your-domain.cybozu.com]
CLOUDFLARE_API_TOKEN: [CloudflareのAPIトークン]
CLOUDFLARE_ACCOUNT_ID: [CloudflareアカウントID]
```

## 3. Cloudflare設定

### Pages作成
1. Cloudflare → Pages → 「Create a project」
2. GitHubリポジトリ接続
3. Build settings: すべて空白

### API Token作成
1. My Profile → API Tokens → 「Create Token」
2. Permissions: Zone:Zone:Read, Account:Cloudflare Pages:Edit
3. トークンをGitHub Secretsに追加

## 4. LINE LIFF設定

### Channel作成
1. LINE Developers Console → 「New channel」
2. Channel type: LINE Login
3. アプリ名、説明を入力

### LIFF作成
1. LIFF → 「Add」
2. Size: Full
3. Endpoint URL: (後で設定)
4. LIFF IDをコピー

## 5. テストデータ作成

kintoneに以下のテストレコードを作成：

```json
{
  "store_id": "test-salon-001",
  "store_name": "テストサロン",
  "phone": "03-1234-5678",
  "liff_id": "[生成したLIFF ID]",
  "menu_config": "[{\"id\":\"cut\",\"name\":\"カット\",\"time\":60,\"price\":5000}]",
  "primary_color": "#00C851"
}
```

レコード保存後、GitHub Actionsが実行され、フォームが生成されます。
