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

---

## Phase 1: kintone環境構築

### 1.1 アプリ作成

#### 手順
```bash
1. kintone → アプリ → 作成
2. 「はじめから作成」を選択
3. アプリ名: Store Management System
4. 「作成」をクリック
```

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

### 1.2 APIトークン設定

#### 手順
```bash
1. アプリ設定 → API → APIトークン
2. 「生成する」をクリック
3. 権限設定:
   - レコード閲覧: ✅
   - レコード編集: ✅
   - レコード追加: ❌
   - レコード削除: ❌
4. 説明: "GitHub Actions用"
5. 保存してトークンをメモ（GitHub Secretsで使用）
```

### 1.3 AWS Lambda 中間プロキシ設定

#### 1.3.1 Lambda関数作成

##### 手順
```bash
1. AWS Console → Lambda → 関数の作成
2. 設定:
   - 関数名: kintone-github-proxy
   - ランタイム: Node.js 20.x
   - アーキテクチャ: x86_64
3. 「関数の作成」をクリック
```

##### コード (index.js)
```javascript
const https = require('https');

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        // kintone標準Webhookデータを解析
        const body = JSON.parse(event.body);
        const record = body.record;
        const recordId = body.recordId;
        
        console.log('kintone record:', record);
        
        // 必須フィールドの確認
        if (!record.store_id || !record.store_id.value || 
            !record.liff_id || !record.liff_id.value) {
            console.log('Missing required fields');
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields: store_id or liff_id'
                })
            };
        }
        
        // JSON文字列フィールドのパース
        let menuConfig = [];
        let businessHours = {};
        
        try {
            if (record.menu_config && record.menu_config.value) {
                menuConfig = JSON.parse(record.menu_config.value);
            }
        } catch (e) {
            console.log('Menu config parse error:', e);
        }
        
        try {
            if (record.business_hours && record.business_hours.value) {
                businessHours = JSON.parse(record.business_hours.value);
            }
        } catch (e) {
            console.log('Business hours parse error:', e);
        }
        
        // GitHub API用のペイロード作成
        const githubPayload = {
            event_type: 'deploy-form',
            client_payload: {
                record_id: recordId,
                store_id: record.store_id.value,
                store_name: record.store_name ? record.store_name.value : '',
                liff_id: record.liff_id.value,
                menu: menuConfig,
                business_hours: businessHours,
                primary_color: record.primary_color ? record.primary_color.value : '#007bff',
                phone: record.phone ? record.phone.value : '',
                email: record.email ? record.email.value : ''
            }
        };
        
        console.log('GitHub payload:', JSON.stringify(githubPayload, null, 2));
        
        // GitHub API呼び出し
        const result = await callGitHubAPI(githubPayload);
        
        if (result.success) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'GitHub Actions triggered successfully'
                })
            };
        } else {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: result.error
                })
            };
        }
        
    } catch (error) {
        console.error('Lambda Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

async function callGitHubAPI(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: `/repos/${process.env.GITHUB_REPO}/dispatches`,
            method: 'POST',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'User-Agent': 'kintone-github-proxy'
            }
        };
        
        const req = https.request(options, (res) => {
            console.log(`GitHub API status: ${res.statusCode}`);
            
            let responseBody = '';
            res.on('data', (chunk) => {
                responseBody += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 204) {
                    resolve({ success: true });
                } else {
                    console.log('GitHub API response:', responseBody);
                    resolve({ 
                        success: false, 
                        error: `GitHub API returned ${res.statusCode}: ${responseBody}` 
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            resolve({ success: false, error: error.message });
        });
        
        req.write(data);
        req.end();
    });
}
```

#### 1.3.2 Lambda環境変数設定

##### 手順
```bash
1. Lambda関数画面 → 設定 → 環境変数
2. 編集をクリック
3. 環境変数を追加:
   
   キー: GITHUB_TOKEN
   値: ghp_xxxxxxxxxxxxxxxxxxxx
   説明: GitHub Personal Access Token
   
   キー: GITHUB_REPO  
   値: your-org/line-forms
   説明: GitHubリポジトリ名（owner/repo形式）

4. 保存
```

##### GitHub Personal Access Token作成
```bash
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token → Generate new token (classic)
4. 設定:
   - Note: kintone-lambda-integration
   - Expiration: 1 year
   - Select scopes:
     ✅ repo (Full control of private repositories)
     ✅ workflow (Update GitHub Action workflows)
5. Generate token
6. トークンをコピー（再表示不可のため注意）
```

#### 1.3.3 API Gateway作成

##### 手順
```bash
1. AWS Console → API Gateway → APIを作成
2. REST API → 構築
3. 設定:
   - API名: kintone-webhook-api
   - 説明: kintone to GitHub webhook proxy
   - エンドポイントタイプ: リージョン
4. 作成

5. リソース作成:
   - アクション → リソースの作成
   - リソース名: webhook
   - リソースパス: /webhook
   - リソースの作成

6. メソッド作成:
   - /webhook リソース選択
   - アクション → メソッドの作成
   - メソッド: POST
   - 統合タイプ: Lambda関数
   - Lambdaプロキシ統合の使用: ✅
   - Lambda関数: kintone-github-proxy
   - 保存

7. CORS設定:
   - /webhook リソース選択
   - アクション → CORSの有効化
   - Access-Control-Allow-Origin: *
   - Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token
   - Access-Control-Allow-Methods: GET,HEAD,OPTIONS,POST,PUT
   - CORSの有効化とリソースへのデプロイ

8. API デプロイ:
   - アクション → APIのデプロイ
   - デプロイされるステージ: [新しいステージ]
   - ステージ名: prod
   - ステージの説明: Production stage
   - デプロイ

9. URLをメモ:
   - 表示されるURL例: https://abcd1234.execute-api.ap-northeast-1.amazonaws.com/prod
```

#### 1.3.4 kintone Webhook設定（標準機能）

##### 手順
```bash
1. kintoneアプリ → アプリ設定 → 外部サービス連携 → Webhook
2. 「追加する」をクリック
3. Webhook設定:
   - 名前: Lambda Proxy
   - URL: https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/prod/webhook
   - HTTPヘッダ:
     - Content-Type: application/json
   - 送信条件:
     - レコード追加時: ✅
     - レコード更新時: ✅
   - 有効: ✅
4. 保存
```

##### 送信条件の詳細設定
```javascript
// 必須フィールドが入力されている場合のみ送信
(record.store_id.value !== "") && (record.liff_id.value !== "")
```

##### kintone標準Webhookのデータ形式
```json
{
    "recordId": "1",
    "record": {
        "store_id": {
            "type": "SINGLE_LINE_TEXT",
            "value": "store001"
        },
        "store_name": {
            "type": "SINGLE_LINE_TEXT", 
            "value": "Test Beauty Salon"
        },
        "liff_id": {
            "type": "SINGLE_LINE_TEXT",
            "value": "1234567890-abcdefgh"
        },
        "menu_config": {
            "type": "MULTI_LINE_TEXT",
            "value": "[{\"id\": \"cut\", \"name\": \"カット\", \"time\": 60, \"price\": 5000}]"
        },
        "business_hours": {
            "type": "MULTI_LINE_TEXT",
            "value": "{\"月\": \"9:00-18:00\", \"火\": \"9:00-18:00\"}"
        },
        "primary_color": {
            "type": "SINGLE_LINE_TEXT",
            "value": "#ff6b6b"
        },
        "status": {
            "type": "DROP_DOWN",
            "value": "pending"
        }
    },
    "type": "ADD_RECORD"
}
```

### 1.4 テストデータ作成

#### サンプルレコード
```json
{
  "store_id": "test-store-001",
  "store_name": "Test Beauty Salon",
  "phone": "03-1234-5678",
  "email": "test@example.com",
  "liff_id": "1234567890-abcdefgh",
  "menu_config": "[{\"id\": \"cut\", \"name\": \"カット\", \"time\": 60, \"price\": 5000}, {\"id\": \"color\", \"name\": \"カラー\", \"time\": 120, \"price\": 8000}]",
  "business_hours": "{\"月\": \"9:00-18:00\", \"火\": \"9:00-18:00\", \"水\": \"休み\", \"木\": \"9:00-18:00\", \"金\": \"9:00-18:00\", \"土\": \"9:00-17:00\", \"日\": \"10:00-16:00\"}",
  "primary_color": "#ff6b6b"
}
```

---

## Phase 2: GitHub環境構築

### 2.1 リポジトリ準備

#### リポジトリ構造
```
line-forms/
├── .github/
│   └── workflows/
│       └── deploy-form.yml
├── templates/
│   ├── index.hbs
│   ├── style.css
│   └── script.js
├── dist/
│   └── (生成されたフォーム)
└── README.md
```

### 4.2 GitHub Secrets設定（詳細手順）

#### アクセス方法
```bash
1. GitHubリポジトリのページ
2. Settings タブをクリック
3. 左サイドバー → Secrets and variables 
4. Actions をクリック
```

#### Repository Secrets追加手順

##### 各Secretの設定
```bash
■ CLOUDFLARE_API_TOKEN
Name: CLOUDFLARE_API_TOKEN
Secret: 先ほど作成したCloudflare APIトークン
説明: Cloudflare API操作用の認証トークン

■ CLOUDFLARE_ACCOUNT_ID  
Name: CLOUDFLARE_ACCOUNT_ID
Secret: アカウントID（ダッシュボード右下に表示）
説明: Cloudflareアカウントの識別ID

■ CLOUDFLARE_ZONE_ID
Name: CLOUDFLARE_ZONE_ID  
Secret: ゾーンID（ドメイン管理画面のAPIセクション）
説明: 管理対象ドメインの識別ID
⚠️ 注意: 独自ドメインを使う場合のみ必要。.pages.devのみなら設定不要

■ GITHUB_TOKEN（自動設定済み）
Name: GITHUB_TOKEN
説明: GitHub Actions用の自動生成トークン
※ 手動設定不要（GitHub側で自動生成）
```

#### 設定時の注意点
```bash
⚠️ セキュリティ注意事項:
- Secretsは一度設定すると内容確認不可
- 誤入力の場合は削除→再作成が必要
- API トークンは最小権限の原則で設定
- 定期的な権限見直しとローテーション推奨

✅ 設定確認方法:
- Secrets一覧でSecret名のみ表示される
- 値は暗号化されて見えない状態が正常
- Actions実行時にログで参照エラーが出ないかチェック
```

#### Environment Variables vs Secrets の使い分け

##### Secrets（非公開情報）
```bash
用途: 認証情報、APIキー、パスワードなど
例:
- CLOUDFLARE_API_TOKEN（APIトークン）
- CLOUDFLARE_ACCOUNT_ID（アカウントID）  
- CLOUDFLARE_ZONE_ID（ゾーンID ※独自ドメイン使用時のみ）
- DATABASE_PASSWORD（DB接続情報）

特徴:
- ログに出力されない（***表示）
- Pull Request作成者に見えない
- 暗号化保存
```

##### Environment Variables（公開情報）
```bash
用途: 非機密な設定値、公開情報など
例:
- NODE_ENV（実行環境）
- API_VERSION（APIバージョン）
- REGION（リージョン設定）
- PUBLIC_URL（公開URL）

特徴:
- ログに出力される
- Pull Request作成者も確認可能
- 平文保存

■ 設定場所:
リポジトリ → Settings → Secrets and variables → Actions → Variables タブ
```

### 2.3 GitHub Actionsワークフロー

#### ファイル: .github/workflows/deploy-form.yml
```yaml
name: Deploy LIFF Form

on:
  repository_dispatch:
    types: [deploy-form]

env:
  STORE_ID: ${{ github.event.client_payload.store_id }}
  RECORD_ID: ${{ github.event.client_payload.record_id }}

jobs:
  generate-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        npm install -g handlebars-cli
        
    - name: Generate form files
      run: |
        # ディレクトリ作成
        mkdir -p dist/${STORE_ID}
        
        # テンプレートデータ作成
        echo '${{ toJson(github.event.client_payload) }}' > data.json
        
        # HTML生成
        handlebars templates/index.hbs \
          --data data.json \
          --output dist/${STORE_ID}/index.html
          
        # CSS・JS複製
        cp templates/style.css dist/${STORE_ID}/
        cp templates/script.js dist/${STORE_ID}/
        
        # 設定値をJSに埋め込み
        sed -i "s/{{LIFF_ID}}/${{ github.event.client_payload.liff_id }}/g" dist/${STORE_ID}/script.js
        sed -i "s/{{STORE_ID}}/${STORE_ID}/g" dist/${STORE_ID}/script.js
        
    - name: Deploy to Cloudflare Pages
      uses: cloudflare/pages-action@v1
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        projectName: ${STORE_ID}-booking
        directory: dist/${STORE_ID}
        gitHubToken: ${{ secrets.GITHUB_TOKEN }}
        
    - name: Update kintone record (Success)
      if: success()
      run: |
        FORM_URL="https://${STORE_ID}-booking.pages.dev"
        
        curl -X PUT "https://${{ secrets.KINTONE_DOMAIN }}/k/v1/record.json" \
          -H "X-Cybozu-API-Token: ${{ secrets.KINTONE_API_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d "{
            \"app\": \"${{ secrets.KINTONE_APP_ID }}\",
            \"id\": \"${RECORD_ID}\",
            \"record\": {
              \"form_url\": {\"value\": \"${FORM_URL}\"},
              \"status\": {\"value\": \"active\"},
              \"updated_at\": {\"value\": \"$(date -Iseconds)\"},
              \"error_message\": {\"value\": \"\"}
            }
          }"
          
    - name: Update kintone record (Failure)
      if: failure()
      run: |
        curl -X PUT "https://${{ secrets.KINTONE_DOMAIN }}/k/v1/record.json" \
          -H "X-Cybozu-API-Token: ${{ secrets.KINTONE_API_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d "{
            \"app\": \"${{ secrets.KINTONE_APP_ID }}\",
            \"id\": \"${RECORD_ID}\",
            \"record\": {
              \"status\": {\"value\": \"error\"},
              \"error_message\": {\"value\": \"フォーム生成またはデプロイに失敗しました\"},
              \"updated_at\": {\"value\": \"$(date -Iseconds)\"}
            }
          }"
```

### 2.4 テンプレートファイル作成

#### ファイル: templates/index.hbs
```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{store_name}} - 予約フォーム</title>
    <link rel="stylesheet" href="style.css">
    <style>
        :root {
            --primary-color: {{primary_color}};
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>{{store_name}}<br>予約フォーム</h1>
        </header>
        
        <main>
            <!-- 来店回数選択 -->
            <section class="visit-section">
                <h2>来店回数</h2>
                <div class="button-group">
                    <button type="button" class="visit-btn" data-time="30">初めて</button>
                    <button type="button" class="visit-btn" data-time="15">2回目以降</button>
                </div>
            </section>
            
            <!-- メニュー選択 -->
            <section class="menu-section">
                <h2>メニュー選択</h2>
                <div class="menu-list">
                    {{#each menu}}
                    <button type="button" class="menu-btn" 
                            data-id="{{id}}" 
                            data-time="{{time}}" 
                            data-price="{{price}}">
                        {{name}} - {{time}}分 - ¥{{price}}
                    </button>
                    {{/each}}
                </div>
            </section>
            
            <!-- カレンダー -->
            <section class="calendar-section">
                <h2>日時選択</h2>
                <div id="calendar"></div>
            </section>
            
            <!-- 顧客情報 -->
            <section class="customer-section">
                <h2>お客様情報</h2>
                <form id="customerForm">
                    <input type="text" id="customerName" placeholder="お名前" required>
                    <input type="tel" id="customerPhone" placeholder="電話番号" required>
                    <textarea id="customerMessage" placeholder="ご要望・ご質問"></textarea>
                </form>
            </section>
            
            <!-- 送信ボタン -->
            <section class="submit-section">
                <button id="submitBtn" class="submit-btn" disabled>
                    予約を行う
                </button>
            </section>
        </main>
    </div>
    
    <script src="https://static.line-scdn.net/liff/edge/2.1/sdk.js"></script>
    <script src="script.js"></script>
</body>
</html>
```

#### ファイル: templates/script.js
```javascript
// 店舗設定（GitHub Actionsで置換される）
const STORE_CONFIG = {
    storeId: '{{STORE_ID}}',
    liffId: '{{LIFF_ID}}',
    gasAvailabilityUrl: 'YOUR_GAS_AVAILABILITY_URL',
    gasReservationUrl: 'YOUR_GAS_RESERVATION_URL'
};

let selectedVisitTime = 0;
let selectedMenu = null;
let selectedDateTime = null;

// LIFF初期化
liff.init({ liffId: STORE_CONFIG.liffId });

// 来店回数選択
document.querySelectorAll('.visit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.visit-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        selectedVisitTime = parseInt(this.dataset.time);
        updateSubmitButton();
    });
});

// メニュー選択
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        selectedMenu = {
            id: this.dataset.id,
            time: parseInt(this.dataset.time),
            price: parseInt(this.dataset.price),
            name: this.textContent.split(' - ')[0]
        };
        updateSubmitButton();
    });
});

// 送信ボタン状態更新
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    
    const isValid = selectedVisitTime > 0 && 
                   selectedMenu && 
                   selectedDateTime && 
                   name.trim() && 
                   phone.trim();
                   
    submitBtn.disabled = !isValid;
}

// 顧客情報入力監視
document.getElementById('customerName').addEventListener('input', updateSubmitButton);
document.getElementById('customerPhone').addEventListener('input', updateSubmitButton);

// 予約送信
document.getElementById('submitBtn').addEventListener('click', async function() {
    if (this.disabled) return;
    
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const customerMessage = document.getElementById('customerMessage').value;
    
    const reservationData = {
        storeId: STORE_CONFIG.storeId,
        customerName,
        customerPhone,
        customerMessage,
        visitTime: selectedVisitTime,
        menu: selectedMenu,
        dateTime: selectedDateTime
    };
    
    try {
        // GAS経由で予約処理
        const response = await fetch(STORE_CONFIG.gasReservationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reservationData)
        });
        
        if (!response.ok) {
            throw new Error('予約処理に失敗しました');
        }
        
        // LINE トークに送信
        await liff.sendMessages([{
            type: 'text',
            text: `【予約フォーム】
お名前：${customerName}
電話番号：${customerPhone}
メニュー：${selectedMenu.name}
日時：${selectedDateTime}
${customerMessage ? `ご要望：${customerMessage}` : ''}`
        }]);
        
        alert('予約が完了しました。当日キャンセルは無いようにお願いします。');
        liff.closeWindow();
        
    } catch (error) {
        console.error('予約送信エラー:', error);
        alert('予約送信に失敗しました。もう一度お試しください。');
    }
});

// カレンダー初期化（簡易版）
function initCalendar() {
    // 実際の実装では営業時間・定休日を考慮したカレンダーを生成
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '<p>カレンダー機能は実装中です</p>';
}

// ページ読み込み完了時
document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
});
```

---

## Phase 3: Cloudflare環境構築

### 3.1 Cloudflare Pages設定（詳細版）

#### 初回設定手順
```bash
1. Cloudflareアカウント作成・ログイン
   - dash.cloudflare.com にアクセス
   - アカウント作成または既存アカウントでログイン

2. ドメイン追加（必要な場合）
   - ダッシュボード → ドメインを追加
   - ネームサーバーをCloudflareに変更
   - DNS設定の確認・移行

3. Pages プロジェクト作成
   - 左サイドバー → Pages
   - 「Create a project」をクリック
   - 「Connect to Git」を選択
```

#### Git連携設定
```bash
1. GitHub連携
   - 「GitHub」を選択
   - Cloudflareのアクセス許可
   - リポジトリ選択: line-forms

2. Build Configuration
   - Project name: line-forms-booking
   - Production branch: main
   - Framework preset: None
   - Build command: （空白のまま）
   - Build output directory: dist
   - Root directory: /（デフォルト）
```

#### Environment Variables設定（Pages側）
```bash
1. Pages project → Settings → Environment variables
2. Production環境で設定:

   Variable name: NODE_VERSION
   Value: 18

   Variable name: NPM_VERSION  
   Value: 8

   Variable name: DEPLOYMENT_ENV
   Value: production

3. Preview環境（オプション）:
   - 同様の設定をPreview環境にも適用可能
```

### 3.2 ドメイン設定（独自ドメインなしでOK）

#### 無料の.pages.devドメインを使用（推奨）
```bash
■ 自動で利用可能なドメイン:
- メインプロジェクト: line-forms-booking.pages.dev
- 店舗別フォーム: 各店舗のフォームは同一ドメインの異なるパスで配信
  例: line-forms-booking.pages.dev/store001/
     line-forms-booking.pages.dev/store002/

■ 設定不要事項:
- DNS設定: 不要（Cloudflareが自動管理）
- SSL証明書: 自動で有効化
- ドメイン購入: 不要
- ネームサーバー変更: 不要
```

#### 独自ドメインを使いたい場合（オプション）
```bash
■ ドメイン取得方法:
1. お名前.com、ムームードメインなどでドメイン購入
   推奨: .com, .jp, .net など一般的なTLD
   
2. Cloudflareにドメイン追加
   - Cloudflareダッシュボード → "Add a site"
   - ドメイン名を入力
   - プランを選択（Free プランでOK）
   
3. ネームサーバー変更
   - Cloudflareが指定するネームサーバーに変更
   - ドメイン管理会社の管理画面で設定変更
   - 反映まで最大24時間

4. カスタムドメイン設定
   - Pages project → Custom domains
   - 「Set up a custom domain」
   - ドメイン名入力: booking.yourdomain.com
   - CNAME自動設定: プロジェクト名.pages.dev
```

#### 実際の運用での推奨事項
```bash
✅ 開発・テスト段階:
- .pages.dev ドメインで十分
- 設定が簡単で即座に利用可能
- SSL/HTTPSも自動で有効

✅ 本格運用時:
- 独自ドメインがあればブランディング向上
- ただし、.pages.dev でも全く問題なし
- LINE LIFFでは外部ドメインでも正常動作

⚠️ 注意点:
- 独自ドメインは年間費用が発生（1,000-3,000円程度）
- DNS設定に知識が必要
- 設定ミスでアクセスできなくなるリスク
```

### 3.3 Cloudflare API Token作成（詳細版）

#### 手順
```bash
1. Cloudflareダッシュボード → 右上のプロフィールアイコン
2. "My Profile" をクリック
3. "API Tokens" タブを選択
4. "Create Token" をクリック
```

#### Custom Token設定
```bash
■ Token名設定:
Token name: GitHub Actions Deploy

■ 権限設定（3つ必要）:
1. Zone | Zone Settings | Edit
   - ドメインの設定変更権限
   
2. Zone | Zone | Read  
   - ドメイン情報の読み取り権限
   
3. Account | Cloudflare Pages | Edit
   - Pages管理権限

■ リソース制限:
Account Resources: Include | All accounts
Zone Resources: Include | Specific zone | yourdomain.com

■ その他設定:
Client IP Address Filtering: （空白 = 制限なし）
TTL: Custom | 1 year

5. "Continue to summary" をクリック
6. 設定内容を確認
7. "Create Token" をクリック
8. 表示されたトークンをコピー（⚠️ 再表示不可）
```

#### 必要なID/情報の確認方法

##### アカウントIDの確認
```bash
1. Cloudflareダッシュボード
2. 画面右下に表示されている
3. 例: Account ID: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

##### ゾーンIDの確認（独自ドメインを使う場合のみ）
```bash
1. ダッシュボード → 管理対象ドメインをクリック
2. 右サイドバー → APIセクション
3. Zone ID をコピー
4. 例: Zone ID: z1y2x3w4v5u6t7s8r9q0p1o2n3m4l5k6

⚠️ 注意: .pages.dev ドメインのみ使用する場合、Zone IDは不要
```

##### .pages.devドメイン使用時の設定
```bash
■ GitHub Secretsで設定するもの:
- CLOUDFLARE_API_TOKEN: 必要（Pages管理用）
- CLOUDFLARE_ACCOUNT_ID: 必要（アカウント識別用）
- CLOUDFLARE_ZONE_ID: 不要（.pages.devの場合）

■ GitHub Actionsワークフローの修正:
# 独自ドメインを使わない場合、zone関連の処理は削除
```

##### Pages URL確認
```bash
1. Pages → プロジェクト名をクリック  
2. 画面上部に表示されるURL
3. 例: https://line-forms-booking.pages.dev
```

#### トークンテスト
```bash
# 作成したトークンの動作確認
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# 正常レスポンス例:
{
  "result": {
    "id": "token_id",
    "status": "active"
  },
  "success": true
}
```

---

## Phase 4: LINE LIFF設定

### 4.1 LINE Developers Console

#### 手順
```bash
1. LINE Developers Console → New channel
2. Channel type: LINE Login
3. Basic settings:
   - Channel name: [店舗名] 予約システム
   - Channel description: 予約フォーム用LIFF
4. LIFF → Add:
   - LIFF app name: 予約フォーム
   - Size: Full
   - Endpoint URL: (後で設定)
   - Scope: profile, openid
5. LIFF IDをメモ
```

### 4.2 各店舗のLIFF設定

#### 手順
```bash
# 店舗ごとに個別のLIFF IDが必要
1. 店舗数分のLIFFアプリを作成
2. Endpoint URLを各店舗のフォームURLに設定
   - store001: https://store001-booking.pages.dev
   - store002: https://store002-booking.pages.dev
3. kintoneの各レコードにLIFF IDを設定
```

---

## Phase 5: Google Apps Script設定

### 5.1 GASプロジェクト作成

#### 空き状況確認API
```javascript
function doGet(e) {
  const storeId = e.parameter.store;
  const startTime = e.parameter.startTime;
  const endTime = e.parameter.endTime;
  
  // Google Calendar APIで空き状況確認
  const calendarId = getStoreCalendarId(storeId);
  const events = Calendar.Events.list(calendarId, {
    timeMin: startTime,
    timeMax: endTime,
    singleEvents: true,
    orderBy: 'startTime'
  });
  
  // 空き時間計算ロジック
  const availableSlots = calculateAvailableSlots(events.items);
  
  return ContentService
    .createTextOutput(JSON.stringify(availableSlots))
    .setMimeType(ContentService.MimeType.JSON);
}
```

#### 予約処理API
```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  try {
    // Google Calendarにイベント作成
    const calendarId = getStoreCalendarId(data.storeId);
    const event = Calendar.Events.insert({
      summary: `${data.customerName} - ${data.menu.name}`,
      start: { dateTime: data.dateTime },
      end: { dateTime: calculateEndTime(data.dateTime, data.menu.time + data.visitTime) },
      description: `電話: ${data.customerPhone}\nメッセージ: ${data.customerMessage}`
    }, calendarId);
    
    // kintoneに予約実績記録（オプション）
    recordToKintone(data);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, eventId: event.id }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## Phase 6: テスト・デプロイ

### 6.1 単体テスト

#### kintone
```bash
1. テストレコード作成
2. Webhook送信確認
3. ステータス更新確認
```

#### GitHub Actions
```bash
1. repository_dispatch手動実行
2. テンプレート生成確認
3. Cloudflareデプロイ確認
4. kintone逆方向更新確認
```

#### LIFF
```bash
1. テスト用LIFFアプリ作成
2. 生成されたフォームでLIFF動作確認
3. liff.sendMessages()動作確認
```

### 6.2 統合テスト

#### エンドツーエンドフロー
```bash
1. kintoneでレコード作成/更新
2. 3-5分待機
3. 生成されたフォームURLにアクセス
4. LIFF経由での予約フロー実行
5. LINE トークへのメッセージ送信確認
6. Google Calendarイベント作成確認
```

### 6.3 本番デプロイ

#### チェックリスト
```yaml
kintone:
  ✅ 本番APIトークン設定
  ✅ Webhookカスタマイズ適用
  ✅ フィールド設定完了

GitHub:
  ✅ 本番Secrets設定
  ✅ ワークフロー動作確認
  ✅ テンプレートファイル最新化

Cloudflare:
  ✅ 本番ドメイン設定
  ✅ SSL証明書有効
  ✅ カスタムドメインパターン設定

LINE:
  ✅ 本番LIFFアプリ作成
  ✅ Endpoint URL設定
  ✅ 各店舗のLIFF ID確認

GAS:
  ✅ 本番Calendar連携
  ✅ API URL更新
  ✅ 権限設定確認
```

---

## Phase 7:運用・監視

### 7.1 監視項目

#### 自動監視
```yaml
GitHub Actions:
  - ワークフロー失敗通知
  - 実行時間監視（閾値: 10分）

kintone:
  - エラー状態レコード監視
  - Webhook送信失敗監視

Cloudflare:
  - Pages デプロイ失敗監視
  - SSL証明書期限監視
```

#### 手動確認
```yaml
週次確認:
  - 新規店舗フォーム生成テスト
  - LIFF動作確認
  - 予約フロー動作確認

月次確認:
  - API制限使用量確認
  - ストレージ使用量確認
  - パフォーマンス確認
```

### 7.2 トラブルシューティング

#### よくある問題と対処法
```yaml
フォーム生成失敗:
  1. GitHub Actions ログ確認
  2. kintoneデータ形式確認
  3. Cloudflare Pages状態確認

LIFF動作不良:
  1. LIFF ID設定確認
  2. Endpoint URL確認
  3. ブラウザキャッシュクリア

予約送信失敗:
  1. GAS ログ確認
  2. Calendar API制限確認
  3. CORS設定確認
```

---

## 拡張計画

### Short-term（1-3ヶ月）
- 複数店舗グループ管理
- 予約状況リアルタイム同期
- エラー通知Slack連携

### Mid-term（3-6ヶ月）
- 顧客管理機能追加
- 売上レポート機能
- モバイルアプリ対応

### Long-term（6ヶ月以上）
- AI予約最適化
- 多言語対応
- 他社システム連携API

---

## 付録

### A. 設定ファイルテンプレート
### B. トラブルシューティングガイド
### C. API仕様書
### D. セキュリティガイドライン

---

## 変更履歴

| 日付       | バージョン | 変更内容                     |
|------------|------------|------------------------------|
| 2023-10-01 | 1.0        | 初版公開                     |
| 2023-10-10 | 1.1        | CSVファイルによるアプリ作成手順追加 |
