// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION (Core FX for all games)
// Provides: popText, scorePop, burst, shockwave, burstAt, celebrate
// Safe: no deps, minimal DOM, mobile-friendly

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  // ---------- layer ----------
  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9997;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- style ----------
  (function injectStyle(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.6);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-fx-pop.big{ font-size:22px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.55)); }
      .hha-fx-pop.perfect{ font-size:24px; letter-spacing:.5px; }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.92); opacity:.92; }
        70%{ transform:translate(-50%,-75%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.05); opacity:0; }
      }

      .hha-fx-dot{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        opacity:.95;
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaDot 520ms cubic-bezier(.2,.9,.2,1) forwards;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      }
      @keyframes hhaDot{
        0%{ opacity:.95; transform: translate(-50%,-50%) scale(.9); }
        85%{ opacity:.9; }
        100%{ opacity:0; transform: translate(var(--tx), var(--ty)) scale(.55); }
      }

      .hha-fx-wave{
        position:absolute;
        width:16px; height:16px;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.85);
        transform: translate(-50%,-50%) scale(.4);
        opacity:.85;
        will-change: transform, opacity;
        animation: hhaWave 520ms ease-out forwards;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      }
      @keyframes hhaWave{
        0%{ opacity:.85; transform: translate(-50%,-50%) scale(.35); }
        80%{ opacity:.7; }
        100%{ opacity:0; transform: translate(-50%,-50%) scale(3.6); }
      }

      .hha-fx-confetti{
        position:absolute;
        width:10px; height:10px;
        border-radius:4px;
        opacity:.95;
        transform: translate(-50%,-50%);
        animation: hhaConfetti 900ms cubic-bezier(.15,.8,.2,1) forwards;
        will-change: transform, opacity;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
      }
      @keyframes hhaConfetti{
        0%{ opacity:.95; transform: translate(-50%,-50%) rotate(0deg) scale(.9); }
        70%{ opacity:.9; }
        100%{ opacity:0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(.75); }
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- helpers ----------
  function clamp(v,min,max){ return v<min?min:(v>max?max:v); }
  function rnd(a,b){ return a + (b-a)*Math.random(); }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-fx-pop' + (cls?(' '+cls):'');
    el.textContent = String(text ?? '');
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function scorePop(x,y,text){
    const t = String(text ?? '');
    const big = (t.includes('+') && Number(t.replace('+','')) >= 20) || t.includes('PERFECT');
    popText(x,y,t, big ? 'big' : 'score');
  }

  function burst(x,y,opts={}){
    const layer = ensureLayer();
    const r = clamp(Number(opts.r ?? 46), 18, 110);
    const n = clamp(Number(opts.n ?? 10), 6, 18);

    for(let i=0;i<n;i++){
      const d = doc.createElement('div');
      d.className = 'hha-fx-dot';
      d.style.left = `${x}px`;
      d.style.top  = `${y}px`;

      const ang = rnd(0, Math.PI*2);
      const dist = rnd(r*0.55, r*1.15);
      const tx = x + Math.cos(ang)*dist;
      const ty = y + Math.sin(ang)*dist;

      d.style.setProperty('--tx', `${tx - x - 50}px`); // because transform baseline uses -50%
      d.style.setProperty('--ty', `${ty - y - 50}px`);

      // subtle variation (no hard-coded palette; still looks good)
      d.style.background = `rgba(255,255,255,${rnd(.65,.95)})`;
      d.style.width = `${rnd(7,12)}px`;
      d.style.height = d.style.width;

      layer.appendChild(d);
      setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 650);
    }
  }

  function shockwave(x,y,opts={}){
    const layer = ensureLayer();
    const w = doc.createElement('div');
    w.className = 'hha-fx-wave';
    w.style.left = `${x}px`;
    w.style.top  = `${y}px`;
    layer.appendChild(w);
    setTimeout(()=>{ try{ w.remove(); }catch(_){ } }, 650);

    // also add burst for impact
    burst(x,y,{ r: Number(opts.r ?? 56), n: Number(opts.n ?? 10) });
  }

  function burstAt(x,y,kind='good'){
    // kind reserved for future (game signature can override)
    // keep core consistent
    if(kind === 'bad') shockwave(x,y,{ r: 64, n: 12 });
    else if(kind === 'block') burst(x,y,{ r: 44, n: 10 });
    else if(kind === 'star') shockwave(x,y,{ r: 72, n: 12 });
    else if(kind === 'diamond') shockwave(x,y,{ r: 84, n: 14 });
    else burst(x,y,{ r: 54, n: 11 });
  }

  function celebrate(){
    const layer = ensureLayer();
    const cx = innerWidth/2;
    const cy = innerHeight*0.28;

    const count = 24;
    for(let i=0;i<count;i++){
      const c = doc.createElement('div');
      c.className = 'hha-fx-confetti';
      c.style.left = `${cx}px`;
      c.style.top  = `${cy}px`;

      const ang = rnd(-Math.PI, 0);
      const dist = rnd(140, 320);
      const tx = cx + Math.cos(ang)*dist + rnd(-60,60);
      const ty = cy + Math.sin(ang)*dist + rnd(40,180);

      c.style.setProperty('--tx', `${tx - cx - 50}px`);
      c.style.setProperty('--ty', `${ty - cy - 50}px`);
      c.style.setProperty('--rot', `${rnd(-540,540)}deg`);

      c.style.background = `rgba(255,255,255,${rnd(.6,.95)})`;

      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){ } }, 980);
    }

    // extra pop
    popText(cx, cy + 14, '🎉', 'big');
  }

  // expose
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burst = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.burstAt = burstAt;
  root.Particles.celebrate = celebrate;

  // keep compatibility for root.GAME_MODULES.Particles
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;
})(window);