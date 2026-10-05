# Phase 0｜現有系統盤點（唯讀）

- 盤點基準：branch main @1ab8f4f；日期 2026-10-05。
- 範圍：只讀現有程式與 migration 檔；未連正式 DB、未部署、未改任何檔。
- 依據標示：`檔案:行號`。DB 實際現況（正式環境）未直接讀取，只依 migration 檔推定，標【需查證】。
- 名詞：RLS＝Row Level Security，資料庫列級權限；service role＝Edge Function 內使用的最高權限金鑰，可繞過 RLS。

---

## 1. 頁面清單與導向邏輯

### 1.1 頁面一覽

| 頁面 | 檔案 | 功能 | 依據 |
|---|---|---|---|
| 公開首頁 | `index.html`（`data-page="public"`） | Hero、四大服務、品牌故事、價目、流程、安心承諾、CTA；登入按鈕 | index.html:16、40-131 |
| 會員中心 | `member.html`（`data-page="member"`） | 6 個區塊：首頁、預約服務、我的預約、我的詢價、我的資料、常用地址 | member.html:17、37/87/167/176/182/216 |
| 後台 | `admin.html`（`data-page="admin"`） | 6 個工作區（見第 4 節） | admin.html:15、21-26 |
| 舊版前端腳本 | `app.js` | 舊式預約表單，POST 到 `booking-submit`；**沒有任何 HTML 引用它**（孤兒檔） | app.js:69,255；grep `app.js` 於 *.html 無結果 |

- 三頁都載入 `config.js` + `platform.js`（index.html:13-14、member.html:12-13、admin.html:12-13）。
- 頁面種類由 `<body data-page>` 決定，`platform.js:473-478` 的 DOMContentLoaded 依 `cfg.mode === "production"` 分派 `initProduction*` 或離線示範 `init*`。
- 正式設定 `config.js:1-6`：mode=production、apiBase=booking-api、runtimeConfigUrl、redirectUrl=member.html。
- 前端 Supabase client 由 runtime-config 動態取得 URL 與 anon key（platform.js:113-123），再 `import` esm.sh 的 supabase-js；登入用 Google OAuth（platform.js:165）。
- 前端不直接讀寫資料表；全部經 `api()` 呼叫 booking-api（platform.js:124-136）。

### 1.2 路由／導向邏輯（依 me.role）

- 角色判斷：`privilegedRoles = {admin, developer}`（platform.js:137）；`destinationForMember`：特權角色 → `admin.html`，其餘 → `member.html`（platform.js:139）。
- 公開首頁：有 session 時呼叫 `api("me")`（platform.js:145），按鈕文字依角色顯示「進入開發者後台／進入管理後台／進入會員中心」（platform.js:147），點擊導向 `destinationForMember`（platform.js:161-162）；無 session 則 Google OAuth（platform.js:165）。
- 未登入進 member/admin：`requireSession()` 導回 `index.html?login=required`（platform.js:170-175）。
- 會員中心：特權角色預設被導向 `admin.html`，除非網址帶 `?mode=member`（platform.js:199-202）；後台側欄「會員前台」連結即帶此參數（admin.html:28）。
- 後台守門（前端）：`me.role` 非 admin/developer 時顯示「此帳號沒有管理員權限」並中止（platform.js:386）。這只是 UI 層，真正權限在 API（第 3 節）。
- 後台工作區切換：靠 `data-admin-view` + URL hash（platform.js:398-408）；`data-developer-only` 區塊對 admin 隱藏（platform.js:396-407）——**僅前端隱藏，沒有 developer 專屬 API**（見第 3 節）。
- 切換帳號：只做 `signOut({scope:"local"})` 後導回 `index.html?login=1`（platform.js:176-188）。
- 沒有 recruit／provider／partner 之類頁面或路由；新頁面需自行新增並同步加入 `cfg`／導向規則。

---

## 2. 資料表盤點（schema `booking`，共 14 張）

### 2.0 共通事項

- schema 建立後 `revoke all ... from public, anon, authenticated`，只給 service_role（20260923153000:3-4）。
- 所有表皆 `enable + force row level security`。
- 預設只有 service_role 可存取（migration 20260924015611:55-67）。
- 例外：服務目錄類 7 張表另開 `authenticated` 的 select policy（見各表）。
  - 同時 `grant usage on schema booking to authenticated`（20260930055848:87）。
  - 這代表只要 `booking` schema 被 PostgREST 公開，登入者可直接讀取（見第 7 節風險 R5）。【需查證 exposed schemas 設定】
- 前端目前不使用 supabase client 直接查表，全走 Edge Function（platform.js:124-136）。

### 2.1 members（會員，核心）

- 來源：20260924015611:1-11；+full_name 20260924025532:1-2；role 約束 20261001004622:1-6。
- **主鍵：`user_id uuid`**，FK → `auth.users(id)` on delete cascade。**沒有 `id` 欄位**。
- 欄位：
  - `email text not null`
  - `name text default ''`
  - `phone text default ''`
  - `line_id text default ''`
  - `contact_email text default ''`
  - `role text not null default 'member'`
  - `full_name text default ''`
  - `created_at`、`updated_at timestamptz`
- check：`role in ('member','admin','developer')`（20261001004622:4-6）。
- 觸發器：`members_apply_role_assignment`（before insert／update of email），依 email 查 `role_assignments` 覆寫 `new.role`（20261001004622:23-50）。
- RLS：force RLS，**無任何 policy**，`revoke all` from authenticated，僅 service_role 可 CRUD（20260924015611:55-66）。
- 建立時機：任何 API 呼叫都會 upsert 一筆（`ignoreDuplicates`）再讀回，所以「登入過 API 一次就有會員列」（booking-api/index.ts:126-129）。
- 外洩點：`me` 動作回傳 `members.select("*")` 整列（index.ts:128,131），`profile` PATCH 也回整列（index.ts:132）。**之後在 members 加內部欄位（如 admin_note）會直接回傳給會員本人**。

### 2.2 role_assignments（系統權限預設表）

- 來源：20261001004622:8-21。
- **主鍵：`email text`**（小寫去空白，check `email = lower(btrim(email))` 且長度 3-320）。
- 欄位：`role text not null check (role in ('admin','developer'))`、`created_at`、`updated_at`。
- 無 FK。RLS：force RLS，無 policy，僅 service_role。
- 注意：trigger 只在 members 的 insert／update of email 時套用（20261001004622:47-50）。**事後改 role_assignments 不會自動更新已存在的 members.role**（_SESSION_CONTEXT.md 記載「role_assignments＋members 同步」是手動做）。
- **沒有任何 API 可改這張表或 members.role**（index.ts 全檔無寫 role 的動作）；升降權目前只能由 DB 直接執行。

### 2.3 addresses（常用地址）

- 來源：20260924015611:13-26；+address_type 20260924025532:4-12。
- **主鍵 `id uuid`**；`user_id uuid not null` FK → `members(user_id)` on delete cascade。
- 欄位：`label`（1-80）、`recipient`、`phone`、`address`（3-300）、`note`（≤500）、`is_default boolean`、`address_type`（check `home/company/other`）、時間戳。
- RLS：force RLS，無 policy，僅 service_role。API 以 `user_id` 篩選（index.ts:133-135）。

### 2.4 orders（訂單）

- 來源：20260924015611:28-45；+service_id 20260930055848:72；+provider_id、booking_details 20261005120000:110-112。
- **主鍵 `id uuid`**；`order_no text unique`（格式 `MH`+時間+4 碼，index.ts:156）。
- FK：`user_id` → `members(user_id)`（無 cascade）；`service_id text` → `services(service_id)`；`provider_id text` → `providers(provider_id)`。
- 欄位：
  - `category`
  - `booking_date date`、`booking_time time`（皆可 null）
  - `note`（≤2000）
  - `total_amount integer`（0–1,000,000）
  - `payment_status`
  - `service_status`
  - `quote_payload jsonb not null`
  - `booking_details jsonb default {}`
  - 時間戳
- check：
  - `category in ('rental','errand','temporary_staff','recording_space','ai_digital','venue_equipment')`（20260930055848:73-75）
  - `payment_status in ('UNPAID','PENDING','PARTIAL','PAID','REFUND_PENDING','REFUNDED','FAILED')`
  - `service_status in ('DRAFT','WAITING_PAYMENT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')`
- 索引：`(user_id, created_at desc)`、`(booking_date, booking_time, category)`。
- RLS：force RLS，無 policy，僅 service_role。

### 2.5 order_items（訂單明細）

- 來源：20260924015611:47-53。
- **主鍵 `id bigint generated always as identity`**（不是 uuid）；`order_id uuid` FK → orders(id) on delete cascade。
- 欄位：`label text`、`amount integer`（0–1,000,000）、`created_at`。
- RLS：force RLS，無 policy，僅 service_role。

### 2.6 services（服務目錄；已被 migration 0930 建立、1005 擴充）

- 來源：20260930055848:3-22；+8 欄 20261005120000:3-36。
- **主鍵 `service_id text`**（例如 `REC-001`、`COMP-001`、舊資料 `cowork-2h`；非 uuid）。
- 欄位：
  - `category_id`、`service_name`（1-120）、`short_description`（≤500）、`full_description`（≤4000）
  - `cover_image text`、`price integer`、`price_type`、`booking_type`
  - `duration text`、`location text`、`service_status`、`is_featured`、`sort_order`、時間戳
  - 陪工作擴充：`service_type`、`price_unit`、`included_hours`、`min_hours`、`additional_hour_price`、`deposit`、`companion_modes text[]`、`requires_provider boolean`
- check：
  - `category_id in ('temporary_staff','recording_space','ai_digital','venue_equipment')`
  - `price_type in ('fixed','starting_from','custom_quote')`
  - `booking_type in ('direct_booking','custom_quote')`
  - `service_status in ('draft','coming_soon','active','paused','custom','hidden','archived')`
  - 表級：`price_type='custom_quote' or price is not null`；`booking_type<>'custom_quote' or price_type in ('starting_from','custom_quote')`
  - `service_type in ('recording','ai_digital','staff','space','companion')`（可 null）
  - `price_unit in ('session','hour','half_day','day','project')`
  - 小時欄位範圍 1–12、金額 0–1,000,000
  - `companion_modes <@ {quiet,low_interaction,together,body_doubling}`
- 索引：`(service_status, category_id, sort_order, service_id)`。
- RLS：policy「members read available services」：authenticated 可讀 `active/coming_soon`（20260930055848:92-95）；grant select to authenticated（:88）；service_role 全權。
- 資料量（migration 內）：38 列規格資料（見 _SESSION_CONTEXT.md「陪工作 P0」）；舊 ID 以改名搬移（MAN-004→MAN-007、SPACE-006→SPACE-008、SPACE-007→SPACE-009，20261005120000:115-150）。
- 分類只有 4 個固定 category_id，且「陪工作」放在 `venue_equipment`（20261005120000:219-226；platform.js:261、451）；舊 check 禁止新增分類值。

### 2.7 service_options（服務選項）

- 來源：20260930055848:27-38。
- **主鍵 `option_id text`**；`service_id text` FK → services(service_id) on update cascade。
- 欄位：`option_name`（1-120）、`status in ('active','hidden','archived')`、`sort_order`、時間戳。
- RLS：authenticated 可讀 status=active 且所屬服務 active（:97-107）。

### 2.8 service_addons（加購）

- 來源：20260930055848:40-50。
- **主鍵 `addon_id text`**；欄位：`addon_name`、`addon_price integer null`、`addon_description`（≤1000）、`available_for text[]`、`status in ('draft','active','hidden','archived')`、`sort_order`、時間戳。
- 無 FK 到 services（以標籤陣列比對，index.ts:84-91）。
- RLS：authenticated 可讀 status=active（:109-112）。

### 2.9 service_inquiries（客製詢價）

- 來源：20260930055848:52-70。
- **主鍵 `id uuid`**；`user_id uuid` FK → members(user_id)；`service_id text` FK → services(service_id)。
- 欄位：`service_name`（快照）、`preferred_date`、`preferred_time`、`requirements`（3-4000）、`additional_notes`（≤2000）、`status`、`quoted_amount`（0–1,000,000）、時間戳。
- check：`status in ('pending','reviewing','quoted','accepted','closed')`。
- 索引：`(user_id, created_at desc)`、`(status, created_at desc)`。
- RLS：authenticated 可 select 自己的、insert 自己且 `status='pending' and quoted_amount is null`（:114-126）；grant `select, insert`（:89）。後台更新走 service_role。

### 2.10 providers（服務提供者）

- 來源：20261005120000:38-46。
- **主鍵 `provider_id text`**（目前唯一資料 `PRV-MEIHAU`，20261005120000:249-256）。
- 欄位：`display_name`（1-120）、`provider_type in ('person','team')`、`bio`（≤2000）、`status in ('active','paused','hidden','archived')`、時間戳。
- **沒有任何會員連結欄位**（無 `user_id`／`member_id`）。無作品集、無標籤、無審核狀態（status 沒有 pending）。
- RLS：authenticated 可讀 status=active（:88-91）。

### 2.11 service_providers（服務×提供者，多對多）

- 來源：20261005120000:48-56。
- **複合主鍵 `(service_id text, provider_id text)`**，兩者皆 FK、on update cascade。
- 欄位：`status in ('active','paused','hidden','archived')`、`sort_order`、時間戳。索引 `(service_id, status, sort_order)`。
- RLS：authenticated 可讀（status=active 且 provider active 且 service active/coming_soon，:93-100）。
- 現況資料：所有 `service_type='companion'` 服務都掛 `PRV-MEIHAU`（:258-265）。

### 2.12 service_packages（服務套餐）

- 來源：20261005120000:58-70。
- **主鍵 `package_id text`**；`service_id text` FK → services。
- 欄位：`package_name`、`price integer`（0–1,000,000）、`session_count`、`included_hours`（≤1000）、`billing_period in ('once','month')`、`status in ('active','hidden','archived')` 預設 hidden、`sort_order`、時間戳。
- 現況：4 筆 COMP-001 套餐全為 hidden（:267-274）；**API 與前端都沒讀它**（index.ts 無 service_packages 字樣）。
- RLS：authenticated 可讀 active 且服務 active（:102-108）。

### 2.13 requests（舊版預約需求）

- 來源：20260923153000:6-24。
- **主鍵 `id uuid`**；`service_type in ('cowork','recording','studio','makeup','errand')`、`service_plan`、`requested_date`、`requested_time`、`customer_name`、`contact`、`note`、`estimate_amount`、`status in ('pending','confirmed','cancelled','completed')`、`source`、`metadata jsonb`。
- 無 FK 到 members。RLS force，無 policy；僅 SECURITY DEFINER 函式 `booking.submit_request` 寫入（:45-93）。
- 僅 `booking-submit` Edge Function 使用（booking-submit/index.ts:70）；目前沒有頁面載入 `app.js`，等同停用。

### 2.14 submission_limits（舊版限流）

- 來源：20260923153000:27-33。
- **主鍵 `id bigint identity`**；`fingerprint text`、`created_at`。索引 `(fingerprint, created_at desc)`。
- RLS force，無 policy；供 `submit_request` 限流（10 分鐘 5 次，:75-79）。

### 2.15 函式／觸發器

- `booking.submit_request(jsonb,text)`：SECURITY DEFINER，僅 service_role 可執行（20260923153000:45-93）。
- `public.submit_meihau_booking_request`：包裝呼叫（:95-103）。
- `booking.apply_member_role_assignment()` + trigger `members_apply_role_assignment`（20261001004622:23-50）。
- Storage／bucket：migrations 與程式碼完全沒有（grep `storage` 僅命中 DEPLOYMENT_HANDOFF 的「localStorage」字樣）。

---

## 3. booking-api（`supabase/functions/booking-api/index.ts`）

### 3.1 權限檢查實作

1. **JWT 驗證**：`supabase/config.toml` 設 `[functions.booking-api] verify_jwt = true`；程式內再次取 Bearer token，缺少回 401（index.ts:122-123）。
2. **取得使用者**：`db.auth.getUser(token)`，失敗回 401（index.ts:124）。`db` 為 service role client（index.ts:119-120），**所有查詢都繞過 RLS**，隔離完全靠程式內條件。
3. **會員列**：每次請求先 upsert `members`，再讀整列放入 `member`（index.ts:126-129）。
4. **會員資料隔離**：各動作自行加 `.eq("user_id", user.id)`（addresses index.ts:133-135；orders :152、:187-190、:199-202；inquiries :207）。
5. **後台權限**：所有 `action.startsWith("admin-")` 統一關卡 `["admin","developer"].includes(member?.role)`，否則 403（index.ts:221-222）。**只有這一道，沒有 developer 專屬的 API**。
6. **CORS／Origin**：白名單 `origins`（index.ts:3）與 `cors()`（:39-42）；非白名單 Origin 回 403（:118）。
7. 路由方式：不是 REST path，而是 `?action=<名稱>` + HTTP method（index.ts:121）；未匹配回 404（:254）。
8. 輸入處理：每個動作自行 `String(...).slice(n)` 截長度，無共用驗證框架。

### 3.2 action 清單（共 12 個 action 名稱、17 條路由，另 `me` 1 條，合計 18 條 action×method）

| action | 方法 | 權限 | 讀寫的表 | 行號 |
|---|---|---|---|---|
| me | GET/任意 | member（任何登入者） | 讀 members（含自動 upsert） | 131 |
| profile | PATCH | member（自己） | 寫 members（name/full_name/phone/line_id/contact_email/updated_at） | 132 |
| addresses | GET | member | 讀 addresses | 133 |
| addresses | POST | member | 寫 addresses（address_type 白名單 home/company/other） | 134 |
| addresses | DELETE | member | 刪 addresses（限本人） | 135 |
| services | GET | member | 讀 services（active/coming_soon）、service_options、service_addons | 136-144 |
| quote | POST | member | 讀 services、service_addons、service_options（不寫入；金額由後端算） | 145-151、buildQuote 58-114 |
| orders | GET | member | 讀 orders + order_items（限本人） | 152 |
| orders | POST | member | 讀 services/addons/options/service_providers；寫 orders、order_items | 153-183 |
| order-cancel | POST | member | 寫 orders（限本人且 UNPAID、WAITING_PAYMENT/DRAFT → CANCELLED） | 184-193 |
| order-reschedule | PATCH | member | 寫 orders（改 booking_date/time，限同條件） | 194-205 |
| inquiries | GET | member | 讀 service_inquiries（限本人） | 206-209 |
| inquiries | POST | member | 讀 services；寫 service_inquiries（只允許 booking_type=custom_quote 的 active 服務） | 210-220 |
| admin-orders | GET | admin／developer | 讀 orders + members(name,email) + order_items | 223-226 |
| admin-orders | PATCH | admin／developer | 寫 orders.service_status（CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED） | 227-233 |
| admin-services | GET | admin／developer | 讀 services 全部 | 234-237 |
| admin-inquiries | GET | admin／developer | 讀 service_inquiries + members(name,full_name,email) | 238-241 |
| admin-inquiries | PATCH | admin／developer | 寫 service_inquiries（status、quoted_amount） | 242-252 |

重點觀察：

- **不存在的動作**：沒有 admin-members、admin-services 的寫入、providers／service_providers／service_packages 的任何讀寫（除 orders POST 內挑 provider）、角色變更、標籤、規範同意、Storage。`config.example.js:15-18` 列的 `adminMembers`、`adminPayments` 等是舊示範設定，API 並未實作。
- orders POST 指派提供者：取 `service_providers` 中該服務 `status=active` 依 `sort_order` 的**第一筆**（index.ts:166-172）；`requires_provider=true` 才查。
- orders POST 的 `booking_date/time` 直接寫入，未驗證格式（index.ts:173），與 order-reschedule 的正規式驗證不同（:198）。
- 金額：全部由伺服器 `buildQuote` 計算（前端不能傳價），價格相關規則見 index.ts:58-114。
- 付款欄位：POST orders 不設 payment_status，走 DB 預設 `UNPAID`。

### 3.3 其他 Edge Functions

| 函式 | 驗證 | 用途 | 依據 |
|---|---|---|---|
| booking-submit | `verify_jwt=false`（config.toml） | 舊版匿名預約需求，呼叫 RPC `submit_meihau_booking_request`，雜湊 IP 限流；origin 白名單含 localhost:8000（非 8080） | booking-submit/index.ts:3-7、56-73 |
| runtime-config | `verify_jwt=false` | 回傳 `SUPABASE_URL` 與 `SUPABASE_ANON_KEY` 供前端建 client | runtime-config/index.ts:15-18 |

---

## 4. 後台工作區與會員中心區塊

### 4.1 後台（admin.html）

| 工作區 `data-admin-view` | 內容 | 資料來源 | 依據 |
|---|---|---|---|
| overview 總覽 | 統計卡（今日預約、待處理詢價、未付款、今日已收）、快速入口、狀態辨識 | admin-orders、admin-inquiries | admin.html:33-38；platform.js:409-421 |
| operations 預約營運 | 月曆（calendarSection）、每日排程（daySection）、收款管理（payments） | admin-orders；可改 service_status | admin.html:39-41；platform.js:434-449 |
| inquiries 詢價管理 | 詢價列表、改狀態、填報價 | admin-inquiries GET/PATCH | admin.html:42；platform.js:462 |
| members 會員 | **佔位頁**：搜尋與狀態欄位未串接（頁面自述） | 無 API | admin.html:43 |
| services 服務資料 | 服務唯讀表（ID、分類、價格、流程、狀態／排序） | admin-services GET | admin.html:44；platform.js:451-454 |
| system 系統狀態（僅 developer 顯示） | 角色、服務數量、API 狀態 | 前端組字，無專用 API | admin.html:45；platform.js:416-421 |

- 陪工作新增部分：服務資料表的分類標籤把 `venue_equipment` 顯示為「陪工作／工作空間」（platform.js:451）；訂單明細顯示陪伴模式／目標（platform.js:215、222）。**後台沒有「服務狀態」寫入 API**（`_SESSION_CONTEXT.md` 寫 Admin 服務狀態，但 index.ts 只有 admin-services GET，需查證是否為訂單 service_status）。
- 側欄頁尾：會員前台、公開網站、切換帳號（admin.html:28）。事件彈窗 `#eventModal`（admin.html:48）。

### 4.2 會員中心（member.html）

| 區塊 `data-section` | 功能 | API |
|---|---|---|
| home | 統計（我的預約、待付款、常用地址）、快速開始入口卡（第 4 張為我的詢價） | orders、addresses |
| book | 服務分類選單、服務卡、選項／加購、陪工作欄位（時數、模式、目標）、詢價欄位、報價與送出 | services、quote、orders POST、inquiries POST |
| orders | 我的預約、改期、取消 | orders、order-reschedule、order-cancel |
| inquiries | 我的詢價 | inquiries GET |
| profile | 基本資料表單 | me、profile PATCH |
| addresses | 常用地址 CRUD | addresses GET/POST/DELETE |

- 依據：member.html:37-267；platform.js:190-382。
- 頁尾提示「正式付款功能尚未啟用」（member.html:33-35）。

---

## 5. 付款／綠界現況（僅描述）

- **沒有任何綠界程式碼**：grep ecpay／綠界／MerchantTradeNo 於 *.js／*.ts／*.sql／*.html 無命中（僅 docs/DEPLOYMENT_HANDOFF.md 規劃文字：:149-150、:213-225）。
- booking-api 無 checkout、無 webhook／ReturnURL 路由（見 3.2）。
- DB 只有「狀態欄位」：`orders.payment_status`（UNPAID/PENDING/PARTIAL/PAID/REFUND_PENDING/REFUNDED/FAILED）與 `service_status`（20260924015611:37-38）。建單後固定為 `UNPAID`／`WAITING_PAYMENT`（DB 預設）。
- 前端「立即預約」按鈕只建立訂單，不跳付款（platform.js:364-377）；`config.example.js:13` 的 `checkout` 是空字串的舊示範設定。
- 後台收款管理僅依 `payment_status` 顯示與篩選，沒有收款寫入動作（platform.js:422-423、449-450）。
- 離線示範的 `app.js`／`initMember` 內有一個示範按鈕 alert「預留給建立訂單 → 綠界付款 API」（platform.js:77-79），production 不使用。
- 結論：金流屬紅線，未實作、本次也不動；`transactions`、`payouts` 為全新表，不可與 `orders.payment_status` 混成同一套。

---

## 6. 對照新計畫：保留／擴充／新增／不能重建

對照依據：完整計畫「二十一、建議資料表」（Downloads/…完整計畫_V1.md:793-815）與工程師指令 §2、§9、§22、§26（…開發指令…_V1.md:38-58、275-292、646-669、732-766）。

| 項目 | 保留（照用） | 擴充（加欄位／加值） | 新增 | 不能重建／不能混用 |
|---|---|---|---|---|
| 會員核心 `members` | 保留為唯一會員表；主鍵 `user_id uuid`、trigger、`me`/`profile` API | 可加 `status`、顯示用欄位等；**內部欄位（備註等）不能放 members**，否則 `me` 會整列回傳（index.ts:128,131-132），須先改 `me` 為白名單欄位 | — | **不能新建第二張 members**；新表 FK 一律指 `members(user_id)`，不是 `members.id`（不存在） |
| 系統權限 `members.role` | 保留 `member/admin/developer` 與 index.ts:222 關卡、platform.js:137 導向 | 若需 staff 等系統角色，須同步改 check（20261001004622:4-6）、index.ts:222、platform.js:137 三處 | — | **不能把 provider/partner/resource_seeker 塞進 `members.role`**（工程師指令 §2:38-58）；也不能與 `role_assignments`（email→系統權限）混用 |
| 平台合作角色 | — | — | **新增 `member_roles`**（member_id uuid → members.user_id，role_type、status、審核欄位；一人多列） | 不得複用 `role_assignments`（主鍵是 email、check 僅 admin/developer，20261001004622:10） |
| `providers` | 保留表與 `PRV-MEIHAU` 資料、orders.provider_id FK（20261005120000:110-111） | **加 `member_id uuid null` FK → members(user_id)**（現無會員連結，見 2.10）；status 需加 `pending`/審核流（現只有 active/paused/hidden/archived）；加 profile／portfolio 欄位或另表 | `provider_profiles`／作品集表（若不想肥大 providers） | **不重建 providers**；主鍵維持 `provider_id text`，新表 FK 用 text |
| `service_providers` | 保留（複合主鍵 text×text，多對多已符合計畫「不要把 provider_id 塞進 services」） | 可加 `source`、審核欄位；**注意 orders POST 取第一筆 active provider**（index.ts:169），新增大量 provider 後行為會變，需先定指派規則 | — | 不重建 |
| `services` | 保留；`service_id text` 主鍵、`requires_provider`、status 機制 | `category_id` 僅 4 值 check（20260930055848:5），若新計畫要新分類須改 check 或改以 tags 表達 | **`service_tags`**：`service_id text` FK → services（**不是 uuid**）、`tag_id` | 不重建；不可假設 service id 為 uuid |
| `service_packages` | 保留（目前全 hidden、API 未讀） | 之後做套餐時再接 API | — | 不重建 |
| `service_inquiries` | 保留；與新「案件 projects」並存 | 可加 `project_id`（日後） | — | **不要直接當 `projects`／媒合案件用**：它是會員→店家的詢價，狀態機不同（pending…closed）、FK 綁 service_id not null（20260930055848:55） |
| `orders` / `order_items` | 保留（金流相關，紅線） | — | `transactions`、`payouts`（Phase 5） | **不能重建**；`projects`／`project_matches` 不要借用 orders 表 |
| `addresses` | 保留 | — | — | — |
| 標籤 | — | — | `tags`、`member_tags`、`service_tags`（id 型別需先定案：tag 用 uuid 或 text slug；member_tags.member_id uuid；service_tags.service_id text） | `addons.available_for text[]`（20260930055848:45）是舊的陣列式標籤，與新 tags 並存，勿混用 |
| 規範同意 | — | — | `agreements`、`member_agreements`（含版本與同意時間） | — |
| 案件／媒合／合作／資源／招募 | — | — | `projects`、`project_requirements`、`project_matches`、`partnerships`、`resource_requests`、`recruitment_positions`、`recruitment_applications` | 計畫 PEOPLE_ROLES 草案的 `provider_applications` 與計畫 `recruitment_applications` 重複，需先決定用哪個名稱（docs/PEOPLE_ROLES_MATCHING_PLAN_V1.md:30、計畫 :807-808） |
| 後台 API／UI | admin- 前綴關卡（index.ts:221-222）、六工作區殼、`members` 佔位頁 | 把 members 佔位頁（admin.html:43）做成實際審核頁 | 新 admin-* actions（目前 0 個管理會員的 API） | 不另開第二套後端；沿用 booking-api 單一入口 |
| 檔案上傳（作品集） | — | — | Storage bucket＋policy（現完全沒有） | — |
| 計畫權限 §22 對照 | `developer` ≈ `super_admin`；`admin`＝`admin`；`member`＝`member` | `staff` 需新增系統角色（見上） | provider／partner 屬平台合作角色，放 `member_roles` | **provider 不得因此取得後台權限**（工程師指令 §22:661-667） |

最重要的 5 條結論（供回報引用）：

1. members 擴充不重建；主鍵是 `user_id uuid`，新表 FK 都指這個。
2. `members.role`（developer/admin/member）只代表系統權限，平台合作角色另建 `member_roles`，且不可借用 `role_assignments`。
3. `providers` 沒有會員連結欄位，需加 `member_id`＋審核狀態；`service_providers` 多對多可直接沿用。
4. `services.service_id` 是 text，`service_tags.service_id` 必須 text；providers/packages 也是 text，members 才是 uuid——型別混用要小心。
5. 加內部欄位前必須先收斂 `me`/`profile` 的 `select("*")` 回傳，否則會洩漏給會員本人。

---

## 7. 風險與地雷

| # | 風險／地雷 | 依據 |
|---|---|---|
| R1 | 部署只能由使用者在終端機以 `npx.cmd supabase ...` 執行（PowerShell 執行原則擋 `npx.ps1`）；Claude 端 auto mode 會擋 functions deploy、migration repair、正式 DB 讀取 | _SESSION_CONTEXT.md 最後兩段；協作/除錯紀錄.md:60-67 |
| R2 | git 必須加 `-c safe.directory=*`（`.git` 擁有者為 CodexSandboxOnline） | 協作/除錯紀錄.md:62-66 |
| R3 | 部署成功判定要看到 `Deployed Functions on project ...`，只看 `Uploading asset` 不算 | 協作/除錯紀錄.md:67 |
| R4 | 派工單必須明寫「禁止修改 `協作/骨架定案.md`」，Codex 曾擅自追加鎖定段落 | 協作/除錯紀錄.md:73 |
| R5 | `authenticated` 對 services/options/addons/providers/service_providers/service_packages 有 select grant、inquiries 有 insert grant；若 `booking` schema 在 PostgREST 公開，登入者可繞過 Edge Function 直連。【需查證 exposed schemas】；新表不要照抄這個模式，預設只給 service_role | 20260930055848:86-90；20261005120000:84-86 |
| R6 | Storage 目前沒有 bucket、policy、上傳 API；作品集上傳需全新建立（含大小／MIME 限制、公開或簽名網址策略）；bucket 建立也屬 DB／部署操作，需使用者執行 | grep `storage` 無命中；index.ts 無 upload |
| R7 | `me`／`profile` 回傳 members 整列；加入備註、審核、黑名單等內部欄位會洩漏給會員本人 | index.ts:128,131-132 |
| R8 | 沒有任何 API 可改權限；`role_assignments` 只在 members 新增／改 email 時套用，事後改了不會同步 members.role（現靠手動 SQL） | 20261001004622:47-50；index.ts 無寫 role |
| R9 | 後台「僅 developer」只在前端隱藏（platform.js:396-407），API 層沒有 developer 專屬檢查；新增「只有 developer 可設 admin」必須在 index.ts 新增伺服器端檢查 | index.ts:221-222；PEOPLE_ROLES 草案:3、:22 |
| R10 | 單檔 `index.ts` 255 行，各 handler 為單行巨型寫法；新增十餘個 action 容易互相覆蓋或漏掉權限，建議新增前先決定分檔／共用驗證，且需整檔 Deno 型別檢查（目前陪工作 P0 曾 NOT RUN Deno check） | index.ts:132-135；_SESSION_CONTEXT.md |
| R11 | 以 service role 查詢，沒有 RLS 兜底：新 action 漏寫 `.eq("user_id", user.id)` 即成越權；每個新 action 需逐一檢查 | index.ts:119-120 |
| R12 | `orders` POST 指派 provider 取「第一筆 active」，新增大量 provider（會員轉 provider）後會直接影響既有陪工作訂單指派 | index.ts:166-172 |
| R13 | `services.category_id` check 僅 4 值，且「陪工作」掛在 `venue_equipment`；新分類／標籤設計需先處理 | 20260930055848:5；20261005120000:219-226 |
| R14 | migration 以日期戳命名並需登記 migration history；正式環境已套用 6 支，新增 migration 前須確認 history 一致 | _SESSION_CONTEXT.md「陪工作 P0 已上線」；supabase/migrations/ 6 支 |
| R15 | 孤兒程式：`app.js`、`booking-submit`、`requests`、`submission_limits` 目前無頁面使用，新增功能勿誤接；`booking-submit` origin 白名單用 localhost:8000，與 booking-api 的 8080 不一致 | grep app.js；booking-submit/index.ts:3-7；index.ts:3 |
| R16 | 內部備註與會員個資（電話、LINE、Email）屬個資；應徵／作品集資料同理，需限本人與後台可讀 | PEOPLE_ROLES 草案:39-43 |
| R17 | 跨文件命名衝突：工程師指令 §22 權限為 super_admin/admin/staff/provider/partner/member，與既有 developer/admin/member 不同；計畫「二十二」是生鮮案例（資料表在「二十一」），兩份文件章節號不一致，引用時以標題為準 | …開發指令…:646-669；…完整計畫…:793、821 |
| R18 | 正式站驗收缺口：會員取消／改期、後台改狀態在正式站仍 NOT RUN；直接預約日期是否必填待使用者決定（orders.booking_date 可 null） | _SESSION_CONTEXT.md；index.ts:173 |
| R19 | 前端為無框架靜態頁，所有邏輯集中在 `platform.js` 479 行（含示範與正式）；新增多頁需決定共用方式（目前每頁各載 `platform.js` 並以 `data-page` 分派） | platform.js:473-478 |

---

## 8. 核對數字

- migrations 檔 6 支；`create table` 語句共 **14**（0923:2、0924_v1:4、0924_alter:0、0930:4、1001:1、1005:3），與第 2 節 2.1–2.14 的 14 張一致（members、addresses、orders、order_items、services、service_options、service_addons、service_inquiries、providers、service_providers、service_packages、requests、submission_limits、role_assignments）。
- booking-api 以 `action === "..."` 比對的**相異 action 名稱 12 個**（me、profile、addresses、services、quote、orders、order-cancel、order-reschedule、inquiries、admin-orders、admin-services、admin-inquiries）；**action×method 路由 18 條**（含 me），與第 3.2 表 18 列一致。
- Edge Functions 共 3 個：booking-api、booking-submit、runtime-config。
- admin.html 工作區 6 個（overview、operations、inquiries、members、services、system）；其中 operations 內含 3 個子區段（月曆、每日排程、收款）。
- member.html 區塊 6 個（home、book、orders、inquiries、profile、addresses）。
