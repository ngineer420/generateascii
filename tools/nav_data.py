"""generateascii.com navigation data — the single source of truth for the toolbar.

This is the ONLY file that differs between sites. `sync_nav.py` is generic and
copies verbatim. Nothing here is computed at runtime by the browser: sync_nav
renders it into the static HTML of the three hand-written tool pages, and
`build_font_pages.py` imports the same renderer for the 123 generated ones, so
there is exactly one definition of the bar in the repo.

Tier rule (portfolio spec, ngineer420.github.io#13): a page is tier 1 only if it
answers a *different question*. The same tool with a parameter baked in is
tier 2 — it never appears in the rail or the sheet body. It gets one hub link at
the bottom of the sheet plus real <a href> sibling chips inside the tool's own
control panel, where it is a parameter and not a peer.

Here the 59 font pages are the same renderer with `font` fixed, so they are
tier 2: their hub is /fonts/ and their sibling cluster sits under the h1 of each
font page. The font list is read from the same manifest the generator reads, so
the literal count in the hub label cannot drift as fonts are added.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def _font_slugs():
    """The tier-2 page list, from assets/js/fonts-manifest.js.

    Read rather than written out: build_font_pages.py derives the 59 slugs from
    this same file with this same rule, and two hand-maintained copies of a
    fifty-nine-entry list is how a count in the chrome goes stale.
    """
    src = open(os.path.join(ROOT, "assets/js/fonts-manifest.js"), encoding="utf-8").read()
    names = re.findall(r'\{\s*file:\s*"([^"]+)",\s*category:\s*"[^"]+"\s*\}', src)
    if not names:
        raise SystemExit("could not parse assets/js/fonts-manifest.js")
    return [re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-") for n in names]


FONT_SLUGS = _font_slugs()

# Noun used in the menu trigger: "All 3 tools".
NOUN = "tools"

# Tier-1 tools, in rail order.
#   label -> rail chip text, <= 18 chars. Short here on purpose: the page font
#            is monospace, and "Text to ASCII" plus "Image to ASCII" plus the
#            trigger is 500px of chips on a 390px phone. The sheet carries the
#            full names, which is exactly what `long` is for.
#   long  -> anchor text in the sheet and in any footer/in-body list
#   group -> sheet grouping key, only used once a site passes 8 destinations
TOOLS = [
    {"href": "/text-to-ascii",  "label": "Text",  "long": "Text to ASCII",  "group": "make",   "tier": 1},
    {"href": "/image-to-ascii", "label": "Image", "long": "Image to ASCII", "group": "make",   "tier": 1},
    {"href": "/fonts/",         "label": "Fonts", "long": "Font Gallery",   "group": "browse", "tier": 1},
]

# Sheet groups, in order. Unused at <= 8 destinations (the sheet renders flat,
# because group headings are noise at that size) — kept so the arrangement is
# already decided the day this site gains a ninth tool.
GROUPS = [
    ("make",   "Make ASCII art"),
    ("browse", "Browse"),
]

# One hub link at the bottom of the sheet per tier-2 family.
HUBS = [("/fonts/", "All %d fonts" % len(FONT_SLUGS))]

# Tier-2: the 59 font landing pages. One renderer with the font fixed, so they
# are deliberately absent from the rail and the sheet body. They are declared
# here so the gallery chip carries aria-current="true" on a font page rather
# than the rail rendering unselected on the site's highest-traffic page shape
# (spec #13 errata, defect 4). Their sibling cluster is emitted by
# build_font_pages.py under each page's h1, not from a `sizechips` region: the
# cluster is the font's own category, which is per-page and not per-site.
VARIANTS = {
    "parent": "/fonts/",
    "label": "Font",
    "aria": "FIGlet font",
    "items": [{"href": "/fonts/%s/" % s, "label": s, "bytes": None} for s in FONT_SLUGS],
}

# Long anchor text for a footer crawl list, if the site has one. The generated
# pages already ship a footer with Home and Font gallery in it; it stays as it
# is, so this renderer has nothing to add.
FOOTER = []

# One-time --migrate: what the legacy markup looked like and where the marker
# pairs go. Per-site, because the legacy markup is per-site. Ops run in order.
# The generated pages never see these: build_font_pages.py writes the marked
# region itself from the same renderer.
MIGRATE = [
    # The old tab strip, which lived *inside* <main> — a second nav layer under
    # the header. On index.html it also carried role="tablist" and
    # role="tab" tabindex="-1", which took half its own links out of tab order
    # and announced site navigation as tabs; the spec forbids porting that.
    {"op": "strip", "pattern": r'\n  <nav [^>]*class="tabbar"[^>]*>.*?\n  </nav>'},
    # The homepage's stray third link, which existed because its tab strip only
    # had room for two. The rail carries all three on every page now.
    {"op": "strip", "pattern": r'\n  <p class="tabbar-aside">.*?</p>'},
    # The toolbar is a direct child of <body>, immediately after </header>.
    {"op": "insert_after", "region": "nav", "pattern": r"</header>", "indent": ""},
]
