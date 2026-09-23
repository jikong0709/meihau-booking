import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://jikong0709.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://jikong0709.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, origin);
  }
  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ ok: false, message: "Origin not allowed" }, 403, origin);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) {
    return jsonResponse({ ok: false, message: "Request too large" }, 413, origin);
  }

  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || payload.company) {
      return jsonResponse({ ok: false, message: "Invalid request" }, 400, origin);
    }

    const projectUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const fingerprintSecret = Deno.env.get("BOOKING_FINGERPRINT_SECRET");
    if (!projectUrl || !serviceRoleKey || !fingerprintSecret) {
      return jsonResponse({ ok: false, message: "Service unavailable" }, 503, origin);
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = request.headers.get("cf-connecting-ip") || forwardedFor || "unknown";
    const fingerprint = await sha256(`${fingerprintSecret}:${clientIp}`);

    const supabase = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc("submit_meihau_booking_request", {
      p_payload: payload,
      p_fingerprint: fingerprint,
    });

    if (error) {
      const rateLimited = error.message.toLowerCase().includes("rate limit");
      return jsonResponse(
        { ok: false, message: rateLimited ? "送出次數過多，請稍後再試。" : "資料格式有誤，請檢查後再試。" },
        rateLimited ? 429 : 400,
        origin,
      );
    }

    return jsonResponse({ ok: true, request_id: data }, 201, origin);
  } catch {
    return jsonResponse({ ok: false, message: "暫時無法送出，請稍後再試。" }, 500, origin);
  }
});

