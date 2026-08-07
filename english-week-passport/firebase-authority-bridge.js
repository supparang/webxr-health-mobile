(function () {
  "use strict";

  const cfg = window.EW_CONFIG || {};
  const legacy = window.EW_AUTHORITY || {};
  const params = new URLSearchParams(location.search);
  const qaFallbackAllowed = params.get("qa") === "1" && cfg.allowQaDemoFallback === true;
  const READ_ACTIONS = new Set(["health", "profile_lookup", "player_resume", "leaderboard"]);
  const runtime = {
    mode: "configured",
    lastError: "",
    lastSuccessAt: "",
    endpoint: String(cfg.firebaseAuthorityUrl || "").trim(),
    qaFallbackAllowed,
    transport: "read-get/write-post"
  };

  function endpointReady() {
    return /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.cloudfunctions\.net\/englishWeekAuthority(?:\?.*)?$/i.test(runtime.endpoint);
  }

  function emit() {
    window.dispatchEvent(new CustomEvent("ew-authority-status", { detail: { ...runtime } }));
  }

  function decorateFallback(value, reason) {
    if (!value || typeof value !== "object") return value;
    return {
      ...value,
      mode: "demo-fallback",
      sourceOfTruth: "Local QA fallback",
      firebaseError: String(reason || runtime.lastError || "FIREBASE_UNAVAILABLE")
    };
  }

  function buildEnvelope(action, payload) {
    return {
      ...(payload || {}),
      action,
      appId: cfg.appId || "ENGLISH-WEEK-PASSPORT-2026",
      sourceVersion: String(payload?.sourceVersion || cfg.version || "unknown"),
      passportVersion: cfg.version || "unknown"
    };
  }

  async function remote(action, payload) {
    if (!endpointReady()) throw new Error("FIREBASE_AUTHORITY_URL_MISSING");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(cfg.requestTimeoutMs || 12000));
    try {
      const envelope = buildEnvelope(action, payload);
      let response;

      if (READ_ACTIONS.has(action)) {
        const url = new URL(runtime.endpoint);
        Object.entries(envelope).forEach(([key, value]) => {
          if (value !== undefined && value !== null && typeof value !== "object") {
            url.searchParams.set(key, String(value));
          }
        });
        response = await fetch(url.toString(), {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
          redirect: "follow"
        });
      } else {
        response = await fetch(runtime.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EW-App-Id": String(cfg.appId || "ENGLISH-WEEK-PASSPORT-2026")
          },
          body: JSON.stringify(envelope),
          signal: controller.signal,
          cache: "no-store",
          redirect: "follow"
        });
      }

      let data = null;
      try { data = await response.json(); }
      catch (_) { throw new Error(`INVALID_FIREBASE_AUTHORITY_RESPONSE_${response.status}`); }
      if (!response.ok || data?.ok === false) throw new Error(data?.error || `FIREBASE_HTTP_${response.status}`);
      runtime.mode = "firebase";
      runtime.lastError = "";
      runtime.lastSuccessAt = new Date().toISOString();
      emit();
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function withFallback(action, payload, legacyName, legacyArgs) {
    try {
      return await remote(action, payload);
    } catch (error) {
      runtime.mode = "error";
      runtime.lastError = String(error?.message || error);
      emit();
      if (!qaFallbackAllowed || typeof legacy[legacyName] !== "function") throw error;
      const value = await legacy[legacyName](...(legacyArgs || []));
      runtime.mode = "demo-fallback";
      emit();
      return decorateFallback(value, runtime.lastError);
    }
  }

  async function health() {
    return withFallback("health", {}, "health", []);
  }

  async function profileLookup(playerId, nickname) {
    return withFallback("profile_lookup", { playerId, nickname }, "profileLookup", [playerId, nickname]);
  }

  async function resume(playerId, nickname) {
    return withFallback("player_resume", { playerId, nickname }, "resume", [playerId, nickname]);
  }

  async function submitAssessment(payload) {
    return withFallback("submit_assessment", payload, "submitAssessment", [payload]);
  }

  async function submitGame(payload) {
    return withFallback("submit_game_result", payload, "submitGame", [payload]);
  }

  async function submitEvent(payload) {
    return withFallback("submit_event", payload, "submitEvent", [payload]);
  }

  async function leaderboard(limit) {
    return withFallback("leaderboard", { limit }, "leaderboard", [limit]);
  }

  function getRuntimeStatus() {
    return Object.freeze({ ...runtime, endpointReady: endpointReady() });
  }

  window.EW_AUTHORITY = Object.freeze({
    ...(legacy || {}),
    modeName: "firebase-first",
    sourceOfTruth: "Firebase Cloud Authority",
    firebaseProjectId: cfg.firebaseProjectId || "english-d4bfa",
    endpointReady,
    health,
    profileLookup,
    resume,
    submitAssessment,
    submitGame,
    submitEvent,
    leaderboard,
    getRuntimeStatus,
    legacyFallback: legacy
  });

  emit();
}());
