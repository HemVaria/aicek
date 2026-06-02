# AICEK Methodology

> Status: **Stage 0 stub.** This document is written *alongside* the scoring
> engine (Stage 1), not after. Every weight, constant, and rule below is filled
> in as the corresponding engine code lands, with a citation to the source that
> justifies it. Until then, sections are placeholders describing what will be
> documented.

The purpose of this document is **auditability**: every number AICEK prints can
be traced back to a rule and a justification here. Nothing in the score is a
black box (PRD §20).

---

## 1. Versioning

- **Schema version** (`SCHEMA_VERSION`) — the shape of the audit artifact
  (PRD §14). Bumped on any structural change.
- **Engine version** (`ENGINE_VERSION`) — the scoring engine: pillar weights and
  estimator constants. Bumped whenever a change would alter the score for
  identical input, so historical scores remain comparable.

Both are committed in `packages/core/src/version.ts`.

---

## 2. Token estimation (PRD §12)

`tokensOf(text)` is the single source of truth; every other estimator composes
it. All outputs carry a confidence level.

| Constant | Value | Confidence | Justification |
|---|---|---|---|
| bytes-per-token ratio | `4` (baseline) | medium | _TBD — cite tokenizer behavior._ |
| prose multiplier | `1.0` | medium | _TBD._ |
| code / markdown-table multiplier | `1.15` | medium | _TBD._ |
| default sessions/day | `10` | low | _TBD — user-supplied; projection only._ |

Confidence levels: **high** = deterministic byte/char measurement; **medium** =
heuristic ratio; **low** = behavioral projection. A vendored tokenizer may later
raise specific estimates to high.

---

## 3. Health score pillars (PRD §10.2)

Score starts at 100; each pillar deducts from its own budget; deductions sum and
clamp to `[0, 100]`. Every deduction carries a `reason` and an `evidence`
pointer.

| Pillar | Weight | What it measures | Justification |
|---|---|---|---|
| Context Economy | 30 | Cost of always-on context | _TBD._ |
| Routing Correctness | 25 | Is each instruction in the right place? | _TBD._ |
| Skill Effectiveness | 20 | Do skills earn their keep? | _TBD._ |
| Structural Hygiene | 15 | Is the setup well-formed? | _TBD._ |
| Redundancy & Overlap | 10 | Duplication & conflict | _TBD._ |

Determinism guarantees: no `Date.now()`, no `Math.random()`, inputs sorted before
scoring; identical inventory → byte-identical score and reasons.

---

## 4. Classification taxonomy (PRD §11)

Five destinations — CLAUDE.md, Skill, Rule (path-scoped), Hook, MCP — chosen from
six signals (length, procedural, path-specificity, enforcement intent, frequency,
externality), each scored 0–1.

The full signal-to-destination rule table is documented here as the classifier
is implemented. The classifier always returns the deciding signals so users see
*why*.
