# 莓好預約站｜前端產品架構 v1

> 本文件只定義前端、頁面、狀態與後端介面契約。**不建立、不修改、不部署任何資料庫。**

## 1. 頁面責任

### `index.html`｜公開網站
- 公開服務介紹
- 公開價目表
- 公開規則
- 不提供預約表單
- 所有「預約」CTA 都導向 Google 登入／會員中心

### `member.html`｜會員中心
正式環境必須先通過 Google 登入才可存取。

功能：
- 基本會員資料：姓名、Google Email、手機、LINE ID、聯絡 Email
- 多組常用地址：名稱、收件人、電話、完整地址、備註、預設地址
- 我的預約／訂單
- 服務選單
- 場地出租服務
- 跑腿／配送服務
- 動態費用計算
- 固定費用結算區
- 「建立訂單並付款」入口

### `admin.html`｜管理後台
正式環境必須由後端確認 `admin` 權限，不能只靠前端隱藏。

功能：
- Dashboard：今日出租、今日跑腿、待付款、已收款
- 月曆：全部／出租／跑腿切換
- 每日排程
- 單筆排程明細
- 收款管理：未付款、付款中、部分付款、已付款、退款等
- 會員管理入口
- 服務／價格管理入口

## 2. 計價規則（目前試營運值）

### 共享辦公
- 2 小時：99
- 半日 4 小時：150
- 單日：250
- 5 日券：1,100
- 10 日券：2,000
- 月租自由座：2,800
- 月租固定座：4,000

### 錄音／Podcast
- 純錄音空間：500／hr
- 空間＋基本設備：700／hr
- 設備＋基本操作協助：1,000／hr
- 2 小時設備方案：1,300
- 4 小時設備方案：2,400

### 攝影／直播
- 純場地：600／hr
- 場地＋基本燈具：800／hr
- 場地＋攝錄設備：1,000／hr 起
- 2 小時：1,500
- 4 小時：2,800

### 化妝／更衣
- 單獨租用：300／hr
- 搭配場地：+200／hr

### 機車配送
- 0–3km：99
- 3–5km：130
- 5–8km：180
- 8–10km：220
- 10km 以上：220 + 超出公里數向上取整 × 15

### 其他跑腿費用
- 急件：配送費 +30%
- 等待：前 10 分鐘免費，其後每 10 分鐘 +50
- 額外停靠：+50／站
- 代買服務費：+80
- 純跑腿／代辦：200／小時起
- 汽車：0–3km 220；超過 3km 每公里 +20；停車與通行費另計

> 正式付款前必須由後端重新計價。禁止直接信任瀏覽器送來的總額。

## 3. Google 登入契約

前端只需要一個登入入口：

`GET /auth/google/start?return_to=/member.html`

登入成功後由後端建立／取得會員，再導回會員中心。

前端取得目前會員：

`GET /api/me`

建議回傳：

```json
{
  "id": "member_id",
  "name": "王小莓",
  "email": "google@example.com",
  "phone": "",
  "line": "",
  "contact_email": "",
  "roles": ["member"]
}
```

管理後台要求：`roles` 必須包含 `admin`。

## 4. 會員資料 API 契約

### 更新基本資料
`PATCH /api/me/profile`

```json
{
  "name": "王小莓",
  "phone": "09xxxxxxxx",
  "line": "line-id",
  "contact_email": "contact@example.com"
}
```

### 地址
- `GET /api/me/addresses`
- `POST /api/me/addresses`
- `PATCH /api/me/addresses/:id`
- `DELETE /api/me/addresses/:id`

地址欄位：

```json
{
  "label": "公司",
  "recipient": "王小莓",
  "phone": "09xxxxxxxx",
  "address": "台中市...",
  "note": "到了先打電話",
  "is_default": false
}
```

## 5. 計價 API 契約

`POST /api/quote`

前端送服務選擇，不送可信任的總額：

```json
{
  "service_id": "record-2h",
  "date": "2026-10-01",
  "time": "14:00",
  "addons": ["makeup-addon"]
}
```

配送範例：

```json
{
  "service_id": "shopping",
  "distance_km": 6.4,
  "wait_minutes": 20,
  "extra_stops": 1,
  "urgent": false,
  "goods_amount": 680,
  "pickup_address_id": "addr_1",
  "dropoff_address_id": "addr_2"
}
```

建議回傳：

```json
{
  "quote_id": "q_123",
  "lines": [
    {"label":"機車配送 6.4km","amount":180},
    {"label":"代買服務費","amount":80},
    {"label":"商品代墊","amount":680},
    {"label":"等待費","amount":50},
    {"label":"額外停靠","amount":50}
  ],
  "total": 1040,
  "expires_at": "2026-10-01T12:00:00+08:00"
}
```

## 6. 建立訂單

`POST /api/orders`

```json
{
  "quote_id": "q_123",
  "booking_date": "2026-10-01",
  "booking_time": "14:00",
  "note": "兩人錄音"
}
```

後端應回傳自己的訂單編號與**後端重新確認過的金額**。

```json
{
  "order_id": "MH261001A001",
  "payment_status": "UNPAID",
  "service_status": "WAITING_PAYMENT",
  "total": 1800
}
```

## 7. 綠界付款契約

前端不可直接持有 MerchantHashKey／MerchantHashIV。

會員按「前往付款」：

`POST /api/orders/:order_id/checkout`

後端建立綠界交易，再回傳：

```json
{
  "checkout_url": "https://..."
}
```

或回傳需要 POST 到綠界的表單 payload，由前端建立表單跳轉。

送綠界的核心概念：
- `MerchantTradeNo`：系統訂單唯一編號
- `ItemName`：由訂單明細動態組合，例如 `Podcast錄音2小時#化妝間#設備操作協助`
- `TotalAmount`：後端計算後總額，例如 `1800`

付款結果由綠界 Server-to-Server 通知後端，後端再更新付款狀態。前端不得自行把訂單改為已付款。

## 8. 狀態模型

付款狀態：
- `UNPAID`
- `PENDING`
- `PARTIAL`
- `PAID`
- `REFUND_PENDING`
- `REFUNDED`
- `FAILED`

服務狀態：
- `DRAFT`
- `WAITING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

## 9. 管理後台 API 契約

### 月曆
`GET /api/admin/calendar?month=2026-09&category=all|rental|errand`

每筆至少：

```json
{
  "id":"R001",
  "category":"rental",
  "date":"2026-09-24",
  "start_time":"15:00",
  "end_time":"17:00",
  "title":"Podcast｜張小姐",
  "payment_status":"PAID",
  "service_status":"CONFIRMED",
  "amount":1300
}
```

### 收款
`GET /api/admin/payments?status=PAID`

### 會員
`GET /api/admin/members?q=關鍵字`

### 服務／價格
- `GET /api/admin/services`
- `PATCH /api/admin/services/:id`

修改價格時，既有訂單不得跟著變價；訂單必須保留成交時的 `order_items` 快照。

## 10. 地址距離

正式跑腿計價請由後端或可信任的路線 API 計算取件→送達的實際路線距離。不要讓會員手填公里數作為正式付款依據。

目前 `member.html` 的公里輸入欄只用於前端架構展示。
