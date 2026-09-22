#!/usr/bin/env node
/**
 * Compose a single profile SVG from a background + slots (text / svg / image).
 *
 * Usage:
 *   node scripts/compose.mjs
 *   node scripts/compose.mjs --config path/to/config.json
 *   node scripts/compose.mjs --config config.json --out output/profile.svg
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PRESETS = {
  midnight: "presets/midnight.svg",
  aurora: "presets/aurora.svg",
  slate: "presets/slate.svg",
};

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

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripSvgShell(svgText) {
  let text = svgText.replace(/^\uFEFF/, "").trim();
  text = text.replace(/<\?xml[\s\S]*?\?>/i, "");
  text = text.replace(/<!DOCTYPE[\s\S]*?>/i, "");

  const open = text.match(/<svg\b([^>]*)>/i);
  if (!open) {
    throw new Error("File does not contain an <svg> root element");
  }

  const attrs = open[1];
  const viewBoxMatch = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i);

  const start = open.index + open[0].length;
  const end = text.toLowerCase().lastIndexOf("</svg>");
  if (end === -1) {
    throw new Error("File is missing a closing </svg>");
  }

  return {
    inner: text.slice(start, end).trim(),
    viewBox: viewBoxMatch?.[1] ?? null,
    width: widthMatch?.[1] ?? null,
    height: heightMatch?.[1] ?? null,
  };
}

function mimeForExt(ext) {
  switch (ext.toLowerCase()) {
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function resolveBackgroundPath(background) {
  if (!background) return null;
  if (PRESETS[background]) {
    return resolve(ROOT, PRESETS[background]);
  }
  if (/^https?:\/\//i.test(background)) {
    return background;
  }
  return isAbsolute(background) ? background : resolve(ROOT, background);
}

async function loadBytes(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${source}: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(source);
}

async function backgroundLayer(background, width, height) {
  if (!background) {
    return `<rect width="100%" height="100%" fill="#0f1419"/>`;
  }

  const source = resolveBackgroundPath(background);
  const isUrl = /^https?:\/\//i.test(source);
  const ext = isUrl
    ? extname(new URL(source).pathname) || guessExtFromUrl(source)
    : extname(source);

  if (ext.toLowerCase() === ".svg" || (!ext && String(background).endsWith(".svg"))) {
    const svgText = (await loadBytes(source)).toString("utf8");
    const { inner, viewBox, width: bw, height: bh } = stripSvgShell(svgText);
    const vb =
      viewBox ||
      (bw && bh ? `0 0 ${parseFloat(bw)} ${parseFloat(bh)}` : `0 0 ${width} ${height}`);
    return `<svg x="0" y="0" width="${width}" height="${height}" viewBox="${escapeXml(vb)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  }

  const bytes = await loadBytes(source);
  const mime = mimeForExt(ext || ".png");
  const href = `data:${mime};base64,${bytes.toString("base64")}`;
  return `<image href="${href}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
}

function guessExtFromUrl(url) {
  const path = new URL(url).pathname.toLowerCase();
  for (const ext of [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"]) {
    if (path.endsWith(ext)) return ext;
  }
  return ".png";
}

async function renderSlot(slot) {
  const type = slot.type ?? "svg";

  if (type === "text") {
    const fontFamily = slot.fontFamily ?? "sans-serif";
    const fontSize = slot.fontSize ?? 24;
    const fill = slot.fill ?? "#ffffff";
    const fontWeight = slot.fontWeight ?? "400";
    return `<text x="${slot.x}" y="${slot.y}" fill="${escapeXml(fill)}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${escapeXml(fontWeight)}">${escapeXml(slot.text ?? "")}</text>`;
  }

  if (type === "image") {
    const src = isAbsolute(slot.src) ? slot.src : resolve(ROOT, slot.src);
    const bytes = await loadBytes(src);
    const ext = /^https?:\/\//i.test(slot.src)
      ? extname(new URL(slot.src).pathname) || ".png"
      : extname(src);
    const href = `data:${mimeForExt(ext)};base64,${bytes.toString("base64")}`;
    return `<image href="${href}" x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  if (type === "svg") {
    const src = isAbsolute(slot.src) ? slot.src : resolve(ROOT, slot.src);
    const svgText = (await loadBytes(src)).toString("utf8");
    const { inner, viewBox, width: sw, height: sh } = stripSvgShell(svgText);
    const vb =
      viewBox ||
      (sw && sh
        ? `0 0 ${parseFloat(sw)} ${parseFloat(sh)}`
        : `0 0 ${slot.width} ${slot.height}`);
    return `<svg x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" viewBox="${escapeXml(vb)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  }

  throw new Error(`Unknown slot type: ${type}`);
}

async function compose(config) {
  const width = config.width ?? 900;
  const height = config.height ?? 520;
  const slots = config.slots ?? [];

  const layers = [await backgroundLayer(config.background, width, height)];
  for (const slot of slots) {
    layers.push(await renderSlot(slot));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Profile banner">
${layers.map((layer) => `  ${layer}`).join("\n")}
</svg>
`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node scripts/compose.mjs [--config config.json] [--out output/profile.svg]

Background can be:
  - preset name: midnight | aurora | slate
  - local path: presets/midnight.svg, photos/me.png
  - URL: https://example.com/banner.gif

Slots:
  - { "type": "text", "text", "x", "y", "fontSize", "fill", ... }
  - { "type": "svg", "src", "x", "y", "width", "height" }
  - { "type": "image", "src", "x", "y", "width", "height" }
`);
    return;
  }

  let configRaw;
  try {
    configRaw = await readFile(args.config, "utf8");
  } catch {
    const example = join(ROOT, "config.example.json");
    console.warn(`No config at ${args.config}; using config.example.json`);
    configRaw = await readFile(example, "utf8");
    args.config = example;
  }

  const config = JSON.parse(configRaw);
  const out =
    args.out ??
    (config.out
      ? resolve(ROOT, config.out)
      : join(ROOT, "output", "profile.svg"));

  const svg = await compose(config);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, svg, "utf8");
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
