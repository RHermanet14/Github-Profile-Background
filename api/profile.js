import {
  applyQueryOverrides,
  compose,
  errorSvg,
  loadConfigFile,
  loadEnvFile,
} from "../lib/compose.mjs";

function cacheControl() {
  const maxAge = Number(process.env.CACHE_MAX_AGE || 3600);
  const age = Number.isFinite(maxAge) && maxAge >= 0 ? maxAge : 3600;
  return `public, s-maxage=${age}, stale-while-revalidate=86400`;
}

export default async function handler(req, res) {
  try {
    loadEnvFile();
    const { config } = await loadConfigFile(null);
    const query = req.query ?? {};
    const merged = applyQueryOverrides(config, query);
    const svg = await compose(merged);

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", cacheControl());
    res.statusCode = 200;
    res.end(svg);
  } catch (err) {
    const message = err?.message || String(err);
    console.error(message);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.statusCode = 500;
    res.end(errorSvg(message, 500));
  }
}
