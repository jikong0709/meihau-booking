import type { RequestContext } from "./auth.ts";
import { contractError, reply } from "./http.ts";

const TAG_APPLICATION_FIELDS = "application_id,proposed_name,purpose,service_description,qualification_summary,evidence_urls,status,matched_tag_id,review_note,reviewed_at,created_at,updated_at";
const VERIFICATION_FIELDS = "verification_id,user_id,tag_id,rule_id,rule_version,status,submitted_at,verified_at,expires_at,review_note_public,revoked_at,revoked_reason,created_at,updated_at";
const ADMIN_VERIFICATION_FIELDS = `${VERIFICATION_FIELDS},reviewed_by,review_note_private`;
const EVIDENCE_FIELDS = "evidence_id,verification_id,rule_id,requirement_id,text_value,url_value,certificate_name,issuer_name,certificate_number_masked,issued_on,created_at,updated_at";

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

function httpUrl(value: unknown, field: string) {
  const result = text(value, 2000, field);
  if (!result) return "";
  let parsed: URL;
  try { parsed = new URL(result); } catch { return fail("invalid_url", `${field}僅接受 http 或 https 網址`); }
  if (!["http:", "https:"].includes(parsed.protocol)) fail("invalid_url", `${field}僅接受 http 或 https 網址`);
  return parsed.toString();
}

function urls(value: unknown) {
  if (!Array.isArray(value) || value.length > 10) fail("invalid_input", "驗證網址最多 10 筆");
  return [...new Set(value.map((item) => httpUrl(item, "驗證網址")).filter(Boolean))];
}

function apiError(ctx: RequestContext, error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : "invalid_input";
  const message = error && typeof error === "object" && "publicMessage" in error
    ? String((error as { publicMessage?: unknown }).publicMessage || fallback)
    : fallback;
  return contractError(ctx.origin, code === "not_found" ? 404 : 400, code, message);
}

async function readEvidence(ctx: RequestContext, verificationIds: string[]) {
  if (!verificationIds.length) return { data: [], error: null };
  return await ctx.db.schema("booking").from("member_identity_evidence")
    .select(EVIDENCE_FIELDS).in("verification_id", verificationIds).order("created_at");
}

async function validateRuleAndEvidence(ctx: RequestContext, ruleId: string, tagId: string, rawEvidence: unknown, requireComplete: boolean) {
  const { data: rule, error: ruleError } = await ctx.db.schema("booking").from("identity_verification_rules")
    .select("rule_id,tag_id,version,status,valid_days").eq("rule_id", ruleId).eq("tag_id", tagId).eq("status", "active").maybeSingle();
  if (ruleError || !rule) fail("invalid_rule", "認證規則不存在或已停用");
  const { data: requirements, error } = await ctx.db.schema("booking").from("identity_verification_requirements")
    .select("requirement_id,evidence_type,is_required").eq("rule_id", ruleId);
  if (error) fail("requirements_unavailable", "認證要求暫時無法讀取");
  if (!Array.isArray(rawEvidence)) fail("invalid_evidence", "evidence 必須是陣列");
  const byId = new Map<string, any>((requirements || []).map((row: any) => [String(row.requirement_id), row]));
  const seen = new Set<string>();
  const rows = rawEvidence.map((raw: any) => {
    const requirementId = id(raw?.requirement_id, "requirement_id");
    const requirement = byId.get(requirementId);
    if (!requirement || seen.has(requirementId)) fail("invalid_evidence", "認證資料含有重複或不屬於本規則的項目");
    seen.add(requirementId);
    const row = {
      requirement_id: requirementId,
      text_value: requirement.evidence_type === "text" ? text(raw?.text_value, 4000, "文字資料") : "",
      url_value: requirement.evidence_type === "url" ? httpUrl(raw?.url_value, "證明網址") : "",
      certificate_name: requirement.evidence_type === "certificate" ? text(raw?.certificate_name, 300, "證書名稱") : "",
      issuer_name: requirement.evidence_type === "certificate" ? text(raw?.issuer_name, 300, "核發單位") : "",
      certificate_number_masked: requirement.evidence_type === "certificate" ? text(raw?.certificate_number_masked, 120, "證書編號") : "",
      issued_on: requirement.evidence_type === "certificate" && raw?.issued_on ? String(raw.issued_on) : null,
    };
    if (row.issued_on && !/^\d{4}-\d{2}-\d{2}$/.test(row.issued_on)) fail("invalid_evidence", "核發日期格式不正確");
    const hasValue = requirement.evidence_type === "url" ? Boolean(row.url_value)
      : requirement.evidence_type === "certificate" ? Boolean(row.certificate_name && row.issuer_name)
      : Boolean(row.text_value);
    if (!hasValue) fail("invalid_evidence", "已填寫的認證項目內容不完整");
    if (requireComplete && requirement.is_required && !hasValue) fail("missing_evidence", "尚有必填認證資料未完成");
    return { ...row, rule_id: ruleId };
  });
  const missing = (requirements || []).some((requirement: any) => requirement.is_required && !seen.has(String(requirement.requirement_id)));
  if (requireComplete && missing) fail("missing_evidence", "尚有必填認證資料未完成");
  return { rule, rows };
}

export async function handleIdentityMember(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  try {
    if (action === "identity-tag-applications") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("identity_tag_applications")
          .select(TAG_APPLICATION_FIELDS).eq("user_id", ctx.user.id).order("created_at", { ascending: false });
        return error ? contractError(ctx.origin, 400, "tag_applications_unavailable", "身份標籤申請暫時無法讀取") : reply(ctx.origin, 200, { applications: data || [] });
      }
      if (method === "POST") {
        const values = {
          user_id: ctx.user.id,
          proposed_name: text(ctx.body.proposed_name, 120, "身份名稱", true),
          purpose: text(ctx.body.purpose, 1000, "用途", true),
          service_description: text(ctx.body.service_description, 3000, "服務說明"),
          qualification_summary: text(ctx.body.qualification_summary, 3000, "資格摘要"),
          evidence_urls: urls(ctx.body.evidence_urls || []), status: "pending",
        };
        const { data, error } = await ctx.db.schema("booking").from("identity_tag_applications").insert(values).select(TAG_APPLICATION_FIELDS).single();
        return error ? contractError(ctx.origin, 400, "tag_application_failed", "身份標籤申請送出失敗") : reply(ctx.origin, 201, { application: data });
      }
    }

    if (action === "identity-verification-rules" && method === "GET") {
      const tagId = id(ctx.url.searchParams.get("tag_id"), "tag_id");
      const { data: rules, error } = await ctx.db.schema("booking").from("identity_verification_rules")
        .select("rule_id,tag_id,version,title,description,requires_manual_review,valid_days,special_legal_notice,published_at")
        .eq("tag_id", tagId).eq("status", "active").order("version", { ascending: false });
      if (error) return contractError(ctx.origin, 400, "verification_rules_unavailable", "認證規則暫時無法讀取");
      const ruleIds = (rules || []).map((row: any) => row.rule_id);
      const requirements = ruleIds.length
        ? await ctx.db.schema("booking").from("identity_verification_requirements")
          .select("requirement_id,rule_id,requirement_key,label,evidence_type,is_required,is_public_result,sort_order,instructions,config")
          .in("rule_id", ruleIds).order("sort_order")
        : { data: [], error: null };
      return requirements.error ? contractError(ctx.origin, 400, "verification_rules_unavailable", "認證規則暫時無法讀取") : reply(ctx.origin, 200, { rules: rules || [], requirements: requirements.data || [] });
    }

    if (action === "my-identity-verifications") {
      if (method === "GET") {
        const { data, error } = await ctx.db.schema("booking").from("member_identity_verifications")
          .select(VERIFICATION_FIELDS).eq("user_id", ctx.user.id).order("created_at", { ascending: false });
        if (error) return contractError(ctx.origin, 400, "verifications_unavailable", "認證資料暫時無法讀取");
        const evidence = await readEvidence(ctx, (data || []).map((row: any) => row.verification_id));
        return evidence.error ? contractError(ctx.origin, 400, "verifications_unavailable", "認證資料暫時無法讀取") : reply(ctx.origin, 200, { verifications: data || [], evidence: evidence.data || [] });
      }
      if (method === "POST") {
        const tagId = id(ctx.body.tag_id, "tag_id");
        const ruleId = id(ctx.body.rule_id, "rule_id");
        const status = ctx.body.submit === true ? "pending" : "draft";
        const { rule, rows } = await validateRuleAndEvidence(ctx, ruleId, tagId, ctx.body.evidence || [], status === "pending");
        const now = new Date().toISOString();
        const { data, error } = await ctx.db.schema("booking").from("member_identity_verifications").insert({
          user_id: ctx.user.id, tag_id: tagId, rule_id: ruleId, rule_version: rule.version, status,
          submitted_at: status === "pending" ? now : null,
        }).select(VERIFICATION_FIELDS).single();
        if (error || !data) return contractError(ctx.origin, 400, "verification_create_failed", "認證申請建立失敗");
        if (rows.length) {
          const { error: evidenceError } = await ctx.db.schema("booking").from("member_identity_evidence")
            .insert(rows.map((row) => ({ ...row, verification_id: data.verification_id })));
          if (evidenceError) {
            await ctx.db.schema("booking").from("member_identity_verifications").update({ status: "draft" }).eq("verification_id", data.verification_id).eq("user_id", ctx.user.id);
            return contractError(ctx.origin, 400, "evidence_save_failed", "認證資料儲存失敗，申請已保留為草稿");
          }
        }
        return reply(ctx.origin, 201, { verification: data });
      }
      if (method === "PATCH") {
        const verificationId = id(ctx.body.verification_id, "verification_id");
        const { data: current, error } = await ctx.db.schema("booking").from("member_identity_verifications")
          .select("verification_id,tag_id,rule_id,status").eq("verification_id", verificationId).eq("user_id", ctx.user.id).maybeSingle();
        if (error || !current) fail("not_found", "找不到認證申請");
        if (!["draft", "rejected"].includes(current.status)) fail("invalid_transition", "目前狀態不可由會員修改");
        const submit = ctx.body.submit === true;
        const { rows } = await validateRuleAndEvidence(ctx, current.rule_id, current.tag_id, ctx.body.evidence || [], submit);
        if (rows.length) {
          const { error: evidenceError } = await ctx.db.schema("booking").from("member_identity_evidence")
            .upsert(rows.map((row) => ({ ...row, verification_id: verificationId })), { onConflict: "verification_id,requirement_id" });
          if (evidenceError) return contractError(ctx.origin, 400, "evidence_save_failed", "認證資料儲存失敗");
        }
        const patch = { status: submit ? "pending" : "draft", submitted_at: submit ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
        const { data, error: updateError } = await ctx.db.schema("booking").from("member_identity_verifications")
          .update(patch).eq("verification_id", verificationId).eq("user_id", ctx.user.id).in("status", ["draft", "rejected"]).select(VERIFICATION_FIELDS).maybeSingle();
        return updateError || !data ? contractError(ctx.origin, 409, "verification_update_failed", "認證申請已變更，請重新讀取") : reply(ctx.origin, 200, { verification: data });
      }
    }
    return null;
  } catch (error) { return apiError(ctx, error, "輸入資料格式不正確"); }
}

export async function handleIdentityAdmin(ctx: RequestContext, action: string, method: string): Promise<Response | null> {
  try {
    if (action === "admin-identity-tag-applications") {
      if (method === "GET") {
        let query = ctx.db.schema("booking").from("identity_tag_applications").select(`${TAG_APPLICATION_FIELDS},user_id`).order("created_at", { ascending: false });
        const status = ctx.url.searchParams.get("status");
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        return error ? contractError(ctx.origin, 400, "tag_applications_unavailable", "身份標籤申請暫時無法讀取") : reply(ctx.origin, 200, { applications: data || [] });
      }
      if (method === "PATCH") {
        const applicationId = id(ctx.body.application_id, "application_id");
        const status = String(ctx.body.status || "");
        if (!["approved", "rejected"].includes(status)) fail("invalid_transition", "只能核准或駁回待審申請");
        const { data: application, error } = await ctx.db.schema("booking").from("identity_tag_applications")
          .select("application_id,proposed_name,status").eq("application_id", applicationId).eq("status", "pending").maybeSingle();
        if (error || !application) fail("not_found", "找不到待審申請");
        let matchedTagId: string | null = null;
        let createdTagId: string | null = null;
        if (status === "approved") {
          if (ctx.body.matched_tag_id) {
            matchedTagId = id(ctx.body.matched_tag_id, "matched_tag_id");
            const { data: tag } = await ctx.db.schema("booking").from("tags").select("tag_id").eq("tag_id", matchedTagId).eq("tag_type", "identity").eq("status", "active").maybeSingle();
            if (!tag) fail("invalid_tag", "指定的身份標籤不存在");
          } else {
            const slug = text(ctx.body.slug, 120, "slug", true).toLowerCase();
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("invalid_slug", "slug 只能使用小寫英數字與連字號");
            const { data: tag, error: tagError } = await ctx.db.schema("booking").from("tags")
              .insert({ tag_type: "identity", name: application.proposed_name, slug }).select("tag_id").single();
            if (tagError || !tag) return contractError(ctx.origin, 409, "tag_create_failed", "標籤名稱或 slug 可能已存在");
            matchedTagId = tag.tag_id;
            createdTagId = tag.tag_id;
          }
        }
        const { data, error: updateError } = await ctx.db.schema("booking").from("identity_tag_applications").update({
          status, matched_tag_id: matchedTagId, review_note: text(ctx.body.review_note, 2000, "審核備註"),
          reviewed_by: ctx.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("application_id", applicationId).eq("status", "pending").select(`${TAG_APPLICATION_FIELDS},user_id`).maybeSingle();
        if (updateError || !data) {
          if (createdTagId) await ctx.db.schema("booking").from("tags").update({ status: "hidden", updated_at: new Date().toISOString() }).eq("tag_id", createdTagId);
          return contractError(ctx.origin, 409, "tag_application_update_failed", "申請狀態已變更，請重新讀取");
        }
        return reply(ctx.origin, 200, { application: data });
      }
    }

    if (action === "admin-verification-rules") {
      if (method === "GET") {
        const [{ data: rules, error }, { data: requirements, error: requirementError }] = await Promise.all([
          ctx.db.schema("booking").from("identity_verification_rules").select("*").order("created_at", { ascending: false }),
          ctx.db.schema("booking").from("identity_verification_requirements").select("*").order("sort_order"),
        ]);
        return error || requirementError ? contractError(ctx.origin, 400, "verification_rules_unavailable", "認證規則暫時無法讀取") : reply(ctx.origin, 200, { rules: rules || [], requirements: requirements || [] });
      }
      if (method === "POST") {
        const tagId = id(ctx.body.tag_id, "tag_id");
        const { data: identityTag } = await ctx.db.schema("booking").from("tags").select("tag_id").eq("tag_id", tagId).eq("tag_type", "identity").eq("status", "active").maybeSingle();
        if (!identityTag) fail("invalid_tag", "指定的身份標籤不存在");
        const version = Number(ctx.body.version);
        if (!Number.isInteger(version) || version < 1) fail("invalid_version", "規則版本必須是正整數");
        const validDays = ctx.body.valid_days === null || ctx.body.valid_days === "" || ctx.body.valid_days === undefined ? null : Number(ctx.body.valid_days);
        if (validDays !== null && (!Number.isInteger(validDays) || validDays < 1 || validDays > 36500)) fail("invalid_valid_days", "有效天數格式不正確");
        const requirements = Array.isArray(ctx.body.requirements) ? ctx.body.requirements : [];
        if (!requirements.length || requirements.length > 50) fail("invalid_requirements", "認證要求必須有 1 至 50 項");
        const allowedEvidence = new Set(["text", "url", "certificate"]);
        const requirementTemplates = requirements.map((raw: any, index: number) => {
          const evidenceType = String(raw?.evidence_type || "");
          if (!allowedEvidence.has(evidenceType)) fail("invalid_requirements", "認證資料類型不正確");
          const requirementKey = text(raw?.requirement_key, 80, "requirement_key", true);
          if (!/^[a-z][a-z0-9_]{0,79}$/.test(requirementKey)) fail("invalid_requirements", "requirement_key 格式不正確");
          return { requirement_key: requirementKey, label: text(raw?.label, 200, "欄位名稱", true), evidence_type: evidenceType, is_required: raw?.is_required !== false, is_public_result: raw?.is_public_result === true, sort_order: Number.isInteger(raw?.sort_order) ? raw.sort_order : index, instructions: text(raw?.instructions, 2000, "填寫說明"), config: raw?.config && typeof raw.config === "object" && !Array.isArray(raw.config) ? raw.config : {} };
        });
        if (new Set(requirementTemplates.map((row) => row.requirement_key)).size !== requirementTemplates.length) fail("invalid_requirements", "requirement_key 不可重複");
        const { data: rule, error } = await ctx.db.schema("booking").from("identity_verification_rules").insert({
          tag_id: tagId, version, title: text(ctx.body.title, 200, "規則名稱", true), description: text(ctx.body.description, 4000, "規則說明"),
          requires_manual_review: ctx.body.requires_manual_review !== false, valid_days: validDays,
          special_legal_notice: text(ctx.body.special_legal_notice, 4000, "特別法律提示"), status: "draft", created_by: ctx.user.id,
        }).select("*").single();
        if (error || !rule) return contractError(ctx.origin, 409, "verification_rule_create_failed", "認證規則版本可能已存在");
        const requirementRows = requirementTemplates.map((row) => ({ ...row, rule_id: rule.rule_id }));
        const { error: requirementError } = await ctx.db.schema("booking").from("identity_verification_requirements").insert(requirementRows);
        if (requirementError) return contractError(ctx.origin, 400, "verification_requirements_create_failed", "規則已建立為草稿，但要求儲存失敗");
        return reply(ctx.origin, 201, { rule, requirements: requirementRows });
      }
      if (method === "PATCH") {
        const ruleId = id(ctx.body.rule_id, "rule_id");
        const status = String(ctx.body.status || "");
        if (!["active", "retired"].includes(status)) fail("invalid_transition", "規則只能發布或停用");
        const { data: current, error } = await ctx.db.schema("booking").from("identity_verification_rules").select("rule_id,tag_id,status").eq("rule_id", ruleId).maybeSingle();
        if (error || !current) fail("not_found", "找不到認證規則");
        if ((status === "active" && current.status !== "draft") || (status === "retired" && current.status !== "active")) fail("invalid_transition", "認證規則狀態轉換不合法");
        const now = new Date().toISOString();
        let previousActive: any[] = [];
        if (status === "active") {
          const { data: activeRules, error: activeReadError } = await ctx.db.schema("booking").from("identity_verification_rules").select("rule_id,published_at").eq("tag_id", current.tag_id).eq("status", "active");
          if (activeReadError) return contractError(ctx.origin, 400, "verification_rule_publish_failed", "舊版規則讀取失敗");
          previousActive = activeRules || [];
          const { error: retireError } = await ctx.db.schema("booking").from("identity_verification_rules").update({ status: "retired", updated_at: now }).eq("tag_id", current.tag_id).eq("status", "active");
          if (retireError) return contractError(ctx.origin, 400, "verification_rule_publish_failed", "舊版規則停用失敗");
        }
        const { data, error: updateError } = await ctx.db.schema("booking").from("identity_verification_rules").update({ status, published_at: status === "active" ? now : null, updated_at: now }).eq("rule_id", ruleId).eq("status", current.status).select("*").maybeSingle();
        if (updateError || !data) {
          for (const old of previousActive) await ctx.db.schema("booking").from("identity_verification_rules").update({ status: "active", published_at: old.published_at, updated_at: new Date().toISOString() }).eq("rule_id", old.rule_id).eq("status", "retired");
          return contractError(ctx.origin, 409, "verification_rule_update_failed", "規則狀態已變更，請重新讀取");
        }
        return reply(ctx.origin, 200, { rule: data });
      }
    }

    if (action === "admin-identity-verifications") {
      if (method === "GET") {
        let query = ctx.db.schema("booking").from("member_identity_verifications").select(ADMIN_VERIFICATION_FIELDS).order("created_at", { ascending: false });
        const status = ctx.url.searchParams.get("status");
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return contractError(ctx.origin, 400, "verifications_unavailable", "認證資料暫時無法讀取");
        const evidence = await readEvidence(ctx, (data || []).map((row: any) => row.verification_id));
        return evidence.error ? contractError(ctx.origin, 400, "verifications_unavailable", "認證資料暫時無法讀取") : reply(ctx.origin, 200, { verifications: data || [], evidence: evidence.data || [] });
      }
      if (method === "PATCH") {
        const verificationId = id(ctx.body.verification_id, "verification_id");
        const next = String(ctx.body.status || "");
        const { data: current, error } = await ctx.db.schema("booking").from("member_identity_verifications").select("verification_id,status,rule_id").eq("verification_id", verificationId).maybeSingle();
        if (error || !current) fail("not_found", "找不到認證申請");
        const transitions: Record<string, string[]> = { pending: ["verified", "rejected"], verified: ["revoked", "expired"], rejected: ["pending"] };
        if (!(transitions[current.status] || []).includes(next)) fail("invalid_transition", "認證狀態轉換不合法");
        const now = new Date().toISOString();
        let expiresAt: string | null = null;
        if (next === "verified") {
          const { data: rule } = await ctx.db.schema("booking").from("identity_verification_rules").select("valid_days").eq("rule_id", current.rule_id).single();
          if (rule?.valid_days) expiresAt = new Date(Date.now() + Number(rule.valid_days) * 86400000).toISOString();
        }
        const patch: Record<string, unknown> = {
          status: next, reviewed_by: ctx.user.id, review_note_private: text(ctx.body.review_note_private, 4000, "私人審核備註"),
          review_note_public: text(ctx.body.review_note_public, 2000, "公開審核說明"), updated_at: now,
        };
        if (next === "verified") Object.assign(patch, { verified_at: now, expires_at: expiresAt, revoked_at: null, revoked_reason: "" });
        if (next === "revoked") Object.assign(patch, { revoked_at: now, revoked_reason: text(ctx.body.revoked_reason, 2000, "撤銷原因", true) });
        const { data, error: updateError } = await ctx.db.schema("booking").from("member_identity_verifications").update(patch).eq("verification_id", verificationId).eq("status", current.status).select(ADMIN_VERIFICATION_FIELDS).maybeSingle();
        return updateError || !data ? contractError(ctx.origin, 409, "verification_update_failed", "認證狀態已變更，請重新讀取") : reply(ctx.origin, 200, { verification: data });
      }
    }
    return null;
  } catch (error) { return apiError(ctx, error, "輸入資料格式不正確"); }
}
