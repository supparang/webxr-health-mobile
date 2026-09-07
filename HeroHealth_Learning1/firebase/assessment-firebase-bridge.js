import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const RELEASE = "20260907-FIREBASE-ASSESSMENT-R7-PROGRESS-AUTHORITY-FALLBACK";
const PENDING_KEY = "HH_FIREBASE_PENDING_ASSESSMENTS_R76";
const SANDBOX_STUDENT_IDS = new Set(Array.from({ length: 29 }, (_, i) => String(990001 + i)));
const CORE_GAMES = Object.freeze([
  ["hygiene", ["handwash", "hand-wash"]],
  ["hygiene", ["toothbrush", "brush"]],
  ["nutrition", ["groups", "foodgroups", "food-groups"]],
  ["nutrition", ["goodjunk", "good-junk"]],
  ["fitness", ["jumpduck", "jump-duck"]],
  ["fitness", ["balance", "balancehold", "balance-hold"]]
]);
let draining = false;

function isSandboxStudent(studentId) {
  return SANDBOX_STUDENT_IDS.has(String(studentId || "").trim());
}
function isPermissionError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || error || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("insufficient permission") || message.includes("missing or insufficient permissions");
}
async function user() {
  if (typeof auth.authStateReady === "function") {
    try { await auth.authStateReady(); } catch (_error) {}
  }
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}
function sanitizeFirestore(value, insideArray = false) {
  if (typeof value === "undefined" || typeof value === "function") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return 0;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const items = value.map(item => sanitizeFirestore(item, true));
    return insideArray ? { values: items } : items;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item !== "undefined" && typeof item !== "function")
      .map(([key, item]) => [key, sanitizeFirestore(item, false)])
  );
}
function token(studentId, mode, attemptId) {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${studentId}:${mode}:${attemptId}:${random}`;
}
function resultComplete(result) {
  return Boolean(result && result.completed === true && result.passed !== false && result.progressionEligible !== false && result.firebaseReceiptToken);
}
function gameDone(progress, zone, aliases) {
  return aliases.some(id => progress?.gameCompleted?.[zone]?.[id] === true) ||
    aliases.some(id => resultComplete(progress?.gameResults?.[id]));
}
function allCoreGamesComplete(progress) {
  return CORE_GAMES.every(([zone, aliases]) => gameDone(progress, zone, aliases));
}
function pretestComplete(progress) {
  return progress?.pretestCompleted === true || progress?.assessments?.pretest?.completed === true;
}
function queueRead() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch (_error) { return {}; }
}
function queueWrite(value) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(value || {})); }
  catch (_error) {}
}
function queueId(payload) {
  return `${String(payload.studentId || "").trim()}_${String(payload.mode || "").toLowerCase()}_${String(payload.attemptId || "").replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 240);
}
function enqueue(payload) {
  const queue = queueRead();
  queue[queueId(payload)] = sanitizeFirestore(payload);
  const keys = Object.keys(queue);
  while (keys.length > 20) delete queue[keys.shift()];
  queueWrite(queue);
}
function dequeue(payload) {
  const queue = queueRead();
  delete queue[queueId(payload)];
  queueWrite(queue);
}

async function ensureAssessmentBinding(studentId, currentUser, sandbox) {
  const sid = String(studentId || "").trim();
  if (!sid || !currentUser?.uid) throw new Error("firebase-assessment-binding-invalid-identity");
  const rosterCollection = sandbox ? "studentsSandbox" : "students";
  const bindingCollection = sandbox ? "studentBindingsSandbox" : "studentBindings";
  const rosterRef = doc(db, rosterCollection, sid);
  const rosterSnap = await getDoc(rosterRef);
  if (!rosterSnap.exists()) throw new Error("firebase-assessment-roster-not-found");
  const roster = rosterSnap.data() || {};
  if (roster.active === false) throw new Error("firebase-assessment-student-inactive");

  const bindingRef = doc(db, bindingCollection, currentUser.uid);
  let binding = null;
  try {
    const bindingSnap = await getDoc(bindingRef);
    binding = bindingSnap.exists() ? bindingSnap.data() : null;
  } catch (_error) {}

  if (String(binding?.studentId || "") === sid && String(binding?.uid || currentUser.uid) === currentUser.uid) {
    return { ok: true, repaired: false, bindingPath: bindingRef.path, rosterPath: rosterRef.path };
  }

  await setDoc(bindingRef, {
    uid: currentUser.uid,
    studentId: sid,
    classId: roster.classId || roster.section || "",
    rosterPath: rosterRef.path,
    boundAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  }, { merge: true });

  const confirmed = await getDoc(bindingRef);
  const confirmedData = confirmed.exists() ? confirmed.data() : null;
  if (!confirmed.exists() || String(confirmedData?.studentId || "") !== sid || String(confirmedData?.uid || "") !== currentUser.uid) {
    throw new Error("firebase-assessment-binding-confirmation-failed");
  }
  console.info("[HeroHealth Assessment R7] learner binding repaired", { studentId: sid, uid: currentUser.uid, bindingPath: bindingRef.path });
  return { ok: true, repaired: true, bindingPath: bindingRef.path, rosterPath: rosterRef.path };
}

function assessmentSummary(payload, receipt, assessmentType, extra = {}) {
  return {
    completed: true,
    attemptId: String(payload.attemptId || ""),
    score: Number(payload.score || 0),
    total: Number(payload.total || 0),
    form: String(payload.form || ""),
    firebaseReceiptToken: receipt,
    confirmedAtClient: new Date().toISOString(),
    assessmentType,
    release: RELEASE,
    ...extra
  };
}

async function saveProgressAuthorityFallback(payload, currentUser, assessmentType, progressRef, safePayload, originalError) {
  let progressSnap;
  try {
    progressSnap = await getDoc(progressRef);
  } catch (error) {
    const e = new Error(`FIREBASE_RULES_BLOCK_PROGRESS_READ:${String(error?.message || error)}`);
    e.cause = error;
    throw e;
  }
  const currentProgress = progressSnap.exists() ? progressSnap.data() : {};
  const mode = String(payload.mode || "").toLowerCase();
  if (mode === "post") {
    if (!pretestComplete(currentProgress)) throw new Error("firebase-posttest-pretest-required");
    if (!allCoreGamesComplete(currentProgress)) throw new Error("firebase-posttest-six-games-required");
  }

  const existing = currentProgress?.assessments?.[assessmentType] || {};
  const receipt = String(existing.firebaseReceiptToken || "") || token(payload.studentId, mode, payload.attemptId);
  const summary = assessmentSummary(payload, receipt, assessmentType, {
    storageMode: "studentProgress-authority-fallback",
    assessmentDocumentPending: true,
    fallbackReason: isPermissionError(originalError) ? "studentAssessments-permission-denied" : "atomic-assessment-write-unavailable",
    payload: safePayload
  });
  const patch = {
    studentId: String(payload.studentId || ""),
    pretestCompleted: mode === "pre" ? true : currentProgress.pretestCompleted === true,
    posttestCompleted: mode === "post" ? true : currentProgress.posttestCompleted === true,
    assessments: {
      ...(currentProgress.assessments && typeof currentProgress.assessments === "object" ? currentProgress.assessments : {}),
      [assessmentType]: summary
    },
    updatedByUid: currentUser.uid,
    updatedAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD,
    assessmentAuthorityRelease: RELEASE
  };
  try {
    await setDoc(progressRef, patch, { merge: true });
  } catch (error) {
    const e = new Error(`FIREBASE_RULES_BLOCK_PROGRESS_WRITE:${String(error?.message || error)}`);
    e.cause = error;
    throw e;
  }

  let confirmedSnap;
  try {
    confirmedSnap = await getDoc(progressRef);
  } catch (error) {
    const e = new Error(`FIREBASE_RULES_BLOCK_PROGRESS_CONFIRM:${String(error?.message || error)}`);
    e.cause = error;
    throw e;
  }
  const progress = confirmedSnap.exists() ? confirmedSnap.data() : null;
  const stored = progress?.assessments?.[assessmentType] || null;
  const confirmed = Boolean(stored?.completed === true && stored?.firebaseReceiptToken === receipt && progress?.[mode === "pre" ? "pretestCompleted" : "posttestCompleted"] === true);
  if (!confirmed) throw new Error("firebase-progress-authority-receipt-mismatch");
  console.warn("[HeroHealth Assessment R7] progress authority fallback used", {
    studentId: payload.studentId,
    assessmentType,
    progressPath: progressRef.path,
    receipt,
    originalError: String(originalError?.message || originalError || "")
  });
  return { ok: true, receipt, assessmentPath: null, progressPath: progressRef.path, assessment: stored, progress, release: RELEASE, storageMode: "studentProgress-authority-fallback" };
}

async function saveAssessment(payload = {}, options = {}) {
  const sid = String(payload.studentId || "").trim();
  const mode = String(payload.mode || "").toLowerCase();
  const attemptId = String(payload.attemptId || "").trim();
  if (!sid || !attemptId || !["pre", "post"].includes(mode)) throw new Error("firebase-assessment-invalid-payload");

  if (options.enqueue !== false) enqueue(payload);
  const currentUser = await user();
  const assessmentType = mode === "pre" ? "pretest" : "posttest";
  const sandbox = isSandboxStudent(sid);
  await ensureAssessmentBinding(sid, currentUser, sandbox);

  const collection = sandbox ? "studentAssessmentsSandbox" : "studentAssessments";
  const progressCollection = sandbox ? "studentProgressSandbox" : "studentProgress";
  const assessmentRef = doc(db, collection, `${sid}_${attemptId}`);
  const progressRef = doc(db, progressCollection, sid);
  const safePayload = sanitizeFirestore(payload);
  let confirmedReceipt = "";

  try {
    await runTransaction(db, async transaction => {
      const [assessmentSnap, progressSnap] = await Promise.all([
        transaction.get(assessmentRef),
        transaction.get(progressRef)
      ]);
      const existingAssessment = assessmentSnap.exists() ? assessmentSnap.data() : null;
      const currentProgress = progressSnap.exists() ? progressSnap.data() : {};
      const existingReceipt = String(existingAssessment?.firebaseReceiptToken || "");

      if (!existingReceipt) {
        if (mode === "pre" && pretestComplete(currentProgress)) {
          throw new Error("firebase-pretest-already-complete");
        }
        if (mode === "post") {
          if (!pretestComplete(currentProgress)) throw new Error("firebase-posttest-pretest-required");
          if (!allCoreGamesComplete(currentProgress)) throw new Error("firebase-posttest-six-games-required");
        }
      }

      const receipt = existingReceipt || token(sid, mode, attemptId);
      confirmedReceipt = receipt;
      const stored = {
        ...safePayload,
        assessmentType,
        completed: true,
        firebaseReceiptToken: receipt,
        firebaseSavedByUid: currentUser.uid,
        firebasePreviousWriterUid: existingAssessment?.firebaseSavedByUid || null,
        firebaseClientSavedAt: new Date().toISOString(),
        firebaseSavedAt: serverTimestamp(),
        firebaseBuild: HEROHEALTH_FIREBASE_BUILD,
        release: RELEASE,
        nestedArrayEncoding: "nested-array-as-map-values-v1",
        progressionGate: {
          checked: true,
          pretestComplete: mode === "pre" ? true : pretestComplete(currentProgress),
          sixGamesComplete: mode === "post" ? allCoreGamesComplete(currentProgress) : false,
          release: RELEASE
        }
      };
      const summary = assessmentSummary(payload, receipt, assessmentType, { storageMode: "atomic-assessment-document" });
      const assessments = {
        ...(currentProgress.assessments && typeof currentProgress.assessments === "object" ? currentProgress.assessments : {}),
        [assessmentType]: summary
      };

      transaction.set(assessmentRef, stored, { merge: true });
      transaction.set(progressRef, {
        studentId: sid,
        pretestCompleted: mode === "pre" ? true : currentProgress.pretestCompleted === true,
        posttestCompleted: mode === "post" ? true : currentProgress.posttestCompleted === true,
        assessments,
        updatedByUid: currentUser.uid,
        updatedAt: serverTimestamp(),
        build: HEROHEALTH_FIREBASE_BUILD,
        assessmentAuthorityRelease: RELEASE
      }, { merge: true });
    });
  } catch (error) {
    const recoverable = isPermissionError(error) || String(error?.message || "") === "firebase-pretest-already-complete";
    if (!recoverable) throw error;
    const fallback = await saveProgressAuthorityFallback(payload, currentUser, assessmentType, progressRef, safePayload, error);
    dequeue(payload);
    return fallback;
  }

  const [assessmentSnap, progressSnap] = await Promise.all([getDoc(assessmentRef), getDoc(progressRef)]);
  const assessment = assessmentSnap.exists() ? assessmentSnap.data() : null;
  const progress = progressSnap.exists() ? progressSnap.data() : null;
  const receipt = String(assessment?.firebaseReceiptToken || confirmedReceipt || "");
  const confirmed = Boolean(receipt) &&
    assessment?.completed === true &&
    assessment?.firebaseReceiptToken === receipt &&
    assessment?.firebaseSavedByUid === currentUser.uid &&
    progress?.assessments?.[assessmentType]?.firebaseReceiptToken === receipt &&
    progress?.[mode === "pre" ? "pretestCompleted" : "posttestCompleted"] === true;
  if (!confirmed) throw new Error("firebase-assessment-receipt-mismatch");
  dequeue(payload);
  return { ok: true, receipt, assessmentPath: assessmentRef.path, progressPath: progressRef.path, assessment, progress, release: RELEASE, storageMode: "atomic-assessment-document" };
}

async function drainPending() {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    const entries = Object.values(queueRead());
    for (const payload of entries) {
      try { await saveAssessment(payload, { enqueue: false }); }
      catch (error) { console.warn("[HeroHealth Assessment R7] pending retry remains queued", error); }
    }
  } finally { draining = false; }
}

window.addEventListener("online", drainPending);
setTimeout(drainPending, 800);
window.HHAssessmentFirebase = Object.freeze({
  release: RELEASE,
  saveAssessment,
  drainPending,
  sanitizeFirestore,
  isSandboxStudent,
  allCoreGamesComplete,
  pretestComplete,
  ensureAssessmentBinding
});
console.info("[HeroHealth Firebase Assessment R7] installed", RELEASE);
