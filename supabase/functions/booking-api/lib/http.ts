export const origins = new Set([
  "https://jikong0709.github.io",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
]);

export function cors(origin: string | null) {
  const value = origin && origins.has(origin) ? origin : "https://jikong0709.github.io";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

export function reply(origin: string | null, status: number, body: unknown) {
  const payload = status >= 400 && body && typeof body === "object" && "error" in body && !("message" in body)
    ? { ...(body as Record<string, unknown>), message: String((body as Record<string, unknown>).error) }
    : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function contractError(origin: string | null, status: number, error: string, message: string) {
  return reply(origin, status, { error, message });
}
