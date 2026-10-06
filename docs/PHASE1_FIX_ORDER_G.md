工單 G｜正式站驗收發現的 3 個顯示問題（純前端，不重新部署後端）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。只動 platform.js（必要時 platform.css）。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/。

G1 標籤名稱不顯示（🟡）：admin-person GET 回傳的 tags 元素實際形狀是 `{tag_id, source, status, tags:{name, tag_type, slug}}`（supabase/functions/booking-api/lib/admin_people.ts:62 的 join，未攤平），但 platform.js:~667 會員詳情用 `tag.name` → 畫面只剩「×」。前端加一個正規化函式（例如 normalizeTag：name = tag.name ?? tag.tags?.name，tag_type 同理），用在後台會員詳情標籤、可選標籤過濾（assigned 比對 tag_id）、以及任何讀 tags 陣列的地方（列表 admin-people 已是攤平形狀，也走同函式以防萬一）。不要改後端。
G2 從未申請的角色顯示「已停用」（🔵）：會員送出時未勾選的角色會建立 status=inactive 列。會員中心與後台徽章：若角色 status=inactive 且該角色從未有對應 profile（會員端：my-roles 回應中 provider/partner/seeker 為 null；後台：admin-person 的 provider/partner/seeker 為 null；列表無 profile 資訊時可依 inactive 一律顯示「未申請／已停用」二擇一的判斷：列表上 inactive 且非多重…→ 列表直接不顯示 inactive 角色徽章）顯示「未申請」，有 profile 才顯示「已停用」。後台列表：inactive 角色徽章不顯示（只顯示 pending/approved/rejected）。
G3 後台會員詳情的提供者／合作夥伴／需求者資料欄位顯示英文 key（provider_id、approval_status…）（🔵）：改為中文標籤對照表（例如 provider_id→提供者編號、display_name→顯示名稱、entity_type→身分型態、approval_status→審核狀態、status→上架狀態…，partners 與 seeker_profiles 欄位同理）；enum 值也轉中文（individual→個人、online→線上、hidden→不公開、pending→審核中…）；布林顯示「是／否」；陣列以「、」連接；空值顯示「—」；隱藏 created_at/updated_at/user_id。值一律 escapeHtml。

AC：
- AC1 node --check platform.js。
- AC2 node 單元測試 normalizeTag 對兩種形狀皆回正確 name。
- AC3 Playwright 或 jsdom mock：admin-person 回巢狀 tags 時抽屜顯示「設計師」；my-roles 中 partner=null 且 partner 角色 inactive 時會員中心顯示「未申請」；後台列表不顯示 inactive 徽章；詳情欄位為中文。無法跑則說明 NOT RUN 並給靜態證據。
- AC4 escape 不退化（grep 新增插值皆經 escapeHtml）。
- AC5 只動 platform.js／platform.css。
回報：改動、AC1-5 證據。
