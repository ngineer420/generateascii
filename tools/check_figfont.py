#!/usr/bin/env python3
"""Prove tools/figfont.py renders identically to the vendored figlet.js.

The per-font landing pages ship a sample rendered by figfont.py, and the page's
live generator re-renders with figlet.js the moment a visitor types. If the two
disagree, the page visibly flinches. So: render every font in the catalogue
against a corpus with Python, then diff against figlet.js in a real browser.

    python3 tools/check_figfont.py     # writes tools/.figfont-expected.json
    python3 -m http.server 8000        # then open /tools/check_figfont.html

This script renders the Python side; tools/check_figfont.html renders the
figlet.js side in a real browser and reports the diff. Both engines must agree
on every case, or the baked samples on the /fonts/ pages will visibly change
the moment JavaScript runs.
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from figfont import FigFont  # noqa: E402

CORPUS = [
    "Hello World 123",
    "ABCDEFGHIJKLM",
    "nopqrstuvwxyz",
    "0123456789",
    "!@#$%^&*()_+-=",
    "The quick brown fox",
    "ascii art",
    "W",
    "il1|",
    "  spaced  out  ",
]


def font_names():
    src = open(os.path.join(ROOT, "assets/js/fonts-manifest.js"), encoding="utf-8").read()
    return re.findall(r'\{\s*file:\s*"([^"]+)"', src)


def main():
    names = font_names()
    data = {}
    for name in names:
        font = FigFont(os.path.join(ROOT, "assets/fonts", name + ".flf"), name)
        entry = {}
        for i, text in enumerate(CORPUS):
            entry["c%d" % i] = font.render(text)
            entry["c%d-fit" % i] = font.render(text, "fitted")
            entry["c%d-full" % i] = font.render(text, "full")
        entry["nm"] = font.render(name)
        data[name] = entry

    out = os.path.join(HERE, ".figfont-expected.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"corpus": CORPUS, "data": data}, fh)
    print("rendered %d fonts x %d cases -> %s" % (names.__len__(), len(CORPUS) * 3 + 1, out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
