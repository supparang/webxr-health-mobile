// === /herohealth/vr/particles.js ===
// HHA Particles — FAIR PACK (Unified FX Core)
// ✅ Non-blocking overlay layer
// ✅ API: popText(x,y,text,cls,opts), burstAt(x,y,kind,opts), ringPulse(x,y,kind,opts), celebrate(kind,opts)
// ✅ Safe for all games (Groups/Hydration/Plate/GoodJunk)
// Notes:
// - All colors are CSS-class driven (no hard dependency on theme)
// - Rate/cleanup safe

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---- layer ----
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:90',
      'overflow:hidden',
      'contain:layout paint style'
    ].join(';');
    doc.body.appendChild(layer);
    return layer;
  }

  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function rnd(a,b){ return a + Math.random()*(b-a); }

  function vp(){
    const W = doc.documentElement.clientWidth || innerWidth || 1;
    const H = doc.documentElement.clientHeight || innerHeight || 1;
    return { W,H };
  }

  function removeLater(el, ms){
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, ms);
  }

  // ---- styles ----
  const st = doc.createElement('style');
  st.textContent = `
    .hha-fx-pop{
      position:absolute;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui;
      letter-spacing:.2px;
      opacity:.98;
      will-change: transform, opacity, filter;
      text-shadow: 0 10px 22px rgba(0,0,0,.55);
      animation: hhaPop 520ms ease-out forwards;
    }
    .hha-fx-pop.good{ color: rgba(229,255,244,.98); filter: drop-shadow(0 0 16px rgba(34,197,94,.30)); }
    .hha-fx-pop.bad{  color: rgba(255,235,235,.98); filter: drop-shadow(0 0 16px rgba(239,68,68,.25)); }
    .hha-fx-pop.warn{ color: rgba(255,240,210,.98); filter: drop-shadow(0 0 16px rgba(245,158,11,.25)); }
    .hha-fx-pop.cyan{ color: rgba(225,252,255,.98); filter: drop-shadow(0 0 16px rgba(34,211,238,.25)); }
    .hha-fx-pop.violet{ color: rgba(244,235,255,.98); filter: drop-shadow(0 0 16px rgba(167,139,250,.22)); }

    @keyframes hhaPop{
      0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; }
      70%{ transform:translate(-50%,-72%) scale(1.18); opacity:1; }
      100%{ transform:translate(-50%,-92%) scale(1.05); opacity:0; }
    }

    .hha-fx-ring{
      position:absolute;
      transform: translate(-50%,-50%);
      border-radius: 999px;
      border: 2px solid rgba(229,231,235,.55);
      box-shadow: 0 0 0 10px rgba(229,231,235,.08);
      opacity:.0;
      will-change: transform, opacity;
      animation: hhaRing 520ms ease-out forwards;
    }
    .hha-fx-ring.good{ border-color: rgba(34,197,94,.55); box-shadow: 0 0 0 10px rgba(34,197,94,.12); }
    .hha-fx-ring.bad{  border-color: rgba(239,68,68,.55); box-shadow: 0 0 0 10px rgba(239,68,68,.12); }
    .hha-fx-ring.warn{ border-color: rgba(245,158,11,.55); box-shadow: 0 0 0 10px rgba(245,158,11,.12); }
    .hha-fx-ring.cyan{ border-color: rgba(34,211,238,.55); box-shadow: 0 0 0 10px rgba(34,211,238,.12); }
    .hha-fx-ring.violet{ border-color: rgba(167,139,250,.55); box-shadow: 0 0 0 10px rgba(167,139,250,.12); }
    .hha-fx-ring.star{ border-color: rgba(245,158,11,.55); box-shadow: 0 0 0 12px rgba(245,158,11,.12); }
    .hha-fx-ring.shield{ border-color: rgba(34,211,238,.55); box-shadow: 0 0 0 12px rgba(34,211,238,.12); }

    @keyframes hhaRing{
      0%{ transform:translate(-50%,-50%) scale(.70); opacity:0; }
      20%{ opacity:1; }
      100%{ transform:translate(-50%,-50%) scale(1.12); opacity:0; }
    }

    .hha-fx-dot{
      position:absolute;
      transform: translate(-50%,-50%);
      width: 8px; height: 8px;
      border-radius: 999px;
      background: rgba(229,231,235,.9);
      opacity:.0;
      will-change: transform, opacity;
      animation: hhaDot 520ms cubic-bezier(.12,.9,.16,1) forwards;
    }
    .hha-fx-dot.good{ background: rgba(34,197,94,.92); }
    .hha-fx-dot.bad{ background: rgba(239,68,68,.92); }
    .hha-fx-dot.warn{ background: rgba(245,158,11,.92); }
    .hha-fx-dot.cyan{ background: rgba(34,211,238,.92); }
    .hha-fx-dot.violet{ background: rgba(167,139,250,.92); }

    @keyframes hhaDot{
      0%{ opacity:0; transform:translate(-50%,-50%) scale(.7); }
      15%{ opacity:1; }
      100%{ opacity:0; transform:translate(var(--dx), var(--dy)) scale(.9); }
    }
  `;
  doc.head.appendChild(st);

  // ---- API ----
  function popText(x,y,text,cls,opts){
    const layer = ensureLayer();
    const { W,H } = vp();
    const el = doc.createElement('div');
    el.className = `hha-fx-pop ${cls||''}`.trim();
    el.textContent = String(text||'');
    el.style.left = clamp(x, 10, W-10) + 'px';
    el.style.top  = clamp(y, 10, H-10) + 'px';

    const size = clamp(Number(opts?.size||18), 12, 40);
    el.style.fontSize = size + 'px';

    layer.appendChild(el);
    removeLater(el, 700);
  }

  function ringPulse(x,y,kind,opts){
    const layer = ensureLayer();
    const { W,H } = vp();
    const el = doc.createElement('div');
    const cls = String(kind||'').toLowerCase();
    el.className = `hha-fx-ring ${cls}`.trim();
    el.style.left = clamp(x, 10, W-10) + 'px';
    el.style.top  = clamp(y, 10, H-10) + 'px';

    const size = clamp(Number(opts?.size||160), 80, 420);
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    layer.appendChild(el);
    removeLater(el, 700);
  }

  function burstAt(x,y,kind,opts){
    const layer = ensureLayer();
    const { W,H } = vp();

    const cls = String(kind||'').toLowerCase();
    const n = clamp(Number(opts?.count||12), 6, 22);
    const r = clamp(Number(opts?.radius||rnd(90, 140)), 60, 200);

    for(let i=0;i<n;i++){
      const dot = doc.createElement('div');
      dot.className = `hha-fx-dot ${cls}`.trim();
      const ang = (Math.PI*2) * (i/n) + rnd(-0.22, 0.22);
      const dist = rnd(r*0.55, r);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;

      dot.style.left = clamp(x, 10, W-10) + 'px';
      dot.style.top  = clamp(y, 10, H-10) + 'px';
      dot.style.setProperty('--dx', `calc(${dot.style.left} + ${dx}px - 50%)`);
      dot.style.setProperty('--dy', `calc(${dot.style.top} + ${dy}px - 50%)`);

      // override animation by using transform target via CSS vars:
      // We do it by setting translate() destination in vars, CSS uses translate(var(--dx), var(--dy))
      // Here vars are absolute pixels; the translate uses them directly.
      // To keep it simple, set them as pixel translate values:
      dot.style.setProperty('--dx', `calc(-50% + ${dx}px)`);
      dot.style.setProperty('--dy', `calc(-50% + ${dy}px)`);

      layer.appendChild(dot);
      removeLater(dot, 650);
    }
  }

  function celebrate(kind, opts){
    const { W,H } = vp();
    const count = clamp(Number(opts?.count||16), 8, 28);
    const cls = String(kind||'good').toLowerCase();

    // top confetti rain
    for(let i=0;i<count;i++){
      const x = rnd(W*0.15, W*0.85);
      const y = rnd(H*0.10, H*0.30);
      ringPulse(x,y, cls==='win' ? 'good' : cls, { size: rnd(120, 220) });
      burstAt(x,y, cls==='win' ? 'good' : cls, { count: rnd(10, 18), radius: rnd(90, 150) });
    }
    popText(W/2, H*0.22, (cls==='win'?'NICE!':'GREAT!'), cls==='win'?'good':cls, { size: 26 });
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.ringPulse = ringPulse;
  root.Particles.burstAt = burstAt;
  root.Particles.celebrate = celebrate;

  // optional registry
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);