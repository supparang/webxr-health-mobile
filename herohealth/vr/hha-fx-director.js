// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (Storm/Boss/Rage)
// Requires: ../vr/particles.js (recommended)

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------- inject minimal CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-20px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.32) 74%, rgba(0,0,0,.60) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .40; }
      body.fx-miss     .hha-fx-vignette{ opacity: .34; }

      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.8px,-0.8px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.15) contrast(1.06); }
        100%{ filter:none; }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setBodyFlag(c, on){
    try{
      DOC.body.classList.toggle(c, !!on);
    }catch(_){}
  }
  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct')) return 'good';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('boss')) return 'boss';
    if (t.includes('rage')) return 'rage';
    return t || 'good';
  }

  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }
  function fxBurst(x,y,r){ const p=P(); if(p?.burst) p.burst(x,y,{r}); }
  function fxShock(x,y,r){ const p=P(); if(p?.shockwave) p.shockwave(x,y,{r}); else fxBurst(x,y,r); }
  function fxPop(x,y,text,cls){ const p=P(); if(p?.popText) p.popText(x,y,text,cls); }
  function fxCelebrate(){ const p=P(); if(p?.celebrate) p.celebrate(); else fxBurst(innerWidth/2, innerHeight*0.35, 70); }

  // ---------- core listeners ----------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 56);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurst(x,y, 36);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 76);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 64);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 220);
      fxBurst(x,y, 58);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
      fxPop(x,y, 'BLOCK', 'big');
    } else if (t === 'boss'){
      addBodyCls('fx-hit-bad', 260);
      fxShock(x,y, 86);
      fxPop(x,y, 'BOSS!', 'big');
    } else if (t === 'rage'){
      addBodyCls('fx-hit-bad', 280);
      fxShock(x,y, 96);
      fxPop(x,y, 'RAGE!', 'big');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.delta ?? d.add ?? d.value ?? d.score ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), Math.abs(sc)>=50?'big':'');
    }
  });

  DOC.addEventListener('hha:celebrate', ()=> fxCelebrate());
  DOC.addEventListener('hha:end', ()=>{ addBodyCls('fx-endblink', 760); setTimeout(()=>fxCelebrate(), 220); });

  // intensity flags -> body classes (CSS can react)
  DOC.addEventListener('hha:storm', (e)=> setBodyFlag('fx-storm', true));
  DOC.addEventListener('hha:storm-end', (e)=> setBodyFlag('fx-storm', false));

  DOC.addEventListener('hha:boss', (e)=> setBodyFlag('fx-boss', true));
  DOC.addEventListener('hha:boss-end', (e)=> setBodyFlag('fx-boss', false));

  DOC.addEventListener('hha:rage', (e)=> setBodyFlag('fx-rage', true));
  DOC.addEventListener('hha:rage-end', (e)=> setBodyFlag('fx-rage', false));

  // dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:storm',{ detail:{ on:true } })), 320);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:boss',{ detail:{ on:true } })), 380);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:rage',{ detail:{ on:true } })), 440);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 620);
  };

})();