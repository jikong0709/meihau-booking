import type { RequestContext } from "./auth.ts";
import { MEMBER_PUBLIC_COLUMNS } from "./auth.ts";
import { buildQuote, loadActiveService, selectedIds } from "./catalog.ts";
import { reply } from "./http.ts";

export async function handleProfile(ctx: RequestContext) {
  const { body, db, origin, user } = ctx;
  const patch: Record<string, string | boolean> = { updated_at: new Date().toISOString() };
  const textFields: Record<string, number> = {
    name: 80, full_name: 120, phone: 40, line_id: 80, contact_email: 160,
    avatar_url: 2000, region: 120, bio: 2000,
  };
  for (const [field, limit] of Object.entries(textFields)) {
    if (field in body) patch[field] = String(body[field] ?? "").slice(0, limit);
  }
  if ("is_public" in body) patch.is_public = Boolean(body.is_public);
  const { data, error } = await db.schema("booking").from("members").update(patch).eq("user_id", user.id).select(MEMBER_PUBLIC_COLUMNS).single();
  return reply(origin, error ? 400 : 200, error ? { error: error.message } : data);
}

export async function handleAddresses(ctx: RequestContext, method: string) {
  const { body, db, origin, user, url } = ctx;
  if (method === "GET") {
    const { data, error } = await db.schema("booking").from("addresses").select("*").eq("user_id", user.id).order("created_at");
    return reply(origin, error ? 400 : 200, error ? { error: error.message } : data);
  }
  if (method === "POST") {
    const addressType = ["home", "company", "other"].includes(String(body.address_type)) ? String(body.address_type) : "other";
    const row = { user_id: user.id, address_type: addressType, label: String(body.label || "").slice(0, 80), recipient: String(body.recipient || "").slice(0, 120), phone: String(body.phone || "").slice(0, 40), address: String(body.address || "").slice(0, 300), note: String(body.note || "").slice(0, 500), is_default: Boolean(body.is_default) };
    if (!row.label || !row.recipient || !row.phone || row.address.length < 3) return reply(origin, 400, { error: "Address fields are incomplete" });
    const { data, error } = await db.schema("booking").from("addresses").insert(row).select().single();
    return reply(origin, error ? 400 : 201, error ? { error: error.message } : data);
  }
  const id = url.searchParams.get("id");
  // Preserve the pre-Phase-1 address DELETE route without introducing deletion into new role flows.
  const { error } = await db.schema("booking").from("addresses").delete().eq("id", id).eq("user_id", user.id);
  return reply(origin, error ? 400 : 200, error ? { error: error.message } : { ok: true });
}

export async function handleServices(ctx: RequestContext) {
  const { db, origin } = ctx;
  const now = new Date().toISOString();
  const [{ data: services, error: servicesError }, { data: options, error: optionsError }, { data: addons, error: addonsError }, { data: officialTeams, error: teamsError }, { data: applicationFields, error: fieldsError }, { data: priceOptions, error: pricesError }] = await Promise.all([
    db.schema("booking").from("services").select("*").in("service_status", ["active", "coming_soon"]).order("sort_order"),
    db.schema("booking").from("service_options").select("option_id,service_id,option_name,status,sort_order").eq("status", "active").order("sort_order"),
    db.schema("booking").from("service_addons").select("*").eq("status", "active").order("sort_order"),
    db.schema("booking").from("official_teams").select("*").eq("status", "active").order("sort_order"),
    db.schema("booking").from("service_application_fields").select("*").eq("status", "active").order("sort_order"),
    db.schema("booking").from("service_price_options").select("*").eq("status", "active").or(`valid_from.is.null,valid_from.lte.${now}`).or(`valid_until.is.null,valid_until.gt.${now}`).order("sort_order"),
  ]);
  if (servicesError || optionsError || addonsError || teamsError || fieldsError || pricesError) return reply(origin, 500, { error: "Service catalog unavailable" });
  return reply(origin, 200, { services, options, addons, official_teams: officialTeams, application_fields: applicationFields, price_options: priceOptions });
}

export async function handleQuote(ctx: RequestContext) {
  try { return reply(ctx.origin, 200, await buildQuote(ctx.db, ctx.body)); }
  catch (error) {
    const messages: Record<string, string> = { inquiry_required: "Inquiry required for this service", invalid_hours: "Invalid booking hours", invalid_companion_mode: "Invalid companion mode", invalid_work_goal: "Work goal is too long" };
    return reply(ctx.origin, 400, { error: error instanceof Error ? (messages[error.message] || "Invalid quote") : "Invalid quote" });
  }
}

export async function handleOrders(ctx: RequestContext, method: string) {
  const { body, db, origin, user } = ctx;
  if (method === "GET") {
    const { data, error } = await db.schema("booking").from("orders").select("*,order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: error.message } : data);
  }
  try {
    const q = await buildQuote(db, body);
    const orderNo = `MH${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const safeQuotePayload = { service_id: q.service_id, option_id: String(body.option_id || "") || null, selected_addon_ids: selectedIds(body, "selected_addon_ids"), pending_addons: q.pending_addons, pickup_address_id: String(body.pickup_address_id || "") || null, dropoff_address_id: String(body.dropoff_address_id || "") || null, booking_details: q.booking_details };
    let providerId: string | null = null;
    const service = await loadActiveService(db, q.service_id);
    if (service.requires_provider) {
      const { data: links, error: linkError } = await db.schema("booking").from("service_providers")
        .select("provider_id,providers!inner(provider_id,status)").eq("service_id", q.service_id).eq("status", "active").eq("providers.status", "active").order("sort_order").limit(1);
      const provider = links?.[0];
      if (linkError || !provider) throw new Error("provider_unavailable");
      providerId = provider.provider_id;
    }
    const order = { order_no: orderNo, user_id: user.id, service_id: q.service_id, provider_id: providerId, category: q.category, booking_date: body.booking_date || null, booking_time: body.booking_time || null, booking_details: q.booking_details, note: String(body.note || "").slice(0, 2000), total_amount: q.total, quote_payload: safeQuotePayload };
    const { data, error } = await db.schema("booking").from("orders").insert(order).select().single();
    if (error) return reply(origin, 400, { error: "Order could not be created" });
    const { error: itemError } = await db.schema("booking").from("order_items").insert(q.lines.map((line) => ({ order_id: data.id, ...line })));
    if (itemError) return reply(origin, 500, { error: "Order items could not be created" });
    return reply(origin, 201, { ...data, lines: q.lines, pending_addons: q.pending_addons });
  } catch (error) {
    const messages: Record<string, string> = { inquiry_required: "Inquiry required for this service", invalid_hours: "Invalid booking hours", invalid_companion_mode: "Invalid companion mode", invalid_work_goal: "Work goal is too long", provider_unavailable: "Service provider unavailable" };
    return reply(origin, 400, { error: error instanceof Error ? (messages[error.message] || "Invalid order") : "Invalid order" });
  }
}

export async function handleOrderChange(ctx: RequestContext, action: string) {
  const { body, db, origin, user } = ctx;
  const id = String(body.id || "");
  if (action === "order-cancel") {
    if (!id) return reply(origin, 400, { error: "Invalid order cancellation" });
    const { data, error } = await db.schema("booking").from("orders").update({ service_status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id).eq("payment_status", "UNPAID").in("service_status", ["WAITING_PAYMENT", "DRAFT"]).select().maybeSingle();
    if (error || !data) return reply(origin, 400, { error: "Order cannot be cancelled" });
    return reply(origin, 200, data);
  }
  const bookingDate = String(body.booking_date || "");
  const bookingTime = String(body.booking_time || "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !/^\d{2}:\d{2}$/.test(bookingTime)) return reply(origin, 400, { error: "Invalid reschedule request" });
  const { data, error } = await db.schema("booking").from("orders").update({ booking_date: bookingDate, booking_time: bookingTime, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("payment_status", "UNPAID").in("service_status", ["WAITING_PAYMENT", "DRAFT"]).select().maybeSingle();
  if (error || !data) return reply(origin, 400, { error: "Order cannot be rescheduled" });
  return reply(origin, 200, data);
}

export async function handleInquiries(ctx: RequestContext, method: string) {
  const { body, db, origin, user } = ctx;
  if (method === "GET") {
    const { data, error } = await db.schema("booking").from("service_inquiries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: "Inquiries unavailable" } : data);
  }
  try {
    const service = await loadActiveService(db, String(body.service_id || ""));
    if (service.booking_type !== "custom_quote") return reply(origin, 400, { error: "Direct booking service cannot create an inquiry" });
    const rawPayload = body.application_payload && typeof body.application_payload === "object" && !Array.isArray(body.application_payload) ? body.application_payload as Record<string, unknown> : {};
    const { data: definitions, error: definitionError } = await db.schema("booking").from("service_application_fields")
      .select("field_key,required").eq("service_id", service.service_id).eq("status", "active").order("sort_order");
    if (definitionError) return reply(origin, 400, { error: "Application fields unavailable" });
    const allowed = new Map((definitions || []).map((field: any) => [String(field.field_key), Boolean(field.required)]));
    const applicationPayload: Record<string, string> = {};
    for (const [key, required] of allowed) {
      const value = String(rawPayload[key] ?? "").trim().slice(0, 2000);
      if (required && !value) return reply(origin, 400, { error: `Required application field is missing: ${key}` });
      if (value) applicationPayload[key] = value;
    }
    const requirements = String(applicationPayload.requirements || body.requirements || "").trim().slice(0, 4000);
    if (requirements.length < 3) return reply(origin, 400, { error: "Requirements are incomplete" });
    const row = {
      user_id: user.id, service_id: service.service_id, team_id: service.team_id || null, service_name: service.service_name,
      preferred_date: applicationPayload.preferred_date || body.preferred_date || null,
      preferred_time: applicationPayload.preferred_time || body.preferred_time || null,
      requirements, additional_notes: String(applicationPayload.notes || body.additional_notes || "").slice(0, 2000),
      application_payload: applicationPayload, status: "pending", quoted_amount: null,
    };
    const { data, error } = await db.schema("booking").from("service_inquiries").insert(row).select().single();
    return reply(origin, error ? 400 : 201, error ? { error: "Inquiry could not be created" } : data);
  } catch { return reply(origin, 400, { error: "Invalid inquiry" }); }
}
