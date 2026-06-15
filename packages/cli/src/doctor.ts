/**
 * `aicek doctor` — read-only health report.
 *
 * Returns the text to print (pretty or JSON). It only ever READS the filesystem
 * (via detect) and computes pure functions — no writes. Keeping the output as a
 * returned string (not direct printing) makes the read-only guarantee testable.
 */
import { detect, audit } from "@aicek/core";
import { renderReport } from "./render.js";

export interface DoctorOptions {
  cwd: string;
  json?: boolean;
  sessions?: number;
}

export async function runDoctor(opts: DoctorOptions): Promise<string> {
  const inventory = await detect(opts.cwd);
  const artifact = audit(inventory, opts.sessions);
  if (opts.json) {
    return JSON.stringify(artifact, null, 2);
  }
  return renderReport(artifact, opts.cwd);
}
