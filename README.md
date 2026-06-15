<div align="center">

# aicek

**The configuration intelligence layer for AI coding agents.**

```
npx aicek doctor
```

*Install less. Use better. Measure everything.*

</div>

---

## What is configuration intelligence?

The ecosystem only teaches one move: install more skills. Nobody tells you which
instructions belong in `CLAUDE.md` versus a skill, a rule, a hook, or an MCP —
which skills never activate, or what always-on context costs you per session.

**aicek is the doctor for your AI coding setup.** It reads your configuration,
scores it, explains every deduction, and tells you exactly what to change. It is
*not* a skill installer.

## The Health Score

A single **0–100** score, deterministic, across five pillars — every deduction
carries a reason and a file pointer:

| Pillar | Weight | Measures |
|---|---:|---|
| Context Economy | 30 | Cost of always-on context |
| Routing Correctness | 25 | Is each instruction in the right place? |
| Skill Effectiveness | 20 | Do your skills earn their keep? |
| Structural Hygiene | 15 | Is the setup well-formed? |
| Redundancy & Overlap | 10 | Duplication & conflict |

> Every number aicek prints is an **estimate**, labeled with a confidence level.
> The score is a projection to guide decisions, not a guarantee.

## Quickstart

```bash
npx aicek doctor            # read-only health report (start here)
npx aicek doctor --json     # the audit artifact, for CI / tooling
npx aicek doctor --html     # a shareable HTML report
npx aicek marketplace       # tools aicek recommends
npx aicek init              # generate a clean CLAUDE.md + ignore config
npx aicek skills            # which skills are dead or weakly described
npx aicek optimize          # apply safe, reversible fixes
```

## Example

```
  aicek doctor  ·  /your/project

  Configuration Health   65/100   [FAIR]
  ██████████░░░░░░

  Pillars
    Context Economy        ████████████████ 30/30
    Routing Correctness    ░░░░░░░░░░░░░░░░ 0/25     7 issues
    Skill Effectiveness    ████████████░░░░ 15/20    1 issue
    ...

  Top recommendations
    P1 +5 Rewrite the skill description to name concrete triggers …
    P1 +5 Add a .gitignore covering build output, deps, and secrets …

  ✓ Read-only — nothing was changed.
```

## Safety

- `doctor`, `marketplace`, and `skills` are **read-only**.
- `init` and `optimize` write only after a confirmation (or `--yes` for CI), and
  `--dry-run` shows the plan without touching anything.
- `optimize` archives originals first — undo any change with `aicek restore <name>`.

## Methodology

Every weight, constant, and rule is public and auditable in
[docs/methodology.md](docs/methodology.md). The audit artifact schema lives at
[packages/core/schema/audit.schema.json](packages/core/schema/audit.schema.json).

## Related tools

aicek points to good tools instead of hoarding them — see the
[marketplace](registry/registry.json): **OpenSpec** (planning), **Caveman**
(token compression), **Graphify** (context), **Impeccable** (design),
**Context7** (docs), and more. Each is credited to its owner.

## Contributing & license

MIT © Hem Varia. Issues and PRs welcome at
[github.com/HemVaria/aicek](https://github.com/HemVaria/aicek).

> Pre-release. The engine (`@aicek/core`) is fully implemented, deterministic,
> and tested; see [PRD.md](PRD.md) for the roadmap.
