# generateascii.com

Free, ad-supported ASCII art generator. Two tools, zero backend: **Text → ASCII**
(FIGlet banners, 59 curated fonts) and **Image → ASCII** (canvas luminance mapping).
Everything runs client-side — no build step, no uploads, no server. Static files on
GitHub Pages at generateascii.com.

## Architecture

- `index.html` — landing page; both tool panels, About + Learn More sections.
- `text-to-ascii.html` / `image-to-ascii.html` — standalone per-tool pages with their
  own `<title>`/`<meta>`/canonical for SEO. They share the same markup and `app.js`;
  the difference is which panel opens `active`. The tab bar links are real `<a href>`s
  to these URLs (crawlable), not just JS tab switches. **Keep all three panel markups
  in sync** — an edit to a control in `index.html` almost always needs the same edit
  in the matching per-tool page.
- `fonts/` — **generated, do not hand-edit.** One landing page per FIGlet font
  (`fonts/<slug>/index.html` plus a byte-identical flat `fonts/<slug>.html`), and
  an index at `fonts/index.html` / `fonts.html`. Everything under `fonts/`, plus
  `sitemap.xml`, is written by `tools/build_font_pages.py` — change the template
  in that script and re-run it, never edit the output.
- `tools/` — the page generator and its FIGlet engine (Python 3, stdlib only, not
  shipped to the browser). See "Per-font pages" below.
- `articles/` — 4 SEO/content articles linked from the Learn More section.
- `assets/js/app.js` — all logic (~1000 lines): tabs, font gallery, editable preview,
  canvas image pipeline, export, session persistence.
- `assets/js/figlet.min.js` — vendored figlet.js browser build.
- `assets/js/fonts-manifest.js` — curated 59-font catalogue, grouped by style.
- `assets/fonts/*.flf` — vendored FIGlet fonts (from the `figlet` npm package, MIT).
  Loaded **lazily per style group** on demand.
- `privacy.html` / `terms.html` — required for ad networks; keep them working.

Serve locally with any static server (`python3 -m http.server 8000`). To verify
changes in a real browser, use the `generateascii:verify` skill.

## Per-font pages (`/fonts/`)

59 fonts is 59 pages of surface built from data already in the repo, so they are
generated, not written:

```
python3 tools/build_font_pages.py           # regenerate fonts/ and sitemap.xml
python3 tools/build_font_pages.py --check   # non-zero if the output is stale
```

Each page bakes a real ASCII sample into the HTML as text, so the page has
content with JavaScript off and before figlet.js loads. That sample is rendered
by `tools/figfont.py`, a Python port of the horizontal layout in the vendored
`figlet.min.js` — **not** of the original C figlet, which differs from figlet.js
in several places. It has to match exactly, because `assets/js/font-page.js`
re-renders the same string with figlet.js the moment the page is interactive and
the preview must not visibly jump.

Whenever you touch `tools/figfont.py`, prove the two still agree:

```
python3 tools/check_figfont.py     # writes tools/.figfont-expected.json (gitignored)
python3 -m http.server 8000        # then open /tools/check_figfont.html
```

That is 59 fonts x 10 strings x 3 layout modes plus each font's own name — 1829
comparisons, and the expected result is zero mismatches.

`/fonts/<slug>/` links into the main tool as `/text-to-ascii?font=<Font Name>`;
`app.js` reads that parameter, validates it against `FONT_CATALOGUE`, and applies
it after the sessionStorage restore so an explicit link always wins.

## UX decisions (we iterated to these — don't regress them)

These were arrived at over many rounds. If a change would undo one, that's a
regression, not a cleanup.

**Text tool: the preview IS the input.** There's no separate text box. You click the
rendered ASCII art and type; a real `<textarea>` (`.ghost-input`) sits invisibly over
the `<pre>` and captures keystrokes. The `#text-edit-hint` ("click the art & type")
signals this. Keystrokes re-render the figlet art live.

**Custom caret.** Because the input is transparent, we draw our own caret
(`.ascii-caret`) positioned at the art column matching the real cursor index — it
tracks the actual caret position, not just end-of-line (this was PR #15). Clicking the
art moves the caret to the nearest character. Keep the caret metrics (`caretMetrics`,
`caretIndexFromClick`) working when touching preview rendering.

**Honest placeholder.** When empty and blurred, show a dimmed sample phrase as a
placeholder that **scales itself to fit the width** (ignores the Size slider) so it
never overflows. On focus the placeholder vanishes; on blur with no text it returns.
The placeholder uses the `is-placeholder` class and does **not** affect copy/export
output. Don't show fake sample text that could be mistaken for real content.

**Font gallery is a list beside the preview**, not a dropdown. Each tile renders your
current text in that font (live). It's grouped by style. There's an **Expand** button
for fullscreen browsing; picking a font in fullscreen selects it and drops back out.
We removed the font filter/search deliberately (PR #6/#7) — the grouped list is the nav.

**No horizontal page overflow, ever.** Wide figlet art has caused mobile page overflow
before. Tiles fit art to width; scrolling lives inside `overflow-x: auto` containers at
the `<pre>` level, never on the page body. Do **not** put `overflow: hidden` on
`.gallery-item` — inside the fixed-height scrollable gallery it collapses tiles to
padding height. Always check `document.body.scrollWidth === innerWidth` at 390px.

**Layout modes** (Text): Default / Full width / Fitted — map to figlet's
`horizontalLayout`. Fitted placeholder measurement strips trailing whitespace so it
doesn't skew the fit.

**Style controls** (Text): Size slider (8–32px), Text color with Solid/Rainbow
segmented toggle, Background (Dark / Light / Transparent), Layout select.

**Image tool:** drop / click / paste an image → columns-width slider, character-set
ramp (standard/detailed/blocks/binary/custom, light→dark), dithering
(none / Floyd–Steinberg / ordered Bayer 4x4), Monochrome vs Full color,
Dark/Light background, and Fine-tune (brightness / contrast / gamma / invert).

**Colour survives as text, not only as a PNG.** `Copy ANSI` and `.ans` emit 24-bit
SGR escapes for a terminal; `.html` emits a standalone page with one `<span>` per
run of colour. Plain `Copy` and `.txt` stay uncoloured on purpose.

**Animated GIFs become animated ASCII.** Frames are decoded with the browser's own
`ImageDecoder` (WebCodecs) — no library. Where it is missing (Firefox at time of
writing) `decodeAnimated` returns null and the GIF renders as a still, which is
the intended fallback, not a bug. Capped at 60 frames. Autoplay is suppressed
under `prefers-reduced-motion`. `Animated .html` exports a self-contained player
that carries the same reduced-motion guard.

**Exports everywhere:** Copy to clipboard, `.txt`, and rendered `.png` — on both tools.
Copy shows a "Copied!" flash.

**State survives reload.** Text, font, and controls persist across an accidental reload
within a session via `sessionStorage` under the `ga:` prefix. Keep new controls
persisted the same way.

**Theme toggle** (`◐`) switches dark/light and persists. Dark is the default look.

## Ads (Google AdSense — read the memory conventions)

- **AdSense Auto ads only.** The single `<script>` for `ca-pub-7560786263587509` lives
  in the `<head>`. **Never add manual `.ad-slot` divs** — Auto ads places units itself.
  This is a hard portfolio-wide rule; we removed manual slots in PR #4.
- `ads.txt` at the repo root is the AdSense verification.

## Deploy / infra

- GitHub Pages, custom domain via `CNAME` (generateascii.com). Apex `A` records point at
  GitHub Pages IPs; DNS is on Cloudflare.
- `.nojekyll` skips Jekyll processing.
- Keep `sitemap.xml` and `robots.txt` current when adding pages/articles.
- The `erabb.it` 🐇 mark in the footer is the portfolio signature — leave it.

## Conventions

- Vanilla HTML/CSS/JS, no framework, no build. Match the existing style.
- `assets/css/styles.css` is the whole design system — one file.
- When adding a tool page or article, update the tab nav (if a tool),
  `sitemap.xml`, and the Learn More list (if an article). `sitemap.xml` is
  rewritten by `tools/build_font_pages.py`, so add non-font URLs to the `rows`
  list in that script's `sitemap()` rather than editing the XML by hand.
- Infinite CSS animations need a `prefers-reduced-motion: reduce` guard. There is
  a blanket one at the end of `styles.css`; keep new animations inside it.
