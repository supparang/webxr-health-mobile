const base = process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function req(path, { actor, method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (actor) headers["x-activa-user-id"] = actor;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    throw new Error(method + " " + path + " -> " + res.status + " " + text);
  }
  return data;
}

const health = await req("/api/health");
assert(health.ok && health.database === "connected", "health/database check failed");

const me = await req("/api/me", { actor: "ADM001" });
assert(me.user?.employeeId === "ADM001", "admin identity check failed");

const users = await req("/api/users", { actor: "ADM001" });
const p1 = users.users.find((u) => u.employeeId === "P001");
assert(p1, "P001 seed user missing");

const activities = await req("/api/activities", { actor: "ADM001" });
assert(activities.activities.length > 0, "seed activity missing");
const activity = activities.activities[0];

const qr = await req("/api/activities/" + encodeURIComponent(activity.id) + "/qr", {
  actor: "ORG001",
  method: "POST",
});
assert(qr.token && qr.expiresAt, "signed QR issuance failed");

const checkin = await req("/api/attendance/checkin", {
  actor: "P001",
  method: "POST",
  body: { userId: "P001", token: qr.token },
});
const attendanceId = checkin.attendance?.id;
assert(attendanceId, "check-in failed");

await req("/api/attendance/" + encodeURIComponent(attendanceId) + "/checkout", {
  actor: "P001",
  method: "POST",
});

await req("/api/attendance/" + encodeURIComponent(attendanceId) + "/staff-verify", {
  actor: "STF001",
  method: "POST",
});

const evidence = await req("/api/evidence/" + encodeURIComponent(attendanceId) + "/evaluate", {
  actor: "STF001",
  method: "POST",
});
assert(evidence.result?.ruleVersion, "evidence evaluation failed");
assert(evidence.note?.includes("not AI"), "rule-based disclaimer missing");

const queue = await req("/api/ground-truth/queue", { actor: "STF001" });
const gtRecord = queue.records.find((r) => r.id === attendanceId);
assert(gtRecord, "ground-truth queue missing record");
assert(!Object.prototype.hasOwnProperty.call(gtRecord, "aiPredictions"), "AI leakage into ground-truth queue");
assert(gtRecord.user?.employeeId === "P001", "reviewer-safe identity lookup missing");

await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/labels", {
  actor: "STF001",
  method: "POST",
  body: {
    target: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "CI smoke test only",
  },
});

const staffMe = await req("/api/me", { actor: "STF001" });

await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/labels", {
  actor: "ADM001",
  method: "POST",
  body: {
    target: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "Second independent CI label",
  },
});

const staffQueueAfterTwoLabels = await req("/api/ground-truth/queue", { actor: "STF001" });
const staffRecordAfterTwoLabels = staffQueueAfterTwoLabels.records.find((r) => r.id === attendanceId);
assert(
  (staffRecordAfterTwoLabels.groundTruthLabels || []).every((x) => x.reviewerId === staffMe.user.id),
  "independent label privacy failed: STAFF can see peer labels"
);
assert(
  !Object.prototype.hasOwnProperty.call(staffRecordAfterTwoLabels, "consistencyResult"),
  "rule-result leakage into blinded ground-truth queue"
);

const adjudication = await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/adjudicate", {
  actor: "ADM001",
  method: "POST",
  body: {
    finalTarget: "REVIEW_REQUIRED",
    reasonCodes: ["SHORT_DURATION"],
    notes: "Two independent labels agree in CI",
  },
});
assert(adjudication.groundTruthCase?.status === "ADJUDICATED", "ground-truth adjudication failed");

const locked = await req("/api/ground-truth/" + encodeURIComponent(attendanceId) + "/lock", {
  actor: "ADM001",
  method: "POST",
});
assert(locked.groundTruthCase?.status === "LOCKED", "ground-truth lock failed");

const readiness = await req("/api/ml/readiness", { actor: "ADM001" });
assert(readiness.counts?.lockedCount >= 1, "ML readiness does not count locked case");

const mlDataset = await req("/api/ml/dataset", { actor: "ADM001" });
const mlRecord = mlDataset.records.find((r) => r.record_id === attendanceId);
assert(mlRecord, "locked ML dataset missing record");
assert(mlRecord.participant_hash && mlRecord.participant_hash !== "P001", "ML dataset is not de-identified");
assert(mlRecord.final_target === "REVIEW_REQUIRED", "ML final target mismatch");
assert(!Object.prototype.hasOwnProperty.call(mlRecord, "risk_probability"), "AI output leaked into training dataset");

await req("/api/reviews/" + encodeURIComponent(attendanceId), {
  actor: "STF001",
  method: "POST",
  body: {
    decision: "VERIFY",
    reason: "CI smoke test",
    reviewDurationSeconds: 1,
  },
});

const participantAttendance = await req("/api/attendance", { actor: "P001" });
assert(participantAttendance.attendance.every((r) => r.user?.employeeId === "P001"), "participant privacy filter failed");

const research = await req("/api/research/export", { actor: "ADM001" });
const exported = research.records.find((r) => r.record_id === attendanceId);
assert(exported, "research export missing test record");
assert(exported.participant_hash && exported.participant_hash !== "P001", "research de-identification failed");

const audit = await req("/api/audit", { actor: "ADM001" });
assert(audit.logs.length > 0, "audit trail empty");

console.log("ACTIVA-AI V0.3.1 smoke test passed");
