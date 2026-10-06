工單 F｜規範全文排版（純前端）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（目前分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。只動 platform.js（必要時 platform.css）。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/。

問題：member.html「我的合作角色」與 admin.html「規範版本 → 查看內容」顯示規範 body_md 時原樣輸出 Markdown 符號（`## 2. 服務提供者規範`、`### 條文`、`**第 1 條　定義**`），會員看起來很亂。

要做：在 platform.js 新增一個安全的極簡 Markdown 轉換函式（例如 renderAgreementMarkdown），兩處都改用它：
1. 先對整段文字 escapeHtml（沿用既有函式），之後才做轉換；絕不讓原文 HTML 生效。
2. 支援：`#`/`##`/`###` 開頭行 → 標題元素（規範內最大用 h4/h5 等，避免破壞頁面階層）；標題文字去掉開頭編號如「2. 」「2、」；`**文字**` → <strong>；`- ` 或 `* ` 開頭 → 清單項；空行分段；其餘行保留換行。
3. 若第一個標題與規範 title 重複（例如「服務提供者規範」），可省略該標題。
4. 加少量 CSS 讓條文易讀（行距、標題間距），沿用 UI v2 色系。

AC：
- AC1 node --check platform.js。
- AC2 node 腳本單元測試轉換函式：含 `## 2. 服務提供者規範`、`### 條文`、`**第 1 條　定義**`、清單、空行、以及 `<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`**<b>x</b>**` → 輸出無任何未轉義的 < >（除函式自己產生的標籤），列輸入輸出。
- AC3 grep 確認 member 與 admin 兩處規範顯示都改用新函式。
- AC4 只動 platform.js／platform.css。
回報：改動、AC1-4 證據。
