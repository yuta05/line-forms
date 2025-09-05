## 進捗ログ

### Day 1
- モノレポ初期化（README, docs, packages/config）
- config dev サンプル追加（menu/rules/ui）
- apps/* README、移行ガイド追加
- CI/CD スタブ（Vercel/GAS）追加

### Next
- LIFF自動化ドキュメント、GAS CI/CD 詳細、Secrets マトリクス、Admin API 設計 追加
- 予約フォームの Next.js 移植開始

### Day 2
- apps/frontend を初期化（Next.js, TS）
- LIFF 初期化と空き取得プレースホルダを追加（`app/page.tsx`）
- 実行設定：`NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_GAS_AVAILABILITY_URL` を利用
- TODO更新：frontend-scaffold を完了に設定
- original/GAS のレスポンス形式を解析し、フロントのマッピングを実装
- モックAPI `/api/availability` を追加し、GAS未接続でも動作確認可能に
- `FormSkeleton` を追加し、`liff.sendMessages` の送信テンプレ骨子を実装
 - カレンダーUI（週×30分）を追加し、クリックで日時選択できるように
- 選択日時をフォームへ連動・保存（localStorage）
- `packages/config/dev` の実メニューデータに更新
- `MenuSelector` コンポーネント追加（来店回数/コース/メニュー/オプション選択）
- 所要時間計算ロジック実装（`lib/config.ts`）
- カレンダー可否判定を所要時間＋最終受付時刻で動的計算
- **マイルストーン2（フロント移植）完了** ✅

### Day 3
- GAS 3種をTS最小実装（availability/reservation/reminder）
- GASデプロイActionsを具体化（clasp push/version/deploy + Properties同期）
- GASに管理用プロパティ設定エンドポイント追加（adminToken保護）
- Secretsマトリクス更新（ADMIN_TOKEN/各URL）
 - マルチテナント着手：tenantId入力、workflowにtenant追加、サンプルテナントconfig
 - 管理UI/APIをtenant対応へ更新（GAS deploy）

