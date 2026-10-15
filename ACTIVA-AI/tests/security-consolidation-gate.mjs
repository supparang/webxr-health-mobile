// S2.13 — consolidated main-relative security controls inventory.
// CI-only static integration guard; not a substitute for independent
// code review, deployed-Staging QA, network pentest, or human Production GO.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const get=async name=>readFile(new URL("../"+name,import.meta.url),"utf8");
const inventory=JSON.parse(await get("security/s2.13-consolidated-review-manifest.json"));
const server=await get("server/index.js");
const limiter=await get("server/rate-limit.js");
const secMonitor=await get("server/security-monitor.js");
const secAlert=await get("server/security-alert-delivery.js");
const frontend=await get("server/frontend-security.js");
const config=await get("server/deployment-config.js");
const page=await get("index.html");
const staging=await get("scripts/verify-staging-security.mjs");
const dispatch=await readFile(new URL("../../.github/workflows/activa-ai-staging-acceptance.yml",import.meta.url),"utf8");
const decision=await get("scripts/assess-production-security.mjs");
const evidence=JSON.parse(await get("security/s2.12-review-input.template.json"));
const manifest=JSON.parse(await get("tests/browser-asset-integrity.json"));

assert.equal(inventory.schemaVersion,1);
assert.equal(inventory.reviewType,"ACTIVA_AI_CONSOLIDATED_SOFTWARE_SECURITY_REVIEW");
assert.equal(inventory.baseline.branch,"main");
assert.equal(inventory.stages.length,12);
assert.deepEqual(inventory.stages.map(x=>x.name),
  Array.from({length:12},(_,i)=>"S2."+(i+1)));
assert.deepEqual(inventory.prerequisiteDraftPRs,
  Array.from({length:12},(_,i)=>136+i));
for(const name of ["productionGoApproved","mergeApproved",
  "deploymentApproved","researchEthicsApproved"]) {
  assert.equal(inventory[name],false,"Manifest must never authorize: "+name);
}
assert.equal(inventory.releaseDecision,"HOLD");
assert.equal(inventory.manualAcceptance.approvedIsolatedStaging,"NOT_VERIFIED");
assert.equal(inventory.manualAcceptance.realGoogleOidc,"NOT_TESTED");
assert.equal(inventory.manualAcceptance.realAlertDelivery,"NOT_TESTED");

// Middleware order matters. IP/public quotas must run before the JSON parser;
// authenticated quotas must run only after the actor identity is attached.
function at(piece){const n=server.indexOf(piece);assert(n>=0,"Missing server protection "+piece);return n;}
const ip=at('app.use("/api", rateLimiters.perIp);');
const guest=at('app.use("/api/public/guest", rateLimiters.guestIp, rateLimiters.guestPass);');
const reviewer=at('app.use("/api/public/blind-review", rateLimiters.reviewerIp, rateLimiters.reviewerPass);');
const json=at('app.use(express.json({ limit: "1mb" }));');
const attach=at('app.use("/api", attachActor);');
const account=at('app.use("/api", rateLimiters.authenticated, rateLimiters.authenticatedWrite);');
const admin=at('app.get("/api/operations/security-summary", requireRoles("ADMIN")');
assert(ip<guest&&guest<reviewer&&reviewer<json&&json<attach);
assert(attach<account&&account<admin,"ADMIN summary must require authentication and be role-guarded");
assert(server.includes("securityMonitor.recordHttp(req, res.statusCode)"));
assert(server.includes("securityAlertDispatcher.enqueue(event)"));
assert(server.includes("routeTemplateForLog(req)"));
assert(server.includes("securityMonitor.recordAudit(action, req)"));
assert(server.includes("accessibleActivityIdsForUser"));
assert(server.includes("EVIDENCE_ACTIVITY_SCOPE_FORBIDDEN"));
assert(server.includes("PERSONAL_QR_ACTIVITY_SCOPE_FORBIDDEN"));
assert(config.includes("PRODUCTION_RATE_LIMIT_MUST_BE_ENABLED"));
assert(limiter.includes("RATE_LIMITED"));
assert(secMonitor.includes('type: "security_alert"'));
assert(secAlert.includes('"DISABLED"'));
assert(secAlert.includes("https://api.github.com/repos/"));
assert(secAlert.includes('redirect:"error"')||secAlert.includes('redirect:"error",'));

// XSS/CSP safety. Static checks complement the existing real Chromium CI test.
assert(frontend.includes("frame-ancestors 'none'"));
assert(frontend.includes("script-src-attr 'none'"));
assert(!frontend.includes("script-src 'unsafe-inline'"));
assert(!frontend.includes("script-src 'unsafe-eval'"));
for(const asset of manifest.assets){
  const tag='<script src="'+asset.url+'" integrity="'+asset.sha384+
    '" crossorigin="anonymous" defer></script>';
  assert(page.includes(tag),"Missing pinned QR JavaScript "+asset.id);
}
assert(!/<script\s*>[\s\S]*?<\/script>/i.test(page));

// Release approvals are an external human task. No source may represent a
// passing CI/staging checker as legal authorization or accepted Production GO.
assert(staging.includes('productionGoApproved:false'));
assert(staging.includes('manualAcceptanceStatus:"NOT_TESTED"'));
assert(decision.includes("READY_FOR_HUMAN_DECISION"));
assert(decision.includes("productionGoApproved:false"));
assert(decision.includes("mergeApproved:false"));
assert(decision.includes("researchEthicsApproved:false"));
assert.equal(evidence.pullRequests.integrationReviewedAndMerged,false);
for(let i=1;i<=13;i++){
  const id="M"+String(i).padStart(2,"0");
  assert.equal(evidence.manualChecks[id].status,"NOT_TESTED");
}
assert(/on:\s*\n\s+workflow_dispatch:/.test(dispatch));
assert(!/\n\s+(?:push|schedule|pull_request):/.test(dispatch));
assert(dispatch.includes('ACTIVA_S211_APPROVAL_ENABLED: ${{ vars.ACTIVA_S211_APPROVAL_ENABLED }}'));
assert(dispatch.includes("environment: ACTIVA-Staging-ReadOnly"));
assert(dispatch.includes("persist-credentials: false"));

console.log("ACTIVA-AI S2.13 consolidated release-candidate control inventory: PASS (NO-GO/HOLD)");
