import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { REGISTRY, findEntry, PROFILES } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, "..", "..", "..", "registry", "registry.json");

describe("registry", () => {
  it("the TS registry and registry/registry.json stay in sync", () => {
    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    expect(json.entries).toEqual(JSON.parse(JSON.stringify(REGISTRY)));
  });

  it("every entry is verified and has the required fields", () => {
    for (const e of REGISTRY) {
      expect(e.verified).toBe(true);
      expect(e.repo_url).toMatch(/^https:\/\/github\.com\//);
      expect(e.compatible_with.length).toBeGreaterThan(0);
      expect(e.attribution_required).toBe(true);
    }
  });

  it("findEntry is case-insensitive", () => {
    expect(findEntry("caveman")?.owner).toBe("JuliusBrussee");
    expect(findEntry("CONTEXT7")?.owner).toBe("upstash");
    expect(findEntry("nope")).toBeUndefined();
  });

  it("every profile references real registry entries", () => {
    for (const p of PROFILES) {
      for (const name of p.entries) {
        expect(findEntry(name), `${p.id} -> ${name}`).toBeDefined();
      }
    }
  });
});
