import { authenticate, isResponse, requireAdmin } from "./lib/auth.ts";
import { cors, origins, reply } from "./lib/http.ts";
import { handleAddresses, handleInquiries, handleOrderChange, handleOrders, handleProfile, handleQuote, handleServices } from "./lib/member_core.ts";
import { getMyRoles, handleAgreements, handleServicesForProviders, handleTags, mePayload, putMyRoles } from "./lib/roles.ts";
import { handleExistingAdmin } from "./lib/admin_existing.ts";
import { adminAgreementRecords, adminAgreements, adminPeople, adminPersonGet, adminPersonPatch, adminRoleReview, adminSystemRole, adminTags } from "./lib/admin_people.ts";
import { handleIdentityAdmin, handleIdentityMember } from "./lib/identity_verification.ts";
import { handleMatchingAdmin, handleMatchingMember } from "./lib/matching.ts";
import { handleCircleMember } from "./lib/circle_social.ts";
import { handleResourceAdmin, handleResourceMember } from "./lib/resources.ts";
import { handleServiceQuoteAdmin, handleServiceQuotes } from "./lib/service_quotes.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (origin && !origins.has(origin)) return reply(origin, 403, { error: "Origin not allowed" });

  const authenticated = await authenticate(request, origin);
  if (isResponse(authenticated)) return authenticated;
  const ctx = authenticated;
  const action = ctx.url.searchParams.get("action") || "";
  const method = request.method;

  if (action === "me" && method === "GET") return await mePayload(ctx);
  if (action === "profile" && method === "PATCH") return await handleProfile(ctx);
  if (action === "addresses" && ["GET", "POST", "DELETE"].includes(method)) return await handleAddresses(ctx, method);
  if (action === "services" && method === "GET") return await handleServices(ctx);
  if (action === "quote" && method === "POST") return await handleQuote(ctx);
  if (action === "orders" && ["GET", "POST"].includes(method)) return await handleOrders(ctx, method);
  if (action === "order-cancel" && method === "POST") return await handleOrderChange(ctx, action);
  if (action === "order-reschedule" && method === "PATCH") return await handleOrderChange(ctx, action);
  if (action === "inquiries" && ["GET", "POST"].includes(method)) return await handleInquiries(ctx, method);

  if (action === "my-roles" && method === "GET") return await getMyRoles(ctx);
  if (action === "my-roles" && method === "PUT") return await putMyRoles(ctx);
  if (action === "tags" && method === "GET") return await handleTags(ctx);
  if (action === "agreements" && method === "GET") return await handleAgreements(ctx);
  if (action === "services-for-providers" && method === "GET") return await handleServicesForProviders(ctx);

  const identityMemberResponse = await handleIdentityMember(ctx, action, method);
  if (identityMemberResponse) return identityMemberResponse;
  const matchingMemberResponse = await handleMatchingMember(ctx, action, method);
  if (matchingMemberResponse) return matchingMemberResponse;
  const circleMemberResponse = await handleCircleMember(ctx, action, method);
  if (circleMemberResponse) return circleMemberResponse;
  const resourceMemberResponse = await handleResourceMember(ctx, action, method);
  if (resourceMemberResponse) return resourceMemberResponse;
  const quoteResponse = await handleServiceQuotes(ctx, action, method);
  if (quoteResponse) return quoteResponse;

  if (action.startsWith("admin-")) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const legacy = await handleExistingAdmin(ctx, action, method);
    if (legacy) return legacy;
    const quoteAdminResponse = await handleServiceQuoteAdmin(ctx, action, method);
    if (quoteAdminResponse) return quoteAdminResponse;
    if (action === "admin-people" && method === "GET") return await adminPeople(ctx);
    if (action === "admin-person" && method === "GET") return await adminPersonGet(ctx);
    if (action === "admin-person" && method === "PATCH") return await adminPersonPatch(ctx);
    if (action === "admin-role-review" && method === "PATCH") return await adminRoleReview(ctx);
    if (action === "admin-tags" && ["GET", "POST", "PATCH"].includes(method)) return await adminTags(ctx, method);
    if (action === "admin-agreements" && ["GET", "POST", "PATCH"].includes(method)) return await adminAgreements(ctx, method);
    if (action === "admin-agreement-records" && method === "GET") return await adminAgreementRecords(ctx);
    if (action === "admin-system-role" && method === "PATCH") return await adminSystemRole(ctx);
    const identityAdminResponse = await handleIdentityAdmin(ctx, action, method);
    if (identityAdminResponse) return identityAdminResponse;
    const matchingAdminResponse = await handleMatchingAdmin(ctx, action, method);
    if (matchingAdminResponse) return matchingAdminResponse;
    const resourceAdminResponse = await handleResourceAdmin(ctx, action, method);
    if (resourceAdminResponse) return resourceAdminResponse;
  }
  return reply(origin, 404, { error: "Not found" });
});
