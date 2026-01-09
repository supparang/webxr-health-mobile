// === /herohealth/vr/particles.js ===
// HHA Particles — UNIFIED (ULTRA)
// ✅ Creates .hha-fx-layer
// ✅ API:
//    - popText(x,y,text,cls?)
//    - scorePop(x,y,text,cls?)
//    - burstAt(x,y,kind?)
//    - celebrate(kind?)
// ✅ Safe + lightweight, no deps

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_PARTICLES__) return;
  root.__HHA_PARTICLES__ = true;

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
  function rnd(a,b){ return a + Math.random()*(b-a); }

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:120',
      'overflow:hidden','contain:layout paint style'
    ].join(';');
    DOC.body.appendChild(layer);
    return layer;
  }

  function addStyle(){
    if(DOC.getElementById('hhaParticlesStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'hhaParticlesStyle';
    st.textContent = `
      @keyframes hhaPop {
        0% { transform:translate(-50%,-50%) scale(.88); opacity:.92; filter:blur(0px); }
        60%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-98%) scale(1.05); opacity:0; filter:blur(.2px); }
      }
      @keyframes hhaBurst {
        0% { transform:translate(-50%,-50%) scale(.7); opacity:.92; }
        45%{ transform:translate(-50%,-50%) scale(1.05); opacity:1; }
        100%{ transform:translate(-50%,-50%) scale(1.35); opacity:0; }
      }
      @keyframes hhaConfetti {
        0% { transform:translate3d(0,0,0) rotate(0deg); opacity:1; }
        100% { transform:translate3d(var(--dx), var(--dy), 0) rotate(var(--dr)); opacity:0; }
      }
      .hha-pop {
        position:absolute;
        transform:translate(-50%,-50%);
        font: 1000 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 24px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity;
        animation: hhaPop 520ms ease-out forwards;
        padding:6px 10px;
        border-radius: 999px;
        background: rgba(2,6,23,.25);
        border: 1px solid rgba(148,163,184,.18);
        backdrop-filter: blur(6px);
      }
      .hha-pop.hha-score { font-size: 20px; }
      .hha-pop.hha-judge { font-size: 18px; letter-spacing:.4px; }
      .hha-pop.hha-grade { font-size: 26px; padding:10px 14px; }

      .hha-burst {
        position:absolute;
        transform:translate(-50%,-50%);
        width: 76px; height: 76px;
        border-radius: 999px;
        opacity:.9;
        will-change: transform, opacity;
        animation: hhaBurst 460ms ease-out forwards;
        border: 2px solid rgba(255,255,255,.65);
        box-shadow: 0 10px 26px rgba(0,0,0,.35);
      }
      .hha-burst.good { background: rgba(34,197,94,.18); border-color: rgba(34,197,94,.85); }
      .hha-burst.bad  { background: rgba(239,68,68,.16); border-color: rgba(239,68,68,.85); }
      .hha-burst.star { background: rgba(250,204,21,.14); border-color: rgba(250,204,21,.85); }
      .hha-burst.shield { background: rgba(56,189,248,.14); border-color: rgba(56,189,248,.85); }
      .hha-burst.diamond{ background: rgba(167,139,250,.14); border-color: rgba(167,139,250,.85); }
      .hha-burst.block { background: rgba(148,163,184,.16); border-color: rgba(148,163,184,.9); }

      .hha-confetti {
        position:absolute;
        width:10px; height:10px;
        border-radius: 4px;
        opacity: 1;
        will-change: transform, opacity;
        animation: hhaConfetti 900ms ease-out forwards;
        box-shadow: 0 10px 18px rgba(0,0,0,.25);
      }

      body.hha-judge-pulse .hha-fx-layer { filter: saturate(1.03) contrast(1.03); }
      body.hha-celebrate { animation: hhaCelebrShake 520ms ease; }
      @keyframes hhaCelebrShake{
        0%{ transform: translate3d(0,0,0); }
        20%{ transform: translate3d(1px,-1px,0); }
        40%{ transform: translate3d(-1px,1px,0); }
        60%{ transform: translate3d(1px,1px,0); }
        80%{ transform: translate3d(-1px,-1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }
      body.hha-shake { animation: hhaCelebrShake 220ms ease; }
    `;
    DOC.head.appendChild(st);
  }

  addStyle();

  function popText(x,y,text,cls){
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-pop' + (cls ? (' ' + cls) : '');
    el.textContent = String(text ?? '');
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 680);
  }

  function scorePop(x,y,text,cls){
    popText(x,y,text, (cls ? (cls + ' hha-score') : 'hha-score'));
  }

  function burstAt(x,y,kind){
    const layer = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'hha-burst ' + String(kind||'good');
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    layer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 520);
  }

  function celebrate(kind){
    const layer = ensureLayer();
    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    const n = (kind === 'end') ? 26 : 18;
    for(let i=0;i<n;i++){
      const c = DOC.createElement('div');
      c.className = 'hha-confetti';

      const x = rnd(W*0.15, W*0.85);
      const y = rnd(H*0.12, H*0.35);

      c.style.left = Math.round(x) + 'px';
      c.style.top  = Math.round(y) + 'px';

      const dx = rnd(-140, 140) + 'px';
      const dy = rnd(160, 380) + 'px';
      const dr = rnd(-280, 280) + 'deg';
      c.style.setProperty('--dx', dx);
      c.style.setProperty('--dy', dy);
      c.style.setProperty('--dr', dr);

      // random color via HSL (no fixed palette)
      const hue = Math.floor(rnd(0, 360));
      c.style.background = `hsla(${hue}, 95%, 62%, .95)`;

      layer.appendChild(c);
      setTimeout(()=>{ try{ c.remove(); }catch(_){ } }, 980);
    }
  }

  // Expose unified API
  root.Particles = root.Particles || {};
  root.Particles.popText = popText;
  root.Particles.scorePop = scorePop;
  root.Particles.burstAt = burstAt;
  root.Particles.celebrate = celebrate;

  // Also expose to GAME_MODULES convention
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = root.Particles;

})(window);