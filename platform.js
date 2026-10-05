const cfg = window.MEIHAU_CONFIG || { mode: 'mock', auth: {}, api: {} };

// 僅供 config 缺失時的離線相容示範；production 服務一律由 booking.services 載入。
const legacyDemoCatalog = [
  {id:'demo-rental',category:'rental',service:'場地服務',name:'請切換正式模式查看 API 價格'},
  {id:'demo-errand',category:'errand',service:'人力服務',name:'請切換正式模式查看 API 價格'}
];

const money = n => `NT$ ${Math.round(Number(n)||0).toLocaleString('zh-TW')}`;
const priceLabel = (item) => {
  if (item.price_type === "custom_quote" || item.price === null) return "客製報價";
  const amount = money(item.price).replace("NT$ ", "NT$");
  const unit = item.price_unit === "hour" ? "／小時" : item.price_unit === "half_day" ? "／半日" : item.price_unit === "day" ? "／日" : item.price_unit === "project" ? "／專案" : item.included_hours ? `／${item.included_hours} 小時` : "";
  return `${amount}${unit}${item.price_type === "starting_from" ? "起" : ""}`;
};
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

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
  show(location.hash === '#roles' ? 'roles' : 'home');

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
  if (!response.ok) throw new Error(data.message || data.error || "API_ERROR");
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
        const member = currentMember || await api("me");
        location.href = destinationForMember(member);
        return;
      }
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: cfg.redirectUrl } });
      if (error) throw error;
    } catch (error) { alert(`目前無法啟動 Google 登入：${error.message}`); }
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
    } catch (error) { alert(`目前無法啟動 Google 登入：${error.message}`); }
  }));
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
      button.textContent = "切換帳號";
      alert(`目前無法切換帳號：${error.message}`);
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

function fillRoleFields(card, data = {}) {
  card?.querySelectorAll("[data-f]").forEach((field) => {
    const value = data?.[field.dataset.f];
    if (field.type === "checkbox") field.checked = Boolean(value);
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
    const tags = normalizeList(tagPayload, "tags");
    const services = normalizeList(servicePayload, "services");
    const statusByRole = new Map((roleData.roles || []).map((role) => [role.role_key, role]));
    const selectedTagIds = new Set((roleData.tag_ids || []).map(String));
    const agreedById = new Map((roleData.agreements || []).map((agreement) => [String(agreement.agreement_id), Boolean(agreement.agreed)]));
    const checks = [...form.querySelectorAll("[data-role-check]")];
    checks.forEach((check) => { check.checked = statusByRole.has(check.dataset.roleCheck) && statusByRole.get(check.dataset.roleCheck).status !== "inactive"; });
    for (const [key, role] of statusByRole) {
      const target = form.querySelector(`[data-role-status="${key}"]`);
      const meta = roleStatusMeta[role.status] || [role.status, "role-st-inactive"];
      if (target) target.innerHTML = `<span class="role-badge ${meta[1]}">${escapeHtml(meta[0])}</span>`;
      const note = form.querySelector(`[data-role-note="${key}"]`);
      if (note && role.review_note_public) { note.textContent = `審核說明：${role.review_note_public}`; note.classList.remove("hidden"); }
    }
    fillRoleFields(form.querySelector('[data-role-card="provider"]'), roleData.provider);
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
      root.innerHTML = visibleAgreements.map((agreement) => `<article class="agreement-item"><details><summary>${escapeHtml(agreement.title)} <span class="muted">v${escapeHtml(agreement.version)}</span></summary><div class="agreement-body">${escapeHtml(agreement.body_md)}</div></details><label class="field-check agreement-confirm"><input type="checkbox" data-agreement-confirm value="${escapeHtml(agreement.agreement_id)}" ${agreedById.get(String(agreement.agreement_id)) ? "checked" : ""} />我已閱讀並同意此版本</label></article>`).join("") || '<span class="muted">目前沒有可用規範，請稍後再試。</span>';
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
      const invalidUrl = urlValues.find((value) => { try { return !["http:", "https:"].includes(new URL(value).protocol); } catch { return true; } });
      if (invalidUrl) { message.textContent = "作品集與網站網址僅接受 http／https 格式。"; return; }
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
          const meta = roleStatusMeta[role.status] || [role.status, "role-st-inactive"];
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
  show(location.hash === "#roles" ? "roles" : "home");
  let addresses = await api("addresses");
  const list = document.querySelector("#addressList"); const pickup = document.querySelector("#pickupAddress"); const dropoff = document.querySelector("#dropoffAddress");
  const addressTypeLabel = { home: "住家", company: "公司", other: "其他" };
  const renderAddresses = () => { list.innerHTML = addresses.map((a) => `<article class="address-card"><div class="address-card-head"><span class="address-type">${addressTypeLabel[a.address_type] || "其他"}</span><strong>${escapeHtml(a.label)}</strong></div><div class="address-main">${escapeHtml(a.address)}</div><div class="address-recipient"><span>收件人：${escapeHtml(a.recipient || "未填")}</span><span>${escapeHtml(a.phone || "未填電話")}</span></div>${a.note ? `<div class="address-note">收件備註：${escapeHtml(a.note)}</div>` : ""}<button class="btn ghost small" data-delete="${a.id}">刪除</button></article>`).join("") || '<div class="empty-address"><strong>尚未新增常用地址</strong><span>新增住家、公司或其他收件地址，預約時就能直接選用。</span></div>'; list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => { await api("addresses", { method: "DELETE", query: `&id=${button.dataset.delete}` }); addresses = addresses.filter((a) => a.id !== button.dataset.delete); renderAddresses(); })); const options = '<option value="">請選擇常用地址</option>' + addresses.map((a) => `<option value="${a.id}">${addressTypeLabel[a.address_type] || "其他"}｜${escapeHtml(a.label)}｜${escapeHtml(a.address)}</option>`).join(""); if (pickup) pickup.innerHTML = options; if (dropoff) dropoff.innerHTML = options; document.querySelector("#addressCount").textContent = String(addresses.length); };
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
    ["temporary_staff", "臨時人力", "活動、現場與單次支援"],
    ["recording_space", "錄音／空間", "錄音體驗與一日歌手"],
    ["ai_digital", "AI／數位服務", "簡報、網站、Excel 與系統"],
    ["venue_equipment", "陪工作／工作空間", "有人陪你一起把事情做完，也可預約工作空間（即將推出）。"],
  ];
  let category = "recording_space";
  let currentQuote;
  let serviceStateRevision = 0;
  const selectedService = () => catalogData.services.find((item) => item.service_id === planSelect.value);
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
    inquiryFields.classList.toggle("hidden", !isInquiry);
    checkoutButton.textContent = isInquiry ? "立即詢價" : "立即預約";
    checkoutButton.disabled = false;
    if (isInquiry) {
      document.querySelector("#checkoutLines").innerHTML = `<div class="checkout-line"><span>${escapeHtml(item.service_name)}</span><strong>${priceLabel(item)}</strong></div>`;
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
    cardRoot.innerHTML = items.map((item) => `<button type="button" class="service-plan-card ${item.service_id === planSelect.value ? "active" : ""}" data-service-id="${item.service_id}" ${item.service_status !== "active" ? "disabled" : ""}><span class="service-plan-head"><strong>${escapeHtml(item.service_name)}</strong><em>${item.service_status === "coming_soon" ? "即將推出" : priceLabel(item)}</em></span>${item.service_type === "companion" ? '<span class="companion-tags">🧍 真人陪伴｜🏢 工作空間</span>' : ""}<small>${escapeHtml(item.short_description || "")}</small></button>`).join("") || '<p class="muted">目前沒有上架服務</p>';
    cardRoot.querySelectorAll("[data-service-id]:not(:disabled)").forEach((card) => card.addEventListener("click", () => { planSelect.value = card.dataset.serviceId; updateServiceMode().catch((error) => alert(error.message)); cardRoot.querySelectorAll("[data-service-id]").forEach((item) => item.classList.toggle("active", item === card)); }));
    updateServiceMode().catch((error) => alert(error.message));
  };
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
        const created = await api("inquiries", { method: "POST", body: { service_id: item.service_id, preferred_date: bookingDate, preferred_time: bookingTime, requirements, additional_notes: note } });
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
}

async function initAdminPeople(isDeveloper) {
  const panels = [...document.querySelectorAll("[data-people-panel]")];
  const tabs = [...document.querySelectorAll("[data-people-tab]")];
  let allTags = [], peoplePage = 1, peopleTotal = 0;
  const showMessage = (text, isError = false) => {
    const root = document.querySelector("#peopleMessage");
    root.textContent = text;
    root.classList.toggle("hidden", !text);
    root.classList.toggle("error", isError);
  };
  const loadTags = async () => {
    allTags = normalizeList(await api("admin-tags"), "tags");
    const select = document.querySelector("#peopleTag");
    select.innerHTML = '<option value="">全部標籤</option>' + allTags.map((tag) => `<option value="${escapeHtml(tag.tag_id)}">${escapeHtml(tag.name)}｜${escapeHtml(tag.tag_type)}</option>`).join("");
    renderTagRows();
  };
  const roleBadges = (roles = []) => roles.map((role) => {
    const meta = roleStatusMeta[role.status] || [role.status, "role-st-inactive"];
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
    root.innerHTML = items.map((person) => `<tr><td><div class="people-name"><button type="button" data-person-id="${escapeHtml(person.user_id)}">${escapeHtml(person.full_name || person.name || "未命名會員")}</button><small>${escapeHtml(person.email)}</small></div></td><td>${escapeHtml(person.account_status || "active")}</td><td><div class="role-badge-row">${roleBadges(person.partner_roles)}</div></td><td>${(person.tags || []).map((tag) => `<span class="mini-tag">${escapeHtml(tag.name)}</span>`).join("") || "—"}</td><td>${escapeHtml(person.created_at ? new Date(person.created_at).toLocaleDateString("zh-TW") : "—")}</td></tr>`).join("") || '<tr><td colspan="5">沒有符合條件的會員</td></tr>';
    root.querySelectorAll("[data-person-id]").forEach((button) => button.addEventListener("click", () => openPerson(button.dataset.personId).catch((error) => showMessage(error.message, true))));
    const pageSize = Number(result.page_size || 50);
    document.querySelector("#peoplePage").textContent = `第 ${Number(result.page || peoplePage)} 頁・共 ${peopleTotal} 人`;
    document.querySelector("#peoplePrev").disabled = peoplePage <= 1;
    document.querySelector("#peopleNext").disabled = peoplePage * pageSize >= peopleTotal;
  };
  const detailPairs = (data) => Object.entries(data || {}).filter(([key]) => !["admin_note", "user_id", "created_at", "updated_at"].includes(key)).map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join("、") : typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "—")}</dd>`).join("");
  const closeDrawer = () => { document.querySelector("#personDrawer").hidden = true; document.querySelector("#personDrawerBackdrop").hidden = true; };
  const openPerson = async (userId) => {
    const detail = await api("admin-person", { query: `&user_id=${encodeURIComponent(userId)}` });
    const member = detail.member || {};
    const drawer = document.querySelector("#personDrawer"), backdrop = document.querySelector("#personDrawerBackdrop"), root = document.querySelector("#personDrawerBody");
    document.querySelector("#personDrawerTitle").textContent = member.full_name || member.name || member.email || "會員詳情";
    const profileBlocks = [["服務提供者資料", detail.provider], ["合作夥伴資料", detail.partner], ["資源需求者資料", detail.seeker]].filter(([, value]) => value);
    root.innerHTML = `<section class="panel drawer-block"><h3>基本資料</h3><dl class="kv"><dt>Email</dt><dd>${escapeHtml(member.email)}</dd><dt>手機</dt><dd>${escapeHtml(member.phone || "—")}</dd><dt>LINE</dt><dd>${escapeHtml(member.line_id || "—")}</dd><dt>地區</dt><dd>${escapeHtml(member.region || "—")}</dd><dt>帳號狀態</dt><dd>${escapeHtml(member.account_status || "active")}</dd></dl></section>
      <section class="panel drawer-block"><h3>角色審核</h3><div id="personRoleReviews">${(detail.roles || []).map((role) => `<div class="review-block"><div class="role-badge-row">${roleBadges([role])}</div><label class="field"><span>審核備註</span><textarea data-review-note="${escapeHtml(role.role_key)}">${escapeHtml(role.review_note || "")}</textarea></label><div class="review-actions"><button class="btn ghost small" type="button" data-role-decision="approved" data-role-key="${escapeHtml(role.role_key)}">通過</button><button class="btn ghost small" type="button" data-role-decision="rejected" data-role-key="${escapeHtml(role.role_key)}">不通過</button><button class="btn ghost small" type="button" data-role-decision="inactive" data-role-key="${escapeHtml(role.role_key)}">停用</button></div></div>`).join("") || '<p class="muted">尚無合作角色</p>'}</div></section>
      ${profileBlocks.map(([title, data]) => `<section class="panel drawer-block"><h3>${title}</h3><dl class="kv">${detailPairs(data)}</dl></section>`).join("")}
      <section class="panel drawer-block"><h3>標籤</h3><div id="personTags" class="tag-line">${(detail.tags || []).map((tag) => `<span class="mini-tag">${escapeHtml(tag.name)} <button class="tag-remove" type="button" data-remove-person-tag="${escapeHtml(tag.tag_id)}" aria-label="移除 ${escapeHtml(tag.name)}">×</button></span>`).join("") || '<span class="muted">尚無標籤</span>'}</div><div class="field"><label for="personTagAdd">新增標籤</label><select id="personTagAdd"><option value="">請選擇</option>${allTags.filter((tag) => tag.status === "active" && !(detail.tags || []).some((assigned) => assigned.tag_id === tag.tag_id)).map((tag) => `<option value="${escapeHtml(tag.tag_id)}">${escapeHtml(tag.name)}｜${escapeHtml(tag.tag_type)}</option>`).join("")}</select></div><button id="addPersonTag" class="btn ghost small" type="button">加入標籤</button></section>
      <section class="panel drawer-block"><h3>內部資料</h3><form id="personAdminForm" class="inline-form"><div class="field"><label for="personAccountStatus">帳號狀態</label><select id="personAccountStatus" name="account_status"><option value="active" ${member.account_status !== "suspended" ? "selected" : ""}>啟用</option><option value="suspended" ${member.account_status === "suspended" ? "selected" : ""}>停權</option></select></div><div class="field"><label for="personAdminNote">內部備註</label><textarea id="personAdminNote" name="admin_note" rows="4">${escapeHtml(member.admin_note || "")}</textarea></div><button class="btn small" type="submit">儲存會員資料</button></form></section>
      ${isDeveloper ? `<section class="panel drawer-block" data-system-role-section><h3>系統權限（僅 Developer）</h3><div class="field"><label for="personSystemRole">系統權限</label><select id="personSystemRole"><option value="member" ${member.role !== "admin" ? "selected" : ""}>member</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>admin</option></select></div><button id="saveSystemRole" class="btn ghost small" type="button">更新系統權限</button></section>` : ""}
      <section class="panel drawer-block"><h3>同意紀錄</h3><div class="table-scroll"><table class="table"><thead><tr><th>規範</th><th>版本</th><th>狀態</th></tr></thead><tbody>${(detail.agreement_records || []).map((record) => `<tr><td>${escapeHtml(record.agreement_key)}</td><td>v${escapeHtml(record.agreement_version)}</td><td>${escapeHtml(record.status)}</td></tr>`).join("") || '<tr><td colspan="3">尚無同意紀錄</td></tr>'}</tbody></table></div></section>`;
    drawer.hidden = false; backdrop.hidden = false;
    root.querySelectorAll("[data-role-decision]").forEach((button) => button.addEventListener("click", async () => {
      const roleKey = button.dataset.roleKey;
      const reviewNote = root.querySelector(`[data-review-note="${roleKey}"]`).value.trim();
      try { await api("admin-role-review", { method: "PATCH", body: { user_id: userId, role_key: roleKey, decision: button.dataset.roleDecision, review_note: reviewNote } }); await openPerson(userId); await loadPeople(); }
      catch (error) { document.querySelector("#personDrawerMessage").textContent = error.message; document.querySelector("#personDrawerMessage").classList.remove("hidden"); }
    }));
    root.querySelector("#personAdminForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api("admin-person", { method: "PATCH", body: { user_id: userId, admin_note: data.admin_note, account_status: data.account_status } }); await openPerson(userId); await loadPeople(); } catch (error) { showMessage(error.message, true); } });
    root.querySelectorAll("[data-remove-person-tag]").forEach((button) => button.addEventListener("click", async () => { try { await api("admin-person", { method: "PATCH", body: { user_id: userId, remove_tag_ids: [button.dataset.removePersonTag] } }); await openPerson(userId); await loadPeople(); } catch (error) { showMessage(error.message, true); } }));
    root.querySelector("#addPersonTag")?.addEventListener("click", async () => { const tagId = root.querySelector("#personTagAdd").value; if (!tagId) return; try { await api("admin-person", { method: "PATCH", body: { user_id: userId, add_tag_ids: [tagId] } }); await openPerson(userId); await loadPeople(); } catch (error) { showMessage(error.message, true); } });
    root.querySelector("#saveSystemRole")?.addEventListener("click", async () => { try { await api("admin-system-role", { method: "PATCH", body: { user_id: userId, role: root.querySelector("#personSystemRole").value } }); await openPerson(userId); await loadPeople(); } catch (error) { showMessage(error.message, true); } });
  };
  const renderTagRows = () => {
    const root = document.querySelector("#tagRows");
    root.innerHTML = allTags.map((tag) => `<tr><td><input data-tag-name="${escapeHtml(tag.tag_id)}" value="${escapeHtml(tag.name)}" /></td><td>${escapeHtml(tag.tag_type)}</td><td>${escapeHtml(tag.slug)}</td><td><select data-tag-status="${escapeHtml(tag.tag_id)}"><option value="active" ${tag.status === "active" ? "selected" : ""}>active</option><option value="hidden" ${tag.status === "hidden" ? "selected" : ""}>hidden</option><option value="archived" ${tag.status === "archived" ? "selected" : ""}>archived</option></select><input data-tag-order="${escapeHtml(tag.tag_id)}" type="number" value="${escapeHtml(tag.sort_order ?? 0)}" aria-label="排序" /></td><td><button class="btn ghost small" type="button" data-save-tag="${escapeHtml(tag.tag_id)}">儲存</button></td></tr>`).join("") || '<tr><td colspan="5">目前沒有標籤</td></tr>';
    root.querySelectorAll("[data-save-tag]").forEach((button) => button.addEventListener("click", async () => { const id = button.dataset.saveTag; try { await api("admin-tags", { method: "PATCH", body: { tag_id: id, name: root.querySelector(`[data-tag-name="${id}"]`).value.trim(), status: root.querySelector(`[data-tag-status="${id}"]`).value, sort_order: Number(root.querySelector(`[data-tag-order="${id}"]`).value) } }); await loadTags(); } catch (error) { showMessage(error.message, true); } }));
  };
  const loadAgreements = async () => {
    const agreements = normalizeList(await api("admin-agreements"), "agreements");
    const root = document.querySelector("#agreementAdminList");
    root.innerHTML = agreements.map((agreement) => `<article class="card agr-card"><div class="agr-card-head"><div><strong>${escapeHtml(agreement.title)}</strong><div class="muted">${escapeHtml(agreement.agreement_key)}・v${escapeHtml(agreement.version)}</div></div><span class="badge neutral">${escapeHtml(agreement.status)}</span></div>${agreement.status === "draft" ? `<div class="inline-form"><div class="field"><label>標題</label><input data-agreement-title="${escapeHtml(agreement.agreement_id)}" value="${escapeHtml(agreement.title)}" /></div><div class="field"><label>規範全文</label><textarea rows="6" data-agreement-body="${escapeHtml(agreement.agreement_id)}">${escapeHtml(agreement.body_md)}</textarea></div><button class="btn ghost small" type="button" data-save-agreement="${escapeHtml(agreement.agreement_id)}">儲存草稿</button><label class="field-check"><input type="checkbox" data-publish-confirm="${escapeHtml(agreement.agreement_id)}" />我確認：舊版同意將失效、會員需重新同意</label><button class="btn small" type="button" data-publish-agreement="${escapeHtml(agreement.agreement_id)}" disabled>發布此版本</button></div>` : `<details><summary>查看內容</summary><div class="agreement-body">${escapeHtml(agreement.body_md)}</div></details>`}</article>`).join("") || '<p class="muted">目前沒有規範版本</p>';
    root.querySelectorAll("[data-publish-confirm]").forEach((check) => check.addEventListener("change", () => { root.querySelector(`[data-publish-agreement="${check.dataset.publishConfirm}"]`).disabled = !check.checked; }));
    root.querySelectorAll("[data-save-agreement]").forEach((button) => button.addEventListener("click", async () => { const id = button.dataset.saveAgreement; try { await api("admin-agreements", { method: "PATCH", body: { agreement_id: id, title: root.querySelector(`[data-agreement-title="${id}"]`).value.trim(), body_md: root.querySelector(`[data-agreement-body="${id}"]`).value } }); await loadAgreements(); } catch (error) { showMessage(error.message, true); } }));
    root.querySelectorAll("[data-publish-agreement]").forEach((button) => button.addEventListener("click", async () => { if (!root.querySelector(`[data-publish-confirm="${button.dataset.publishAgreement}"]`).checked) return; try { await api("admin-agreements", { method: "PATCH", body: { agreement_id: button.dataset.publishAgreement, action: "publish" } }); await loadAgreements(); } catch (error) { showMessage(error.message, true); } }));
  };
  const loadRecords = async () => {
    const form = new FormData(document.querySelector("#agreementRecordFilters")); const params = new URLSearchParams();
    for (const [key, value] of form) if (value) params.set(key, value);
    const items = normalizeList(await api("admin-agreement-records", { query: params.toString() ? `&${params.toString()}` : "" }), "items");
    document.querySelector("#agreementRecordRows").innerHTML = items.map((record) => `<tr><td>${escapeHtml(record.user_id || record.email || "—")}</td><td>${escapeHtml(record.agreement_key)}</td><td>v${escapeHtml(record.agreement_version)}</td><td>${escapeHtml(record.agreed_at ? new Date(record.agreed_at).toLocaleString("zh-TW") : "—")}</td><td>${escapeHtml(record.status)}</td></tr>`).join("") || '<tr><td colspan="5">沒有符合條件的同意紀錄</td></tr>';
  };
  const showPanel = async (id) => {
    panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.peoplePanel !== id));
    tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.peopleTab === id));
    if (id === "agreements") await loadAgreements();
    if (id === "records") await loadRecords();
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => showPanel(tab.dataset.peopleTab).catch((error) => showMessage(error.message, true))));
  document.querySelector("#peopleFilters")?.addEventListener("submit", (event) => { event.preventDefault(); peoplePage = 1; loadPeople().catch((error) => showMessage(error.message, true)); });
  document.querySelector("#peoplePrev")?.addEventListener("click", () => { if (peoplePage > 1) { peoplePage--; loadPeople().catch((error) => showMessage(error.message, true)); } });
  document.querySelector("#peopleNext")?.addEventListener("click", () => { peoplePage++; loadPeople().catch((error) => showMessage(error.message, true)); });
  document.querySelector("#tagCreateForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api("admin-tags", { method: "POST", body: data }); event.currentTarget.reset(); await loadTags(); } catch (error) { showMessage(error.message, true); } });
  document.querySelector("#agreementDraftForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); data.applies_to_roles = data.applies_to_roles.split(",").map((value) => value.trim()).filter(Boolean); try { await api("admin-agreements", { method: "POST", body: data }); event.currentTarget.reset(); await loadAgreements(); } catch (error) { showMessage(error.message, true); } });
  document.querySelector("#agreementRecordFilters")?.addEventListener("submit", (event) => { event.preventDefault(); loadRecords().catch((error) => showMessage(error.message, true)); });
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
  const categoryLabel = { temporary_staff: "臨時人力", recording_space: "錄音／空間", ai_digital: "AI／數位服務", venue_equipment: "陪工作／工作空間" };
  const priceTypeLabel = { fixed: "固定價", starting_from: "起價", custom_quote: "客製報價" };
  const bookingTypeLabel = { direct_booking: "直接預約", custom_quote: "先詢價" };
  document.querySelector("#adminServiceRows").innerHTML = services.map((service) => `<tr><td><strong>${escapeHtml(service.service_id)}</strong><br>${escapeHtml(service.service_name)}</td><td>${categoryLabel[service.category_id] || escapeHtml(service.category_id)}</td><td>${priceLabel(service)}<br><small>${priceTypeLabel[service.price_type] || escapeHtml(service.price_type)}</small></td><td>${bookingTypeLabel[service.booking_type] || escapeHtml(service.booking_type)}</td><td><span class="badge neutral">${escapeHtml(service.service_status)}</span><br><small>#${service.sort_order}</small></td></tr>`).join("") || '<tr><td colspan="5">目前沒有服務資料</td></tr>';
  const renderAdminInquiries = () => {
    document.querySelector("#adminInquiryRows").innerHTML = inquiries.map((item) => `<tr><td><strong>${escapeHtml(item.id.slice(0, 8))}</strong><br><small>${escapeHtml(item.members?.full_name || item.members?.name || item.members?.email || "會員")}</small></td><td><strong>${escapeHtml(item.service_name)}</strong><br><small>${item.preferred_date || "日期未定"} ${item.preferred_time || ""}</small></td><td>${escapeHtml(item.requirements)}</td><td><div class="admin-inquiry-actions"><select data-inquiry-status="${item.id}"><option value="pending" ${item.status === "pending" ? "selected" : ""}>待處理</option><option value="reviewing" ${item.status === "reviewing" ? "selected" : ""}>評估中</option><option value="quoted" ${item.status === "quoted" ? "selected" : ""}>已報價</option><option value="accepted" ${item.status === "accepted" ? "selected" : ""}>已接受</option><option value="closed" ${item.status === "closed" ? "selected" : ""}>已結案</option></select><input data-inquiry-amount="${item.id}" type="number" min="0" step="1" placeholder="報價金額" value="${item.quoted_amount ?? ""}" /><button class="btn ghost small" data-save-inquiry="${item.id}">儲存</button></div></td></tr>`).join("") || '<tr><td colspan="4">目前沒有詢價</td></tr>';
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
  renderAdminInquiries();
  await initAdminPeople(isDeveloper);
  renderCalendar(); renderDay(today); renderPayments();
}

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  const production = cfg.mode === "production";
  if(page==='public')(production ? initProductionPublic() : initPublic());
  if(page==='member')(production ? initProductionMember().catch((error) => { if (error.message !== "LOGIN_REQUIRED") alert(error.message); }) : initMember());
  if(page==='admin')(production ? initProductionAdmin().catch((error) => { if (error.message !== "LOGIN_REQUIRED") alert(error.message); }) : initAdmin());
});
