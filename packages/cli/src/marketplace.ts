/**
 * `aicek marketplace` — read-only listing of the registry (PRD Stage 3).
 * Pure: returns text; the caller prints it.
 */
import pc from "picocolors";
import { REGISTRY, type RegistryEntry } from "@aicek/core";

function stars(n?: number): string {
  if (!n) return "";
  return n >= 1000 ? `${Math.round(n / 1000)}k★` : `${n}★`;
}

export function renderMarketplace(): string {
  const byCat = new Map<string, RegistryEntry[]>();
  for (const e of REGISTRY) {
    const list = byCat.get(e.category) ?? [];
    list.push(e);
    byCat.set(e.category, list);
  }

  const L: string[] = [];
  L.push("");
  L.push(`  ${pc.bold("aicek marketplace")} ${pc.dim("— tools aicek recommends. Install less, use better.")}`);
  L.push("");
  for (const cat of [...byCat.keys()].sort()) {
    L.push(`  ${pc.bold(pc.cyan(cat))}`);
    for (const e of byCat.get(cat)!) {
      L.push(`    ${pc.bold(e.name)} ${pc.dim("by " + e.owner)} ${pc.yellow(stars(e.stars))}`);
      L.push(`      ${pc.dim(e.token_note)}`);
      L.push(`      ${pc.dim("install:")} ${e.install_command}`);
    }
    L.push("");
  }
  L.push(pc.dim(`  ${REGISTRY.length} tools · run \`aicek init\` to pick a profile and generate config.`));
  L.push("");
  return L.join("\n");
}
