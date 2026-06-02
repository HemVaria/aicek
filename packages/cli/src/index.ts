/**
 * aicek CLI — thin command surface over @aicek/core.
 *
 * Stage 0: placeholder. The real `doctor` / `init` / `optimize` commands
 * (PRD §8) arrive in Stage 2+. The CLI stays thin: it parses args, calls the
 * engine, and renders. All intelligence lives in @aicek/core.
 */
import { SCHEMA_VERSION, ENGINE_VERSION } from "@aicek/core";

const BANNER = `
  aicek — AI Coding Efficiency Kit
  The configuration intelligence layer for AI coding agents.

  This is an early placeholder. The full release is on the way.
  Star and follow: https://github.com/HemVaria/aicek
`;

export function run(_argv: string[] = process.argv.slice(2)): void {
  process.stdout.write(BANNER + "\n");
  process.stdout.write(
    `  (schema v${SCHEMA_VERSION}, engine v${ENGINE_VERSION})\n\n`,
  );
}
