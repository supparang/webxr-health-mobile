import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { HEROHEALTH_FIREBASE_CONFIG, HEROHEALTH_FIREBASE_BUILD } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const RELEASE = "20260804-FIREBASE-ASSESSMENT-RECEIPT-R1";

async function user() {
  if (auth.currentUser) return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}

function clean(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === "undefined" || typeof item === "function") return undefined;
    if (typeof item === "number" && !Number.isFinite(item)) return 0;
    return item;
  }));
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
  const collection = sid === "990014" ? "studentAssessmentsSandbox" : "studentAssessments";
  const progressCollection = sid === "990014" ? "studentProgressSandbox" : "studentProgress";
  const assessmentRef = doc(db, collection, `${sid}_${attemptId}`);
  const progressRef = doc(db, progressCollection, sid);
  const stored = {
    ...clean(payload),
    assessmentType,
    completed: true,
    firebaseReceiptToken: receipt,
    firebaseSavedByUid: currentUser.uid,
    firebaseClientSavedAt: new Date().toISOString(),
    firebaseSavedAt: serverTimestamp(),
    firebaseBuild: HEROHEALTH_FIREBASE_BUILD,
    release: RELEASE
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
        firebaseReceiptToken: receipt
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

window.HHAssessmentFirebase = Object.freeze({ release: RELEASE, saveAssessment });
console.info("[HeroHealth Firebase Assessment R1] installed", RELEASE);
