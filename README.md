# Profile image compositor (self-hosted)

Build **one** live profile SVG from a background + slots (text, local files, or any remote SVG/image embed). Deploy **your own** copy to Vercel so updates happen on request — no recommitting the image — and rate limits stay on your account.

```text
Profile README  --img-->  your-app.vercel.app/api/profile
                                |
                         config.json + presets
                                |
                         fetch remote / local embeds
                                |
                         composed image/svg+xml
```

---

## Deploy (recommended)

### 1. Fork or clone this repo

### 2. Deploy to Vercel

- [Deploy with Vercel](https://vercel.com/new) and import the repo, or:

```bash
npx vercel
```

### 3. Environment variables (optional)

In the Vercel project → Settings → Environment Variables:

| Variable | Required | Meaning |
|----------|----------|---------|
| `CACHE_MAX_AGE` | No | Seconds to cache the composed image (default `3600`) |

### 4. Add your config

```bash
cp config.example.json config.json
```

Edit `config.json` (name, background, layout, embed URLs). Commit it on your fork so the deploy picks it up.

To include a live stats card from another service, paste its image URL as an `svg` (or `image`) slot `src` — same as you’d put in a normal README `<img>`.

### 5. Use it in your profile README

In your **`RHermanet14/RHermanet14`** profile repo (not this repo’s README), add an **image**, not a link.

Wrong (shows a blue “Profile” link only):

```markdown
[Profile](https://github-tool-chart.vercel.app/api/profile)
```

Right — markdown image (`!` before the brackets):

```markdown
![Profile](https://github-tool-chart.vercel.app/api/profile)
```

Or HTML:

```html
<p align="center">
  <img src="https://github-tool-chart.vercel.app/api/profile" width="900" alt="Profile" />
</p>
```

After saving, the GitHub preview should show the banner graphic. Clicking through to the URL in a browser is expected to open the raw SVG (that’s the image source).

Optional query overrides:

```text
https://github-tool-chart.vercel.app/api/profile?bg=aurora&title=Ryan
```

Edit [`config.json`](config.json) for permanent title/embeds, commit + push (or `npx vercel --prod`) so the live image updates.

---

## Local preview (CLI)

```bash
cp config.example.json config.json
npm run compose
```

Open `output/profile.svg` in a browser.

```bash
npm run compose:example          # uses config.example.json
npm run compose:aurora           # another preset demo
node scripts/compose.mjs --help
```

For a local live server (same as production):

```bash
npx vercel dev
# then open http://localhost:3000/api/profile
```

---

## Config

| Field | Meaning |
|--------|---------|
| `background` | Preset (`midnight`, `aurora`, `slate`), local path, or `https://` image URL |
| `width` / `height` | Canvas size |
| `slots` | Layers on top of the background |

### Slot types

```json
{ "type": "text", "text": "Hi", "x": 40, "y": 60, "fontSize": 36, "fill": "#fff", "fontWeight": "700" }

{ "type": "svg", "src": "embeds/chart.svg", "x": 40, "y": 120, "width": 500, "height": 280 }

{ "type": "svg", "src": "https://example.com/your-stats-card.svg?user=You", "x": 40, "y": 120, "width": 500, "height": 280 }

{ "type": "image", "src": "photos/avatar.png", "x": 700, "y": 40, "width": 120, "height": 120 }
```

- **svg** — local path or any `https://` URL that returns SVG (stats trackers, charts, badges, etc.)
- **image** — local or remote png/jpg/gif/webp
- Remote sources are fetched and inlined on each compose (subject to API cache headers)

### Backgrounds

| You want | `"background"` value |
|----------|----------------------|
| Built-in | `"midnight"`, `"aurora"`, `"slate"` |
| File in repo | `"presets/midnight.svg"` or `"photos/beach.png"` |
| Remote photo | `"https://example.com/banner.jpg"` |

---

## Layout sketch (example config)

```text
←———————————— 900px ————————————→
┌────────────────────────────────────────┐
│  background (preset / photo / URL)     │
│  Title + subtitle                      │
│  ┌───────────────┐  ┌────────┐         │
│  │ local / remote│  │ remote │         │
│  │ svg embed     │  │ embed  │         │
│  └───────────────┘  └────────┘         │
└────────────────────────────────────────┘
```

---

## Caching

The API sends `Cache-Control: public, s-maxage=…, stale-while-revalidate=86400`.

- Default max age: **1 hour** (`CACHE_MAX_AGE=3600`).
- Lower it for fresher remote embeds (more upstream calls on your Vercel + those hosts).
- GitHub/CDN may cache the image as well; hard-refresh or wait for TTL to see changes.

---

## Why self-host?

A shared public URL would put everyone’s traffic on one quota. Each user deploying their own instance keeps limits and cost on their account.

---

## Limits

- One flat image: links/hover inside nested SVGs usually do not behave like normal README markdown.
- Animated GIF backgrounds often will not animate when GitHub displays the SVG.
- Upstream embed hosts can still rate-limit; caching reduces how often you call them.
