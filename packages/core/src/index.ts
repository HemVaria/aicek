/**
 * @aicek/core — the configuration intelligence engine.
 *
 * Pure functions, no I/O side effects beyond reads in `detect`, zero CLI deps.
 *   import { detect, classify, score, recommend } from "@aicek/core";
 */
export * from "./types.js";
export { SCHEMA_VERSION, ENGINE_VERSION } from "./version.js";

export { detect } from "./detect.js";
export { audit } from "./audit.js";
export {
  REGISTRY,
  REGISTRY_SCHEMA_VERSION,
  findEntry,
  type RegistryEntry,
  type InstallType,
} from "./registry.js";
export {
  PROFILES,
  planInit,
  generateClaudeMd,
  generateIgnore,
  attributionFor,
  type InitProfile,
  type InitPlan,
  type PlannedFile,
  type InstallStep,
  type FileAction,
} from "./generate.js";
export {
  classify,
  signalsOf,
  LENGTH_TOKENS_FULL,
  ENFORCEMENT_THRESHOLD,
  PROCEDURAL_THRESHOLD,
  FREQUENCY_LOW,
  PATH_THRESHOLD,
  EXTERNALITY_THRESHOLD,
} from "./classify.js";
export { score, PILLAR_WEIGHTS } from "./score.js";
export { recommend } from "./recommend.js";
export {
  countSkillActivations,
  suggestDescription,
  assessSkills,
  WEAK_DESCRIPTION_MIN_CHARS,
  type SkillHealth,
  type SkillStatus,
} from "./skills.js";
export {
  tokensOf,
  estimate,
  alwaysOnContext,
  perSessionTax,
  perDayTax,
  looksLikeCodeOrMarkdown,
  BYTES_PER_TOKEN,
  PROSE_MULTIPLIER,
  CODE_MULTIPLIER,
  DEFAULT_SESSIONS_PER_DAY,
} from "./estimate.js";
