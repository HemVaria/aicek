# @aicek/core

The configuration intelligence engine behind [AICEK](https://github.com/HemVaria/aicek).

Pure functions, zero CLI dependencies:

```ts
import { detect, classify, score, recommend } from "@aicek/core";
```

- **detect** — build a normalized `ConfigInventory` from a project
- **classify** — decide where each instruction should live, and why
- **score** — a deterministic 0–100 health score across five pillars
- **recommend** — fixes with estimated token savings and health gains

Every number is an estimate labeled with a confidence level. Determinism is
guaranteed: identical input → byte-identical score and reasons.

> Pre-release. See [PRD.md](https://github.com/HemVaria/aicek/blob/main/PRD.md)
> and [docs/methodology.md](https://github.com/HemVaria/aicek/blob/main/docs/methodology.md).
