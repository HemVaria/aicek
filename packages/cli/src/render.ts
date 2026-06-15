/**
 * Terminal renderer for `aicek doctor`. Pure: takes an audit artifact + the root
 * and returns a string. No I/O — the caller prints it (keeps it testable and
 * read-only).
 */
import pc from "picocolors";
import type { AuditArtifact, PillarName, Severity } from "@aicek/core";

const PILLAR_LABEL: Record<PillarName, string> = {
  "context-economy": "Context Economy",
  "routing-correctness": "Routing Correctness",
  "skill-effectiveness": "Skill Effectiveness",
  "structural-hygiene": "Structural Hygiene",
  "redundancy-overlap": "Redundancy & Overlap",
};

const BAR_WIDTH = 16;

function bar(value: number, max: number, color: (s: string) => string): string {
  const filled = max === 0 ? BAR_WIDTH : Math.round((value / max) * BAR_WIDTH);
  return color("█".repeat(filled)) + pc.dim("░".repeat(BAR_WIDTH - filled));
}

function gradeColor(ratio: number): (s: string) => string {
  if (ratio >= 0.8) return pc.green;
  if (ratio >= 0.6) return pc.yellow;
  return pc.red;
}

function grade(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "POOR";
  return "CRITICAL";
}

const SEV_COLOR: Record<Severity, (s: string) => string> = {
  P0: pc.red,
  P1: (s) => pc.red(pc.dim(s)),
  P2: pc.yellow,
  P3: pc.dim,
};

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

export function renderReport(a: AuditArtifact, root: string): string {
  const L: string[] = [];
  const ratio = a.healthScore / 100;
  const gc = gradeColor(ratio);

  L.push("");
  L.push(`  ${pc.bold("aicek doctor")}  ${pc.dim("·")}  ${pc.dim(root)}`);
  L.push("");
  L.push(
    `  ${pc.bold("Configuration Health")}   ${gc(pc.bold(String(a.healthScore) + "/100"))}   ${gc("[" + grade(a.healthScore) + "]")}`,
  );
  L.push(`  ${bar(a.healthScore, 100, gc)}`);
  L.push("");

  // Pillars
  L.push(`  ${pc.bold("Pillars")}`);
  for (const p of a.pillars) {
    const pr = p.max === 0 ? 1 : p.score / p.max;
    const issues = p.deductions.length;
    const issueTxt = issues ? pc.dim(`  ${issues} issue${issues === 1 ? "" : "s"}`) : "";
    L.push(
      `    ${pad(PILLAR_LABEL[p.pillar], 22)} ${bar(p.score, p.max, gradeColor(pr))} ${pad(`${p.score}/${p.max}`, 7)}${issueTxt}`,
    );
  }
  L.push("");

  // Top recommendations
  if (a.recommendations.length) {
    L.push(`  ${pc.bold("Top recommendations")}`);
    for (const r of a.recommendations.slice(0, 5)) {
      const sev = SEV_COLOR[r.severity](r.severity);
      const save =
        r.estTokenSaving.value > 0
          ? pc.dim(` (save ~${r.estTokenSaving.value} tok, ${r.estTokenSaving.confidence})`)
          : "";
      L.push(`    ${sev} ${pc.dim("+" + r.estHealthGain.points)} ${truncate(r.fix, 68)}${save}`);
    }
    if (a.recommendations.length > 5) {
      L.push(pc.dim(`    …and ${a.recommendations.length - 5} more (use --json for all)`));
    }
    L.push("");
  }

  // Estimates
  L.push(`  ${pc.bold("Estimates")} ${pc.dim("(every number is an estimate)")}`);
  for (const e of a.estimates) {
    L.push(`    ${pad(e.name, 22)} ${pad(String(e.value) + " tok", 12)} ${pc.dim("(" + e.confidence + ")")}`);
  }
  L.push("");

  L.push(`  ${pc.green("✓ Read-only")} ${pc.dim("— nothing was changed.")}`);
  L.push(pc.dim(`  Methodology: docs/methodology.md  ·  schema v${a.schemaVersion}, engine v${a.engineVersion}`));
  L.push("");
  return L.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
