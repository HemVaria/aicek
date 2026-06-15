import { describe, it, expect } from "vitest";
import { renderHtml, renderShareSvg } from "../src/report.js";
import type { AuditArtifact } from "../src/types.js";

const sample: AuditArtifact = {
  schemaVersion: "1.0.0",
  engineVersion: "0.0.1",
  generatedFor: { stack: ["node"], agent: "claude-code" },
  healthScore: 72,
  pillars: [
    { pillar: "context-economy", score: 30, max: 30, deductions: [] },
    { pillar: "routing-correctness", score: 12, max: 25, deductions: [] },
    { pillar: "skill-effectiveness", score: 20, max: 20, deductions: [] },
    { pillar: "structural-hygiene", score: 10, max: 15, deductions: [] },
    { pillar: "redundancy-overlap", score: 10, max: 10, deductions: [] },
  ],
  classification: [],
  estimates: [{ name: "perSessionTax", value: 1200, confidence: "medium" }],
  recommendations: [
    {
      id: "r1",
      severity: "P1",
      issue: "x",
      fix: "Add a .gitignore <safely>",
      estTokenSaving: { value: 0, confidence: "low" },
      estHealthGain: { points: 5, pillar: "structural-hygiene" },
      reversible: true,
    },
  ],
};

describe("renderHtml", () => {
  it("is a self-contained HTML doc with the score and escapes text", () => {
    const html = renderHtml(sample);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("72");
    expect(html).toContain("Context Economy");
    expect(html).toContain("&lt;safely&gt;"); // fix text escaped
    expect(html).not.toContain("<safely>");
  });
});

describe("renderShareSvg", () => {
  it("is a valid-looking SVG card with score and hashtag", () => {
    const svg = renderShareSvg(sample);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("</svg>");
    expect(svg).toContain(">72<");
    expect(svg).toContain("#aicek");
  });
});
