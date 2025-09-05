const fs = require('fs-extra');
const path = require('path');
const Handlebars = require('handlebars');

async function build() {
  try {
    console.log('🔨 ビルドを開始します...');
    
    // 環境変数または引数から店舗データを取得
    const storeData = getStoreData();
    console.log('📋 店舗データ:', storeData);
    
    // distディレクトリをクリーンアップ
    await fs.emptyDir('./dist');
    console.log('✅ distディレクトリをクリーンアップしました');
    
    // テンプレートファイルを読み込み
    const templatePath = './templates/index.hbs';
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    
    // HTMLを生成
    const html = template(storeData);
    
    // 出力ディレクトリを作成
    const outputDir = `./dist/${storeData.store_id}`;
    await fs.ensureDir(outputDir);
    
    // HTMLファイルを出力
    await fs.writeFile(path.join(outputDir, 'index.html'), html);
    console.log(`✅ ${outputDir}/index.html を生成しました`);
    
    // CSS と JS をコピー
    await fs.copy('./templates/style.css', path.join(outputDir, 'style.css'));
    await fs.copy('./templates/script.js', path.join(outputDir, 'script.js'));
    console.log('✅ CSS と JS ファイルをコピーしました');
    
    // ルートにindex.htmlを作成（Cloudflare Pages用）
    const indexContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Line Forms - 予約システム</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
    .container { max-width: 600px; margin: 0 auto; }
    .store-link { 
      display: block; 
      padding: 20px; 
      margin: 10px 0; 
      background: #f0f0f0; 
      text-decoration: none; 
      color: #333; 
      border-radius: 8px; 
    }
    .store-link:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Line Forms 予約システム</h1>
    <p>利用可能な店舗:</p>
    <a href="/${storeData.store_id}/" class="store-link">
      ${storeData.store_name}
    </a>
  </div>
</body>
</html>`;
    
    await fs.writeFile('./dist/index.html', indexContent);
    console.log('✅ ルートindex.htmlを生成しました');
    
    console.log('🎉 ビルドが完了しました！');
    
  } catch (error) {
    console.error('❌ ビルドエラー:', error);
    process.exit(1);
  }
}

function getStoreData() {
  // GitHub Actions の environment variables から取得
  if (process.env.GITHUB_ACTIONS && process.env.STORE_DATA) {
    try {
      return JSON.parse(process.env.STORE_DATA);
    } catch (error) {
      console.warn('⚠️ STORE_DATA の解析に失敗しました:', error);
    }
  }
  
  // デフォルトの店舗データ（ローカル開発・デモ用）
  return {
    store_id: 'demo-store',
    store_name: 'デモ店舗',
    phone: '03-1234-5678',
    liff_id: 'demo-liff-id',
    menu: [
      { id: 'cut', name: 'カット', time: 60, price: 5000 },
      { id: 'color', name: 'カラー', time: 120, price: 8000 },
      { id: 'perm', name: 'パーマ', time: 150, price: 12000 }
    ],
    business_hours: {
      '月': '9:00-18:00',
      '火': '9:00-18:00',
      '水': '休み',
      '木': '9:00-18:00',
      '金': '9:00-18:00',
      '土': '9:00-17:00',
      '日': '10:00-16:00'
    },
    primary_color: '#ff6b6b'
  };
}

build();
