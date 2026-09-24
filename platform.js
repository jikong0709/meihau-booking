const cfg = window.MEIHAU_CONFIG || { mode: 'mock', auth: {}, api: {} };

const catalog = [
  {id:'cowork-2h',category:'rental',service:'共享辦公',name:'2 小時',price:99},
  {id:'cowork-half',category:'rental',service:'共享辦公',name:'半日 4 小時',price:150},
  {id:'cowork-day',category:'rental',service:'共享辦公',name:'單日',price:250},
  {id:'cowork-5',category:'rental',service:'共享辦公',name:'5 日券',price:1100},
  {id:'cowork-10',category:'rental',service:'共享辦公',name:'10 日券',price:2000},
  {id:'cowork-month',category:'rental',service:'共享辦公',name:'月租自由座',price:2800},
  {id:'cowork-fixed',category:'rental',service:'共享辦公',name:'月租固定座',price:4000},
  {id:'record-room',category:'rental',service:'錄音／Podcast',name:'純錄音空間／1 小時',price:500},
  {id:'record-equip',category:'rental',service:'錄音／Podcast',name:'空間＋基本設備／1 小時',price:700},
  {id:'record-assist',category:'rental',service:'錄音／Podcast',name:'設備＋基本操作協助／1 小時',price:1000},
  {id:'record-2h',category:'rental',service:'錄音／Podcast',name:'2 小時設備方案',price:1300},
  {id:'record-4h',category:'rental',service:'錄音／Podcast',name:'4 小時設備方案',price:2400},
  {id:'studio-room',category:'rental',service:'攝影／直播',name:'純場地／1 小時',price:600},
  {id:'studio-light',category:'rental',service:'攝影／直播',name:'場地＋基本燈具／1 小時',price:800},
  {id:'studio-gear',category:'rental',service:'攝影／直播',name:'場地＋攝錄設備／1 小時',price:1000},
  {id:'studio-2h',category:'rental',service:'攝影／直播',name:'2 小時拍攝方案',price:1500},
  {id:'studio-4h',category:'rental',service:'攝影／直播',name:'4 小時半日方案',price:2800},
  {id:'makeup-solo',category:'rental',service:'化妝／更衣',name:'單獨租用／1 小時',price:300},
  {id:'makeup-addon',category:'rental',service:'化妝／更衣',name:'搭配錄音／攝影加購／1 小時',price:200},
  {id:'motor',category:'errand',service:'機車配送',name:'預約配送',price:null},
  {id:'urgent',category:'errand',service:'機車配送',name:'急件',price:null},
  {id:'car',category:'errand',service:'汽車配送',name:'汽車配送',price:null},
  {id:'shopping',category:'errand',service:'代買',name:'代買＋配送',price:null},
  {id:'task',category:'errand',service:'跑腿／代辦',name:'1 小時起',price:200}
];

const money = n => `NT$ ${Math.round(Number(n)||0).toLocaleString('zh-TW')}`;
function motorPrice(km){ if(km<=3)return 99;if(km<=5)return 130;if(km<=8)return 180;if(km<=10)return 220;return 220+Math.ceil(km-10)*15; }
function carPrice(km){ return km<=3?220:220+Math.ceil(km-3)*20; }
function waitFee(min){ return min<=10?0:Math.ceil((min-10)/10)*50; }
function stopFee(stops){ return Math.max(0,Math.floor(stops||0))*50; }

function readStore(key,fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function writeStore(key,value){ localStorage.setItem(key,JSON.stringify(value)); }

function initPublic(){
  document.querySelectorAll('[data-login]').forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    if(cfg.auth?.googleLoginUrl){ location.href=cfg.auth.googleLoginUrl; return; }
    location.href='member.html?demo=1';
  }));
}

function initMember(){
  const sections=[...document.querySelectorAll('[data-section]')];
  const nav=[...document.querySelectorAll('[data-show]')];
  function show(id){ sections.forEach(s=>s.classList.toggle('hidden',s.dataset.section!==id)); nav.forEach(n=>n.classList.toggle('active',n.dataset.show===id)); }
  nav.forEach(n=>n.addEventListener('click',()=>show(n.dataset.show)));
  show('home');

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
    const items=catalog.filter(x=>x.category===activeCategory);
    planSelect.innerHTML=items.map(x=>`<option value="${x.id}">${x.service}｜${x.name}${x.price!==null?'｜'+money(x.price):''}</option>`).join('');
    document.querySelector('#errandInputs').classList.toggle('hidden',activeCategory!=='errand');
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
    const item=catalog.find(x=>x.id===planSelect.value) || catalog.find(x=>x.category===activeCategory);
    if(!item)return;
    const lines=[];let total=0;
    if(item.category==='rental'){ total=item.price||0; lines.push([`${item.service}｜${item.name}`,total]); }
    else{
      const km=Math.max(0,Number(document.querySelector('#distanceKm').value||0));
      const wait=Math.max(0,Number(document.querySelector('#waitMinutes').value||0));
      const stops=Math.max(0,Number(document.querySelector('#extraStops').value||0));
      if(item.id==='task'){ total=200;lines.push(['跑腿／代辦 1 小時起',200]); }
      else{
        let delivery=item.id==='car'?carPrice(km):motorPrice(km);
        const isUrgent=item.id==='urgent'||document.querySelector('#urgentFlag').checked;
        if(isUrgent)delivery=Math.round(delivery*1.3);
        lines.push([`${item.id==='car'?'汽車':'機車'}配送 ${km.toFixed(1)} km`,delivery]);total+=delivery;
        if(item.id==='shopping'){lines.push(['代買服務費',80]);total+=80;const goods=Math.max(0,Number(document.querySelector('#shoppingAmount').value||0));if(goods){lines.push(['商品代墊',goods]);total+=goods;}}
        const wf=waitFee(wait);if(wf){lines.push(['等待費',wf]);total+=wf;}
        const sf=stopFee(stops);if(sf){lines.push(['額外停靠',sf]);total+=sf;}
      }
    }
    document.querySelector('#checkoutLines').innerHTML=lines.map(([l,v])=>`<div class="checkout-line"><span>${l}</span><strong>${money(v)}</strong></div>`).join('');
    document.querySelector('#checkoutTotal').textContent=money(total);
    document.querySelector('#checkoutButton').disabled=!total;
  }
  document.querySelector('#checkoutButton')?.addEventListener('click',()=>{
    alert('目前為前端架構版：此按鈕預留給「建立訂單 → 綠界付款」API。部署工程師串接後才會送出正式訂單。');
  });
  renderAddresses();fillAddressOptions();renderPlans();
}

const demoEvents=[
  {id:'R001',date:'2026-09-24',time:'09:00',category:'rental',title:'共享辦公｜陳先生',payment:'paid',amount:250,detail:'單日共享辦公'},
  {id:'E001',date:'2026-09-24',time:'10:00',category:'errand',title:'機車配送｜李小姐',payment:'paid',amount:180,detail:'北屯 → 西屯，6.4 km'},
  {id:'E002',date:'2026-09-24',time:'13:30',category:'errand',title:'代買｜王先生',payment:'unpaid',amount:310,detail:'北區 → 南屯'},
  {id:'R002',date:'2026-09-24',time:'15:00',category:'rental',title:'Podcast｜張小姐',payment:'paid',amount:1300,detail:'錄音 2 小時'},
  {id:'R003',date:'2026-09-26',time:'14:00',category:'rental',title:'攝影棚｜林小姐',payment:'partial',amount:1500,detail:'拍攝 2 小時，已收訂金'}
];

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
  if (!response.ok) throw new Error(data.error || "API_ERROR");
  return data;
}
async function initProductionPublic() {
  document.querySelectorAll("[data-login]").forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const client = await getProductionClient();
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: cfg.redirectUrl } });
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
async function initProductionMember() {
  await requireSession();
  const sections = [...document.querySelectorAll("[data-section]")];
  const nav = [...document.querySelectorAll("[data-show]")];
  const show = (id) => { sections.forEach((section) => section.classList.toggle("hidden", section.dataset.section !== id)); nav.forEach((item) => item.classList.toggle("active", item.dataset.show === id)); };
  nav.forEach((item) => item.addEventListener("click", () => show(item.dataset.show))); show("home");
  const member = await api("me");
  const profileForm = document.querySelector("#profileForm");
  const profileMap = { name: member.name, email: member.email, phone: member.phone, line: member.line_id, contactEmail: member.contact_email };
  Object.entries(profileMap).forEach(([key, value]) => { const field = profileForm?.querySelector(`[name="${key}"]`); if (field) field.value = value || ""; });
  profileForm?.addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(profileForm)); await api("profile", { method: "PATCH", body: { name: form.name, phone: form.phone, line_id: form.line, contact_email: form.contactEmail } }); document.querySelector("#profileStatus").textContent = "已更新"; });
  let addresses = await api("addresses");
  const list = document.querySelector("#addressList"); const pickup = document.querySelector("#pickupAddress"); const dropoff = document.querySelector("#dropoffAddress");
  const renderAddresses = () => { list.innerHTML = addresses.map((a) => `<div class="address-card"><strong>${a.label}</strong><div>${a.address}</div><div class="muted">${a.recipient || ""} ${a.phone || ""}</div><button class="btn ghost small" data-delete="${a.id}">刪除</button></div>`).join("") || '<p class="muted">尚未新增常用地址</p>'; list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => { await api("addresses", { method: "DELETE", query: `&id=${button.dataset.delete}` }); addresses = addresses.filter((a) => a.id !== button.dataset.delete); renderAddresses(); })); const options = '<option value="">請選擇常用地址</option>' + addresses.map((a) => `<option value="${a.id}">${a.label}｜${a.address}</option>`).join(""); pickup.innerHTML = options; dropoff.innerHTML = options; document.querySelector("#addressCount").textContent = String(addresses.length); };
  renderAddresses();
  const addressForm = document.querySelector("#addressForm"); addressForm?.addEventListener("submit", async (event) => { event.preventDefault(); const form = Object.fromEntries(new FormData(addressForm)); const created = await api("addresses", { method: "POST", body: form }); addresses.push(created); addressForm.reset(); renderAddresses(); });
  const serviceMenu = document.querySelector("#serviceMenu"); const planSelect = document.querySelector("#planSelect"); let category = "rental";
  serviceMenu.innerHTML = '<button class="service-choice active" data-cat="rental"><strong>場地出租</strong></button><button class="service-choice" data-cat="errand"><strong>跑腿／配送</strong></button>';
  const renderPlans = () => { const items = catalog.filter((item) => item.category === category); planSelect.innerHTML = items.map((item) => `<option value="${item.id}">${item.service}｜${item.name}</option>`).join(""); document.querySelector("#errandInputs").classList.toggle("hidden", category !== "errand"); updateQuote(); };
  serviceMenu.querySelectorAll("[data-cat]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.cat; serviceMenu.querySelectorAll("[data-cat]").forEach((item) => item.classList.toggle("active", item === button)); renderPlans(); }));
  let currentQuote;
  const quotePayload = () => ({ service_id: planSelect.value, distance_km: Number(document.querySelector("#distanceKm")?.value || 0), wait_minutes: Number(document.querySelector("#waitMinutes")?.value || 0), extra_stops: Number(document.querySelector("#extraStops")?.value || 0), goods_amount: Number(document.querySelector("#shoppingAmount")?.value || 0), urgent: Boolean(document.querySelector("#urgentFlag")?.checked), pickup_address_id: pickup.value || null, dropoff_address_id: dropoff.value || null });
  async function updateQuote() { currentQuote = await api("quote", { method: "POST", body: quotePayload() }); document.querySelector("#checkoutLines").innerHTML = currentQuote.lines.map((line) => `<div class="checkout-line"><span>${line.label}</span><strong>${money(line.amount)}</strong></div>`).join(""); document.querySelector("#checkoutTotal").textContent = money(currentQuote.total); }
  ["planSelect", "distanceKm", "waitMinutes", "extraStops", "shoppingAmount", "urgentFlag"].forEach((id) => document.querySelector(`#${id}`)?.addEventListener("change", updateQuote));
  document.querySelector("#checkoutButton")?.addEventListener("click", async () => { const order = await api("orders", { method: "POST", body: { ...quotePayload(), booking_date: document.querySelector("#serviceDate").value || null, booking_time: document.querySelector("#serviceTime").value || null } }); alert(`訂單 ${order.order_no} 已建立，正式付款功能待綠界啟用。`); });
  renderPlans();
}
async function initProductionAdmin() {
  const { client } = await requireSession(); const member = await api("me");
  if (member.role !== "admin") { document.querySelector(".main").innerHTML = '<div class="demo-note">此帳號沒有管理員權限。</div>'; return; }
  const orders = await api("admin-orders");
  document.querySelector("#paymentRows").innerHTML = orders.map((order) => `<tr><td>${order.order_no}</td><td>${order.order_items?.map((item) => item.label).join("、") || order.category}</td><td>${order.booking_date || ""} ${order.booking_time || ""}</td><td>${money(order.total_amount)}</td><td>${order.payment_status}</td></tr>`).join("");
  void client;
}

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  const production = cfg.mode === "production";
  if(page==='public')(production ? initProductionPublic() : initPublic());
  if(page==='member')(production ? initProductionMember().catch((error) => { if (error.message !== "LOGIN_REQUIRED") alert(error.message); }) : initMember());
  if(page==='admin')(production ? initProductionAdmin().catch((error) => { if (error.message !== "LOGIN_REQUIRED") alert(error.message); }) : initAdmin());
});
