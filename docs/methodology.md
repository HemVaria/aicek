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

| Pillar | Weight | What it measures |
|---|---|---|
| Context Economy | 30 | Cost of always-on context |
| Routing Correctness | 25 | Is each instruction in the right place? |
| Skill Effectiveness | 20 | Do skills earn their keep? |
| Structural Hygiene | 15 | Is the setup well-formed? |
| Redundancy & Overlap | 10 | Duplication & conflict |

Implemented in `packages/core/src/score.ts`. Each pillar emits `Deduction`s
(`{ id, points, reason, evidence }`); points are capped cumulatively to the
pillar budget so a pillar **never goes negative** (PRD §10.3). `total =
Σ pillar.score`, clamped to `[0, 100]`.

### 3.1 Deduction rules (v1 constants — changing any bumps `ENGINE_VERSION`)

**Context Economy** — `CLAUDE.md` over `1200` always-on tokens deducts
`ceil(overage / 250)`; always-on rules (no globs) over `400` tokens deduct
`ceil(overage / 250)`.

**Routing Correctness** — runs the classifier (§4) over CLAUDE.md blocks; every
block whose ideal destination is **not** CLAUDE.md (i.e. a skill/rule/hook/mcp
squatting in always-on context) deducts `4`, with the classifier's reason as
evidence.

**Skill Effectiveness** — each skill with an empty or `<20`-char description
deducts `5` (agents invoke skills by description; a weak one may never activate).

**Structural Hygiene** — no `.gitignore`/`.claudeignore` deducts `5`; no
`CLAUDE.md` deducts `4`.

**Redundancy & Overlap** — duplicate/near-duplicate instruction blocks (matched
by normalized first line) deduct `3` per extra occurrence.

### 3.2 Determinism guarantees
No `Date.now()`, no `Math.random()`; the inventory is already sorted by `detect`,
and items are processed in document order. Property: identical `ConfigInventory`
→ identical score and reasons (covered by a test).

> Note (v1): the Routing pillar can over-penalize legitimately-global routing
> instructions that merely *mention* external tools (they trip the MCP signal).
> This is tracked for threshold tuning; the score stays honest and every
> deduction is explained, so nothing is hidden.

---

## 4. Classification taxonomy (PRD §11)

Five destinations — CLAUDE.md, Skill, Rule (path-scoped), Hook, MCP — chosen from
six signals, each scored 0–1 from the text alone. Implemented in
`packages/core/src/classify.ts`. The classifier always returns the deciding
signals so users see *why*.

### 4.1 Signals (0–1)

| Signal | Heuristic |
|---|---|
| `length` | `min(1, tokensOf(text) / 200)` |
| `procedural` | `min(1, (# numbered items + # bullets + # imperative-leading lines) / 5)` |
| `pathSpecificity` | `min(1, (# globs `**/`,`*.ext` + dir tokens `src/`,`tests/`… + filenames-with-ext) / 3)` |
| `enforcementIntent` | `min(1, # of {always, must, never, required, ensure, do not, after/before every} / 2)` |
| `frequency` | `clamp(1 − 0.5·pathSpecificity − 0.3·conditionality − 0.5·procedural − 0.2·length, 0, 1)` |
| `externality` | `min(1, # of {api, database, http, fetch, endpoint, mcp, server, service, webhook, oauth, token, url, URLs} / 2)` |

`conditionality` counts `{when, if, only when, in case, unless, "for … files"}`.
The key modeling choice: **always-on relevance (`frequency`) erodes with
procedural bulk** — a long multi-step how-to is needed on demand, not every turn —
so `procedural` and `length` pull `frequency` down. This is what lets a release
runbook route to a Skill instead of squatting in CLAUDE.md.

### 4.2 Decision table (ordered; first match wins — PRD §11.2)

1. `enforcementIntent ≥ 0.5` **and** an event trigger (`after/before … commit/save/push/build`) → **Hook**
2. `procedural ≥ 0.5` **and** `frequency < 0.5` → **Skill**
3. `pathSpecificity ≥ 0.5` → **Rule (path-scoped)**
4. `externality ≥ 0.5` → **MCP**
5. otherwise (short, declarative, broadly relevant) → **CLAUDE.md**

Thresholds are named constants in `classify.ts` (`ENFORCEMENT_THRESHOLD`,
`PROCEDURAL_THRESHOLD`, `FREQUENCY_LOW`, `PATH_THRESHOLD`,
`EXTERNALITY_THRESHOLD`); changing them bumps `ENGINE_VERSION`.

### 4.3 Item extraction

CLAUDE.md is split into heading-delimited blocks (fallback: blank-line
paragraphs); each rule body is one item. Items are processed in document order
for determinism, and each carries an `evidence` pointer (file + line).

---

## 5. Recommendations (PRD §13)

`recommend(inventory, score)` maps every scored deduction to an actionable fix.
Implemented in `packages/core/src/recommend.ts`.

Each recommendation has: `severity` (P0–P3, by health-gain points: ≥8 P0, ≥5 P1,
≥3 P2, else P3), `issue` (the deduction reason), `fix` (concrete action),
`estTokenSaving` (`{value, confidence}`), `estHealthGain` (`{points, pillar}`),
and `reversible`.

**Honest savings.** A token saving is computed only where it is real and
measurable — Context Economy overages (CLAUDE.md trim, rule scoping) report the
actual overage at **medium** confidence. Fixes that don't remove always-on tokens
(rewriting a skill description, adding an ignore file, relocating a block whose
token count we don't carry) report `0` at **low** confidence rather than inventing
a number (PRD §20).

**Reversibility.** Fixes `optimize` can apply and undo are `reversible: true`;
fixes requiring human authoring (writing a skill description, writing a new
CLAUDE.md) are `reversible: false`.

**Ordering.** Sorted by `estHealthGain.points` desc, then `estTokenSaving.value`
desc — highest-impact first.
