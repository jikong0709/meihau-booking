修正工單 C｜莓好預約站 Phase 1 驗收 NO-GO 修正
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 feature/people-roles-p1-work；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。不要動 supabase/.temp/、.recall/、LOGO/、output/、其他更換的美術UI/。
依據：docs/PHASE1_MEMBER_ROLES_DESIGN.md（§2.1 合約不可改）。只修下列項目，不做額外重構。

🔴 必修
R1 supabase/functions/booking-api/lib/roles.ts:~167：批次 upsert member_roles 時未勾選角色 applied_at=undefined → postgrest 送 NULL 違反 not null。改為每列都帶明確值（沿用既有 applied_at，新列用 now），任何 upsert/insert 物件不得出現 undefined 值（全檔 grep 檢查同類寫法，lib/*.ts 都要查）。

🟡 應修
Y1 roles.ts putMyRoles：改為「先驗證全部輸入（角色、各 profile 欄位、tag_ids、service_ids、規範）→ 再寫入」；每個 insert/update/upsert 都檢查 error 並回傳錯誤。
Y2 roles.ts：已 approved 的角色再次送出時保留 status 與 reviewed_at/reviewed_by/review_note，不得清空；只有 rejected/inactive 重新勾選才回 pending。
Y3 lib/admin_people.ts:~101-105 角色審核同步 providers/partners/seeker_profiles approval_status：檢查 error 並回報。
Y4 roles.ts:~112-121：會員取消勾選的服務，對應 service_providers 改 status='hidden'（僅限該會員自己的 provider；不得動 PRV-MEIHAU）。
Y5 member.html Instagram／Facebook 欄位：前端加網址驗證與提示（http/https，placeholder 範例）；partner 的 organization_name、partner_types 必填前端先提示。伺服器 validationError 回應的 message 要指出哪個欄位錯（中文欄位名）。
Y6 lib/member_core.ts:~9-13 handleProfile：請求未帶的欄位不更新（避免舊前端清空 avatar_url/region/bio/is_public）。
Y7 supabase/rollback/20261006090000_member_roles_p1_rollback.sql：補還原 migration 第 182-183 行刪除的 policy 與 revoke 的 grant（依原 migration 20261005120000 的定義），並移除本 migration 新建且 Phase 0 不存在的函式（若有）。

🔵 一併修（小改）
B1 roles.ts：伺服器強制 roles 必含 "member"（缺則 400）。
B2 member.html/platform.js：seeker accept_matching 預設勾選（true）。
B3 platform.js 後台抽屜：目標為 developer 時不顯示系統權限下拉，改顯示「Developer 帳號受保護」。
B4 admin_people.ts:~77：admin 不可修改 developer 帳號的 account_status（403）；developer 可。
B5 admin_people.ts:~81-87：先驗證 add_tag_ids 全部有效再執行 remove/add。
B6 admin_people.ts:~154-155：規範發布改為先確認新版可啟用（draft 存在）→ 退役舊版 → 啟用新版，任何一步 error 立即回報；（能用單一 SQL/rpc 更好但不強制）。
B7 admin_people.ts:~36 loadAll：加 order 確保分頁穩定。
B8 admin_people.ts:~124：PATCH name 空字串回 400 驗證錯誤而非 404。
B9 platform.js:~174：`currentMember || await api("me")` 正確解包 {member}。
B10 migration 第~186 行：PRV-MEIHAU approval_status 只在為 null 時設 approved（重跑不覆蓋）。

AC：
- AC1 node --check platform.js 通過；以 typescript transpileModule 檢查 index.ts 與 lib/*.ts 0 syntax diagnostics。
- AC2 grep lib/*.ts 無 `? .* : undefined` 寫入 DB 物件的情形；列出每個 DB 寫入點與 error 檢查位置對照表。
- AC3 逐條列 R1、Y1-Y7、B1-B10 → 檔案:行號 修改證據。
- AC4 合約（§2.1）回應形狀未改；既有 18 條 action 行為未改。
- AC5 只動 supabase/functions、supabase/migrations/20261006090000_member_roles_p1.sql、supabase/rollback、member.html、platform.js（必要時 platform.css）。
回報：改動檔案、AC1-5 結果與證據。
