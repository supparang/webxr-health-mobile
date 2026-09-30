import "dotenv/config";
import { pathToFileURL } from "node:url";

export class BootstrapError extends Error {}

export function bootstrapConfig(env = process.env, args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== "--apply")) {
    throw new BootstrapError("Only --apply is accepted. Supply identity fields through the private environment.");
  }
  if (String(env.ACTIVA_AUTH_MODE || "").trim().toUpperCase() !== "GOOGLE_OIDC") {
    throw new BootstrapError("First-admin provisioning requires ACTIVA_AUTH_MODE=GOOGLE_OIDC.");
  }
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const employeeId = String(env.BOOTSTRAP_ADMIN_EMPLOYEE_ID || "").trim().toUpperCase();
  const name = String(env.BOOTSTRAP_ADMIN_NAME || "").trim();
  const reason = String(env.BOOTSTRAP_ADMIN_REASON || "").trim();
  const domains = String(env.GOOGLE_ALLOWED_DOMAINS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || !domains.includes(email.split("@")[1])) {
    throw new BootstrapError("BOOTSTRAP_ADMIN_EMAIL must be a real approved Workspace email in GOOGLE_ALLOWED_DOMAINS.");
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(employeeId)) {
    throw new BootstrapError("BOOTSTRAP_ADMIN_EMPLOYEE_ID must contain 2–64 letters, digits, underscores or hyphens.");
  }
  if (name.length < 2 || name.length > 200 || reason.length < 10 || reason.length > 1000) {
    throw new BootstrapError("Provide BOOTSTRAP_ADMIN_NAME (2–200 characters) and BOOTSTRAP_ADMIN_REASON (10–1000 characters).");
  }
  return { email, employeeId, name, reason, apply: args.includes("--apply") };
}

// This command only creates the first administrator; later users are managed by
// the authenticated administrator. Never upgrade an existing personnel record.
export async function bootstrapAdmin(prisma, config) {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent invocations of this bootstrap command.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1730481515)`;
    const matches = await tx.user.findMany({
      where: { OR: [{ employeeId: config.employeeId }, { email: { equals: config.email, mode: "insensitive" } }] },
    });
    if (matches.length) {
      const same = matches.length === 1 && matches[0].employeeId === config.employeeId &&
        matches[0].email?.toLowerCase() === config.email && matches[0].name === config.name &&
        matches[0].role === "ADMIN" && matches[0].status === "ACTIVE";
      if (!same) throw new BootstrapError("Identity conflict: no existing user was changed or granted access.");
      return { status: "already-provisioned", changed: false };
    }
    if (await tx.user.count({ where: { role: "ADMIN" } })) {
      throw new BootstrapError("An administrator already exists. Use authenticated user administration; bootstrap is closed.");
    }
    if (!config.apply) return { status: "dry-run", changed: false };
    const user = await tx.user.create({
      data: { employeeId: config.employeeId, email: config.email, name: config.name, role: "ADMIN", status: "ACTIVE" },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "ADMIN_BOOTSTRAPPED",
        entityType: "User",
        entityId: user.id,
        metadata: { source: "operator-bootstrap-cli", reason: config.reason, authenticationMode: "GOOGLE_OIDC", firstAdminOnly: true },
      },
    });
    return { status: "created", changed: true };
  });
}

async function main() {
  const config = bootstrapConfig();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const result = await bootstrapAdmin(prisma, config);
    console.log(JSON.stringify({ ...result, email: config.email, employeeId: config.employeeId, role: "ADMIN" }));
    if (!config.apply) console.log("Dry run only. Review the identity, then rerun with --apply to create the first administrator.");
    console.log("No release decision was made. Keep Production GO on HOLD.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof BootstrapError ? error.message : "Bootstrap failed. Check private database connectivity and applied migrations; no credentials are printed.");
    process.exitCode = 1;
  });
}
