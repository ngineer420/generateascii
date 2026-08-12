#!/usr/bin/env python3
"""Generate the per-font landing pages under /fonts/ from the font catalogue.

The 59 FIGlet fonts are already data in this repo — `assets/js/fonts-manifest.js`
plus `assets/fonts/*.flf`. Nobody should be hand-writing 59 near-identical pages
from them, so this does it, and it is the only thing that should ever write
those files.

    python3 tools/build_font_pages.py            # regenerate everything
    python3 tools/build_font_pages.py --check    # fail if anything is stale

What it writes, all under the repo root:

    fonts/index.html + fonts.html                 the index of all 59
    fonts/<slug>/index.html + fonts/<slug>.html   one per font
    sitemap.xml                                   rebuilt to match what is on disk

Every page exists at both `/fonts/<slug>/` and `/fonts/<slug>.html`, byte for
byte identical, because every asset link is absolute. The canonical on both is
the directory form.

The sample art is baked in as real text by tools/figfont.py, which is a port of
the vendored figlet.js — see tools/check_figfont.py for the proof they agree.
That matters: the page has to have content before JavaScript runs, and it must
not change when the page's live generator re-renders it a moment later.

Standard library only. Python 3.8+.
"""

import argparse
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from figfont import FigFont  # noqa: E402
import nav_data as NAV  # noqa: E402
import sync_nav  # noqa: E402  — the toolbar renderer, shared with the hand-written pages

SITE = "https://generateascii.com"
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
OUT_DIR = os.path.join(ROOT, "fonts")

# Sample strings, in preference order. The first that renders visibly in a
# given font wins — several fonts ship blank digits or blank lowercase.
HERO_FALLBACKS = ["ASCII", "Ascii", "ABC", "A"]
SECOND_SAMPLE = "Hello World"
THIRD_SAMPLE = "0123456789"
MAX_HERO_COLS = 96

THEME_BOOTSTRAP = (
    '<script>try{var t=localStorage.getItem("ga-theme");'
    'if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>'
)

ADSENSE = ('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
           '?client=ca-pub-7560786263587509" crossorigin="anonymous"></script>')

ERABBIT = ('<a href="https://erabb.it" class="erabbit-mark" aria-label="erabb.it">'
           '<img src="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 '
           'viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐇</text></svg>" '
           'width="10" height="10" alt=""></a>')


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise ValueError("font name %r has no slug" % name)
    return slug


def load_catalogue():
    src = open(os.path.join(ROOT, "assets/js/fonts-manifest.js"), encoding="utf-8").read()
    entries = re.findall(r'\{\s*file:\s*"([^"]+)",\s*category:\s*"([^"]+)"\s*\}', src)
    if not entries:
        raise SystemExit("could not parse assets/js/fonts-manifest.js")
    return [{"name": n, "category": c, "slug": slugify(n)} for n, c in entries]


def esc(s):
    return html.escape(s, quote=True)


def pre_block(lines, extra_class=""):
    body = html.escape("\n".join(lines).rstrip("\n"))
    cls = ("ascii-sample " + extra_class).strip()
    return '<div class="%s"><pre>%s</pre></div>' % (cls, body)


def pick_hero(font, name):
    """Best visible sample for the hero: the font's own name if it fits."""
    for candidate in [name] + HERO_FALLBACKS:
        if not font.renders(candidate):
            continue
        if font.width_of(candidate) <= MAX_HERO_COLS:
            return candidate
    return None


def head(title, description, url, nav_url, ld_name, ld_description):
    ld = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": ld_name,
        "url": url,
        "applicationCategory": "DesignApplication",
        "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "description": ld_description,
    }
    return """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#0b0d0f">

<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{site}/assets/og-image.png">

<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/styles.css">
<script src="/assets/js/toolbar.js" defer></script>
{theme}

<script type="application/ld+json">
{ld}
</script>

{ads}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/" aria-label="generateascii.com home">
      <span class="brand-mark"><span class="bracket">[</span>generate<span class="bracket">/</span>ascii<span class="bracket">]</span></span>
      <span class="brand-tag">text &amp; image → ASCII art</span>
    </a>
    <div class="header-actions">
      <button id="theme-toggle" class="icon-btn" type="button" aria-label="Toggle dark/light theme" title="Toggle theme">◐</button>
    </div>
  </div>
</header>

<!-- nav:start -->
{nav}
<!-- nav:end -->

""".format(title=esc(title), description=esc(description), url=url, site=SITE,
           theme=THEME_BOOTSTRAP, ads=ADSENSE,
           nav=sync_nav.render_nav(sync_nav.canon(nav_url)),
           ld=json.dumps(ld, indent=2, ensure_ascii=False))


def font_switch(entry, siblings):
    """The tier-2 sibling cluster, directly under the h1 of a font page.

    Portfolio spec #13: a font page is the same renderer with the font fixed,
    so its siblings are not peers of the three tools and do not belong in the
    rail. They belong next to the control they change, as real links, above the
    fold — this used to be a link list at the very bottom of the page, which is
    not where a visitor decides the font is wrong for them.
    """
    out = ['  <nav class="font-switch" aria-labelledby="font-switch-label">',
           '    <span class="font-switch-label" id="font-switch-label">%s fonts</span>'
           % esc(entry["category"]),
           '    <ul>']
    for s in [entry] + list(siblings):
        current = ' aria-current="page"' if s["slug"] == entry["slug"] else ""
        out.append('      <li><a class="chip" href="/fonts/%s/"%s>%s</a></li>'
                   % (s["slug"], current, esc(s["name"])))
    out.append('      <li><a class="chip chip-all" href="/fonts/">All %d fonts →</a></li>'
               % len(NAV.FONT_SLUGS))
    out += ['    </ul>', '  </nav>']
    return "\n".join(out)


FOOT = """
<footer class="site-footer">
  <div class="footer-inner">
    <div>© <span id="year"></span> generateascii.com</div>
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="/fonts/">Font gallery</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="https://github.com/patorjk/figlet.js" target="_blank" rel="noopener">Fonts via figlet.js</a>
    </div>
  </div>
</footer>

{erabbit}

<script src="/assets/js/figlet.min.js"></script>
<script src="/assets/js/fonts-manifest.js"></script>
<script src="/assets/js/font-page.js"></script>
</body>
</html>
""".format(erabbit=ERABBIT)


def font_page(font, entry, siblings):
    name, slug, category = entry["name"], entry["slug"], entry["category"]
    url = "%s/fonts/%s/" % (SITE, slug)
    title = "%s ASCII Art Font — Free Generator & Preview" % name
    description = ("Generate ASCII art in the %s FIGlet font. See a live preview, type your own "
                   "text, and copy the result — free, instant, and entirely in your browser."
                   % name)

    hero_text = pick_hero(font, name)
    hero = font.render(hero_text) if hero_text else [""]
    second = font.render(SECOND_SAMPLE) if font.renders(SECOND_SAMPLE) else None
    digits = font.render(THIRD_SAMPLE) if font.renders(THIRD_SAMPLE) else None

    facts = [
        ("Height", "%d lines" % font.height),
        ("Layout", font.layout_label()),
        ("Lowercase", "distinct lowercase glyphs" if font.has_lowercase()
         else "uppercase only (a-z reuse A-Z)"),
        ("Digits", "yes" if digits else "no digit glyphs"),
        ("Category", category),
    ]
    credit = font.attribution()

    body = []
    body.append('<main id="main">')
    body.append('''  <div class="hero">
    <h1>%s ASCII Art Generator</h1>
    <p>Turn any text into ASCII art with the <strong>%s</strong> FIGlet font — free, instant, and processed entirely in your browser.</p>
  </div>''' % (esc(name), esc(name)))
    body.append(font_switch(entry, siblings))
    body.append('')

    body.append('  <div class="panel">')
    body.append('    <h2>%s preview</h2>' % esc(name))
    body.append("    " + pre_block(hero, "ascii-sample--hero"))
    body.append('''    <label class="font-page-label" for="font-page-input">Type your own text</label>
    <div class="font-page-row">
      <input id="font-page-input" type="text" maxlength="40" value="%s" autocomplete="off" spellcheck="false" placeholder="Your text here">
      <button type="button" id="font-page-copy">Copy</button>
    </div>
    <p class="font-page-note" id="font-page-note">The preview above updates as you type. Nothing is uploaded — the font is rendered on your device.</p>''' % esc(hero_text or ""))
    body.append('  </div>')

    if second:
        body.append('  <div class="panel">')
        body.append('    <h2>%s in a sentence</h2>' % esc(name))
        body.append("    " + pre_block(second))
        body.append('  </div>')
    if digits:
        body.append('  <div class="panel">')
        body.append('    <h2>%s digits</h2>' % esc(name))
        body.append("    " + pre_block(digits))
        body.append('  </div>')

    body.append('  <div class="panel">')
    body.append('    <h2>About the %s font</h2>' % esc(name))
    body.append('    <dl class="font-facts">')
    for k, v in facts:
        body.append('      <div><dt>%s</dt><dd>%s</dd></div>' % (esc(k), esc(v)))
    body.append('    </dl>')
    if credit:
        body.append('    <p class="font-credit">From the FIGlet font collection: <span>%s</span></p>' % esc(credit))
    body.append('''    <p><a class="font-page-cta" href="/text-to-ascii?font=%s">Open %s in the full generator →</a></p>
    <p class="font-page-note">The full generator adds colour, layout modes, a size slider, and .txt / .png export.</p>''' % (esc(name), esc(name)))
    body.append('  </div>')

    body.append('  <section class="container-narrow about-section" style="padding-left:0;padding-right:0;">')
    body.append('    <h2>What %s looks like, and when to use it</h2>' % esc(name))
    body.append('''    <p>%s is one of 59 FIGlet fonts on this site. FIGlet fonts are not typefaces in the usual sense: each one is a small file describing how to draw every character out of ordinary text symbols, %d lines tall, so the result is plain text you can paste anywhere a monospace font renders — a terminal banner, a README, a code comment, an IRC channel.</p>
    <p>This font draws its characters %d lines high and joins them using %s layout, which is the setting the font's own author chose. %s Wide art is the usual gotcha: a banner that looks right in a full-width terminal will wrap badly in a narrow one, so check the width of your text before you paste it somewhere fixed.</p>''' % (
        esc(name), font.height, font.height, esc(font.layout_label()),
        ("It has its own lowercase glyphs, so mixed-case text keeps its shape."
         if font.has_lowercase()
         else "It has no separate lowercase glyphs — lowercase input renders using the uppercase shapes.")))
    body.append('  </section>')

    body.append('</main>')

    return (head(title, description, url, "/fonts/%s/" % slug,
                 "%s ASCII Art Generator" % name,
                 "Free browser-based ASCII art generator using the %s FIGlet font." % name)
            + "\n".join(body) + FOOT)


def index_page(entries, fonts):
    url = SITE + "/fonts/"
    title = "All 59 ASCII Art Fonts — FIGlet Font Gallery"
    description = ("Browse all 59 FIGlet fonts available on generateascii.com, grouped by style, "
                   "each with a live preview and its own generator page. Free and instant.")

    by_category = {}
    order = []
    for e in entries:
        if e["category"] not in by_category:
            by_category[e["category"]] = []
            order.append(e["category"])
        by_category[e["category"]].append(e)

    body = []
    body.append('<main id="main">')
    body.append('''
  <div class="hero">
    <h1>ASCII Art Font Gallery</h1>
    <p>All %d FIGlet fonts on generateascii.com, grouped by style. Every font has its own page with a live preview.</p>
  </div>
''' % len(entries))

    for category in order:
        body.append('  <section class="font-index-group">')
        body.append('    <h2>%s</h2>' % esc(category))
        body.append('    <div class="font-index-grid">')
        for e in by_category[category]:
            font = fonts[e["name"]]
            sample_text = pick_hero(font, e["name"]) or "ABC"
            sample = font.render(sample_text)
            body.append('      <a class="font-index-card" href="/fonts/%s/">' % e["slug"])
            body.append('        <span class="font-index-name">%s</span>' % esc(e["name"]))
            body.append('        <pre>%s</pre>' % html.escape("\n".join(sample).rstrip("\n")))
            body.append('      </a>')
        body.append('    </div>')
        body.append('  </section>')

    body.append('''  <section class="container-narrow about-section" style="padding-left:0;padding-right:0;">
    <h2>About these fonts</h2>
    <p>Every font here is a FIGlet font — a plain-text file describing how to draw each character out of ordinary symbols. They come from the long-standing public FIGlet collection bundled with <a href="https://github.com/patorjk/figlet.js" target="_blank" rel="noopener">figlet.js</a>, and they render on your device: no font file, no image and no text you type is ever uploaded.</p>
    <p>Pick a font to see it at full size with a live preview you can type into, then open it in the <a href="/text-to-ascii">full generator</a> for colour, layout modes, sizing and .txt / .png export.</p>
  </section>''')
    body.append('</main>')

    return (head(title, description, url, "/fonts/",
                 "ASCII Art Font Gallery",
                 "Browse all 59 FIGlet fonts available on generateascii.com, each with a live preview.")
            + "\n".join(body) + FOOT)


def sitemap(entries):
    rows = [('/', 'weekly', '1.0'),
            ('/text-to-ascii', 'monthly', '0.8'),
            ('/image-to-ascii', 'monthly', '0.8'),
            ('/fonts/', 'monthly', '0.8')]
    for e in entries:
        rows.append(('/fonts/%s/' % e["slug"], 'monthly', '0.6'))
    for a in ["history-of-ascii-art", "how-text-to-ascii-generators-work",
              "where-ascii-art-lives-today", "why-we-built-this-generator"]:
        rows.append(('/articles/%s.html' % a, 'yearly', '0.5'))
    rows.append(('/privacy.html', 'yearly', '0.2'))
    rows.append(('/terms.html', 'yearly', '0.2'))

    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, prio in rows:
        out += ['  <url>', '    <loc>%s%s</loc>' % (SITE, loc),
                '    <changefreq>%s</changefreq>' % freq,
                '    <priority>%s</priority>' % prio, '  </url>']
    out.append('</urlset>')
    return "\n".join(out) + "\n"


def write(path, text, check, stale):
    if check:
        if not os.path.exists(path) or open(path, encoding="utf-8").read() != text:
            stale.append(os.path.relpath(path, ROOT))
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="report stale/missing generated files instead of writing")
    args = ap.parse_args()

    entries = load_catalogue()
    # The sheet's hub label is a literal count and the rail's aria-current
    # depends on the tier-2 list, both read from the same manifest by
    # tools/nav_data.py. If the two readings ever disagree the chrome is lying.
    if [e["slug"] for e in entries] != NAV.FONT_SLUGS:
        raise SystemExit("tools/nav_data.py and the catalogue disagree on the font list")
    slugs = [e["slug"] for e in entries]
    if len(set(slugs)) != len(slugs):
        dupes = sorted({s for s in slugs if slugs.count(s) > 1})
        raise SystemExit("slug collision: %s" % ", ".join(dupes))

    fonts = {}
    for e in entries:
        path = os.path.join(FONT_DIR, e["name"] + ".flf")
        if not os.path.exists(path):
            raise SystemExit("missing font file: %s" % path)
        fonts[e["name"]] = FigFont(path, e["name"])

    stale = []
    for e in entries:
        siblings = [s for s in entries
                    if s["category"] == e["category"] and s["slug"] != e["slug"]][:6]
        page = font_page(fonts[e["name"]], e, siblings)
        write(os.path.join(OUT_DIR, e["slug"], "index.html"), page, args.check, stale)
        # Flat alias: byte-identical, because every link in the page is absolute.
        write(os.path.join(OUT_DIR, e["slug"] + ".html"), page, args.check, stale)

    idx = index_page(entries, fonts)
    write(os.path.join(OUT_DIR, "index.html"), idx, args.check, stale)
    write(os.path.join(ROOT, "fonts.html"), idx, args.check, stale)
    write(os.path.join(ROOT, "sitemap.xml"), sitemap(entries), args.check, stale)

    if args.check:
        if stale:
            print("stale or missing (%d):" % len(stale))
            for s in stale[:20]:
                print("  " + s)
            if len(stale) > 20:
                print("  ... and %d more" % (len(stale) - 20))
            return 1
        print("all generated files are up to date (%d fonts)" % len(entries))
        return 0

    print("wrote %d font pages (x2 URL forms), the index, and sitemap.xml" % len(entries))
    return 0


if __name__ == "__main__":
    sys.exit(main())
