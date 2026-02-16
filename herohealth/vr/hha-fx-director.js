// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (ULTRA + SAFE)
// ✅ Consistent feedback across ALL games
// ✅ Listens: hha:judge, hha:score, hha:miss, hha:celebrate, hha:end
// ✅ Aliases: groups:hit, gj:judge (optional)
// ✅ Uses Particles.* when available; graceful fallback if missing
// ✅ Adds micro hit-stop / kick / vignette / shake / rage tint

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // -----------------------------
  // Inject minimal CSS (once)
  // -----------------------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if(DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* ===== HHA FX Director (minimal) ===== */
      body{ transform: translateZ(0); }

      /* screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* hit-stop (micro freeze feel) */
      body.fx-hitstop *{
        animation-play-state: paused !important;
        transition-duration: 0ms !important;
      }

      /* mild flash tint (no seizure-y) */
      body.fx-flash-good{ filter: brightness(1.05) contrast(1.03); }
      body.fx-flash-bad { filter: brightness(0.98) contrast(1.08) saturate(1.08); }

      /* miss blink */
      body.fx-missblink{ animation: hhaMissBlink 260ms ease; }
      @keyframes hhaMissBlink{
        0%{ filter:none; }
        35%{ filter: brightness(1.08) contrast(1.08); }
        100%{ filter:none; }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.12) contrast(1.05); }
        100%{ filter:none; }
      }

      /* rage tint (opt-in by game: body.classList.add('fx-rage')) */
      body.fx-rage{
        filter: saturate(1.15) contrast(1.08);
      }

      /* lowtime panic tint (opt-in by game: body.classList.add('fx-lowtime')) */
      body.fx-lowtime{
        filter: saturate(1.06) contrast(1.04);
      }
    `;
    DOC.head.appendChild(st);
  })();

  // -----------------------------
  // Helpers
  // -----------------------------
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const num = (v)=>{ v = Number(v); return Number.isFinite(v) ? v : null; };

  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms || 180);
    }catch(_){}
  }

  function hitStop(ms){
    const t = clamp(ms ?? 40, 18, 90);
    try{
      DOC.body.classList.add('fx-hitstop');
      setTimeout(()=>DOC.body.classList.remove('fx-hitstop'), t);
    }catch(_){}
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function pickXY(detail){
    // accept x/y, px/py, clientX/clientY, cx/cy
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if(x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = String(d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toLowerCase();

    // allow label-based mapping
    if(t.includes('perfect')) return 'perfect';
    if(t.includes('goal')) return 'good';
    if(t.includes('mini')) return 'good';
    if(t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';

    if(t.includes('good') || t.includes('correct') || t.includes('hit_good') || t.includes('hitgood')) return 'good';
    if(t.includes('bad')  || t.includes('junk')    || t.includes('wrong')   || t.includes('hit_junk') || t.includes('hitjunk')) return 'bad';
    if(t.includes('miss') || t.includes('expire')  || t.includes('timeout')) return 'miss';

    return t || 'good';
  }

  function fxPop(x,y,text,cls){
    const P = particles();
    try{
      if(P?.popText) P.popText(x,y,text,cls);
      else if(P?.popText === undefined && P?.scorePop) P.scorePop(x,y,text);
      else if(P?.scorePop) P.scorePop(x,y,text);
    }catch(_){}
  }

  function fxScore(x,y,delta){
    const P = particles();
    try{
      if(P?.scorePop) P.scorePop(x,y, delta);
      else if(P?.popText) P.popText(x,y, delta);
    }catch(_){}
  }

  function fxBurst(x,y,kind){
    const P = particles();
    try{
      if(P?.burstAt) P.burstAt(x,y,kind);
      else if(P?.hitGood && kind==='good') P.hitGood(x,y);
      else if(P?.hitBad && kind==='bad') P.hitBad(x,y);
      else if(P?.ringAt) P.ringAt(x,y);
    }catch(_){}
  }

  function fxShake(ms){
    const P = particles();
    try{
      if(P?.shake) P.shake(ms);
      else addBodyCls('fx-kick', 120);
    }catch(_){}
  }

  function fxCelebrate(){
    const P = particles();
    if(P?.celebrate){
      try{ P.celebrate(); return; }catch(_){}
    }
    // fallback: multiple bursts
    for(let i=0;i<9;i++){
      setTimeout(()=>{
        const x = innerWidth/2 + (Math.random()*2-1)*180;
        const y = innerHeight*0.38 + (Math.random()*2-1)*110;
        fxBurst(x,y,'star');
      }, i*45);
    }
  }

  // combo amplifier (kid-friendly, but “โหดขึ้น”)
  function comboAmp(combo){
    combo = Number(combo||0);
    if(combo >= 12) return { stop: 60, kick: 160, extra:true };
    if(combo >= 6)  return { stop: 44, kick: 140, extra:false };
    return { stop: 28, kick: 120, extra:false };
  }

  // -----------------------------
  // Canon events
  // -----------------------------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
    const amp = comboAmp(combo);

    if(t === 'good'){
      hitStop(amp.stop);
      addBodyCls('fx-kick', amp.kick);
      addBodyCls('fx-flash-good', 120);
      fxBurst(x,y,'good');
      if(amp.extra) fxBurst(x,y,'star');

    } else if(t === 'perfect'){
      hitStop(72);
      addBodyCls('fx-kick', 170);
      addBodyCls('fx-flash-good', 150);
      fxBurst(x,y,'diamond');
      fxPop(x,y,'PERFECT!','perfect');

    } else if(t === 'bad'){
      hitStop(54);
      addBodyCls('fx-kick', 140);
      addBodyCls('fx-flash-bad', 150);
      addBodyCls('fx-missblink', 240);
      fxBurst(x,y,'bad');
      fxShake(160);

    } else if(t === 'miss'){
      addBodyCls('fx-missblink', 260);
      fxBurst(x,y,'bad');
      fxShake(140);

    } else if(t === 'block'){
      hitStop(36);
      addBodyCls('fx-kick', 120);
      addBodyCls('fx-flash-good', 90);
      fxBurst(x,y,'block');
      fxPop(x,y,'BLOCK','block');

    } else {
      // unknown => treat as mild good
      hitStop(22);
      addBodyCls('fx-kick', 120);
      fxBurst(x,y,'good');
    }
  }, { passive:true });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if(Number.isFinite(sc) && sc !== 0){
      const txt = (sc>0 ? `+${sc}` : `${sc}`);
      fxScore(x,y, txt);
    }
  }, { passive:true });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-missblink', 260);
    fxBurst(x,y,'bad');
    fxShake(140);
  }, { passive:true });

  DOC.addEventListener('hha:celebrate', ()=>{
    fxCelebrate();
  }, { passive:true });

  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 180);
  }, { passive:true });

  // -----------------------------
  // Optional aliases (for older games)
  // -----------------------------
  DOC.addEventListener('groups:hit', (e)=>{
    const d = e?.detail || {};
    // expected: {type:'hit_good'|'hit_bad'|'shot_miss'|'timeout_miss', x,y, combo}
    const tRaw = String(d.type || '').toLowerCase();
    let type = 'good';
    if(tRaw.includes('bad')) type = 'bad';
    else if(tRaw.includes('miss') || tRaw.includes('timeout')) type = 'miss';
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{
      type, x:d.x, y:d.y, combo:d.combo
    }}));
  }, { passive:true });

  // Debug probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:7 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+90, y:y-20 } })), 140);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-90, y:y+25, combo:0 } })), 280);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'perfect', x:x, y:y-40, combo:12 } })), 420);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 640);
  };

})();