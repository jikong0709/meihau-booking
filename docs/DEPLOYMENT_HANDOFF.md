# 莓好預約站｜部署／後端串接交接指令

> 目前施工分支：`feature/full-platform-v1-implementation`
>
> **目前只完成前端產品架構，不要先把資料庫 schema、Supabase、金流或 Google Auth 當成已完成。**

---

## A. 取得這版程式

部署工程師在本機專案執行：

```bash
git fetch origin
git checkout feature/full-platform-v1-implementation
git pull origin feature/full-platform-v1-implementation
```

確認：

```bash
git status
git log -1 --oneline
```

不要直接覆蓋其他 Repository。

---

## B. 本機預覽

任一靜態伺服器即可，例如：

```bash
py -m http.server 8080
```

或：

```bash
python -m http.server 8080
```

預覽：

- 公開頁：`http://localhost:8080/index.html`
- 會員中心：`http://localhost:8080/member.html?demo=1`
- 管理後台：`http://localhost:8080/admin.html`

目前會員／後台是前端 Demo，不代表正式權限已完成。

---

## C. 上正式環境前的必要串接

部署工程師先讀：

`docs/FRONTEND_ARCHITECTURE_V1.md`

前端需要後端提供以下能力：

1. Google 登入／登出
2. 目前會員 `/api/me`
3. 會員基本資料更新
4. 多組常用地址 CRUD
5. 正式後端計價 `/api/quote`
6. 建立訂單 `/api/orders`
7. 建立付款 `/api/orders/:id/checkout`
8. 會員訂單／預約查詢
9. 管理員月曆
10. 管理員收款列表
11. 管理員會員搜尋
12. 管理員服務／價格管理

前端目前的 `platform.js` 內建 Demo 計價只是 UI 預覽。**正式金額必須以後端回傳為準。**

---

## D. Google 登入

正式環境不要讓 `member.html` 直接當成已登入。

預期流程：

```text
公開頁
→ /auth/google/start
→ Google OAuth
→ 後端 callback
→ 首次登入建立會員
→ 回 member.html
→ member.html 呼叫 /api/me
```

若 `/api/me` 回 401：

```text
member.html → 導回公開首頁或 Google 登入
```

若進入 `admin.html`，後端必須確認：

```text
roles includes "admin"
```

不是 admin 就回 403。

> 只在 JavaScript 裡把後台按鈕隱藏不算權限保護。

---

## E. 前端 Runtime 設定

目前前端讀取：

`config.example.js`

正式部署前可直接把這個檔案改成正式「非秘密」端點設定，或由工程師改名為 `config.js` 並同步更新三個 HTML 的 script 引用。

範例：

```js
window.MEIHAU_CONFIG = {
  mode: 'production',
  auth: {
    googleLoginUrl: 'https://YOUR-BACKEND/auth/google/start?return_to=/member.html',
    logoutUrl: 'https://YOUR-BACKEND/auth/logout'
  },
  api: {
    me: 'https://YOUR-BACKEND/api/me',
    profile: 'https://YOUR-BACKEND/api/me/profile',
    addresses: 'https://YOUR-BACKEND/api/me/addresses',
    quote: 'https://YOUR-BACKEND/api/quote',
    orders: 'https://YOUR-BACKEND/api/orders',
    checkout: 'https://YOUR-BACKEND/api/orders/{id}/checkout',
    adminCalendar: 'https://YOUR-BACKEND/api/admin/calendar',
    adminPayments: 'https://YOUR-BACKEND/api/admin/payments',
    adminMembers: 'https://YOUR-BACKEND/api/admin/members',
    adminServices: 'https://YOUR-BACKEND/api/admin/services'
  }
};
```

**不要把以下內容寫進任何前端 JS：**

- 資料庫 service role key
- Google OAuth client secret
- 綠界 MerchantHashKey
- 綠界 MerchantHashIV
- 任何私密 API token

這些只能存在伺服器端環境變數。

---

## F. 把 Demo 資料改成正式 API

目前：

- 會員資料：localStorage
- 常用地址：localStorage
- 訂單：畫面示範資料
- 管理月曆：`demoEvents`
- 收款：`demoEvents`

正式串接時請把 `platform.js` 中上述 Demo 資料來源替換為 API 呼叫，UI 結構可以保留。

### 會員中心必要行為

```text
GET /api/me
GET /api/me/addresses
PATCH /api/me/profile
POST /api/me/addresses
PATCH /api/me/addresses/:id
DELETE /api/me/addresses/:id
```

### 預約結算必要行為

```text
前端選服務
→ POST /api/quote
→ 後端回 item lines + total
→ 使用者確認
→ POST /api/orders
→ 後端建立訂單
→ POST /api/orders/:id/checkout
→ 跳綠界
```

---

## G. 跑腿里程

目前 Demo 是會員手動填公里數，只是為了展示計算器。

正式版必須改成：

```text
取件地址 + 送達地址
→ 後端／路線服務算實際騎車／開車路線
→ 後端得到 distance_km
→ 後端套正式計價
→ 回傳 quote
```

不要把使用者手填 km 當正式付款依據。

---

## H. 綠界付款

金流一定由後端產生，不由瀏覽器計算 CheckMacValue 或持有秘密金鑰。

流程：

```text
order_id
→ 後端重新讀取訂單與 order_items
→ 後端確認 TotalAmount
→ 後端建立綠界交易
→ 使用者前往綠界付款
→ 綠界 ReturnURL / webhook 通知後端
→ 後端驗證通知
→ payment_status = PAID
→ service_status = CONFIRMED
```

### 動態 ItemName

場地範例：

```text
Podcast錄音2小時#化妝間#設備操作協助
```

配送範例：

```text
機車配送6.4km#代買服務#等待費
```

### 金額來源

`TotalAmount` 必須由後端自己的訂單明細加總，不接受前端傳入的 total 作為可信任金額。

### 自訂金額付款

保留給：

- 補尾款
- 追加費用
- 特殊報價
- 停車費／通行費等事後差額

正常預約不要讓客戶自己輸入付款金額。

---

## I. 管理後台

`admin.html` 已有以下前端畫面：

- Dashboard
- 月曆模式
- 全部／出租／跑腿篩選
- 單日排程
- 單筆排程明細
- 收款狀態篩選
- 會員搜尋入口
- 服務／價格管理入口

正式 API：

```text
GET /api/admin/calendar?month=YYYY-MM&category=all|rental|errand
GET /api/admin/payments?status=...
GET /api/admin/members?q=...
GET /api/admin/services
PATCH /api/admin/services/:id
```

每一支 `/api/admin/*` 都必須由伺服器驗證管理員身份。

---

## J. 正式部署前驗收

至少完成以下測試：

```text
[ ] 未登入不能建立預約
[ ] 未登入不能取得會員資料
[ ] 一般會員不能讀 admin API
[ ] 首次 Google 登入會建立會員
[ ] 會員可更新手機／LINE／聯絡 Email
[ ] 會員可建立多個常用地址
[ ] 場地費用由後端計算
[ ] 跑腿距離由可信任來源計算
[ ] 前端自行竄改金額不會影響後端 total
[ ] 訂單保留成交當下 item 快照
[ ] 綠界付款成功才標記 PAID
[ ] 付款失敗不成立 CONFIRMED 預約
[ ] 月曆可分全部／出租／跑腿
[ ] 每日排程可開單筆內容
[ ] 已付款／未付款／部分付款可篩選
[ ] 手機版會員結算區可正常使用
```

---

## K. Merge 到 main（只有使用者核准後才做）

部署工程師先確保 `main` 沒有別人新的未整合改動：

```bash
git fetch origin
git checkout main
git pull origin main
git merge --no-ff origin/feature/full-platform-v1-implementation
```

確認 diff：

```bash
git status
git diff HEAD~1..HEAD --stat
```

再 push：

```bash
git push origin main
```

如果有衝突，停止部署，不要使用 `--force`。

---

## L. 靜態預覽部署（可選）

若只是給使用者驗收 UI，可使用 GitHub Pages／其他靜態主機部署此分支。

但正式會員與管理後台上線前，仍須完成 Auth、API、Admin 權限與金流。

如果正式站仍使用 GitHub Pages：
- 公開 HTML 可以放 Pages
- 所有會員資料與 admin 資料必須由受保護 API 提供
- `admin.html` 的 HTML 本身可能被任何人下載，因此不可在 HTML／JS 放任何秘密或敏感資料

若希望 `/admin` 頁面本身也在伺服器層阻擋未授權使用者，請改用支援 middleware／server route guard 的部署平台。

---

## M. 不要做的事

- 不要從這份前端規格自行重建另一套資料庫
- 不要把 secrets commit 到 GitHub
- 不要把前端試算當正式收款金額
- 不要讓綠界成功頁面直接把訂單標記 PAID
- 不要把 admin 權限做成純前端布林值
- 不要刪除既有資料庫／Supabase／部署設定
- 不要 `git push --force` 到 main
