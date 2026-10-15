// ACTIVA-AI S2.12 — conservative Security Go/No-Go evidence assessor.
// Local JSON evidence only. This code NEVER contacts Production, changes CI,
// merges a PR, approves deployment or grants research-ethics permission.
// It can return READY_FOR_HUMAN_DECISION but NEVER "GO" or Production approved.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const requiredManual=Object.freeze(
  Array.from({length:13},(_,i)=>"M"+String(i+1).padStart(2,"0"))
);
const requiredPRs=Object.freeze(
  Array.from({length:11},(_,i)=>136+i)
);
const supportedReviewTracks=Object.freeze([
  "independentSecurityAssessment",
  "privacyAndPersonnelDirectory",
  "providerProxyAndLoad",
  "incidentAlertDeliveryAndAck",
]);
const REVIEW_REF=/^(?:SEC|OPS|STG|QA|PR|CI)-[A-Z0-9][A-Z0-9-]{2,79}$/;
const FULL_SHA=/^[0-9a-f]{40}$/i;
const allowedResearchStatus=new Set([
  "NOT_SUBMITTED","SUBMITTED","APPROVED","REJECTED","UNKNOWN",
]);

function safeRef(value) {
  // Only opaque institutional evidence ticket identifiers, never PII, URLs,
  // file paths, passwords, QR tokens, email addresses or IP addresses.
  return typeof value==="string" && REVIEW_REF.test(value);
}
function object(value) {
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function saneRun(e) {
  if(!object(e) || e.status!=="PASS" || !FULL_SHA.test(e.testedCommit||""))return false;
  const id=String(e.runId||"");
  return /^\d{6,20}$/.test(id) &&
    e.verifiedGitHubUrl===
    "https://github.com/supparang/webxr-health-mobile/actions/runs/"+id;
}

export function evaluateSecurityRelease(input,{now=new Date()}={}) {
  const e=object(input)?input:{};
  const checks=[];
  const check=(id,passed,owner)=>{
    checks.push({id,status:passed===true?"PASS":"HOLD",owner});
  };
  const candidate=String(e.releaseCandidateCommit||"");
  const candidateValid=FULL_SHA.test(candidate);
  const ci=e.ci||{};
  const staging=e.staging||{};
  const prs=e.pullRequests||{};
  const manual=e.manualChecks||{};
  const review=e.review||{};
  const preflight=staging.readOnlyPreflight;
  const reportDate=now instanceof Date?now:new Date(now);
  const reportTime=Number.isFinite(reportDate.getTime())?
    reportDate:new Date("1970-01-01T00:00:00.000Z");

  check("RELEASE_CANDIDATE_DECLARED",candidateValid,"RELEASE_MANAGER");
  check("CI_SAME_COMMIT_VERIFIED",
    candidateValid && saneRun(ci) && candidate.toLowerCase()===ci.testedCommit.toLowerCase(),
    "CI_OWNER");
  check("PR_SET_COMPLETE",
    Array.isArray(prs.required) && prs.required.length===requiredPRs.length &&
      requiredPRs.every(n=>prs.required.includes(n)),
    "REPOSITORY_OWNER");
  check("PRS_REVIEWED_AND_MERGED",
    prs.integrationReviewedAndMerged===true &&
    safeRef(prs.mergeEvidenceRef),
    "REPOSITORY_OWNER");
  check("STAGING_DEDICATED_AND_ISOLATED",
    staging.deploymentStatus==="VERIFIED" &&
      staging.approvedIsolatedInfrastructure===true &&
      safeRef(staging.independentIsolationEvidenceRef),
    "STAGING_OPERATOR");
  check("STAGING_DEPLOYED_COMMIT_MATCH",
    candidateValid && FULL_SHA.test(staging.deployedCommit||"") &&
      staging.deployedCommit.toLowerCase()===candidate.toLowerCase(),
    "STAGING_OPERATOR");
  const checksPresent=object(preflight) && Array.isArray(preflight.checks) &&
    preflight.checks.length>=25 && preflight.checks.every(item=>
      object(item) && typeof item.id==="string" &&
      /^[A-Z0-9_]{3,80}$/.test(item.id) && item.passed===true
    ) && new Set(preflight.checks.map(x=>x.id)).size===preflight.checks.length;
  const issuedAt=preflight?Date.parse(preflight.checkedAtUtc):NaN;
  const preflightAge=reportTime.getTime()-issuedAt;
  const fresh=Number.isFinite(issuedAt) && preflightAge>=0 &&
    preflightAge<=7*24*60*60*1000;
  check("STAGING_READ_ONLY_PREFLIGHT_VERIFIED",
    checksPresent && preflight.type==="ACTIVA_S210_READ_ONLY_STAGING_PREFLIGHT" &&
    preflight.automatedChecksPassed===true &&
    preflight.productionGoApproved===false &&
    preflight.manualAcceptanceStatus==="NOT_TESTED" &&
    candidateValid &&
    String(preflight.expectedSourceCommit||"").toLowerCase()===candidate.toLowerCase() &&
    fresh &&
    safeRef(staging.readOnlyPreflightEvidenceRef),
    "STAGING_OPERATOR");
  // NOTE: evidence references and attached reports are *declarations*, NOT
  // signed or GitHub API-verified evidence. Human reviewers must verify both.
  for(const id of requiredManual) {
    const entry=manual[id]||{};
    check("MANUAL_"+id,entry.status==="PASS" && safeRef(entry.evidenceRef),
      id==="M12"?"INDEPENDENT_SECURITY_REVIEWER":"STAGING_TESTER");
  }
  for(const id of supportedReviewTracks) {
    const entry=review[id]||{};
    check("REVIEW_"+id.toUpperCase(),
      entry.status==="PASS" && safeRef(entry.evidenceRef),
      id==="privacyAndPersonnelDirectory"?"DATA_PROTECTION_REVIEWER":"SECURITY_REVIEWER");
  }
  check("NO_UNRESOLVED_CRITICAL_HIGH_FINDINGS",
    review.criticalHighFindings==="NONE_OPEN" &&
      safeRef(review.findingsRegisterEvidenceRef),
    "INDEPENDENT_SECURITY_REVIEWER");
  for(const role of ["securityOwnerSignoff","operationsOwnerSignoff"]) {
    const entry=review[role]||{};
    check("SIGNOFF_"+role.toUpperCase(),entry.status==="APPROVED" &&
      safeRef(entry.evidenceRef),"INSTITUTIONAL_AUTHORITY");
  }

  const ready=checks.every(x=>x.status==="PASS");
  const researchStatus=allowedResearchStatus.has(e.researchEthics?.status)?
    e.researchEthics.status:"UNKNOWN";
  return {
    schemaVersion:1,
    reportType:"ACTIVA_AI_SOFTWARE_SECURITY_EVIDENCE_GATE",
    evaluatedAtUtc:reportTime.toISOString(),
    decision:ready?"READY_FOR_HUMAN_DECISION":"HOLD",
    productionGoApproved:false,
    mergeApproved:false,
    deploymentApproved:false,
    researchEthicsApproved:false,
    researchEthicsStatus:researchStatus,
    electronicSignaturesVerified:false,
    evidenceProvenanceVerified:false,
    // Tests and operations are evaluated separately from research ethics.
    track:"SOFTWARE_PRODUCTION_SECURITY_ONLY",
    passedChecks:checks.filter(x=>x.status==="PASS").length,
    totalChecks:checks.length,
    blockers:checks.filter(x=>x.status!=="PASS").map(x=>({code:x.id,owner:x.owner})),
    manualDeviceAcceptanceComplete:requiredManual.every(id=>
      checks.some(x=>x.id==="MANUAL_"+id&&x.status==="PASS")),
    nextAction:ready?
      "REQUEST_INDEPENDENT_HUMAN_GO_NO_GO_MEETING_WITH_VERIFIED_EVIDENCE":
      "COLLECT_MISSING_STAGING_MANUAL_AND_GOVERNANCE_EVIDENCE",
  };
}

async function main() {
  const args=process.argv.slice(2);
  if(args.length>2 || args.length===0 || args[0]!=="--input" ||
     typeof args[1]!=="string" || !args[1].endsWith(".json")) {
    console.error("S212_USAGE: node scripts/assess-production-security.mjs --input <local-json>");
    process.exitCode=2;
    return;
  }
  try {
    const source=resolve(args[1]);
    const raw=await readFile(source,"utf8");
    if(raw.length>150000)throw Error("S212_INPUT_TOO_LARGE");
    const result=evaluateSecurityRelease(JSON.parse(raw));
    console.log(JSON.stringify(result,null,2));
    // A valid HOLD result is a successful evaluation, NOT an approved release.
    // CI should remain green while evidence appropriately states NO-GO/HOLD.
  }catch {
    console.error(JSON.stringify({
      reportType:"ACTIVA_AI_SOFTWARE_SECURITY_EVIDENCE_GATE",
      decision:"HOLD",productionGoApproved:false,
      reason:"S212_INVALID_OR_MISSING_EVIDENCE_INPUT",
    }));
    process.exitCode=2;
  }
}
if(process.argv[1] && import.meta.url===fileURLToPath(import.meta.url) &&
   process.argv[1]===fileURLToPath(import.meta.url)){
  await main();
}
