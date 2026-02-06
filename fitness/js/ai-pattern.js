// === /fitness/js/ai-pattern.js ===
// Shadow Breaker — Pattern + Target Size Policy (PATCH F)
// ✅ Size policy A: Easy 160 / Normal 135 / Hard 120
// ✅ Auto-scale by viewport (small phones -> bigger targets)
// Export: AIPattern
'use strict';

export const AIPattern = {
  sizePx(diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();

    // --- Option A ---
    let base = 135;            // normal
    if (d === 'easy') base = 160;
    else if (d === 'hard') base = 120;

    // auto-scale by viewport short side
    const vw = Math.max(0, Number(window.innerWidth) || 0);
    const vh = Math.max(0, Number(window.innerHeight) || 0);
    const shortSide = Math.max(320, Math.min(vw || 360, vh || 800));

    let scale = 1.0;
    if (shortSide <= 380) scale = 1.10;
    else if (shortSide <= 430) scale = 1.05;
    else if (shortSide >= 900) scale = 0.88;

    const out = Math.round(base * scale);
    return Math.max(95, Math.min(200, out));
  }
};