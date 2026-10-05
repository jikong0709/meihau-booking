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

## 2026-09-25 UI v2 最新狀態

- UI v2 已由 `feature/ui-v2-full-redesign` 併入 `main`；功能 commit `ea9f7bf79e8d1bdf45c9c48a9354e4c57234baf8`，merge commit `7438634f0ae59b5353a06b07edf2fec208c33faf`。
- Pages workflow `36033771729` 已成功，正式站為 `https://jikong0709.github.io/meihau-booking/`。
- 改動範圍只有 `index.html`、`member.html`、`admin.html`、`platform.css` 與 `assets/ui-v2/`；既有 JS、Supabase、資料庫、Auth、金流、價格計算、API 未修改。
- 1440／1024／768／390／320px 已檢查；正式站 390px 無頁面水平溢位、手機 Hero 載入正確、console 0 error。
- 未登入會員頁與管理頁保護已通過；Google 登入入口可到登入頁。
- ⚠️待使用者操作：選擇 Google 帳號後驗證會員資料、地址 CRUD、報價、訂單清單；使用已授權管理員帳號驗證日曆與收款清單。
- 因登入後流程尚未驗證，目前狀態是「UI v2 已部署；最終帳號驗收待驗證」，不是整案最終結案。
- 未追蹤的 `LOGO/`、`output/`、`其他更換的美術UI/` 仍保留，未加入 Git。

## 2026-09-30 服務系統 V1 最新狀態

- 功能 commit `646387da42273e4e55877b8150d523e7a6ea1c1f` 已推送 `main`；Pages workflow `36680263055` 成功。
- 正式站 `https://jikong0709.github.io/meihau-booking/` 已讀回 HTTP 200；首頁有 9 張正式服務卡，手機／桌機無頁面水平溢位，console 0 error／warning。
- 部署前 SHA `934ea4189901f99d6bf061d7ec0d5c5d9475e171`；回滾 tag `rollback-service-v1-pre-20260930-934ea41` 已推送。
- Supabase migration `20260930055848_service_system_v1.sql` 已套用；`booking-api` v4 已部署且 JWT、CORS、無 session 401 檢查通過。
- 資料庫讀回：active services 9、coming soon 1、hidden 7、archived legacy 24、addons 2、service options 6；原有 members 2、addresses 0、orders 0、order_items 0 未變。
- 服務分流：直接預約為 `direct`；客製服務為 `custom_quote` 並寫入 `service_inquiries`，不得直接產生訂單。
- 未登入會員／管理頁 redirect 通過；Google OAuth 後完整流程仍是 `NOT RUN`，原因是客戶帳號操作必須由使用者親自進行或另行明確授權。
- 下次優先：使用者登入後驗證會員資料、地址 CRUD、直接預約、客製詢價、自己的詢價；再用已授權管理員驗證詢價管理與 RLS 隔離。
- Production Security Advisor 有既存 Leaked Password Protection Disabled 警告；Performance Advisor 無問題。
- 金流仍未啟用／未操作；未追蹤的使用者素材資料夾保持原狀。

## 2026-10-01 Developer 導向與後台整合最新狀態

- 正式 `main` 版本 `fc17ab7`；Pages workflow `36821363851` 成功。
- 指定最高權限帳號已在正式資料庫讀回 `developer`；副管理者正式登入畫面已讀回 `admin`。
- `platform.js` 現在依 `me.role` 導向：Developer／Admin 進後台，Member 進會員中心；公開首頁已有 session 時也依角色進入。
- 後台已整合為六個工作區；Developer 專屬「系統狀態」對 Admin 隱藏。
- 後台與會員中心新增「切換帳號」，只清除本站本機 session，不代替使用者選擇 Google 帳號。
- 正式 Admin 驗證通過：角色標示、會員頁自動導向、首頁角色按鈕、預約營運工作區切換、console 無 error／warning。
- ⚠️待使用者操作：點「切換帳號」後親自選擇 Developer 帳號；登入後應看到「開發者與營運工作台」「最高權限・Developer」與「系統狀態」。
- ⚠️整案仍待 Claude Code fresh-context 最終驗收；不要把 Codex 自檢標成制度上的最終完成。

## 2026-10-05 Developer 驗收完成＋首頁按鈕修正

- `a2f348d`：已登入時首頁 header 只顯示一顆角色入口按鈕（原本兩顆同字）；正式站實測 PASS。
- 「光言」帳號已升為 `developer`（role_assignments＋members 同步）；目前 Developer 2 名（光言、草槑兒），無 Admin。
- Developer 正式站畫面驗收 PASS：開發者與營運工作台／最高權限・Developer／系統狀態可見。
- Claude 的 Supabase MCP 連線不含本專案；DB 操作改用本機 Supabase CLI `db query --linked --project-ref tssvabclujwpljzupuvj`。
- 登入後流程（同日）：會員資料讀取、地址新增／讀回、我的預約／詢價、後台各工作區 PASS。
- ⚠️待使用者：親自送出一筆直接預約與一筆客製詢價（Claude 送出被安全機制擋）；決定直接預約日期是否必填；決定 E2E 測試資料是否清除。
- 下次優先：會員資料、地址 CRUD、直接預約、客製詢價、詢價管理的登入後流程驗收（仍 NOT RUN）。

## 2026-10-05 陪工作／共同存在型服務 P0

- `feature/companion-services` 已實作新 migration、時數計價、陪伴模式／目標、Provider 指派、會員取消／改期、Admin 服務狀態與 UI。
- migration 規格服務列共 38 筆；COMP-001／002／003／006 active，價格分別為 299／399／499／499。
- 本機自檢：JS／TS syntax、diff check、AC2 mock、AC3 靜態權限條件、AC4 無前端硬編碼金額、三頁 HTTP 200 均通過。
- NOT RUN：DB migration 重跑兩次、Deno check、瀏覽器 console／390px；未 push、未部署、未寫正式 DB。
- Git commit 被沙箱阻擋：worktree Git metadata 位於禁止寫入的另一工作目錄，`index.lock` Permission denied。
- 下一步必須由 Claude Code fresh-context 先驗收，再由可寫 Git metadata 的環境分三段提交；不得直接部署。
