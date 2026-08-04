const params = new URLSearchParams(location.search);
const mode = String(params.get("authority") || "sheet").toLowerCase();
const enabled = mode === "firebase" || mode === "dual";
const studentIdFromUrl = String(params.get("studentId") || params.get("pid") || params.get("sid") || "").trim();
const STATE_KEY = "herohealth_learning_platform_rc2";
const ACTIVE_STUDENT_KEY = "herohealth_active_student_id";
const RELOAD_KEY = "hh_firebase_passport_seed_v1";
const SHEET_RESUME_VERSION = "20260730-MOBILE-AUTHORITY-V8.3-SYNTAX-FIX";

if (enabled) {
  suppressSheetResume(studentIdFromUrl);
  installAuthorityBadge();
  window.addEventListener("hh:firebase-authority-ready", applyAuthority, { once: true });
  window.addEventListener("hh:firebase-authority-error", showAuthorityError, { once: true });
  import("./firebase-authority-bridge.js").catch((error) => {
    showAuthorityError({ detail: { error: error?.message || String(error) } });
  });
}

function suppressSheetResume(studentId) {
  document.documentElement.dataset.hhAuthority = mode;
  window.HH_AUTHORITY_MODE = mode;
  window.HH_DISABLE_SHEET_RESUME = mode === "firebase";

  if (mode !== "firebase" || !studentId) return;

  try {
    localStorage.setItem(`hh_authority_version_synced:${studentId}`, SHEET_RESUME_VERSION);
    sessionStorage.setItem(`hh_authority_bootstrap:${studentId}`, String(Date.now()));
  } catch (_) {}

  // Hide the legacy Sheet blocker even if an older authority module recreates it.
  const style = document.createElement("style");
  style.id = "hh-firebase-hide-sheet-overlay";
  style.textContent = `
    html[data-hh-authority="firebase"] #hh-sheet-login-status { display:none!important; visibility:hidden!important; pointer-events:none!important; }
    html[data-hh-authority="firebase"][data-hh-login-busy="1"] body { overflow:auto!important; }
  `;
  document.head.appendChild(style);

  const removeSheetOverlay = () => {
    document.querySelectorAll("#hh-sheet-login-status").forEach((node) => node.remove());
    document.documentElement.dataset.hhLoginBusy = "0";
  };

  removeSheetOverlay();
  const observer = new MutationObserver(removeSheetOverlay);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-hh-login-busy"] });
  window.__HH_FIREBASE_SHEET_OVERLAY_OBSERVER__ = observer;
  window.__HH_FIREBASE_REMOVE_SHEET_OVERLAY__ = removeSheetOverlay;
  setInterval(removeSheetOverlay, 120);

  const patchResumeApi = () => {
    const api = window.HHStudentResume;
    if (!api || api.__firebaseGuarded) return false;
    const skipped = async () => ({ ok: false, skipped: true, authority: "firebase" });
    try {
      api.syncOfficial = skipped;
      api.login = skipped;
      api.getStudent = skipped;
      api.reconcile = skipped;
      api.__firebaseGuarded = true;
    } catch (_) {}
    return true;
  };
  if (!patchResumeApi()) {
    const timer = setInterval(() => {
      if (patchResumeApi()) clearInterval(timer);
    }, 20);
    setTimeout(() => clearInterval(timer), 10000);
  }
}

function normalizeZone(value) {
  const zone = String(value || "hygiene").toLowerCase();
  return ["hygiene", "nutrition", "fitness", "posttest", "reflection", "certificate"].includes(zone)
    ? zone
    : "hygiene";
}

function completionForZone(zone) {
  const completed = {
    pretest: true,
    hygiene: false,
    nutrition: false,
    fitness: false,
    posttest: false,
    reflection: false
  };
  if (["nutrition", "fitness", "posttest", "reflection", "certificate"].includes(zone)) completed.hygiene = true;
  if (["fitness", "posttest", "reflection", "certificate"].includes(zone)) completed.nutrition = true;
  if (["posttest", "reflection", "certificate"].includes(zone)) completed.fitness = true;
  if (["reflection", "certificate"].includes(zone)) completed.posttest = true;
  if (zone === "certificate") completed.reflection = true;
  return completed;
}

function profileFromRoster(roster, studentId) {
  const group = String(roster?.rotationGroup || roster?.group || "A").toUpperCase();
  return {
    studentId,
    fullName: roster?.fullName || roster?.nickname || `นักเรียน ${studentId}`,
    nickname: roster?.nickname || "",
    section: roster?.section || roster?.classId || "herohealth-pilot-2026",
    group,
    active: roster?.active !== false,
    authority: "firebase"
  };
}

function mergeFirebaseState(current, authority) {
  const studentId = authority.studentId;
  const roster = authority.roster || {};
  const progress = authority.progress || {};
  const zone = normalizeZone(progress.currentZone);
  const profile = profileFromRoster(roster, studentId);
  const base = current && typeof current === "object" ? current : {};

  return {
    ...base,
    profile,
    pendingProfile: null,
    view: "student",
    group: profile.group,
    completed: {
      ...(base.completed || {}),
      ...completionForZone(zone),
      ...(progress.completed || {})
    },
    scores: { ...(base.scores || {}), ...(progress.scores || {}) },
    gameCompleted: {
      hygiene: { ...(base.gameCompleted?.hygiene || {}), ...(progress.gameCompleted?.hygiene || {}) },
      nutrition: { ...(base.gameCompleted?.nutrition || {}), ...(progress.gameCompleted?.nutrition || {}) },
      fitness: { ...(base.gameCompleted?.fitness || {}), ...(progress.gameCompleted?.fitness || {}) }
    },
    gameScores: { ...(base.gameScores || {}), ...(progress.gameScores || {}) },
    activeMissionProfile: progress.activeMissionProfile || base.activeMissionProfile || "CLASS_60",
    sheetAuthority: false,
    firebaseAuthority: {
      mode: authority.mode,
      uid: authority.uid,
      studentId,
      currentZone: zone,
      build: authority.build,
      syncedAt: new Date().toISOString()
    }
  };
}

function applyAuthority(event) {
  const authority = event.detail || window.HH_FIREBASE_AUTHORITY;
  if (!authority?.enabled || authority.error || !authority.studentId || !authority.roster) return;

  let current = {};
  try { current = JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); } catch (_) {}
  const next = mergeFirebaseState(current, authority);
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  localStorage.setItem(ACTIVE_STUDENT_KEY, authority.studentId);
  sessionStorage.setItem(RELOAD_KEY, authority.studentId);
  sessionStorage.setItem(`hh_authority_bootstrap:${authority.studentId}`, String(Date.now()));
  localStorage.setItem(`hh_authority_version_synced:${authority.studentId}`, SHEET_RESUME_VERSION);
  window.HH_FIREBASE_PASSPORT_STATE = Object.freeze(next.firebaseAuthority);
  window.dispatchEvent(new CustomEvent("hh:passport-firebase-applied", { detail: next.firebaseAuthority }));

  const alreadySeeded = params.get("firebaseReady") === "1";
  if (!alreadySeeded) {
    params.set("firebaseReady", "1");
    location.replace(`${location.pathname}?${params.toString()}${location.hash}`);
    return;
  }

  window.__HH_FIREBASE_REMOVE_SHEET_OVERLAY__?.();
  updateBadge(`Firebase • ${authority.studentId} • ${next.firebaseAuthority.currentZone}`, "ok");
  try { window.HH?.go?.("student"); } catch (_) {}
}

function installAuthorityBadge() {
  const existing = document.getElementById("hh-firebase-authority-badge");
  if (existing) return;
  const node = document.createElement("div");
  node.id = "hh-firebase-authority-badge";
  node.textContent = "กำลังโหลด Firebase Authority…";
  Object.assign(node.style, {
    position: "fixed", left: "12px", bottom: "12px", zIndex: "99999",
    padding: "8px 11px", borderRadius: "999px", font: "700 12px system-ui",
    background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa",
    boxShadow: "0 8px 24px rgba(15,23,42,.14)"
  });
  document.body.appendChild(node);
}

function updateBadge(text, kind = "info") {
  const node = document.getElementById("hh-firebase-authority-badge");
  if (!node) return;
  node.textContent = text;
  if (kind === "ok") {
    node.style.background = "#ecfdf5";
    node.style.color = "#166534";
    node.style.borderColor = "#bbf7d0";
  } else if (kind === "error") {
    node.style.background = "#fef2f2";
    node.style.color = "#991b1b";
    node.style.borderColor = "#fecaca";
  }
}

function showAuthorityError(event) {
  const detail = event.detail || {};
  window.__HH_FIREBASE_REMOVE_SHEET_OVERLAY__?.();
  updateBadge(`Firebase error: ${detail.error || "unknown"}`, "error");
}
