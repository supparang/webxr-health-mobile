import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FRONTEND_CSP_META, FRONTEND_CSP_HEADER,
  setFrontendHtmlSecurityHeaders,
} from "../server/frontend-security.js";

// S2.6 static policy verification: no browser or Production API is contacted.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "Login.html", "guest.html", "blind-review.html"];
const csp = FRONTEND_CSP_META;
assert(csp.includes("object-src 'none'"));
assert(csp.includes("base-uri 'self'"));
assert(csp.includes("script-src-attr 'none'"));
assert(csp.includes("https://accounts.google.com/gsi/client"));
assert(csp.includes("https://accounts.google.com/gsi/style"));
assert(csp.includes("frame-src https://accounts.google.com/gsi/"));
assert(csp.includes("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"));
assert(csp.includes("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"));
assert(csp.includes("connect-src 'self' https:"));
assert(!csp.includes("script-src 'unsafe-inline'"));
assert(!csp.includes("script-src *"));
assert(!csp.includes("unsafe-eval"));
assert(FRONTEND_CSP_HEADER.endsWith("frame-ancestors 'none'"));
assert(!csp.includes("frame-ancestors"),"meta CSP does not support frame-ancestors");

for (const page of pages) {
  const html=await fs.readFile(path.join(root,page),"utf8");
  const policyTag=/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/>/i.exec(html);
  assert(policyTag,page+" missing CSP meta");
  assert.equal(policyTag[1],csp,page+" CSP deviates from Node server policy");
  const firstScript=html.search(/<script\b/i);
  const firstPolicy=html.search(/<meta\s+http-equiv="Content-Security-Policy"/i);
  assert(firstPolicy>=0 && (firstScript<0 || firstPolicy<firstScript),
    page+" CSP must appear before JavaScript");
  assert(!/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(html),
    page+" inline JavaScript must be extracted");
  assert(!/\son(?:click|error|load|submit|change|input|focus|blur)\s*=/i.test(html),
    page+" inline JS event handler prohibited");
  assert(!/javascript\s*:/i.test(html),page+" unsafe javascript URL");
  assert(!/<base\b/i.test(html),page+" unreviewed base URL element");
  const references=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(m=>m[1]);
  for (const script of references) {
    if (script.startsWith("https://")) {
      assert(["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
        "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
        "https://accounts.google.com/gsi/client"].includes(script),
        page+" unexpected external JS dependency: "+script);
    } else {
      assert(script.startsWith("./"),page+" unreviewed script URL");
      const pathname=script.slice(2).split("?")[0];
      await fs.access(path.join(root,pathname));
    }
  }
}
const login=await fs.readFile(path.join(root,"Login.html"),"utf8");
assert(login.includes("login-redirect.js"),"Login redirect must be a local script");
const redirect=await fs.readFile(path.join(root,"login-redirect.js"),"utf8");
assert(redirect.includes('window.location.replace("./index.html?v=11503")'));

const app=await fs.readFile(path.join(root,"app.js"),"utf8");
assert(app.includes("esc(roleLabel(session.role))"),"Role label must be HTML-escaped");
assert(app.includes("esc(viewTitle())"),"Page title must be HTML-escaped");
assert(!/\bdocument\.write\s*\(/.test(app),"document.write sink prohibited");
assert(!/\b(?:eval|Function)\s*\(/.test(app),"dynamic code execution prohibited");

const headers={};
const res={set:(key,value)=>{headers[key.toLowerCase()]=value;return res;}};
setFrontendHtmlSecurityHeaders(res);
assert.equal(headers["content-security-policy"],FRONTEND_CSP_HEADER);
assert.equal(headers["cache-control"],"no-store");
console.log("ACTIVA-AI S2.6 CSP static HTML + escaping regression: PASS");
