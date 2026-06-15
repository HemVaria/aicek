import { describe, it, expect } from "vitest";
import { generateIgnore, generateClaudeMd, planInit } from "../src/generate.js";
import { findEntry } from "../src/registry.js";
import type { ConfigInventory } from "../src/types.js";

function inv(p: Partial<ConfigInventory> = {}): ConfigInventory {
  return {
    root: "/proj",
    stack: [],
    agent: "claude-code",
    rules: [],
    skills: [],
    hooks: [],
    mcpServers: [],
    ignoreFiles: [],
    ...p,
  };
}

describe("generateIgnore", () => {
  it("includes stack-specific ignores", () => {
    const out = generateIgnore(["node", "python"]);
    expect(out).toMatch(/node_modules\//);
    expect(out).toMatch(/__pycache__\//);
  });
});

describe("generateClaudeMd", () => {
  it("lists the stack and credits selected tools", () => {
    const c = generateClaudeMd(["node"], [findEntry("Context7")!]);
    expect(c).toMatch(/## Stack/);
    expect(c).toMatch(/- node/);
    expect(c).toMatch(/Context7 by upstash/);
  });
});

describe("planInit", () => {
  it("creates CLAUDE.md + .gitignore for an empty project", () => {
    const plan = planInit(inv({ stack: ["node"] }), []);
    const paths = plan.files.map((f) => f.path);
    expect(paths).toContain("CLAUDE.md");
    expect(paths).toContain(".gitignore");
    expect(plan.files.find((f) => f.path === "CLAUDE.md")!.action).toBe("create");
    expect(plan.estClaudeMdTokens).toBeGreaterThan(0);
  });

  it("marks CLAUDE.md overwrite when one already exists", () => {
    const plan = planInit(
      inv({ claudeMd: { path: "CLAUDE.md", content: "old", bytes: 3 } }),
      [],
    );
    expect(plan.files.find((f) => f.path === "CLAUDE.md")!.action).toBe("overwrite");
  });

  it("resolves selected entries, drops unknown, and emits credits + installs", () => {
    const plan = planInit(inv({ stack: ["node"] }), ["Context7", "Caveman", "does-not-exist"]);
    expect(plan.selected.map((e) => e.name).sort()).toEqual(["Caveman", "Context7"]);
    expect(plan.installs.length).toBe(2);
    expect(plan.credits.some((c) => c.includes("Context7"))).toBe(true);
  });

  it("is deterministic", () => {
    const i = inv({ stack: ["node"] });
    expect(planInit(i, ["Context7"])).toEqual(planInit(i, ["Context7"]));
  });
});
