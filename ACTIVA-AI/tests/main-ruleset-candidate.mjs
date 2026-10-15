// S3.13: validate a non-operative operator-importable Ruleset candidate.
// This test does not modify GitHub settings or nominate reviewer identities.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {auditEffectiveMainRulesets,rulesetExplicitlyTargetsMain}
  from "../scripts/github-effective-ruleset.mjs";
const config=JSON.parse(await readFile(
  new URL("../security/s3.13-main-ruleset.CANDIDATE.json",import.meta.url),"utf8"
));
assert.equal(config.enforcement,"disabled",
  "Ruleset proposal MUST remain disabled until independently approved");
assert.equal(config.target,"branch");
assert.deepEqual(config.bypass_actors,[]);
assert(config.conditions.ref_name.include.includes("~DEFAULT_BRANCH"));
assert(config.conditions.ref_name.include.includes("refs/heads/release/*"));
assert.deepEqual(config.conditions.ref_name.exclude,[]);
const review=config.rules.find(x=>x.type==="pull_request");
const p=review?.parameters;
assert.equal(p?.required_approving_review_count,2);
assert.equal(p?.require_code_owner_review,true);
assert.equal(p?.dismiss_stale_reviews_on_push,true);
assert.equal(p?.require_last_push_approval,true);
assert.equal(p?.required_review_thread_resolution,true);
const required=config.rules.find(x=>x.type==="required_status_checks");
assert.equal(required?.parameters?.strict_required_status_checks_policy,true);
assert(required.parameters.required_status_checks.some(x=>x.context==="smoke"));
assert(config.rules.some(x=>x.type==="non_fast_forward"));
assert(config.rules.some(x=>x.type==="deletion"));
const active={...config,id:123,enforcement:"active"};
assert.equal(rulesetExplicitlyTargetsMain(config),false);
assert.equal(rulesetExplicitlyTargetsMain(active),true);
const mocked=auditEffectiveMainRulesets(
  [{id:123,target:"branch",enforcement:"active"}],
  [{status:200,value:active}]
);
assert.equal(mocked.policyBundleObserved,true,
  "When actually activated, the proposed exact bundle must satisfy source checker");
for(const bad of [
  {...active,conditions:{ref_name:{include:[],exclude:[]}}},
  {...active,rules:active.rules.filter(x=>x.type!=="required_status_checks")},
  {...active,bypass_actors:[{actor_id:123}]},
]){
  const outcome=auditEffectiveMainRulesets([{id:123,target:"branch",enforcement:"active"}],
    [{status:200,value:bad}]);
  assert.equal(outcome.policyBundleObserved,false);
}
const workflow=await readFile(
  new URL("../../.github/workflows/activa-ai-ci.yml",import.meta.url),"utf8"
);
assert(/(?:^|\n)  pull_request:\s*(?:\n|$)/.test(workflow),
  "All PRs must run the required smoke check (no path filter on pull_request)");
const pull=workflow.split(/\n  pull_request:\s*\n/)[1]?.split(/\n  workflow_dispatch:/)[0]||"";
assert(!/\bpaths(?:-ignore)?:/.test(pull),
  "Path-filtered PR CI can leave required check pending on non-ACTIVA changes");
assert(/\n  smoke:\s*\n/.test(workflow),
  "Required check context must match actual CI job name smoke");
assert(!JSON.stringify(config).includes("private_key"));
console.log("S3.13 disabled GitHub ruleset candidate and always-triggered PR smoke check: PASS (still requires independent admin activation)");
