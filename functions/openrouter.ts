type Env = {
  OPENROUTER_API_KEY?: string;
  CORS_ALLOW_ORIGIN?: string;
};

type PagesFunction = (context: { request: Request; env: Env }) => Promise<Response>;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

const buildCorsHeaders = (request: Request, env: Env, extra: Record<string, string> = {}) => {
  const origin = request.headers.get("Origin") || "";
  const hostname = new URL(request.url).hostname;
  const isLocal =
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1");

  // Use * for local dev; otherwise allow an explicit domain if provided.
  const allowOrigin = isLocal ? "*" : env.CORS_ALLOW_ORIGIN || "*";

  return new Headers({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...extra,
  });
};

export const onRequestOptions: PagesFunction = async ({ request, env }) => {
  // Respect origin for local vs deployed requests.
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  // Basic origin check - stops casual abuse (easily spoofed, but filters out lazy requests)
  const origin = request.headers.get("Origin") || "";
  const referer = request.headers.get("Referer") || "";
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isAllowed = isLocal || origin.includes("infinitebitcointext.com") || referer.includes("infinitebitcointext.com");

  if (!isAllowed) {
    return new Response("Forbidden", { status: 403, headers: buildCorsHeaders(request, env) });
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("Missing OPENROUTER_API_KEY", { status: 500, headers: buildCorsHeaders(request, env) });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400, headers: buildCorsHeaders(request, env) });
  }

  const proxyBody = {
    model: OPENROUTER_MODEL,
    ...((body as Record<string, unknown>) ?? {}),
  };

  const upstreamResponse = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": new URL(request.url).origin,
      "X-Title": "the-infinite-bitcoin-text",
    },
    body: JSON.stringify(proxyBody),
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: buildCorsHeaders(request, env, { "Content-Type": "application/json" }),
  });
};
