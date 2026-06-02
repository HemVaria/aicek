/**
 * 7.4 Token estimation (PRD §12).
 *
 * `tokensOf` is the single source of truth; every other estimator composes it.
 * Every returned number carries a confidence level. The 4-bytes/token ratio and
 * the prose/code multipliers are versioned constants — see docs/methodology.md.
 * Changing any constant here bumps ENGINE_VERSION.
 *
 * Determinism: pure functions of their inputs. No clocks, no RNG, no filesystem
 * ordering. Inventory-derived estimators sort their inputs before summing so the
 * result is independent of array order.
 */
import type { ConfigInventory, Estimate } from "./types.js";

/** Versioned estimator constants (documented in docs/methodology.md §2). */
export const BYTES_PER_TOKEN = 4;
export const PROSE_MULTIPLIER = 1.0;
export const CODE_MULTIPLIER = 1.15;
export const DEFAULT_SESSIONS_PER_DAY = 10;

/**
 * Heuristic: does this block tokenize denser than prose (code / markdown tables)?
 * Code and tables carry more punctuation per byte, which tokenizes into more
 * tokens, so they get the higher multiplier. Deterministic and content-only.
 */
export function looksLikeCodeOrMarkdown(text: string): boolean {
  if (text.includes("```")) return true; // fenced code block
  // A markdown table separator row, e.g. | --- | :--: |
  if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/m.test(text)) return true;
  // A line with two or more column pipes (table body)
  if (/^.*\|.*\|.*$/m.test(text)) return true;
  return false;
}

/**
 * Estimate the token cost of a block of text.
 * `ceil(utf8Bytes / 4)` baseline, then ×1.0 (prose) or ×1.15 (code/markdown).
 * Confidence: **medium** (heuristic ratio, not a real tokenizer).
 */
export function tokensOf(text: string): number {
  if (text.length === 0) return 0;
  const bytes = Buffer.byteLength(text, "utf8");
  const baseline = Math.ceil(bytes / BYTES_PER_TOKEN);
  const multiplier = looksLikeCodeOrMarkdown(text) ? CODE_MULTIPLIER : PROSE_MULTIPLIER;
  return Math.ceil(baseline * multiplier);
}

/** Rules that load on every turn (no path scope). */
function alwaysLoadedRules(inventory: ConfigInventory): string[] {
  return inventory.rules
    .filter((r) => r.globs.length === 0)
    .map((r) => r.content)
    .sort(); // order-independent sum
}

/**
 * Tokens loaded into context on every session: CLAUDE.md + all always-on rules.
 * Confidence: **medium**.
 */
export function alwaysOnContext(inventory: ConfigInventory): number {
  const claudeMd = inventory.claudeMd ? tokensOf(inventory.claudeMd.content) : 0;
  const rules = alwaysLoadedRules(inventory).reduce((sum, c) => sum + tokensOf(c), 0);
  return claudeMd + rules;
}

/**
 * Per-session token tax — the always-on context, paid once per session.
 * Confidence: **medium**.
 */
export function perSessionTax(inventory: ConfigInventory): number {
  return alwaysOnContext(inventory);
}

/**
 * Projected per-day token tax: per-session tax × sessions/day.
 * `sessions` is user-supplied (default 10). Confidence: **low** (behavioral
 * projection, not a measurement).
 */
export function perDayTax(
  inventory: ConfigInventory,
  sessions: number = DEFAULT_SESSIONS_PER_DAY,
): number {
  return perSessionTax(inventory) * sessions;
}

/**
 * All composed estimators for an inventory, each labeled with its confidence.
 * This is what the audit artifact's `estimates[]` is built from (PRD §14).
 */
export function estimate(
  inventory: ConfigInventory,
  sessions: number = DEFAULT_SESSIONS_PER_DAY,
): Estimate[] {
  return [
    { name: "alwaysOnContext", value: alwaysOnContext(inventory), confidence: "medium" },
    { name: "perSessionTax", value: perSessionTax(inventory), confidence: "medium" },
    { name: "perDayTax", value: perDayTax(inventory, sessions), confidence: "low" },
  ];
}
