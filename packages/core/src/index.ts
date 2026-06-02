/**
 * @aicek/core — the configuration intelligence engine.
 *
 * Pure functions, no I/O side effects beyond reads in `detect`, zero CLI deps.
 *   import { detect, classify, score, recommend } from "@aicek/core";
 */
export * from "./types.js";
export { SCHEMA_VERSION, ENGINE_VERSION } from "./version.js";

export { detect } from "./detect.js";
export { classify } from "./classify.js";
export { score, PILLAR_WEIGHTS } from "./score.js";
export { recommend } from "./recommend.js";
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
