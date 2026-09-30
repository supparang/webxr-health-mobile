import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db.js";
import { validGoogleClientId, validGoogleDomain, validGoogleEmail } from "./google-config.js";

let googleVerifier=null;
let googleVerifierAudienceKey="";

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

export function googlePilotClientId() {
  return String(process.env.GOOGLE_PILOT_CLIENT_ID || "").trim();
}

export function googleClientIds() {
  return [...new Set([googleClientId(), googlePilotClientId()].filter(validGoogleClientId))];
}

export function googleAllowedDomains() {
  return String(process.env.GOOGLE_ALLOWED_DOMAINS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function googleAllowedEmails() {
  return [...new Set(
    String(process.env.GOOGLE_ALLOWED_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function googleOidcConfigured() {
  const clientId=googleClientId();
  const pilotClientId=googlePilotClientId();
  const domains=googleAllowedDomains();
  const emails=googleAllowedEmails();

  const allowlistsValid=domains.every(validGoogleDomain) && emails.every(validGoogleEmail);
  if (!allowlistsValid) return false;

  // Production/organization route remains bound to GOOGLE_CLIENT_ID.
  // Personal Gmail pilot accounts are accepted only when a separate
  // GOOGLE_PILOT_CLIENT_ID is configured; the Internal client is never reused.
  const workspaceRouteReady=domains.length > 0 && validGoogleClientId(clientId);
  const pilotEmailRouteReady=emails.length > 0 && validGoogleClientId(pilotClientId);
  return workspaceRouteReady || pilotEmailRouteReady;
}

export function googlePilotEmailReady() {
  return googleAllowedEmails().length > 0 && validGoogleClientId(googlePilotClientId());
}

export function productionAuthenticationReady() {
  return authenticationMode() === "GOOGLE_OIDC" && googleOidcConfigured();
}

function getGoogleVerifier() {
  const audiences=googleClientIds();
  if (!audiences.length) return null;
  const key=audiences.join("|");
  if (!googleVerifier || googleVerifierAudienceKey !== key) {
    googleVerifier=new OAuth2Client(audiences[0]);
    googleVerifierAudienceKey=key;
  }
  return googleVerifier;
}

function bearerToken(req) {
  const value=String(req.header("authorization") || "");
  const match=value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function emailDomain(email) {
  const match=email.match(/^[^\s@]+@([^\s@]+)$/);
  return match ? match[1] : "";
}

async function resolveGoogleUser(idToken) {
  const clientId=googleClientId();
  const pilotClientId=googlePilotClientId();
  const clientIds=googleClientIds();
  const allowedDomains=googleAllowedDomains();
  const allowedEmails=googleAllowedEmails();

  if (!googleOidcConfigured()) {
    const error=new Error("GOOGLE_OIDC_NOT_CONFIGURED");
    error.status=503;
    throw error;
  }

  let ticket;
  try {
    const verifier=getGoogleVerifier();
    // The Google library validates the signature, issuer, audience and lifetime.
    // Only trust claims obtained from this verified ticket.
    ticket=await verifier.verifyIdToken({
      idToken,
      audience: clientIds,
    });
  } catch {
    const error=new Error("GOOGLE_ID_TOKEN_INVALID");
    error.status=401;
    throw error;
  }

  const payload=ticket.getPayload() || {};
  const email=typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const hd=typeof payload.hd === "string" ? payload.hd.trim().toLowerCase() : "";

  if (typeof payload.sub !== "string" || !payload.sub.trim() || payload.sub.length > 255) {
    const error=new Error("GOOGLE_ID_TOKEN_INVALID");
    error.status=401;
    throw error;
  }

  if (!email || payload.email_verified !== true) {
    const error=new Error("GOOGLE_EMAIL_NOT_VERIFIED");
    error.status=401;
    throw error;
  }

  const domain=emailDomain(email);
  const tokenAudience=typeof payload.aud === "string" ? payload.aud : "";
  const workspaceAllowed=Boolean(
    tokenAudience === clientId &&
    domain && hd &&
    allowedDomains.includes(domain) &&
    allowedDomains.includes(hd)
  );
  const exactEmailAllowed=Boolean(
    pilotClientId &&
    tokenAudience === pilotClientId &&
    allowedEmails.includes(email)
  );

  if (!workspaceAllowed && !exactEmailAllowed) {
    if (allowedEmails.includes(email) && !validGoogleClientId(pilotClientId)) {
      const error=new Error("GOOGLE_PILOT_LOGIN_NOT_CONFIGURED");
      error.status=503;
      throw error;
    }
    const error=new Error(
      allowedEmails.length > 0 ? "GOOGLE_ACCOUNT_NOT_ALLOWED" : "GOOGLE_WORKSPACE_DOMAIN_NOT_ALLOWED"
    );
    error.status=403;
    throw error;
  }

  // PostgreSQL's email uniqueness is case-sensitive; authentication is not.
  // Reject ambiguous provisioned accounts rather than choosing an arbitrary role.
  const users=await prisma.user.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    take: 2,
  });

  if (users.length === 0) {
    const error=new Error("GOOGLE_ACCOUNT_NOT_PROVISIONED");
    error.status=403;
    throw error;
  }

  if (users.length !== 1) {
    const error=new Error("GOOGLE_ACCOUNT_AMBIGUOUS");
    error.status=403;
    throw error;
  }
  const [user]=users;

  if (user.status !== "ACTIVE") {
    const error=new Error("INVALID_OR_INACTIVE_USER");
    error.status=403;
    throw error;
  }

  return {
    user,
    authContext: {
      provider: "GOOGLE",
      subject: payload.sub,
      email,
      hostedDomain: hd,
    },
  };
}

export async function attachActor(req, res, next) {
  try {
    const mode=authenticationMode();

    if (mode === "DEMO_HEADER") {
      if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
        return res.status(503).json({
          ok: false,
          error: "DEMO_HEADER_FORBIDDEN_IN_PRODUCTION",
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
