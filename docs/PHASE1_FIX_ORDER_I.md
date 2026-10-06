工單 I｜帳號狀態雙鍵開關＋儲存按鈕變綠（使用者指定，純前端）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。只動 platform.js、platform.css。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/。先看 HEAD（工單 H 已加入抽屜回饋訊息與帳號狀態徽章），在其上修改。

I1 帳號狀態改為「停權｜啟用」雙鍵分段開關（取代 #personAccountStatus 下拉）：
- 左「停權」右「啟用」，兩鍵相連；目前狀態那顆亮起（停權＝紅底白字、啟用＝綠底白字），另一顆為淡色外框。aria-pressed 標示。
- 點擊即呼叫既有 admin-person PATCH（只帶 user_id 與 account_status），不需再按「儲存會員資料」。
- 點「停權」前用 confirm 確認：「確定停權「{會員名稱}」？停權後對方將無法使用網站。」取消則不送出；點「啟用」不需確認。點目前已是的狀態不送出。
- 送出期間兩鍵 disabled，旁邊顯示「儲存中…」；成功後開關切換並在旁顯示綠色「✓ 已儲存」數秒，同時刷新列表該列徽章；失敗恢復原狀並顯示紅色錯誤 message。
- 後端既有保護（不可停權自己、developer 受保護）回 403 時要顯示其 message；目標為 developer 或自己時，開關直接 disabled 並註明「Developer 帳號受保護」／「不可停權自己」。
I2「儲存會員資料」按鈕（此後只負責內部備註 admin_note）：成功後按鈕變綠底、文字改「✓ 已儲存」約 2.5 秒再恢復；失敗按鈕不變綠並顯示錯誤。其他抽屜內儲存類按鈕（加入標籤、角色通過/不通過/停用、更新系統權限）同樣套用成功變綠回饋。
I3 手機 390px 開關可點（每鍵至少 44px 高），不溢位。

AC：
- AC1 node --check platform.js。
- AC2 Playwright mock：點停權→confirm 取消不送出；接受→PATCH body 為 {user_id, account_status:"suspended"}，成功後停權鍵亮紅、顯示「✓ 已儲存」、列表徽章變停權；點啟用→無 confirm、PATCH active、亮綠；mock 403 時恢復原狀並顯示 message；送出期間 disabled。
- AC3 目標 developer／自己時開關 disabled 並有說明。
- AC4 儲存會員資料成功按鈕變綠並自動恢復；失敗不變綠。
- AC5 390/1440 無溢位、console 0 error；新增插值皆 escapeHtml；只動 platform.js／platform.css。
回報：改動、AC1-5 證據。
