// S2.1 authorization regression — disposable GitHub CI database only.
// Reject unexpected scopes without touching any Production service.
if (
  process.env.CI !== "true" ||
  process.env.ACTIVA_TEST_DATABASE_ONLY !== "true" ||
  process.env.ACTIVA_DEPLOYMENT_TIER !== "STAGING" ||
  process.env.ACTIVA_AUTH_MODE !== "DEMO_HEADER" ||
  !/^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1):\d+\//.test(process.env.DATABASE_URL || "")
) throw new Error("S2_1_TEST_REQUIRES_DISPOSABLE_LOCAL_CI_POSTGRES");

const base = process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3000";
if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("S2_1_TEST_REQUIRES_LOCALHOST_API");
const assert = (value, message) => { if (!value) throw new Error(message); };
async function request(route, actor, method="GET", body) {
  const headers = { Accept:"application/json", "x-activa-user-id":actor };
  if (body !== undefined) headers["Content-Type"]="application/json";
  const response = await fetch(base + route, {
    method, headers, body:body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data=JSON.parse(text); } catch { data={}; }
  return { status:response.status, data };
}

const adminRows=await request("/api/attendance","ADM001");
assert(adminRows.status===200 && adminRows.data.attendance.length > 0,
  "Need existing CI synthetic attendance from the smoke test");
const records=adminRows.data.attendance;
const directory=await request("/api/users","ADM001");
assert(directory.status===200, "ADMIN directory failed");
const p1=directory.data.users.find(u=>u.employeeId==="P001");
assert(p1, "Missing synthetic P001 user");
assert(Object.hasOwn(p1,"email") && Object.hasOwn(p1,"activityPermissions"),
  "ADMIN directory must retain administrative fields");

const outsider=await request("/api/users","ADM001","POST",{
  employeeId:"STFSEC",name:"Security Regression Only",role:"STAFF"
});
assert(outsider.status===201, "Cannot create disposable unassigned STAFF fixture");
const outsiderId=outsider.data.user.id;
const outsiderDirectory=await request("/api/users","STFSEC");
assert(outsiderDirectory.status===200 && outsiderDirectory.data.users.length>0,
  "STAFF must retain basic personnel lookup");
assert(outsiderDirectory.data.users.every(u=>
  !Object.hasOwn(u,"email") &&
  !Object.hasOwn(u,"activityPermissions") &&
  !Object.hasOwn(u,"positionTitle")),
  "Non-admin directory leaked restricted contact/permission fields");

const outsiderAttendance=await request("/api/attendance","STFSEC");
assert(outsiderAttendance.status===200, "Unassigned staff attendance request failed");
assert(outsiderAttendance.data.attendance.every(r=>r.userId===outsiderId),
  "Unassigned STAFF read other participants' attendance");

const unrelated=records.find(r=>r.userId!==outsiderId);
assert(unrelated, "Missing unrelated attendance");
const before=unrelated.consistencyResult;
const forbiddenEval=await request(
  "/api/evidence/"+encodeURIComponent(unrelated.id)+"/evaluate","STFSEC","POST"
);
assert(forbiddenEval.status===403 && forbiddenEval.data.error==="EVIDENCE_ACTIVITY_SCOPE_FORBIDDEN",
  "Unassigned STAFF must be denied evidence evaluation");
const after=await request("/api/attendance","ADM001");
const check=after.data.attendance.find(r=>r.id===unrelated.id);
assert(JSON.stringify(check.consistencyResult)===JSON.stringify(before),
  "Forbidden evidence evaluation must not mutate result");

const participantAttendance=await request("/api/attendance","P001");
assert(participantAttendance.status===200 &&
  participantAttendance.data.attendance.every(r=>r.userId===p1.id),
  "PARTICIPANT must see only own attendance");

const staffMe=await request("/api/me","STF001");
assert(staffMe.status===200,"Assigned STAFF identity failed");
const staffId=staffMe.data.user.id;
const verifierIds=staffMe.data.user.activityAssignments
  .filter(a=>a.role==="VERIFIER").map(a=>a.activityId);
assert(verifierIds.length>0,"CI needs an assigned VERIFIER");
const staffAttendance=await request("/api/attendance","STF001");
assert(staffAttendance.status===200 &&
  staffAttendance.data.attendance.every(r=>
    r.userId===staffId || verifierIds.includes(r.activityId)),
  "STAFF attendance list returned unassigned activity");

const qr=await request("/api/personal-qr/me","P001");
assert(qr.status===200 && qr.data.token,"P001 personal QR unavailable");
const outsiderResolve=await request("/api/personal-qr/resolve","STFSEC","POST",{
  token:qr.data.token
});
assert(outsiderResolve.status===403 &&
  outsiderResolve.data.error==="PERSONAL_QR_ACTIVITY_SCOPE_FORBIDDEN",
  "Unassigned STAFF resolved another person's personal QR");

const assignedP1=records.find(r=>r.userId===p1.id && verifierIds.includes(r.activityId));
assert(assignedP1,"Missing P001 record under assigned verifier");
const allowedResolve=await request("/api/personal-qr/resolve","STF001","POST",{
  token:qr.data.token, activityId:assignedP1.activityId
});
assert(allowedResolve.status===200 &&
  allowedResolve.data.attendance.some(r=>r.id===assignedP1.id),
  "Assigned verifier must resolve personal QR for own activity");

const activities=await request("/api/activities","ADM001");
assert(activities.status===200,"Admin activities unavailable");
const other=activities.data.activities.find(a=>!verifierIds.includes(a.id));
assert(other,"Need an unrelated activity for Personal QR negative scope");
const foreignResolve=await request("/api/personal-qr/resolve","STF001","POST",{
  token:qr.data.token, activityId:other.id
});
assert(foreignResolve.status===403 &&
  foreignResolve.data.error==="PERSONAL_QR_ACTIVITY_SCOPE_FORBIDDEN",
  "STAFF resolved personal QR outside assigned activity");

const fullAdminResolve=await request("/api/personal-qr/resolve","ADM001","POST",{
  token:qr.data.token
});
assert(fullAdminResolve.status===200,"ADMIN should retain organization-wide QR resolution");

console.log("S2.1 authorization and data-minimization regression: PASS");
