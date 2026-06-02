/**
 * @aicek/core — shared types.
 *
 * These are the stable contracts the engine is built around (PRD §7, §10–§14).
 * Stage 0 defines the shapes; Stage 1 fills in the behavior. Keep these types
 * pure and serializable — they flow straight into the audit artifact (§14),
 * which is the only contract between AICEK and Hermes (§19).
 */

/** Confidence attached to every estimated number (PRD §12.1). */
export type Confidence = "high" | "medium" | "low";

/** Recommendation severity (PRD §13). */
export type Severity = "P0" | "P1" | "P2" | "P3";

/** Where an instruction should live (PRD §11). */
export type Location = "claude-md" | "skill" | "rule" | "hook" | "mcp";

/** The five health pillars (PRD §10.2). */
export type PillarName =
  | "context-economy"
  | "routing-correctness"
  | "skill-effectiveness"
  | "structural-hygiene"
  | "redundancy-overlap";

/** A pointer to the offending location for a deduction or finding. */
export interface Evidence {
  file: string;
  line?: number;
}

// --- 7.1 Detection -----------------------------------------------------------

/**
 * Normalized snapshot of a project's AI-agent configuration.
 * Detection produces this; everything downstream consumes it. No scoring here.
 */
export interface ConfigInventory {
  /** Absolute or repo-relative root the inventory was taken from. */
  root: string;
  /** Detected tech stack identifiers (e.g. "node", "python", "go"). */
  stack: string[];
  /** The agent this inventory targets. */
  agent: "claude-code";
  claudeMd?: FileEntry;
  rules: RuleEntry[];
  skills: SkillEntry[];
  hooks: HookEntry[];
  mcpServers: McpEntry[];
  settings?: FileEntry;
  ignoreFiles: FileEntry[];
}

export interface FileEntry {
  path: string;
  /** Raw text content, when read. */
  content: string;
  bytes: number;
}

export interface RuleEntry extends FileEntry {
  /** Path globs the rule is scoped to, if any. Empty = always-on. */
  globs: string[];
}

export interface SkillEntry extends FileEntry {
  name: string;
  description: string;
}

export interface HookEntry {
  event: string;
  command: string;
}

export interface McpEntry {
  name: string;
  /** Capabilities the server advertises, for overlap detection. */
  capabilities: string[];
}

// --- 7.2 Classification (PRD §11) -------------------------------------------

/** Signals scored 0–1 and combined by rules (PRD §11.1). */
export interface ClassificationSignals {
  length: number;
  procedural: number;
  pathSpecificity: number;
  enforcementIntent: number;
  frequency: number;
  externality: number;
}

export interface Classification {
  item: string;
  location: Location;
  reason: string;
  signals: ClassificationSignals;
  evidence?: Evidence;
}

// --- 7.3 Health scoring (PRD §10) -------------------------------------------

export interface Deduction {
  id: string;
  points: number;
  reason: string;
  evidence: Evidence;
}

export interface PillarResult {
  pillar: PillarName;
  score: number;
  max: number;
  deductions: Deduction[];
}

export interface HealthScore {
  /** 0–100, clamped. */
  total: number;
  pillars: PillarResult[];
}

// --- 7.4 Token estimation (PRD §12) -----------------------------------------

export interface Estimate {
  name: string;
  value: number;
  confidence: Confidence;
}

// --- 7.5 Recommendations (PRD §13) ------------------------------------------

export interface Recommendation {
  id: string;
  severity: Severity;
  issue: string;
  fix: string;
  estTokenSaving: { value: number; confidence: Confidence };
  estHealthGain: { points: number; pillar: PillarName };
  reversible: boolean;
}

// --- 7 / §14 Audit artifact -------------------------------------------------

export interface AuditArtifact {
  schemaVersion: string;
  engineVersion: string;
  generatedFor: { stack: string[]; agent: ConfigInventory["agent"] };
  healthScore: number;
  pillars: PillarResult[];
  classification: Classification[];
  estimates: Estimate[];
  recommendations: Recommendation[];
}
