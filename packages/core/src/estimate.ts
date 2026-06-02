/**
 * 7.4 Token estimation (PRD §12).
 *
 * `tokensOf` is the single source of truth; every other estimator composes it.
 * Every returned number carries a confidence level. The 4-bytes/token ratio and
 * the prose/code multipliers are versioned constants documented in
 * docs/methodology.md.
 *
 * Stage 1: implement.
 */
import type { ConfigInventory, Estimate } from "./types.js";
import { notImplemented } from "./internal.js";

/** ceil(utf8Bytes(text) / 4), ×1.0 prose / ×1.15 code-or-markdown. Confidence: medium. */
export function tokensOf(_text: string): number {
  return notImplemented("tokensOf");
}

/** All composed estimators for an inventory (perSessionTax, perDayTax, …). */
export function estimate(_inventory: ConfigInventory): Estimate[] {
  return notImplemented("estimate");
}
