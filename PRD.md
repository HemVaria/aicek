# AICEK — Product Requirements Document

**Version:** 3.0.0
**Package:** `aicek` (npm, claimed — v0.0.1 placeholder live)
**Command:** `npx aicek`
**One-liner:** The configuration intelligence layer for AI coding agents.
**Status:** Pre-release. Stage 0–1 in progress (see BUILD_TRACKING / tracker).

> Naming note: the product, package, command, brand, repo, and all docs use
> **aicek** (lowercase) / **AICEK** (display). The legacy `ccek` spelling is
> retired; any remaining `ccek` reference is a bug to fix.

---

## 1. Positioning

AICEK is **not** a skill installer, a skill marketplace, a curated collection,
or "a better Antigravity." Those markets are crowded and commoditized.

AICEK creates and owns a new category: **Configuration Intelligence**.

> The doctor for AI coding environments.
> Datadog/Lighthouse for agent configuration — not another skill store.

The primary value is **understanding an AI coding environment and telling the
user what should live where** — and what it costs them when it doesn't.

---

## 2. The Problem

The ecosystem only teaches one move: *install more skills.* Nobody tells a user:

- Which instructions belong in CLAUDE.md vs a skill vs a rule vs a hook vs an MCP
- Which skills should be removed, and which never activate
- Which rules should be path-scoped instead of always-loaded
- Where token waste comes from, and what it costs per session
- Why a given configuration performs poorly

The result: bloated always-on context, duplicated instructions, dead skills, and
silent token tax — with no instrument to measure any of it.

---

## 3. Core Thesis

> **Install less. Use better. Measure everything.**

AICEK is the expert system for AI agent configuration. The **Health Score** and
the **doctor** are the whole product; everything else supports them.

---

## 4. Target Users & Personas

| Persona | Pain | AICEK entry point |
|---|---|---|
| **The Drifter** | Veteran with a sprawling `.claude/` they no longer trust | `aicek doctor` |
| **The Beginner** | Empty project, no idea what to configure | `aicek init` |
| **The Optimizer** | Wants to cut token cost, keep quality | `aicek optimize` |
| **The Team Lead** | Wants a repeatable config standard + CI gate | `aicek doctor --json` |

---

## 5. Product Principles

1. **Doctor first.** Read-only, safe, shareable. It is the front door.
2. **Engine separate from CLI** from day one. `packages/core` never imports CLI.
3. **Every number is an estimate** and is labeled with a confidence level.
4. **Determinism is sacred.** Same input → same score, always. No clocks, no RNG.
5. **Every deduction carries a reason string.** No black-box scores.
6. **Read-only by default.** Writes only on explicit `init`/`optimize` intent.
7. **Attribution always.** Installed entries credit their owner in output + files.

---

## 6. Feature Hierarchy

Old (rejected): Installer → Skills → Optimization.

**New:**

1. Configuration **Analysis** (detection, audit)
2. Configuration **Intelligence** (classification, health score)
3. Configuration **Optimization** (recommendations, applied fixes)
4. Configuration **Monitoring** (drift, skill effectiveness — later)
5. **Skill Management** (a supporting feature, never the product)

---

## 7. The Configuration Intelligence Engine

Lives entirely in `packages/core`. Pure functions, no I/O side effects, no CLI.

```
import { detect, classify, score, recommend } from "@aicek/core"
```

### 7.1 Detection
- **Stack:** from `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`,
  `pom.xml`, `Gemfile`, etc.
- **Existing setup:** `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`,
  `.claude/settings.json`, `.claude/settings.local.json`, ignore files
  (`.gitignore`, `.claudeignore`), hooks, MCP config.
- Output: a normalized `ConfigInventory` object (no scoring yet).

### 7.2 Classification (the moat) — see §11
Given an instruction/config item, decide where it *should* live and **why**.

### 7.3 Health Scoring (the KPI) — see §10
0–100, five pillars, deterministic, every deduction explained.

### 7.4 Recommendations — see §13
Each issue → fix text + estimated token saving + estimated health gain.

### 7.5 Drift Detection *(Phase 2 — parked)*
Score over time; needs history → cold-start problem. Not in v1.

### 7.6 Topology Mapping *(Phase 2 — parked)*
Relationships between skills/rules/hooks/MCPs/CLAUDE.md. Text/tree first.

---

## 8. Commands

| Command | Stage | Writes? | Purpose |
|---|---|---|---|
| `aicek doctor` | 2 (first release) | **No** | Health score, per-pillar bars, top issues, savings |
| `aicek doctor --json` | 2 | No | Emit the audit schema artifact (§14) |
| `aicek doctor --html` | 4 | report file only | Shareable report |
| `aicek doctor --share` | 4 | image only | Health-score card + hashtag |
| `aicek init` | 3 | Yes (confirmed) | Detect → profile → marketplace → generate config |
| `aicek optimize` | 4 | Yes (confirmed) | Apply doctor fixes; reversible archive |
| `aicek restore <name>` | 4 | Yes | Undo an archived skill/fix |

Global flags: `--dry-run`, `--yes` (CI), `--json`.

---

## 9. Architecture

```
aicek/                      (monorepo, npm workspaces)
├─ packages/
│  ├─ core/                 @aicek/core — the engine (zero CLI deps)
│  │  ├─ src/{detect,classify,score,recommend,estimate}.ts
│  │  └─ schema/audit.schema.json
│  └─ cli/                  aicek — thin CLI (@clack/prompts)
│     └─ bin/aicek.js
├─ docs/methodology.md      written alongside the scorer (§10, §11, §12)
└─ PRD.md
```

- Tooling: **TypeScript**, **Vitest**, a `build` script, `prepublishOnly` hook.
- `core` is published independently so Hermes (§19) can consume the schema.
- CLI depends on `core`; **core never depends on CLI**.

---

## 10. Configuration Health Score

### 10.1 Concept
A single 0–100 number — *Lighthouse Score for AI agent configuration.* It is the
core KPI. Pure and deterministic. Starts at 100; each pillar deducts from its own
budget; deductions are summed and clamped to `[0, 100]`. Every deduction returns a
`reason` string and a pointer to the offending file/line.

### 10.2 The Five Pillars (initial weights)

| # | Pillar | Weight | Measures | Example deductions |
|---|---|---|---|---|
| 1 | **Context Economy** | **30** | Cost of always-on context | CLAUDE.md over budget; always-loaded rule bloat; duplicated always-on instructions |
| 2 | **Routing Correctness** | **25** | Is each instruction in the right place? (§11) | Procedural steps stuck in CLAUDE.md; enforcement intent not a hook; global rule that should be path-scoped |
| 3 | **Skill Effectiveness** | **20** | Do skills earn their keep? | Never-activated skill; weak/ambiguous description; overlapping skills |
| 4 | **Structural Hygiene** | **15** | Is the setup well-formed? | Missing ignore config; unscoped rules dir; malformed settings.json; no path globs |
| 5 | **Redundancy & Overlap** | **10** | Duplication & conflict | MCP capability overlap; duplicate rules; conflicting instructions |

Total budget = 100. Weights are **v1 initial values**, versioned in
`docs/methodology.md`; changing them bumps the score-engine version in the audit
artifact so historical scores stay comparable.

### 10.3 Deduction model
Each pillar exposes `evaluate(inventory) → { pillar, score, max, deductions[] }`
where each `deduction = { id, points, reason, evidence: {file, line?} }`.
No deduction may exceed its pillar's remaining budget (pillars never go negative).

### 10.4 Determinism guarantees
- No `Date.now()`, no `Math.random()`, no filesystem ordering dependence
  (sort inputs before scoring).
- Property test: identical `ConfigInventory` → byte-identical score + reasons.

---

## 11. Classification Taxonomy (the moat)

Five destinations. For every instruction, return `{ location, reason }`.

| Destination | When it belongs there | Primary signals |
|---|---|---|
| **CLAUDE.md** | Short, always-relevant, declarative project facts/conventions | Low length · always relevant · declarative · global scope |
| **Skill** | Procedural, multi-step, on-demand, not always needed | High procedural-ness · invoked-by-description · intermittent relevance |
| **Rule (path-scoped)** | Applies only to specific paths/globs | Path-specificity · conditional relevance |
| **Hook** | Enforcement / deterministic automation ("always run X after Y") | Enforcement intent · determinism · event-triggered |
| **MCP** | External capability, integration, or data source | Needs external tool/data access |

### 11.1 Signals (scored 0–1, combined by rules)
- **length** — token size of the instruction block
- **procedural** — imperative multi-step vs single declarative fact
- **path-specificity** — references particular files/dirs/globs
- **enforcement intent** — "always / must / never / after every"
- **frequency** — how often it is actually relevant per session
- **externality** — requires a capability the agent doesn't natively have

### 11.2 Rule sketch (illustrative, see methodology.md for the full table)
- `enforcement ∧ deterministic ∧ event-triggered` → **Hook**
- `procedural ∧ ¬always-relevant` → **Skill**
- `path-specific ∧ conditional` → **Rule (scoped)**
- `externality` → **MCP**
- else (short, declarative, global) → **CLAUDE.md**

Output always includes the deciding signals so the user sees *why*.

---

## 12. Token Estimation

> Every number printed is an **estimate**, labeled with a confidence level.
> AICEK never claims to count tokens exactly without a tokenizer present.

### 12.1 Confidence levels
- **high** — deterministic byte/char measurement
- **medium** — heuristic ratio (chars→tokens)
- **low** — behavioral projection (sessions/day, quality %)

### 12.2 Why estimates, not exact counts
Different agents/models tokenize differently; AICEK is cross-agent. A vendored
tokenizer may later raise specific estimates to **high**; until then ratios are
labeled **medium** and projections **low**.

### 12.3 Estimators

| Estimator | Formula | Confidence |
|---|---|---|
| `tokensOf(text)` | `ceil(utf8Bytes(text) / 4)` baseline; ×1.0 prose, ×1.15 code/markdown tables | **medium** |
| `alwaysOnContext()` | `tokensOf(CLAUDE.md) + Σ tokensOf(always-loaded rule)` | **medium** |
| `perSessionTax()` | `alwaysOnContext()` (loaded every session) | **medium** |
| `perDayTax(sessions)` | `perSessionTax() × sessions` (`sessions` user-supplied, default 10) | **low** |
| `duplicationWaste()` | `Σ tokensOf(instruction)` over detected duplicate/near-duplicate blocks | **medium** |
| `deadSkillWaste()` | `Σ tokensOf(description)` of skills with 0 activations in transcripts | **low** |
| `savingOf(fix)` | tokens removed/relocated by applying a recommendation | **medium** |

`tokensOf` is the single source of truth; all others compose it. The 4-bytes/token
ratio and multipliers are versioned constants in `docs/methodology.md`.

---

## 13. Recommendations

For each detected issue produce:

```
{
  id, severity,              // P0–P3
  issue,                     // human reason
  fix,                       // exact action / generated text
  estTokenSaving,            // number + confidence
  estHealthGain,             // points + which pillar
  reversible                 // bool (optimize can archive/restore)
}
```

Recommendations are sorted by `estHealthGain` desc, then `estTokenSaving` desc.

---

## 14. Audit JSON Schema

Versioned artifact emitted by `aicek doctor --json`. It is the **only** contract
between AICEK and Hermes (§19). Stub committed at
`packages/core/schema/audit.schema.json`. Top-level shape:

```jsonc
{
  "schemaVersion": "1.0.0",
  "engineVersion": "...",        // score-engine version (weights/constants)
  "generatedFor": { "stack": [], "agent": "claude-code" },
  "healthScore": 72,
  "pillars": [ { "pillar": "...", "score": 24, "max": 30, "deductions": [] } ],
  "classification": [ { "item": "...", "location": "skill", "reason": "..." } ],
  "estimates": [ { "name": "perSessionTax", "value": 4800, "confidence": "medium" } ],
  "recommendations": [ /* §13 */ ]
}
```

---

## 15. Roadmap

- **Phase 1 (now):** doctor · audit · optimize · health score · classification engine
- **Phase 2:** skill effectiveness · drift detection · health monitoring
- **Phase 3:** Hermes integration · long-term intelligence · config history
- **Phase 4:** cross-agent — Claude Code, Cursor, Gemini CLI, Codex, Windsurf → universal configuration layer

Parked (do not build in v1): drift detection, topology mapping, the self-diagnosing MCP server, cross-agent support, Discord/community funding.

---

## 16. Competitive Landscape

| Tool | Category | AICEK relationship |
|---|---|---|
| Anthropic Skills / Antigravity | Skill catalogs | Different category; AICEK measures, not sells |
| Awesome-Claude-* directories | Curation | Distribution channels for AICEK |
| Caveman / token compressors | Token cut | Complementary; AICEK can recommend them |
| ccusage | Usage metering | Benchmark for organic growth (1k stars/30d) |

AICEK's moat = classification + health score + reasons. No competitor explains
*where instructions should live and why.*

---

## 17. README Structure (launch)

1. Logo + tagline: *The configuration intelligence layer for AI coding agents.*
2. Hero line: `npx aicek doctor`
3. 30-second demo GIF of the doctor
4. "What is configuration intelligence?" (3 sentences)
5. The Health Score explained (pillars + that every number is an estimate)
6. Quickstart: `doctor` → `init` → `optimize`
7. Example output block (scored, with reasons)
8. Philosophy: *Install less. Use better. Measure everything.*
9. Read-only / safety guarantee
10. Methodology link (`docs/methodology.md`)
11. **Related Tools** cross-traffic section (§18.2)
12. Attribution + contributing + license (MIT)

---

## 18. Distribution & Discovery

### 18.1 GitHub repo metadata
- **About:** "Configuration intelligence for AI coding agents — audit, score, and optimize your Claude Code setup. Read-only doctor + health score."
- **20 Topics:** `claude-code`, `ai-coding`, `configuration`, `cli`, `developer-tools`, `token-optimization`, `anthropic`, `claude`, `cursor`, `windsurf`, `copilot`, `agent`, `llm`, `devtools`, `code-quality`, `linter`, `audit`, `health-score`, `prompt-engineering`, `context-engineering`
- Submit to: `hesreallyhim/awesome-claude-code`, `travisvn/awesome-claude-skills`, VoltAgent, skills.sh.

### 18.2 Related Tools (cross-traffic)
A README section that credits and links complementary tools (OpenSpec, Caveman,
Impeccable, Graphify, ccusage). Drives reciprocal traffic and reinforces the
"install less, use better" stance — AICEK points to good tools instead of hoarding.

---

## 19. Hermes (separate product — never inside aicek)

- AICEK **produces** audits (the §14 JSON).
- Hermes **consumes** audits → generates long-term intelligence.
- The **only** coupling is the versioned audit schema. No shared code, no shared
  release. Hermes is out of scope for this PRD.

---

## 20. Credibility & Claims Policy

- Mark every quantitative claim as an estimate with a confidence level.
- No unverifiable hype ("10x", "guaranteed"). Prefer conservative wording.
- The score and savings are *projections to guide decisions*, not guarantees.
- Methodology is public (`docs/methodology.md`) so numbers are auditable.

---

## 21. Success Metrics

1. GitHub stars — target **1,000 in 30 days** (ccusage benchmark)
2. npm weekly downloads
3. Avg estimated saving per `doctor` run — target **> 3,000 tokens**
4. Marketplace entries (community-grown)
