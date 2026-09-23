export function evaluateEvidence(record, policy, staffVerification, ruleVersion) {
  const required = [];
  const satisfied = [];
  const missingCodes = [];
  const reasonCodes = [];

  function req(code, enabled, ok) {
    if (!enabled) return;
    required.push(code);
    if (ok) satisfied.push(code);
    else missingCodes.push(code);
  }

  req("QR", policy.qrRequired, record.qrValid);
  req("IDENTITY", policy.identityRequired, record.identityVerified);
  req("CHECKIN", policy.checkinRequired, Boolean(record.checkinAt));
  req("CHECKOUT", policy.checkoutRequired, Boolean(record.checkoutAt));
  req("STAFF", policy.staffRequired, Boolean(staffVerification));
  req("SIGNATURE", policy.signatureRequired, record.signatureVerified);

  let durationRatio = null;
  if (record.checkinAt && record.checkoutAt) {
    const expectedMs = record.activity.endAt.getTime() - record.activity.startAt.getTime();
    const actualMs = record.checkoutAt.getTime() - record.checkinAt.getTime();
    if (expectedMs > 0) {
      durationRatio = Math.max(0, Math.min(1, actualMs / expectedMs));
    }
  }

  if (policy.durationRequired) {
    required.push("DURATION");
    if (durationRatio !== null && durationRatio >= policy.minDurationRatio) {
      satisfied.push("DURATION");
    } else {
      missingCodes.push("DURATION");
      if (durationRatio !== null) reasonCodes.push("SHORT_DURATION");
    }
  }

  if (staffVerification && !record.checkinAt) {
    reasonCodes.push("STAFF_WITHOUT_CHECKIN");
  }
  if (record.checkoutAt && !record.checkinAt) {
    reasonCodes.push("CHECKOUT_WITHOUT_CHECKIN");
  }

  const completenessRatio =
    required.length === 0 ? 1 : satisfied.length / required.length;

  let status = "COMPLETE";
  if (missingCodes.length > 0) status = "INCOMPLETE";
  if (reasonCodes.length > 0) status = "REVIEW_REQUIRED";
  if (record.finalEvidenceStatus === "VERIFIED") status = "VERIFIED";
  if (record.finalEvidenceStatus === "REJECTED") status = "REJECTED";

  return {
    status,
    completenessRatio,
    missingCodes,
    reasonCodes,
    durationRatio,
    ruleVersion,
  };
}
