/* inascii.com — the sch3ma link. Imported by share.js on the image tool and by share-view.js
   on /s/. The project id and the publishable key live in this file and in no other.

   While either one still reads PENDING, `configured` is false and client() answers null. The
   share bar, the share list and the viewer then stay off, and nothing is requested. To turn
   sharing on, run tools/sch3ma_setup.mjs, then fill both values with the sed it prints. */

const PROJECT = "prj_PENDING";
const KEY = "pk_live_PENDING"; // publishable: it ships in the page by design

export const configured = !PROJECT.endsWith("_PENDING") && !KEY.endsWith("_PENDING");

// The maxLength of shares.art, in code points. tools/sch3ma_setup.mjs declares the same
// number, and the two must stay equal.
export const ART_MAX = 300000;

// sch3ma refuses a stored row past 1,048,576 bytes of JSON. The server adds the id, the
// timestamps, the version and the owner to the body the page sends, so the page keeps 1 KB back.
export const DOC_BYTES_MAX = 1048576 - 1024;

// A row id is the collection prefix and a ULID. The viewer checks it before any request, so a
// damaged link never reaches the API as a path.
export function isShareId(id) {
  return /^shr_[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}

export function shareUrl(id) {
  return location.origin + "/s/?id=" + encodeURIComponent(id);
}

let dbPromise = null;
export function client() {
  if (!configured) return Promise.resolve(null);
  if (!dbPromise) dbPromise = import("https://sch3ma.com/sdk/1.js").then((m) => m.sch3ma({ project: PROJECT, key: KEY })).catch(() => null);
  return dbPromise;
}
