#!/usr/bin/env node
/**
 * Compose a single profile SVG from a background + slots (text / svg / image).
 *
 * Usage:
 *   node scripts/compose.mjs
 *   node scripts/compose.mjs --config path/to/config.json
 *   node scripts/compose.mjs --config config.json --out output/profile.svg
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { compose, loadConfigFile, loadEnvFile, ROOT } from "../lib/compose.mjs";

function parseArgs(argv) {
  const args = { config: join(ROOT, "config.json"), out: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--config" && argv[i + 1]) {
      args.config = resolve(ROOT, argv[++i]);
    } else if (argv[i] === "--out" && argv[i + 1]) {
      args.out = resolve(ROOT, argv[++i]);
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    }
  }
  return args;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node scripts/compose.mjs [--config config.json] [--out output/profile.svg]

Background can be:
  - preset name: midnight | aurora | slate
  - local path: presets/midnight.svg, photos/me.png
  - URL: https://example.com/banner.gif

Slots:
  - { "type": "text", "text", "x", "y", "fontSize", "fill", ... }
  - { "type": "svg", "src", "x", "y", "width", "height" }  (local path or https URL)
  - { "type": "image", "src", "x", "y", "width", "height" }
`);
    return;
  }

  let loaded;
  try {
    loaded = await loadConfigFile(args.config);
  } catch {
    console.warn(`No config at ${args.config}; trying defaults`);
    loaded = await loadConfigFile(null);
  }

  const { config } = loaded;
  const out =
    args.out ??
    (config.out ? resolve(ROOT, config.out) : join(ROOT, "output", "profile.svg"));

  const svg = await compose(config);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, svg, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
