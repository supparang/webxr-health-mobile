// === /herohealth/vr/particles.js ===
// Simple DOM-based particle & score FX for HeroHealth VR
// ใช้กับโหมด GoodJunk / Groups / Hydration ได้เหมือนกัน
//
// Particles.scorePop(x, y, "+50", { judgment:"good"  });
// Particles.scorePop(x, y, "PERFECT", { judgment:"perfect" });
// Particles.scorePop(x, y, "MISS", { judgment:"miss" });
//
// ยังรองรับแบบเก่าด้วย:
// Particles.scorePop(x, y, "+50", { good:true });
// Particles.scorePop(x, y, "-10", { good:false });

'use strict';

(function (global) {
  let layer = null;

  function ensureStyle() {
    if (document.getElementById('hha-particles-style')) return;
    const style = document.createElement('style');
    style.id = 'hha-particles-style';
    style.textContent = `
    .hha-fx-layer{
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:20;
      overflow:hidden;
    }

    .hha-score-pop{
      position:absolute;
      transform:translate(-50%,-50%);
      font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
      font-size:14px;
      font-weight:700;
      padding:2px 8px;
      border-radius:999px;
      background:rgba(15,23,42,0.95);
      color:#e5e7eb;
      border:1px solid rgba(148,163,184,0.9);
      opacity:0;
      transition:
        transform .6s ease-out,
        opacity .6s ease-out;
      white-space:nowrap;
      pointer-events:none;
      box-shadow:0 10px 22px rgba(15,23,42,0.95);
      text-shadow:0 1px 2px rgba(0,0,0,0.5);
    }

    /* GOOD (เขียว) */
    .hha-score-pop--good{
      color:#bbf7d0;
      border-color:rgba(34,197,94,0.95);
      box-shadow:0 10px 24px rgba(22,163,74,0.85);
    }

    /* PERFECT (ทอง) */
    .hha-score-pop--perfect{
      color:#fef9c3;
      border-color:rgba(250,204,21,0.95);
      box-shadow:0 0 0 1px rgba(250,204,21,0.7),
                 0 12px 26px rgba(234,179,8,0.9);
      background:radial-gradient(circle at top,rgba(250,204,21,0.22),rgba(15,23,42,0.96));
    }

    /* MISS (แดง/ส้ม) */
    .hha-score-pop--miss,
    .hha-score-pop.bad{
      color:#fed7aa;
      border-color:rgba(248,113,113,0.95);
      box-shadow:0 10px 26px rgba(248,113,113,0.85);
      background:radial-gradient(circle at top,rgba(248,113,113,0.18),rgba(15,23,42,0.96));
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
   * แสดงคะแนนเด้งขึ้นจากจุดตีเป้า
   * @param {number} x - screen X (px)
   * @param {number} y - screen Y (px)
   * @param {string} text - ข้อความคะแนน เช่น "+50" หรือ "GOOD" / "MISS" / "PERFECT"
   * @param {object} opts - { good?: boolean, judgment?: "good"|"perfect"|"miss" }
   */
  function scorePop(x, y, text, opts = {}) {
    const host = ensureLayer();

    const jRaw = (opts.judgment || '').toString().toLowerCase();
    let cls = 'hha-score-pop';

    if (jRaw === 'perfect') {
      cls += ' hha-score-pop--perfect';
    } else if (jRaw === 'good') {
      cls += ' hha-score-pop--good';
    } else if (jRaw === 'miss') {
      cls += ' hha-score-pop--miss';
    } else if (opts.good === true) {
      cls += ' hha-score-pop--good';
    } else if (opts.good === false) {
      cls += ' hha-score-pop--miss bad';
    }

    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    host.appendChild(el);

    // animate ขึ้นด้านบน + fade in/out
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-120%)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-180%)';
      setTimeout(() => el.remove(), 260);
    }, 420);
  }

  /**
   * แตกกระจายอนุภาครอบจุดตีเป้า
   * @param {number} x - screen X (px)
   * @param {number} y - screen Y (px)
   * @param {object} opts - { color, count, radius }
   */
  function burstAt(x, y, opts = {}) {
    const host   = ensureLayer();
    const color  = opts.color  || '#22c55e';
    const n      = opts.count  || 12;
    const radius = opts.radius || 50;

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

  // ผูกเข้า global ให้โหมดอื่นเรียกใช้ได้
  const Particles = { scorePop, burstAt };

  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.Particles = Particles;
  global.Particles = Particles;

})(window);
