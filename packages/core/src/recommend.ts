/**
 * 7.5 Recommendations (PRD §13).
 *
 * Turn each detected issue into a fix with an estimated token saving and an
 * estimated health gain. Sorted by estHealthGain desc, then estTokenSaving desc.
 *
 * Stage 1: implement.
 */
import type { ConfigInventory, HealthScore, Recommendation } from "./types.js";
import { notImplemented } from "./internal.js";

export function recommend(
  _inventory: ConfigInventory,
  _score: HealthScore,
): Recommendation[] {
  return notImplemented("recommend");
}
