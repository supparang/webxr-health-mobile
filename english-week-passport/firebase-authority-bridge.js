(function () {
  "use strict";

  const VERSION = "2026-08-08-SPARK-DIRECT-COMPAT-BRIDGE-V2-MOBILE-RACE-FIX";
  const legacy = window.EW_AUTHORITY || {};
  const runtime = {
    mode: "loading",
    lastError: "",
    lastSuccessAt: "",
    projectId: "englishweek-95869",
    transport: "firebase-web-sdk-firestore-direct"
  };

  function emit() {
    window.dispatchEvent(new CustomEvent("ew-authority-status", {
      detail: { ...runtime, endpointReady: true }
    }));
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function waitUntilReady(readyTest, timeoutMs, label) {
    if (!readyTest) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        if (readyTest()) return true;
      } catch (_) {}
      await sleep(50);
    }
    throw new Error("SCRIPT_READY_TIMEOUT: " + label);
  }

  function loadScript(src, readyTest) {
    if (readyTest) {
      try { if (readyTest()) return Promise.resolve(); } catch (_) {}
    }

    const key = src.split("?")[0];
    const existing = [...document.scripts].find(s => s.src && s.src.includes(key));

    // Mobile race fix: if the script tag already exists, its load event may have
    // fired before this bridge attached a listener. Never wait only for `load`.
    // Poll the actual readiness condition with a bounded timeout instead.
    if (existing) {
      return waitUntilReady(readyTest, 8000, key);
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("SCRIPT_LOAD_TIMEOUT: " + src));
      }, 10000);

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn(value);
      }

      script.src = src;
      script.async = false;
      script.onload = async () => {
        try {
          await waitUntilReady(readyTest, 5000, key);
          finish(resolve);
        } catch (error) {
          finish(reject, error);
        }
      };
      script.onerror = () => finish(reject, new Error("SCRIPT_LOAD_FAILED: " + src));
      document.head.appendChild(script);
    });
  }

  async function bootstrapCore() {
    await loadScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
      () => Boolean(window.firebase && firebase.initializeApp)
    );
    await Promise.all([
      loadScript(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
        () => Boolean(window.firebase && firebase.auth)
      ),
      loadScript(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js",
        () => Boolean(window.firebase && firebase.firestore)
      )
    ]);
    await loadScript(
      "./firebase-web-config.js?v=20260807-englishweek95869-r2",
      () => Boolean(window.EW_FIREBASE_WEB_CONFIG?.projectId === "englishweek-95869")
    );
    await loadScript(
      "./firestore-direct-authority-v1.js?v=20260807-direct2",
      () => Boolean(window.EW_AUTHORITY?.directFirestoreVersion)
    );

    const direct = window.EW_AUTHORITY;
    if (!direct?.submitGame || !direct?.resume) {
      throw new Error("DIRECT_FIRESTORE_AUTHORITY_NOT_READY");
    }
    return direct;
  }

  async function bootstrap() {
    try {
      const direct = await Promise.race([
        bootstrapCore(),
        new Promise((_, reject) => setTimeout(
          () => reject(new Error("FIREBASE_BRIDGE_BOOTSTRAP_TIMEOUT")),
          15000
        ))
      ]);
      runtime.mode = "firebase";
      runtime.lastError = "";
      runtime.lastSuccessAt = new Date().toISOString();
      runtime.projectId = direct.firebaseProjectId || "englishweek-95869";
      emit();
      return direct;
    } catch (error) {
      runtime.mode = "error";
      runtime.lastError = String(error?.message || error);
      emit();
      throw error;
    }
  }

  const readyPromise = bootstrap();

  async function call(name, args) {
    const direct = await Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("FIREBASE_AUTHORITY_READY_TIMEOUT")),
        16000
      ))
    ]);
    if (typeof direct?.[name] !== "function") throw new Error("DIRECT_METHOD_MISSING: " + name);
    return direct[name](...(args || []));
  }

  function endpointReady() { return true; }
  function getRuntimeStatus() {
    const directStatus = window.EW_AUTHORITY?.directFirestoreVersion
      ? window.EW_AUTHORITY.getRuntimeStatus?.()
      : null;
    return Object.freeze({
      ...runtime,
      ...(directStatus || {}),
      endpointReady: true,
      bridgeVersion: VERSION
    });
  }

  const proxy = Object.freeze({
    ...(legacy || {}),
    modeName: "firestore-direct-compat",
    sourceOfTruth: "Cloud Firestore Direct Authority",
    firebaseProjectId: "englishweek-95869",
    endpointReady,
    health: (...args) => call("health", args),
    profileLookup: (...args) => call("profileLookup", args),
    resume: (...args) => call("resume", args),
    submitAssessment: (...args) => call("submitAssessment", args),
    submitGame: (...args) => call("submitGame", args),
    submitEvent: (...args) => call("submitEvent", args),
    leaderboard: (...args) => call("leaderboard", args),
    saveAssessmentCheckpoint: (...args) => call("saveAssessmentCheckpoint", args),
    getAssessmentCheckpoint: (...args) => call("getAssessmentCheckpoint", args),
    clearAssessmentCheckpoint: (...args) => call("clearAssessmentCheckpoint", args),
    getRuntimeStatus,
    compatibilityBridgeVersion: VERSION
  });

  window.EW_AUTHORITY = proxy;
  emit();
}());
