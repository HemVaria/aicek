/**
 * `aicek optimize` core (PRD Stage 4) — pure planning. Returns the changes that
 * WOULD be applied; the CLI archives originals first and applies them, so every
 * change is reversible via `aicek restore`.
 *
 * Auto-fixes are deliberately limited to the provably-safe set:
 *  - add-ignore: create .gitignore when missing (pure addition).
 *  - archive-skill: archive never-triggered ("dead") skills — reversible.
 * Riskier rewrites (trimming/moving CLAUDE.md prose) stay as doctor advice, not
 * automatic edits, so optimize can never silently damage a config.
 */
import type { ConfigInventory } from "./types.js";
import { tokensOf } from "./estimate.js";
import { generateIgnore } from "./generate.js";
import { STRUCT_NO_IGNORE, SKILL_WEAK_DESCRIPTION } from "./score.js";

export type OptimizeKind = "add-ignore" | "archive-skill";

export interface OptimizeChange {
  id: string;
  kind: OptimizeKind;
  description: string;
  /** A file to create (relative path + content). */
  write?: { path: string; content: string };
  /** A path (relative to root) to move into the archive. */
  archive?: { path: string; name: string };
  estTokenSaving: number;
  estHealthGain: number;
}

export interface OptimizePlan {
  changes: OptimizeChange[];
  estTokenSaving: number;
  estHealthGain: number;
}

export interface OptimizeInput {
  /** Skill names with zero activations (from the transcript monitor). */
  deadSkills?: string[];
}

export function planOptimize(inventory: ConfigInventory, input: OptimizeInput = {}): OptimizePlan {
  const changes: OptimizeChange[] = [];
  const dead = new Set((input.deadSkills ?? []).map((n) => n.toLowerCase()));

  // 1. add-ignore (safe, pure addition)
  const hasGitignore = inventory.ignoreFiles.some((f) => f.path.endsWith(".gitignore"));
  if (!hasGitignore) {
    changes.push({
      id: "add-ignore",
      kind: "add-ignore",
      description: "Create .gitignore so build output, deps, and secrets stay out of context.",
      write: { path: ".gitignore", content: generateIgnore(inventory.stack) },
      estTokenSaving: 0,
      estHealthGain: STRUCT_NO_IGNORE,
    });
  }

  // 2. archive dead skills (never triggered) — reversible
  for (const s of inventory.skills) {
    if (!dead.has(s.name.toLowerCase())) continue;
    changes.push({
      id: `archive-skill-${s.name}`,
      kind: "archive-skill",
      description: `Archive never-triggered skill "${s.name}" (0 activations). Restore anytime with \`aicek restore ${s.name}\`.`,
      archive: { path: `.claude/skills/${s.name}`, name: s.name },
      estTokenSaving: tokensOf(s.description),
      estHealthGain: SKILL_WEAK_DESCRIPTION,
    });
  }

  return {
    changes,
    estTokenSaving: changes.reduce((a, c) => a + c.estTokenSaving, 0),
    estHealthGain: changes.reduce((a, c) => a + c.estHealthGain, 0),
  };
}
