import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const PROFILE_FIELDS = "user_id,public_slug,display_name,headline,public_intro,service_region,availability_summary,avatar_url,welcome_name,welcome_message,profile_field_visibility,booking_enabled,inquiry_enabled,inquiry_items,matching_enabled,matching_items,verification_info_visible,is_public,is_recommendable,is_carousel_enabled,carousel_status,carousel_start_at,carousel_end_at,carousel_priority,circle_joined_at,profile_updated_at,publish_status,contact_mode,submitted_at,published_at,created_at,updated_at";
const RECORD_FIELDS = "match_id,match_code,initiator_user_id,counterparty_user_id,provider_user_id,seeker_user_id,subject_type,subject_title,scope_snapshot,terms_version,scheduled_at,location_text,agreed_amount,payment_method_text,status,created_at,updated_at,confirmed_at";
const REPORT_FIELDS = "report_id,match_id,reporter_user_id,category,description,status,assigned_to,resolution_note,created_at,updated_at,resolved_at";
const FEATURE_APPLICATION_FIELDS = "application_id,user_id,matching_profile_user_id,category_tag_id,requested_start_at,requested_end_at,status,reviewed_by,review_note,reviewed_at,created_at,updated_at";

function fail(code: string, message: string): never {
  const error = new Error(code) as Error & { publicMessage?: string };
  error.publicMessage = message;
  throw error;
}
function text(value: unknown, max: number, field: string, required = false) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > max) fail("invalid_input", `${field}格式不正確`);
  return result;
}
function id(value: unknown, field: string) {
  const result = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) fail("invalid_input", `${field}格式不正確`);
  return result;
}
function dateValue(value: unknown, field: string) {
  if (value === null || value === "" || value === undefined) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) fail("invalid_date", `${field}日期格式不正確`);
  return date.toISOString();
}
function object(value: unknown, field: string, max = 20000) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_input", `${field}必須是物件`);
  if (JSON.stringify(value).length > max) fail("invalid_input", `${field}超過長度限制`);
  return value;
}
function stringArray(value: unknown, field: string, maxItems = 30) {
  const items = value == null || value === "" ? [] : (Array.isArray(value) ? value : String(value).split(/[,\n]/));
  const cleaned = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  if (cleaned.length > maxItems || cleaned.some((item) => item.length > 160)) fail("invalid_input", `${field}格式不正確`);
  return cleaned;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function apiError(ctx: RequestContext, error: unknown, fallback = "輸入資料格式不正確") {
  const code = error instanceof Error ? error.message : "invalid_input";
  const message = error && typeof error === "object" && "publicMessage" in error ? String((error as { publicMessage?: unknown }).publicMessage || fallback) : fallback;
  const status = code === "not_found" ? 404 : code === "forbidden" ? 403 : code === "conflict" || code === "invalid_transition" ? 409 : 400;
  return contractError(ctx.origin, status, code, message);
}
function publicDb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
}
function randomSlug() { return `m-${crypto.randomUUID().replace(/-/g, "")}`; }
function randomCode() { return `MAT-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`; }

export async function handlePublicMatching(request: Request, origin: string | null, action: string, method: string): Promise<Response | null> {
  if (method !== "GET" || !["public-matching-profile", "matching-feature-feed", "matching-discovery-feed"].includes(action)) return null;
  const db = publicDb();
  const url = new URL(request.url);
  const now = new Date().toISOString();
  if (action === "matching-discovery-feed") {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 50);
    const [{ data: profiles, error }, { data: teams, error: teamsError }] = await Promise.all([
      db.schema("booking").from("matching_profiles").select(PROFILE_FIELDS).eq("publish_status", "published").or("is_public.eq.true,is_public.is.null").order("circle_joined_at", { ascending: false }).limit(limit),
      db.schema("booking").from("official_teams").select("team_id,team_name,team_description,service_scope,logo,cover_image,sort_order").eq("status", "active").eq("display_in_meihao_circle", true).order("sort_order"),
    ]);
    if (error || teamsError) return contractError(origin, 503, "matching_feed_unavailable", "莓好預約圈暫時無法讀取");
    const teamIds = (teams || []).map((row: any) => row.team_id);
    const { data: officialServices } = teamIds.length ? await db.schema("booking").from("services")
      .select("service_id,team_id,service_name,category_id,short_description,pricing_type,price_note,sort_order")
      .in("team_id", teamIds).eq("service_status", "active").eq("display_in_meihao_circle", true).order("sort_order") : { data: [] };
    const officialItems = (teams || []).map((team: any) => ({
      entity_type: "official_partner", team_id: team.team_id, user_id: `official:${team.team_id}`,
      display_name: team.team_name, headline: team.team_description, avatar_url: team.logo, cover_image: team.cover_image,
      identities: [{ tag_id: "official_partner", name: "官方合作", slug: "official-partner" }],
      service_scope: team.service_scope || [], services: (officialServices || []).filter((service: any) => service.team_id === team.team_id),
      stats: { like_count: 0, follower_count: 0, popularity_score: 0 }, sort_order: team.sort_order,
      is_carousel_enabled: true, carousel_status: "active", carousel_priority: team.sort_order,
    }));
    const userIds = (profiles || []).map((row: any) => row.user_id);
    if (!userIds.length) return reply(origin, 200, { categories: [], official_partners: officialItems, carousel: officialItems, latest: [], popular: [], items: officialItems });
    const [{ data: members }, { data: stats }, { data: verifications }] = await Promise.all([
      db.schema("booking").from("members").select("user_id").in("user_id", userIds).eq("account_status", "active"),
      db.schema("booking").from("matching_profile_stats").select("*").in("user_id", userIds),
      db.schema("booking").from("member_identity_verifications").select("user_id,tag_id").in("user_id", userIds).eq("status", "verified").or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);
    const activeIds = new Set((members || []).map((row: any) => row.user_id));
    const tagIds = [...new Set((verifications || []).map((row: any) => row.tag_id))];
    const { data: tags } = tagIds.length ? await db.schema("booking").from("tags").select("tag_id,name,slug").in("tag_id", tagIds).eq("tag_type", "identity").eq("status", "active") : { data: [] };
    const tagById = new Map((tags || []).map((row: any) => [row.tag_id, row]));
    const verifiedByUser = new Map<string, any[]>();
    for (const row of verifications || []) { const tag = tagById.get(row.tag_id); if (tag) verifiedByUser.set(row.user_id, [...(verifiedByUser.get(row.user_id) || []), tag]); }
    const statsByUser = new Map((stats || []).map((row: any) => [row.user_id, row]));
    const items = (profiles || []).filter((row: any) => activeIds.has(row.user_id)).map((row: any) => {
      const visibility = row.profile_field_visibility || {};
      return {
        user_id: row.user_id, public_slug: row.public_slug, display_name: row.welcome_name || row.display_name,
        headline: visibility.headline === false ? "" : (row.welcome_message || row.headline),
        avatar_url: visibility.avatar_url === false ? "" : row.avatar_url,
        circle_joined_at: row.circle_joined_at || row.published_at || row.created_at,
        identities: verifiedByUser.get(row.user_id) || [], stats: statsByUser.get(row.user_id) || { like_count: 0, follower_count: 0, popularity_score: 0 },
        is_carousel_enabled: row.is_carousel_enabled, carousel_status: row.carousel_status,
        carousel_start_at: row.carousel_start_at, carousel_end_at: row.carousel_end_at, carousel_priority: row.carousel_priority,
      };
    });
    const categories = [...new Map(items.flatMap((item: any) => item.identities).map((tag: any) => [tag.tag_id, tag])).values()];
    const memberCarousel = items.filter((item: any) => item.is_carousel_enabled && item.carousel_status === "active" && (!item.carousel_start_at || item.carousel_start_at <= now) && (!item.carousel_end_at || item.carousel_end_at > now)).sort((a: any,b: any) => Number(a.carousel_priority||0)-Number(b.carousel_priority||0));
    const carousel = [...officialItems, ...memberCarousel];
    const latest = [...items].sort((a: any,b: any) => new Date(b.circle_joined_at || 0).valueOf()-new Date(a.circle_joined_at || 0).valueOf()).slice(0,10);
    const popular = [...items].sort((a: any,b: any) => Number(b.stats?.popularity_score||0)-Number(a.stats?.popularity_score||0)).slice(0,10);
    return reply(origin, 200, { categories, official_partners: officialItems, carousel, latest, popular, items: [...officialItems, ...items] });
  }
  if (action === "public-matching-profile") {
    const slug = String(url.searchParams.get("slug") || url.searchParams.get("profile") || "").trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,126}[a-z0-9])?$/.test(slug)) return contractError(origin, 404, "not_found", "找不到媒合頁");
    const { data: profile, error } = await db.schema("booking").from("matching_profiles")
      .select(PROFILE_FIELDS).eq("public_slug", slug).eq("publish_status", "published").or("is_public.eq.true,is_public.is.null").maybeSingle();
    if (error || !profile) return contractError(origin, 404, "not_found", "找不到媒合頁");
    const { data: member } = await db.schema("booking").from("members").select("user_id,account_status").eq("user_id", profile.user_id).eq("account_status", "active").maybeSingle();
    if (!member) return contractError(origin, 404, "not_found", "找不到媒合頁");
    const [{ data: provider }, { data: partner }, { data: seeker }, { data: memberTags }, { data: verifications }] = await Promise.all([
      db.schema("booking").from("providers").select("brand_name,service_area,service_mode,website,instagram,facebook,portfolio_urls,pricing_description,quote_method,member_discount,accept_projects,accept_long_term,available_hours,availability_status").eq("user_id", profile.user_id).eq("approval_status", "approved").maybeSingle(),
      db.schema("booking").from("partners").select("organization_name,partner_types,introduction,website,location,service_area,resources,cooperation_methods,cooperation_conditions,price_description,member_discount,advertising_interest,matching_interest").eq("user_id", profile.user_id).eq("approval_status", "approved").maybeSingle(),
      db.schema("booking").from("seeker_profiles").select("looking_for,need_categories,budget_min,budget_max,region,timeline,cooperation_type,accept_matching").eq("user_id", profile.user_id).eq("approval_status", "approved").eq("is_public", true).maybeSingle(),
      db.schema("booking").from("member_tags").select("tag_id").eq("user_id", profile.user_id).eq("status", "active"),
      db.schema("booking").from("member_identity_verifications").select("verification_id,tag_id,verified_at,expires_at,review_note_public").eq("user_id", profile.user_id).eq("status", "verified").or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);
    const tagIds = [...new Set([...(memberTags || []).map((row: any) => row.tag_id), ...(verifications || []).map((row: any) => row.tag_id)])];
    const { data: tags } = tagIds.length ? await db.schema("booking").from("tags").select("tag_id,name,slug").in("tag_id", tagIds).eq("tag_type", "identity").eq("status", "active") : { data: [] };
    const verificationIds = (verifications || []).map((row: any) => row.verification_id);
    const { data: publicRequirements } = verificationIds.length ? await db.schema("booking").from("identity_verification_requirements").select("requirement_id,label").eq("is_public_result", true).eq("evidence_type", "certificate") : { data: [] };
    const requirementIds = (publicRequirements || []).map((row: any) => row.requirement_id);
    const { data: certificates } = verificationIds.length && requirementIds.length ? await db.schema("booking").from("member_identity_evidence")
      .select("verification_id,requirement_id,certificate_name,issuer_name,certificate_number_masked,issued_on").in("verification_id", verificationIds).in("requirement_id", requirementIds) : { data: [] };
    const tagByVerification = new Map((verifications || []).map((row: any) => [row.verification_id, row.tag_id]));
    const labelByRequirement = new Map((publicRequirements || []).map((row: any) => [row.requirement_id, row.label]));
    const visibility = profile.profile_field_visibility || {};
    const { data: currentStats } = await db.schema("booking").from("matching_profile_stats").select("*").eq("user_id", profile.user_id).maybeSingle();
    const stats = { ...(currentStats || {}), user_id: profile.user_id, profile_view_count: Number(currentStats?.profile_view_count || 0) + 1, updated_at: now };
    await db.schema("booking").from("matching_profile_stats").upsert(stats, { onConflict: "user_id" });
    return reply(origin, 200, {
      profile: { user_id: profile.user_id, public_slug: profile.public_slug, display_name: profile.display_name, welcome_name: profile.welcome_name, welcome_message: profile.welcome_message, headline: visibility.headline === false ? "" : profile.headline, public_intro: visibility.public_intro === false ? "" : profile.public_intro, service_region: visibility.service_region === false ? "" : profile.service_region, availability_summary: profile.availability_summary, avatar_url: visibility.avatar_url === false ? "" : profile.avatar_url, booking_enabled: profile.booking_enabled, inquiry_enabled: profile.inquiry_enabled, matching_enabled: profile.matching_enabled, contact_mode: "platform_only", published_at: profile.published_at },
      provider: provider || null, partner: partner || null, seeker: seeker || null, identity_tags: tags || [],
      verifications: (verifications || []).map((row: any) => ({ tag_id: row.tag_id, verified_at: row.verified_at, expires_at: row.expires_at, review_note_public: row.review_note_public })),
      certificates: profile.verification_info_visible === false ? [] : (certificates || []).map((row: any) => ({ tag_id: tagByVerification.get(row.verification_id), label: labelByRequirement.get(row.requirement_id), certificate_name: row.certificate_name, issuer_name: row.issuer_name, certificate_number_masked: row.certificate_number_masked, issued_on: row.issued_on })),
      stats,
    });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);
  const categoryTagIdRaw = url.searchParams.get("category_tag_id");
  if (categoryTagIdRaw && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(categoryTagIdRaw)) {
    return contractError(origin, 400, "invalid_input", "category_tag_id 格式不正確");
  }
  const categoryTagId = categoryTagIdRaw || null;
  let scheduleQuery = db.schema("booking").from("matching_feature_schedules").select("schedule_id,application_id,sort_order,starts_at,ends_at")
    .in("status", ["scheduled", "active"]).lte("starts_at", now).gt("ends_at", now).order("sort_order").limit(limit);
  const { data: schedules, error } = await scheduleQuery;
  if (error) return contractError(origin, 400, "feature_feed_unavailable", "媒合輪播暫時無法讀取");
  const applicationIds = (schedules || []).map((row: any) => row.application_id);
  let applicationsQuery = db.schema("booking").from("matching_feature_applications").select("application_id,matching_profile_user_id,category_tag_id").in("application_id", applicationIds).eq("status", "approved");
  if (categoryTagId) applicationsQuery = applicationsQuery.eq("category_tag_id", categoryTagId);
  const { data: applications } = applicationIds.length ? await applicationsQuery : { data: [] };
  const profileUsers = (applications || []).map((row: any) => row.matching_profile_user_id);
  const [{ data: profiles }, { data: activeMembers }] = profileUsers.length ? await Promise.all([
    db.schema("booking").from("matching_profiles").select("user_id,public_slug,display_name,headline,public_intro,service_region,availability_summary").in("user_id", profileUsers).eq("publish_status", "published"),
    db.schema("booking").from("members").select("user_id").in("user_id", profileUsers).eq("account_status", "active"),
  ]) : [{ data: [] }, { data: [] }];
  const activeMemberIds = new Set((activeMembers || []).map((row: any) => row.user_id));
  const applicationById = new Map((applications || []).map((row: any) => [row.application_id, row]));
  const profileByUser = new Map((profiles || []).map((row: any) => [row.user_id, row]));
  const items = (schedules || []).flatMap((schedule: any) => {
    const application: any = applicationById.get(schedule.application_id);
    const profile: any = application ? profileByUser.get(application.matching_profile_user_id) : null;
    return profile && activeMemberIds.has(profile.user_id) ? [{ ...profile, category_tag_id: application.category_tag_id, sort_order: schedule.sort_order }] : [];
  });
  return reply(origin, 200, { items });
}

async function participantRecord(ctx: RequestContext, matchId: string) {
  const { data, error } = await ctx.db.schema("booking").from("matching_records").select(RECORD_FIELDS).eq("match_id", matchId).or(`initiator_user_id.eq.${ctx.user.id},counterparty_user_id.eq.${ctx.user.id}`).maybeSingle();
  if (error || !data) fail("not_found", "找不到媒合紀錄");
  return data;
}

export async function handleMatchingMember(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  try {
    if (action === "my-matching-profile") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("matching_profiles").select(PROFILE_FIELDS).eq("user_id", ctx.user.id).maybeSingle();
        return error ? contractError(ctx.origin, 400, "matching_profile_unavailable", "媒合頁暫時無法讀取") : reply(ctx.origin, 200, { profile: data || null });
      }
      if (method === "PUT") {
        const requested = String(ctx.body.publish_status || "draft");
        if (!["draft", "pending_review", "hidden"].includes(requested)) fail("invalid_transition", "會員不可自行發布或停權媒合頁");
        const { data: current, error: readError } = await ctx.db.schema("booking").from("matching_profiles").select("public_slug,publish_status,submitted_at,is_public,profile_field_visibility").eq("user_id", ctx.user.id).maybeSingle();
        if (readError) return contractError(ctx.origin, 400, "matching_profile_unavailable", "媒合頁暫時無法讀取");
        if (current?.publish_status === "suspended") fail("forbidden", "媒合頁已被停權");
        const memberTransitions: Record<string, string[]> = {
          new: ["draft", "pending_review"], draft: ["draft", "pending_review"],
          pending_review: ["draft", "pending_review", "hidden"], published: ["pending_review", "hidden"],
          hidden: ["draft", "pending_review", "hidden"],
        };
        if (!(memberTransitions[current?.publish_status || "new"] || []).includes(requested)) fail("invalid_transition", "媒合頁狀態轉換不合法");
        const now = new Date().toISOString();
        const requestedVisibility = (ctx.body.profile_field_visibility && typeof ctx.body.profile_field_visibility === "object" && !Array.isArray(ctx.body.profile_field_visibility) ? ctx.body.profile_field_visibility : current?.profile_field_visibility || {}) as Record<string, unknown>;
        const visibility = Object.fromEntries(["display_name","headline","public_intro","avatar_url","service_region","contact","social","address"].map((key) => [key, Boolean(requestedVisibility[key])]));
        const avatarUrl = text(ctx.body.avatar_url, 1000, "頭像網址");
        if (avatarUrl && !/^https:\/\/[^\s]+$/i.test(avatarUrl)) fail("invalid_input", "頭像網址只接受 https");
        const values = {
          user_id: ctx.user.id, public_slug: current?.public_slug || randomSlug(),
          display_name: text(ctx.body.display_name, 120, "公開名稱", true), headline: text(ctx.body.headline, 200, "標題"),
          public_intro: text(ctx.body.public_intro, 5000, "公開介紹"), service_region: text(ctx.body.service_region, 500, "服務地區"),
          availability_summary: text(ctx.body.availability_summary, 1000, "可預約時段"), publish_status: requested, contact_mode: "platform_only",
          avatar_url: avatarUrl, welcome_name: text(ctx.body.welcome_name,120,"歡迎名稱"), welcome_message: text(ctx.body.welcome_message,300,"歡迎訊息"),
          profile_field_visibility: visibility, booking_enabled: ctx.body.booking_enabled !== false,
          inquiry_enabled: ctx.body.inquiry_enabled !== false, inquiry_items: stringArray(ctx.body.inquiry_items,"詢價項目"),
          matching_enabled: ctx.body.matching_enabled !== false, matching_items: stringArray(ctx.body.matching_items,"媒合項目"),
          verification_info_visible: ctx.body.verification_info_visible !== false,
          is_public: "is_public" in ctx.body ? Boolean(ctx.body.is_public) : (current?.is_public ?? true),
          submitted_at: requested === "pending_review" ? now : (requested === "draft" ? null : current?.submitted_at), profile_updated_at: now, updated_at: now,
        };
        const { data, error } = await ctx.db.schema("booking").from("matching_profiles").upsert(values, { onConflict: "user_id" }).select(PROFILE_FIELDS).single();
        return error ? contractError(ctx.origin, 400, "matching_profile_save_failed", "媒合頁儲存失敗") : reply(ctx.origin, 200, { profile: data });
      }
    }

    if (action === "matching-records") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("matching_records").select(RECORD_FIELDS).or(`initiator_user_id.eq.${ctx.user.id},counterparty_user_id.eq.${ctx.user.id}`).order("created_at", { ascending: false });
        if (error) return contractError(ctx.origin, 400, "matching_records_unavailable", "媒合紀錄暫時無法讀取");
        const ids = (data || []).map((row: any) => row.match_id);
        const confirmations = ids.length ? await ctx.db.schema("booking").from("matching_confirmations").select("confirmation_id,match_id,user_id,terms_version,decision,terms_snapshot,confirmed_at,created_at,updated_at").in("match_id", ids) : { data: [], error: null };
        return confirmations.error ? contractError(ctx.origin, 400, "matching_records_unavailable", "媒合紀錄暫時無法讀取") : reply(ctx.origin, 200, { records: data || [], confirmations: confirmations.data || [] });
      }
      if (method === "POST") {
        const counterpartyId = id(ctx.body.counterparty_user_id, "counterparty_user_id");
        if (counterpartyId === ctx.user.id) fail("invalid_input", "媒合雙方不可為同一人");
        const { data: counterparty } = await ctx.db.schema("booking").from("members").select("user_id").eq("user_id", counterpartyId).eq("account_status", "active").maybeSingle();
        if (!counterparty) fail("not_found", "找不到媒合對象");
        const subjectType = String(ctx.body.subject_type || "");
        if (!["service", "need", "cooperation", "resource"].includes(subjectType)) fail("invalid_input", "媒合主題類型不正確");
        const providerId = ctx.body.provider_user_id ? id(ctx.body.provider_user_id, "provider_user_id") : null;
        const seekerId = ctx.body.seeker_user_id ? id(ctx.body.seeker_user_id, "seeker_user_id") : null;
        const participants = new Set([ctx.user.id, counterpartyId]);
        if ((providerId && !participants.has(providerId)) || (seekerId && !participants.has(seekerId))) fail("invalid_input", "服務者與需求方必須是媒合參與者");
        if (providerId && seekerId && providerId === seekerId) fail("invalid_input", "服務者與需求方不可為同一人");
        const amount = ctx.body.agreed_amount === null || ctx.body.agreed_amount === "" || ctx.body.agreed_amount === undefined ? null : Number(ctx.body.agreed_amount);
        if (amount !== null && (!Number.isInteger(amount) || amount < 0 || amount > 100000000)) fail("invalid_input", "約定金額格式不正確");
        const { data, error } = await ctx.db.schema("booking").from("matching_records").insert({
          match_code: randomCode(), initiator_user_id: ctx.user.id, counterparty_user_id: counterpartyId, provider_user_id: providerId, seeker_user_id: seekerId,
          subject_type: subjectType, subject_title: text(ctx.body.subject_title, 300, "媒合主題", true), scope_snapshot: object(ctx.body.scope_snapshot || {}, "媒合內容"),
          terms_version: 1, scheduled_at: dateValue(ctx.body.scheduled_at, "預定時間"), location_text: text(ctx.body.location_text, 500, "地點"),
          agreed_amount: amount, payment_method_text: text(ctx.body.payment_method_text, 300, "付款方式"), status: "proposed",
        }).select(RECORD_FIELDS).single();
        return error ? contractError(ctx.origin, 400, "matching_record_create_failed", "媒合紀錄建立失敗") : reply(ctx.origin, 201, { record: data });
      }
    }

    if (action === "matching-confirmation" && method === "POST") {
      const matchId = id(ctx.body.match_id, "match_id");
      const record = await participantRecord(ctx, matchId);
      if (!["proposed", "partially_confirmed"].includes(record.status)) fail("invalid_transition", "目前媒合狀態不可確認");
      const termsVersion = Number(ctx.body.terms_version);
      if (!Number.isInteger(termsVersion) || termsVersion !== record.terms_version) fail("conflict", "媒合內容已變更，請重新讀取");
      const decision = String(ctx.body.decision || "");
      if (!["confirmed", "declined"].includes(decision)) fail("invalid_input", "確認結果不正確");
      const termsSnapshot = object(ctx.body.terms_snapshot || record.scope_snapshot, "確認內容");
      if (stableJson(termsSnapshot) !== stableJson(record.scope_snapshot)) fail("conflict", "媒合內容已變更，請重新讀取");
      const now = new Date().toISOString();
      const { error } = await ctx.db.schema("booking").from("matching_confirmations").upsert({ match_id: matchId, user_id: ctx.user.id, terms_version: termsVersion, decision, terms_snapshot: termsSnapshot, confirmed_at: now, updated_at: now }, { onConflict: "match_id,user_id,terms_version" });
      if (error) return contractError(ctx.origin, 400, "matching_confirmation_failed", "媒合確認儲存失敗");
      let next = "cancelled";
      if (decision === "confirmed") {
        const { data: confirmations, error: readError } = await ctx.db.schema("booking").from("matching_confirmations").select("user_id,decision,terms_snapshot").eq("match_id", matchId).eq("terms_version", termsVersion);
        if (readError) return contractError(ctx.origin, 400, "matching_confirmation_failed", "媒合確認狀態讀取失敗");
        const confirmed = new Set((confirmations || []).filter((row: any) => row.decision === "confirmed" && stableJson(row.terms_snapshot) === stableJson(record.scope_snapshot)).map((row: any) => row.user_id));
        next = confirmed.has(record.initiator_user_id) && confirmed.has(record.counterparty_user_id) ? "confirmed" : "partially_confirmed";
      }
      const { data, error: updateError } = await ctx.db.schema("booking").from("matching_records").update({ status: next, confirmed_at: next === "confirmed" ? now : null, updated_at: now }).eq("match_id", matchId).eq("terms_version", termsVersion).in("status", ["proposed", "partially_confirmed"]).select(RECORD_FIELDS).maybeSingle();
      return updateError || !data ? contractError(ctx.origin, 409, "matching_confirmation_conflict", "媒合狀態已變更，請重新讀取") : reply(ctx.origin, 200, { record: data });
    }

    if (action === "matching-reports") {
      if (method === "GET") {
        const { data: records } = await ctx.db.schema("booking").from("matching_records").select("match_id").or(`initiator_user_id.eq.${ctx.user.id},counterparty_user_id.eq.${ctx.user.id}`);
        const matchIds = (records || []).map((row: any) => row.match_id);
        const { data, error } = matchIds.length ? await ctx.db.schema("booking").from("matching_reports").select(REPORT_FIELDS).in("match_id", matchIds).order("created_at", { ascending: false }) : { data: [], error: null };
        return error ? contractError(ctx.origin, 400, "matching_reports_unavailable", "問題回報暫時無法讀取") : reply(ctx.origin, 200, { reports: data || [] });
      }
      if (method === "POST") {
        const matchId = id(ctx.body.match_id, "match_id");
        await participantRecord(ctx, matchId);
        const category = String(ctx.body.category || "");
        if (!["no_show", "late_cancel", "amount_dispute", "scope_dispute", "suspected_fraud", "misconduct", "safety", "other"].includes(category)) fail("invalid_input", "回報類別不正確");
        const { data, error } = await ctx.db.schema("booking").from("matching_reports").insert({ match_id: matchId, reporter_user_id: ctx.user.id, category, description: text(ctx.body.description, 5000, "回報說明", true), status: "open" }).select(REPORT_FIELDS).single();
        return error ? contractError(ctx.origin, 400, "matching_report_create_failed", "問題回報建立失敗") : reply(ctx.origin, 201, { report: data });
      }
    }

    if (action === "matching-feature-applications") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("matching_feature_applications").select(FEATURE_APPLICATION_FIELDS).eq("user_id", ctx.user.id).order("created_at", { ascending: false });
        return error ? contractError(ctx.origin, 400, "feature_applications_unavailable", "輪播申請暫時無法讀取") : reply(ctx.origin, 200, { applications: data || [] });
      }
      if (method === "POST") {
        const { data: profile } = await ctx.db.schema("booking").from("matching_profiles").select("user_id,publish_status").eq("user_id", ctx.user.id).maybeSingle();
        if (!profile || profile.publish_status !== "published") fail("invalid_profile", "媒合頁必須先經審核發布");
        const requestedStart = dateValue(ctx.body.requested_start_at, "希望開始時間");
        const requestedEnd = dateValue(ctx.body.requested_end_at, "希望結束時間");
        if (requestedStart && requestedEnd && requestedStart >= requestedEnd) fail("invalid_date", "結束時間必須晚於開始時間");
        const categoryTagId = ctx.body.category_tag_id ? id(ctx.body.category_tag_id, "category_tag_id") : null;
        if (categoryTagId) {
          const { data: category } = await ctx.db.schema("booking").from("tags").select("tag_id").eq("tag_id", categoryTagId).eq("status", "active").maybeSingle();
          if (!category) fail("invalid_tag", "輪播分類標籤不存在");
        }
        const { data, error } = await ctx.db.schema("booking").from("matching_feature_applications").insert({ user_id: ctx.user.id, matching_profile_user_id: ctx.user.id, category_tag_id: categoryTagId, requested_start_at: requestedStart, requested_end_at: requestedEnd, status: "pending" }).select(FEATURE_APPLICATION_FIELDS).single();
        return error ? contractError(ctx.origin, 400, "feature_application_create_failed", "輪播申請建立失敗") : reply(ctx.origin, 201, { application: data });
      }
    }
    return null;
  } catch (error) { return apiError(ctx, error); }
}

export async function handleMatchingAdmin(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  try {
    if (action === "admin-matching-profiles") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("matching_profiles").select(`${PROFILE_FIELDS},reviewed_by`).order("updated_at", { ascending: false });
        return error ? contractError(ctx.origin, 400, "matching_profiles_unavailable", "媒合頁暫時無法讀取") : reply(ctx.origin, 200, { profiles: data || [] });
      }
      if (method === "PATCH") {
        const userId = id(ctx.body.user_id, "user_id");
        const next = String(ctx.body.publish_status || "");
        const transitions: Record<string, string[]> = { pending_review: ["published", "hidden", "suspended"], published: ["hidden", "suspended"], hidden: ["published", "suspended"], suspended: ["hidden"] };
        const { data: current } = await ctx.db.schema("booking").from("matching_profiles").select("publish_status").eq("user_id", userId).maybeSingle();
        if (!current) fail("not_found", "找不到媒合頁");
        if (!(transitions[current.publish_status] || []).includes(next)) fail("invalid_transition", "媒合頁狀態轉換不合法");
        const now = new Date().toISOString();
        const { data, error } = await ctx.db.schema("booking").from("matching_profiles").update({ publish_status: next, reviewed_by: ctx.user.id, published_at: next === "published" ? now : null, updated_at: now }).eq("user_id", userId).eq("publish_status", current.publish_status).select(PROFILE_FIELDS).maybeSingle();
        return error || !data ? contractError(ctx.origin, 409, "matching_profile_update_failed", "媒合頁狀態已變更，請重新讀取") : reply(ctx.origin, 200, { profile: data });
      }
    }
    if (action === "admin-matching-records" && method === "GET") {
      const { data, error } = await ctx.db.schema("booking").from("matching_records").select(RECORD_FIELDS).order("created_at", { ascending: false });
      return error ? contractError(ctx.origin, 400, "matching_records_unavailable", "媒合紀錄暫時無法讀取") : reply(ctx.origin, 200, { records: data || [] });
    }
    if (action === "admin-matching-reports") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("matching_reports").select(REPORT_FIELDS).order("created_at", { ascending: false });
        return error ? contractError(ctx.origin, 400, "matching_reports_unavailable", "問題回報暫時無法讀取") : reply(ctx.origin, 200, { reports: data || [] });
      }
      if (method === "PATCH") {
        const reportId = id(ctx.body.report_id, "report_id");
        const next = String(ctx.body.status || "");
        const transitions: Record<string, string[]> = { open: ["reviewing", "resolved", "dismissed"], reviewing: ["resolved", "dismissed"] };
        const { data: current } = await ctx.db.schema("booking").from("matching_reports").select("status").eq("report_id", reportId).maybeSingle();
        if (!current) fail("not_found", "找不到問題回報");
        if (!(transitions[current.status] || []).includes(next)) fail("invalid_transition", "回報狀態轉換不合法");
        const now = new Date().toISOString();
        const { data, error } = await ctx.db.schema("booking").from("matching_reports").update({ status: next, assigned_to: ctx.body.assigned_to ? id(ctx.body.assigned_to, "assigned_to") : ctx.user.id, resolution_note: text(ctx.body.resolution_note, 5000, "處理紀錄"), resolved_at: ["resolved", "dismissed"].includes(next) ? now : null, updated_at: now }).eq("report_id", reportId).eq("status", current.status).select(REPORT_FIELDS).maybeSingle();
        return error || !data ? contractError(ctx.origin, 409, "matching_report_update_failed", "回報狀態已變更，請重新讀取") : reply(ctx.origin, 200, { report: data });
      }
    }
    if (action === "admin-matching-features") {
      if (method === "GET") {
        const [{ data: applications, error }, { data: schedules, error: scheduleError }] = await Promise.all([
          ctx.db.schema("booking").from("matching_feature_applications").select(FEATURE_APPLICATION_FIELDS).order("created_at", { ascending: false }),
          ctx.db.schema("booking").from("matching_feature_schedules").select("*").order("starts_at", { ascending: false }),
        ]);
        return error || scheduleError ? contractError(ctx.origin, 400, "matching_features_unavailable", "媒合輪播暫時無法讀取") : reply(ctx.origin, 200, { applications: applications || [], schedules: schedules || [] });
      }
      if (method === "POST") {
        const applicationId = id(ctx.body.application_id, "application_id");
        const startsAt = dateValue(ctx.body.starts_at, "開始時間"); const endsAt = dateValue(ctx.body.ends_at, "結束時間");
        if (!startsAt || !endsAt || startsAt >= endsAt) fail("invalid_date", "輪播時間區間不正確");
        const { data: application } = await ctx.db.schema("booking").from("matching_feature_applications").select("application_id,status").eq("application_id", applicationId).eq("status", "approved").maybeSingle();
        if (!application) fail("invalid_application", "只有已核准申請可建立排程");
        const { data, error } = await ctx.db.schema("booking").from("matching_feature_schedules").insert({ application_id: applicationId, starts_at: startsAt, ends_at: endsAt, sort_order: Number.isInteger(ctx.body.sort_order) ? ctx.body.sort_order : 0, status: "scheduled" }).select("*").single();
        return error ? contractError(ctx.origin, 400, "matching_schedule_create_failed", "媒合輪播排程建立失敗") : reply(ctx.origin, 201, { schedule: data });
      }
      if (method === "PATCH") {
        const target = String(ctx.body.target || "application");
        const now = new Date().toISOString();
        if (target === "application") {
          const applicationId = id(ctx.body.application_id, "application_id"); const status = String(ctx.body.status || "");
          if (!["approved", "rejected", "inactive"].includes(status)) fail("invalid_transition", "輪播申請狀態不正確");
          const { data, error } = await ctx.db.schema("booking").from("matching_feature_applications").update({ status, reviewed_by: ctx.user.id, review_note: text(ctx.body.review_note, 2000, "審核備註"), reviewed_at: now, updated_at: now }).eq("application_id", applicationId).in("status", status === "inactive" ? ["approved"] : ["pending"]).select(FEATURE_APPLICATION_FIELDS).maybeSingle();
          return error || !data ? contractError(ctx.origin, 409, "feature_application_update_failed", "申請狀態已變更，請重新讀取") : reply(ctx.origin, 200, { application: data });
        }
        if (target === "schedule") {
          const scheduleId = id(ctx.body.schedule_id, "schedule_id"); const status = String(ctx.body.status || "");
          if (!["scheduled", "active", "paused", "ended"].includes(status)) fail("invalid_transition", "輪播排程狀態不正確");
          const { data: current } = await ctx.db.schema("booking").from("matching_feature_schedules").select("status").eq("schedule_id", scheduleId).maybeSingle();
          if (!current) fail("not_found", "找不到輪播排程");
          const scheduleTransitions: Record<string, string[]> = { scheduled: ["active", "paused", "ended"], active: ["paused", "ended"], paused: ["scheduled", "active", "ended"] };
          if (!(scheduleTransitions[current.status] || []).includes(status)) fail("invalid_transition", "輪播排程狀態轉換不合法");
          const patch: Record<string, unknown> = { status, updated_at: now };
          if ("sort_order" in ctx.body) {
            const sortOrder = Number(ctx.body.sort_order);
            if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) fail("invalid_input", "排序值格式不正確");
            patch.sort_order = sortOrder;
          }
          const { data, error } = await ctx.db.schema("booking").from("matching_feature_schedules").update(patch).eq("schedule_id", scheduleId).eq("status", current.status).select("*").maybeSingle();
          return error || !data ? contractError(ctx.origin, 400, "matching_schedule_update_failed", "輪播排程更新失敗") : reply(ctx.origin, 200, { schedule: data });
        }
        fail("invalid_input", "target 必須是 application 或 schedule");
      }
    }
    return null;
  } catch (error) { return apiError(ctx, error); }
}
