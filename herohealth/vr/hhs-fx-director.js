// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (V2)
// ✅ Consistent FX across games
// ✅ Uses Particles if available (popText/burst/shockwave/celebrate)
// ✅ Adds minimal CSS + vignette + kick + endblink

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR_V2__) return;
  ROOT.__HHA_FX_DIRECTOR_V2__ = true;

  (function injectCss(){
    const id = 'hha-fx-director-style';
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-20px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.32) 74%, rgba(0,0,0,.58) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .34; }
      body.fx-miss     .hha-fx-vignette{ opacity: .30; }

      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        45%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.15) contrast(1.05); }
        100%{ filter:none; }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }

  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }
  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if(x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }
  function fxBurst(x,y,r){ const P = particles(); if(P?.burst) P.burst(x,y,{r}); }
  function fxShock(x,y,r){ const P = particles(); if(P?.shockwave) P.shockwave(x,y,{r}); else fxBurst(x,y,r); }
  function fxPop(x,y,text,cls){ const P = particles(); if(P?.popText) P.popText(x,y,text,cls); }
  function fxCelebrate(){ const P = particles(); if(P?.celebrate) P.celebrate(); }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toString().toLowerCase();
    if(t.includes('perfect')) return 'perfect';
    if(t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if(t.includes('miss') || t.includes('expire')) return 'miss';
    if(t.includes('bad') || t.includes('junk') || t.includes('oops')) return 'bad';
    return 'good';
  }

  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);
    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if(t === 'good'){
      addBodyCls('fx-hit-good', 160);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 56);
      if(combo >= 5) fxBurst(x,y, 34);
    } else if(t === 'perfect'){
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 72);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if(t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 44);
      fxPop(x,y, 'BLOCK', 'block');
    } else if(t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 64);
    } else { // miss
      addBodyCls('fx-miss', 220);
      fxShock(x,y, 66);
    }
  }, { passive:true });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const v = Number(d.delta ?? d.add ?? d.value ?? 0);
    if(Number.isFinite(v) && v !== 0){
      fxPop(x, y, (v>0?`+${v}`:`${v}`), Math.abs(v)>=50?'big':'score');
    }
  }, { passive:true });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    fxShock(x,y, 66);
  }, { passive:true });

  DOC.addEventListener('hha:celebrate', ()=> fxCelebrate(), { passive:true });

  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  }, { passive:true });

  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 520);
  };
})();