# Phase 1｜會員多重角色＋資料底座 設計定稿 V1

日期：2026-10-05　依據：`docs/PHASE0_SYSTEM_INVENTORY.md`、使用者兩份計畫書、`協作/骨架定案.md`（2026-10-05 媒合模組段）。
取代：`docs/PEOPLE_ROLES_MATCHING_PLAN_V1.md`（舊草案，內容已併入本檔與後續 Phase）。

## 0. 範圍

做：會員資料擴充、四種合作角色（可複選）、角色動態表單、標籤、服務提供者／合作夥伴／資源需求者資料、規範版本與同意紀錄、後台審核、首頁入口區塊＋頁尾連結。
不做（後續 Phase）：服務分類擴充與 service_tags（P2）、projects／resource_requests（P3）、招募 recruitment_*（P4）、project_matches（P5）、transactions／payouts／綠界（P6）、智慧媒合（P7）。
紅線：不刪任何資料（取消角色＝改狀態）、不碰金流、不代客戶帳號操作。

## 1. 資料表（schema `booking`，全部 force RLS、無 policy、不 grant 給 authenticated，只經 booking-api service role 存取）

### 1.1 members（擴充，不重建）
新增欄位：`avatar_url`、`region`、`bio`(≤2000)、`is_public bool default false`、`account_status`('active','suspended')、`last_login_at`、`admin_note`(僅後台)。
`members.role` 維持系統權限（developer＝super_admin／admin／member），與合作角色無關。

### 1.2 member_roles（平台合作角色）
`id uuid pk`、`user_id → members`、`role_key`('member','provider','partner','resource_seeker')、`status`('pending','approved','rejected','inactive')、`applied_at`、`reviewed_at`、`reviewed_by uuid`、`review_note`、時間戳；`unique(user_id, role_key)`。
- `member` 角色自動 approved；其餘送出後 pending，由後台審核。
- 會員取消勾選 → `inactive`，對應資料保留不刪；重新勾選 → 回 pending。

### 1.3 tags／member_tags
`tags`：`tag_id uuid pk`、`tag_type`('identity','skill','service','project_type','cooperation_type','resource_type','region')、`name`、`slug`、`status`('active','hidden','archived')、`sort_order`；`unique(tag_type, slug)`。種子資料取計畫書範例（設計師、Canva、LINE貼圖、生鮮、建國市場…）。
`member_tags`：`(user_id, tag_id) pk`、`source`('self','admin')、時間戳。
標籤不硬刪，只改 archived。

### 1.4 providers（擴充既有表）
新增：`user_id uuid unique null → members`、`entity_type`('individual','brand','store')、`brand_name`、`service_area`、`service_mode`('online','offline','both')、`website`、`instagram`、`facebook`、`line`、`portfolio_urls text[]`、`pricing_description`、`quote_method`、`member_discount`、`accept_projects bool`、`accept_long_term bool`、`available_hours`、`availability_status`('available','partial','paused','internal_only','standby')、`approval_status`('pending','approved','rejected','suspended')、`admin_note`。
既有 `PRV-MEIHAU` 補 `approval_status='approved'`。
- 會員建立的 provider：`provider_id = 'PRV-' + 短碼`，`status='hidden'`（審核通過也不自動 active；上架由後台另行開啟，P2）。
- 會員勾選「提供哪些服務」→ 寫 `service_providers` 且 `status='hidden'`。
- **防誤派**：orders 自動指派（index.ts:166-172）改為只取「與該服務在 service_providers 為 active 的 provider」，確保新會員提供者不會被派到陪工作訂單。

### 1.5 partners（新）
`partner_id uuid pk`、`user_id unique → members`、`organization_name`、`partner_types text[]`（store／brand／supplier／advertising／cross_industry／channel／venue／lecturer／consultant／other）、`introduction`、`website`、`social_links jsonb`、`location`、`service_area`、`resources text[]`、`cooperation_methods text[]`（自由加值，不寫死）、`cooperation_conditions`、`price_description`、`member_discount`、`advertising_interest bool`、`matching_interest bool`、`approval_status`、`admin_note`、時間戳。
生鮮案例＝partner_types 含 supplier＋resource_type 標籤「生鮮」＋region 標籤「台中」＋自訂標籤「建國市場」，無特殊程式。

### 1.6 seeker_profiles（新；正式的 resource_requests 在 P3）
`user_id pk → members`、`looking_for`、`need_categories text[]`、`budget_min int`、`budget_max int`、`region`、`timeline`、`cooperation_type`、`is_public bool default false`、`accept_matching bool default true`、`approval_status`、`admin_note`、時間戳。所需技能用 member_tags（skill）。

### 1.7 agreements／member_agreements
`agreements`：`agreement_id uuid pk`、`agreement_key`（member_terms／provider_rules／partner_rules／seeker_rules／matching_rules／payment_rules）、`version int`、`title`、`body_md`、`applies_to_roles text[]`、`status`('draft','active','retired')、`published_at`；`unique(key, version)`；每個 key 只能一個 active（partial unique index）。
`member_agreements`：`id uuid pk`、`user_id`、`agreement_id`、`agreement_key`、`agreement_version`、`agreed_at`、`status`('agreed','superseded')；`unique(user_id, agreement_id)`。
- 角色需同意：member→member_terms；provider→provider_rules＋matching_rules＋payment_rules；partner→partner_rules；resource_seeker→seeker_rules＋matching_rules。
- 規範發布新版 → 舊版同意紀錄改 superseded，會員下次進會員中心被要求重新同意。
- 規範內容來源：`docs/AGREEMENTS_DRAFT_V1.md`（草案，需法律／會計確認）。

## 2. booking-api（先拆檔，再加功能）
- 先把 `index.ts` 拆成 `lib/auth.ts`（身分、requireAdmin、requireDeveloper）、`lib/members.ts`、`lib/roles.ts`、`lib/admin_people.ts`…；行為不變。
- **修外洩**：`me`／`profile` 改欄位白名單，永不回傳 `admin_note`、`review_note`。

會員端：
| action | method | 說明 |
|---|---|---|
| me | GET | 白名單欄位＋合作角色摘要＋待重新同意清單 |
| profile | PATCH | 基本資料（含 avatar_url、region、bio、is_public） |
| my-roles | GET | 角色狀態＋各角色資料＋需同意規範（含是否已同意目前版本） |
| my-roles | PUT | 一次送出：角色集合＋各角色資料＋同意的 agreement_id 清單；伺服器驗證必要規範皆已同意才收件 |
| tags | GET | 依 type 取 active 標籤 |
| agreements | GET | 依 role 取 active 規範全文 |

後台（admin＋developer）：
| action | method | 說明 |
|---|---|---|
| admin-people | GET | 會員列表：搜尋、依角色／狀態／標籤篩選、多重角色篩選、分頁 |
| admin-person | GET | 單人完整資料（含備註、各角色資料、同意紀錄） |
| admin-person | PATCH | admin_note、account_status、標籤增減 |
| admin-role-review | PATCH | 角色 approve／reject／inactive＋review_note；provider／partner／seeker 的 approval_status 同步 |
| admin-tags | GET/POST/PATCH | 標籤管理（無刪除，改 archived） |
| admin-agreements | GET/POST/PATCH | 規範版本：新增草稿、發布（舊版 retired、同意紀錄 superseded） |
| admin-agreement-records | GET | 同意紀錄查詢 |
| admin-system-role | PATCH | **僅 developer**：設定 admin／member（伺服器端驗證；不可經 API 設 developer） |

## 3. 前台
- `member.html` 新區塊「我的合作角色」：四個勾選（一般會員｜找服務、服務提供者｜找案件、合作夥伴｜找合作、資源需求者｜找資源），勾選才展開對應欄位；作品集只收網址（可多筆）；依勾選角色列出規範（可展開全文）與確認勾選；送出後每個角色顯示狀態徽章（審核中／已通過／未通過／已停用）。
- 私密欄位（手機、Email、LINE）前台永不公開。
- `index.html`：新增「找服務／加入莓好」雙入口區塊（方案摘要之後、預約流程之前），沿用 UI v2 色系；「加入莓好」未登入先登入，登入後到 `member.html#roles`。頁尾加「加入莓好」「找服務」連結。

## 4. 後台
`admin.html` 新工作區「👥 會員與合作管理」，P1 子分頁：全部會員（含多重角色／各角色篩選）、會員詳情（角色審核、標籤、備註、系統權限＝僅 developer 可見）、標籤管理、規範與同意紀錄。其餘子分頁（服務者／服務關聯、合作申請、招募、資源需求、案件、媒合）在對應 Phase 才出現。

## 5. 驗收標準（對應計畫書 Phase 1 完成標準 12 項）
1. Google 登入即建立會員（既有）。
2. 可複選兩個以上角色。
3. 勾選才顯示對應欄位，取消勾選隱藏且資料不刪（DB 讀回 status=inactive，profile 仍在）。
4. 四類資料可填寫、存檔、重新載入讀回一致。
5. 作品集多筆網址可存、格式驗證（僅 http/https）。
6. 依角色顯示對應規範全文。
7. 未勾齊必要規範 → 前端擋＋伺服器回 400。
8. 送出後非 member 角色為 pending。
9. 後台列表看得到會員。
10. 後台看得到每位會員的多重角色與狀態，可篩選。
11. 後台可 approve／reject，會員端狀態同步。
12. 後台可新增標籤、替會員加減標籤。
安全加驗：
- 會員 A 無法讀寫會員 B 的任何角色資料。
- member 呼叫任一 admin-* 回 403。
- admin 呼叫 admin-system-role 回 403。
- `me` 回應不含 admin_note。
- 規範發新版後，舊同意紀錄變 superseded，會員被要求重新同意。
- 陪工作訂單仍只指派 PRV-MEIHAU。
- migration 可重跑兩次無錯。
- 390px 無水平溢位，console 0 error。

## 6. 施工切分
- 工單 A（後端）：migration＋種子＋booking-api 拆檔＋新 action＋防誤派修正。
- 工單 B（前端）：member.html 角色區、admin.html 會員與合作管理、index.html 入口區塊＋頁尾。依本檔 §2 API 合約先做，可與 A 平行。
- 驗收：fresh-reviewer 依 §5 逐條檢查；正式 DB migration＋函式部署由使用者在終端機以 `npx.cmd` 執行。
