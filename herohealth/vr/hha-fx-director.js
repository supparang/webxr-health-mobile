// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (shared across all games, tuned for GoodJunkVR)
// ✅ Body classes for tactile screen feedback: fx-hit-good/bad/miss/block, fx-kick, fx-endblink
// ✅ Global vignette overlay + storm/boss/rage atmosphere
// ✅ Auto react to: hha:judge, hha:score, hha:miss, hha:time, hha:celebrate, hha:end
// ✅ GoodJunk rules baked in:
//    - timeLeftSec <= 30  -> body.gj-storm
//    - miss >= 4          -> body.gj-boss
//    - miss >= 5          -> body.gj-rage (overrides boss feel)
// ✅ Works with Particles (optional). Safe if Particles not loaded.
// ✅ No external CSS needed (injects minimal style)

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ------------ CSS inject ------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* base overlay */
      .hha-fx-vignette{
        position:fixed; inset:-20px; pointer-events:none; z-index:199;
        opacity:0; transition: opacity 160ms ease;
        filter: blur(.2px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 45%, rgba(0,0,0,.32) 74%, rgba(0,0,0,.58) 100%);
      }

      /* judge pulses */
      body.fx-hit-good .hha-fx-vignette{ opacity: .22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .38; }
      body.fx-miss     .hha-fx-vignette{ opacity: .34; }

      /* tactile kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(.9px,-.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 700ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.15) contrast(1.05); }
        100%{ filter:none; }
      }

      /* STORM/BOSS/RAGE global moods (stackable but rage dominates) */
      body.gj-storm::after,
      body.gj-boss::after,
      body.gj-rage::after{
        content:""; position:fixed; inset:0; pointer-events:none; z-index:198;
        opacity:0; transition: opacity 220ms ease;
      }

      /* storm: time pressure (≤30s) */
      body.gj-storm::after{
        background:
          radial-gradient(1200px 420px at 50% -10%, rgba(56,189,248,.16), transparent 60%),
          radial-gradient(800px 800px at 50% 120%, rgba(34,197,94,.10), transparent 60%),
          repeating-linear-gradient(90deg, rgba(148,163,184,.06) 0 1px, transparent 1px 6px);
        opacity:.75;
      }
      body.gj-storm .hha-fx-vignette{ opacity:.26; }

      /* boss: miss ≥4 */
      body.gj-boss::after{
        background:
          radial-gradient(1100px 380px at 50% -8%, rgba(234,179,8,.14), transparent 62%),
          radial-gradient(800px 820px at 50% 120%, rgba(251,191,36,.10), transparent 60%);
        opacity:.78;
      }
      body.gj-boss .hha-fx-vignette{ opacity:.30; }

      /* rage: miss ≥5 (dominates, flashes a bit) */
      body.gj-rage::after{
        background:
          radial-gradient(1200px 420px at 50% -10%, rgba(239,68,68,.16), transparent 60%),
          radial-gradient(820px 860px at 50% 120%, rgba(239,68,68,.10), transparent 60%),
          repeating-linear-gradient(90deg, rgba(239,68,68,.07) 0 2px, transparent 2px 7px);
        opacity:.88;
        animation: hhaRagePulse 900ms ease-in-out infinite;
      }
      @keyframes hhaRagePulse{
        0%{ filter:saturate(1) brightness(1); }
        50%{ filter:saturate(1.15) brightness(1.05); }
        100%{ filter:saturate(1) brightness(1); }
      }

      /* subtle tick for low-time countdown numbers if used */
      body.gj-tick{ animation: hhaTick 140ms ease; }
      @keyframes hhaTick{
        0%{ transform: scale(1); }
        100%{ transform: scale(1.02); }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // ------------ helpers ------------
  const N = (v)=>{ v = Number(v); return Number.isFinite(v) ? v : null; };
  const particles = ()=> ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;

  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      if(ms) setTimeout(()=>DOC.body.classList.remove(c), ms);
    }catch(_){}
  }
  function removeBodyCls(...cls){ try{ DOC.body.classList.remove(...cls); }catch(_){ } }

  function pickXY(d){
    const x = N(d?.x) ?? N(d?.px) ?? N(d?.clientX) ?? N(d?.cx) ?? (innerWidth/2);
    const y = N(d?.y) ?? N(d?.py) ?? N(d?.clientY) ?? N(d?.cy) ?? (innerHeight/2);
    return { x, y };
  }
  function pickType(d){
    const t = (d?.type || d?.kind || d?.result || d?.judge || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';
    if (t.includes('bad') || t.includes('junk')   || t.includes('wrong')   || t.includes('hitjunk')) return 'bad';
    if (t.includes('miss')|| t.includes('expire')) return 'miss';
    if (t.includes('block')|| t.includes('guard') || t.includes('shield')) return 'block';
    return t || 'good';
  }

  function fxBurst(x,y,r){ const P = particles(); if(P?.burst) P.burst(x,y,{spread:r||160}); }
  function fxShock(x,y,r){ const P = particles(); if(P?.shockwave) P.shockwave(x,y,{r:r||160}); else fxBurst(x,y,r||160); }
  function fxPop(x,y,txt,cls){ const P = particles(); if(P?.popText) P.popText(x,y,txt,cls||''); }
  function fxCelebrate(){ const P = particles(); if(P?.celebrate) P.celebrate(); }

  // ------------ GoodJunk atmosphere states ------------
  let __timeLeft = null;
  let __miss = 0;

  function syncStormBossRage(){
    // priority: rage > boss > storm (storm can co-exist visually but rage dominates)
    // remove all, then add whichever applies
    removeBodyCls('gj-storm','gj-boss','gj-rage');

    if(__miss >= 5){ DOC.body.classList.add('gj-rage'); return; }
    if(__miss >= 4){ DOC.body.classList.add('gj-boss'); }

    if(__timeLeft != null && __timeLeft <= 30){
      DOC.body.classList.add('gj-storm');
    }
  }

  // ------------ Event listeners ------------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 64);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurst(x,y, 180);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 200);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 84);
      fxPop(x,y, 'PERFECT!','fx-good');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 78);
      fxPop(x,y, 'OOPS','fx-bad');
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxBurst(x,y, 200);
      fxPop(x,y, 'MISS','fx-bad');
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 160);
      fxPop(x,y, 'BLOCK','fx-warn');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 150);
    }
  });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'fx-violet':'fx-good');
    }
  });

  DOC.addEventListener('hha:miss', (e)=>{
    __miss = Math.max(__miss, Number(e?.detail?.miss ?? e?.detail?.value ?? __miss));
    syncStormBossRage();
  });

  DOC.addEventListener('hha:time', (e)=>{
    __timeLeft = Number(e?.detail?.t ?? __timeLeft);
    if(__timeLeft <= 5){
      addBodyCls('gj-tick', 120);
    }
    syncStormBossRage();
  });

  DOC.addEventListener('hha:celebrate', ()=> fxCelebrate());
  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
    // clear pressure states after end to show nice summary lighting
    setTimeout(()=>removeBodyCls('gj-storm','gj-boss','gj-rage'), 300);
  });

  // ------------ Public tiny tester ------------
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight*0.55;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ score:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 520);
  };

})();