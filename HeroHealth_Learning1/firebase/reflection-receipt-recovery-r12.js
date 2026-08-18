import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';
import { HEROHEALTH_FIREBASE_CONFIG } from './firebase-config.js';

const RELEASE = '20260818-REFLECTION-RECEIPT-RECOVERY-R14-STRICT';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const SANDBOX_STUDENT_IDS = new Set(Array.from({ length: 29 }, (_, i) => String(990001 + i)));
const isSandboxStudent = sid => SANDBOX_STUDENT_IDS.has(String(sid || '').trim());

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}
function writeState(state) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
  catch (_) {}
}
function resolveStudentId() {
  const values = ['studentId','sid','pid']
    .map(key => String(params.get(key) || '').trim())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (unique.length > 1) return '';
  if (unique.length === 1) return unique[0];
  const state = readState();
  const local = [state?.profile?.studentId, state?.firebaseAuthority?.studentId]
    .map(v => String(v || '').trim()).filter(Boolean);
  const localUnique = [...new Set(local)];
  return localUnique.length === 1 ? localUnique[0] : '';
}
function applyEvidence(state, sid, evidence, collectionName) {
  const evidenceReflection = evidence?.reflection && typeof evidence.reflection === 'object'
    ? evidence.reflection : {};
  const receipt = String(
    evidence?.firebaseReceiptToken || evidence?.receiptToken || evidenceReflection?.firebaseReceiptToken || ''
  );
  return {
    ...state,
    completed: { ...(state.completed || {}), reflection: true },
    reflectionCompleted: true,
    reflection: { ...(state.reflection || {}), ...evidenceReflection, completed: true, firebaseReceiptToken: receipt },
    firebaseReflection: {
      receipt,
      evidencePath: `${collectionName}/${sid}_REFLECTION`,
      recoveredAt: new Date().toISOString(),
      release: RELEASE
    }
    // Certificate is deliberately NOT marked complete here. Certificate R8 has
    // its own Firestore-issued receipt and strict full-flow eligibility gate.
  };
}

async function boot() {
  if (!enabled || window.__HH_REFLECTION_RECOVERY_R14__) return;
  window.__HH_REFLECTION_RECOVERY_R14__ = true;
  const sid = resolveStudentId();
  if (!sid) return;
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);
    const db = getFirestore(app);
    const collectionName = isSandboxStudent(sid) ? 'studentAssessmentsSandbox' : 'studentAssessments';
    const progressCollection = isSandboxStudent(sid) ? 'studentProgressSandbox' : 'studentProgress';
    const [snapshot, progressSnap] = await Promise.all([
      getDoc(doc(db, collectionName, `${sid}_REFLECTION`)),
      getDoc(doc(db, progressCollection, sid))
    ]);
    if (!snapshot.exists() || !progressSnap.exists()) return;
    const evidence = snapshot.data() || {};
    const progress = progressSnap.data() || {};
    const receipt = String(evidence.firebaseReceiptToken || evidence.receiptToken || evidence.reflection?.firebaseReceiptToken || '');
    const confirmed = evidence.completed === true && Boolean(receipt) &&
      progress.reflectionCompleted === true &&
      String(progress.reflectionReceiptToken || '') === receipt;
    if (!confirmed) {
      console.warn('[Reflection Recovery R14] Firestore evidence not fully confirmed', { sid, receipt });
      return;
    }
    const latest = readState();
    if (String(latest?.profile?.studentId || '') !== sid || String(latest?.firebaseAuthority?.studentId || '') !== sid) return;
    writeState(applyEvidence(latest, sid, evidence, collectionName));
    window.dispatchEvent(new CustomEvent('hh:firebase-state-updated', { detail: { reason: 'reflection-recovery-r14', release: RELEASE } }));
    console.info('[Reflection Recovery R14] verified', { sid, receipt });
  } catch (error) {
    console.error('[Reflection Recovery R14] failed', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 120), { once: true });
} else {
  setTimeout(boot, 120);
}
