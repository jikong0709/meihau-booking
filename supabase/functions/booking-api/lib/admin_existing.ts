import type { RequestContext } from "./auth.ts";
import { reply } from "./http.ts";

export async function handleExistingAdmin(ctx: RequestContext, action: string, method: string) {
  const { body, db, origin } = ctx;
  if (action === "admin-orders" && method === "GET") {
    const { data, error } = await db.schema("booking").from("orders").select("*,members(name,email),order_items(*)").order("booking_date");
    return reply(origin, error ? 400 : 200, error ? { error: "Orders unavailable" } : data);
  }
  if (action === "admin-orders" && method === "PATCH") {
    const id = String(body.id || ""); const serviceStatus = String(body.service_status || "");
    if (!id || !["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(serviceStatus)) return reply(origin, 400, { error: "Invalid service status update" });
    const { data, error } = await db.schema("booking").from("orders").update({ service_status: serviceStatus, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    return reply(origin, error ? 400 : 200, error ? { error: "Order status update failed" } : data);
  }
  if (action === "admin-services" && method === "GET") {
    const { data, error } = await db.schema("booking").from("services").select("*").order("sort_order");
    return reply(origin, error ? 400 : 200, error ? { error: "Services unavailable" } : data);
  }
  if (action === "admin-inquiries" && method === "GET") {
    const { data, error } = await db.schema("booking").from("service_inquiries").select("*,members(name,full_name,email)").order("created_at", { ascending: false });
    return reply(origin, error ? 400 : 200, error ? { error: "Inquiries unavailable" } : data);
  }
  if (action === "admin-inquiries" && method === "PATCH") {
    const id = String(body.id || ""); const status = String(body.status || "");
    if (!id || !["pending", "reviewing", "quoted", "accepted", "closed"].includes(status)) return reply(origin, 400, { error: "Invalid inquiry update" });
    const rawAmount = body.quoted_amount;
    const quotedAmount = rawAmount === null || rawAmount === "" || rawAmount === undefined ? null : Number(rawAmount);
    if (quotedAmount !== null && (!Number.isInteger(quotedAmount) || quotedAmount < 0 || quotedAmount > 1000000)) return reply(origin, 400, { error: "Invalid quoted amount" });
    if (status === "quoted" && quotedAmount === null) return reply(origin, 400, { error: "Quoted amount is required" });
    const { data, error } = await db.schema("booking").from("service_inquiries").update({ status, quoted_amount: quotedAmount, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    return reply(origin, error ? 400 : 200, error ? { error: "Inquiry update failed" } : data);
  }
  return null;
}

