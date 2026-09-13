/* inascii.com — share links for the image tool. A module, loaded after app.js on the two pages
   that mount the image panel. Off until assets/js/sch3ma.js holds a real project: the share bar
   and the list stay hidden, and nothing is requested.

   What a visitor can cause:
     Create share link   one row with the art on screen, its kind and its width. The link then
                         goes to the clipboard, or to the share sheet on a touch device. The
                         first create also mints the anonymous identity that owns the row.
     Delete              one of this browser's rows, gone for everyone who has the link.
     the list            this browser's rows, filtered on the owner field by the server. It
                         loads with the page only where a create happened before, so a first
                         visit mints nothing and reads nothing. */

import { client, shareUrl, ART_MAX, DOC_BYTES_MAX } from "./sch3ma.js";

const SHARED_KEY = "ga-shared"; // "1" once this browser created a link
const PAGE = 10;
const TOO_LONG = "This art is too long to share. Lower the width, then try again.";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const $ = (id) => document.getElementById(id);

function errorText(err, fallback) {
  const code = err && err.code;
  const fields = err && err.body && Array.isArray(err.body.fields) ? err.body.fields : [];
  if (code === "document_too_large" || code === "body_too_large" || fields.some((f) => f.constraint === "maxLength")) return TOO_LONG;
  if (code === "rate_limited") return "Too many requests. Wait a minute, then try again.";
  if (code === "quota_exhausted") return "Sharing is paused for now. Try again later.";
  return fallback;
}

// The server counts maxLength in code points and the row cap in UTF-8 bytes of JSON. The page
// checks both first, so a piece that is too long gets a clear line and costs no request.
function tooLong(body) {
  if (body.art.length > ART_MAX && [...body.art].length > ART_MAX) return true;
  return new TextEncoder().encode(JSON.stringify(body)).length > DOC_BYTES_MAX;
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The clipboard can refuse a write that comes after the save, because the press that
    // allowed it is too old. Select the link in its box, so one more press copies it.
    if (!input) return false;
    input.focus();
    input.select();
    try { return document.execCommand("copy"); } catch { return false; }
  }
}

function rowCount(art) {
  let n = 1;
  for (let i = art.indexOf("\n"); i !== -1; i = art.indexOf("\n", i + 1)) n++;
  return n;
}

function describe(row) {
  const rows = typeof row.art === "string" ? rowCount(row.art) : 0;
  return (Number.isInteger(row.width) ? row.width + " columns, " : "") + rows + " rows";
}

function when(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "Share link" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function button(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "icon-btn";
  b.textContent = label;
  return b;
}

async function boot() {
  const bar = $("img-share");
  if (!bar) return;
  const db = await client();
  if (!db) return;

  const createBtn = $("img-share-create");
  const result = $("img-share-result");
  const urlInput = $("img-share-url");
  const status = $("img-share-status");
  const panel = $("img-shares");
  const list = $("img-shares-list");
  const listStatus = $("img-shares-status");
  const older = $("img-shares-older");

  let art = "";
  let columns = 0;
  let resultId = null; // the row behind the link in the result box
  let cursor = null;

  function removeItem(id) {
    Array.from(list.children).forEach((li) => { if (li.dataset.id === id) li.remove(); });
    if (resultId === id) {
      result.hidden = true;
      resultId = null;
    }
  }

  function item(row) {
    const li = document.createElement("li");
    li.className = "share-item";
    li.dataset.id = row.id;

    const main = document.createElement("div");
    main.className = "share-item-main";
    const link = document.createElement("a");
    link.href = shareUrl(row.id);
    link.textContent = when(row.created_at);
    const meta = document.createElement("span");
    meta.className = "share-item-meta";
    meta.textContent = describe(row);
    main.append(link, meta);

    const actions = document.createElement("div");
    actions.className = "share-item-actions";
    const copy = button("Copy link");
    copy.addEventListener("click", async () => {
      listStatus.textContent = (await copyText(link.href)) ? "Link copied." : "Open the link and copy it from the address bar.";
    });
    const del = button("Delete");
    // Two presses: the first arms the button for four seconds, the second deletes. Other people
    // can already hold the link, so one stray press must not break it for them.
    let armed = null;
    del.addEventListener("click", async () => {
      if (!armed) {
        del.textContent = "Confirm delete";
        del.classList.add("is-armed");
        armed = setTimeout(() => {
          armed = null;
          del.textContent = "Delete";
          del.classList.remove("is-armed");
        }, 4000);
        return;
      }
      clearTimeout(armed);
      del.disabled = true;
      del.textContent = "Deleting…";
      try {
        await db.delete("shares", row.id);
        removeItem(row.id);
        listStatus.textContent = "Link deleted. It no longer works.";
      } catch (err) {
        // Another tab deleted it first. The row is gone either way.
        if (err && err.code === "not_found") {
          removeItem(row.id);
          return;
        }
        armed = null;
        del.disabled = false;
        del.textContent = "Delete";
        del.classList.remove("is-armed");
        listStatus.textContent = errorText(err, "The link was not deleted. Try again.");
      }
    });
    actions.append(copy, del);

    li.append(main, actions);
    return li;
  }

  // The filter and the sort go out byte for byte the same on every page, because the cursor
  // carries a fingerprint of both and the server refuses a mismatch.
  async function loadList(more) {
    older.disabled = true;
    try {
      const session = await db.session();
      const page = await db.list("shares", {
        filter: { visitor: session.identity },
        sort: "-created_at",
        limit: PAGE,
        ...(more ? { cursor } : {}),
      });
      const have = new Set(Array.from(list.children, (li) => li.dataset.id));
      page.data.forEach((row) => { if (!have.has(row.id)) list.append(item(row)); });
      cursor = page.cursor;
      older.hidden = !page.has_more;
      listStatus.textContent = list.children.length ? "" : "You have no share links.";
    } finally {
      older.disabled = false;
    }
  }

  async function deliver(url) {
    // A touch device with the Web Share API gets the native share sheet, as "Copy link" does
    // on the text tool. Everywhere else the link goes to the clipboard.
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "ASCII art from inascii.com", url });
        status.textContent = "Link shared. Anyone who has it can see this art.";
        return;
      } catch (e) {
        if (e && e.name === "AbortError") {
          status.textContent = "Link created. Anyone who has it can see this art.";
          return;
        }
      }
    }
    status.textContent = (await copyText(url, urlInput))
      ? "Link copied. Anyone who has it can see this art."
      : "Link created. Press Copy link to copy it.";
  }

  window.addEventListener("ga:image-art", (e) => {
    const d = e.detail || {};
    art = typeof d.text === "string" ? d.text : "";
    columns = Number.isInteger(d.columns) ? d.columns : 0;
    bar.hidden = art === "";
  });
  // app.js renders a restored image as soon as it loads, and that can happen before this
  // module is ready. Ask once for the art on screen, now that a listener is in place.
  window.dispatchEvent(new Event("ga:image-art-request"));

  createBtn.addEventListener("click", async () => {
    if (!art) return;
    const body = { art, kind: "image", width: columns };
    if (tooLong(body)) {
      status.textContent = TOO_LONG;
      return;
    }
    createBtn.disabled = true;
    createBtn.textContent = "Saving…";
    status.textContent = "";
    try {
      const row = await db.create("shares", body);
      store.set(SHARED_KEY, "1");
      const url = shareUrl(row.id);
      resultId = row.id;
      urlInput.value = url;
      result.hidden = false;
      panel.hidden = false;
      listStatus.textContent = "";
      list.prepend(item(row));
      await deliver(url);
    } catch (err) {
      status.textContent = errorText(err, "The link was not created. Try again.");
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = "Create share link";
    }
  });

  $("img-share-copy").addEventListener("click", async () => {
    status.textContent = (await copyText(urlInput.value, urlInput)) ? "Link copied." : "Select the link, then copy it.";
  });

  older.addEventListener("click", () => {
    loadList(true).catch((err) => {
      listStatus.textContent = errorText(err, "Older links did not load. Try again.");
    });
  });

  if (store.get(SHARED_KEY) === "1") {
    panel.hidden = false;
    try {
      await loadList(false);
    } catch (err) {
      listStatus.textContent = errorText(err, "Your share links did not load. Reload the page to try again.");
    }
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
