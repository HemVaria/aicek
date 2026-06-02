import { describe, it, expect } from "vitest";
import {
  tokensOf,
  looksLikeCodeOrMarkdown,
  alwaysOnContext,
  perSessionTax,
  perDayTax,
  estimate,
  BYTES_PER_TOKEN,
  CODE_MULTIPLIER,
} from "../src/estimate.js";
import type { ConfigInventory, RuleEntry } from "../src/types.js";

function rule(content: string, globs: string[] = []): RuleEntry {
  return { path: "r", content, bytes: Buffer.byteLength(content), globs };
}

function inv(partial: Partial<ConfigInventory>): ConfigInventory {
  return {
    root: "/x",
    stack: [],
    agent: "claude-code",
    rules: [],
    skills: [],
    hooks: [],
    mcpServers: [],
    ignoreFiles: [],
    ...partial,
  };
}

describe("tokensOf", () => {
  it("returns 0 for empty string", () => {
    expect(tokensOf("")).toBe(0);
  });

  it("uses ceil(bytes/4) for prose", () => {
    // 8 ASCII bytes -> ceil(8/4) = 2, prose multiplier 1.0
    expect(tokensOf("abcdefgh")).toBe(2);
    // 9 bytes -> ceil(9/4) = 3
    expect(tokensOf("abcdefghi")).toBe(3);
  });

  it("counts UTF-8 bytes, not characters", () => {
    // "é" is 2 UTF-8 bytes; 4 of them = 8 bytes -> 2 tokens
    expect(tokensOf("éééé")).toBe(2);
  });

  it("applies the code/markdown multiplier", () => {
    const code = "```js\nconst a = 1;\n```";
    const bytes = Buffer.byteLength(code, "utf8");
    const expected = Math.ceil(Math.ceil(bytes / BYTES_PER_TOKEN) * CODE_MULTIPLIER);
    expect(tokensOf(code)).toBe(expected);
  });

  it("is deterministic — identical input, identical output", () => {
    const t = "the quick brown fox jumps over the lazy dog";
    expect(tokensOf(t)).toBe(tokensOf(t));
  });
});

describe("looksLikeCodeOrMarkdown", () => {
  it("detects fenced code", () => {
    expect(looksLikeCodeOrMarkdown("```\nx\n```")).toBe(true);
  });
  it("detects markdown tables", () => {
    expect(looksLikeCodeOrMarkdown("| a | b |\n| --- | --- |")).toBe(true);
  });
  it("treats plain prose as prose", () => {
    expect(looksLikeCodeOrMarkdown("just a normal sentence about cats")).toBe(false);
  });
});

describe("composed estimators", () => {
  it("alwaysOnContext sums CLAUDE.md + always-loaded rules only", () => {
    const inventory = inv({
      claudeMd: { path: "CLAUDE.md", content: "abcdefgh", bytes: 8 }, // 2 tokens
      rules: [
        rule("abcdefgh"), // always-on -> 2 tokens
        rule("abcdefgh", ["src/**"]), // path-scoped -> excluded
      ],
    });
    expect(alwaysOnContext(inventory)).toBe(4);
    expect(perSessionTax(inventory)).toBe(4);
  });

  it("is order-independent across rules", () => {
    const a = inv({ rules: [rule("aaaa"), rule("bbbbbbbb")] });
    const b = inv({ rules: [rule("bbbbbbbb"), rule("aaaa")] });
    expect(alwaysOnContext(a)).toBe(alwaysOnContext(b));
  });

  it("perDayTax scales by sessions (default 10)", () => {
    const inventory = inv({ claudeMd: { path: "CLAUDE.md", content: "abcdefgh", bytes: 8 } });
    expect(perDayTax(inventory)).toBe(perSessionTax(inventory) * 10);
    expect(perDayTax(inventory, 3)).toBe(perSessionTax(inventory) * 3);
  });

  it("estimate() labels every number with a confidence", () => {
    const out = estimate(inv({}));
    expect(out.map((e) => e.name)).toEqual(["alwaysOnContext", "perSessionTax", "perDayTax"]);
    expect(out.find((e) => e.name === "perDayTax")?.confidence).toBe("low");
    expect(out.find((e) => e.name === "perSessionTax")?.confidence).toBe("medium");
  });
});
