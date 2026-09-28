import { prisma } from "./db.js";

export async function resolveUserRef(ref) {
  if (!ref) return null;
  return prisma.user.findFirst({
    where: {
      OR: [{ id: String(ref) }, { employeeId: String(ref).toUpperCase() }],
    },
  });
}

export function authenticationMode() {
  return String(process.env.ACTIVA_AUTH_MODE || "DISABLED").trim().toUpperCase();
}

const IMPLEMENTED_PRODUCTION_AUTH_MODES = new Set([]);

export function productionAuthenticationReady() {
  return IMPLEMENTED_PRODUCTION_AUTH_MODES.has(authenticationMode());
}

export async function attachActor(req, res, next) {
  try {
    const mode=authenticationMode();

    if (mode !== "DEMO_HEADER") {
      return res.status(503).json({
        ok: false,
        error: "PRODUCTION_AUTHENTICATION_NOT_CONFIGURED",
        authenticationMode: mode || "DISABLED",
      });
    }

    const ref = req.header("x-activa-user-id");
    if (!ref) {
      return res.status(401).json({
        ok: false,
        error: "X_ACTIVA_USER_ID_REQUIRED",
      });
    }

    const user = await resolveUserRef(ref);
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        ok: false,
        error: "INVALID_OR_INACTIVE_USER",
      });
    }

    req.activaUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.activaUser) {
      return res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
    }
    if (!roles.includes(req.activaUser.role)) {
      return res.status(403).json({
        ok: false,
        error: "FORBIDDEN",
        requiredRoles: roles,
      });
    }
    next();
  };
}
