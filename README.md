# 莓好預約站

獨立的會員制服務系統，承接光言工作室的錄音體驗、AI／數位服務、臨時人力與後續場地／設備服務。

## 目前施工狀態

正式站使用 GitHub Pages、Supabase、Google 登入與 `booking-api` Edge Function。

- Production：`https://jikong0709.github.io/meihau-booking/`
- Supabase project：`tssvabclujwpljzupuvj`
- 付款：尚未啟用；建立訂單不代表已付款
- 正式服務來源：`booking.services`
- 詢價來源：`booking.service_inquiries`

## 已完成前端架構

- `index.html`：公開網站，展示正式服務、起價／客製報價與預約／詢價分流
- `member.html`：會員中心、基本資料、多組常用地址、我的預約、我的詢價與動態服務選單
- `admin.html`：管理後台、月曆、訂單、收款、正式服務資料與詢價管理
- `platform.css`：共用 RWD UI
- `platform.js`：Google 登入、會員／地址／訂單、服務目錄、後端計價與詢價流程
- `supabase/functions/booking-api/`：驗證 direct booking／custom quote、服務端計價與 Admin 權限
- `supabase/migrations/20260930055848_service_system_v1.sql`：服務、加購、需求選項、詢價、RLS 與舊服務相容
- `config.example.js`：正式後端端點設定範例
- `docs/FRONTEND_ARCHITECTURE_V1.md`：完整 API／Auth／金流介面契約
- `docs/DEPLOYMENT_HANDOFF.md`：部署工程師完整交接指令

## 重要原則

1. 所有預約必須登入會員後才能進行。
2. Google 登入首次成功後由後端建立會員。
3. 會員可維護手機、LINE、聯絡 Email 與多組常用地址。
4. direct booking 金額只由後端服務資料計算；custom quote 不得建立固定金額訂單。
5. 綠界金流 secrets 不得進前端。
6. 管理後台正式版必須由伺服器驗證 `admin` 權限。
7. 付款狀態與服務狀態分開管理。
8. 舊訂單保留成交價快照，後台改價不能回寫舊訂單。

## 部署與驗收

請先閱讀：

- `docs/FRONTEND_ARCHITECTURE_V1.md`
- `docs/DEPLOYMENT_HANDOFF.md`

任何 production 變更都先鎖定遠端 `main` 與 rollback tag，再依序驗證 migration、Edge Function、GitHub Pages 與正式站；Google 帳號與 Admin 真實操作由使用者親自完成。
