import { describe, it, expect } from "vitest";
import { classify, signalsOf } from "../src/classify.js";
import type { ConfigInventory } from "../src/types.js";

function inv(claudeMdContent: string): ConfigInventory {
  return {
    root: "/x",
    stack: [],
    agent: "claude-code",
    claudeMd: { path: "CLAUDE.md", content: claudeMdContent, bytes: Buffer.byteLength(claudeMdContent) },
    rules: [],
    skills: [],
    hooks: [],
    mcpServers: [],
    ignoreFiles: [],
  };
}

// Single-block inventories so each maps to one classification.
function classifyOne(text: string) {
  const out = classify(inv(text));
  expect(out.length).toBe(1);
  return out[0]!;
}

describe("signalsOf", () => {
  it("keeps every signal within [0,1]", () => {
    const s = signalsOf("Always run prettier and eslint after every commit. Must never skip.");
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("scores procedural higher for step lists than for a declarative fact", () => {
    const steps = signalsOf("1. Run build\n2. Run tests\n3. Deploy\n4. Verify\n5. Tag release");
    const fact = signalsOf("This project uses TypeScript and pnpm.");
    expect(steps.procedural).toBeGreaterThan(fact.procedural);
  });
});

describe("classify — destinations (PRD §11)", () => {
  it("enforcement + event trigger → hook", () => {
    const c = classifyOne("Always run prettier and eslint after every commit. You must never skip this.");
    expect(c.location).toBe("hook");
    expect(c.reason).toMatch(/hook/i);
  });

  it("procedural + intermittent → skill", () => {
    const c = classifyOne(
      "Releasing a new version:\n1. Bump the version\n2. Run the build\n3. Generate changelog\n4. Create a git tag\n5. Publish to npm\nDo this only when cutting a release.",
    );
    expect(c.location).toBe("skill");
  });

  it("path-specific → rule", () => {
    const c = classifyOne(
      "For files in src/api/**/*.ts use the repository pattern and keep controllers thin in src/controllers/.",
    );
    expect(c.location).toBe("rule");
  });

  it("external capability → mcp", () => {
    const c = classifyOne(
      "Fetch billing data from the Stripe API endpoint and our internal payments service over http.",
    );
    expect(c.location).toBe("mcp");
  });

  it("short declarative global fact → claude-md", () => {
    const c = classifyOne("This project uses TypeScript and pnpm.");
    expect(c.location).toBe("claude-md");
  });

  it("always returns a non-empty reason and bounded signals", () => {
    const c = classifyOne("This project uses TypeScript and pnpm.");
    expect(c.reason.length).toBeGreaterThan(0);
    expect(c.item.length).toBeGreaterThan(0);
    expect(c.evidence.file).toBe("CLAUDE.md");
  });
});

describe("classify — whole document", () => {
  const doc = [
    "# Stack",
    "This project uses TypeScript and pnpm.",
    "",
    "# Releasing",
    "Steps to cut a release, only when shipping:",
    "1. Bump version",
    "2. Build",
    "3. Publish to npm",
    "4. Tag",
    "5. Announce",
    "",
    "# Formatting",
    "Always run prettier after every commit; you must never push unformatted code.",
  ].join("\n");

  it("splits headings into separate items and classifies the mix", () => {
    const out = classify(inv(doc));
    expect(out.length).toBe(3);
    const byLoc = out.map((c) => c.location);
    expect(byLoc).toContain("claude-md");
    expect(byLoc).toContain("skill");
    expect(byLoc).toContain("hook");
  });

  it("is deterministic", () => {
    expect(classify(inv(doc))).toEqual(classify(inv(doc)));
  });
});
