/**
 * 7.1 Detection — build a normalized {@link ConfigInventory} from a project root.
 *
 * Reads stack manifests (package.json, pyproject.toml, go.mod, …) and the
 * existing agent setup (CLAUDE.md, .claude/rules, .claude/skills, settings,
 * ignore files, hooks, MCP config). No scoring here. (PRD §7.1)
 *
 * Stage 1: implement.
 */
import type { ConfigInventory } from "./types.js";
import { notImplemented } from "./internal.js";

export function detect(_root: string): Promise<ConfigInventory> {
  return notImplemented("detect");
}
