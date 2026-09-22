# Github Tool Chart — profile image compositor

Builds **one** profile SVG from a background (preset, local file, or URL) plus slots for text and your updating SVG embeds.

## Quick start

```bash
npm run compose:example
```

Writes `output/profile.svg`. Open that file in a browser to preview.

Copy the example config and edit it:

```bash
cp config.example.json config.json
npm run compose
```

## Config

| Field | Meaning |
|--------|---------|
| `background` | Preset name (`midnight`, `aurora`, `slate`), a local path, or an `https://` image URL (png/jpg/gif/webp/svg) |
| `width` / `height` | Canvas size |
| `slots` | Layers drawn on top of the background |

Slot types:

- `text` — `{ type, text, x, y, fontSize, fill, fontFamily, fontWeight }`
- `svg` — `{ type, src, x, y, width, height }` (your live embeds)
- `image` — `{ type, src, x, y, width, height }` (raster)

## Profile README

After composing, point your profile README at the image:

```markdown
![Profile](./output/profile.svg)
```

Or host/commit the file in your `username/username` repo and use that path.

Re-run `npm run compose` whenever an embed SVG changes (or wire that into a GitHub Action later).

## Notes

- Animated GIF backgrounds are embedded as data URIs; animation often **does not** play when GitHub displays the SVG as an image. Prefer a static frame, PNG, or SVG preset if motion matters.
- Nested SVGs stay vector; keep embeds as SVG when you can.
