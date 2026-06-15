#!/usr/bin/env node
// aicek CLI entry. Thin shim — all logic lives in ../dist (built from src).
import { run } from "../dist/index.js";

run().catch((err) => {
  console.error("aicek:", err?.message ?? err);
  process.exitCode = 1;
});
