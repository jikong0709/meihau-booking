工單 K｜莓好預約站每一頁安裝「主題式橫式分潤輪播」（使用者指定）
工作目錄：C:\Users\User\Documents\New project 2\莓好預約站（分支 main；git 加 `-c safe.directory=*`；不要切分支、不要 commit/push/部署、不要連正式資料庫）。不要動 supabase/、.recall/、LOGO/、output/、其他更換的美術UI/、既有 config.js。

安裝包（已解壓、SHA256 已與 SHA256SUMS.txt 核對一致，唯讀來源）：
C:\Users\User\AppData\Local\Temp\claude\C--Users-User-Documents-New-project-2------\2e5ea465-3970-4c2e-9a6d-efd2314322c9\scratchpad\affpkg\pkg
先讀其中 README.md、affiliate-carousel.snippet.html、affiliate-carousel.config.js、affiliate-carousel.js、affiliate-carousel.css、examples/minimal.html、tests/ranking.test.js；以及兩份中文說明（檔名亂碼為 zip 編碼問題，內容可讀）。另參考 C:\Users\User\Documents\New project 2\蝦皮分潤專案\_doc_staging_policy_20261006\給執行工程師_莓好生活安裝.md 的規格（橫式卡、揭露、輪播行為必須保留）。
協作/骨架定案.md 2026-10-07 段為本次定案。

要做：
1. 把 affiliate-carousel.js / .css / .config.js 三檔「原樣複製」到專案 assets/affiliate/（不得修改核心 js/css；如需新增主題只可改 config）。複製後 sha256 必須與安裝包一致（config 若有改則說明）。
2. 三個頁面 index.html、member.html、admin.html 都在 <head> 依序載入 CSS → config → JS（使用相對路徑 assets/affiliate/...，網站部署在 GitHub Pages 子路徑 /meihau-booking/，禁止用 / 開頭的絕對路徑）。
3. 每頁在頁尾（footer）之前新增一個獨立區塊 section（例如 class="affiliate-strip"，加 aria-label），內含：
   <div data-affiliate-carousel data-storefront-url="https://collshp.com/sberrychang?view=storefront" data-theme="learning-center" data-limit="12" data-site-style="meihau-booking"></div>
   admin.html 若沒有 footer，放在主要內容最後。不得改動其他既有區塊。
4. 背景 80% 透明：在 platform.css 局部加樣式，區塊背景使用網站色票的 rgba，alpha 0.2（＝80% 透明）；只作用在背景，不得對整個區塊或揭露文字套 opacity；商品卡、價格、分潤揭露、完整推薦池連結文字保持清楚可讀（對比足夠）。不得修改核心模組 CSS。
5. 主題：莓好預約站沒有對應主題鍵時使用 learning-center 並依模組回退熱門商品；回報中標示。
6. 保留：桌面左右箭頭、手機橫向滑動、5 秒自動輪播、prefers-reduced-motion、本機快取與過期備援、載入失敗說明與完整分享池連結、分潤揭露。
7. 不得影響既有功能：登入、會員中心、後台、首頁 #join 區塊；輪播載入失敗不得產生未捕捉錯誤或阻擋頁面。

AC：
- AC1 三個核心檔 sha256 與安裝包一致（列出）。
- AC2 三頁皆有載入順序 CSS→config→JS 且為相對路徑（grep 證據）；每頁恰一個 data-affiliate-carousel，位於 footer 之前（或 admin 主內容末）。
- AC3 本機靜態伺服器＋Playwright：三頁輪播區塊渲染（若外部分享池可連線則顯示商品；不可連線則顯示模組的失敗說明與完整分享池連結，兩者皆可接受並說明）；390/1440 無頁面水平溢位（輪播內部可捲動不算）；console 無未捕捉錯誤；區塊背景 computed background-color alpha=0.2，區塊本身 opacity=1，揭露文字可見。
- AC4 若安裝包有 tests/ranking.test.js，用 node 跑過並附結果。
- AC5 git diff --stat：只新增 assets/affiliate/ 三檔，修改 index.html、member.html、admin.html、platform.css。
回報：改動、AC1-5 證據、主題選擇說明。
