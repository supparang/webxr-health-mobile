import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const SANDBOX_STUDENT_IDS = new Set(
  Array.from({ length: 29 }, (_, i) => String(990001 + i))
);

const LOGIN_COMMIT_KEY = "HH_FIREBASE_RECENT_LOGIN_COMMIT_R74";
const LOGIN_COMMIT_TTL_MS = 10000;

function writeRecentLoginCommit(studentId) {
  const sid = String(studentId || "").trim();
  if (!sid) return;
  try {
    sessionStorage.setItem(LOGIN_COMMIT_KEY, JSON.stringify({ sid, at: Date.now() }));
  } catch (_error) {}
}

function recoverRecentLoginCommitIntoUrl() {
  try {
    const raw = sessionStorage.getItem(LOGIN_COMMIT_KEY);
    if (!raw) return;
    const commit = JSON.parse(raw);
    const sid = String(commit?.sid || "").trim();
    const age = Date.now() - Number(commit?.at || 0);
    if (!sid || age < 0 || age > LOGIN_COMMIT_TTL_MS) {
      sessionStorage.removeItem(LOGIN_COMMIT_KEY);
      return;
    }

    const url = new URL(location.href);
    const currentSid = String(url.searchParams.get("studentId") || url.searchParams.get("sid") || "").trim();
    const needsRecovery = url.searchParams.get("logout") === "1" || !currentSid;
    if (!needsRecovery) return;

    url.searchParams.delete("logout");
    url.searchParams.delete("logoutAt");
    url.searchParams.delete("logoutNonce");
    url.searchParams.set("authority", "firebase");
    url.searchParams.set("studentId", sid);
    url.searchParams.set("sid", sid);
    url.searchParams.set("firebaseReady", "1");
    url.searchParams.delete("firebaseHydratedR71");
    url.searchParams.delete("firebaseHydratedR72");
    url.searchParams.delete("firebaseHydratedR73");
    url.searchParams.set("loginCommitRecovery", "r74");
    history.replaceState(null, "", url.href);
    sessionStorage.removeItem(LOGIN_COMMIT_KEY);
  } catch (_error) {}
}

recoverRecentLoginCommitIntoUrl();

function isSandboxStudent(studentId) {
  return SANDBOX_STUDENT_IDS.has(String(studentId || "").trim());
}

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

function isPermissionError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("insufficient permission");
}

async function readRoster(studentId) {
  const user = await ensureAnonymousUser();
  const sid = String(studentId || "").trim();
  if (!sid) return { ok: false, user, reason: "student-required" };

  const collectionOrder = isSandboxStudent(sid)
    ? ["studentsSandbox", "students"]
    : ["students", "studentsSandbox"];

  let lastPermissionError = null;
  for (const collectionName of collectionOrder) {
    const ref = doc(db, collectionName, sid);
    let snapshot;
    try {
      snapshot = await getDoc(ref);
    } catch (error) {
      if (isPermissionError(error)) {
        lastPermissionError = error;
        continue;
      }
      throw error;
    }
    if (!snapshot.exists()) continue;
    const roster = snapshot.data();
    if (roster.active === false) {
      return { ok: false, user, reason: "student-inactive", roster, rosterPath: ref.path };
    }
    return { ok: true, user, roster: { ...roster, studentId: sid }, rosterPath: ref.path };
  }

  if (lastPermissionError) {
    return { ok: false, user, reason: "roster-permission-denied", error: lastPermissionError };
  }
  return { ok: false, user, reason: "student-not-found" };
}

async function bindStudent(studentId) {
  const rosterResult = await readRoster(studentId);
  if (!rosterResult.ok) return rosterResult;
  const { user, roster } = rosterResult;
  const sandbox = String(rosterResult.rosterPath || "").startsWith("studentsSandbox/");
  const bindingCollection = sandbox ? "studentBindingsSandbox" : "studentBindings";
  const ref = doc(db, bindingCollection, user.uid);
  await setDoc(ref, {
    uid: user.uid,
    studentId: String(studentId),
    classId: roster.classId || roster.section || "",
    rosterPath: rosterResult.rosterPath || "",
    boundAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  }, { merge: true });
  writeRecentLoginCommit(studentId);
  return { ok: true, user, roster, rosterPath: rosterResult.rosterPath, bindingPath: ref.path };
}

function progressCollectionFor(studentId) {
  return isSandboxStudent(studentId) ? "studentProgressSandbox" : "studentProgress";
}

async function loadProgress(studentId) {
  const user = await ensureAnonymousUser();
  const sid = String(studentId || "").trim();
  const preferred = progressCollectionFor(sid);
  const collections = [preferred, preferred === "studentProgress" ? "studentProgressSandbox" : "studentProgress"];
  let lastPermissionError = null;
  for (const collectionName of collections) {
    const ref = doc(db, collectionName, sid);
    let snapshot;
    try {
      snapshot = await getDoc(ref);
    } catch (error) {
      if (isPermissionError(error)) {
        lastPermissionError = error;
        continue;
      }
      throw error;
    }
    if (snapshot.exists()) {
      return { ok: true, user, exists: true, progress: snapshot.data(), path: ref.path };
    }
  }
  if (lastPermissionError && preferred !== "studentProgressSandbox") {
    return { ok: false, user, exists: false, progress: null, path: `${preferred}/${sid}`, reason: "progress-permission-denied", error: lastPermissionError };
  }
  return { ok: true, user, exists: false, progress: null, path: `${preferred}/${sid}` };
}

async function saveProgress(studentId, patch = {}) {
  const user = await ensureAnonymousUser();
  const sid = String(studentId || "").trim();
  const ref = doc(db, progressCollectionFor(sid), sid);
  const safe = {
    studentId: sid,
    currentZone: String(patch.currentZone || "hygiene"),
    pretestCompleted: patch.pretestCompleted === true,
    posttestCompleted: patch.posttestCompleted === true,
    updatedByUid: user.uid,
    updatedAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  };
  await setDoc(ref, safe, { merge: true });
  return loadProgress(sid);
}

function plainObject(value) {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (typeof item === "function" || typeof item === "undefined") return undefined;
      if (typeof item === "number" && !Number.isFinite(item)) return 0;
      return item;
    }));
  } catch (_error) {
    return {};
  }
}

function receiptToken(studentId, gameId) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${String(studentId)}:${String(gameId)}:${random}`;
}

async function saveGameResult(studentId, gameId, result = {}) {
  const sid = String(studentId || "").trim();
  const gid = String(gameId || "").trim();
  if (!sid) throw new Error("firebase-game-result-student-required");
  if (!gid) throw new Error("firebase-game-result-game-required");

  const rosterResult = await bindStudent(sid);
  if (!rosterResult.ok) throw new Error(`firebase-roster-${rosterResult.reason || "failed"}`);

  const user = rosterResult.user;
  const token = receiptToken(sid, gid);
  const cleanResult = plainObject(result);
  const zone = String(cleanResult.zone || cleanResult.zoneId || "hygiene");
  const sandbox = String(rosterResult.rosterPath || "").startsWith("studentsSandbox/");
  const progressCollection = sandbox ? "studentProgressSandbox" : "studentProgress";
  const ref = doc(db, progressCollection, sid);
  const storedResult = {
    ...cleanResult,
    studentId: sid,
    gameId: gid,
    zone,
    completed: true,
    passed: cleanResult.passed !== false,
    progressionEligible: cleanResult.progressionEligible !== false,
    firebaseReceiptToken: token,
    firebaseSavedByUid: user.uid,
    firebaseClientSavedAt: new Date().toISOString(),
    firebaseSavedAt: serverTimestamp(),
    firebaseBuild: HEROHEALTH_FIREBASE_BUILD
  };

  await setDoc(ref, {
    studentId: sid,
    currentZone: zone,
    gameCompleted: { [zone]: { [gid]: true } },
    gameResults: { [gid]: storedResult },
    lastGame: {
      gameId: gid,
      zone,
      completed: true,
      passed: storedResult.passed,
      progressionEligible: storedResult.progressionEligible,
      firebaseReceiptToken: token
    },
    updatedByUid: user.uid,
    updatedAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  }, { merge: true });

  const confirmed = await confirmGameResult(sid, gid, token);
  if (!confirmed.ok) throw new Error("firebase-game-result-receipt-mismatch");
  return { ...confirmed, user, roster: rosterResult.roster, token, path: ref.path };
}

async function confirmGameResult(studentId, gameId, expectedToken = "") {
  const loaded = await loadProgress(studentId);
  const stored = loaded.progress?.gameResults?.[String(gameId)] || null;
  const token = String(stored?.firebaseReceiptToken || "");
  const ok = Boolean(stored && stored.completed === true && (!expectedToken || token === expectedToken));
  return {
    ok,
    user: loaded.user,
    progress: loaded.progress,
    result: stored,
    token,
    path: loaded.path
  };
}

export const HHFirebaseClient = Object.freeze({
  build: HEROHEALTH_FIREBASE_BUILD,
  sandboxStudentIds: Object.freeze([...SANDBOX_STUDENT_IDS]),
  isSandboxStudent,
  ensureAnonymousUser,
  readRoster,
  bindStudent,
  loadProgress,
  saveProgress,
  saveGameResult,
  confirmGameResult
});