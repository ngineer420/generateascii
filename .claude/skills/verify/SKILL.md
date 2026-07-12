---
name: verify
description: Build/launch/drive recipe to verify generateascii.com changes in a real browser.
---

# Verifying generateascii.com

Static site — no build step. Serve the repo root and drive it headless.

## Launch

```bash
python3 -m http.server 8613 --bind 127.0.0.1   # run from repo root, in background
```

Note: binding a socket is blocked by the Claude Code bash sandbox
(`PermissionError` on `server_bind`) — run the server and the browser driver
with sandbox disabled.

## Drive

No global Playwright install, but the npm npx cache has one with matching
Chromium binaries:

```bash
NODE_PATH=/Users/max/.npm/_npx/e41f203b7505f1fb/node_modules node driver.js
```

(`require("playwright")`, `chromium.launch()`. If that cache entry is gone,
`npx playwright@latest` needs a network-enabled install first.)

## Flows worth driving

- Text tab: click the preview surface, type, confirm the figlet art re-renders
  (`#text-output`), pick a font from the `#font-gallery` list, use Copy and
  check `navigator.clipboard.readText()` (grant clipboard permissions on the
  context first).
- Reload the page: text/font/controls must survive (sessionStorage, `ga:` keys).
- Mobile viewport (390px): check `document.body.scrollWidth === innerWidth` —
  wide figlet art in the gallery has caused horizontal page overflow before.
- Image tab: drop/paste path needs a real file; controls-only checks are fine
  for CSS-level changes.

## Gotchas

- Gallery tiles are grid items; `overflow: hidden` on `.gallery-item` inside a
  fixed-height scrollable gallery collapses every tile to padding height
  (automatic minimum size → 0). Keep pre-level `overflow-x: auto` instead.
- Headless Chromium defaults to `prefers-color-scheme: light`; the site's dark
  look needs `colorScheme: "dark"` in the Playwright context if you want to
  screenshot it.
- Fonts load lazily per style (`/assets/fonts/*.flf`); wait ~1s after
  `networkidle` before asserting on gallery tile contents.
