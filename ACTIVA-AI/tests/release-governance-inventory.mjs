// Local-only S3.10 contract tests. Synthetic inputs are NOT real approval.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assessReleaseGovernance} from "../scripts/assess-release-governance.mjs";

const template=JSON.parse(await readFile(
  new URL("../security/s3.10-institutional-release.template.json",import.meta.url),"utf8"
));
const baseline=assessReleaseGovernance(template);
assert.equal(baseline.decision,"HOLD");
assert.equal(baseline.evidenceInventoryComplete,false);
assert.equal(baseline.productionGoApproved,false);
assert.equal(baseline.mergeApproved,false);
assert.equal(baseline.deploymentApproved,false);
assert.equal(baseline.researchEthicsApproved,false);
assert.equal(baseline.independentlyVerified,false);
assert(!baseline.blockers.some(b=>b.code==="S310_STRICT_SCHEMA"),
  "Checked-in default must be an exact valid HOLD schema");

const full=structuredClone(template),sha="a".repeat(40);
const ref="SEC-S310-SYNTHETIC-UNVERIFIED";
const digest="b".repeat(64),image="sha256:"+"c".repeat(64);
full.sourceCommit=sha;
Object.assign(full.repository,{
  codeownersPath:".github/CODEOWNERS",codeownersEvidenceRef:ref,
  rulesetExportSha256:digest,rulesetEvidenceRef:ref,
  mainProtected:true,releaseBranchesProtected:true,
  protectCodeownersChanges:true,minRequiredApprovals:2,
  requireCodeOwnerReviews:true,dismissStaleReviews:true,
  blockForcePush:true,blockDirectPush:true,noAdminBypass:true,
  requiredStatusChecks:true,reviewerIndependenceEvidenceRef:ref,
});
Object.assign(full.artifact,{
  sourceCommit:sha,imageDigest:image,
  buildAttestationEvidenceRef:ref,builderIdentityEvidenceRef:ref,
  immutableRegistryEvidenceRef:ref,
});
Object.assign(full.staging,{
  deployedSourceCommit:sha,deployedImageDigest:image,
  deploymentEvidenceRef:ref,isolationEvidenceRef:ref,
  s36EvidenceInventorySha256:"d".repeat(64),
  s36IndependentReviewEvidenceRef:ref,
  all25ManualCasesVerified:true,externalSiemHumanAckEvidenceRef:ref,
});
Object.assign(full.approvals,{
  securityReviewerEvidenceRef:ref,operationsReviewerEvidenceRef:ref,
  privacyReviewerEvidenceRef:ref,independentFindingsClosureEvidenceRef:ref,
  signerCustodyEvidenceRef:ref,allCriticalHighFindingsClosed:true,
});
function hold(data){
  const result=assessReleaseGovernance(data);
  assert.equal(result.decision,"HOLD");
  for(const key of ["productionGoApproved","mergeApproved",
    "deploymentApproved","researchEthicsApproved","independentlyVerified",
    "gitHubRulesetVerified","reviewerIndependenceVerified",
    "sourceToArtifactProvenanceVerified","stagingDeploymentVerified",
    "manualAcceptanceVerified"]){
    assert.equal(result[key],false,key);
  }
  assert(!JSON.stringify(result).includes(ref),
    "Never echo restricted record identifiers");
  assert(!JSON.stringify(result).includes(image),
    "Never echo private Staging build artifact identity");
  return result;
}
const allDeclared=hold(full);
assert.equal(allDeclared.evidenceInventoryComplete,true);
assert.equal(allDeclared.collectionState,
  "READY_FOR_INDEPENDENT_PROVENANCE_REVIEW");
assert.equal(allDeclared.blockers.length,0);

function reject(change,expected){
  const changed=structuredClone(full);change(changed);
  const actual=hold(changed);
  assert.equal(actual.evidenceInventoryComplete,false,expected);
  assert(actual.blockers.some(x=>x.code===expected),
    "Failed to block "+expected);
}
reject(x=>{x.sourceCommit=null;},"S310_SOURCE_COMMIT");
reject(x=>{x.repository.name="other/repository";},"S310_REPOSITORY_SCOPE");
reject(x=>{x.repository.codeownersPath=null;},"S310_CODEOWNERS_EXISTS_AND_INDEPENDENTLY_REVIEWED");
reject(x=>{x.repository.rulesetExportSha256=null;},"S310_RULESET_EXPORT_DIGEST_AND_CUSTODY");
reject(x=>{x.repository.mainProtected=false;},"S310_PROTECTED_MAIN_RELEASE_AND_CODEOWNERS");
reject(x=>{x.repository.releaseBranchesProtected=false;},"S310_PROTECTED_MAIN_RELEASE_AND_CODEOWNERS");
reject(x=>{x.repository.minRequiredApprovals=1;},"S310_REQUIRED_INDEPENDENT_APPROVALS");
reject(x=>{x.repository.dismissStaleReviews=false;},"S310_REQUIRED_INDEPENDENT_APPROVALS");
reject(x=>{x.repository.noAdminBypass=false;},"S310_BLOCK_DIRECT_FORCE_BYPASS");
reject(x=>{x.repository.requiredStatusChecks=false;},"S310_MANDATORY_STATUS_CHECKS");
reject(x=>{x.artifact.sourceCommit="f".repeat(40);},"S310_BUILD_SOURCE_EQUALS_RELEASE");
reject(x=>{x.artifact.imageDigest="sha256:unsafe";},"S310_IMMUTABLE_IMAGE_DIGEST");
reject(x=>{x.staging.deployedSourceCommit="f".repeat(40);},
  "S310_STAGING_SAME_EXACT_COMMIT_AND_IMAGE");
reject(x=>{x.staging.deployedImageDigest="sha256:"+"e".repeat(64);},
  "S310_STAGING_SAME_EXACT_COMMIT_AND_IMAGE");
reject(x=>{x.staging.s36IndependentReviewEvidenceRef=null;},
  "S310_S36_EVIDENCE_INDEPENDENTLY_DECLARED");
reject(x=>{x.staging.all25ManualCasesVerified=false;},
  "S310_STAGING_25_MANUAL_AND_EXTERNAL_SIEM");
reject(x=>{x.staging.externalSiemHumanAckEvidenceRef=null;},
  "S310_STAGING_25_MANUAL_AND_EXTERNAL_SIEM");
reject(x=>{x.approvals.signerCustodyEvidenceRef=null;},
  "S310_INDEPENDENT_SECURITY_OPERATIONS_PRIVACY_EVIDENCE");
reject(x=>{x.approvals.allCriticalHighFindingsClosed=false;},
  "S310_CRITICAL_HIGH_FINDINGS_CLOSED");
reject(x=>{x.productionGoApproved=true;},"S310_STRICT_SCHEMA");
reject(x=>{x.researchEthicsApproved=true;},"S310_STRICT_SCHEMA");
reject(x=>{x.unexpectedRawSecret="private-value";},"S310_STRICT_SCHEMA");
assert.equal(hold(null).evidenceInventoryComplete,false);
console.log("ACTIVA-AI S3.10 institutional governance & artifact declared-evidence contract: PASS (real verification remains HOLD)");
