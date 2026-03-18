// === /goodjunk-intervention/research/session-summary.js ===
// SESSION SUMMARY BUILDER
// PATCH v20260318a-GJI-SESSION-SUMMARY

import { KEYS, loadCtx, loadJSON } from './localstore.js';

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value ?? null;
  }
}

function normalizeAssessment(saved) {
  if (!saved || typeof saved !== 'object') return null;
  return {
    page: saved.page || '',
    savedAt: saved.savedAt || '',
    storageKey: saved.storageKey || '',
    ctxSnapshot: clone(saved.ctxSnapshot || {}),
    answers: clone(saved.answers || {}),
    knowledgeScore: clone(saved.knowledgeScore || null),
  };
}

function normalizeGameSummary(saved) {
  if (!saved || typeof saved !== 'object') return null;
  return {
    savedAt: saved.savedAt || saved.endedAt || '',
    version: saved.version || '',
    score: Number(saved.score ?? 0),
    goodHit: Number(saved.goodHit ?? 0),
    junkHit: Number(saved.junkHit ?? 0),
    miss: Number(saved.miss ?? 0),
    junkAvoided: Number(saved.junkAvoided ?? 0),
    comboBest: Number(saved.comboBest ?? 0),
    fruitHit: Number(saved.fruitHit ?? 0),
    vegHit: Number(saved.vegHit ?? 0),
    drinkHit: Number(saved.drinkHit ?? 0),
    grade: saved.grade || '',
    accuracy: Number(saved.accuracy ?? 0),
    stageReached: saved.stageReached || '',
    bossCleared: !!saved.bossCleared,
    diff: saved.diff || '',
    view: saved.view || '',
    totalSec: Number(saved.totalSec ?? 0),
    elapsedSec: Number(saved.elapsedSec ?? 0),
  };
}

function normalizeGameEvents(saved) {
  if (!Array.isArray(saved)) return [];
  return saved.map(ev => ({
    type: ev?.type || '',
    at: ev?.at || '',
    elapsedMs: Number(ev?.elapsedMs ?? ev?.t ?? 0),
    stage: ev?.stage || '',
    item: ev?.item || '',
    label: ev?.label || '',
    score: Number(ev?.score ?? 0),
    combo: Number(ev?.combo ?? 0),
    reason: ev?.reason || '',
  }));
}

function normalizeCompleted(saved) {
  if (!saved || typeof saved !== 'object') return null;
  return {
    done: !!saved.done,
    at: saved.at || '',
    code: saved.code || '',
  };
}

function sectionExists(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

export function buildSessionSummary(inputCtx = null) {
  const ctx = clone(inputCtx || loadCtx() || {});

  const preKnowledge = normalizeAssessment(loadJSON(KEYS.PRE_KNOWLEDGE, null));
  const preBehavior = normalizeAssessment(loadJSON(KEYS.PRE_BEHAVIOR, null));

  const gameSummary = normalizeGameSummary(loadJSON(KEYS.GAME_SUMMARY, null));
  const gameEvents = normalizeGameEvents(loadJSON(KEYS.GAME_EVENTS, []));
  const gameEventCount = gameEvents.length;

  const postKnowledge = normalizeAssessment(loadJSON(KEYS.POST_KNOWLEDGE, null));
  const postBehavior = normalizeAssessment(loadJSON(KEYS.POST_BEHAVIOR, null));
  const postChoice = normalizeAssessment(loadJSON(KEYS.POST_CHOICE, null));

  const shortFollowup = normalizeAssessment(loadJSON(KEYS.SHORT_FOLLOWUP, null));
  const weeklyCheck = normalizeAssessment(loadJSON(KEYS.WEEKLY_CHECK, null));

  const parentResponse = normalizeAssessment(loadJSON(KEYS.PARENT_RESPONSE, null));
  const completed = normalizeCompleted(loadJSON(KEYS.COMPLETED, null));

  const completion = {
    preKnowledge: sectionExists(preKnowledge),
    preBehavior: sectionExists(preBehavior),
    gameSummary: sectionExists(gameSummary),
    postKnowledge: sectionExists(postKnowledge),
    postBehavior: sectionExists(postBehavior),
    postChoice: sectionExists(postChoice),
    completion: sectionExists(completed) && !!completed?.done,
    parentResponse: sectionExists(parentResponse),
    shortFollowup: sectionExists(shortFollowup),
    weeklyCheck: sectionExists(weeklyCheck),
  };

  const progress = {
    coreFlowDone:
      completion.preKnowledge &&
      completion.preBehavior &&
      completion.gameSummary &&
      completion.postKnowledge &&
      completion.postBehavior &&
      completion.postChoice,
    completionDone: completion.completion,
    parentDone: completion.parentResponse,
    followupAnyDone: completion.shortFollowup || completion.weeklyCheck,
    allKnownSectionsDone: Object.values(completion).every(Boolean),
  };

  const timestamps = [
    preKnowledge?.savedAt,
    preBehavior?.savedAt,
    gameSummary?.savedAt,
    postKnowledge?.savedAt,
    postBehavior?.savedAt,
    postChoice?.savedAt,
    shortFollowup?.savedAt,
    weeklyCheck?.savedAt,
    parentResponse?.savedAt,
    completed?.at,
  ].filter(Boolean);

  const summary = {
    app: 'goodjunk-intervention',
    exportedAt: new Date().toISOString(),
    ctx,

    progress,
    completion,

    counts: {
      gameEventCount,
    },

    sections: {
      preKnowledge,
      preBehavior,
      gameSummary,
      gameEvents,
      postKnowledge,
      postBehavior,
      postChoice,
      shortFollowup,
      weeklyCheck,
      parentResponse,
      completed,
    },

    timeline: timestamps.sort(),
  };

  return summary;
}

export function buildCompactSessionSummary(inputCtx = null) {
  const full = buildSessionSummary(inputCtx);
  return {
    app: full.app,
    exportedAt: full.exportedAt,
    ctx: full.ctx,
    progress: full.progress,
    completion: full.completion,
    counts: full.counts,
    keyMetrics: {
      score: full.sections.gameSummary?.score ?? 0,
      goodHit: full.sections.gameSummary?.goodHit ?? 0,
      junkHit: full.sections.gameSummary?.junkHit ?? 0,
      miss: full.sections.gameSummary?.miss ?? 0,
      grade: full.sections.gameSummary?.grade ?? '',
      preKnowledgePercent: full.sections.preKnowledge?.knowledgeScore?.percent ?? null,
      postKnowledgePercent: full.sections.postKnowledge?.knowledgeScore?.percent ?? null,
      completionCode: full.sections.completed?.code ?? '',
    },
    savedPages: [
      full.sections.preKnowledge?.page,
      full.sections.preBehavior?.page,
      full.sections.postKnowledge?.page,
      full.sections.postBehavior?.page,
      full.sections.postChoice?.page,
      full.sections.shortFollowup?.page,
      full.sections.weeklyCheck?.page,
      full.sections.parentResponse?.page,
    ].filter(Boolean),
  };
}