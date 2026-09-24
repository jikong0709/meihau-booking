const origins = new Set(["https://jikong0709.github.io", "http://127.0.0.1:8080", "http://localhost:8080"]);

Deno.serve((request) => {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin && origins.has(origin) ? origin : "https://jikong0709.github.io";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET" || (origin && !origins.has(origin))) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  return new Response(JSON.stringify({
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY"),
  }), { status: 200, headers });
});
