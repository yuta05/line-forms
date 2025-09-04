# トラブルシューティングガイド

## よくある問題と解決方法

### 1. GitHub Actions が実行されない

#### 症状
- kintoneでレコードを作成/更新してもワークフローが実行されない

#### 確認項目
1. **Webhook設定**
   - kintoneのWebhook URLが正しいか
   - GitHub PersonalAccessTokenが有効か
   - HTTPヘッダーが正しく設定されているか

2. **GitHub Secrets**
   - 必要なSecretsがすべて設定されているか
   - 値に余分なスペースや文字が含まれていないか

3. **リポジトリ権限**
   - Actions が有効になっているか
   - repository_dispatch イベントが許可されているか

#### 解決方法
```bash
# Webhook テスト
curl -X POST https://api.github.com/repos/YOUR_ORG/line-forms/dispatches \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"event_type":"deploy-form","client_payload":{"test":true}}'
```

### 2. フォーム生成に失敗

#### 症状
- GitHub Actions は実行されるが、フォーム生成でエラー

#### 確認項目
1. **データ形式**
   - menu_config が正しいJSON形式か
   - 必須フィールドが入力されているか

2. **テンプレート**
   - Handlebars テンプレートの構文エラー
   - 参照しているフィールドが存在するか

#### 解決方法
```bash
# ローカルでテンプレート確認
echo '{"store_name":"テスト","menu":[]}' > test.json
handlebars templates/index.hbs --data test.json
```

### 3. Cloudflare デプロイ失敗

#### 症状
- フォームは生成されるが、Cloudflareへのデプロイが失敗

#### 確認項目
1. **API Token**
   - 権限が正しく設定されているか
   - Account ID が正しいか

2. **プロジェクト名**
   - store_id に使用禁止文字が含まれていないか
   - プロジェクト名が重複していないか

#### 解決方法
- store_id は英数字とハイフンのみ使用
- 既存プロジェクトとの重複を避ける

### 4. LIFF が動作しない

#### 症状
- フォームは表示されるが、LIFF 機能が動作しない

#### 確認項目
1. **LIFF ID**
   - 正しい LIFF ID が設定されているか
   - Endpoint URL が正しく設定されているか

2. **ドメイン**
   - HTTPS で配信されているか
   - CORS 設定が正しいか

#### 解決方法
```javascript
// ブラウザ開発者ツールで確認
console.log('LIFF ID:', STORE_CONFIG.liffId);
liff.getProfile().then(profile => console.log(profile));
```

### 5. 予約送信が失敗

#### 症状
- フォーム入力は完了するが、予約送信でエラー

#### 確認項目
1. **GAS URL**
   - Google Apps Script の URL が正しいか
   - 権限が正しく設定されているか

2. **データ形式**
   - 送信データの形式が GAS で期待される形式か

#### 解決方法
```javascript
// 送信データをコンソールで確認
console.log('Sending data:', JSON.stringify(reservationData, null, 2));
```

## エラーログの確認方法

### GitHub Actions
1. リポジトリ → Actions
2. 失敗したワークフローをクリック
3. 各ステップのログを確認

### kintone Webhook
1. アプリ設定 → 外部サービス連携 → Webhook
2. 実行履歴を確認
3. エラーメッセージを確認

### ブラウザ開発者ツール
1. F12 で開発者ツールを開く
2. Console タブでJavaScriptエラーを確認
3. Network タブでAPI通信を確認

## 連絡先

問題が解決しない場合は、以下の情報を含めてIssueを作成してください：

- 発生している問題の詳細
- エラーメッセージ
- 実行環境（ブラウザ、OS等）
- 再現手順
- 期待される動作
