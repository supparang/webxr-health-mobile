// === /herohealth/vr/particles.js ===
// HHA FX Layer — ULTRA (shared by all games)
// ✅ window.Particles + window.GAME_MODULES.Particles
// ✅ API (backward compatible):
//    - popText(x,y,text,cls?,opts?)
//    - scorePop(x,y,text) (alias)
//    - burstAt(x,y,kind?,opts?)
//    - ringPulse(x,y,kind?,opts?)
//    - celebrate(kind?, opts?)  // fireworks-ish
// ✅ Safe: creates its own fixed layer, never blocks clicks (pointer-events:none)
// ✅ Works even if called before DOMContentLoaded (deferred safe)
// ✅ No CSS dependency (inline styles), so "CSS not working" won't kill FX

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC) return;

  // prevent duplicate load overriding instance
  if(root.__HHA_PARTICLES_LOADED__) return;
  root.__HHA_PARTICLES_LOADED__ = true;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const rnd = (a,b)=> a + Math.random()*(b-a);
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  // ---------- layer ----------
  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; z-index:90;
      pointer-events:none;
      overflow:hidden;
      contain: layout style paint;
    `;
    DOC.body.appendChild(layer);
    return layer;
  }

  function ensureSubLayer(name){
    const layer = ensureLayer();
    let el = layer.querySelector('.' + name);
    if(el) return el;
    el = DOC.createElement('div');
    el.className = name;
    el.style.cssText = `
      position:absolute; inset:0;
      pointer-events:none;
      overflow:hidden;
    `;
    layer.appendChild(el);
    return el;
  }

  function px(n){ return Math.round(Number(n)||0) + 'px'; }

  // ---------- styling helpers ----------
  function colorFor(kind){
    // IMPORTANT: not using CSS vars so FX works even if css fails
    switch(String(kind||'').toLowerCase()){
      case 'good': return 'rgba(34,197,94,.92)';     // green
      case 'bad':  return 'rgba(239,68,68,.92)';     // red
      case 'warn': return 'rgba(245,158,11,.92)';    // amber
      case 'star': return 'rgba(245,158,11,.92)';    // amber-ish
      case 'shield': return 'rgba(34,211,238,.92)';  // cyan
      case 'diamond':
      case 'violet': return 'rgba(167,139,250,.92)'; // violet
      case 'cyan': return 'rgba(34,211,238,.92)';
      default: return 'rgba(229,231,235,.92)';       // text
    }
  }

  function shadowFor(kind){
    switch(String(kind||'').toLowerCase()){
      case 'good': return '0 14px 34px rgba(34,197,94,.22)';
      case 'bad':  return '0 14px 34px rgba(239,68,68,.22)';
      case 'warn': return '0 14px 34px rgba(245,158,11,.22)';
      case 'shield': return '0 14px 34px rgba(34,211,238,.22)';
      case 'diamond':
      case 'violet': return '0 14px 34px rgba(167,139,250,.22)';
      default: return '0 14px 34px rgba(0,0,0,.22)';
    }
  }

  // ---------- FX primitives ----------
  function popText(x,y,text,cls,opts){
    const layer = ensureSubLayer('hha-fx-pop');
    const el = DOC.createElement('div');

    const kind = (opts && opts.kind) || cls || 'good';
    const size = clamp((opts && opts.size) || 18, 12, 64);
    const lifeMs = clamp((opts && opts.lifeMs) || 820, 280, 1800);
    const driftY = (opts && opts.driftY) != null ? Number(opts.driftY) : -44;

    el.textContent = String(text ?? '');
    el.style.cssText = `
      position:absolute;
      left:${px(x)}; top:${px(y)};
      transform: translate(-50%,-50%) scale(.92);
      opacity:0;
      font: 900 ${size}px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: .2px;
      color:${colorFor(kind)};
      text-shadow: 0 2px 0 rgba(0,0,0,.35);
      filter: drop-shadow(${shadowFor(kind)});
      will-change: transform, opacity;
      white-space: nowrap;
    `;

    layer.appendChild(el);

    // animate
    const t0 = now();
    const t1 = t0 + lifeMs;

    function step(){
      const t = now();
      const p = clamp((t - t0) / lifeMs, 0, 1);

      // ease out
      const e = 1 - Math.pow(1-p, 3);
      const yy = driftY * e;
      const sc = 0.92 + 0.20 * Math.sin(Math.PI * Math.min(1, p*1.1));
      const op = (p < 0.15) ? (p/0.15) : (p > 0.85 ? (1 - (p-0.85)/0.15) : 1);

      el.style.opacity = String(op);
      el.style.transform = `translate(-50%,-50%) translateY(${yy}px) scale(${sc})`;

      if(t < t1){
        requestAnimationFrame(step);
      }else{
        try{ el.remove(); }catch(_){}
      }
    }
    requestAnimationFrame(step);
  }

  function scorePop(x,y,text){
    popText(x,y,text,'good',{ size: 18, lifeMs: 780, driftY: -52 });
  }

  function ringPulse(x,y,kind,opts){
    const layer = ensureSubLayer('hha-fx-ring');
    const el = DOC.createElement('div');

    const col = colorFor(kind || 'good');
    const size = clamp((opts && opts.size) || 160, 60, 520);
    const lifeMs = clamp((opts && opts.lifeMs) || 520, 180, 1400);
    const thick = clamp((opts && opts.thick) || 6, 2, 14);

    el.style.cssText = `
      position:absolute;
      left:${px(x)}; top:${px(y)};
      width:${px(size)}; height:${px(size)};
      transform: translate(-50%,-50%) scale(.75);
      border-radius: 999px;
      border:${thick}px solid ${col};
      opacity:0;
      box-shadow: 0 0 0 ${px(Math.round(thick*1.3))} rgba(0,0,0,.06);
      filter: drop-shadow(${shadowFor(kind)});
      will-change: transform, opacity;
    `;
    layer.appendChild(el);

    const t0 = now();
    const t1 = t0 + lifeMs;

    function step(){
      const t = now();
      const p = clamp((t - t0)/lifeMs, 0, 1);
      const e = 1 - Math.pow(1-p, 3);

      const sc = 0.75 + 0.55 * e;
      const op = (p < 0.12) ? (p/0.12) : (1 - p);
      el.style.opacity = String(op);
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;

      if(t < t1) requestAnimationFrame(step);
      else { try{ el.remove(); }catch(_){} }
    }
    requestAnimationFrame(step);
  }

  function burstAt(x,y,kind,opts){
    const layer = ensureSubLayer('hha-fx-burst');

    const col = colorFor(kind || 'good');
    const count = clamp((opts && opts.count) || (kind==='bad'? 14 : 12), 6, 28);
    const lifeMs = clamp((opts && opts.lifeMs) || 520, 220, 1600);
    const radius = clamp((opts && opts.radius) || (kind==='bad' ? 110 : 90), 40, 220);

    for(let i=0;i<count;i++){
      const el = DOC.createElement('div');
      const ang = (i / count) * Math.PI * 2 + rnd(-0.08, 0.08);
      const dist = rnd(radius*0.45, radius);
      const sx = Math.cos(ang) * dist;
      const sy = Math.sin(ang) * dist;

      const sz = rnd(6, 12);
      el.style.cssText = `
        position:absolute;
        left:${px(x)}; top:${px(y)};
        width:${px(sz)}; height:${px(sz)};
        border-radius: ${rnd(3, 999)}px;
        background:${col};
        opacity:0;
        transform: translate(-50%,-50%) translate(0px,0px) scale(.7);
        filter: drop-shadow(${shadowFor(kind)});
        will-change: transform, opacity;
      `;
      layer.appendChild(el);

      const t0 = now();
      const t1 = t0 + lifeMs;

      function step(){
        const t = now();
        const p = clamp((t - t0)/lifeMs, 0, 1);
        const e = 1 - Math.pow(1-p, 3);

        const xx = sx * e;
        const yy = sy * e + (p*p*30); // gravity-ish
        const sc = 0.7 + 0.8*(1-p);
        const op = (p < 0.08) ? (p/0.08) : (1 - p);

        el.style.opacity = String(op);
        el.style.transform = `translate(-50%,-50%) translate(${xx}px,${yy}px) scale(${sc})`;

        if(t < t1) requestAnimationFrame(step);
        else { try{ el.remove(); }catch(_){} }
      }
      requestAnimationFrame(step);
    }
  }

  function celebrate(kind, opts){
    // quick fireworks around top-mid screen
    const W = DOC.documentElement.clientWidth || innerWidth;
    const H = DOC.documentElement.clientHeight || innerHeight;
    const n = clamp((opts && opts.count) || 14, 6, 40);

    const centerX = (opts && opts.x) != null ? Number(opts.x) : (W*0.5);
    const centerY = (opts && opts.y) != null ? Number(opts.y) : (H*0.30);

    const palette = [
      'good','warn','shield','violet','good','warn','bad'
    ];

    for(let i=0;i<n;i++){
      const k = (opts && opts.kind) || palette[i % palette.length];
      const x = centerX + rnd(-W*0.22, W*0.22);
      const y = centerY + rnd(-H*0.10, H*0.18);
      ringPulse(x,y,k,{ size: rnd(160, 320), lifeMs: rnd(420, 760), thick: rnd(4, 8) });
      burstAt(x,y,k,{ count: rnd(10,18)|0, lifeMs: rnd(420, 720), radius: rnd(70, 150) });
      if(Math.random() < 0.55){
        popText(x,y, (kind==='boss'?'BOSS DOWN!':'NICE!'), k, { size: rnd(14, 22), lifeMs: rnd(520, 980), driftY: -rnd(34, 62) });
      }
    }
  }

  // ---------- expose ----------
  const API = {
    ensureLayer,
    popText,
    scorePop,
    ringPulse,
    burstAt,
    celebrate,
  };

  root.Particles = API;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);