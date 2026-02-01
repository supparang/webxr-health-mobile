// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION FX PACK (SAFE, NO-DEPS)
// ✅ Shared FX layer for all games (GoodJunk/Groups/Hydration/Plate/...)
// ✅ Always-on-top: z-index forced high, pointer-events none
// ✅ APIs:
//    Particles.popText(x,y,text,opts)
//    Particles.popEmoji(x,y,emoji,opts)
//    Particles.burst(x,y,opts)          // radial spark burst
//    Particles.confetti(x,y,opts)       // confetti burst
//    Particles.ring(x,y,opts)           // shockwave ring
//    Particles.flash(opts)              // screen flash
// Notes:
// - Safe: never throws, auto-mounts layer and CSS once.
// - Works in mobile/PC, ignores in SSR/no-document.
// - You can pass className like "fx-good fx-warn fx-bad fx-violet" to match CSS.

(function (root) {
  'use strict';
  const doc = root && root.document;
  if (!doc || root.__HHA_PARTICLES_V2__) return;
  root.__HHA_PARTICLES_V2__ = true;

  // ------------------------ helpers ------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const now = () => (root.performance && performance.now) ? performance.now() : Date.now();

  function ensureLayer() {
    try{
      let layer = doc.querySelector('.hha-fx-layer');
      if (layer) {
        // harden style (in case CSS changed)
        layer.style.position = 'fixed';
        layer.style.inset = '0';
        layer.style.pointerEvents = 'none';
        layer.style.overflow = 'hidden';
        layer.style.zIndex = '9999';
        layer.setAttribute('aria-hidden', 'true');
        return layer;
      }
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
      doc.body.appendChild(layer);
      return layer;
    }catch(_){
      return null;
    }
  }

  function mountCSSOnce() {
    try{
      if (doc.getElementById('hha-particles-css')) return;
      const st = doc.createElement('style');
      st.id = 'hha-particles-css';
      st.textContent = `
        .hha-fx-layer{ position:fixed; inset:0; pointer-events:none; overflow:hidden; z-index:9999; }
        .hha-fx{ position:absolute; left:0; top:0; transform:translate(-50%,-50%); will-change:transform,opacity,filter; pointer-events:none; }

        /* pop text / emoji */
        @keyframes hhaPopUp{
          0%   { transform:translate(-50%,-50%) scale(.88); opacity:.0; }
          16%  { opacity:1; }
          70%  { transform:translate(-50%,-86%) scale(1.18); opacity:1; }
          100% { transform:translate(-50%,-105%) scale(1.02); opacity:0; }
        }

        /* ring */
        @keyframes hhaRing{
          0%   { transform:translate(-50%,-50%) scale(.35); opacity:.0; }
          10%  { opacity:.65; }
          100% { transform:translate(-50%,-50%) scale(1.55); opacity:0; }
        }

        /* confetti piece */
        @keyframes hhaConf{
          0%   { transform:translate(-50%,-50%) translate(0,0) rotate(0deg); opacity:1; }
          100% { transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity:0; }
        }

        /* spark */
        @keyframes hhaSpark{
          0%   { transform:translate(-50%,-50%) translate(0,0) scale(1); opacity:1; }
          100% { transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.7); opacity:0; }
        }

        /* screen flash */
        .hha-flash{
          position:fixed; inset:0; pointer-events:none;
          background: rgba(255,255,255,.18);
          opacity:0;
          animation: hhaFlash 180ms ease-out forwards;
        }
        @keyframes hhaFlash{
          0%{ opacity:0; }
          25%{ opacity:1; }
          100%{ opacity:0; }
        }
      `;
      doc.head.appendChild(st);
    }catch(_){}
  }

  function addEl(el, ttlMs) {
    const layer = ensureLayer();
    if (!layer) return null;
    try{
      layer.appendChild(el);
      const kill = () => { try{ el.remove(); }catch(_){ } };
      setTimeout(kill, clamp(ttlMs, 80, 5000));
      return el;
    }catch(_){
      return null;
    }
  }

  // ------------------------ FX primitives ------------------------
  function popText(x, y, text, opts) {
    try{
      mountCSSOnce();
      const el = doc.createElement('div');
      el.className = 'hha-fx ' + (opts && opts.className ? String(opts.className) : '');
      el.textContent = String(text ?? '');
      const size = clamp(opts && opts.size ? opts.size : 18, 10, 56);
      const dur = clamp(opts && opts.dur ? opts.dur : 520, 140, 1600);
      const weight = clamp(opts && opts.weight ? opts.weight : 900, 400, 1200);
      const color = (opts && opts.color) ? String(opts.color) : '#fff';
      const shadow = (opts && opts.shadow) ? String(opts.shadow) : '0 8px 22px rgba(0,0,0,.55)';
      el.style.left = (Number(x) || 0) + 'px';
      el.style.top  = (Number(y) || 0) + 'px';
      el.style.font = `${weight} ${size}px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif`;
      el.style.color = color;
      el.style.textShadow = shadow;
      el.style.opacity = '0';
      el.style.animation = `hhaPopUp ${dur}ms ease-out forwards`;
      return addEl(el, dur + 120);
    }catch(_){
      return null;
    }
  }

  function popEmoji(x, y, emoji, opts) {
    opts = opts || {};
    if (!('size' in opts)) opts.size = 26;
    if (!('weight' in opts)) opts.weight = 900;
    return popText(x, y, emoji, opts);
  }

  function ring(x, y, opts) {
    try{
      mountCSSOnce();
      const el = doc.createElement('div');
      el.className = 'hha-fx ' + (opts && opts.className ? String(opts.className) : '');
      const dur = clamp(opts && opts.dur ? opts.dur : 380, 180, 1200);
      const size = clamp(opts && opts.size ? opts.size : 86, 30, 240);
      const stroke = clamp(opts && opts.stroke ? opts.stroke : 2, 1, 6);
      const color = (opts && opts.color) ? String(opts.color) : 'rgba(255,255,255,.35)';
      el.style.left = (Number(x) || 0) + 'px';
      el.style.top  = (Number(y) || 0) + 'px';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.borderRadius = '999px';
      el.style.border = `${stroke}px solid ${color}`;
      el.style.boxShadow = `0 0 0 14px rgba(255,255,255,.04), 0 0 0 40px rgba(255,255,255,.02)`;
      el.style.opacity = '0';
      el.style.animation = `hhaRing ${dur}ms ease-out forwards`;
      return addEl(el, dur + 120);
    }catch(_){
      return null;
    }
  }

  function burst(x, y, opts) {
    try{
      mountCSSOnce();
      const count = clamp(opts && opts.count ? opts.count : 10, 4, 28);
      const dur = clamp(opts && opts.dur ? opts.dur : 420, 200, 1200);
      const spread = clamp(opts && opts.spread ? opts.spread : 88, 30, 220);
      const size = clamp(opts && opts.size ? opts.size : 6, 3, 14);
      const color = (opts && opts.color) ? String(opts.color) : 'rgba(255,255,255,.85)';
      const className = (opts && opts.className) ? String(opts.className) : '';

      for (let i = 0; i < count; i++) {
        const el = doc.createElement('div');
        el.className = 'hha-fx ' + className;
        el.style.left = (Number(x) || 0) + 'px';
        el.style.top  = (Number(y) || 0) + 'px';
        el.style.width = size + 'px';
        el.style.height = size + 'px';
        el.style.borderRadius = '999px';
        el.style.background = color;
        el.style.filter = 'drop-shadow(0 10px 24px rgba(0,0,0,.35))';

        const ang = rnd(0, Math.PI * 2);
        const r = rnd(spread * 0.55, spread);
        const dx = Math.cos(ang) * r;
        const dy = Math.sin(ang) * r;
        el.style.setProperty('--dx', dx.toFixed(1) + 'px');
        el.style.setProperty('--dy', dy.toFixed(1) + 'px');
        el.style.opacity = '1';
        el.style.animation = `hhaSpark ${dur}ms ease-out forwards`;
        addEl(el, dur + 120);
      }

      // optional ring under burst
      if (!opts || opts.ring !== false) {
        ring(x, y, {
          dur: Math.max(220, dur * 0.8),
          size: clamp(spread * 1.1, 56, 320),
          stroke: 2,
          color: (opts && opts.ringColor) ? String(opts.ringColor) : 'rgba(255,255,255,.18)',
          className
        });
      }
      return true;
    }catch(_){
      return false;
    }
  }

  function confetti(x, y, opts) {
    try{
      mountCSSOnce();
      const count = clamp(opts && opts.count ? opts.count : 14, 6, 42);
      const dur = clamp(opts && opts.dur ? opts.dur : 680, 260, 1600);
      const spread = clamp(opts && opts.spread ? opts.spread : 140, 60, 360);
      const size = clamp(opts && opts.size ? opts.size : 8, 4, 14);
      const className = (opts && opts.className) ? String(opts.className) : '';

      const colors = (opts && opts.colors && Array.isArray(opts.colors) && opts.colors.length)
        ? opts.colors.map(String)
        : ['rgba(34,197,94,.95)','rgba(34,211,238,.95)','rgba(245,158,11,.95)','rgba(167,139,250,.95)','rgba(251,113,133,.95)'];

      for (let i = 0; i < count; i++) {
        const el = doc.createElement('div');
        el.className = 'hha-fx ' + className;
        el.style.left = (Number(x) || 0) + 'px';
        el.style.top  = (Number(y) || 0) + 'px';

        const w = size + rnd(-2, 4);
        const h = size + rnd(4, 10);
        el.style.width = Math.max(3, w).toFixed(0) + 'px';
        el.style.height = Math.max(6, h).toFixed(0) + 'px';
        el.style.borderRadius = rnd(2, 6).toFixed(0) + 'px';
        el.style.background = colors[i % colors.length];
        el.style.filter = 'drop-shadow(0 10px 22px rgba(0,0,0,.32))';

        const dx = rnd(-spread, spread);
        const dy = rnd(spread * 0.45, spread * 1.2);
        const rot = rnd(-720, 720).toFixed(0) + 'deg';

        el.style.setProperty('--dx', dx.toFixed(1) + 'px');
        el.style.setProperty('--dy', dy.toFixed(1) + 'px');
        el.style.setProperty('--rot', rot);

        el.style.opacity = '1';
        el.style.animation = `hhaConf ${dur}ms cubic-bezier(.2,.9,.2,1) forwards`;
        addEl(el, dur + 160);
      }

      return true;
    }catch(_){
      return false;
    }
  }

  function flash(opts) {
    try{
      mountCSSOnce();
      const el = doc.createElement('div');
      el.className = 'hha-flash ' + (opts && opts.className ? String(opts.className) : '');
      if (opts && opts.color) el.style.background = String(opts.color);
      return addEl(el, 260);
    }catch(_){
      return null;
    }
  }

  // ------------------------ expose ------------------------
  root.Particles = root.Particles || {};
  root.Particles.ensureLayer = ensureLayer;
  root.Particles.popText = popText;
  root.Particles.popEmoji = popEmoji;
  root.Particles.burst = burst;
  root.Particles.confetti = confetti;
  root.Particles.ring = ring;
  root.Particles.flash = flash;

  // small smoke test hook (optional)
  root.Particles._ping = function () {
    try{
      const t = now();
      popEmoji(80, 120, '✨', { className:'fx-violet', dur: 520, size: 26 });
      burst(140, 120, { className:'fx-good', count: 10, spread: 90, dur: 420 });
      ring(220, 120, { className:'fx-warn', size: 90, dur: 380 });
      confetti(300, 120, { count: 12, spread: 120, dur: 720 });
      return { ok:true, t };
    }catch(_){
      return { ok:false };
    }
  };

})(window);