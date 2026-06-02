/**
 * 7.2 Classification — the moat (PRD §11).
 *
 * For every instruction, decide where it should live (CLAUDE.md / skill / rule /
 * hook / MCP) and why. Returns the deciding signals so the user always sees the
 * reasoning. Rules are documented in docs/methodology.md.
 *
 * Stage 1: implement.
 */
import type { Classification, ConfigInventory } from "./types.js";
import { notImplemented } from "./internal.js";

export function classify(_inventory: ConfigInventory): Classification[] {
  return notImplemented("classify");
}
