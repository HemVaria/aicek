import { describe, it, expect } from "vitest";
import * as core from "../src/index.js";
import { PILLAR_WEIGHTS } from "../src/score.js";
import { SCHEMA_VERSION, ENGINE_VERSION } from "../src/version.js";

describe("@aicek/core public API", () => {
  it("exports the five engine functions", () => {
    for (const fn of ["detect", "classify", "score", "recommend", "estimate", "tokensOf"]) {
      expect(typeof (core as Record<string, unknown>)[fn]).toBe("function");
    }
  });

  it("exposes versioned constants", () => {
    expect(SCHEMA_VERSION).toBe("1.0.0");
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("pillar weights sum to 100 (PRD §10.2)", () => {
    const total = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("Stage 1 surfaces are stubbed, not silently faked", () => {
    expect(() => core.tokensOf("hello")).toThrow(/not implemented/i);
    expect(() => core.classify({} as never)).toThrow(/not implemented/i);
  });
});
