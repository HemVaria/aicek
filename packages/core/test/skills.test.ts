import { describe, it, expect } from "vitest";
import { countSkillActivations, assessSkills, suggestDescription } from "../src/skills.js";
import type { SkillEntry } from "../src/types.js";

const file = (name: string, description: string): SkillEntry => ({
  path: `.claude/skills/${name}/SKILL.md`,
  content: "x",
  bytes: 1,
  name,
  description,
});

describe("countSkillActivations", () => {
  const transcripts = [
    '{"type":"tool_use","name":"Skill","input":{"skill":"polish"}}\n{"role":"user","content":"/typeset please"}',
    'used "name":"polish" again and /polish',
  ];
  it("counts Skill-tool inputs and slash-command uses", () => {
    const c = countSkillActivations(transcripts, ["polish", "typeset", "ghost"]);
    expect(c.polish).toBeGreaterThanOrEqual(2);
    expect(c.typeset).toBeGreaterThanOrEqual(1);
    expect(c.ghost).toBe(0);
  });
  it("is case-insensitive and escapes regex chars in names", () => {
    const c = countSkillActivations(['"skill":"c++helper"'], ["c++helper"]);
    expect(c["c++helper"]).toBe(1);
  });
});

describe("assessSkills", () => {
  it("marks zero-activation skills dead when activations are known", () => {
    const h = assessSkills([file("ghost", "A perfectly fine long description here.")], { ghost: 0 });
    expect(h[0]!.status).toBe("dead");
  });
  it("never marks dead when activations are unknown", () => {
    const h = assessSkills([file("ok", "A perfectly fine long description here.")]);
    expect(h[0]!.status).toBe("unknown");
  });
  it("flags weak descriptions with a suggestion", () => {
    const h = assessSkills([file("thing", "")], { thing: 5 });
    expect(h[0]!.status === "weak-description" || h[0]!.status === "dead").toBe(true);
    expect(h[0]!.suggestion).toMatch(/Use this skill when/);
  });
});

describe("suggestDescription", () => {
  it("humanizes the skill name", () => {
    expect(suggestDescription("whiteboard-generator")).toMatch(/whiteboard generator/);
  });
});
