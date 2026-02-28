// === /herohealth/vr/score-rank.js ===
// Score comparator: score → acc → miss → medianRT (GOOD hit only median)
// FULL v20260228-SCORE-RANK
'use strict';

export function normalizeResult(x){
  x = x || {};
  // accept both live payload and end summary shapes
  const score =
    Number(x.scoreFinal ?? x.score ?? 0) || 0;

  const acc =
    Number(x.accPct ?? x.acc ?? 0) || 0;

  const miss =
    Number(x.missTotal ?? x.miss ?? 0) || 0;

  const medRT =
    Number(x.medianRtGoodMs ?? x.medRT ?? x.medianRT ?? 0) || 0;

  return {
    score: Math.round(score),
    acc: Math.round(acc),
    miss: Math.round(miss),
    medRT: Math.round(medRT),
    pid: (x.pid!=null? String(x.pid): undefined),
    gameKey: (x.gameKey!=null? String(x.gameKey): undefined),
    zone: (x.zone!=null? String(x.zone): undefined),
    ts: Number(x.ts ?? x.endTs ?? Date.now()) || Date.now(),
    raw: x
  };
}

/**
 * Returns:
 *  +1 if A better than B
 *  -1 if A worse than B
 *   0 tie
 */
export function compareResults(A, B){
  A = normalizeResult(A);
  B = normalizeResult(B);

  // 1) score DESC
  if(A.score !== B.score) return (A.score > B.score) ? 1 : -1;

  // 2) acc DESC
  if(A.acc !== B.acc) return (A.acc > B.acc) ? 1 : -1;

  // 3) miss ASC
  if(A.miss !== B.miss) return (A.miss < B.miss) ? 1 : -1;

  // 4) median RT ASC (lower is better)
  if(A.medRT !== B.medRT) return (A.medRT < B.medRT) ? 1 : -1;

  return 0;
}

export function sortBestFirst(list){
  list = Array.isArray(list) ? list.slice() : [];
  list.sort((a,b)=> -compareResults(a,b)); // best first
  return list;
}

export function pickWinner(a,b){
  const cmp = compareResults(a,b);
  if(cmp > 0) return { winner: 'a', cmp };
  if(cmp < 0) return { winner: 'b', cmp };
  return { winner: 'tie', cmp: 0 };
}