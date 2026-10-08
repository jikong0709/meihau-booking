import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

function fail(code: string, message: string): never { const error = new Error(code) as Error & { publicMessage?: string }; error.publicMessage = message; throw error; }
function id(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) fail("invalid_input", `${label}格式不正確`); return result; }
function apiError(ctx: RequestContext, error: unknown) { const code = error instanceof Error ? error.message : "invalid_input"; const message = error && typeof error === "object" && "publicMessage" in error ? String((error as { publicMessage?: unknown }).publicMessage || "莓好追星圈資料格式不正確") : "莓好追星圈資料格式不正確"; return contractError(ctx.origin, code === "not_found" ? 404 : code === "forbidden" ? 403 : 400, code, message); }

async function refreshStats(ctx: RequestContext, target: string) {
  const [likes, follows, bookings, inquiries, matches, settings, current] = await Promise.all([
    ctx.db.schema("booking").from("circle_likes").select("like_id", { count: "exact", head: true }).eq("target_member_id", target).eq("status", "active"),
    ctx.db.schema("booking").from("circle_follows").select("follow_id", { count: "exact", head: true }).eq("target_member_id", target).eq("status", "active"),
    ctx.db.schema("booking").from("orders").select("id", { count: "exact", head: true }).eq("user_id", target),
    ctx.db.schema("booking").from("service_inquiries").select("id", { count: "exact", head: true }).eq("user_id", target),
    ctx.db.schema("booking").from("matching_records").select("match_id", { count: "exact", head: true }).or(`initiator_user_id.eq.${target},counterparty_user_id.eq.${target}`).eq("status", "confirmed"),
    ctx.db.schema("booking").from("circle_scoring_settings").select("weights").eq("setting_key", "default").maybeSingle(),
    ctx.db.schema("booking").from("matching_profile_stats").select("profile_view_count,impression_count").eq("user_id", target).maybeSingle(),
  ]);
  const likeCount = likes.count || 0, followerCount = follows.count || 0, bookingCount = bookings.count || 0, inquiryCount = inquiries.count || 0, matchCount = matches.count || 0;
  const views = Number(current.data?.profile_view_count || 0), impressions = Number(current.data?.impression_count || 0);
  const w = settings.data?.weights || {};
  const score = likeCount * Number(w.like || 0) + followerCount * Number(w.follow || 0) + views * Number(w.profile_view || 0) + bookingCount * Number(w.booking || 0) + inquiryCount * Number(w.inquiry || 0) + matchCount * Number(w.match || 0);
  await ctx.db.schema("booking").from("matching_profile_stats").upsert({ user_id: target, like_count: likeCount, follower_count: followerCount, booking_count: bookingCount, inquiry_count: inquiryCount, match_count: matchCount, profile_view_count: views, impression_count: impressions, popularity_score: score, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { like_count: likeCount, follower_count: followerCount, booking_count: bookingCount, inquiry_count: inquiryCount, match_count: matchCount, popularity_score: score };
}

export async function handleCircleMember(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  try {
    if (action === "circle-social") {
      const target = method === "GET" ? id(ctx.url.searchParams.get("target_member_id"), "target_member_id") : id(ctx.body.target_member_id, "target_member_id");
      if (target === ctx.user.id) fail("invalid_input", "不可對自己的莓好圈按喜歡或追蹤");
      const { data: profile } = await ctx.db.schema("booking").from("matching_profiles").select("user_id").eq("user_id", target).eq("publish_status", "published").or("is_public.eq.true,is_public.is.null").maybeSingle();
      if (!profile) fail("not_found", "找不到公開的莓好圈");
      if (method === "GET") {
        const [{ data: like }, { data: follow }, categories, stats] = await Promise.all([
          ctx.db.schema("booking").from("circle_likes").select("status").eq("user_id", ctx.user.id).eq("target_member_id", target).maybeSingle(),
          ctx.db.schema("booking").from("circle_follows").select("follow_id,status").eq("follower_user_id", ctx.user.id).eq("target_member_id", target).maybeSingle(),
          ctx.db.schema("booking").from("follow_categories").select("category_id,category_name,is_public,sort_order").eq("owner_user_id", ctx.user.id).eq("status", "active").order("sort_order"),
          refreshStats(ctx, target),
        ]);
        return reply(ctx.origin, 200, { liked: like?.status === "active", followed: follow?.status === "active", follow_id: follow?.follow_id || null, categories: categories.data || [], stats });
      }
      if (method === "POST") {
        const kind = String(ctx.body.kind || ""); const active = Boolean(ctx.body.active); const now = new Date().toISOString();
        if (kind === "like") await ctx.db.schema("booking").from("circle_likes").upsert({ user_id: ctx.user.id, target_member_id: target, status: active ? "active" : "inactive", updated_at: now }, { onConflict: "user_id,target_member_id" });
        else if (kind === "follow") {
          const { data: follow, error } = await ctx.db.schema("booking").from("circle_follows").upsert({ follower_user_id: ctx.user.id, target_member_id: target, status: active ? "active" : "inactive", updated_at: now }, { onConflict: "follower_user_id,target_member_id" }).select("follow_id,status").single();
          if (error) fail("follow_save_failed", "追蹤狀態儲存失敗");
          const categoryIds = Array.isArray(ctx.body.category_ids) ? [...new Set(ctx.body.category_ids.map((value: unknown) => id(value, "category_id")))] : [];
          if (active && categoryIds.length) {
            const { data: owned } = await ctx.db.schema("booking").from("follow_categories").select("category_id").eq("owner_user_id", ctx.user.id).in("category_id", categoryIds).eq("status", "active");
            if ((owned || []).length !== categoryIds.length) fail("forbidden", "追蹤分類不屬於目前會員");
            await ctx.db.schema("booking").from("follow_category_items").upsert(categoryIds.map((categoryId: string) => ({ follow_id: follow.follow_id, category_id: categoryId })), { onConflict: "follow_id,category_id" });
          }
        } else fail("invalid_input", "互動類型不正確");
        return reply(ctx.origin, 200, { kind, active, stats: await refreshStats(ctx, target) });
      }
      return null;
    }

    if (action === "follow-categories") {
      if (method === "GET") {
        const [{ data: categories, error }, { data: follows }, { data: items }, { data: profiles }] = await Promise.all([
          ctx.db.schema("booking").from("follow_categories").select("*").eq("owner_user_id", ctx.user.id).eq("status", "active").order("sort_order"),
          ctx.db.schema("booking").from("circle_follows").select("follow_id,target_member_id,created_at,updated_at").eq("follower_user_id", ctx.user.id).eq("status", "active").order("updated_at", { ascending: false }),
          ctx.db.schema("booking").from("follow_category_items").select("follow_id,category_id"),
          ctx.db.schema("booking").from("matching_profiles").select("user_id,public_slug,display_name,headline,avatar_url").eq("publish_status", "published").or("is_public.eq.true,is_public.is.null"),
        ]);
        if (error) return contractError(ctx.origin, 503, "follow_categories_unavailable", "莓好追星圈暫時無法讀取");
        const profileById = new Map((profiles || []).map((row: any) => [row.user_id, row]));
        const categoriesByFollow = new Map<string, string[]>(); for (const row of items || []) categoriesByFollow.set(row.follow_id, [...(categoriesByFollow.get(row.follow_id) || []), row.category_id]);
        return reply(ctx.origin, 200, { categories: categories || [], follows: (follows || []).flatMap((row: any) => { const profile = profileById.get(row.target_member_id); return profile ? [{ ...row, profile, category_ids: categoriesByFollow.get(row.follow_id) || [] }] : []; }) });
      }
      if (method === "POST") {
        const name = String(ctx.body.category_name || "").trim(); if (!name || name.length > 80) fail("invalid_input", "分類名稱格式不正確");
        const { data, error } = await ctx.db.schema("booking").from("follow_categories").insert({ owner_user_id: ctx.user.id, category_name: name, is_public: Boolean(ctx.body.is_public), sort_order: Math.min(Math.max(Number(ctx.body.sort_order || 0),0),100000) }).select("*").single();
        return error ? contractError(ctx.origin,400,"follow_category_create_failed","追蹤分類新增失敗") : reply(ctx.origin,201,{category:data});
      }
      if (method === "PATCH") {
        const categoryId = id(ctx.body.category_id,"category_id"); const patch: Record<string,unknown> = {};
        if ("category_name" in ctx.body) { const name=String(ctx.body.category_name||"").trim(); if(!name||name.length>80) fail("invalid_input","分類名稱格式不正確"); patch.category_name=name; }
        if ("is_public" in ctx.body) patch.is_public=Boolean(ctx.body.is_public);
        if (ctx.body.archive === true) patch.status="archived";
        const { data,error }=await ctx.db.schema("booking").from("follow_categories").update(patch).eq("category_id",categoryId).eq("owner_user_id",ctx.user.id).select("*").maybeSingle();
        return error||!data?contractError(ctx.origin,404,"follow_category_update_failed","追蹤分類更新失敗或不存在"):reply(ctx.origin,200,{category:data});
      }
    }
    return null;
  } catch (error) { return apiError(ctx, error); }
}
