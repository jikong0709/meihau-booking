工單 J｜工單 I 驗收小修（純前端）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。只動 platform.js（必要時 platform.css）。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/。

J1（🟡）platform.js:~129-160 withButtonSaveFeedback／showButtonSuccess：按鈕在綠色「✓ 已儲存」期間再點，originalText 會被抓成「✓ 已儲存」，之後永久卡住。修法：原文存在 button.dataset.restoreText（首次記錄、已存在不覆蓋），所有恢復一律用它。
J2（🟡）同處 catch 分支：綠色期間再存一次失敗，按鈕仍綠。修法：進入送出時與 catch 內 clearTimeout(該按鈕計時器)、移除 save-success、還原 restoreText，失敗絕不顯示成功樣式。
J3（🟡）platform.js:~231 與 ~912：帳號狀態開關成功後，抽屜上方「基本資料」的帳號狀態徽章不更新。修法：該徽章容器加 id，成功時以 accountStatusBadge(nextStatus) 更新。
J4（🔵）角色審核：同一角色的「通過／不通過／停用」三鍵在任一送出期間全部 disabled，避免並行送出。

AC：
- AC1 node --check platform.js。
- AC2 Playwright mock：綠色期間再點→最終文字恢復原文；綠色期間再存失敗→按鈕不綠並顯示錯誤；開關切停權後基本資料徽章同步為停權、切回啟用同步；角色審核送出中三鍵 disabled。
- AC3 新增插值 escapeHtml；只動 platform.js／platform.css。
回報：改動、AC1-3 證據。
