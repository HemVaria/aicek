/**
 * Tests for detect() — Stage 1a Detection (PRD §7.1).
 *
 * Fixture paths are resolved from import.meta.url so the tests work when run
 * from any working directory (repo root, package dir, etc.).
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { detect } from "../src/detect.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES = path.join(__dirname, "fixtures");

function fixture(name: string): string {
  return path.join(FIXTURES, name);
}

// ---------------------------------------------------------------------------
// node-rich
// ---------------------------------------------------------------------------

describe("node-rich fixture", () => {
  it("detects node stack", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.stack).toEqual(["node"]);
  });

  it("reads CLAUDE.md with correct bytes", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.claudeMd).toBeDefined();
    expect(inv.claudeMd?.path).toContain("CLAUDE.md");
    expect(inv.claudeMd?.content).toContain("Node Rich Project");
    const expectedBytes = Buffer.byteLength(inv.claudeMd!.content, "utf8");
    expect(inv.claudeMd?.bytes).toBe(expectedBytes);
  });

  it("reads two rules — one always-on, one scoped", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.rules).toHaveLength(2);

    const alwaysOn = inv.rules.find((r) => r.path.endsWith("always-on.md"));
    expect(alwaysOn).toBeDefined();
    expect(alwaysOn?.globs).toEqual([]);

    const scoped = inv.rules.find((r) => r.path.endsWith("scoped.md"));
    expect(scoped).toBeDefined();
    expect(scoped?.globs).toEqual(["src/**/*.ts", "lib/**/*.ts"]);
  });

  it("reads skill with name and description", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.skills).toHaveLength(1);
    const skill = inv.skills[0];
    expect(skill?.name).toBe("my-skill");
    expect(skill?.description).toBe("A test skill for the node-rich fixture");
    expect(skill?.content).toContain("This skill does something useful");
  });

  it("flattens hooks from settings.json", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.hooks).toHaveLength(1);
    expect(inv.hooks[0]?.event).toBe("PreToolUse");
    expect(inv.hooks[0]?.command).toBe("echo pre-tool-use-hook");
  });

  it("reads MCP server names from settings.json", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.mcpServers).toHaveLength(2);
    const names = inv.mcpServers.map((m) => m.name).sort();
    expect(names).toEqual(["context7", "filesystem"]);
    // capabilities are empty at detection time
    for (const srv of inv.mcpServers) {
      expect(srv.capabilities).toEqual([]);
    }
  });

  it("sets settings FileEntry to settings.json", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.settings).toBeDefined();
    expect(inv.settings?.path).toContain("settings.json");
  });

  it("reads .gitignore as an ignore file", async () => {
    const inv = await detect(fixture("node-rich"));
    expect(inv.ignoreFiles.some((f) => f.path.endsWith(".gitignore"))).toBe(true);
  });

  it("sets root and agent correctly", async () => {
    const root = fixture("node-rich");
    const inv = await detect(root);
    expect(inv.root).toBe(root);
    expect(inv.agent).toBe("claude-code");
  });

  it("is deterministic — two calls produce identical results", async () => {
    const root = fixture("node-rich");
    const a = await detect(root);
    const b = await detect(root);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// python-min
// ---------------------------------------------------------------------------

describe("python-min fixture", () => {
  it("detects python stack", async () => {
    const inv = await detect(fixture("python-min"));
    expect(inv.stack).toEqual(["python"]);
  });

  it("reads CLAUDE.md", async () => {
    const inv = await detect(fixture("python-min"));
    expect(inv.claudeMd).toBeDefined();
    expect(inv.claudeMd?.content).toContain("Python Minimal");
  });

  it("has no rules, skills, hooks, mcpServers, or settings", async () => {
    const inv = await detect(fixture("python-min"));
    expect(inv.rules).toEqual([]);
    expect(inv.skills).toEqual([]);
    expect(inv.hooks).toEqual([]);
    expect(inv.mcpServers).toEqual([]);
    expect(inv.settings).toBeUndefined();
    expect(inv.ignoreFiles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// go-rules
// ---------------------------------------------------------------------------

describe("go-rules fixture", () => {
  it("detects go stack", async () => {
    const inv = await detect(fixture("go-rules"));
    expect(inv.stack).toEqual(["go"]);
  });

  it("reads two rules — one always-on, one scoped to *.go", async () => {
    const inv = await detect(fixture("go-rules"));
    expect(inv.rules).toHaveLength(2);

    const errorHandling = inv.rules.find((r) => r.path.endsWith("error-handling.md"));
    expect(errorHandling?.globs).toEqual([]);

    const naming = inv.rules.find((r) => r.path.endsWith("naming.md"));
    expect(naming?.globs).toEqual(["**/*.go"]);
  });

  it("has no claudeMd", async () => {
    const inv = await detect(fixture("go-rules"));
    expect(inv.claudeMd).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// empty
// ---------------------------------------------------------------------------

describe("empty fixture", () => {
  it("returns correct empty-but-valid shape", async () => {
    const root = fixture("empty");
    const inv = await detect(root);
    expect(inv.root).toBe(root);
    expect(inv.agent).toBe("claude-code");
    expect(inv.stack).toEqual([]);
    expect(inv.claudeMd).toBeUndefined();
    expect(inv.rules).toEqual([]);
    expect(inv.skills).toEqual([]);
    expect(inv.hooks).toEqual([]);
    expect(inv.mcpServers).toEqual([]);
    expect(inv.settings).toBeUndefined();
    expect(inv.ignoreFiles).toEqual([]);
  });

  it("is deterministic on empty dir", async () => {
    const root = fixture("empty");
    const a = await detect(root);
    const b = await detect(root);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// multi-stack
// ---------------------------------------------------------------------------

describe("multi-stack fixture", () => {
  it("detects both go and node stacks, sorted", async () => {
    const inv = await detect(fixture("multi-stack"));
    expect(inv.stack).toEqual(["go", "node"]);
  });

  it("has no claudeMd, rules, skills, hooks, or mcpServers", async () => {
    const inv = await detect(fixture("multi-stack"));
    expect(inv.claudeMd).toBeUndefined();
    expect(inv.rules).toEqual([]);
    expect(inv.skills).toEqual([]);
    expect(inv.hooks).toEqual([]);
    expect(inv.mcpServers).toEqual([]);
  });
});
