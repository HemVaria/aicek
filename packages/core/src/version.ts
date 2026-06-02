/**
 * Versioned constants.
 *
 * SCHEMA_VERSION — the audit artifact contract (PRD §14). Bump on shape changes.
 * ENGINE_VERSION — the scoring engine (weights + estimator constants, PRD §10.2,
 * §12.3). Bump whenever a change would alter a score for identical input, so that
 * historical scores stay comparable.
 */
export const SCHEMA_VERSION = "1.0.0";
export const ENGINE_VERSION = "0.0.1";
