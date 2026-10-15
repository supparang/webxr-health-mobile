// S2.9 — actual headless Chromium browser security checks.
// CI uses disposable localhost Postgres/backend and synthetic test tokens only.
// This is NOT a Google OIDC login, hardware-camera, mobile-device, or live
// Staging acceptance test. All browser interaction stays on localhost except
// loading the two explicitly reviewed pinned QR CDN scripts.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright-core";

const expectedDatabase=/^postgres(?:ql)?:\/\/[^@]+@(?:127\.0\.0\.1|localhost):\d+\//;
if (process.env.CI!=="true" ||
    process.env.ACTIVA_TEST_DATABASE_ONLY!=="true" ||
    process.env.ALLOW_SYNTHETIC_CI!=="true" ||
    process.env.ACTIVA_DEPLOYMENT_TIER!=="STAGING" ||
    process.env.ACTIVA_AUTH_MODE!=="DEMO_HEADER" ||
    process.env.ACTIVA_PRODUCTION_GO_ENABLED!=="false" ||
    !expectedDatabase.test(process.env.DATABASE_URL||"")) {
  throw new Error("S2_9_REQUIRES_DISPOSABLE_LOCAL_CI_BACKEND");
}
const base=process.env.ACTIVA_BASE_URL||"http://127.0.0.1:3000";
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):3000\/?$/.test(base)) {
  throw new Error("S2_9_BROWSER_TARGET_MUST_BE_LOCALHOST_PORT_3000");
}
const binary=process.env.ACTIVA_CHROME_BIN;
if(!binary || !path.isAbsolute(binary)) throw new Error("S2_9_CHROME_EXECUTABLE_REQUIRED");
const fileRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(fileRoot,"test-results","s2-9-browser-security.json");
const manifest=JSON.parse(await readFile(new URL("./browser-asset-integrity.json",import.meta.url),"utf8"));
const evidence={
  testSuite:"ACTIVA-AI S2.9 synthetic headless Chromium security",
  scope:"localhost-disposable-CI",
  productionTested:false,
  liveGoogleOidcTested:false,
  physicalCameraTested:false,
  liveStagingTested:false,
  actualAlertDeliveryTested:false,
  sha:process.env.GITHUB_SHA||null,
  browser:null,
  results:[],
};
async function step(name,fn) {
  try {
    const detail=await fn();
    evidence.results.push({name,status:"PASS",detail:detail||"Verified in local headless Chromium"});
    console.log("S2_9_PASS "+name);
  } catch(e) {
    evidence.results.push({name,status:"FAIL",errorCode:"BROWSER_ASSERTION_FAILED"});
    console.error("S2_9_FAIL "+name+": "+String(e?.message||"Error").slice(0,240));
    throw e;
  }
}
let browser;
let completed=false;
try {
  browser=await chromium.launch({
    executablePath:binary,headless:true,
    args:["--no-sandbox","--disable-dev-shm-usage"],
    timeout:30000,
  });
  evidence.browser=await browser.version();

  await step("HTTP_HTML_CSP_HEADER",async()=>{
    for(const pathname of ["/","/index.html","/Login.html","/guest.html","/blind-review.html"]) {
      const response=await fetch(base+pathname);
      assert.equal(response.status,200,"HTML route missing");
      const csp=response.headers.get("content-security-policy")||"";
      assert(csp.includes("script-src-attr 'none'"));
      assert(csp.includes("object-src 'none'"));
      assert(csp.includes("frame-ancestors 'none'"));
      assert(!csp.includes("script-src 'unsafe-inline'"));
    }
    return "All five HTML routes served with enforced CSP and anti-framing response header";
  });

  const context=await browser.newContext({
    viewport:{width:1280,height:800},
    ignoreHTTPSErrors:false,
    serviceWorkers:"block",
  });
  const page=await context.newPage();
  const mainErrors=[];
  page.on("pageerror",err=>mainErrors.push(String(err?.message||"Browser error").slice(0,180)));
  await step("DESKTOP_MAIN_APP_RENDER",async()=>{
    const response=await page.goto(base+"/index.html",{waitUntil:"domcontentloaded",timeout:30000});
    assert.equal(response?.status(),200);
    await page.locator("#app").waitFor({state:"attached"});
    await page.waitForFunction(()=>document.getElementById("app").children.length>0,{timeout:15000});
    const title=await page.title();
    assert(title.includes("ACTIVA-AI"),"Main page title");
    if(mainErrors.length)throw new Error("Unexpected page JS exception: "+mainErrors[0]);
    return "ACTIVA-AI loaded and app root populated in desktop Chromium";
  });

  await step("SRI_QR_SCRIPT_BROWSER_LOAD",async()=>{
    await page.waitForFunction(
      ()=>typeof window.QRCode==="function" && typeof window.Html5Qrcode==="function",
      {timeout:20000}
    );
    const scripts=await page.locator("script[src^='https://']").evaluateAll(nodes=>
      nodes.map(el=>({src:el.getAttribute("src"),
        integrity:el.getAttribute("integrity"),
        crossorigin:el.getAttribute("crossorigin")})));
    assert.equal(scripts.length,manifest.assets.length);
    for(const asset of manifest.assets) {
      const matching=scripts.filter(s=>s.src===asset.url);
      assert.equal(matching.length,1);
      assert.equal(matching[0].integrity,asset.sha384);
      assert.equal(matching[0].crossorigin,"anonymous");
    }
    return "Two pinned QR libraries loaded as JavaScript globals with reviewed SHA-384 SRI";
  });

  await step("CSP_BLOCKS_INLINE_SCRIPT_AND_EVENT_HANDLER",async()=>{
    const state=await page.evaluate(()=>{
      window.__s29InlineRan=false;
      window.__s29HandlerRan=false;
      const sc=document.createElement("script");
      sc.textContent="window.__s29InlineRan=true;";
      document.head.append(sc);
      const img=document.createElement("img");
      img.setAttribute("onerror","window.__s29HandlerRan=true;");
      img.src="/missing-s2-9-browser-check.png";
      document.body.append(img);
      return {script:window.__s29InlineRan};
    });
    assert.equal(state.script,false,"Injected inline <script> unexpectedly executed");
    await page.waitForTimeout(250);
    const result=await page.evaluate(()=>({
      inline:window.__s29InlineRan,handler:window.__s29HandlerRan,
    }));
    assert.equal(result.inline,false);
    assert.equal(result.handler,false);
    return "Injected inline executable script and HTML onerror attribute were blocked by CSP";
  });

  await step("LOGIN_REDIRECT_JS_EXTERNAL",async()=>{
    const login=await context.newPage();
    try {
      await login.goto(base+"/Login.html",{waitUntil:"domcontentloaded"});
      await login.waitForURL(url=>url.pathname.endsWith("/index.html"),{timeout:10000});
      assert((await login.url()).includes("/index.html"));
    } finally {await login.close();}
    return "Legacy Login.html redirects through same-origin external JavaScript";
  });

  await step("GUEST_PASS_URL_FRAGMENT_REDACTION",async()=>{
    const guest=await context.newPage();
    try {
      // This synthetic invalid value is not a credential and has no privileges.
      const fake="S2_9_FAKE_UNUSABLE_GUEST_TOKEN";
      await guest.goto(base+"/guest.html#token="+fake,{waitUntil:"domcontentloaded"});
      await guest.waitForFunction(()=>location.hash==="",{timeout:10000});
      assert.equal(new URL(guest.url()).hash,"");
      await guest.locator("#guestApp").waitFor({state:"visible",timeout:10000});
    } finally {await guest.close();}
    return "Guest Pass token fragment cleared from browser address/history before rendering";
  });

  await step("BLIND_REVIEW_URL_FRAGMENT_REDACTION",async()=>{
    const reviewer=await context.newPage();
    try {
      const fake="S2_9_FAKE_UNUSABLE_REVIEWER_TOKEN";
      await reviewer.goto(base+"/blind-review.html#token="+fake,{waitUntil:"domcontentloaded"});
      await reviewer.waitForFunction(()=>location.hash==="",{timeout:10000});
      assert.equal(new URL(reviewer.url()).hash,"");
      await reviewer.locator("#blindReviewApp").waitFor({state:"visible",timeout:10000});
    } finally {await reviewer.close();}
    return "Blind Review bearer fragment cleared from browser address/history";
  });

  await step("SRI_TAMPERED_SCRIPT_NOT_EXECUTED",async()=>{
    const tampered=await browser.newContext({serviceWorkers:"block"});
    const changed=await tampered.newPage();
    const q=manifest.assets.find(x=>x.id==="qrcodejs-1.0.0");
    assert(q);
    let wasIntercepted=false;
    try {
      await changed.route(q.url,async route=>{
        wasIntercepted=true;
        await route.fulfill({
          status:200,contentType:"application/javascript",
          headers:{"access-control-allow-origin":"*"},
          body:"window.__S29InjectedSupplyChain=true;window.QRCode=function(){};",
        });
      });
      const response=await changed.goto(base+"/index.html",{waitUntil:"domcontentloaded",timeout:30000});
      assert.equal(response?.status(),200);
      assert(wasIntercepted,"Did not intercept pinned dependency");
      await changed.waitForTimeout(450);
      const result=await changed.evaluate(()=>({
        malicious:window.__S29InjectedSupplyChain===true,
        qrcode:typeof window.QRCode,
      }));
      assert.equal(result.malicious,false,"Tampered bytes executed despite SHA-384 mismatch");
      assert.equal(result.qrcode,"undefined","Tampered asset unexpectedly installed QRCode");
    } finally {
      await tampered.close();
    }
    return "Headless Chromium rejects intercepted tampered QR CDN script when SRI differs";
  });

  await step("MOBILE_VIEWPORT_STATIC_UI",async()=>{
    const mobile=await browser.newContext({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,
      deviceScaleFactor:2,serviceWorkers:"block",
    });
    try{
      const p=await mobile.newPage();
      await p.goto(base+"/index.html",{waitUntil:"domcontentloaded"});
      await p.locator("#app").waitFor({state:"attached"});
      await p.waitForFunction(()=>document.getElementById("app").children.length>0);
      const hasHorizontalScroll=await p.evaluate(()=>
        document.documentElement.scrollWidth>innerWidth+50
      );
      assert.equal(hasHorizontalScroll,false,"Mobile root has excessive horizontal scroll");
    } finally {await mobile.close();}
    return "App renders under emulated mobile viewport; not a physical phone/camera test";
  });
  await context.close();
  completed=true;
} finally {
  if(browser)await browser.close();
  evidence.summary={
    pass:evidence.results.filter(x=>x.status==="PASS").length,
    fail:evidence.results.filter(x=>x.status==="FAIL").length,
    completed,
  };
  await mkdir(path.dirname(out),{recursive:true});
  await writeFile(out,JSON.stringify(evidence,null,2)+"\n");
  console.log("S2_9_BROWSER_EVIDENCE "+JSON.stringify(evidence.summary));
}
if(!completed)process.exitCode=1;
