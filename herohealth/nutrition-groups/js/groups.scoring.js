// === /herohealth/nutrition-groups/js/groups.scoring.js ===
// Scoring and stat aggregation for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-C

import { FOOD_GROUPS } from './groups.content.js';

export function createEmptyStats() {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,

    sort: {
      total: 0,
      correct: 0,
      byGroup: {
        m1: { total: 0, correct: 0 },
        m2: { total: 0, correct: 0 },
        m3: { total: 0, correct: 0 },
        m4: { total: 0, correct: 0 },
        m5: { total: 0, correct: 0 }
      }
    },

    compare: {
      total: 0,
      correct: 0
    },

    reason: {
      total: 0,
      correct: 0
    },

    retry: {
      total: 0,
      correct: 0,
      correctedByType: {
        sort: 0,
        compare: 0,
        reason: 0
      }
    },

    quiz: {
      pre: { total: 0, correct: 0 },
      post: { total: 0, correct: 0 }
    }
  };
}

function updateStreak(stats, isCorrect) {
  if (isCorrect) {
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
}

export function scoreQuiz(stats, question, answerId) {
  const bucket = stats.quiz[question.quizPhase] || stats.quiz.pre;
  const correct = question.correctId === answerId;

  bucket.total += 1;
  if (correct) bucket.correct += 1;

  let feedback = '';
  if (question.type === 'sort') {
    feedback = correct
      ? `ถูกต้อง! ${question.food.label} อยู่${FOOD_GROUPS[question.correctId].label}`
      : `ยังไม่ใช่ — ${question.food.label} อยู่${FOOD_GROUPS[question.correctId].label}`;
  } else if (question.type === 'compare') {
    feedback = correct
      ? `ดีมาก! "${question.meta.betterText}" เป็นตัวเลือกที่ดีกว่า`
      : `คำตอบที่ดีกว่าคือ "${question.meta.betterText}"`;
  }

  return {
    correct,
    delta: 0,
    feedback
  };
}

export function scoreSort(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.sort.total += 1;
  stats.sort.byGroup[question.correctId].total += 1;

  if (correct) {
    stats.sort.correct += 1;
    stats.sort.byGroup[question.correctId].correct += 1;
    stats.score += 10;
  }

  updateStreak(stats, correct);

  return {
    correct,
    delta: correct ? 10 : 0,
    feedback: correct
      ? `ถูกต้อง! ${question.food.label} อยู่${FOOD_GROUPS[question.correctId].label}`
      : `ยังไม่ใช่ — ${question.food.label} อยู่${FOOD_GROUPS[question.correctId].label}`
  };
}

export function scoreCompare(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.compare.total += 1;

  if (correct) {
    stats.compare.correct += 1;
    stats.score += 15;
  }

  updateStreak(stats, correct);

  return {
    correct,
    delta: correct ? 15 : 0,
    feedback: correct
      ? `ดีมาก! "${question.meta.betterText}" เป็นตัวเลือกที่ดีกว่า`
      : `ลองใหม่อีกนิด — คำตอบที่ดีกว่าคือ "${question.meta.betterText}"`
  };
}

export function scoreReason(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.reason.total += 1;

  if (correct) {
    stats.reason.correct += 1;
    stats.score += 10;
  }

  updateStreak(stats, correct);

  return {
    correct,
    delta: correct ? 10 : 0,
    feedback: correct
      ? 'ใช่เลย! เหตุผลนี้เหมาะสม'
      : `เกือบถูก — เหตุผลที่เหมาะกว่าคือ "${question.meta.correctReason}"`
  };
}

export function scoreRetry(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.retry.total += 1;

  if (correct) {
    stats.retry.correct += 1;
    stats.retry.correctedByType[question.retryFrom] += 1;
    stats.score += 8;
  }

  updateStreak(stats, correct);

  const typeLabel =
    question.retryFrom === 'sort'
      ? 'การแยกหมวด'
      : question.retryFrom === 'compare'
      ? 'การเลือกตัวเลือกที่ดีกว่า'
      : 'การให้เหตุผล';

  return {
    correct,
    delta: correct ? 8 : 0,
    feedback: correct
      ? `เยี่ยม! แก้ตัวสำเร็จในรอบทบทวน (${typeLabel})`
      : `ไม่เป็นไรนะ ลองจำไว้ว่าโจทย์นี้เป็นเรื่อง${typeLabel}`
  };
}