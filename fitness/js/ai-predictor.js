// === /fitness/js/ai-predictor.js ===
// Rhythm Boxer — AI Predictor (Classic Script, NO export) — PRODUCTION
// ✅ safe for <script src="...">
// ✅ Research mode: prediction visible BUT locked (no gameplay changes)
// ✅ Normal mode: allow assist only when ?ai=1
// ✅ heuristic model (replaceable by ML/DL later)

'use strict';

(function () {
  const WIN = window;

  // ---- helpers ----
  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

  function readQueryFlag(key) {
    try {
      const v = new URL(location.href).searchParams.get(key);
      return v === '1' || v === 'true' || v === 'yes';
    } catch (_) {
      return false;
    }
  }

  function readQueryMode() {
    try {
      const m = (new URL(location.href).searchParams.get('mode') || '').toLowerCase();
      if (m === 'research') return 'research';
      return 'normal';
    } catch (_) {
      return 'normal';
    }
  }

  // ---- heuristic predictor (baseline) ----
  // snapshot fields expected (best-effort) from engine:
  // {
  //   accPct, hitMiss, hitPerfect, hitGreat, hitGood,
  //   combo, offsetAbsMean, hp, songTime, durationSec
  // }
  function predictFromSnapshot(s) {
    const acc = clamp01((Number(s.accPct) || 0) / 100);
    const hp = clamp01((Number(s.hp) || 100) / 100);

    // offsetAbsMean in seconds (smaller is better)
    const off = Number(s.offsetAbsMean);
    const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.55;

    const miss = Number(s.hitMiss) || 0;
    const judged =
      (Number(s.hitPerfect) || 0) +
      (Number(s.hitGreat) || 0) +
      (Number(s.hitGood) || 0) +
      miss;

    const missRate = judged > 0 ? clamp01(miss / judged) : 0;

    // fatigueRisk: hp low + miss high + timing offset poor
    const fatigueRisk = clamp01(
      (1 - hp) * 0.45 +
      missRate * 0.35 +
      (1 - offScore) * 0.20
    );

    // skillScore: accuracy + timing quality + low miss
    const skillScore = clamp01(
      acc * 0.55 +
      offScore * 0.30 +
      (1 - missRate) * 0.15
    );

    // suggested difficulty label
    let suggestedDifficulty = 'normal';
    if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
    else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

    // micro tip (explainable)
    let tip = '';
    if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเส้นตี แล้วค่อยกด';
    else if (offScore < 0.45) tip = 'ลอง “รอให้โน้ตแตะเส้น” ก่อนกด จะตรงขึ้น';
    else if (skillScore > 0.80 && fatigueRisk < 0.30) tip = 'ดีมาก! ลองเพิ่มความเร็ว/เพลงยากขึ้นได้';
    else if (hp < 0.45) tip = 'ระวัง HP—อย่ากดรัว ให้กดเฉพาะโน้ตที่ใกล้เส้น';

    return {
      fatigueRisk,             // 0..1
      skillScore,              // 0..1
      suggestedDifficulty,     // 'easy'|'normal'|'hard'
      tip                      // string
    };
  }

  // ---- Assist policy (LOCK for research) ----
  // Research lock rule:
  // - if mode=research => locked ALWAYS (ai assist OFF)
  // - if mode=normal   => assist ON only when ?ai=1
  const API = {
    getMode() {
      return readQueryMode(); // 'research' | 'normal'
    },
    isLocked() {
      return readQueryMode() === 'research';
    },
    isAssistEnabled() {
      const mode = readQueryMode();
      if (mode === 'research') return false;  // locked 100%
      return readQueryFlag('ai');             // normal only with ?ai=1
    },

    // main prediction
    predict(snapshot) {
      return predictFromSnapshot(snapshot || {});
    },

    // ---- future hooks (optional, for ML/DL later) ----
    // You can swap the predictor at runtime:
    // RB_AI.setModel((snapshot)=>({...}))
    setModel(fn) {
      if (typeof fn === 'function') {
        API.predict = function (snapshot) {
          try { return fn(snapshot || {}); }
          catch (_) { return predictFromSnapshot(snapshot || {}); }
        };
        return true;
      }
      return false;
    }
  };

  // expose globally
  WIN.RB_AI = API;
})();