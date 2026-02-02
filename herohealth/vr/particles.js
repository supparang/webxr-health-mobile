// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (UNIVERSAL, SAFE)
// ✅ Ensures one global FX layer (.hha-fx-layer) above playfield/HUD but below end overlay
// ✅ API: window.Particles.popText(x,y,text)
// ✅ API: window.Particles.scorePop(x,y,text)
// ✅ API: window.Particles.burstAt(x,y,kind)  kind: good|bad|star|shield|diamond|block|confetti
// ✅ Never throws; ok if called very frequently (internal rate-limits are mild)
// ✅ Works across all HeroHealth games

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ------------------ helpers ------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();

  // light throttles (avoid DOM spam on mobile)
  const RL = { popAt: 0, burstAt: 0 };
  function allow(key, ms){
    const t = now();
    if (t - (RL[key] || 0) < ms) return false;
    RL[key] = t;
    return true;
  }

  function ensureLayer() {
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:120',         // <— above most HUD(<=110) but still below end overlay(>=200)
      'overflow:hidden',
      'contain:layout paint style',
    ].join(';');
    DOC.body.appendChild(layer);
    return layer;
  }

  // ------------------ style ------------------
  const st = DOC.createElement('style');
  st.textContent = `
    /* ===== HHA Particles core ===== */

    .hha-fx-pop, .hha-fx-score{
      position:absolute;
      transform: translate(-50%,-50%);
      will-change: transform, opacity;
      pointer-events:none;
      user-select:none;
      -webkit-user-select:none;
      text-shadow: 0 10px 26px rgba(0,0,0,.55);
      filter: drop-shadow(0 10px 22px rgba(0,0,0,.22));
    }

    .hha-fx-pop{
      font: 1000 16px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      opacity:.98;
      animation: hhaPopUp 520ms ease-out forwards;
    }

    .hha-fx-score{
      font: 1200 18px/1 system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      letter-spacing:.2px;
      opacity:.98;
      animation: hhaScoreUp 650ms cubic-bezier(.12,.8,.18,1) forwards;
    }

    @keyframes hhaPopUp{
      0%{ transform:translate(-50%,-45%) scale(.92); opacity:.1; }
      20%{ opacity:1; }
      70%{ transform:translate(-50%,-75%) scale(1.12); opacity:1; }
      100%{ transform:translate(-50%,-92%) scale(1.05); opacity:0; }
    }
    @keyframes hhaScoreUp{
      0%{ transform:translate(-50%,-40%) scale(.92); opacity:.15; }
      18%{ opacity:1; }
      70%{ transform:translate(-50%,-95%) scale(1.18); opacity:1; }
      100%{ transform:translate(-50%,-120%) scale(1.06); opacity:0; }
    }

    .hha-fx-burst{
      position:absolute;
      left:0; top:0;
      width:1px; height:1px;
      pointer-events:none;
    }

    .hha-fx-spark{
      position:absolute;
      width:10px; height:10px;
      border-radius:999px;
      opacity:.95;
      transform: translate(-50%,-50%);
      will-change: transform, opacity;
      animation: hhaSpark 520ms ease-out forwards;
      filter: drop-shadow(0 10px 22px rgba(0,0,0,.25));
    }

    @keyframes hhaSpark{
      0%{ transform:translate(-50%,-50%) scale(.9); opacity:.0; }
      15%{ opacity:1; }
      80%{ opacity:.95; }
      100%{ transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.4);
            opacity:0; }
    }

    /* confetti: rectangles */
    .hha-fx-conf{
      position:absolute;
      width:8px; height:12px;
      border-radius:3px;
      opacity:.95;
      transform: translate(-50%,-50%) rotate(var(--rot));
      will-change: transform, opacity;
      animation: hhaConf 900ms ease-out forwards;
      filter: drop-shadow(0 10px 22px rgba(0,0,0,.22));
    }
    @keyframes hhaConf{
      0%{ opacity:0; transform:translate(-50%,-50%) rotate(var(--rot)) scale(.9); }
      12%{ opacity:1; }
      100%{ opacity:0;
            transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(calc(var(--rot) + 90deg)) scale(.65); }
    }
  `;
  DOC.head.appendChild(st);

  // ------------------ FX primitives ------------------
  function popText(x, y, text) {
    try {
      if (!allow('popAt', 45)) return;
      const layer = ensureLayer();
      const el = DOC.createElement('div');
      el.className = 'hha-fx-pop';
      el.textContent = String(text ?? '');
      el.style.left = `${Math.round(Number(x) || 0)}px`;
      el.style.top  = `${Math.round(Number(y) || 0)}px`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 700);
    } catch (_) {}
  }

  function scorePop(x, y, text) {
    try {
      if (!allow('popAt', 45)) return;
      const layer = ensureLayer();
      const el = DOC.createElement('div');
      el.className = 'hha-fx-score';
      el.textContent = String(text ?? '');
      el.style.left = `${Math.round(Number(x) || 0)}px`;
      el.style.top  = `${Math.round(Number(y) || 0)}px`;
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 900);
    } catch (_) {}
  }

  function burstAt(x, y, kind) {
    try {
      if (!allow('burstAt', 55)) return;
      const layer = ensureLayer();

      const cx = Math.round(Number(x) || 0);
      const cy = Math.round(Number(y) || 0);

      const wrap = DOC.createElement('div');
      wrap.className = 'hha-fx-burst';
      wrap.style.left = `${cx}px`;
      wrap.style.top  = `${cy}px`;
      layer.appendChild(wrap);

      // pick palette per kind (no hard colors needed; use translucent white variants)
      // We'll vary opacity/size and rely on drop-shadow; keeps style consistent.
      const n =
        (kind === 'confetti') ? 18 :
        (kind === 'diamond') ? 14 :
        (kind === 'bad') ? 12 :
        10;

      // sparks
      for (let i = 0; i < n; i++) {
        const s = DOC.createElement('div');
        s.className = (kind === 'confetti') ? 'hha-fx-conf' : 'hha-fx-spark';

        const ang = rnd(0, Math.PI * 2);
        const r   =
          (kind === 'diamond') ? rnd(54, 120) :
          (kind === 'bad') ? rnd(40, 95) :
          (kind === 'block') ? rnd(35, 80) :
          rnd(45, 105);

        const dx = Math.cos(ang) * r;
        const dy = Math.sin(ang) * r;

        s.style.left = `0px`;
        s.style.top  = `0px`;
        s.style.setProperty('--dx', `${dx.toFixed(1)}px`);
        s.style.setProperty('--dy', `${dy.toFixed(1)}px`);

        if (s.className === 'hha-fx-spark') {
          const sz =
            (kind === 'diamond') ? rnd(9, 14) :
            (kind === 'star') ? rnd(8, 12) :
            (kind === 'shield') ? rnd(8, 12) :
            (kind === 'bad') ? rnd(9, 13) :
            rnd(8, 12);

          s.style.width  = `${sz.toFixed(0)}px`;
          s.style.height = `${sz.toFixed(0)}px`;

          // use simple visual hints by opacity only (avoid explicit colors)
          const op =
            (kind === 'bad') ? rnd(0.55, 0.85) :
            (kind === 'block') ? rnd(0.55, 0.8) :
            rnd(0.65, 0.95);
          s.style.opacity = String(op);

          // subtle variety by blur/brightness
          const bright =
            (kind === 'diamond') ? rnd(1.05, 1.25) :
            (kind === 'star') ? rnd(1.05, 1.2) :
            rnd(0.95, 1.15);
          s.style.filter = `drop-shadow(0 10px 22px rgba(0,0,0,.25)) brightness(${bright.toFixed(2)})`;

          // base fill
          s.style.background = 'rgba(255,255,255,.92)';
        } else {
          // confetti rectangles
          const w = rnd(7, 10);
          const h = rnd(10, 16);
          s.style.width  = `${w.toFixed(0)}px`;
          s.style.height = `${h.toFixed(0)}px`;
          s.style.opacity = String(rnd(0.55, 0.9));
          s.style.background = 'rgba(255,255,255,.90)';
          s.style.setProperty('--rot', `${rnd(-30, 30).toFixed(1)}deg`);
        }

        wrap.appendChild(s);
      }

      // cleanup
      setTimeout(() => { try { wrap.remove(); } catch (_) {} }, 1100);
    } catch (_) {}
  }

  // ------------------ export ------------------
  root.Particles = root.Particles || {};
  root.Particles.popText  = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt  = burstAt;

  // notify for boots that want to wait
  try { root.dispatchEvent(new CustomEvent('hha:particles-ready', { detail: { ok: true } })); } catch (_) {}
})(window);