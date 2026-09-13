#!/usr/bin/env node
/* One-time project setup on sch3ma, run by hand with the project's secret key. Safe to re-run:
   a collection PUT creates and never replaces, so a second run reports the collection as there
   and goes on to the settings below, which every run rewrites.

     SCH3MA_PROJECT=prj_… SCH3MA_SECRET=sk_live_… node tools/sch3ma_setup.mjs

   One collection. `shares` holds one row per share link from the image tool: the art as text,
   the kind of art, and its width in columns. Anyone reads a row, so a link works for anyone who
   has it. That also means anyone can read or list every share through the API, which
   privacy.html says. A visitor with an identity creates, and the owner alone deletes. Nobody
   updates, because a share is immutable. The first create mints the anonymous identity.

   `visitor` is visible to its owner only. The owner can filter on it, which is how "Your share
   links" lists server-side, and no other caller sees who made a share.

   `art` takes at most 300,000 code points, and ART_MAX in assets/js/sch3ma.js holds the same
   number. That is 996 rows at the tool's 300-column maximum. The widest character the shipped
   ramps use is 3 bytes in UTF-8, so a full-length piece stays under 900 KB, inside sch3ma's
   1 MB row cap. */

const project = process.env.SCH3MA_PROJECT;
const secret = process.env.SCH3MA_SECRET;
if (!project || !secret) {
  console.error("Set SCH3MA_PROJECT and SCH3MA_SECRET.");
  process.exit(1);
}
const base = `https://admin.sch3ma.com/${project}`;

const SHARES = {
  prefix: "shr",
  rules: { read: "public", create: "authenticated", delete: "owner:visitor" },
  fields: {
    art: { type: "text", required: true, maxLength: 300000, visible: "public" },
    // One kind today. Adding "text" later widens the enum, which is a loosening.
    kind: { type: "text", required: true, enum: ["image"], visible: "public" },
    width: { type: "integer", required: true, min: 1, visible: "public" },
    visitor: { type: "reference", to: "users", visible: "owner:visitor" },
  },
};
const ORIGINS = ["https://inascii.com"];
const IDENTITY = { anonymous: true, landing_url: "https://inascii.com/" };

async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

// The two-call rule: a first call answers a report and a token, the second commits.
async function twoCall(method, path, body, made) {
  const first = made ?? (await call(method, path, body));
  if (first.status === 201) return first;
  if (first.status !== 200 || !first.json || !first.json.report) throw new Error(`${method} ${path}: ${first.status} ${first.text}`);
  const second = await call(method, `${path}?_confirm=${encodeURIComponent(first.json.report.confirm_token)}`, body);
  if (second.status !== 200) throw new Error(`${method} ${path} (confirm): ${second.status} ${second.text}`);
  return second;
}

// A second run answers 409 collection_exists. That is the collection already where this script
// wants it, so the run goes on.
const first = await call("PUT", "/_schemas/shares", SHARES);
if (first.status === 409 && first.json?.error?.code === "collection_exists") console.log("shares: exists");
else console.log(`shares: ${(await twoCall("PUT", "/_schemas/shares", SHARES, first)).status}`);
console.log(`origins: ${(await twoCall("PUT", "/_origins", { origins: ORIGINS })).status}`);
const identity = await call("PATCH", "/_identity", IDENTITY);
console.log(`identity: ${identity.status} ${identity.text}`);

// The placeholder is spelled in two parts here, so a search of the repo for it finds
// assets/js/sch3ma.js alone, and a careless sed cannot rewrite this script.
const MARK = "PENDING";
console.log(`
Now turn sharing on. Put the project id and the publishable key into the one file that holds them:

  sed -i '' -e 's/prj_${MARK}/${project}/' -e 's/pk_live_${MARK}/pk_live_…/' assets/js/sch3ma.js
`);
