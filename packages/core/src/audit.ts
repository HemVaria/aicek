/**
 * Assemble the versioned audit artifact (PRD §14) — the single contract between
 * AICEK and Hermes (§19). Composes the whole engine over one inventory.
 */
import type { AuditArtifact, ConfigInventory } from "./types.js";
import { SCHEMA_VERSION, ENGINE_VERSION } from "./version.js";
import { classify } from "./classify.js";
import { score } from "./score.js";
import { recommend } from "./recommend.js";
import { estimate } from "./estimate.js";

export function audit(
  inventory: ConfigInventory,
  sessions?: number,
): AuditArtifact {
  const health = score(inventory);
  return {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    generatedFor: { stack: inventory.stack, agent: inventory.agent },
    healthScore: health.total,
    pillars: health.pillars,
    classification: classify(inventory),
    estimates: estimate(inventory, sessions),
    recommendations: recommend(inventory, health),
  };
}
