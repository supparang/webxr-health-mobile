// /functions/index.js
'use strict';

import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import {
  QUESTION_BANK,
  chooseQuestions,
  evaluateAnswer,
  adjustDifficulty,
  calcBossDamage
} from './english-engine.js';
import {
  createSessionDoc,
  getSessionDoc,
  updateSessionDoc,
  appendSessionEvent,
  saveLeaderboardEntry
} from './english-store.js';

initializeApp();

function send(res, status, payload) {
  res.status(status).json(payload);
}

function makeSessionId() {
  return `ES_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function publicQuestionShape(question) {
  return {
    questionId: question.id,
    type: question.type,
    promptText: question.promptText,
    questionText: question.questionText,
    choices: question.choices || [],
    timeLimitSec: question.timeLimitSec || 10
  };
}

function pickNextQuestion(unitId, difficulty, askedIds = []) {
  const pool = chooseQuestions(unitId, difficulty).filter(q => !askedIds.includes(q.id));
  const fallback = (QUESTION_BANK[unitId] || []).filter(q => !askedIds.includes(q.id));
  const source = pool.length ? pool : fallback.length ? fallback : (QUESTION_BANK[unitId] || []);
  return source[Math.floor(Math.random() * source.length)] || null;
}

export const englishSessionStart = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const {
      uid = 'anon_player',
      unitId = 'a2_cs_unit_01',
      requestedDifficulty = 'normal',
      mode = 'play'
    } = req.body || {};

    const sessionId = makeSessionId();

    await createSessionDoc(sessionId, {
      uid,
      unitId,
      mode,
      difficulty: requestedDifficulty,
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: 3,
      bossHp: 100,
      bossMaxHp: 100,
      askedIds: [],
      recentResults: [],
      answered: 0,
      correctCount: 0,
      finished: false
    });

    return send(res, 200, {
      sessionId,
      difficulty: requestedDifficulty,
      lives: 3,
      boss: {
        hp: 100,
        maxHp: 100
      }
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || 'session_start_failed' });
  }
});

export const englishQuestionNext = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const { sessionId } = req.body || {};
    if (!sessionId) return send(res, 400, { error: 'Missing sessionId' });

    const session = await getSessionDoc(sessionId);
    if (!session) return send(res, 404, { error: 'Session not found' });
    if (session.finished) return send(res, 400, { error: 'Session already finished' });

    const nextQ = pickNextQuestion(session.unitId, session.difficulty, session.askedIds || []);
    if (!nextQ) return send(res, 404, { error: 'No question available' });

    await updateSessionDoc(sessionId, {
      currentQuestionId: nextQ.id,
      questionStartedAtMs: Date.now()
    });

    await appendSessionEvent(sessionId, {
      type: 'question_served',
      questionId: nextQ.id,
      difficulty: session.difficulty
    });

    return send(res, 200, publicQuestionShape(nextQ));
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || 'next_question_failed' });
  }
});

export const englishAnswerSubmit = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const { sessionId, questionId, timeUsedMs = 0 } = req.body || {};
    if (!sessionId || !questionId) {
      return send(res, 400, { error: 'Missing sessionId or questionId' });
    }

    const session = await getSessionDoc(sessionId);
    if (!session) return send(res, 404, { error: 'Session not found' });
    if (session.finished) return send(res, 400, { error: 'Session already finished' });

    const question = (QUESTION_BANK[session.unitId] || []).find(q => q.id === questionId);
    if (!question) return send(res, 404, { error: 'Question not found' });

    const result = evaluateAnswer(question, req.body);

    const prevCombo = Number(session.combo || 0);
    const combo = result.correct ? prevCombo + 1 : 0;
    const bestCombo = Math.max(Number(session.bestCombo || 0), combo);
    const damage = calcBossDamage(question, result, combo);
    const bossHp = Math.max(0, Number(session.bossHp || 100) - damage);
    const score = Number(session.score || 0) + Number(result.scoreDelta || 0);
    const lives = result.correct ? Number(session.lives || 3) : Math.max(0, Number(session.lives || 3) - 1);
    const answered = Number(session.answered || 0) + 1;
    const correctCount = Number(session.correctCount || 0) + (result.correct ? 1 : 0);

    const askedIds = Array.isArray(session.askedIds) ? [...session.askedIds] : [];
    if (!askedIds.includes(questionId)) askedIds.push(questionId);

    const recentResults = Array.isArray(session.recentResults) ? [...session.recentResults, !!result.correct].slice(-3) : [!!result.correct];
    const difficulty = adjustDifficulty(session.difficulty || 'normal', recentResults);

    const finished = lives <= 0 || bossHp <= 0 || answered >= 10;

    await updateSessionDoc(sessionId, {
      score,
      combo,
      bestCombo,
      bossHp,
      lives,
      answered,
      correctCount,
      askedIds,
      recentResults,
      difficulty,
      finished
    });

    await appendSessionEvent(sessionId, {
      type: 'answer_submitted',
      questionId,
      correct: result.correct,
      scoreDelta: result.scoreDelta,
      timeUsedMs,
      combo,
      bossHp,
      lives,
      difficulty
    });

    return send(res, 200, {
      correct: result.correct,
      displayFeedback: result.feedback,
      scoreDelta: result.scoreDelta,
      combo,
      difficulty,
      boss: {
        hp: bossHp
      },
      player: {
        lives
      },
      nextAction: finished ? 'finish' : 'next_question'
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || 'submit_failed' });
  }
});

export const englishSessionFinish = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

    const { sessionId } = req.body || {};
    if (!sessionId) return send(res, 400, { error: 'Missing sessionId' });

    const session = await getSessionDoc(sessionId);
    if (!session) return send(res, 404, { error: 'Session not found' });

    const answered = Number(session.answered || 0);
    const correctCount = Number(session.correctCount || 0);
    const accuracy = answered > 0 ? correctCount / answered : 0;
    const bossCleared = Number(session.bossHp || 100) <= 0;

    await updateSessionDoc(sessionId, {
      finished: true,
      finalScore: Number(session.score || 0),
      accuracy,
      bossCleared,
      endedAtMs: Date.now()
    });

    if (answered >= 3) {
      await saveLeaderboardEntry(session.unitId, session.uid, {
        uid: session.uid,
        finalScore: Number(session.score || 0),
        accuracy,
        bestCombo: Number(session.bestCombo || 0),
        bossCleared
      });
    }

    await appendSessionEvent(sessionId, {
      type: 'session_finished',
      finalScore: Number(session.score || 0),
      accuracy,
      bossCleared
    });

    return send(res, 200, {
      sessionId,
      finalScore: Number(session.score || 0),
      accuracy,
      bossCleared,
      summary: {
        bestCombo: Number(session.bestCombo || 0),
        correct: correctCount,
        wrong: answered - correctCount
      }
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message || 'finish_failed' });
  }
});
