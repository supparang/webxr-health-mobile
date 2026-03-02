// === /herohealth/vr/score-compare.js ===
// Comparator: score → acc → miss → median RT (lower is better)
// PATCH v20260302
'use strict';

export function normalizeScorePacket(p){
  p = p || {};
  const score = Number(p.score ?? p.scoreFinal ?? 0) || 0;
  const miss  = Number(p.miss ?? p.missTotal ?? 0) || 0;

  // accPct can be 0-100 or 0-1; normalize to 0-100
  let accPct = p.accPct;
  if(accPct == null) accPct = p.accPctFinal;
  accPct = Number(accPct);
  if(!Number.isFinite(accPct)) accPct = 0;
  if(accPct > 0 && accPct <= 1.01) accPct = accPct * 100;

  const medianRtGoodMs = Number(p.medianRtGoodMs ?? p.medianRT ?? 0) || 0;
  const pid = String(p.pid ?? p.player ?? p.playerId ?? '') || '';

  return { pid, score, miss, accPct, medianRtGoodMs };
}

// returns: 1 if A wins, -1 if B wins, 0 tie
export function comparePackets(a, b){
  const A = normalizeScorePacket(a);
  const B = normalizeScorePacket(b);

  if(A.score !== B.score) return (A.score > B.score) ? 1 : -1;       // higher better
  if(A.accPct !== B.accPct) return (A.accPct > B.accPct) ? 1 : -1;   // higher better
  if(A.miss !== B.miss) return (A.miss < B.miss) ? 1 : -1;           // lower better

  // median RT: lower better (but if missing -> treat as very large so it won't win)
  const rtA = (A.medianRtGoodMs > 0) ? A.medianRtGoodMs : 1e9;
  const rtB = (B.medianRtGoodMs > 0) ? B.medianRtGoodMs : 1e9;
  if(rtA !== rtB) return (rtA < rtB) ? 1 : -1;

  return 0;
}