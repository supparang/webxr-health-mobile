// === /herohealth/vr/score-compare.js ===
// Comparator for battle winner: score → accPct → miss → medianRtGoodMs
// - Higher score is better
// - Higher accPct is better
// - Lower miss is better
// - Lower medianRtGoodMs is better (tie-break)
// return: negative => a better, positive => b better, 0 => equal
'use strict';

function n(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

export function normalizeScorePacket(p){
  p = p || {};
  return {
    pid: String(p.pid || 'anon'),
    score: n(p.score, 0),
    accPct: n(p.accPct, 0),
    miss: n(p.miss, 0),
    medianRtGoodMs: n(p.medianRtGoodMs, 0),
    ts: n(p.ts, Date.now())
  };
}

export function compareScorePackets(a, b){
  a = normalizeScorePacket(a);
  b = normalizeScorePacket(b);

  // 1) score desc
  if(a.score !== b.score) return (b.score - a.score);

  // 2) acc desc
  if(a.accPct !== b.accPct) return (b.accPct - a.accPct);

  // 3) miss asc
  if(a.miss !== b.miss) return (a.miss - b.miss);

  // 4) median RT asc (lower better)
  if(a.medianRtGoodMs !== b.medianRtGoodMs) return (a.medianRtGoodMs - b.medianRtGoodMs);

  // 5) older first (stable)
  if(a.ts !== b.ts) return (a.ts - b.ts);

  return 0;
}

export function formatPacket(p){
  p = normalizeScorePacket(p);
  return `score ${p.score} | acc ${p.accPct}% | miss ${p.miss} | medRT ${p.medianRtGoodMs}ms`;
}