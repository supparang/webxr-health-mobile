import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { HEROHEALTH_FIREBASE_CONFIG } from './firebase-config.js';

const RELEASE = '20260806-REFLECTION-RECEIPT-RECOVERY-R12';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
  catch (_) { return {}; }
}

function writeState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function studentId() {
  const state = readState();
  return String(
    params.get('studentId') ||
    params.get('sid') ||
    state?.profile?.studentId ||
    ''
  ).trim();
}

function alreadyComplete(state) {
  return state?.completed?.reflection === true && state?.reflectionCompleted === true;
}

function applyEvidence(state, sid, evidence) {
  const reflection = evidence?.reflection && typeof evidence.reflection === 'object'
    ? evidence.reflection
    : (state.reflection || {});

  return {
    ...state,
    completed: {
      ...(state.completed || {}),
      reflection: true,
      certificate: true
    },
    reflectionCompleted: true,
    reflection: {
      ...reflection,
      completed: true,
      firebaseReceiptToken:
        evidence?.firebaseReceiptToken ||
        evidence?.receiptToken ||
        reflection?.firebaseReceiptToken ||
        ''
    },
    firebaseReflection: {
      ...(state.firebaseReflection || {}),
      receipt:
        evidence?.firebaseReceiptToken ||
        evidence?.receiptToken ||
        evidence?.reflection?.firebaseReceiptToken ||
        '',
      evidencePath: `studentAssessmentsSandbox/${sid}_REFLECTION`,
      recoveredAt: new Date().toISOString(),
      release: RELEASE
    }
  };
}

async function boot() {
  if (!enabled || window.__HH_REFLECTION_RECOVERY_R12__) return;
  window.__HH_REFLECTION_RECOVERY_R12__ = true;

  const sid = studentId();
  if (!sid) return;

  const current = readState();
  if (alreadyComplete(current)) return;

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(HEROHEALTH_FIREBASE_CONFIG);
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);

    const db = getFirestore(app);
    const collectionName = sid === '990014' ? 'studentAssessmentsSandbox' : 'studentAssessments';
    const documentId = `${sid}_REFLECTION`;
    const snapshot = await getDoc(doc(db, collectionName, documentId));
    if (!snapshot.exists()) {
      console.info('[Reflection Recovery R12] no evidence', { sid, path: `${collectionName}/${documentId}` });
      return;
    }

    const evidence = snapshot.data() || {};
    const confirmed = evidence.completed === true && (
      Boolean(evidence.firebaseReceiptToken) ||
      Boolean(evidence.receiptToken) ||
      Boolean(evidence.reflection?.firebaseReceiptToken)
    );
    if (!confirmed) {
      console.warn('[Reflection Recovery R12] evidence incomplete', evidence);
      return;
    }

    const latest = readState();
    writeState(applyEvidence(latest, sid, evidence));

    if (params.get('reflectionRecoveredR12') !== '1') {
      const url = new URL(location.href);
      url.searchParams.set('authority', 'firebase');
      url.searchParams.set('studentId', sid);
      url.searchParams.set('sid', sid);
      url.searchParams.set('firebaseReady', '1');
      url.searchParams.set('reflectionRecoveredR12', '1');
      url.searchParams.set('v', RELEASE);
      location.replace(url.href);
    }
  } catch (error) {
    console.error('[Reflection Recovery R12] failed', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 80), { once: true });
} else {
  setTimeout(boot, 80);
}
