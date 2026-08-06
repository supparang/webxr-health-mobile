// English Week Passport • Firebase Cloud Authority
// Version: 2026-08-06-FIREBASE-AUTHORITY-V1
'use strict';

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
const VERSION = '2026-08-06-FIREBASE-AUTHORITY-V1';
const ASSIGNMENT_VERSION = '2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT';
const APP_ID = 'ENGLISH-WEEK-PASSPORT-2026';
const REGION = 'asia-southeast1';

const FLOW = Object.freeze([
  'pre_challenge',
  'word_match',
  'category_forest',
  'sentence_city',
  'word_detective',
  'final_boss',
  'post_challenge',
  'certificate'
]);

const PASS_MARKS = Object.freeze({
  word_match: 70,
  category_forest: 70,
  sentence_city: 70,
  word_detective: 70,
  final_boss: 65
});

const COL = Object.freeze({
  profiles: 'ewp_profiles',
  progress: 'ewp_progress',
  assignments: 'ewp_assignments',
  gameResults: 'ewp_game_results',
  gameSummary: 'ewp_game_summary',
  assessments: 'ewp_assessments',
  events: 'ewp_events',
  certificates: 'ewp_certificates'
});

const clean = value => String(value == null ? '' : value).trim();
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const array = value => Array.isArray(value) ? value : [];
const nowIso = () => new Date().toISOString();
const unique = values => [...new Set(array(values).map(clean).filter(Boolean))];

function error(code, status = 400) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

function hash32(value) {
  const input = clean(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value) {
  let x = Number(value) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function assignmentFor(playerId) {
  const id = clean(playerId);
  const passportHash = mix32(hash32(`${APP_ID}|${id}|passport|${ASSIGNMENT_VERSION}`));
  const reversedId = Array.from(id).reverse().join('');
  const assessmentHash = mix32(hash32(`assessment|${reversedId}|${ASSIGNMENT_VERSION}|${APP_ID}`));
  const passportRotation = ['P1', 'P2', 'P3', 'P4'][passportHash % 4];
  const assessmentRotation = ['R1', 'R2'][(assessmentHash >>> 16) % 2];
  const randomSeed = mix32(hash32(`${ASSIGNMENT_VERSION}|seed|${id}|${APP_ID}`));
  return {
    playerId: id,
    passportRotation,
    assessmentRotation,
    preForm: assessmentRotation === 'R1' ? 'A' : 'B',
    postForm: assessmentRotation === 'R1' ? 'B' : 'A',
    randomSeed,
    randomSeedHex: randomSeed.toString(16).padStart(8, '0'),
    assignmentVersion: ASSIGNMENT_VERSION,
    assignmentSource: 'firebase-deterministic-authority',
    assignmentLocked: true
  };
}

function defaultProgress(playerId) {
  return reconcileProgress({
    playerId,
    currentStage: 'pre_challenge',
    unlocked: ['pre_challenge'],
    passed: [],
    bestScores: {},
    preDone: false,
    postDone: false,
    finalDone: false,
    certificateEligible: false,
    certificate: null,
    totalScore: 0,
    updatedAt: nowIso()
  });
}

function reconcileProgress(value) {
  const passed = unique(value?.passed).filter(stage => Object.hasOwn(PASS_MARKS, stage));
  const bestScores = value?.bestScores && typeof value.bestScores === 'object' ? value.bestScores : {};
  const preDone = Boolean(value?.preDone);
  const postDone = Boolean(value?.postDone);
  const unlocked = ['pre_challenge'];
  if (preDone) unlocked.push('word_match');
  if (passed.includes('word_match')) unlocked.push('category_forest');
  if (passed.includes('category_forest')) unlocked.push('sentence_city');
  if (passed.includes('sentence_city')) unlocked.push('word_detective');
  if (passed.includes('word_detective')) unlocked.push('final_boss');
  if (passed.includes('final_boss')) unlocked.push('post_challenge');
  if (postDone) unlocked.push('certificate');
  const totalScore = Object.values(bestScores).reduce((sum, score) => sum + Number(score || 0), 0);
  return {
    playerId: clean(value?.playerId),
    currentStage: unlocked[unlocked.length - 1],
    unlocked,
    passed,
    bestScores,
    preDone,
    postDone,
    finalDone: Boolean(value?.finalDone || passed.includes('final_boss')),
    certificateEligible: Boolean(value?.certificateEligible || postDone),
    certificate: value?.certificate || null,
    totalScore,
    updatedAt: nowIso()
  };
}

function isQaPlayer(playerId) {
  const id = clean(playerId);
  return /^(QA|TEST)[-_]/i.test(id) || /^99\d{4,}$/.test(id);
}

async function ensureProfile(playerId, nickname = '') {
  const id = clean(playerId);
  if (!id) throw error('PLAYER_ID_REQUIRED');
  const ref = db.collection(COL.profiles).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const profile = { playerId: id, ...snap.data() };
    if (profile.active === false) throw error('PLAYER_INACTIVE', 403);
    await ref.set({ lastSeenAt: nowIso(), updatedAt: nowIso() }, { merge: true });
    return profile;
  }
  if (!isQaPlayer(id)) throw error('PLAYER_NOT_FOUND', 404);
  const label = clean(nickname) || `Test Player ${id}`;
  const profile = {
    playerId: id,
    fullName: label,
    nickname: label,
    groupName: 'English Week QA',
    institution: 'QA',
    active: true,
    profileSource: 'firebase-qa-auto-registration',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastSeenAt: nowIso()
  };
  await ref.set(profile, { merge: false });
  return profile;
}

async function ensureAssignment(playerId) {
  const computed = assignmentFor(playerId);
  const ref = db.collection(COL.assignments).doc(clean(playerId));
  const snap = await ref.get();
  if (snap.exists) {
    const saved = snap.data() || {};
    if (saved.assignmentVersion === ASSIGNMENT_VERSION && saved.assignmentLocked === true) {
      return { ...computed, ...saved, playerId: clean(playerId) };
    }
  }
  const value = { ...computed, assignedAt: nowIso(), updatedAt: nowIso() };
  await ref.set(value, { merge: false });
  return value;
}

async function ensureProgress(playerId) {
  const id = clean(playerId);
  const ref = db.collection(COL.progress).doc(id);
  const snap = await ref.get();
  if (snap.exists) return reconcileProgress({ playerId: id, ...snap.data() });
  const progress = defaultProgress(id);
  await ref.set(progress, { merge: false });
  return progress;
}

function authority(profile, progress, assignment) {
  return {
    ok: true,
    mode: 'firebase',
    sourceOfTruth: 'Firebase Cloud Authority',
    profile,
    progress,
    assignment,
    policy: {
      flow: FLOW,
      passMarks: PASS_MARKS,
      assignmentVersion: ASSIGNMENT_VERSION,
      qaAutoRegistration: true,
      productionRosterRequiredForNonQaIds: true
    },
    version: VERSION,
    serverTime: nowIso()
  };
}

function validateAssignment(payload, assignment) {
  const rotation = clean(payload?.passportRotation);
  const seed = Number(payload?.randomSeed);
  if (rotation && rotation !== assignment.passportRotation) throw error('ASSIGNMENT_ROTATION_MISMATCH', 409);
  if (Number.isFinite(seed) && (seed >>> 0) !== (assignment.randomSeed >>> 0)) throw error('ASSIGNMENT_SEED_MISMATCH', 409);
}

function validateCategoryEvidence(payload, assignment) {
  if (clean(payload?.stageId) !== 'category_forest') return;
  const answers = array(payload?.answers);
  const summary = answers.find(item => item?.itemId === '__summary__') || {};
  const order = array(summary.itemOrder || payload.itemOrder).map(clean).filter(Boolean);
  if (order.length !== 10 || new Set(order).size !== 10) throw error('CATEGORY_ITEM_ORDER_INVALID');
  if (clean(summary.passportRotation || payload.passportRotation) !== assignment.passportRotation) {
    throw error('CATEGORY_ROTATION_EVIDENCE_MISMATCH', 409);
  }
  if (!clean(summary.wordSetId || payload.wordSetId)) throw error('CATEGORY_WORD_SET_REQUIRED');
}

async function handleProfileLookup(payload) {
  const profile = await ensureProfile(payload.playerId, payload.nickname);
  const assignment = await ensureAssignment(profile.playerId);
  return { ok: true, mode: 'firebase', profile, assignment, version: VERSION };
}

async function handleResume(payload) {
  const profile = await ensureProfile(payload.playerId, payload.nickname);
  const [progress, assignment] = await Promise.all([
    ensureProgress(profile.playerId),
    ensureAssignment(profile.playerId)
  ]);
  return authority(profile, progress, assignment);
}

async function handleAssessment(payload) {
  const profile = await ensureProfile(payload.playerId, payload.nickname);
  const assignment = await ensureAssignment(profile.playerId);
  validateAssignment(payload, assignment);
  const assessmentType = clean(payload.assessmentType).toLowerCase();
  if (!['pre', 'post'].includes(assessmentType)) throw error('INVALID_ASSESSMENT_TYPE');
  const score = int(payload.score, -1);
  const total = int(payload.total, 0);
  if (total <= 0 || score < 0 || score > total) throw error('INVALID_SCORE');
  const accuracy = Math.round((score / total) * 100);
  const progressRef = db.collection(COL.progress).doc(profile.playerId);
  const assessmentRef = db.collection(COL.assessments).doc();
  const certificateRef = db.collection(COL.certificates).doc();
  let savedProgress;

  await db.runTransaction(async transaction => {
    const progressSnap = await transaction.get(progressRef);
    const progress = progressSnap.exists
      ? reconcileProgress({ playerId: profile.playerId, ...progressSnap.data() })
      : defaultProgress(profile.playerId);
    if (assessmentType === 'post' && !progress.passed.includes('final_boss')) throw error('POST_NOT_UNLOCKED', 409);
    const expectedForm = assessmentType === 'post' ? assignment.postForm : assignment.preForm;
    const suppliedForm = clean(payload.formId);
    if (suppliedForm && suppliedForm !== expectedForm) throw error('ASSESSMENT_FORM_MISMATCH', 409);

    const assessmentId = assessmentRef.id;
    transaction.set(assessmentRef, {
      assessmentId,
      submittedAt: nowIso(),
      playerId: profile.playerId,
      fullName: profile.fullName,
      groupName: profile.groupName,
      assessmentType,
      formId: expectedForm,
      score,
      total,
      accuracy,
      durationMs: int(payload.durationMs, 0),
      answers: array(payload.answers),
      assignment,
      sourceVersion: clean(payload.sourceVersion) || VERSION,
      createdAt: FieldValue.serverTimestamp()
    });

    progress.preDone = progress.preDone || assessmentType === 'pre';
    progress.postDone = progress.postDone || assessmentType === 'post';
    if (assessmentType === 'post') {
      progress.certificateEligible = true;
      if (!progress.certificate?.certificateId) {
        progress.certificate = {
          certificateId: certificateRef.id,
          issuedAt: nowIso(),
          awardLevel: progress.totalScore >= 450 ? 'English Week Champion' : progress.totalScore >= 400 ? 'Word Master' : progress.totalScore >= 325 ? 'Vocabulary Adventurer' : 'English Explorer'
        };
        transaction.set(certificateRef, {
          ...progress.certificate,
          playerId: profile.playerId,
          fullName: profile.fullName,
          groupName: profile.groupName,
          totalScore: progress.totalScore,
          active: true,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }
    savedProgress = reconcileProgress(progress);
    transaction.set(progressRef, savedProgress, { merge: false });
  });

  return {
    ok: true,
    mode: 'firebase',
    receiptId: `FBA-${assessmentRef.id}`,
    assessmentId: assessmentRef.id,
    accuracy,
    authority: authority(profile, savedProgress, assignment),
    version: VERSION
  };
}

async function handleGameResult(payload) {
  const profile = await ensureProfile(payload.playerId, payload.nickname);
  const assignment = await ensureAssignment(profile.playerId);
  validateAssignment(payload, assignment);
  validateCategoryEvidence(payload, assignment);
  const stageId = clean(payload.stageId);
  if (!Object.hasOwn(PASS_MARKS, stageId)) throw error('INVALID_STAGE');
  const score = int(payload.score, -1);
  const total = int(payload.total, 0);
  if (total <= 0 || score < 0 || score > total) throw error('INVALID_SCORE');
  const accuracy = Math.round((score / total) * 100);
  const passMark = PASS_MARKS[stageId];
  const passed = accuracy >= passMark;
  const progressRef = db.collection(COL.progress).doc(profile.playerId);
  const summaryRef = db.collection(COL.gameSummary).doc(`${profile.playerId}__${stageId}`);
  const resultRef = db.collection(COL.gameResults).doc();
  let savedProgress;
  let attemptNo = 1;

  await db.runTransaction(async transaction => {
    const [progressSnap, summarySnap] = await Promise.all([
      transaction.get(progressRef),
      transaction.get(summaryRef)
    ]);
    const progress = progressSnap.exists
      ? reconcileProgress({ playerId: profile.playerId, ...progressSnap.data() })
      : defaultProgress(profile.playerId);
    if (!progress.unlocked.includes(stageId)) throw error('STAGE_LOCKED', 409);
    const summary = summarySnap.exists ? summarySnap.data() || {} : {};
    attemptNo = int(summary.attempts, 0) + 1;

    transaction.set(resultRef, {
      resultId: resultRef.id,
      submittedAt: nowIso(),
      playerId: profile.playerId,
      fullName: profile.fullName,
      groupName: profile.groupName,
      stageId,
      score,
      total,
      accuracy,
      passMark,
      passed,
      durationMs: int(payload.durationMs, 0),
      attemptNo,
      clientPoints: int(payload.clientPoints, 0),
      answers: array(payload.answers),
      wordSetId: clean(payload.wordSetId),
      itemOrder: array(payload.itemOrder),
      assignment,
      sourceVersion: clean(payload.sourceVersion) || VERSION,
      createdAt: FieldValue.serverTimestamp()
    });

    transaction.set(summaryRef, {
      playerId: profile.playerId,
      stageId,
      bestScore: Math.max(int(summary.bestScore, 0), score),
      bestAccuracy: Math.max(int(summary.bestAccuracy, 0), accuracy),
      passed: Boolean(summary.passed || passed),
      attempts: attemptNo,
      lastResultId: resultRef.id,
      lastPlayedAt: nowIso(),
      updatedAt: nowIso()
    }, { merge: false });

    progress.bestScores[stageId] = Math.max(Number(progress.bestScores[stageId] || 0), accuracy);
    if (passed && !progress.passed.includes(stageId)) progress.passed.push(stageId);
    if (stageId === 'final_boss' && passed) progress.finalDone = true;
    savedProgress = reconcileProgress(progress);
    transaction.set(progressRef, savedProgress, { merge: false });
  });

  return {
    ok: true,
    mode: 'firebase',
    receiptId: `FBG-${resultRef.id}`,
    resultId: resultRef.id,
    passed,
    accuracy,
    passMark,
    attemptNo,
    authority: authority(profile, savedProgress, assignment),
    version: VERSION
  };
}

async function handleEvent(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  const ref = db.collection(COL.events).doc();
  await ref.set({
    eventId: ref.id,
    eventAt: nowIso(),
    playerId,
    eventName: clean(payload.eventName),
    stageId: clean(payload.stageId),
    payload: payload.payload && typeof payload.payload === 'object' ? payload.payload : {},
    sourceVersion: clean(payload.sourceVersion) || VERSION,
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, mode: 'firebase', eventId: ref.id, version: VERSION };
}

async function handleLeaderboard(payload) {
  const limit = Math.max(1, Math.min(100, int(payload.limit, 10)));
  const snap = await db.collection(COL.progress).orderBy('totalScore', 'desc').limit(limit).get();
  const rows = await Promise.all(snap.docs.map(async document => {
    const progress = document.data() || {};
    const profileSnap = await db.collection(COL.profiles).doc(document.id).get();
    const profile = profileSnap.exists ? profileSnap.data() || {} : {};
    return {
      playerId: document.id,
      nickname: profile.nickname || profile.fullName || document.id,
      fullName: profile.fullName || '',
      groupName: profile.groupName || '',
      totalScore: Number(progress.totalScore || 0),
      completed: Boolean(progress.postDone)
    };
  }));
  return { ok: true, mode: 'firebase', rows, generatedAt: nowIso(), version: VERSION };
}

function applyCors(req, res) {
  const origin = clean(req.get('origin'));
  const allowed = !origin || origin === 'https://supparang.github.io' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!allowed) throw error('ORIGIN_NOT_ALLOWED', 403);
  res.set('Access-Control-Allow-Origin', origin || '*');
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-EW-App-Id');
  res.set('Cache-Control', 'no-store');
}

async function route(action, payload) {
  if (action === 'health') return {
    ok: true,
    mode: 'firebase',
    service: 'English Week Passport Firebase Authority',
    projectId: 'english-d4bfa',
    region: REGION,
    version: VERSION,
    flow: FLOW,
    passMarks: PASS_MARKS,
    serverTime: nowIso()
  };
  if (action === 'profile_lookup') return handleProfileLookup(payload);
  if (action === 'player_resume') return handleResume(payload);
  if (action === 'submit_assessment') return handleAssessment(payload);
  if (action === 'submit_game_result') return handleGameResult(payload);
  if (action === 'submit_event') return handleEvent(payload);
  if (action === 'leaderboard') return handleLeaderboard(payload);
  throw error('UNKNOWN_ACTION', 404);
}

export const englishWeekAuthority = onRequest({
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 10,
  cors: false
}, async (req, res) => {
  try {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!['GET', 'POST'].includes(req.method)) throw error('METHOD_NOT_ALLOWED', 405);
    const payload = {
      ...(req.query || {}),
      ...(req.body && typeof req.body === 'object' ? req.body : {})
    };
    if (clean(payload.appId) && clean(payload.appId) !== APP_ID) throw error('APP_ID_MISMATCH', 403);
    const action = clean(payload.action || 'health');
    const result = await route(action, payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('English Week Authority error', err);
    return res.status(Number(err.status || 500)).json({
      ok: false,
      mode: 'firebase',
      error: clean(err.code || err.message || 'INTERNAL_ERROR'),
      version: VERSION,
      serverTime: nowIso()
    });
  }
});
