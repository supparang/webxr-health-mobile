// === /fitness/js/ai-pattern.js ===
// Shadow Breaker — Pattern + Target Size Policy (PATCH F)
// ✅ Size policy A: Easy 160 / Normal 135 / Hard 120
// ✅ Auto-scale by viewport (small phones -> bigger targets, large screens -> slightly smaller)
// ✅ Bossface size multiplier stays in engine (engine already uses baseSize*1.9) but we provide helper too.
// Export: AIPattern

'use strict';

export const AIPattern = {
  // return base target size in px (for normal targets)
  sizePx(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();

    // --- Option A (approved) ---
    let base = 135;            // normal
    if (d === 'easy') base = 160;
    else if (d === 'hard') base = 120;

    // --- Auto scale by viewport ---
    // Use shorter side for "felt size" on mobile
    const vw = Math.max(0, Number(window.innerWidth) || 0);
    const vh = Math.max(0, Number(window.innerHeight) || 0);
    const shortSide = Math.max(320, Math.min(vw || 360, vh || 800));

    // tuned for phones/tablets/desktop:
    // <=380 : +10%
    // <=430 : +5%
    // >=900 : -12%
    // else  : 0
    let scale = 1.0;
    if (shortSide <= 380) scale = 1.10;
    else if (shortSide <= 430) scale = 1.05;
    else if (shortSide >= 900) scale = 0.88;

    const out = Math.round(base * scale);

    // clamp to keep UI sane
    return Math.max(95, Math.min(200, out));
  },

  // optional helper: bossface size (if you want to centralize it here later)
  bossFaceSizePx(diffKey, phaseScale = 1.0) {
    const base = this.sizePx(diffKey);
    // engine uses baseSize * 1.9 * phaseScale; we keep same
    const out = Math.round(base * 1.9 * (Number(phaseScale) || 1));
    return Math.max(140, Math.min(320, out));
  }
};