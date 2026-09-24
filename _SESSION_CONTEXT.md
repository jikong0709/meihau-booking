# Session Context

## 2026-09-24 品牌 Logo 更換

- 使用者指定圖檔已納入 `assets/meihau-booking-logo.png`，原圖內容未修改。
- 公開首頁、會員中心、管理後台與 favicon 均已改用新 Logo。
- 導覽列顯示圖片中的愛心勾選圖形，保留既有品牌文字與 MEMBER／ADMIN 識別。
- 桌機與 390px 手機版已完成本機 Playwright 視覺自檢。

## 2026-09-24 會員全名與多組常用地址

- 正式程式 commit：`c38b158`；GitHub Pages workflow `35949540337` 已成功。
- 會員資料已拆分為「帳號名稱」與「全名」。
- 常用地址可新增多筆，類型為住家／公司／其他；欄位包含地址名稱、收件人、收件人電話、完整地址與收件位置備註。
- Supabase `booking.members.full_name`、`booking.addresses.address_type` 已套用，地址表仍維持強制 RLS。
- `booking-api` 已支援全名更新與多地址新增，包含服務端欄位驗證。
- 線上靜態頁與未登入保護已驗證。
- 唯一尚待：使用者親自在 Google 選擇帳號後，驗證登入狀態下的會員資料更新與多地址新增／讀回。

## 2026-09-24 正式後端與 Google 登入部署

- 正式 `main` commit：`273cdd7`；GitHub Pages workflow `35946549055` 已成功。
- Google OAuth 已接至既有 Supabase Auth；正式首頁點「使用 Google 登入」已實測抵達 Google 選擇帳戶頁。
- 未登入直接開 `member.html` 已實測導回 `index.html?login=required`。
- 既有 Supabase 專案內使用獨立 `booking` schema，新增 `members`、`addresses`、`orders`、`order_items`；均啟用並強制 RLS。
- 已部署 `booking-api` 與 `runtime-config` Edge Functions；前端不保存私密金鑰。
- 會員資料、常用地址、後端計價、訂單清單／建立、Admin 權限閘門、後台統計／月曆／收款清單皆已接正式 API。
- 待使用者在保留的 Google 分頁親自選帳號，才能繼續驗證首次會員建立與登入後流程。
- 真實綠界付款尚未啟用；涉及金流，必須取得使用者當下明確確認與正式商店設定後才能處理。

## 2026-09-24 最新部署

- 前端產品架構 v1 已從 `feature/full-platform-v1-implementation` 合併到 `main`。
- 正式部署 commit：`60e243dd4fed8d5af090ca90ef92eb2b540cbbe7`。
- GitHub Pages workflow `35892501346` 已成功完成。
- 線上網址：`https://jikong0709.github.io/meihau-booking/`。
- 線上驗收：首頁、`member.html?demo=1`、`admin.html` 均為 HTTP 200；管理後台 390px 手機視窗無水平溢位，主控台 0 error／0 warning。
- 目前仍是前端 Demo；正式 Google Login、會員／地址／訂單 API、Admin 權限、後端計價與綠界付款尚未串接。
- 本次部署未修改 Supabase 或其他資料庫。

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
