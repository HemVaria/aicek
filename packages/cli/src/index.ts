/**
 * aicek CLI — thin command surface over @aicek/core.
 *
 * Stage 2 shipped `doctor` (read-only). Stage 3 adds `marketplace` (read-only)
 * and `init` (the first writing command, guarded by --dry-run / confirm / --yes).
 * `optimize` (PRD §8) arrives later. All intelligence lives in @aicek/core.
 */
import pc from "picocolors";
import { SCHEMA_VERSION, ENGINE_VERSION } from "@aicek/core";
import { runDoctor } from "./doctor.js";
import { renderMarketplace } from "./marketplace.js";
import { runInit } from "./init.js";
import { runSkills } from "./skills.js";
import { runOptimize, runRestore } from "./optimize.js";

const HELP = `
  ${pc.bold("aicek")} — the configuration intelligence layer for AI coding agents

  ${pc.bold("Usage")}
    aicek <command> [options]

  ${pc.bold("Commands")}
    doctor            Audit the current project and print a 0–100 health score
    marketplace       List the tools aicek recommends (read-only)
    init              Pick a profile + tools and generate clean config
    skills            Skill health report — dead/weak skills from transcripts
    optimize          Apply safe, reversible fixes (archives originals first)
    restore <name>    Restore a skill archived by optimize
    help              Show this help
    version           Print version info

  ${pc.bold("doctor options")}
    --json            Emit the audit artifact as JSON (PRD §14)
    --cwd <path>      Directory to audit (default: current directory)
    --sessions <n>    Sessions/day for the per-day token projection (default: 10)

  ${pc.bold("init options")}
    --dry-run         Show the plan; write nothing
    --yes             Write non-interactively (CI); uses --profile (default: minimal)
    --profile <id>    minimal | frontend | full-stack | token-optimizer
    --cwd <path>      Target directory (default: current directory)

  ${pc.dim("doctor & marketplace are read-only. init only writes after confirm or --yes.")}
`;

interface ParsedArgs {
  command: string;
  json: boolean;
  dryRun: boolean;
  yes: boolean;
  profile: string | undefined;
  cwd: string;
  projects: string | undefined;
  sessions: number | undefined;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    command: argv[0] && !argv[0].startsWith("-") ? argv[0] : "help",
    json: false,
    dryRun: false,
    yes: false,
    profile: undefined,
    cwd: process.cwd(),
    projects: undefined,
    sessions: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--profile") out.profile = argv[++i];
    else if (a === "--cwd") out.cwd = argv[++i] ?? out.cwd;
    else if (a === "--projects") out.projects = argv[++i];
    else if (a === "--sessions") {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) out.sessions = n;
    }
  }
  return out;
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  switch (args.command) {
    case "doctor": {
      const output = await runDoctor({ cwd: args.cwd, json: args.json, sessions: args.sessions });
      process.stdout.write(output + "\n");
      return;
    }
    case "marketplace":
    case "market":
    case "list":
      process.stdout.write(renderMarketplace());
      return;
    case "init":
      await runInit({ cwd: args.cwd, dryRun: args.dryRun, yes: args.yes, profile: args.profile });
      return;
    case "skills":
      process.stdout.write(await runSkills({ cwd: args.cwd, projectsDir: args.projects }));
      return;
    case "optimize":
      await runOptimize({ cwd: args.cwd, dryRun: args.dryRun, yes: args.yes, projectsDir: args.projects });
      return;
    case "restore": {
      const name = argv[1] && !argv[1].startsWith("-") ? argv[1] : "";
      if (!name) {
        process.stdout.write("usage: aicek restore <skill-name>\n");
        return;
      }
      await runRestore({ cwd: args.cwd, name });
      return;
    }
    case "version":
      process.stdout.write(`aicek (schema v${SCHEMA_VERSION}, engine v${ENGINE_VERSION})\n`);
      return;
    case "help":
    default:
      process.stdout.write(HELP + "\n");
      return;
  }
}
