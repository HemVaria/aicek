import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "../src/doctor.js";
import { parseArgs } from "../src/index.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aicek-doctor-"));
  writeFileSync(join(dir, "CLAUDE.md"), "# Stack\nThis project uses TypeScript and pnpm.\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Recursive snapshot of (path → size,mtimeMs) for read-only verification. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else out[p] = `${s.size}:${s.mtimeMs}`;
    }
  };
  walk(root);
  return out;
}

describe("aicek doctor", () => {
  it("prints a health score and is read-only (no file writes)", async () => {
    const before = snapshot(dir);
    const out = await runDoctor({ cwd: dir });
    expect(out).toMatch(/Configuration Health/);
    expect(out).toMatch(/\d+\/100/);
    expect(out).toMatch(/Read-only/);
    const after = snapshot(dir);
    expect(after).toEqual(before); // nothing created, modified, or deleted
  });

  it("--json emits a valid audit artifact (PRD §14)", async () => {
    const out = await runDoctor({ cwd: dir, json: true });
    const a = JSON.parse(out);
    expect(a.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(a.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(a.generatedFor.agent).toBe("claude-code");
    expect(a.generatedFor.stack).toContain("node");
    expect(typeof a.healthScore).toBe("number");
    expect(a.pillars).toHaveLength(5);
    expect(Array.isArray(a.classification)).toBe(true);
    expect(Array.isArray(a.estimates)).toBe(true);
    expect(Array.isArray(a.recommendations)).toBe(true);
  });

  it("respects --sessions in the per-day projection", async () => {
    const a3 = JSON.parse(await runDoctor({ cwd: dir, json: true, sessions: 3 }));
    const a10 = JSON.parse(await runDoctor({ cwd: dir, json: true, sessions: 10 }));
    const perDay = (x: { estimates: { name: string; value: number }[] }) =>
      x.estimates.find((e) => e.name === "perDayTax")!.value;
    expect(perDay(a10)).toBeGreaterThan(perDay(a3));
  });

  it("is deterministic", async () => {
    expect(await runDoctor({ cwd: dir, json: true })).toBe(await runDoctor({ cwd: dir, json: true }));
  });

  it("--html writes a self-contained report file", async () => {
    const msg = await runDoctor({ cwd: dir, html: true });
    expect(msg).toMatch(/Wrote HTML report/);
    expect(existsSync(join(dir, "aicek-report.html"))).toBe(true);
    expect(readFileSync(join(dir, "aicek-report.html"), "utf8")).toMatch(/^<!doctype html>/);
  });

  it("--share writes an SVG card", async () => {
    const msg = await runDoctor({ cwd: dir, share: "card.svg" });
    expect(msg).toMatch(/Wrote share card/);
    const svg = readFileSync(join(dir, "card.svg"), "utf8");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("#aicek");
  });
});

describe("parseArgs", () => {
  it("defaults to help with no args", () => {
    expect(parseArgs([]).command).toBe("help");
  });
  it("parses doctor + flags", () => {
    const a = parseArgs(["doctor", "--json", "--cwd", "/tmp/x", "--sessions", "7"]);
    expect(a).toMatchObject({ command: "doctor", json: true, cwd: "/tmp/x", sessions: 7 });
  });
  it("ignores invalid --sessions", () => {
    expect(parseArgs(["doctor", "--sessions", "abc"]).sessions).toBeUndefined();
  });
});
