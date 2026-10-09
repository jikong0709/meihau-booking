import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const CASE_STATUSES = ["submitted","provider_replied","awaiting_member","accepted","rejected","expired","converted_to_booking","cancelled"];

function fail(ctx: RequestContext, status: number, code: string, message: string) {
  return contractError(ctx.origin, status, code, message);
}
function amount(value: unknown, optional = true) {
  if (value === null || value === "" || value === undefined) return optional ? null : NaN;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1000000 ? parsed : NaN;
}
function text(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function urlValue(value: unknown) {
  const raw = text(value, 2000);
  if (!raw) return null;
  try { const url = new URL(raw); return ["http:","https:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function isAdmin(ctx: RequestContext) { return ["admin","developer"].includes(String(ctx.member.role)); }
function caseNo() { return `SQ-${new Date().toISOString().slice(2,10).replace(/-/g,"")}-${crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`; }

async function teamAccess(ctx: RequestContext, teamId: string) {
  if (isAdmin(ctx)) return true;
  const { data } = await ctx.db.schema("booking").from("official_team_members").select("team_id").eq("team_id", teamId).eq("user_id", ctx.user.id).eq("status", "active").maybeSingle();
  return Boolean(data);
}
async function loadCase(ctx: RequestContext, quoteId: string) {
  const { data, error } = await ctx.db.schema("booking").from("service_quote_cases").select("*").eq("quote_id", quoteId).maybeSingle();
  if (error || !data) return null;
  if (data.member_id === ctx.user.id || await teamAccess(ctx, data.provider_team_id)) return data;
  return null;
}
async function recipientIds(ctx: RequestContext, row: any, exclude: string) {
  const ids = new Set<string>();
  if (row.member_id !== exclude) ids.add(row.member_id);
  const [{ data: teamMembers }, { data: admins }] = await Promise.all([
    ctx.db.schema("booking").from("official_team_members").select("user_id").eq("team_id", row.provider_team_id).eq("status", "active"),
    ctx.db.schema("booking").from("members").select("user_id").in("role", ["admin","developer"]).eq("account_status", "active"),
  ]);
  for (const item of [...(teamMembers || []), ...(admins || [])]) if (item.user_id !== exclude) ids.add(item.user_id);
  return [...ids];
}
async function notify(ctx: RequestContext, row: any, type: string, title: string, exclude: string) {
  const ids = await recipientIds(ctx, row, exclude);
  if (!ids.length) return;
  await ctx.db.schema("booking").from("service_quote_notifications").insert(ids.map((recipient_id) => ({ quote_id: row.quote_id, recipient_id, notification_type: type, title })));
}
async function withDetails(ctx: RequestContext, cases: any[]) {
  const ids = cases.map((row) => row.quote_id);
  if (!ids.length) return [];
  const [{ data: messages }, { data: events }, { data: services }] = await Promise.all([
    ctx.db.schema("booking").from("service_quote_messages").select("*").in("quote_id", ids).order("created_at"),
    ctx.db.schema("booking").from("service_quote_events").select("*").in("quote_id", ids).order("created_at"),
    ctx.db.schema("booking").from("services").select("service_id,service_name,category_id,team_id").in("service_id", [...new Set(cases.map((row) => row.service_id))]),
  ]);
  const serviceMap = new Map((services || []).map((row: any) => [row.service_id, row]));
  return cases.map((row) => ({ ...row, service: serviceMap.get(row.service_id) || null, messages: (messages || []).filter((item: any) => item.quote_id === row.quote_id), events: (events || []).filter((item: any) => item.quote_id === row.quote_id) }));
}

export async function handleServiceQuotes(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  const { body, db, origin, user } = ctx;
  if (action === "quote-cases" && method === "GET") {
    const { data, error } = await db.schema("booking").from("service_quote_cases").select("*").eq("member_id", user.id).order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: "報價案件暫時無法讀取" } : { items: await withDetails(ctx, data || []) });
  }
  if (action === "quote-cases" && method === "POST") {
    const caseType = String(body.case_type || "");
    if (!["quote","negotiation"].includes(caseType)) return fail(ctx, 400, "invalid_case_type", "案件類型不正確");
    const { data: service, error } = await db.schema("booking").from("services").select("*").eq("service_id", String(body.service_id || "")).eq("service_status", "active").maybeSingle();
    if (error || !service || !service.team_id) return fail(ctx, 404, "service_not_found", "找不到可申請的官方服務");
    if ((caseType === "quote" && !service.allow_quote) || (caseType === "negotiation" && !service.allow_negotiation)) return fail(ctx, 409, "feature_disabled", "此服務目前未開啟這項功能");
    const requirements = text(body.requirements, 4000);
    if (requirements.length < 3) return fail(ctx, 400, "requirements_required", "請填寫至少 3 個字的需求");
    const memberBudget = amount(body.member_budget);
    if (Number.isNaN(memberBudget)) return fail(ctx, 400, "invalid_budget", "預算格式不正確");
    const attachmentUrl = urlValue(body.attachment_url);
    if (body.attachment_url && !attachmentUrl) return fail(ctx, 400, "invalid_attachment_url", "附件網址只接受 http 或 https");
    const now = new Date().toISOString();
    const { data: priceOptions } = await db.schema("booking").from("service_price_options").select("price_option_id,option_name,amount,pricing_type,price_note,valid_from,valid_until").eq("service_id", service.service_id).eq("status", "active").or(`valid_from.is.null,valid_from.lte.${now}`).or(`valid_until.is.null,valid_until.gt.${now}`).order("sort_order");
    const row = {
      case_no: caseNo(), case_type: caseType, service_id: service.service_id, provider_team_id: service.team_id, member_id: user.id,
      system_price_snapshot: { price: service.price, price_type: service.price_type, pricing_type: service.pricing_type, price_note: service.price_note, price_options: priceOptions || [] },
      requirements, preferred_date: body.preferred_date || null, member_budget: memberBudget, status: "submitted",
    };
    const { data: created, error: createError } = await db.schema("booking").from("service_quote_cases").insert(row).select().single();
    if (createError) return fail(ctx, 400, "case_create_failed", "案件無法建立");
    await Promise.all([
      db.schema("booking").from("service_quote_messages").insert({ quote_id: created.quote_id, sender_id: user.id, sender_role: "member", message_text: requirements, attachment_url: attachmentUrl }),
      db.schema("booking").from("service_quote_events").insert({ quote_id: created.quote_id, actor_id: user.id, event_type: "created", to_status: "submitted", event_payload: { case_type: caseType, member_budget: memberBudget } }),
      notify(ctx, created, "case_created", `新${caseType === "quote" ? "報價" : "議價"}案件 ${created.case_no}`, user.id),
    ]);
    return reply(origin, 201, { ...created, service: { service_id: service.service_id, service_name: service.service_name }, messages: [], events: [] });
  }
  if (action === "quote-message" && method === "POST") {
    const row = await loadCase(ctx, String(body.quote_id || ""));
    if (!row) return fail(ctx, 404, "case_not_found", "找不到案件或無權限");
    if (["rejected","expired","converted_to_booking","cancelled"].includes(row.status)) return fail(ctx, 409, "case_closed", "此案件已結束");
    const messageText = text(body.message_text, 4000);
    if (!messageText) return fail(ctx, 400, "message_required", "請輸入留言");
    const attachmentUrl = urlValue(body.attachment_url);
    if (body.attachment_url && !attachmentUrl) return fail(ctx, 400, "invalid_attachment_url", "附件網址只接受 http 或 https");
    const senderRole = isAdmin(ctx) ? String(ctx.member.role) : row.member_id === user.id ? "member" : "provider";
    const { data, error } = await db.schema("booking").from("service_quote_messages").insert({ quote_id: row.quote_id, sender_id: user.id, sender_role: senderRole, message_text: messageText, attachment_url: attachmentUrl }).select().single();
    if (error) return fail(ctx, 400, "message_failed", "留言無法送出");
    await Promise.all([
      db.schema("booking").from("service_quote_events").insert({ quote_id: row.quote_id, actor_id: user.id, event_type: "message", from_status: row.status, to_status: row.status }),
      notify(ctx, row, "message", `${row.case_no} 有新留言`, user.id),
    ]);
    return reply(origin, 201, data);
  }
  if (action === "quote-member-action" && method === "POST") {
    const row = await loadCase(ctx, String(body.quote_id || ""));
    if (!row || row.member_id !== user.id) return fail(ctx, 404, "case_not_found", "找不到案件或無權限");
    const next = String(body.next_status || "");
    if (!["accepted","rejected","cancelled"].includes(next)) return fail(ctx, 400, "invalid_transition", "狀態操作不正確");
    if (next === "accepted" && (!["provider_replied","awaiting_member"].includes(row.status) || row.provider_quote_amount === null)) return fail(ctx, 409, "invalid_transition", "尚無可接受的正式報價");
    if (next === "accepted" && row.valid_until && new Date(row.valid_until) <= new Date()) return fail(ctx, 409, "quote_expired", "報價已逾期");
    if (next === "cancelled" && !["submitted","provider_replied","awaiting_member"].includes(row.status)) return fail(ctx, 409, "invalid_transition", "目前狀態不可取消");
    const patch: any = { status: next };
    if (next === "accepted") patch.accepted_at = new Date().toISOString();
    const { data, error } = await db.schema("booking").from("service_quote_cases").update(patch).eq("quote_id", row.quote_id).eq("member_id", user.id).select().single();
    if (error) return fail(ctx, 400, "status_update_failed", "案件狀態無法更新");
    await Promise.all([
      db.schema("booking").from("service_quote_events").insert({ quote_id: row.quote_id, actor_id: user.id, event_type: next, from_status: row.status, to_status: next, price_snapshot: row.provider_quote_amount }),
      notify(ctx, row, "status_changed", `${row.case_no} 已更新為 ${next}`, user.id),
    ]);
    return reply(origin, 200, data);
  }
  if (action === "quote-convert" && method === "POST") {
    const row = await loadCase(ctx, String(body.quote_id || ""));
    if (!row || row.member_id !== user.id) return fail(ctx, 404, "case_not_found", "找不到案件或無權限");
    if (row.status !== "accepted" || row.provider_quote_amount === null) return fail(ctx, 409, "not_accepted", "會員接受正式報價後才能建立預約");
    if (row.valid_until && new Date(row.valid_until) <= new Date()) return fail(ctx, 409, "quote_expired", "報價已逾期");
    const { data: existing } = await db.schema("booking").from("orders").select("*").eq("quote_case_id", row.quote_id).maybeSingle();
    if (existing) return reply(origin, 200, existing);
    const { data: service } = await db.schema("booking").from("services").select("service_name,category_id").eq("service_id", row.service_id).single();
    const orderNo = `MH${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const orderPayload = {
      order_no: orderNo, user_id: user.id, service_id: row.service_id, category: service.category_id,
      booking_date: row.preferred_date, total_amount: row.provider_quote_amount, quote_case_id: row.quote_id,
      note: row.quote_description, quote_payload: { source: "service_quote_case", quote_id: row.quote_id, system_price_snapshot: row.system_price_snapshot, provider_terms: row.provider_terms },
    };
    const { data: order, error } = await db.schema("booking").from("orders").insert(orderPayload).select().single();
    if (error) return fail(ctx, 400, "order_create_failed", "預約無法建立");
    const { error: itemError } = await db.schema("booking").from("order_items").insert({ order_id: order.id, label: service.service_name, amount: row.provider_quote_amount });
    if (itemError) return fail(ctx, 500, "order_item_failed", "預約明細無法建立");
    await Promise.all([
      db.schema("booking").from("service_quote_cases").update({ status: "converted_to_booking", converted_order_id: order.id }).eq("quote_id", row.quote_id).eq("status", "accepted"),
      db.schema("booking").from("service_quote_events").insert({ quote_id: row.quote_id, actor_id: user.id, event_type: "converted", from_status: "accepted", to_status: "converted_to_booking", price_snapshot: row.provider_quote_amount, event_payload: { order_id: order.id } }),
      notify(ctx, row, "status_changed", `${row.case_no} 已轉為預約`, user.id),
    ]);
    return reply(origin, 201, order);
  }
  if (action === "quote-notifications" && method === "GET") {
    const { data, error } = await db.schema("booking").from("service_quote_notifications").select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(50);
    return reply(origin, error ? 400 : 200, error ? { error: "通知暫時無法讀取" } : { items: data || [] });
  }
  if (action === "quote-notifications" && method === "PATCH") {
    const { data, error } = await db.schema("booking").from("service_quote_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("notification_id", String(body.notification_id || "")).eq("recipient_id", user.id).select().maybeSingle();
    return reply(origin, error || !data ? 404 : 200, error || !data ? { error: "找不到通知" } : data);
  }
  return null;
}

export async function handleServiceQuoteAdmin(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  const { body, db, origin, user } = ctx;
  if (action === "admin-quote-cases" && method === "GET") {
    const { data, error } = await db.schema("booking").from("service_quote_cases").select("*,members!service_quote_cases_member_id_fkey(name,full_name,email)").order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: "報價案件暫時無法讀取" } : { items: await withDetails(ctx, data || []) });
  }
  if (action === "admin-quote-cases" && method === "PATCH") {
    const quoteId = String(body.quote_id || "");
    const { data: row } = await db.schema("booking").from("service_quote_cases").select("*").eq("quote_id", quoteId).maybeSingle();
    if (!row) return fail(ctx, 404, "case_not_found", "找不到案件");
    if (!["submitted","provider_replied","awaiting_member"].includes(row.status)) return fail(ctx, 409, "case_closed", "目前狀態不可報價");
    const providerQuoteAmount = amount(body.provider_quote_amount, false);
    if (Number.isNaN(providerQuoteAmount)) return fail(ctx, 400, "invalid_amount", "請輸入有效報價金額");
    const validUntil = body.valid_until ? new Date(String(body.valid_until)) : null;
    if (validUntil && (Number.isNaN(validUntil.valueOf()) || validUntil <= new Date())) return fail(ctx, 400, "invalid_valid_until", "有效期限必須晚於現在");
    const patch = { provider_quote_amount: providerQuoteAmount, quote_description: text(body.quote_description, 4000), provider_terms: text(body.provider_terms, 4000), valid_until: validUntil?.toISOString() || null, status: "awaiting_member" };
    const { data, error } = await db.schema("booking").from("service_quote_cases").update(patch).eq("quote_id", quoteId).select().single();
    if (error) return fail(ctx, 400, "quote_update_failed", "正式報價無法送出");
    await Promise.all([
      db.schema("booking").from("service_quote_events").insert({ quote_id: quoteId, actor_id: user.id, event_type: "provider_quote", from_status: row.status, to_status: "awaiting_member", price_snapshot: providerQuoteAmount, event_payload: { valid_until: patch.valid_until } }),
      db.schema("booking").from("service_quote_notifications").insert({ quote_id: quoteId, recipient_id: row.member_id, notification_type: "provider_quote", title: `${row.case_no} 收到正式報價` }),
    ]);
    return reply(origin, 200, data);
  }
  if (action === "admin-service-features" && method === "PATCH") {
    const serviceId = String(body.service_id || "");
    const patch: Record<string, boolean> = {};
    if ("allow_quote" in body) patch.allow_quote = Boolean(body.allow_quote);
    if ("allow_negotiation" in body) patch.allow_negotiation = Boolean(body.allow_negotiation);
    if (!serviceId || !Object.keys(patch).length) return fail(ctx, 400, "invalid_input", "缺少服務或開關設定");
    const { data, error } = await db.schema("booking").from("services").update(patch).eq("service_id", serviceId).select().maybeSingle();
    return reply(origin, error || !data ? 400 : 200, error || !data ? { error: "服務開關無法更新" } : data);
  }
  return null;
}
