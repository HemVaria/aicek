import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { detect } from "../src/detect.js";
import { tokensOf } from "../src/estimate.js";

const here = dirname(fileURLToPath(import.meta.url));
const realDir = join(here, "fixtures", "real");

/**
 * These fixtures are minimal CLAUDE.md snapshots vendored from real, popular
 * public Claude Code config repos (see each fixture's SOURCE.md). We assert
 * structural facts, not exact content, so the tests stay robust if the snapshot
 * is refreshed.
 */
const REAL = ["my-claude-code-setup", "claude-code-config"];

describe("detect() on real vendored configs", () => {
  for (const repo of REAL) {
    it(`reads ${repo}'s CLAUDE.md`, async () => {
      const inv = await detect(join(realDir, repo));
      expect(inv.claudeMd).toBeDefined();
      expect(inv.claudeMd!.bytes).toBeGreaterThan(0);
      expect(tokensOf(inv.claudeMd!.content)).toBeGreaterThan(0);
      // bytes is a real utf8 measurement of the content
      expect(inv.claudeMd!.bytes).toBe(Buffer.byteLength(inv.claudeMd!.content, "utf8"));
    });

    it(`is deterministic for ${repo}`, async () => {
      const a = await detect(join(realDir, repo));
      const b = await detect(join(realDir, repo));
      expect(a).toEqual(b);
    });
  }
});
