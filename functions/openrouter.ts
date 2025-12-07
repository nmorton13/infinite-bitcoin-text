type Env = {
  OPENROUTER_API_KEY?: string;
};

type PagesFunction = (context: { request: Request; env: Env }) => Promise<Response>;

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response("Missing OPENROUTER_API_KEY", { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
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
    headers: { "Content-Type": "application/json" },
  });
};
