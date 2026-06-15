import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOptimize, runRestore } from "../src/optimize.js";

let dir: string;
let projects: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aicek-opt-"));
  projects = mkdtempSync(join(tmpdir(), "aicek-tx-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
  // a dead skill (never referenced in transcripts)
  mkdirSync(join(dir, ".claude", "skills", "ghost"), { recursive: true });
  writeFileSync(
    join(dir, ".claude", "skills", "ghost", "SKILL.md"),
    "---\nname: ghost\ndescription: short\n---\nbody",
  );
  // a transcript that exists but never uses "ghost"
  writeFileSync(join(projects, "t.jsonl"), '{"role":"user","content":"/audit the page"}\n');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(projects, { recursive: true, force: true });
});

const skillDir = () => join(dir, ".claude", "skills", "ghost", "SKILL.md");
const archived = () => join(dir, ".aicek", "archive", "skills", "ghost", "SKILL.md");

describe("aicek optimize", () => {
  it("--dry-run changes nothing", async () => {
    const res = await runOptimize({ cwd: dir, dryRun: true, yes: true, projectsDir: projects });
    expect(res.applied).toEqual([]);
    expect(existsSync(skillDir())).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(false);
    expect(existsSync(join(dir, ".aicek"))).toBe(false);
  });

  it("archives a dead skill and creates .gitignore, then restore brings it back", async () => {
    const res = await runOptimize({ cwd: dir, yes: true, projectsDir: projects });
    expect(res.applied.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(existsSync(skillDir())).toBe(false); // moved out
    expect(existsSync(archived())).toBe(true); // into archive
    expect(existsSync(join(dir, ".aicek", "manifest.json"))).toBe(true);

    const r = await runRestore({ cwd: dir, name: "ghost" });
    expect(r.restored).toBe(true);
    expect(existsSync(skillDir())).toBe(true); // back in place
    expect(existsSync(archived())).toBe(false);
  });

  it("restore reports cleanly when the name is unknown", async () => {
    const r = await runRestore({ cwd: dir, name: "nope" });
    expect(r.restored).toBe(false);
  });
});
