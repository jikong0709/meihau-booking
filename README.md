# 莓好預約站

獨立的會員制預約服務專案，承接光言工作室的場地出租、共享辦公、跑腿／配送與後續付款流程。

## 目前施工狀態

前端產品架構 v1 已建置於：

`feature/full-platform-v1-implementation`

目前**尚未部署、尚未串正式 Google 登入、尚未串綠界、尚未修改任何資料庫**。

## 已完成前端架構

- `index.html`：公開網站，只展示服務、價目與規則；公開預約表單已移除
- `member.html`：會員中心、基本資料、多組常用地址、我的預約、服務選單、動態計價、費用結算
- `admin.html`：管理後台、Dashboard、月曆、出租／跑腿切換、每日排程、收款分類、會員與價格管理入口
- `platform.css`：共用 RWD UI
- `platform.js`：前端 Demo 狀態、試算器、會員本機資料、管理月曆示範
- `config.example.js`：正式後端端點設定範例
- `docs/FRONTEND_ARCHITECTURE_V1.md`：完整 API／Auth／金流介面契約
- `docs/DEPLOYMENT_HANDOFF.md`：部署工程師完整交接指令

## 重要原則

1. 所有預約必須登入會員後才能進行。
2. Google 登入首次成功後由後端建立會員。
3. 會員可維護手機、LINE、聯絡 Email 與多組常用地址。
4. 前端可即時計價，但正式付款前必須由後端重新計算。
5. 綠界金流 secrets 不得進前端。
6. 管理後台正式版必須由伺服器驗證 `admin` 權限。
7. 付款狀態與服務狀態分開管理。
8. 舊訂單保留成交價快照，後台改價不能回寫舊訂單。

## 部署前

請先閱讀：

- `docs/FRONTEND_ARCHITECTURE_V1.md`
- `docs/DEPLOYMENT_HANDOFF.md`

只有使用者確認後，才由部署工程師將本分支整合到 `main` 並部署。
