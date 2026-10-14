// ACTIVA-AI S2.4 — opt-in GitHub Issues delivery for high-level security alerts.
// Extends S2.3 structured log events; does not persist or expose identities.
// The GitHub endpoint is FIXED (api.github.com), not a user-configured URL.
// Never place the GitHub token in source control, request logs, issue bodies,
// exceptions or API responses. No outbound calls when the mode is DISABLED.
const ALLOWED_CATEGORIES = new Set([
  "AUTH_DENIED", "ACCESS_DENIED", "RATE_LIMITED", "SERVER_ERROR",
]);

export function securityAlertDeliveryErrors(env = process.env) {
  const errors = [];
  const mode = String(env.ACTIVA_SECURITY_ALERT_MODE || "DISABLED").trim();
  if (!["DISABLED", "GITHUB_ISSUE"].includes(mode)) {
    errors.push("ACTIVA_SECURITY_ALERT_MODE_INVALID");
  }
  if (mode === "GITHUB_ISSUE") {
    const repo = String(env.ACTIVA_SECURITY_ALERT_GITHUB_REPO || "");
    const token = String(env.ACTIVA_SECURITY_ALERT_GITHUB_TOKEN || "");
    const assignee = String(env.ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE || "");
    const repoPart = repo.split("/")[1];
    if (!new RegExp("^[A-Za-z0-9-]{1,39}/[A-Za-z0-9_.-]{1,100}$").test(repo) ||
        repoPart === "." || repoPart === "..") {
      errors.push("ACTIVA_SECURITY_ALERT_GITHUB_REPO_INVALID");
    }
    if (!/^[A-Za-z0-9_-]{20,512}$/.test(token) ||
        /^(?:test|demo|placeholder|change|example|ci-)/i.test(token)) {
      errors.push("ACTIVA_SECURITY_ALERT_GITHUB_TOKEN_REQUIRED");
    }
    if (assignee && !/^[A-Za-z0-9-]{1,39}$/.test(assignee)) {
      errors.push("ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE_INVALID");
    }
  }
  return errors;
}

function safeAlert(alert) {
  if (!alert || alert.type !== "security_alert" ||
      !ALLOWED_CATEGORIES.has(alert.category)) return null;
  const count = Number(alert.count);
  const threshold = Number(alert.threshold);
  const timestamp = Date.parse(alert.timestampUtc);
  if (!Number.isInteger(count) || count < 1 || count > 100000000 ||
      !Number.isInteger(threshold) || threshold < 1 || threshold > 100000000 ||
      !Number.isFinite(timestamp) ||
      count < threshold || alert.periodMinutes !== 15) return null;
  return {
    category: alert.category,
    count,
    threshold,
    timestampUtc: new Date(timestamp).toISOString(),
  };
}

export function createSecurityAlertDispatcher({
  env = process.env,
  fetchImpl = fetch,
  write = (record) => console.warn(JSON.stringify(record)),
} = {}) {
  const errors = securityAlertDeliveryErrors(env);
  if (errors.length) throw new Error("UNSAFE_SECURITY_ALERT_DELIVERY_CONFIGURATION: " + errors.join(","));
  const enabled = String(env.ACTIVA_SECURITY_ALERT_MODE || "DISABLED").trim() === "GITHUB_ISSUE";
  const repo = enabled ? env.ACTIVA_SECURITY_ALERT_GITHUB_REPO : "";
  const assignee = enabled ? String(env.ACTIVA_SECURITY_ALERT_GITHUB_ASSIGNEE || "") : "";
  const token = enabled ? env.ACTIVA_SECURITY_ALERT_GITHUB_TOKEN : "";
  const base = enabled ? "https://api.github.com/repos/" + repo : "";
  const inFlight = new Set();
  let delivered = 0;
  let failed = 0;
  let rejected = 0;

  function getHeaders() {
    return {
      Accept:"application/vnd.github+json",
      Authorization:"Bearer " + token,
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"ACTIVA-AI-security-alert-dispatcher",
      "Content-Type":"application/json",
    };
  }

  async function github(method, route, body) {
    // No redirects to arbitrary destinations that could receive the token.
    const response = await fetchImpl(base + route, {
      method,
      headers:getHeaders(),
      redirect:"error",
      signal:AbortSignal.timeout(4000),
      ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    });
    if (!response || !response.ok) {
      const status = Number(response?.status);
      const error = new Error("GITHUB_DELIVERY_FAILED");
      error.status = Number.isInteger(status) ? status : null;
      throw error;
    }
    return response.json();
  }

  async function deliver(alert) {
    const title = "[SECURITY ALERT] ACTIVA-AI " + alert.category;
    const details = [
      "Automated security anomaly threshold crossed.",
      "",
      "- Category: " + alert.category,
      "- Severity: HIGH",
      "- UTC: " + alert.timestampUtc,
      "- Count in 15 minutes: " + alert.count,
      "- Threshold: " + alert.threshold,
      "",
      "No personal identifiers, IPs, user IDs, tokens or request bodies are included.",
      "An authorized incident responder must investigate the protected provider logs",
      "and the application AuditLog separately. Confirm ownership and close only",
      "after human review. This notification is NOT proof of incident or compromise.",
    ].join("\n");

    // One stable open issue per category; later windows append incident comments.
    // This GET-before-write minimizes duplicate issues; GitHub issue creation
    // is not atomic across multiple instances, so operators must review races.
    const items = await github("GET", "/issues?state=open&per_page=100");
    if (!Array.isArray(items)) throw new Error("GITHUB_DELIVERY_RESPONSE_INVALID");
    const issue = items.find(x => x.title === title &&
      Number.isInteger(x.number) && x.number > 0 && !x.pull_request);
    if (issue) {
      await github("POST", "/issues/" + issue.number + "/comments", {body:details});
      return "COMMENTED";
    }
    await github("POST", "/issues", {
      title,
      body:details,
      ...(assignee ? {assignees:[assignee]} : {}),
    });
    return "CREATED";
  }

  function enqueue(event) {
    const alert = safeAlert(event);
    if (!alert) {
      rejected++;
      return Promise.resolve({status:"REJECTED"});
    }
    if (!enabled) return Promise.resolve({status:"DISABLED"});
    if (inFlight.size >= 4) {
      failed++;
      write({type:"security_alert_delivery",category:alert.category,status:"OVER_CAPACITY"});
      return Promise.resolve({status:"OVER_CAPACITY"});
    }
    const task = Promise.resolve().then(()=>deliver(alert)).then((action)=>{
      delivered++;
      write({type:"security_alert_delivery",category:alert.category,status:"ACKNOWLEDGED_BY_GITHUB",action});
      return {status:"ACKNOWLEDGED_BY_GITHUB",action};
    }).catch(()=>{
      failed++;
      // No error messages; HTTP client messages may contain secret URLs.
      write({type:"security_alert_delivery",category:alert.category,status:"FAILED"});
      return {status:"FAILED"};
    });
    inFlight.add(task);
    void task.finally(()=>inFlight.delete(task));
    return task;
  }

  return {
    enqueue,
    drain:async()=>Promise.all([...inFlight]),
    snapshot:()=>({
      mode:enabled?"GITHUB_ISSUE":"DISABLED",
      configured:enabled,
      delivered,
      failed,
      rejected,
      pending:inFlight.size,
      persistent:false,
      // A GitHub HTTP 2xx is not proof that a human saw a notification.
    }),
  };
}
