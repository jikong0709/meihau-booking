import { origins, reply } from "../booking-api/lib/http.ts";
import { handlePublicMatching } from "../booking-api/lib/matching.ts";
import { handlePublicResources } from "../booking-api/lib/resources.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    const response = reply(origin, 204, {});
    return new Response(null, { status: 204, headers: response.headers });
  }
  if (origin && !origins.has(origin)) return reply(origin, 403, { error: "Origin not allowed" });

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";
  if (!["public-matching-profile", "matching-feature-feed", "matching-discovery-feed", "public-resources", "resource-click"].includes(action)) {
    return reply(origin, 404, { error: "Not found" });
  }
  return await handlePublicMatching(request, origin, action, request.method)
    || await handlePublicResources(request, origin, action, request.method)
    || reply(origin, 405, { error: "Method not allowed" });
});
