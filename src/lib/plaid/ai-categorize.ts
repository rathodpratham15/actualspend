import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiCategoryCache } from "@/lib/db/schema";
import type { PlaidCategory } from "@/lib/db/schema";
import { toCanonical } from "./categorize";

// All canonical codes the static map may return — AI must stay within this set
// so the FK to the category table is never violated.
const VALID_CODES = new Set([
  "INCOME", "TRANSFER", "FEES", "ENTERTAINMENT", "EATING_OUT", "SHOPPING",
  "HEALTH", "OTHER", "TAXES", "TRANSPORT", "TRAVEL", "UTILITIES", "GROCERIES",
  "RENT", "SUBSCRIPTION", "EDUCATION", "SOCIAL", "CC_PAYMENT", "REIMBURSEMENT",
]);

function buildPrompt(merchantName: string, detailed: string): string {
  return `Classify this bank transaction into exactly one category code.

Merchant: ${merchantName}
Plaid category: ${detailed}

Valid codes (pick exactly one):
GROCERIES, EATING_OUT, SHOPPING, TRANSPORT, TRAVEL, UTILITIES, RENT,
HEALTH, ENTERTAINMENT, SUBSCRIPTION, EDUCATION, SOCIAL, FEES, TAXES,
INCOME, TRANSFER, CC_PAYMENT, REIMBURSEMENT, OTHER

Respond with only the code, nothing else.`;
}

async function callAI(
  prompt: string,
): Promise<{ code: string; provider: string } | null> {
  // Anthropic takes priority when both keys are present
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        messages: [{ role: "user", content: prompt }],
      });
      const text =
        msg.content[0].type === "text"
          ? msg.content[0].text.trim().toUpperCase()
          : "";
      return { code: text, provider: "anthropic" };
    } catch {
      // fall through to Groq
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            max_tokens: 20,
            messages: [{ role: "user", content: prompt }],
          }),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text =
        data.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "";
      return { code: text, provider: "groq" };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves the canonical category for a transaction. Uses the static map
 * first; falls back to an AI call (cached by merchant+plaid_detailed) only
 * when the static result is "OTHER" or null — i.e., the long tail that the
 * regex maps can't handle confidently.
 */
export async function resolveCategory(
  pfc: PlaidCategory | null | undefined,
  merchantName: string | null | undefined,
): Promise<string | null> {
  const staticResult = toCanonical(pfc);

  // Static map gave a meaningful answer — no AI needed.
  if (staticResult && staticResult !== "OTHER") return staticResult;

  // Without a merchant name we can't do better than the static result.
  if (!merchantName?.trim()) return staticResult;

  const detailed = pfc?.detailed ?? "UNKNOWN";
  const cacheKey = `${merchantName.toLowerCase().trim()}::${detailed}`;

  // Check cache first.
  const [cached] = await db
    .select({ canonicalCategory: aiCategoryCache.canonicalCategory })
    .from(aiCategoryCache)
    .where(eq(aiCategoryCache.cacheKey, cacheKey))
    .limit(1);

  if (cached) return cached.canonicalCategory;

  // Neither key set — fall back gracefully.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    return staticResult;
  }

  const result = await callAI(buildPrompt(merchantName.trim(), detailed));
  if (!result) return staticResult;

  const code = VALID_CODES.has(result.code) ? result.code : "OTHER";

  // Store in cache so this merchant never hits the model again.
  await db
    .insert(aiCategoryCache)
    .values({ cacheKey, canonicalCategory: code, provider: result.provider })
    .onConflictDoNothing();

  return code;
}
