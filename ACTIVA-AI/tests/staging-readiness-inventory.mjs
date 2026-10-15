// S3.6 offline safety contract. All "complete" evidence is synthetic,
// intentionally never authorizes use of institutional Staging or Production.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluateStagingReadiness} from "../scripts/assess-staging-readiness.mjs";

const path=new URL("../security/s3.6-staging-readiness.template.json",import.meta.url);
const template=JSON.parse(await readFile(path,"utf8"));
const ids=[
  ...Array.from({length:13},(_,i)=>"M"+String(i+1).padStart(2,"0")),
  ...Array.from({length:12},(_,i)=>"S35-M"+String(i+1).padStart(2,"0")),
];
const baseline=evaluateStagingReadiness(template);
assert.equal(baseline.decision,"HOLD");
assert.equal(baseline.evidenceInventoryComplete,false);
assert.equal(baseline.manualAcceptanceVerified,false);
assert.equal(baseline.productionGoApproved,false);
assert.equal(baseline.deploymentApproved,false);
assert.equal(baseline.researchEthicsApproved,false);
assert.equal(baseline.evidenceProvenanceVerified,false);
assert(ids.every(id=>baseline.blockers.some(x=>
  x.code==="S36_MANUAL_"+id.replace("-","_"))));
assert(!baseline.blockers.some(x=>x.code==="S36_MANIFEST_SHAPE_NO_EXTRA_FIELDS"),
  "Template must have exact allowed schema keys");

const data=structuredClone(template);
const sha="a".repeat(40);
const ticket="SEC-CI-SYNTHETIC-PLACEHOLDER";
data.sourceCommit=sha;
Object.assign(data.staging,{
  apiOrigin:"https://api-staging.chandra.ac.th",
  approvedApiOrigin:"https://api-staging.chandra.ac.th",
  frontendOrigin:"https://web-staging.chandra.ac.th",
  deployedCommit:sha,
  testDatabaseFingerprintSha256:"b".repeat(64),
  productionDatabaseFingerprintSha256:"c".repeat(64),
  syntheticDataOnly:true,productionGoDisabled:true,
});
Object.assign(data.siem,{
  origin:"https://siem-staging.chandra.ac.th",
  approvedOrigin:"https://siem-staging.chandra.ac.th",
});
for(const section of ["staging","siem","network","governance"]){
  for(const key of Object.keys(data[section])){
    if(key.endsWith("EvidenceRef") ||
       key.endsWith("ReviewEvidenceRef")){
      data[section][key]=ticket;
    }
  }
}
for(const id of ids){
  data.manualChecks[id]={
    status:"EVIDENCE_RECORDED",evidenceRef:"QA-CI-SYNTHETIC-PLACEHOLDER",
  };
}
function checkHold(value,reason){
  const report=evaluateStagingReadiness(value);
  assert.equal(report.decision,"HOLD",reason);
  assert.equal(report.productionGoApproved,false,reason);
  assert.equal(report.mergeApproved,false,reason);
  assert.equal(report.deploymentApproved,false,reason);
  assert.equal(report.researchEthicsApproved,false,reason);
  assert.equal(report.claimsVerified,false,reason);
  assert.equal(report.evidenceProvenanceVerified,false,reason);
  assert.equal(report.manualAcceptanceVerified,false,reason);
  assert(!JSON.stringify(report).includes("QA-CI-SYNTHETIC"),
    "No operator refs, raw source URL or secret values in report");
  return report;
}
const complete=checkHold(data,"Even all synthetic declarations cannot grant GO");
assert.equal(complete.evidenceInventoryComplete,true,
  "Synthetic fixture needs all required field references for contract tests");
assert.equal(complete.collectionState,"READY_FOR_INDEPENDENT_PROVENANCE_REVIEW");
assert.equal(complete.blockers.length,0);

function rejected(change,blocker){
  const o=structuredClone(data);
  change(o);
  const r=checkHold(o,blocker);
  assert.equal(r.evidenceInventoryComplete,false,blocker);
  assert(r.blockers.some(x=>x.code===blocker),
    "Expected fail-closed blocker "+blocker);
}
rejected(d=>{d.sourceCommit="invalid";},"S36_EXACT_SOURCE_SHA");
rejected(d=>{d.staging.deployedCommit="f".repeat(40);},
  "S36_STAGING_DEPLOYED_SHA_DECLARED");
rejected(d=>{d.staging.apiOrigin="https://activa-ai-production-api.onrender.com";},
  "S36_OPERATOR_APPROVED_STAGING_ORIGINS");
rejected(d=>{d.staging.approvedApiOrigin="https://other-staging.chandra.ac.th";},
  "S36_OPERATOR_APPROVED_STAGING_ORIGINS");
rejected(d=>{d.staging.apiOrigin="http://api-staging.chandra.ac.th";
  d.staging.approvedApiOrigin="http://api-staging.chandra.ac.th";},
  "S36_OPERATOR_APPROVED_STAGING_ORIGINS");
rejected(d=>{d.staging.testDatabaseFingerprintSha256=
  d.staging.productionDatabaseFingerprintSha256;},
  "S36_DATABASES_DECLARED_DISTINCT");
rejected(d=>{d.staging.syntheticDataOnly=false;},
  "S36_SYNTHETIC_TEST_DATA_ONLY");
rejected(d=>{d.staging.productionGoDisabled=false;},
  "S36_STAGING_PRODUCTION_GO_DISABLED");
rejected(d=>{d.siem.origin=d.staging.apiOrigin;
  d.siem.approvedOrigin=d.staging.apiOrigin;},
  "S36_APPROVED_INDEPENDENT_SIEM_ORIGIN");
rejected(d=>{d.siem.origin="https://siem-production.chandra.ac.th";
  d.siem.approvedOrigin=d.siem.origin;},
  "S36_APPROVED_INDEPENDENT_SIEM_ORIGIN");
rejected(d=>{d.siem.signingKeyCustodyEvidenceRef=null;},
  "S36_SIEM_SIGNINGKEYCUSTODYEVIDENCEREF");
rejected(d=>{d.network.edgeWafEvidenceRef="https://unsafe.example?token=key";},
  "S36_NETWORK_EDGEWAFEVIDENCEREF");
rejected(d=>{d.governance.privacyReviewEvidenceRef="name@chandra.ac.th";},
  "S36_GOV_PRIVACYREVIEWEVIDENCEREF");
rejected(d=>{d.manualChecks["S35-M10"].status="PASS";},
  "S36_MANUAL_S35_M10");
rejected(d=>{d.manualChecks.M01.evidenceRef=null;},
  "S36_MANUAL_M01");
rejected(d=>{d.extraDangerousKey="TOKEN_FORGED";},
  "S36_MANIFEST_SHAPE_NO_EXTRA_FIELDS");
rejected(d=>{d.productionGoApproved=true;},
  "S36_MANIFEST_SHAPE_NO_EXTRA_FIELDS");
rejected(d=>{d.researchEthicsApproved=true;},
  "S36_MANIFEST_SHAPE_NO_EXTRA_FIELDS");

const invalid=checkHold(null,"Invalid input must not authorize anything");
assert.equal(invalid.evidenceInventoryComplete,false);
console.log("ACTIVA-AI S3.6 offline isolated Staging/SIEM 25-case readiness evidence inventory: PASS (PRODUCTION HOLD)");
