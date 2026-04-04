// /herohealth/vr-groups/groups.summary.js
// Groups Solo Summary Helpers
// PATCH v20260404-groups-summary-r1

import {
  GROUPS_CATEGORIES,
  GROUPS_SUMMARY_COPY
} from './groups.data.js';

export const GROUPS_PATCH_SUMMARY = 'v20260404-groups-summary-r1';

const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const LAST_GROUPS_SUMMARY_KEY = 'HHA_GROUPS_LAST_SUMMARY';
const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
const MAX_HISTORY = 40;

export function calcAccuracy(correct = 0, wrong = 0, miss = 0){
  const total = Number(correct) + Number(wrong) + Number(miss);
  if (!total) return 0;
  return Math.round((Number(correct) / total) * 100);
}

export function calcAvgReaction(samples = []){
  if (!Array.isArray(samples) || !samples.length) return 0;
  const sum = samples.reduce((a, b) => a + Number(b || 0), 0);
  return Math.round(sum / samples.length);
}

export function gradeGroupsRun({ accuracy = 0, score = 0 } = {}){
  if (accuracy >= 90 && score >= 180) return 'S';
  if (accuracy >= 80 && score >= 120) return 'A';
  if (accuracy >= 65 && score >= 70) return 'B';
  return 'C';
}

export function analyzeCategoryStats(statsByCat = {}){
  const rows = GROUPS_CATEGORIES.map((cat) => {
    const s = statsByCat[cat.id] || { correct:0, wrong:0, miss:0 };
    return {
      ...cat,
      correct: Number(s.correct || 0),
      wrong: Number(s.wrong || 0),
      miss: Number(s.miss || 0),
      score: (Number(s.correct || 0) * 2) - Number(s.wrong || 0) - Number(s.miss || 0)
    };
  });

  const best = [...rows].sort((a,b) => b.score - a.score || b.correct - a.correct)[0] || rows[0];
  const need = [...rows].sort((a,b) => (b.wrong + b.miss) - (a.wrong + a.miss) || a.correct - b.correct)[0] || rows[0];

  return {
    best,
    need,
    rows
  };
}

export function buildGroupsSummary({
  ctx,
  patch = GROUPS_PATCH_SUMMARY,
  state,
  reactionSamples = []
} = {}){
  const accuracy = calcAccuracy(state.correct, state.wrong, state.miss);
  const avgReactionMs = calcAvgReaction(reactionSamples);
  const grade = gradeGroupsRun({ accuracy, score: state.score || 0 });
  const copy = GROUPS_SUMMARY_COPY[grade] || GROUPS_SUMMARY_COPY.C;

  const { best, need, rows } = analyzeCategoryStats(state.statsByCat || {});

  return {
    patch,
    game: ctx.game || 'groups',
    gameId: ctx.gameId || 'groups',
    zone: ctx.zone || 'nutrition',
    mode: ctx.mode || 'solo',
    pid: ctx.pid || 'anon',
    heroName: ctx.name || '',
    run: ctx.run || 'play',
    difficulty: ctx.diff || 'normal',
    view: ctx.view || 'mobile',
    seed: ctx.seed || '',
    studyId: ctx.studyId || '',
    score: Number(state.score || 0),
    correct: Number(state.correct || 0),
    wrong: Number(state.wrong || 0),
    miss: Number(state.miss || 0),
    bestStreak: Number(state.bestStreak || 0),
    accuracy,
    avgReactionMs,
    feverCount: Number(state.feverCount || 0),
    practiceUsed: !!state.practiceUsed,
    bestCategory: `${best.short} ${best.name}`,
    needCategory: `${need.short} ${need.name}`,
    bestCategoryId: best.id,
    needCategoryId: need.id,
    categoryRows: rows,
    grade,
    stars: copy.stars,
    lead: copy.lead,
    ts: Date.now(),
    summaryText: `score=${state.score || 0} acc=${accuracy}% streak=${state.bestStreak || 0}`
  };
}

export function saveGroupsSummary(summary){
  try{
    localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
    localStorage.setItem(LAST_GROUPS_SUMMARY_KEY, JSON.stringify(summary));

    const raw = localStorage.getItem(SUMMARY_HISTORY_KEY);
    const arr = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
    arr.unshift(summary);
    localStorage.setItem(SUMMARY_HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
  }catch{}
}

export function renderGroupsSummary(ui, summary){
  if (!ui || !summary) return;

  if (ui.sumScore) ui.sumScore.textContent = String(summary.score);
  if (ui.sumAcc) ui.sumAcc.textContent = `${summary.accuracy}%`;
  if (ui.sumCwm) ui.sumCwm.textContent = `${summary.correct} / ${summary.wrong} / ${summary.miss}`;
  if (ui.sumStreak) ui.sumStreak.textContent = String(summary.bestStreak);
  if (ui.sumBestCat) ui.sumBestCat.textContent = summary.bestCategory;
  if (ui.sumNeedCat) ui.sumNeedCat.textContent = summary.needCategory;
  if (ui.summaryLead) ui.summaryLead.textContent = summary.lead;
  if (ui.summaryStars) ui.summaryStars.textContent = summary.stars;

  if (ui.summaryGrade){
    ui.summaryGrade.textContent = summary.grade;
    ui.summaryGrade.className = `grade ${String(summary.grade || 'C').toLowerCase()}`;
  }
}