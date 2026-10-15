# 小黃司機優惠資源庫｜接線及部署前交接
日期：2026-10-15（Asia/Taipei）

## 任務
- TASK_ID：MB-20261015-001
- DEPLOY_REF：MB-DEPLOY-20261015-001（部署候選識別，尚未執行）
- SOURCE_BRANCH：`feature/mb-20261015-taxi-benefits-resource-entry`
- BASE_SHA：`46c392c8c5cfddd8b9eb71792f1278ae1b946cfe`
- 目標網站：`https://jikong0709.github.io/meihau-booking/`
- 預計公開頁：`https://jikong0709.github.io/meihau-booking/taxi-benefits/`
- 本次使用者核准：將第七輪獨立優惠頁「接線在莓好」。
- 本次執行邊界：雲端來源工程師建立獨立分支及 Draft PR；正式合併／部署交由本機部署工程師依授權與 Gate 執行。

## 最小安全修改
1. **NET-NEW** `taxi-benefits/index.html`：自帶 CSS、JS 與 89 筆資料；粉黃黑主題、優惠分類直接顯示按鈕；頁內「回到首頁」相對連結 `../`。
2. **LOCAL PATCH** `resources.html`：在原本資源搜尋區前新增一張小黃司機優惠入口卡，`href="taxi-benefits/"`。
3. **NET-NEW** 本交接文件。

不得變更 `index.html`、`platform.js`、`platform.css`、`booking-api`、`supabase/migrations`、`config.js`、Auth／RLS／金流、其餘五大服務分類。

## 資料保留與限制
- 89 筆來源記錄、89 個不重複編號：79 筆 benefit、3 筆 law、7 筆 excluded。
- 原始網址：88 筆；`EXC-005` 無可用原始網址，前端須顯示來源待補，不得虛構來源。
- 目前仍有 3 筆申辦現況未證實；不宣稱 89 筆全部可即時申請。
- 記錄經源文件整理，尚非對外部每筆優惠「現時尚可申請」的保證。
- 本功能公開唯讀；無登入、無領券、無付款、無後端或資料庫依賴。暫不改寫資料來源方式。

## 部署工程師必做 Gate
1. 先讀中央 02D／TOP RULE、莓好預約站 00 READ FIRST／05 開工／04 共用交接、部署工作流程與其他 Draft PR。
2. Fresh-check `origin/main` HEAD 及本 PR Exact Head；檢查只更動上述三個檔案；與 PR #2 未完成服務流程完全隔離。
3. 把分支放進**非正式**的 GitHub Pages 相容 HTTP 測試環境，驗證 `/meihau-booking/resources.html` 可點擊入口、`/meihau-booking/taxi-benefits/` 可載入、按「回到首頁」回到 `/meihau-booking/`。
4. 測試 390／768／1440px：無橫向溢位、優惠分類按鈕選取、關鍵字搜尋、縣市與狀態篩選、分頁、彈窗 Escape 關閉、原始來源開新分頁、缺少來源顯示「待補」。
5. 無登入要求；不新增 Supabase Migration／RLS／Edge Function。確認 PR CI 與網頁 404、Console 錯誤。
6. 完整驗收通過且另得使用者正式部署核准後，才可依專案部署規範合併 `main` 並讓 Pages 發布。
7. 部署後提供 final SHA、workflow/deployment ID、精確正式 URL、真實桌機／手機瀏覽器 QA；沒有實測則標 NOT_RUN。

## 現階段紀錄
- GitHub 來源分支：已建立。
- `resources.html` 入口：已在來源分支局部補上。
- 89 筆來源靜態台帳與原始 HTML：已寫入來源分支（以本 PR 內容為準）。
- GitHub Pages 真正部署與正式站瀏覽器驗收：NOT_RUN。
- 主站 production / main：UNCHANGED。

## 回滾
未合併時：關閉 Draft PR 即可，不動正式站。
若未來已部署：依正式部署工程師保存的 base SHA 回退上述獨立入口及 `taxi-benefits/` 模組，不變更既有業務資料。
