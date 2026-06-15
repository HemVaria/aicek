/**
 * `aicek skills` — skill health report (PRD Stage 4). Read-only.
 * Detects the project's skills, reads ~/.claude/projects transcripts to count
 * activations, and reports dead / weak-description / healthy skills with
 * rewrite suggestions.
 */
import { homedir } from "node:os";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { detect, countSkillActivations, assessSkills, type SkillStatus } from "@aicek/core";

const MAX_TRANSCRIPT_BYTES = 50 * 1024 * 1024; // safety cap on total read

/** Recursively read *.jsonl transcript text under a directory. */
export function readTranscripts(dir: string): string[] {
  const texts: string[] = [];
  let budget = MAX_TRANSCRIPT_BYTES;
  const walk = (d: string): void => {
    let names: string[];
    try {
      names = readdirSync(d).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (budget <= 0) return;
      const p = join(d, name);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(p);
      else if (name.endsWith(".jsonl") && s.size <= budget) {
        try {
          texts.push(readFileSync(p, "utf8"));
          budget -= s.size;
        } catch {
          /* skip unreadable */
        }
      }
    }
  };
  walk(dir);
  return texts;
}

const STATUS_STYLE: Record<SkillStatus, { icon: string; color: (s: string) => string }> = {
  healthy: { icon: "✓", color: pc.green },
  "weak-description": { icon: "!", color: pc.yellow },
  dead: { icon: "✗", color: pc.red },
  unknown: { icon: "?", color: pc.dim },
};

export interface SkillsOptions {
  cwd: string;
  projectsDir?: string;
}

export async function runSkills(opts: SkillsOptions): Promise<string> {
  const inv = await detect(opts.cwd);
  const projects = opts.projectsDir ?? join(homedir(), ".claude", "projects");
  const texts = readTranscripts(projects);
  const names = inv.skills.map((s) => s.name);
  const counts = texts.length ? countSkillActivations(texts, names) : undefined;
  const health = assessSkills(inv.skills, counts);

  const L: string[] = [];
  L.push("");
  L.push(`  ${pc.bold("aicek skills")} ${pc.dim(`· ${inv.skills.length} skills · ${texts.length} transcripts scanned`)}`);
  L.push("");
  if (!health.length) {
    L.push(pc.dim("  No skills found under .claude/skills."));
    L.push("");
    return L.join("\n");
  }
  for (const h of health) {
    const st = STATUS_STYLE[h.status];
    const act = counts ? pc.dim(` ${h.activations} use${h.activations === 1 ? "" : "s"}`) : "";
    L.push(`    ${st.color(st.icon)} ${h.name}${act} ${pc.dim("· " + h.status)}`);
    if (h.suggestion) L.push(pc.dim(`        ↳ ${h.suggestion}`));
  }
  L.push("");
  const dead = health.filter((h) => h.status === "dead").length;
  const weak = health.filter((h) => h.status === "weak-description").length;
  L.push(pc.dim(`  ${dead} dead · ${weak} weak description${weak === 1 ? "" : "s"}. Archive dead skills with \`aicek optimize\`.`));
  if (!counts) L.push(pc.dim("  (no transcripts found — activations unknown, so nothing marked dead)"));
  L.push("");
  return L.join("\n");
}
