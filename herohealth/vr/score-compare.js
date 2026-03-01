// === /herohealth/vr/score-compare.js ===
// Shared comparator for HeroHealth competitive modes.
// Order: score (desc) → accPct (desc) → miss (asc) → medianRtGoodMs (asc)
'use strict';

function n(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

export function compareScorePackets(a, b){
  const as = n(a?.score ?? a?.scoreFinal, 0);
  const bs = n(b?.score ?? b?.scoreFinal, 0);
  if(as !== bs) return (bs - as); // higher score first

  const aa = n(a?.accPct, 0);
  const ba = n(b?.accPct, 0);
  if(aa !== ba) return (ba - aa); // higher acc first

  const am = n(a?.miss ?? a?.missTotal, 0);
  const bm = n(b?.miss ?? b?.missTotal, 0);
  if(am !== bm) return (am - bm); // lower miss first

  const art = n(a?.medianRtGoodMs, 0);
  const brt = n(b?.medianRtGoodMs, 0);
  if(art !== brt) return (art - brt); // lower RT first

  // stable tie-break (older first wins? keep deterministic)
  const ats = n(a?.ts, 0);
  const bts = n(b?.ts, 0);
  return (ats - bts);
}

export function pickWinner(a, b){
  return compareScorePackets(a,b) <= 0 ? a : b;
}