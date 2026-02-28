// === /herohealth/vr/score-rank.js ===
// Universal rank comparator for HeroHealth (tie-break ready)
// Rule: score → acc → miss → medianRT (GOOD hit median)  [score/acc high better, miss/median low better]
// FULL v20260228-RANK-SCORE-ACC-MISS-MEDRT
'use strict';

export function normalizeResult(r){
  r = r || {};
  const score = Number(r.scoreFinal ?? r.score ?? 0) || 0;
  const acc   = Number(r.accPct ?? r.acc ?? 0) || 0;
  const miss  = Number(r.missTotal ?? r.miss ?? 0) || 0;
  const medRT = Number(r.medianRtGoodMs ?? r.medianRT ?? r.medRtGoodMs ?? 0) || 0;
  return { score, acc, miss, medRT, raw:r };
}

export function compareResults(a, b){
  const A = normalizeResult(a);
  const B = normalizeResult(b);

  // 1) score DESC
  if(B.score !== A.score) return B.score - A.score;

  // 2) acc DESC
  if(B.acc !== A.acc) return B.acc - A.acc;

  // 3) miss ASC
  if(A.miss !== B.miss) return A.miss - B.miss;

  // 4) medianRT ASC (lower is better)
  if(A.medRT !== B.medRT) return A.medRT - B.medRT;

  return 0;
}

export function rankList(list){
  const arr = Array.isArray(list) ? list.slice() : [];
  arr.sort(compareResults);
  return arr;
}