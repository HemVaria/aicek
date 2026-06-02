/**
 * 7.5 Recommendations (PRD §13).
 *
 * Turn each scored deduction into an actionable fix carrying an estimated token
 * saving and an estimated health gain. Sorted by estHealthGain desc, then
 * estTokenSaving desc, so the highest-impact fix is first.
 *
 * Pure and deterministic. Token savings are honest: a real saving is computed
 * only where it can be (Context Economy overages); fixes that don't remove
 * always-on tokens (e.g. rewriting a skill description) report 0 with low
 * confidence rather than inventing a number (PRD §20).
 */
import type {
  Confidence,
  ConfigInventory,
  Deduction,
  HealthScore,
  PillarName,
  Recommendation,
  Severity,
} from "./types.js";
import { tokensOf } from "./estimate.js";
import {
  ALWAYS_ON_RULE_BUDGET_TOKENS,
  CLAUDE_MD_BUDGET_TOKENS,
} from "./score.js";

function severityOf(points: number): Severity {
  if (points >= 8) return "P0";
  if (points >= 5) return "P1";
  if (points >= 3) return "P2";
  return "P3";
}

/** Location named in a routing deduction reason ("…classified as HOOK: …"). */
function routedLocation(reason: string): string {
  const m = /classified as ([A-Z-]+)/.exec(reason);
  return m?.[1] ?? "elsewhere";
}

interface FixPlan {
  fix: string;
  saving: number;
  confidence: Confidence;
  reversible: boolean;
}

/** Map a deduction to a concrete fix + token-saving estimate. */
function planFor(d: Deduction, inv: ConfigInventory): FixPlan {
  // Context Economy — real, computable savings.
  if (d.id === "ctx-claude-md-over-budget" && inv.claudeMd) {
    const saving = Math.max(0, tokensOf(inv.claudeMd.content) - CLAUDE_MD_BUDGET_TOKENS);
    return {
      fix: "Trim CLAUDE.md back under budget: move long or procedural sections into on-demand skills or path-scoped rules, and cut anything not always relevant.",
      saving,
      confidence: "medium",
      reversible: true,
    };
  }
  if (d.id === "ctx-always-on-rules") {
    const ruleTokens = inv.rules
      .filter((r) => r.globs.length === 0)
      .reduce((s, r) => s + tokensOf(r.content), 0);
    return {
      fix: "Add `globs:` frontmatter to these rules so they load only for matching files instead of every session.",
      saving: Math.max(0, ruleTokens - ALWAYS_ON_RULE_BUDGET_TOKENS),
      confidence: "medium",
      reversible: true,
    };
  }

  // Routing — moving a block out of always-on context saves tokens, but we don't
  // carry the block's token count on the deduction, so report low-confidence 0.
  if (d.id.startsWith("route-")) {
    const loc = routedLocation(d.reason);
    const where: Record<string, string> = {
      HOOK: "Convert this enforcement into a hook in .claude/settings.json so it runs automatically.",
      SKILL: "Move this into a Skill at .claude/skills/<name>/SKILL.md with a clear, trigger-rich description.",
      RULE: "Move this into a path-scoped rule under .claude/rules with `globs:` frontmatter.",
      MCP: "Expose this capability through an MCP server instead of static instructions in CLAUDE.md.",
    };
    return {
      fix: where[loc] ?? "Relocate this block out of always-on CLAUDE.md to its proper destination.",
      saving: 0,
      confidence: "low",
      reversible: true,
    };
  }

  if (d.id.startsWith("skill-weak-desc")) {
    return {
      fix: "Rewrite the skill description to name concrete triggers (when it should activate, on what inputs) so the agent actually invokes it.",
      saving: 0,
      confidence: "low",
      reversible: false,
    };
  }
  if (d.id === "struct-no-ignore") {
    return {
      fix: "Add a .gitignore (and/or .claudeignore) covering build output, dependencies, and secrets so they stay out of context.",
      saving: 0,
      confidence: "low",
      reversible: true,
    };
  }
  if (d.id === "struct-no-claude-md") {
    return {
      fix: "Add a short CLAUDE.md with always-relevant project facts (stack, conventions, entry points).",
      saving: 0,
      confidence: "low",
      reversible: false,
    };
  }
  if (d.id.startsWith("dup-")) {
    return {
      fix: "Consolidate the duplicate/near-duplicate instruction into a single source of truth.",
      saving: 0,
      confidence: "low",
      reversible: true,
    };
  }
  return { fix: "Address the issue described.", saving: 0, confidence: "low", reversible: true };
}

/**
 * Produce ranked recommendations from a computed health score.
 * Sorted by estimated health gain (desc), then estimated token saving (desc).
 */
export function recommend(
  inventory: ConfigInventory,
  health: HealthScore,
): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const pillar of health.pillars) {
    for (const d of pillar.deductions) {
      const plan = planFor(d, inventory);
      recs.push({
        id: `rec-${d.id}`,
        severity: severityOf(d.points),
        issue: d.reason,
        fix: plan.fix,
        estTokenSaving: { value: plan.saving, confidence: plan.confidence },
        estHealthGain: { points: d.points, pillar: pillar.pillar as PillarName },
        reversible: plan.reversible,
      });
    }
  }
  recs.sort(
    (a, b) =>
      b.estHealthGain.points - a.estHealthGain.points ||
      b.estTokenSaving.value - a.estTokenSaving.value,
  );
  return recs;
}
