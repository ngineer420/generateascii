/* ================================================================== *
 * toolbar v1 — the portfolio navigation pattern.                      *
 * Spec: github.com/ngineer420/ngineer420.github.io/issues/13          *
 * Reference implementation: photoshrink#7.                            *
 *                                                                     *
 * Copied verbatim from the pilot. It lives in its own file here       *
 * rather than appended to app.js because the 59 font pages load        *
 * font-page.js instead, and 404, privacy, terms and the four articles  *
 * load no page JS at all — the chrome has to behave the same on all.   *
 *                                                                     *
 * Pure enhancement: with JS off, <details>/<summary> still discloses  *
 * the sheet, the rail is still a native scroll container of real      *
 * links, the edge fades are still CSS and the scrim is still CSS.     *
 * Only the active-chip centring, Escape and click-outside are lost.   *
 * ================================================================== */
(function toolbar() {
  const bar = document.querySelector(".toolbar");
  if (!bar) return;
  const rail = bar.querySelector(".tb-rail");
  const menu = bar.querySelector("details.tb-menu");

  if (rail) {
    // js-on hands the right-hand fade over to measurement. Until then the
    // CSS keeps it on, so a JS-disabled visitor never gets a chip clipped
    // mid-word with nothing to say there is more of the row.
    rail.classList.add("js-on");
    const fades = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      rail.classList.toggle("can-l", rail.scrollLeft > 1);
      rail.classList.toggle("can-r", rail.scrollLeft < max - 1);
    };
    // Assigning scrollLeft, never scrollIntoView: that also scrolls every
    // ancestor and the document, which on a phone drops the visitor below
    // the header on arrival.
    const current = rail.querySelector("[aria-current]");
    if (current) {
      rail.scrollLeft = Math.max(
        0,
        current.offsetLeft - (rail.clientWidth - current.offsetWidth) / 2
      );
    }
    rail.addEventListener("scroll", fades, { passive: true });
    window.addEventListener("resize", fades);
    fades();
  }

  if (menu) {
    // A disclosure, not a modal: focus is deliberately not trapped, Tab
    // walks the links and straight out the other side.
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !menu.open) return;
      menu.open = false;
      const summary = menu.querySelector("summary");
      if (summary) summary.focus();
    });
    document.addEventListener("click", (e) => {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }
})();
