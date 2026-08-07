// English Week Passport • Assessment Checkpoint Authority
// Server-side resume for interrupted Pre/Post Challenge attempts.
'use strict';

import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
const REGION = 'asia-southeast1';
const APP_ID = 'ENGLISH-WEEK-PASSPORT-2026';
const VERSION = '2026-08-07-ASSESSMENT-CHECKPOINT-V1';
const COLLECTION = 'ewp_assessment_checkpoints';

const clean = value => String(value == null ? '' : value).trim();
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const arr = value => Array.isArray(value) ? value : [];
const nowIso = () => new Date().toISOString();

function send(res, status, body) {
  res.status(status).json(body);
}

function cors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-EW-App-Id');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

function key(playerId, assessmentType) {
  return `${clean(playerId)}__${clean(assessmentType).toLowerCase()}`;
}

function normalizeType(value) {
  const type = clean(value).toLowerCase();
  return type === 'pre' || type === 'post' ? type : '';
}

function normalizeCheckpoint(payload) {
  const playerId = clean(payload?.playerId);
  const assessmentType = normalizeType(payload?.assessmentType);
  const total = Math.max(0, Math.min(50, int(payload?.total, 0)));
  const currentIndex = Math.max(0, Math.min(total || 50, int(payload?.currentIndex, 0)));
  const answers = arr(payload?.answers).slice(0, 50).map(item => ({
    itemId: clean(item?.itemId),
    selected: clean(item?.selected),
    correctAnswer: clean(item?.correctAnswer),
    correct: Boolean(item?.correct),
    answeredAtMs: Math.max(0, int(item?.answeredAtMs, 0))
  }));
  const questionIds = arr(payload?.questionIds).slice(0, 50).map(clean).filter(Boolean);
  return {
    playerId,
    assessmentType,
    formId: clean(payload?.formId),
    currentIndex,
    total,
    answers,
    questionIds,
    correct: Math.max(0, int(payload?.correct, 0)),
    points: Math.max(0, int(payload?.points, 0)),
    combo: Math.max(0, int(payload?.combo, 0)),
    elapsedMs: Math.max(0, int(payload?.elapsedMs, 0)),
    passportRotation: clean(payload?.passportRotation),
    assessmentRotation: clean(payload?.assessmentRotation),
    randomSeed: Number.isFinite(Number(payload?.randomSeed)) ? Number(payload.randomSeed) >>> 0 : 0,
    sourceVersion: clean(payload?.sourceVersion) || VERSION
  };
}

async function profileExists(playerId) {
  const snap = await db.collection('ewp_profiles').doc(playerId).get();
  return snap.exists;
}

export const englishWeekAssessmentCheckpoint = onRequest({ region: REGION, cors: false }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED', version: VERSION });

  try {
    const headerAppId = clean(req.get('X-EW-App-Id'));
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const bodyAppId = clean(payload.appId);
    if ((headerAppId && headerAppId !== APP_ID) || (bodyAppId && bodyAppId !== APP_ID)) {
      return send(res, 403, { ok: false, error: 'APP_ID_MISMATCH', version: VERSION });
    }

    const action = clean(payload.action).toLowerCase();
    const playerId = clean(payload.playerId);
    const assessmentType = normalizeType(payload.assessmentType);
    if (!playerId) return send(res, 400, { ok: false, error: 'PLAYER_ID_REQUIRED', version: VERSION });
    if (!assessmentType) return send(res, 400, { ok: false, error: 'ASSESSMENT_TYPE_REQUIRED', version: VERSION });

    if (!(await profileExists(playerId))) {
      return send(res, 404, { ok: false, error: 'PLAYER_NOT_FOUND', version: VERSION });
    }

    const ref = db.collection(COLLECTION).doc(key(playerId, assessmentType));

    if (action === 'get') {
      const snap = await ref.get();
      const checkpoint = snap.exists ? snap.data() : null;
      return send(res, 200, {
        ok: true,
        mode: 'firebase',
        checkpoint: checkpoint?.status === 'pending' ? checkpoint : null,
        version: VERSION,
        serverTime: nowIso()
      });
    }

    if (action === 'clear') {
      await ref.delete();
      return send(res, 200, {
        ok: true,
        mode: 'firebase',
        cleared: true,
        playerId,
        assessmentType,
        version: VERSION,
        serverTime: nowIso()
      });
    }

    if (action === 'save') {
      const checkpoint = normalizeCheckpoint(payload);
      if (checkpoint.total <= 0) return send(res, 400, { ok: false, error: 'TOTAL_REQUIRED', version: VERSION });
      if (checkpoint.currentIndex > checkpoint.total) return send(res, 400, { ok: false, error: 'INDEX_OUT_OF_RANGE', version: VERSION });
      if (checkpoint.answers.length > checkpoint.currentIndex) return send(res, 400, { ok: false, error: 'ANSWERS_EXCEED_INDEX', version: VERSION });

      const value = {
        ...checkpoint,
        status: 'pending',
        checkpointVersion: VERSION,
        savedAt: nowIso(),
        updatedAt: FieldValue.serverTimestamp()
      };
      await ref.set(value, { merge: false });
      return send(res, 200, {
        ok: true,
        mode: 'firebase',
        saved: true,
        checkpoint: { ...checkpoint, status: 'pending', checkpointVersion: VERSION, savedAt: value.savedAt },
        version: VERSION,
        serverTime: nowIso()
      });
    }

    return send(res, 400, { ok: false, error: 'INVALID_ACTION', version: VERSION });
  } catch (error) {
    console.error('englishWeekAssessmentCheckpoint', error);
    return send(res, 500, { ok: false, error: clean(error?.message) || 'INTERNAL_ERROR', version: VERSION });
  }
});
