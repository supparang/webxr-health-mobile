// Phase 3: persisted research provenance; never infer empirical status from titles.
export const ACTIVITY_DATA_CLASSES = Object.freeze(["UNCLASSIFIED","QA_TEST","EMPIRICAL"]);
export const EMPIRICAL_ACTIVITY_FILTER = Object.freeze({ dataClassification:"EMPIRICAL" });
// Guests may enter research only after explicit consent; withdrawing consent
// or revoking a compromised pass removes their records without deleting audit.
export const EMPIRICAL_ATTENDANCE_FILTER = Object.freeze({
  isVoided:false,
  activity:EMPIRICAL_ACTIVITY_FILTER,
  OR:[
    { guestParticipantId:null, userId:{not:null} },
    { guestParticipant:{consentAt:{not:null},withdrawnAt:null,revokedAt:null} },
  ],
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
