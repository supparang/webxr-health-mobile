import assert from "node:assert/strict";
import { bootstrapConfig, bootstrapAdmin, BootstrapError } from "../scripts/bootstrap-admin.mjs";

const env = {
  ACTIVA_AUTH_MODE: "GOOGLE_OIDC",
  GOOGLE_ALLOWED_DOMAINS: "chandra.ac.th",
  BOOTSTRAP_ADMIN_EMAIL: "Operator@chandra.ac.th",
  BOOTSTRAP_ADMIN_EMPLOYEE_ID: "it001",
  BOOTSTRAP_ADMIN_NAME: "Test Operator",
  BOOTSTRAP_ADMIN_REASON: "Approved first-admin bootstrap test",
};
const config = bootstrapConfig(env, []);
assert.equal(config.email, "operator@chandra.ac.th");
assert.equal(config.employeeId, "IT001");
assert.equal(config.apply, false);
for (const overrides of [
  { ACTIVA_AUTH_MODE: "DEMO_HEADER" },
  { GOOGLE_ALLOWED_DOMAINS: "" },
  { BOOTSTRAP_ADMIN_EMAIL: "operator@gmail.com" },
  { BOOTSTRAP_ADMIN_EMAIL: "operator@chandra.ac.th.attacker.test" },
  { BOOTSTRAP_ADMIN_EMAIL: "operator@chandra.ac.th@attacker.test" },
  { BOOTSTRAP_ADMIN_EMPLOYEE_ID: "" },
  { BOOTSTRAP_ADMIN_REASON: "short" },
]) assert.throws(() => bootstrapConfig({ ...env, ...overrides }, []), BootstrapError);
assert.throws(() => bootstrapConfig(env, ["--force"]), BootstrapError);

function database(matches = [], admins = 0) {
  const writes = [];
  const tx = {
    $executeRaw: async () => 0,
    user: {
      findMany: async () => matches,
      count: async () => admins,
      create: async ({ data }) => { writes.push({ user: data }); return { id: "test-user", ...data }; },
    },
    auditLog: { create: async ({ data }) => { writes.push({ audit: data }); return data; } },
  };
  return { writes, prisma: { $transaction: async (action) => action(tx) } };
}
let db = database();
assert.equal((await bootstrapAdmin(db.prisma, config)).status, "dry-run");
assert.equal(db.writes.length, 0, "Dry run must not create a user or audit entry");
assert.equal((await bootstrapAdmin(db.prisma, { ...config, apply: true })).status, "created");
assert.equal(db.writes.length, 2);
assert.equal(db.writes[0].user.role, "ADMIN");
assert.equal(db.writes[1].audit.action, "ADMIN_BOOTSTRAPPED");
assert.equal(db.writes[1].audit.metadata.reason, config.reason);

const existing = { ...config, role: "ADMIN", status: "ACTIVE" };
db = database([existing], 1);
assert.equal((await bootstrapAdmin(db.prisma, { ...config, apply: true })).status, "already-provisioned");
assert.equal(db.writes.length, 0);
for (const matches of [
  [{ ...existing, role: "PARTICIPANT" }],
  [{ ...existing, status: "INACTIVE" }],
  [{ ...existing, email: "someone.else@chandra.ac.th" }],
  [existing, { ...existing, employeeId: "IT002" }],
]) {
  db = database(matches);
  await assert.rejects(bootstrapAdmin(db.prisma, { ...config, apply: true }), BootstrapError);
  assert.equal(db.writes.length, 0, "Conflicting identities must not be changed");
}
db = database([], 1);
await assert.rejects(bootstrapAdmin(db.prisma, { ...config, apply: true }), BootstrapError);
assert.equal(db.writes.length, 0);
console.log("First-admin bootstrap validation, dry-run, conflict, existing-admin and audit checks passed.");
