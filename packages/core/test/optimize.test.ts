import { describe, it, expect } from "vitest";
import { planOptimize } from "../src/optimize.js";
import type { ConfigInventory, SkillEntry } from "../src/types.js";

function inv(p: Partial<ConfigInventory> = {}): ConfigInventory {
  return {
    root: "/proj",
    stack: ["node"],
    agent: "claude-code",
    rules: [],
    skills: [],
    hooks: [],
    mcpServers: [],
    ignoreFiles: [],
    ...p,
  };
}
const skill = (name: string): SkillEntry => ({
  path: `.claude/skills/${name}/SKILL.md`,
  content: "x",
  bytes: 1,
  name,
  description: "desc",
});

describe("planOptimize", () => {
  it("adds .gitignore when missing", () => {
    const plan = planOptimize(inv());
    const add = plan.changes.find((c) => c.kind === "add-ignore");
    expect(add).toBeDefined();
    expect(add!.write!.content).toMatch(/node_modules\//);
  });

  it("does not add .gitignore when one exists", () => {
    const plan = planOptimize(inv({ ignoreFiles: [{ path: ".gitignore", content: "x", bytes: 1 }] }));
    expect(plan.changes.some((c) => c.kind === "add-ignore")).toBe(false);
  });

  it("archives only dead skills passed in", () => {
    const plan = planOptimize(inv({ skills: [skill("alive"), skill("dead")] }), { deadSkills: ["dead"] });
    const archived = plan.changes.filter((c) => c.kind === "archive-skill").map((c) => c.archive!.name);
    expect(archived).toEqual(["dead"]);
  });

  it("aggregates estimated savings + health gain", () => {
    const plan = planOptimize(inv({ skills: [skill("dead")] }), { deadSkills: ["dead"] });
    expect(plan.estHealthGain).toBeGreaterThan(0);
    expect(plan.changes.length).toBe(2); // add-ignore + archive dead
  });
});
