// S3.11: synthetic-only GET responses. No token or real GitHub API calls.
import assert from "node:assert/strict";
import {evaluateObservedGitHubGovernance,probeGitHubGovernance}
  from "../scripts/probe-github-governance.mjs";

const REPO="supparang/webxr-health-mobile";
const SHA="a".repeat(40);
const protectedMain={
  enforce_admins:{enabled:true},
  required_pull_request_reviews:{
    required_approving_review_count:2,
    require_code_owner_reviews:true,
    dismiss_stale_reviews:true,
    require_last_push_approval:true,
  },
  required_status_checks:{strict:true,contexts:["smoke"]},
  allow_force_pushes:{enabled:false},
  allow_deletions:{enabled:false},
};
const response={
  repository:{status:200,value:{full_name:REPO,default_branch:"main"}},
  branch:{status:200,value:{name:"main",commit:{sha:SHA}}},
  protection:{status:200,value:protectedMain},
  rulesets:{status:200,value:[{target:"branch",enforcement:"active"}]},
  codeowners:{status:200,path:".github/CODEOWNERS",
    value:{type:"file",content:"RkFLRSBPUEFRVUUgRklYVFVSRQ=="}},
};
const strong=evaluateObservedGitHubGovernance(response);
assert.equal(strong.decision,"HOLD");
assert.equal(strong.collectionState,
  "TECHNICAL_SETTINGS_OBSERVED_REQUIRES_INDEPENDENT_REVIEW");
assert(strong.observedChecks.every(x=>x.observed));
for(const v of ["independentlyVerified","reviewerIdentityVerified",
  "branchBypassVerified","effectiveRulesetsVerified",
  "sourceArtifactDeploymentVerified","stagingAcceptanceVerified",
  "mergeApproved","productionGoApproved","deploymentApproved",
  "researchEthicsApproved"]){
  assert.equal(strong[v],false,v);
}
function lacks(mut,reason){
  const input=structuredClone(response);mut(input);
  const obs=evaluateObservedGitHubGovernance(input);
  assert.equal(obs.decision,"HOLD");
  assert.equal(obs.productionGoApproved,false);
  assert.equal(obs.collectionState,"GITHUB_GOVERNANCE_UNVERIFIED_OR_INCOMPLETE");
  assert(obs.observedChecks.some(x=>x.code===reason&&x.observed===false),
    "Expected unverified observation: "+reason);
}
lacks(x=>x.protection.value.required_pull_request_reviews.required_approving_review_count=1,
  "S311_TWO_REVIEWS_REQUIRED");
lacks(x=>x.protection.value.required_pull_request_reviews.require_code_owner_reviews=false,
  "S311_CODE_OWNER_REVIEWS_REQUIRED");
lacks(x=>x.protection.value.required_pull_request_reviews.dismiss_stale_reviews=false,
  "S311_STALE_REVIEWS_DISMISSED");
lacks(x=>x.protection.value.required_pull_request_reviews.require_last_push_approval=false,
  "S311_LAST_PUSH_REVIEWED");
lacks(x=>x.protection.value.enforce_admins.enabled=false,
  "S311_ADMIN_BRANCH_RULES_ENFORCED");
lacks(x=>x.protection.value.allow_force_pushes.enabled=true,
  "S311_FORCE_PUSH_DISABLED");
lacks(x=>x.protection.value.allow_deletions.enabled=true,
  "S311_BRANCH_DELETION_DISABLED");
lacks(x=>x.protection.value.required_status_checks.contexts=[],
  "S311_REQUIRED_ACTIVA_CI");
lacks(x=>x.rulesets.value=[],
  "S311_ACTIVE_BRANCH_RULESET_VISIBLE");
lacks(x=>x.codeowners={status:404},
  "S311_CODEOWNERS_PRESENT");
lacks(x=>x.branch.value.commit.sha="not-a-commit",
  "S311_MAIN_BRANCH_HEAD");
lacks(x=>x.repository.value.full_name="attacker/fake",
  "S311_REPOSITORY_IDENTITY");
lacks(x=>x.protection={status:403,value:null},
  "S311_LEGACY_BRANCH_PROTECTION_READABLE");

const token="S311-TEST-DUMMY-NEVER-USE-LIVE-TOKEN";
const disabled=await probeGitHubGovernance({confirmed:false,token,
  fetchImpl:()=>{throw Error("Should never fetch without confirmation");}});
assert.equal(disabled.reason,"S311_EXPLICIT_OPERATOR_CONFIRMATION_AND_READ_ONLY_TOKEN_REQUIRED");
const noToken=await probeGitHubGovernance({confirmed:true,
  fetchImpl:()=>{throw Error("Should never fetch without token");}});
assert.equal(noToken.productionGoApproved,false);

const calls=[];
function mockFetch(url,opts){
  calls.push({url,opts});
  const path=new URL(url).pathname;
  let data;
  if(path==="/repos/"+REPO) data=response.repository.value;
  else if(path.endsWith("/branches/main/protection"))data=response.protection.value;
  else if(path.endsWith("/branches/main"))data=response.branch.value;
  else if(path.endsWith("/rulesets"))data=response.rulesets.value;
  else if(path.endsWith("/contents/.github/CODEOWNERS"))data=response.codeowners.value;
  else throw Error("Unexpected mock URL");
  return Promise.resolve({
    status:200,headers:{get:()=>null},text:()=>Promise.resolve(JSON.stringify(data)),
  });
}
const observed=await probeGitHubGovernance({confirmed:true,token,fetchImpl:mockFetch});
assert.equal(observed.collectionState,
  "TECHNICAL_SETTINGS_OBSERVED_REQUIRES_INDEPENDENT_REVIEW");
assert.equal(observed.decision,"HOLD");
assert.equal(calls.length,5);
for(const c of calls){
  assert.equal(new URL(c.url).origin,"https://api.github.com");
  assert.equal(c.opts.method,"GET");
  assert.equal(c.opts.redirect,"error");
  assert.equal(c.opts.credentials,"omit");
  assert.equal(c.opts.headers.Authorization,"Bearer "+token);
}
assert(!JSON.stringify(observed).includes(token),
  "GitHub token must never appear in report");
assert(!JSON.stringify(observed).includes("RkFLRS"),
  "Raw CODEOWNERS content must never appear in report");
assert(!JSON.stringify(observed).includes("bypass_actors"));
const denied=await probeGitHubGovernance({confirmed:true,token,
  fetchImpl:async()=>({status:403,headers:{get:()=>null},
    text:async()=>JSON.stringify({message:"Forbidden, token="+token})})});
assert.equal(denied.decision,"HOLD");
assert.equal(denied.productionGoApproved,false);
assert(!JSON.stringify(denied).includes(token));
assert.equal(denied.collectionState,"GITHUB_GOVERNANCE_UNVERIFIED_OR_INCOMPLETE");
const failed=await probeGitHubGovernance({confirmed:true,token,
  fetchImpl:async()=>{throw Error("Error contains token "+token);}});
assert.equal(failed.reason,"S311_READ_ONLY_REQUEST_FAILED");
assert(!JSON.stringify(failed).includes(token));
console.log("ACTIVA-AI S3.11 read-only authenticated GitHub observation mocked regressions: PASS; independent institutional GO remains HOLD");
