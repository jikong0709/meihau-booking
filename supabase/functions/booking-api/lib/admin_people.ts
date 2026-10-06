import type { RequestContext } from "./auth.ts";
import { requireDeveloper } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const TAG_TYPES = ["identity", "skill", "service", "project_type", "cooperation_type", "resource_type", "region"];
const AGREEMENT_KEYS = ["member_terms", "provider_rules", "partner_rules", "seeker_rules", "matching_rules", "payment_rules"];
const ROLE_KEYS = ["member", "provider", "partner", "resource_seeker"];

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}
function uniqueIds(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))].slice(0, 100) : [];
}

async function loadAll(makeQuery: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const rows: any[] = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await makeQuery(from, from + 999);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

export async function adminPeople(ctx: RequestContext) {
  const page = Math.max(1, Number(ctx.url.searchParams.get("page")) || 1);
  const q = String(ctx.url.searchParams.get("q") || "").trim().slice(0, 160).toLowerCase();
  const roleKey = ctx.url.searchParams.get("role_key");
  const roleStatus = ctx.url.searchParams.get("role_status");
  const tagId = ctx.url.searchParams.get("tag_id");
  const multiRole = ctx.url.searchParams.get("multi_role") === "1";
  const [{ data: members, error }, { data: roles, error: rolesError }, { data: memberTags, error: tagsError }] = await Promise.all([
    loadAll((from, to) => ctx.db.schema("booking").from("members").select("user_id,name,full_name,email,phone,role,account_status,admin_note,created_at").order("created_at", { ascending: false }).order("user_id").range(from, to)),
    loadAll((from, to) => ctx.db.schema("booking").from("member_roles").select("user_id,role_key,status").order("user_id").order("role_key").range(from, to)),
    loadAll((from, to) => ctx.db.schema("booking").from("member_tags").select("user_id,tag_id,tags!inner(name,tag_type)").eq("status", "active").order("user_id").order("tag_id").range(from, to)),
  ]);
  if (error || rolesError || tagsError) return contractError(ctx.origin, 400, "people_unavailable", "會員列表暫時無法讀取");
  const rolesByUser = new Map<string, any[]>();
  for (const row of roles || []) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) || []), { role_key: row.role_key, status: row.status }]);
  const tagsByUser = new Map<string, any[]>();
  for (const row of memberTags || []) tagsByUser.set(row.user_id, [...(tagsByUser.get(row.user_id) || []), { tag_id: row.tag_id, name: row.tags.name, tag_type: row.tags.tag_type }]);
  let items = (members || []).map((member: any) => ({ ...member, partner_roles: rolesByUser.get(member.user_id) || [], tags: tagsByUser.get(member.user_id) || [] }));
  if (q) items = items.filter((item: any) => [item.name, item.full_name, item.email, item.phone].some((value) => String(value || "").toLowerCase().includes(q)));
  if (roleKey) items = items.filter((item: any) => item.partner_roles.some((role: any) => role.role_key === roleKey && (!roleStatus || role.status === roleStatus)));
  else if (roleStatus) items = items.filter((item: any) => item.partner_roles.some((role: any) => role.status === roleStatus));
  if (tagId) items = items.filter((item: any) => item.tags.some((tag: any) => tag.tag_id === tagId));
  if (multiRole) items = items.filter((item: any) => item.partner_roles.filter((role: any) => role.status !== "inactive").length > 1);
  const total = items.length;
  return reply(ctx.origin, 200, { items: items.slice((page - 1) * 50, page * 50), total, page, page_size: 50 });
}

export async function adminPersonGet(ctx: RequestContext) {
  const userId = String(ctx.url.searchParams.get("user_id") || "");
  if (!userId) return contractError(ctx.origin, 400, "user_id_required", "缺少 user_id");
  const [{ data: member }, { data: roles }, { data: provider }, { data: partner }, { data: seeker }, { data: tags }, { data: agreementRecords }] = await Promise.all([
    ctx.db.schema("booking").from("members").select("*").eq("user_id", userId).maybeSingle(),
    ctx.db.schema("booking").from("member_roles").select("*").eq("user_id", userId),
    ctx.db.schema("booking").from("providers").select("*").eq("user_id", userId).maybeSingle(),
    ctx.db.schema("booking").from("partners").select("*").eq("user_id", userId).maybeSingle(),
    ctx.db.schema("booking").from("seeker_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ctx.db.schema("booking").from("member_tags").select("tag_id,source,status,tags!inner(name,tag_type,slug)").eq("user_id", userId).eq("status", "active"),
    ctx.db.schema("booking").from("member_agreements").select("agreement_key,agreement_version,agreed_at,status").eq("user_id", userId).order("agreed_at", { ascending: false }),
  ]);
  return member ? reply(ctx.origin, 200, { member, roles: roles || [], provider, partner, seeker, tags: tags || [], agreement_records: agreementRecords || [] }) : contractError(ctx.origin, 404, "person_not_found", "找不到會員");
}

export async function adminPersonPatch(ctx: RequestContext) {
  const userId = String(ctx.body.user_id || "");
  if (!userId) return contractError(ctx.origin, 400, "user_id_required", "缺少 user_id");
  const now = new Date().toISOString();
  const addIds = uniqueIds(ctx.body.add_tag_ids); const removeIds = uniqueIds(ctx.body.remove_tag_ids);
  if (addIds.length) {
    const { data: valid, error: validError } = await ctx.db.schema("booking").from("tags").select("tag_id").in("tag_id", addIds).eq("status", "active");
    if (validError || valid?.length !== addIds.length) return contractError(ctx.origin, 400, "invalid_tags", "包含不存在或停用的標籤");
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("admin_note" in ctx.body) patch.admin_note = String(ctx.body.admin_note || "").slice(0, 4000);
  if ("account_status" in ctx.body) {
    if (!["active", "suspended"].includes(String(ctx.body.account_status))) return contractError(ctx.origin, 400, "invalid_account_status", "帳號狀態不正確");
    const { data: target, error: targetError } = await ctx.db.schema("booking").from("members").select("role").eq("user_id", userId).maybeSingle();
    if (targetError) return contractError(ctx.origin, 400, "person_unavailable", "會員資料暫時無法讀取");
    if (!target) return contractError(ctx.origin, 404, "person_not_found", "找不到會員");
    if (target.role === "developer" && ctx.member.role !== "developer") return contractError(ctx.origin, 403, "developer_protected", "Admin 不可變更 Developer 帳號狀態");
    patch.account_status = ctx.body.account_status;
  }
  const { data, error } = await ctx.db.schema("booking").from("members").update(patch).eq("user_id", userId).select("*").maybeSingle();
  if (error) return contractError(ctx.origin, 400, "person_save_failed", "會員資料更新失敗");
  if (!data) return contractError(ctx.origin, 404, "person_not_found", "找不到會員");
  if (removeIds.length) {
    const { error: removeError } = await ctx.db.schema("booking").from("member_tags").update({ status: "inactive", updated_at: now }).eq("user_id", userId).in("tag_id", removeIds);
    if (removeError) return contractError(ctx.origin, 400, "tags_save_failed", "標籤更新失敗");
  }
  if (addIds.length) {
    const { error: tagError } = await ctx.db.schema("booking").from("member_tags").upsert(addIds.map((tagId) => ({ user_id: userId, tag_id: tagId, source: "admin", status: "active", updated_at: now })), { onConflict: "user_id,tag_id" });
    if (tagError) return contractError(ctx.origin, 400, "tags_save_failed", "標籤更新失敗");
  }
  return reply(ctx.origin, 200, data);
}

export async function adminRoleReview(ctx: RequestContext) {
  const userId = String(ctx.body.user_id || ""); const roleKey = String(ctx.body.role_key || ""); const decision = String(ctx.body.decision || "");
  if (!userId || !ROLE_KEYS.includes(roleKey) || !["approved", "rejected", "inactive"].includes(decision)) return contractError(ctx.origin, 400, "invalid_role_review", "角色審核資料不正確");
  const profileTables: Record<string, string> = { provider: "providers", partner: "partners", resource_seeker: "seeker_profiles" };
  const profileTable = profileTables[roleKey];
  if (profileTable) {
    const { data: profile, error: profileError } = await ctx.db.schema("booking").from(profileTable).select("user_id").eq("user_id", userId).maybeSingle();
    if (profileError) return contractError(ctx.origin, 400, "role_profile_unavailable", "角色資料暫時無法讀取");
    if (!profile) return contractError(ctx.origin, 400, "role_profile_missing", "角色資料尚未建立，無法進行審核");
  }
  const now = new Date().toISOString();
  const { data, error } = await ctx.db.schema("booking").from("member_roles").update({ status: decision, review_note: String(ctx.body.review_note || "").slice(0, 2000), reviewed_at: now, reviewed_by: ctx.user.id, updated_at: now }).eq("user_id", userId).eq("role_key", roleKey).select("*").maybeSingle();
  if (error || !data) return contractError(ctx.origin, 404, "role_not_found", "找不到角色申請");
  const profileStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "suspended";
  if (roleKey === "provider") {
    const providerPatch: Record<string, unknown> = { approval_status: profileStatus, updated_at: now };
    if (decision !== "approved") providerPatch.status = "hidden";
    const { data: provider, error: providerError } = await ctx.db.schema("booking").from("providers").update(providerPatch).eq("user_id", userId).select("provider_id").maybeSingle();
    if (providerError || !provider) return contractError(ctx.origin, 400, "role_profile_sync_failed", "服務提供者審核狀態同步失敗");
    if (provider && decision !== "approved") {
      const { error: linksError } = await ctx.db.schema("booking").from("service_providers").update({ status: "hidden", updated_at: now }).eq("provider_id", provider.provider_id);
      if (linksError) return contractError(ctx.origin, 400, "role_profile_sync_failed", "提供服務狀態同步失敗");
    }
  }
  if (roleKey === "partner") {
    const { data: partner, error: partnerError } = await ctx.db.schema("booking").from("partners").update({ approval_status: profileStatus, updated_at: now }).eq("user_id", userId).select("partner_id").maybeSingle();
    if (partnerError || !partner) return contractError(ctx.origin, 400, "role_profile_sync_failed", "合作夥伴審核狀態同步失敗");
  }
  if (roleKey === "resource_seeker") {
    const { data: seeker, error: seekerError } = await ctx.db.schema("booking").from("seeker_profiles").update({ approval_status: profileStatus, updated_at: now }).eq("user_id", userId).select("user_id").maybeSingle();
    if (seekerError || !seeker) return contractError(ctx.origin, 400, "role_profile_sync_failed", "資源需求者審核狀態同步失敗");
  }
  return reply(ctx.origin, 200, data);
}

export async function adminTags(ctx: RequestContext, method: string) {
  if (method === "GET") {
    const { data, error } = await ctx.db.schema("booking").from("tags").select("*").order("tag_type").order("sort_order");
    return error ? contractError(ctx.origin, 400, "tags_unavailable", "標籤暫時無法讀取") : reply(ctx.origin, 200, { tags: data });
  }
  if (method === "POST") {
    const tagType = String(ctx.body.tag_type || ""); const name = String(ctx.body.name || "").trim().slice(0, 120); const slug = slugify(String(ctx.body.slug || name));
    if (!TAG_TYPES.includes(tagType) || !name || !slug) return contractError(ctx.origin, 400, "invalid_tag", "標籤資料不正確");
    const { data, error } = await ctx.db.schema("booking").from("tags").insert({ tag_type: tagType, name, slug }).select("*").single();
    return error ? contractError(ctx.origin, 400, "tag_save_failed", "標籤新增失敗") : reply(ctx.origin, 201, data);
  }
  const tagId = String(ctx.body.tag_id || ""); const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in ctx.body) {
    const name = String(ctx.body.name || "").trim().slice(0, 120);
    if (!name) return contractError(ctx.origin, 400, "invalid_tag", "標籤名稱不可空白");
    patch.name = name;
  }
  if ("status" in ctx.body) { if (!["active", "hidden", "archived"].includes(String(ctx.body.status))) return contractError(ctx.origin, 400, "invalid_tag", "標籤狀態不正確"); patch.status = ctx.body.status; }
  if ("sort_order" in ctx.body) { const value = Number(ctx.body.sort_order); if (!Number.isInteger(value)) return contractError(ctx.origin, 400, "invalid_tag", "排序值不正確"); patch.sort_order = value; }
  const { data, error } = await ctx.db.schema("booking").from("tags").update(patch).eq("tag_id", tagId).select("*").maybeSingle();
  return error || !data ? contractError(ctx.origin, 404, "tag_not_found", "找不到標籤") : reply(ctx.origin, 200, data);
}

export async function adminAgreements(ctx: RequestContext, method: string) {
  if (method === "GET") {
    const { data, error } = await ctx.db.schema("booking").from("agreements").select("*").order("agreement_key").order("version", { ascending: false });
    return error ? contractError(ctx.origin, 400, "agreements_unavailable", "規範暫時無法讀取") : reply(ctx.origin, 200, { agreements: data });
  }
  if (method === "POST") {
    const key = String(ctx.body.agreement_key || ""); const title = String(ctx.body.title || "").trim().slice(0, 200); const bodyMd = String(ctx.body.body_md || ""); const roles = uniqueIds(ctx.body.applies_to_roles);
    if (!AGREEMENT_KEYS.includes(key) || !title || !bodyMd || roles.some((role) => !ROLE_KEYS.includes(role))) return contractError(ctx.origin, 400, "invalid_agreement", "規範資料不正確");
    const { data: current } = await ctx.db.schema("booking").from("agreements").select("version").eq("agreement_key", key).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await ctx.db.schema("booking").from("agreements").insert({ agreement_key: key, version: (current?.version || 0) + 1, title, body_md: bodyMd, applies_to_roles: roles, status: "draft" }).select("*").single();
    return error ? contractError(ctx.origin, 400, "agreement_save_failed", "規範新增失敗") : reply(ctx.origin, 201, data);
  }
  const agreementId = String(ctx.body.agreement_id || "");
  const { data: target, error: targetError } = await ctx.db.schema("booking").from("agreements").select("*").eq("agreement_id", agreementId).maybeSingle();
  if (targetError) return contractError(ctx.origin, 400, "agreements_unavailable", "規範資料暫時無法讀取");
  if (!target) return contractError(ctx.origin, 404, "agreement_not_found", "找不到規範");
  if (ctx.body.action === "publish") {
    if (target.status !== "draft") return contractError(ctx.origin, 400, "agreement_publish_failed", "僅草稿可發布");
    const now = new Date().toISOString();
    const { data: draft, error: draftError } = await ctx.db.schema("booking").from("agreements").select("agreement_id").eq("agreement_id", agreementId).eq("status", "draft").maybeSingle();
    if (draftError || !draft) return contractError(ctx.origin, 400, "agreement_publish_failed", "新版規範草稿不存在或不可發布");
    const { data: oldActive, error: oldActiveError } = await ctx.db.schema("booking").from("agreements").select("agreement_id").eq("agreement_key", target.agreement_key).eq("status", "active").neq("agreement_id", agreementId);
    if (oldActiveError) return contractError(ctx.origin, 400, "agreement_publish_failed", "舊版規範讀取失敗");
    const oldIds = (oldActive || []).map((row: any) => row.agreement_id);
    if (oldIds.length) {
      const { error: retireError } = await ctx.db.schema("booking").from("agreements").update({ status: "retired", updated_at: now }).in("agreement_id", oldIds);
      if (retireError) return contractError(ctx.origin, 400, "agreement_publish_failed", "舊版規範退役失敗");
    }
    const { data, error } = await ctx.db.schema("booking").from("agreements").update({ status: "active", published_at: now, updated_at: now }).eq("agreement_id", agreementId).eq("status", "draft").select("*").maybeSingle();
    if (error || !data) {
      let restoreError = null;
      if (oldIds.length) {
        const restored = await ctx.db.schema("booking").from("agreements").update({ status: "active", updated_at: new Date().toISOString() }).in("agreement_id", oldIds);
        restoreError = restored.error;
      }
      const message = restoreError
        ? "新版規範啟用失敗，且舊版規範恢復失敗"
        : oldIds.length ? "新版規範啟用失敗，舊版規範已恢復" : "新版規範啟用失敗";
      return contractError(ctx.origin, 400, "agreement_publish_failed", message);
    }
    if (oldIds.length) {
      const { error: supersedeError } = await ctx.db.schema("booking").from("member_agreements").update({ status: "superseded", updated_at: now }).in("agreement_id", oldIds).eq("status", "agreed");
      if (supersedeError) return contractError(ctx.origin, 400, "agreement_publish_failed", "舊版同意紀錄更新失敗");
    }
    return reply(ctx.origin, 200, data);
  }
  if (target.status !== "draft") return contractError(ctx.origin, 400, "agreement_not_draft", "僅草稿可編輯");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title" in ctx.body) patch.title = String(ctx.body.title || "").trim().slice(0, 200);
  if ("body_md" in ctx.body) patch.body_md = String(ctx.body.body_md || "");
  const { data, error } = await ctx.db.schema("booking").from("agreements").update(patch).eq("agreement_id", agreementId).select("*").single();
  return error ? contractError(ctx.origin, 400, "agreement_save_failed", "規範更新失敗") : reply(ctx.origin, 200, data);
}

export async function adminAgreementRecords(ctx: RequestContext) {
  let query = ctx.db.schema("booking").from("member_agreements").select("*").order("agreed_at", { ascending: false });
  const agreementKey = ctx.url.searchParams.get("agreement_key"); const userId = ctx.url.searchParams.get("user_id");
  if (agreementKey) query = query.eq("agreement_key", agreementKey);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  return error ? contractError(ctx.origin, 400, "agreement_records_unavailable", "同意紀錄暫時無法讀取") : reply(ctx.origin, 200, { items: data });
}

export async function adminSystemRole(ctx: RequestContext) {
  const denied = requireDeveloper(ctx); if (denied) return denied;
  const userId = String(ctx.body.user_id || ""); const role = String(ctx.body.role || "");
  if (!userId || !["admin", "member"].includes(role)) return contractError(ctx.origin, 400, "invalid_system_role", "系統權限只可設定 admin 或 member");
  const { data: target } = await ctx.db.schema("booking").from("members").select("user_id,role").eq("user_id", userId).maybeSingle();
  if (!target) return contractError(ctx.origin, 404, "person_not_found", "找不到會員");
  if (target.role === "developer") return contractError(ctx.origin, 403, "developer_protected", "不可變更 developer 權限");
  const { data, error } = await ctx.db.schema("booking").from("members").update({ role, updated_at: new Date().toISOString() }).eq("user_id", userId).select("user_id,role").single();
  return error ? contractError(ctx.origin, 400, "system_role_save_failed", "系統權限更新失敗") : reply(ctx.origin, 200, data);
}
