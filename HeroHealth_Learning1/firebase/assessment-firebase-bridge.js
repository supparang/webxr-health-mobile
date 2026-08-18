import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const RELEASE = "20260818-FIREBASE-ASSESSMENT-R4-ATOMIC-RETRY";
const PENDING_KEY = "HH_FIREBASE_PENDING_ASSESSMENTS_R76";
const SANDBOX_STUDENT_IDS = new Set(Array.from({ length: 29 }, (_, i) => String(990001 + i)));
let draining = false;

function isSandboxStudent(studentId) {
  return SANDBOX_STUDENT_IDS.has(String(studentId || "").trim());
}

async function user() {
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

async function saveAssessment(payload = {}, options = {}) {
  const sid = String(payload.studentId || "").trim();
  const mode = String(payload.mode || "").toLowerCase();
  const attemptId = String(payload.attemptId || "").trim();
  if (!sid || !attemptId || !["pre", "post"].includes(mode)) throw new Error("firebase-assessment-invalid-payload");

  if (options.enqueue !== false) enqueue(payload);
  const currentUser = await user();
  const assessmentType = mode === "pre" ? "pretest" : "posttest";
  const sandbox = isSandboxStudent(sid);
  const collection = sandbox ? "studentAssessmentsSandbox" : "studentAssessments";
  const progressCollection = sandbox ? "studentProgressSandbox" : "studentProgress";
  const assessmentRef = doc(db, collection, `${sid}_${attemptId}`);
  const progressRef = doc(db, progressCollection, sid);
  const safePayload = sanitizeFirestore(payload);
  let confirmedReceipt = "";

  await runTransaction(db, async transaction => {
    const [assessmentSnap, progressSnap] = await Promise.all([
      transaction.get(assessmentRef),
      transaction.get(progressRef)
    ]);
    const existingAssessment = assessmentSnap.exists() ? assessmentSnap.data() : null;
    const currentProgress = progressSnap.exists() ? progressSnap.data() : {};
    const receipt = String(existingAssessment?.firebaseReceiptToken || "") || token(sid, mode, attemptId);
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
      nestedArrayEncoding: "nested-array-as-map-values-v1"
    };
    const assessmentSummary = {
      completed: true,
      attemptId,
      score: Number(payload.score || 0),
      total: Number(payload.total || 0),
      form: String(payload.form || ""),
      firebaseReceiptToken: receipt,
      confirmedAtClient: new Date().toISOString(),
      release: RELEASE
    };
    const assessments = {
      ...(currentProgress.assessments && typeof currentProgress.assessments === "object" ? currentProgress.assessments : {}),
      [assessmentType]: assessmentSummary
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
  return { ok: true, receipt, assessmentPath: assessmentRef.path, progressPath: progressRef.path, assessment, progress, release: RELEASE };
}

async function drainPending() {
  if (draining || !navigator.onLine) return;
  draining = true;
  try {
    const entries = Object.values(queueRead());
    for (const payload of entries) {
      try { await saveAssessment(payload, { enqueue: false }); }
      catch (error) { console.warn("[HeroHealth Assessment R4] pending retry remains queued", error); }
    }
  } finally { draining = false; }
}

window.addEventListener("online", drainPending);
setTimeout(drainPending, 800);
window.HHAssessmentFirebase = Object.freeze({ release: RELEASE, saveAssessment, drainPending, sanitizeFirestore, isSandboxStudent });
console.info("[HeroHealth Firebase Assessment R4] installed", RELEASE);
