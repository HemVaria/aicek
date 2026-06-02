# AICEK Marketplace Registry (seed)

This is the seed catalog AICEK's `aicek init` will draw from (PRD Stage 3). It is
**not** the product — the doctor and the health score are. The registry exists so
that beginners starting from zero can assemble a *healthy, attributed* setup, and
so AICEK can point to good tools instead of hoarding skills.

> Philosophy: **Install less. Use better. Measure everything.** Every entry here
> is something AICEK would actively recommend, with a note on how it affects your
> configuration health score.

## Files
- [`registry.json`](registry.json) — the entries.
- [`schema.json`](schema.json) — JSON Schema (draft 2020-12) for an entry.

## Entry fields (PRD Stage 3)
`name · owner · repo_url · category · install_type · install_command ·
token_note · compatible_with · health_impact · attribution_required`

Plus, for trust: `license`, `stars`, `verified` (repo/owner/url/license confirmed
via the GitHub API), and `installVerified` (the exact install command confirmed
from the tool's own docs).

## Current entries

| Tool | Owner | Category | Stars | License | Verified |
|---|---|---|---:|---|:--:|
| OpenSpec | Fission-AI | planning | 52k | MIT | ✅ |
| Caveman | JuliusBrussee | token-compression | 68k | MIT | ✅ |
| Graphify | safishamsi | context | 58k | MIT | ✅ |
| Impeccable | pbakaus | frontend-design | 33k | Apache-2.0 | ✅ |
| Context7 | upstash | context | 57k | MIT | ✅ |
| Claude SEO | AgriciDaniel | seo | 8k | MIT | ✅ |
| Code Review Skill | awesome-skills | code-review | 878 | MIT | ✅ |

`verified: true` on every entry = the repository, owner, URL and license were
confirmed against the GitHub API. `installVerified` is currently `false`
everywhere — the install commands are sensible defaults and must each be checked
against the tool's own README before `aicek init` ships them.

## Attribution policy
**Every installed entry credits its owner** — in AICEK's output and in any files
it generates (PRD §5.7, §18.2). `attribution_required` is `true` for all entries.
AICEK drives reciprocal traffic to these tools rather than re-hosting them.

## Tailored to the user's setup
The seed reflects what this user actually runs: **Impeccable** is the source of
their installed design-skill suite; **Context7** matches their installed
`context7` integration; **Code Review** matches their `code-review` skill. New
categories (SEO, planning, token-compression, context) round out a starter shelf.
