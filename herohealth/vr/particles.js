// === /herohealth/vr/particles.js ===
// HHA Particles — ULTRA FX Layer (PRODUCTION)
// ✅ drop-in: provides window.Particles + window.GAME_MODULES.Particles
// ✅ APIs:
//   - popText(x,y,text, cls?)
//   - scorePop(x,y,text)
//   - burst(x,y,{r?, n?, ttl?})
//   - burstAt(x,y, kind='good'|'bad'|'star'|'shield'|'diamond'|'block')
//   - shockwave(x,y,{r?})
//   - celebrate()
// Notes:
// - No dependencies
// - Safe: if CSS missing, it injects minimal keyframes

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES_ULTRA__) return;
  root.__HHA_PARTICLES_ULTRA__ = true;

  // ---------------- layer ----------------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:90;
      overflow:hidden;
    `;
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------------- css inject ----------------
  (function injectCss(){
    const id = 'hha-particles-style';
    if (doc.getElementById(id)) return;
    const st = doc.createElement('style');
    st.id = id;
    st.textContent = `
      @keyframes hhaPop {
        0%   { transform:translate(-50%,-50%) scale(.9); opacity:.92; filter: blur(0px); }
        60%  { transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100% { transform:translate(-50%,-108%) scale(1.05); opacity:0; filter: blur(.15px); }
      }
      @keyframes hhaBurstDot {
        0%   { transform:translate3d(0,0,0) scale(1); opacity:1; }
        100% { transform:translate3d(var(--dx), var(--dy), 0) scale(.35); opacity:0; }
      }
      @keyframes hhaShock {
        0%   { transform:translate(-50%,-50%) scale(.25); opacity:.0; }
        15%  { opacity:.85; }
        100% { transform:translate(-50%,-50%) scale(1.35); opacity:0; }
      }
      @keyframes hhaConfetti {
        0%   { transform:translate3d(var(--x0), var(--y0),0) rotate(0deg); opacity:1; }
        100% { transform:translate3d(var(--x1), var(--y1),0) rotate(var(--rot)); opacity:0; }
      }

      .hha-pop {
        position:absolute; transform:translate(-50%,-50%);
        font: 1000 16px/1 system-ui;
        color:#fff; text-shadow:0 10px 26px rgba(0,0,0,.62);
        animation: hhaPop 560ms ease-out forwards;
        will-change: transform, opacity;
        letter-spacing:.2px;
      }
      .hha-pop.big{ font-size: 20px; }
      .hha-pop.perfect{ font-size: 18px; }
      .hha-pop.bad{ opacity:.95; }
      .hha-pop.block{ opacity:.95; }

      .hha-dot{
        position:absolute; width:8px; height:8px; border-radius:999px;
        left:0; top:0; transform:translate3d(0,0,0);
        opacity:1;
        animation: hhaBurstDot var(--ttl, 520ms) cubic-bezier(.12,.78,.22,1) forwards;
        will-change: transform, opacity;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.25));
      }

      .hha-shock{
        position:absolute; left:0; top:0;
        width: 120px; height: 120px; border-radius:999px;
        transform:translate(-50%,-50%) scale(.25);
        border:2px solid rgba(255,255,255,.45);
        box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
        animation: hhaShock 520ms ease-out forwards;
        will-change: transform, opacity;
        pointer-events:none;
      }

      .hha-confetti{
        position:absolute; width:10px; height:6px; border-radius:3px;
        transform:translate3d(var(--x0), var(--y0),0);
        animation: hhaConfetti var(--ttl, 900ms) ease-out forwards;
        will-change: transform, opacity;
        opacity:1;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.18));
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------------- helpers ----------------
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function rnd(a,b){ return a + (b-a)*Math.random(); }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? ` ${cls}` : '');
    el.textContent = String(text ?? '');
    el.style.left = `${Math.floor(x)}px`;
    el.style.top  = `${Math.floor(y)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function scorePop(x,y,text){
    // stylized score pop
    const t = String(text ?? '');
    const cls = (t.includes('+') && t.length >= 2) ? 'big' : '';
    popText(x,y,t, cls);
  }

  function burst(x,y,opt={}){
    const layer = ensureLayer();
    const r = clamp(opt.r ?? 52, 18, 120);
    const n = clamp(opt.n ?? 12, 6, 28);
    const ttl = clamp(opt.ttl ?? 520, 260, 900);

    for(let i=0;i<n;i++){
      const ang = (Math.PI*2) * (i/n) + rnd(-0.22,0.22);
      const dist = rnd(r*0.55, r*1.10);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      const dot = doc.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = `${Math.floor(x)}px`;
      dot.style.top  = `${Math.floor(y)}px`;
      dot.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      dot.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      dot.style.setProperty('--ttl', `${ttl}ms`);

      // neutral color by default
      dot.style.background = 'rgba(255,255,255,.92)';

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, ttl + 80);
    }
  }

  function shockwave(x,y,opt={}){
    const layer = ensureLayer();
    const r = clamp(opt.r ?? 64, 36, 140);
    const el = doc.createElement('div');
    el.className = 'hha-shock';
    el.style.left = `${Math.floor(x)}px`;
    el.style.top  = `${Math.floor(y)}px`;
    el.style.width = `${Math.floor(r*2)}px`;
    el.style.height= `${Math.floor(r*2)}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function burstAt(x,y,kind='good'){
    // kind palette
    const K = String(kind||'good').toLowerCase();
    const layer = ensureLayer();

    // shock first (feels punchy)
    shockwave(x,y,{ r: (K==='perfect'?80: K==='bad'?72: 62) });

    const cfg = {
      good:   { n:14, r:56, ttl:520, c1:'rgba(34,197,94,.95)', c2:'rgba(34,211,238,.92)' },
      bad:    { n:14, r:62, ttl:560, c1:'rgba(239,68,68,.95)', c2:'rgba(245,158,11,.92)' },
      star:   { n:16, r:66, ttl:620, c1:'rgba(250,204,21,.95)', c2:'rgba(255,255,255,.95)' },
      shield: { n:12, r:56, ttl:520, c1:'rgba(56,189,248,.95)', c2:'rgba(167,139,250,.92)' },
      diamond:{ n:18, r:72, ttl:680, c1:'rgba(167,139,250,.95)', c2:'rgba(34,211,238,.92)' },
      block:  { n:12, r:58, ttl:540, c1:'rgba(34,197,94,.85)', c2:'rgba(56,189,248,.85)' }
    }[K] || { n:12, r:56, ttl:520, c1:'rgba(255,255,255,.92)', c2:'rgba(255,255,255,.88)' };

    // spawn colored dots
    const n = cfg.n;
    for(let i=0;i<n;i++){
      const ang = (Math.PI*2) * (i/n) + rnd(-0.18,0.18);
      const dist = rnd(cfg.r*0.55, cfg.r*1.12);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      const dot = doc.createElement('div');
      dot.className = 'hha-dot';
      dot.style.left = `${Math.floor(x)}px`;
      dot.style.top  = `${Math.floor(y)}px`;
      dot.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      dot.style.setProperty('--dy', `${dy.toFixed(1)}px`);
      dot.style.setProperty('--ttl', `${cfg.ttl}ms`);

      // alternate colors
      dot.style.background = (i%2===0) ? cfg.c1 : cfg.c2;
      dot.style.width = `${rnd(7,11).toFixed(1)}px`;
      dot.style.height= `${rnd(7,11).toFixed(1)}px`;

      layer.appendChild(dot);
      setTimeout(()=>{ try{ dot.remove(); }catch(_){ } }, cfg.ttl + 90);
    }
  }

  function celebrate(){
    const layer = ensureLayer();
    const W = innerWidth || doc.documentElement.clientWidth || 360;
    const H = innerHeight|| doc.documentElement.clientHeight|| 640;

    const n = 42;
    for(let i=0;i<n;i++){
      const el = doc.createElement('div');
      el.className = 'hha-confetti';

      const x0 = rnd(W*0.15, W*0.85);
      const y0 = rnd(H*0.08, H*0.22);

      const x1 = x0 + rnd(-220, 220);
      const y1 = y0 + rnd(220, 520);

      el.style.setProperty('--x0', `${x0.toFixed(1)}px`);
      el.style.setProperty('--y0', `${y0.toFixed(1)}px`);
      el.style.setProperty('--x1', `${x1.toFixed(1)}px`);
      el.style.setProperty('--y1', `${y1.toFixed(1)}px`);
      el.style.setProperty('--rot', `${rnd(-540,540).toFixed(1)}deg`);
      el.style.setProperty('--ttl', `${rnd(780, 1050).toFixed(0)}ms`);

      // color variety (no fixed palette dependency)
      const hue = Math.floor(rnd(160, 320));
      el.style.background = `hsla(${hue}, 90%, 62%, .95)`;

      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 1200);
    }
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burst = burst;
  root.Particles.burstAt = burstAt;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);