import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://jikong0709.github.io", "http://127.0.0.1:8080", "http://localhost:8080"]);
const catalog: Record<string, { category: "rental" | "errand"; label: string; price?: number }> = {
  "cowork-2h": { category: "rental", label: "共享辦公｜2 小時", price: 99 },
  "cowork-half": { category: "rental", label: "共享辦公｜半日 4 小時", price: 150 },
  "cowork-day": { category: "rental", label: "共享辦公｜單日", price: 250 },
  "cowork-5": { category: "rental", label: "共享辦公｜5 日券", price: 1100 },
  "cowork-10": { category: "rental", label: "共享辦公｜10 日券", price: 2000 },
  "cowork-month": { category: "rental", label: "共享辦公｜月租自由座", price: 2800 },
  "cowork-fixed": { category: "rental", label: "共享辦公｜月租固定座", price: 4000 },
  "record-room": { category: "rental", label: "錄音｜純錄音空間", price: 500 },
  "record-equip": { category: "rental", label: "錄音｜空間＋基本設備", price: 700 },
  "record-assist": { category: "rental", label: "錄音｜設備＋操作協助", price: 1000 },
  "record-2h": { category: "rental", label: "錄音｜2 小時設備方案", price: 1300 },
  "record-4h": { category: "rental", label: "錄音｜4 小時設備方案", price: 2400 },
  "studio-room": { category: "rental", label: "攝影／直播｜純場地", price: 600 },
  "studio-light": { category: "rental", label: "攝影／直播｜場地＋燈具", price: 800 },
  "studio-gear": { category: "rental", label: "攝影／直播｜場地＋設備", price: 1000 },
  "studio-2h": { category: "rental", label: "攝影／直播｜2 小時方案", price: 1500 },
  "studio-4h": { category: "rental", label: "攝影／直播｜4 小時方案", price: 2800 },
  "makeup-solo": { category: "rental", label: "化妝／更衣｜1 小時", price: 300 },
  "makeup-addon": { category: "rental", label: "化妝／更衣｜場地加購", price: 200 },
  motor: { category: "errand", label: "機車配送" }, urgent: { category: "errand", label: "機車急件" },
  car: { category: "errand", label: "汽車配送" }, shopping: { category: "errand", label: "代買＋配送" },
  task: { category: "errand", label: "跑腿／代辦", price: 200 },
};

function cors(origin: string | null) {
  const value = origin && origins.has(origin) ? origin : "https://jikong0709.github.io";
  return { "Access-Control-Allow-Origin": value, "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", Vary: "Origin" };
}
function reply(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
}
function quote(input: Record<string, unknown>) {
  const item = catalog[String(input.service_id || "")]; if (!item) throw new Error("invalid service");
  const lines: { label: string; amount: number }[] = []; let total = 0;
  if (item.category === "rental" || item.price) { total = item.price || 0; lines.push({ label: item.label, amount: total }); }
  if (item.category === "errand" && !item.price) {
    const km = Math.max(0, Number(input.distance_km || 0));
    let delivery = item === catalog.car ? (km <= 3 ? 220 : 220 + Math.ceil(km - 3) * 20) : (km <= 3 ? 99 : km <= 5 ? 130 : km <= 8 ? 180 : km <= 10 ? 220 : 220 + Math.ceil(km - 10) * 15);
    if (item === catalog.urgent || input.urgent === true) delivery = Math.round(delivery * 1.3);
    lines.push({ label: `${item === catalog.car ? "汽車" : "機車"}配送 ${km.toFixed(1)} km`, amount: delivery }); total += delivery;
    if (item === catalog.shopping) { lines.push({ label: "代買服務費", amount: 80 }); total += 80; const goods = Math.max(0, Math.round(Number(input.goods_amount || 0))); if (goods) { lines.push({ label: "商品代墊", amount: goods }); total += goods; } }
    const wait = Math.max(0, Number(input.wait_minutes || 0)); const wf = wait <= 10 ? 0 : Math.ceil((wait - 10) / 10) * 50;
    const sf = Math.max(0, Math.floor(Number(input.extra_stops || 0))) * 50;
    if (wf) { lines.push({ label: "等待費", amount: wf }); total += wf; } if (sf) { lines.push({ label: "額外停靠", amount: sf }); total += sf; }
  }
  return { category: item.category, service_id: String(input.service_id), lines, total };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin"); if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (origin && !origins.has(origin)) return reply(origin, 403, { error: "Origin not allowed" });
  const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const action = new URL(request.url).searchParams.get("action") || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(origin, 401, { error: "Unauthorized" });
  const { data: auth, error: authError } = await db.auth.getUser(token); if (authError || !auth.user) return reply(origin, 401, { error: "Unauthorized" });
  const user = auth.user; const email = user.email || ""; const defaultName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
  await db.schema("booking").from("members").upsert({ user_id: user.id, email, name: defaultName }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: member } = await db.schema("booking").from("members").select("*").eq("user_id", user.id).single();
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  if (action === "me") return reply(origin, 200, member);
  if (action === "profile" && request.method === "PATCH") { const patch = { name: String(body.name || "").slice(0, 80), phone: String(body.phone || "").slice(0, 40), line_id: String(body.line_id || "").slice(0, 80), contact_email: String(body.contact_email || "").slice(0, 160), updated_at: new Date().toISOString() }; const { data, error } = await db.schema("booking").from("members").update(patch).eq("user_id", user.id).select().single(); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "GET") { const { data, error } = await db.schema("booking").from("addresses").select("*").eq("user_id", user.id).order("created_at"); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "POST") { const row = { user_id: user.id, label: String(body.label || ""), recipient: String(body.recipient || ""), phone: String(body.phone || ""), address: String(body.address || ""), note: String(body.note || ""), is_default: Boolean(body.is_default) }; const { data, error } = await db.schema("booking").from("addresses").insert(row).select().single(); return reply(origin, error ? 400 : 201, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "DELETE") { const id = new URL(request.url).searchParams.get("id"); const { error } = await db.schema("booking").from("addresses").delete().eq("id", id).eq("user_id", user.id); return reply(origin, error ? 400 : 200, error ? { error: error.message } : { ok: true }); }
  if (action === "quote" && request.method === "POST") { try { return reply(origin, 200, quote(body)); } catch { return reply(origin, 400, { error: "Invalid quote" }); } }
  if (action === "orders" && request.method === "GET") { const { data, error } = await db.schema("booking").from("orders").select("*,order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false }); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "orders" && request.method === "POST") { try { const q = quote(body); const orderNo = `MH${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`; const order = { order_no: orderNo, user_id: user.id, category: q.category, booking_date: body.booking_date || null, booking_time: body.booking_time || null, note: String(body.note || "").slice(0, 2000), total_amount: q.total, quote_payload: body }; const { data, error } = await db.schema("booking").from("orders").insert(order).select().single(); if (error) return reply(origin, 400, { error: error.message }); await db.schema("booking").from("order_items").insert(q.lines.map((line) => ({ order_id: data.id, ...line }))); return reply(origin, 201, { ...data, lines: q.lines }); } catch { return reply(origin, 400, { error: "Invalid order" }); } }
  if (action.startsWith("admin-")) { if (member?.role !== "admin") return reply(origin, 403, { error: "Forbidden" }); const { data, error } = await db.schema("booking").from("orders").select("*,members(name,email),order_items(*)").order("booking_date"); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  return reply(origin, 404, { error: "Not found" });
});
