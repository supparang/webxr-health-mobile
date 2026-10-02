// Phase 4 prospective research switch. This is an operational interlock,
// NEVER machine-verification of the validity of an ethics/site decision.
// Defaults to HOLD in every environment; ordinary/QA_TEST attendance is unaffected.
import crypto from "node:crypto";

const SHA256=/^[a-f0-9]{64}$/i;
const VERSION=/^[A-Za-z0-9._-]{3,60}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,127}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const v=(env,key)=>String(env[key]??"").trim();
function syntheticCiOnly(env) {
  return env.CI==="true" && env.ACTIVA_TEST_DATABASE_ONLY==="true" &&
    env.ALLOW_SYNTHETIC_CI==="true" && env.ACTIVA_DEPLOYMENT_TIER==="STAGING";
}
function validRef(value,env) {
  if(!REF.test(value) || /^(pending|todo|placeholder|example|unknown|none|n\/a)(?:$|[-_.])/i.test(value))return false;
  if(/^(ci|mock|demo|test)[-_]/i.test(value)&&!syntheticCiOnly(env))return false;
  return true;
}
function validUtc(value) {return UTC.test(value)&&Number.isFinite(Date.parse(value));}

// Returns only Boolean flags, reason CODES, study stage and a non-sensitive
// consent version. NEVER return ethics/site refs, consent text, hashes or keys.
export function empiricalCollectionGate(env=process.env, now=new Date()) {
  const blockers=[];
  const add=(condition,code)=>{if(!condition)blockers.push(code);};
  const stage=v(env,"ACTIVA_APPROVED_STUDY_STAGE");
  add(env.ACTIVA_EMPIRICAL_COLLECTION_ENABLED==="true","EMPIRICAL_SWITCH_DISABLED");
  if(env.ACTIVA_DEPLOYMENT_TIER==="PRODUCTION") {
    add(env.ACTIVA_AUTH_MODE==="GOOGLE_OIDC" && env.ACTIVA_PRODUCTION_GO_ENABLED==="true",
      "PRODUCTION_AUTHENTICATION_OR_GO_NOT_READY");
  }
  add(["FEASIBILITY","MAIN"].includes(stage),"APPROVED_STUDY_STAGE_REQUIRED");
  for(const key of ["ACTIVA_ETHICS_DECISION_REF","ACTIVA_SITE_PERMISSION_REF"]) {
    add(validRef(v(env,key),env),key+"_MISSING_OR_INVALID");
  }
  add(VERSION.test(v(env,"ACTIVA_APPROVED_CONSENT_VERSION")),"APPROVED_CONSENT_VERSION_REQUIRED");
  add(SHA256.test(v(env,"ACTIVA_APPROVED_CONSENT_TEXT_SHA256")),"APPROVED_CONSENT_TEXT_SHA256_REQUIRED");
  const from=v(env,"ACTIVA_ETHICS_VALID_FROM_UTC");
  const until=v(env,"ACTIVA_ETHICS_VALID_UNTIL_UTC");
  add(validUtc(from)&&validUtc(until)&&Date.parse(from)<Date.parse(until) &&
    Date.parse(from)<=new Date(now).getTime() && new Date(now).getTime()<Date.parse(until),
    "ETHICS_WINDOW_MISSING_EXPIRED_OR_NOT_YET_VALID");
  if(stage==="MAIN")add(validRef(v(env,"ACTIVA_SAMPLE_PLAN_SIGNOFF_REF"),env),"MAIN_SAMPLE_PLAN_SIGNOFF_REQUIRED");
  return {
    enabled:blockers.length===0,
    studyStage:["FEASIBILITY","MAIN"].includes(stage)?stage:null,
    approvedConsentVersion:blockers.length===0?v(env,"ACTIVA_APPROVED_CONSENT_VERSION"):null,
    blockers,
    caution:"Configuration records a human operator's attestation only. Confirm the actual ethics decision, CRU site scope, consent wording and (for MAIN) approved sample plan in protected institutional records.",
  };
}

// Pair the *exact* committee-approved version AND text fingerprint with a new
// EMPIRICAL Guest Pass. QA_TEST keeps its preexisting software-test flow.
export function empiricalGuestConsentGate(dataClassification,version,text,env=process.env,now=new Date()) {
  if(dataClassification!=="EMPIRICAL")return {ok:true};
  const gate=empiricalCollectionGate(env,now);
  if(!gate.enabled)return {ok:false,error:"EMPIRICAL_COLLECTION_GATE_HOLD"};
  const digest=crypto.createHash("sha256").update(String(text??""),"utf8").digest("hex");
  if(version!==gate.approvedConsentVersion ||
     digest!==v(env,"ACTIVA_APPROVED_CONSENT_TEXT_SHA256").toLowerCase()) {
    return {ok:false,error:"EMPIRICAL_APPROVED_CONSENT_MISMATCH"};
  }
  return {ok:true};
}
