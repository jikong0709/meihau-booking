# 莓好預約站｜Visual Design System v1

工作分支：`feature/visual-design-v1`

本文件只描述 UI／UX／CSS 與前端視覺狀態。不更動資料庫、Supabase、OAuth、綠界、API secret、既定服務價格或計價公式。

## 1. 品牌視覺

方向：溫柔、生活感、乾淨、有質感、親切，但不幼稚、不企業 ERP、不過度粉紅。

- 主背景：奶油暖白
- 主品牌：低彩度莓果色
- 輔助：灰粉、暖灰
- 點綴：杏色／低彩度金色
- 出租事件：莓果灰粉
- 跑腿事件：低彩度鼠尾草綠

品牌標誌採單色莓果底，不使用滿版漸層。公開頁留白較多；會員與後台提高資訊密度。

## 2. Design Tokens

所有核心值集中在 `platform.css :root`。

### Color

- `--bg`, `--bg-warm`
- `--surface`, `--surface-raised`, `--surface-soft`, `--surface-muted`
- `--ink`, `--ink-strong`, `--muted`, `--muted-strong`
- `--berry-50` ～ `--berry-800`
- `--apricot-100`, `--apricot-300`, `--gold-500`
- `--sage-100`, `--sage-600`
- `--sky-100`, `--sky-700`
- `--line`, `--line-strong`, `--focus`
- semantic：success / warning / danger / info

### Radius

- `--radius-sm: 10px`
- `--radius-md: 14px`
- `--radius-lg: 20px`
- `--radius-xl: 28px`
- `--radius-pill: 999px`

### Spacing

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80px scale。

### Shadow

只使用 `--shadow-xs`, `--shadow-sm`, `--shadow-md`，避免重陰影與卡片漂浮感過重。

### Motion

- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
- `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
- `--duration-fast: 140ms`
- `--duration-ui: 200ms`
- `--duration-modal: 240ms`

所有 hover motion 只在 `hover:hover` + `pointer:fine` 啟用；提供 `prefers-reduced-motion` 降低動態。

## 3. Typography

- 中文 UI：`Noto Sans TC` / `PingFang TC` / `Microsoft JhengHei` fallback
- 大標題：Georgia + `Noto Serif TC` fallback，建立生活品牌感
- 金額與數字：`font-variant-numeric: tabular-nums`
- Eyebrow：小尺寸、高字距，用於區塊識別，不作大量裝飾

## 4. Button 系統

最多三級：

1. Primary `.btn`
2. Secondary `.btn.ghost`
3. Light / inverse `.btn.light`

最小 Tap Target 44px。按壓回饋 `scale(.97)`；不使用 `transition: all`。

## 5. Form UI

Input / Select / Textarea 共用：

- 44px 最小高度
- 12px 圓角
- 可見 focus ring
- readonly / disabled 差異
- `.field-error` + `.field-message` 錯誤狀態

## 6. 公開首頁

3–5 秒內先回答：這裡可預約共享辦公、創作空間與跑腿配送。

CTA 統一為：`登入會員開始預約`。

公開頁沒有正式預約表單，不提供未登入送單。

## 7. 會員中心

保留既有資訊架構，首頁主入口仍為：

- 場地出租
- 跑腿／配送
- 我的預約
- 常用地址

會員資料與設定維持次要層級。

## 8. 預約與費用結算

Desktop：右側 Sticky checkout。

Tablet / Mobile：轉成底部 Sticky Summary，直接顯示：

- 總計
- `確認訂單並前往付款`

詳細費用仍存在 DOM，Desktop 可完整查看；正式付款仍須由後端重新計價。

## 9. 管理後台

### Calendar category

- Rental：莓果灰粉
- Errand：鼠尾草綠
- 未付款事件：左側 warning emphasis，不用高彩度紅色整塊警示

### Payment badges

- `.unpaid`
- `.pending`
- `.partial`
- `.paid`
- `.refund-pending`
- `.refund`
- `.failed`

### Service badges

- `.draft`
- `.waiting-payment`
- `.confirmed`
- `.in-progress`
- `.completed`
- `.cancelled`

付款狀態與服務狀態使用不同 semantic mapping，不視為同一套業務狀態。

## 10. Modal

- 中央定位
- `role=dialog`, `aria-modal=true`, `aria-labelledby`
- 240ms ease-out
- 從 `scale(.96)` + opacity 進入，不從 `scale(0)` 出現
- reduced motion 關閉 transform motion

## 11. Loading / Empty / Error

- `.state-box`：Empty
- `.state-box.error`：Error
- `.skeleton`：Loading

管理後台提供可視範例，供未來 API 串接直接套用。

## 12. RWD

### Desktop > 1080

- sidebar 248px
- 4 欄 KPI
- 預約雙欄 + 350px checkout

### Tablet 621–820

- sidebar 轉成頂部橫向可滑導覽
- checkout 轉底部 sticky summary
- 公開頁服務卡 2 欄

### Mobile <= 620

- 單欄主要操作
- 表單單欄
- 訂單／每日排程改成兩欄資訊重排
- 公開 CTA 全寬
- 最低 44px tap target
- 月曆保留橫向捲動，避免把事件壓到不可讀

## 13. Accessibility 基本視覺

- 明確 `:focus-visible`
- 最低 44px tap target
- readonly / disabled / error 有視覺差異
- hover 不作為唯一狀態
- 狀態不只靠色彩：Badge 同時有文字；未付款月曆另有左側 emphasis
- reduced motion 支援
- Modal 有 ARIA dialog 標記

## 14. 不在本次 UI 工作範圍

- 資料庫
- Supabase
- migration
- Google OAuth 正式串接
- 綠界正式串接
- API key / secrets
- 後端 quote 驗證
- 正式 admin 權限
- 正式部署
- main 合併
