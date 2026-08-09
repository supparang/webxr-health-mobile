import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const RELEASE = "20260809-FIREBASE-ASSESSMENT-RECEIPT-R3-E2E29";
const SANDBOX_STUDENT_IDS = new Set(Array.from({ length: 29 }, (_, i) => String(990001 + i)));

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

async function saveAssessment(payload = {}) {
  const sid = String(payload.studentId || "").trim();
  const mode = String(payload.mode || "").toLowerCase();
  const attemptId = String(payload.attemptId || "").trim();
  if (!sid || !attemptId || !["pre", "post"].includes(mode)) throw new Error("firebase-assessment-invalid-payload");

  const currentUser = await user();
  const receipt = token(sid, mode, attemptId);
  const assessmentType = mode === "pre" ? "pretest" : "posttest";
  const sandbox = isSandboxStudent(sid);
  const collection = sandbox ? "studentAssessmentsSandbox" : "studentAssessments";
  const progressCollection = sandbox ? "studentProgressSandbox" : "studentProgress";
  const assessmentRef = doc(db, collection, `${sid}_${attemptId}`);
  const progressRef = doc(db, progressCollection, sid);
  const safePayload = sanitizeFirestore(payload);
  const stored = {
    ...safePayload,
    assessmentType,
    completed: true,
    firebaseReceiptToken: receipt,
    firebaseSavedByUid: currentUser.uid,
    firebaseClientSavedAt: new Date().toISOString(),
    firebaseSavedAt: serverTimestamp(),
    firebaseBuild: HEROHEALTH_FIREBASE_BUILD,
    release: RELEASE,
    nestedArrayEncoding: "nested-array-as-map-values-v1"
  };

  await setDoc(assessmentRef, stored, { merge: true });
  await setDoc(progressRef, {
    studentId: sid,
    [mode === "pre" ? "pretestCompleted" : "posttestCompleted"]: true,
    assessments: {
      [assessmentType]: {
        completed: true,
        attemptId,
        score: Number(payload.score || 0),
        total: Number(payload.total || 0),
        form: String(payload.form || ""),
        firebaseReceiptToken: receipt,
        confirmedAtClient: new Date().toISOString()
      }
    },
    updatedByUid: currentUser.uid,
    updatedAt: serverTimestamp(),
    build: HEROHEALTH_FIREBASE_BUILD
  }, { merge: true });

  const [assessmentSnap, progressSnap] = await Promise.all([getDoc(assessmentRef), getDoc(progressRef)]);
  const assessment = assessmentSnap.exists() ? assessmentSnap.data() : null;
  const progress = progressSnap.exists() ? progressSnap.data() : null;
  const confirmed = assessment?.firebaseReceiptToken === receipt &&
    progress?.assessments?.[assessmentType]?.firebaseReceiptToken === receipt &&
    progress?.[mode === "pre" ? "pretestCompleted" : "posttestCompleted"] === true;
  if (!confirmed) throw new Error("firebase-assessment-receipt-mismatch");
  return { ok: true, receipt, assessmentPath: assessmentRef.path, progressPath: progressRef.path, assessment, progress };
}

window.HHAssessmentFirebase = Object.freeze({ release: RELEASE, saveAssessment, sanitizeFirestore, isSandboxStudent });
console.info("[HeroHealth Firebase Assessment R3] installed", RELEASE);
