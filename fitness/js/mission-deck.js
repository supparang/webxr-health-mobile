// === /fitness/js/mission-deck.js ===
// Shadow Breaker — Missions (A-18)

'use strict';

export function pickMission(seed){
  // deterministic-ish: simple hash
  const ms = Number(seed) || Date.now();
  const idx = (ms % 3 + 3) % 3;
  return ['speed','accuracy','endurance'][idx];
}

export function missionText(type){
  if (type === 'speed') return '⚡ Mission: SPEED — เก็บ PERFECT 10 ครั้ง';
  if (type === 'accuracy') return '🎯 Mission: ACCURACY — ความแม่น ≥ 92%';
  if (type === 'endurance') return '🛡️ Mission: ENDURANCE — อยู่โหมด LOW HP รวม < 6 วิ';
  return '🎮 Mission: FREE PLAY';
}

export function missionProgress(type, s){
  // s: state summary live
  if (type === 'speed') {
    const p = Math.min(10, s.perfectCount || 0);
    return { done: p >= 10, text: `${p}/10 PERFECT` };
  }
  if (type === 'accuracy') {
    const trials = (s.totalHits||0) + (s.miss||0);
    const acc = trials ? (s.totalHits / trials) * 100 : 0;
    return { done: acc >= 92 && trials >= 25, text: `Acc ${acc.toFixed(1)}%` };
  }
  if (type === 'endurance') {
    const low = (s.lowHpMs||0) / 1000;
    return { done: low <= 6 && (s.elapsedMs||0) >= 45000, text: `LOW HP ${low.toFixed(1)}s` };
  }
  return { done:false, text:'—' };
}