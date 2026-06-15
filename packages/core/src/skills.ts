/**
 * Skill health monitor + description linter (PRD Stage 4).
 *
 * Pure functions over transcript text. The CLI reads ~/.claude/projects/*.jsonl
 * and feeds the text here; keeping the counting pure makes it deterministic and
 * testable. A skill is "dead" if it has zero activations across the transcripts,
 * "weak" if its description is too short to reliably trigger, else "healthy".
 */
import type { SkillEntry } from "./types.js";

export type SkillStatus = "healthy" | "weak-description" | "dead" | "unknown";

export interface SkillHealth {
  name: string;
  activations: number;
  status: SkillStatus;
  /** A concrete rewrite suggestion when the description is weak. */
  suggestion?: string;
}

export const WEAK_DESCRIPTION_MIN_CHARS = 20;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Count how many times each skill was invoked across transcript texts. Matches
 * the Skill tool input (`"skill":"name"` / `"name":"name"`) and slash-command
 * usage (`/name`). Case-insensitive on the name.
 */
export function countSkillActivations(
  transcriptTexts: string[],
  skillNames: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of skillNames) {
    const n = escapeRegExp(name);
    const re = new RegExp(`"(?:skill|name)"\\s*:\\s*"${n}"|(?<![\\w/])/${n}\\b`, "gi");
    let total = 0;
    for (const text of transcriptTexts) {
      const m = text.match(re);
      if (m) total += m.length;
    }
    counts[name] = total;
  }
  return counts;
}

/** A heuristic rewrite suggestion for a weak/empty skill description. */
export function suggestDescription(name: string): string {
  const readable = name.replace(/[-_]/g, " ");
  return `Use this skill when the user needs ${readable}. Describe the concrete trigger (what the user asks for) and what the skill produces, so the agent invokes it reliably.`;
}

/**
 * Assess each skill's health. `activations` may be omitted (e.g. transcripts
 * unavailable) — then a skill is never marked "dead", only "weak-description"
 * or "unknown", so we never penalize on missing data.
 */
export function assessSkills(
  skills: SkillEntry[],
  activations?: Record<string, number>,
): SkillHealth[] {
  return skills.map((s) => {
    const weak = !s.description || s.description.trim().length < WEAK_DESCRIPTION_MIN_CHARS;
    const count = activations?.[s.name];
    let status: SkillStatus;
    if (count !== undefined && count === 0) status = "dead";
    else if (weak) status = "weak-description";
    else if (count === undefined) status = "unknown";
    else status = "healthy";
    return {
      name: s.name,
      activations: count ?? 0,
      status,
      ...(weak ? { suggestion: suggestDescription(s.name) } : {}),
    };
  });
}
