// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (shared)
// Requires: ../vr/particles.js (recommended)

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR_ULTRA__) return;
  ROOT.__HHA_FX_DIRECTOR_ULTRA__ = true;

  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-22px; pointer-events:none; z-index:9996;
        opacity:0; transition: opacity 140ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 42%,
          rgba(0,0,0,.28) 72%,
          rgba(0,0,0,.62) 100%);
      }

      body.fx-hit-good .hha-fx-vignette{ opacity:.18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity:.34; }
      body.fx-miss     .hha-fx-vignette{ opacity:.30; }

      /* screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        45%{ transform: translate3d(1px,-1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 720ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.16) contrast(1.06) saturate(1.1); }
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
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct')) return 'good';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong')) return 'bad';
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
        setTimeout(()=>fxShock(innerWidth/2 + (Math.random()*2-1)*180, innerHeight*0.33 + (Math.random()*2-1)*90, 48 + Math.random()*55), i*55);
      }
    }
  }

  function onJudge(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);
    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 170);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 58);
      if (combo >= 5) fxBurst(x,y, 38);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 210);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 74);
      fxPop(x,y,'PERFECT!','perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 66);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 230);
      fxBurst(x,y, 64);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
      fxPop(x,y,'BLOCK','big');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  }

  function onScore(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const delta = Number(d.delta ?? d.add ?? d.value ?? d.scoreDelta ?? 0);
    if (!Number.isFinite(delta) || delta === 0) return;
    fxPop(x,y, (delta>0?`+${delta}`:`${delta}`), Math.abs(delta)>=35 ? 'big' : 'score');
  }

  function onMiss(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    fxShock(x,y, 68);
    fxPop(x,y,'MISS','big');
  }

  // listen BOTH document + window (robust)
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:score', onScore, { passive:true });
  DOC.addEventListener('hha:miss',  onMiss,  { passive:true });
  DOC.addEventListener('hha:celebrate', ()=>fxCelebrate(), { passive:true });
  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  }, { passive:true });

  ROOT.addEventListener('hha:judge', onJudge, { passive:true });
  ROOT.addEventListener('hha:score', onScore, { passive:true });
  ROOT.addEventListener('hha:miss',  onMiss,  { passive:true });
  ROOT.addEventListener('hha:celebrate', ()=>fxCelebrate(), { passive:true });
  ROOT.addEventListener('hha:end', ()=>{
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