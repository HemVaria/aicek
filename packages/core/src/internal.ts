/**
 * Internal helpers shared across the engine. Not part of the public API.
 */

/**
 * Marks a Stage 1 surface that is intentionally not implemented yet.
 * Throwing keeps the public API shape honest at Stage 0 without faking behavior.
 */
export function notImplemented(fn: string): never {
  throw new Error(
    `@aicek/core: ${fn}() is not implemented yet (Stage 1). See PRD.md and docs/methodology.md.`,
  );
}
