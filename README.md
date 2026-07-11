# generateascii.com

A free, ad-supported ASCII art generator with two tools in one page:

- **Text → ASCII**: FIGlet-style banner text using [figlet.js](https://github.com/patorjk/figlet.js) with a curated set of 59 fonts, a live browsable font gallery, solid/rainbow color, and .txt/.png export.
- **Image → ASCII**: drag-and-drop image-to-ASCII conversion via canvas luminance mapping, with adjustable width, character ramp, brightness/contrast/gamma, invert, and monochrome/full-color output.

Everything runs client-side — no backend, no build step, no uploads. Deployed as static files on GitHub Pages.

## Local development

No build tooling required. Serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Structure

```
index.html            Main app (both tools)
privacy.html           Privacy policy (required for ad networks)
terms.html             Terms of use
assets/css/styles.css  Design system
assets/js/app.js       All app logic (tabs, font gallery, canvas image pipeline, export)
assets/js/figlet.min.js       Vendored figlet.js browser build
assets/js/fonts-manifest.js   Curated font catalogue
assets/fonts/*.flf      Vendored FIGlet font files (from the figlet npm package)
CNAME                   GitHub Pages custom domain (generateascii.com)
```

## Enabling ads (Google AdSense)

1. Deploy the site and get it live at generateascii.com.
2. Apply at https://adsense.google.com with the live URL. Approval requires a working privacy policy (already included) and some real content/traffic — it isn't instant.
3. Once approved, uncomment the AdSense `<script>` tag in `index.html`'s `<head>` and replace `ca-pub-XXXXXXXXXXXXXXXX` with your publisher ID.
4. Fill in real ad units in place of the `.ad-slot` placeholder `<div>`s (`#ad-top`, `#ad-inline`, `#ad-footer`) with your AdSense ad unit code.

## Custom domain (generateascii.com)

The `CNAME` file tells GitHub Pages to serve this repo at `generateascii.com`. You still need to point DNS at GitHub Pages yourself:

- Apex domain (`generateascii.com`): four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `www` subdomain (optional): `CNAME` record to `<username>.github.io`.

Then enable Pages in the repo's Settings → Pages, and enter `generateascii.com` as the custom domain (GitHub will offer to enforce HTTPS once DNS propagates).

## Fonts license

`.flf` FIGlet font files are bundled from the [figlet](https://www.npmjs.com/package/figlet) npm package (MIT), which itself distributes the long-standing public FIGlet font collection used by essentially every FIGlet-based tool on the web.
