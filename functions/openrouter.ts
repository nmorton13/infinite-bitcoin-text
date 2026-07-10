type Env = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  CORS_ALLOW_ORIGIN?: string;
};

type PagesFunction = (context: { request: Request; env: Env }) => Promise<Response>;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-3.1-flash-lite";
const MAX_REQUEST_BYTES = 32_768;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 1_200;

type RequestKind = "text" | "concept-tree";

const SYSTEM_PROMPTS: Record<RequestKind, string> = {
  text: "You are the author of an infinite, living document about Bitcoin. You possess deep knowledge of cryptography, economics, history, and computer science. You write in a raw, terminal-like style.",
  "concept-tree": "You are a Bitcoin researcher who thinks laterally. You respond with lean JSON concept trees only.",
};

const jsonResponse = (request: Request, env: Env, status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: buildCorsHeaders(request, env, { "Content-Type": "application/json", ...extra }),
  });

const readBoundedJson = async (request: Request): Promise<unknown> => {
  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_REQUEST_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  if (!request.body) {
    throw new Error("INVALID_JSON");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("REQUEST_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
};

const parseRequest = (body: unknown): { kind: RequestKind; prompt: string } | null => {
  if (typeof body !== "object" || body === null) return null;
  const { kind, prompt } = body as { kind?: unknown; prompt?: unknown };
  if ((kind !== "text" && kind !== "concept-tree") || typeof prompt !== "string") return null;
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_CHARS) return null;
  return { kind, prompt: trimmed };
};

const getHostname = (value: string) => {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
};

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
    "Access-Control-Expose-Headers": "Retry-After",
    ...extra,
  });
};

export const onRequestOptions: PagesFunction = async ({ request, env }) => {
  // Respect origin for local vs deployed requests.
  return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
};

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  // Basic origin check - stops casual abuse (easily spoofed, but filters out lazy requests)
  const originHostname = getHostname(request.headers.get("Origin") || "");
  const refererHostname = getHostname(request.headers.get("Referer") || "");
  const requestHost = new URL(request.url).hostname;
  const isLocal = originHostname === "localhost" || originHostname === "127.0.0.1";
  const isProduction = originHostname === "infinitebitcointext.com" || refererHostname === "infinitebitcointext.com";
  const isPagesPreview = originHostname.endsWith(".infinite-bitcoin-text.pages.dev") && originHostname === requestHost;
  const isAllowed = isLocal || isProduction || isPagesPreview;

  if (!isAllowed) {
    return new Response("Forbidden", { status: 403, headers: buildCorsHeaders(request, env) });
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse(request, env, 500, { error: "SERVER_CONFIGURATION_ERROR" });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonResponse(request, env, 413, { error: "REQUEST_TOO_LARGE" });
    }
    return jsonResponse(request, env, 400, { error: "INVALID_JSON" });
  }

  const parsedRequest = parseRequest(body);
  if (!parsedRequest) {
    return jsonResponse(request, env, 400, { error: "INVALID_REQUEST" });
  }

  const proxyBody = {
    model: env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPTS[parsedRequest.kind] },
      { role: "user", content: parsedRequest.prompt },
    ],
    stream: false,
    temperature: parsedRequest.kind === "concept-tree" ? 0.55 : 0.35,
    max_tokens: MAX_OUTPUT_TOKENS,
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

  if (upstreamResponse.status === 429) {
    const retryAfter = upstreamResponse.headers.get("Retry-After") || "30";
    await upstreamResponse.body?.cancel();
    return jsonResponse(
      request,
      env,
      429,
      { error: "RATE_LIMITED", retryAfterSeconds: Number.parseInt(retryAfter, 10) || 30 },
      { "Retry-After": retryAfter }
    );
  }

  if (!upstreamResponse.ok) {
    await upstreamResponse.body?.cancel();
    return jsonResponse(request, env, upstreamResponse.status, { error: "UPSTREAM_ERROR" });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: buildCorsHeaders(request, env, { "Content-Type": "application/json" }),
  });
};
