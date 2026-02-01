// === /fitness/js/ai-predictor.js ===
// Classic Script (NO export) — safe for <script src="...">
// ✅ Provides window.RB_AIPredictor (class)
// ✅ Research lock: mode=research => locked true (no adapt)
// ✅ Normal assist: only if ?ai=1 (or meta.aiAssistEnabled true via UI)

'use strict';

(function () {
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

  function predictFromSnapshot(s) {
    const acc = clamp01((Number(s.accPct) || 0) / 100);
    const hp = clamp01((Number(s.hp) || 100) / 100);

    // offsetAbsMean in seconds; smaller => better
    const off = Number(s.offsetAbsMean);
    const offScore = Number.isFinite(off) ? clamp01(1 - (off / 0.18)) : 0.5; // 0.18s loose cap

    const miss = Number(s.hitMiss) || 0;
    const judged = (Number(s.hitPerfect) || 0) + (Number(s.hitGreat) || 0) + (Number(s.hitGood) || 0) + miss;
    const missRate = judged > 0 ? clamp01(miss / judged) : 0;

    const fatigueRisk = clamp01(
      (1 - hp) * 0.45 +
      missRate * 0.35 +
      (1 - offScore) * 0.20
    );

    const skillScore = clamp01(
      acc * 0.55 +
      offScore * 0.30 +
      (1 - missRate) * 0.15
    );

    let suggestedDifficulty = 'normal';
    if (skillScore >= 0.78 && fatigueRisk <= 0.35) suggestedDifficulty = 'hard';
    else if (skillScore <= 0.45 || fatigueRisk >= 0.70) suggestedDifficulty = 'easy';

    let tip = '';
    if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเส้นตี แล้วค่อยกด';
    else if (offScore < 0.45) tip = 'ลอง “รอให้โน้ตแตะเส้น” ก่อนกด จะตรงขึ้น';
    else if (skillScore > 0.8 && fatigueRisk < 0.3) tip = 'ดีมาก! ลองเพิ่มความเร็ว/เพลงยากขึ้นได้';
    else if (hp < 0.45) tip = 'ระวัง HP—อย่ากดรัว ให้กดเฉพาะโน้ตที่ใกล้เส้น';

    return { fatigueRisk, skillScore, suggestedDifficulty, tip };
  }

  class RB_AIPredictor {
    constructor(opts = {}) {
      const mode = readQueryMode();
      this.locked = (opts.locked != null) ? !!opts.locked : (mode === 'research');

      // Normal assist enabled only by ?ai=1 unless overridden by opts.allowAdapt
      const qAssist = readQueryFlag('ai');
      this.allowAdapt = (opts.allowAdapt != null) ? !!opts.allowAdapt : ((mode !== 'research') && qAssist);

      this.last = null;
    }

    update(snapshot) {
      const out = predictFromSnapshot(snapshot || {});
      out.locked = !!this.locked;
      out.allowAdapt = !!this.allowAdapt;
      this.last = out;
      return out;
    }
  }

  window.RB_AIPredictor = RB_AIPredictor;
})();