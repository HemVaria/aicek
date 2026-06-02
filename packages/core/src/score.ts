/**
 * 7.3 Health scoring — the KPI (PRD §10).
 *
 * Pure and deterministic: starts at 100, each of the five pillars deducts from
 * its own budget, deductions sum and clamp to [0, 100]. Every deduction carries
 * a reason and evidence pointer. No clocks, no RNG, no filesystem-ordering
 * dependence (inputs are sorted before scoring).
 *
 * Pillar weights (PRD §10.2): context-economy 30, routing-correctness 25,
 * skill-effectiveness 20, structural-hygiene 15, redundancy-overlap 10.
 *
 * Stage 1: implement.
 */
import type { ConfigInventory, HealthScore, PillarName } from "./types.js";
import { notImplemented } from "./internal.js";

/** Initial pillar budgets (v1). Changing these bumps ENGINE_VERSION. */
export const PILLAR_WEIGHTS: Record<PillarName, number> = {
  "context-economy": 30,
  "routing-correctness": 25,
  "skill-effectiveness": 20,
  "structural-hygiene": 15,
  "redundancy-overlap": 10,
};

export function score(_inventory: ConfigInventory): HealthScore {
  return notImplemented("score");
}
