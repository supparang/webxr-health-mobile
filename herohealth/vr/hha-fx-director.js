// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (shared for all games)
// Listens to HHA events and triggers consistent feedback across games.
// Requires: ../vr/particles.js (recommended)
// ----------------------------------------------------
// ✅ hha:judge  -> hit good/bad/miss/perfect/block + shockwave/burst/pop + body kick
// ✅ hha:score  -> +score pop (optional big)
// ✅ hha:time   -> low-time panic (<=30s storm feel) + last-5 tick
// ✅ hha:end    -> end blink + celebrate
// ✅ hha:celebrate -> celebrate
// ✅ Optional hooks:
//    - emit('hha:phase',{phase:'storm'|'boss'|'rage', on:true/false})
//    - add body classes: fx-storm fx-boss fx-rage
// ----------------------------------------------------

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // -------------------- inject CSS (self-contained fallbacks) --------------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* vignette overlay */
      .hha-fx-vignette{
        position:fixed; inset:-24px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 140ms ease;
        filter: blur(.2px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background:
          radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.30) 74%, rgba(0,0,0,.62) 100%);
      }

      /* hit intensity */
      body.fx-hit-good .hha-fx-vignette{ opacity:.20; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity:.36; }
      body.fx-miss     .hha-fx-vignette{ opacity:.34; }
      body.fx-perfect  .hha-fx-vignette{ opacity:.26; }
      body.fx-block    .hha-fx-vignette{ opacity:.18; }

      /* screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        35%{ transform: translate3d(1px,-1px,0); }
        70%{ transform: translate3d(-.8px,.6px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* tiny chroma flash (safe) */
      body.fx-flash{ animation: hhaFlash 160ms ease; }
      @keyframes hhaFlash{
        0%{ filter:none; }
        40%{ filter: brightness(1.10) contrast(1.08) saturate(1.15); }
        100%{ filter:none; }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.18) contrast(1.06) saturate(1.06); }
        100%{ filter:none; }
      }

      /* low-time panic: storm feel */
      body.fx-storm{
        animation: hhaStormPulse 860ms ease-in-out infinite;
      }
      @keyframes hhaStormPulse{
        0%{ filter: none; }
        55%{ filter: saturate(1.16) contrast(1.05); }
        100%{ filter: none; }
      }

      /* boss / rage hooks */
      body.fx-boss{
        box-shadow: inset 0 0 0 9999px rgba(239,68,68,.02);
      }
      body.fx-rage{
        animation: hhaRage 520ms ease-in-out infinite;
      }
      @keyframes hhaRage{
        0%{ filter: none; }
        40%{ filter: saturate(1.22) contrast(1.10) brightness(1.06); }
        100%{ filter: none; }
      }

      /* last-5 tick */
      body.fx-tick{ animation: hhaTick 120ms ease; }
      @keyframes hhaTick{
        0%{ transform: translate3d(0,0,0) scale(1); }
        50%{ transform: translate3d(0,0,0) scale(1.003); }
        100%{ transform: translate3d(0,0,0) scale(1); }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // -------------------- helpers --------------------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setBodyModeCls(c, on){
    try{
      if(on) DOC.body.classList.add(c);
      else DOC.body.classList.remove(c);
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

  function str(v){ return (v==null)?'':String(v); }

  function pickType(detail){
    const d = detail || {};
    const t = str(d.type || d.kind || d.result || d.judge || d.hitType || d.label).toLowerCase();

    if (t.includes('perfect')) return 'perfect';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('oops')) return 'bad';
    if (t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';

    // allow "star/diamond" to map to good burst but special pop
    if (t.includes('star')) return 'star';
    if (t.includes('diamond')) return 'diamond';

    return t || 'good';
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function fxPop(x,y,text,cls){
    const P = particles();
    try{
      if(P?.popText) P.popText(x,y,text,cls);
    }catch(_){}
  }

  function fxBurst(x,y,kind){
    const P = particles();
    try{
      if(P?.burstAt) P.burstAt(x,y,kind);
      else if(P?.shockwave) P.shockwave(x,y,{});
    }catch(_){}
  }

  function fxShock(x,y,opts){
    const P = particles();
    try{
      if(P?.shockwave) P.shockwave(x,y,opts||{});
      else fxBurst(x,y,'neutral');
    }catch(_){}
  }

  function fxCelebrate(kind){
    const P = particles();
    try{
      if(P?.celebrate) P.celebrate(kind||'good');
      else{
        // soft fallback
        for(let i=0;i<8;i++){
          setTimeout(()=>fxBurst(innerWidth/2 + (Math.random()*2-1)*180, innerHeight*0.33 + (Math.random()*2-1)*90, 'good'), i*45);
        }
      }
    }catch(_){}
  }

  // -------------------- low time state --------------------
  let lastTimeSec = null;
  let stormOn = false;

  function updateTimeFx(tSec){
    const t = Math.max(0, Number(tSec)||0);

    // storm when <=30s (your rule: 30s = storm)
    const wantStorm = (t <= 30);
    if(wantStorm !== stormOn){
      stormOn = wantStorm;
      setBodyModeCls('fx-storm', stormOn);
      // allow games to react too
      try{
        ROOT.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'storm', on:stormOn, t } }));
      }catch(_){}
    }

    // last 5 sec tick (only on integer change)
    const it = Math.ceil(t);
    if(lastTimeSec !== it){
      lastTimeSec = it;
      if(it <= 5 && it >= 1){
        addBodyCls('fx-tick', 120);
        fxPop(innerWidth/2, innerHeight*0.30, String(it), 'big');
      }
    }
  }

  // -------------------- phase hook (boss/rage) --------------------
  // Your rules:
  // miss>=4 => boss
  // miss>=5 => rage
  // (we implement from hha:state / hha:miss or hha:judge with miss)
  let bossOn = false;
  let rageOn = false;

  function updateBossRage(miss){
    const m = Math.max(0, Number(miss)||0);
    const wantBoss = (m >= 4);
    const wantRage = (m >= 5);

    if(wantBoss !== bossOn){
      bossOn = wantBoss;
      setBodyModeCls('fx-boss', bossOn);
      try{ ROOT.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'boss', on:bossOn, miss:m } })); }catch(_){}
      if(bossOn){
        fxPop(innerWidth/2, innerHeight*0.26, 'BOSS!', 'big bad');
        fxShock(innerWidth/2, innerHeight*0.32, { s:8.8, color:'rgba(239,68,68,.95)' });
      }
    }

    if(wantRage !== rageOn){
      rageOn = wantRage;
      setBodyModeCls('fx-rage', rageOn);
      try{ ROOT.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'rage', on:rageOn, miss:m } })); }catch(_){}
      if(rageOn){
        fxPop(innerWidth/2, innerHeight*0.24, 'RAGE!', 'big bad');
        fxShock(innerWidth/2, innerHeight*0.30, { s:9.8, color:'rgba(239,68,68,.98)' });
      }
    }
  }

  // -------------------- listeners --------------------
  // 1) judge (hit feedback)
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    // optional: miss value included
    if(d.miss != null || d.misses != null) updateBossRage(d.miss ?? d.misses);

    // combo amplification
    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 170);
      addBodyCls('fx-kick', 120);
      addBodyCls('fx-flash', 160);
      fxBurst(x,y,'good');
      if(combo >= 5) fxBurst(x,y,'good'); // extra burst

    } else if (t === 'perfect'){
      addBodyCls('fx-perfect', 200);
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 120);
      addBodyCls('fx-flash', 180);
      fxBurst(x,y,'good');
      fxShock(x,y,{ s:8.2, color:'rgba(34,197,94,.95)' });
      fxPop(x,y,'PERFECT!','big good');

    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxBurst(x,y,'bad');
      fxShock(x,y,{ s:7.6, color:'rgba(239,68,68,.95)' });

    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxBurst(x,y,'bad');
      fxShock(x,y,{ s:8.2, color:'rgba(239,68,68,.95)' });
      fxPop(x,y,'MISS','bad');

    } else if (t === 'block'){
      addBodyCls('fx-block', 150);
      addBodyCls('fx-hit-good', 150);
      fxBurst(x,y,'block');
      fxPop(x,y,'BLOCK','block');

    } else if (t === 'star'){
      addBodyCls('fx-hit-good', 160);
      addBodyCls('fx-flash', 160);
      fxBurst(x,y,'star');
      fxPop(x,y,'⭐','big star');

    } else if (t === 'diamond'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-flash', 180);
      fxBurst(x,y,'diamond');
      fxPop(x,y,'💎','big diamond');

    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y,'neutral');
    }
  }, { passive:true });

  // 2) score pop
  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.delta ?? d.add ?? d.value ?? d.score ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      const cls = (Math.abs(sc) >= 50) ? 'big score' : 'score';
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), cls);
    }
  }, { passive:true });

  // 3) time -> storm + last 5 tick
  DOC.addEventListener('hha:time', (e)=>{
    const d = e?.detail || {};
    const t = (d.t != null) ? d.t : (d.timeLeftSec ?? d.time ?? null);
    if(t != null) updateTimeFx(t);
  }, { passive:true });

  // 4) miss -> update boss/rage
  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const m = d.miss ?? d.misses ?? d.value ?? null;
    if(m != null) updateBossRage(m);
  }, { passive:true });

  // 5) celebrate & end
  DOC.addEventListener('hha:celebrate', (e)=>{
    const d = e?.detail || {};
    fxCelebrate(d.kind || 'good');
  }, { passive:true });

  DOC.addEventListener('hha:end', (e)=>{
    addBodyCls('fx-endblink', 760);
    const d = e?.detail || {};
    // end celebration after a beat
    setTimeout(()=>fxCelebrate(d.grade ? 'good' : 'neutral'), 220);
  }, { passive:true });

  // 6) explicit phase event (optional)
  DOC.addEventListener('hha:phase', (e)=>{
    const d = e?.detail || {};
    const p = String(d.phase||'').toLowerCase();
    const on = !!d.on;
    if(p === 'storm') setBodyModeCls('fx-storm', on);
    if(p === 'boss')  setBodyModeCls('fx-boss', on);
    if(p === 'rage')  setBodyModeCls('fx-rage', on);
  }, { passive:true });

  // -------------------- dev probe --------------------
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+90, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-90, y:y+20, miss:4 } })), 280);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:time',{ detail:{ t:29 } })), 420);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'miss', x:x, y:y+80, miss:5 } })), 560);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end',{ detail:{ grade:'A' } })), 820);
  };

})();