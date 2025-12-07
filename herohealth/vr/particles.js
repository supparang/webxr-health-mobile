// === /herohealth/vr/particles.js ===
// Simple DOM-based particle & score FX for HeroHealth VR
// ใช้กับ GoodJunk / Groups / Hydration ได้เหมือนกัน
//
//   Particles.scorePop(x, y, "+50", { kind:"score" });
//   Particles.scorePop(x, y, "GOOD", { kind:"judge", judgment:"GOOD" });
//   Particles.burstAt(x, y, { color:"#22c55e", count:14, radius:60 });

'use strict';

(function (global) {
  let layer = null;
  let styleInjected = false;

  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const style = document.createElement('style');
    style.id = 'hha-particles-style';
    style.textContent = `
      .hha-fx-layer{
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:652; /* เหนือ HUD (650) แต่ยังต่ำกว่า countdown (655) */
        overflow:hidden;
      }

      .hha-score-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        font-size:14px;
        font-weight:600;
        padding:2px 8px;
        border-radius:999px;
        background:rgba(15,23,42,0.96);
        color:#e5e7eb;
        border:1px solid rgba(148,163,184,0.7);
        opacity:0;
        transition:
          transform .55s ease-out,
          opacity .55s ease-out;
        white-space:nowrap;
        pointer-events:none;
        box-shadow:0 10px 22px rgba(15,23,42,0.95);
      }

      /* คะแนนตัวเลข */
      .hha-score-pop--score{
        background:rgba(15,23,42,0.98);
        font-size:13px;
      }

      /* GOOD / BLOCK */
      .hha-score-pop--good{
        color:#bbf7d0;
        border-color:rgba(34,197,94,0.95);
      }

      /* PERFECT */
      .hha-score-pop--perfect{
        color:#fef9c3;
        border-color:rgba(245,158,11,0.98);
      }

      /* MISS / LATE */
      .hha-score-pop--bad{
        color:#fed7aa;
        border-color:rgba(248,113,113,0.96);
      }

      .hha-frag{
        position:absolute;
        width:6px;
        height:6px;
        border-radius:999px;
        background:#22c55e;
        opacity:0.9;
        pointer-events:none;
        transform:translate(-50%,-50%);
        transition:
          transform .7s ease-out,
          opacity .7s ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    ensureStyle();
    layer = document.createElement('div');
    layer.className = 'hha-fx-layer';
    document.body.appendChild(layer);
    return layer;
  }

  /**
   * แสดง popup คะแนน / ข้อความบนจอ
   * opts:
   *   kind: "score" | "judge"
   *   judgment: "GOOD" | "MISS" | "LATE" | "PERFECT" | "BLOCK"
   */
  function scorePop(x, y, text, opts = {}) {
    const host = ensureLayer();
    const el = document.createElement('div');

    const classes = ['hha-score-pop'];
    if (opts.kind === 'score') {
      classes.push('hha-score-pop--score');
    } else if (opts.kind === 'judge') {
      const j = String(opts.judgment || '').toUpperCase();
      if (j === 'GOOD' || j === 'BLOCK' || j === 'BONUS') {
        classes.push('hha-score-pop--good');
      } else if (j === 'PERFECT') {
        classes.push('hha-score-pop--perfect');
      } else if (j === 'MISS' || j === 'LATE') {
        classes.push('hha-score-pop--bad');
      }
    }
    el.className = classes.join(' ');
    el.textContent = text;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    host.appendChild(el);

    // animate ขึ้นด้านบน + fade
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-130%)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-190%)';
      setTimeout(() => el.remove(), 260);
    }, 430);
  }

  /**
   * แตกกระจายอนุภาครอบจุดตีเป้า
   */
  function burstAt(x, y, opts = {}) {
    const host   = ensureLayer();
    const color  = opts.color  || '#22c55e';
    const n      = opts.count  || 12;
    const radius = opts.radius || 54;

    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'hha-frag';
      el.style.background = color;
      el.style.left = x + 'px';
      el.style.top  = y + 'px';

      host.appendChild(el);

      const ang  = (i / n) * Math.PI * 2;
      const dist = radius + Math.random() * radius * 0.7;
      const dx   = Math.cos(ang) * dist;
      const dy   = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.opacity = '0';
      });

      setTimeout(() => el.remove(), 720);
    }
  }

  const Particles = { scorePop, burstAt };

  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.Particles = Particles;
  global.Particles = Particles;

})(window);