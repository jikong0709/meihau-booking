import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const ROLE_KEYS = ["member", "provider", "partner", "resource_seeker"] as const;
const REQUIRED: Record<string, string[]> = {
  member: ["member_terms"],
  provider: ["provider_rules", "matching_rules", "payment_rules"],
  partner: ["partner_rules"],
  resource_seeker: ["seeker_rules", "matching_rules"],
};
const PROVIDER_FIELDS = "provider_id,entity_type,brand_name,service_area,service_mode,website,instagram,facebook,line,portfolio_urls,pricing_description,quote_method,member_discount,accept_projects,accept_long_term,available_hours,availability_status,approval_status";
const PARTNER_FIELDS = "partner_id,organization_name,partner_types,introduction,website,social_links,location,service_area,resources,cooperation_methods,cooperation_conditions,price_description,member_discount,advertising_interest,matching_interest,approval_status";
const SEEKER_FIELDS = "user_id,looking_for,need_categories,budget_min,budget_max,region,timeline,cooperation_type,is_public,accept_matching,approval_status";

function strings(value: unknown, limit = 20, itemLimit = 200) {
  if (!Array.isArray(value)) return [];
  const result = [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  if (result.length > limit || result.some((v) => v.length > itemLimit)) throw new Error("invalid_length");
  return result;
}
function text(value: unknown, max: number) {
  const result = String(value ?? "").trim();
  if (result.length > max) throw new Error("invalid_length");
  return result;
}
function url(value: unknown, max = 2000) {
  const result = text(value, max);
  if (result && !/^https?:\/\//i.test(result)) throw new Error("invalid_url");
  return result;
}
function urls(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) throw new Error("invalid_portfolio_urls");
  return [...new Set(value.map((v) => url(v)).filter(Boolean))];
}
function integer(value: unknown, nullable = true) {
  if ((value === "" || value === null || value === undefined) && nullable) return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0 || result > 100000000) throw new Error("invalid_number");
  return result;
}
function validationError(ctx: RequestContext, error: unknown) {
  const code = error instanceof Error ? error.message : "invalid_input";
  const messages: Record<string, string> = {
    invalid_length: "欄位長度超過限制", invalid_url: "網址僅接受 http 或 https", invalid_portfolio_urls: "作品集網址最多 10 筆", invalid_number: "數字欄位格式錯誤",
  };
  return contractError(ctx.origin, 400, code, messages[code] || "輸入資料格式錯誤");
}

async function activeAgreements(db: any, roles?: string[]) {
  let query = db.schema("booking").from("agreements").select("agreement_id,agreement_key,version,title,body_md,applies_to_roles").eq("status", "active").order("agreement_key");
  if (roles?.length) query = query.overlaps("applies_to_roles", roles);
  return await query;
}

export async function getMyRoles(ctx: RequestContext) {
  const { db, origin, user } = ctx;
  const [{ data: roles, error: roleError }, { data: provider }, { data: partner }, { data: seeker }, { data: tags }, { data: agreements, error: agreementError }, { data: records }, { data: links }] = await Promise.all([
    db.schema("booking").from("member_roles").select("role_key,status").eq("user_id", user.id).order("role_key"),
    db.schema("booking").from("providers").select(PROVIDER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("partners").select(PARTNER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("seeker_profiles").select(SEEKER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("member_tags").select("tag_id").eq("user_id", user.id).eq("status", "active"),
    activeAgreements(db),
    db.schema("booking").from("member_agreements").select("agreement_id,status").eq("user_id", user.id).eq("status", "agreed"),
    db.schema("booking").from("service_providers").select("service_id,providers!inner(user_id)").eq("providers.user_id", user.id),
  ]);
  if (roleError || agreementError) return contractError(origin, 400, "roles_unavailable", "角色資料暫時無法讀取");
  const agreed = new Set((records || []).map((row: any) => row.agreement_id));
  return reply(origin, 200, {
    roles: (roles || []).map((row: any) => ({ ...row, review_note_public: null })),
    provider: provider ? { ...provider, service_ids: (links || []).map((row: any) => row.service_id) } : null,
    partner: partner || null, seeker: seeker || null,
    tag_ids: (tags || []).map((row: any) => row.tag_id),
    agreements: (agreements || []).map((row: any) => ({ ...row, agreed: agreed.has(row.agreement_id) })),
  });
}

async function validateAgreementSubmission(ctx: RequestContext, roles: string[], submittedIds: string[]) {
  const requiredKeys = [...new Set(roles.flatMap((role) => REQUIRED[role] || []))];
  const { data, error } = await activeAgreements(ctx.db, roles);
  if (error) throw new Error("agreements_unavailable");
  const required = (data || []).filter((row: any) => requiredKeys.includes(row.agreement_key));
  const submitted = new Set(submittedIds);
  const { data: existing } = await ctx.db.schema("booking").from("member_agreements").select("agreement_id").eq("user_id", ctx.user.id).eq("status", "agreed");
  const agreed = new Set([...(existing || []).map((row: any) => row.agreement_id), ...submitted]);
  return { required, missing: required.filter((row: any) => !agreed.has(row.agreement_id)) };
}

async function saveRoleProfiles(ctx: RequestContext, roles: string[], existingRoles: Map<string, string>) {
  const { body, db, user } = ctx;
  let providerId: string | null = null;
  if (roles.includes("provider")) {
    const input = body.provider || {};
    const entityType = String(input.entity_type || "individual");
    const serviceMode = String(input.service_mode || "both");
    const availability = String(input.availability_status || "available");
    if (!["individual", "brand", "store"].includes(entityType) || !["online", "offline", "both"].includes(serviceMode) || !["available", "partial", "paused", "internal_only", "standby"].includes(availability)) throw new Error("invalid_input");
    const { data: existing } = await db.schema("booking").from("providers").select("provider_id").eq("user_id", user.id).maybeSingle();
    providerId = existing?.provider_id || `PRV-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const brandName = text(input.brand_name || ctx.member.full_name || ctx.member.name, 120);
    if (!brandName) throw new Error("invalid_input");
    const row = {
      provider_id: providerId, user_id: user.id, display_name: brandName, provider_type: entityType === "individual" ? "person" : "team",
      entity_type: entityType, brand_name: brandName, service_area: text(input.service_area, 500), service_mode: serviceMode,
      website: url(input.website), instagram: url(input.instagram), facebook: url(input.facebook), line: text(input.line, 200),
      portfolio_urls: urls(input.portfolio_urls || []), pricing_description: text(input.pricing_description, 2000), quote_method: text(input.quote_method, 1000),
      member_discount: text(input.member_discount, 1000), accept_projects: Boolean(input.accept_projects), accept_long_term: Boolean(input.accept_long_term),
      available_hours: text(input.available_hours, 1000), availability_status: availability, status: "hidden", approval_status: existingRoles.get("provider") === "approved" ? "approved" : "pending", updated_at: new Date().toISOString(),
    };
    const { error } = await db.schema("booking").from("providers").upsert(row, { onConflict: "provider_id" });
    if (error) throw new Error("provider_save_failed");
    const serviceIds = strings(input.service_ids, 100, 80);
    if (serviceIds.length) {
      const { data: validServices, error: serviceError } = await db.schema("booking").from("services").select("service_id").in("service_id", serviceIds).in("service_status", ["active", "coming_soon"]);
      if (serviceError || validServices?.length !== serviceIds.length) throw new Error("invalid_services");
      const { error: linkError } = await db.schema("booking").from("service_providers").upsert(
        serviceIds.map((serviceId) => ({ service_id: serviceId, provider_id: providerId, status: "hidden" })),
        { onConflict: "service_id,provider_id", ignoreDuplicates: true },
      );
      if (linkError) throw new Error("provider_services_save_failed");
    }
  }
  if (roles.includes("partner")) {
    const input = body.partner || {};
    const partnerTypes = strings(input.partner_types, 20, 40);
    const allowed = ["store", "brand", "supplier", "advertising", "cross_industry", "channel", "venue", "lecturer", "consultant", "other"];
    if (!partnerTypes.length || partnerTypes.some((value) => !allowed.includes(value))) throw new Error("invalid_input");
    const organizationName = text(input.organization_name, 160);
    if (!organizationName) throw new Error("invalid_input");
    const row = {
      user_id: user.id, organization_name: organizationName, partner_types: partnerTypes, introduction: text(input.introduction, 4000), website: url(input.website),
      social_links: typeof input.social_links === "object" && input.social_links && !Array.isArray(input.social_links) ? input.social_links : {}, location: text(input.location, 300),
      service_area: text(input.service_area, 500), resources: strings(input.resources, 50, 200), cooperation_methods: strings(input.cooperation_methods, 50, 200),
      cooperation_conditions: text(input.cooperation_conditions, 3000), price_description: text(input.price_description, 2000), member_discount: text(input.member_discount, 1000),
      advertising_interest: Boolean(input.advertising_interest), matching_interest: Boolean(input.matching_interest), approval_status: existingRoles.get("partner") === "approved" ? "approved" : "pending", updated_at: new Date().toISOString(),
    };
    const { error } = await db.schema("booking").from("partners").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error("partner_save_failed");
  }
  if (roles.includes("resource_seeker")) {
    const input = body.seeker || {};
    const budgetMin = integer(input.budget_min);
    const budgetMax = integer(input.budget_max);
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) throw new Error("invalid_number");
    const row = { user_id: user.id, looking_for: text(input.looking_for, 3000), need_categories: strings(input.need_categories, 50, 120), budget_min: budgetMin, budget_max: budgetMax, region: text(input.region, 120), timeline: text(input.timeline, 500), cooperation_type: text(input.cooperation_type, 500), is_public: Boolean(input.is_public), accept_matching: input.accept_matching !== false, approval_status: existingRoles.get("resource_seeker") === "approved" ? "approved" : "pending", updated_at: new Date().toISOString() };
    const { error } = await db.schema("booking").from("seeker_profiles").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error("seeker_save_failed");
  }
}

export async function putMyRoles(ctx: RequestContext) {
  try {
    if (!Array.isArray(ctx.body.roles)) return contractError(ctx.origin, 400, "invalid_roles", "roles 必須是陣列");
    const roles = [...new Set(ctx.body.roles.map(String))];
    if (roles.some((role) => !ROLE_KEYS.includes(role as typeof ROLE_KEYS[number]))) return contractError(ctx.origin, 400, "invalid_roles", "包含不支援的角色");
    const submittedIds = strings(ctx.body.agree_agreement_ids, 100, 80);
    const { required, missing } = await validateAgreementSubmission(ctx, roles, submittedIds);
    if (missing.length) return contractError(ctx.origin, 400, "agreements_required", `尚未同意：${missing.map((row: any) => row.title).join("、")}`);

    const now = new Date().toISOString();
    const { data: existingRoles, error: existingError } = await ctx.db.schema("booking").from("member_roles").select("role_key,status").eq("user_id", ctx.user.id);
    if (existingError) throw new Error("roles_save_failed");
    const existingMap = new Map((existingRoles || []).map((row: any) => [row.role_key, row.status]));
    const rows = ROLE_KEYS.map((roleKey) => ({
      user_id: ctx.user.id, role_key: roleKey,
      status: roles.includes(roleKey) ? (roleKey === "member" ? "approved" : (existingMap.get(roleKey) === "approved" ? "approved" : "pending")) : "inactive",
      applied_at: roles.includes(roleKey) ? now : undefined, reviewed_at: null, reviewed_by: null, review_note: "", updated_at: now,
    }));
    const { error: roleError } = await ctx.db.schema("booking").from("member_roles").upsert(rows, { onConflict: "user_id,role_key" });
    if (roleError) throw new Error("roles_save_failed");
    await saveRoleProfiles(ctx, roles, existingMap);
    if (!roles.includes("provider")) {
      const { data: provider } = await ctx.db.schema("booking").from("providers").update({ status: "hidden", approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id).select("provider_id").maybeSingle();
      if (provider) await ctx.db.schema("booking").from("service_providers").update({ status: "hidden", updated_at: now }).eq("provider_id", provider.provider_id);
    }
    if (!roles.includes("partner")) await ctx.db.schema("booking").from("partners").update({ approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id);
    if (!roles.includes("resource_seeker")) await ctx.db.schema("booking").from("seeker_profiles").update({ approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id);

    const tagIds = strings(ctx.body.tag_ids, 100, 80);
    if (tagIds.length) {
      const { data: activeTags, error: tagError } = await ctx.db.schema("booking").from("tags").select("tag_id").in("tag_id", tagIds).eq("status", "active");
      if (tagError || activeTags?.length !== tagIds.length) throw new Error("invalid_tags");
    }
    await ctx.db.schema("booking").from("member_tags").update({ status: "inactive", updated_at: now }).eq("user_id", ctx.user.id).eq("source", "self").eq("status", "active");
    if (tagIds.length) {
      const { error } = await ctx.db.schema("booking").from("member_tags").upsert(tagIds.map((tagId) => ({ user_id: ctx.user.id, tag_id: tagId, source: "self", status: "active", updated_at: now })), { onConflict: "user_id,tag_id" });
      if (error) throw new Error("tags_save_failed");
    }
    const submittedRequired = required.filter((row: any) => submittedIds.includes(row.agreement_id));
    if (submittedRequired.length) {
      const { error } = await ctx.db.schema("booking").from("member_agreements").upsert(submittedRequired.map((row: any) => ({ user_id: ctx.user.id, agreement_id: row.agreement_id, agreement_key: row.agreement_key, agreement_version: row.version, agreed_at: now, status: "agreed" })), { onConflict: "user_id,agreement_id" });
      if (error) throw new Error("agreements_save_failed");
    }
    return await getMyRoles(ctx);
  } catch (error) { return validationError(ctx, error); }
}

export async function handleTags(ctx: RequestContext) {
  let query = ctx.db.schema("booking").from("tags").select("tag_id,tag_type,name,slug").eq("status", "active").order("tag_type").order("sort_order");
  const type = ctx.url.searchParams.get("type");
  if (type) query = query.eq("tag_type", type);
  const { data, error } = await query;
  return error ? contractError(ctx.origin, 400, "tags_unavailable", "標籤暫時無法讀取") : reply(ctx.origin, 200, { tags: data });
}

export async function handleAgreements(ctx: RequestContext) {
  const role = ctx.url.searchParams.get("role");
  const { data, error } = await activeAgreements(ctx.db, role ? [role] : undefined);
  return error ? contractError(ctx.origin, 400, "agreements_unavailable", "規範暫時無法讀取") : reply(ctx.origin, 200, { agreements: data });
}

export async function handleServicesForProviders(ctx: RequestContext) {
  const { data, error } = await ctx.db.schema("booking").from("services").select("service_id,service_name,category_id").in("service_status", ["active", "coming_soon"]).order("sort_order");
  return error ? contractError(ctx.origin, 400, "services_unavailable", "服務清單暫時無法讀取") : reply(ctx.origin, 200, { services: data });
}

export async function mePayload(ctx: RequestContext) {
  const now = new Date().toISOString();
  const [{ data: member, error: memberError }, { data: roles }, { data: agreements }, { data: records }] = await Promise.all([
    ctx.db.schema("booking").from("members").update({ last_login_at: now }).eq("user_id", ctx.user.id).select("user_id,email,name,full_name,phone,line_id,contact_email,avatar_url,region,bio,is_public,role,account_status").single(),
    ctx.db.schema("booking").from("member_roles").select("role_key,status").eq("user_id", ctx.user.id),
    activeAgreements(ctx.db),
    ctx.db.schema("booking").from("member_agreements").select("agreement_id").eq("user_id", ctx.user.id).eq("status", "agreed"),
  ]);
  if (memberError) return contractError(ctx.origin, 400, "member_unavailable", "會員資料暫時無法讀取");
  const activeRoles = (roles || []).filter((row: any) => row.status !== "inactive").map((row: any) => row.role_key);
  const requiredKeys = new Set(activeRoles.flatMap((role: string) => REQUIRED[role] || []));
  const agreed = new Set((records || []).map((row: any) => row.agreement_id));
  const pending = (agreements || []).filter((row: any) => requiredKeys.has(row.agreement_key) && !agreed.has(row.agreement_id)).map(({ agreement_id, agreement_key, version, title }: any) => ({ agreement_id, agreement_key, version, title }));
  return reply(ctx.origin, 200, { member, partner_roles: roles || [], pending_agreements: pending });
}
