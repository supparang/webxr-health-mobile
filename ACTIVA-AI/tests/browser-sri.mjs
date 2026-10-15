import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// Offline S2.8 release invariant — no network, database, browser or secrets.
const root=new URL("../",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("./browser-asset-integrity.json",import.meta.url),"utf8"));
const html=await readFile(new URL("./index.html",root),"utf8");
const page=await readFile(new URL("./guest.html",root),"utf8");
const review=await readFile(new URL("./blind-review.html",root),"utf8");

assert.equal(manifest.assets.length,2,"QR dependency count changed; seek security review");
const expectedIds=["qrcodejs-1.0.0","html5-qrcode-2.3.8"];
assert.deepEqual(manifest.assets.map(x=>x.id),expectedIds);
assert.equal(new Set(manifest.assets.map(x=>x.url)).size,2);
const scriptTags=[...html.matchAll(/<script\b[^>]*><\/script>/gi)].map(x=>x[0]);
function attr(tag,name){const m=new RegExp("\\b"+name+'="([^"]+)"',"i").exec(tag);return m?.[1]||null;}
const external=scriptTags.filter(x=>(attr(x,"src")||"").startsWith("https://"));
assert.equal(external.length,manifest.assets.length,"Unreviewed external JavaScript detected");
for (const asset of manifest.assets) {
  assert(/^https:\/\/[a-z0-9.-]+\//.test(asset.url),"Non-HTTPS asset origin");
  assert(/^sha384-[A-Za-z0-9+/]{64}$/.test(asset.sha384),"SRI digest invalid");
  assert(/^[0-9a-f]{64}$/.test(asset.sha256),"SHA-256 digest invalid");
  assert(Number.isInteger(asset.bytes)&&asset.bytes>=1000&&asset.bytes<=1000000);
  const matching=external.filter(t=>attr(t,"src")===asset.url);
  assert.equal(matching.length,1,"Missing/unreviewed CDN script "+asset.id);
  assert.equal(attr(matching[0],"integrity"),asset.sha384,"Pinned SRI drifted: "+asset.id);
  assert.equal(attr(matching[0],"crossorigin"),"anonymous","SRI requires anonymous CORS: "+asset.id);
  assert(/\bdefer\b/.test(matching[0]),"Unexpected blocking script loading");
}
for(const tag of scriptTags){
  const url=attr(tag,"src");
  assert(url && !url.startsWith("http:"),"External JavaScript must be HTTPS");
  assert(!url.startsWith("//"),"Protocol-relative script not permitted");
  assert(!/\bonerror\s*=|\bonload\s*=/.test(tag),"Inline event callback disallowed");
}
for(const [name,source] of [["Guest",page],["Blind Review",review]]) {
  assert(!/<script\b[^>]*\bsrc="https?:/i.test(source),
    name+" must not acquire unreviewed remote scripts");
}
const csp=await readFile(new URL("./server/frontend-security.js",root),"utf8");
for(const asset of manifest.assets) assert(csp.includes(asset.url),
  "CSP must continue allowing exact pinned source "+asset.id);
assert(!csp.includes('script-src *'),"Wildcard scripts not permitted");
console.log("ACTIVA-AI S2.8 browser QR script SRI policy: PASS");
