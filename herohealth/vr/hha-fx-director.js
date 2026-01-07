// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (PRODUCTION)
// ✅ Consistent feedback for all games via HHA events
// ✅ Requires: ../vr/particles.js (recommended)
// ✅ Adds vignette + kick + end blink + state flashes
// ✅ Understands judge types: good/bad/perfect/miss/block

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR_ULTRA__) return;
  ROOT.__HHA_FX_DIRECTOR_ULTRA__ = true;

  // ---------- inject minimal CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-22px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
        filter: blur(0.25px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 45%,
          rgba(0,0,0,.28) 72%,
          rgba(0,0,0,.62) 100%);
      }

      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .38; }
      body.fx-miss     .hha-fx-vignette{ opacity: .32; }
      body.fx-perfect  .hha-fx-vignette{ opacity: .22; }

      /* subtle screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 740ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        28%{ filter: brightness(1.14) contrast(1.06); }
        100%{ filter:none; }
      }

      /* micro flash bands (optional vibes) */
      body.fx-flash-good::after,
      body.fx-flash-bad::after{
        content:""; position:fixed; inset:0; pointer-events:none; z-index:9997;
        opacity:.0;
        animation: hhaFlash 220ms ease forwards;
      }
      body.fx-flash-good::after{ background: radial-gradient(circle at 50% 30%, rgba(34,197,94,.22), transparent 55%); }
      body.fx-flash-bad::after { background: radial-gradient(circle at 50% 30%, rgba(239,68,68,.22), transparent 55%); }

      @keyframes hhaFlash{
        0%{ opacity:0; }
        35%{ opacity:1; }
        100%{ opacity:0; }
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
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toString().toLowerCase();

    if (t.includes('perfect')) return 'perfect';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('oops')) return 'bad';
    if (t.includes('good') || t.includes('correct') || t.includes('hit')) return 'good';

    return 'good';
  }

  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }

  function fxBurstKind(x,y,kind){
    const p = P();
    if (p?.burstAt) p.burstAt(x,y,kind);
    else if (p?.burst) p.burst(x,y,{r: (kind==='bad'?64:56)});
  }

  function fxShock(x,y,r){
    const p = P();
    if (p?.shockwave) p.shockwave(x,y,{r});
    else fxBurstKind(x,y,'good');
  }

  function fxPop(x,y,text,cls){
    const p = P();
    if (p?.popText) p.popText(x,y,text,cls);
  }

  function fxScore(x,y,val){
    const p = P();
    if (p?.scorePop) p.scorePop(x,y,val);
    else fxPop(x,y,val, (String(val).startsWith('+') ? 'big' : ''));
  }

  function fxCelebrate(){
    const p = P();
    if (p?.celebrate) p.celebrate();
    else{
      for(let i=0;i<8;i++){
        setTimeout(()=>fxBurstKind(innerWidth/2 + (Math.random()*2-1)*160, innerHeight*0.35 + (Math.random()*2-1)*90, 'star'), i*45);
      }
    }
  }

  // ---------- event listeners ----------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 170);
      addBodyCls('fx-flash-good', 220);
      addBodyCls('fx-kick', 110);
      fxShock(x,y, 60);
      fxBurstKind(x,y,'good');

      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurstKind(x,y,'star');

    } else if (t === 'perfect'){
      addBodyCls('fx-perfect', 200);
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-flash-good', 240);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 78);
      fxBurstKind(x,y,'diamond');
      fxPop(x,y, 'PERFECT!', 'perfect');

    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 230);
      addBodyCls('fx-flash-bad', 240);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 70);
      fxBurstKind(x,y,'bad');

    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxBurstKind(x,y,'bad');
      fxPop(x,y,'MISS','bad');

    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 150);
      addBodyCls('fx-kick', 110);
      fxShock(x,y, 62);
      fxBurstKind(x,y,'block');
      fxPop(x,y,'BLOCK','block');
    }
  });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);

    const sc =
      (d.delta != null ? Number(d.delta) :
      d.add != null ? Number(d.add) :
      d.value != null ? Number(d.value) :
      d.score != null ? Number(d.score) : null);

    if (Number.isFinite(sc) && sc !== 0){
      fxScore(x, y, (sc>0?`+${sc}`:`${sc}`));
    }
  });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 250);
    fxShock(x,y, 74);
    fxBurstKind(x,y,'bad');
  });

  DOC.addEventListener('hha:celebrate', ()=>{
    fxCelebrate();
  });

  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 780);
    setTimeout(()=>fxCelebrate(), 220);
  });

  // dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'block', x:x+40, y:y+40 } })), 360);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 560);
  };

})();