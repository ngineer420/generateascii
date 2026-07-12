(() => {
  "use strict";

  /* ============================= shared helpers ============================= */

  const MONO_STACK = 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace';
  const RAINBOW_GRADIENT = "linear-gradient(90deg,#ff003c,#ff8c00,#ffe600,#39ff14,#00e5ff,#7b2ff7,#ff00c8)";

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function flash(el) {
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1100);
  }

  function download(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ============================= session persistence =============================
     sessionStorage (not localStorage) so an accidental reload keeps your work, but
     closing the tab starts fresh — matches how people expect "undo my reload", not
     "remember this forever". */

  const SESSION_PREFIX = "ga:";

  function saveSession(key, value) {
    try {
      sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false; // private browsing / quota exceeded — degrade silently
    }
  }

  function loadSession(key) {
    try {
      const raw = sessionStorage.getItem(SESSION_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function copyText(text, flashEl) {
    try {
      await navigator.clipboard.writeText(text);
      flash(flashEl);
    } catch {
      // Fallback for browsers/contexts without Clipboard API permission.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      flash(flashEl);
    }
  }

  /* ============================= theme toggle ============================= */

  (function initTheme() {
    const stored = localStorage.getItem("ga-theme");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const current =
        document.documentElement.getAttribute("data-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("ga-theme", next);
    });
  })();

  /* ============================= tabs ============================= */

  (function initTabs() {
    const tabs = [document.getElementById("tab-text"), document.getElementById("tab-image")];
    const panels = {
      "tab-text": document.getElementById("panel-text"),
      "tab-image": document.getElementById("panel-image"),
    };

    function select(tab, { focus = true } = {}) {
      tabs.forEach((t) => {
        const active = t === tab;
        t.setAttribute("aria-selected", String(active));
        t.tabIndex = active ? 0 : -1;
        panels[t.id].hidden = !active;
        panels[t.id].classList.toggle("active", active);
      });
      saveSession("tab", tab.id === "tab-image" ? "image" : "text");
      if (focus) tab.focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length]);
        if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length]);
        if (e.key === "Home") select(tabs[0]);
        if (e.key === "End") select(tabs[tabs.length - 1]);
      });
    });

    if (loadSession("tab") === "image") select(tabs[1], { focus: false });
  })();

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ============================= font loading ============================= */

  const fontLoadPromises = new Map();

  function ensureFont(name) {
    if (fontLoadPromises.has(name)) return fontLoadPromises.get(name);
    const p = fetch(`/assets/fonts/${encodeURIComponent(name)}.flf`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load font "${name}"`);
        return r.text();
      })
      .then((data) => {
        figlet.parseFont(name, data);
      });
    fontLoadPromises.set(name, p);
    return p;
  }

  function renderFigletSync(text, font, layout) {
    const opts = { font };
    if (layout === "full") opts.horizontalLayout = "full";
    else if (layout === "fitted") opts.horizontalLayout = "fitted";
    return figlet.textSync(text, opts);
  }

  /* ============================= TEXT TO ASCII ============================= */

  (function textTool() {
    const textInput = document.getElementById("text-input");
    const layoutSelect = document.getElementById("layout-select");
    const sizeSlider = document.getElementById("text-size");
    const sizeVal = document.getElementById("text-size-val");
    const textColorInput = document.getElementById("text-color");
    const modeSolidBtn = document.getElementById("mode-solid");
    const modeRainbowBtn = document.getElementById("mode-rainbow");
    const bgButtons = Array.from(document.querySelectorAll(".bg-opt"));
    const output = document.getElementById("text-output");
    const outputWrap = document.getElementById("text-output-wrap");
    const galleryEl = document.getElementById("font-gallery");
    const copyFlash = document.getElementById("text-copy-flash");
    const editHint = document.getElementById("text-edit-hint");

    let colorMode = "solid"; // "solid" | "rainbow"
    let bgMode = "dark"; // "dark" | "light" | "transparent"
    let selectedFont = DEFAULT_FONT;

    function persistTextState() {
      saveSession("text", {
        text: textInput.value,
        font: selectedFont,
        layout: layoutSelect.value,
        size: sizeSlider.value,
        colorMode,
        textColor: textColorInput.value,
        bgMode,
      });
    }

    // Restore last session's selections, if any, before the first render.
    (function restoreTextState() {
      const saved = loadSession("text");
      if (!saved) return;
      if (typeof saved.text === "string") textInput.value = saved.text;
      if (saved.font) selectedFont = saved.font;
      if (saved.layout) layoutSelect.value = saved.layout;
      if (saved.size) {
        sizeSlider.value = saved.size;
        sizeVal.textContent = `${saved.size}px`;
      }
      if (saved.textColor) textColorInput.value = saved.textColor;
      if (saved.colorMode) {
        colorMode = saved.colorMode;
        modeSolidBtn.setAttribute("aria-pressed", String(colorMode === "solid"));
        modeRainbowBtn.setAttribute("aria-pressed", String(colorMode === "rainbow"));
      }
      if (saved.bgMode) {
        bgMode = saved.bgMode;
        bgButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bg === bgMode)));
      }
    })();

    function currentText() {
      return (textInput.value || "").slice(0, 200);
    }

    function applyColorStyle() {
      output.style.color = "";
      output.style.backgroundImage = "";
      output.style.webkitBackgroundClip = "";
      output.style.backgroundClip = "";
      if (colorMode === "rainbow") {
        output.style.backgroundImage = RAINBOW_GRADIENT;
        output.style.webkitBackgroundClip = "text";
        output.style.backgroundClip = "text";
        output.style.color = "transparent";
      } else {
        output.style.color = textColorInput.value;
      }
    }

    function applySizeStyle() {
      output.style.fontSize = `${sizeSlider.value}px`;
    }

    function applyBgStyle() {
      outputWrap.classList.remove("bg-transparent");
      if (bgMode === "dark") {
        outputWrap.style.background = "#08090a";
      } else if (bgMode === "light") {
        outputWrap.style.background = "#f5f6f4";
      } else {
        outputWrap.style.background =
          "repeating-conic-gradient(#20242a 0% 25%, transparent 0% 50%) 0 0 / 20px 20px";
      }
    }

    async function updateMainPreview() {
      const raw = currentText();
      const editing = document.activeElement === textInput;
      // Empty input: while blurred, show a dimmed sample as a placeholder;
      // while editing, show nothing but the caret — there's no real text to
      // delete, and pretending otherwise is a trap.
      const isPlaceholder = !raw && !editing;
      const text = raw || (isPlaceholder ? "Type ASCII here" : "");
      const font = selectedFont || DEFAULT_FONT;
      const layout = layoutSelect.value;
      try {
        await ensureFont(font);
        let art = text ? renderFigletSync(text, font, layout) : "";
        // Trailing whitespace would skew the placeholder's fit measurement.
        if (isPlaceholder) art = art.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");
        output.textContent = art;
      } catch (err) {
        output.textContent = `Couldn't render that text in "${font}".\nTry a shorter phrase or a different font.`;
      }
      output.classList.toggle("is-placeholder", isPlaceholder);
      output.appendChild(caret); // textContent wiped it; caret holds no text, so copy/export are unaffected
      applyColorStyle();
      applyBgStyle();
      applySizeStyle();
      if (isPlaceholder) fitPlaceholderSize(); // longer than typical input; size it to the surface
      updateCaret();
    }

    // The placeholder phrase ignores the Size slider and scales itself to
    // span the preview width without horizontal scrolling; real text goes
    // back to the slider size (applySizeStyle above).
    function fitPlaceholderSize() {
      const w = output.clientWidth;
      if (!w) return; // text tab hidden
      const cols = Math.max(1, ...output.textContent.split("\n").map((l) => l.length));
      let fs = Math.max(6, Math.min(22, Math.floor((w - 40) / (cols * CHAR_RATIO))));
      output.style.fontSize = fs + "px";
      while (fs > 6 && output.scrollWidth > output.clientWidth) {
        fs -= 1;
        output.style.fontSize = fs + "px";
      }
    }

    /* ---- the preview is the input ----
       #text-input is a visually hidden textarea: clicking the art focuses it
       and keystrokes re-render the art. The caret is drawn at the art
       position of the *real* cursor: render the figlet of the text before
       the cursor and measure its width in monospace columns. */

    const caret = document.createElement("span");
    caret.className = "ascii-caret";
    caret.setAttribute("aria-hidden", "true");

    const EDIT_HINT_DEFAULT = editHint ? editHint.textContent : "";

    function updateEditHint() {
      if (!editHint) return;
      const editing = document.activeElement === textInput;
      editHint.textContent = editing ? textInput.value || "(empty)" : EDIT_HINT_DEFAULT;
    }

    const measureCtx = document.createElement("canvas").getContext("2d");

    function caretMetrics() {
      const cs = getComputedStyle(output);
      const fontSize = parseFloat(cs.fontSize) || 13;
      measureCtx.font = `${fontSize}px ${MONO_STACK}`;
      return {
        charW: measureCtx.measureText("MMMMMMMMMM").width / 10,
        lineH: parseFloat(cs.lineHeight) || fontSize * 1.05,
        padL: parseFloat(cs.paddingLeft) || 0,
        padT: parseFloat(cs.paddingTop) || 0,
      };
    }

    // Every line of a FIGlet font renders at the same fixed height.
    const blockLinesCache = new Map();
    function fontBlockLines(font) {
      if (!blockLinesCache.has(font)) {
        try {
          blockLinesCache.set(font, renderFigletSync("A", font, "default").split("\n").length);
        } catch {
          return 6;
        }
      }
      return blockLinesCache.get(font);
    }

    // Width, in monospace columns, of the art for `str`. Smushing between
    // the prefix and the next glyph can overlap a column or two, so this is
    // within a couple of pixels rather than exact — close enough for a caret.
    function artCols(str, font, layout) {
      if (!str) return 0;
      try {
        return Math.max(...renderFigletSync(str, font, layout).split("\n").map((l) => l.replace(/\s+$/, "").length));
      } catch {
        return 0;
      }
    }

    function updateCaret() {
      if (!outputWrap.classList.contains("is-editing")) return;
      const raw = currentText();
      const font = selectedFont || DEFAULT_FONT;
      const layout = layoutSelect.value;
      const pos = textInput.selectionStart == null ? raw.length : textInput.selectionStart;
      const prefix = raw.slice(0, pos);
      const row = (prefix.match(/\n/g) || []).length;
      const linePrefix = prefix.slice(prefix.lastIndexOf("\n") + 1);
      const { charW, lineH, padL, padT } = caretMetrics();
      const blockH = fontBlockLines(font) * lineH;
      caret.style.left = `${padL + artCols(linePrefix, font, layout) * charW}px`;
      caret.style.top = `${padT + row * blockH}px`;
      caret.style.height = `${blockH}px`;
    }

    // Map a click on the art back to a cursor index: walk prefix widths on
    // the clicked row until we pass the click point, then land on the nearer
    // side of the glyph under it.
    function caretIndexFromClick(evt) {
      const raw = currentText();
      if (!raw) return 0;
      const font = selectedFont || DEFAULT_FONT;
      const layout = layoutSelect.value;
      const rect = output.getBoundingClientRect();
      const { charW, lineH, padL, padT } = caretMetrics();
      const blockH = fontBlockLines(font) * lineH;
      const lines = raw.split("\n");
      const row = Math.max(0, Math.min(lines.length - 1, Math.floor((evt.clientY - rect.top - padT) / blockH)));
      const targetCols = (evt.clientX - rect.left - padL) / charW;
      let base = 0;
      for (let r = 0; r < row; r++) base += lines[r].length + 1;
      const line = lines[row];
      let i = 0;
      while (i < line.length && artCols(line.slice(0, i + 1), font, layout) < targetCols) i++;
      if (i < line.length) {
        const before = artCols(line.slice(0, i), font, layout);
        const after = artCols(line.slice(0, i + 1), font, layout);
        if (targetCols - before > after - targetCols) i++;
      }
      return base + i;
    }

    outputWrap.addEventListener("click", (evt) => {
      // Don't steal focus from a manual drag-selection of the art.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const idx = caretIndexFromClick(evt);
      textInput.focus();
      textInput.setSelectionRange(idx, idx);
      updateCaret();
    });
    textInput.addEventListener("focus", () => {
      outputWrap.classList.add("is-editing");
      updateEditHint();
      if (!currentText()) updateMainPreview(); // placeholder vanishes on focus
      updateCaret();
    });
    textInput.addEventListener("blur", () => {
      outputWrap.classList.remove("is-editing");
      updateEditHint();
      if (!currentText()) updateMainPreview(); // placeholder returns on blur
    });
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") textInput.blur();
    });
    // Arrow keys / Home / End move the hidden cursor without re-rendering.
    document.addEventListener("selectionchange", () => {
      if (document.activeElement === textInput) updateCaret();
    });
    textInput.addEventListener("keyup", updateCaret); // fallback where textarea selectionchange isn't fired

    const debouncedMainPreview = debounce(updateMainPreview, 120);
    const debouncedGallery = debounce(renderGallery, 150);

    textInput.addEventListener("input", () => {
      debouncedMainPreview();
      debouncedGallery();
      updateEditHint();
      persistTextState();
    });
    layoutSelect.addEventListener("change", () => {
      updateMainPreview();
      persistTextState();
    });
    sizeSlider.addEventListener("input", () => {
      sizeVal.textContent = `${sizeSlider.value}px`;
      applySizeStyle();
      if (output.classList.contains("is-placeholder")) fitPlaceholderSize();
      updateCaret(); // caret coordinates scale with the font size
      persistTextState();
    });
    textColorInput.addEventListener("input", () => {
      applyColorStyle();
      persistTextState();
    });

    modeSolidBtn.addEventListener("click", () => {
      colorMode = "solid";
      modeSolidBtn.setAttribute("aria-pressed", "true");
      modeRainbowBtn.setAttribute("aria-pressed", "false");
      applyColorStyle();
      persistTextState();
    });
    modeRainbowBtn.addEventListener("click", () => {
      colorMode = "rainbow";
      modeRainbowBtn.setAttribute("aria-pressed", "true");
      modeSolidBtn.setAttribute("aria-pressed", "false");
      applyColorStyle();
      persistTextState();
    });
    bgButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        bgMode = btn.dataset.bg;
        bgButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        applyBgStyle();
        persistTextState();
      });
    });

    /* ---- gallery ---- */

    function highlightGallerySelection() {
      Array.from(galleryEl.querySelectorAll(".gallery-item")).forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.font === selectedFont));
      });
    }

    /* ---- fit tile art to its width ----
       Scales each tile's font-size so the widest art line fills the tile
       without horizontal scrolling, in both the side list and fullscreen. */

    const CHAR_RATIO = (() => {
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `100px ${MONO_STACK}`;
      return ctx.measureText("M").width / 100;
    })();

    function fitTilePre(pre) {
      const w = pre.clientWidth;
      if (!w) return; // tab hidden; refitted when it becomes visible
      const cols = Math.max(1, ...pre.textContent.split("\n").map((l) => l.length));
      let fs = Math.max(4, Math.min(14, Math.floor(w / (cols * CHAR_RATIO))));
      pre.style.fontSize = fs + "px";
      // Real glyph metrics drift a little from the canvas measurement at
      // small sizes; nudge down until the widest line truly fits.
      while (fs > 4 && pre.scrollWidth > pre.clientWidth) {
        fs -= 1;
        pre.style.fontSize = fs + "px";
      }
    }

    function fitAllTiles() {
      galleryEl.querySelectorAll(".gallery-item pre").forEach(fitTilePre);
    }

    function refitAll() {
      fitAllTiles();
      if (output.classList.contains("is-placeholder")) fitPlaceholderSize();
    }
    window.addEventListener("resize", debounce(refitAll, 150));
    // Gallery/preview may have rendered while the Image tab was active (zero widths).
    document.getElementById("tab-text").addEventListener("click", () => requestAnimationFrame(refitAll));

    /* ---- fullscreen font browsing ---- */

    const fontListPanel = document.getElementById("font-list-panel");
    const expandBtn = document.getElementById("gallery-expand");

    function setGalleryFullscreen(on) {
      fontListPanel.classList.toggle("is-fullscreen", on);
      document.body.classList.toggle("gallery-fullscreen", on);
      expandBtn.textContent = on ? "✕ Close" : "⛶ Expand";
      expandBtn.setAttribute("aria-label", (on ? "Close" : "Expand") + " full-screen font list");
      expandBtn.setAttribute("aria-pressed", String(on));
      requestAnimationFrame(fitAllTiles); // tile widths just changed
    }

    expandBtn.addEventListener("click", () => {
      setGalleryFullscreen(!fontListPanel.classList.contains("is-fullscreen"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && fontListPanel.classList.contains("is-fullscreen")) {
        setGalleryFullscreen(false);
      }
    });

    // Grouped by category, in catalogue order — mirrors how fonts used to be
    // organized under the (now-removed) font <select>'s optgroups.
    async function renderGallery() {
      galleryEl.innerHTML = "";
      const text = currentText() || "ASCII";
      let lastCategory = null;

      FONT_CATALOGUE.forEach((f) => {
        if (f.category !== lastCategory) {
          lastCategory = f.category;
          const heading = document.createElement("div");
          heading.className = "gallery-category";
          heading.textContent = f.category;
          galleryEl.appendChild(heading);
        }

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gallery-item";
        btn.dataset.font = f.file;
        btn.setAttribute("aria-pressed", String(f.file === selectedFont));
        btn.innerHTML = `<pre>Loading…</pre><span class="font-name">${f.file}</span>`;
        btn.addEventListener("click", () => {
          selectedFont = f.file;
          updateMainPreview();
          highlightGallerySelection();
          persistTextState();
          // Picking a font in fullscreen means "that one" — drop back to the
          // sidebar and bring the chosen font into view there.
          if (fontListPanel.classList.contains("is-fullscreen")) {
            setGalleryFullscreen(false);
            // Double rAF: let the fullscreen-exit refit (rAF in
            // setGalleryFullscreen) resize tiles before computing offsets.
            requestAnimationFrame(() => requestAnimationFrame(scrollGalleryToSelection));
          }
        });
        galleryEl.appendChild(btn);

        ensureFont(f.file)
          .then(() => {
            const pre = btn.querySelector("pre");
            try {
              // Trailing whitespace is invisible but widens scrollWidth,
              // which would skew the fit — strip it for the tile preview.
              pre.textContent = renderFigletSync(text, f.file, "default")
                .split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");
            } catch {
              pre.textContent = "(unsupported characters)";
            }
            fitTilePre(pre);
          })
          .catch(() => {
            const pre = btn.querySelector("pre");
            pre.textContent = "(failed to load)";
            fitTilePre(pre);
          });
      });
    }

    /* ---- export ---- */

    document.getElementById("text-copy").addEventListener("click", () => {
      copyText(output.textContent, copyFlash);
    });

    document.getElementById("text-download-txt").addEventListener("click", () => {
      download("ascii-art.txt", new Blob([output.textContent], { type: "text/plain" }));
    });

    document.getElementById("text-download-png").addEventListener("click", () => {
      renderTextToPng(output.textContent);
    });

    function renderTextToPng(asciiText) {
      const lines = asciiText.split("\n");
      const fontSize = parseInt(sizeSlider.value, 10);
      const lineHeight = fontSize * 1.05;
      const pad = 24;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const measureCanvas = document.createElement("canvas");
      const mctx = measureCanvas.getContext("2d");
      mctx.font = `${fontSize}px ${MONO_STACK}`;
      const charWidth = mctx.measureText("M").width;
      const maxCols = Math.max(1, ...lines.map((l) => l.length));

      const w = Math.ceil(maxCols * charWidth + pad * 2);
      const h = Math.ceil(lines.length * lineHeight + pad * 2);

      const canvas = document.createElement("canvas");
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      if (bgMode !== "transparent") {
        ctx.fillStyle = bgMode === "light" ? "#f5f6f4" : "#0b0d0f";
        ctx.fillRect(0, 0, w, h);
      }

      ctx.font = `${fontSize}px ${MONO_STACK}`;
      ctx.textBaseline = "top";

      const rainbowColors = ["#ff003c", "#ff8c00", "#ffe600", "#39ff14", "#00e5ff", "#7b2ff7", "#ff00c8"];

      lines.forEach((line, row) => {
        const y = pad + row * lineHeight;
        if (colorMode === "rainbow") {
          for (let i = 0; i < line.length; i++) {
            const t = maxCols <= 1 ? 0 : i / (maxCols - 1);
            const idx = t * (rainbowColors.length - 1);
            const c0 = rainbowColors[Math.floor(idx)];
            ctx.fillStyle = c0;
            ctx.fillText(line[i], pad + i * charWidth, y);
          }
        } else {
          ctx.fillStyle = textColorInput.value;
          ctx.fillText(line, pad, y);
        }
      });

      canvas.toBlob((blob) => download("ascii-art.png", blob), "image/png");
    }

    // Bring the restored session's font into view in the scrollable list,
    // without scrollIntoView (which could also yank the page itself).
    function scrollGalleryToSelection() {
      const sel = galleryEl.querySelector('.gallery-item[aria-pressed="true"]');
      if (!sel) return;
      const top = sel.offsetTop - galleryEl.offsetTop;
      const above = top < galleryEl.scrollTop;
      const below = top + sel.offsetHeight > galleryEl.scrollTop + galleryEl.clientHeight;
      if (above || below) galleryEl.scrollTop = Math.max(0, top - 12);
    }

    /* ---- init ---- */
    renderGallery();
    updateMainPreview();
    requestAnimationFrame(scrollGalleryToSelection);
  })();

  /* ============================= IMAGE TO ASCII ============================= */

  (function imageTool() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");
    const sourceThumb = document.getElementById("source-thumb");
    const sourceThumbImg = document.getElementById("source-thumb-img");
    const sourceThumbMeta = document.getElementById("source-thumb-meta");
    const sourceClear = document.getElementById("source-clear");

    const widthSlider = document.getElementById("img-width");
    const widthVal = document.getElementById("img-width-val");
    const rampSelect = document.getElementById("img-ramp");
    const customRampField = document.getElementById("img-custom-ramp-field");
    const customRampInput = document.getElementById("img-custom-ramp");
    const brightnessSlider = document.getElementById("img-brightness");
    const brightnessVal = document.getElementById("img-brightness-val");
    const contrastSlider = document.getElementById("img-contrast");
    const contrastVal = document.getElementById("img-contrast-val");
    const gammaSlider = document.getElementById("img-gamma");
    const gammaVal = document.getElementById("img-gamma-val");
    const invertCheckbox = document.getElementById("img-invert");
    const colorOptBtns = Array.from(document.querySelectorAll(".img-color-opt"));
    const monoColorField = document.getElementById("img-mono-color-field");
    const monoColorInput = document.getElementById("img-mono-color");
    const bgOptBtns = Array.from(document.querySelectorAll(".img-bg-opt"));

    const outputWrap = document.getElementById("img-output-wrap");
    const emptyMsg = document.getElementById("img-empty-msg");
    const canvas = document.getElementById("img-canvas");
    const ctx = canvas.getContext("2d");
    const copyFlash = document.getElementById("img-copy-flash");

    const RAMPS = {
      standard: " .:-=+*#%@",
      detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
      blocks: " ░▒▓█",
      binary: " 01",
    };

    let sourceImage = null;
    let colorMode = "mono"; // "mono" | "color"
    let bgMode = "dark"; // "dark" | "light"
    let lastAsciiText = "";
    let lastImageDataUrl = null;
    let lastImageMeta = null;

    function currentRamp() {
      if (rampSelect.value === "custom") return customRampInput.value || RAMPS.standard;
      return RAMPS[rampSelect.value] || RAMPS.standard;
    }

    function persistImageState() {
      const state = {
        width: widthSlider.value,
        ramp: rampSelect.value,
        customRamp: customRampInput.value,
        brightness: brightnessSlider.value,
        contrast: contrastSlider.value,
        gamma: gammaSlider.value,
        invert: invertCheckbox.checked,
        colorMode,
        monoColor: monoColorInput.value,
        bgMode,
        imageDataUrl: lastImageDataUrl,
        imageMeta: lastImageMeta,
      };
      // The embedded image can push this over a browser's sessionStorage quota;
      // if so, fall back to persisting just the control settings.
      if (!saveSession("image", state)) {
        saveSession("image", { ...state, imageDataUrl: null, imageMeta: null });
      }
    }

    // Declared early (computeAndRender is a hoisted function declaration) because several
    // addEventListener calls below pass `scheduleRender` directly as the handler reference,
    // which resolves the identifier immediately rather than deferring to call-time.
    const scheduleRender = debounce(computeAndRender, 60);

    /* ---- input handling ---- */

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
    });
    document.addEventListener("paste", (e) => {
      if (!document.getElementById("panel-image").classList.contains("active")) return;
      const item = Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith("image/"));
      if (item) handleFile(item.getAsFile());
    });
    sourceClear.addEventListener("click", () => {
      sourceImage = null;
      sourceThumb.classList.remove("show");
      fileInput.value = "";
      canvas.style.display = "none";
      emptyMsg.style.display = "";
      outputWrap.classList.add("is-empty");
      lastAsciiText = "";
      lastImageDataUrl = null;
      lastImageMeta = null;
      persistImageState();
    });

    function handleFile(file) {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        sourceImage = img;
        sourceThumbImg.src = url;
        sourceThumbMeta.textContent = `${file.name || "pasted image"} — ${img.naturalWidth}×${img.naturalHeight}`;
        sourceThumb.classList.add("show");
        scheduleRender();
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;

      // Also read as a data URL so the image survives an accidental reload this session.
      const reader = new FileReader();
      reader.onload = () => {
        lastImageDataUrl = reader.result;
        lastImageMeta = { name: file.name || "pasted image" };
        persistImageState();
      };
      reader.readAsDataURL(file);
    }

    /* ---- controls ---- */

    widthSlider.addEventListener("input", () => {
      widthVal.textContent = widthSlider.value;
      scheduleRender();
      persistImageState();
    });
    rampSelect.addEventListener("change", () => {
      customRampField.style.display = rampSelect.value === "custom" ? "" : "none";
      scheduleRender();
      persistImageState();
    });
    customRampInput.addEventListener("input", () => {
      scheduleRender();
      persistImageState();
    });
    brightnessSlider.addEventListener("input", () => {
      brightnessVal.textContent = brightnessSlider.value;
      scheduleRender();
      persistImageState();
    });
    contrastSlider.addEventListener("input", () => {
      contrastVal.textContent = contrastSlider.value;
      scheduleRender();
      persistImageState();
    });
    gammaSlider.addEventListener("input", () => {
      gammaVal.textContent = parseFloat(gammaSlider.value).toFixed(1);
      scheduleRender();
      persistImageState();
    });
    invertCheckbox.addEventListener("change", () => {
      scheduleRender();
      persistImageState();
    });
    monoColorInput.addEventListener("input", () => {
      scheduleRender();
      persistImageState();
    });

    colorOptBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        colorMode = btn.dataset.mode;
        colorOptBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        monoColorField.style.display = colorMode === "mono" ? "" : "none";
        scheduleRender();
        persistImageState();
      });
    });
    bgOptBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        bgMode = btn.dataset.bg;
        bgOptBtns.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        scheduleRender();
        persistImageState();
      });
    });

    // Restore last session's controls (and image, if it fit in storage) before first render.
    (function restoreImageState() {
      const saved = loadSession("image");
      if (!saved) return;
      if (saved.width) {
        widthSlider.value = saved.width;
        widthVal.textContent = saved.width;
      }
      if (saved.ramp) {
        rampSelect.value = saved.ramp;
        customRampField.style.display = saved.ramp === "custom" ? "" : "none";
      }
      if (typeof saved.customRamp === "string") customRampInput.value = saved.customRamp;
      if (saved.brightness !== undefined) {
        brightnessSlider.value = saved.brightness;
        brightnessVal.textContent = saved.brightness;
      }
      if (saved.contrast !== undefined) {
        contrastSlider.value = saved.contrast;
        contrastVal.textContent = saved.contrast;
      }
      if (saved.gamma !== undefined) {
        gammaSlider.value = saved.gamma;
        gammaVal.textContent = parseFloat(saved.gamma).toFixed(1);
      }
      if (saved.invert !== undefined) invertCheckbox.checked = saved.invert;
      if (saved.colorMode) {
        colorMode = saved.colorMode;
        colorOptBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === colorMode)));
        monoColorField.style.display = colorMode === "mono" ? "" : "none";
      }
      if (saved.monoColor) monoColorInput.value = saved.monoColor;
      if (saved.bgMode) {
        bgMode = saved.bgMode;
        bgOptBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.bg === bgMode)));
      }
      if (saved.imageDataUrl) {
        lastImageDataUrl = saved.imageDataUrl;
        lastImageMeta = saved.imageMeta || null;
        const img = new Image();
        img.onload = () => {
          sourceImage = img;
          sourceThumbImg.src = saved.imageDataUrl;
          const name = (saved.imageMeta && saved.imageMeta.name) || "restored image";
          sourceThumbMeta.textContent = `${name} — ${img.naturalWidth}×${img.naturalHeight}`;
          sourceThumb.classList.add("show");
          scheduleRender();
        };
        img.src = saved.imageDataUrl;
      }
    })();

    /* ---- core pipeline ---- */

    function computeAndRender() {
      if (!sourceImage) return;

      const columns = parseInt(widthSlider.value, 10);
      const CHAR_ASPECT = 0.55; // monospace glyph width/height approximation
      const rows = Math.max(
        1,
        Math.round(columns * (sourceImage.naturalHeight / sourceImage.naturalWidth) * CHAR_ASPECT)
      );

      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = columns;
      sampleCanvas.height = rows;
      const sctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(sourceImage, 0, 0, columns, rows);

      const { data } = sctx.getImageData(0, 0, columns, rows);
      const ramp = currentRamp();
      const brightness = parseInt(brightnessSlider.value, 10) * 1.2;
      const contrastRaw = parseInt(contrastSlider.value, 10) * 2.55;
      const contrastFactor = (259 * (contrastRaw + 255)) / (255 * (259 - contrastRaw));
      const gamma = parseFloat(gammaSlider.value);
      const invert = invertCheckbox.checked;

      function adjust(v) {
        v = contrastFactor * (v - 128) + 128 + brightness;
        v = 255 * Math.pow(Math.max(0, Math.min(255, v)) / 255, 1 / gamma);
        v = Math.max(0, Math.min(255, v));
        return invert ? 255 - v : v;
      }

      const grid = [];
      const textRows = [];
      for (let y = 0; y < rows; y++) {
        const rowCells = [];
        let textRow = "";
        for (let x = 0; x < columns; x++) {
          const i = (y * columns + x) * 4;
          const r = adjust(data[i]);
          const g = adjust(data[i + 1]);
          const b = adjust(data[i + 2]);
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const idx = Math.min(ramp.length - 1, Math.floor(((255 - lum) / 255) * ramp.length));
          const ch = ramp[idx] || " ";
          textRow += ch;
          rowCells.push({ ch, r: Math.round(r), g: Math.round(g), b: Math.round(b) });
        }
        grid.push(rowCells);
        textRows.push(textRow);
      }
      lastAsciiText = textRows.join("\n");

      drawCanvas(grid, columns, rows);
    }

    function drawCanvas(grid, columns, rows) {
      const fontSize = columns > 180 ? 6 : columns > 120 ? 8 : columns > 80 ? 10 : 12;
      const charWidth = fontSize * 0.6;
      const lineHeight = fontSize;
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const w = Math.ceil(columns * charWidth);
      const h = Math.ceil(rows * lineHeight);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bgMode === "light" ? "#f5f6f4" : "#0b0d0f";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${fontSize}px ${MONO_STACK}`;
      ctx.textBaseline = "top";

      const monoColor = monoColorInput.value;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const cell = grid[y][x];
          if (cell.ch === " ") continue;
          ctx.fillStyle = colorMode === "color" ? `rgb(${cell.r},${cell.g},${cell.b})` : monoColor;
          ctx.fillText(cell.ch, x * charWidth, y * lineHeight);
        }
      }

      canvas.style.display = "block";
      emptyMsg.style.display = "none";
      outputWrap.classList.remove("is-empty");
    }

    /* ---- export ---- */

    document.getElementById("img-copy").addEventListener("click", () => {
      if (lastAsciiText) copyText(lastAsciiText, copyFlash);
    });
    document.getElementById("img-download-txt").addEventListener("click", () => {
      if (lastAsciiText) download("ascii-image.txt", new Blob([lastAsciiText], { type: "text/plain" }));
    });
    document.getElementById("img-download-png").addEventListener("click", () => {
      if (!lastAsciiText) return;
      canvas.toBlob((blob) => download("ascii-image.png", blob), "image/png");
    });
  })();
})();
