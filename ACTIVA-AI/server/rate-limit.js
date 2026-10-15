// ACTIVA-AI S2.2 — bounded, per-process API throttling.
// NOTE: This is defense in depth for a *single Node.js process*. Multi-instance
// deployments must add an edge/distributed limiter before Production acceptance.
import crypto from "node:crypto";
import {createDistributedWindowLimiter,createPostgresWindowStore,distributedRateLimitEnabled,distributedRateLimitConfigErrors} from "./distributed-rate-limit.js";

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 25_000;
const EXEMPT_PROBES = new Set(["/live", "/ready", "/health"]);

function intWithin(value, fallback, min, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

// Fail closed: Production must never opt out of application throttling.
export function rateLimitingEnabled(env = process.env) {
  return env.NODE_ENV === "production"
    ? true
    : env.ACTIVA_RATE_LIMIT_ENABLED === "true";
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sourceIp(req) {
  // Express req.ip uses the socket peer by default; X-Forwarded-For MUST NOT
  // be trusted unless a reviewed, trusted proxy topology is configured.
  return String(req.ip || req.socket?.remoteAddress || "unknown").trim().slice(0, 160);
}

function bearerFingerprint(req, scheme) {
  const authorization = String(req.get?.("authorization") || "");
  const match = authorization.match(new RegExp("^" + scheme + "\\s+([A-Za-z0-9_-]{32,256})$", "i"));
  return match ? digest(match[1]) : null;
}

/**
 * Fixed-window rate limiter with bounded in-memory state, no timers and no PII
 * in logs. All limits are per process, not cluster-global.
 */
export function createFixedWindowLimiter({
  category,
  limit,
  windowMs = WINDOW_MS,
  keyFor,
  skip = () => false,
  now = Date.now,
  capacity = MAX_BUCKETS,
}) {
  if (typeof keyFor !== "function" || typeof now !== "function" ||
      !Number.isInteger(limit) || limit <= 0 ||
      !Number.isInteger(windowMs) || windowMs <= 0 ||
      !Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("RATE_LIMIT_INVALID_CONFIGURATION");
  }

  const windows = new Map();
  let lastCleanup = 0;

  return function limitRequest(req, res, next) {
    if (skip(req)) return next();
    const key = keyFor(req);
    if (!key) return next(); // Only applicable to a known actor/token.
    const timestamp = now();
    if (timestamp - lastCleanup >= windowMs || timestamp < lastCleanup) {
      for (const [id, entry] of windows) {
        if (entry.resetAt <= timestamp) windows.delete(id);
      }
      lastCleanup = timestamp;
    }

    let entry = windows.get(key);
    if (!entry && windows.size >= capacity) {
      // Do not evict live buckets: that would allow evasion under key flooding.
      console.warn(JSON.stringify({
        type: "security_rate_limit_capacity",
        category,
        requestId: req.activaRequestId || null,
      }));
      return res.status(503).json({ ok: false, error: "RATE_LIMIT_CAPACITY_EXCEEDED" });
    }
    if (!entry || timestamp >= entry.resetAt) {
      entry = { count: 0, resetAt: timestamp + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    if (entry.count <= limit) return next();

    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000));
    res.set("Retry-After", String(retryAfterSeconds));
    res.set("Cache-Control", "no-store");
    console.warn(JSON.stringify({
      type: "security_rate_limited",
      category,
      requestId: req.activaRequestId || null,
      // Deliberately no source IP, bearer hash, token, employee ID or email.
    }));
    return res.status(429).json({
      ok: false,
      error: "RATE_LIMITED",
      retryAfterSeconds,
    });
  };
}

export function createActivaRateLimiters(env = process.env, now = Date.now, {prisma} = {}) {
  const enabled = rateLimitingEnabled(env);
  const modeErrors = distributedRateLimitConfigErrors(env);
  if(modeErrors.length)throw Error("UNSAFE_RATE_LIMIT_CONFIGURATION: "+modeErrors.join(","));
  const distributed = distributedRateLimitEnabled(env);
  const store = enabled && distributed
    ? createPostgresWindowStore({prisma,secret:env.ACTIVA_RATE_LIMIT_HMAC_SECRET,clock:now})
    : null;
  const passthrough = (_req, _res, next) => next();
  if (!enabled) {
    return {
      enabled: false,
      perIp: passthrough,
      guestIp: passthrough,
      guestPass: passthrough,
      reviewerIp: passthrough,
      reviewerPass: passthrough,
      authenticated: passthrough,
      authenticatedWrite: passthrough,
    };
  }

  const create = (category,defaultLimit,keyFor,skip) => {
    const params={
      category,
      limit:intWithin(env["ACTIVA_RATE_LIMIT_"+category.toUpperCase()],defaultLimit,1,100_000),
      keyFor,skip,now,
    };
    return distributed
      ? createDistributedWindowLimiter({...params,store})
      : createFixedWindowLimiter(params);
  };

  return {
    enabled: true,
    // Fair to large classrooms behind a shared NAT; fine-grained limits below.
    perIp: create("all_ip", 3_000, (req) => "all:" + sourceIp(req),
      (req) => EXEMPT_PROBES.has(req.path)),
    guestIp: create("guest_ip", 900, (req) => "guest-ip:" + sourceIp(req)),
    guestPass: create("guest_pass", 36, (req) => {
      const hash = bearerFingerprint(req, "GuestPass");
      return hash ? "guest-token:" + hash : null;
    }),
    reviewerIp: create("reviewer_ip", 300, (req) => "reviewer-ip:" + sourceIp(req)),
    reviewerPass: create("reviewer_pass", 36, (req) => {
      const hash = bearerFingerprint(req, "BlindReview");
      return hash ? "reviewer-token:" + hash : null;
    }),
    authenticated: create("actor", 600, (req) =>
      req.activaUser?.id ? "actor:" + req.activaUser.id : null),
    authenticatedWrite: create("actor_write", 180, (req) =>
      req.activaUser?.id ? "actor-write:" + req.activaUser.id : null,
      (req) => !["POST", "PUT", "PATCH", "DELETE"].includes(req.method)),
  };
}
