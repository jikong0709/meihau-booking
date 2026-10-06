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

function validationIssue(code: string, message: string): never {
  const error = new Error(code) as Error & { publicMessage?: string };
  error.publicMessage = message;
  throw error;
}
function strings(value: unknown, limit = 20, itemLimit = 200, field = "清單欄位") {
  if (!Array.isArray(value)) return [];
  const result = [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  if (result.length > limit || result.some((v) => v.length > itemLimit)) validationIssue("invalid_length", `${field}超過數量或長度限制`);
  return result;
}
function text(value: unknown, max: number, field = "文字欄位") {
  const result = String(value ?? "").trim();
  if (result.length > max) validationIssue("invalid_length", `${field}超過長度限制`);
  return result;
}
function url(value: unknown, field: string, max = 2000) {
  const result = text(value, max, field);
  if (result && !/^https?:\/\//i.test(result)) validationIssue("invalid_url", `${field}僅接受 http 或 https 網址`);
  return result;
}
function urls(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) validationIssue("invalid_portfolio_urls", "作品集網址最多 10 筆");
  return [...new Set(value.map((v) => url(v, "作品集網址")).filter(Boolean))];
}
function integer(value: unknown, field: string, nullable = true) {
  if ((value === "" || value === null || value === undefined) && nullable) return null;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0 || result > 100000000) validationIssue("invalid_number", `${field}必須是 0 到 100000000 的整數`);
  return result;
}
function validationError(ctx: RequestContext, error: unknown) {
  const code = error instanceof Error ? error.message : "invalid_input";
  const publicMessage = error && typeof error === "object" && "publicMessage" in error ? String((error as { publicMessage?: unknown }).publicMessage || "") : "";
  const messages: Record<string, string> = {
    invalid_length: "欄位長度超過限制", invalid_url: "網址僅接受 http 或 https", invalid_portfolio_urls: "作品集網址最多 10 筆", invalid_number: "數字欄位格式錯誤",
    agreements_unavailable: "規範資料暫時無法讀取", invalid_agreements: "規範同意項目包含不存在或未啟用的版本", roles_save_failed: "角色資料儲存失敗", provider_save_failed: "服務提供者資料儲存失敗",
    provider_services_save_failed: "提供服務關聯儲存失敗", partner_save_failed: "合作夥伴資料儲存失敗", seeker_save_failed: "資源需求資料儲存失敗",
    tags_save_failed: "標籤資料儲存失敗", agreements_save_failed: "規範同意紀錄儲存失敗", invalid_tags: "標籤選擇包含不存在或停用的項目",
    invalid_services: "提供服務包含不存在或不可用的項目", protected_provider: "內建服務者不可由會員角色流程修改",
  };
  return contractError(ctx.origin, 400, code, publicMessage || messages[code] || "輸入資料格式錯誤");
}

async function activeAgreements(db: any, roles?: string[]) {
  let query = db.schema("booking").from("agreements").select("agreement_id,agreement_key,version,title,body_md,applies_to_roles").eq("status", "active").order("agreement_key");
  if (roles?.length) query = query.overlaps("applies_to_roles", roles);
  return await query;
}

export async function getMyRoles(ctx: RequestContext) {
  const { db, origin, user } = ctx;
  const [{ data: roles, error: roleError }, { data: provider, error: providerError }, { data: partner, error: partnerError }, { data: seeker, error: seekerError }, { data: tags, error: tagsError }, { data: agreements, error: agreementError }, { data: records, error: recordsError }, { data: links, error: linksError }] = await Promise.all([
    db.schema("booking").from("member_roles").select("role_key,status").eq("user_id", user.id).order("role_key"),
    db.schema("booking").from("providers").select(PROVIDER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("partners").select(PARTNER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("seeker_profiles").select(SEEKER_FIELDS).eq("user_id", user.id).maybeSingle(),
    db.schema("booking").from("member_tags").select("tag_id").eq("user_id", user.id).eq("status", "active"),
    activeAgreements(db),
    db.schema("booking").from("member_agreements").select("agreement_id,status").eq("user_id", user.id).eq("status", "agreed"),
    db.schema("booking").from("service_providers").select("service_id,providers!inner(user_id)").eq("providers.user_id", user.id),
  ]);
  if (roleError || providerError || partnerError || seekerError || tagsError || agreementError || recordsError || linksError) {
    return contractError(origin, 500, "roles_unavailable", "角色資料暫時無法讀取");
  }
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
  const activeIds = new Set((data || []).map((row: any) => row.agreement_id));
  if (submittedIds.some((agreementId) => !activeIds.has(agreementId))) throw new Error("invalid_agreements");
  const required = (data || []).filter((row: any) => requiredKeys.includes(row.agreement_key));
  const submitted = new Set(submittedIds);
  const { data: existing, error: existingError } = await ctx.db.schema("booking").from("member_agreements").select("agreement_id").eq("user_id", ctx.user.id).eq("status", "agreed");
  if (existingError) throw new Error("agreements_unavailable");
  const agreed = new Set([...(existing || []).map((row: any) => row.agreement_id), ...submitted]);
  return { required, missing: required.filter((row: any) => !agreed.has(row.agreement_id)) };
}

function validateRoleProfiles(ctx: RequestContext, roles: string[]) {
  const { body } = ctx;
  let provider: Record<string, unknown> | null = null;
  let partner: Record<string, unknown> | null = null;
  let seeker: Record<string, unknown> | null = null;
  let serviceIds: string[] = [];
  if (roles.includes("provider")) {
    const input = body.provider || {};
    const entityType = String(input.entity_type || "individual");
    const serviceMode = String(input.service_mode || "both");
    const availability = String(input.availability_status || "available");
    if (!["individual", "brand", "store"].includes(entityType)) validationIssue("invalid_input", "身分型態不正確");
    if (!["online", "offline", "both"].includes(serviceMode)) validationIssue("invalid_input", "服務方式不正確");
    if (!["available", "partial", "paused", "internal_only", "standby"].includes(availability)) validationIssue("invalid_input", "目前接案狀態不正確");
    const brandName = text(input.brand_name || ctx.member.full_name || ctx.member.name, 120, "品牌／工作室名稱");
    if (!brandName) validationIssue("invalid_input", "品牌／工作室名稱不可空白");
    provider = {
      display_name: brandName, provider_type: entityType === "individual" ? "person" : "team", entity_type: entityType, brand_name: brandName,
      service_area: text(input.service_area, 500, "服務地區"), service_mode: serviceMode, website: url(input.website, "官方網站"),
      instagram: url(input.instagram, "Instagram"), facebook: url(input.facebook, "Facebook"), line: text(input.line, 200, "LINE"),
      portfolio_urls: urls(input.portfolio_urls || []), pricing_description: text(input.pricing_description, 2000, "價格說明"), quote_method: text(input.quote_method, 1000, "報價方式"),
      member_discount: text(input.member_discount, 1000, "會員優惠"), accept_projects: Boolean(input.accept_projects), accept_long_term: Boolean(input.accept_long_term),
      available_hours: text(input.available_hours, 1000, "可服務時段"), availability_status: availability,
    };
    serviceIds = strings(input.service_ids, 100, 80, "提供服務");
  }
  if (roles.includes("partner")) {
    const input = body.partner || {};
    const partnerTypes = strings(input.partner_types, 20, 40, "夥伴類型");
    const allowed = ["store", "brand", "supplier", "advertising", "cross_industry", "channel", "venue", "lecturer", "consultant", "other"];
    if (!partnerTypes.length) validationIssue("invalid_input", "夥伴類型至少選擇一項");
    if (partnerTypes.some((value) => !allowed.includes(value))) validationIssue("invalid_input", "夥伴類型包含不支援的選項");
    const organizationName = text(input.organization_name, 160, "單位／品牌名稱");
    if (!organizationName) validationIssue("invalid_input", "單位／品牌名稱不可空白");
    const rawSocial = typeof input.social_links === "object" && input.social_links && !Array.isArray(input.social_links) ? input.social_links as Record<string, unknown> : {};
    partner = {
      organization_name: organizationName, partner_types: partnerTypes, introduction: text(input.introduction, 4000, "合作夥伴簡介"), website: url(input.website, "合作夥伴官方網站"),
      social_links: { facebook: url(rawSocial.facebook, "合作夥伴 Facebook"), instagram: url(rawSocial.instagram, "合作夥伴 Instagram"), line: text(rawSocial.line, 200, "合作夥伴 LINE") },
      location: text(input.location, 300, "所在地點"), service_area: text(input.service_area, 500, "服務／合作地區"), resources: strings(input.resources, 50, 200, "可提供的資源"),
      cooperation_methods: strings(input.cooperation_methods, 50, 200, "合作方式"), cooperation_conditions: text(input.cooperation_conditions, 3000, "合作條件"),
      price_description: text(input.price_description, 2000, "合作價格說明"), member_discount: text(input.member_discount, 1000, "合作會員優惠"),
      advertising_interest: Boolean(input.advertising_interest), matching_interest: Boolean(input.matching_interest),
    };
  }
  if (roles.includes("resource_seeker")) {
    const input = body.seeker || {};
    const budgetMin = integer(input.budget_min, "預算下限");
    const budgetMax = integer(input.budget_max, "預算上限");
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) validationIssue("invalid_number", "預算下限不可高於預算上限");
    seeker = { looking_for: text(input.looking_for, 3000, "想找什麼"), need_categories: strings(input.need_categories, 50, 120, "需求類別"), budget_min: budgetMin, budget_max: budgetMax, region: text(input.region, 120, "需求地區"), timeline: text(input.timeline, 500, "時程"), cooperation_type: text(input.cooperation_type, 500, "合作型態"), is_public: Boolean(input.is_public), accept_matching: input.accept_matching !== false };
  }
  return { provider, partner, seeker, serviceIds };
}

export async function putMyRoles(ctx: RequestContext) {
  try {
    if (!Array.isArray(ctx.body.roles)) return contractError(ctx.origin, 400, "invalid_roles", "roles 必須是陣列");
    const roles = [...new Set(ctx.body.roles.map(String))];
    if (roles.some((role) => !ROLE_KEYS.includes(role as typeof ROLE_KEYS[number]))) return contractError(ctx.origin, 400, "invalid_roles", "包含不支援的角色");
    if (!roles.includes("member")) return contractError(ctx.origin, 400, "invalid_roles", "roles 必須包含一般會員 member");
    const submittedIds = strings(ctx.body.agree_agreement_ids, 100, 80, "規範同意項目");
    const tagIds = strings(ctx.body.tag_ids, 100, 80, "標籤");
    const profiles = validateRoleProfiles(ctx, roles);
    const { required, missing } = await validateAgreementSubmission(ctx, roles, submittedIds);
    if (missing.length) return contractError(ctx.origin, 400, "agreements_required", `尚未同意：${missing.map((row: any) => row.title).join("、")}`);

    const now = new Date().toISOString();
    const [{ data: existingRoles, error: existingError }, { data: existingProvider, error: providerLookupError }, { data: existingTags, error: existingTagsError }, tagCheck, serviceCheck] = await Promise.all([
      ctx.db.schema("booking").from("member_roles").select("role_key,status,applied_at,reviewed_at,reviewed_by,review_note").eq("user_id", ctx.user.id),
      ctx.db.schema("booking").from("providers").select("provider_id").eq("user_id", ctx.user.id).maybeSingle(),
      ctx.db.schema("booking").from("member_tags").select("tag_id,source").eq("user_id", ctx.user.id),
      tagIds.length ? ctx.db.schema("booking").from("tags").select("tag_id").in("tag_id", tagIds).eq("status", "active") : Promise.resolve({ data: [], error: null }),
      profiles.serviceIds.length ? ctx.db.schema("booking").from("services").select("service_id").in("service_id", profiles.serviceIds).in("service_status", ["active", "coming_soon"]) : Promise.resolve({ data: [], error: null }),
    ]);
    if (existingError) throw new Error("roles_save_failed");
    if (providerLookupError) throw new Error("provider_save_failed");
    if (existingTagsError) throw new Error("tags_save_failed");
    if (tagCheck.error || tagCheck.data?.length !== tagIds.length) throw new Error("invalid_tags");
    if (serviceCheck.error || serviceCheck.data?.length !== profiles.serviceIds.length) throw new Error("invalid_services");
    if (roles.includes("provider") && existingProvider?.provider_id === "PRV-MEIHAU") throw new Error("protected_provider");
    const existingMap = new Map((existingRoles || []).map((row: any) => [row.role_key, row]));
    const rows = ROLE_KEYS.map((roleKey) => ({
      ...(() => {
        const existing = existingMap.get(roleKey);
        const selected = roles.includes(roleKey);
        const preserveReview = selected && (existing?.status === "approved" || existing?.status === "pending");
        const status = selected ? (roleKey === "member" ? "approved" : (existing?.status === "approved" ? "approved" : "pending")) : "inactive";
        return {
          user_id: ctx.user.id, role_key: roleKey, status, applied_at: existing?.applied_at || now,
          reviewed_at: preserveReview ? (existing?.reviewed_at || null) : null,
          reviewed_by: preserveReview ? (existing?.reviewed_by || null) : null,
          review_note: preserveReview ? String(existing?.review_note || "") : "", updated_at: now,
        };
      })(),
    }));
    const { error: roleError } = await ctx.db.schema("booking").from("member_roles").upsert(rows, { onConflict: "user_id,role_key" });
    if (roleError) throw new Error("roles_save_failed");
    const statusByRole = new Map(rows.map((row) => [row.role_key, row.status]));
    const providerId = existingProvider?.provider_id || `PRV-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    if (profiles.provider) {
      const providerValues = { ...profiles.provider, user_id: ctx.user.id, approval_status: statusByRole.get("provider") === "approved" ? "approved" : "pending", updated_at: now };
      const { error } = existingProvider
        ? await ctx.db.schema("booking").from("providers").update(providerValues).eq("provider_id", providerId)
        : await ctx.db.schema("booking").from("providers").insert({ ...providerValues, provider_id: providerId, status: "hidden" });
      if (error) throw new Error("provider_save_failed");
      if (profiles.serviceIds.length) {
        const { error: linkError } = await ctx.db.schema("booking").from("service_providers").upsert(profiles.serviceIds.map((serviceId) => ({ service_id: serviceId, provider_id: providerId, status: "hidden" })), { onConflict: "service_id,provider_id", ignoreDuplicates: true });
        if (linkError) throw new Error("provider_services_save_failed");
      }
      const { data: currentLinks, error: linksError } = await ctx.db.schema("booking").from("service_providers").select("service_id").eq("provider_id", providerId);
      if (linksError) throw new Error("provider_services_save_failed");
      const removedServiceIds = (currentLinks || []).map((row: any) => row.service_id).filter((serviceId: string) => !profiles.serviceIds.includes(serviceId));
      if (removedServiceIds.length) {
        const { error: hideError } = await ctx.db.schema("booking").from("service_providers").update({ status: "hidden", updated_at: now }).eq("provider_id", providerId).in("service_id", removedServiceIds);
        if (hideError) throw new Error("provider_services_save_failed");
      }
    }
    if (profiles.partner) {
      const { error } = await ctx.db.schema("booking").from("partners").upsert({ ...profiles.partner, user_id: ctx.user.id, approval_status: statusByRole.get("partner") === "approved" ? "approved" : "pending", updated_at: now }, { onConflict: "user_id" });
      if (error) throw new Error("partner_save_failed");
    }
    if (profiles.seeker) {
      const { error } = await ctx.db.schema("booking").from("seeker_profiles").upsert({ ...profiles.seeker, user_id: ctx.user.id, approval_status: statusByRole.get("resource_seeker") === "approved" ? "approved" : "pending", updated_at: now }, { onConflict: "user_id" });
      if (error) throw new Error("seeker_save_failed");
    }
    if (!roles.includes("provider") && existingProvider?.provider_id !== "PRV-MEIHAU") {
      const { data: provider, error: providerError } = await ctx.db.schema("booking").from("providers").update({ status: "hidden", approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id).select("provider_id").maybeSingle();
      if (providerError) throw new Error("provider_save_failed");
      if (provider?.provider_id && provider.provider_id !== "PRV-MEIHAU") {
        const { error: linksError } = await ctx.db.schema("booking").from("service_providers").update({ status: "hidden", updated_at: now }).eq("provider_id", provider.provider_id);
        if (linksError) throw new Error("provider_services_save_failed");
      }
    }
    if (!roles.includes("partner")) {
      const { error } = await ctx.db.schema("booking").from("partners").update({ approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id);
      if (error) throw new Error("partner_save_failed");
    }
    if (!roles.includes("resource_seeker")) {
      const { error } = await ctx.db.schema("booking").from("seeker_profiles").update({ approval_status: "suspended", updated_at: now }).eq("user_id", ctx.user.id);
      if (error) throw new Error("seeker_save_failed");
    }
    const { error: deactivateTagsError } = await ctx.db.schema("booking").from("member_tags").update({ status: "inactive", updated_at: now }).eq("user_id", ctx.user.id).eq("source", "self").eq("status", "active");
    if (deactivateTagsError) throw new Error("tags_save_failed");
    const adminTagIds = new Set((existingTags || []).filter((row: any) => row.source === "admin").map((row: any) => String(row.tag_id)));
    const selfTagIds = tagIds.filter((tagId) => !adminTagIds.has(tagId));
    if (selfTagIds.length) {
      const { error } = await ctx.db.schema("booking").from("member_tags").upsert(selfTagIds.map((tagId) => ({ user_id: ctx.user.id, tag_id: tagId, source: "self", status: "active", updated_at: now })), { onConflict: "user_id,tag_id" });
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
