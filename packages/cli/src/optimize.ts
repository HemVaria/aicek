/**
 * `aicek optimize` + `aicek restore` (PRD Stage 4). The fixer — fully reversible.
 *
 * Safety model: originals are moved into `.aicek/archive/` and recorded in
 * `.aicek/manifest.json` BEFORE any change. `--dry-run` writes nothing;
 * interactive confirms; `--yes` applies non-interactively. A guardrail aborts if
 * the projected health would drop.
 */
import { homedir } from "node:os";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  renameSync,
  cpSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import {
  detect,
  score,
  planOptimize,
  countSkillActivations,
  type ConfigInventory,
  type OptimizePlan,
} from "@aicek/core";
import { readTranscripts } from "./skills.js";

interface Manifest {
  archivedSkills: Record<string, { original: string; archived: string }>;
  created: string[];
}

const ARCHIVE_DIR = ".aicek/archive";
const MANIFEST = ".aicek/manifest.json";

function loadManifest(cwd: string): Manifest {
  const path = join(cwd, MANIFEST);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Manifest;
    } catch {
      /* fall through to fresh */
    }
  }
  return { archivedSkills: {}, created: [] };
}

function saveManifest(cwd: string, m: Manifest): void {
  mkdirSync(join(cwd, ".aicek"), { recursive: true });
  writeFileSync(join(cwd, MANIFEST), JSON.stringify(m, null, 2) + "\n", "utf8");
}

function move(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    renameSync(src, dest);
  } catch {
    cpSync(src, dest, { recursive: true });
    rmSync(src, { recursive: true, force: true });
  }
}

/** Score the inventory as it WOULD look after optimize (for the guardrail). */
function projectedScore(inv: ConfigInventory, plan: OptimizePlan): number {
  const archived = new Set(
    plan.changes.filter((c) => c.archive).map((c) => c.archive!.name.toLowerCase()),
  );
  const addsIgnore = plan.changes.some((c) => c.kind === "add-ignore");
  const syn: ConfigInventory = {
    ...inv,
    skills: inv.skills.filter((s) => !archived.has(s.name.toLowerCase())),
    ignoreFiles:
      addsIgnore && inv.ignoreFiles.length === 0
        ? [{ path: ".gitignore", content: "x", bytes: 1 }]
        : inv.ignoreFiles,
  };
  return score(syn).total;
}

function renderPlan(inv: ConfigInventory, plan: OptimizePlan, before: number, after: number): string {
  const L: string[] = [];
  L.push("");
  L.push(`  ${pc.bold("aicek optimize")} ${pc.dim("· reversible — originals are archived first")}`);
  L.push("");
  if (!plan.changes.length) {
    L.push(pc.green("  ✓ Nothing to optimize — your config is already healthy."));
    L.push("");
    return L.join("\n");
  }
  for (const c of plan.changes) {
    const tag = c.kind === "add-ignore" ? pc.green("create ") : pc.yellow("archive");
    L.push(`    ${tag}  ${c.description}`);
  }
  L.push("");
  L.push(
    `  ${pc.bold("Projected health")}  ${before} ${pc.dim("→")} ${pc.green(String(after))} ${pc.dim(`(+${after - before})`)}  ${pc.dim(`· ~${plan.estTokenSaving} tokens reclaimed`)}`,
  );
  L.push("");
  return L.join("\n");
}

export interface OptimizeOptions {
  cwd: string;
  dryRun?: boolean;
  yes?: boolean;
  projectsDir?: string;
}

export async function runOptimize(opts: OptimizeOptions): Promise<{ applied: string[]; dryRun: boolean }> {
  const inv = await detect(opts.cwd);
  const projects = opts.projectsDir ?? join(homedir(), ".claude", "projects");
  const texts = readTranscripts(projects);
  const deadSkills =
    texts.length && inv.skills.length
      ? Object.entries(countSkillActivations(texts, inv.skills.map((s) => s.name)))
          .filter(([, n]) => n === 0)
          .map(([name]) => name)
      : [];

  const plan = planOptimize(inv, { deadSkills });
  const before = score(inv).total;
  const after = projectedScore(inv, plan);
  process.stdout.write(renderPlan(inv, plan, before, after));

  if (!plan.changes.length) return { applied: [], dryRun: Boolean(opts.dryRun) };

  // Guardrail: never apply changes that would lower the score.
  if (after < before) {
    process.stdout.write(pc.red(`  ✗ Aborted: projected health would drop (${before} → ${after}).\n\n`));
    return { applied: [], dryRun: Boolean(opts.dryRun) };
  }

  if (opts.dryRun) {
    process.stdout.write(pc.dim("  Dry run — nothing was changed.\n\n"));
    return { applied: [], dryRun: true };
  }

  if (!opts.yes) {
    const ok = await p.confirm({ message: "Apply these changes? (originals are archived)" });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Cancelled — nothing changed.");
      return { applied: [], dryRun: false };
    }
  }

  const manifest = loadManifest(opts.cwd);
  const applied: string[] = [];
  for (const c of plan.changes) {
    if (c.write) {
      writeFileSync(join(opts.cwd, c.write.path), c.write.content, "utf8");
      if (!manifest.created.includes(c.write.path)) manifest.created.push(c.write.path);
      applied.push(c.write.path);
    } else if (c.archive) {
      const from = join(opts.cwd, c.archive.path);
      const to = join(opts.cwd, ARCHIVE_DIR, "skills", c.archive.name);
      if (existsSync(from)) {
        move(from, to);
        manifest.archivedSkills[c.archive.name] = { original: c.archive.path, archived: join(ARCHIVE_DIR, "skills", c.archive.name) };
        applied.push(`archived ${c.archive.name}`);
      }
    }
  }
  saveManifest(opts.cwd, manifest);
  process.stdout.write(pc.green(`  ✓ Applied ${applied.length} change(s). Restore with \`aicek restore <name>\`.\n\n`));
  return { applied, dryRun: false };
}

export async function runRestore(opts: { cwd: string; name: string }): Promise<{ restored: boolean }> {
  const manifest = loadManifest(opts.cwd);
  const entry = manifest.archivedSkills[opts.name];
  if (!entry) {
    process.stdout.write(pc.yellow(`  No archived skill named "${opts.name}". Archived: ${Object.keys(manifest.archivedSkills).join(", ") || "none"}\n`));
    return { restored: false };
  }
  move(join(opts.cwd, entry.archived), join(opts.cwd, entry.original));
  delete manifest.archivedSkills[opts.name];
  saveManifest(opts.cwd, manifest);
  process.stdout.write(pc.green(`  ✓ Restored ${opts.name} → ${entry.original}\n`));
  return { restored: true };
}
