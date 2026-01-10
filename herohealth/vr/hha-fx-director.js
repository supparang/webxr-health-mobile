// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA
// ✅ Unified FX across games
// ✅ Supports: judge/score/miss/celebrate/end
// ✅ NEW: storm / boss / rage phases (screen + particles)
// Requires: ../vr/particles.js (ULTRA recommended)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR_ULTRA__) return;
  WIN.__HHA_FX_DIRECTOR_ULTRA__ = true;

  // -------------------- CSS INJECTION --------------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* vignette */
      .hha-fx-vignette{
        position:fixed; inset:-24px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
        filter: blur(.3px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background:
          radial-gradient(circle at 50% 50%,
            rgba(0,0,0,0) 44%,
            rgba(0,0,0,.30) 72%,
            rgba(0,0,0,.58) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity:.22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity:.40; }
      body.fx-miss     .hha-fx-vignette{ opacity:.36; }

      /* kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform:translate3d(0,0,0); }
        40%{ transform:translate3d(.9px,-.9px,0); }
        100%{ transform:translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter:brightness(1.18) contrast(1.06); }
        100%{ filter:none; }
      }

      /* storm */
      body.fx-storm{
        animation: hhaStormPulse 900ms ease-in-out infinite;
      }
      @keyframes hhaStormPulse{
        0%{ filter: saturate(1.05) contrast(1.02); }
        50%{ filter: saturate(1.15) contrast(1.08); }
        100%{ filter: saturate(1.05) contrast(1.02); }
      }

      /* boss */
      body.fx-boss{
        box-shadow: inset 0 0 0 9999px rgba(239,68,68,.06);
      }

      /* rage */
      body.fx-rage{
        animation: hhaRageShake 120ms linear infinite;
        filter: saturate(1.25) contrast(1.12);
      }
      @keyframes hhaRageShake{
        0%{ transform:translate3d(0,0,0); }
        25%{ transform:translate3d(1px,-1px,0); }
        50%{ transform:translate3d(-1px,1px,0); }
        75%{ transform:translate3d(1px,1px,0); }
        100%{ transform:translate3d(0,0,0); }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // -------------------- HELPERS --------------------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      if(ms) setTimeout(()=>DOC.body.classList.remove(c), ms);
    }catch(_){}
  }
  function rmBodyCls(c){
    try{ DOC.body.classList.remove(c); }catch(_){}
  }
  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }
  function centerXY(){
    return { x: innerWidth/2, y: innerHeight/2 };
  }
  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x!=null && y!=null) return { x, y };
    return centerXY();
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
  function P(){ return WIN.Particles || WIN.GAME_MODULES?.Particles || null; }

  // -------------------- FX PRIMITIVES --------------------
  function fxBurst(x,y,r){ try{ P()?.burst(x,y,{ r }); }catch(_){} }
  function fxShock(x,y,r){ try{ P()?.shockwave(x,y,{ r }); }catch(_){} }
  function fxPop(x,y,text,cls){ try{ P()?.popText(x,y,text,cls); }catch(_){} }
  function fxCelebrate(){ try{ P()?.celebrate(); }catch(_){} }

  // -------------------- EVENT: JUDGE --------------------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'perfect'){
      addBodyCls('fx-hit-good', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 78);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 56);
      const combo = Number(d.combo || d.comboNow || 0);
      if (combo >= 5) fxBurst(x,y, 36);
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 64);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 220);
      fxBurst(x,y, 60);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 44);
      fxPop(x,y,'BLOCK','big');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  });

  // -------------------- EVENT: SCORE --------------------
  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'');
    }
  });

  // -------------------- EVENT: MISS --------------------
  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    fxShock(x,y, 66);
  });

  // -------------------- EVENT: CELEBRATE --------------------
  DOC.addEventListener('hha:celebrate', ()=>{
    fxCelebrate();
  });

  // -------------------- EVENT: END --------------------
  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
    // clear phase states
    rmBodyCls('fx-storm'); rmBodyCls('fx-boss'); rmBodyCls('fx-rage');
  });

  // -------------------- PHASE EVENTS (NEW) --------------------
  // storm: when time <= 30s (engine emits hha:phase {phase:'storm'})
  DOC.addEventListener('hha:phase', (e)=>{
    const p = (e?.detail?.phase || '').toLowerCase();
    if (p === 'storm'){
      addBodyCls('fx-storm');
      const {x,y}=centerXY();
      fxBurst(x,y, 72);
    }
    if (p === 'boss'){
      addBodyCls('fx-boss');
      const {x,y}=centerXY();
      fxShock(x,y, 90);
      fxPop(x,y,'BOSS','big');
    }
    if (p === 'rage'){
      addBodyCls('fx-rage');
      const {x,y}=centerXY();
      fxShock(x,y, 120);
      fxPop(x,y,'RAGE','big');
    }
    if (p === 'clear'){
      rmBodyCls('fx-storm'); rmBodyCls('fx-boss'); rmBodyCls('fx-rage');
    }
  });

  // -------------------- DEV TEST --------------------
  WIN.HHA_FX_TEST = function(){
    const {x,y}=centerXY();
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'perfect', x, y } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ score:60, x:x+80, y:y-10 } })), 140);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'storm' } })), 420);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'boss' } })), 900);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'rage' } })), 1400);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 2000);
  };
})();