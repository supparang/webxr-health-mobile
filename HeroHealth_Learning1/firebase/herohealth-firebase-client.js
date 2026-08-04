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

export const HHFirebaseClient = Object.freeze({
  build: HEROHEALTH_FIREBASE_BUILD,
  ensureAnonymousUser,
  readRoster,
  bindStudent,
  loadProgress,
  saveProgress
});
