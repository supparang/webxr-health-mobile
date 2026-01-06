// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION
// Listens to HHA events and triggers visual feedback consistently across all games.
// Requires: ../vr/particles.js (optional but recommended)

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------- inject CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-24px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 44%,
          rgba(0,0,0,.34) 74%,
          rgba(0,0,0,.62) 100%);
      }

      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .42; }
      body.fx-miss     .hha-fx-vignette{ opacity: .36; }

      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(1.1px,-1.1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      body.fx-shake{ animation: hhaShake 180ms ease; }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0); }
        20%{ transform: translate3d(1.2px,0,0); }
        55%{ transform: translate3d(-1.2px,0,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.20) contrast(1.08); }
        100%{ filter:none; }
      }

      /* global modes */
      body.hha-storm{
        animation: hhaStormGlow 1.25s ease-in-out infinite;
      }
      @keyframes hhaStormGlow{
        0%,100%{ filter:none; }
        50%{ filter: contrast(1.06) brightness(1.06); }
      }

      body.hha-boss{
        animation: hhaBossPulse 980ms ease-in-out infinite;
      }
      @keyframes hhaBossPulse{
        0%,100%{ filter:none; }
        50%{ filter: contrast(1.08) brightness(1.03); }
      }

      body.hha-rage{
        animation: hhaRage 520ms ease-in-out infinite;
      }
      @keyframes hhaRage{
        0%,100%{ transform:translate3d(0,0,0); filter: contrast(1.10) brightness(1.04); }
        50%{ transform:translate3d(.9px,-.9px,0); filter: contrast(1.18) brightness(1.06); }
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
    return t || 'good';
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function fxBurst(x,y,r){
    const P = particles();
    if (P?.burst) P.burst(x,y,{r});
  }

  function fxShock(x,y,r){
    const P = particles();
    if (P?.shockwave) P.shockwave(x,y,{r});
    else fxBurst(x,y,r);
  }

  function fxPop(x,y,text,cls){
    const P = particles();
    if (P?.popText) P.popText(x,y,text,cls);
  }

  function fxCelebrate(){
    const P = particles();
    if (P?.celebrate) P.celebrate();
    else{
      for(let i=0;i<8;i++){
        setTimeout(()=>fxBurst(innerWidth/2 + (Math.random()*2-1)*160, innerHeight*0.35 + (Math.random()*2-1)*90, 22 + Math.random()*40), i*45);
      }
    }
  }

  // judge
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 56);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurst(x,y, 34);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 72);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-shake', 180);
      fxShock(x,y, 64);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 220);
      addBodyCls('fx-shake', 180);
      fxBurst(x,y, 58);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 44);
      fxPop(x,y, 'BLOCK', 'big');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  });

  // score
  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'score');
    }
  });

  // celebrate/end
  DOC.addEventListener('hha:celebrate', ()=> fxCelebrate());
  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  });

  // modes
  DOC.addEventListener('hha:storm', ()=> DOC.body.classList.add('hha-storm'));
  DOC.addEventListener('hha:boss',  ()=> DOC.body.classList.add('hha-boss'));
  DOC.addEventListener('hha:rage',  ()=> DOC.body.classList.add('hha-rage'));

  DOC.addEventListener('hha:mode-clear', ()=>{
    DOC.body.classList.remove('hha-storm','hha-boss','hha-rage');
  });

})();