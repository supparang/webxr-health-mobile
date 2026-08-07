// English Week Passport • Final Reflection + Journey Summary Authority
// Version: 2026-08-07-JOURNEY-AUTHORITY-V1
'use strict';

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
const VERSION = '2026-08-07-JOURNEY-AUTHORITY-V1';
const APP_ID = 'ENGLISH-WEEK-PASSPORT-2026';
const REGION = 'asia-southeast1';

const COL = Object.freeze({
  progress: 'ewp_progress',
  assessments: 'ewp_assessments',
  gameResults: 'ewp_game_results',
  gameSummary: 'ewp_game_summary',
  events: 'ewp_events',
  reflections: 'ewp_reflections',
  journey: 'ewp_journey'
});

const GAME_STAGES = Object.freeze([
  { id: 'word_match', title: 'LexiMatch Navigator', skill: 'Vocabulary' },
  { id: 'category_forest', title: 'Category Forest', skill: 'Categorization' },
  { id: 'sentence_city', title: 'Sentence City', skill: 'Sentence Building' },
  { id: 'word_detective', title: 'Conversation Quest AR', skill: 'Conversation' },
  { id: 'final_boss', title: 'Champion Command Arena', skill: 'Integrated English' }
]);

const MISSIONS = new Set([...GAME_STAGES.map(item => item.id), 'bonus_lens']);
const HELPED = new Set(['vocabulary', 'context', 'speaking', 'movement', 'strategy']);

const clean = value => String(value == null ? '' : value).trim();
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const nowIso = () => new Date().toISOString();

function error(code, status = 400) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

function latest(rows, predicate) {
  return rows
    .filter(predicate)
    .sort((a, b) => clean(b.submittedAt || b.eventAt).localeCompare(clean(a.submittedAt || a.eventAt)))[0] || null;
}

async function readProgress(playerId) {
  const snap = await db.collection(COL.progress).doc(playerId).get();
  if (!snap.exists) throw error('PLAYER_PROGRESS_NOT_FOUND', 404);
  return snap.data() || {};
}

async function readStatus(playerId) {
  const [progress, reflectionSnap, journeySnap] = await Promise.all([
    readProgress(playerId),
    db.collection(COL.reflections).doc(playerId).get(),
    db.collection(COL.journey).doc(playerId).get()
  ]);
  return {
    postDone: Boolean(progress.postDone),
    reflectionDone: reflectionSnap.exists,
    summaryViewed: Boolean(journeySnap.exists && journeySnap.data()?.summaryViewed),
    authorityCertificateEligible: Boolean(progress.certificateEligible),
    certificateId: clean(progress.certificate?.certificateId)
  };
}

async function handleStatus(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  return { ok: true, mode: 'firebase', playerId, ...(await readStatus(playerId)), version: VERSION };
}

async function handleReflection(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  const progress = await readProgress(playerId);
  if (!progress.postDone) throw error('REFLECTION_NOT_UNLOCKED', 409);

  const confidence = int(payload.confidence, 0);
  const mostUsefulMission = clean(payload.mostUsefulMission);
  const helpedMost = clean(payload.helpedMost).toLowerCase();
  const takeaway = clean(payload.takeaway).slice(0, 240);
  if (confidence < 1 || confidence > 5) throw error('REFLECTION_CONFIDENCE_REQUIRED');
  if (!MISSIONS.has(mostUsefulMission)) throw error('REFLECTION_MISSION_REQUIRED');
  if (!HELPED.has(helpedMost)) throw error('REFLECTION_HELPED_REQUIRED');

  const reflectionRef = db.collection(COL.reflections).doc(playerId);
  const receiptRef = db.collection(COL.events).doc();
  const saved = {
    playerId,
    confidence,
    mostUsefulMission,
    helpedMost,
    takeaway,
    submittedAt: nowIso(),
    sourceVersion: clean(payload.sourceVersion) || VERSION,
    updatedAt: FieldValue.serverTimestamp()
  };

  await db.runTransaction(async transaction => {
    transaction.set(reflectionRef, saved, { merge: true });
    transaction.set(receiptRef, {
      eventId: receiptRef.id,
      eventAt: nowIso(),
      eventName: 'final_reflection_submitted',
      stageId: 'final_reflection',
      playerId,
      payload: { confidence, mostUsefulMission, helpedMost, hasTakeaway: Boolean(takeaway) },
      sourceVersion: VERSION,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return {
    ok: true,
    mode: 'firebase',
    receiptId: `FBR-${receiptRef.id}`,
    reflection: { confidence, mostUsefulMission, helpedMost, takeaway },
    reflectionDone: true,
    version: VERSION
  };
}

async function buildJourneySummary(playerId) {
  const progress = await readProgress(playerId);
  if (!progress.postDone) throw error('JOURNEY_SUMMARY_NOT_UNLOCKED', 409);

  const reflectionSnap = await db.collection(COL.reflections).doc(playerId).get();
  if (!reflectionSnap.exists) throw error('FINAL_REFLECTION_REQUIRED', 409);

  const [assessmentSnap, resultSnap, eventSnap, ...summarySnaps] = await Promise.all([
    db.collection(COL.assessments).where('playerId', '==', playerId).get(),
    db.collection(COL.gameResults).where('playerId', '==', playerId).get(),
    db.collection(COL.events).where('playerId', '==', playerId).get(),
    ...GAME_STAGES.map(stage => db.collection(COL.gameSummary).doc(`${playerId}__${stage.id}`).get())
  ]);

  const assessments = assessmentSnap.docs.map(doc => doc.data() || {});
  const results = resultSnap.docs.map(doc => doc.data() || {});
  const events = eventSnap.docs.map(doc => doc.data() || {});
  const pre = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'pre');
  const post = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'post');
  const preAccuracy = int(pre?.accuracy, 0);
  const postAccuracy = int(post?.accuracy, 0);
  const learningGain = postAccuracy - preAccuracy;

  const games = GAME_STAGES.map((stage, index) => {
    const saved = summarySnaps[index].exists ? summarySnaps[index].data() || {} : {};
    const stageResults = results.filter(row => clean(row.stageId) === stage.id);
    return {
      stageId: stage.id,
      title: stage.title,
      skill: stage.skill,
      bestAccuracy: int(saved.bestAccuracy, 0),
      attempts: int(saved.attempts, stageResults.length),
      passed: Boolean(saved.passed),
      durationMs: stageResults.reduce((sum, row) => sum + int(row.durationMs, 0), 0)
    };
  });

  const bonusEvent = latest(events, row => clean(row.eventName) === 'lens_result_summary' && clean(row.stageId) === 'bonus_lens');
  const bonusPayload = bonusEvent?.payload && typeof bonusEvent.payload === 'object' ? bonusEvent.payload : null;
  const bonus = bonusPayload ? {
    played: true,
    score: int(bonusPayload.score, 0),
    correctContexts: int(bonusPayload.correctContexts, 0),
    totalScans: int(bonusPayload.totalScans, 0),
    durationMs: int(bonusPayload.durationMs, 0)
  } : { played: false, score: 0, correctContexts: 0, totalScans: 0, durationMs: 0 };

  const totalDurationMs = int(pre?.durationMs, 0) + int(post?.durationMs, 0)
    + games.reduce((sum, game) => sum + game.durationMs, 0) + bonus.durationMs;
  const totalAttempts = games.reduce((sum, game) => sum + game.attempts, 0);
  const strongest = games.slice().sort((a, b) => b.bestAccuracy - a.bestAccuracy)[0] || null;
  const averageGameAccuracy = games.length
    ? Math.round(games.reduce((sum, game) => sum + game.bestAccuracy, 0) / games.length)
    : 0;

  const badge = postAccuracy >= 90 && averageGameAccuracy >= 85
    ? 'English Champion'
    : learningGain >= 20
      ? 'Growth Star'
      : strongest?.bestAccuracy >= 90
        ? `${strongest.skill} Master`
        : 'LEXICON X Explorer';

  const reflection = reflectionSnap.data() || {};
  return {
    playerId,
    pre: { accuracy: preAccuracy, durationMs: int(pre?.durationMs, 0), formId: clean(pre?.formId) },
    post: { accuracy: postAccuracy, durationMs: int(post?.durationMs, 0), formId: clean(post?.formId) },
    learningGain,
    games,
    bonus,
    totalDurationMs,
    totalAttempts,
    averageGameAccuracy,
    strongestSkill: strongest ? { stageId: strongest.stageId, skill: strongest.skill, accuracy: strongest.bestAccuracy } : null,
    badge,
    reflection: {
      confidence: int(reflection.confidence, 0),
      mostUsefulMission: clean(reflection.mostUsefulMission),
      helpedMost: clean(reflection.helpedMost),
      takeaway: clean(reflection.takeaway)
    },
    generatedAt: nowIso()
  };
}

async function handleJourneySummary(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  const summary = await buildJourneySummary(playerId);
  const status = await readStatus(playerId);
  return { ok: true, mode: 'firebase', summary, ...status, version: VERSION };
}

async function handleCompleteSummary(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  const summary = await buildJourneySummary(playerId);
  const journeyRef = db.collection(COL.journey).doc(playerId);
  const receiptRef = db.collection(COL.events).doc();
  const completedAt = nowIso();

  await db.runTransaction(async transaction => {
    transaction.set(journeyRef, {
      playerId,
      summaryViewed: true,
      summaryViewedAt: completedAt,
      learningGain: summary.learningGain,
      averageGameAccuracy: summary.averageGameAccuracy,
      totalAttempts: summary.totalAttempts,
      totalDurationMs: summary.totalDurationMs,
      badge: summary.badge,
      strongestSkill: summary.strongestSkill,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(receiptRef, {
      eventId: receiptRef.id,
      eventAt: completedAt,
      eventName: 'journey_summary_completed',
      stageId: 'journey_summary',
      playerId,
      payload: {
        learningGain: summary.learningGain,
        averageGameAccuracy: summary.averageGameAccuracy,
        totalAttempts: summary.totalAttempts,
        totalDurationMs: summary.totalDurationMs,
        badge: summary.badge
      },
      sourceVersion: VERSION,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return {
    ok: true,
    mode: 'firebase',
    receiptId: `FBJ-${receiptRef.id}`,
    summaryViewed: true,
    certificateUnlocked: true,
    version: VERSION
  };
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
  if (action === 'health') return { ok: true, mode: 'firebase', service: 'English Week Journey Authority', version: VERSION, serverTime: nowIso() };
  if (action === 'status') return handleStatus(payload);
  if (action === 'submit_reflection') return handleReflection(payload);
  if (action === 'journey_summary') return handleJourneySummary(payload);
  if (action === 'complete_summary') return handleCompleteSummary(payload);
  throw error('UNKNOWN_ACTION', 404);
}

export const englishWeekJourney = onRequest({
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
    const result = await route(clean(payload.action || 'health'), payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('English Week Journey error', err);
    return res.status(Number(err.status || 500)).json({
      ok: false,
      mode: 'firebase',
      error: clean(err.code || err.message || 'INTERNAL_ERROR'),
      version: VERSION,
      serverTime: nowIso()
    });
  }
});
