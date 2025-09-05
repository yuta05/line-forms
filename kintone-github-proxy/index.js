const https = require('https');

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        // kintone標準Webhookデータを解析
        const body = JSON.parse(event.body);
        const record = body.record;
        
        // 🔧 レコードID取得方法を修正 - kintone標準Webhook形式に対応
        const recordId = record.$id.value;
        
        console.log('kintone record:', record);
        console.log('Record ID:', recordId);
        
        // 必須フィールドの確認（recordId追加）
        if (!recordId || !record.store_id || !record.store_id.value || 
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
                    error: 'Missing required fields: recordId, store_id or liff_id'
                })
            };
        }
        
        // 🔧 MULTI_SELECT フィールドの暫定対応
        let menuConfig = [];
        let businessHours = {};
        
        try {
            if (record.menu_config && record.menu_config.value) {
                // MULTI_LINE_TEXT フィールドからJSONパース
                menuConfig = JSON.parse(record.menu_config.value);
                console.log('Parsed menu_config:', menuConfig);
            } else {
                console.log('menu_config field is empty or missing');
                menuConfig = []; // 空配列で送信、kintoneで設定してもらう
            }
        } catch (e) {
            console.log('Menu config parse error:', e);
            console.log('Raw menu_config value:', record.menu_config?.value);
            menuConfig = []; // パースエラーの場合は空配列
        }
        
        try {
            if (record.business_hours && record.business_hours.value) {
                // MULTI_LINE_TEXT フィールドからJSONパースして英語キーに変換
                const originalHours = JSON.parse(record.business_hours.value);
                businessHours = convertBusinessHoursToEnglish(originalHours);
                console.log('Parsed business_hours:', businessHours);
            } else {
                console.log('business_hours field is empty or missing');
                businessHours = {}; // 空オブジェクトで送信、kintoneで設定してもらう
            }
        } catch (e) {
            console.log('Business hours parse error:', e);
            console.log('Raw business_hours value:', record.business_hours?.value);
            businessHours = {}; // パースエラーの場合は空オブジェクト
        }
        
        // GitHub API用のペイロード作成
        const githubPayload = {
            event_type: "deploy-form",
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

// 営業時間の日本語キーを英語キーに変換
function convertBusinessHoursToEnglish(originalHours) {
    const dayMapping = {
        '月': 'mon',
        '火': 'tue', 
        '水': 'wed',
        '木': 'thu',
        '金': 'fri',
        '土': 'sat',
        '日': 'sun'
    };
    
    const convertedHours = {};
    for (const [japaneseDay, time] of Object.entries(originalHours)) {
        const englishDay = dayMapping[japaneseDay] || japaneseDay;
        convertedHours[englishDay] = time;
    }
    
    return convertedHours;
}

async function callGitHubAPI(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        
        console.log('Sending payload to GitHub:', data);
        
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: `/repos/${process.env.GITHUB_REPO}/dispatches`,
            method: 'POST',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
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