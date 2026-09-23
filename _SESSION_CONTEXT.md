# Session Context

## 當前狀態

- 專案：莓好預約站。
- Repository：`jikong0709/meihau-booking`。
- 分支：`main`。
- 階段：MVP 已部署，預約需求可安全寫入 Supabase。
- 技術：無框架靜態 HTML / CSS / JavaScript，零相依套件、可直接用靜態主機部署。
- 部署／線上版本：GitHub Pages `https://jikong0709.github.io/meihau-booking/`；Pages workflow 已驗證成功。

## 已鎖定

- 專案不得掛在任何既有專案底下。
- 舊 `my-first-project/meihau-booking-site` 空分支不再使用。
- 第一版品牌顯示：`莓好預約站 × 光言工作室`。
- 第一版先做前端資訊架構、試營運價目、估價與預約需求單，不假裝正式訂單已成立。
- 頁面現有價格為 MVP 試營運測試價，不視為正式上線定價。

## 已實作 MVP

- `index.html`：服務、價目、預約表單、營運規則。
- `styles.css`：桌機／手機響應式視覺。
- `app.js`：服務方案、估價、需求摘要、Edge Function 安全送件與錯誤狀態。
- `supabase/functions/booking-submit/`：公開送件入口、來源限制、欄位驗證與指紋限流。
- Supabase 專案內新增獨立 `booking` schema；資料表強制 RLS，`anon`／`authenticated` 無表格權限。

## 服務範圍

- 場地預約：錄音、Podcast、攝影／直播、化妝／更衣。
- 共享辦公：時數、單日、多日與月方案。
- 跑腿／配送：預約配送、急件、汽車配送、代買、等待與額外停靠。

## 尚未實作

- 正式價格核准與營運時段。
- 正式訂單／時段鎖定（目前只建立待確認需求單）。
- 庫存／座位／場地時段衝突檢查。
- 付款／訂金。
- Google Calendar。
- Email / LINE / 其他通知。
- 後台管理。
- 正式部署與網域。

## 下一步

1. 核准正式價格、營業時間、服務區域、取消與責任規則。
2. 定義可用時段與衝突鎖定模型。
3. 建立通知與管理後台。
4. 最後再接付款與 Google Calendar。

## 禁止事項

- 不把試營運價直接描述成已正式上線價格。
- 不把目前需求單描述成正式預約或已付款訂單。
- 不處理刪除、金流或客戶帳號，除非使用者另行明確確認。
- 不記錄任何 token、API key、密碼、cookie 或私密憑證。
