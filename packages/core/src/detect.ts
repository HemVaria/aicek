/**
 * 7.1 Detection — build a normalized {@link ConfigInventory} from a project root.
 *
 * Reads stack manifests (package.json, pyproject.toml, go.mod, …) and the
 * existing agent setup (CLAUDE.md, .claude/rules, .claude/skills, settings,
 * ignore files, hooks, MCP config). No scoring here. (PRD §7.1)
 *
 * Determinism: no Date.now(), no Math.random(). All directory listings are sorted
 * before processing so output order is stable regardless of filesystem order.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  ConfigInventory,
  FileEntry,
  RuleEntry,
  SkillEntry,
  HookEntry,
  McpEntry,
} from "./types.js";

// ---------------------------------------------------------------------------
// Stack detection
// ---------------------------------------------------------------------------

/** Map from manifest filename to stack identifier. */
const MANIFEST_TO_STACK: ReadonlyArray<readonly [string, string]> = [
  ["package.json", "node"],
  ["pyproject.toml", "python"],
  ["requirements.txt", "python"],
  ["go.mod", "go"],
  ["Cargo.toml", "rust"],
  ["pom.xml", "java"],
  ["build.gradle", "java"],
  ["Gemfile", "ruby"],
  ["composer.json", "php"],
];

/**
 * Detect tech-stack identifiers present in `root` by checking for known
 * manifest files. Returns a sorted, deduplicated array of stack ids.
 */
async function detectStack(root: string): Promise<string[]> {
  const found = new Set<string>();
  await Promise.all(
    MANIFEST_TO_STACK.map(async ([manifest, stack]) => {
      try {
        await stat(join(root, manifest));
        found.add(stack);
      } catch {
        // file absent — normal
      }
    }),
  );
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// FileEntry helpers
// ---------------------------------------------------------------------------

/**
 * Read a file and return a {@link FileEntry}, or `undefined` if the file does
 * not exist or cannot be read.
 */
async function readFileEntry(filePath: string): Promise<FileEntry | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    return { path: filePath, content, bytes: Buffer.byteLength(content, "utf8") };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Parse optional YAML-ish frontmatter between `---` fences at the top of a
 * markdown file. Returns a plain key→value map (values are raw strings).
 *
 * Supports scalar values (`key: value`) and inline YAML lists (`key: [a, b]`).
 */
function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match || match[1] === undefined) return result;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (kv && kv[1] !== undefined && kv[2] !== undefined) {
      result[kv[1]] = kv[2].trim();
    }
  }
  return result;
}

/**
 * Extract a string list from a raw YAML-ish value.
 * Handles bracketed form `[a, b, c]` and bare comma-separated `a, b, c`.
 */
function parseListValue(raw: string): string[] {
  if (!raw) return [];
  const bracketed = /^\[(.+)\]$/.exec(raw.trim());
  const inner = bracketed !== null ? (bracketed[1] ?? "") : raw;
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Read `<root>/.claude/rules/*.md` and build a sorted array of
 * {@link RuleEntry} objects. Missing directory → empty array.
 */
async function detectRules(root: string): Promise<RuleEntry[]> {
  const rulesDir = join(root, ".claude", "rules");
  let files: string[];
  try {
    files = (await readdir(rulesDir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }

  const entries: RuleEntry[] = [];
  for (const file of files) {
    const entry = await readFileEntry(join(rulesDir, file));
    if (!entry) continue;
    const fm = parseFrontmatter(entry.content);
    const rawGlobs = fm["globs"] ?? "";
    const globs = rawGlobs ? parseListValue(rawGlobs) : [];
    entries.push({ ...entry, globs });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/**
 * Read `<root>/.claude/skills/*\/SKILL.md` and build a sorted array of
 * {@link SkillEntry} objects. Missing directory → empty array.
 */
async function detectSkills(root: string): Promise<SkillEntry[]> {
  const skillsDir = join(root, ".claude", "skills");
  let names: string[];
  try {
    // Plain name listing — do NOT filter by Dirent.isDirectory(). Symlinked and
    // junctioned skill dirs (e.g. Windows reparse points from plugin installs)
    // report as non-directories, which would silently drop them. Instead we
    // probe each entry for a SKILL.md; readFile transparently follows links and
    // non-skill entries (plain files) simply fail the read and are skipped.
    names = (await readdir(skillsDir)).sort();
  } catch {
    return [];
  }

  const skills: SkillEntry[] = [];
  for (const name of names) {
    const entry = await readFileEntry(join(skillsDir, name, "SKILL.md"));
    if (!entry) continue;
    const fm = parseFrontmatter(entry.content);
    const skillName = fm["name"] ?? name;
    const description = fm["description"] ?? "";
    skills.push({ ...entry, name: skillName, description });
  }
  return skills;
}

// ---------------------------------------------------------------------------
// Settings, hooks, MCP servers
// ---------------------------------------------------------------------------

/** Relevant subset of a Claude Code settings.json. */
interface SettingsJson {
  hooks?: Record<
    string,
    Array<{
      matcher?: string;
      hooks?: Array<{ type?: string; command?: string }>;
    }>
  >;
  mcpServers?: Record<string, unknown>;
}

/**
 * Read `.claude/settings.json` (fallback: `settings.local.json`). Returns the
 * first-found {@link FileEntry} plus flattened {@link HookEntry} and
 * {@link McpEntry} arrays parsed from it.
 */
async function detectSettings(root: string): Promise<{
  settings: FileEntry | undefined;
  hooks: HookEntry[];
  mcpServers: McpEntry[];
}> {
  const candidates = ["settings.json", "settings.local.json"] as const;
  let settingsEntry: FileEntry | undefined;

  for (const candidate of candidates) {
    const entry = await readFileEntry(join(root, ".claude", candidate));
    if (entry) {
      settingsEntry = entry;
      break;
    }
  }

  const hooks: HookEntry[] = [];
  const mcpServers: McpEntry[] = [];

  if (!settingsEntry) return { settings: undefined, hooks, mcpServers };

  let parsed: SettingsJson;
  try {
    parsed = JSON.parse(settingsEntry.content) as SettingsJson;
  } catch {
    return { settings: settingsEntry, hooks, mcpServers };
  }

  // Flatten hooks: event → groups → individual hook commands.
  if (parsed.hooks && typeof parsed.hooks === "object") {
    for (const event of Object.keys(parsed.hooks).sort()) {
      const groups = parsed.hooks[event];
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        if (!Array.isArray(group.hooks)) continue;
        for (const h of group.hooks) {
          if (typeof h.command === "string") {
            hooks.push({ event, command: h.command });
          }
        }
      }
    }
  }

  // MCP servers: name = key, capabilities unknown at detection time.
  if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
    for (const name of Object.keys(parsed.mcpServers).sort()) {
      mcpServers.push({ name, capabilities: [] });
    }
  }

  return { settings: settingsEntry, hooks, mcpServers };
}

// ---------------------------------------------------------------------------
// Ignore files
// ---------------------------------------------------------------------------

/**
 * Read `<root>/.gitignore` and `<root>/.claudeignore` if present.
 * Returns FileEntry array in that order (absent files are omitted).
 */
async function detectIgnoreFiles(root: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  for (const name of [".gitignore", ".claudeignore"]) {
    const entry = await readFileEntry(join(root, name));
    if (entry) entries.push(entry);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a normalized {@link ConfigInventory} from a project root.
 *
 * All filesystem reads are try/catch-guarded — missing files or directories
 * are silently omitted. The result is deterministic: every list is sorted
 * before processing so output order is stable across repeated calls.
 *
 * @param root - Absolute path to the project root to inspect.
 */
export async function detect(root: string): Promise<ConfigInventory> {
  const [stack, claudeMd, rules, skills, { settings, hooks, mcpServers }, ignoreFiles] =
    await Promise.all([
      detectStack(root),
      readFileEntry(join(root, "CLAUDE.md")),
      detectRules(root),
      detectSkills(root),
      detectSettings(root),
      detectIgnoreFiles(root),
    ]);

  return {
    root,
    stack,
    agent: "claude-code",
    ...(claudeMd !== undefined ? { claudeMd } : {}),
    rules,
    skills,
    hooks,
    mcpServers,
    ...(settings !== undefined ? { settings } : {}),
    ignoreFiles,
  };
}
