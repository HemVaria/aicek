/**
 * 7.3 Health scoring — the KPI (PRD §10).
 *
 * Pure and deterministic: starts at 100, each of the five pillars deducts from
 * its own budget, deductions sum and clamp to [0, 100]. Every deduction carries
 * a reason and an evidence pointer. No clocks, no RNG, no filesystem-ordering
 * dependence (the inventory is already sorted by `detect`).
 *
 * Pillar weights (PRD §10.2) are v1 initial values; changing them — or any
 * deduction constant below — bumps ENGINE_VERSION so historical scores stay
 * comparable. All constants are documented in docs/methodology.md §3.
 */
import type {
  ConfigInventory,
  Deduction,
  Evidence,
  HealthScore,
  PillarName,
  PillarResult,
} from "./types.js";
import { tokensOf } from "./estimate.js";
import { classify } from "./classify.js";

/** Initial pillar budgets (v1). Changing these bumps ENGINE_VERSION. */
export const PILLAR_WEIGHTS: Record<PillarName, number> = {
  "context-economy": 30,
  "routing-correctness": 25,
  "skill-effectiveness": 20,
  "structural-hygiene": 15,
  "redundancy-overlap": 10,
};

// --- Deduction constants (documented in docs/methodology.md §3) --------------
export const CLAUDE_MD_BUDGET_TOKENS = 1200; // always-on CLAUDE.md soft budget
export const CLAUDE_MD_OVERAGE_PER = 250; // tokens over budget per 1 point
export const ALWAYS_ON_RULE_BUDGET_TOKENS = 400;
export const ALWAYS_ON_RULE_OVERAGE_PER = 250;
export const ROUTING_PER_MISPLACED = 4; // points per CLAUDE.md block that belongs elsewhere
export const SKILL_WEAK_DESCRIPTION = 5; // points per skill with a weak/empty description
export const SKILL_WEAK_MIN_CHARS = 20;
export const STRUCT_NO_IGNORE = 5;
export const STRUCT_NO_CLAUDE_MD = 4;
export const REDUNDANCY_PER_DUPLICATE = 3;

/**
 * Assemble a pillar result, capping deductions cumulatively to the pillar's
 * budget so it can never go negative (PRD §10.3). Zero-point deductions (budget
 * already exhausted) are dropped to keep the report clean.
 */
function buildPillar(pillar: PillarName, raw: Deduction[]): PillarResult {
  const max = PILLAR_WEIGHTS[pillar];
  let remaining = max;
  const deductions: Deduction[] = [];
  for (const d of raw) {
    const points = Math.min(d.points, remaining);
    if (points <= 0) continue;
    remaining -= points;
    deductions.push({ ...d, points });
  }
  return { pillar, score: remaining, max, deductions };
}

const tokensOfFile = (content: string): number => tokensOf(content);

// --- Pillar 1: Context Economy ----------------------------------------------
function contextEconomy(inv: ConfigInventory): Deduction[] {
  const out: Deduction[] = [];
  if (inv.claudeMd) {
    const t = tokensOfFile(inv.claudeMd.content);
    if (t > CLAUDE_MD_BUDGET_TOKENS) {
      out.push({
        id: "ctx-claude-md-over-budget",
        points: Math.ceil((t - CLAUDE_MD_BUDGET_TOKENS) / CLAUDE_MD_OVERAGE_PER),
        reason: `CLAUDE.md is ~${t} tokens, over the ${CLAUDE_MD_BUDGET_TOKENS}-token always-on budget — it loads every session.`,
        evidence: { file: inv.claudeMd.path },
      });
    }
  }
  const alwaysOn = inv.rules.filter((r) => r.globs.length === 0);
  const ruleTokens = alwaysOn.reduce((s, r) => s + tokensOfFile(r.content), 0);
  if (ruleTokens > ALWAYS_ON_RULE_BUDGET_TOKENS) {
    out.push({
      id: "ctx-always-on-rules",
      points: Math.ceil((ruleTokens - ALWAYS_ON_RULE_BUDGET_TOKENS) / ALWAYS_ON_RULE_OVERAGE_PER),
      reason: `${alwaysOn.length} always-on rule(s) add ~${ruleTokens} tokens to every session (budget ${ALWAYS_ON_RULE_BUDGET_TOKENS}). Path-scope them.`,
      evidence: { file: alwaysOn[0]?.path ?? ".claude/rules" },
    });
  }
  return out;
}

// --- Pillar 2: Routing Correctness ------------------------------------------
function routingCorrectness(inv: ConfigInventory): Deduction[] {
  if (!inv.claudeMd) return [];
  const claudeMdPath = inv.claudeMd.path;
  const misplaced = classify(inv).filter(
    (c) => c.evidence?.file === claudeMdPath && c.location !== "claude-md",
  );
  return misplaced.map((c, i) => ({
    id: `route-${i}-${c.location}`,
    points: ROUTING_PER_MISPLACED,
    reason: `In CLAUDE.md but classified as ${c.location.toUpperCase()}: "${c.item}". ${c.reason}`,
    evidence: c.evidence ?? { file: claudeMdPath },
  }));
}

// --- Pillar 3: Skill Effectiveness ------------------------------------------
function skillEffectiveness(inv: ConfigInventory): Deduction[] {
  return inv.skills
    .filter((s) => !s.description || s.description.trim().length < SKILL_WEAK_MIN_CHARS)
    .map((s) => ({
      id: `skill-weak-desc-${s.name}`,
      points: SKILL_WEAK_DESCRIPTION,
      reason: `Skill "${s.name}" has a weak/empty description (${s.description.trim().length} chars) — agents invoke skills by description, so it may never activate.`,
      evidence: { file: s.path },
    }));
}

// --- Pillar 4: Structural Hygiene -------------------------------------------
function structuralHygiene(inv: ConfigInventory): Deduction[] {
  const out: Deduction[] = [];
  if (inv.ignoreFiles.length === 0) {
    out.push({
      id: "struct-no-ignore",
      points: STRUCT_NO_IGNORE,
      reason: "No .gitignore/.claudeignore found — the agent may read build junk, secrets, or vendored code into context.",
      evidence: { file: inv.root },
    });
  }
  if (!inv.claudeMd) {
    out.push({
      id: "struct-no-claude-md",
      points: STRUCT_NO_CLAUDE_MD,
      reason: "No CLAUDE.md — the project has no always-on guidance for the agent.",
      evidence: { file: inv.root },
    });
  }
  return out;
}

// --- Pillar 5: Redundancy & Overlap -----------------------------------------
function redundancyOverlap(inv: ConfigInventory): Deduction[] {
  const items = classify(inv);
  const seen = new Map<string, { count: number; evidence: Evidence }>();
  for (const c of items) {
    const key = c.item.trim().toLowerCase();
    if (!key) continue;
    const prev = seen.get(key);
    if (prev) prev.count += 1;
    else seen.set(key, { count: 1, evidence: c.evidence ?? { file: inv.root } });
  }
  const out: Deduction[] = [];
  for (const [key, { count, evidence }] of seen) {
    if (count > 1) {
      out.push({
        id: `dup-${key.slice(0, 40)}`,
        points: REDUNDANCY_PER_DUPLICATE * (count - 1),
        reason: `Duplicate/near-duplicate instruction "${key.slice(0, 60)}" appears ${count} times — consolidate to cut repeated context.`,
        evidence,
      });
    }
  }
  return out;
}

/**
 * Compute the 0–100 configuration health score across the five pillars.
 * Pure and deterministic: identical inventory → identical score and reasons.
 */
export function score(inventory: ConfigInventory): HealthScore {
  const pillars: PillarResult[] = [
    buildPillar("context-economy", contextEconomy(inventory)),
    buildPillar("routing-correctness", routingCorrectness(inventory)),
    buildPillar("skill-effectiveness", skillEffectiveness(inventory)),
    buildPillar("structural-hygiene", structuralHygiene(inventory)),
    buildPillar("redundancy-overlap", redundancyOverlap(inventory)),
  ];
  const total = pillars.reduce((s, p) => s + p.score, 0);
  return { total: Math.max(0, Math.min(100, total)), pillars };
}
