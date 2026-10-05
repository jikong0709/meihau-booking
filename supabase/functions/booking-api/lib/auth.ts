import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { contractError, reply } from "./http.ts";

export const MEMBER_PUBLIC_COLUMNS = "user_id,email,name,full_name,phone,line_id,contact_email,avatar_url,region,bio,is_public,role,account_status";

export type RequestContext = {
  db: any;
  user: any;
  member: Record<string, any>;
  origin: string | null;
  url: URL;
  body: Record<string, any>;
};

export async function authenticate(request: Request, origin: string | null): Promise<RequestContext | Response> {
  const urlValue = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(urlValue, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(origin, 401, { error: "Unauthorized" });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return reply(origin, 401, { error: "Unauthorized" });

  const user = auth.user;
  const email = user.email || "";
  const defaultName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
  const { error: createError } = await db.schema("booking").from("members")
    .upsert({ user_id: user.id, email, name: defaultName }, { onConflict: "user_id", ignoreDuplicates: true });
  if (createError) return reply(origin, 500, { error: "Member initialization failed" });
  const { data: member, error: readError } = await db.schema("booking").from("members")
    .select("*").eq("user_id", user.id).single();
  if (readError || !member) return reply(origin, 500, { error: "Member profile unavailable" });
  const { error: memberRoleError } = await db.schema("booking").from("member_roles")
    .upsert({ user_id: user.id, role_key: "member", status: "approved" }, { onConflict: "user_id,role_key", ignoreDuplicates: true });
  if (memberRoleError) return reply(origin, 500, { error: "Member role initialization failed" });
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  return { db, user, member, origin, url: new URL(request.url), body };
}

export function isResponse(value: RequestContext | Response): value is Response {
  return value instanceof Response;
}

export function requireAdmin(ctx: RequestContext): Response | null {
  return ["admin", "developer"].includes(String(ctx.member.role))
    ? null
    : contractError(ctx.origin, 403, "forbidden", "需要管理員權限");
}

export function requireDeveloper(ctx: RequestContext): Response | null {
  return ctx.member.role === "developer"
    ? null
    : contractError(ctx.origin, 403, "forbidden", "需要開發者權限");
}
