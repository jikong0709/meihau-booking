# Phase 2｜個人媒合與身份認證修改計畫 V1

日期：2026-10-07
來源：`莓好預約站_媒合服務補充計畫書.docx`、`docs/PHASE1_MEMBER_ROLES_DESIGN.md`、目前 `main` 程式與資料表。
狀態：規劃完成，尚未施工、未部署、未寫正式資料庫。

## 0. 結論

本計畫不重建會員、角色、標籤或服務提供者資料。Phase 2 應沿用已上線的 `booking.members`、`member_roles`、`tags`、`member_tags`、`providers`、`partners`、`seeker_profiles` 與規範同意紀錄，新增五個可獨立驗收的能力：

1. 自訂身份標籤申請與後台審核。
2. 身份認證規則、認證提交與審核。
3. 個人媒合公開資料與唯一分享連結。
4. 雙方媒合確認、紀錄與問題回報。
5. 平台媒合輪播的申請與排程資料。

分享頁美術、社群分享圖、QR Code、付費曝光價格、平台抽成與金流不在本階段定稿。

## 1. 現況對照

| 補充計畫需求 | 現有能力 | 修改判斷 |
|---|---|---|
| 多重身份 | `member_roles` 與 `member_tags` 已上線 | 沿用，不新增第二套身份系統 |
| 身份標籤 | `tags.tag_type='identity'` 已支援擴充 | 新增會員提案與後台核准流程 |
| 身份認證 | 尚無認證規則、送審與到期資料 | 新增獨立認證模組 |
| 作品／資格 | provider 已有 `portfolio_urls` | 沿用網址；認證證據另建結構 |
| 公開媒合資料 | members/provider/partner/seeker 已有部分公開欄位 | 新增公開狀態、唯一 slug 與安全聚合 API |
| 分享連結 | 尚無穩定公開路由 | 新增 `match.html?profile=<slug>` 資料入口 |
| 媒合輪播 | 目前只有獨立的蝦皮分潤輪播 | 新模組必須分開命名與資料來源，禁止混用 |
| 媒合確認 | 尚無雙方確認紀錄 | 新增媒合案件與逐方確認紀錄 |
| 問題回報 | 尚無媒合爭議模組 | 新增分類、狀態、處理紀錄 |

## 2. 不可破壞的既有邊界

- `members.role` 仍只代表 developer／admin／member 系統權限；不得拿來存身份標籤或合作角色。
- Google 登入仍是唯一會員登入入口，不建立第二套帳密註冊。
- 第一版作品集／附件只收網址，不開 Storage。補充計畫中的「文件」先以證書欄位、文字與公開驗證連結實作；檔案上傳需使用者另行解鎖骨架。
- 手機、Email、私人 LINE、住址、完整證件、銀行資料不得出現在公開 API 或媒合頁。
- 「已驗證」只表示平台核對指定資料，不得呈現為平台保證服務品質、履約或專家資格。
- 付款、平台抽成、付費置頂與曝光價格全部延後；本期不得新增付款狀態寫入。
- 既有蝦皮分潤輪播為 `assets/affiliate/` 獨立模組；媒合輪播不得修改、覆寫或共用其商品事件。
- 所有新表維持 force RLS、無 anon/authenticated 直接表權限，只經 `booking-api` service role 存取。
- 資料停用採狀態更新，不硬刪資料。

## 3. 建議資料模型

### 3.1 自訂身份標籤

`identity_tag_applications`

- `application_id uuid pk`
- `user_id -> members`
- `proposed_name`、`purpose`、`service_description`
- `qualification_summary`、`evidence_urls text[]`
- `status`：pending／approved／rejected／withdrawn
- `matched_tag_id -> tags null`：核准後指向既有或新建的 identity tag
- `review_note`、`reviewed_by`、`reviewed_at`、時間戳

核准流程必須先做同名／同義重複檢查；核准標籤與會員個人認證是兩件事，不可核准標籤時順便把申請人標成已認證。

### 3.2 身份認證規則

`identity_verification_rules`

- `rule_id uuid pk`、`tag_id -> tags`
- `version int`、`title`、`description`
- `requires_manual_review bool`
- `valid_days int null`：null 代表未設定到期
- `special_legal_notice text`
- `status`：draft／active／retired
- `created_by`、`published_at`、時間戳
- 同一 tag 同一時間只允許一個 active 版本

`identity_verification_requirements`

- `requirement_id uuid pk`、`rule_id -> identity_verification_rules`
- `requirement_key`、`label`
- `evidence_type`：text／url／certificate
- `is_required bool`、`is_public_result bool`、`sort_order`
- `instructions`、`config jsonb`

### 3.3 會員認證提交

`member_identity_verifications`

- `verification_id uuid pk`
- `user_id -> members`、`tag_id -> tags`、`rule_id`
- `rule_version` 快照
- `status`：draft／pending／verified／rejected／expired／revoked
- `submitted_at`、`verified_at`、`expires_at`
- `reviewed_by`、`review_note_private`、`review_note_public`
- `revoked_at`、`revoked_reason`、時間戳

`member_identity_evidence`

- `evidence_id uuid pk`、`verification_id`、`requirement_id`
- `text_value`、`url_value`
- `certificate_name`、`issuer_name`、`certificate_number_masked`、`issued_on`
- 第一版禁止加入 storage path 或原始證件影像欄位

公開端只回傳 tag 名稱、認證狀態、必要證書顯示欄位與驗證日期；不得回傳審核素材、完整編號或私人備註。

### 3.4 個人媒合頁

`matching_profiles`

- `user_id pk -> members`
- `public_slug unique`：不可由 email 或 user UUID 直接推導
- `display_name`、`headline`、`public_intro`
- `service_region`、`availability_summary`
- `publish_status`：draft／pending_review／published／hidden／suspended
- `contact_mode`：platform_only
- `submitted_at`、`published_at`、`reviewed_by`、時間戳

第一版公開 API 聚合既有 provider／partner／seeker 資料、active identity tags 與 verified 認證摘要，不另複製一份服務者資料。公開頁路由先採 GitHub Pages 可直接部署的 `match.html?profile=<slug>`；漂亮網址留待有 rewrite 能力的主機再做。

公開 CTA 規則：可以未登入瀏覽；點「預約／聯絡」時要求 Google 登入，再走既有預約／詢價或新的平台內聯絡申請，不直接公開私人聯絡方式。

### 3.5 媒合確認與問題回報

`matching_records`

- `match_id uuid pk`、`match_code unique`
- `initiator_user_id`、`counterparty_user_id`
- `provider_user_id null`、`seeker_user_id null`
- `subject_type`：service／need／cooperation／resource
- `subject_title`、`scope_snapshot jsonb`
- `scheduled_at`、`location_text`
- `agreed_amount int null`、`payment_method_text`
- `status`：proposed／partially_confirmed／confirmed／cancelled／disputed／closed
- `created_at`、`confirmed_at`

`matching_confirmations`

- `match_id`、`user_id` 複合唯一
- `decision`：confirmed／declined
- `terms_snapshot jsonb`、`confirmed_at`

只有兩位參與者各自確認同一版本的內容後，`matching_records.status` 才能成為 confirmed。`agreed_amount` 只記錄約定，不代表已付款。

`matching_reports`

- `report_id uuid pk`、`match_id`、`reporter_user_id`
- `category`：no_show／late_cancel／amount_dispute／scope_dispute／suspected_fraud／misconduct／safety／other
- `description`、`status`：open／reviewing／resolved／dismissed
- `assigned_to`、`resolution_note`、時間戳

### 3.6 平台媒合輪播

`matching_feature_applications`

- `application_id uuid pk`、`user_id`、`matching_profile_user_id`
- `category_tag_id null`、`requested_start_at null`、`requested_end_at null`
- `status`：pending／approved／rejected／inactive
- `reviewed_by`、`review_note`、時間戳

`matching_feature_schedules`

- `schedule_id uuid pk`、`application_id`
- `starts_at`、`ends_at`、`sort_order`
- `status`：scheduled／active／paused／ended

本期只建立申請、核准、排程與公開讀取資料；不建付費、抽成、曝光計費或成效結算。

## 4. API 修改計畫

維持 `?action=xxx` 合約，新增模組檔，避免把功能塞回 `index.ts`。

### 4.1 會員端

| action | method | 功能 |
|---|---|---|
| identity-tag-applications | GET／POST | 查看自己的申請、提出自訂身份標籤 |
| identity-verification-rules | GET | 依 identity tag 取得目前 active 認證規則 |
| my-identity-verifications | GET／POST／PATCH | 草稿、送審、補件；不可自行改成 verified |
| my-matching-profile | GET／PUT | 編輯公開媒合資料、送審或下架 |
| matching-records | GET／POST | 查看自己的媒合紀錄、建立確認草稿 |
| matching-confirmation | POST | 參與者確認或拒絕同一版本 |
| matching-reports | GET／POST | 查看自己的回報、建立問題回報 |
| matching-feature-applications | GET／POST | 申請加入平台媒合輪播 |

### 4.2 公開端

| action | method | 功能 |
|---|---|---|
| public-matching-profile | GET | 依 slug 只回傳 allowlist 公開欄位 |
| matching-feature-feed | GET | 依時間、類別回傳已核准且 published 的媒合頁摘要 |

公開 action 不得要求或回傳客戶帳號資料；必須驗證 profile、角色、認證與排程狀態皆可公開。

### 4.3 後台

| action | method | 功能 |
|---|---|---|
| admin-identity-tag-applications | GET／PATCH | 查詢、核准、合併到既有標籤、拒絕 |
| admin-verification-rules | GET／POST／PATCH | 建草稿、發布新版、停用舊版 |
| admin-identity-verifications | GET／PATCH | 審核、退補、驗證、拒絕、撤銷、失效 |
| admin-matching-profiles | GET／PATCH | 審核公開頁、下架、停權 |
| admin-matching-records | GET | 媒合紀錄查詢 |
| admin-matching-reports | GET／PATCH | 爭議指派、處理與結案 |
| admin-matching-features | GET／POST／PATCH | 輪播申請與排程管理 |

developer／admin 可執行一般審核；涉及系統權限設定仍只有 developer。所有狀態轉換都要在伺服器端白名單驗證。

## 5. 前後台頁面修改

### 5.1 `member.html`

- 在「我的合作角色」下新增「身份與認證」。
- 支援新增身份提案、查看各身份認證要求、填寫證書欄位與網址、送審、補件及查看狀態。
- 新增「我的媒合頁」資料編輯、預覽、送審、複製連結、隱藏頁面。
- 新增「媒合紀錄」與「問題回報」。
- 認證徽章只在 verified 且未過期／撤銷時顯示。

### 5.2 `match.html` 新增功能殼

- 只負責讀取公開 API 與顯示安全欄位。
- 第一版以可讀、可用、手機不溢位為目標，不把視覺定稿混入本工單。
- CTA 依資料來源導向既有服務預約、詢價或登入後的平台內聯絡流程。
- 補上 canonical／分享 metadata 的資料欄位接口；OG 圖與正式分享卡另案。

### 5.3 `admin.html`

在「會員與合作管理」增加子頁：

1. 身份標籤申請。
2. 認證規則。
3. 會員認證審核。
4. 媒合頁管理。
5. 媒合紀錄。
6. 問題回報。
7. 媒合輪播。

不得把認證私人證據塞入既有會員列表；詳細資料只在單筆審核抽屜顯示。

## 6. 施工 Wave 與 Agent 分工

### Wave 0｜設計閘門

- 主 Agent：凍結狀態機、欄位 allowlist、錯誤碼、migration 名稱與 API request／response 範例。
- Fresh reviewer：檢查與 Phase 1、骨架定案、隱私邊界、GitHub Pages 路由是否衝突。
- 產物：Phase 2 API 合約與驗收矩陣；未過閘門不施工。

### Wave 1｜身份提案與認證底座

- Agent A：migration、約束、索引、RLS／grant、認證狀態機。
- Agent B：`lib/identity_verification.ts` 與會員／後台 API。
- Agent C：member/admin 表單與狀態顯示。
- 驗收：自訂標籤核准不等於會員認證；member 無法自我核准；私密證據不出公開 API。

### Wave 2｜公開媒合資料與分享連結

- Agent A：matching_profiles migration、slug 產生與公開 allowlist API。
- Agent B：`match.html` 功能殼、會員編輯與複製連結。
- Fresh reviewer：未登入公開頁、登入 CTA、手機 390px、XSS／網址協定、停權／隱藏頁 404。

### Wave 3｜雙方確認與問題回報

- Agent A：matching records／confirmations／reports migration 與原子狀態轉換。
- Agent B：會員紀錄、雙方確認、回報 UI。
- Agent C：後台查詢、處理與稽核畫面。
- 驗收：單方不能把案件改為 confirmed；非參與者不可讀寫；金額欄不得改寫訂單付款狀態。

### Wave 4｜媒合輪播資料與排程

- Agent A：feature application／schedule migration 與公開 feed。
- Agent B：會員申請及後台排程 UI。
- Agent C：獨立媒合輪播容器；不得修改 `assets/affiliate/` 核心模組。
- 驗收：只有 published、核准且在排程區間內的 profile 可曝光；到期自動不回傳。

### Wave 5｜另案 UI／UX

- 個人品牌版型、正式分享頁視覺、社群分享圖、QR Code、輪播卡片美術。
- 必須在資料與權限驗收完成後開工，不阻塞前四個 Wave。

## 7. Migration 與部署順序

每個 Wave 各自一支可重跑 migration，不把五個模組塞進單一巨型 SQL。建議命名：

1. `*_identity_tag_applications_and_verification.sql`
2. `*_matching_profiles.sql`
3. `*_matching_records_and_reports.sql`
4. `*_matching_feature_schedules.sql`

正式環境順序固定：

1. Fresh-context 原始碼驗收。
2. migration transaction／rollback 演練。
3. migration 正式套用與表／約束／權限讀回。
4. 部署 `booking-api` 並做 CORS、401、403、狀態轉換 smoke。
5. 最後才發布前端。
6. 正式站做匿名公開頁與使用者親自登入後流程驗收。

本 Repository 不使用 `supabase db push --linked`；沿用已驗證的 `npx.cmd supabase db query --linked --project-ref ... --file ...` 流程，且 migration 讀回成功前不得先部署函式。

## 8. 驗收閘門

### 功能

- 身份標籤提案可核准為新標籤或合併既有標籤。
- 一個會員可有多個身份、每個身份有獨立認證狀態。
- 認證規則發布新版不竄改舊提交快照。
- 認證到期／撤銷後，公開徽章立即消失。
- 每位會員只有一個不可猜測且唯一的 public slug。
- 公開頁只顯示 allowlist 欄位；停權、hidden、未審核頁不可讀。
- 雙方各自確認後才成立 matching record confirmed。
- 問題回報只有參與者與 admin／developer 可讀。
- 媒合輪播只回傳有效排程與已發布頁面。

### 安全

- member 呼叫任何 admin action 為 403。
- 會員 A 無法讀寫會員 B 的認證、媒合紀錄、回報或輪播申請。
- 不回傳 private review note、完整證書編號、私人聯絡資料、住址、銀行資料。
- URL 僅允許 `http:`／`https:`；公開文字經 escape，不接受腳本或事件屬性。
- migration 可重跑兩次；既有 members、orders、providers 與 Phase 1 資料筆數不被刪除。
- 陪工作自動派單仍只依 active `service_providers`，不可因新增認證而改變。

### UI 與回歸

- 320／390／768／1440px 無頁面水平溢位。
- console 0 error；錯誤與成功訊息可見且不只靠顏色。
- 既有會員資料、角色審核、標籤、預約、詢價、後台、蝦皮分潤輪播均需回歸。
- Codex 自檢不算最終完成；必須由 Claude Code fresh-context 逐項驗收。

## 9. 需要使用者決定的閘門

以下決定不阻擋 Wave 0 規格，但在對應功能施工前必須確認：

1. 是否解鎖認證文件上傳；未解鎖前一律維持網址／文字／證書欄位。
2. 各身份認證是否有有效期限；未指定時 `valid_days=null`，不自行假設。
3. 未登入訪客點「聯絡」時，是否一律先登入；本計畫預設先登入以保護雙方。
4. 媒合確認是否允許只有一方是本站會員；本計畫預設雙方皆為會員。
5. 媒合輪播第一版放在哪些頁面；不得直接併入既有蝦皮分潤輪播區塊。

## 10. TODO Tree

```text
Phase 2 媒合服務補充
├─ W0 合約與狀態機定稿
├─ W1 身份提案與認證
│  ├─ DB／RLS
│  ├─ Member API／UI
│  └─ Admin API／UI
├─ W2 公開媒合頁與分享連結
│  ├─ matching_profiles／slug
│  ├─ public allowlist API
│  └─ match.html 功能殼
├─ W3 媒合確認與問題回報
│  ├─ matching_records／confirmations
│  └─ matching_reports／admin workflow
├─ W4 媒合輪播申請與排程
│  ├─ application／schedule
│  └─ public feed／獨立輪播容器
└─ W5 分享頁與輪播視覺另案
```

## 11. Token 與維護成本控制

- 先凍結每個 Wave 的 API 合約，再讓前後端 Agent 平行施工，避免反覆掃完整 Repository。
- 每張工單只列允許修改檔、禁止修改檔、request／response 與驗收命令。
- 共用驗證函式放 `lib/`，不要在每個 action 重複寫狀態、網址、隱私欄位檢查。
- 驗收以固定矩陣保存 PASS／FAIL／NOT RUN；不把本機 mock 當成正式 DB 或登入後驗收。
- 每個 Wave 獨立 migration、獨立 commit、獨立回滾點，降低部署與 fresh-review token 成本。
