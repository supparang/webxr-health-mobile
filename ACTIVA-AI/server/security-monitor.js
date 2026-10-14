// ACTIVA-AI S2.3 — privacy-preserving, process-local security telemetry.
// Does not replace database AuditLog, provider log retention, SIEM, or alert delivery.
// NEVER include bearer/QR tokens, user or employee IDs, emails, IPs, request bodies,
// response bodies, query strings or raw user-supplied request paths in emitted events.
const WINDOW_MS = 15 * 60 * 1000;
const SAMPLED_EVENTS_PER_CATEGORY = 8;
const CATEGORIES = Object.freeze([
  "AUTH_DENIED", "ACCESS_DENIED", "RATE_LIMITED", "SERVER_ERROR",
  "ACCOUNT_CHANGE", "PERMISSION_CHANGE", "PRIVILEGED_ACTION",
  "AUTHENTICATED_REQUEST",
]);
const ALERT_THRESHOLDS = Object.freeze({
  AUTH_DENIED: 25,
  ACCESS_DENIED: 20,
  RATE_LIMITED: 20,
  SERVER_ERROR: 10,
});

export function routeTemplateForLog(req) {
  // A route template is authored by this server; req.path is not trusted,
  // because raw paths can contain participant identifiers or guest tokens.
  const template = req?.route?.path;
  const base = req?.baseUrl || "";
  const candidate = typeof template === "string" ? String(base) + template : "";
  if (candidate.startsWith("/api/") &&
      candidate.length <= 160 &&
      /^\/[A-Za-z0-9_:/.-]+$/.test(candidate)) return candidate;
  return "UNMATCHED_API";
}

function scopeFor(req) {
  // originalUrl survives Express mount rewriting (e.g. attachActor mounted at /api).
  // It is used only for classification and is NEVER written to logs.
  const path = String(req?.originalUrl || req?.path || "");
  if (path.startsWith("/api/public/guest/")) return "GUEST";
  if (path.startsWith("/api/public/blind-review/")) return "BLIND_REVIEW";
  return "ORGANIZATION";
}

function classifyAuditAction(action) {
  const value = String(action || "");
  if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(value)) return null;
  if (/^ACTIVITY_PERMISSION_|^CO_ORGANIZER_|^ACTIVITY_ASSIGNMENTS_UPDATED$/.test(value)) {
    return "PERMISSION_CHANGE";
  }
  if (/^USER_(?:CREATED|UPDATED|STATUS_CHANGED|IMPORT)$/.test(value)) {
    return "ACCOUNT_CHANGE";
  }
  if (/^MODEL_(?:APPROVED|DEPLOYED)$|^ACTIVITY_PILOT_CLOSED$|^BACKUP_EXPORTED$|^PERSONAL_QR_REISSUED$|^EXTERNAL_BLIND_REVIEW_BATCH_CREATED$/.test(value)) {
    return "PRIVILEGED_ACTION";
  }
  return null;
}

export function createSecurityMonitor({
  now = Date.now,
  write = (event) => console.warn(JSON.stringify(event)),
  thresholds = ALERT_THRESHOLDS,
} = {}) {
  if (typeof now !== "function" || typeof write !== "function") {
    throw new TypeError("SECURITY_MONITOR_INVALID_CONFIG");
  }

  // At most one fixed-window aggregate is held. No per-user/IP/token state.
  let windowStart = null;
  let counts = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));
  let samples = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));
  let alertFired = new Set();
  let alerts = [];

  function resetIfNeeded(timestamp) {
    const newStart = Math.floor(timestamp / WINDOW_MS) * WINDOW_MS;
    if (windowStart !== newStart) {
      windowStart = newStart;
      counts = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));
      samples = Object.fromEntries(CATEGORIES.map((name) => [name, 0]));
      alertFired = new Set();
      alerts = [];
    }
  }

  function push(category, details = {}) {
    if (!CATEGORIES.includes(category)) return;
    const timestamp = now();
    resetIfNeeded(timestamp);
    counts[category] += 1;
    const count = counts[category];
    const base = {
      timestampUtc: new Date(timestamp).toISOString(),
      category,
      // These fields are generated/controlled server-side; no raw metadata.
      ...details,
    };
    if (category !== "AUTHENTICATED_REQUEST" &&
        samples[category] < SAMPLED_EVENTS_PER_CATEGORY) {
      samples[category]++;
      write({type:"security_event", ...base});
    }
    const threshold = thresholds[category];
    if (Number.isInteger(threshold) && threshold > 0 &&
        count >= threshold && !alertFired.has(category)) {
      alertFired.add(category);
      const alert = {
        type: "security_alert",
        timestampUtc: base.timestampUtc,
        category,
        count,
        threshold,
        periodMinutes: 15,
        severity: "HIGH",
      };
      alerts.push(alert);
      write(alert);
    }
  }

  return {
    recordHttp(req, statusCode) {
      if (!req || typeof statusCode !== "number" ||
          !String(req.originalUrl || req.path || "").startsWith("/api/")) return;
      const category = statusCode === 401 ? "AUTH_DENIED"
        : statusCode === 403 ? "ACCESS_DENIED"
        : statusCode === 429 ? "RATE_LIMITED"
        : statusCode >= 500 ? "SERVER_ERROR"
        : statusCode >= 200 && statusCode < 400 && req.activaUser
          ? "AUTHENTICATED_REQUEST" : null;
      if (!category) return;
      const details = category === "AUTHENTICATED_REQUEST" ? {} : {
        method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)
          ? req.method : "OTHER",
        route: routeTemplateForLog(req),
        scope: scopeFor(req),
        status: statusCode,
        // The ID is validated/assigned by the request-ID middleware.
        requestId: req.activaRequestId || null,
      };
      push(category, details);
    },
    recordAudit(action, req) {
      const category = classifyAuditAction(action);
      if (!category) return;
      push(category, {
        action: String(action),
        requestId: req?.activaRequestId || null,
      });
    },
    snapshot() {
      const timestamp = now();
      resetIfNeeded(timestamp);
      return {
        windowMinutes: 15,
        windowStartUtc: new Date(windowStart).toISOString(),
        asOfUtc: new Date(timestamp).toISOString(),
        source: "PROCESS_MEMORY",
        persistent: false,
        categories: { ...counts },
        alerts: alerts.map((alert) => ({
          category: alert.category,
          count: alert.count,
          threshold: alert.threshold,
          severity: alert.severity,
          timestampUtc: alert.timestampUtc,
        })),
      };
    },
  };
}
