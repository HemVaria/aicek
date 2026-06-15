/**
 * `aicek doctor` — read-only health report.
 *
 * Pretty/JSON output is returned as a string (so the read-only guarantee is
 * testable). `--html` / `--share` write a single report/image file (output only,
 * never touching the audited config) and return the path.
 */
import { writeFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { detect, audit, renderHtml, renderShareSvg } from "@aicek/core";
import { renderReport } from "./render.js";

export interface DoctorOptions {
  cwd: string;
  json?: boolean;
  sessions?: number;
  /** Output path for an HTML report (or true for the default name). */
  html?: string | boolean;
  /** Output path for an SVG share card (or true for the default name). */
  share?: string | boolean;
}

function resolveOut(cwd: string, value: string | boolean, fallback: string): string {
  const name = typeof value === "string" && value ? value : fallback;
  return isAbsolute(name) ? name : join(cwd, name);
}

export async function runDoctor(opts: DoctorOptions): Promise<string> {
  const inventory = await detect(opts.cwd);
  const artifact = audit(inventory, opts.sessions);

  if (opts.html) {
    const out = resolveOut(opts.cwd, opts.html, "aicek-report.html");
    writeFileSync(out, renderHtml(artifact), "utf8");
    return `  ✓ Wrote HTML report: ${out}`;
  }
  if (opts.share) {
    const out = resolveOut(opts.cwd, opts.share, "aicek-card.svg");
    writeFileSync(out, renderShareSvg(artifact), "utf8");
    return `  ✓ Wrote share card: ${out}  (#aicek)`;
  }
  if (opts.json) {
    return JSON.stringify(artifact, null, 2);
  }
  return renderReport(artifact, opts.cwd);
}
