import { BITCOIN_TOPICS } from "../constants";
import { ConceptNode } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const OPENROUTER_PROXY_URL = `${API_BASE}/openrouter`;
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

const getRandomTopic = (exclude: string[] = []): string => {
  const excludeSet = new Set(exclude.map(topic => topic.toLowerCase()));
  const available = BITCOIN_TOPICS.filter(topic => !excludeSet.has(topic.toLowerCase()));
  const pool = available.length > 0 ? available : BITCOIN_TOPICS;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};

export const generateBitcoinText = async (recentTopics: string[] = [], forcedTopic?: string): Promise<{ text: string; topic: string }> => {
  const topic = forcedTopic || getRandomTopic(recentTopics);

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

const parseConceptNodes = (raw: unknown, topic: string): ConceptNode[] => {
  const baseId = `${topic}-${Date.now().toString(36)}`;
  const fallbackNode: ConceptNode = {
    id: `${baseId}-root`,
    label: topic,
    parentId: null,
    summary: `Exploring ${topic} through Bitcoin's lens.`
  };

  if (!raw) return [fallbackNode];

  const nodesInput = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as { nodes?: unknown }).nodes)
      ? (raw as { nodes: unknown }).nodes
      : null;

  if (!nodesInput) return [fallbackNode];

  const sanitized = nodesInput
    .map((node, idx) => {
      if (typeof node !== "object" || node === null) return null;
      const { label, parent, parentId, summary } = node as Record<string, unknown>;
      const safeLabel = typeof label === "string" ? label.trim() : null;
      const safeParent = typeof parentId === "string"
        ? parentId.trim()
        : typeof parent === "string"
          ? parent.trim()
          : null;
      const safeSummary = typeof summary === "string" ? summary.trim() : "";

      if (!safeLabel) return null;

      return {
        id: `${baseId}-${idx}`,
        label: safeLabel,
        parentId: safeParent || (idx === 0 ? null : topic),
        summary: safeSummary || `How ${safeLabel} intersects with ${topic} in Bitcoin's world.`
      } as ConceptNode;
    })
    .filter(Boolean) as ConceptNode[];

  if (sanitized.length === 0) {
    return [fallbackNode];
  }

  const hasRoot = sanitized.some(node => node.parentId === null);
  return hasRoot ? sanitized : [{ ...fallbackNode }, ...sanitized];
};

export const generateConceptTree = async (topic: string): Promise<ConceptNode[]> => {
  const userPrompt = `
    You generate surprising, Bitcoin-specific concept trees.
    Root concept: "${topic}"

    Output requirements:
    - Return JSON only. Shape: { "nodes": [ { "label": string, "parent": string | null, "summary": string } ] }
    - Include 1 root (parent null), 3-5 first-level branches, and 2-3 offshoots per branch where useful.
    - Keep labels short (2-5 words) and Bitcoin-anchored. Prefer unexpected angles (policy, energy, human rights, security).
    - Summaries: 1 concise sentence explaining why the concept matters for Bitcoin.
    - No prose outside JSON. No markdown.
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
            "You are a Bitcoin researcher who thinks laterally. You respond with lean JSON concept trees only.",
        },
        { role: "user", content: userPrompt.trim() },
      ],
      stream: false,
      temperature: 0.55,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter tree request failed:", errorText);
    throw new Error(`OpenRouter error: ${response.status}`);
  }

  const data: {
    choices?: { message?: { content?: string } }[];
  } = await response.json();

  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    return parseConceptNodes(null, topic);
  }

  try {
    const json = JSON.parse(text);
    return parseConceptNodes(json, topic);
  } catch (error) {
    console.warn("Failed to parse concept tree JSON, returning fallback", error);
    return parseConceptNodes(null, topic);
  }
};
