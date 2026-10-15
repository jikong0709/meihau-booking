# 小黃司機優惠資源庫｜來源及非正式測試記錄

Date: 2026-10-15 (Asia/Taipei)　TASK_ID: MB-20261015-001

## 來源一致性
- 最新 `main`: `46c392c8c5cfddd8b9eb71792f1278ae1b946cfe`。
- 第七輪獨立頁來自指定 Google Drive 子資料夾的 `小黃司機優惠資源庫_第七輪互動預覽.html`。
- GitHub `taxi-benefits/index.html` connector readback 和該來源逐字一致：PASS。
- 89 筆 records，89 個不重複 ID：PASS。
- 原始來源 URL：88 筆；`EXC-005` 沒有來源 URL，顯示待補。
- `resources.html` 差異：只新增一筆 `entry-card` 的 6 行入口，去除新增段落後與原 `main` 完全一致：PASS。

## JavaScript / HTML（在本機隔離執行環境）
- `node --check` 對第七輪獨立頁的兩段 inline script：PASS。
- HTML `id` 24 個，重複：0。
- Chromium 執行 Playwright `page.set_content` （不連線 production）：390／768／1440px 首頁渲染 PASS；各 viewport 可見 12 張優惠卡、8 個分類按鈕，無水平溢位、無 JavaScript pageerror。
- 1440px 分類按鈕「加油優惠」切換：7 筆符合清單，`aria-pressed=true` PASS。
- 搜尋「中油」：3 筆符合清單 PASS。
- 點擊詳情開啟彈窗、Escape 關閉：PASS。
- 返回首頁相對路徑 `../` 存在：PASS（純路徑檢查，尚未進行 Pages 線上導航）。
- 測試中無任何真實使用者登入、寫入資料庫或正式部署。

## 未執行的驗收
- GitHub Pages 或 localhost HTTP 下 `/meihau-booking/resources.html` → `/meihau-booking/taxi-benefits/` → `/meihau-booking/` 的端到端導航：NOT_RUN。
- 生產環境 CI／Pages workflow／手機真機／外部網站現行申辦查核：NOT_RUN。
- PR 合併、正式部署：NOT_EXECUTED。

## 使用者下一階段 Gate
部署工程師須依 `DEPLOYMENT_HANDOFF.md` 完成 HTTP + 正式 Pages 驗收。凡無即時證據的第三方優惠保留資格／期限警示，不宣告可直接申辦。
