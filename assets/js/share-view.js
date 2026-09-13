/* inascii.com — the share viewer at /s/?id=<row id>. A module. One request: the row the link
   names, read with the publishable key. The art reaches the page through textContent and never
   as markup, so a share cannot put HTML into this page.

   The page loads neither app.js nor font-page.js, so the theme toggle and the footer year are
   wired here too. */

import { client, configured, isShareId } from "./sch3ma.js";

const $ = (id) => document.getElementById(id);

(function initTheme() {
  const toggle = $("theme-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const current =
      document.documentElement.getAttribute("data-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ga-theme", next); } catch { /* private mode */ }
  });
})();

{
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

const MISSING = "This share does not exist. The link may be wrong, or its owner may have deleted it.";
const FAILED = "The shared art did not load. Try again in a moment.";

function state(text) {
  const el = $("share-state");
  el.textContent = text;
  el.hidden = text === "";
}

// The image tool draws its preview at these sizes (drawCanvas in app.js), so a share looks the
// way it did on screen.
function fontSizeFor(columns) {
  return columns > 180 ? 6 : columns > 120 ? 8 : columns > 80 ? 10 : 12;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  const flash = $("share-copy-flash");
  flash.classList.add("show");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => flash.classList.remove("show"), 1100);
}

async function boot() {
  if (!configured) {
    state("Sharing is not available yet.");
    return;
  }
  const id = new URLSearchParams(location.search).get("id") || "";
  if (!isShareId(id)) {
    state("This link is not complete. Check that you copied all of it.");
    return;
  }
  state("Loading the shared art…");
  const db = await client();
  if (!db) {
    state(FAILED);
    return;
  }

  let row;
  try {
    row = await db.get("shares", id);
  } catch (err) {
    state(err && err.code === "not_found" ? MISSING : FAILED);
    return;
  }
  if (!row || typeof row.art !== "string") {
    state(MISSING);
    return;
  }

  const lines = row.art.split("\n");
  const columns = Number.isInteger(row.width) ? row.width : Math.max(...lines.map((l) => l.length));
  const pre = $("share-pre");
  pre.textContent = row.art;
  pre.style.fontSize = fontSizeFor(columns) + "px";
  $("share-meta").textContent = columns + " columns, " + lines.length + " rows";
  $("share-copy").addEventListener("click", () => copyText(row.art));
  state("");
  $("share-result").hidden = false;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
