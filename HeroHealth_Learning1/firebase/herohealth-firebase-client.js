import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureAnonymousUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function readRoster(studentId) {
  const user = await ensureAnonymousUser();
  const ref = doc(db, "studentsSandbox", String(studentId));
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return { ok: false, user, reason: "student-not-found" };
  const roster = snapshot.data();
  if (roster.active !== true) return { ok: false, user, reason: "student-inactive", roster };
  return { ok: true, user, roster };
}

async function bindStudent(studentId) {
  const rosterResult = await readRoster(studentId);
  if (!rosterResult.ok) return rosterResult;
  const { user, roster } = rosterResult;
  const ref = doc(db, "studentBindingsSandbox", user.uid);
  await setDoc(ref, {
    uid: user.uid,
    studentId: String(studentId),
    classId: roster.classId || "",
    boundAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  }, { merge: true });
  return { ok: true, user, roster, bindingPath: ref.path };
}

async function loadProgress(studentId) {
  const user = await ensureAnonymousUser();
  const ref = doc(db, "studentProgressSandbox", String(studentId));
  const snapshot = await getDoc(ref);
  return {
    ok: true,
    user,
    exists: snapshot.exists(),
    progress: snapshot.exists() ? snapshot.data() : null,
    path: ref.path
  };
}

async function saveProgress(studentId, patch = {}) {
  const user = await ensureAnonymousUser();
  const ref = doc(db, "studentProgressSandbox", String(studentId));
  const safe = {
    studentId: String(studentId),
    currentZone: String(patch.currentZone || "hygiene"),
    pretestCompleted: patch.pretestCompleted === true,
    posttestCompleted: patch.posttestCompleted === true,
    updatedByUid: user.uid,
    updatedAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  };
  await setDoc(ref, safe, { merge: true });
  return loadProgress(studentId);
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
  const ref = doc(db, "studentProgressSandbox", sid);
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
  ensureAnonymousUser,
  readRoster,
  bindStudent,
  loadProgress,
  saveProgress,
  saveGameResult,
  confirmGameResult
});
