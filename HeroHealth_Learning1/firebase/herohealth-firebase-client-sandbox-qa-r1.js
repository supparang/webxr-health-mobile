import { HHFirebaseClient as BaseClient } from './herohealth-firebase-client.js?cv=20260807-sandbox-qa-r1';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const db = getFirestore();
const RELEASE = '20260807-SANDBOX-QA-ROSTER-FALLBACK-R1';

const QA_ROSTER = Object.freeze({
  '990015': Object.freeze({
    studentId: '990015',
    fullName: 'HeroHealth Firebase Test 15',
    section: 'QA-P5',
    classId: 'QA-P5',
    group: 'A',
    rotationGroup: 'A',
    active: true,
    testAccount: true,
    authority: 'firebase-sandbox-fallback'
  }),
  '990016': Object.freeze({
    studentId: '990016',
    fullName: 'HeroHealth Firebase Test 16',
    section: 'QA-P5',
    classId: 'QA-P5',
    group: 'B',
    rotationGroup: 'B',
    active: true,
    testAccount: true,
    authority: 'firebase-sandbox-fallback'
  }),
  '990017': Object.freeze({
    studentId: '990017',
    fullName: 'HeroHealth Firebase Test 17',
    section: 'QA-P5',
    classId: 'QA-P5',
    group: 'C',
    rotationGroup: 'C',
    active: true,
    testAccount: true,
    authority: 'firebase-sandbox-fallback'
  })
});

async function readRoster(studentId) {
  const sid = String(studentId || '').trim();
  const result = await BaseClient.readRoster(sid);
  if (result?.ok) return result;

  const fallback = QA_ROSTER[sid];
  if (!fallback || result?.reason !== 'student-not-found') return result;

  const user = result?.user || await BaseClient.ensureAnonymousUser();
  console.warn('[HeroHealth Sandbox QA] using built-in roster fallback', sid, RELEASE);
  return {
    ok: true,
    user,
    roster: { ...fallback },
    rosterPath: `studentsSandbox/${sid}`,
    fallback: true,
    release: RELEASE
  };
}

async function bindStudent(studentId) {
  const sid = String(studentId || '').trim();
  const rosterResult = await readRoster(sid);
  if (!rosterResult?.ok) return rosterResult;

  if (!rosterResult.fallback) return BaseClient.bindStudent(sid);

  const { user, roster } = rosterResult;
  const ref = doc(db, 'studentBindingsSandbox', user.uid);
  await setDoc(ref, {
    uid: user.uid,
    studentId: sid,
    classId: roster.classId || roster.section || '',
    rosterPath: rosterResult.rosterPath,
    boundAt: serverTimestamp(),
    build: RELEASE,
    qaRosterFallback: true
  }, { merge: true });

  return {
    ok: true,
    user,
    roster,
    rosterPath: rosterResult.rosterPath,
    bindingPath: ref.path,
    fallback: true,
    release: RELEASE
  };
}

export const HHFirebaseClient = Object.freeze({
  ...BaseClient,
  release: RELEASE,
  qaRosterFallbackIds: Object.freeze(Object.keys(QA_ROSTER)),
  readRoster,
  bindStudent
});
