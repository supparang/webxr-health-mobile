// === /herohealth/plate/plate.metrics.js ===
// PlateVR Metrics helper — PRODUCTION
// - Computes derived metrics for hha:end payload (sheet-friendly)

'use strict';

export function computePlateMetrics(state, cfg, extra = {}){
  const hitGood = Number(state.hitGood||0);
  const hitJunk = Number(state.hitJunk||0);
  const expireGood = Number(state.expireGood||0);
  const total = hitGood + hitJunk + expireGood;

  const accuracy = (total<=0) ? 1 : (hitGood / total);
  const accPct = Math.round(accuracy * 100);

  const planned = Number(cfg.durationPlannedSec)||0;
  const left = Math.max(0, Number(state.timeLeft||0));
  const played = planned ? Math.max(0, planned - left) : 0;

  return Object.assign({
    hitGood, hitJunk, expireGood,
    totalActions: total,
    accuracyGoodPct: accPct,
    junkErrorPct: total>0 ? Math.round((hitJunk/total)*100) : 0,
    durationPlannedSec: planned || undefined,
    durationPlayedSec: played || undefined
  }, extra || {});
}