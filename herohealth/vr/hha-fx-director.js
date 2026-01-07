// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (ULTRA)
// ✅ Works across all games
// ✅ Listens: hha:judge, hha:score, hha:miss, hha:celebrate, hha:end
// ✅ Uses Particles if present (../vr/particles.js recommended)
// ✅ Adds: vignette + kick + endblink + stage pulses

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR_ULTRA__) return;
  ROOT.__HHA_FX_DIRECTOR_ULTRA__ = true;

  // ---------- CSS + vignette ----------
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
        background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.34) 75%, rgba(0,0,0,.62) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .38; }
      body.fx-miss     .hha-fx-vignette{ opacity: .34; }
      body.fx-rage     .hha-fx-vignette{ opacity: .44; }

      /* kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.16) contrast(1.06); }
        100%{ filter:none; }
      }

      /* rage pulse */
      body.fx-ragepulse{ animation: hhaRagePulse 240ms ease; }
      @keyframes hhaRagePulse{
        0%{ filter:none; }
        45%{ filter: saturate(1.08) contrast(1.05); }
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
    if (t.includes('decoy')) return 'decoy';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('oops')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('rage')) return 'rage';
    if (t.includes('good') || t.includes('correct')) return 'good';
    return t || 'good';
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }
  function fxBurst(x,y,r){
    const P = particles();
    if (P?.burst) P.burst(x,y,{r});
    else if (P?.burstAt) P.burstAt(x,y,'good');
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

  function onJudge(e){
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
      fxShock(x,y, 76);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if (t === 'decoy'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 66);
      fxPop(x,y, 'DECOY!', 'big');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 64);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxShock(x,y, 72);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 150);
      fxBurst(x,y, 44);
      fxPop(x,y,'BLOCK','score');
    } else if (t === 'rage'){
      addBodyCls('fx-rage', 260);
      addBodyCls('fx-ragepulse', 240);
      fxShock(x,y, 78);
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  }

  function onScore(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'score');
    }
  }

  function onMiss(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 260);
    fxShock(x,y, 72);
  }

  function onEnd(){
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  }

  // Listen on BOTH window+document (กันเกมยิงคนละที่)
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  ROOT.addEventListener('hha:judge', onJudge, { passive:true });

  DOC.addEventListener('hha:score', onScore, { passive:true });
  ROOT.addEventListener('hha:score', onScore, { passive:true });

  DOC.addEventListener('hha:miss', onMiss, { passive:true });
  ROOT.addEventListener('hha:miss', onMiss, { passive:true });

  DOC.addEventListener('hha:celebrate', ()=>fxCelebrate(), { passive:true });
  ROOT.addEventListener('hha:celebrate', ()=>fxCelebrate(), { passive:true });

  DOC.addEventListener('hha:end', onEnd, { passive:true });
  ROOT.addEventListener('hha:end', onEnd, { passive:true });

  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ score:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'decoy', x:x-60, y:y+10 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'miss', x:x+40, y:y+30 } })), 380);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 620);
  };
})();