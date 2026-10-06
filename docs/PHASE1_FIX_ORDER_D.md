修正工單 D｜莓好預約站 Phase 1 第二輪驗收修正
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 feature/people-roles-p1-work；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。不要動 supabase/.temp/、.recall/、supabase/functions/booking-api/lib/.recall/、LOGO/、output/、其他更換的美術UI/、supabase/migrations（本輪不改 migration）。
依據：docs/PHASE1_MEMBER_ROLES_DESIGN.md（§2.1 合約不可改）。只修下列項目。

🔴 R1 supabase/functions/booking-api/lib/http.ts:~10：Access-Control-Allow-Methods 加 PUT → "GET, POST, PUT, PATCH, DELETE, OPTIONS"。
🟡 Y1 platform.js initProductionAdmin：initAdminPeople 失敗不得影響既有後台（日曆、每日排程、收款）。既有渲染先執行，initAdminPeople 放最後並以 try/catch 包住，錯誤用頁面內提示（既有 showMessage 類函式）而非 alert。
🟡 Y2 lib/roles.ts:~147：providers upsert 只在新建時設 status='hidden'；已存在的 provider 不覆蓋 status（可分 insert / update 兩路，update 物件不含 status）。仍需保持「任何寫入物件無 undefined 值」。
🟡 Y3 後台搜尋：lib/admin_people.ts 搜尋加入 phone（與 placeholder「姓名／Email／手機」一致）。
🔵 B1 lib/admin_people.ts admin-role-review：先確認對應 profile 存在（provider/partner/seeker 依 role_key），不存在就回 400 且不改 member_roles；存在才更新角色與同步。
🔵 B2 admin-agreements publish：啟用新版失敗時，把剛退役的舊版改回 active（補救），並回報錯誤。
🔵 B3 lib/roles.ts:~178-181：會員重送時不得把 source='admin' 的標籤改成 'self'；會員只能增減 source='self' 的標籤，admin 標籤保持不動。
🔵 B4 lib/roles.ts getMyRoles：provider、partner、seeker、tags、service links 查詢都檢查 error，失敗回 500 帶 message。
🔵 B5 lib/member_core.ts:~36：`["delete"]()` 改回 `.delete()`（既有 addresses 刪除路由，行為不變）。
🔵 B6 member.html／platform.js：「一般會員」勾選框固定勾選且 disabled（附說明「所有會員預設具備」）。
🔵 B7 member.html／platform.js：服務提供者的下拉（身分型態、服務方式、接案狀態等）新會員預設選第一個有效選項，不送空字串。

AC：
- AC1 node --check platform.js；typescript transpileModule 檢查 index.ts＋lib/*.ts 0 診斷。
- AC2 以實際 HTTP 伺服器套用 cors() 輸出驗證 PUT preflight 被允許（或至少 grep 證據＋說明）。
- AC3 以 mock 讓 admin-tags 回 400，確認後台日曆／每日排程／收款仍渲染、無 alert（Playwright 或說明 NOT RUN）。
- AC4 逐條 R1、Y1-Y3、B1-B7 → 檔案:行號 證據；DB 寫入物件仍無 undefined（列檢查方式）。
- AC5 只動 supabase/functions、member.html、platform.js（必要時 platform.css）。
回報：改動檔案、AC1-5 結果與證據。
