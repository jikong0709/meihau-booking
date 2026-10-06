工單 E｜莓好預約站 Phase 1 上線前兩項（使用者已同意）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 feature/people-roles-p1-work；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。不要動 supabase/.temp/、.recall/、supabase/functions/booking-api/lib/.recall/、LOGO/、output/、其他更換的美術UI/。docs/AGREEMENTS_DRAFT_V1.md 保持原樣（它是內部草稿紀錄）。

E1 規範種子清稿：supabase/migrations/20261006090000_member_roles_p1.sql 中 6 份 agreements 的 body_md（此 migration 尚未套用正式環境，可直接改）：
- 移除所有內部字樣：【待定】、【需使用者決定】、【需查證】、「§」交叉參照、「agreement_key：」、「適用角色：」「版本：」等工程欄位行、交叉比對／衝突表段落、草案聲明。
- 原本含【待定】的條文：改成會員可讀、不含具體數字的說法（例如「平台服務費／媒合費之計算方式，將於金流正式啟用前另行公告並請您重新同意」「相關期間與處理方式依平台另行公告之規定」），不得編造任何費率、金額、天數。
- 每份開頭加一行：「本規範為試營運版本，正式版本將另行公告，屆時將請您重新確認。」
- 保留條文編號與勾選確認句清單（勾選句同樣清除內部字樣）。
- 保持 dollar-quoting 與 on conflict do nothing、冪等不變。
E2 停權帳號不能使用：
- lib/auth.ts authenticate：讀到 members.account_status='suspended' 時，所有 action 回 403 `{error:"account_suspended", message:"此帳號已停權，如有疑問請聯繫莓好客服。"}`（在任何業務邏輯前）。
- lib/admin_people.ts admin-person PATCH：不可停權自己（403 cannot_suspend_self）；admin 不可停權 developer（既有）、developer 也不可停權其他 developer（403 developer_protected）。
- platform.js：任何 API 回 account_suspended 時，顯示頁面提示「此帳號已停權…」與「切換帳號」按鈕，不做角色導向、不無限重導；公開首頁不受影響。

AC：
- AC1 grep migration agreements 區段：無 【、§、agreement_key、需使用者決定、待定、草案 等字樣（列 grep 指令與 0 筆結果）；6 份都有試營運聲明行；無任何 % / NT$ / 數字天數。
- AC2 node --check platform.js；typescript transpileModule index.ts＋lib/*.ts 0 診斷。
- AC3 mock 驗證：suspended 會員呼叫 me/my-roles/orders 回 403 account_suspended；active 會員正常；自我停權 403；developer 停權 developer 403。
- AC4 前端：mock me 回 account_suspended 時 member.html／admin.html 顯示停權提示、不重導迴圈（Playwright 或靜態說明）。
- AC5 只動 migration 20261006090000、lib/auth.ts、lib/admin_people.ts、platform.js（必要時 member.html/admin.html/platform.css）。
回報：改動檔案、AC1-5 證據。
