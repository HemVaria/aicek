import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init.js";
import { renderMarketplace } from "../src/marketplace.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aicek-init-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "demo" }));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(root).sort()) {
    const p = join(root, name);
    const s = statSync(p);
    if (!s.isDirectory()) out[name] = `${s.size}:${s.mtimeMs}`;
  }
  return out;
}

describe("aicek init", () => {
  it("--dry-run writes nothing, even with --yes", async () => {
    const before = snapshot(dir);
    const res = await runInit({ cwd: dir, dryRun: true, yes: true, profile: "frontend" });
    expect(res.written).toEqual([]);
    expect(res.dryRun).toBe(true);
    expect(snapshot(dir)).toEqual(before);
  });

  it("--yes writes CLAUDE.md and .gitignore for the chosen profile", async () => {
    const res = await runInit({ cwd: dir, yes: true, profile: "frontend" });
    expect(res.written.sort()).toEqual([".gitignore", "CLAUDE.md"]);
    expect(existsSync(join(dir, "CLAUDE.md"))).toBe(true);
    const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(claude).toMatch(/## Stack/);
    expect(claude).toMatch(/- node/); // detected from package.json
    expect(claude).toMatch(/Impeccable by pbakaus/); // frontend profile credit
    const ignore = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(ignore).toMatch(/node_modules\//);
  });

  it("minimal profile writes config but no tool credits", async () => {
    await runInit({ cwd: dir, yes: true, profile: "minimal" });
    const claude = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    expect(claude).not.toMatch(/## Installed tools/);
  });
});

describe("aicek marketplace", () => {
  it("lists registry entries with owners and install commands", () => {
    const out = renderMarketplace();
    expect(out).toMatch(/aicek marketplace/);
    expect(out).toMatch(/OpenSpec/);
    expect(out).toMatch(/Context7/);
    expect(out).toMatch(/install:/);
  });
});
