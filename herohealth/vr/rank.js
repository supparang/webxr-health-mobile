/* === /herohealth/vr/rank.js ===
HHA Rank Calculator — shared across games
Rank set: SSS, SS, S, A, B, C
- Rank is for in-game motivation ONLY (not research outcome)
- Uses: accuracyGoodPct, misses, avgRtGoodMs/medianRtGoodMs, scoreFinal (optional)
*/

(function(root){
  'use strict';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));

  // Normalize RT to bonus [0..100], where faster => higher bonus
  // Tuned for Grade 4–6: typical touch/aim RT ~ 450–1200ms
  function rtToBonus(rtMs){
    rtMs = Number(rtMs);
    if (!isFinite(rtMs) || rtMs <= 0) return 50; // neutral when missing
    // Map 450ms -> ~95, 1200ms -> ~35
    const t = (rtMs - 450) / (1200 - 450); // 0..1
    const raw = 95 - (t * 60);
    return clamp(raw, 20, 95);
  }

  // Miss penalty capped (prevents "miss explosion" killing the grade)
  function missToPenalty(misses){
    misses = Number(misses);
    if (!isFinite(misses) || misses < 0) misses = 0;
    // 0 miss => 0 penalty, 10 miss => ~10, 20 miss => ~15 (cap)
    const p = Math.min(15, Math.pow(misses, 0.85) * 1.05);
    return clamp(p, 0, 15);
  }

  // Optional small score bonus (avoid score dominating)
  function scoreToBonus(scoreFinal){
    const s = Number(scoreFinal);
    if (!isFinite(s) || s <= 0) return 0;
    // log bonus capped at 8
    const b = Math.min(8, Math.log10(Math.max(10, s)) * 2.2);
    return clamp(b, 0, 8);
  }

  // Main index [0..100] then map to grade
  function computeRank(metrics, opts){
    metrics = metrics || {};
    opts = Object.assign({
      wAcc: 0.60,
      wSpeed: 0.25,
      wMiss: 0.15,
      // if you want score to matter slightly:
      useScoreBonus: true
    }, opts || {});

    const acc = clamp(Number(metrics.accuracyGoodPct) || 0, 0, 100);
    const misses = Math.max(0, Number(metrics.misses) || 0);

    // Prefer median RT if available (robust), else avg RT
    const rt = (metrics.medianRtGoodMs != null) ? metrics.medianRtGoodMs : metrics.avgRtGoodMs;
    const speedBonus = rtToBonus(rt);
    const missPenalty = missToPenalty(misses);
    const scoreBonus = opts.useScoreBonus ? scoreToBonus(metrics.scoreFinal) : 0;

    // Index: higher is better
    let index =
      (acc * opts.wAcc) +
      (speedBonus * opts.wSpeed) -
      (missPenalty * (opts.wMiss * 10)); // scale miss to comparable range

    index += scoreBonus;
    index = clamp(index, 0, 100);

    let grade = 'C';
    if (index >= 92) grade = 'SSS';
    else if (index >= 85) grade = 'SS';
    else if (index >= 78) grade = 'S';
    else if (index >= 68) grade = 'A';
    else if (index >= 55) grade = 'B';

    return {
      grade,
      index: Math.round(index),
      components: {
        acc: Math.round(acc),
        speedBonus: Math.round(speedBonus),
        missPenalty: Math.round(missPenalty),
        scoreBonus: Math.round(scoreBonus)
      }
    };
  }

  root.HHA_Rank = { computeRank };

})(typeof window !== 'undefined' ? window : globalThis);