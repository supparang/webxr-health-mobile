import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

// Static/source-isolated test: no browser, remote CDN request, database,
// Production credential or user data. Malicious strings are synthetic.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=await fs.readFile(path.join(root,"app.js"),"utf8");
const guest=await fs.readFile(path.join(root,"guest.js"),"utf8");
const blind=await fs.readFile(path.join(root,"blind-review.js"),"utf8");
const html=await fs.readFile(path.join(root,"index.html"),"utf8");
const manifest=JSON.parse(await fs.readFile(path.join(root,"package.json"),"utf8"));
const lock=JSON.parse(await fs.readFile(path.join(root,"package-lock.json"),"utf8"));

const payload='\"><img src=x onerror=alert(1)><svg/onload=alert(1)>&\'';
const escStart=app.indexOf("  const esc = (v) => ");
const escEnd=app.indexOf("  const fmt = ",escStart);
assert(escStart>=0 && escEnd>escStart,"HTML escaper not found");
const esc=vm.runInNewContext(app.slice(escStart,escEnd)+"\n esc",Object.create(null));
assert.equal(typeof esc,"function");
assert(!esc(payload).includes("<img"));
assert(esc(payload).includes("&quot;")&&esc(payload).includes("&#39;")&&esc(payload).includes("&lt;"));
assert(esc(payload).includes("&amp;"),"Ampersands must be escaped");

// Test exact code extracted from the app so changes to production helpers
// are covered rather than testing only a reimplemented HTML escaper.
const fieldStart=app.indexOf("  function field(");
const fieldEnd=app.indexOf("  const checked = ",fieldStart);
assert(fieldStart>=0&&fieldEnd>fieldStart,"field renderer helpers absent");
const renderers=vm.runInNewContext(app.slice(fieldStart,fieldEnd)+"\n({field,check})",{esc});
const fieldHtml=renderers.field(payload,payload,payload,payload,payload);
const checkHtml=renderers.check(payload,payload,true);
for(const output of [fieldHtml,checkHtml]) {
  assert(!output.includes("<img"),"Unsanitized HTML element in form helper");
  assert(!output.includes('onerror=alert(1)><svg'),"HTML attribute breakout");
  assert(output.includes("&quot;")&&output.includes("&lt;"));
}

// Ground Truth reasonCodes may be data from an existing label or imported
// evidence. Both text and value attributes must escape injected markup.
const reasonsStart=app.indexOf("reasonCodes.map(code => ");
assert(reasonsStart>=0);
const reasonsEnd=app.indexOf('.join("")',reasonsStart);
assert(reasonsEnd>reasonsStart);
const actualExpression=app.slice(reasonsStart,reasonsEnd+'.join("")'.length);
const rendered=vm.runInNewContext(actualExpression,{
  reasonCodes:[payload],esc,lockedCase:false,
});
assert(rendered.includes('class="gtReason"'));
assert(!rendered.includes('<img'));
assert(!rendered.includes('<svg'));
assert(rendered.includes("&quot;")&&rendered.includes("&lt;"));
assert(!rendered.includes('value="'+payload),"Reason code broke out of value attribute");

// High-risk dynamic data/id sinks must retain contextual escaping.
for(const piece of [
  'data-id="\'+esc(u.id)+\'"',
  'data-id="\'+esc(m.id)+\'"',
  'data-id="\'+esc(r.id)+\'"',
  'data-status="\'+esc(u.status)+\'"',
  '<option value="\'+esc(a.id)+\'">',
  '<option value="\'+esc(r.id)+\'">',
  'data-permission="\'+esc(key)+\'"',
  'data-filter="\'+esc(key)+\'"',
]) assert(app.includes(piece),"Unsafe dynamic data/attribute sink: "+piece);

// Scanning all user-visible frontend scripts for dangerous direct execution
// sinks; document.write or Function('...') must never be used for rendering.
for(const [name,source] of [["app",app],["guest",guest],["blind",blind]]) {
  assert(!/\bdocument\.write\s*\(/.test(source),name+" unsafe document.write");
  assert(!/\b(?:eval|Function)\s*\(/.test(source),name+" dynamic code execution");
  assert(!/\bsetInterval\s*\(\s*["']/.test(source),name+" string timer execution");
}
assert(/function\s+esc\s*\(/.test(guest),"Guest page must use HTML encoder");
assert(/function\s+esc\s*\(/.test(blind),"Blind Review must use HTML encoder");
assert(guest.includes("esc(c.text)")&&guest.includes("esc(a.title)"),
  "Guest consent text/activity title must be encoded");
assert(blind.includes("esc(data.caseRef")&&blind.includes("esc(a.title"),
  "Blind reviewer case and activity title must be encoded");

// Third-party browser JS may only load audited exact/versioned URLs.
// This test is a pinned-source allowlist; it is NOT SRI or byte integrity.
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
const allowedExternal=[
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
];
assert.deepEqual(scripts.filter(x=>x.startsWith("https://")).sort(),allowedExternal.sort());
assert(!/<script\b[^>]*\bsrc="(?:http:|\/\/)/i.test(html),"Unreviewed insecure/script origin");
// npm ci verifies lock integrity for registry packages; this audit enforces
// presence of those fields without claiming malicious upstream prevention.
assert.equal(lock.lockfileVersion>=2,true);
for(const [name,entry] of Object.entries(lock.packages||{})) {
  if(!name.startsWith("node_modules/"))continue;
  if(entry.resolved && /^https:\/\/registry\.npmjs\.org\//.test(entry.resolved)) {
    assert(/^sha(?:1|256|384|512)-[A-Za-z0-9+/=]+$/.test(entry.integrity||""),
      "NPM registry dependency missing lockfile integrity: "+name);
  }
}
assert(manifest.dependencies?.express&&manifest.dependencies?.["@prisma/client"],
  "Backend dependency list unexpectedly absent");
console.log("S2.7 XSS renderers, attribute escaping and pinned dependency policy: PASS");
