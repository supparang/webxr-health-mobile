// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (BOSS/STORM/RAGE READY)
// Listens to HHA events and triggers visual feedback consistently across all games.
// Optional: ../vr/particles.js (recommended). Safe if missing.

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------- inject minimal CSS (so every game works without extra CSS edits) ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* --- FX overlays --- */
      .hha-fx-vignette{
        position:fixed; inset:-26px; pointer-events:none;
        z-index: 9998;
        opacity:0; transition: opacity 150ms ease;
        filter: blur(0.2px);
        will-change: opacity, filter;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 44%,
          rgba(0,0,0,.30) 74%,
          rgba(0,0,0,.62) 100%);
      }

      .hha-fx-flash{
        position:fixed; inset:0; pointer-events:none;
        z-index: 9999;
        opacity:0;
        background: radial-gradient(circle at 50% 45%,
          rgba(255,255,255,.12) 0%,
          rgba(255,255,255,.08) 25%,
          rgba(0,0,0,0) 65%);
        transition: opacity 120ms ease;
        will-change: opacity;
      }

      .hha-fx-storm{
        position:fixed; inset:0; pointer-events:none;
        z-index: 9997;
        opacity:0;
        background:
          radial-gradient(circle at 60% 40%, rgba(56,189,248,.10) 0%, rgba(2,6,23,0) 55%),
          radial-gradient(circle at 40% 60%, rgba(167,139,250,.08) 0%, rgba(2,6,23,0) 55%),
          linear-gradient(180deg, rgba(2,6,23,.0) 0%, rgba(2,6,23,.35) 100%);
        mix-blend-mode: screen;
        transition: opacity 220ms ease;
        will-change: opacity;
      }

      .hha-fx-rage{
        position:fixed; inset:0; pointer-events:none;
        z-index: 9996;
        opacity:0;
        background:
          radial-gradient(circle at 50% 55%, rgba(239,68,68,.12) 0%, rgba(2,6,23,0) 55%),
          radial-gradient(circle at 50% 50%, rgba(239,68,68,.08) 0%, rgba(2,6,23,0) 70%);
        mix-blend-mode: screen;
        transition: opacity 200ms ease;
        will-change: opacity;
      }

      /* --- body classes driven by events --- */
      body.fx-hit-good .hha-fx-vignette{ opacity:.18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity:.36; }
      body.fx-miss     .hha-fx-vignette{ opacity:.32; }

      body.fx-storm .hha-fx-storm{ opacity: 1; }
      body.fx-rage  .hha-fx-rage { opacity: 1; }
      body.fx-boss  .hha-fx-vignette{ opacity: .48; filter: blur(0.35px) contrast(1.06); }

      /* subtle screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* heavy kick */
      body.fx-heavykick{ animation: hhaHeavyKick 160ms ease; }
      @keyframes hhaHeavyKick{
        0%{ transform: translate3d(0,0,0) scale(1); }
        25%{ transform: translate3d(1.4px,-1.1px,0) scale(1.004); }
        60%{ transform: translate3d(-1.2px,1.0px,0) scale(1.002); }
        100%{ transform: translate3d(0,0,0) scale(1); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 720ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        24%{ filter: brightness(1.16) contrast(1.07) saturate(1.05); }
        100%{ filter:none; }
      }

      /* storm shake */
      body.fx-stormshake{ animation: hhaStormShake 220ms ease; }
      @keyframes hhaStormShake{
        0%{ transform: translate3d(0,0,0); }
        20%{ transform: translate3d(1.6px,-1.0px,0); }
        55%{ transform: translate3d(-1.2px,1.2px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* rage heartbeat */
      body.fx-ragebeat{ animation: hhaRageBeat 420ms ease; }
      @keyframes hhaRageBeat{
        0%{ transform: translate3d(0,0,0) scale(1); }
        20%{ transform: translate3d(0.6px,-0.4px,0) scale(1.006); }
        45%{ transform: translate3d(-0.6px,0.5px,0) scale(1.002); }
        100%{ transform: translate3d(0,0,0) scale(1); }
      }

      /* lightning flash */
      body.fx-lightning .hha-fx-flash{ opacity: 1; }
    `;
    DOC.head.appendChild(st);

    // mount overlays once
    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);

    const fl = DOC.createElement('div');
    fl.className = 'hha-fx-flash';
    DOC.body.appendChild(fl);

    const stm = DOC.createElement('div');
    stm.className = 'hha-fx-storm';
    DOC.body.appendChild(stm);

    const rg = DOC.createElement('div');
    rg.className = 'hha-fx-rage';
    DOC.body.appendChild(rg);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setBodyState(c, on){
    try{
      if(on) DOC.body.classList.add(c);
      else DOC.body.classList.remove(c);
    }catch(_){}
  }
  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }

  function pickXY(detail){
    // accept x/y, px/py, clientX/clientY, cx/cy
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
    if (t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('hitjunk')) return 'bad';
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
    else if (P?.burstAt) P.burstAt(x,y,'good'); // compatibility
    else if (P?.popText) P.popText(x,y,'✨');
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
      for(let i=0;i<9;i++){
        setTimeout(()=>fxBurst(innerWidth/2 + (Math.random()*2-1)*190, innerHeight*0.35 + (Math.random()*2-1)*110, 24 + Math.random()*46), i*45);
      }
    }
  }

  // ---------- storm / boss / rage ----------
  let stormTimer = 0;
  let rageTimer = 0;

  function lightning(){
    addBodyCls('fx-lightning', 120);
    addBodyCls('fx-stormshake', 220);
    fxShock(innerWidth/2, innerHeight*0.28, 92);
  }

  function startStorm(ms){
    stormTimer = Date.now() + (ms || 6000);
    setBodyState('fx-storm', true);
    lightning();
    // periodic lightning while storm
    const tick = ()=>{
      if(Date.now() > stormTimer) return;
      if(Math.random() < 0.55) lightning();
      setTimeout(tick, 650 + Math.random()*600);
    };
    setTimeout(tick, 520);
  }

  function stopStorm(){
    stormTimer = 0;
    setBodyState('fx-storm', false);
  }

  function bossPulse(){
    addBodyCls('fx-boss', 900);
    addBodyCls('fx-heavykick', 160);
    fxPop(innerWidth/2, innerHeight*0.24, '⚔️ BOSS!', 'boss');
    fxShock(innerWidth/2, innerHeight*0.30, 120);
  }

  function startRage(ms){
    rageTimer = Date.now() + (ms || 3000);
    setBodyState('fx-rage', true);
    addBodyCls('fx-ragebeat', 420);
    fxPop(innerWidth/2, innerHeight*0.26, '🔥 RAGE!', 'rage');
    const beat = ()=>{
      if(Date.now() > rageTimer) return;
      addBodyCls('fx-ragebeat', 420);
      if(Math.random() < 0.40) addBodyCls('fx-heavykick', 160);
      setTimeout(beat, 360);
    };
    setTimeout(beat, 120);
  }

  function stopRage(){
    rageTimer = 0;
    setBodyState('fx-rage', false);
  }

  // ---------- event listeners ----------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 58);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurst(x,y, 34);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 210);
      addBodyCls('fx-heavykick', 160);
      fxShock(x,y, 84);
      fxPop(x,y, 'PERFECT!', 'perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 230);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 72);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 230);
      fxBurst(x,y, 64);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 48);
      fxPop(x,y,'BLOCK','block');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46);
    }
  });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'score');
    }
  });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 260);
    fxShock(x,y, 76);
  });

  DOC.addEventListener('hha:celebrate', ()=>{
    fxCelebrate();
  });

  DOC.addEventListener('hha:end', ()=>{
    stopStorm();
    stopRage();
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  });

  // --- NEW: boss/storm/rage signals (GoodJunk & future games) ---
  DOC.addEventListener('hha:storm', (e)=>{
    const d = e?.detail || {};
    const ms = Number(d.ms ?? d.durationMs ?? 6000);
    startStorm(ms);
  });

  DOC.addEventListener('hha:boss', ()=>{
    bossPulse();
  });

  DOC.addEventListener('hha:rage', (e)=>{
    const d = e?.detail || {};
    const ms = Number(d.ms ?? d.durationMs ?? 3000);
    startRage(ms);
  });

  // helpful dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'perfect', x:x+90, y:y-10 } })), 160);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 320);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:storm',{ detail:{ ms: 2500 } })), 520);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:boss')), 980);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:rage',{ detail:{ ms: 1800 } })), 1320);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 2100);
  };
})();