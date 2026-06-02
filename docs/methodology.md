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
it. All outputs carry a confidence level. Implemented in
`packages/core/src/estimate.ts`.

```
tokensOf(text) = ceil( ceil(utf8Bytes(text) / 4) × multiplier )
multiplier = 1.15 if the block looks like code/markdown, else 1.0
```

| Constant | Value | Confidence | Justification |
|---|---|---|---|
| `BYTES_PER_TOKEN` | `4` | medium | Common rule-of-thumb for English text under BPE tokenizers (~4 chars/token, ~1 byte/char for ASCII). Cross-agent, so a heuristic not a measurement; a vendored tokenizer can later raise this to **high**. |
| `PROSE_MULTIPLIER` | `1.0` | medium | Prose is the baseline the 4-bytes ratio is calibrated against. |
| `CODE_MULTIPLIER` | `1.15` | medium | Code and markdown tables carry more punctuation per byte (`{}`, `|`, `;`, operators), which BPE splits into more tokens — empirically ~10–20% denser than prose. |
| `DEFAULT_SESSIONS_PER_DAY` | `10` | low | User-supplied projection input; the default only seeds `perDayTax` when the user gives no value. Projection, never a measurement. |

**Confidence levels:** **high** = deterministic byte/char measurement; **medium**
= heuristic ratio; **low** = behavioral projection. A vendored tokenizer may later
raise specific estimates to high.

**Code/markdown detection** (`looksLikeCodeOrMarkdown`) is deterministic and
content-only: a block is treated as code/markdown if it contains a fenced code
block (```` ``` ````), a markdown table separator row (`| --- |`), or a
multi-column table body row. Everything else is prose.

**Composed estimators** (all pure functions of the `ConfigInventory`):

| Estimator | Formula | Confidence |
|---|---|---|
| `alwaysOnContext` | `tokensOf(CLAUDE.md) + Σ tokensOf(always-loaded rule)` | medium |
| `perSessionTax` | `= alwaysOnContext` (paid once per session) | medium |
| `perDayTax(sessions)` | `perSessionTax × sessions` (default 10) | low |

An "always-loaded rule" is a rule with no path globs. Sums sort their inputs
first, so the result is independent of file/array ordering (determinism, §3).

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
