// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (V2)
// ✅ Works with particles.js V2
// ✅ judge/score/miss/end/celebrate consistent across all games
// ✅ Adds vignette + kick + endblink

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR_V2__) return;
  ROOT.__HHA_FX_DIRECTOR_V2__ = true;

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
        background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 44%, rgba(0,0,0,.34) 76%, rgba(0,0,0,.62) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .40; }
      body.fx-miss     .hha-fx-vignette{ opacity: .36; }

      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
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
  function pickXY(d){
    d = d || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(d){
    const t = String(d?.type || d?.kind || d?.result || d?.judge || d?.hitType || d?.label || '').toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct')) return 'good';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    return t || 'good';
  }

  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }

  function burst(x,y,r){ try{ P()?.burst?.(x,y,{r}); }catch(_){ } }
  function shock(x,y,r){ try{ P()?.shockwave?.(x,y,{r}); }catch(_){ burst(x,y,r); } }
  function pop(x,y,text,cls){ try{ P()?.popText?.(x,y,text,cls); }catch(_){ } }
  function celebrate(){ try{ P()?.celebrate?.(); }catch(_){ } }

  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      shock(x,y, 56);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 6) burst(x,y, 40);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 220);
      addBodyCls('fx-kick', 120);
      shock(x,y, 72);
      pop(x,y,'PERFECT!','perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      shock(x,y, 66);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 220);
      burst(x,y, 62);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      burst(x,y, 44);
      pop(x,y,'BLOCK','big');
    } else {
      addBodyCls('fx-hit-good', 140);
      burst(x,y, 48);
    }
  });

  // IMPORTANT: expects delta for score pop
  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const delta = Number(d.delta ?? d.add ?? d.value ?? d.scoreDelta ?? 0);
    if (!Number.isFinite(delta) || delta === 0) return;
    const text = (delta>0?`+${delta}`:`${delta}`);
    pop(x,y,text, Math.abs(delta)>=40 ? 'big' : 'score');
  });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    shock(x,y, 70);
  });

  DOC.addEventListener('hha:celebrate', ()=> celebrate());

  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>celebrate(), 220);
  });

  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:7 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+90, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 520);
  };
})();