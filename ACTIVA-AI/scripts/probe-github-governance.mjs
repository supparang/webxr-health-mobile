// ACTIVA-AI S3.11. Authorized, strictly read-only GitHub governance probe.
// NEVER grants Production release or institutional reviewer approval.
// Real network requests require operator confirmation + read-only GitHub token.
// CI exercises this with a fully mocked fetch, NEVER a live token or network.
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {auditEffectiveMainRulesets} from "./github-effective-ruleset.mjs";
const REPO="supparang/webxr-health-mobile";
const BASE="https://api.github.com/repos/"+REPO;
const SHA=/^[a-f0-9]{40}$/;
const PATHS=[
  "/contents/.github/CODEOWNERS?ref=main",
  "/contents/docs/CODEOWNERS?ref=main",
  "/contents/CODEOWNERS?ref=main",
];
const PATH_LABELS=[".github/CODEOWNERS","docs/CODEOWNERS","CODEOWNERS"];
const MAX_BYTES=256000;
const ERROR_STATUS=new Set([401,403,404,408,429]);

function safeError(error){
  // No exception message is printed: it can contain a token, URL or response.
  return error?.code==="S311_RESPONSE_TOO_LARGE"?
    "RESPONSE_TOO_LARGE":"READ_ONLY_REQUEST_FAILED";
}
function cleanStatus(x){
  return Number.isInteger(x)&&x>=100&&x<=599?x:0;
}
async function getJSON(fetchImpl,token,path){
  const url=BASE+path;
  // The caller cannot supply URL, host, repository or headers.
  const response=await fetchImpl(url,{
    method:"GET",
    headers:{
      Authorization:"Bearer "+token,
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
    },
    redirect:"error",
    signal:AbortSignal.timeout(10000),
    credentials:"omit",
  });
  const status=cleanStatus(response?.status);
  if(status!==200)return {status,value:null};
  const headerSize=Number(response?.headers?.get?.("content-length")||0);
  if(headerSize>MAX_BYTES){
    const err=new Error("Too large");err.code="S311_RESPONSE_TOO_LARGE";throw err;
  }
  const raw=await response.text();
  if(raw.length>MAX_BYTES){
    const err=new Error("Too large");err.code="S311_RESPONSE_TOO_LARGE";throw err;
  }
  return {status,value:JSON.parse(raw)};
}
function present(x){return x!==null&&typeof x==="object"&&!Array.isArray(x);}
function on(x){return x===true;}
function safeCheck(name,observed){return {code:name,observed:observed===true};}
export function evaluateObservedGitHubGovernance({
  repository,branch,protection,rulesets,codeowners,rulesetDetails=[]
}={}){
  const repoOK=repository?.status===200 &&
    repository.value?.full_name===REPO &&
    repository.value?.default_branch==="main";
  const branchOK=branch?.status===200&&
    SHA.test(branch.value?.commit?.sha||"")&&
    branch.value?.name==="main";
  const p=protection?.status===200&&present(protection.value)?
    protection.value:null;
  const reviews=p?.required_pull_request_reviews;
  const contexts=p?.required_status_checks?.contexts;
  const checksList=p?.required_status_checks?.checks;
  const requiredChecks=[...(Array.isArray(contexts)?contexts:[]),
    ...(Array.isArray(checksList)?checksList.map(x=>x?.context):[])];
  const ruleArray=rulesets?.status===200&&Array.isArray(rulesets.value)?
    rulesets.value:null;
  const enforcedRules=(ruleArray||[]).filter(x=>x?.enforcement==="active"&&
    x?.target==="branch");
  const effective=auditEffectiveMainRulesets(ruleArray||[],rulesetDetails);
  const conditions=[
    safeCheck("S311_REPOSITORY_IDENTITY",repoOK),
    safeCheck("S311_MAIN_BRANCH_HEAD",branchOK),
    safeCheck("S312_MAIN_REPORTED_PROTECTED",branchOK&&branch.value?.protected===true),
    safeCheck("S311_LEGACY_BRANCH_PROTECTION_READABLE",Boolean(p)),
    safeCheck("S311_TWO_REVIEWS_REQUIRED",Number.isInteger(reviews?.required_approving_review_count)&&
      reviews.required_approving_review_count>=2),
    safeCheck("S311_CODE_OWNER_REVIEWS_REQUIRED",on(reviews?.require_code_owner_reviews)),
    safeCheck("S311_STALE_REVIEWS_DISMISSED",on(reviews?.dismiss_stale_reviews)),
    safeCheck("S311_LAST_PUSH_REVIEWED",on(reviews?.require_last_push_approval)),
    safeCheck("S311_ADMIN_BRANCH_RULES_ENFORCED",on(p?.enforce_admins?.enabled)),
    safeCheck("S311_FORCE_PUSH_DISABLED",p?.allow_force_pushes?.enabled===false),
    safeCheck("S311_BRANCH_DELETION_DISABLED",p?.allow_deletions?.enabled===false),
    safeCheck("S311_REQUIRED_ACTIVA_CI",requiredChecks.some(c=>typeof c==="string"&&
      /(?:^|\/)smoke$/i.test(c))),
    safeCheck("S311_RULESETS_API_READABLE",Array.isArray(ruleArray)),
    safeCheck("S311_ACTIVE_BRANCH_RULESET_VISIBLE",enforcedRules.length>0),
    safeCheck("S312_RULESET_DETAILS_COMPLETE",effective.ruleDetailsComplete),
    safeCheck("S312_RULESET_EXPLICIT_MAIN_TARGET",effective.mainExplicitlyTargeted),
    safeCheck("S312_RULESET_NO_LISTED_BYPASS",effective.noListedBypassObserved),
    safeCheck("S312_MAIN_REVIEW_CI_FORCE_DELETE_CONTROLS",effective.policyBundleObserved),
    safeCheck("S311_CODEOWNERS_PRESENT",codeowners?.status===200&&
      PATH_LABELS.includes(codeowners.path)&&
      codeowners.value?.type==="file"),
  ];
  const readErrors=[];
  for(const [name,result] of Object.entries({
    REPOSITORY:repository,BRANCH:branch,BRANCH_PROTECTION:protection,
    REPOSITORY_RULESETS:rulesets,CODEOWNERS:codeowners
  })){
    if(!result||result.status!==200){
      readErrors.push({code:"S311_"+name+"_UNVERIFIED",
        outcome:ERROR_STATUS.has(result?.status)?("HTTP_"+result.status):"NOT_CONFIRMED"});
    }
  }
  return {
    schemaVersion:1,
    reportType:"ACTIVA_AI_S311_READ_ONLY_GITHUB_GOVERNANCE_OBSERVATION",
    decision:"HOLD",
    evidenceSource:"AUTHENTICATED_GITHUB_READ_ONLY_API_RESPONSE_NOT_INDEPENDENT_ATTESTATION",
    collectionState:conditions.every(x=>x.observed)&&readErrors.length===0?
      "TECHNICAL_SETTINGS_OBSERVED_REQUIRES_INDEPENDENT_REVIEW":
      "GITHUB_GOVERNANCE_UNVERIFIED_OR_INCOMPLETE",
    repo:REPO,
    branch:"main",
    observedChecks:conditions,
    readErrors,
    independentlyVerified:false,
    reviewerIdentityVerified:false,
    branchBypassVerified:false,
    effectiveRulesetsVerified:false,
    sourceArtifactDeploymentVerified:false,
    stagingAcceptanceVerified:false,
    mergeApproved:false,productionGoApproved:false,deploymentApproved:false,
    researchEthicsApproved:false,
    nextAction:"INDEPENDENT_REPO_ADMIN_AND_SECURITY_RULESET_REVIEW_REQUIRED",
  };
}
export async function probeGitHubGovernance({
  confirmed=false,token="",fetchImpl=fetch
}={}){
  if(confirmed!==true||typeof token!=="string"||token.length<15){
    return {
      decision:"HOLD",reason:"S311_EXPLICIT_OPERATOR_CONFIRMATION_AND_READ_ONLY_TOKEN_REQUIRED",
      productionGoApproved:false,mergeApproved:false,deploymentApproved:false,
      researchEthicsApproved:false,
    };
  }
  try{
    const repository=await getJSON(fetchImpl,token,"");
    const branch=await getJSON(fetchImpl,token,"/branches/main");
    const protection=await getJSON(fetchImpl,token,"/branches/main/protection");
    const rulesets=await getJSON(fetchImpl,token,"/rulesets?includes_parents=true&per_page=100");
    // Follow listed active branch rulesets by safe numeric IDs only; DO NOT
    // infer effective protection from an unrelated, unscoped active rule.
    const active=rulesets.status===200&&Array.isArray(rulesets.value)?
      rulesets.value.filter(x=>x?.target==="branch"&&x?.enforcement==="active"):[];
    const rulesetDetails=[];
    if(active.length>20)throw Error("S312_RULESET_LIST_TOO_LARGE");
    for(const item of active){
      if(!Number.isSafeInteger(item.id)||item.id<=0){
        rulesetDetails.push({status:0});continue;
      }
      rulesetDetails.push(await getJSON(fetchImpl,token,"/rulesets/"+item.id));
    }
    let codeowners={status:404};
    for(let i=0;i<PATHS.length;i++){
      const result=await getJSON(fetchImpl,token,PATHS[i]);
      if(result.status===200){
        codeowners={...result,path:PATH_LABELS[i]};break;
      }
      if(result.status!==404){codeowners={status:result.status};break;}
    }
    return evaluateObservedGitHubGovernance({
      repository,branch,protection,rulesets,codeowners,rulesetDetails
    });
  }catch(error){
    return {
      decision:"HOLD",reason:"S311_"+safeError(error),
      productionGoApproved:false,mergeApproved:false,deploymentApproved:false,
      researchEthicsApproved:false,
    };
  }
}
async function main(){
  // Read-only token must be supplied by operator on a protected workstation.
  // Do not use workflow pull_request secrets or publish raw responses.
  const result=await probeGitHubGovernance({
    confirmed:process.env.ACTIVA_S311_READ_ONLY_CONFIRM==="true",
    token:process.env.ACTIVA_S311_GITHUB_READ_ONLY_TOKEN||"",
  });
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.reason||result.collectionState!==
    "TECHNICAL_SETTINGS_OBSERVED_REQUIRES_INDEPENDENT_REVIEW"?1:0;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  await main();
}
