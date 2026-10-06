window.AFFILIATE_CAROUSEL_CONFIG = {
  adapter: "collshp-storefront",
  defaultTheme: "learning-center",
  fetchLimit: 50,
  displayLimit: 12,
  autoplayMs: 5000,
  cacheTtlMs: 30 * 60 * 1000,
  blockedProductNameTerms: ["蝦皮", "Shopee"],
  analytics: {
    enabled: true
  },
  themes: {
    "learning-center": {
      label: "教材中心",
      keywords: [
        { term: "學習", weight: 8 },
        { term: "教材", weight: 8 },
        { term: "文具", weight: 6 },
        { term: "兒童", weight: 5 },
        { term: "書", weight: 4 },
        { term: "護眼", weight: 3 },
        { term: "收納", weight: 2 }
      ]
    },
    "english-elementary": {
      label: "英語國小",
      keywords: [
        { term: "英文", weight: 9 },
        { term: "英語", weight: 9 },
        { term: "單字", weight: 8 },
        { term: "國小", weight: 8 },
        { term: "兒童", weight: 5 },
        { term: "自然發音", weight: 7 },
        { term: "字卡", weight: 5 }
      ]
    },
    "english-junior": {
      label: "英語國中",
      keywords: [
        { term: "英文", weight: 9 },
        { term: "英語", weight: 9 },
        { term: "國中", weight: 9 },
        { term: "會考", weight: 8 },
        { term: "單字", weight: 7 },
        { term: "文法", weight: 7 },
        { term: "參考書", weight: 5 }
      ]
    },
    "math-grade-6": {
      label: "數學六年級",
      keywords: [
        { term: "數學", weight: 10 },
        { term: "六年級", weight: 10 },
        { term: "6年級", weight: 10 },
        { term: "國小", weight: 7 },
        { term: "評量", weight: 7 },
        { term: "題庫", weight: 6 },
        { term: "講義", weight: 5 }
      ]
    }
  },
  priorityProducts: {
    default: [],
    "learning-center": [],
    "english-elementary": [],
    "english-junior": [],
    "math-grade-6": []
  },
  text: {
    eyebrow: "廣告欄位｜合作購物平台",
    title: "莓好生活精選推薦",
    description: "左右滑動或使用箭頭查看更多商品。",
    loading: "正在載入推薦商品…",
    stale: "目前顯示最近一次成功同步的推薦商品。",
    failure: "推薦商品暫時無法載入，請使用下方連結查看完整分享池。",
    disclosure: "本區為廣告推薦連結；若你覺得本站提供您資訊有幫助到您，您可以透過連結購買，本站可能獲得回饋，但不影響你的購買價格。",
    storefrontLink: "點擊跳轉完整推薦池"
  }
};
