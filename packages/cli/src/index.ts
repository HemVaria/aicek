/**
 * aicek CLI — thin command surface over @aicek/core.
 *
 * Stage 2 ships the hero command: `aicek doctor` (read-only). `init` / `optimize`
 * (PRD §8) arrive in later stages. All intelligence lives in @aicek/core; this
 * file only parses args, calls the engine, and prints.
 */
import pc from "picocolors";
import { SCHEMA_VERSION, ENGINE_VERSION } from "@aicek/core";
import { runDoctor } from "./doctor.js";

const HELP = `
  ${pc.bold("aicek")} — the configuration intelligence layer for AI coding agents

  ${pc.bold("Usage")}
    aicek <command> [options]

  ${pc.bold("Commands")}
    doctor            Audit the current project and print a 0–100 health score
    help              Show this help
    version           Print version info

  ${pc.bold("doctor options")}
    --json            Emit the audit artifact as JSON (PRD §14)
    --cwd <path>      Directory to audit (default: current directory)
    --sessions <n>    Sessions/day for the per-day token projection (default: 10)

  ${pc.dim("Read-only by design — doctor never writes. Install less. Use better. Measure everything.")}
`;

interface ParsedArgs {
  command: string;
  json: boolean;
  cwd: string;
  sessions: number | undefined;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    command: argv[0] && !argv[0].startsWith("-") ? argv[0] : "help",
    json: false,
    cwd: process.cwd(),
    sessions: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--cwd") out.cwd = argv[++i] ?? out.cwd;
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
    case "version":
      process.stdout.write(`aicek (schema v${SCHEMA_VERSION}, engine v${ENGINE_VERSION})\n`);
      return;
    case "help":
    default:
      process.stdout.write(HELP + "\n");
      return;
  }
}
