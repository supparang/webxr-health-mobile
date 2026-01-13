// === /herohealth/vr/particles.js ===
// HeroHealth Particles — ULTRA FX CORE (SAFE, SHARED)
// ✅ Single .hha-fx-layer (idempotent)
// ✅ popText(x,y,text,cls?, opts?)
// ✅ burstAt(x,y, kind='good'|'bad'|'star'|'shield', opts?)
// ✅ ringPulse(x,y, kind, opts?)
// ✅ celebrate(kind='win'|'perfect'|'boss', opts?)
// ✅ screenPing(kind='good'|'bad'|'warn', ms?)
// Notes:
// - Pure DOM/CSS (no canvas) for maximum compatibility (Android/VR browsers)
// - All effects are pointer-events:none and auto-cleaned.

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
  const now = ()=> (root.performance?.now?.() ?? Date.now());

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  function ensurePing(){
    let el = doc.getElementById('hha-screen-ping');
    if (el) return el;
    el = doc.createElement('div');
    el.id = 'hha-screen-ping';
    el.style.cssText =
      'position:fixed;inset:-2px;pointer-events:none;z-index:91;opacity:0;' +
      'background:radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), rgba(0,0,0,0) 58%);' +
      'mix-blend-mode:overlay;transition:opacity 120ms ease;';
    doc.body.appendChild(el);
    return el;
  }

  function injectStyle(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font: 900 18px/1 system-ui;
        color:#fff;
        text-shadow:0 10px 24px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-fx-pop.good{ color: rgba(34,197,94,1); }
      .hha-fx-pop.bad{  color: rgba(239,68,68,1); }
      .hha-fx-pop.warn{ color: rgba(245,158,11,1); }
      .hha-fx-pop.cyan{ color: rgba(34,211,238,1); }
      .hha-fx-pop.violet{ color: rgba(167,139,250,1); }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.95; filter:blur(0px); }
        70%{ transform:translate(-50%,-74%) scale(1.18); opacity:1; filter:blur(0px); }
        100%{ transform:translate(-50%,-92%) scale(1.06); opacity:0; filter:blur(.2px); }
      }

      .hha-burst{
        position:absolute;
        width:10px; height:10px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaBurst 520ms ease-out forwards;
      }
      .hha-burst.good{ background: rgba(34,197,94,.95); box-shadow:0 0 18px rgba(34,197,94,.35); }
      .hha-burst.bad{  background: rgba(239,68,68,.95);  box-shadow:0 0 18px rgba(239,68,68,.35); }
      .hha-burst.star{ background: rgba(245,158,11,.95); box-shadow:0 0 18px rgba(245,158,11,.35); }
      .hha-burst.shield{ background: rgba(34,211,238,.95); box-shadow:0 0 18px rgba(34,211,238,.35); }

      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.6); opacity:.95; }
        100%{ transform:translate(-50%,-50%) scale(3.2); opacity:0; }
      }

      .hha-ring{
        position:absolute;
        width:120px; height:120px;
        transform:translate(-50%,-50%) scale(.72);
        border-radius:999px;
        border:2px solid rgba(255,255,255,.18);
        opacity:.85;
        will-change: transform, opacity;
        animation: hhaRing 620ms ease-out forwards;
      }
      .hha-ring.good{ border-color: rgba(34,197,94,.55); box-shadow:0 0 24px rgba(34,197,94,.18); }
      .hha-ring.bad{  border-color: rgba(239,68,68,.55);  box-shadow:0 0 24px rgba(239,68,68,.18); }
      .hha-ring.star{ border-color: rgba(245,158,11,.55); box-shadow:0 0 24px rgba(245,158,11,.18); }
      .hha-ring.shield{ border-color: rgba(34,211,238,.55); box-shadow:0 0 24px rgba(34,211,238,.18); }
      .hha-ring.violet{ border-color: rgba(167,139,250,.55); box-shadow:0 0 24px rgba(167,139,250,.18); }

      @keyframes hhaRing{
        0%{ transform:translate(-50%,-50%) scale(.72); opacity:.88; filter:blur(0px); }
        100%{ transform:translate(-50%,-50%) scale(1.22); opacity:0; filter:blur(.3px); }
      }

      .hha-confetti{
        position:absolute;
        width:10px; height:10px;
        transform:translate(-50%,-50%);
        border-radius:3px;
        opacity:.95;
        will-change: transform, opacity;
        animation: hhaConfetti 980ms ease-out forwards;
      }
      @keyframes hhaConfetti{
        0%{ transform:translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1); opacity:1; }
        100%{ transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) rotate(260deg) scale(.9); opacity:0; }
      }
    `;
    doc.head.appendChild(st);
  }

  injectStyle();

  function popText(x,y,text,cls,opts){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls ? (' ' + cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';

    // optional sizing
    const size = clamp(Number(opts?.size ?? 18), 12, 34);
    el.style.fontSize = size + 'px';

    layer.appendChild(el);
    const life = clamp(Number(opts?.life ?? 600), 320, 1400);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, life);
    return el;
  }

  function burstAt(x,y,kind,opts){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-burst ' + (kind || 'good');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';

    const scale = clamp(Number(opts?.scale ?? 1), .6, 2.2);
    el.style.transform = `translate(-50%,-50%) scale(${0.6*scale})`;

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
    return el;
  }

  function ringPulse(x,y,kind,opts){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-ring ' + (kind || 'good');
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';

    const size = clamp(Number(opts?.size ?? 120), 72, 240);
    el.style.width = size + 'px';
    el.style.height= size + 'px';

    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 780);
    return el;
  }

  function celebrate(kind, opts){
    const layer = ensureLayer();
    const w = root.innerWidth || 360;
    const h = root.innerHeight || 640;

    const n = clamp(Number(opts?.count ?? (kind==='boss'? 26 : 18)), 8, 48);
    const cx = Number(opts?.x ?? (w*0.5));
    const cy = Number(opts?.y ?? (h*0.34));

    for(let i=0;i<n;i++){
      const c = doc.createElement('div');
      c.className = 'hha-confetti';

      const rx = (Math.random()*2 - 1);
      const ry = (Math.random()*2 - 1);

      const dx = (rx * (kind==='boss'? 260 : 200)) | 0;
      const dy = (ry * (kind==='boss'? 320 : 260) + 220) | 0; // fall down
      c.style.setProperty('--dx', dx + 'px');
      c.style.setProperty('--dy', dy + 'px');

      c.style.left = (cx|0) + 'px';
      c.style.top  = (cy|0) + 'px';

      // color set by inline (simple, avoids theme mismatch)
      const palette =
        kind==='perfect' ? ['rgba(34,211,238,.95)','rgba(167,139,250,.95)','rgba(34,197,94,.95)'] :
        kind==='boss'    ? ['rgba(245,158,11,.95)','rgba(239,68,68,.95)','rgba(255,255,255,.88)'] :
                           ['rgba(34,197,94,.95)','rgba(245,158,11,.95)','rgba(34,211,238,.95)'];
      c.style.background = palette[(Math.random()*palette.length)|0];

      const s = clamp(0.8 + Math.random()*1.4, .7, 2.2);
      c.style.width = (8*s) + 'px';
      c.style.height= (8*s) + 'px';
      c.style.borderRadius = (Math.random()>.5) ? '999px' : '3px';

      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){ } }, 1100);
    }
  }

  let lastPingT = 0;
  function screenPing(kind, ms){
    const t = now();
    if (t - lastPingT < 80) return; // rate limit
    lastPingT = t;

    const el = ensurePing();
    const dur = clamp(Number(ms ?? 140), 90, 520);

    // choose tint
    const bg =
      (kind==='bad')  ? 'radial-gradient(circle at 50% 45%, rgba(239,68,68,.10), rgba(0,0,0,0) 60%)' :
      (kind==='warn') ? 'radial-gradient(circle at 50% 45%, rgba(245,158,11,.10), rgba(0,0,0,0) 60%)' :
                        'radial-gradient(circle at 50% 45%, rgba(34,197,94,.09), rgba(0,0,0,0) 60%)';

    el.style.background = bg;
    el.style.opacity = '1';
    setTimeout(()=>{ try{ el.style.opacity = '0'; }catch(_){ } }, dur);
  }

  // public API
  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.burstAt   = burstAt;
  root.Particles.ringPulse = ringPulse;
  root.Particles.celebrate = celebrate;
  root.Particles.screenPing= screenPing;

})(window);