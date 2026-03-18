// === /goodjunk-intervention/research/export-schema.js ===
// RESEARCH EXPORT SCHEMA
// PATCH v20260318a-GJI-EXPORT-SCHEMA

import { buildSessionSummary, buildCompactSessionSummary } from './session-summary.js';

function safe(v, fallback = '') {
  return v == null ? fallback : v;
}

function yn(v) {
  return v ? 1 : 0;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildResearchRow(inputCtx = null) {
  const full = buildSessionSummary(inputCtx);
  const compact = buildCompactSessionSummary(inputCtx);

  const ctx = full.ctx || {};
  const sec = full.sections || {};
  const game = sec.gameSummary || {};
  const preK = sec.preKnowledge?.knowledgeScore || {};
  const postK = sec.postKnowledge?.knowledgeScore || {};
  const completed = sec.completed || {};
  const parent = sec.parentResponse?.answers || {};
  const shortF = sec.shortFollowup?.answers || {};
  const weekly = sec.weeklyCheck?.answers || {};
  const postChoice = sec.postChoice?.answers || {};
  const postBehavior = sec.postBehavior?.answers || {};
  const preBehavior = sec.preBehavior?.answers || {};

  const row = {
    export_app: 'goodjunk-intervention',
    export_time: full.exportedAt || '',

    pid: safe(ctx.pid),
    nickName: safe(ctx.nickName),
    studyId: safe(ctx.studyId),
    phase: safe(ctx.phase),
    group: safe(ctx.group),
    condition: safe(ctx.condition),
    session: safe(ctx.session),

    classroom: safe(ctx.classRoom || ctx.classroom),
    school: safe(ctx.schoolName || ctx.school),

    diff: safe(ctx.diff),
    view: safe(ctx.view),
    mode: safe(ctx.mode || ctx.run),
    time: safe(ctx.time),

    coreFlowDone: yn(compact.progress?.coreFlowDone),
    completionDone: yn(compact.progress?.completionDone),
    parentDone: yn(compact.progress?.parentDone),
    followupAnyDone: yn(compact.progress?.followupAnyDone),
    allKnownSectionsDone: yn(compact.progress?.allKnownSectionsDone),

    has_preKnowledge: yn(compact.completion?.preKnowledge),
    has_preBehavior: yn(compact.completion?.preBehavior),
    has_gameSummary: yn(compact.completion?.gameSummary),
    has_postKnowledge: yn(compact.completion?.postKnowledge),
    has_postBehavior: yn(compact.completion?.postBehavior),
    has_postChoice: yn(compact.completion?.postChoice),
    has_completion: yn(compact.completion?.completion),
    has_parentResponse: yn(compact.completion?.parentResponse),
    has_shortFollowup: yn(compact.completion?.shortFollowup),
    has_weeklyCheck: yn(compact.completion?.weeklyCheck),

    game_score: safe(game.score, 0),
    game_goodHit: safe(game.goodHit, 0),
    game_junkHit: safe(game.junkHit, 0),
    game_miss: safe(game.miss, 0),
    game_junkAvoided: safe(game.junkAvoided, 0),
    game_comboBest: safe(game.comboBest, 0),
    game_fruitHit: safe(game.fruitHit, 0),
    game_vegHit: safe(game.vegHit, 0),
    game_drinkHit: safe(game.drinkHit, 0),
    game_grade: safe(game.grade),
    game_accuracy: safe(game.accuracy, 0),
    game_stageReached: safe(game.stageReached),
    game_bossCleared: yn(game.bossCleared),
    game_elapsedSec: safe(game.elapsedSec, 0),
    game_totalSec: safe(game.totalSec, 0),
    game_eventCount: safe(compact.counts?.gameEventCount, 0),

    preKnowledge_correct: safe(preK.correct, ''),
    preKnowledge_total: safe(preK.total, ''),
    preKnowledge_percent: safe(preK.percent, ''),

    postKnowledge_correct: safe(postK.correct, ''),
    postKnowledge_total: safe(postK.total, ''),
    postKnowledge_percent: safe(postK.percent, ''),

    completion_code: safe(completed.code),

    preBehavior_usualSnack: safe(preBehavior.b1_usualSnack),
    preBehavior_usualDrink: safe(preBehavior.b2_usualDrink),
    preBehavior_fruitFrequency: safe(preBehavior.b3_fruitFrequency),
    preBehavior_junkFrequency: safe(preBehavior.b4_junkFrequency),
    preBehavior_intention: safe(preBehavior.b7_intention),
    preBehavior_changeIdea: safe(preBehavior.b8_changeIdea),

    postBehavior_afterSchoolSnack: safe(postBehavior.pb1_afterSchoolSnack),
    postBehavior_afterGameDrink: safe(postBehavior.pb2_afterGameDrink),
    postBehavior_moreFruitIntent: safe(postBehavior.pb3_moreFruitIntent),
    postBehavior_reduceJunkIntent: safe(postBehavior.pb4_reduceJunkIntent),
    postBehavior_shopChoice: safe(postBehavior.pb5_shopChoice),
    postBehavior_nowChoice: safe(postBehavior.pb6_nowChoice),
    postBehavior_talkToParent: safe(postBehavior.pb7_talkToParent),
    postBehavior_changePlan: safe(postBehavior.pb8_changePlan),

    postChoice_snackChoice: safe(postChoice.snackChoice),
    postChoice_drinkChoice: safe(postChoice.drinkChoice),
    postChoice_reason: safe(postChoice.reason),
    postChoice_confidence: safe(postChoice.confidence),
    postChoice_transferText: safe(postChoice.transferText),

    parent_talkNutrition: safe(parent.p1_talkNutrition),
    parent_moreHealthyChoice: safe(parent.p2_moreHealthyChoice),
    parent_reduceJunk: safe(parent.p3_reduceJunk),
    parent_explainReason: safe(parent.p4_explainReason),
    parent_overallImpact: safe(parent.p5_overallImpact),
    parent_mostChanged: safe(parent.p6_mostChanged),
    parent_supportPlan: safe(parent.p7_supportPlan),
    parent_comment: safe(parent.p8_comment),

    shortFollowup_rememberHealthy: safe(shortF.sf1_rememberHealthy),
    shortFollowup_afterSchoolSnack: safe(shortF.sf2_afterSchoolSnack),
    shortFollowup_drinkChoice: safe(shortF.sf3_drinkChoice),
    shortFollowup_reduceJunk: safe(shortF.sf4_reduceJunk),
    shortFollowup_shareIdea: safe(shortF.sf5_shareIdea),
    shortFollowup_confidence: safe(shortF.sf6_confidence),
    shortFollowup_actionPlan: safe(shortF.sf7_actionPlan),
    shortFollowup_mainMemory: safe(shortF.sf8_mainMemory),

    weekly_fruitFrequency: safe(weekly.wk1_fruitFrequency),
    weekly_junkFrequency: safe(weekly.wk2_junkFrequency),
    weekly_drinkChoice: safe(weekly.wk3_drinkChoice),
    weekly_healthyChoice: safe(weekly.wk4_healthyChoice),
    weekly_sharedWithOthers: safe(weekly.wk5_sharedWithOthers),
    weekly_helpFactor: safe(weekly.wk6_helpFactor),
    weekly_barrier: safe(weekly.wk7_barrier),
    weekly_overallChange: safe(weekly.wk8_overallChange),
  };

  return row;
}

export function buildResearchCSV(rows) {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (!arr.length) return '';

  const headers = Array.from(
    arr.reduce((set, row) => {
      Object.keys(row || {}).forEach(k => set.add(k));
      return set;
    }, new Set())
  );

  const lines = [
    headers.map(csvEscape).join(','),
    ...arr.map(row => headers.map(h => csvEscape(row?.[h] ?? '')).join(','))
  ];

  return lines.join('\n');
}

export function buildCurrentSessionCSV() {
  const row = buildResearchRow();
  return buildResearchCSV([row]);
}

export function buildCurrentSessionJSONL() {
  const row = buildResearchRow();
  return JSON.stringify(row);
}