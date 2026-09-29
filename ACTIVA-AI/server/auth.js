import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db.js";

let googleVerifier=null;
let googleVerifierClientId=null;

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

export function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

export function googleAllowedDomains() {
  return String(process.env.GOOGLE_ALLOWED_DOMAINS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function googleOidcConfigured() {
  return Boolean(googleClientId()) && googleAllowedDomains().length > 0;
}

export function productionAuthenticationReady() {
  return authenticationMode() === "GOOGLE_OIDC" && googleOidcConfigured();
}

function getGoogleVerifier() {
  const clientId=googleClientId();
  if (!clientId) return null;
  if (!googleVerifier || googleVerifierClientId !== clientId) {
    googleVerifier=new OAuth2Client(clientId);
    googleVerifierClientId=clientId;
  }
  return googleVerifier;
}

function bearerToken(req) {
  const value=String(req.header("authorization") || "");
  const match=value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function emailDomain(email) {
  const parts=String(email || "").toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

async function resolveGoogleUser(idToken) {
  const verifier=getGoogleVerifier();
  const clientId=googleClientId();
  const allowedDomains=googleAllowedDomains();

  if (!verifier || !clientId || allowedDomains.length === 0) {
    const error=new Error("GOOGLE_OIDC_NOT_CONFIGURED");
    error.status=503;
    throw error;
  }

  let ticket;
  try {
    ticket=await verifier.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch {
    const error=new Error("GOOGLE_ID_TOKEN_INVALID");
    error.status=401;
    throw error;
  }

  const payload=ticket.getPayload() || {};
  const email=String(payload.email || "").trim().toLowerCase();
  const hd=String(payload.hd || "").trim().toLowerCase();

  if (!email || payload.email_verified !== true) {
    const error=new Error("GOOGLE_EMAIL_NOT_VERIFIED");
    error.status=401;
    throw error;
  }

  const domain=emailDomain(email);
  if (!allowedDomains.includes(domain) || !hd || !allowedDomains.includes(hd)) {
    const error=new Error("GOOGLE_WORKSPACE_DOMAIN_NOT_ALLOWED");
    error.status=403;
    throw error;
  }

  const user=await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
  });

  if (!user) {
    const error=new Error("GOOGLE_ACCOUNT_NOT_PROVISIONED");
    error.status=403;
    throw error;
  }

  if (user.status !== "ACTIVE") {
    const error=new Error("INVALID_OR_INACTIVE_USER");
    error.status=403;
    throw error;
  }

  return {
    user,
    authContext: {
      provider: "GOOGLE",
      subject: payload.sub || null,
      email,
      hostedDomain: hd,
    },
  };
}

export async function attachActor(req, res, next) {
  try {
    const mode=authenticationMode();

    if (mode === "DEMO_HEADER") {
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
      req.authContext = { provider: "DEMO_HEADER" };
      return next();
    }

    if (mode === "GOOGLE_OIDC") {
      const token=bearerToken(req);
      if (!token) {
        return res.status(401).json({
          ok: false,
          error: "GOOGLE_ID_TOKEN_REQUIRED",
        });
      }

      const resolved=await resolveGoogleUser(token);
      req.activaUser=resolved.user;
      req.authContext=resolved.authContext;
      return next();
    }

    return res.status(503).json({
      ok: false,
      error: "PRODUCTION_AUTHENTICATION_NOT_CONFIGURED",
      authenticationMode: mode || "DISABLED",
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        ok: false,
        error: error.message || "AUTHENTICATION_FAILED",
      });
    }
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
