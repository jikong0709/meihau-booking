const cfg = window.MEIHAU_CONFIG || { mode: 'mock', auth: {}, api: {} };

// 僅供 config 缺失時的離線相容示範；production 服務一律由 booking.services 載入。
const legacyDemoCatalog = [
  {id:'demo-rental',category:'rental',service:'場地服務',name:'請切換正式模式查看 API 價格'},
  {id:'demo-errand',category:'errand',service:'人力服務',name:'請切換正式模式查看 API 價格'}
];

const money = n => `NT$ ${Math.round(Number(n)||0).toLocaleString('zh-TW')}`;
const priceLabel = (item) => {
  if (item.pricing_type === "quote") return item.price_note || "依需求報價";
  if (item.pricing_type === "current_campaign") return item.price_note || "依當期方案公告";
  if (item.pricing_type === "contact") return item.price_note || "請先提交需求";
  if (item.pricing_type === "fixed" && item.price !== null) return money(item.price).replace("NT$ ", "NT$");
  if (item.price_type === "custom_quote" || item.price === null) return "客製報價";
  const amount = money(item.price).replace("NT$ ", "NT$");
  const unit = item.price_unit === "hour" ? "／小時" : item.price_unit === "half_day" ? "／半日" : item.price_unit === "day" ? "／日" : item.price_unit === "project" ? "／專案" : item.included_hours ? `／${item.included_hours} 小時` : "";
  return `${amount}${unit}${item.price_type === "starting_from" ? "起" : ""}`;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const safeHttpUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
const phase2StatusLabel = {
  draft: "草稿", pending: "審核中", pending_review: "審核中", approved: "已核准", rejected: "未通過",
  withdrawn: "已撤回", verified: "已驗證", expired: "已到期", revoked: "已撤銷", published: "已發布",
  hidden: "已隱藏", suspended: "已停權", inactive: "已停用", proposed: "待確認", partially_confirmed: "單方已確認",
  confirmed: "雙方已確認", declined: "已拒絕", cancelled: "已取消", disputed: "爭議中", closed: "已結案",
  open: "待處理", reviewing: "處理中", resolved: "已處理", dismissed: "不受理", scheduled: "已排程",
  active: "曝光中", paused: "已暫停", ended: "已結束", retired: "已退役",
};
const phase2Status = (status) => `<span class="badge neutral">${escapeHtml(phase2StatusLabel[status] || status || "—")}</span>`;
const phase2Items = (payload, ...keys) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};
const phase2Date = (value) => value ? new Date(value).toLocaleString("zh-TW") : "—";

function renderAgreementMarkdown(value, title = "") {
  const lines = escapeHtml(value).replace(/\r\n?/g, "\n").split("\n");
  const escapedTitle = escapeHtml(title).trim();
  const output = [];
  let paragraph = [];
  let listItems = [];
  let firstHeadingSeen = false;
  const renderInline = (text) => text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    output.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const headingText = heading[2].replace(/^\s*\d+(?:\.\d+)*(?:[.．、）)]|\s+)\s*/, "").trim();
      const isRepeatedTitle = !firstHeadingSeen && headingText === escapedTitle;
      firstHeadingSeen = true;
      if (!isRepeatedTitle) {
        const level = Math.min(6, heading[1].length + 3);
        output.push(`<h${level}>${renderInline(headingText)}</h${level}>`);
      }
      return;
    }
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    flushList();
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return output.join("");
}

function readStore(key,fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function writeStore(key,value){ localStorage.setItem(key,JSON.stringify(value)); }

function initPublic(){
  document.querySelectorAll('[data-login]').forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    if(cfg.auth?.googleLoginUrl){ location.href=cfg.auth.googleLoginUrl; return; }
    location.href='member.html?demo=1';
  }));
  document.querySelectorAll('[data-join]').forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    if(cfg.auth?.googleLoginUrl){ location.href=cfg.auth.googleLoginUrl; return; }
    location.href=joinMemberUrl;
  }));
}

function initMember(){
  const sections=[...document.querySelectorAll('[data-section]')];
  const nav=[...document.querySelectorAll('[data-show]')];
  function show(id){ sections.forEach(s=>s.classList.toggle('hidden',s.dataset.section!==id)); nav.forEach(n=>n.classList.toggle('active',n.dataset.show===id)); }
  nav.forEach(n=>n.addEventListener('click',()=>show(n.dataset.show)));
  show(sections.some((section) => `#${section.dataset.section}` === location.hash) ? location.hash.slice(1) : 'home');

  const profile=readStore('meihau-profile',{name:'測試會員',email:'demo@example.com',phone:'',line:'',contactEmail:''});
  ['name','email','phone','line','contactEmail'].forEach(k=>{const el=document.querySelector(`[name="${k}"]`);if(el)el.value=profile[k]||''});
  const profileForm=document.querySelector('#profileForm');
  profileForm?.addEventListener('submit',e=>{e.preventDefault(); const data=Object.fromEntries(new FormData(profileForm)); writeStore('meihau-profile',data); document.querySelector('#profileStatus').textContent='已儲存在本機示範資料';});

  let addresses=readStore('meihau-addresses',[{id:crypto.randomUUID(),label:'住家',recipient:'',phone:'',address:'台中市北屯區（示範地址）',note:'',isDefault:true}]);
  const list=document.querySelector('#addressList');
  function renderAddresses(){
    list.innerHTML=addresses.map(a=>`<div class="address-card"><strong>${a.label}${a.isDefault?' · 預設':''}</strong><div class="muted">${a.recipient||'未填收件人'} · ${a.phone||'未填電話'}</div><div>${a.address}</div><div class="muted">${a.note||''}</div><button class="btn ghost small" data-del-address="${a.id}">刪除</button></div>`).join('')||'<p class="muted">尚未新增常用地址</p>';
    list.querySelectorAll('[data-del-address]').forEach(b=>b.addEventListener('click',()=>{addresses=addresses.filter(a=>a.id!==b.dataset.delAddress);writeStore('meihau-addresses',addresses);renderAddresses();fillAddressOptions();}));
  }
  const addressForm=document.querySelector('#addressForm');
  addressForm?.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(addressForm));addresses.push({id:crypto.randomUUID(),...d,isDefault:false});writeStore('meihau-addresses',addresses);addressForm.reset();renderAddresses();fillAddressOptions();});

  const serviceMenu=document.querySelector('#serviceMenu');
  const planSelect=document.querySelector('#planSelect');
  let activeCategory='rental';
  const categories=[['rental','場地出租'],['errand','跑腿／配送']];
  serviceMenu.innerHTML=categories.map(([id,label])=>`<button class="service-choice ${id==='rental'?'active':''}" data-cat="${id}"><strong>${label}</strong><div class="muted">${id==='rental'?'共享辦公、錄音、攝影、化妝':'機車、汽車、代買、代辦'}</div></button>`).join('');
  serviceMenu.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.cat;serviceMenu.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('active',x===b));renderPlans();}));
  function renderPlans(){
    const items=legacyDemoCatalog.filter(x=>x.category===activeCategory);
    planSelect.innerHTML=items.map(x=>`<option value="${x.id}">${x.service}｜${x.name}</option>`).join('');
    document.querySelector('#errandInputs')?.classList.toggle('hidden',activeCategory!=='errand');
    calc();
  }

  const pickup=document.querySelector('#pickupAddress');
  const dropoff=document.querySelector('#dropoffAddress');
  function fillAddressOptions(){
    const opts=['<option value="">請選擇常用地址或輸入新地址</option>',...addresses.map(a=>`<option value="${a.address}">${a.label}｜${a.address}</option>`)].join('');
    if(pickup)pickup.innerHTML=opts;if(dropoff)dropoff.innerHTML=opts;
  }

  const calcIds=['planSelect','distanceKm','waitMinutes','extraStops','shoppingAmount','urgentFlag'];
  calcIds.forEach(id=>document.querySelector('#'+id)?.addEventListener('input',calc));
  function calc(){
    document.querySelector('#checkoutLines').innerHTML='<p class="muted">示範模式不提供價格；正式價格只從 API 載入。</p>';
    document.querySelector('#checkoutTotal').textContent='尚未載入';
    document.querySelector('#checkoutButton').disabled=true;
  }
  document.querySelector('#checkoutButton')?.addEventListener('click',()=>{
    alert('目前為前端架構版：此按鈕預留給「建立訂單 → 綠界付款」API。部署工程師串接後才會送出正式訂單。');
  });
  renderAddresses();fillAddressOptions();renderPlans();
}

const demoEvents=[];

function initAdmin(){
  let filter='all';
  const tabs=[...document.querySelectorAll('[data-calendar-filter]')];
  tabs.forEach(t=>t.addEventListener('click',()=>{filter=t.dataset.calendarFilter;tabs.forEach(x=>x.classList.toggle('active',x===t));renderCalendar();}));
  const paymentFilter=document.querySelector('#paymentFilter');
  paymentFilter?.addEventListener('change',renderPayments);
  function renderCalendar(){
    const root=document.querySelector('#calendar'); if(!root)return;
    const year=2026,month=8; const first=new Date(year,month,1);const days=new Date(year,month+1,0).getDate();
    const names=['日','一','二','三','四','五','六'];let html=names.map(n=>`<div class="cal-head">${n}</div>`).join('');
    for(let i=0;i<first.getDay();i++)html+='<div class="cal-day"></div>';
    for(let d=1;d<=days;d++){
      const date=`2026-09-${String(d).padStart(2,'0')}`;const events=demoEvents.filter(e=>e.date===date&&(filter==='all'||e.category===filter));
      html+=`<div class="cal-day" data-day="${date}"><strong>${d}</strong>${events.map(e=>`<button class="event ${e.category} ${e.payment==='unpaid'?'unpaid':''}" data-event="${e.id}">${e.time} ${e.title}</button>`).join('')}</div>`;
    }
    root.innerHTML=html;
    root.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>openEvent(b.dataset.event)));
    root.querySelectorAll('[data-day]').forEach(d=>d.addEventListener('dblclick',()=>renderDay(d.dataset.day)));
  }
  function openEvent(id){const e=demoEvents.find(x=>x.id===id);if(!e)return;const m=document.querySelector('#eventModal');document.querySelector('#eventModalBody').innerHTML=`<h3>${e.title}</h3><p>${e.date} ${e.time}</p><p>${e.detail}</p><p>金額：<strong>${money(e.amount)}</strong></p><p>付款：${e.payment==='paid'?'已付款':e.payment==='partial'?'部分付款':'未付款'}</p>`;m.hidden=false;}
  document.querySelector('#closeModal')?.addEventListener('click',()=>document.querySelector('#eventModal').hidden=true);
  function renderDay(date){const rows=demoEvents.filter(e=>e.date===date);document.querySelector('#dayTitle').textContent=`${date} 每日排程`;document.querySelector('#daySchedule').innerHTML=rows.map(e=>`<div class="schedule-row"><strong>${e.time} ${e.title}</strong><span>${e.detail}</span><span>${money(e.amount)}</span><span class="badge ${e.payment==='paid'?'ok':e.payment==='partial'?'warn':'danger'}">${e.payment==='paid'?'已付款':e.payment==='partial'?'部分付款':'未付款'}</span></div>`).join('')||'<p class="muted">當日無排程</p>';
  }
  function renderPayments(){const f=paymentFilter?.value||'all';const rows=demoEvents.filter(e=>f==='all'||e.payment===f);document.querySelector('#paymentRows').innerHTML=rows.map(e=>`<tr><td>${e.id}</td><td>${e.title}</td><td>${e.date} ${e.time}</td><td>${money(e.amount)}</td><td><span class="badge ${e.payment==='paid'?'ok':e.payment==='partial'?'warn':'danger'}">${e.payment==='paid'?'已付款':e.payment==='partial'?'部分付款':'未付款'}</span></td></tr>`).join('');}
  renderCalendar();renderDay('2026-09-24');renderPayments();
}

let productionClient;
async function getProductionClient() {
  if (productionClient) return productionClient;
  const response = await fetch(cfg.runtimeConfigUrl);
  if (!response.ok) throw new Error("無法載入登入設定");
  const runtime = await response.json();
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.57.4");
  productionClient = createClient(runtime.supabaseUrl, runtime.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return productionClient;
}
function showAccountSuspended() {
  const page = document.body?.dataset.page;
  if (!["member", "admin"].includes(page) || document.querySelector("#accountSuspendedNotice")) return;
  const notice = document.createElement("main");
  notice.id = "accountSuspendedNotice";
  notice.className = "main";
  notice.innerHTML = `<section class="state-box error" role="alert"><h1>此帳號已停權</h1><p>此帳號已停權，如有疑問請聯繫莓好客服。</p><button type="button" class="btn primary" data-suspended-switch-account>登出</button></section>`;
  document.body.replaceChildren(notice);
  notice.querySelector("[data-suspended-switch-account]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "正在登出…";
    const client = await getProductionClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) {
      button.disabled = false;
      button.textContent = "登出";
      alert(`目前無法登出：${error.message}`);
      return;
    }
    location.replace("index.html?login=1");
  });
}
async function api(action, options = {}) {
  const client = await getProductionClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("LOGIN_REQUIRED");
  const response = await fetch(`${cfg.apiBase}?action=${encodeURIComponent(action)}${options.query || ""}`, {
    method: options.method || "GET",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || data.error || "API_ERROR");
    error.code = data.error;
    if (data.error === "account_suspended") showAccountSuspended();
    throw error;
  }
  return data;
}
const privilegedRoles = new Set(["admin", "developer"]);
const isPrivilegedMember = (member) => privilegedRoles.has(member?.role);
const destinationForMember = (member) => isPrivilegedMember(member) ? "admin.html" : "member.html";
const memberFromMe = (payload) => payload?.member || payload;
const roleStatusMeta = {
  pending: ["審核中", "role-st-pending"], approved: ["已通過", "role-st-approved"],
  rejected: ["未通過", "role-st-rejected"], inactive: ["已停用", "role-st-inactive"],
};
const roleName = { member: "一般會員", provider: "服務提供者", partner: "合作夥伴", resource_seeker: "資源需求者" };
const normalizeList = (payload, key) => Array.isArray(payload) ? payload : (payload?.[key] || []);
const normalizeTag = (tag = {}) => ({
  ...tag,
  name: tag.name ?? tag.tags?.name ?? "",
  tag_type: tag.tag_type ?? tag.tags?.tag_type ?? "",
  slug: tag.slug ?? tag.tags?.slug ?? "",
});
const profileForRole = (roleKey, roleData = {}) => ({
  provider: roleData.provider,
  partner: roleData.partner,
  resource_seeker: roleData.seeker,
})[roleKey];
const displayRoleStatusMeta = (role, roleData = {}) => (
  role?.status === "inactive" && ["provider", "partner", "resource_seeker"].includes(role.role_key) && !profileForRole(role.role_key, roleData)
    ? ["未申請", "role-st-inactive"]
    : (roleStatusMeta[role?.status] || [role?.status || "—", "role-st-inactive"])
);
const joinMemberUrl = "member.html?mode=member#roles";
async function initProductionPublic() {
  const client = await getProductionClient();
  const { data: { session } } = await client.auth.getSession();
  let currentMember = null;
  if (session) {
    try { currentMember = memberFromMe(await api("me")); } catch (error) { console.warn("Unable to resolve signed-in destination", error); }
  }
  const roleLabel = currentMember?.role === "developer" ? "進入開發者後台" : currentMember?.role === "admin" ? "進入管理後台" : "進入會員中心";
  if (currentMember) {
    // Header keeps a single role entry button (solid primary); the ghost login button is hidden.
    const ghostLogin = document.querySelector(".desktop-login");
    if (ghostLogin) { ghostLogin.hidden = true; ghostLogin.style.display = "none"; }
    [document.querySelector(".header-actions > .btn.small:not(.desktop-login)"), document.querySelector(".hero-copy .btn[data-login]")]
      .filter(Boolean)
      .forEach((button) => { button.childNodes[0].textContent = `${roleLabel} `; });
  }
  document.querySelectorAll("[data-login]").forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const { data: { session: activeSession } } = await client.auth.getSession();
      if (activeSession) {
        const member = currentMember || memberFromMe(await api("me"));
        location.href = destinationForMember(member);
        return;
      }
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: cfg.redirectUrl } });
      if (error) throw error;
    } catch (error) { alert(error.code === "account_suspended" ? error.message : `目前無法啟動 Google 登入：${error.message}`); }
  }));
  document.querySelectorAll("[data-join]").forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const { data: { session: activeSession } } = await client.auth.getSession();
      if (activeSession) { location.href = joinMemberUrl; return; }
      const redirect = new URL(cfg.redirectUrl, location.href);
      redirect.searchParams.set("mode", "member");
      redirect.hash = "roles";
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect.href } });
      if (error) throw error;
    } catch (error) { alert(error.code === "account_suspended" ? error.message : `目前無法啟動 Google 登入：${error.message}`); }
  }));
  await Promise.all([initMatchingHomeFeed(), initResourcesHomeFeed()]);
}
async function requireSession() {
  const client = await getProductionClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.replace("index.html?login=required"); throw new Error("LOGIN_REQUIRED"); }
  return { client, session };
}
function bindAccountSwitch(client) {
  document.querySelectorAll("[data-switch-account]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "正在登出…";
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) {
      button.disabled = false;
      button.textContent = "登出";
      alert(`目前無法登出：${error.message}`);
      return;
    }
    location.replace("index.html?login=1");
  }));
}

function renderChoiceChips(root, items, selectedIds, name, valueKey = "tag_id", labelKey = "name") {
  if (!root) return;
  root.innerHTML = items.map((item) => {
    const value = String(item[valueKey] ?? "");
    return `<label class="chip"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${selectedIds.has(value) ? "checked" : ""} /><span>${escapeHtml(item[labelKey])}</span></label>`;
  }).join("") || '<span class="muted">目前沒有可選項目</span>';
}

function setupListEditor(root, values = [], options = {}) {
  if (!root) return;
  const max = options.max || 20;
  const placeholder = options.placeholder || "輸入內容";
  const inputType = options.type || "text";
  const render = () => {
    const current = values.length ? values : [""];
    root.innerHTML = current.map((value, index) => `<div class="list-editor-row"><input type="${escapeHtml(inputType)}" inputmode="${inputType === "url" ? "url" : "text"}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-list-value /><button class="btn ghost small" type="button" data-list-remove="${index}" aria-label="移除此筆">移除</button></div>`).join("") + `<div class="list-editor-actions"><button class="btn ghost small" type="button" data-list-add>＋新增一筆</button><span class="muted">最多 ${max} 筆</span></div>`;
    root.querySelectorAll("[data-list-value]").forEach((input, index) => input.addEventListener("input", () => { values[index] = input.value; }));
    root.querySelectorAll("[data-list-remove]").forEach((button) => button.addEventListener("click", () => { values.splice(Number(button.dataset.listRemove), 1); render(); }));
    root.querySelector("[data-list-add]")?.addEventListener("click", () => { if (values.length >= max) return; values.push(""); render(); });
  };
  render();
  return () => [...root.querySelectorAll("[data-list-value]")].map((input) => input.value.trim()).filter(Boolean);
}

function readRoleFields(card) {
  const result = {};
  card?.querySelectorAll("[data-f]").forEach((field) => {
    const key = field.dataset.f;
    if (field.type === "checkbox") result[key] = field.checked;
    else if (field.hasAttribute("data-num")) result[key] = field.value === "" ? null : Number(field.value);
    else result[key] = field.value.trim();
  });
  const social = {};
  card?.querySelectorAll("[data-s]").forEach((field) => { social[field.dataset.s] = field.value.trim(); });
  if (Object.keys(social).length) result.social_links = social;
  return result;
}

function fillRoleFields(card, data = {}, defaultFirstValid = false) {
  card?.querySelectorAll("[data-f]").forEach((field) => {
    const value = data?.[field.dataset.f];
    if (field.type === "checkbox") field.checked = field.dataset.f === "accept_matching" && value === undefined ? true : Boolean(value);
    else if (defaultFirstValid && field.tagName === "SELECT" && (value === undefined || value === null || value === "")) {
      field.value = [...field.options].find((option) => !option.disabled && option.value)?.value ?? "";
    }
    else field.value = value ?? "";
  });
  card?.querySelectorAll("[data-s]").forEach((field) => { field.value = data?.social_links?.[field.dataset.s] ?? ""; });
}

async function initMemberRoles(mePayload) {
  const form = document.querySelector("#rolesForm");
  if (!form) return;
  const message = document.querySelector("#rolesMessage");
  const submit = document.querySelector("#rolesSubmit");
  const pending = mePayload?.pending_agreements || [];
  const banner = document.querySelector("#pendingAgreementBanner");
  if (pending.length && banner) {
    banner.classList.remove("hidden");
    banner.innerHTML = `<div><strong>有 ${pending.length} 份規範需要重新同意</strong><span>${pending.map((item) => escapeHtml(`${item.title} v${item.version}`)).join("、")}</span></div><button class="btn ghost small" type="button" data-open-roles>前往確認</button>`;
    banner.querySelector("[data-open-roles]")?.addEventListener("click", () => document.querySelector('[data-show="roles"]')?.click());
  }
  try {
    const [rolePayload, tagPayload, servicePayload] = await Promise.all([api("my-roles"), api("tags"), api("services-for-providers")]);
    let roleData = rolePayload;
    const tags = normalizeList(tagPayload, "tags").map(normalizeTag);
    const services = normalizeList(servicePayload, "services");
    const statusByRole = new Map((roleData.roles || []).map((role) => [role.role_key, role]));
    const selectedTagIds = new Set((roleData.tag_ids || []).map(String));
    const agreedById = new Map((roleData.agreements || []).map((agreement) => [String(agreement.agreement_id), Boolean(agreement.agreed)]));
    const checks = [...form.querySelectorAll("[data-role-check]")];
    checks.forEach((check) => {
      if (check.dataset.roleCheck === "member") { check.checked = true; check.disabled = true; return; }
      check.checked = statusByRole.has(check.dataset.roleCheck) && statusByRole.get(check.dataset.roleCheck).status !== "inactive";
    });
    for (const [key, role] of statusByRole) {
      const target = form.querySelector(`[data-role-status="${key}"]`);
      const meta = displayRoleStatusMeta(role, roleData);
      if (target) target.innerHTML = `<span class="role-badge ${meta[1]}">${escapeHtml(meta[0])}</span>`;
      const note = form.querySelector(`[data-role-note="${key}"]`);
      if (note && role.review_note_public) { note.textContent = `審核說明：${role.review_note_public}`; note.classList.remove("hidden"); }
    }
    fillRoleFields(form.querySelector('[data-role-card="provider"]'), roleData.provider, true);
    fillRoleFields(form.querySelector('[data-role-card="partner"]'), roleData.partner);
    fillRoleFields(form.querySelector('[data-role-card="resource_seeker"]'), roleData.seeker);
    renderChoiceChips(document.querySelector("#pvServices"), services, new Set((roleData.provider?.service_ids || []).map(String)), "provider_service", "service_id", "service_name");
    renderChoiceChips(document.querySelector("#pvSkills"), tags.filter((tag) => tag.tag_type === "skill"), selectedTagIds, "member_tag");
    renderChoiceChips(document.querySelector("#ptTags"), tags.filter((tag) => ["resource_type", "region", "cooperation_type"].includes(tag.tag_type)), selectedTagIds, "member_tag");
    renderChoiceChips(document.querySelector("#skTags"), tags.filter((tag) => ["skill", "resource_type", "region"].includes(tag.tag_type)), selectedTagIds, "member_tag");
    const partnerTypes = ["store", "brand", "supplier", "advertising", "cross_industry", "channel", "venue", "lecturer", "consultant", "other"].map((value) => ({ value, label: { store:"店家", brand:"品牌", supplier:"供應商", advertising:"廣告合作", cross_industry:"異業合作", channel:"通路", venue:"場地", lecturer:"講師", consultant:"顧問", other:"其他" }[value] }));
    renderChoiceChips(document.querySelector("#ptTypes"), partnerTypes, new Set(roleData.partner?.partner_types || []), "partner_type", "value", "label");
    const getPortfolio = setupListEditor(document.querySelector("#pvPortfolio"), [...(roleData.provider?.portfolio_urls || [])], { max: 10, type: "url", placeholder: "https://作品網址" });
    const getResources = setupListEditor(document.querySelector("#ptResources"), [...(roleData.partner?.resources || [])], { placeholder: "例如：場地、商品、通路" });
    const getMethods = setupListEditor(document.querySelector("#ptMethods"), [...(roleData.partner?.cooperation_methods || [])], { placeholder: "例如：聯名活動" });
    const getNeeds = setupListEditor(document.querySelector("#skNeeds"), [...(roleData.seeker?.need_categories || [])], { placeholder: "例如：攝影、活動人力" });
    let visibleAgreements = [], agreementRevision = 0;
    const updateSubmit = () => {
      const agreementChecks = [...document.querySelectorAll("[data-agreement-confirm]")];
      submit.disabled = !checks.some((check) => check.checked) || !visibleAgreements.length || agreementChecks.some((check) => !check.checked);
    };
    const renderAgreements = async () => {
      const revision = ++agreementRevision;
      const selectedRoles = checks.filter((check) => check.checked).map((check) => check.dataset.roleCheck);
      checks.forEach((check) => {
        form.querySelector(`[data-role-fields="${check.dataset.roleCheck}"]`)?.classList.toggle("hidden", !check.checked);
        const wasActive = statusByRole.get(check.dataset.roleCheck)?.status !== "inactive" && statusByRole.has(check.dataset.roleCheck);
        form.querySelector(`[data-role-hint="${check.dataset.roleCheck}"]`)?.classList.toggle("hidden", check.checked || !wasActive);
      });
      const batches = await Promise.all(selectedRoles.map((role) => api("agreements", { query: `&role=${encodeURIComponent(role)}` })));
      if (revision !== agreementRevision) return;
      const unique = new Map();
      batches.flatMap((batch) => normalizeList(batch, "agreements")).forEach((agreement) => unique.set(String(agreement.agreement_id), agreement));
      visibleAgreements = [...unique.values()];
      const root = document.querySelector("#agreementList");
      root.innerHTML = visibleAgreements.map((agreement) => `<article class="agreement-item"><details><summary>${escapeHtml(agreement.title)} <span class="muted">v${escapeHtml(agreement.version)}</span></summary><div class="agreement-body">${renderAgreementMarkdown(agreement.body_md, agreement.title)}</div></details><label class="field-check agreement-confirm"><input type="checkbox" data-agreement-confirm value="${escapeHtml(agreement.agreement_id)}" ${agreedById.get(String(agreement.agreement_id)) ? "checked" : ""} />我已閱讀並同意此版本</label></article>`).join("") || '<span class="muted">目前沒有可用規範，請稍後再試。</span>';
      root.querySelectorAll("[data-agreement-confirm]").forEach((check) => check.addEventListener("change", updateSubmit));
      updateSubmit();
    };
    checks.forEach((check) => check.addEventListener("change", () => renderAgreements().catch((error) => { message.textContent = error.message; submit.disabled = true; })));
    await renderAgreements();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      message.className = "roles-error";
      message.textContent = "";
      const selectedRoles = checks.filter((check) => check.checked).map((check) => check.dataset.roleCheck);
      const portfolio = getPortfolio();
      const urlValues = [...form.querySelectorAll("[data-url]")].filter((field) => !field.closest("[data-role-fields]")?.classList.contains("hidden")).map((field) => field.value.trim()).filter(Boolean).concat(portfolio);
      const invalidUrlField = [...form.querySelectorAll("[data-url]")].filter((field) => !field.closest("[data-role-fields]")?.classList.contains("hidden")).find((field) => { const value = field.value.trim(); if (!value) return false; try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } });
      const invalidPortfolioUrl = portfolio.find((value) => { try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } });
      if (invalidUrlField) { message.textContent = `${invalidUrlField.labels?.[0]?.textContent || "網址欄位"}僅接受 http／https 網址。`; invalidUrlField.focus(); return; }
      if (invalidPortfolioUrl) { message.textContent = "作品集網址僅接受 http／https 網址。"; return; }
      if (portfolio.length > 10) { message.textContent = "作品集網址最多 10 筆。"; return; }
      const budgetMin = Number(document.querySelector("#skBudgetMin")?.value || 0), budgetMax = Number(document.querySelector("#skBudgetMax")?.value || 0);
      if (selectedRoles.includes("resource_seeker") && budgetMax && budgetMin > budgetMax) { message.textContent = "預算下限不可高於預算上限。"; return; }
      const requiredChecks = [...document.querySelectorAll("[data-agreement-confirm]")];
      if (requiredChecks.some((check) => !check.checked)) { message.textContent = "請逐份勾選所有必要規範後再送出。"; return; }
      const provider = readRoleFields(form.querySelector('[data-role-card="provider"]'));
      provider.service_ids = [...form.querySelectorAll('[name="provider_service"]:checked')].map((input) => input.value);
      provider.portfolio_urls = portfolio;
      const partner = readRoleFields(form.querySelector('[data-role-card="partner"]'));
      partner.partner_types = [...form.querySelectorAll('[name="partner_type"]:checked')].map((input) => input.value);
      if (selectedRoles.includes("partner") && !String(partner.organization_name || "").trim()) { message.textContent = "請填寫合作夥伴的單位／品牌名稱。"; document.querySelector("#ptOrg")?.focus(); return; }
      if (selectedRoles.includes("partner") && !partner.partner_types.length) { message.textContent = "請至少選擇一項夥伴類型。"; document.querySelector("#ptTypes")?.scrollIntoView({ block: "center" }); return; }
      partner.resources = getResources(); partner.cooperation_methods = getMethods();
      const seeker = readRoleFields(form.querySelector('[data-role-card="resource_seeker"]'));
      seeker.need_categories = getNeeds();
      const body = {
        roles: selectedRoles,
        provider: selectedRoles.includes("provider") ? provider : null,
        partner: selectedRoles.includes("partner") ? partner : null,
        seeker: selectedRoles.includes("resource_seeker") ? seeker : null,
        tag_ids: [...new Set([...form.querySelectorAll('[name="member_tag"]:checked')].map((input) => input.value))],
        agree_agreement_ids: requiredChecks.filter((check) => check.checked).map((check) => check.value),
      };
      submit.disabled = true;
      try {
        roleData = await api("my-roles", { method: "PUT", body });
        message.className = "roles-ok";
        message.textContent = "合作角色資料已送出。";
        (roleData.roles || []).forEach((role) => {
          const target = form.querySelector(`[data-role-status="${role.role_key}"]`);
          const meta = displayRoleStatusMeta(role, roleData);
          if (target) target.innerHTML = `<span class="role-badge ${meta[1]}">${escapeHtml(meta[0])}</span>`;
        });
      } catch (error) { message.textContent = error.message; }
      finally { updateSubmit(); }
    });
  } catch (error) {
    const target = document.querySelector("#rolesLoadError");
    target.textContent = error.message;
    target.classList.remove("hidden");
  }
}

async function initProductionMember() {
  const { client } = await requireSession();
  bindAccountSwitch(client);
  const sections = [...document.querySelectorAll("[data-section]")];
  const nav = [...document.querySelectorAll("[data-show]")];
  const show = (id) => { sections.forEach((section) => section.classList.toggle("hidden", section.dataset.section !== id)); nav.forEach((item) => item.classList.toggle("active", item.dataset.show === id)); };
  nav.forEach((item) => item.addEventListener("click", () => show(item.dataset.show)));
  const mePayload = await api("me");
  const member = memberFromMe(mePayload);
  if (!member) throw new Error("會員資料初始化失敗，請重新整理後再試。");
  const memberHomeName = document.querySelector("#memberHomeName");
  const memberHomeAvatar = document.querySelector("#memberHomeAvatar");
  if (memberHomeName) memberHomeName.textContent = member.name || member.full_name || "莓好會員";
  if (memberHomeAvatar) {
    const avatarUrl = safeHttpUrl(member.avatar_url);
    if (avatarUrl) memberHomeAvatar.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(member.name || member.full_name || "會員")}的頭像" />`;
    else memberHomeAvatar.textContent = String(member.name || member.full_name || "莓").trim().slice(0, 1) || "莓";
  }
  const stayInMemberCenter = new URLSearchParams(location.search).get("mode") === "member";
  if (isPrivilegedMember(member) && !stayInMemberCenter) {
    location.replace("admin.html");
    return;
  }
  const profileForm = document.querySelector("#profileForm");
  const profileMap = { name: member.name, fullName: member.full_name, email: member.email, phone: member.phone, line: member.line_id, contactEmail: member.contact_email, avatarUrl: member.avatar_url, region: member.region, bio: member.bio };
  Object.entries(profileMap).forEach(([key, value]) => { const field = profileForm?.querySelector(`[name="${key}"]`); if (field) field.value = value || ""; });
  if (profileForm?.querySelector('[name="isPublic"]')) profileForm.querySelector('[name="isPublic"]').checked = Boolean(member.is_public);
  profileForm?.addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(profileForm)); try { await api("profile", { method: "PATCH", body: { name: form.name, full_name: form.fullName, phone: form.phone, line_id: form.line, contact_email: form.contactEmail, avatar_url: form.avatarUrl, region: form.region, bio: form.bio, is_public: Boolean(form.isPublic) } }); document.querySelector("#profileStatus").textContent = "已更新"; } catch (error) { document.querySelector("#profileStatus").textContent = error.message; } });
  await initMemberRoles(mePayload);
  const requestedSection = location.hash.slice(1);
  show(sections.some((section) => section.dataset.section === requestedSection) ? requestedSection : "home");
  await initPhase2Member().catch((error) => console.warn("Phase 2 member modules unavailable", error));
  let addresses = await api("addresses");
  const list = document.querySelector("#addressList"); const pickup = document.querySelector("#pickupAddress"); const dropoff = document.querySelector("#dropoffAddress");
  const addressTypeLabel = { home: "住家", company: "公司", other: "其他" };
  const renderAddresses = () => { list.innerHTML = addresses.map((a) => `<article class="address-card"><div class="address-card-head"><span class="address-type">${addressTypeLabel[a.address_type] || "其他"}</span><strong>${escapeHtml(a.label)}</strong></div><div class="address-main">${escapeHtml(a.address)}</div><div class="address-recipient"><span>收件人：${escapeHtml(a.recipient || "未填")}</span><span>${escapeHtml(a.phone || "未填電話")}</span></div>${a.note ? `<div class="address-note">收件備註：${escapeHtml(a.note)}</div>` : ""}<button class="btn ghost small" data-delete="${a.id}">刪除</button></article>`).join("") || '<div class="empty-address"><strong>尚未新增常用地址</strong><span>新增住家、公司或其他收件地址，預約時就能直接選用。</span></div>'; list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => { await api("addresses", { method: "DELETE", query: `&id=${button.dataset.delete}` }); addresses = addresses.filter((a) => a.id !== button.dataset.delete); renderAddresses(); })); const options = '<option value="">請選擇常用地址</option>' + addresses.map((a) => `<option value="${a.id}">${addressTypeLabel[a.address_type] || "其他"}｜${escapeHtml(a.label)}｜${escapeHtml(a.address)}</option>`).join(""); if (pickup) pickup.innerHTML = options; if (dropoff) dropoff.innerHTML = options; document.querySelector("#addressCount")?.replaceChildren(document.createTextNode(String(addresses.length))); };
  renderAddresses();
  let orders = await api("orders");
  const canMemberEditOrder = (order) => order.payment_status === "UNPAID" && ["WAITING_PAYMENT", "DRAFT"].includes(order.service_status);
  const companionModeLabels = { quiet: "完全安靜", low_interaction: "低互動", together: "一起工作", body_doubling: "Body Doubling" };
  const renderOrders = () => {
    document.querySelector("#orderCount").textContent = String(orders.length);
    document.querySelector("#unpaidCount").textContent = String(orders.filter((order) => !["PAID", "REFUNDED"].includes(order.payment_status)).length);
    const root = document.querySelector("#memberOrderList");
    root.innerHTML = orders.map((order) => {
      const details = order.booking_details || {};
      const detailText = [details.companion_mode ? `模式：${companionModeLabels[details.companion_mode] || escapeHtml(details.companion_mode)}` : "", details.work_goal ? `目標：${escapeHtml(details.work_goal)}` : ""].filter(Boolean).join("｜");
      const actions = canMemberEditOrder(order) ? `<div class="order-actions"><button class="btn ghost small" data-reschedule-order="${order.id}">改期</button><button class="btn ghost small danger-action" data-cancel-order="${order.id}">取消</button></div>` : "";
      return `<article class="order-row member-order-row"><strong>${order.order_items?.map((item) => escapeHtml(item.label)).join("、") || escapeHtml(order.category)}</strong><span>${order.booking_date || "日期未定"} ${order.booking_time || ""}</span><span>${money(order.total_amount)}</span><span class="badge ${order.payment_status === "PAID" ? "ok" : order.payment_status === "PARTIAL" ? "warn" : "danger"}">${escapeHtml(order.payment_status)}</span>${detailText ? `<p class="order-details">${detailText}</p>` : ""}${actions}</article>`;
    }).join("") || '<p class="muted">目前沒有預約</p>';
    root.querySelectorAll("[data-cancel-order]").forEach((button) => button.addEventListener("click", async () => {
      try {
        if (!confirm("確定取消這筆未付款預約？")) return;
        await api("order-cancel", { method: "POST", body: { id: button.dataset.cancelOrder } });
        orders = await api("orders"); renderOrders();
      } catch (error) { alert(error.message); }
    }));
    root.querySelectorAll("[data-reschedule-order]").forEach((button) => button.addEventListener("click", async () => {
      try {
        const order = orders.find((item) => item.id === button.dataset.rescheduleOrder); if (!order) return;
        const bookingDate = prompt("請輸入新日期（YYYY-MM-DD）", order.booking_date || ""); if (bookingDate === null) return;
        const bookingTime = prompt("請輸入新時間（HH:MM）", String(order.booking_time || "").slice(0, 5)); if (bookingTime === null) return;
        await api("order-reschedule", { method: "PATCH", body: { id: order.id, booking_date: bookingDate, booking_time: bookingTime } });
        orders = await api("orders"); renderOrders();
      } catch (error) { alert(error.message); }
    }));
  };
  renderOrders();
  const addressForm = document.querySelector("#addressForm"); const showAddressForm = (show) => { addressForm?.classList.toggle("hidden", !show); if (show) addressForm?.querySelector("input, select")?.focus(); };
  document.querySelector("#addAddressButton")?.addEventListener("click", () => showAddressForm(true));
  document.querySelector("#cancelAddressButton")?.addEventListener("click", () => { addressForm?.reset(); showAddressForm(false); });
  addressForm?.addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(addressForm)); const created = await api("addresses", { method: "POST", body: form }); addresses.push(created); addressForm.reset(); showAddressForm(false); renderAddresses(); });
  const catalogData = await api("services");
  let inquiries = await api("inquiries");
  const renderInquiries = () => {
    const labels = { pending: "待處理", reviewing: "評估中", quoted: "已報價", accepted: "已接受", closed: "已結案" };
    document.querySelector("#memberInquiryList").innerHTML = inquiries.map((item) => `<div class="order-row"><strong>${escapeHtml(item.service_name)}</strong><span>${escapeHtml(item.requirements)}</span><span>${item.quoted_amount === null ? "尚未報價" : money(item.quoted_amount)}</span><span class="badge neutral">${labels[item.status] || escapeHtml(item.status)}</span></div>`).join("") || '<p class="muted">目前沒有詢價紀錄</p>';
  };
  renderInquiries();
  const serviceMenu = document.querySelector("#serviceMenu");
  const planSelect = document.querySelector("#planSelect");
  const categoryDefinitions = [
    ["temporary_staff", "莓你不可", "人與人的服務・專人委託・客製服務"],
    ["recording_space", "莓好聲音", "錄音・歌唱・配音・聲音體驗"],
    ["venue_equipment", "莓好基地", "工作・創作・活動・共享空間"],
    ["learning", "莓好學習", "課程・教學・親子・共學"],
    ["ai_digital", "莓好數位", "AI・網站・自動化・數位服務"],
  ];
  let category = "recording_space";
  let currentQuote;
  let serviceStateRevision = 0;
  const selectedService = () => catalogData.services.find((item) => item.service_id === planSelect.value);
  const teamById = new Map((catalogData.official_teams || []).map((team) => [team.team_id, team]));
  serviceMenu.innerHTML = categoryDefinitions.map(([id, label, description]) => `<button class="service-choice ${id === category ? "active" : ""}" data-cat="${id}"><strong>${label}</strong><div class="muted">${description}</div></button>`).join("");
  const quotePayload = () => {
    const item = selectedService();
    const needsHours = item && (item.service_type === "companion" || item.price_unit === "hour" || item.included_hours);
    return {
      service_id: planSelect.value,
      option_id: document.querySelector("#serviceOption")?.value || null,
      selected_addon_ids: [...document.querySelectorAll('[name="serviceAddon"]:checked')].map((field) => field.value),
      hours: needsHours ? Number(document.querySelector("#bookingHours")?.value || 1) : 1,
      companion_mode: item?.service_type === "companion" ? document.querySelector("#companionMode")?.value || null : null,
      work_goal: item?.service_type === "companion" ? document.querySelector("#workGoal")?.value.trim() || "" : "",
    };
  };
  const updateServiceMode = async () => {
    const revision = ++serviceStateRevision;
    const item = selectedService();
    const optionWrap = document.querySelector("#serviceOptionWrap");
    const addonWrap = document.querySelector("#addonWrap");
    const inquiryFields = document.querySelector("#inquiryFields");
    const companionFields = document.querySelector("#companionFields");
    const checkoutButton = document.querySelector("#checkoutButton");
    currentQuote = null;
    if (!item || item.service_status !== "active") {
      optionWrap.classList.add("hidden"); addonWrap.classList.add("hidden"); inquiryFields.classList.add("hidden"); companionFields.classList.add("hidden");
      document.querySelector("#checkoutLines").innerHTML = '<p class="muted">此分類目前沒有可預約服務。</p>';
      document.querySelector("#checkoutTotal").textContent = "尚未開放"; checkoutButton.disabled = true; return;
    }
    const options = catalogData.options.filter((option) => option.service_id === item.service_id);
    optionWrap.classList.toggle("hidden", options.length === 0);
    document.querySelector("#serviceOption").innerHTML = '<option value="">請選擇需求類型（選填）</option>' + options.map((option) => `<option value="${option.option_id}">${escapeHtml(option.option_name)}</option>`).join("");
    const showAddons = item.category_id === "recording_space";
    addonWrap.classList.toggle("hidden", !showAddons);
    document.querySelector("#addonOptions").innerHTML = showAddons ? catalogData.addons.map((addon) => `<label><input type="checkbox" name="serviceAddon" value="${addon.addon_id}" /> <span><strong>${escapeHtml(addon.addon_name)}</strong><small>${addon.addon_price === null ? "價格待確認" : money(addon.addon_price)}</small></span></label>`).join("") : "";
    const isCompanion = item.service_type === "companion";
    const needsHours = isCompanion || item.price_unit === "hour" || item.included_hours;
    companionFields.classList.toggle("hidden", !needsHours);
    companionFields.querySelectorAll(".companion-only").forEach((element) => element.classList.toggle("hidden", !isCompanion));
    const hoursInput = document.querySelector("#bookingHours");
    hoursInput.min = String(item.min_hours || 1);
    hoursInput.value = String(item.included_hours || item.min_hours || 1);
    const staleHint = document.querySelector("#bookingHoursHint"); if (staleHint) staleHint.textContent = "";
    document.querySelector("#companionMode").innerHTML = (item.companion_modes || []).map((mode) => `<option value="${mode}">${companionModeLabels[mode] || escapeHtml(mode)}</option>`).join("");
    const isInquiry = item.booking_type === "custom_quote";
    const applicationRoot = document.querySelector("#serviceApplicationFields");
    const applicationFields = (catalogData.application_fields || []).filter((field) => field.service_id === item.service_id && !["requirements", "preferred_date", "preferred_time", "notes"].includes(field.field_key));
    if (applicationRoot) applicationRoot.innerHTML = applicationFields.map((field) => {
      const attrs = `data-application-field="${escapeHtml(field.field_key)}" ${field.required ? "required" : ""} placeholder="${escapeHtml(field.placeholder || "")}"`;
      const control = field.field_type === "textarea" ? `<textarea ${attrs} rows="3"></textarea>` : `<input ${attrs} type="${escapeHtml(field.field_type || "text")}" />`;
      return `<div class="field ${field.field_type === "textarea" ? "full" : ""}"><label>${escapeHtml(field.field_label)}${field.required ? "＊" : ""}</label>${control}</div>`;
    }).join("");
    inquiryFields.classList.toggle("hidden", !isInquiry);
    checkoutButton.textContent = isInquiry ? "立即詢價" : "立即預約";
    checkoutButton.disabled = false;
    if (isInquiry) {
      const priceOptions = (catalogData.price_options || []).filter((option) => option.service_id === item.service_id);
      document.querySelector("#checkoutLines").innerHTML = `<div class="checkout-line"><span>${escapeHtml(item.service_name)}</span><strong>${priceLabel(item)}</strong></div>`
        + priceOptions.map((option) => `<div class="checkout-line service-price-option"><span>${escapeHtml(option.option_name)}</span><strong>${option.amount === null ? priceLabel(option) : money(option.amount)}</strong></div>`).join("")
        + (item.application_method ? `<p class="service-application-note">${escapeHtml(item.application_method)}</p>` : "");
      document.querySelector("#checkoutTotal").textContent = "人工報價";
    } else {
      checkoutButton.disabled = true;
      await updateQuote(revision);
    }
  };
  const renderPlans = () => {
    const items = catalogData.services.filter((item) => item.category_id === category);
    planSelect.innerHTML = items.length ? items.map((item) => `<option value="${item.service_id}" ${item.service_status !== "active" ? "disabled" : ""}>${escapeHtml(item.service_name)}｜${priceLabel(item)}${item.service_status === "coming_soon" ? "｜即將推出" : ""}</option>`).join("") : '<option value="">目前沒有上架服務</option>';
    const firstActive = items.find((item) => item.service_status === "active");
    if (firstActive) planSelect.value = firstActive.service_id;
    const cardRoot = document.querySelector("#serviceCatalogCards");
    cardRoot.innerHTML = items.map((item) => { const team = teamById.get(item.team_id); return `<button type="button" class="service-plan-card ${item.service_id === planSelect.value ? "active" : ""}" data-service-id="${item.service_id}" ${item.service_status !== "active" ? "disabled" : ""}><span class="service-plan-head"><strong>${escapeHtml(item.service_name)}</strong><em>${item.service_status === "coming_soon" ? "即將推出" : priceLabel(item)}</em></span>${team ? `<span class="official-service-meta"><b>官方合作</b>${escapeHtml(team.team_name)}</span>` : ""}${item.service_type === "companion" ? '<span class="companion-tags">🧍 真人陪伴｜🏢 工作空間</span>' : ""}<small>${escapeHtml(item.short_description || "")}</small></button>`; }).join("") || '<p class="muted">目前沒有上架服務</p>';
    cardRoot.querySelectorAll("[data-service-id]:not(:disabled)").forEach((card) => card.addEventListener("click", () => { planSelect.value = card.dataset.serviceId; updateServiceMode().catch((error) => alert(error.message)); cardRoot.querySelectorAll("[data-service-id]").forEach((item) => item.classList.toggle("active", item === card)); }));
    updateServiceMode().catch((error) => alert(error.message));
  };
  const openMemberService = (categoryId, serviceId = "") => {
    category = categoryId;
    serviceMenu.querySelectorAll("[data-cat]").forEach((item) => item.classList.toggle("active", item.dataset.cat === category));
    renderPlans();
    if (serviceId && [...planSelect.options].some((option) => option.value === serviceId && !option.disabled)) {
      planSelect.value = serviceId;
      document.querySelectorAll("[data-service-id]").forEach((card) => card.classList.toggle("active", card.dataset.serviceId === serviceId));
      updateServiceMode().catch((error) => alert(error.message));
    }
    show("book");
    document.querySelector('[data-section="book"]')?.scrollIntoView({ block: "start" });
  };
  document.querySelectorAll("[data-service-category]").forEach((button) => button.addEventListener("click", () => openMemberService(button.dataset.serviceCategory)));
  const featuredRoot = document.querySelector("#memberFeaturedServices");
  const serviceImageByCategory = { temporary_staff: "service-errand.webp", recording_space: "service-podcast.webp", venue_equipment: "service-coworking.webp", learning: "service-photo.webp", ai_digital: "hero-desktop.webp" };
  const featuredServices = categoryDefinitions.map(([id]) => catalogData.services.find((item) => item.category_id === id && item.service_status === "active")).filter(Boolean);
  if (featuredRoot) {
    featuredRoot.innerHTML = featuredServices.map((item, index) => `<article class="member-featured-card"><div class="member-featured-media"><img src="assets/ui-v2/${serviceImageByCategory[item.category_id] || "hero-desktop.webp"}" alt="${escapeHtml(item.service_name)}" loading="lazy" /><span>${index % 2 ? "新上架" : "熱門"}</span></div><div><h3>${escapeHtml(item.service_name)}</h3><strong>${priceLabel(item)}</strong><small>${escapeHtml(item.short_description || categoryDefinitions.find(([id]) => id === item.category_id)?.[2] || "莓好預約服務")}</small><button class="member-service-link" type="button" data-featured-service="${escapeHtml(item.service_id)}" data-featured-category="${escapeHtml(item.category_id)}">查看服務 →</button></div></article>`).join("") || '<div class="member-carousel-empty">目前沒有上架中的精選服務。</div>';
    featuredRoot.querySelectorAll("[data-featured-service]").forEach((button) => button.addEventListener("click", () => openMemberService(button.dataset.featuredCategory, button.dataset.featuredService)));
  }
  const homeSearch = document.querySelector("#memberHomeSearch");
  homeSearch?.addEventListener("submit", (event) => {
    event.preventDefault();
    const searchInput = document.querySelector("#memberHomeSearchInput");
    const keyword = searchInput?.value.trim().toLocaleLowerCase("zh-Hant") || "";
    if (!keyword) { searchInput?.focus(); return; }
    const hit = catalogData.services.find((item) => [item.service_name, item.short_description, item.category_id].some((value) => String(value || "").toLocaleLowerCase("zh-Hant").includes(keyword)));
    if (hit) openMemberService(hit.category_id, hit.service_id);
    else { show("book"); searchInput.setCustomValidity("目前找不到符合的服務，已為你開啟完整服務清單。"); searchInput.reportValidity(); searchInput.setCustomValidity(""); }
  });
  initMemberCircleCarousel().catch((error) => {
    const root = document.querySelector("#memberCircleCarousel");
    if (root) root.innerHTML = `<div class="member-carousel-empty">推薦莓好圈暫時無法載入。<a href="match.html?v=20261008-resource-circle">前往莓好預約圈</a></div>`;
    console.warn("Member circle carousel unavailable", error);
  });
  serviceMenu.querySelectorAll("[data-cat]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.cat; serviceMenu.querySelectorAll("[data-cat]").forEach((item) => item.classList.toggle("active", item === button)); renderPlans(); }));
  async function updateQuote(revision = ++serviceStateRevision) {
    const item = selectedService(); if (!item || item.booking_type !== "direct_booking") return;
    const payload = quotePayload();
    const checkoutButton = document.querySelector("#checkoutButton");
    checkoutButton.disabled = true;
    const quote = await api("quote", { method: "POST", body: payload });
    if (revision !== serviceStateRevision || planSelect.value !== payload.service_id) return;
    currentQuote = quote;
    document.querySelector("#checkoutLines").innerHTML = quote.lines.map((line) => `<div class="checkout-line"><span>${escapeHtml(line.label)}</span><strong>${money(line.amount)}</strong></div>`).join("") + quote.pending_addons.map((addon) => `<div class="checkout-line"><span>${escapeHtml(addon.addon_name)}</span><strong>價格待確認</strong></div>`).join("");
    document.querySelector("#checkoutTotal").textContent = `${money(quote.total)}${item.price_type === "starting_from" ? " 起" : ""}`;
    checkoutButton.disabled = false;
  }
  planSelect.addEventListener("change", () => { document.querySelectorAll("[data-service-id]").forEach((card) => card.classList.toggle("active", card.dataset.serviceId === planSelect.value)); updateServiceMode().catch((error) => alert(error.message)); });
  document.querySelector("#serviceOption")?.addEventListener("change", () => updateQuote().catch((error) => alert(error.message)));
  document.querySelector("#addonOptions")?.addEventListener("change", () => updateQuote().catch((error) => alert(error.message)));
  document.querySelector("#bookingHours")?.addEventListener("change", (event) => {
    const input = event.target;
    const item = selectedService();
    const min = Number(item?.min_hours || input.min || 1);
    const max = Number(input.max || 12);
    let hint = document.querySelector("#bookingHoursHint");
    if (!hint) { hint = document.createElement("small"); hint.id = "bookingHoursHint"; hint.className = "muted"; hint.setAttribute("role", "alert"); input.insertAdjacentElement("afterend", hint); }
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < min || value > max) {
      hint.textContent = `預約時數需介於 ${min} 至 ${max} 小時，請調整後再試。`;
      if (document.querySelector("#checkoutButton")) document.querySelector("#checkoutButton").disabled = true;
      return;
    }
    hint.textContent = "";
    updateQuote().catch((error) => { hint.textContent = error.message; });
  });
  document.querySelector("#companionMode")?.addEventListener("change", () => updateQuote().catch((error) => alert(error.message)));
  document.querySelector("#checkoutButton")?.addEventListener("click", async () => {
    try {
      const item = selectedService(); if (!item) return;
      const bookingDate = document.querySelector("#serviceDate").value || null;
      const bookingTime = document.querySelector("#serviceTime").value || null;
      const note = document.querySelector("#bookingNote").value || "";
      if (item.booking_type === "custom_quote") {
        const requirements = document.querySelector("#inquiryRequirements").value.trim();
        const applicationPayload = Object.fromEntries([...document.querySelectorAll("[data-application-field]")].map((field) => [field.dataset.applicationField, field.value.trim()]));
        Object.assign(applicationPayload, { requirements, preferred_date: bookingDate || "", preferred_time: bookingTime || "", notes: note });
        const invalid = [...document.querySelectorAll("[data-application-field]:required")].find((field) => !field.value.trim());
        if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
        const created = await api("inquiries", { method: "POST", body: { service_id: item.service_id, preferred_date: bookingDate, preferred_time: bookingTime, requirements, additional_notes: note, application_payload: applicationPayload } });
        inquiries = [created, ...inquiries]; renderInquiries(); document.querySelector("#inquiryRequirements").value = ""; show("inquiries");
        alert("詢價已送出，管理者確認後會更新報價狀態。");
      } else {
        const order = await api("orders", { method: "POST", body: { ...quotePayload(), booking_date: bookingDate, booking_time: bookingTime, note } });
        orders = await api("orders"); renderOrders();
        alert(`訂單 ${order.order_no} 已建立；付款功能尚未啟用，未產生付款成功紀錄。`);
      }
    } catch (error) { alert(error.message); }
  });
  renderPlans();
  const entryParams = new URLSearchParams(location.search);
  const requestedService = entryParams.get("service");
  const requestedTeam = entryParams.get("service_team");
  const targetService = catalogData.services.find((item) => item.service_id === requestedService)
    || catalogData.services.find((item) => item.team_id === requestedTeam && item.service_status === "active");
  if (targetService) openMemberService(targetService.category_id, targetService.service_id);
}

function officialServiceUrl(item, apply = false) {
  const href = new URL("member.html", location.href);
  href.searchParams.set("v", "20261008-official-teams");
  href.searchParams.set("service_team", String(item.team_id || ""));
  const firstService = (item.services || [])[0];
  if (firstService?.service_id) href.searchParams.set("service", firstService.service_id);
  if (apply) href.searchParams.set("apply", "1");
  return href.href;
}
function officialMatchingCard(item) {
  const scope = (item.service_scope || []).join("・") || "官方合作服務";
  return `<article class="matching-feed-card official-team-card"><p class="eyebrow"><span class="official-partner-badge">官方合作</span></p><h3>${escapeHtml(item.display_name || "官方團隊")}</h3><p>${escapeHtml(item.headline || scope)}</p><small>${escapeHtml(scope)}</small><div class="official-team-actions"><a class="btn ghost small" href="${escapeHtml(officialServiceUrl(item))}">查看服務</a><a class="btn small" href="${escapeHtml(officialServiceUrl(item, true))}">申請服務</a></div></article>`;
}

async function initMemberCircleCarousel() {
  const root = document.querySelector("#memberCircleCarousel"), dots = document.querySelector("#memberCircleDots");
  if (!root || !dots) return;
  const payload = await publicPhase2Api("matching-discovery-feed", "&limit=18");
  const items = [...phase2Items(payload, "carousel"), ...phase2Items(payload, "popular"), ...phase2Items(payload, "latest")].filter((item, index, rows) => rows.findIndex((row) => row.user_id === item.user_id) === index).slice(0, 12);
  if (!items.length) {
    root.innerHTML = '<div class="member-carousel-empty">目前還沒有公開的推薦莓好圈。<a href="match.html?v=20261008-resource-circle">先逛逛莓好預約圈</a></div>';
    return;
  }
  let page = 0, timer, touchStartX = 0;
  const pageSize = () => matchMedia("(max-width: 620px)").matches ? 1 : matchMedia("(max-width: 1080px)").matches ? 2 : 3;
  const pageCount = () => Math.ceil(items.length / pageSize());
  const card = (item) => {
    if (item.entity_type === "official_partner") return `<article class="member-circle-card official-team-card"><span class="member-circle-avatar" aria-hidden="true">莓</span><span class="member-circle-role">官方合作</span><strong>${escapeHtml(item.display_name || "官方團隊")}</strong><small>${escapeHtml((item.service_scope || []).join("・") || item.headline || "官方合作服務")}</small><div class="official-team-actions"><a href="${escapeHtml(officialServiceUrl(item))}">查看服務</a><a href="${escapeHtml(officialServiceUrl(item, true))}">申請服務</a></div></article>`;
    const href = new URL("match.html", location.href); href.searchParams.set("v", "20261008-resource-circle"); href.searchParams.set("profile", String(item.public_slug || ""));
    const avatar = safeHttpUrl(item.avatar_url), identities = (item.identities || []).map((tag) => tag.name).filter(Boolean);
    const role = identities[0] || "莓好圈會員";
    const services = [item.headline, ...(item.services || []).map((service) => service.service_name || service.name)].filter(Boolean).slice(0, 2).join("・") || "查看公開服務與合作內容";
    const trust = Number(item.stats?.follower_count || 0) + Number(item.stats?.like_count || 0);
    return `<a class="member-circle-card" href="${escapeHtml(href.href)}">${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(item.display_name || "莓好圈會員")}的頭像" loading="lazy" />` : `<span class="member-circle-avatar" aria-hidden="true">${escapeHtml(String(item.display_name || "莓").slice(0, 1))}</span>`}<span class="member-circle-role">${escapeHtml(role)}</span><strong>${escapeHtml(item.display_name || "莓好圈會員")}</strong><small>${escapeHtml(services)}</small><em>♥ ${trust} 次信任互動</em><b>進入莓好圈 →</b></a>`;
  };
  const render = () => {
    const count = pageCount(); page = (page + count) % count;
    const size = pageSize(), start = page * size;
    root.innerHTML = items.slice(start, start + size).map(card).join("");
    dots.innerHTML = Array.from({ length: count }, (_, index) => `<button type="button" aria-label="第 ${index + 1} 頁" aria-current="${index === page ? "true" : "false"}" data-circle-page="${index}"></button>`).join("");
    dots.querySelectorAll("[data-circle-page]").forEach((button) => button.addEventListener("click", () => { page = Number(button.dataset.circlePage); render(); restart(); }));
  };
  const restart = () => { window.clearInterval(timer); if (!matchMedia("(prefers-reduced-motion: reduce)").matches && pageCount() > 1) timer = window.setInterval(() => { page++; render(); }, 6000); };
  document.querySelector("#memberCirclePrev")?.addEventListener("click", () => { page--; render(); restart(); });
  document.querySelector("#memberCircleNext")?.addEventListener("click", () => { page++; render(); restart(); });
  root.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", (event) => { const delta = event.changedTouches[0].clientX - touchStartX; if (Math.abs(delta) < 45) return; page += delta < 0 ? 1 : -1; render(); restart(); }, { passive: true });
  let resizeTimer; window.addEventListener("resize", () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { page = 0; render(); restart(); }, 180); });
  render(); restart();
}

async function initPhase2Member() {
  const showMessage = (selector, text, isError = false) => showActionFeedback(document.querySelector(selector), text, isError, true);
  const identityRoot = document.querySelector("#identityApplicationList");
  const verificationRoot = document.querySelector("#identityVerificationList");
  const availableRulesRoot = document.querySelector("#availableVerificationRules");
  const loadIdentity = async () => {
    const [applicationPayload, verificationPayload, rolePayload, tagPayload] = await Promise.all([
      api("identity-tag-applications"), api("my-identity-verifications"), api("my-roles"), api("tags"),
    ]);
    const applications = phase2Items(applicationPayload, "items", "applications");
    identityRoot.innerHTML = applications.map((item) => `<article class="phase2-card"><div class="phase2-card-head"><strong>${escapeHtml(item.proposed_name)}</strong>${phase2Status(item.status)}</div><p>${escapeHtml(item.purpose || "未填申請用途")}</p>${item.review_note ? `<p class="muted">審核說明：${escapeHtml(item.review_note)}</p>` : ""}</article>`).join("") || '<p class="muted">目前沒有身份提案。</p>';
    const verifications = phase2Items(verificationPayload, "items", "verifications"), savedEvidence = phase2Items(verificationPayload, "evidence");
    const assignedIds = new Set((rolePayload?.tag_ids || []).map(String));
    const identityTags = phase2Items(tagPayload, "tags", "items").map(normalizeTag).filter((tag) => tag.tag_type === "identity" && assignedIds.has(String(tag.tag_id)));
    const rulePayloads = await Promise.all(identityTags.map(async (tag) => {
      try { return { tag, payload: await api("identity-verification-rules", { query: `&tag_id=${encodeURIComponent(tag.tag_id)}` }) }; }
      catch { return { tag, payload: { rules: [], requirements: [] } }; }
    }));
    availableRulesRoot.innerHTML = rulePayloads.flatMap(({ tag, payload }) => phase2Items(payload, "rules").map((rule) => ({ tag, rule, requirements: phase2Items(payload, "requirements").filter((requirement) => String(requirement.rule_id) === String(rule.rule_id)) }))).map(({ tag, rule, requirements }) => `<form class="phase2-card verification-application-form" data-tag-id="${escapeHtml(tag.tag_id)}" data-rule-id="${escapeHtml(rule.rule_id)}"><div class="phase2-card-head"><div><strong>${escapeHtml(tag.name)}｜${escapeHtml(rule.title)}</strong><small>規則 v${escapeHtml(rule.version)}${rule.valid_days ? `・有效 ${escapeHtml(rule.valid_days)} 天` : ""}</small></div></div><p>${escapeHtml(rule.description || "請依欄位提供認證資料。")}</p>${requirements.map((requirement) => {
      const required = requirement.is_required ? "required" : ""; const common = `data-requirement-id="${escapeHtml(requirement.requirement_id)}" data-evidence-type="${escapeHtml(requirement.evidence_type)}"`;
      if (requirement.evidence_type === "url") return `<label class="field"><span>${escapeHtml(requirement.label)}</span><input type="url" inputmode="url" ${common} ${required} /><small>${escapeHtml(requirement.instructions || "只接受 http 或 https 網址")}</small></label>`;
      if (requirement.evidence_type === "certificate") return `<fieldset class="verification-certificate" ${common}><legend>${escapeHtml(requirement.label)}</legend><label class="field"><span>證書名稱</span><input data-certificate-name ${required} /></label><label class="field"><span>核發單位</span><input data-issuer-name ${required} /></label><label class="field"><span>遮罩後證書編號</span><input data-certificate-number /></label><label class="field"><span>核發日期</span><input data-issued-on type="date" /></label></fieldset>`;
      return `<label class="field"><span>${escapeHtml(requirement.label)}</span><textarea rows="3" ${common} ${required}></textarea><small>${escapeHtml(requirement.instructions || "")}</small></label>`;
    }).join("")}<button class="btn small" type="submit">填妥並送審</button></form>`).join("") || '<p class="muted">目前沒有可申請的身份認證規則。</p>';
    availableRulesRoot.querySelectorAll(".verification-application-form").forEach((form) => form.addEventListener("submit", async (event) => {
      event.preventDefault(); const evidence = [...form.querySelectorAll("[data-requirement-id]")].map((field) => {
        const row = { requirement_id: field.dataset.requirementId };
        if (field.dataset.evidenceType === "url") row.url_value = field.value.trim();
        else if (field.dataset.evidenceType === "certificate") Object.assign(row, { certificate_name: field.querySelector("[data-certificate-name]").value.trim(), issuer_name: field.querySelector("[data-issuer-name]").value.trim(), certificate_number_masked: field.querySelector("[data-certificate-number]").value.trim(), issued_on: field.querySelector("[data-issued-on]").value || null });
        else row.text_value = field.value.trim();
        return row;
      });
      if (evidence.some((row) => row.url_value && !safeHttpUrl(row.url_value))) { showMessage("#identityMessage", "認證網址只允許 http 或 https。", true); return; }
      try { await withButtonPending(form.querySelector("button"), () => api("my-identity-verifications", { method: "POST", body: { tag_id: form.dataset.tagId, rule_id: form.dataset.ruleId, evidence, submit: true } })); await loadIdentity(); showMessage("#identityMessage", "身份認證已送審。"); }
      catch (error) { showMessage("#identityMessage", error.message, true); }
    }));
    const memberTagById = new Map(identityTags.map((tag) => [String(tag.tag_id), tag]));
    verificationRoot.innerHTML = verifications.map((item) => `<article class="phase2-card"><div class="phase2-card-head"><div><strong>${escapeHtml(item.tag_name || item.tag?.name || memberTagById.get(String(item.tag_id))?.name || "身份認證")}</strong><small>規則 v${escapeHtml(item.rule_version || item.rule?.version || "—")}</small></div>${phase2Status(item.status)}</div>${item.review_note_public ? `<p>${escapeHtml(item.review_note_public)}</p>` : ""}<div class="phase2-actions">${["draft", "rejected"].includes(item.status) ? `<button class="btn small" type="button" data-submit-verification="${escapeHtml(item.verification_id)}">送出審核</button>` : ""}</div></article>`).join("") || '<p class="muted">目前沒有身份認證資料；身份規則啟用後即可開始申請。</p>';
    verificationRoot.querySelectorAll("[data-submit-verification]").forEach((button) => button.addEventListener("click", async () => {
      try { await withButtonPending(button, () => api("my-identity-verifications", { method: "PATCH", body: { verification_id: button.dataset.submitVerification, evidence: savedEvidence.filter((row) => String(row.verification_id) === String(button.dataset.submitVerification)), submit: true } })); await loadIdentity(); showMessage("#identityMessage", "認證資料已送審。"); }
      catch (error) { showMessage("#identityMessage", error.message, true); }
    }));
  };
  document.querySelector("#identityTagApplicationForm")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form));
    const urls = String(data.evidence_urls || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (urls.some((value) => !safeHttpUrl(value))) { showMessage("#identityMessage", "佐證網址只允許 http 或 https。", true); return; }
    data.evidence_urls = urls;
    try { await withButtonPending(form.querySelector('[type="submit"]'), () => api("identity-tag-applications", { method: "POST", body: data })); form.reset(); await loadIdentity(); showMessage("#identityMessage", "身份提案已送出。"); }
    catch (error) { showMessage("#identityMessage", error.message, true); }
  });
  document.querySelector("#refreshIdentityVerifications")?.addEventListener("click", () => loadIdentity().catch((error) => showMessage("#identityMessage", error.message, true)));

  let matchingProfile = null;
  const profileForm = document.querySelector("#matchingProfileForm");
  const updateProfileLink = () => {
    const slug = matchingProfile?.public_slug; const preview = document.querySelector("#matchingProfilePreview"); const copy = document.querySelector("#copyMatchingProfileLink");
    if (!slug) { preview?.classList.add("hidden"); copy?.classList.add("hidden"); return; }
    const url = new URL("match.html", location.href); url.searchParams.set("v", "20261008-resource-circle"); url.searchParams.set("profile", slug);
    preview.href = url.href; preview.classList.remove("hidden"); copy.classList.remove("hidden"); copy.dataset.url = url.href;
  };
  const loadProfile = async () => {
    const payload = await api("my-matching-profile"); matchingProfile = payload?.profile || payload || {};
    for (const field of profileForm?.elements || []) if (field.name && Object.hasOwn(matchingProfile, field.name)) {
      const value = matchingProfile[field.name];
      if (field.type === "checkbox") field.checked = Boolean(value);
      else if (Array.isArray(value)) field.value = value.join("、");
      else field.value = value ?? "";
    }
    profileForm?.querySelectorAll("[data-visibility]").forEach((field) => { field.checked = matchingProfile.profile_field_visibility?.[field.dataset.visibility] !== false; });
    updateProfileLink();
  };
  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(profileForm));
    ["booking_enabled","inquiry_enabled","matching_enabled","verification_info_visible","is_public"].forEach((key) => { data[key] = Boolean(profileForm.elements[key]?.checked); });
    data.profile_field_visibility = Object.fromEntries([...profileForm.querySelectorAll("[data-visibility]")].map((field) => [field.dataset.visibility, field.checked]));
    try { matchingProfile = await withButtonPending(profileForm.querySelector('[type="submit"]'), () => api("my-matching-profile", { method: "PUT", body: data })); matchingProfile = matchingProfile?.profile || matchingProfile; updateProfileLink(); showMessage("#matchingProfileMessage", "我的莓好圈已儲存。"); }
    catch (error) { showMessage("#matchingProfileMessage", error.message, true); }
  });
  document.querySelector("#copyMatchingProfileLink")?.addEventListener("click", async (event) => {
    try { await navigator.clipboard.writeText(event.currentTarget.dataset.url); showMessage("#matchingProfileMessage", "我的莓好圈連結已複製。"); }
    catch { showMessage("#matchingProfileMessage", "無法自動複製，請由預覽頁網址列複製。", true); }
  });

  const recordsRoot = document.querySelector("#matchingRecordList");
  const reportCategories = '<option value="no_show">未到場</option><option value="late_cancel">臨時取消</option><option value="amount_dispute">金額爭議</option><option value="scope_dispute">範圍爭議</option><option value="suspected_fraud">疑似詐騙</option><option value="misconduct">不當行為</option><option value="safety">安全疑慮</option><option value="other">其他</option>';
  const loadRecords = async () => {
    const [recordPayload, reportPayload] = await Promise.all([api("matching-records"), api("matching-reports")]);
    const records = phase2Items(recordPayload, "items", "records"), reports = phase2Items(reportPayload, "items", "reports");
    recordsRoot.innerHTML = records.map((item) => `<article class="phase2-card"><div class="phase2-card-head"><div><strong>${escapeHtml(item.subject_title)}</strong><small>${escapeHtml(item.match_code || "")}</small></div>${phase2Status(item.status)}</div><p>${escapeHtml(item.location_text || "地點未定")}・${escapeHtml(phase2Date(item.scheduled_at))}</p>${item.agreed_amount == null ? "" : `<p>約定金額：${money(item.agreed_amount)}（非付款狀態）</p>`}<div class="phase2-actions">${["proposed", "partially_confirmed"].includes(item.status) ? `<button class="btn small" data-match-confirm="${escapeHtml(item.match_id)}">確認內容</button><button class="btn ghost small" data-match-decline="${escapeHtml(item.match_id)}">拒絕</button>` : ""}<button class="btn ghost small" data-open-report="${escapeHtml(item.match_id)}">回報問題</button></div><form class="phase2-report-form hidden" data-report-form="${escapeHtml(item.match_id)}"><label class="field"><span>問題類別</span><select name="category">${reportCategories}</select></label><label class="field"><span>問題說明</span><textarea name="description" rows="3" required></textarea></label><button class="btn small" type="submit">送出回報</button></form></article>`).join("") + (reports.length ? `<div class="panel"><h3>我的問題回報</h3>${reports.map((item) => `<p><strong>${escapeHtml(item.match_code || item.category)}</strong> ${phase2Status(item.status)}<br><span class="muted">${escapeHtml(item.description)}</span></p>`).join("")}</div>` : "") || '<p class="muted">目前沒有媒合紀錄。</p>';
    recordsRoot.querySelectorAll("[data-match-confirm],[data-match-decline]").forEach((button) => button.addEventListener("click", async () => { const record = records.find((item) => String(item.match_id) === String(button.dataset.matchConfirm || button.dataset.matchDecline)); try { await withButtonPending(button, () => api("matching-confirmation", { method: "POST", body: { match_id: record.match_id, terms_version: record.terms_version, terms_snapshot: record.scope_snapshot || {}, decision: button.hasAttribute("data-match-confirm") ? "confirmed" : "declined" } })); await loadRecords(); } catch (error) { showMessage("#matchingRecordMessage", error.message, true); } }));
    recordsRoot.querySelectorAll("[data-open-report]").forEach((button) => button.addEventListener("click", () => recordsRoot.querySelector(`[data-report-form="${button.dataset.openReport}"]`)?.classList.toggle("hidden")));
    recordsRoot.querySelectorAll("[data-report-form]").forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.match_id = form.dataset.reportForm; try { await withButtonPending(form.querySelector("button"), () => api("matching-reports", { method: "POST", body: data })); await loadRecords(); showMessage("#matchingRecordMessage", "問題回報已送出。"); } catch (error) { showMessage("#matchingRecordMessage", error.message, true); } }));
  };
  document.querySelector("#matchingRecordForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); data.agreed_amount = data.agreed_amount === "" ? null : Number(data.agreed_amount); try { await withButtonPending(form.querySelector("button"), () => api("matching-records", { method: "POST", body: data })); form.reset(); await loadRecords(); showMessage("#matchingRecordMessage", "媒合草稿已建立，等待雙方確認。"); } catch (error) { showMessage("#matchingRecordMessage", error.message, true); } });

  const featureRoot = document.querySelector("#matchingFeatureList");
  const loadFeatures = async () => { const items = phase2Items(await api("matching-feature-applications"), "items", "applications"); featureRoot.innerHTML = items.map((item) => `<article class="phase2-card"><div class="phase2-card-head"><strong>莓好圈輪播申請</strong>${phase2Status(item.status)}</div><p>${escapeHtml(phase2Date(item.requested_start_at))} ～ ${escapeHtml(phase2Date(item.requested_end_at))}</p>${item.review_note ? `<p class="muted">${escapeHtml(item.review_note)}</p>` : ""}</article>`).join("") || '<p class="muted">目前沒有輪播申請。</p>'; };
  document.querySelector("#matchingFeatureForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); try { await withButtonPending(form.querySelector("button"), () => api("matching-feature-applications", { method: "POST", body: data })); form.reset(); await loadFeatures(); showMessage("#matchingFeatureMessage", "莓好圈輪播申請已送出。"); } catch (error) { showMessage("#matchingFeatureMessage", error.message, true); } });

  let starCirclePayload = { categories: [], follows: [] }, activeStarCategory = "all";
  const renderStarCircle = () => {
    const categoryRoot = document.querySelector("#followCategoryFilters"), listRoot = document.querySelector("#starCircleList");
    if (!categoryRoot || !listRoot) return;
    categoryRoot.innerHTML = `<button type="button" data-star-category="all">全部</button>${starCirclePayload.categories.map((item) => `<button type="button" data-star-category="${escapeHtml(item.category_id)}">${escapeHtml(item.category_name)}${item.is_public ? "・公開" : ""}</button>`).join("")}`;
    categoryRoot.querySelectorAll("button").forEach((button) => { button.classList.toggle("active", button.dataset.starCategory === activeStarCategory); button.addEventListener("click", () => { activeStarCategory = button.dataset.starCategory; renderStarCircle(); }); });
    const rows = activeStarCategory === "all" ? starCirclePayload.follows : starCirclePayload.follows.filter((item) => item.category_ids.includes(activeStarCategory));
    listRoot.innerHTML = rows.map((item) => { const profile=item.profile||{}; const href=new URL("match.html",location.href); href.searchParams.set("profile",profile.public_slug||""); return `<article class="resource-card"><div class="resource-card-head"><span>⭐ 追蹤中</span></div><h3>${escapeHtml(profile.display_name||"莓好圈會員")}</h3><p>${escapeHtml(profile.headline||"查看我的莓好圈")}</p><a class="btn ghost small" href="${escapeHtml(href.href)}">查看 MY 莓好圈</a></article>`; }).join("") || '<p class="muted">目前沒有這個分類的追蹤對象。</p>';
  };
  const loadStarCircle = async () => { starCirclePayload = await api("follow-categories"); renderStarCircle(); };
  document.querySelector("#followCategoryForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const form=event.currentTarget,data=Object.fromEntries(new FormData(form)); data.is_public=Boolean(form.elements.is_public.checked); try { await withButtonPending(form.querySelector("button"),()=>api("follow-categories",{method:"POST",body:data})); form.reset(); await loadStarCircle(); showMessage("#starCircleMessage","追蹤分類已新增。"); } catch(error){ showMessage("#starCircleMessage",error.message,true); } });

  const resourceNeedRoot = document.querySelector("#resourceNeedList");
  const loadResourceNeeds = async () => { const items=phase2Items(await api("my-resource-needs"),"needs","items"); if(resourceNeedRoot) resourceNeedRoot.innerHTML=items.map((item)=>`<article class="phase2-card"><div class="phase2-card-head"><strong>${escapeHtml(item.title)}</strong>${phase2Status(item.status)}</div><p>${escapeHtml(item.description||"尚未填寫需求內容")}</p><div class="phase2-actions">${["draft","seeking"].includes(item.status)?`<button class="btn ghost small" type="button" data-close-resource-need="${escapeHtml(item.need_id)}">標記已完成</button>`:""}</div></article>`).join("")||'<p class="muted">目前沒有資源需求。</p>'; resourceNeedRoot?.querySelectorAll("[data-close-resource-need]").forEach((button)=>button.addEventListener("click",async()=>{try{await api("my-resource-needs",{method:"PATCH",body:{need_id:button.dataset.closeResourceNeed,status:"completed"}});await loadResourceNeeds();}catch(error){showMessage("#resourceNeedMessage",error.message,true);}})); };
  document.querySelector("#resourceNeedForm")?.addEventListener("submit",async(event)=>{event.preventDefault();const form=event.currentTarget,data=Object.fromEntries(new FormData(form));try{await withButtonPending(form.querySelector("button"),()=>api("my-resource-needs",{method:"POST",body:data}));form.reset();await loadResourceNeeds();showMessage("#resourceNeedMessage","資源需求已新增。");}catch(error){showMessage("#resourceNeedMessage",error.message,true);}});

  await Promise.all([loadIdentity(), loadProfile(), loadRecords(), loadFeatures(), loadStarCircle(), loadResourceNeeds()]);
}

function showAdminPeopleMessage(text, isError = false) {
  const root = document.querySelector("#peopleMessage");
  showActionFeedback(root, text, isError);
}

const actionFeedbackTimers = new WeakMap();
const buttonSuccessTimers = new WeakMap();
function showActionFeedback(root, text, isError = false, scrollIntoView = false) {
  if (!root) return;
  const previousTimer = actionFeedbackTimers.get(root);
  if (previousTimer) {
    window.clearTimeout(previousTimer);
    actionFeedbackTimers.delete(root);
  }
  root.textContent = text;
  root.setAttribute("aria-live", isError ? "assertive" : "polite");
  root.classList.toggle("hidden", !text);
  root.classList.toggle("error", isError);
  root.classList.toggle("success", Boolean(text) && !isError);
  if (text && scrollIntoView) {
    window.requestAnimationFrame(() => root.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
  }
  if (text) {
    actionFeedbackTimers.set(root, window.setTimeout(() => {
      root.classList.add("hidden");
      actionFeedbackTimers.delete(root);
    }, 7000));
  }
}

function showAdminPanelMessage(text, isError, contextElement) {
  const panel = contextElement?.closest?.("[data-people-panel]");
  if (!panel) { showAdminPeopleMessage(text, isError); return; }
  let root = panel.querySelector(":scope > [data-action-feedback]");
  if (!root) {
    root = document.createElement("div");
    root.className = "demo-note action-feedback hidden";
    root.dataset.actionFeedback = "";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    panel.prepend(root);
  }
  showActionFeedback(root, text, isError, true);
}

async function withButtonPending(button, action) {
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "儲存中…";
  }
  try { return await action(); }
  finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function rememberButtonRestoreText(button, fallbackText = "") {
  if (!button) return fallbackText;
  if (!Object.hasOwn(button.dataset, "restoreText")) button.dataset.restoreText = fallbackText || button.textContent || "";
  return button.dataset.restoreText;
}

function resetButtonSuccess(button) {
  if (!button) return "";
  const restoreText = rememberButtonRestoreText(button);
  const previousTimer = buttonSuccessTimers.get(button);
  if (previousTimer) window.clearTimeout(previousTimer);
  buttonSuccessTimers.delete(button);
  button.classList.remove("save-success");
  button.textContent = restoreText;
  return restoreText;
}

function showButtonSuccess(button, restoreText, duration = 2500) {
  if (!button) return;
  rememberButtonRestoreText(button, restoreText);
  const previousTimer = buttonSuccessTimers.get(button);
  if (previousTimer) window.clearTimeout(previousTimer);
  buttonSuccessTimers.delete(button);
  button.disabled = false;
  button.classList.add("save-success");
  button.textContent = "✓ 已儲存";
  buttonSuccessTimers.set(button, window.setTimeout(() => {
    button.classList.remove("save-success");
    button.textContent = button.dataset.restoreText;
    buttonSuccessTimers.delete(button);
  }, duration));
}

async function withButtonSaveFeedback(button, action, resolveVisibleButton = () => button) {
  const restoreText = rememberButtonRestoreText(button);
  if (button) {
    resetButtonSuccess(button);
    button.disabled = true;
    button.textContent = "儲存中…";
  }
  try {
    const result = await action();
    showButtonSuccess(resolveVisibleButton() || button, restoreText);
    return result;
  } catch (error) {
    if (button) {
      resetButtonSuccess(button);
      button.disabled = false;
    }
    throw error;
  }
}

const profileFieldLabels = {
  provider_id: "提供者編號", display_name: "顯示名稱", provider_type: "提供者類型", bio: "簡介", status: "上架狀態",
  entity_type: "身分型態", brand_name: "品牌／工作室名稱", service_area: "服務／合作地區", service_mode: "服務方式",
  website: "官方網站", instagram: "Instagram", facebook: "Facebook", line: "LINE", portfolio_urls: "作品集網址",
  pricing_description: "價格說明", quote_method: "報價方式", member_discount: "會員優惠", accept_projects: "接受專案合作",
  accept_long_term: "接受長期合作", available_hours: "可服務時段", availability_status: "接案狀態", approval_status: "審核狀態",
  admin_note: "內部備註", service_ids: "提供服務", partner_id: "合作夥伴編號", organization_name: "單位／品牌名稱",
  partner_types: "夥伴類型", introduction: "簡介", social_links: "社群連結", location: "所在地點", resources: "可提供資源",
  cooperation_methods: "合作方式", cooperation_conditions: "合作條件", price_description: "價格說明", advertising_interest: "廣告合作意願",
  matching_interest: "媒合意願", looking_for: "想找什麼", need_categories: "需求類別", budget_min: "預算下限",
  budget_max: "預算上限", region: "地區", timeline: "時程", cooperation_type: "合作型態", is_public: "公開顯示",
  accept_matching: "接受媒合",
};
const profileEnumLabels = {
  individual: "個人", brand: "品牌", store: "店家", person: "個人", team: "團隊",
  online: "線上", offline: "實體", both: "線上＋實體",
  active: "啟用", paused: "暫停", hidden: "不公開", archived: "已封存",
  available: "可接案", partial: "部分時段可接", internal_only: "僅限內部", standby: "待命",
  pending: "審核中", approved: "已通過", rejected: "未通過", suspended: "已停用",
  supplier: "供應商", advertising: "廣告合作", cross_industry: "異業合作", channel: "通路", venue: "場地",
  lecturer: "講師", consultant: "顧問", other: "其他",
};
const profileFieldLabel = (key) => Object.hasOwn(profileFieldLabels, key) ? profileFieldLabels[key] : key;
const profileEnumLabel = (value, fieldKey = "") => {
  if (fieldKey === "availability_status" && value === "paused") return "暫停接案";
  return Object.hasOwn(profileEnumLabels, value) ? profileEnumLabels[value] : String(value);
};
const formatProfileValue = (value, fieldKey = "") => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.length ? value.map((item) => profileEnumLabel(item, fieldKey)).join("、") : "—";
  if (typeof value === "object") {
    const parts = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "").map(([key, item]) => `${profileFieldLabel(key)}：${formatProfileValue(item, key)}`);
    return parts.length ? parts.join("、") : "—";
  }
  return profileEnumLabel(value, fieldKey);
};

const accountStatusMeta = {
  active: ["啟用", "active"],
  suspended: ["停權", "suspended"],
};
const accountStatusBadge = (status) => {
  const meta = Object.hasOwn(accountStatusMeta, status) ? accountStatusMeta[status] : [String(status || "active"), "unknown"];
  return `<span class="account-status-badge account-status-${escapeHtml(meta[1])}">${escapeHtml(meta[0])}</span>`;
};

async function publicPhase2Api(action, query = "", options = {}) {
  const publicApiBase = cfg.matchingPublicApiBase || cfg.apiBase.replace(/\/booking-api\/?$/, "/matching-public");
  const response = await fetch(`${publicApiBase}?action=${encodeURIComponent(action)}${query}`, { method: options.method || "GET", headers: options.body ? { "Content-Type": "application/json" } : undefined, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 404 ? "找不到這個莓好圈頁面，或頁面目前未公開。" : (data.message || data.error || "莓好預約圈資料暫時無法載入。"));
  return data;
}

const resourceCategoryLabels = { benefits:"福利／補助",ai_digital:"AI／數位",learning:"學習／課程",work_tools:"工作工具",market_work:"市場／工作／創業",lifestyle:"生活",events_cooperation:"活動／合作／機會" };
function resourceCard(item, source = "resource_center") {
  return `<article class="resource-card" data-resource-card="${escapeHtml(item.resource_id)}"><div class="resource-card-head"><span>${escapeHtml(resourceCategoryLabels[item.category]||item.category)}</span>${item.featured?'<span class="badge neutral">精選</span>':""}</div><h3>${escapeHtml(item.resource_name)}</h3><p>${escapeHtml(item.resource_description||"")}</p><div class="resource-tag-row">${(item.tags||[]).slice(0,4).map((tag)=>`<span>${escapeHtml(tag)}</span>`).join("")}</div><div class="resource-actions"><a class="btn small" href="${escapeHtml(item.resource_url)}" target="_blank" rel="noopener noreferrer" data-resource-open="${escapeHtml(item.resource_id)}" data-resource-source="${escapeHtml(source)}">開啟資源</a>${(item.related_service_ids||[]).length?'<a class="btn ghost small" href="index.html#serviceCatalog">相關莓好服務</a>':""}<a class="btn ghost small" href="match.html?v=20261008-resource-circle">相關莓好圈</a></div></article>`;
}
function bindResourceClicks(root) {
  root?.querySelectorAll("[data-resource-open]").forEach((link)=>link.addEventListener("click",()=>{ publicPhase2Api("resource-click","",{method:"POST",body:{resource_id:link.dataset.resourceOpen,source:link.dataset.resourceSource||"resource_center",destination_type:"resource"}}).catch(()=>{}); }));
}
async function initResourcesHomeFeed() {
  const root=document.querySelector("#resourceHomeFeed"); if(!root)return;
  try { const items=phase2Items(await publicPhase2Api("public-resources","&featured=true&limit=6"),"resources","items"); root.innerHTML=items.map((item)=>resourceCard(item,"home")).join("")||'<p class="muted">目前沒有精選資源。</p>'; bindResourceClicks(root); }
  catch { root.innerHTML='<p class="muted">熱門資源暫時無法載入，請稍後再試。</p>'; }
}
async function initResourcesPage() {
  const listRoot=document.querySelector("#resourceList"),filterRoot=document.querySelector("#resourceCategoryFilter"),search=document.querySelector("#resourceSearch"); if(!listRoot)return;
  try {
    const items=phase2Items(await publicPhase2Api("public-resources","&limit=100"),"resources","items"); let active="all";
    const render=()=>{ const query=String(search?.value||"").trim().toLowerCase(); const filtered=items.filter((item)=>(active==="all"||item.category===active)&&(!query||JSON.stringify([item.resource_name,item.resource_description,item.tags,item.sub_category]).toLowerCase().includes(query))); listRoot.innerHTML=filtered.map((item)=>resourceCard(item,"resource_center")).join("")||'<p class="muted">沒有符合條件的資源。</p>'; bindResourceClicks(listRoot); filterRoot?.querySelectorAll("button").forEach((button)=>{const selected=button.dataset.resourceCategory===active;button.classList.toggle("active",selected);button.setAttribute("aria-pressed",String(selected));}); };
    if(filterRoot){ const categories=[...new Set(items.map((item)=>item.category))]; filterRoot.innerHTML=`<button type="button" data-resource-category="all" aria-pressed="true">全部</button>${categories.map((category)=>`<button type="button" data-resource-category="${escapeHtml(category)}" aria-pressed="false">${escapeHtml(resourceCategoryLabels[category]||category)}</button>`).join("")}`; filterRoot.querySelectorAll("button").forEach((button)=>button.addEventListener("click",()=>{active=button.dataset.resourceCategory;render();})); }
    search?.addEventListener("input",render); render();
  } catch(error){listRoot.innerHTML=`<p class="muted">莓好資源暫時無法載入：${escapeHtml(error.message)}</p>`;}
}

const matchingList = (value) => Array.isArray(value) ? value.filter(Boolean) : (value ? [value] : []);
const matchingLabel = (value) => {
  const labels = {
    online: "線上合作", offline: "實體合作", both: "線上＋實體", project: "專案合作",
    long_term: "長期合作", one_time: "單次合作", flexible: "彈性洽談", available: "目前可合作",
    partial: "部分時段可合作", paused: "暫停洽談", service: "服務媒合", need: "需求媒合",
    cooperation: "合作媒合", resource: "資源媒合",
  };
  return labels[String(value)] || String(value).replaceAll("_", " ");
};
const matchingChips = (values, emptyText = "資料洽談中") => {
  const items = matchingList(values);
  return items.length ? items.map((value) => `<span class="matching-chip">${escapeHtml(matchingLabel(value))}</span>`).join("") : `<span class="matching-chip is-muted">${escapeHtml(emptyText)}</span>`;
};
const matchingInitial = (value) => [...String(value || "莓")][0] || "莓";
const matchingMoneyRange = (minimum, maximum) => {
  if (minimum == null && maximum == null) return "預算面議";
  if (minimum != null && maximum != null) return `${money(minimum)} ～ ${money(maximum)}`;
  return minimum != null ? `${money(minimum)} 起` : `${money(maximum)} 以內`;
};
function showMatchingToast(message) {
  const toast = document.querySelector("#matchingToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showMatchingToast.timer);
  showMatchingToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}
function bindMatchingShare(root, title) {
  root?.querySelectorAll("[data-match-share]").forEach((button) => button.addEventListener("click", async () => {
    const shareData = { title: `我的莓好圈｜${title}`, text: "查看我的莓好圈", url: location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(location.href); showMatchingToast("我的莓好圈連結已複製"); }
    } catch (error) {
      if (error?.name !== "AbortError") showMatchingToast("無法自動分享，請從網址列複製連結");
    }
  }));
}
async function initMatchingHomeFeed() {
  const root = document.querySelector("#matchingHomeFeed");
  if (!root) return;
  try {
    const payload = await publicPhase2Api("matching-discovery-feed", "&limit=12");
    const items = [...phase2Items(payload, "carousel"), ...phase2Items(payload, "popular")].filter((item,index,rows)=>rows.findIndex((row)=>row.user_id===item.user_id)===index).slice(0,6);
    root.innerHTML = items.map((item) => {
      if (item.entity_type === "official_partner") return officialMatchingCard(item);
      const href = new URL("match.html", location.href); href.searchParams.set("v", "20261008-resource-circle");
      href.searchParams.set("profile", String(item.public_slug || ""));
      return `<article class="matching-feed-card"><p class="eyebrow">${escapeHtml((item.identities||[]).map((tag)=>tag.name).join("・")||"莓好圈會員")}</p><h3>${escapeHtml(item.display_name || "莓好圈會員")}</h3><p>${escapeHtml(item.headline || "查看公開的我的莓好圈")}</p><div class="circle-social-counts"><span>❤️ ${Number(item.stats?.like_count||0)}</span><span>⭐ ${Number(item.stats?.follower_count||0)}</span></div><a class="btn ghost small" href="${escapeHtml(href.href)}">查看 MY 莓好圈</a></article>`;
    }).join("") || '<p class="muted">目前沒有排程中的莓好圈推薦，歡迎稍後再來看看。</p>';
  } catch (error) {
    root.innerHTML = `<p class="muted">莓好圈推薦暫時無法載入。<a href="match.html?v=20261008-resource-circle">進入莓好預約圈</a></p>`;
  }
}

async function initMatchingPage() {
  const params = new URLSearchParams(location.search), slug = params.get("profile")?.trim();
  const state = document.querySelector("#matchingProfileState"), root = document.querySelector("#matchingPublicProfile");
  const categoryRoot = document.querySelector("#matchingCategoryFilter");
  const carouselSection = document.querySelector("#matchingCarouselSection"), carouselRoot = document.querySelector("#matchingCarousel"), carouselIndicator = document.querySelector("#matchingCarouselIndicator");
  const latestSection = document.querySelector("#matchingLatestSection"), latestRoot = document.querySelector("#matchingLatestFeed");
  const popularSection = document.querySelector("#matchingPopularSection"), popularRoot = document.querySelector("#matchingPopularFeed");
  const feedCard = (item) => {
    if (item.entity_type === "official_partner") return officialMatchingCard(item);
    const itemSlug = String(item.public_slug || "");
    const href = new URL("match.html", location.href); href.searchParams.set("v", "20261008-resource-circle"); href.searchParams.set("profile", itemSlug);
    const identities = item.identities || [], avatar = safeHttpUrl(item.avatar_url);
    return `<article class="matching-feed-card">${avatar?`<img class="matching-feed-avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(item.display_name||"會員")}的頭像" loading="lazy" />`:`<div class="matching-feed-avatar matching-avatar-fallback" aria-hidden="true">${escapeHtml(matchingInitial(item.display_name))}</div>`}<h3>${escapeHtml(item.display_name || "莓好圈會員")}</h3><p>${escapeHtml(item.headline||"查看我的莓好圈")}</p>${identities.length ? `<div class="matching-chip-row" aria-label="已認證身份">${identities.map((tag) => `<span class="matching-chip">🔵 ${escapeHtml(tag.name||"身份")}</span>`).join("")}</div>` : ""}<div class="circle-social-counts"><span>❤️ ${Number(item.stats?.like_count||0)}</span><span>⭐ ${Number(item.stats?.follower_count||0)}</span></div><a class="btn ghost small" href="${escapeHtml(href.href)}">查看 MY 莓好圈</a></article>`;
  };
  const renderFeed = async () => {
    const payload = await publicPhase2Api("matching-discovery-feed", "&limit=50");
    const items = phase2Items(payload, "items"), categories = phase2Items(payload, "categories");
    let activeCategory = "all";
    let carouselIndex = 0, carouselTimer;
    const filteredByCategory = (rows) => activeCategory === "all" ? rows : rows.filter((item) => (item.identities||[]).some((tag) => String(tag.tag_id) === activeCategory));
    const renderCarousel = () => {
      const rows=filteredByCategory(phase2Items(payload,"carousel")); if(!carouselRoot||!carouselSection)return;
      if(!rows.length){carouselRoot.innerHTML='<p class="muted">目前沒有排程中的推薦輪播。</p>';if(carouselIndicator)carouselIndicator.textContent="0 / 0";carouselSection.classList.remove("hidden");return;}
      carouselIndex=(carouselIndex+rows.length)%rows.length;carouselRoot.innerHTML=feedCard(rows[carouselIndex]);if(carouselIndicator)carouselIndicator.textContent=`${carouselIndex+1} / ${rows.length}`;carouselSection.classList.remove("hidden");
      window.clearInterval(carouselTimer);if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&rows.length>1)carouselTimer=window.setInterval(()=>{carouselIndex++;renderCarousel();},5000);
    };
    const renderLists = () => {
      const empty = '<p class="muted">目前沒有此分類的莓好圈推薦。</p>';
      latestRoot.innerHTML = filteredByCategory(phase2Items(payload,"latest")).map(feedCard).join("") || empty;
      popularRoot.innerHTML = filteredByCategory(phase2Items(payload,"popular")).map(feedCard).join("") || empty;
      categoryRoot.querySelectorAll("button").forEach((button) => {
        const selected = button.dataset.circleCategory === activeCategory;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    };
    categoryRoot.innerHTML = `<button type="button" data-circle-category="all" aria-pressed="true">全部</button>${categories.map((tag)=>`<button type="button" data-circle-category="${escapeHtml(tag.tag_id)}" aria-pressed="false">${escapeHtml(tag.name)}</button>`).join("")}`;
    categoryRoot.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { activeCategory = button.dataset.circleCategory; carouselIndex=0; renderLists(); renderCarousel(); }));
    document.querySelector("#matchingCarouselPrev")?.addEventListener("click",()=>{carouselIndex--;renderCarousel();});document.querySelector("#matchingCarouselNext")?.addEventListener("click",()=>{carouselIndex++;renderCarousel();});
    renderLists();renderCarousel();
    categoryRoot.classList.remove("hidden");
    latestSection.classList.remove("hidden");
    popularSection.classList.remove("hidden");
  };
  if (!slug) {
    state.innerHTML = '<h1>莓好預約圈</h1><p>找到適合的人，讓需要被看見。找服務｜找合作｜找人才｜找機會。</p>';
    await renderFeed(); return;
  }
  try {
    const payload = await publicPhase2Api("public-matching-profile", `&profile=${encodeURIComponent(slug)}`), profile = payload?.profile || payload;
    const publicLinkCandidates = [payload?.provider?.website, payload?.provider?.instagram, payload?.provider?.facebook, payload?.partner?.website, ...phase2Items(payload?.provider?.portfolio_urls || profile.links || [], "items").map((value) => typeof value === "string" ? value : value?.url)];
    const publicLinks = [...new Set(publicLinkCandidates.map(safeHttpUrl).filter(Boolean))];
    const tags = phase2Items(payload?.identity_tags || profile.identity_tags || profile.tags || [], "items"), tagById = new Map(tags.map((tag) => [String(tag.tag_id), tag])); const verifications = phase2Items(payload?.verifications || profile.verifications || [], "items");
    const provider = payload?.provider, partner = payload?.partner, seeker = payload?.seeker;
    const hasDemand = Boolean(seeker), isBusiness = Boolean(partner || seeker), isDemand = isBusiness;
    const displayName = profile.welcome_name || profile.display_name || provider?.brand_name || partner?.organization_name || "媒合會員";
    const serviceItems = seeker ? matchingList(seeker.need_categories) : partner ? [...matchingList(partner.partner_types), ...matchingList(partner.resources)] : [provider?.service_mode, provider?.quote_method, provider?.availability_status].flatMap(matchingList);
    const cooperationItems = provider ? [provider.accept_projects ? "專案合作" : null, provider.accept_long_term ? "長期合作" : null, provider.member_discount].filter(Boolean) : partner ? [...matchingList(partner.cooperation_methods), partner.cooperation_conditions].filter(Boolean) : [seeker?.cooperation_type, seeker?.timeline].filter(Boolean);
    const locationText = profile.service_region || provider?.service_area || partner?.service_area || partner?.location || seeker?.region || "地區洽談";
    const introText = profile.public_intro || partner?.introduction || seeker?.looking_for || "尚未提供公開簡介。";
    const detailTitle = hasDemand ? "正在尋找" : partner ? "合作資源與方向" : "我可以提供";
    const detailSubtitle = hasDemand ? "需求項目與合作條件" : partner ? "單位可提供的資源與合作類型" : "專業服務與合作能力";
    const priceText = hasDemand ? matchingMoneyRange(seeker?.budget_min, seeker?.budget_max) : (provider?.pricing_description || partner?.price_description || "合作內容與費用另行洽談");
    root.classList.toggle("matching-profile-demand", isBusiness);
    root.classList.toggle("matching-profile-talent", !isBusiness);
    root.innerHTML = `<section class="matching-profile-hero"><div class="matching-profile-avatar" aria-hidden="true">${escapeHtml(matchingInitial(displayName))}</div><div class="matching-profile-identity"><div class="matching-profile-badges"><span>${isDemand ? "需求方／廠商" : "服務者／合作夥伴"}</span>${verifications.length ? '<span class="is-verified">✓ 平台已認證</span>' : '<span>公開資料已審核</span>'}</div><p class="eyebrow">PUBLIC MATCHING PROFILE</p><h1 id="matchingPublicName">${escapeHtml(displayName)}</h1><p class="matching-headline">${escapeHtml(profile.headline || (isDemand ? seeker?.looking_for : partner?.introduction) || "歡迎透過平台提出媒合")}</p><div class="matching-chip-row">${tags.length ? tags.map((tag) => `<span class="matching-chip">${escapeHtml(tag.name || tag.tag_name || tag)}</span>`).join("") : '<span class="matching-chip is-muted">媒合會員</span>'}</div></div><div class="matching-profile-quick"><span><small>服務／需求地區</small><strong>⌖ ${escapeHtml(locationText)}</strong></span><span><small>可合作時間</small><strong>◷ ${escapeHtml(profile.availability_summary || provider?.available_hours || seeker?.timeline || "時間洽談")}</strong></span></div></section><div class="matching-profile-layout"><div class="matching-profile-content"><section class="matching-detail-card matching-about-card"><div class="matching-card-heading"><span class="matching-section-icon">✦</span><div><p class="eyebrow">ABOUT</p><h2>${isDemand ? "需求說明" : "關於我"}</h2></div></div><p class="preserve-lines matching-intro-copy">${escapeHtml(introText)}</p></section><div class="matching-detail-grid"><section class="matching-detail-card"><div class="matching-card-heading"><span class="matching-section-icon">▦</span><div><p class="eyebrow">${isDemand ? "NEEDS" : "SERVICES"}</p><h2>${detailTitle}</h2><small>${detailSubtitle}</small></div></div><div class="matching-chip-row">${matchingChips(serviceItems)}</div></section><section class="matching-detail-card"><div class="matching-card-heading"><span class="matching-section-icon">↗</span><div><p class="eyebrow">COOPERATION</p><h2>合作方式</h2><small>可依實際內容進一步確認</small></div></div><div class="matching-chip-row">${matchingChips(cooperationItems)}</div></section><section class="matching-detail-card"><div class="matching-card-heading"><span class="matching-section-icon">⌖</span><div><p class="eyebrow">AREA & BUDGET</p><h2>${isDemand ? "地區與預算" : "服務資訊"}</h2></div></div><dl class="matching-detail-list"><div><dt>地區</dt><dd>${escapeHtml(locationText)}</dd></div><div><dt>${isDemand ? "預算" : "費用"}</dt><dd>${escapeHtml(priceText)}</dd></div></dl></section><section class="matching-detail-card"><div class="matching-card-heading"><span class="matching-section-icon">✓</span><div><p class="eyebrow">VERIFICATION</p><h2>平台認證</h2></div></div>${verifications.map((item) => `<div class="verification-public-row"><strong>✓ ${escapeHtml(tagById.get(String(item.tag_id))?.name || "身份")}</strong><span>已核對${item.verified_at ? `・${escapeHtml(new Date(item.verified_at).toLocaleDateString("zh-TW"))}` : ""}</span></div>`).join("") || '<p class="muted">目前沒有公開的有效認證。</p>'}</section></div>${publicLinks.length ? `<section class="matching-detail-card matching-portfolio-card"><div class="matching-card-heading"><span class="matching-section-icon">▣</span><div><p class="eyebrow">PORTFOLIO</p><h2>作品與公開連結</h2></div></div><div class="phase2-link-list">${publicLinks.map((url, index) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">公開連結 ${index + 1} <span aria-hidden="true">↗</span></a>`).join("")}</div></section>` : ""}</div><aside class="matching-profile-aside"><section class="matching-contact-card"><span class="matching-lock-mark" aria-hidden="true">⌁</span><p class="eyebrow">MEMBER CONTACT</p><h2>想與 ${escapeHtml(displayName)} ${isDemand ? "合作" : "洽談"}嗎？</h2><p>公開頁不顯示電話、Email、LINE 或地址。登入會員後，由平台留下可追蹤的媒合紀錄。</p><a class="btn" href="member.html?mode=member#matching-records">登入後提出媒合 <span aria-hidden="true">→</span></a><button class="btn ghost" type="button" data-match-share>分享此頁</button><small>🔒 聯絡資訊受平台保護</small></section><section class="matching-trust-card"><strong>莓好安全媒合</strong><ul><li>公開資料經平台審核</li><li>媒合內容由雙方確認</li><li>可於平台內留下問題回報</li></ul><p>認證只代表平台已核對指定資料，不代表服務品質、履約或專業資格保證。</p></section></aside></div>`;
    root.querySelector(".matching-profile-identity .eyebrow").textContent = "我的莓好圈";
    root.querySelector(".matching-headline").textContent = profile.welcome_message || profile.headline || (isDemand ? seeker?.looking_for : partner?.introduction) || "歡迎透過平台提出媒合";
    root.querySelector("[data-match-share]").textContent = "分享我的莓好圈";
    root.classList.remove("hidden"); state.classList.add("hidden");
    bindMatchingShare(root, displayName);
    const avatarUrl = safeHttpUrl(profile.avatar_url);
    const avatarRoot = root.querySelector(".matching-profile-avatar");
    if (avatarUrl && avatarRoot) {
      avatarRoot.classList.add("has-image");
      avatarRoot.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}的頭像" />`;
    }
    const socialHost = root.querySelector(".matching-contact-card [data-match-share]");
    if (socialHost && profile.user_id) {
      socialHost.insertAdjacentHTML("beforebegin", `<div class="circle-social-actions"><button class="btn ghost" type="button" data-circle-like>♡ 喜歡 <span>${Number(payload?.stats?.like_count || 0)}</span></button><button class="btn ghost" type="button" data-circle-follow>☆ 追蹤 <span>${Number(payload?.stats?.follower_count || 0)}</span></button></div>`);
      const likeButton = root.querySelector("[data-circle-like]"), followButton = root.querySelector("[data-circle-follow]");
      const paintSocial = (social = {}) => {
        likeButton?.classList.toggle("active", Boolean(social.liked));
        followButton?.classList.toggle("active", Boolean(social.followed));
        if (likeButton) likeButton.firstChild.textContent = social.liked ? "♥ 已喜歡 " : "♡ 喜歡 ";
        if (followButton) followButton.firstChild.textContent = social.followed ? "★ 已追蹤 " : "☆ 追蹤 ";
        if (social.stats && likeButton && followButton) {
          likeButton.querySelector("span").textContent = String(Number(social.stats.like_count || 0));
          followButton.querySelector("span").textContent = String(Number(social.stats.follower_count || 0));
        }
      };
      try {
        const client = await getProductionClient();
        const { data: { session } } = await client.auth.getSession();
        if (!session || session.user.id === profile.user_id) {
          likeButton?.addEventListener("click", () => { location.href = session ? "member.html#my-circle" : "member.html?mode=member"; });
          followButton?.addEventListener("click", () => { location.href = session ? "member.html#my-circle" : "member.html?mode=member"; });
          if (session?.user.id === profile.user_id) {
            likeButton?.setAttribute("disabled", "");
            followButton?.setAttribute("disabled", "");
          }
        } else {
          const currentSocial = await api("circle-social", { query: `&target_member_id=${encodeURIComponent(profile.user_id)}` });
          paintSocial(currentSocial);
          [[likeButton, "like"], [followButton, "follow"]].forEach(([button, kind]) => button?.addEventListener("click", async () => {
            const active = !button.classList.contains("active");
            try {
              button.disabled = true;
              const saved = await api("circle-social", { method: "POST", body: { target_member_id: profile.user_id, kind, active } });
              paintSocial({ ...saved, liked: kind === "like" ? active : likeButton.classList.contains("active"), followed: kind === "follow" ? active : followButton.classList.contains("active") });
            } catch (error) { showMatchingToast(error.message); }
            finally { button.disabled = false; }
          }));
        }
      } catch { /* 公開頁可正常瀏覽；登入後再啟用互動。 */ }
    }
    const canonical = new URL("match.html", location.href); canonical.searchParams.set("profile", slug); document.querySelector("#matchingCanonical").href = canonical.href;
    document.title = `我的莓好圈｜${displayName}`; document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    const description = String(profile.headline || profile.public_intro || "查看會員公開的我的莓好圈。").slice(0, 150); document.querySelector('meta[name="description"]')?.setAttribute("content", description); document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    await renderFeed();
  } catch (error) { state.classList.add("error"); state.innerHTML = `<h1>莓好圈頁面目前無法顯示</h1><p>${escapeHtml(error.message)}</p><a class="btn ghost" href="match.html?v=20261008-resource-circle">返回莓好預約圈</a>`; await renderFeed().catch(() => {}); }
}

async function initAdminPeople(isDeveloper, currentUserId) {
  const panels = [...document.querySelectorAll("[data-people-panel]")];
  const tabs = [...document.querySelectorAll("[data-people-tab]")];
  let allTags = [], peoplePage = 1, peopleTotal = 0;
  const showMessage = showAdminPeopleMessage;
  const loadTags = async () => {
    allTags = normalizeList(await api("admin-tags"), "tags").map(normalizeTag);
    const select = document.querySelector("#peopleTag");
    select.innerHTML = '<option value="">全部標籤</option>' + allTags.map((tag) => `<option value="${escapeHtml(tag.tag_id)}">${escapeHtml(tag.name)}｜${escapeHtml(tag.tag_type)}</option>`).join("");
    renderTagRows();
  };
  const roleBadges = (roles = [], options = {}) => roles.filter((role) => !options.hideInactive || role.status !== "inactive").map((role) => {
    const meta = displayRoleStatusMeta(role, options.roleData);
    return `<span class="role-badge ${meta[1]}">${escapeHtml(roleName[role.role_key] || role.role_key)}・${escapeHtml(meta[0])}</span>`;
  }).join("") || '<span class="muted">尚無合作角色</span>';
  const loadPeople = async () => {
    const form = new FormData(document.querySelector("#peopleFilters"));
    const params = new URLSearchParams();
    for (const [key, value] of form) if (value) params.set(key, value);
    params.set("page", String(peoplePage));
    const result = await api("admin-people", { query: `&${params.toString()}` });
    const items = result.items || [];
    peopleTotal = Number(result.total || 0);
    const root = document.querySelector("#peopleRows");
    root.innerHTML = items.map((person) => `<tr><td><div class="people-name"><button type="button" data-person-id="${escapeHtml(person.user_id)}">${escapeHtml(person.full_name || person.name || "未命名會員")}</button><small>${escapeHtml(person.email)}</small></div></td><td>${accountStatusBadge(person.account_status)}</td><td><div class="role-badge-row">${roleBadges(person.partner_roles, { hideInactive: true })}</div></td><td>${(person.tags || []).map(normalizeTag).map((tag) => `<span class="mini-tag">${escapeHtml(tag.name)}</span>`).join("") || "—"}</td><td>${escapeHtml(person.created_at ? new Date(person.created_at).toLocaleDateString("zh-TW") : "—")}</td></tr>`).join("") || '<tr><td colspan="5">沒有符合條件的會員</td></tr>';
    root.querySelectorAll("[data-person-id]").forEach((button) => button.addEventListener("click", () => openPerson(button.dataset.personId).catch((error) => showMessage(error.message, true))));
    const pageSize = Number(result.page_size || 50);
    document.querySelector("#peoplePage").textContent = `第 ${Number(result.page || peoplePage)} 頁・共 ${peopleTotal} 人`;
    document.querySelector("#peoplePrev").disabled = peoplePage <= 1;
    document.querySelector("#peopleNext").disabled = peoplePage * pageSize >= peopleTotal;
  };
  const detailPairs = (data) => Object.entries(data || {}).filter(([key]) => !["user_id", "created_at", "updated_at"].includes(key)).map(([key, value]) => `<dt>${escapeHtml(profileFieldLabel(key))}</dt><dd>${escapeHtml(formatProfileValue(value, key))}</dd>`).join("");
  const closeDrawer = () => { document.querySelector("#personDrawer").hidden = true; document.querySelector("#personDrawerBackdrop").hidden = true; };
  const openPerson = async (userId) => {
    showActionFeedback(document.querySelector("#personDrawerMessage"), "");
    const detail = await api("admin-person", { query: `&user_id=${encodeURIComponent(userId)}` });
    const member = detail.member || {};
    const detailTags = (detail.tags || []).map(normalizeTag);
    const drawer = document.querySelector("#personDrawer"), backdrop = document.querySelector("#personDrawerBackdrop"), root = document.querySelector("#personDrawerBody");
    document.querySelector("#personDrawerTitle").textContent = member.full_name || member.name || member.email || "會員詳情";
    const memberName = member.full_name || member.name || member.email || "未命名會員";
    const accountStatus = member.account_status === "suspended" ? "suspended" : "active";
    const accountStatusProtection = member.role === "developer"
      ? "Developer 帳號受保護"
      : (String(userId) === String(currentUserId) ? "不可停權自己" : "");
    const accountStatusDisabled = Boolean(accountStatusProtection);
    const profileBlocks = [["服務提供者資料", detail.provider], ["合作夥伴資料", detail.partner], ["資源需求者資料", detail.seeker]].filter(([, value]) => value);
    root.innerHTML = `<section class="panel drawer-block"><h3>基本資料</h3><dl class="kv"><dt>Email</dt><dd>${escapeHtml(member.email)}</dd><dt>手機</dt><dd>${escapeHtml(member.phone || "—")}</dd><dt>LINE</dt><dd>${escapeHtml(member.line_id || "—")}</dd><dt>地區</dt><dd>${escapeHtml(member.region || "—")}</dd><dt>帳號狀態</dt><dd id="personAccountStatusBadge">${accountStatusBadge(member.account_status)}</dd></dl></section>
      <section class="panel drawer-block"><h3>角色審核</h3><div id="personRoleReviews">${(detail.roles || []).map((role) => `<div class="review-block"><div class="role-badge-row">${roleBadges([role], { roleData: detail })}</div><label class="field"><span>審核備註</span><textarea data-review-note="${escapeHtml(role.role_key)}">${escapeHtml(role.review_note || "")}</textarea></label><div class="review-actions"><button class="btn ghost small" type="button" data-role-decision="approved" data-role-key="${escapeHtml(role.role_key)}">通過</button><button class="btn ghost small" type="button" data-role-decision="rejected" data-role-key="${escapeHtml(role.role_key)}">不通過</button><button class="btn ghost small" type="button" data-role-decision="inactive" data-role-key="${escapeHtml(role.role_key)}">停用</button></div></div>`).join("") || '<p class="muted">尚無合作角色</p>'}</div></section>
      ${profileBlocks.map(([title, data]) => `<section class="panel drawer-block"><h3>${escapeHtml(title)}</h3><dl class="kv">${detailPairs(data)}</dl></section>`).join("")}
      <section class="panel drawer-block"><h3>標籤</h3><div id="personTags" class="tag-line">${detailTags.map((tag) => `<span class="mini-tag">${escapeHtml(tag.name)} <button class="tag-remove" type="button" data-remove-person-tag="${escapeHtml(tag.tag_id)}" aria-label="移除 ${escapeHtml(tag.name)}">×</button></span>`).join("") || '<span class="muted">尚無標籤</span>'}</div><div class="field"><label for="personTagAdd">新增標籤</label><select id="personTagAdd"><option value="">請選擇</option>${allTags.filter((tag) => tag.status === "active" && !detailTags.some((assigned) => String(assigned.tag_id) === String(tag.tag_id))).map((tag) => `<option value="${escapeHtml(tag.tag_id)}">${escapeHtml(tag.name)}｜${escapeHtml(tag.tag_type)}</option>`).join("")}</select></div><button id="addPersonTag" class="btn ghost small" type="button">加入標籤</button></section>
      <section class="panel drawer-block"><h3>內部資料</h3><div class="field"><span id="personAccountStatusLabel">帳號狀態</span><div class="account-status-row"><div id="personAccountStatus" class="account-status-toggle" role="group" aria-labelledby="personAccountStatusLabel"><button type="button" data-account-status="suspended" aria-pressed="${accountStatus === "suspended"}" ${accountStatusDisabled ? "disabled" : ""}>停權</button><button type="button" data-account-status="active" aria-pressed="${accountStatus === "active"}" ${accountStatusDisabled ? "disabled" : ""}>啟用</button></div><span id="personAccountStatusFeedback" class="account-status-feedback${accountStatusProtection ? " protected" : ""}" role="status" aria-live="polite">${escapeHtml(accountStatusProtection)}</span></div></div><form id="personAdminForm" class="inline-form"><div class="field"><label for="personAdminNote">內部備註</label><textarea id="personAdminNote" name="admin_note" rows="4">${escapeHtml(member.admin_note || "")}</textarea></div><button class="btn small" type="submit">儲存會員資料</button></form></section>
      ${isDeveloper ? (member.role === "developer" ? `<section class="panel drawer-block" data-system-role-section><h3>系統權限（僅 Developer）</h3><p class="demo-note">Developer 帳號受保護</p></section>` : `<section class="panel drawer-block" data-system-role-section><h3>系統權限（僅 Developer）</h3><div class="field"><label for="personSystemRole">系統權限</label><select id="personSystemRole"><option value="member" ${member.role !== "admin" ? "selected" : ""}>member</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>admin</option></select></div><button id="saveSystemRole" class="btn ghost small" type="button">更新系統權限</button></section>`) : ""}
      <section class="panel drawer-block"><h3>同意紀錄</h3><div class="table-scroll"><table class="table"><thead><tr><th>規範</th><th>版本</th><th>狀態</th></tr></thead><tbody>${(detail.agreement_records || []).map((record) => `<tr><td>${escapeHtml(record.agreement_key)}</td><td>v${escapeHtml(record.agreement_version)}</td><td>${escapeHtml(record.status)}</td></tr>`).join("") || '<tr><td colspan="3">尚無同意紀錄</td></tr>'}</tbody></table></div></section>`;
    drawer.hidden = false; backdrop.hidden = false;
    const showDrawerMessage = (text, isError = false) => showActionFeedback(document.querySelector("#personDrawerMessage"), text, isError, true);
    const accountStatusButtons = [...root.querySelectorAll("[data-account-status]")];
    const accountStatusBadgeRoot = root.querySelector("#personAccountStatusBadge");
    const accountStatusFeedback = root.querySelector("#personAccountStatusFeedback");
    let currentAccountStatus = accountStatus;
    let accountStatusFeedbackTimer;
    const renderAccountStatus = (isPending = false) => {
      accountStatusButtons.forEach((button) => {
        const isCurrent = button.dataset.accountStatus === currentAccountStatus;
        button.setAttribute("aria-pressed", String(isCurrent));
        button.disabled = accountStatusDisabled || isPending;
      });
    };
    const showAccountStatusFeedback = (text, state = "") => {
      if (accountStatusFeedbackTimer) window.clearTimeout(accountStatusFeedbackTimer);
      accountStatusFeedback.textContent = text;
      accountStatusFeedback.classList.toggle("success", state === "success");
      accountStatusFeedback.classList.toggle("error", state === "error");
      if (state === "success") {
        accountStatusFeedbackTimer = window.setTimeout(() => {
          accountStatusFeedback.textContent = "";
          accountStatusFeedback.classList.remove("success");
        }, 3000);
      }
    };
    accountStatusButtons.forEach((button) => button.addEventListener("click", async () => {
      const nextStatus = button.dataset.accountStatus;
      if (accountStatusDisabled || nextStatus === currentAccountStatus) return;
      if (nextStatus === "suspended" && !window.confirm(`確定停權「${memberName}」？停權後對方將無法使用網站。`)) return;
      const previousStatus = currentAccountStatus;
      renderAccountStatus(true);
      showAccountStatusFeedback("儲存中…");
      try {
        await api("admin-person", { method: "PATCH", body: { user_id: userId, account_status: nextStatus } });
        currentAccountStatus = nextStatus;
        accountStatusBadgeRoot.innerHTML = accountStatusBadge(nextStatus);
        renderAccountStatus(false);
        showAccountStatusFeedback("✓ 已儲存", "success");
        loadPeople().catch((error) => showMessage(error.message, true));
      } catch (error) {
        currentAccountStatus = previousStatus;
        renderAccountStatus(false);
        showAccountStatusFeedback(error.message, "error");
      }
    }));
    root.querySelectorAll("[data-role-decision]").forEach((button) => button.addEventListener("click", async () => {
      const roleKey = button.dataset.roleKey;
      const reviewNote = root.querySelector(`[data-review-note="${roleKey}"]`).value.trim();
      const decision = button.dataset.roleDecision;
      const decisionLabel = { approved: "通過", rejected: "不通過", inactive: "停用" }[decision] || decision;
      const roleDecisionButtons = [...root.querySelectorAll("[data-role-decision]")].filter((candidate) => candidate.dataset.roleKey === roleKey);
      roleDecisionButtons.forEach((candidate) => { candidate.disabled = true; });
      try {
        await withButtonSaveFeedback(button, async () => { await api("admin-role-review", { method: "PATCH", body: { user_id: userId, role_key: roleKey, decision, review_note: reviewNote } }); await openPerson(userId); await loadPeople(); }, () => [...root.querySelectorAll("[data-role-decision]")].find((candidate) => candidate.dataset.roleDecision === decision && candidate.dataset.roleKey === roleKey));
        showDrawerMessage(`✓ 已儲存：${Object.hasOwn(roleName, roleKey) ? roleName[roleKey] : roleKey}角色${decisionLabel}`);
      } catch (error) { showDrawerMessage(error.message, true); }
      finally { roleDecisionButtons.forEach((candidate) => { candidate.disabled = false; }); }
    }));
    root.querySelector("#personAdminForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('[type="submit"]'), data = Object.fromEntries(new FormData(form));
      try {
        await withButtonSaveFeedback(button, async () => { await api("admin-person", { method: "PATCH", body: { user_id: userId, admin_note: data.admin_note } }); });
        showDrawerMessage("✓ 已儲存：內部備註");
      } catch (error) { showDrawerMessage(error.message, true); }
    });
    root.querySelectorAll("[data-remove-person-tag]").forEach((button) => button.addEventListener("click", async () => {
      const tagId = button.dataset.removePersonTag;
      const tagName = detailTags.find((tag) => String(tag.tag_id) === String(tagId))?.name || "所選標籤";
      try {
        await withButtonPending(button, async () => { await api("admin-person", { method: "PATCH", body: { user_id: userId, remove_tag_ids: [tagId] } }); await openPerson(userId); await loadPeople(); });
        showDrawerMessage(`✓ 已移除標籤：${tagName}`);
      } catch (error) { showDrawerMessage(error.message, true); }
    }));
    root.querySelector("#addPersonTag")?.addEventListener("click", async (event) => {
      const button = event.currentTarget, select = root.querySelector("#personTagAdd"), tagId = select.value;
      if (!tagId) return;
      const tagName = select.selectedOptions[0]?.textContent?.split("｜")[0] || "所選標籤";
      try {
        await withButtonSaveFeedback(button, async () => { await api("admin-person", { method: "PATCH", body: { user_id: userId, add_tag_ids: [tagId] } }); await openPerson(userId); await loadPeople(); }, () => document.querySelector("#addPersonTag"));
        showDrawerMessage(`✓ 已加入標籤：${tagName}`);
      } catch (error) { showDrawerMessage(error.message, true); }
    });
    root.querySelector("#saveSystemRole")?.addEventListener("click", async (event) => {
      const button = event.currentTarget, role = root.querySelector("#personSystemRole").value;
      try {
        await withButtonSaveFeedback(button, async () => { await api("admin-system-role", { method: "PATCH", body: { user_id: userId, role } }); await openPerson(userId); await loadPeople(); }, () => document.querySelector("#saveSystemRole"));
        showDrawerMessage(`✓ 已更新系統權限：${role === "admin" ? "管理員" : "一般會員"}`);
      } catch (error) { showDrawerMessage(error.message, true); }
    });
  };
  const renderTagRows = () => {
    const root = document.querySelector("#tagRows");
    root.innerHTML = allTags.map((tag) => `<tr><td><input data-tag-name="${escapeHtml(tag.tag_id)}" value="${escapeHtml(tag.name)}" /></td><td>${escapeHtml(tag.tag_type)}</td><td>${escapeHtml(tag.slug)}</td><td><select data-tag-status="${escapeHtml(tag.tag_id)}"><option value="active" ${tag.status === "active" ? "selected" : ""}>active</option><option value="hidden" ${tag.status === "hidden" ? "selected" : ""}>hidden</option><option value="archived" ${tag.status === "archived" ? "selected" : ""}>archived</option></select><input data-tag-order="${escapeHtml(tag.tag_id)}" type="number" value="${escapeHtml(tag.sort_order ?? 0)}" aria-label="排序" /></td><td><button class="btn ghost small" type="button" data-save-tag="${escapeHtml(tag.tag_id)}">儲存</button></td></tr>`).join("") || '<tr><td colspan="5">目前沒有標籤</td></tr>';
    root.querySelectorAll("[data-save-tag]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.saveTag, name = root.querySelector(`[data-tag-name="${id}"]`).value.trim();
      try {
        await withButtonPending(button, async () => { await api("admin-tags", { method: "PATCH", body: { tag_id: id, name, status: root.querySelector(`[data-tag-status="${id}"]`).value, sort_order: Number(root.querySelector(`[data-tag-order="${id}"]`).value) } }); await loadTags(); });
        showAdminPanelMessage(`✓ 已儲存標籤：${name}`, false, document.querySelector('[data-people-panel="tags"]'));
      } catch (error) { showAdminPanelMessage(error.message, true, button); }
    }));
  };
  const loadAgreements = async () => {
    const agreements = normalizeList(await api("admin-agreements"), "agreements");
    const root = document.querySelector("#agreementAdminList");
    root.innerHTML = agreements.map((agreement) => `<article class="card agr-card"><div class="agr-card-head"><div><strong>${escapeHtml(agreement.title)}</strong><div class="muted">${escapeHtml(agreement.agreement_key)}・v${escapeHtml(agreement.version)}</div></div><span class="badge neutral">${escapeHtml(agreement.status)}</span></div>${agreement.status === "draft" ? `<div class="inline-form"><div class="field"><label>標題</label><input data-agreement-title="${escapeHtml(agreement.agreement_id)}" value="${escapeHtml(agreement.title)}" /></div><div class="field"><label>規範全文</label><textarea rows="6" data-agreement-body="${escapeHtml(agreement.agreement_id)}">${escapeHtml(agreement.body_md)}</textarea></div><button class="btn ghost small" type="button" data-save-agreement="${escapeHtml(agreement.agreement_id)}">儲存草稿</button><label class="field-check"><input type="checkbox" data-publish-confirm="${escapeHtml(agreement.agreement_id)}" />我確認：舊版同意將失效、會員需重新同意</label><button class="btn small" type="button" data-publish-agreement="${escapeHtml(agreement.agreement_id)}" disabled>發布此版本</button></div>` : `<details><summary>查看內容</summary><div class="agreement-body">${renderAgreementMarkdown(agreement.body_md, agreement.title)}</div></details>`}</article>`).join("") || '<p class="muted">目前沒有規範版本</p>';
    root.querySelectorAll("[data-publish-confirm]").forEach((check) => check.addEventListener("change", () => { root.querySelector(`[data-publish-agreement="${check.dataset.publishConfirm}"]`).disabled = !check.checked; }));
    root.querySelectorAll("[data-save-agreement]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.saveAgreement, title = root.querySelector(`[data-agreement-title="${id}"]`).value.trim();
      try {
        await withButtonPending(button, async () => { await api("admin-agreements", { method: "PATCH", body: { agreement_id: id, title, body_md: root.querySelector(`[data-agreement-body="${id}"]`).value } }); await loadAgreements(); });
        showAdminPanelMessage(`✓ 已儲存規範草稿：${title}`, false, document.querySelector('[data-people-panel="agreements"]'));
      } catch (error) { showAdminPanelMessage(error.message, true, button); }
    }));
    root.querySelectorAll("[data-publish-agreement]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.publishAgreement, confirm = root.querySelector(`[data-publish-confirm="${id}"]`);
      if (!confirm.checked) return;
      const title = root.querySelector(`[data-agreement-title="${id}"]`).value.trim();
      try {
        await withButtonPending(button, async () => { await api("admin-agreements", { method: "PATCH", body: { agreement_id: id, action: "publish" } }); await loadAgreements(); });
        showAdminPanelMessage(`✓ 已發布規範版本：${title}`, false, document.querySelector('[data-people-panel="agreements"]'));
      } catch (error) { showAdminPanelMessage(error.message, true, button); }
    }));
  };
  const loadRecords = async () => {
    const form = new FormData(document.querySelector("#agreementRecordFilters")); const params = new URLSearchParams();
    for (const [key, value] of form) if (value) params.set(key, value);
    const items = normalizeList(await api("admin-agreement-records", { query: params.toString() ? `&${params.toString()}` : "" }), "items");
    document.querySelector("#agreementRecordRows").innerHTML = items.map((record) => `<tr><td>${escapeHtml(record.user_id || record.email || "—")}</td><td>${escapeHtml(record.agreement_key)}</td><td>v${escapeHtml(record.agreement_version)}</td><td>${escapeHtml(record.agreed_at ? new Date(record.agreed_at).toLocaleString("zh-TW") : "—")}</td><td>${escapeHtml(record.status)}</td></tr>`).join("") || '<tr><td colspan="5">沒有符合條件的同意紀錄</td></tr>';
  };
  const adminPhase2Definitions = {
    "identity-applications": ["admin-identity-tag-applications", "#adminIdentityApplicationList", ["items", "applications"]],
    "verification-rules": ["admin-verification-rules", "#adminVerificationRuleList", ["items", "rules"]],
    "identity-verifications": ["admin-identity-verifications", "#adminIdentityVerificationList", ["items", "verifications"]],
    "matching-profiles": ["admin-matching-profiles", "#adminMatchingProfileList", ["items", "profiles"]],
    "matching-records": ["admin-matching-records", "#adminMatchingRecordList", ["items", "records"]],
    "matching-reports": ["admin-matching-reports", "#adminMatchingReportList", ["items", "reports"]],
    "matching-features": ["admin-matching-features", "#adminMatchingFeatureList", ["items", "applications"]],
  };
  const phase2AdminTitle = (item, id) => item.proposed_name || item.title || item.display_name || item.subject_title || item.match_code || item.category || ({ "identity-verifications": "會員認證", "matching-features": "輪播申請" }[id] || "項目");
  const phase2AdminSubtitle = (item) => item.email || item.user_id || item.match_code || item.tag_name || item.public_slug || "";
  const phase2AdminActions = (id, item) => {
    const key = item.application_id || item.verification_id || item.user_id || item.report_id || item.rule_id;
    if (!key || id === "matching-records") return "";
    if (id === "identity-applications") return `<button class="btn small" data-phase2-decision="approved">核准新標籤</button><button class="btn ghost small" data-phase2-decision="rejected">不通過</button>`;
    if (id === "verification-rules") return item.status === "draft" ? `<button class="btn small" data-phase2-decision="publish">發布規則</button>` : (item.status === "active" ? `<button class="btn ghost small" data-phase2-decision="retired">停用</button>` : "");
    if (id === "identity-verifications") return item.status === "pending" ? `<button class="btn small" data-phase2-decision="verified">驗證通過</button><button class="btn ghost small" data-phase2-decision="rejected">退回</button>` : (item.status === "verified" ? `<button class="btn ghost small" data-phase2-decision="revoked">撤銷</button>` : "");
    if (id === "matching-profiles") return `<button class="btn small" data-phase2-decision="published">核准發布</button><button class="btn ghost small" data-phase2-decision="hidden">下架</button><button class="btn ghost small" data-phase2-decision="suspended">停權頁面</button>`;
    if (id === "matching-reports") return `<button class="btn small" data-phase2-decision="reviewing">開始處理</button><button class="btn ghost small" data-phase2-decision="resolved">結案</button><button class="btn ghost small" data-phase2-decision="dismissed">不受理</button>`;
    if (id === "matching-features") return `<button class="btn small" data-phase2-decision="approved">核准申請</button><button class="btn ghost small" data-phase2-decision="rejected">不通過</button>${item.status === "approved" ? '<button class="btn ghost small" data-phase2-decision="schedule">建立排程</button>' : ""}`;
    return "";
  };
  const loadAdminPhase2 = async (id) => {
    const [action, selector, keys] = adminPhase2Definitions[id], payload = await api(action), items = phase2Items(payload, ...keys), root = document.querySelector(selector);
    root.innerHTML = items.map((item, index) => `<article class="phase2-card" data-phase2-index="${index}"><div class="phase2-card-head"><div><strong>${escapeHtml(phase2AdminTitle(item, id))}</strong><small>${escapeHtml(phase2AdminSubtitle(item))}</small></div>${phase2Status(item.status)}</div>${item.description || item.purpose || item.public_intro ? `<p>${escapeHtml(item.description || item.purpose || item.public_intro)}</p>` : ""}<label class="field"><span>審核／處理備註</span><textarea data-phase2-note rows="2">${escapeHtml(item.review_note || item.resolution_note || "")}</textarea></label><div class="phase2-actions">${phase2AdminActions(id, item)}</div></article>`).join("") || '<p class="muted">目前沒有待處理資料。</p>';
    root.querySelectorAll("[data-phase2-decision]").forEach((button) => button.addEventListener("click", async () => {
      const card = button.closest("[data-phase2-index]"), item = items[Number(card.dataset.phase2Index)], decision = button.dataset.phase2Decision;
      const body = { status: decision, review_note: card.querySelector("[data-phase2-note]")?.value.trim() || "" };
      if (id === "identity-applications") {
        body.application_id = item.application_id;
        if (decision === "approved") { const matchedTagId = prompt("若要合併既有身份標籤，請輸入標籤 ID；建立新標籤請留空。", ""); if (matchedTagId === null) return; if (matchedTagId.trim()) body.matched_tag_id = matchedTagId.trim(); else { const slug = prompt("請輸入新身份標籤 slug（小寫英數與連字號）", ""); if (slug === null) return; body.slug = slug.trim(); } }
      }
      if (id === "verification-rules") { body.rule_id = item.rule_id; body.status = decision === "publish" ? "active" : "retired"; }
      if (id === "identity-verifications") { body.verification_id = item.verification_id; body.review_note_public = body.review_note; body.review_note_private = ""; delete body.review_note; if (decision === "revoked") { const reason = prompt("請輸入撤銷原因", ""); if (!reason) return; body.revoked_reason = reason; } }
      if (id === "matching-profiles") { body.user_id = item.user_id; body.publish_status = decision; delete body.status; delete body.review_note; }
      if (id === "matching-reports") { body.report_id = item.report_id; body.resolution_note = body.review_note; delete body.review_note; }
      if (id === "matching-features") body.application_id = item.application_id;
      if (decision === "schedule") {
        const startsAt = prompt("排程開始時間（YYYY-MM-DDTHH:MM）", item.requested_start_at?.slice(0, 16) || ""); if (startsAt === null) return;
        const endsAt = prompt("排程結束時間（YYYY-MM-DDTHH:MM）", item.requested_end_at?.slice(0, 16) || ""); if (endsAt === null) return;
        Object.assign(body, { action: "schedule", starts_at: startsAt, ends_at: endsAt, sort_order: 0 }); delete body.status;
      }
      try { await withButtonPending(button, () => api(action, { method: decision === "schedule" ? "POST" : "PATCH", body })); await loadAdminPhase2(id); showAdminPanelMessage("資料已更新。", false, root); }
      catch (error) { showAdminPanelMessage(error.message, true, button); }
    }));
  };
  const showPanel = async (id) => {
    panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.peoplePanel !== id));
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.peopleTab === id));
    if (id === "agreements") await loadAgreements();
    if (id === "records") await loadRecords();
    if (adminPhase2Definitions[id]) await loadAdminPhase2(id);
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => showPanel(tab.dataset.peopleTab).catch((error) => showMessage(error.message, true))));
  document.querySelector("#peopleFilters")?.addEventListener("submit", (event) => { event.preventDefault(); peoplePage = 1; loadPeople().catch((error) => showMessage(error.message, true)); });
  document.querySelector("#peoplePrev")?.addEventListener("click", () => { if (peoplePage > 1) { peoplePage--; loadPeople().catch((error) => showMessage(error.message, true)); } });
  document.querySelector("#peopleNext")?.addEventListener("click", () => { peoplePage++; loadPeople().catch((error) => showMessage(error.message, true)); });
  document.querySelector("#tagCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), data = Object.fromEntries(new FormData(form));
    try {
      await withButtonPending(button, async () => { await api("admin-tags", { method: "POST", body: data }); form.reset(); await loadTags(); });
      showAdminPanelMessage(`✓ 已新增標籤：${data.name}`, false, form);
    } catch (error) { showAdminPanelMessage(error.message, true, form); }
  });
  document.querySelector("#agreementDraftForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), data = Object.fromEntries(new FormData(form));
    data.applies_to_roles = data.applies_to_roles.split(",").map((value) => value.trim()).filter(Boolean);
    try {
      await withButtonPending(button, async () => { await api("admin-agreements", { method: "POST", body: data }); form.reset(); await loadAgreements(); });
      showAdminPanelMessage(`✓ 已新增規範草稿：${data.title}`, false, form);
    } catch (error) { showAdminPanelMessage(error.message, true, form); }
  });
  document.querySelector("#agreementRecordFilters")?.addEventListener("submit", (event) => { event.preventDefault(); loadRecords().catch((error) => showMessage(error.message, true)); });
  document.querySelector("#verificationRuleForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); data.version = Number(data.version); data.valid_days = data.valid_days === "" ? null : Number(data.valid_days); data.requires_manual_review = Boolean(data.requires_manual_review); data.requirements = [{ requirement_key: data.requirement_key, label: data.requirement_label, evidence_type: data.evidence_type, is_required: Boolean(data.is_required), is_public_result: Boolean(data.is_public_result), sort_order: 0 }]; delete data.requirement_key; delete data.requirement_label; delete data.evidence_type; delete data.is_required; delete data.is_public_result; try { await withButtonPending(form.querySelector("button"), () => api("admin-verification-rules", { method: "POST", body: data })); form.reset(); await loadAdminPhase2("verification-rules"); showAdminPanelMessage("認證規則草稿已建立。", false, form); } catch (error) { showAdminPanelMessage(error.message, true, form); } });
  document.querySelector("#closePersonDrawer")?.addEventListener("click", closeDrawer);
  document.querySelector("#personDrawerBackdrop")?.addEventListener("click", closeDrawer);
  await loadTags(); await loadPeople();
}

async function initProductionAdmin() {
  const { client } = await requireSession(); bindAccountSwitch(client); const member = memberFromMe(await api("me"));
  if (!["admin", "developer"].includes(member.role)) { document.querySelector(".main").innerHTML = '<div class="demo-note">此帳號沒有管理員權限。</div>'; return; }
  const isDeveloper = member.role === "developer";
  document.title = `${isDeveloper ? "開發者" : "管理"}後台｜莓好預約站`;
  document.querySelector("#adminBrandRole").textContent = isDeveloper ? "DEVELOPER" : "ADMIN";
  document.querySelector("#adminWorkspaceEyebrow").textContent = isDeveloper ? "DEVELOPER WORKSPACE" : "ADMIN WORKSPACE";
  document.querySelector("#adminWorkspaceTitle").textContent = isDeveloper ? "開發者與營運工作台" : "營運管理工作台";
  document.querySelector("#adminRoleBadge").textContent = isDeveloper ? "最高權限・Developer" : "副管理者・Admin";
  document.querySelector("#adminOperatorName").textContent = member.name || member.full_name || member.email || "已登入";
  document.querySelector("#adminAccessNote").textContent = isDeveloper
    ? "Developer 已驗證：可使用完整營運功能與系統狀態；權限由正式 API 驗證。"
    : "Admin 已驗證：可使用營運、詢價、會員與服務資料；系統狀態僅限 Developer。";
  document.querySelectorAll("[data-developer-only]").forEach((element) => element.classList.toggle("hidden", !isDeveloper));
  const adminViews = [...document.querySelectorAll("[data-admin-view]")];
  const adminNav = [...document.querySelectorAll("[data-admin-show]")];
  const allowedViews = new Set(adminViews.filter((view) => !view.hasAttribute("data-developer-only") || isDeveloper).map((view) => view.dataset.adminView));
  const showAdminView = (id) => {
    const next = allowedViews.has(id) ? id : "overview";
    adminViews.forEach((view) => view.classList.toggle("hidden", view.dataset.adminView !== next || (view.hasAttribute("data-developer-only") && !isDeveloper)));
    adminNav.forEach((item) => item.classList.toggle("active", item.dataset.adminShow === next));
    history.replaceState(null, "", `#${next}`);
  };
  adminNav.forEach((item) => item.addEventListener("click", () => showAdminView(item.dataset.adminShow)));
  showAdminView(location.hash.slice(1) || "overview");
  let [orders, services] = await Promise.all([api("admin-orders"), api("admin-services")]);
  let inquiries = await api("admin-inquiries");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
  document.querySelector("#todayRentalCount").textContent = String(orders.filter((order) => order.booking_date === today).length);
  document.querySelector("#todayErrandCount").textContent = String(inquiries.filter((item) => ["pending", "reviewing"].includes(item.status)).length);
  document.querySelector("#adminUnpaidCount").textContent = String(orders.filter((order) => !["PAID", "REFUNDED"].includes(order.payment_status)).length);
  document.querySelector("#todayPaidTotal").textContent = money(orders.filter((order) => order.booking_date === today && order.payment_status === "PAID").reduce((sum, order) => sum + order.total_amount, 0));
  document.querySelector("#adminInquiryCount").textContent = String(inquiries.filter((item) => ["pending", "reviewing"].includes(item.status)).length);
  document.querySelector("#adminServiceCount").textContent = String(services.length);
  document.querySelector("#systemRole").textContent = member.role;
  document.querySelector("#systemServiceCount").textContent = String(services.length);
  document.querySelector("#systemApiStatus").textContent = "正常";
  let calendarFilter = "all";
  const paymentLabel = (status) => ({ PAID: "已付款", PARTIAL: "部分付款", UNPAID: "未付款" }[status] || status);
  const paymentClass = (status) => status === "PAID" ? "ok" : status === "PARTIAL" ? "warn" : "danger";
  const serviceStatusLabels = { DRAFT: "草稿", WAITING_PAYMENT: "等待付款", CONFIRMED: "已確認", IN_PROGRESS: "進行中", COMPLETED: "已完成", CANCELLED: "已取消" };
  const titleFor = (order) => order.order_items?.map((item) => item.label).join("、") || order.category;
  const datedOrders = orders.filter((order) => order.booking_date);
  const focus = datedOrders[0]?.booking_date ? new Date(`${datedOrders[0].booking_date}T12:00:00`) : new Date();
  const year = focus.getFullYear(), month = focus.getMonth();
  document.querySelector("#calendarTitle").textContent = `${year} 年 ${month + 1} 月排程`;
  const renderDay = (date) => {
    const rows = orders.filter((order) => order.booking_date === date);
    document.querySelector("#dayTitle").textContent = `${date} 每日排程`;
    const root = document.querySelector("#daySchedule");
    root.innerHTML = rows.map((order) => `<article class="schedule-row admin-order-row"><strong>${order.booking_time || "時間未定"} ${titleFor(order)}</strong><span>${order.members?.name || order.members?.email || "會員"}</span><span>${money(order.total_amount)}</span><span class="badge ${paymentClass(order.payment_status)}">${paymentLabel(order.payment_status)}</span><div class="admin-order-status"><label for="service-status-${order.id}">服務狀態</label><select id="service-status-${order.id}" data-order-status="${order.id}"><option value="CONFIRMED" ${order.service_status === "CONFIRMED" ? "selected" : ""}>已確認</option><option value="IN_PROGRESS" ${order.service_status === "IN_PROGRESS" ? "selected" : ""}>進行中</option><option value="COMPLETED" ${order.service_status === "COMPLETED" ? "selected" : ""}>已完成</option><option value="CANCELLED" ${order.service_status === "CANCELLED" ? "selected" : ""}>已取消</option></select><button class="btn ghost small" data-save-order-status="${order.id}">更新服務狀態</button><small>目前：${serviceStatusLabels[order.service_status] || escapeHtml(order.service_status)}</small></div></article>`).join("") || '<p class="muted">當日無排程</p>';
    root.querySelectorAll("[data-save-order-status]").forEach((button) => button.addEventListener("click", async () => {
      try {
        const id = button.dataset.saveOrderStatus;
        const serviceStatus = root.querySelector(`[data-order-status="${id}"]`).value;
        const updated = await api("admin-orders", { method: "PATCH", body: { id, service_status: serviceStatus } });
        orders = orders.map((order) => order.id === id ? { ...order, service_status: updated.service_status } : order);
        renderDay(date);
      } catch (error) { alert(error.message); }
    }));
  };
  const openOrder = (id) => { const order = orders.find((item) => item.id === id); if (!order) return; document.querySelector("#eventModalBody").innerHTML = `<h3>${titleFor(order)}</h3><p>${order.booking_date || "日期未定"} ${order.booking_time || ""}</p><p>${order.members?.name || order.members?.email || "會員"}</p><p>金額：<strong>${money(order.total_amount)}</strong></p><p>付款：${paymentLabel(order.payment_status)}</p>`; document.querySelector("#eventModal").hidden = false; };
  const renderCalendar = () => { const root = document.querySelector("#calendar"); const first = new Date(year, month, 1); const days = new Date(year, month + 1, 0).getDate(); let html = ["日", "一", "二", "三", "四", "五", "六"].map((name) => `<div class="cal-head">${name}</div>`).join(""); for (let i = 0; i < first.getDay(); i++) html += '<div class="cal-day"></div>'; for (let day = 1; day <= days; day++) { const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const rows = orders.filter((order) => order.booking_date === date && (calendarFilter === "all" || order.category === calendarFilter)); html += `<div class="cal-day" data-day="${date}"><strong>${day}</strong>${rows.map((order) => `<button class="event ${order.category} ${order.payment_status === "UNPAID" ? "unpaid" : ""}" data-event="${order.id}">${order.booking_time || "--:--"} ${titleFor(order)}</button>`).join("")}</div>`; } root.innerHTML = html; root.querySelectorAll("[data-event]").forEach((button) => button.addEventListener("click", () => openOrder(button.dataset.event))); root.querySelectorAll("[data-day]").forEach((day) => day.addEventListener("dblclick", () => renderDay(day.dataset.day))); };
  document.querySelectorAll("[data-calendar-filter]").forEach((tab) => tab.addEventListener("click", () => { calendarFilter = tab.dataset.calendarFilter; document.querySelectorAll("[data-calendar-filter]").forEach((item) => item.classList.toggle("active", item === tab)); renderCalendar(); }));
  document.querySelector("#closeModal")?.addEventListener("click", () => { document.querySelector("#eventModal").hidden = true; });
  const renderPayments = () => { const filter = document.querySelector("#paymentFilter").value.toUpperCase(); const rows = orders.filter((order) => filter === "ALL" || order.payment_status === filter); document.querySelector("#paymentRows").innerHTML = rows.map((order) => `<tr><td>${order.order_no}</td><td>${titleFor(order)}</td><td>${order.booking_date || ""} ${order.booking_time || ""}</td><td>${money(order.total_amount)}</td><td><span class="badge ${paymentClass(order.payment_status)}">${paymentLabel(order.payment_status)}</span></td></tr>`).join("") || '<tr><td colspan="5">目前沒有訂單</td></tr>'; };
  document.querySelector("#paymentFilter")?.addEventListener("change", renderPayments);
  const categoryLabel = { temporary_staff: "莓你不可", recording_space: "莓好聲音", venue_equipment: "莓好基地", learning: "莓好學習", ai_digital: "莓好數位" };
  const priceTypeLabel = { fixed: "固定價", starting_from: "起價", custom_quote: "客製報價" };
  const bookingTypeLabel = { direct_booking: "直接預約", custom_quote: "先詢價" };
  document.querySelector("#adminServiceRows").innerHTML = services.map((service) => `<tr><td><strong>${escapeHtml(service.service_id)}</strong><br>${escapeHtml(service.service_name)}${service.team_id ? `<br><small><span class="official-partner-badge">官方合作</span> ${escapeHtml(service.team_id)}</small>` : ""}</td><td>${categoryLabel[service.category_id] || escapeHtml(service.category_id)}</td><td>${priceLabel(service)}<br><small>${priceTypeLabel[service.price_type] || escapeHtml(service.price_type)}</small></td><td>${bookingTypeLabel[service.booking_type] || escapeHtml(service.booking_type)}</td><td><span class="badge neutral">${escapeHtml(service.service_status)}</span><br><small>#${service.sort_order}</small></td></tr>`).join("") || '<tr><td colspan="5">目前沒有服務資料</td></tr>';
  const renderAdminInquiries = () => {
    document.querySelector("#adminInquiryRows").innerHTML = inquiries.map((item) => { const details = Object.entries(item.application_payload || {}).filter(([, value]) => value !== "").map(([key, value]) => `<li><b>${escapeHtml(key)}</b>：${escapeHtml(value)}</li>`).join(""); return `<tr><td><strong>${escapeHtml(item.id.slice(0, 8))}</strong><br><small>${escapeHtml(item.members?.full_name || item.members?.name || item.members?.email || "會員")}</small></td><td><strong>${escapeHtml(item.service_name)}</strong><br><small>${item.preferred_date || "日期未定"} ${item.preferred_time || ""}</small></td><td>${escapeHtml(item.requirements)}${details ? `<details><summary>申請欄位</summary><ul>${details}</ul></details>` : ""}</td><td><div class="admin-inquiry-actions"><select data-inquiry-status="${item.id}"><option value="pending" ${item.status === "pending" ? "selected" : ""}>待處理</option><option value="reviewing" ${item.status === "reviewing" ? "selected" : ""}>評估中</option><option value="quoted" ${item.status === "quoted" ? "selected" : ""}>已報價</option><option value="accepted" ${item.status === "accepted" ? "selected" : ""}>已接受</option><option value="closed" ${item.status === "closed" ? "selected" : ""}>已結案</option></select><input data-inquiry-amount="${item.id}" type="number" min="0" step="1" placeholder="報價金額" value="${item.quoted_amount ?? ""}" /><button class="btn ghost small" data-save-inquiry="${item.id}">儲存</button></div></td></tr>`; }).join("") || '<tr><td colspan="4">目前沒有詢價</td></tr>';
    document.querySelectorAll("[data-save-inquiry]").forEach((button) => button.addEventListener("click", async () => {
      try {
        const id = button.dataset.saveInquiry;
        const status = document.querySelector(`[data-inquiry-status="${id}"]`).value;
        const quotedAmount = document.querySelector(`[data-inquiry-amount="${id}"]`).value;
        const updated = await api("admin-inquiries", { method: "PATCH", body: { id, status, quoted_amount: quotedAmount } });
        inquiries = inquiries.map((item) => item.id === id ? { ...item, ...updated } : item);
        document.querySelector("#adminInquiryCount").textContent = String(inquiries.filter((item) => ["pending", "reviewing"].includes(item.status)).length);
        renderAdminInquiries();
      } catch (error) { alert(error.message); }
    }));
  };
  let adminResources = [];
  const resourceForm = document.querySelector("#adminResourceForm");
  const resetResourceForm = () => {
    resourceForm?.reset();
    if (resourceForm?.elements.resource_id) resourceForm.elements.resource_id.value = "";
    if (resourceForm?.elements.sort_order) resourceForm.elements.sort_order.value = "0";
  };
  const renderAdminResources = () => {
    const root = document.querySelector("#adminResourceList");
    document.querySelector("#adminResourceCount").textContent = String(adminResources.length);
    root.innerHTML = adminResources.map((item) => `<article class="phase2-card"><div class="phase2-card-head"><div><strong>${escapeHtml(item.resource_name)}</strong><small>${escapeHtml(resourceCategoryLabels[item.category] || item.category)}・${escapeHtml(item.resource_slug)}</small></div>${phase2Status(item.status)}</div><p>${escapeHtml(item.resource_description || "尚未填寫用途說明")}</p><p class="muted">導流 ${Number(item.click_count || 0)} 次・排序 #${Number(item.sort_order || 0)}${item.featured ? "・首頁精選" : ""}</p><div class="phase2-actions"><a class="btn ghost small" href="${escapeHtml(item.resource_url)}" target="_blank" rel="noopener noreferrer">查看資源</a><button class="btn ghost small" type="button" data-edit-admin-resource="${escapeHtml(item.resource_id)}">編輯</button></div></article>`).join("") || '<p class="muted">目前沒有資源資料。</p>';
    root.querySelectorAll("[data-edit-admin-resource]").forEach((button) => button.addEventListener("click", () => {
      const item = adminResources.find((row) => row.resource_id === button.dataset.editAdminResource);
      if (!item || !resourceForm) return;
      [...resourceForm.elements].forEach((field) => {
        if (!field.name || !(field.name in item)) return;
        if (field.type === "checkbox") field.checked = Boolean(item[field.name]);
        else if (Array.isArray(item[field.name])) field.value = item[field.name].join(", ");
        else field.value = item[field.name] ?? "";
      });
      resourceForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  };
  const loadAdminResources = async () => {
    adminResources = phase2Items(await api("admin-resources"), "resources", "items");
    renderAdminResources();
  };
  resourceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(resourceForm));
    data.featured = Boolean(resourceForm.elements.featured.checked);
    data.sort_order = Number(data.sort_order || 0);
    ["tags", "related_service_ids", "related_role_ids", "related_opportunity_ids"].forEach((key) => { data[key] = String(data[key] || "").split(",").map((value) => value.trim()).filter(Boolean); });
    const method = data.resource_id ? "PATCH" : "POST";
    try {
      await withButtonPending(resourceForm.querySelector('[type="submit"]'), () => api("admin-resources", { method, body: data }));
      resetResourceForm();
      await loadAdminResources();
      showActionFeedback(document.querySelector("#adminResourceMessage"), method === "POST" ? "莓好資源已新增。" : "莓好資源已更新。", false, true);
    } catch (error) { showActionFeedback(document.querySelector("#adminResourceMessage"), error.message, true, true); }
  });
  document.querySelector("#adminResourceCancelEdit")?.addEventListener("click", resetResourceForm);
  renderAdminInquiries();
  await loadAdminResources();
  renderCalendar(); renderDay(today); renderPayments();
  try { await initAdminPeople(isDeveloper, member.user_id); }
  catch (error) { showAdminPeopleMessage(error instanceof Error ? error.message : "會員管理暫時無法載入", true); }
}

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  const production = cfg.mode === "production";
  if(page==='public')(production ? initProductionPublic() : initPublic());
  if(page==='member')(production ? initProductionMember().catch((error) => { if (error.message !== "LOGIN_REQUIRED" && error.code !== "account_suspended") alert(error.message); }) : initMember());
  if(page==='admin')(production ? initProductionAdmin().catch((error) => { if (error.message !== "LOGIN_REQUIRED" && error.code !== "account_suspended") alert(error.message); }) : initAdmin());
  if(page==='match') initMatchingPage().catch((error) => { const root = document.querySelector("#matchingProfileState"); if (root) root.innerHTML = `<h1>莓好圈頁面目前無法顯示</h1><p>${escapeHtml(error.message)}</p>`; });
  if(page==='resources') initResourcesPage();
});
