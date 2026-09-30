import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { bootstrapAdmin } from "../scripts/bootstrap-admin.mjs";

// This integration test is deliberately restricted to the disposable CI service.
assert.equal(process.env.CI, "true", "Use only the disposable CI database");
assert.equal(process.env.ACTIVA_TEST_DATABASE_ONLY, "true");
const prisma = new PrismaClient();
let createdId;
try {
  assert.equal(await prisma.user.count(), 0, "Fresh migrations must create no identities");
  assert.equal(await prisma.activity.count(), 0, "Fresh migrations must create no activities");
  const config = { email: "ci-bootstrap@chandra.ac.th", employeeId: "CI_BOOTSTRAP", name: "Synthetic CI Operator", reason: "Disposable CI bootstrap integration", apply: false };
  assert.equal((await bootstrapAdmin(prisma, config)).status, "dry-run");
  assert.equal(await prisma.user.count(), 0);
  assert.equal((await bootstrapAdmin(prisma, { ...config, apply: true })).status, "created");
  const user = await prisma.user.findUnique({ where: { employeeId: config.employeeId } });
  createdId = user.id;
  assert.equal(user.role, "ADMIN");
  assert.equal(user.status, "ACTIVE");
  assert.equal(await prisma.auditLog.count({ where: { actorId: user.id, action: "ADMIN_BOOTSTRAPPED" } }), 1);
  assert.equal((await bootstrapAdmin(prisma, { ...config, apply: true })).status, "already-provisioned");
  assert.equal(await prisma.user.count(), 1);
  await assert.rejects(bootstrapAdmin(prisma, { ...config, employeeId: "CI_SECOND", email: "ci-second@chandra.ac.th", apply: true }), /administrator already exists/);
  await assert.rejects(bootstrapAdmin(prisma, { ...config, name: "Changed identity", apply: true }), /Identity conflict/);
  console.log("Fresh PostgreSQL migration and transactional administrator bootstrap passed");
} finally {
  if (createdId) {
    await prisma.auditLog.deleteMany({ where: { actorId: createdId } });
    await prisma.user.delete({ where: { id: createdId } });
  }
  await prisma.$disconnect();
}
