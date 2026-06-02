/**
 * 7.2 Classification — the moat (PRD §11).
 *
 * For every instruction block in the inventory, decide where it *should* live
 * (CLAUDE.md / skill / rule / hook / MCP) and why. Six signals are scored 0..1
 * from the text alone (deterministic, content-only), then combined by an ordered
 * rule table. The deciding signals are always returned so the user sees the
 * reasoning. See docs/methodology.md §4.
 */
import type {
  Classification,
  ClassificationSignals,
  ConfigInventory,
  Evidence,
  Location,
} from "./types.js";
import { tokensOf } from "./estimate.js";

// --- Tunable thresholds (documented in docs/methodology.md §4) ---------------
export const LENGTH_TOKENS_FULL = 200; // tokens at which `length` saturates to 1
export const ENFORCEMENT_THRESHOLD = 0.5;
export const PROCEDURAL_THRESHOLD = 0.5;
export const FREQUENCY_LOW = 0.5; // below this, an instruction is "intermittent"
export const PATH_THRESHOLD = 0.5;
export const EXTERNALITY_THRESHOLD = 0.5;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

const IMPERATIVE_VERBS =
  /^\s*(run|install|create|add|then|open|click|build|deploy|configure|update|set|copy|move|delete|remove|generate|write|edit|commit|push|enable|disable)\b/gim;
const ENFORCEMENT =
  /\b(always|must|never|required|ensure|do not|don't|after every|before every|mandatory)\b/gi;
const CONDITIONALITY = /\b(when|if|only when|in case|unless|for .{1,30} files)\b/gi;
const EXTERNALITY =
  /\b(api|database|http|fetch|endpoint|mcp|server|service|webhook|oauth|token|url)\b|https?:\/\//gi;
const EVENT_TRIGGER =
  /\b(after|before)\b[^.\n]{0,40}\b(commit|save|push|run|edit|write|build|merge)\b|on (save|commit|push|edit)|every (commit|save|run|edit)/i;

/** Path/glob/extension references — markers that an instruction is path-scoped. */
function pathSignalCount(text: string): number {
  return (
    countMatches(text, /\*\*?\//g) + // ** / or */
    countMatches(text, /\*\.\w+/g) + // *.ts
    countMatches(text, /\b(?:src|tests?|lib|packages|dist|app|components?|api|hooks?)\//gi) +
    countMatches(text, /\b[\w-]+\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|json|md|ya?ml)\b/gi)
  );
}

/** Score the six classification signals for a block of instruction text. */
export function signalsOf(text: string): ClassificationSignals {
  const length = clamp01(tokensOf(text) / LENGTH_TOKENS_FULL);

  const proceduralCount =
    countMatches(text, /^\s*\d+[.)]/gm) +
    countMatches(text, /^\s*[-*+]\s+/gm) +
    countMatches(text, IMPERATIVE_VERBS);
  const procedural = clamp01(proceduralCount / 5);

  const pathSpecificity = clamp01(pathSignalCount(text) / 3);
  const enforcementIntent = clamp01(countMatches(text, ENFORCEMENT) / 2);

  const conditionality = clamp01(countMatches(text, CONDITIONALITY) / 3);
  // Always-on relevance erodes with conditionality, path-scoping, and — crucially
  // — with procedural bulk: a long multi-step how-to is needed on demand, not
  // every turn. So procedural and length pull frequency down too.
  const frequency = clamp01(
    1 - 0.5 * pathSpecificity - 0.3 * conditionality - 0.5 * procedural - 0.2 * length,
  );

  const externality = clamp01(countMatches(text, EXTERNALITY) / 2);

  return { length, procedural, pathSpecificity, enforcementIntent, frequency, externality };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Apply the ordered rule table (PRD §11.2) and return location + reason. */
function decide(text: string, s: ClassificationSignals): { location: Location; reason: string } {
  if (s.enforcementIntent >= ENFORCEMENT_THRESHOLD && EVENT_TRIGGER.test(text)) {
    return {
      location: "hook",
      reason: `Enforcement intent (${r2(s.enforcementIntent)}) on an event trigger ("after/before …") → automate it as a Hook, don't rely on always-on prose.`,
    };
  }
  if (s.procedural >= PROCEDURAL_THRESHOLD && s.frequency < FREQUENCY_LOW) {
    return {
      location: "skill",
      reason: `High procedural-ness (${r2(s.procedural)}) and low session-frequency (${r2(s.frequency)}) → belongs in an on-demand Skill, not always-on CLAUDE.md.`,
    };
  }
  if (s.pathSpecificity >= PATH_THRESHOLD) {
    return {
      location: "rule",
      reason: `Path-specific (${r2(s.pathSpecificity)}) and conditionally relevant → a path-scoped Rule, so it loads only for matching files.`,
    };
  }
  if (s.externality >= EXTERNALITY_THRESHOLD) {
    return {
      location: "mcp",
      reason: `References an external capability/data source (externality ${r2(s.externality)}) → expose it via an MCP server, not static text.`,
    };
  }
  return {
    location: "claude-md",
    reason: `Short, declarative, broadly relevant (length ${r2(s.length)}, frequency ${r2(s.frequency)}) → a good always-on CLAUDE.md fact.`,
  };
}

/** First meaningful line of a block, stripped of heading markers, as a label. */
function labelOf(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const stripped = first.replace(/^#{1,6}\s*/, "").trim();
  return stripped.length > 80 ? stripped.slice(0, 77) + "…" : stripped;
}

interface Item {
  text: string;
  evidence: Evidence;
}

/** Split CLAUDE.md into heading-delimited blocks (fallback: paragraph blocks). */
function blocksFromClaudeMd(content: string, file: string): Item[] {
  const lines = content.split(/\r?\n/);
  const hasHeadings = lines.some((l) => /^#{1,6}\s/.test(l));
  const items: Item[] = [];

  if (hasHeadings) {
    let start = 0;
    let buf: string[] = [];
    const flush = (lineNo: number): void => {
      const text = buf.join("\n").trim();
      if (text) items.push({ text, evidence: { file, line: lineNo } });
      buf = [];
    };
    lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line) && buf.length > 0) {
        flush(start + 1);
        start = i;
      }
      if (buf.length === 0) start = i;
      buf.push(line);
    });
    flush(start + 1);
  } else {
    // paragraph blocks separated by blank lines
    let start = 0;
    let buf: string[] = [];
    const flush = (lineNo: number): void => {
      const text = buf.join("\n").trim();
      if (text) items.push({ text, evidence: { file, line: lineNo } });
      buf = [];
    };
    lines.forEach((line, i) => {
      if (line.trim() === "") {
        if (buf.length) flush(start + 1);
        start = i + 1;
      } else {
        if (buf.length === 0) start = i;
        buf.push(line);
      }
    });
    if (buf.length) flush(start + 1);
  }
  return items;
}

/** Extract all classifiable instruction items from the inventory, in document order. */
function extractItems(inventory: ConfigInventory): Item[] {
  const items: Item[] = [];
  if (inventory.claudeMd) {
    items.push(...blocksFromClaudeMd(inventory.claudeMd.content, inventory.claudeMd.path));
  }
  for (const rule of inventory.rules) {
    const text = rule.content.trim();
    if (text) items.push({ text, evidence: { file: rule.path } });
  }
  return items;
}

/**
 * Classify every instruction in the inventory: where it should live, and why.
 * Pure and deterministic — items are processed in document order.
 */
export function classify(inventory: ConfigInventory): Classification[] {
  return extractItems(inventory).map(({ text, evidence }) => {
    const signals = signalsOf(text);
    const { location, reason } = decide(text, signals);
    return { item: labelOf(text), location, reason, signals, evidence };
  });
}
