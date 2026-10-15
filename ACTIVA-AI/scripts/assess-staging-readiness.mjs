// S3.6: offline, fail-closed review of evidence *inventory* for ACTIVA-AI
// isolated Staging + external SIEM. Does not contact GitHub, Staging, SIEM,
// DNS, databases, or participants. Even a complete manifest is UNVERIFIED.
// Institutional Security/Operations must independently authenticate evidence.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {validateS210Target} from "./verify-staging-security.mjs";

const SHA=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const EVIDENCE=/^(?:OPS|SEC|STG|QA|SIEM|NET|DB|CI)-[A-Z0-9][A-Z0-9-]{3,79}$/;
const CHECK_IDS=Object.freeze([
  ...Array.from({length:13},(_,i)=>"M"+String(i+1).padStart(2,"0")),
  ...Array.from({length:12},(_,i)=>"S35-M"+String(i+1).padStart(2,"0")),
]);
const STAGING_REFS=Object.freeze([
  "operatorDeploymentEvidenceRef","isolationEvidenceRef","testSecretManagerEvidenceRef",
]);
const SIEM_REFS=Object.freeze([
  "independentReceiverEvidenceRef","dnsTlsEgressEvidenceRef",
  "signingKeyCustodyEvidenceRef","durableIngestionEvidenceRef",
  "idempotencyAndReceiptEvidenceRef","immutableRetentionEvidenceRef",
  "primaryResponderEvidenceRef","backupResponderEvidenceRef",
]);
const NETWORK_REFS=Object.freeze([
  "proxyIdentityEvidenceRef","edgeWafEvidenceRef","twoReplicaEvidenceRef",
  "sharedCampusLoadEvidenceRef","recoveryDrillEvidenceRef",
]);
const GOVERNANCE_REFS=Object.freeze([
  "reviewedDraftIntegrationEvidenceRef","securityOwnerReviewEvidenceRef",
  "operationsOwnerReviewEvidenceRef","privacyReviewEvidenceRef",
  "findingsClosureEvidenceRef",
]);
function obj(x){return Boolean(x)&&typeof x==="object"&&!Array.isArray(x);}
function exactKeys(x,keys){
  return obj(x)&&Object.keys(x).length===keys.length &&
    keys.every(k=>Object.prototype.hasOwnProperty.call(x,k));
}
function validSha(x){return typeof x==="string"&&SHA.test(x);}
function validRef(x){return typeof x==="string"&&EVIDENCE.test(x);}
function exactStagingOrigin(target,approved,frontend,sha){
  try{
    validateS210Target({
      apiUrl:target,approvedOrigin:approved,
      frontendOrigin:frontend,expectedSourceCommit:sha,
    });
    return true;
  }catch{return false;}
}
function safeSiemStagingOrigin(origin,approved,api,front){
  if(!origin||origin!==approved||origin===api||origin===front)return false;
  try{
    const u=new URL(origin),host=u.hostname.toLowerCase();
    return u.protocol==="https:" && u.origin===origin &&
      u.username===""&&u.password===""&&u.search===""&&u.hash==="" &&
      u.pathname==="/"&&!u.port&&host.includes(".") &&
      (host.includes("staging")||host.includes("stage")||host.includes("pilot")) &&
      !/production|(?:^|[.-])prod(?:[.-]|$)/.test(host) &&
      !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) &&
      !host.includes(":")&&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid|example|lan)$/.test(host);
  }catch{return false;}
}
const TOP_KEYS=["schemaVersion","purpose","sourceCommit","staging",
  "siem","network","governance","manualChecks",
  "productionGoApproved","researchEthicsApproved","note"];
const STAGING_KEYS=["apiOrigin","approvedApiOrigin","frontendOrigin",
  "deployedCommit",...STAGING_REFS,"testDatabaseFingerprintSha256",
  "productionDatabaseFingerprintSha256","syntheticDataOnly","productionGoDisabled"];
const SIEM_KEYS=["origin","approvedOrigin",...SIEM_REFS];
const NETWORK_KEYS=[...NETWORK_REFS];
const GOV_KEYS=[...GOVERNANCE_REFS];
function structureValid(d){
  return exactKeys(d,TOP_KEYS)&&
    exactKeys(d.staging,STAGING_KEYS)&&
    exactKeys(d.siem,SIEM_KEYS)&&
    exactKeys(d.network,NETWORK_KEYS)&&
    exactKeys(d.governance,GOV_KEYS)&&
    exactKeys(d.manualChecks,CHECK_IDS)&&
    CHECK_IDS.every(id=>exactKeys(d.manualChecks[id],["status","evidenceRef"])) &&
    d.schemaVersion===1&&
    d.purpose==="ACTIVA_AI_OPERATOR_STAGING_SECURITY_READINESS" &&
    d.productionGoApproved===false&&d.researchEthicsApproved===false&&
    typeof d.note==="string"&&d.note.length<=500;
}
export function evaluateStagingReadiness(input){
  const d=obj(input)?input:{};
  const result=[];
  const check=(id,flag,owner)=>result.push({
    id,declared:flag===true,owner,
  });
  const shape=structureValid(d);
  check("S36_MANIFEST_SHAPE_NO_EXTRA_FIELDS",shape,"SECURITY_OWNER");
  const source=validSha(d.sourceCommit);
  check("S36_EXACT_SOURCE_SHA",source,"RELEASE_MANAGER");
  const st=obj(d.staging)?d.staging:{};
  const si=obj(d.siem)?d.siem:{};
  const net=obj(d.network)?d.network:{};
  const gov=obj(d.governance)?d.governance:{};
  check("S36_OPERATOR_APPROVED_STAGING_ORIGINS",
    source&&exactStagingOrigin(st.apiOrigin,st.approvedApiOrigin,
      st.frontendOrigin,d.sourceCommit),"STAGING_OPERATOR");
  check("S36_STAGING_DEPLOYED_SHA_DECLARED",
    source&&st.deployedCommit===d.sourceCommit,"STAGING_OPERATOR");
  const sf=st.testDatabaseFingerprintSha256;
  const pf=st.productionDatabaseFingerprintSha256;
  check("S36_DATABASES_DECLARED_DISTINCT",
    typeof sf==="string"&&SHA256.test(sf)&&
    typeof pf==="string"&&SHA256.test(pf)&&sf!==pf,"DATABASE_ADMIN");
  check("S36_SYNTHETIC_TEST_DATA_ONLY",
    st.syntheticDataOnly===true,"DATA_PROTECTION_OWNER");
  check("S36_STAGING_PRODUCTION_GO_DISABLED",
    st.productionGoDisabled===true,"STAGING_OPERATOR");
  for(const key of STAGING_REFS){
    check("S36_STAGING_"+key.toUpperCase(),
      validRef(st[key]),"STAGING_OPERATOR");
  }
  check("S36_APPROVED_INDEPENDENT_SIEM_ORIGIN",
    safeSiemStagingOrigin(si.origin,si.approvedOrigin,st.apiOrigin,
      st.frontendOrigin),"SECURITY_OPERATIONS");
  for(const key of SIEM_REFS){
    check("S36_SIEM_"+key.toUpperCase(),
      validRef(si[key]),"SECURITY_OPERATIONS");
  }
  for(const key of NETWORK_REFS){
    check("S36_NETWORK_"+key.toUpperCase(),
      validRef(net[key]),"INFRASTRUCTURE_OPERATOR");
  }
  for(const key of GOVERNANCE_REFS){
    check("S36_GOV_"+key.toUpperCase(),
      validRef(gov[key]),"INDEPENDENT_REVIEWER");
  }
  const manual=obj(d.manualChecks)?d.manualChecks:{};
  for(const id of CHECK_IDS){
    const record=obj(manual[id])?manual[id]:{};
    check("S36_MANUAL_"+id.replace("-","_"),
      record.status==="EVIDENCE_RECORDED" && validRef(record.evidenceRef),
      id==="M12"||id==="S35-M12"?"INDEPENDENT_SECURITY_REVIEWER":
        id==="S35-M10"?"ON_CALL_SECURITY":"STAGING_TESTER");
  }
  const missing=result.filter(x=>!x.declared);
  return {
    schemaVersion:1,
    reportType:"ACTIVA_AI_S36_STAGING_EVIDENCE_INVENTORY",
    decision:"HOLD",
    evidenceInventoryComplete:missing.length===0,
    collectionState:missing.length===0?
      "READY_FOR_INDEPENDENT_PROVENANCE_REVIEW":
      "MISSING_DECLARED_EVIDENCE",
    claimsVerified:false,
    evidenceProvenanceVerified:false,
    stagingDeployedAndVerified:false,
    siemReceiverVerified:false,
    operatorSignaturesVerified:false,
    manualAcceptanceVerified:false,
    productionGoApproved:false,
    mergeApproved:false,
    deploymentApproved:false,
    researchEthicsApproved:false,
    collectedChecks:result.length-missing.length,
    totalChecks:result.length,
    blockers:missing.map(x=>({code:x.id,owner:x.owner})),
    nextAction:missing.length===0?
      "INDEPENDENT_SECURITY_AND_OPERATIONS_EVIDENCE_VERIFICATION_REQUIRED":
      "COLLECT_REAL_STAGING_AND_SIEM_INFRASTRUCTURE_EVIDENCE",
  };
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=="--input"||
     typeof args[1]!=="string"||!args[1].endsWith(".json")){
    process.exitCode=2;
    console.error(JSON.stringify({decision:"HOLD",code:"S36_INVALID_INPUT_ARGUMENTS"}));
    return;
  }
  try{
    const data=await readFile(resolve(args[1]),"utf8");
    if(data.length>100000)throw Error("S36_TOO_LARGE");
    const report=evaluateStagingReadiness(JSON.parse(data));
    console.log(JSON.stringify(report,null,2));
  }catch{
    console.error(JSON.stringify({decision:"HOLD",code:"S36_INVALID_MANIFEST",
      productionGoApproved:false,manualAcceptanceVerified:false}));
    process.exitCode=2;
  }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  await main();
}
