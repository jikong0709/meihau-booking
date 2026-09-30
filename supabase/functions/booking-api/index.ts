import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://jikong0709.github.io", "http://127.0.0.1:8080", "http://localhost:8080"]);
type ServiceRow = {
  service_id: string;
  category_id: "temporary_staff" | "recording_space" | "ai_digital" | "venue_equipment";
  service_name: string;
  short_description: string;
  full_description: string;
  cover_image: string | null;
  price: number | null;
  price_type: "fixed" | "starting_from" | "custom_quote";
  booking_type: "direct_booking" | "custom_quote";
  duration: string | null;
  location: string | null;
  service_status: "draft" | "coming_soon" | "active" | "paused" | "custom" | "hidden" | "archived";
  is_featured: boolean;
  sort_order: number;
};

type AddonRow = {
  addon_id: string;
  addon_name: string;
  addon_price: number | null;
  addon_description: string;
  available_for: string[];
  status: string;
  sort_order: number;
};

function cors(origin: string | null) {
  const value = origin && origins.has(origin) ? origin : "https://jikong0709.github.io";
  return { "Access-Control-Allow-Origin": value, "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", Vary: "Origin" };
}
function reply(origin: string | null, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
}
function selectedIds(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(Boolean))].slice(0, 10);
}

async function loadActiveService(db: any, serviceId: string) {
  const { data, error } = await db.schema("booking").from("services").select("*").eq("service_id", serviceId).eq("service_status", "active").maybeSingle();
  if (error || !data) throw new Error("invalid_service");
  return data as ServiceRow;
}

async function buildQuote(db: any, input: Record<string, unknown>) {
  const service = await loadActiveService(db, String(input.service_id || ""));
  if (service.booking_type !== "direct_booking" || service.price === null) throw new Error("inquiry_required");
  const lines = [{ label: service.service_name, amount: service.price }];
  const selectedAddonIds = selectedIds(input, "selected_addon_ids");
  const pendingAddons: AddonRow[] = [];
  let total = service.price;
  if (selectedAddonIds.length) {
    const { data, error } = await db.schema("booking").from("service_addons").select("*").in("addon_id", selectedAddonIds).eq("status", "active");
    if (error || !data || data.length !== selectedAddonIds.length) throw new Error("invalid_addon");
    const allowedTags: Record<ServiceRow["category_id"], string[]> = {
      recording_space: ["recording", "podcast"],
      venue_equipment: ["photo", "event"],
      temporary_staff: ["event"],
      ai_digital: [],
    };
    for (const addon of data as AddonRow[]) {
      if (!addon.available_for.some((tag) => allowedTags[service.category_id].includes(tag))) throw new Error("invalid_addon");
      if (addon.addon_price === null) pendingAddons.push(addon);
      else { total += addon.addon_price; lines.push({ label: addon.addon_name, amount: addon.addon_price }); }
    }
  }
  const optionId = String(input.option_id || "");
  if (optionId) {
    const { data, error } = await db.schema("booking").from("service_options").select("option_id,option_name").eq("option_id", optionId).eq("service_id", service.service_id).eq("status", "active").maybeSingle();
    if (error || !data) throw new Error("invalid_option");
  }
  return {
    category: service.category_id,
    service_id: service.service_id,
    price_type: service.price_type,
    lines,
    pending_addons: pendingAddons.map(({ addon_id, addon_name }) => ({ addon_id, addon_name })),
    total,
  };
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
  const { error: memberCreateError } = await db.schema("booking").from("members").upsert({ user_id: user.id, email, name: defaultName }, { onConflict: "user_id", ignoreDuplicates: true });
  if (memberCreateError) return reply(origin, 500, { error: "Member initialization failed" });
  const { data: member, error: memberReadError } = await db.schema("booking").from("members").select("*").eq("user_id", user.id).single();
  if (memberReadError || !member) return reply(origin, 500, { error: "Member profile unavailable" });
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  if (action === "me") return reply(origin, 200, member);
  if (action === "profile" && request.method === "PATCH") { const patch = { name: String(body.name || "").slice(0, 80), full_name: String(body.full_name || "").slice(0, 120), phone: String(body.phone || "").slice(0, 40), line_id: String(body.line_id || "").slice(0, 80), contact_email: String(body.contact_email || "").slice(0, 160), updated_at: new Date().toISOString() }; const { data, error } = await db.schema("booking").from("members").update(patch).eq("user_id", user.id).select().single(); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "GET") { const { data, error } = await db.schema("booking").from("addresses").select("*").eq("user_id", user.id).order("created_at"); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "POST") { const addressType = ["home", "company", "other"].includes(String(body.address_type)) ? String(body.address_type) : "other"; const row = { user_id: user.id, address_type: addressType, label: String(body.label || "").slice(0, 80), recipient: String(body.recipient || "").slice(0, 120), phone: String(body.phone || "").slice(0, 40), address: String(body.address || "").slice(0, 300), note: String(body.note || "").slice(0, 500), is_default: Boolean(body.is_default) }; if (!row.label || !row.recipient || !row.phone || row.address.length < 3) return reply(origin, 400, { error: "Address fields are incomplete" }); const { data, error } = await db.schema("booking").from("addresses").insert(row).select().single(); return reply(origin, error ? 400 : 201, error ? { error: error.message } : data); }
  if (action === "addresses" && request.method === "DELETE") { const id = new URL(request.url).searchParams.get("id"); const { error } = await db.schema("booking").from("addresses").delete().eq("id", id).eq("user_id", user.id); return reply(origin, error ? 400 : 200, error ? { error: error.message } : { ok: true }); }
  if (action === "services" && request.method === "GET") {
    const [{ data: services, error: servicesError }, { data: options, error: optionsError }, { data: addons, error: addonsError }] = await Promise.all([
      db.schema("booking").from("services").select("*").in("service_status", ["active", "coming_soon"]).order("sort_order"),
      db.schema("booking").from("service_options").select("option_id,service_id,option_name,status,sort_order").eq("status", "active").order("sort_order"),
      db.schema("booking").from("service_addons").select("*").eq("status", "active").order("sort_order"),
    ]);
    if (servicesError || optionsError || addonsError) return reply(origin, 500, { error: "Service catalog unavailable" });
    return reply(origin, 200, { services, options, addons });
  }
  if (action === "quote" && request.method === "POST") {
    try { return reply(origin, 200, await buildQuote(db, body)); }
    catch (error) { return reply(origin, 400, { error: error instanceof Error && error.message === "inquiry_required" ? "Inquiry required for this service" : "Invalid quote" }); }
  }
  if (action === "orders" && request.method === "GET") { const { data, error } = await db.schema("booking").from("orders").select("*,order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false }); return reply(origin, error ? 400 : 200, error ? { error: error.message } : data); }
  if (action === "orders" && request.method === "POST") {
    try {
      const q = await buildQuote(db, body);
      const orderNo = `MH${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const safeQuotePayload = {
        service_id: q.service_id,
        option_id: String(body.option_id || "") || null,
        selected_addon_ids: selectedIds(body, "selected_addon_ids"),
        pending_addons: q.pending_addons,
        pickup_address_id: String(body.pickup_address_id || "") || null,
        dropoff_address_id: String(body.dropoff_address_id || "") || null,
      };
      const order = { order_no: orderNo, user_id: user.id, service_id: q.service_id, category: q.category, booking_date: body.booking_date || null, booking_time: body.booking_time || null, note: String(body.note || "").slice(0, 2000), total_amount: q.total, quote_payload: safeQuotePayload };
      const { data, error } = await db.schema("booking").from("orders").insert(order).select().single();
      if (error) return reply(origin, 400, { error: "Order could not be created" });
      const { error: itemError } = await db.schema("booking").from("order_items").insert(q.lines.map((line) => ({ order_id: data.id, ...line })));
      if (itemError) return reply(origin, 500, { error: "Order items could not be created" });
      return reply(origin, 201, { ...data, lines: q.lines, pending_addons: q.pending_addons });
    } catch (error) {
      return reply(origin, 400, { error: error instanceof Error && error.message === "inquiry_required" ? "Inquiry required for this service" : "Invalid order" });
    }
  }
  if (action === "inquiries" && request.method === "GET") {
    const { data, error } = await db.schema("booking").from("service_inquiries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: "Inquiries unavailable" } : data);
  }
  if (action === "inquiries" && request.method === "POST") {
    try {
      const service = await loadActiveService(db, String(body.service_id || ""));
      if (service.booking_type !== "custom_quote") return reply(origin, 400, { error: "Direct booking service cannot create an inquiry" });
      const requirements = String(body.requirements || "").trim().slice(0, 4000);
      if (requirements.length < 3) return reply(origin, 400, { error: "Requirements are incomplete" });
      const row = { user_id: user.id, service_id: service.service_id, service_name: service.service_name, preferred_date: body.preferred_date || null, preferred_time: body.preferred_time || null, requirements, additional_notes: String(body.additional_notes || "").slice(0, 2000), status: "pending", quoted_amount: null };
      const { data, error } = await db.schema("booking").from("service_inquiries").insert(row).select().single();
      return reply(origin, error ? 400 : 201, error ? { error: "Inquiry could not be created" } : data);
    } catch { return reply(origin, 400, { error: "Invalid inquiry" }); }
  }
  if (action.startsWith("admin-")) {
    if (member?.role !== "admin") return reply(origin, 403, { error: "Forbidden" });
    if (action === "admin-orders" && request.method === "GET") {
      const { data, error } = await db.schema("booking").from("orders").select("*,members(name,email),order_items(*)").order("booking_date");
      return reply(origin, error ? 400 : 200, error ? { error: "Orders unavailable" } : data);
    }
    if (action === "admin-services" && request.method === "GET") {
      const { data, error } = await db.schema("booking").from("services").select("*").order("sort_order");
      return reply(origin, error ? 400 : 200, error ? { error: "Services unavailable" } : data);
    }
    if (action === "admin-inquiries" && request.method === "GET") {
      const { data, error } = await db.schema("booking").from("service_inquiries").select("*,members(name,full_name,email)").order("created_at", { ascending: false });
      return reply(origin, error ? 400 : 200, error ? { error: "Inquiries unavailable" } : data);
    }
    if (action === "admin-inquiries" && request.method === "PATCH") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!id || !["pending", "reviewing", "quoted", "accepted", "closed"].includes(status)) return reply(origin, 400, { error: "Invalid inquiry update" });
      const rawAmount = body.quoted_amount;
      const quotedAmount = rawAmount === null || rawAmount === "" || rawAmount === undefined ? null : Number(rawAmount);
      if (quotedAmount !== null && (!Number.isInteger(quotedAmount) || quotedAmount < 0 || quotedAmount > 1000000)) return reply(origin, 400, { error: "Invalid quoted amount" });
      if (status === "quoted" && quotedAmount === null) return reply(origin, 400, { error: "Quoted amount is required" });
      const { data, error } = await db.schema("booking").from("service_inquiries").update({ status, quoted_amount: quotedAmount, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      return reply(origin, error ? 400 : 200, error ? { error: "Inquiry update failed" } : data);
    }
  }
  return reply(origin, 404, { error: "Not found" });
});
