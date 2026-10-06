工單 H｜後台儲存回饋＋驗收建議（純前端）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。只動 platform.js、platform.css。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/。

H1（🟡 使用者實測回報）：後台「會員與合作管理」會員詳情按「儲存會員資料」後，資料其實已存（列表狀態已變 suspended），但畫面沒有任何明顯提示，使用者無法確定。#peopleMessage 是空的。要做：
- 會員詳情抽屜內，每個寫入動作（儲存會員資料、角色通過／不通過／停用、加入標籤、移除標籤、更新系統權限）完成後，在該按鈕旁或抽屜頂端顯示明顯的成功訊息（例如「✓ 已儲存：帳號狀態改為停權」），失敗顯示錯誤 message；訊息需在抽屜可視範圍內（必要時 scrollIntoView），數秒後可淡出但不得在使用者看到前消失。
- 按鈕送出期間 disabled 並顯示「儲存中…」，防止重複點擊。
- 帳號狀態在列表與詳情以中文顯示（active→啟用、suspended→停權），停權用明顯的警示色徽章（不得與付款狀態色共用）。
- 標籤管理、規範版本的新增／儲存／發布同樣要有可見成功提示。
H2（🔵）profileEnumLabels / profileFieldLabels 查表改用 Object.hasOwn，避免 constructor/toString 等鍵取到內建函式。
H3（🔵）enum 用語：availability_status 的 paused 顯示「暫停接案」，與 member.html 一致（可依欄位區分）。
H4（🔵）renderAgreementMarkdown 標題正則支援 #～######，level 上限對應到 h6。

AC：
- AC1 node --check platform.js。
- AC2 jsdom/Playwright mock：admin-person PATCH 成功後抽屜內出現可見成功訊息（元素 offsetParent 非 null 且在視窗內）；失敗回 400 時顯示 message；送出期間按鈕 disabled。
- AC3 列表與詳情顯示「停權」徽章。
- AC4 單元測試 H2、H4。
- AC5 新增插值皆 escapeHtml；只動 platform.js／platform.css。
回報：改動、AC1-5 證據。
