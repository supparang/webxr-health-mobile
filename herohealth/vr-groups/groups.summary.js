// /herohealth/vr-groups/groups.summary.js
// Groups Summary Helpers
// PATCH v20260405-groups-summary-r1

import { GROUPS_CATEGORIES, getCategoryById } from './groups.data.js';

export const GROUPS_PATCH_SUMMARY = 'v20260405-groups-summary-r1';

const STORAGE_KEY = 'HHA_GROUPS_LAST_SUMMARY';
const HISTORY_KEY = 'HHA_GROUPS_SUMMARY_HISTORY';

export function buildGroupsSummary({ ctx, patch, state, reactionSamples = [] } = {}){
  const score = Number(state?.score || 0);
  const correct = Number(state?.correct || 0);
  const wrong = Number(state?.wrong || 0);
  const miss = Number(state?.miss || 0);
  const bestStreak = Number(state?.bestStreak || 0);

  const total = correct + wrong + miss;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  const avgReactionMs = reactionSamples.length
    ? Math.round(reactionSamples.reduce((a, b) => a + Number(b || 0), 0) / reactionSamples.length)
    : 0;

  const categoryStats = normalizeStats(state?.statsByCat || {});
  const bestCat = findBestCategory(categoryStats);
  const needCat = findNeedPracticeCategory(categoryStats);

  const grade = calcGrade({
    accuracy,
    bestStreak,
    score,
    miss
  });

  const stars = gradeToStars(grade);
  const lead = buildLead({
    grade,
    accuracy,
    bestStreak,
    bestCat,
    needCat
  });

  return {
    patch: patch || GROUPS_PATCH_SUMMARY,
    ts: Date.now(),

    pid: ctx?.pid || 'anon',
    name: ctx?.name || '',
    studyId: ctx?.studyId || '',
    diff: ctx?.diff || 'normal',
    timeSec: Number(ctx?.timeSec || 80),
    seed: ctx?.seed || '',
    run: ctx?.run || 'play',
    view: ctx?.view || 'mobile',
    mode: ctx?.mode || 'solo',
    game: ctx?.game || 'groups',
    gameId: ctx?.gameId || 'groups',
    zone: ctx?.zone || 'nutrition',

    score,
    correct,
    wrong,
    miss,
    bestStreak,
    accuracy,
    avgReactionMs,
    feverCount: Number(state?.feverCount || 0),

    grade,
    stars,
    lead,

    bestCategoryId: bestCat.id,
    bestCategoryText: `${bestCat.short} ${bestCat.name}`,
    needCategoryId: needCat.id,
    needCategoryText: `${needCat.short} ${needCat.name}`,

    categoryStats
  };
}

export function saveGroupsSummary(summary){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summary));
  }catch{}

  try{
    const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const next = Array.isArray(prev) ? prev.slice(-19) : [];
    next.push(summary);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }catch{}

  return summary;
}

export function renderGroupsSummary(ui, summary){
  if (!ui || !summary) return;

  setText(ui.summaryLead, summary.lead);
  setText(ui.summaryStars, summary.stars);
  setText(ui.summaryGrade, summary.grade);

  if (ui.summaryGrade) {
    ui.summaryGrade.className = `grade ${String(summary.grade || 'C').toLowerCase()}`;
  }

  setText(ui.sumScore, String(summary.score));
  setText(ui.sumAcc, `${summary.accuracy}%`);
  setText(ui.sumCwm, `${summary.correct} / ${summary.wrong} / ${summary.miss}`);
  setText(ui.sumStreak, String(summary.bestStreak));
  setText(ui.sumBestCat, summary.bestCategoryText);
  setText(ui.sumNeedCat, summary.needCategoryText);
}

function setText(el, text){
  if (el) el.textContent = String(text ?? '');
}

function normalizeStats(raw = {}){
  return Object.fromEntries(
    GROUPS_CATEGORIES.map((cat) => {
      const s = raw[cat.id] || {};
      return [cat.id, {
        correct: Number(s.correct || 0),
        wrong: Number(s.wrong || 0),
        miss: Number(s.miss || 0)
      }];
    })
  );
}

function findBestCategory(stats){
  let best = GROUPS_CATEGORIES[0];
  let bestScore = -Infinity;

  GROUPS_CATEGORIES.forEach((cat) => {
    const s = stats[cat.id] || { correct:0, wrong:0, miss:0 };
    const value = (s.correct * 3) - (s.wrong * 1.5) - (s.miss * 2);
    if (value > bestScore){
      bestScore = value;
      best = getCategoryById(cat.id);
    }
  });

  return best;
}

function findNeedPracticeCategory(stats){
  let need = GROUPS_CATEGORIES[0];
  let worstScore = Infinity;

  GROUPS_CATEGORIES.forEach((cat) => {
    const s = stats[cat.id] || { correct:0, wrong:0, miss:0 };
    const value = (s.wrong * 2) + (s.miss * 2.5) - (s.correct * 0.5);
    if (value < worstScore && allZero(stats)){
      need = getCategoryById('g3');
      worstScore = value;
      return;
    }
    if (value > -Infinity && value < Infinity){
      if (value < worstScore) return;
    }
  });

  let maxNeed = -Infinity;
  GROUPS_CATEGORIES.forEach((cat) => {
    const s = stats[cat.id] || { correct:0, wrong:0, miss:0 };
    const value = (s.wrong * 2) + (s.miss * 2.5) - (s.correct * 0.5);
    if (value > maxNeed){
      maxNeed = value;
      need = getCategoryById(cat.id);
    }
  });

  return need;
}

function allZero(stats){
  return Object.values(stats).every((s) =>
    Number(s.correct || 0) === 0 &&
    Number(s.wrong || 0) === 0 &&
    Number(s.miss || 0) === 0
  );
}

function calcGrade({ accuracy = 0, bestStreak = 0, score = 0, miss = 0 } = {}){
  let points = 0;

  if (accuracy >= 92) points += 4;
  else if (accuracy >= 82) points += 3;
  else if (accuracy >= 68) points += 2;
  else if (accuracy >= 55) points += 1;

  if (bestStreak >= 12) points += 2;
  else if (bestStreak >= 7) points += 1;

  if (score >= 180) points += 2;
  else if (score >= 110) points += 1;

  if (miss <= 2) points += 1;

  if (points >= 8) return 'S';
  if (points >= 6) return 'A';
  if (points >= 3) return 'B';
  return 'C';
}

function gradeToStars(grade){
  if (grade === 'S') return '⭐⭐⭐';
  if (grade === 'A') return '⭐⭐⭐';
  if (grade === 'B') return '⭐⭐☆';
  return '⭐☆☆';
}

function buildLead({ grade, accuracy, bestStreak, bestCat, needCat } = {}){
  if (grade === 'S') {
    return `ยอดเยี่ยมมาก! รอบนี้ทั้งไวและแม่นสุด ๆ โดยเฉพาะ ${bestCat.short} ${bestCat.name}`;
  }
  if (grade === 'A') {
    return `ดีมากเลย! รอบนี้ทำได้แม่นมาก และ streak สูงถึง ${bestStreak}`;
  }
  if (grade === 'B') {
    return `ทำได้ดีนะ Accuracy ${accuracy}% แล้ว ลองฝึก ${needCat.short} ${needCat.name} เพิ่มอีกนิด`;
  }
  return `เริ่มต้นได้ดีแล้ว รอบหน้าลองดูเป้าหมายให้ชัดขึ้น โดยเฉพาะ ${needCat.short} ${needCat.name}`;
}
