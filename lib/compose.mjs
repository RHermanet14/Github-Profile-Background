/**
 * Shared profile SVG compositor (CLI + Vercel API).
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const PRESETS = {
  midnight: "presets/midnight.svg",
  aurora: "presets/aurora.svg",
  slate: "presets/slate.svg",
};

/**
 * Load KEY=VALUE pairs from project .env into process.env (does not override existing).
 */
export function loadEnvFile(envPath = join(ROOT, ".env")) {
  if (!existsSync(envPath)) return false;
  const text = readFileSync(envPath, "utf8");
  let loaded = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded += 1;
    }
  }
  return loaded > 0;
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Strip XML 1.0 illegal control chars (keeps tab/LF/CR). */
export function sanitizeXmlText(text) {
  return String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

export function stripSvgShell(svgText) {
  let text = sanitizeXmlText(svgText.replace(/^\uFEFF/, "").trim());
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

function guessExtFromUrl(url) {
  const path = new URL(url).pathname.toLowerCase();
  for (const ext of [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"]) {
    if (path.endsWith(ext)) return ext;
  }
  // Query-only image APIs often return SVG with no file extension.
  return ".svg";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

/** Detect real image bytes (URLs that end in .gif often return HTML pages). */
export function sniffImageKind(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0x3c /* < */) {
    const head = bytes.slice(0, 64).toString("utf8").toLowerCase();
    if (head.includes("<!doctype") || head.includes("<html") || head.includes("<svg")) {
      return head.includes("<svg") ? "svg-text" : "html";
    }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString("ascii") === "RIFF" &&
    bytes.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (bytes[0] === 0x3c && bytes.toString("utf8", 0, 200).includes("<svg")) return "svg-text";
  return null;
}

function mimeForKind(kind, fallbackExt) {
  switch (kind) {
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return mimeForExt(fallbackExt || ".png");
  }
}

/** Resolve preset name, local path, or http(s) URL to a loadable source. */
export function resolveAssetRef(ref) {
  if (!ref) return null;
  if (PRESETS[ref]) return resolve(ROOT, PRESETS[ref]);
  if (isHttpUrl(ref)) return ref;
  return isAbsolute(ref) ? ref : resolve(ROOT, ref);
}

export async function loadBytes(source) {
  if (isHttpUrl(source)) {
    const res = await fetch(source, {
      headers: { "User-Agent": "github-tool-chart" },
      redirect: "follow",
    });
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

  const source = resolveAssetRef(background);
  const isUrl = isHttpUrl(source);
  const ext = isUrl
    ? extname(new URL(source).pathname) || guessExtFromUrl(source)
    : extname(source);

  const bytes = await loadBytes(source);
  const kind = sniffImageKind(bytes);

  if (kind === "html") {
    throw new Error(
      `Background URL did not return an image (got an HTML page). Use a direct media link (e.g. media.tenor.com/...gif), not a Tenor/webpage URL: ${background}`,
    );
  }

  if (
    kind === "svg-text" ||
    ext.toLowerCase() === ".svg" ||
    String(background).endsWith(".svg")
  ) {
    const svgText = bytes.toString("utf8");
    const { inner, viewBox, width: bw, height: bh } = stripSvgShell(svgText);
    const vb =
      viewBox ||
      (bw && bh ? `0 0 ${parseFloat(bw)} ${parseFloat(bh)}` : `0 0 ${width} ${height}`);
    return `<svg x="0" y="0" width="${width}" height="${height}" viewBox="${escapeXml(vb)}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  }

  if (!kind) {
    throw new Error(
      `Background is not a recognized image (png/gif/jpeg/webp/svg): ${background}`,
    );
  }

  const mime = mimeForKind(kind, ext);
  const href = `data:${mime};base64,${bytes.toString("base64")}`;
  return `<image href="${href}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
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
    const src = resolveAssetRef(slot.src);
    const bytes = await loadBytes(src);
    const ext = isHttpUrl(slot.src)
      ? extname(new URL(slot.src).pathname) || guessExtFromUrl(slot.src)
      : extname(src);
    const href = `data:${mimeForExt(ext)};base64,${bytes.toString("base64")}`;
    return `<image href="${href}" x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  if (type === "svg") {
    const src = resolveAssetRef(slot.src);
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

/**
 * Apply light query overrides used by the live API.
 * @param {object} config
 * @param {Record<string, string | string[] | undefined>} query
 */
export function applyQueryOverrides(config, query = {}) {
  const next = {
    ...config,
    slots: (config.slots ?? []).map((s) => ({ ...s })),
  };

  const bg = single(query.bg) ?? single(query.background);
  if (bg) next.background = bg;

  const title = single(query.title);
  if (title) {
    const textSlot = next.slots.find((s) => s.type === "text");
    if (textSlot) textSlot.text = title;
  }

  return next;
}

function single(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function loadConfigFile(preferredPath) {
  const candidates = [
    preferredPath,
    join(ROOT, "config.json"),
    join(ROOT, "config.example.json"),
  ].filter(Boolean);

  let lastError;
  for (const path of candidates) {
    try {
      const raw = await readFile(path, "utf8");
      return { config: JSON.parse(raw), path };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("No config.json or config.example.json found");
}

export async function compose(config) {
  loadEnvFile();
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

export function errorSvg(message, status = 500) {
  const text = escapeXml(message).slice(0, 180);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120" viewBox="0 0 600 120">
  <rect width="600" height="120" fill="#1c1917"/>
  <text x="24" y="52" fill="#fafaf9" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="18" font-weight="600">Profile compose error (${status})</text>
  <text x="24" y="82" fill="#a8a29e" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13">${text}</text>
</svg>`;
}
