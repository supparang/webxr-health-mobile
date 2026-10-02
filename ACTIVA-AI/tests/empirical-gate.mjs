import assert from "node:assert/strict";
import { empiricalCollectionGate, empiricalGuestConsentGate } from "../server/empirical-gate.js";

// Synthetic-only unit fixtures: these are NOT actual institutional approvals.
const clock=new Date("2026-10-02T00:00:00Z");
const text="CI-only software acceptance test: this is disposable synthetic data, not an empirical participant or publication consent.";
const env={
  CI:"true",ACTIVA_TEST_DATABASE_ONLY:"true",ALLOW_SYNTHETIC_CI:"true",
  ACTIVA_DEPLOYMENT_TIER:"STAGING",
  ACTIVA_EMPIRICAL_COLLECTION_ENABLED:"true",
  ACTIVA_APPROVED_STUDY_STAGE:"FEASIBILITY",
  ACTIVA_ETHICS_DECISION_REF:"CI-SYNTHETIC-ETHICS-NOT-APPROVAL",
  ACTIVA_SITE_PERMISSION_REF:"CI-SYNTHETIC-SITE-NOT-AUTHORIZED",
  ACTIVA_APPROVED_CONSENT_VERSION:"CI-CONSENT-V1",
  ACTIVA_APPROVED_CONSENT_TEXT_SHA256:"9e2d2b337c60db3530a352c3eaa0be5a7c91b1b28b83a294b04f1a87e5dcb188",
  ACTIVA_ETHICS_VALID_FROM_UTC:"2026-01-01T00:00:00Z",
  ACTIVA_ETHICS_VALID_UNTIL_UTC:"2027-01-01T00:00:00Z",
};
const check=(overrides)=>empiricalCollectionGate({...env,...overrides},clock);
const defaultOff=empiricalCollectionGate({},clock);
assert.equal(defaultOff.enabled,false,"Missing env must never open research enrollment");
assert(defaultOff.blockers.includes("EMPIRICAL_SWITCH_DISABLED"));
assert.equal(defaultOff.approvedConsentVersion,null);
assert.equal(check({}).enabled,true,"Strictly synthetic CI fixture should exercise permitted API branch");
assert.equal(empiricalGuestConsentGate("QA_TEST","QA-UNRELATED","other text",{},clock).ok,true);
assert.equal(empiricalGuestConsentGate("EMPIRICAL","CI-CONSENT-V1",text,{},clock).error,
  "EMPIRICAL_COLLECTION_GATE_HOLD");
assert.equal(empiricalGuestConsentGate("EMPIRICAL","CI-CONSENT-V1",text,env,clock).ok,true);
assert.equal(empiricalGuestConsentGate("EMPIRICAL","WRONG-VERSION",text,env,clock).error,
  "EMPIRICAL_APPROVED_CONSENT_MISMATCH");
assert.equal(empiricalGuestConsentGate("EMPIRICAL","CI-CONSENT-V1",text+" edited",env,clock).error,
  "EMPIRICAL_APPROVED_CONSENT_MISMATCH");
assert(check({ACTIVA_EMPIRICAL_COLLECTION_ENABLED:"false"}).blockers.includes("EMPIRICAL_SWITCH_DISABLED"));
assert(check({ACTIVA_APPROVED_STUDY_STAGE:"WRONG"}).blockers.includes("APPROVED_STUDY_STAGE_REQUIRED"));
assert(check({ACTIVA_ETHICS_DECISION_REF:"PENDING"}).blockers.includes("ACTIVA_ETHICS_DECISION_REF_MISSING_OR_INVALID"));
assert(check({ACTIVA_SITE_PERMISSION_REF:""}).blockers.includes("ACTIVA_SITE_PERMISSION_REF_MISSING_OR_INVALID"));
assert(check({ACTIVA_APPROVED_CONSENT_TEXT_SHA256:"not-a-hash"}).blockers.includes("APPROVED_CONSENT_TEXT_SHA256_REQUIRED"));
assert(check({ACTIVA_ETHICS_VALID_UNTIL_UTC:"2026-01-02T00:00:00Z"}).blockers.includes("ETHICS_WINDOW_MISSING_EXPIRED_OR_NOT_YET_VALID"));
assert(check({ACTIVA_ETHICS_VALID_FROM_UTC:"2026-12-01T00:00:00Z"}).blockers.includes("ETHICS_WINDOW_MISSING_EXPIRED_OR_NOT_YET_VALID"));
assert(check({ACTIVA_APPROVED_STUDY_STAGE:"MAIN"}).blockers.includes("MAIN_SAMPLE_PLAN_SIGNOFF_REQUIRED"));
assert.equal(check({ACTIVA_APPROVED_STUDY_STAGE:"MAIN",
 ACTIVA_SAMPLE_PLAN_SIGNOFF_REF:"CI-SYNTHETIC-PLAN-NOT-APPROVED"}).enabled,true);
// Copying CI placeholders into a production process must never satisfy the gate.
const production={...env,CI:"false",ACTIVA_TEST_DATABASE_ONLY:"false",
 ALLOW_SYNTHETIC_CI:"false",ACTIVA_DEPLOYMENT_TIER:"PRODUCTION"};
assert(empiricalCollectionGate(production,clock).blockers.includes("PRODUCTION_AUTHENTICATION_OR_GO_NOT_READY"));
assert(empiricalCollectionGate({...production,ACTIVA_AUTH_MODE:"GOOGLE_OIDC",ACTIVA_PRODUCTION_GO_ENABLED:"true"},clock).enabled===false,
 "CI reference placeholders must stay invalid in Production even after GO");
assert.equal(empiricalCollectionGate(production,clock).enabled,false);
assert.equal(empiricalCollectionGate(production,clock).blockers.some(x=>x.endsWith("_MISSING_OR_INVALID")),true);
const result=check({});
assert(!JSON.stringify(result).includes(env.ACTIVA_ETHICS_DECISION_REF),"preflight leaked decision ref");
assert(!JSON.stringify(result).includes(env.ACTIVA_SITE_PERMISSION_REF),"preflight leaked site ref");
assert(!JSON.stringify(result).includes(env.ACTIVA_APPROVED_CONSENT_TEXT_SHA256),"preflight leaked consent hash");
console.log("ACTIVA-AI Phase 4 empirical gate, consent fingerprint, expiry and CI/Production isolation PASS (synthetic only).");
