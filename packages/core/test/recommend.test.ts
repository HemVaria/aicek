import { describe, it, expect } from "vitest";
import { score } from "../src/score.js";
import { recommend } from "../src/recommend.js";
import type { ConfigInventory, SkillEntry } from "../src/types.js";

const file = (path: string, content: string) => ({ path, content, bytes: Buffer.byteLength(content) });
function skill(name: string, description: string): SkillEntry {
  return { ...file(`.claude/skills/${name}/SKILL.md`, "x"), name, description };
}
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

function recsFor(p: Partial<ConfigInventory>) {
  const i = inv(p);
  return recommend(i, score(i));
}

describe("recommend", () => {
  it("produces a recommendation per deduction with a fix, saving, and gain", () => {
    const recs = recsFor({ skills: [skill("ghost", "")] }); // weak desc + no ignore
    expect(recs.length).toBeGreaterThanOrEqual(1);
    for (const r of recs) {
      expect(r.fix.length).toBeGreaterThan(0);
      expect(["P0", "P1", "P2", "P3"]).toContain(r.severity);
      expect(r.estTokenSaving.value).toBeGreaterThanOrEqual(0);
      expect(["high", "medium", "low"]).toContain(r.estTokenSaving.confidence);
      expect(r.estHealthGain.points).toBeGreaterThan(0);
    }
  });

  it("computes a real token saving for an over-budget CLAUDE.md (medium confidence)", () => {
    const big = "This is a declarative project fact. ".repeat(300);
    const recs = recsFor({ claudeMd: file("CLAUDE.md", big), ignoreFiles: [file(".gitignore", "x")] });
    const trim = recs.find((r) => r.id === "rec-ctx-claude-md-over-budget");
    expect(trim).toBeDefined();
    expect(trim!.estTokenSaving.value).toBeGreaterThan(0);
    expect(trim!.estTokenSaving.confidence).toBe("medium");
  });

  it("is sorted by health gain desc, then token saving desc", () => {
    const recs = recsFor({
      claudeMd: file("CLAUDE.md", "x ".repeat(4000)),
      skills: [skill("a", ""), skill("b", "")],
    });
    for (let i = 1; i < recs.length; i++) {
      const prev = recs[i - 1]!;
      const cur = recs[i]!;
      const gainDrop = prev.estHealthGain.points >= cur.estHealthGain.points;
      const tieBreak =
        prev.estHealthGain.points !== cur.estHealthGain.points ||
        prev.estTokenSaving.value >= cur.estTokenSaving.value;
      expect(gainDrop && tieBreak).toBe(true);
    }
  });

  it("rewrite-description and write-CLAUDE.md fixes are flagged non-reversible", () => {
    const recs = recsFor({ skills: [skill("ghost", "")] });
    const weak = recs.find((r) => r.id.startsWith("rec-skill-weak-desc"));
    const noClaude = recs.find((r) => r.id === "rec-struct-no-claude-md");
    expect(weak!.reversible).toBe(false);
    expect(noClaude!.reversible).toBe(false);
  });

  it("is deterministic", () => {
    const i = inv({ skills: [skill("ghost", "")] });
    expect(recommend(i, score(i))).toEqual(recommend(i, score(i)));
  });
});
