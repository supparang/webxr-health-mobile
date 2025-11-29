// === /HeroHealth/modes/goodjunk.quest.js (Full, 2 goals from 10 + 3 minis from 15) ===
'use strict';

import { MissionDeck } from '../vr/mission.js';

function G(s) {
  return {
    score:   s.score   | 0,
    combo:   s.combo   | 0,
    comboMax:s.comboMax| 0,
    good:    s.goodCount|0,
    miss:    s.junkMiss |0,
    tick:    s.tick     |0,
    star:    s.star     |0,
    diamond: s.diamond  |0
  };
}

function goalsFor(diff) {
  const K = {
    easy:   { good: 18, score: 900,  combo: 10, miss: 8, time: 30, star: 1, dia: 0 },
    normal: { good: 26, score: 1500, combo: 16, miss: 6, time: 40, star: 2, dia: 1 },
    hard:   { good: 34, score: 2200, combo: 24, miss: 4, time: 50, star: 3, dia: 2 }
  }[diff] || {};

  return [
    { id: 'g_good', label: `เก็บของดี ${K.good} ชิ้น`, target: K.good,
      check: s => G(s).good >= K.good,
      prog:  s => Math.min(K.good, G(s).good) },

    { id: 'g_score', label: `ทำคะแนนรวม ${K.score}+`, target: K.score,
      check: s => G(s).score >= K.score,
      prog:  s => Math.min(K.score, G(s).score) },

    { id: 'g_combo', label: `คอมโบสูงสุด ≥ ${K.combo}`, target: K.combo,
      check: s => G(s).comboMax >= K.combo,
      prog:  s => Math.min(K.combo, G(s).comboMax) },

    { id: 'g_time', label: `อยู่รอด ${K.time}s`, target: K.time,
      check: s => G(s).tick >= K.time,
      prog:  s => Math.min(K.time, G(s).tick) },

    { id: 'g_miss', label: `พลาดไม่เกิน ${K.miss} ครั้ง`, target: K.miss,
      check: s => G(s).miss <= K.miss,
      prog:  s => Math.max(0, K.miss - G(s).miss) },

    { id: 'g_star', label: `เก็บ ⭐ ${K.star} ดวง`, target: K.star,
      check: s => G(s).star >= K.star,
      prog:  s => Math.min(K.star, G(s).star) },

    { id: 'g_dia', label: `เก็บ 💎 ${K.dia} เม็ด`, target: K.dia,
      check: s => G(s).diamond >= K.dia,
      prog:  s => Math.min(K.dia, G(s).diamond) },

    { id: 'g_good30', label: 'เก็บของดี 30 ชิ้น (ทางลัด)', target: 30,
      check: s => G(s).good >= 30,
      prog:  s => Math.min(30, G(s).good) },

    { id: 'g_score2k', label: 'คะแนนแตะ 2000', target: 2000,
      check: s => G(s).score >= 2000,
      prog:  s => Math.min(2000, G(s).score) },

    { id: 'g_combo18', label: 'คอมโบ ≥ 18', target: 18,
      check: s => G(s).comboMax >= 18,
      prog:  s => Math.min(18, G(s).comboMax) }
  ];
}

function minisFor(diff) {
  const K = {
    easy:   { score: 600,  combo: 8,  good: 12, miss: 8, star: 1 },
    normal: { score: 1200, combo: 12, good: 18, miss: 6, star: 2 },
    hard:   { score: 1800, combo: 16, good: 24, miss: 4, star: 2 }
  }[diff] || {};

  return [
    { id: 'm_score', label: `ดันคะแนนให้ถึง ${K.score}`, target: K.score,
      check: s => G(s).score >= K.score,
      prog:  s => Math.min(K.score, G(s).score) },

    { id: 'm_combo', label: `คอมโบต่อเนื่อง ${K.combo}`, target: K.combo,
      check: s => G(s).comboMax >= K.combo,
      prog:  s => Math.min(K.combo, G(s).comboMax) },

    { id: 'm_good', label: `เก็บของดี ${K.good}`, target: K.good,
      check: s => G(s).good >= K.good,
      prog:  s => Math.min(K.good, G(s).good) },

    { id: 'm_nomiss', label: `พลาดไม่เกิน ${K.miss}`, target: K.miss,
      check: s => G(s).miss <= K.miss,
      prog:  s => Math.max(0, K.miss - G(s).miss) },

    { id: 'm_star', label: `เก็บ ⭐ ${K.star}`, target: K.star,
      check: s => G(s).star >= K.star,
      prog:  s => Math.min(K.star, G(s).star) },

    { id: 'm_combo10', label: 'คอมโบ ≥ 10', target: 10,
      check: s => G(s).comboMax >= 10,
      prog:  s => Math.min(10, G(s).comboMax) },

    { id: 'm_score900', label: 'คะแนน 900+', target: 900,
      check: s => G(s).score >= 900,
      prog:  s => Math.min(900, G(s).score) },

    { id: 'm_good14', label: 'เก็บดี 14', target: 14,
      check: s => G(s).good >= 14,
      prog:  s => Math.min(14, G(s).good) },

    { id: 'm_miss4', label: 'พลาด ≤ 4', target: 4,
      check: s => G(s).miss <= 4,
      prog:  s => Math.max(0, 4 - G(s).miss) },

    { id: 'm_dia1', label: 'เก็บ 💎 1', target: 1,
      check: s => G(s).diamond >= 1,
      prog:  s => Math.min(1, G(s).diamond) },

    { id: 'm_time15', label: 'อยู่รอด 15s', target: 15,
      check: s => G(s).tick >= 15,
      prog:  s => Math.min(15, G(s).tick) },

    { id: 'm_combo14', label: 'คอมโบ ≥ 14', target: 14,
      check: s => G(s).comboMax >= 14,
      prog:  s => Math.min(14, G(s).comboMax) },

    { id: 'm_score1400', label: 'คะแนน 1400+', target: 1400,
      check: s => G(s).score >= 1400,
      prog:  s => Math.min(1400, G(s).score) },

    { id: 'm_good10', label: 'เก็บดี 10', target: 10,
      check: s => G(s).good >= 10,
      prog:  s => Math.min(10, G(s).good) },

    { id: 'm_nomiss6', label: 'พลาด ≤ 6', target: 6,
      check: s => G(s).miss <= 6,
      prog:  s => Math.max(0, 6 - G(s).miss) }
  ];
}

export function createGoodJunkQuest(diff = 'normal') {
  const deck = new MissionDeck({
    goalPool: goalsFor(diff),
    miniPool: minisFor(diff)
  });
  return deck;
}

export default { createGoodJunkQuest };