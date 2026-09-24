# Github Tool Chart

Self-host a **live GitHub profile banner**: one SVG built from your config (background, text, and any remote stats embeds). Fork it, deploy your own Vercel app, point your profile README at that URL.

Remote embeds (streak cards, language charts, etc.) refresh when their hosts update — **without** recommitting an image file. Layout/text changes live in `config.json` and update when you redeploy.

```text
your-username/your-username  README.md
        │
        │  <img src="https://YOUR-APP.vercel.app/api/profile" />
        ▼
YOUR Vercel deploy  →  reads config.json  →  fetches embeds  →  returns SVG
```

Each person runs **their own** deploy so API quotas stay on their account.

---

## Quick start (fork → profile)

### 1. Fork this repository

Use your GitHub account so you can edit config and deploy from your copy.

### 2. Create your config

```bash
cp config.example.json config.json
```

Edit `config.json`:

- Your name / subtitle (`type: "text"` slots)
- Background (preset, local file, or image URL)
- Embeds: paste the same `https://…` image URLs you’d use in a normal README (`type: "svg"` or `"image"`)

**Commit `config.json` on your fork.** Vercel only gets files that are in the repo (this project tracks `config.json` so deploys include your layout).

### 3. Deploy to Vercel

1. Open [vercel.com/new](https://vercel.com/new) and import **your fork**, or run `npx vercel` / `npx vercel --prod` locally after `npx vercel login`.
2. Optional env var: `CACHE_MAX_AGE` (seconds; default `3600`).
3. Copy your production domain, e.g. `https://something.vercel.app`.

Smoke-test in a browser:

```text
https://YOUR-APP.vercel.app/api/profile
```

You should see the raw SVG (that’s expected — it’s an image, not a webpage).

### 4. Add it to your GitHub profile README

1. Create a public repo named **exactly** your username: `your-username/your-username`.
2. Put this in that repo’s `README.md` (not only in this chart repo):

```html
<p align="center">
  <img src="https://YOUR-APP.vercel.app/api/profile" width="900" alt="Profile banner" />
</p>
```

Replace `YOUR-APP` with your Vercel subdomain.

3. Commit and open `https://github.com/your-username` — the banner should appear.

You can remove duplicate streak/tools markup from the profile README if those are already inside the composed banner.

---

## Local preview (before deploying)

```bash
cp config.example.json config.json   # if you don’t have one yet
npm run compose                      # → output/profile.svg
```

Open `output/profile.svg` in a browser.

```bash
npm run compose:example    # uses config.example.json
npm run compose:aurora     # preset demo
npx vercel dev             # http://localhost:3000/api/profile
```

---

## Config reference

| Field | Meaning |
|--------|---------|
| `background` | `"midnight"` / `"aurora"` / `"slate"`, a path like `photos/bg.jpg`, or an `https://` image URL |
| `width` / `height` | Canvas size in px (raise `height` if you stack more content) |
| `slots` | Layers drawn on top of the background |
| `out` | Local CLI output path (ignored by the API) |

### Slot types

```json
{ "type": "text", "text": "Your Name", "x": 48, "y": 64, "fontSize": 36, "fill": "#f4f7fb", "fontWeight": "700", "fontFamily": "Segoe UI, Helvetica, Arial, sans-serif" }

{ "type": "svg", "src": "embeds/sample-chart.svg", "x": 48, "y": 140, "width": 480, "height": 360 }

{ "type": "svg", "src": "https://example.com/stats.svg?user=YourLogin", "x": 48, "y": 300, "width": 800, "height": 380 }

{ "type": "image", "src": "https://example.com/avatar.png", "x": 720, "y": 24, "width": 140, "height": 100 }
```

| Type | Use for |
|------|---------|
| `text` | Titles and labels |
| `svg` | Local `.svg` files **or** live remote SVG APIs (stats cards, badges) |
| `image` | PNG / JPEG / GIF / WebP (local or remote) |

Coordinates: `(0,0)` is the **top-left** of the canvas. Background images use cover-style cropping (`slice`) — they fill the canvas without stretching; overflow is cropped.

### Example: streak-style embed

Whatever URL you already use in a README `<img src="…">` works as a slot `src`:

```json
{
  "type": "svg",
  "src": "https://github-readme-streak-stats-one-vert.vercel.app?user=YourLogin&theme=radical",
  "x": 48,
  "y": 300,
  "width": 804,
  "height": 380
}
```

Put **your** username in that URL (or any other tracker’s query params).

---

## Updating after you change config

1. Edit `config.json` → commit → push (Vercel redeploys).
2. Profile README can keep a **stable** URL with no query string if you’re fine waiting for GitHub’s image cache (Camo) to refresh — same idea as other live README badges.
3. For an **immediate** refresh after a deploy, bump a cache-bust query once:

```html
<img src="https://YOUR-APP.vercel.app/api/profile?v=2" width="900" alt="Profile banner" />
```

Change `v=2` → `v=3` (any unused value) only when you need Camo to drop an old/broken copy right away.

---

## Limits (important for GitHub)

GitHub proxies profile images through **Camo** (~**5 MB** max). This app inlines images into one SVG, so:

| Rule | Guidance |
|------|----------|
| Total SVG | Keep under ~**4 MB** |
| Single background/photo/GIF | Roughly ≤ **~3 MB raw** (base64 expands ~33%) |
| Direct media URLs | Use a real image URL (`media.tenor.com/…gif`), not a webpage (`tenor.com/view/…`) |
| GIF animation | Usually **won’t animate** on GitHub inside this SVG; you’ll see a still frame |
| Links inside the banner | Not clickable like normal README markdown — it’s one flat image |

If Camo shows **Content length exceeded** or **Error Fetching Resource**, the composed SVG is too large or the API returned an error — shrink the background or check `/api/profile` in a browser.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Blue “Profile” text only | Use `<img src="…">`, not `[Profile](url)`. Or Camo failed — open the image URL directly. |
| Browser shows raw SVG | Normal for `/api/profile`. |
| Profile stuck on old banner | Wait for Camo, or bump `?v=`. |
| Deploy ignores your edits | Confirm `config.json` is committed on the branch Vercel builds. |
| HTML / wrong background | Background URL returned a webpage — use a direct image link. |
| Image too large error | Use a smaller PNG/JPEG/GIF under the size limits above. |

---

## Project layout

| Path | Role |
|------|------|
| `config.example.json` | Starter layout — copy to `config.json` |
| `config.json` | Your layout (commit on your fork) |
| `api/profile.js` | Vercel endpoint that composes the SVG |
| `lib/compose.mjs` | Compositor (also used by the CLI) |
| `presets/` | Built-in backgrounds |
| `embeds/` | Sample local SVGs |
| `scripts/compose.mjs` | Local `npm run compose` |
