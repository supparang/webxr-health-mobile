// Phase 3: persisted research provenance; never infer empirical status from titles.
export const ACTIVITY_DATA_CLASSES = Object.freeze(["UNCLASSIFIED","QA_TEST","EMPIRICAL"]);
export const EMPIRICAL_ACTIVITY_FILTER = Object.freeze({ dataClassification:"EMPIRICAL" });
// Phase 4 CRU research: registered-user attendance is OPERATIONAL only unless
// a separately authorized/versioned logged-in consent registry is implemented.
// Current EMPIRICAL research eligibility is limited to explicit Guest consent.
// No silent research opt-in from merely being assigned to/attending an event.
// Withdrawal/revocation excludes the row while immutable operational audit remains.
export const EMPIRICAL_ATTENDANCE_FILTER = Object.freeze({
  isVoided:false,
  activity:EMPIRICAL_ACTIVITY_FILTER,
  guestParticipantId:{not:null},
  guestParticipant:{consentAt:{not:null},withdrawnAt:null,revokedAt:null},
});
export const EMPIRICAL_LOCKED_CASE_FILTER = Object.freeze({
  status:"LOCKED",
  finalTarget:{ not:null },
  attendance:EMPIRICAL_ATTENDANCE_FILTER,
});
export function classificationForNewActivity(body, role, startAt, now = new Date()) {
  const value = body?.dataClassification ?? "UNCLASSIFIED";
  if (!ACTIVITY_DATA_CLASSES.includes(value)) return { error:"INVALID_ACTIVITY_DATA_CLASSIFICATION" };
  if (value !== "UNCLASSIFIED" && role !== "ADMIN") return { error:"ADMIN_REQUIRED_FOR_RESEARCH_CLASSIFICATION" };
  if (value === "EMPIRICAL") {
    if (body?.empiricalAttestation !== true) return { error:"EMPIRICAL_PROVENANCE_ATTESTATION_REQUIRED" };
    if (!(new Date(startAt).getTime() > now.getTime())) return { error:"EMPIRICAL_CLASSIFICATION_MUST_PRECEDE_ACTIVITY" };
  }
  return { value, classifiedAt:value==="UNCLASSIFIED" ? null : now };
}
