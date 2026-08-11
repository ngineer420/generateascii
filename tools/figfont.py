"""A minimal FIGfont (.flf) parser and horizontal layout engine.

This exists so `build_font_pages.py` can bake a real ASCII sample into each
per-font landing page at generate time, instead of shipping 59 pages whose
only content appears after JavaScript runs.

It is a deliberate, line-by-line port of the horizontal layout in the vendored
`assets/js/figlet.js` — `getHorizontalSmushLength`, `mergeFigString`, `uni_Smush`
and the six `hRuleN_Smush` helpers — rather than of the original C figlet, which
differs from figlet.js in several places (notably rule 3 and rule 5, where
figlet.js's use of `indexOf` on a class string gives it its own quirks). The
baked sample has to be identical to what the page's live generator produces a
moment later, so matching figlet.js exactly is the requirement.

`tools/check_figfont.py` proves that equivalence against the real figlet.js in a
browser, across every font and a corpus of sample strings. Run it after touching
anything in here.

Standard library only. Python 3.8+.
"""

FULL_WIDTH = 0
FITTING = 1
SMUSHING = 2            # "universal" smushing — no rules selected
CONTROLLED_SMUSHING = 3

# figlet.js indexes these strings with indexOf, and the exact spacing matters:
# the gaps make adjacent members of a pair one apart and separate pairs further.
_RULE2_CHARS = "|/\\[]{}()<>"
_RULE3_CLASSES = "| /\\ [] {} () <>"
_RULE4_CLASSES = "[] {} ()"
_RULE5_CLASSES = "/\\ \\/ ><"
_RULE5_RESULT = {0: "|", 3: "Y", 6: "X"}


def _rule1(ch1, ch2, hardblank):
    """Equal character smushing."""
    if ch1 == ch2 and ch1 != hardblank:
        return ch1
    return None


def _rule2(ch1, ch2, hardblank):
    """Underscore smushing."""
    if ch1 == "_" and ch2 in _RULE2_CHARS:
        return ch2
    if ch2 == "_" and ch1 in _RULE2_CHARS:
        return ch1
    return None


def _rule3(ch1, ch2, hardblank):
    """Hierarchy smushing."""
    p1 = _RULE3_CLASSES.find(ch1)
    p2 = _RULE3_CLASSES.find(ch2)
    if p1 != -1 and p2 != -1 and p1 != p2 and abs(p1 - p2) != 1:
        return _RULE3_CLASSES[max(p1, p2)]
    return None


def _rule4(ch1, ch2, hardblank):
    """Opposite pair smushing."""
    p1 = _RULE4_CLASSES.find(ch1)
    p2 = _RULE4_CLASSES.find(ch2)
    if p1 != -1 and p2 != -1 and abs(p1 - p2) <= 1:
        return "|"
    return None


def _rule5(ch1, ch2, hardblank):
    """Big X smushing."""
    p1 = _RULE5_CLASSES.find(ch1)
    p2 = _RULE5_CLASSES.find(ch2)
    if p1 != -1 and p2 != -1 and p2 - p1 == 1:
        return _RULE5_RESULT.get(p1)
    return None


def _rule6(ch1, ch2, hardblank):
    """Hardblank smushing."""
    if ch1 == hardblank and ch2 == hardblank:
        return hardblank
    return None


_RULES = [(1, _rule1), (2, _rule2), (4, _rule3), (8, _rule4), (16, _rule5), (32, _rule6)]


class FigFont:
    def __init__(self, path, name):
        self.name = name
        self.path = path
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            lines = fh.read().split("\n")

        # Some fonts pad the header with extra spaces; drop the empty fields.
        header = [f for f in lines[0].split(" ") if f != ""]
        if not header[0].startswith("flf2a"):
            raise ValueError("%s is not a flf2a FIGfont" % path)

        self.hardblank = header[0][5]
        self.height = int(header[1])
        self.baseline = int(header[2])
        self.max_length = int(header[3])
        self.old_layout = int(header[4])
        comment_lines = int(header[5])
        self.print_direction = int(header[6]) if len(header) > 6 else 0
        self.full_layout = int(header[7]) if len(header) > 7 else None

        self.comments = [l.rstrip("\r") for l in lines[1:1 + comment_lines]]
        self.layout, self.rules = self._resolve_layout(self.old_layout, self.full_layout)

        # ASCII 32..126 in order, then the seven required Latin-1 characters.
        codes = list(range(32, 127)) + [196, 214, 220, 228, 246, 252, 223]
        self.chars = {}
        cursor = 1 + comment_lines
        for code in codes:
            block = lines[cursor:cursor + self.height]
            if len(block) < self.height:
                break
            cursor += self.height
            self.chars[code] = self._clean(block)

        # Code-tagged characters: "<code> <optional comment>" then `height` lines.
        while cursor < len(lines):
            tag = lines[cursor].strip()
            if not tag:
                break
            try:
                code = int(tag.split(" ")[0], 0)
            except ValueError:
                break
            block = lines[cursor + 1:cursor + 1 + self.height]
            if len(block) < self.height:
                break
            cursor += 1 + self.height
            self.chars[code] = self._clean(block)

    @staticmethod
    def _resolve_layout(old_layout, full_layout):
        """Turn the header layout fields into (layout mode, rule bitmask).

        Mirrors figlet.js's `getSmushingRules`: `full_layout` wins when present,
        bit 128 means smushing and bit 64 means fitting, and smushing promotes to
        CONTROLLED_SMUSHING as soon as any of the six rule bits is set.
        """
        rules = 0
        if full_layout is not None:
            rules = full_layout & 63
            if full_layout & 128:
                mode = CONTROLLED_SMUSHING if rules else SMUSHING
            elif full_layout & 64:
                mode = FITTING
            else:
                mode = FULL_WIDTH
            return mode, rules
        if old_layout < 0:
            return FULL_WIDTH, 0
        if old_layout == 0:
            return FITTING, 0
        rules = old_layout & 63
        return (CONTROLLED_SMUSHING if rules else SMUSHING), rules

    def _clean(self, block):
        """Strip the endmark characters from each row of a character block."""
        out = []
        for row in block:
            row = row.rstrip("\r")
            if row:
                row = row.rstrip(row[-1])
            out.append(row)
        return out

    # ---------------------------------------------------------------- smushing

    def _uni_smush(self, ch1, ch2):
        """figlet.js `uni_Smush`: the later character wins, hardblanks yield."""
        if ch2 == " " or ch2 == "":
            return ch1
        if ch2 == self.hardblank and ch1 != " ":
            return ch1
        return ch2

    def _smush_pair(self, ch1, ch2, mode, rules):
        """The character two overlapping sub-characters collapse to."""
        if mode == CONTROLLED_SMUSHING:
            for bit, fn in _RULES:
                if rules & bit:
                    got = fn(ch1, ch2, self.hardblank)
                    if got:
                        return got
        return self._uni_smush(ch1, ch2)

    def _rule_hit(self, ch1, ch2, rules):
        """Did any enabled rule accept this pair? (overlap test only)"""
        for bit, fn in _RULES:
            if rules & bit and fn(ch1, ch2, self.hardblank):
                return True
        return False

    def _row_overlap(self, line, char_row, mode, rules):
        """Port of figlet.js `getHorizontalSmushLength` for a single row."""
        if mode == FULL_WIDTH:
            return 0
        len1, len2 = len(line), len(char_row)
        if len1 == 0:
            return 0
        max_dist = len1
        cur_dist = 1
        break_after = False

        while cur_dist <= max_dist:
            start = len1 - cur_dist
            seg1 = line[start:start + cur_dist]
            seg2 = char_row[:min(cur_dist, len2)]
            stop = False
            for i in range(min(cur_dist, len2)):
                ch1 = seg1[i] if i < len(seg1) else ""
                ch2 = seg2[i] if i < len(seg2) else ""
                if ch1 != " " and ch2 != " ":
                    if mode == FITTING:
                        cur_dist -= 1
                        stop = True
                        break
                    if mode == SMUSHING:
                        if ch1 == self.hardblank or ch2 == self.hardblank:
                            cur_dist -= 1
                        stop = True
                        break
                    # Controlled smushing: one failing pair ends the search.
                    break_after = True
                    if not self._rule_hit(ch1, ch2, rules):
                        cur_dist -= 1
                        stop = True
                        break
            if stop or break_after:
                break
            cur_dist += 1
        return min(max_dist, cur_dist)

    def _merge_row(self, line, char_row, overlap, mode, rules):
        """Port of figlet.js `mergeFigString`."""
        len1, len2 = len(line), len(char_row)
        head = line[:max(0, len1 - overlap)]
        tail = line[max(0, len1 - overlap):len1]
        incoming = char_row[:min(overlap, len2)]
        merged = []
        for i in range(len(tail)):
            if i >= len2:
                merged.append(tail[i])
            else:
                merged.append(self._smush_pair(tail[i], incoming[i], mode, rules))
        return head + "".join(merged) + char_row[min(overlap, len2):]

    # ----------------------------------------------------------------- render

    def render(self, text, layout="default"):
        """Render `text` to a list of lines. `layout` is default/full/fitted."""
        mode, rules = self.layout, self.rules
        if layout == "full":
            mode, rules = FULL_WIDTH, 0
        elif layout == "fitted":
            mode, rules = FITTING, 0

        buffer = [""] * self.height
        for ch in text:
            glyph = self.chars.get(ord(ch))
            if glyph is None:
                continue
            overlap = 0
            if mode != FULL_WIDTH:
                overlap = min(
                    self._row_overlap(buffer[row], glyph[row], mode, rules)
                    for row in range(self.height)
                )
            for row in range(self.height):
                buffer[row] = self._merge_row(buffer[row], glyph[row], overlap, mode, rules)

        out = [row.replace(self.hardblank, " ") for row in buffer]
        # figlet.js collapses an entirely empty render to a single empty line,
        # which happens for fonts that ship blank glyphs (Calvin S has no digits).
        if not any(row.strip() for row in out):
            return [""]
        return out

    # ----------------------------------------------------------------- facts

    def attribution(self):
        """The first non-empty comment line — conventionally the credit line."""
        for line in self.comments:
            if line.strip():
                return line.strip()
        return ""

    def layout_label(self):
        return {
            FULL_WIDTH: "full width",
            FITTING: "kerned",
            SMUSHING: "smushed (universal)",
            CONTROLLED_SMUSHING: "smushed (controlled)",
        }[self.layout]

    def has_lowercase(self):
        """True when a-z are drawn differently from A-Z rather than aliased."""
        for code in range(ord("a"), ord("z") + 1):
            lower, upper = self.chars.get(code), self.chars.get(code - 32)
            if lower and upper and lower != upper:
                return True
        return False

    def renders(self, text):
        """True when `text` produces visible art in this font."""
        return any(row.strip() for row in self.render(text))

    def width_of(self, text, layout="default"):
        return max((len(r) for r in self.render(text, layout)), default=0)
