// === /herohealth/vr/particles.js ===
// Simple DOM-based particle & score FX for HeroHealth VR
// ใช้กับโหมด GoodJunk / Groups / Hydration ได้เหมือนกัน
//
// Particles.scorePop(x, y, "+50", { good:true });
// Particles.burstAt(x, y, { good:true, bad:false });

(function (global) {
  'use strict';

  let layer = null;
  let styleInjected = false;

  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const style = global.document.createElement('style');
    style.id = 'hha-particles-style';
    style.textContent = `
      .hha-fx-layer{
        position:fixed;
        inset:0;
        pointer-events:none;
        /* ให้ลอยเหนือฉาก VR และไฟ fever แต่ต่ำกว่าบาง HUD ได้ */
        z-index:645;
        overflow:hidden;
      }

      .hha-fx-frag{
        position:absolute;
        width:10px;
        height:10px;
        border-radius:999px;
        opacity:0.9;
        transform:translate3d(0,0,0) scale(1);
        animation:hhaFragPop 500ms ease-out forwards;
      }

      .hha-fx-frag.good   { background:#22c55e; }
      .hha-fx-frag.bad    { background:#f97316; }
      .hha-fx-frag.star   { background:#eab308; }
      .hha-fx-frag.diamond{ background:#38bdf8; }
      .hha-fx-frag.shield { background:#60a5fa; }

      .hha-fx-score{
        position:absolute;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
        font-weight:700;
        font-size:14px;
        white-space:nowrap;
        transform:translate3d(-50%, -50%, 0);
        animation:hhaScoreFloat 700ms ease-out forwards;
        text-shadow:0 0 8px rgba(0,0,0,0.6);
      }

      .hha-fx-score.good{
        color:#bbf7d0;
      }
      .hha-fx-score.bad{
        color:#fecaca;
      }
      .hha-fx-score.small{
        font-size:11px;
        font-weight:600;
      }

      @keyframes hhaFragPop{
        0%{
          opacity:1;
          transform:translate3d(0,0,0) scale(0.8);
        }
        70%{
          opacity:1;
        }
        100%{
          opacity:0;
          transform:translate3d(var(--dx,0px), var(--dy,0px), 0) scale(0.3);
        }
      }

      @keyframes hhaScoreFloat{
        0%{
          opacity:0;
          transform:translate3d(-50%, -30%, 0) scale(0.9);
        }
        20%{
          opacity:1;
          transform:translate3d(-50%, -50%, 0) scale(1);
        }
        100%{
          opacity:0;
          transform:translate3d(-50%, -80%, 0) scale(0.9);
        }
      }
    `;
    global.document.head.appendChild(style);
  }

  function ensureLayer() {
    if (layer && layer.parentNode) return layer;
    ensureStyle();
    layer = global.document.createElement('div');
    layer.className = 'hha-fx-layer';
    global.document.body.appendChild(layer);
    return layer;
  }

  /**
   * เอฟเฟกต์เป้าแตกกระจาย
   * @param {number} x screenX
   * @param {number} y screenY
   * @param {object} opts {good,bad,star,diamond,shield}
   */
  function burstAt(x, y, opts) {
    const root = ensureLayer();
    const count = 14;
    const kindClass =
      (opts && opts.star)    ? 'star' :
      (opts && opts.diamond) ? 'diamond' :
      (opts && opts.shield)  ? 'shield' :
      (opts && opts.bad)     ? 'bad' :
      'good';

    for (let i = 0; i < count; i++) {
      const el = global.document.createElement('div');
      el.className = `hha-fx-frag ${kindClass}`;
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;

      // random direction
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist * 0.8;

      el.style.setProperty('--dx', dx + 'px');
      el.style.setProperty('--dy', dy + 'px');

      root.appendChild(el);
      // cleanup
      setTimeout(() => {
        el.remove();
      }, 520);
    }
  }

  /**
   * ข้อความคะแนน / Miss / Perfect เด้งตรงตำแหน่งเป้า
   * @param {number} x screenX
   * @param {number} y screenY
   * @param {string} text
   * @param {object} opts {good,bad,small}
   */
  function scorePop(x, y, text, opts) {
    const root = ensureLayer();
    const el = global.document.createElement('div');
    el.className = 'hha-fx-score';

    if (opts && opts.good) el.classList.add('good');
    if (opts && opts.bad)  el.classList.add('bad');
    if (opts && opts.small)el.classList.add('small');

    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    root.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 750);
  }

  const api = { burstAt, scorePop };

  global.GAME_MODULES = global.GAME_MODULES || {};
  global.GAME_MODULES.Particles = api;
  global.Particles = api;

})(window);
