import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const RESOURCE_FIELDS = "resource_id,resource_slug,resource_name,resource_description,category,sub_category,resource_url,thumbnail,status,sort_order,tags,related_service_ids,related_role_ids,related_opportunity_ids,featured,created_at,updated_at";
const RESOURCE_CATEGORIES = new Set(["benefits","ai_digital","learning","work_tools","market_work","lifestyle","events_cooperation"]);
const RESOURCE_STATUSES = new Set(["draft","published","paused","archived"]);
const NEED_STATUSES = new Set(["draft","seeking","matched","completed","cancelled"]);

function dbClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
}
function fail(code: string, message: string): never { const error = new Error(code) as Error & { publicMessage?: string }; error.publicMessage = message; throw error; }
function text(value: unknown, max: number, label: string, required = false) { const result = String(value ?? "").trim(); if ((required && !result) || result.length > max) fail("invalid_input", `${label}格式不正確`); return result; }
function id(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) fail("invalid_input", `${label}格式不正確`); return result; }
function url(value: unknown, label: string, required = false) { const result = text(value, 1000, label, required); if (result && !/^https:\/\/[^\s]+$/i.test(result)) fail("invalid_input", `${label}只接受 https 網址`); return result; }
function strings(value: unknown, maxItems = 30) { if (value == null || value === "") return []; const list = Array.isArray(value) ? value : String(value).split(","); const cleaned = [...new Set(list.map((item) => String(item).trim()).filter(Boolean))]; if (cleaned.length > maxItems || cleaned.some((item) => item.length > 120)) fail("invalid_input", "清單資料格式不正確"); return cleaned; }
function apiError(origin: string | null, error: unknown, fallback: string) { const code = error instanceof Error ? error.message : "invalid_input"; const message = error && typeof error === "object" && "publicMessage" in error ? String((error as { publicMessage?: unknown }).publicMessage || fallback) : fallback; return contractError(origin, code === "not_found" ? 404 : code === "forbidden" ? 403 : 400, code, message); }

export async function handlePublicResources(request: Request, origin: string | null, action: string, method: string): Promise<Response | null> {
  if (![["public-resources","GET"],["resource-click","POST"]].some(([a,m]) => a === action && m === method)) return null;
  const db = dbClient();
  try {
    if (action === "public-resources") {
      const requestUrl = new URL(request.url);
      const category = String(requestUrl.searchParams.get("category") || "").trim();
      if (category && !RESOURCE_CATEGORIES.has(category)) fail("invalid_input", "資源分類不正確");
      const limit = Math.min(Math.max(Number(requestUrl.searchParams.get("limit") || 50), 1), 100);
      const featured = requestUrl.searchParams.get("featured") === "true";
      let query = db.schema("booking").from("resources").select(RESOURCE_FIELDS).eq("status", "published").order("sort_order").order("created_at", { ascending: false }).limit(limit);
      if (category) query = query.eq("category", category);
      if (featured) query = query.eq("featured", true);
      const { data, error } = await query;
      return error ? contractError(origin, 503, "resources_unavailable", "莓好資源暫時無法載入") : reply(origin, 200, { resources: data || [] });
    }
    const body = await request.json().catch(() => ({}));
    const resourceId = id(body.resource_id, "resource_id");
    const source = String(body.source || "resource_center");
    const destinationType = String(body.destination_type || "resource");
    if (!["home","resource_center","service","circle","member"].includes(source) || !["resource","service","circle"].includes(destinationType)) fail("invalid_input", "導流來源格式不正確");
    const { data: resource } = await db.schema("booking").from("resources").select("resource_id").eq("resource_id", resourceId).eq("status", "published").maybeSingle();
    if (!resource) fail("not_found", "找不到資源");
    const { error } = await db.schema("booking").from("resource_click_events").insert({ resource_id: resourceId, source, destination_type: destinationType });
    return error ? contractError(origin, 503, "resource_click_failed", "資源導流紀錄暫時無法建立") : reply(origin, 201, { recorded: true });
  } catch (error) { return apiError(origin, error, "莓好資源資料格式不正確"); }
}

export async function handleResourceMember(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  if (action !== "my-resource-needs") return null;
  try {
    if (method === "GET") {
      const { data, error } = await ctx.db.schema("booking").from("member_resource_needs").select("*").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
      return error ? contractError(ctx.origin, 503, "resource_needs_unavailable", "資源需求暫時無法讀取") : reply(ctx.origin, 200, { needs: data || [] });
    }
    if (method === "POST") {
      const status = String(ctx.body.status || "seeking"); if (!NEED_STATUSES.has(status)) fail("invalid_input", "資源需求狀態不正確");
      const { data, error } = await ctx.db.schema("booking").from("member_resource_needs").insert({ user_id: ctx.user.id, title: text(ctx.body.title,160,"需求名稱",true), description: text(ctx.body.description,3000,"需求內容"), category: text(ctx.body.category,80,"需求分類",true), status }).select("*").single();
      return error ? contractError(ctx.origin, 400, "resource_need_create_failed", "資源需求建立失敗") : reply(ctx.origin, 201, { need: data });
    }
    if (method === "PATCH") {
      const needId = id(ctx.body.need_id, "need_id"); const status = String(ctx.body.status || ""); if (!NEED_STATUSES.has(status)) fail("invalid_input", "資源需求狀態不正確");
      const { data, error } = await ctx.db.schema("booking").from("member_resource_needs").update({ status }).eq("need_id", needId).eq("user_id", ctx.user.id).select("*").maybeSingle();
      return error || !data ? contractError(ctx.origin, 404, "resource_need_not_found", "找不到資源需求") : reply(ctx.origin, 200, { need: data });
    }
    return null;
  } catch (error) { return apiError(ctx.origin, error, "資源需求資料格式不正確"); }
}

export async function handleResourceAdmin(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  if (action !== "admin-resources") return null;
  try {
    if (method === "GET") {
      const [{ data, error }, { data: clicks }] = await Promise.all([
        ctx.db.schema("booking").from("resources").select(RESOURCE_FIELDS).order("sort_order").order("created_at", { ascending: false }),
        ctx.db.schema("booking").from("resource_click_events").select("resource_id"),
      ]);
      if (error) return contractError(ctx.origin, 503, "resources_unavailable", "資源管理資料暫時無法讀取");
      const counts = new Map<string, number>(); for (const row of clicks || []) counts.set(row.resource_id, (counts.get(row.resource_id) || 0) + 1);
      return reply(ctx.origin, 200, { resources: (data || []).map((row: any) => ({ ...row, click_count: counts.get(row.resource_id) || 0 })) });
    }
    const category = String(ctx.body.category || ""); if (!RESOURCE_CATEGORIES.has(category)) fail("invalid_input", "資源分類不正確");
    const status = String(ctx.body.status || "draft"); if (!RESOURCE_STATUSES.has(status)) fail("invalid_input", "資源狀態不正確");
    const values = { resource_slug: text(ctx.body.resource_slug,80,"資源代碼",true).toLowerCase(), resource_name: text(ctx.body.resource_name,160,"資源名稱",true), resource_description: text(ctx.body.resource_description,1000,"資源說明"), category, sub_category: text(ctx.body.sub_category,120,"次分類"), resource_url: url(ctx.body.resource_url,"資源網址",true), thumbnail: url(ctx.body.thumbnail,"縮圖網址"), status, sort_order: Math.min(Math.max(Number(ctx.body.sort_order || 0),0),100000), tags: strings(ctx.body.tags), related_service_ids: strings(ctx.body.related_service_ids), related_role_ids: strings(ctx.body.related_role_ids), related_opportunity_ids: strings(ctx.body.related_opportunity_ids), featured: Boolean(ctx.body.featured) };
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(values.resource_slug)) fail("invalid_input", "資源代碼格式不正確");
    if (method === "POST") { const { data, error } = await ctx.db.schema("booking").from("resources").insert(values).select(RESOURCE_FIELDS).single(); return error ? contractError(ctx.origin,400,"resource_create_failed","資源新增失敗") : reply(ctx.origin,201,{ resource:data }); }
    if (method === "PATCH") { const resourceId=id(ctx.body.resource_id,"resource_id"); const { data,error }=await ctx.db.schema("booking").from("resources").update(values).eq("resource_id",resourceId).select(RESOURCE_FIELDS).maybeSingle(); return error||!data?contractError(ctx.origin,404,"resource_update_failed","資源更新失敗或不存在"):reply(ctx.origin,200,{resource:data}); }
    return null;
  } catch (error) { return apiError(ctx.origin, error, "資源管理資料格式不正確"); }
}
