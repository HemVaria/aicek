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
export { tokensOf, estimate } from "./estimate.js";
