(function bootstrapAffiliateCarousel(global, factory) {
  const api = factory(global);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.AffiliateCarousel = api;
})(typeof window !== "undefined" ? window : globalThis, function createAffiliateCarousel(global) {
  "use strict";

  const CACHE_PREFIX = "portable-affiliate-carousel:";
  const adapters = new Map();
  const initializedRoots = new WeakSet();
  const instances = new WeakMap();
  const SAFE_REL = "sponsored noopener noreferrer";

  const FALLBACK_CONFIG = {
    adapter: "collshp-storefront",
    defaultTheme: "",
    fetchLimit: 50,
    displayLimit: 12,
    autoplayMs: 5000,
    cacheTtlMs: 30 * 60 * 1000,
    blockedProductNameTerms: ["蝦皮", "Shopee"],
    analytics: { enabled: true },
    themes: {},
    priorityProducts: {},
    text: {
      eyebrow: "廣告欄位｜合作購物平台",
      title: "莓好生活精選推薦",
      description: "左右滑動或使用箭頭查看更多商品。",
      loading: "正在載入推薦商品…",
      stale: "目前顯示最近一次成功同步的推薦商品。",
      failure: "推薦商品暫時無法載入，請查看完整分享池。",
      disclosure: "本區為廣告推薦連結；若你覺得本站提供您資訊有幫助到您，您可以透過連結購買，本站可能獲得回饋，但不影響你的購買價格。",
      storefrontLink: "點擊跳轉完整推薦池"
    }
  };

  function mergeConfig(localConfig) {
    const supplied = localConfig || global.AFFILIATE_CAROUSEL_CONFIG || {};
    return {
      ...FALLBACK_CONFIG,
      ...supplied,
      analytics: { ...FALLBACK_CONFIG.analytics, ...(supplied.analytics || {}) },
      blockedProductNameTerms: [...new Set([
        ...FALLBACK_CONFIG.blockedProductNameTerms,
        ...(Array.isArray(supplied.blockedProductNameTerms) ? supplied.blockedProductNameTerms : [])
      ])],
      themes: supplied.themes || {},
      priorityProducts: supplied.priorityProducts || {},
      text: { ...FALLBACK_CONFIG.text, ...(supplied.text || {}) }
    };
  }

  function extractStorefrontSuffix(storefrontUrl) {
    const parsed = new URL(storefrontUrl);
    if (parsed.protocol !== "https:") throw new Error("Storefront URL must use HTTPS");
    const suffix = parsed.pathname.split("/").filter(Boolean)[0];
    if (!suffix) throw new Error("Storefront URL is missing its public suffix");
    return suffix;
  }

  function parseSoldCount(value) {
    const raw = String(value || "").replaceAll(",", "").trim().toLowerCase();
    const match = raw.match(/([\d.]+)\s*([k千萬万]?)/i);
    if (!match) return 0;
    const multipliers = { k: 1000, "千": 1000, "萬": 10000, "万": 10000 };
    return Math.round(Number(match[1]) * (multipliers[match[2]] || 1)) || 0;
  }

  function priorityRank(item, entries) {
    const list = Array.isArray(entries) ? entries : [];
    const name = String(item.name || "").toLowerCase();
    const url = String(item.url || "").toLowerCase();
    const id = String(item.id || "").toLowerCase();
    const index = list.findIndex(entry => {
      if (typeof entry === "string") {
        const needle = entry.toLowerCase();
        return needle === id || needle === url || name.includes(needle);
      }
      if (!entry || !entry.match) return false;
      const needle = String(entry.match).toLowerCase();
      if (entry.type === "id") return id === needle;
      if (entry.type === "url") return url === needle;
      return name.includes(needle);
    });
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  }

  function relevanceScore(item, theme) {
    const haystack = `${item.name || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    const excluded = (theme?.exclude || []).some(term => haystack.includes(String(term).toLowerCase()));
    if (excluded) return 0;
    return (theme?.keywords || []).reduce((score, entry) => {
      const term = String(typeof entry === "string" ? entry : entry?.term || "").toLowerCase();
      const weight = Number(typeof entry === "string" ? 1 : entry?.weight || 1);
      return term && haystack.includes(term) ? score + weight : score;
    }, 0);
  }

  function rankProducts(items, options) {
    const source = (items || []).map((item, sourceIndex) => ({ ...item, sourceIndex }));
    const theme = options?.theme || null;
    const priority = options?.priority || [];
    const scored = source.map(item => ({
      ...item,
      relevance: relevanceScore(item, theme),
      priority: priorityRank(item, priority),
      popularity: Number(item.popularity) || parseSoldCount(item.sold)
    }));
    const hasRelevant = scored.some(item => item.relevance > 0);
    scored.sort((a, b) => {
      if (hasRelevant && b.relevance !== a.relevance) return b.relevance - a.relevance;
      if (hasRelevant && a.priority !== b.priority) return a.priority - b.priority;
      if (b.popularity !== a.popularity) return b.popularity - a.popularity;
      return a.sourceIndex - b.sourceIndex;
    });
    return { items: scored, usedPopularFallback: !hasRelevant };
  }

  function isBlockedProductName(name, terms) {
    const normalizedName = String(name || "").toLocaleLowerCase();
    return (Array.isArray(terms) ? terms : []).some(term => {
      const normalizedTerm = String(term || "").trim().toLocaleLowerCase();
      return normalizedTerm && normalizedName.includes(normalizedTerm);
    });
  }

  function filterBlockedProducts(items, terms) {
    return (Array.isArray(items) ? items : []).filter(item => !isBlockedProductName(item?.name, terms));
  }

  function readCache(key, ttlMs) {
    try {
      const cached = JSON.parse(global.localStorage.getItem(CACHE_PREFIX + key));
      if (!cached?.items?.length) return null;
      return { ...cached, fresh: Date.now() - cached.savedAt < ttlMs };
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      global.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      // Browser privacy settings may disable storage; live data can still render.
    }
  }

  function createClientIds() {
    const key = `${CACHE_PREFIX}client-id`;
    let uuid;
    try {
      uuid = global.localStorage.getItem(key);
      if (!uuid) {
        uuid = global.crypto.randomUUID();
        global.localStorage.setItem(key, uuid);
      }
    } catch {
      uuid = global.crypto.randomUUID();
    }
    return { uuId: uuid, deviceId: uuid.replaceAll("-", "").toUpperCase() };
  }

  function formatPrice(rawPrice) {
    const value = Number(rawPrice) / 100000;
    return Number.isFinite(value) ? `$${Math.round(value).toLocaleString("zh-TW")}` : "";
  }

  function registerAdapter(name, adapter) {
    if (!name || typeof adapter?.load !== "function") throw new TypeError("Adapter requires a name and load function");
    adapters.set(name, adapter);
  }

  const BASIC_INFO_QUERY = `query LandingPageBasicInfoV2Query($urlSuffix: String, $affiliateId: Long) {
    landingPageBasicInfoV2(urlSuffix: $urlSuffix, affiliateId: $affiliateId) {
      name affiliateId urlSuffix userId
    }
  }`;
  const PRODUCT_LIST_QUERY = `query StorefrontProductListQuery($urlSuffix: String, $sortType: SortType, $page: LinktreelandingpagePaginationInput, $affiliateMeta: AffiliateMetaInput, $cid: String, $language: String, $uuId: String, $deviceId: String) {
    storefrontProductList(urlSuffix: $urlSuffix, sortType: $sortType, page: $page, affiliateMeta: $affiliateMeta, cid: $cid, language: $language, uuId: $uuId, deviceId: $deviceId) {
      itemList { linkId link linkName image itemCard }
      pagination { hasMore totalCount }
    }
  }`;

  async function collshpRequest(operationName, query, variables) {
    const response = await global.fetch(`https://collshp.com/api/v3/gql/graphql?q=${operationName}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operationName, query, variables })
    });
    if (!response.ok) throw new Error(`Collshp request failed: ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0].message || "Collshp query failed");
    return payload.data;
  }

  registerAdapter("collshp-storefront", {
    async load({ storefrontUrl, limit }) {
      const suffix = extractStorefrontSuffix(storefrontUrl);
      const basic = await collshpRequest("LandingPageBasicInfoV2Query", BASIC_INFO_QUERY, { urlSuffix: suffix });
      const profile = basic.landingPageBasicInfoV2;
      if (!profile?.affiliateId || !profile?.userId) throw new Error("Affiliate profile is unavailable");
      const productData = await collshpRequest("StorefrontProductListQuery", PRODUCT_LIST_QUERY, {
        urlSuffix: suffix,
        affiliateMeta: { affiliateId: profile.affiliateId, userId: profile.userId },
        ...createClientIds(),
        cid: "tw",
        language: "zh-Hant",
        page: { offset: "0", limit: String(limit), hasMore: false, totalCount: "0" },
        sortType: "ITEM_POPULAR"
      });
      const items = (productData.storefrontProductList?.itemList || []).map((item, sourceIndex) => {
        const asset = item.itemCard?.itemCardDisplayedAsset;
        const sold = asset?.soldCount?.text || "";
        return {
          id: item.linkId,
          name: item.linkName || asset?.name || "推薦商品",
          url: item.link,
          image: item.image || asset?.image,
          price: formatPrice(asset?.displayPrice?.price),
          sold,
          discount: asset?.discountTag?.discountText || "",
          popularity: parseSoldCount(sold),
          sourceIndex
        };
      }).filter(item => item.url && item.image);
      if (!items.length) throw new Error("No affiliate products returned");
      return { items, profileName: profile.name || "推薦商品", cacheKey: suffix };
    }
  });

  function emit(root, config, name, detail) {
    const payload = {
      event_category: "affiliate_carousel",
      carousel_theme: detail.theme || "",
      product_id: detail.product?.id || "",
      product_name: detail.product?.name || "",
      destination_url: detail.product?.url || detail.storefrontUrl || "",
      ...detail.extra
    };
    root.dispatchEvent(new CustomEvent("affiliate-carousel:event", {
      bubbles: true,
      detail: { name, parameters: payload }
    }));
    if (config.analytics.enabled && typeof global.gtag === "function") global.gtag("event", name, payload);
  }

  function makeExternalLink(url, className) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = SAFE_REL;
    if (className) link.className = className;
    return link;
  }

  function renderShell(root, config, storefrontUrl) {
    root.classList.add("affiliate-carousel");
    root.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "affiliate-carousel__heading";
    const copy = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "affiliate-carousel__eyebrow";
    eyebrow.textContent = config.text.eyebrow;
    const title = document.createElement("h2");
    title.className = "affiliate-carousel__title";
    title.textContent = root.dataset.title || config.text.title;
    const description = document.createElement("p");
    description.className = "affiliate-carousel__description";
    description.textContent = root.dataset.description || config.text.description;
    copy.append(eyebrow, title, description);

    const controls = document.createElement("div");
    controls.className = "affiliate-carousel__controls";
    controls.setAttribute("aria-label", "商品輪播控制");
    const previous = document.createElement("button");
    previous.className = "affiliate-carousel__control";
    previous.type = "button";
    previous.dataset.direction = "previous";
    previous.setAttribute("aria-label", "上一組推薦商品");
    previous.textContent = "←";
    const next = document.createElement("button");
    next.className = "affiliate-carousel__control";
    next.type = "button";
    next.dataset.direction = "next";
    next.setAttribute("aria-label", "下一組推薦商品");
    next.textContent = "→";
    controls.append(previous, next);
    heading.append(copy, controls);

    const status = document.createElement("div");
    status.className = "affiliate-carousel__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = config.text.loading;
    const track = document.createElement("div");
    track.className = "affiliate-carousel__track";
    track.setAttribute("role", "list");
    track.setAttribute("aria-label", "推薦商品");

    const footer = document.createElement("div");
    footer.className = "affiliate-carousel__footer";
    const disclosure = document.createElement("small");
    disclosure.textContent = config.text.disclosure;
    const storefront = makeExternalLink(storefrontUrl, "affiliate-carousel__storefront-link");
    storefront.textContent = `${config.text.storefrontLink} ↗`;
    footer.append(disclosure, storefront);
    root.append(heading, status, track, footer);
    return { status, track, previous, next };
  }

  function createProductCard(item, onClick) {
    const article = document.createElement("article");
    article.className = "affiliate-carousel__product";
    article.setAttribute("role", "listitem");
    const link = makeExternalLink(item.url, "affiliate-carousel__product-link");
    link.setAttribute("aria-label", `${item.name}，將在新分頁開啟`);
    link.addEventListener("click", () => onClick(item));
    const media = document.createElement("div");
    media.className = "affiliate-carousel__media";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.loading = "lazy";
    image.decoding = "async";
    media.append(image);
    if (item.discount) {
      const discount = document.createElement("span");
      discount.className = "affiliate-carousel__discount";
      discount.textContent = item.discount;
      media.append(discount);
    }
    const body = document.createElement("div");
    body.className = "affiliate-carousel__product-body";
    const title = document.createElement("p");
    title.className = "affiliate-carousel__product-title";
    title.textContent = item.name;
    const meta = document.createElement("div");
    meta.className = "affiliate-carousel__meta";
    const price = document.createElement("span");
    price.className = "affiliate-carousel__price";
    price.textContent = item.price;
    const sold = document.createElement("span");
    sold.className = "affiliate-carousel__sold";
    sold.textContent = item.sold;
    meta.append(price, sold);
    body.append(title, meta);
    link.append(media, body);
    article.append(link);
    return article;
  }

  function setupInteraction(root, elements, items, context) {
    const { track, previous, next } = elements;
    const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = () => {
      const card = track.querySelector(".affiliate-carousel__product");
      return card ? card.getBoundingClientRect().width + 14 : track.clientWidth;
    };
    const updateControls = () => {
      previous.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    const render = nextItems => {
      track.replaceChildren(...nextItems.map(item => createProductCard(item, product => {
        emit(root, context.config, "affiliate_click", { ...context, product });
      })));
      track.scrollTo({ left: 0, behavior: "auto" });
      updateControls();
    };
    const move = direction => {
      if (direction > 0 && next.disabled) track.scrollTo({ left: 0, behavior: reducedMotion ? "auto" : "smooth" });
      else track.scrollBy({ left: direction * step(), behavior: reducedMotion ? "auto" : "smooth" });
    };
    previous.addEventListener("click", () => {
      move(-1);
      emit(root, context.config, "affiliate_carousel_previous", context);
    });
    next.addEventListener("click", () => {
      move(1);
      emit(root, context.config, "affiliate_carousel_next", context);
    });
    track.addEventListener("scroll", updateControls, { passive: true });
    global.addEventListener("resize", updateControls, { passive: true });
    render(items);

    if (!reducedMotion && context.config.autoplayMs >= 3000 && items.length > 1) {
      let timer;
      const stop = () => global.clearInterval(timer);
      const start = () => {
        stop();
        timer = global.setInterval(() => move(1), context.config.autoplayMs);
      };
      root.addEventListener("mouseenter", stop);
      root.addEventListener("mouseleave", start);
      root.addEventListener("focusin", stop);
      root.addEventListener("focusout", start);
      document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
      start();
    }
    return render;
  }

  function observeImpression(root, context) {
    let emitted = false;
    const report = () => {
      if (emitted) return;
      emitted = true;
      emit(root, context.config, "affiliate_impression", context);
    };
    if (typeof global.IntersectionObserver !== "function") return report();
    const observer = new global.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        report();
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(root);
  }

  async function initialize(root, localConfig) {
    if (!root || initializedRoots.has(root)) return;
    initializedRoots.add(root);
    const config = mergeConfig(localConfig);
    const storefrontUrl = root.dataset.storefrontUrl;
    const themeKey = root.dataset.theme || config.defaultTheme;
    const theme = config.themes[themeKey] || null;
    const priority = config.priorityProducts[themeKey] || config.priorityProducts.default || [];
    const displayLimit = Math.max(1, Number(root.dataset.limit) || config.displayLimit);
    const elements = renderShell(root, config, storefrontUrl);
    const context = { config, storefrontUrl, theme: themeKey };
    try {
      extractStorefrontSuffix(storefrontUrl);
      const adapterName = root.dataset.adapter || config.adapter;
      const adapter = adapters.get(adapterName);
      if (!adapter) throw new Error(`Unknown affiliate adapter: ${adapterName}`);
      const cacheKey = `${adapterName}:${storefrontUrl}`;
      const cached = readCache(cacheKey, config.cacheTtlMs);
      let result;
      let stale = false;
      if (cached?.fresh) {
        result = cached;
      } else {
        try {
          result = await adapter.load({ storefrontUrl, limit: config.fetchLimit, root, config });
          writeCache(cacheKey, result);
        } catch (error) {
          if (!cached) throw error;
          result = cached;
          stale = true;
        }
      }
      const eligibleItems = filterBlockedProducts(result.items, config.blockedProductNameTerms);
      if (!eligibleItems.length) throw new Error("No eligible affiliate products after compliance filtering");
      const ranked = rankProducts(eligibleItems, { theme, priority });
      const items = ranked.items.slice(0, displayLimit);
      const render = setupInteraction(root, elements, items, context);
      instances.set(root, { config, context, rawItems: eligibleItems, render, displayLimit });
      elements.status.hidden = !stale;
      if (stale) elements.status.textContent = config.text.stale;
      root.dataset.fallback = ranked.usedPopularFallback ? "popular" : "theme";
      observeImpression(root, context);
    } catch (error) {
      console.warn("Affiliate carousel unavailable", error);
      elements.status.textContent = config.text.failure;
      root.dataset.state = "fallback";
    }
  }

  function setTheme(target, themeKey) {
    const root = typeof target === "string" ? document.querySelector(target) : target;
    if (!root) return false;
    root.dataset.theme = themeKey;
    const instance = instances.get(root);
    if (!instance) return false;
    const { config, context, rawItems, render, displayLimit } = instance;
    context.theme = themeKey;
    const theme = config.themes[themeKey] || null;
    const priority = config.priorityProducts[themeKey] || config.priorityProducts.default || [];
    const ranked = rankProducts(rawItems, { theme, priority });
    render(ranked.items.slice(0, displayLimit));
    root.dataset.fallback = ranked.usedPopularFallback ? "popular" : "theme";
    return true;
  }

  function initializeAll(selector, localConfig) {
    if (typeof document === "undefined") return [];
    const roots = [...document.querySelectorAll(selector || "[data-affiliate-carousel]")];
    roots.forEach(root => initialize(root, localConfig));
    return roots;
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => initializeAll(), { once: true });
    } else {
      initializeAll();
    }
  }

  return {
    initialize,
    initializeAll,
    setTheme,
    registerAdapter,
    rankProducts,
    isBlockedProductName,
    filterBlockedProducts,
    extractStorefrontSuffix,
    parseSoldCount
  };
});
