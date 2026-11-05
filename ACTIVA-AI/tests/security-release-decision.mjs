import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluateSecurityRelease} from "../scripts/assess-production-security.mjs";

// No network, browser, database, Production user or workflow mutation.
// These are synthetic evidence entries: an "eligible" response can NEVER GO.
const raw=JSON.parse(await readFile(
  new URL("../security/s2.12-review-input.template.json",import.meta.url),"utf8"));
const asOf=new Date("2026-10-15T03:45:00.000Z");
const baseline=evaluateSecurityRelease(raw,{now:asOf});
assert.equal(baseline.decision,"HOLD");
assert.equal(baseline.productionGoApproved,false);
assert.equal(baseline.deploymentApproved,false);
assert.equal(baseline.mergeApproved,false);
assert.equal(baseline.electronicSignaturesVerified,false);
assert.equal(baseline.evidenceProvenanceVerified,false);
assert.equal(baseline.manualDeviceAcceptanceComplete,false);
assert.equal(baseline.researchEthicsStatus,"NOT_SUBMITTED");
assert(baseline.blockers.some(x=>x.code==="RELEASE_CANDIDATE_DECLARED"));
assert(baseline.blockers.some(x=>x.code==="PRS_REVIEWED_AND_MERGED"));
assert(baseline.blockers.some(x=>x.code==="STAGING_READ_ONLY_PREFLIGHT_VERIFIED"));
assert.equal(baseline.blockers.filter(x=>x.code.startsWith("MANUAL_M")).length,13);
assert(!JSON.stringify(baseline).includes("69eb50801cc306946edcdb8045687f77b3b3"),
  "Do not confuse prior CI with a release candidate");

const SHA="a".repeat(40);
const clone=(x)=>JSON.parse(JSON.stringify(x));
const nominal=clone(raw);
nominal.releaseCandidateCommit=SHA;
nominal.ci={
  status:"PASS",testedCommit:SHA,runId:"123456789",
  verifiedGitHubUrl:"https://github.com/supparang/webxr-health-mobile/actions/runs/123456789",
};
nominal.staging={
  deploymentStatus:"VERIFIED",approvedIsolatedInfrastructure:true,
  independentIsolationEvidenceRef:"STG-ISOLATION-123",
  deployedCommit:SHA,readOnlyPreflightEvidenceRef:"STG-PREFLIGHT-123",
  readOnlyPreflight:{
    type:"ACTIVA_S210_READ_ONLY_STAGING_PREFLIGHT",
    checkedAtUtc:"2026-10-15T03:00:00.000Z",
    automatedChecksPassed:true,
    manualAcceptanceStatus:"NOT_TESTED",
    productionGoApproved:false,
    expectedSourceCommit:SHA,
    checks:Array.from({length:30},(_,i)=>({
      id:"SECURITY_CHECK_"+String(i+1).padStart(2,"0"),passed:true,
    })),
  },
};
nominal.pullRequests.integrationReviewedAndMerged=true;
nominal.pullRequests.mergeEvidenceRef="PR-INTEGRATION-123";
for(const id of Object.keys(nominal.manualChecks))
  nominal.manualChecks[id]={status:"PASS",evidenceRef:"QA-"+id+"-123"};
for(const id of [
  "independentSecurityAssessment","privacyAndPersonnelDirectory",
  "providerProxyAndLoad","incidentAlertDeliveryAndAck",
])nominal.review[id]={status:"PASS",evidenceRef:"SEC-"+id.toUpperCase()+"-123"};
nominal.review.criticalHighFindings="NONE_OPEN";
nominal.review.findingsRegisterEvidenceRef="SEC-FINDINGS-123";
nominal.review.securityOwnerSignoff={status:"APPROVED",evidenceRef:"SEC-SIGNOFF-123"};
nominal.review.operationsOwnerSignoff={status:"APPROVED",evidenceRef:"OPS-SIGNOFF-123"};
let candidate=evaluateSecurityRelease(nominal,{now:asOf});
assert.equal(candidate.decision,"READY_FOR_HUMAN_DECISION");
assert.equal(candidate.blockers.length,0);
assert.equal(candidate.manualDeviceAcceptanceComplete,true);
assert.equal(candidate.passedChecks,candidate.totalChecks);
assert.equal(candidate.productionGoApproved,false,
  "Even synthetic all-PASS evidence must never turn on Production GO");
assert.equal(candidate.mergeApproved,false);
assert.equal(candidate.deploymentApproved,false);
assert.equal(candidate.researchEthicsApproved,false);

const cases=[
  ["STALE_DEPLOYMENT",x=>{x.staging.deployedCommit="b".repeat(40);}],
  ["STALE_CI_SHA",x=>{x.ci.testedCommit="b".repeat(40);}],
  ["FAKE_CI_SITE",x=>{x.ci.verifiedGitHubUrl="https://evil.example/actions/runs/123456789";}],
  ["UNMERGED_DRAFTS",x=>{x.pullRequests.integrationReviewedAndMerged=false;}],
  ["FALSE_STAGING_ISOLATION",x=>{x.staging.approvedIsolatedInfrastructure=false;}],
  ["FAKE_STAGING_URL_REF",x=>{x.staging.readOnlyPreflightEvidenceRef="https://example.test?token=secret";}],
  ["TAMPERED_CSP",x=>{x.staging.readOnlyPreflight.checks[3].passed=false;}],
  ["DUPLICATE_STAGING_ASSERTION",x=>{
    x.staging.readOnlyPreflight.checks[3].id=x.staging.readOnlyPreflight.checks[2].id;
  }],
  ["OUTDATED_STAGING_RESULT",x=>{x.staging.readOnlyPreflight.checkedAtUtc="2026-09-30T00:00:00Z";}],
  ["STAGING_IN_FUTURE",x=>{x.staging.readOnlyPreflight.checkedAtUtc="2026-10-16T00:00:00Z";}],
  ["WAVED_MANUAL_TEST",x=>{x.manualChecks.M04.status="WAIVED";}],
  ["MISSING_MANUAL_EVIDENCE",x=>{x.manualChecks.M10.evidenceRef=null;}],
  ["FALSE_ALERT_DELIVERY",x=>{x.review.incidentAlertDeliveryAndAck.status="NOT_TESTED";}],
  ["HIGH_FINDING_OPEN",x=>{x.review.criticalHighFindings="HIGH_OPEN";}],
  ["MISSING_SECURITY_OWNER",x=>{x.review.securityOwnerSignoff.status="NOT_APPROVED";}],
  ["UNAPPROVED_OPERATIONS_OWNER",x=>{x.review.operationsOwnerSignoff.evidenceRef=null;}],
  ["S2_10_WRONG_STATUS",x=>{x.staging.readOnlyPreflight.productionGoApproved=true;}],
  ["S2_10_FALSE_MANUAL",x=>{x.staging.readOnlyPreflight.manualAcceptanceStatus="PASS";}],
];
for(const [name,mutate] of cases) {
  const altered=clone(nominal);mutate(altered);
  const decision=evaluateSecurityRelease(altered,{now:asOf});
  assert.equal(decision.decision,"HOLD",name+" must fail closed");
  assert(decision.blockers.length>0,name+" must supply a meaningful blocker");
  assert.equal(decision.productionGoApproved,false,name+" must never approve Production");
}
// A researcher can receive ethics approval only via separate institutional
// policy; this security script never grants it even if input claims APPROVED.
const ethics=clone(nominal);ethics.researchEthics.status="APPROVED";
assert.equal(evaluateSecurityRelease(ethics,{now:asOf}).researchEthicsApproved,false);
const sensitive=clone(nominal);sensitive.notes="token=SECRET-PASSWORD-USER-EMAIL";
assert.equal(JSON.stringify(evaluateSecurityRelease(sensitive,{now:asOf}))
  .includes("SECRET-PASSWORD-USER-EMAIL"),false);
console.log("ACTIVA-AI S2.12 fail-closed Security HOLD/Go-No-Go evidence regression: PASS");
