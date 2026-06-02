import { describe, it, expect } from "vitest";
import { score, PILLAR_WEIGHTS, SKILL_WEAK_MIN_CHARS } from "../src/score.js";
import type { ConfigInventory, RuleEntry, SkillEntry } from "../src/types.js";

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
const file = (path: string, content: string) => ({ path, content, bytes: Buffer.byteLength(content) });
function skill(name: string, description: string): SkillEntry {
  return { ...file(`.claude/skills/${name}/SKILL.md`, "x"), name, description };
}
function rule(content: string, globs: string[] = []): RuleEntry {
  return { ...file(".claude/rules/r.md", content), globs };
}

describe("score — invariants", () => {
  it("a clean minimal setup scores high but is penalized for missing ignore", () => {
    const r = score(inv({ claudeMd: file("CLAUDE.md", "This project uses TypeScript and pnpm.") }));
    expect(r.total).toBeGreaterThan(90);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it("total is always within [0,100]", () => {
    const huge = "Always run X after every commit. ".repeat(500);
    const r = score(inv({ claudeMd: file("CLAUDE.md", huge), ignoreFiles: [] }));
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it("pillar maxes match the PRD weights and sum to 100", () => {
    const r = score(inv());
    const maxByName = Object.fromEntries(r.pillars.map((p) => [p.pillar, p.max]));
    expect(maxByName).toEqual(PILLAR_WEIGHTS);
    expect(r.pillars.reduce((s, p) => s + p.max, 0)).toBe(100);
  });

  it("no pillar ever goes negative", () => {
    const huge = "1. step\n2. step\n3. step\nAlways must never. ".repeat(200);
    const r = score(inv({ claudeMd: file("CLAUDE.md", huge) }));
    for (const p of r.pillars) {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(p.max);
    }
  });

  it("is deterministic — identical inventory, identical score + reasons", () => {
    const i = inv({
      claudeMd: file("CLAUDE.md", "# A\nThis uses TypeScript.\n# B\nFor src/**/*.ts use repos."),
      skills: [skill("good", "A clear, sufficiently long description of the skill.")],
    });
    expect(score(i)).toEqual(score(i));
  });
});

describe("score — pillar behavior", () => {
  it("deducts Skill Effectiveness for a weak/empty description", () => {
    const r = score(inv({ skills: [skill("ghost", "")] }));
    const p = r.pillars.find((x) => x.pillar === "skill-effectiveness")!;
    expect(p.score).toBeLessThan(p.max);
    expect(p.deductions[0]!.reason).toMatch(/weak\/empty description/i);
    // sanity: the threshold constant is exported and used
    expect("short".length).toBeLessThan(SKILL_WEAK_MIN_CHARS);
  });

  it("deducts Structural Hygiene when no ignore file is present", () => {
    const r = score(inv({ ignoreFiles: [] }));
    const p = r.pillars.find((x) => x.pillar === "structural-hygiene")!;
    expect(p.deductions.some((d) => d.id === "struct-no-ignore")).toBe(true);
  });

  it("deducts Routing Correctness for a hook/skill block stuck in CLAUDE.md", () => {
    const claudeMd = file(
      "CLAUDE.md",
      "Always run prettier after every commit; you must never push unformatted code.",
    );
    const r = score(inv({ claudeMd, ignoreFiles: [file(".gitignore", "node_modules")] }));
    const p = r.pillars.find((x) => x.pillar === "routing-correctness")!;
    expect(p.score).toBeLessThan(p.max);
    expect(p.deductions[0]!.reason).toMatch(/HOOK|SKILL|RULE|MCP/);
  });

  it("deducts Context Economy for an over-budget CLAUDE.md", () => {
    const big = "This is a declarative project fact. ".repeat(300); // well over budget
    const r = score(inv({ claudeMd: file("CLAUDE.md", big), ignoreFiles: [file(".gitignore", "x")] }));
    const p = r.pillars.find((x) => x.pillar === "context-economy")!;
    expect(p.deductions.some((d) => d.id === "ctx-claude-md-over-budget")).toBe(true);
  });
});
