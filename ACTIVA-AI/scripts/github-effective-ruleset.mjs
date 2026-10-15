// S3.12: conservative inspection of ACTUAL ruleset target + rules.
// A visible active ruleset is NOT enough: its target must cover main and it
// must include approved review + CI gates. Unknown patterns => UNVERIFIED.
// A complete output is still not a human Security/Operations attestation.
const MAIN_INCLUDES=new Set([
  "~DEFAULT_BRANCH","~ALL","refs/heads/main","main",
]);
const SHA_CHECK=/^(?:smoke|ACTIVA-AI CI(?:\s*\/\s*smoke)?)$/i;

function record(value){return value!==null&&typeof value==="object"&&!Array.isArray(value);}
export function rulesetExplicitlyTargetsMain(ruleset){
  if(!record(ruleset)||ruleset.enforcement!=="active"||
     ruleset.target!=="branch")return false;
  const condition=ruleset.conditions?.ref_name;
  if(!record(condition)||!Array.isArray(condition.include)||
     !Array.isArray(condition.exclude))return false;
  // Exclusion patterns can be glob expressions. Unless the operator has
  // independently resolved them, never claim the rule definitely applies.
  return condition.exclude.length===0 &&
    condition.include.some(x=>MAIN_INCLUDES.has(x));
}
function requiredCi(rule){
  const params=rule?.parameters;
  return rule?.type==="required_status_checks" &&
    Array.isArray(params?.required_status_checks) &&
    params.required_status_checks.some(x=>typeof x?.context==="string" &&
      SHA_CHECK.test(x.context.trim())) &&
    params.strict_required_status_checks_policy===true;
}
function requireReviews(rule){
  const p=rule?.parameters;
  return rule?.type==="pull_request" && record(p) &&
    Number.isInteger(p.required_approving_review_count) &&
    p.required_approving_review_count>=2 &&
    p.require_code_owner_review===true &&
    p.dismiss_stale_reviews_on_push===true &&
    p.require_last_push_approval===true &&
    p.required_review_thread_resolution===true;
}
export function auditEffectiveMainRulesets(summaries=[],detailResults=[]){
  const details=Array.isArray(detailResults)?detailResults:[];
  const list=Array.isArray(summaries)?summaries:[];
  const activeIds=new Set(list.filter(x=>x?.target==="branch"&&
    x?.enforcement==="active"&&Number.isSafeInteger(x.id)&&x.id>0)
    .map(x=>x.id));
  // Reject a partial list or an omitted detail as unverified; other rules
  // may hide administrative bypass or conflicting targeting requirements.
  const allDetailsReturned=activeIds.size===details.length &&
    details.every(x=>x?.status===200&&activeIds.has(x.value?.id)&&
      record(x.value)&&Array.isArray(x.value.rules));
  const scopeCandidates=details.filter(x=>x?.status===200&&
    activeIds.has(x.value?.id) && rulesetExplicitlyTargetsMain(x.value));
  const noBypass=scopeCandidates.some(x=>Array.isArray(x.value.bypass_actors)&&
    x.value.bypass_actors.length===0);
  const protections=scopeCandidates.some(x=>{
    const rs=x.value;
    return Array.isArray(rs.bypass_actors)&&rs.bypass_actors.length===0&&
      rs.rules.some(requireReviews) &&
      rs.rules.some(requiredCi) &&
      rs.rules.some(r=>r?.type==="non_fast_forward") &&
      rs.rules.some(r=>r?.type==="deletion");
  });
  return {
    ruleDetailsComplete:allDetailsReturned,
    mainExplicitlyTargeted:scopeCandidates.length>0,
    noListedBypassObserved:noBypass,
    policyBundleObserved:protections&&allDetailsReturned,
    // Never return rule IDs, raw rules, security identities or bypass actors.
  };
}
