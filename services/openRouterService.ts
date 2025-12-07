import { BITCOIN_TOPICS } from "../constants";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const OPENROUTER_PROXY_URL = `${API_BASE}/openrouter`;
const OPENROUTER_MODEL = "x-ai/grok-4.1-fast";

const getRandomTopic = (exclude: string[] = []): string => {
  const excludeSet = new Set(exclude.map(topic => topic.toLowerCase()));
  const available = BITCOIN_TOPICS.filter(topic => !excludeSet.has(topic.toLowerCase()));
  const pool = available.length > 0 ? available : BITCOIN_TOPICS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};

export const generateBitcoinText = async (recentTopics: string[] = []): Promise<{ text: string; topic: string }> => {
  const topic = getRandomTopic(recentTopics);

  const userPrompt = `
    Write a continuation for an infinite text file about Bitcoin.

    Current Topic to Focus on: "${topic}"

    Instructions:
    1. Write 2-3 dense, high-quality paragraphs about this specific topic.
    2. Style: Balance technical accuracy with philosophical cyberpunk flavor. Maximum one vivid metaphor per paragraph. When in doubt, choose clarity over atmosphere.
    3. Clarity: Be clear first, precise second. Include at least one concrete fact or number per paragraph. Avoid heavy notation; favor plain language.
    4. Relevance: Include one short anchor sentence in each paragraph explaining why this matters to a normal reader (security, autonomy, censorship-resistance).
    5. Math markup ban: Avoid math symbols like $ or LaTeX notation; spell out concepts.
    6. Format: Plain text only. NO markdown. Just raw paragraphs separated by newlines.
    7. Tone: Serious, passionate, informative.
    8. Do not write an intro or outro. Just the raw content.
    9. Avoid repeating topics or specific arguments from these recent topics: ${recentTopics.slice(-3).join("; ") || "none"}.
    10. Technical accuracy is paramount. Verify security claims, especially around: (a) what 51% attacks can and cannot do; (b) what difficulty adjustment does and does not prevent; (c) collision resistance numbers and what they imply; (d) causality—e.g., difficulty adjustment maintains target timing; it does not prevent attacks.
    11. Avoid overclaiming. Use phrases like "computationally infeasible" instead of "impossible" or "unbreakable".
  `;

  const response = await fetch(OPENROUTER_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are the author of an infinite, living document about Bitcoin. You possess deep knowledge of cryptography, economics, history, and computer science. You write in a raw, terminal-like style.",
        },
        { role: "user", content: userPrompt.trim() },
      ],
      stream: false,
      temperature: 0.35,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter request failed:", errorText);
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const data: {
    choices?: { message?: { content?: string } }[];
  } = await response.json();

  const text = data.choices?.[0]?.message?.content?.trim() || "";
  const cleanText = text.replace(/^#+\s/gm, "").replace(/\*\*/g, "");

  return { text: cleanText, topic };
};
