/**
 * `aicek init` (PRD Stage 3) — the only writing command so far. Safety model:
 *  - `--dry-run` prints the plan and writes NOTHING.
 *  - interactive runs confirm before writing.
 *  - `--yes` writes non-interactively (CI), using a profile (default minimal).
 * Marketplace tools are NOT auto-executed; init prints their exact install
 * commands (with attribution) for the user to run.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import {
  detect,
  planInit,
  score,
  PROFILES,
  REGISTRY,
  type ConfigInventory,
  type InitPlan,
} from "@aicek/core";

export interface InitOptions {
  cwd: string;
  dryRun?: boolean;
  yes?: boolean;
  profile?: string;
}

/** Write the planned files to disk. Returns the paths written. */
export function applyPlan(cwd: string, plan: InitPlan): string[] {
  const written: string[] = [];
  for (const f of plan.files) {
    writeFileSync(join(cwd, f.path), f.content, "utf8");
    written.push(f.path);
  }
  return written;
}

/** Score the inventory as it WOULD look after init, for the projected delta. */
function projectedScore(inv: ConfigInventory, plan: InitPlan): number {
  const claudeMd = plan.files.find((f) => f.path === "CLAUDE.md");
  const ignore = plan.files.find((f) => f.path === ".gitignore");
  const syn: ConfigInventory = {
    ...inv,
    claudeMd: claudeMd
      ? { path: "CLAUDE.md", content: claudeMd.content, bytes: Buffer.byteLength(claudeMd.content) }
      : inv.claudeMd,
    ignoreFiles:
      inv.ignoreFiles.length > 0 || !ignore
        ? inv.ignoreFiles
        : [{ path: ".gitignore", content: ignore.content, bytes: Buffer.byteLength(ignore.content) }],
  };
  return score(syn).total;
}

export function renderPlan(inv: ConfigInventory, plan: InitPlan): string {
  const before = score(inv).total;
  const after = projectedScore(inv, plan);
  const L: string[] = [];
  L.push("");
  L.push(`  ${pc.bold("Plan")} ${pc.dim("· stack: " + (inv.stack.join(", ") || "none"))}`);
  for (const f of plan.files) {
    const tag = f.action === "overwrite" ? pc.yellow("overwrite") : pc.green("create");
    L.push(`    ${tag}  ${f.path}`);
  }
  if (plan.installs.length) {
    L.push("");
    L.push(`  ${pc.bold("Run to install")} ${pc.dim("(aicek won't run these for you)")}`);
    for (const s of plan.installs) L.push(`    ${pc.dim(s.install_type)}  ${s.command}`);
    L.push("");
    L.push(`  ${pc.bold("Credits")}`);
    for (const c of plan.credits) L.push(`    ${pc.dim(c)}`);
  }
  L.push("");
  L.push(
    `  ${pc.bold("Projected health")}  ${before} ${pc.dim("→")} ${pc.green(String(after))}  ${pc.dim(`(+${after - before})`)}`,
  );
  L.push(pc.dim(`  CLAUDE.md adds ~${plan.estClaudeMdTokens} always-on tokens.`));
  L.push("");
  return L.join("\n");
}

export async function runInit(opts: InitOptions): Promise<{ written: string[]; dryRun: boolean }> {
  const inv = await detect(opts.cwd);
  let selections: string[];

  if (opts.yes) {
    const prof = PROFILES.find((pr) => pr.id === (opts.profile ?? "minimal")) ?? PROFILES[0]!;
    selections = [...prof.entries];
  } else {
    p.intro(pc.bold("aicek init"));
    const profId = await p.select({
      message: "Pick a starting profile",
      options: PROFILES.map((pr) => ({ value: pr.id, label: pr.label })),
    });
    if (p.isCancel(profId)) {
      p.cancel("Cancelled.");
      return { written: [], dryRun: Boolean(opts.dryRun) };
    }
    const prof = PROFILES.find((pr) => pr.id === profId)!;
    const chosen = await p.multiselect({
      message: "Marketplace tools (space to toggle, enter to confirm)",
      options: REGISTRY.map((e) => ({ value: e.name, label: `${e.name} — ${e.category}`, hint: e.token_note })),
      initialValues: [...prof.entries],
      required: false,
    });
    if (p.isCancel(chosen)) {
      p.cancel("Cancelled.");
      return { written: [], dryRun: Boolean(opts.dryRun) };
    }
    selections = chosen as string[];
  }

  const plan = planInit(inv, selections);
  process.stdout.write(renderPlan(inv, plan));

  if (opts.dryRun) {
    process.stdout.write(pc.dim("  Dry run — nothing was written.\n\n"));
    return { written: [], dryRun: true };
  }

  if (!opts.yes) {
    const ok = await p.confirm({ message: "Write these files?" });
    if (p.isCancel(ok) || !ok) {
      p.cancel("Cancelled — nothing written.");
      return { written: [], dryRun: false };
    }
  }

  const written = applyPlan(opts.cwd, plan);
  process.stdout.write(pc.green(`  ✓ Wrote ${written.join(", ")}\n\n`));
  return { written, dryRun: false };
}
