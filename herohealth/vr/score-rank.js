// === /herohealth/vr/score-rank.js ===
// Winner rule: score → acc → miss (lower) → medianRT (lower)
// v20260304

'use strict';

export function normalizeResult(x){
  x = x || {};
  const n = (v, d=0)=> (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    pid: String(x.pid || ''),
    room: String(x.room || ''),
    gameKey: String(x.gameKey || x.game || ''),
    score: n(x.scoreFinal ?? x.score, 0),
    acc: n(x.accPct ?? x.accuracy_pct ?? x.accuracyGoodPct ?? 0, 0),
    miss: n(x.missTotal ?? x.miss ?? x.misses ?? 0, 0),
    medianRt: n(x.medianRtGoodMs ?? x.medianRt ?? 0, 0),
    raw: x
  };
}

export function pickWinner(a, b){
  a = normalizeResult(a);
  b = normalizeResult(b);

  if(a.score !== b.score) return { winner: a.score > b.score ? 'A' : 'B', reason:'score' };
  if(a.acc !== b.acc)     return { winner: a.acc > b.acc ? 'A' : 'B', reason:'acc' };
  if(a.miss !== b.miss)   return { winner: a.miss < b.miss ? 'A' : 'B', reason:'miss' };
  if(a.medianRt !== b.medianRt) return { winner: a.medianRt < b.medianRt ? 'A' : 'B', reason:'medianRT' };
  return { winner:'TIE', reason:'tie' };
}