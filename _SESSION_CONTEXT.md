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

## 2026-10-05 陪工作 P0 已上線（最新）

- 正式 `main`＝`2191b5c`；回滾 tag `rollback-companion-v1-pre-20261005-7d0f4a3`。
- migration `20261005120000` 已套用正式 DB（演練 rollback 一次＋實跑兩次無錯）並登記 migration history；`booking-api` 已部署（使用者終端機 `npx.cmd`）。
- 正式站驗收：公開頁 fresh-reviewer GO；使用者登入實測陪工作卡片、模式、目標、規則顯示，COMP-001 2h=299、3h=449 PASS。
- 第四區名稱改「陪工作／工作空間」；會員中心第 4 張入口卡維持「我的詢價」。
- 管理員：小雨 `yu614321@gmail.com`、開發者備用帳號 `jane3201jane3201@gmail.com` 已寫入 `role_assignments`＝admin（首次登入自動套用；DB 讀回被安全機制擋，未讀回）。
- NOT RUN：會員取消／改期、後台改服務狀態（需有陪工作訂單）。
- ⚠️環境：PowerShell 執行原則擋 `npx.ps1`，請用 `npx.cmd`；git 需加 `-c safe.directory=*`。Claude 端 production deploy／DB 讀取會被 auto mode 安全機制擋，需使用者執行或授權。
- 下一個任務：後台「人員身分管理」（帳號備註、顧客服務類別、服務提供者提供哪些服務）＋網站招募資訊，作為媒合地基。草案已寫 `docs/PEOPLE_ROLES_MATCHING_PLAN_V1.md`，**暫停等使用者提供完整資訊**；已定案「只有 developer 可設 admin」。

## 2026-10-06 人力・合作・資源媒合 Phase 1 已上線（最新）

- 依使用者兩份計畫書（整合服務＋人力合作資源媒合）施工；Phase 0 盤點 `docs/PHASE0_SYSTEM_INVENTORY.md`、Phase 1 設計＋API 合約 `docs/PHASE1_MEMBER_ROLES_DESIGN.md`、規範草案 `docs/AGREEMENTS_DRAFT_V1.md`（§11 使用者決定）。舊草案 `PEOPLE_ROLES_MATCHING_PLAN_V1.md` 已被取代。
- 正式 `main`＝`db69bfb`；回滾 tag `rollback-people-p1-pre-20261006-1ab8f4f`（前端），舊版 booking-api 可從 `../meihau-companion-wt`（1ab8f4f）重新部署。
- 正式 DB：migration `20261006090000` 已套用（dry-run→套用→重跑 dry-run 無錯）並手動登記 schema_migrations；讀回 6 份規範 v1 active、PRV-MEIHAU active/approved、tags 27、members 3、orders 3。
- booking-api 新版已部署（CORS 含 PUT 實測）；Pages 成功，首頁 #join 與頁尾連結、console 0 error、390px 無溢位。
- fresh-reviewer 三輪：NO-GO（applied_at NULL）→ NO-GO（CORS 缺 PUT）→ GO-條件式；修正工單 `docs/PHASE1_FIX_ORDER_C/D/E.md`。
- ⚠️地雷：本資料夾 `supabase db push --linked` 會報 project ref not linked，**`db query --linked --project-ref tssvabclujwpljzupuvj --file` 才可用**；部署前必須先確認 migration 已套用（本次曾先部署函式導致短暫故障，已用舊版函式救回）。
- 暫存 SQL：`../p1_dryrun.sql`、`../p1_apply.sql`、`../p1_register_verify.sql`（未刪，待使用者決定）。
- ⚠️待使用者登入驗證：合作角色送出／規範勾選、後台審核、標籤、停權與復權、陪工作派單仍為 PRV-MEIHAU。
- 下一階段：Phase 2 整合服務計畫（服務分類擴充、service_tags、服務↔提供者上架管理）。

## 2026-10-07 Phase 1 正式站驗收＋前端修正上線

- 使用者登入、Claude 於 Chrome 驗收：角色送出／讀回、後台審核同步、加標籤、停權提示（使用者截圖）、恢復啟用皆 PASS。停權／恢復寫入被 auto mode 擋，由使用者操作。
- 前端修正工單 F～J（`docs/PHASE1_FIX_ORDER_F～J.md`）：規範 Markdown 安全渲染、標籤名稱、未申請徽章、後台欄位中文化、儲存可見回饋、「停權｜啟用」雙鍵開關、按鈕成功變綠；fresh-reviewer 皆 GO。正式 `main`＝`e58c8b6`，Pages 成功，正式站讀回確認。
- 測試資料：光言帳號保有 provider（PRV-B107BD1D，hidden／approved，「測試提供者（Claude 驗收用）」）與「設計師」標籤，待使用者決定是否停用。
- 已知（未修，可列 Phase 2）：admin-person 回傳 tags 為巢狀（前端已相容，下次部署後端時攤平）。

## 2026-10-07 蝦皮分潤輪播上線

- 安裝包 `C:\Users\User\Documents\Codex\分潤系統\網站輪播模組\通用主題式橫式分潤輪播_完整安裝包_合規過濾版_20261006.zip`（SHA256 核對一致）→ `assets/affiliate/` 三檔原樣；三頁頁尾前（member/admin 無 footer 則主內容末）各一個 `.affiliate-strip`，背景 rgba alpha 0.2。工單 `docs/AFFILIATE_INSTALL_ORDER_K.md`；fresh-reviewer GO。
- 正式 `main`＝`0a89326`；正式站讀回：首頁輪播 12 商品、背景 rgba(245,229,226,0.2)、位於 footer 前、無錯誤。
- 主題改 `data-theme="all"`（使用者定案：不限分類，只擋名稱含「蝦皮／Shopee」的商品，依銷量排序）；標題「莓好生活精選推薦」正確；廣告全部頁面（含後台）都要有。🔵 核心模組未驗證外部商品 URL 協定（資料源 collshp.com，風險低，升級安裝包時處理）。

## 2026-10-07 收工狀態（最新，換窗從這裡讀）

- 正式 `main`＝`1b3018f`（含本段），正式站／正式 DB／booking-api 三者一致，Phase 1＋前端修正＋分潤輪播全部上線並驗收。
- 下次優先：使用者說「開始 Phase 2」才開工（整合服務計畫：服務分類擴充、service_tags、服務↔提供者上架管理；順手攤平 admin-person tags）。
- 待使用者決定：①光言帳號測試 provider／「設計師」標籤保留或停用；②上層 `../p1_dryrun.sql`、`../p1_apply.sql`、`../p1_register_verify.sql` 是否刪除（紅線，需同意）；③棄用 worktree `../meihau-people-p1` 是否清理（紅線）。
- 使用者可自行操作：後台按一次「停權→啟用」雙鍵開關，確認視覺回饋。
- 工兵：指揮官模式，codex 直呼 `node .../codex-companion.mjs task --write`，工作目錄必須是本資料夾；codex 額度用完即暫停、不換工兵（使用者定案）。

## 2026-10-07 媒合服務補充計畫已排程（未施工）

- 已讀取 `C:\Users\User\Downloads\莓好預約站_媒合服務補充計畫書.docx`，並對照 Phase 1、目前 migration、booking-api 與三頁前端。
- 新修改計畫：`docs/PHASE2_MATCHING_SERVICE_SUPPLEMENT_PLAN.md`；切為身份提案／認證、公開媒合頁、雙方確認／問題回報、媒合輪播四個施工 Wave，分享頁正式美術另案。
- 本輪只新增規劃文件與本段交接摘要，未改程式、未部署、未 commit／push、未寫正式 DB。
- 既有鎖定仍有效：第一版附件只收網址、不開 Storage；補充計畫提到的文件上傳須使用者另行解鎖後才能施工。
- 下一步：先由使用者確認計畫 §9 五個決策，再製作 Wave 0 API 合約與逐工單驗收矩陣。

## 2026-10-07 媒合服務補充計畫 Phase 2 已施工並部署

- 已套用正式 migration `20261007120000_matching_service_phase2.sql`：11 張表、強制 RLS、前端角色無表權限、service_role 無 DELETE，正式讀回通過。
- 已部署 `booking-api`（保留 Gateway JWT）與獨立唯讀 `matching-public`；公開 200／400／404、會員無 token 401 正式 smoke 通過。
- 已完成身份提案／認證、公開媒合頁、媒合紀錄雙方確認、問題回報、獨立媒合輪播及後台審核 UI；首頁新增獨立媒合推薦區，不合併分潤輪播。
- 本機首頁與 `match.html` 於 320／390／768／1440px 無水平溢位；Playwright CLI 因 npm cache EPERM 改用 in-app browser。
- 待辦：提交並推送前端到 GitHub Pages、確認 workflow、跑正式匿名 Pages smoke。
- 登入後會員／後台完整流程 `NOT RUN`（客戶帳號紅線）；仍須 Claude Code fresh-context 最終驗收，Codex 自檢不算制度完成。

### 部署完成補記

- 功能 commit `10a3086` 已推至 `main`；GitHub Pages workflow `37599068131` success。
- 正式首頁、`match.html`、`platform.js`、`config.js` HTTP 200；正式瀏覽器公開 feed、console 0 error、無水平溢位、未登入導向皆 PASS。
- 目前只剩登入後會員／後台實際寫入流程與 Claude Code fresh-context 最終驗收。

## 2026-10-07 媒合公開頁美術 UI 已改造（待正式部署）

- 依使用者提供的個人版／廠商版 HTML 參考稿，修改 `match.html`、`platform.css`、`platform.js`；正式資料角色自動分流莓果色服務者版與紫色需求方版。
- 本機 1440px／390px：Hero、平台安全說明、推薦空狀態均正確；無水平溢位；console 0 warning／0 error；JS syntax、duplicate ID、diff check 通過。
- 模板只作視覺參考；未帶入假解鎖、假送出、Tailwind CDN、Tone.js、Font Awesome。API、DB、Auth、金流與分潤輪播未變動。
- 待辦：推 GitHub Pages、確認 workflow、正式匿名 smoke；有正式 published slug 後驗兩種角色檔案頁。登入後／客戶帳號流程仍 `NOT RUN`。
- 制度狀態：Codex 自檢，不是最終驗收；仍須 Claude Code fresh-context 七項複驗。

### 需求範圍修正（最新，以此為準）

- 使用者明確要求：參考模板只整合進公開會員社交檔案 `match.html?profile=<slug>`；不是重做 `match.html` 無 slug 的媒合入口。
- 已撤回入口宣傳 Hero、推薦卡與首頁 feed 改版；無 slug 頁已恢復原「平台媒合推薦」骨架。
- 保留個人／廠商資料版型、真實 API 角色分流、作品／公開連結、認證、受保護聯絡 CTA 與分享功能。
- 尚待正式 published profile 資料驗兩種角色畫面；不得建立假會員資料補測。
- 已部署：功能 commit `4bbdfc5`；GitHub Pages workflow `37643098038` success；正式無 slug 入口 smoke PASS。

## 2026-10-07 社交媒合導覽入口（待部署）

- `index.html` 桌機導覽、手機選單、頁尾快速導覽各新增「社交媒合」連到 `match.html`。
- 本機 1440px／390px：三處入口、既有導覽、無水平溢位與 console 均 PASS；API／DB／媒合頁內容未變。
- 下一步：提交推送、等待 Pages、正式站 smoke；仍須 fresh-context 最終驗收。
- 已部署：功能 commit `50a0abb`；正式站三處「社交媒合」入口讀回且桌機入口實際導向 `match.html`，1440px 無溢位、console 0 error。

## 2026-10-08 莓好圈正式命名（本機自檢通過、待部署）

- 最新使用者定案：平台入口／功能名稱＝「預約莓好圈」；會員個人編輯頁與公開分享頁＝「我的莓好圈」。
- `index.html`、`member.html`、`admin.html`、`match.html`、`platform.js` 已同步；返回首頁按鈕統一為「回到莓好預約站」。
- 現行技術路徑 `match.html?profile=<slug>` 不變，避免既有分享連結失效；`/circle/<slug>` 未施工。
- 本機 1440／390px 導覽、首頁入口、頁尾及實際導頁 PASS；會員／後台 DOM 標籤 PASS；無水平溢位、console 0 error，JS syntax／duplicate ID／diff check PASS。
- 下一步：提交並推送 main、等待 GitHub Pages、正式站匿名 smoke；真實 published profile 與登入後流程仍 `NOT RUN`，不得代操作會員帳號。
- 制度狀態：Codex 自檢，不是最終驗收；需 Claude Code fresh-context 七項複驗。
- 同輪追加：「切換帳號」可見文字統一為「登出」，既有本機 session 登出邏輯不變；本機標籤讀回 PASS，未代操作帳號點擊。
- 正式 workflow #46 後驗出共用 JS 快取仍顯示舊動態主文；四頁已統一引用 `platform.js?v=20261008-circle`，本機新版 DOM PASS，待再次部署正式驗收。
- workflow #47 後驗出無版本 `match.html` 入口仍可命中舊 HTML；首頁與動態莓好圈入口已同步加版本參數，本機從首頁實際點入 PASS，待最終 Pages 回讀。

## 2026-10-08 五大服務架構整合（進行中）

- 五大母分類已統一到 index.html、member.html、admin.html 與 platform.js；內部舊 category ID 保留相容。
- match.html 已加入首頁同款 sticky 導覽、五大分類按鈕、最新加入、平台推薦前十，以及「編輯我的莓好圈」直達入口。
- platform.js?v=20261008-services 為本輪快取版本；本機 1440／390px、console、JS syntax、duplicate ID、diff check 已 PASS。
- 目前待提交、推送、Pages workflow 與正式站匿名 smoke；真實排程卡片和登入後流程 NOT RUN；最終仍需 Claude Code fresh-context 驗收。
- 已部署：commit fa38b72，GitHub Pages run 37719183996 success；正式首頁與莓好圈 1440／390px、sticky、五大分類、兩組推薦區、快取版本、無溢位及 console 均 PASS。
- 尚待：真實排程卡片與登入後流程 NOT RUN；Claude Code fresh-context 最終驗收。

## 2026-10-08｜首頁資源＋會員後台重構（最新）

- 依「莓好預約站_會員後台完整重構工程計畫書.md」與「莓好預約站_首頁資源整合＋會員後台同步重構工程計畫書.md」同步施工。
- 已完成：首頁三路徑、五大服務、莓好資源、莓好預約圈動態分類／輪播／最新／人氣、我的莓好圈可見性與媒合設定、莓好追星圈、資源需求、後台資源 CRUD。
- 正式 Supabase：20261008120000 已套用；資源 11 筆；新增表強制 RLS；booking-api 與 matching-public 已部署。
- 驗證：公開 API、401 閘門、本機 1440／390px、搜尋與無水平溢位 PASS；既有會員沒有批次公開。
- 待完成：GitHub Pages 推送與正式匿名 smoke；登入後寫入、真實 Like／Follow、公開會員檔案 NOT RUN；Claude Code fresh-context 最終驗收待執行。
- 保護邊界：不改協作/骨架定案.md、金流、客戶帳號；不 stage supabase/.temp/、.recall/、LOGO/、output/、其他更換的美術UI/。

### 部署完成

- 功能 commit 74c8ac1；Pages workflow 37753753684 success；booking-api v14、matching-public v3。
- 正式首頁 1440px、莓好資源 390px、莓好預約圈 390px 匿名 smoke PASS，console 0 error、無水平溢位。
- 正式資源 11 筆、8 分類；公開莓好圈目前 0 筆，未批次公開既有會員。
- 登入後會員／後台寫入、真實 Like／Follow、公開會員檔案仍 NOT RUN；Claude Code fresh-context 最終驗收待執行。


## 2026-10-08｜會員首頁 UIUX 最終微調（最新）
- 依 `其他更換的美術UI/莓好預約站_會員首頁_UIUX最終修改計畫書.md` 與參考圖，已局部修改會員首頁：推薦莓好圈輪播 → 會員快速資訊 → 公告 → 五大服務 → 精選服務 → 使用說明。
- `member.html` 新增會員資料側欄入口並移除首頁常用地址卡；`platform.js` 串既有 discovery feed／services、搜尋與預約入口；`platform.css` 完成桌機與手機版。
- 本機自檢：JS syntax、duplicate ID、區塊順序、diff check、1536／390px mock、390px 無水平溢位、console 0 error、導覽切換 PASS。
- 範例人物／價格只用於 `C:\tmp\meihau-member-preview` 視覺 mock，正式來源不含假資料。
- 未 commit、push、deploy；登入後真實資料與 Claude Code fresh-context 最終驗收仍待執行。
## 2026-10-09｜官方團隊服務卡片（本機完成，待驗證）

- 依 `莓好預約站_官方團隊服務卡片建置規格_20261008.md` 鍵入 TEAM-001／TEAM-002、16 項官方服務、7 項課程價格選項與動態申請欄位；保留五大分類與既有 UI 版型。
- 新 migration：`supabase/migrations/20261008144330_official_partner_services.sql`；API 修改：`catalog.ts`、`member_core.ts`、`matching.ts`；前端修改集中於既有共用卡片與詢價流程。
- 本機 PASS：JS syntax、五頁 duplicate ID、diff check、seed 2／16／7、價格標籤回歸、骨架定案零 diff。
- ⚠️待驗證：無 Deno／Docker，本機 Supabase 54322 未啟動；migration、DB lint、登入後流程、正式部署、Claude Code fresh-context 皆 NOT RUN。
- 下一步必須先 fresh-context 驗 migration／API，再依 DB → booking-api＋matching-public → Pages 順序上線；不得先部署 Functions。
- 未 commit／push／deploy；未動金流、客戶帳號、正式 DB 或 `協作/骨架定案.md`。

## 2026-10-09 11:40｜目前狀態：會員首頁已部署
- origin/main：fbf7b5d（會員首頁 UI/UX）。
- Pages run 37880248703：success；正式 HTML/CSS/JS 已核對新版識別字。
- 其他官方團隊服務／後端／migration 改動仍僅在工作目錄，未隨本次部署提交。
- 下一步：Claude fresh-context 登入正式會員頁做最終視覺與互動驗收；使用者端強制重新整理。

### 2026-10-09｜官方團隊已正式上線
- migration `20261008144330` 已套用並登記 applied；正式 DB＝2 團隊、16 服務、7 價格選項、165 申請欄位、3 強制 RLS、0 個空描述。
- booking-api／matching-public 已部署；公開 feed＝official_partners 2、carousel 2，未登入 booking-api＝401。
- commit `51e7e73` 已推送 main；Pages workflow `37885094049` success；正式 HTML／JS／API 讀回新版。
- 右側 in-app browser 目標：`https://jikong0709.github.io/meihau-booking/match.html?v=51e7e73`。
- 尚待：使用者目視、登入後會員／Admin 寫入、Claude Code fresh-context 最終驗收；瀏覽器自動化 helper 因 Windows sandbox crash 未取得截圖。


## 2026-10-09｜官方服務卡片定價／報價／議價更新（最新，本機待驗證）

- 目前工作樹已完成 17 張個別官方服務卡模式；原本 2 張團隊卡不再作為輪播主體。
- 新 migration：supabase/migrations/20261009074823_official_service_quote_negotiation.sql；新增錄音室租借、價格有效期間、報價／議價開關、案件／留言／歷程／通知／團隊成員表。
- 新 API：supabase/functions/booking-api/lib/service_quotes.ts；會員僅讀自己的案件，官方團隊成員僅讀所屬團隊，admin／developer 可管理；接受正式報價後才可轉未付款預約。
- 前端沿用既有 member／admin／match 容器；一般詢價與預約仍保留；五頁資產版本改為 platform.js?v=20261009-official-services。
- 本機 PASS：JS 語法、Edge Function bundle、diff check、卡片行為契約、17 服務靜態數量、5 張新表強制 RLS。
- 尚未執行：正式 DB、Functions／Pages 部署、登入帳號與手機／桌機瀏覽器驗收；不得先部署 Function 再補 migration。
- 工作樹仍有使用者原有未追蹤／temp 項目；只處理本段列出的功能檔，不 stage supabase/.temp、.recall、LOGO、output、其他更換的美術UI。
- 下一步：Claude Code fresh-context 驗收後，按 migration dry-run／套用／讀回 → Functions → Pages → 登入驗收順序執行。


## 2026-10-09｜預約莓好圈服務展示頁改版已部署（最新）
- commit `866376d`（基底 f2e951b）；Pages run 37934775613 success；正式頁 `match.html?v=866376d`。
- 只改 match.html／platform.js／platform.css：莓好推薦（橫式名片卡，僅個別官方服務）→ 服務分類（9 個瀏覽分類，前端映射 service_id／category_id，不改資料）→ 完整服務列表（排序、卡片／列表）→ 既有最新加入／人氣推薦。
- 未動 Function、migration、DB、價格、登入、會員、訂單、後台；報價／議價按鈕依各服務 allow_quote／allow_negotiation 分開顯示（正式資料目前全為關閉）。
- 待確認：9 個分類為顯示用映射，與骨架定案「五大第一層分類」並存，未修改骨架定案；查看詳情／申請／報價／議價均導向 member.html 個別服務深連結（service_action 參數既有但 member 端尚未自動開啟，需登入後驗）。

### 2026-10-09｜預約莓好圈分類改為五大分類＋子分類下拉（commit 6fc76ef，Pages run 37943233008 success）
- 分類按鈕＝五大正式分類（莓你不可／莓好聲音／莓好基地／莓好學習／莓好數位）＋全部服務；子分類下拉＝該分類下已登記的服務項目，未選＝該分類全部。推薦輪播每 5 秒自動前進（滑過／觸控暫停）。取代先前 9 個顯示用分類。

### 2026-10-10｜子分類下拉改為列出全部已登記項目（commit 1add8e8，Pages run 37963239402 success）
- 下拉＝公開 feed 的官方服務＋`SERVICE_SUBCATEGORY_REGISTRY`（platform.js，取自 migration 種子中 active／coming_soon 項目）；沒有公開服務卡的項目選取後顯示「暫時服務內容」。
- 缺口：公開 API 沒有完整服務目錄、本輪無法讀正式 DB（MCP 無權限），登記表為前端靜態副本；後台新增服務項目時需同步更新此表，或另案讓 matching-public 回傳完整目錄。

### 2026-10-10｜官方團隊展示頁＋服務卡操作調整（commit 6e95130，Pages run 37964505564 success）
- 推薦卡「查看詳情」→ `match.html?team=<team_id>` 官方團隊莓好圈展示頁（前端依公開 feed 組成：團隊名、官方合作、該團隊全部服務卡）。
- 完整服務卡整張可點（標題 stretched link）→ member.html 個別服務頁；底部按鈕：報價（allow_quote）、議價（allow_negotiation）、詢價（一律顯示）。
- 缺口：官方團隊目前無獨立簡介／社群欄位（feed 未回傳 team_description），展示頁僅顯示名稱、Logo、服務；`service_action=inquiry` 與 quote／negotiation 同樣尚未被 member 端自動消化。

### 2026-10-10｜五色分類＋報價／詢價路徑補齊（本次部署）
- 五色寫入骨架定案並套用 platform.css（match／member／admin）。
- 報價／詢價：未登入點服務卡→登入→還原原服務與操作（localStorage meihau_pending_return，30 分鐘）；member 端消化 service_action（inquiry／quote／negotiation）並顯示提示、聚焦需求欄；報價在 allow_quote 關閉時引導走一般詢價。
- NOT RUN：登入後實際送出詢價／報價與後台回覆（不得操作客戶帳號）。已知缺口：報價案件通知（quote-notifications）API 已有但前端無通知顯示；官方團隊成員（非 admin）尚無專屬後台入口。

### 2026-10-10｜案件通知前端補齊（本次部署）
- 會員「我的詢價」與後台「詢價管理」新增案件通知清單、未讀徽章、標示已讀（讀 quote-notifications API，60 秒更新）；以 mock api 驗證渲染／已讀流程。
- 未完成：官方團隊成員（非 admin）專屬案件入口。需後端新增團隊案件列表／報價 API（現有 admin-quote-cases 僅限 admin、developer）並重新部署 Function；本環境無 Supabase CLI／MCP 權限，無法部署，待使用者授權部署途徑後再做。
