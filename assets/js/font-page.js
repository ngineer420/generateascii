/* generateascii.com — per-font landing pages (/fonts/<slug>/).
   These pages ship their sample art as real text baked in by
   tools/build_font_pages.py, so they read fine with JavaScript off. This file
   only adds the live bits on top: theme toggle, footer year, re-rendering the
   hero preview as you type, and Copy.

   The baked art comes from tools/figfont.py, a port of figlet.js, so the first
   re-render below produces exactly the same characters that were already on
   screen — the preview must not visibly jump when this runs. */
(function () {
  "use strict";

  var THEME_KEY = "ga-theme";

  /* ---------- shared shell ---------- */
  var toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var current =
        document.documentElement.getAttribute("data-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- live preview ---------- */
  var input = document.getElementById("font-page-input");
  var hero = document.querySelector(".ascii-sample--hero pre");
  var copyBtn = document.getElementById("font-page-copy");
  var note = document.getElementById("font-page-note");
  if (!input || !hero) return;

  // The font name is the last path segment's page, but the catalogue is the
  // authority on the exact file name (spaces and capitals matter), so match the
  // page's canonical slug against it rather than guessing from the URL.
  var slug = (location.pathname.replace(/\/index\.html$/, "").replace(/\.html$/, "")
    .split("/").filter(Boolean).pop() || "");
  var fontName = null;
  if (typeof FONT_CATALOGUE !== "undefined") {
    for (var i = 0; i < FONT_CATALOGUE.length; i++) {
      var candidate = FONT_CATALOGUE[i].file;
      if (candidate.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === slug) {
        fontName = candidate;
        break;
      }
    }
  }
  if (!fontName) return; // unknown font — leave the baked art alone

  var ready = fetch("/assets/fonts/" + encodeURIComponent(fontName) + ".flf")
    .then(function (res) {
      if (!res.ok) throw new Error("font fetch failed");
      return res.text();
    })
    .then(function (data) { figlet.parseFont(fontName, data); });

  var pending = null;
  function render() {
    var text = input.value;
    ready.then(function () {
      var art;
      try {
        art = figlet.textSync(text, { font: fontName });
      } catch (e) {
        return;
      }
      hero.textContent = art;
    }).catch(function () {
      if (note) note.textContent = "Could not load this font — the sample above is still accurate.";
    });
  }

  input.addEventListener("input", function () {
    clearTimeout(pending);
    pending = setTimeout(render, 60);
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = hero.textContent;
      var done = function () {
        var original = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(function () { copyBtn.textContent = original; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
        return;
      }
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    });
  }
})();
