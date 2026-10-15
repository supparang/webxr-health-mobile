// ACTIVA-AI S3.10 — offline inventory of source-governance and artifact
// attestation evidence. NEVER converts self-reported fields into approval.
// No network, live GitHub API, SIEM, staging, secrets or participant data.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const IMAGE=/^sha256:[a-f0-9]{64}$/;
const REF=/^(?:SEC|OPS|GOV|CI|STG|SIEM|PRIV|NET|QA|REL)-[A-Z0-9][A-Z0-9-]{3,79}$/;
const CODEOWNERS=new Set([".github/CODEOWNERS","CODEOWNERS","docs/CODEOWNERS"]);
const TOP=["schemaVersion","purpose","sourceCommit","repository","artifact",
  "staging","approvals","productionGoApproved","researchEthicsApproved","note"];
const REPOSITORY=["name","defaultBranch","codeownersPath",
  "codeownersEvidenceRef","rulesetExportSha256","rulesetEvidenceRef",
  "mainProtected","releaseBranchesProtected","protectCodeownersChanges",
  "minRequiredApprovals","requireCodeOwnerReviews","dismissStaleReviews",
  "blockForcePush","blockDirectPush","noAdminBypass","requiredStatusChecks",
  "reviewerIndependenceEvidenceRef"];
const ARTIFACT=["sourceCommit","imageDigest","buildAttestationEvidenceRef",
  "builderIdentityEvidenceRef","immutableRegistryEvidenceRef"];
const STAGING=["deployedSourceCommit","deployedImageDigest",
  "deploymentEvidenceRef","isolationEvidenceRef","s36EvidenceInventorySha256",
  "s36IndependentReviewEvidenceRef","all25ManualCasesVerified",
  "externalSiemHumanAckEvidenceRef"];
const APPROVALS=["securityReviewerEvidenceRef","operationsReviewerEvidenceRef",
  "privacyReviewerEvidenceRef","independentFindingsClosureEvidenceRef",
  "signerCustodyEvidenceRef","allCriticalHighFindingsClosed"];
function object(v){return Boolean(v)&&typeof v==="object"&&!Array.isArray(v);}
function exact(v,keys){return object(v)&&Object.keys(v).length===keys.length&&
  keys.every(key=>Object.hasOwn(v,key));}
function ref(v){return typeof v==="string"&&REF.test(v);}
function sha(v){return typeof v==="string"&&SHA40.test(v);}
function image(v){return typeof v==="string"&&IMAGE.test(v);}
function digest(v){return typeof v==="string"&&SHA256.test(v);}
function allRefs(v,keys){return keys.every(k=>ref(v[k]));}

export function assessReleaseGovernance(raw){
  const data=object(raw)?raw:{};
  const repository=object(data.repository)?data.repository:{};
  const artifact=object(data.artifact)?data.artifact:{};
  const staging=object(data.staging)?data.staging:{};
  const approvals=object(data.approvals)?data.approvals:{};
  const checks=[];
  const check=(code,condition,owner)=>checks.push({code,declared:condition===true,owner});
  check("S310_STRICT_SCHEMA",
    exact(data,TOP)&&exact(repository,REPOSITORY)&&
    exact(artifact,ARTIFACT)&&exact(staging,STAGING)&&
    exact(approvals,APPROVALS)&&
    data.schemaVersion===1&&
    data.purpose==="ACTIVA_AI_S310_INSTITUTIONAL_RELEASE_GOVERNANCE"&&
    data.productionGoApproved===false&&data.researchEthicsApproved===false&&
    typeof data.note==="string"&&data.note.length<=500,
    "SECURITY_REVIEWER");
  check("S310_SOURCE_COMMIT",sha(data.sourceCommit),"RELEASE_OPERATOR");
  check("S310_REPOSITORY_SCOPE",
    repository.name==="supparang/webxr-health-mobile"&&
    repository.defaultBranch==="main","REPOSITORY_OWNER");
  check("S310_CODEOWNERS_EXISTS_AND_INDEPENDENTLY_REVIEWED",
    CODEOWNERS.has(repository.codeownersPath)&&ref(repository.codeownersEvidenceRef),
    "REPOSITORY_OWNER");
  check("S310_RULESET_EXPORT_DIGEST_AND_CUSTODY",
    digest(repository.rulesetExportSha256)&&ref(repository.rulesetEvidenceRef),
    "REPOSITORY_ADMIN");
  check("S310_PROTECTED_MAIN_RELEASE_AND_CODEOWNERS",
    repository.mainProtected===true&&repository.releaseBranchesProtected===true&&
    repository.protectCodeownersChanges===true,"REPOSITORY_ADMIN");
  check("S310_REQUIRED_INDEPENDENT_APPROVALS",
    Number.isInteger(repository.minRequiredApprovals)&&
    repository.minRequiredApprovals>=2&&repository.minRequiredApprovals<=20&&
    repository.requireCodeOwnerReviews===true&&
    repository.dismissStaleReviews===true&&
    ref(repository.reviewerIndependenceEvidenceRef),"INDEPENDENT_SECURITY");
  check("S310_BLOCK_DIRECT_FORCE_BYPASS",
    repository.blockForcePush===true&&repository.blockDirectPush===true&&
    repository.noAdminBypass===true,"REPOSITORY_ADMIN");
  check("S310_MANDATORY_STATUS_CHECKS",
    repository.requiredStatusChecks===true,"REPOSITORY_ADMIN");
  check("S310_BUILD_SOURCE_EQUALS_RELEASE",
    sha(data.sourceCommit)&&artifact.sourceCommit===data.sourceCommit,
    "BUILD_OPERATOR");
  check("S310_IMMUTABLE_IMAGE_DIGEST",
    image(artifact.imageDigest)&&allRefs(artifact,[
      "buildAttestationEvidenceRef","builderIdentityEvidenceRef",
      "immutableRegistryEvidenceRef",
    ]),"BUILD_OPERATOR");
  check("S310_STAGING_SAME_EXACT_COMMIT_AND_IMAGE",
    sha(data.sourceCommit)&&artifact.sourceCommit===data.sourceCommit&&
    staging.deployedSourceCommit===data.sourceCommit&&
    image(artifact.imageDigest)&&staging.deployedImageDigest===artifact.imageDigest&&
    ref(staging.deploymentEvidenceRef)&&ref(staging.isolationEvidenceRef),
    "STAGING_OPERATOR");
  check("S310_S36_EVIDENCE_INDEPENDENTLY_DECLARED",
    digest(staging.s36EvidenceInventorySha256)&&
    ref(staging.s36IndependentReviewEvidenceRef),"INDEPENDENT_SECURITY");
  check("S310_STAGING_25_MANUAL_AND_EXTERNAL_SIEM",
    staging.all25ManualCasesVerified===true&&
    ref(staging.externalSiemHumanAckEvidenceRef),"STAGING_SECURITY");
  check("S310_INDEPENDENT_SECURITY_OPERATIONS_PRIVACY_EVIDENCE",
    allRefs(approvals,[
      "securityReviewerEvidenceRef","operationsReviewerEvidenceRef",
      "privacyReviewerEvidenceRef","independentFindingsClosureEvidenceRef",
      "signerCustodyEvidenceRef",
    ]),"INDEPENDENT_REVIEWER");
  check("S310_CRITICAL_HIGH_FINDINGS_CLOSED",
    approvals.allCriticalHighFindingsClosed===true,"INDEPENDENT_SECURITY");
  const missing=checks.filter(c=>!c.declared);
  return {
    schemaVersion:1,
    reportType:"ACTIVA_AI_S310_GOVERNANCE_AND_STAGING_ARTIFACT_INVENTORY",
    decision:"HOLD",
    collectionState:missing.length===0?
      "READY_FOR_INDEPENDENT_PROVENANCE_REVIEW":"MISSING_DECLARED_EVIDENCE",
    evidenceInventoryComplete:missing.length===0,
    independentlyVerified:false,
    gitHubRulesetVerified:false,
    reviewerIndependenceVerified:false,
    sourceToArtifactProvenanceVerified:false,
    stagingDeploymentVerified:false,
    manualAcceptanceVerified:false,
    productionGoApproved:false,mergeApproved:false,deploymentApproved:false,
    researchEthicsApproved:false,
    checksDeclared:checks.length-missing.length,totalChecks:checks.length,
    blockers:missing.map(c=>({code:c.code,owner:c.owner})),
    nextAction:missing.length?
      "COLLECT_INSTITUTION_OWNED_GOVERNANCE_ARTIFACT_STAGING_EVIDENCE":
      "INDEPENDENTLY_AUTHENTICATE_EACH_RESTRICTED_RECORD",
  };
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=="--input"||
     typeof args[1]!=="string"||!args[1].endsWith(".json")){
    console.error(JSON.stringify({decision:"HOLD",code:"S310_INVALID_ARGUMENTS"}));
    process.exitCode=2;return;
  }
  try{
    const content=await readFile(resolve(args[1]),"utf8");
    if(content.length>80000)throw Error("S310_INPUT_TOO_LARGE");
    console.log(JSON.stringify(assessReleaseGovernance(JSON.parse(content)),null,2));
  }catch{
    console.error(JSON.stringify({decision:"HOLD",code:"S310_INVALID_INPUT",
      productionGoApproved:false,mergeApproved:false,deploymentApproved:false}));
    process.exitCode=2;
  }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  await main();
}
