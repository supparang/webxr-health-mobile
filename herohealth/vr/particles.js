// === /herohealth/vr/particles.js ===
// HHA Particles — PRODUCTION FX PACK (safe, no deps)
// Provides: popText, burst, shockwave, celebrate, scorePop, burstAt

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function ensureLayer(){
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden;';
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------- CSS ----------
  (function inject(){
    if (doc.getElementById('hha-particles-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-particles-style';
    st.textContent = `
      .hha-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.60);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 520ms ease-out forwards;
      }
      .hha-pop.big{ font-size:22px; }
      .hha-pop.perfect{ font-size:24px; letter-spacing:.5px; }

      @keyframes hhaPop{
        0%{ transform:translate(-50%,-50%) scale(.9); opacity:.95; }
        70%{ transform:translate(-50%,-78%) scale(1.22); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.05); opacity:0; }
      }

      .hha-p{
        position:absolute;
        width:10px; height:10px;
        border-radius:999px;
        background: rgba(255,255,255,.92);
        transform: translate(-50%,-50%);
        will-change: transform, opacity;
        animation: hhaP 520ms ease-out forwards;
        opacity:.95;
        filter: drop-shadow(0 10px 26px rgba(0,0,0,.45));
      }
      @keyframes hhaP{
        0%{ opacity:.95; transform: translate(-50%,-50%) scale(.9); }
        85%{ opacity:.85; }
        100%{ opacity:0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.35); }
      }

      .hha-wave{
        position:absolute;
        width:12px; height:12px;
        border-radius:999px;
        border: 3px solid rgba(255,255,255,.60);
        transform: translate(-50%,-50%) scale(.2);
        opacity:.95;
        animation: hhaWave 520ms ease-out forwards;
        filter: drop-shadow(0 12px 30px rgba(0,0,0,.45));
      }
      @keyframes hhaWave{
        0%{ opacity:.9; transform: translate(-50%,-50%) scale(.25); }
        100%{ opacity:0; transform: translate(-50%,-50%) scale(6.5); }
      }
    `;
    doc.head.appendChild(st);
  })();

  // ---------- helpers ----------
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function rand(a,b){ return a + (b-a) * Math.random(); }

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-pop' + (cls ? (' ' + cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 650);
  }

  function burst(x,y,opts){
    const layer = ensureLayer();
    const r = clamp(opts?.r ?? 44, 18, 110);
    const n = clamp(opts?.n ?? Math.round(r/5), 8, 24);

    for(let i=0;i<n;i++){
      const p = doc.createElement('div');
      p.className = 'hha-p';
      const ang = rand(0, Math.PI*2);
      const dist = rand(r*0.55, r*1.35);
      const dx = Math.cos(ang)*dist;
      const dy = Math.sin(ang)*dist;

      p.style.left = x + 'px';
      p.style.top  = y + 'px';
      p.style.setProperty('--dx', dx.toFixed(1)+'px');
      p.style.setProperty('--dy', dy.toFixed(1)+'px');

      // tiny variation
      const s = rand(6, 12);
      p.style.width = s+'px';
      p.style.height= s+'px';

      layer.appendChild(p);
      setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 650);
    }
  }

  function shockwave(x,y,opts){
    const layer = ensureLayer();
    const w = doc.createElement('div');
    w.className = 'hha-wave';
    w.style.left = x + 'px';
    w.style.top  = y + 'px';
    layer.appendChild(w);
    setTimeout(()=>{ try{ w.remove(); }catch(_){ } }, 650);

    // also burst lightly
    burst(x,y,{ r: clamp(opts?.r ?? 62, 24, 120), n: 10 });
  }

  function celebrate(){
    const cx = innerWidth/2, cy = innerHeight*0.33;
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        burst(cx + rand(-180,180), cy + rand(-90,90), { r: rand(30,70), n: rand(10,22) });
      }, i*55);
    }
  }

  function scorePop(x,y,text){
    // alias for popText but bigger for scores
    const t = String(text ?? '');
    popText(x,y,t, (t.includes('PERFECT') ? 'perfect' : (Math.abs(Number(t))>=50 ? 'big' : '')));
  }

  function burstAt(x,y,kind){
    // kind can be good/bad/star/shield/diamond/block
    const r =
      (kind==='perfect') ? 78 :
      (kind==='bad' || kind==='junk') ? 66 :
      (kind==='shield' || kind==='block') ? 56 :
      (kind==='diamond') ? 74 :
      (kind==='star') ? 60 : 56;
    burst(x,y,{ r });
  }

  root.Particles = root.Particles || {};
  root.Particles.popText   = popText;
  root.Particles.burst     = burst;
  root.Particles.shockwave = shockwave;
  root.Particles.celebrate = celebrate;
  root.Particles.scorePop  = scorePop;
  root.Particles.burstAt   = burstAt;

  // optional namespace
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);