import assert from "node:assert/strict";
import {
  createSecurityMonitor,
  routeTemplateForLog,
} from "../server/security-monitor.js";

// This test uses no database, live credentials, external service or Production API.
let tick = Date.parse("2026-10-14T00:00:00.000Z");
const emitted = [];
const monitor = createSecurityMonitor({
  now:()=>tick,
  write:(record)=>emitted.push(record),
});

const req = {
  path:"/api/users/SECRET-employee-id?token=SECRET-raw-token",
  route:{path:"/api/users/:userId"},
  baseUrl:"",
  method:"GET",
  activaRequestId:"safe-request-0001",
  headers:{authorization:"Bearer SECRET-raw-token"},
};
assert.equal(routeTemplateForLog(req),"/api/users/:userId");
assert.equal(routeTemplateForLog({path:"/api/public/guest/SECRET-token"}),"UNMATCHED_API");
assert.equal(routeTemplateForLog({
  path:"/api/users/alice@example.test", route:{path:"/api/users/:userId"},baseUrl:"",
}),"/api/users/:userId");

// Repeated rejected authentication is counted without logging private details.
for(let i=0;i<25;i++) monitor.recordHttp(req,401);
const summary=monitor.snapshot();
assert.equal(summary.categories.AUTH_DENIED,25);
assert.equal(summary.source,"PROCESS_MEMORY");
assert.equal(summary.persistent,false);
assert.equal(summary.alerts.length,1);
assert.equal(summary.alerts[0].category,"AUTH_DENIED");
assert.equal(summary.alerts[0].threshold,25);
assert.equal(emitted.filter(x=>x.type==="security_alert"&&x.category==="AUTH_DENIED").length,1);
assert.equal(emitted.filter(x=>x.type==="security_event"&&x.category==="AUTH_DENIED").length,8,
  "Per-window event sampling must bound provider log volume");

// Simulate /api-mounted auth middleware: Express req.path becomes "/me"
// during short-circuit, while originalUrl remains the complete original path.
// Query/path values MUST NOT enter logs even though classification sees them.
monitor.recordHttp({
  path:"/me",
  originalUrl:"/api/me?token=SECRET-raw-token",
  method:"GET",
  activaRequestId:"safe-request-mounted",
},401);
assert.equal(monitor.snapshot().categories.AUTH_DENIED,26,
  "API authentication denial inside mounted middleware must be counted");

for(let i=0;i<21;i++) monitor.recordHttp({...req,path:"/api/activities/hidden",route:{path:"/api/activities/:activityId"}},403);
for(let i=0;i<20;i++) monitor.recordHttp({...req,path:"/api/public/guest/checkin",route:{path:"/api/public/guest/checkin"}},429);
for(let i=0;i<10;i++) monitor.recordHttp(req,500);
const events=monitor.snapshot();
assert.equal(events.categories.ACCESS_DENIED,21);
assert.equal(events.categories.RATE_LIMITED,20);
assert.equal(events.categories.SERVER_ERROR,10);
assert.equal(events.alerts.length,4);
assert.equal(emitted.filter(x=>x.type==="security_alert").length,4);

// Successful authenticated requests count, but are NOT incorrectly described
// as successful interactive LOGIN events; there is no server-side login session.
monitor.recordHttp({...req,activaUser:{id:"PRIVATE-user-id"}},200);
monitor.recordHttp({...req},200);
assert.equal(monitor.snapshot().categories.AUTHENTICATED_REQUEST,1);
assert.equal(emitted.some(x=>x.type==="security_event"&&x.category==="AUTHENTICATED_REQUEST"),false);

// Privileged writes are mirrored by action name only; durable Actor/entity
// references remain in the separate existing database AuditLog.
monitor.recordAudit("ACTIVITY_PERMISSION_GRANTED",{activaRequestId:"safe-request-0002",
  activaUser:{id:"PRIVATE-actor"},body:{token:"SECRET-raw-token"}});
monitor.recordAudit("USER_STATUS_CHANGED",{activaRequestId:"safe-request-0003"});
monitor.recordAudit("MODEL_DEPLOYED",{activaRequestId:"safe-request-0004"});
monitor.recordAudit("PERSONAL_QR_RESOLVED",{activaRequestId:"safe-request-0005"});
assert.equal(monitor.snapshot().categories.PERMISSION_CHANGE,1);
assert.equal(monitor.snapshot().categories.ACCOUNT_CHANGE,1);
assert.equal(monitor.snapshot().categories.PRIVILEGED_ACTION,1);
assert.equal(emitted.some(x=>x.action==="PERSONAL_QR_RESOLVED"),false,
  "Non-critical personal QR lookup remains in database AuditLog only");

// Guard against personally identifying information and bearer leakage in all
// operational security telemetry, including the ADMIN aggregate response.
const payload=JSON.stringify({events:emitted,summary:monitor.snapshot()});
for(const secret of [
  "SECRET-employee-id","SECRET-raw-token","PRIVATE-user-id",
  "PRIVATE-actor","alice@example.test","authorization","192.0.2.",
]) {
  assert.equal(payload.includes(secret),false,"Private data leaked: "+secret);
}
assert.equal(payload.includes("/api/users/:userId"),true);

// Period boundary clears volatile counters and alert history, not durable AuditLog.
tick+=15*60*1000;
const next=monitor.snapshot();
assert.equal(next.categories.AUTH_DENIED,0);
assert.equal(next.categories.ACCESS_DENIED,0);
assert.equal(next.alerts.length,0);
assert.equal(next.persistent,false);
console.log("ACTIVA-AI S2.3 security observability checks: PASS");
