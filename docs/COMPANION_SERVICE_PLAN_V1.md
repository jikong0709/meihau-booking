# 陪工作／共同存在型服務＋服務費用表 V1｜工程規格

來源：使用者 2026-10-05 提供之《新增「陪工作／共同存在型工作空間」項目計畫書》與《服務費用列表 V1》。
原則：陪工作不是單一頁面，而是「Service → Service Type → Booking → Provider → Schedule → Price → Order」架構下的新型服務商品；價格存在資料庫，前端不得硬編碼價格。

## 1. 分類與型別

- 首頁維持四大服務（骨架定案）。第四區 `venue_equipment` 顯示名稱改為「空間／陪伴」，副標「一個人工作，也可以有人一起。」
- `booking.services` 新增 `service_type`：`recording`｜`ai_digital`｜`staff`｜`space`｜`companion`。
- 陪工作 = `category_id='venue_equipment'` + `service_type='companion'`；空間 = `service_type='space'`。

## 2. 價格欄位（對應費用表 07）

| 計畫書欄位 | 實作 |
|---|---|
| pricing_type | 既有 `price_type`（fixed／starting_from／custom_quote） |
| base_price | 既有 `price` |
| unit | 新增 `price_unit`：`session`｜`hour`｜`half_day`｜`day`｜`project` |
| minimum_duration | 新增 `included_hours`（基本價含幾小時）／`min_hours` |
| additional_hour_price | 新增 `additional_hour_price`（null＝不可加時） |
| deposit | 新增 `deposit`（V1 全為 null，金流未啟用） |
| quotation_required | 既有 `booking_type`（custom_quote＝需詢價） |
| active | 既有 `service_status` |
| 陪伴模式 | 新增 `companion_modes text[]`：`quiet`｜`low_interaction`｜`together`｜`body_doubling` |
| 需陪伴者 | 新增 `requires_provider boolean` |

計價（後端唯一來源）：
- `price_unit='hour'`：總額 = price × hours（hours ≥ min_hours）。
- 其他單位：總額 = price ＋ max(0, hours − included_hours) × additional_hour_price；additional_hour_price 為 null 時不得超過 included_hours。

## 3. 服務資料 V1

### 01 錄音／創作（recording_space）
| ID | 名稱 | 價格 | 單位 | 預約 | 狀態 |
|---|---|---|---|---|---|
| REC-001 | 錄音體驗 | 800 起 | session | direct | active（既有） |
| REC-002 | 一日歌手 | 2,300 起 | session | direct | active（既有） |
| REC-003 | 錄音室租借 | 800／小時起 | hour | direct | active |
| REC-004 | Podcast 錄製 | 1,200 起 | session | direct | active |
| REC-005 | 配音／旁白錄製 | 800 起 | session | custom_quote | active |
| REC-006 | 錄音＋後製 | 1,500 起 | session | custom_quote | active |

### 02 AI／數位（ai_digital）
| ID | 名稱 | 價格 | 單位 | 預約 | 狀態 |
|---|---|---|---|---|---|
| AI-001 | AI 簡報製作 | 150 起 | project | direct | active（既有） |
| AI-002 | 一頁式網站 | 6,000 起 | project | custom_quote | active（既有） |
| AI-003 | Excel／表單自動化 | 1,000 起 | project | custom_quote | active（既有） |
| AI-004 | AI／數位系統客製 | 3,000 起 | project | custom_quote | active（既有，補起價） |
| AI-005 | AI 工作流程規劃 | 1,500 起 | project | custom_quote | active |
| AI-006 | AI Agent／自動化規劃 | 3,000 起 | project | custom_quote | active |
| AI-007 | AI 生圖／視覺製作 | 500 起 | project | custom_quote | active |
| AI-008 | AI 內容製作 | 1,000 起 | project | custom_quote | active |

### 03 臨時人力（temporary_staff）— 全部維持人工評估詢價
| ID | 名稱 | 價格 | 單位 | 狀態 |
|---|---|---|---|---|
| MAN-001 | 活動工作人員 | 250／小時起 | hour | active |
| MAN-002 | 現場活動支援 | 300／小時起 | hour | active |
| MAN-003 | 臨時行政支援 | 300／小時起 | hour | active |
| MAN-004 | 報到／接待人員 | 300／小時起 | hour | active |
| MAN-005 | 展場／活動支援 | 300／小時起 | hour | active |
| MAN-006 | 短期專案人力 | 詢價 | project | active |
| MAN-007 | 急件支援（原 MAN-004 改編號保留） | 詢價 | project | coming_soon |

### 04 空間（venue_equipment / space）— 場地預備中，先 coming_soon
| ID | 名稱 | 價格 | 單位 |
|---|---|---|---|
| SPACE-001 | 彈性辦公座位 | 150／2 小時起 | session（included_hours 2） |
| SPACE-002 | 半日辦公空間 | 300 起 | half_day |
| SPACE-003 | 一日辦公空間 | 500 起 | day |
| SPACE-004 | 小型會議空間 | 500／小時起 | hour |
| SPACE-005 | 拍攝空間 | 800／小時起 | hour |
| SPACE-006 | 直播空間 | 800／小時起 | hour |
| SPACE-007 | 活動場地 | 1,500 起 | session（custom_quote） |
| SPACE-008 | 商務地址（原 SPACE-006 改編號保留） | 詢價 | hidden |
| SPACE-009 | 虛擬辦公（原 SPACE-007 改編號保留） | 詢價 | hidden |

### 05 陪工作（venue_equipment / companion）— 首發只開 4 項
| ID | 名稱 | 價格 | 含時數 | 加時 | 模式 | 狀態 |
|---|---|---|---|---|---|---|
| COMP-001 | 陪工作｜完全安靜 | 299 fixed | 2 | 150 | quiet | active |
| COMP-002 | 陪工作｜低互動 | 399 fixed | 2 | 200 | low_interaction | active |
| COMP-003 | 陪上班 | 499 fixed | 3 | 150 | quiet, low_interaction, together | active |
| COMP-004 | 陪讀／陪學習 | 399 fixed | 2 | 200 | quiet, low_interaction, together | coming_soon |
| COMP-005 | 陪創作 | 399 fixed | 2 | 200 | quiet, low_interaction, together | coming_soon |
| COMP-006 | Body Doubling | 499 fixed | 2 | 250 | body_doubling | active |
| COMP-007 | 陪你完成一件事 | 599 fixed | 2 | 300 | 全部 | coming_soon |
| COMP-008 | 客製陪伴 | 300／小時起 | — | — | 全部 | custom_quote，coming_soon |

加時費：計畫書僅 COMP-001 給 150；其餘為「基本價 ÷ 2」推算，使用者已於 2026-10-05 核定。

使用者 2026-10-05 核定事項：服務編號撞號改編號保留（MAN-007／SPACE-008／SPACE-009）、SPACE-001～007 先 coming_soon、上述加時費、陪工作地點「莓好工作空間（預約確認後通知地點）」與服務者「莓好」。

### 方案包（`booking.service_packages`，V1 全部 hidden，P2 才販售）
- PKG-COMP-01 單次體驗 299／1 次；PKG-COMP-04 4 次專注包 1,099；PKG-COMP-08 8 次工作包 1,999；PKG-COMP-SUB 月訂閱 1,999／月（每月 8 次、每次 2 小時）。

## 4. Provider（服務者）

- `booking.providers`（provider_id, display_name, provider_type, bio, status）；`booking.service_providers`（service_id, provider_id）。
- V1 種子：`PRV-MEIHAU`「莓好」，綁定所有 companion 服務。資料結構不得假設只有一位陪伴者。
- 訂單新增 `provider_id`（nullable）。

## 5. 訂單／預約

- 訂單新增 `booking_details jsonb`：`hours`、`companion_mode`、`work_goal`（≤500 字）。陪工作服務 `work_goal` 選填、`companion_mode` 必須屬於該服務 `companion_modes`。
- 會員可取消（`service_status` ∈ WAITING_PAYMENT／DRAFT 且未付款 → CANCELLED）與改期（同條件，改 booking_date／booking_time）。
- 後台可更新訂單 `service_status`（確認服務 CONFIRMED、進行中、完成、取消）；**不得**更新 `payment_status`（金流紅線）。

## 6. 服務規則（前台陪工作卡片／預約表單必顯示）

可以：一起工作、一起使用空間、安靜坐在附近、在指定時間一起開始、休息時間簡單交流、依需求維持安靜。
不包含：不替客戶工作、不代寫作業／報告、不代做設計、不提供心理諮商、醫療、職涯、法律／財務建議、不涉及性服務、不接受違法或危險工作。
核心：「陪工作」不是「幫工作」。

## 7. 階段

- P0（本次）：上述資料、計價、模式、工作目標、會員預約紀錄、取消／改期、後台確認、規則顯示。
- P1：Body Doubling 番茄鐘、工作紀錄、完成回報、陪伴者排班／可預約時段、不同陪伴者價格。
- P2：AI 工作助理、任務拆解、陪伴者媒合、服務者個人頁、評價、會員制、套票、月訂閱。
