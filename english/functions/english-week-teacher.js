// LEXICON X Challenge • Teacher Analytics Authority R1
// Version: 2026-08-07-TEACHER-AUTHORITY-R1
'use strict';

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();
const VERSION = '2026-08-07-TEACHER-AUTHORITY-R1';
const REGION = 'asia-southeast1';
const APP_ID = 'ENGLISH-WEEK-PASSPORT-2026';
const TEACHER_KEY = defineSecret('EW_TEACHER_KEY');

const COL = Object.freeze({
  profiles: 'ewp_profiles',
  progress: 'ewp_progress',
  assessments: 'ewp_assessments',
  gameResults: 'ewp_game_results',
  gameSummary: 'ewp_game_summary',
  events: 'ewp_events',
  reflections: 'ewp_reflections',
  journey: 'ewp_journey',
  certificates: 'ewp_certificates'
});

const GAME_STAGES = Object.freeze([
  { id: 'word_match', title: 'LexiMatch Navigator', skill: 'Vocabulary' },
  { id: 'category_forest', title: 'Category Forest', skill: 'Categorization' },
  { id: 'sentence_city', title: 'Sentence City', skill: 'Sentence Building' },
  { id: 'word_detective', title: 'Conversation Quest AR', skill: 'Conversation' },
  { id: 'final_boss', title: 'Champion Command Arena', skill: 'Integrated English' }
]);

const clean = value => String(value == null ? '' : value).trim();
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nowIso = () => new Date().toISOString();

function error(code, status = 400) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}

function applyCors(req, res) {
  const origin = clean(req.get('origin'));
  const allowed = !origin || origin === 'https://supparang.github.io' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!allowed) throw error('ORIGIN_NOT_ALLOWED', 403);
  res.set('Access-Control-Allow-Origin', origin || '*');
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,X-EW-App-Id,X-EW-Teacher-Key');
  res.set('Cache-Control', 'no-store');
}

function requireTeacher(req) {
  const expected = clean(TEACHER_KEY.value());
  if (!expected) throw error('TEACHER_SECRET_NOT_CONFIGURED', 503);
  const supplied = clean(req.get('X-EW-Teacher-Key'));
  if (!supplied || supplied !== expected) throw error('TEACHER_UNAUTHORIZED', 401);
}

function docs(snapshot) {
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
}

function latest(rows, predicate) {
  return rows
    .filter(predicate)
    .sort((a, b) => clean(b.submittedAt || b.eventAt || b.updatedAt).localeCompare(clean(a.submittedAt || a.eventAt || a.updatedAt)))[0] || null;
}

async function readBase() {
  const [profilesSnap, progressSnap, assessmentsSnap, summariesSnap, reflectionsSnap, journeySnap] = await Promise.all([
    db.collection(COL.profiles).get(),
    db.collection(COL.progress).get(),
    db.collection(COL.assessments).get(),
    db.collection(COL.gameSummary).get(),
    db.collection(COL.reflections).get(),
    db.collection(COL.journey).get()
  ]);
  return {
    profiles: docs(profilesSnap),
    progress: docs(progressSnap),
    assessments: docs(assessmentsSnap),
    summaries: docs(summariesSnap),
    reflections: docs(reflectionsSnap),
    journey: docs(journeySnap)
  };
}

function mapById(rows, key = 'id') {
  const map = new Map();
  rows.forEach(row => map.set(clean(row[key]), row));
  return map;
}

function stageLabel(progress) {
  if (!progress?.preDone) return 'Pre-Challenge';
  const passed = Array.isArray(progress?.passed) ? progress.passed : [];
  if (!passed.includes('word_match')) return 'Game 1';
  if (!passed.includes('category_forest')) return 'Game 2';
  if (!passed.includes('sentence_city')) return 'Game 3';
  if (!passed.includes('word_detective')) return 'Game 4';
  if (!passed.includes('final_boss')) return 'Game 5';
  if (!progress?.postDone) return 'Post-Challenge';
  return 'Post Complete';
}

function participantRows(base) {
  const profileMap = mapById(base.profiles, 'playerId');
  const progressMap = mapById(base.progress, 'playerId');
  const reflectionMap = mapById(base.reflections, 'playerId');
  const journeyMap = mapById(base.journey, 'playerId');
  const ids = new Set([...profileMap.keys(), ...progressMap.keys()]);

  const assessmentByPlayer = new Map();
  base.assessments.forEach(row => {
    const playerId = clean(row.playerId);
    if (!assessmentByPlayer.has(playerId)) assessmentByPlayer.set(playerId, []);
    assessmentByPlayer.get(playerId).push(row);
  });
  const summariesByPlayer = new Map();
  base.summaries.forEach(row => {
    const playerId = clean(row.playerId);
    if (!summariesByPlayer.has(playerId)) summariesByPlayer.set(playerId, []);
    summariesByPlayer.get(playerId).push(row);
  });

  return [...ids].filter(Boolean).map(playerId => {
    const profile = profileMap.get(playerId) || {};
    const progress = progressMap.get(playerId) || {};
    const assessments = assessmentByPlayer.get(playerId) || [];
    const pre = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'pre');
    const post = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'post');
    const summaries = summariesByPlayer.get(playerId) || [];
    const gameValues = GAME_STAGES.map(stage => summaries.find(row => clean(row.stageId) === stage.id)).filter(Boolean);
    const averageGameAccuracy = gameValues.length
      ? Math.round(gameValues.reduce((sum, row) => sum + num(row.bestAccuracy), 0) / gameValues.length)
      : 0;
    const totalAttempts = gameValues.reduce((sum, row) => sum + num(row.attempts), 0);
    const preAccuracy = pre ? num(pre.accuracy) : null;
    const postAccuracy = post ? num(post.accuracy) : null;
    const reflection = reflectionMap.get(playerId) || null;
    const journey = journeyMap.get(playerId) || null;
    const passed = Array.isArray(progress.passed) ? progress.passed : [];
    return {
      playerId,
      nickname: clean(profile.nickname || profile.fullName || playerId),
      fullName: clean(profile.fullName || profile.nickname || playerId),
      groupName: clean(profile.groupName || 'English Week'),
      active: profile.active !== false,
      stage: stageLabel(progress),
      passedCount: passed.length,
      preDone: Boolean(progress.preDone),
      postDone: Boolean(progress.postDone),
      preAccuracy,
      postAccuracy,
      learningGain: preAccuracy != null && postAccuracy != null ? postAccuracy - preAccuracy : null,
      averageGameAccuracy,
      totalAttempts,
      reflectionDone: Boolean(reflection),
      reflectionConfidence: reflection ? num(reflection.confidence) : null,
      summaryViewed: Boolean(journey?.summaryViewed),
      certificateEligible: Boolean(progress.certificateEligible),
      certificateId: clean(progress.certificate?.certificateId),
      totalScore: num(progress.totalScore),
      lastSeenAt: clean(profile.lastSeenAt || progress.updatedAt || profile.updatedAt),
      updatedAt: clean(progress.updatedAt || profile.updatedAt)
    };
  }).sort((a, b) => a.groupName.localeCompare(b.groupName) || a.fullName.localeCompare(b.fullName));
}

function aggregateOverview(base, participants) {
  const total = participants.length;
  const completed = key => participants.filter(row => row[key]).length;
  const funnel = [
    ['Roster', total],
    ['Pre', completed('preDone')],
    ['Game 1', participants.filter(r => r.passedCount >= 1).length],
    ['Game 2', participants.filter(r => r.passedCount >= 2).length],
    ['Game 3', participants.filter(r => r.passedCount >= 3).length],
    ['Game 4', participants.filter(r => r.passedCount >= 4).length],
    ['Game 5', participants.filter(r => r.passedCount >= 5).length],
    ['Post', completed('postDone')],
    ['Reflection', completed('reflectionDone')],
    ['Summary', completed('summaryViewed')],
    ['Certificate', participants.filter(r => r.summaryViewed && r.certificateEligible).length]
  ].map(([stage, count]) => ({ stage, count, pct: total ? Math.round(count / total * 100) : 0 }));

  const gains = participants.filter(row => row.learningGain != null).map(row => row.learningGain);
  const preValues = participants.filter(row => row.preAccuracy != null).map(row => row.preAccuracy);
  const postValues = participants.filter(row => row.postAccuracy != null).map(row => row.postAccuracy);
  const mean = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  const games = GAME_STAGES.map(stage => {
    const rows = base.summaries.filter(row => clean(row.stageId) === stage.id);
    return {
      ...stage,
      players: rows.length,
      passed: rows.filter(row => Boolean(row.passed)).length,
      avgBestAccuracy: mean(rows.map(row => num(row.bestAccuracy))),
      avgAttempts: rows.length ? Number((rows.reduce((sum, row) => sum + num(row.attempts), 0) / rows.length).toFixed(1)) : 0
    };
  });

  const issues = [];
  participants.forEach(row => {
    if (row.postDone && !row.reflectionDone) issues.push({ playerId: row.playerId, name: row.nickname, type: 'REFLECTION_PENDING', detail: 'Post สำเร็จแล้ว แต่ยังไม่มี Final Reflection' });
    if (row.reflectionDone && !row.summaryViewed) issues.push({ playerId: row.playerId, name: row.nickname, type: 'SUMMARY_PENDING', detail: 'Reflection สำเร็จแล้ว แต่ยังไม่ได้ยืนยัน Journey Summary' });
    if (row.summaryViewed && !row.certificateEligible) issues.push({ playerId: row.playerId, name: row.nickname, type: 'CERTIFICATE_MISMATCH', detail: 'Journey Summary สำเร็จ แต่ Authority ยังไม่ระบุ Certificate eligible' });
    if (row.preDone && row.passedCount === 0 && !row.postDone) issues.push({ playerId: row.playerId, name: row.nickname, type: 'PROGRESS_STALLED', detail: 'ทำ Pre แล้ว แต่ยังไม่มีเกมที่ผ่าน' });
  });

  return {
    totals: {
      participants: total,
      preDone: completed('preDone'),
      postDone: completed('postDone'),
      reflectionDone: completed('reflectionDone'),
      summaryViewed: completed('summaryViewed'),
      certificatesReady: participants.filter(r => r.summaryViewed && r.certificateEligible).length,
      dataIssues: issues.length
    },
    learning: { meanPre: mean(preValues), meanPost: mean(postValues), meanGain: mean(gains), pairedN: gains.length },
    funnel,
    games,
    issues: issues.slice(0, 100)
  };
}

async function handleOverview() {
  const base = await readBase();
  const participants = participantRows(base);
  return { ok: true, mode: 'firebase', overview: aggregateOverview(base, participants), participants, generatedAt: nowIso(), version: VERSION };
}

async function handleParticipantReport(payload) {
  const playerId = clean(payload.playerId);
  if (!playerId) throw error('PLAYER_ID_REQUIRED');
  const [profileSnap, progressSnap, reflectionSnap, journeySnap, assessmentSnap, resultSnap, eventSnap, ...summarySnaps] = await Promise.all([
    db.collection(COL.profiles).doc(playerId).get(),
    db.collection(COL.progress).doc(playerId).get(),
    db.collection(COL.reflections).doc(playerId).get(),
    db.collection(COL.journey).doc(playerId).get(),
    db.collection(COL.assessments).where('playerId', '==', playerId).get(),
    db.collection(COL.gameResults).where('playerId', '==', playerId).get(),
    db.collection(COL.events).where('playerId', '==', playerId).get(),
    ...GAME_STAGES.map(stage => db.collection(COL.gameSummary).doc(`${playerId}__${stage.id}`).get())
  ]);
  if (!profileSnap.exists && !progressSnap.exists) throw error('PLAYER_NOT_FOUND', 404);
  const assessments = docs(assessmentSnap);
  const results = docs(resultSnap).sort((a, b) => clean(a.submittedAt).localeCompare(clean(b.submittedAt)));
  const events = docs(eventSnap).sort((a, b) => clean(b.eventAt).localeCompare(clean(a.eventAt))).slice(0, 100);
  const games = GAME_STAGES.map((stage, index) => ({ ...stage, ...(summarySnaps[index].exists ? summarySnaps[index].data() || {} : {}) }));
  const pre = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'pre');
  const post = latest(assessments, row => clean(row.assessmentType).toLowerCase() === 'post');
  const preAccuracy = pre ? num(pre.accuracy) : null;
  const postAccuracy = post ? num(post.accuracy) : null;
  const lens = latest(events, row => clean(row.stageId) === 'bonus_lens' && clean(row.eventName) === 'lens_result_summary');
  return {
    ok: true,
    mode: 'firebase',
    report: {
      playerId,
      profile: profileSnap.exists ? profileSnap.data() || {} : {},
      progress: progressSnap.exists ? progressSnap.data() || {} : {},
      assessments: { pre, post, learningGain: preAccuracy != null && postAccuracy != null ? postAccuracy - preAccuracy : null },
      games,
      attempts: results,
      bonusLens: lens?.payload || null,
      reflection: reflectionSnap.exists ? reflectionSnap.data() || {} : null,
      journey: journeySnap.exists ? journeySnap.data() || {} : null,
      recentEvents: events
    },
    generatedAt: nowIso(),
    version: VERSION
  };
}

async function handleExport(payload) {
  const kind = clean(payload.kind || 'participants').toLowerCase();
  const base = await readBase();
  if (kind === 'participants') return { ok: true, mode: 'firebase', kind, rows: participantRows(base), version: VERSION };
  if (kind === 'games') {
    const rows = base.summaries.map(row => ({
      playerId: clean(row.playerId),
      stageId: clean(row.stageId),
      bestScore: num(row.bestScore),
      bestAccuracy: num(row.bestAccuracy),
      passed: Boolean(row.passed),
      attempts: num(row.attempts),
      lastResultId: clean(row.lastResultId),
      lastPlayedAt: clean(row.lastPlayedAt)
    }));
    return { ok: true, mode: 'firebase', kind, rows, version: VERSION };
  }
  throw error('EXPORT_KIND_UNSUPPORTED');
}

async function route(action, payload) {
  if (action === 'health') return { ok: true, mode: 'firebase', service: 'LEXICON X Teacher Analytics Authority', version: VERSION, serverTime: nowIso() };
  if (action === 'overview' || action === 'participants') return handleOverview();
  if (action === 'participant_report') return handleParticipantReport(payload);
  if (action === 'export_rows') return handleExport(payload);
  throw error('UNKNOWN_ACTION', 404);
}

export const englishWeekTeacher = onRequest({
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 5,
  cors: false,
  secrets: [TEACHER_KEY]
}, async (req, res) => {
  try {
    applyCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!['GET', 'POST'].includes(req.method)) throw error('METHOD_NOT_ALLOWED', 405);
    requireTeacher(req);
    const payload = { ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) };
    if (clean(payload.appId) && clean(payload.appId) !== APP_ID) throw error('APP_ID_MISMATCH', 403);
    const result = await route(clean(payload.action || 'health'), payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('English Week Teacher error', err);
    return res.status(Number(err.status || 500)).json({ ok: false, mode: 'firebase', error: clean(err.code || err.message || 'INTERNAL_ERROR'), version: VERSION, serverTime: nowIso() });
  }
});
