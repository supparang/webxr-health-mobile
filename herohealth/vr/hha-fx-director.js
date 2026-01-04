// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (HARD+++)
// Includes:
//   (A) Core: judge/score/miss/end/celebrate + combo tiers + hitstop (VR-safe)
//   (B) Fever Overheat (Global): listens hha:danger OR hha:fever -> heat haze + warning + sfx
//   (C) Boss/Storm Signature FX: listens hha:phase / hha:boss / hha:storm -> heartbeat/rumble/scanlines
//
// Toggles:
//   ?fx=0 / off     => disable all
//   ?fx=soft        => reduced intensity + disables hitstop/rumble
// Respects prefers-reduced-motion
//
// Requires: ../vr/particles.js (optional)
// Optional: ../vr/hha-sfx.js

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------- query helpers ----------
  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  function prefersReduce(){
    try { return !!ROOT.matchMedia && ROOT.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  }

  // fx mode
  const fxMode = String(qs('fx','on')).toLowerCase(); // on | soft | 0/off
  const FX_OFF  = (fxMode === '0' || fxMode === 'off');
  const FX_SOFT = (fxMode === 'soft') || prefersReduce();

  // ---------- inject CSS ----------
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
        background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.32) 74%, rgba(0,0,0,.58) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .22; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .38; }
      body.fx-miss     .hha-fx-vignette{ opacity: .34; }

      /* subtle screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        40%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 700ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.16) contrast(1.06); }
        100%{ filter:none; }
      }

      /* hitstop (global) */
      body.fx-hitstop *{
        animation-play-state: paused !important;
        transition-duration: 0ms !important;
      }
      body.fx-hitstop{
        filter: contrast(1.02) saturate(1.02);
      }

      /* --------- (B) Fever Overheat --------- */
      .hha-heat{
        position:fixed; inset:0;
        z-index:9997; pointer-events:none;
        opacity:0; transition: opacity 180ms ease;
        backdrop-filter: blur(0px);
      }
      .hha-heat::before{
        content:""; position:absolute; inset:-12px;
        background:
          radial-gradient(circle at 50% 30%, rgba(255,80,80,.14), transparent 60%),
          radial-gradient(circle at 50% 70%, rgba(255,150,60,.10), transparent 62%);
        mix-blend-mode: screen;
        opacity:.9;
      }
      body.fx-overheat .hha-heat{
        opacity: .92;
        backdrop-filter: blur(0.6px);
        animation: hhaHeatWobble 900ms ease-in-out infinite;
      }
      @keyframes hhaHeatWobble{
        0%{ transform: translate3d(0,0,0) scale(1.00); filter: saturate(1.02); }
        50%{ transform: translate3d(0.4px,-0.6px,0) scale(1.004); filter: saturate(1.06); }
        100%{ transform: translate3d(0,0,0) scale(1.00); filter: saturate(1.02); }
      }

      /* --------- (C) Boss / Storm Signature --------- */
      .hha-phase{
        position:fixed; inset:0;
        z-index:9996; pointer-events:none;
        opacity:0; transition: opacity 220ms ease;
      }
      /* storm scanlines */
      .hha-phase.storm::before{
        content:""; position:absolute; inset:0;
        background:
          repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,.06) 0px,
            rgba(255,255,255,.06) 1px,
            rgba(0,0,0,0) 6px,
            rgba(0,0,0,0) 10px
          );
        opacity:.18;
        mix-blend-mode: overlay;
      }
      body.fx-storm .hha-phase{ opacity: 1; }
      body.fx-storm{ animation: hhaStormPulse 1.2s ease-in-out infinite; }
      @keyframes hhaStormPulse{
        0%{ filter: contrast(1.02) brightness(1.00); }
        50%{ filter: contrast(1.07) brightness(1.03); }
        100%{ filter: contrast(1.02) brightness(1.00); }
      }

      /* boss heartbeat (non-VR only) */
      body.fx-bossbeat .hha-fx-vignette{ opacity: .42; }
      body.fx-bossbeat{ animation: hhaBossBeat 820ms ease-in-out infinite; }
      @keyframes hhaBossBeat{
        0%{ transform: translate3d(0,0,0) scale(1.000); }
        18%{ transform: translate3d(0.6px,-0.6px,0) scale(1.004); }
        42%{ transform: translate3d(0,0,0) scale(1.000); }
        60%{ transform: translate3d(-0.6px,0.6px,0) scale(1.003); }
        100%{ transform: translate3d(0,0,0) scale(1.000); }
      }

      /* boss rage flash */
      body.fx-bossrage{ animation: hhaBossRage 520ms ease; }
      @keyframes hhaBossRage{
        0%{ filter: saturate(1.00) contrast(1.00); }
        30%{ filter: saturate(1.18) contrast(1.10); }
        100%{ filter: saturate(1.00) contrast(1.00); }
      }

      @media (prefers-reduced-motion: reduce){
        body.fx-kick{ animation-duration: 1ms !important; }
        body.fx-endblink{ animation-duration: 1ms !important; }
        body.fx-storm{ animation-duration: 1ms !important; }
        body.fx-bossbeat{ animation-duration: 1ms !important; }
        body.fx-overheat .hha-heat{ animation-duration: 1ms !important; }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);

    const heat = DOC.createElement('div');
    heat.className = 'hha-heat';
    DOC.body.appendChild(heat);

    const ph = DOC.createElement('div');
    ph.className = 'hha-phase';
    DOC.body.appendChild(ph);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    if(FX_OFF) return;
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setBodyCls(c, on){
    if(FX_OFF) return;
    try{ DOC.body.classList.toggle(c, !!on); }catch(_){}
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
    if (t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';
    if (t.includes('bad')  || t.includes('junk')   || t.includes('wrong')   || t.includes('hitjunk')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block')|| t.includes('guard')  || t.includes('shield')) return 'block';
    return t || 'good';
  }

  function pickReason(detail){
    const d = detail || {};
    return (d.reason || d.label || d.tag || '').toString().toLowerCase();
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function fxBurst(x,y,r){
    if(FX_OFF) return;
    const P = particles();
    if (P?.burst) P.burst(x,y,{r, count: FX_SOFT ? 8 : 12});
  }

  function fxShock(x,y,r){
    if(FX_OFF) return;
    const P = particles();
    if (P?.shockwave) P.shockwave(x,y,{r});
    else fxBurst(x,y,r);
  }

  function fxPop(x,y,text,cls){
    if(FX_OFF) return;
    const P = particles();
    if (P?.popText) P.popText(x,y,text,cls);
  }

  function fxToast(text, cls){
    if(FX_OFF) return;
    const P = particles();
    if (P?.toast) P.toast(text, cls);
    else fxPop(innerWidth/2, innerHeight*0.22, text, cls||'toast');
  }

  function fxCelebrate(payload={}){
    if(FX_OFF) return;
    const P = particles();
    if (P?.celebrate) P.celebrate(payload);
    else{
      for(let i=0;i<8;i++){
        setTimeout(()=>fxBurst(innerWidth/2 + (Math.random()*2-1)*160, innerHeight*0.35 + (Math.random()*2-1)*90, 22 + Math.random()*40), i*45);
      }
    }
  }

  // ---------- SFX ----------
  function sfx(name, detail){
    try{
      if (ROOT.HHA_SFX && typeof ROOT.HHA_SFX.play === 'function'){
        ROOT.HHA_SFX.play(name, detail || {});
        return;
      }
      ROOT.dispatchEvent(new CustomEvent('hha:sfx', { detail: { name, ...(detail||{}) } }));
    }catch(_){}
  }

  // ---------- VR detect ----------
  function isVRish(detail){
    const v = (detail?.view || detail?.device || qs('view','')).toString().toLowerCase();
    return (v === 'vr' || v === 'cvr');
  }

  // ---------- hitstop (VR-safe) ----------
  let hitstopAt = 0;
  function hitstop(ms, detail){
    if(FX_OFF) return;
    if(FX_SOFT) return;
    if(isVRish(detail)) return; // VR/cVR => off (safety)
    const now = performance.now();
    if(now - hitstopAt < 140) return;
    hitstopAt = now;

    const dur = Math.max(12, Math.min(26, ms|0));
    try{
      DOC.body.classList.add('fx-hitstop');
      setTimeout(()=>DOC.body.classList.remove('fx-hitstop'), dur);
    }catch(_){}
  }

  // ---------- combo tiers ----------
  let _lastTierAt = 0;
  let _lastTier = 0;
  function tierFromCombo(c){
    c = Math.floor(Number(c)||0);
    if(c >= 30) return 30;
    if(c >= 25) return 25;
    if(c >= 20) return 20;
    if(c >= 15) return 15;
    if(c >= 10) return 10;
    if(c >= 5)  return 5;
    return 0;
  }
  function resetComboTier(){ _lastTier = 0; }

  function comboTierFx(x,y, combo){
    if(FX_OFF) return;
    const now = performance.now();
    if (now - _lastTierAt < (FX_SOFT ? 420 : 260)) return;
    _lastTierAt = now;

    const c = Math.floor(Number(combo)||0);
    const tier = tierFromCombo(c);
    if(tier <= _lastTier) return;
    _lastTier = tier;

    if (tier === 5){
      fxBurst(x,y, 40);
      fxPop(x,y, `COMBO x${c}`, 'combo');
      sfx('combo5', { combo:c });

    } else if (tier === 10){
      fxShock(x,y, 86);
      fxBurst(x,y, 46);
      fxPop(x,y, `COMBO x${c}`, 'combo');
      sfx('combo10', { combo:c });

    } else if (tier === 15){
      fxShock(x,y, 96);
      fxBurst(x,y, 52);
      setTimeout(()=>fxBurst(x,y, 36), 70);
      fxPop(x,y, `🔥 HOT! x${c}`, 'hot');
      sfx('combo15', { combo:c });

    } else if (tier === 20){
      fxShock(x,y, 110);
      fxBurst(x,y, 60);
      fxPop(x,y, `⚡ RAMPAGE! x${c}`, 'rage');
      sfx('combo20', { combo:c });
      if(!FX_SOFT){
        for(let i=0;i<4;i++){
          setTimeout(()=>fxBurst(x + (Math.random()*2-1)*80, y + (Math.random()*2-1)*55, 26 + Math.random()*26), i*60);
        }
      }

    } else if (tier === 25){
      fxShock(x,y, 120);
      fxBurst(x,y, 66);
      fxPop(x,y, `💥 OVERDRIVE x${c}`, 'rage');
      sfx('combo25', { combo:c });
      hitstop(18, {});

    } else if (tier === 30){
      fxShock(x,y, 140);
      fxBurst(x,y, 74);
      fxPop(x,y, `👑 ULTRA x${c}`, 'big');
      sfx('combo30', { combo:c });
      hitstop(22, {});
      if(!FX_SOFT){
        for(let k=0;k<2;k++){
          setTimeout(()=>fxCelebrate({ intensity: 1.0 }), 220 + k*140);
        }
      }
    }
  }

  // ---------- (B) Fever Overheat ----------
  let overheatOn = false;
  let overheatLastWarn = 0;

  function applyOverheat(level01, detail){
    if(FX_OFF) return;
    const lv = Math.max(0, Math.min(1, Number(level01)||0));
    const want = (lv >= 0.86);

    // VR-safe: keep overlay but disable wobble in VR-ish by using SOFT behavior
    const vr = isVRish(detail);
    const soft = FX_SOFT || vr;

    if(want && !overheatOn){
      overheatOn = true;
      DOC.body.classList.add('fx-overheat');
      if(soft){
        // reduce intensity (disable animation by forcing prefers-like behavior)
        try{ DOC.body.style.setProperty('--hha-overheat-soft','1'); }catch(_){}
      }
      const now = Date.now();
      if(now - overheatLastWarn > 1200){
        overheatLastWarn = now;
        fxToast('🔥 FEVER OVERHEAT!', 'hot');
        sfx('miss', {}); // warning tone (no mp3)
      }
    } else if(!want && overheatOn){
      overheatOn = false;
      DOC.body.classList.remove('fx-overheat');
    }
  }

  // Accept both:
  // 1) hha:danger {level:0..1}
  // 2) hha:fever  {level:0..1} or {pct:0..100}
  DOC.addEventListener('hha:danger', (e)=>{
    const d = e?.detail || {};
    if(d.level == null) return;
    applyOverheat(d.level, d);
  }, { passive:true });

  DOC.addEventListener('hha:fever', (e)=>{
    const d = e?.detail || {};
    const lv =
      (d.level != null) ? Number(d.level) :
      (d.pct != null) ? (Number(d.pct)/100) :
      null;
    if(lv == null) return;
    applyOverheat(lv, d);
  }, { passive:true });

  // ---------- (C) Boss / Storm Signature FX ----------
  const phaseLayer = DOC.querySelector('.hha-phase');

  let curPhase = 'none';
  function setPhase(p){
    p = String(p||'none').toLowerCase();
    curPhase = p;

    // clear classes
    setBodyCls('fx-storm', false);
    setBodyCls('fx-bossbeat', false);
    setBodyCls('fx-bossrage', false);

    if(phaseLayer){
      phaseLayer.classList.remove('storm');
      phaseLayer.classList.remove('boss');
    }

    if(FX_OFF) return;

    // Storm: scanlines + contrast pulse (VR-safe: keep mild only)
    if(p === 'storm'){
      setBodyCls('fx-storm', true);
      if(phaseLayer) phaseLayer.classList.add('storm');
      fxToast('🌪️ STORM!', 'combo');
      sfx('bad', {});
      return;
    }

    // Boss: heartbeat (NON-VR only)
    if(p === 'boss'){
      const vr = (qs('view','')+'').toLowerCase();
      const isVR = (vr === 'vr' || vr === 'cvr');
      if(!FX_SOFT && !isVR){
        setBodyCls('fx-bossbeat', true);
      }
      if(phaseLayer) phaseLayer.classList.add('boss');
      fxToast('👹 BOSS!', 'rage');
      sfx('combo20', {});
      return;
    }

    // none/other => off
  }

  // hha:phase {phase:'storm'|'boss'|'play'|... , state?}
  DOC.addEventListener('hha:phase', (e)=>{
    const d = e?.detail || {};
    const ph = d.phase || d.state || d.mode || '';
    if(!ph) return;
    setPhase(ph);
  }, { passive:true });

  // hha:storm {state:'start'|'end'...}
  DOC.addEventListener('hha:storm', (e)=>{
    const d = e?.detail || {};
    const s = String(d.state||'start').toLowerCase();
    if(s === 'end' || s === 'stop') setPhase('none');
    else setPhase('storm');
  }, { passive:true });

  // hha:boss {state:'start'|'rage'|'hit'|'end'}
  DOC.addEventListener('hha:boss', (e)=>{
    const d = e?.detail || {};
    const s = String(d.state||'start').toLowerCase();
    if(s === 'end' || s === 'stop'){
      setPhase('none');
      return;
    }
    // ensure phase boss
    if(curPhase !== 'boss') setPhase('boss');

    // rage flash (VR-safe: soft only do pop)
    if(s === 'rage'){
      if(!FX_SOFT && !isVRish(d)){
        addBodyCls('fx-bossrage', 520);
        hitstop(18, d);
      }
      fxPop(innerWidth/2, innerHeight*0.30, 'RAGE!', 'rage');
      sfx('combo25', {});
    }

    // boss hit feedback (optional)
    if(s === 'hit'){
      const { x, y } = pickXY(d);
      fxShock(x,y, 92);
      fxBurst(x,y, 52);
      sfx('good', {});
    }
  }, { passive:true });

  // ---------- main judge ----------
  function onJudge(e){
    if(FX_OFF) return;
    const d = e?.detail || {};
    const { x, y } = pickXY(d);

    const t = pickType(d);
    const reason = pickReason(d);

    const isStar = reason.includes('star');
    const isShieldPick = reason.includes('shield') && t !== 'block';
    const isBlock = (t === 'block') || reason.includes('guard') || reason.includes('block');
    const isPerfect = (t === 'perfect') || reason.includes('perfect');

    if (t === 'good' || isPerfect || isBlock){
      addBodyCls('fx-hit-good', isPerfect ? 220 : 180);
      if(!FX_SOFT) addBodyCls('fx-kick', 120);

      if(!FX_SOFT) hitstop(16, d);

      if (isPerfect){
        fxShock(x,y, FX_SOFT ? 78 : 102);
        fxPop(x,y, 'PERFECT!', 'perfect');
        sfx('perfect', {});
      } else if (isStar){
        fxShock(x,y, FX_SOFT ? 74 : 92);
        fxBurst(x,y, 50);
        fxPop(x,y, '⭐ +BONUS', 'star');
        sfx('star', {});
      } else if (isShieldPick){
        fxShock(x,y, FX_SOFT ? 68 : 82);
        fxBurst(x,y, 46);
        fxPop(x,y, '🛡️ SHIELD', 'shield');
        sfx('shield', {});
      } else if (isBlock){
        fxBurst(x,y, 44);
        fxPop(x,y, '🛡️ BLOCK', 'block');
        sfx('block', {});
      } else{
        fxShock(x,y, 58);
        sfx('good', {});
      }

      // combo tiers
      const combo = Number(d.combo || d.comboNow || d.comboCount || d.comboValue || 0);
      if (combo > 0) comboTierFx(x,y, combo);
      return;
    }

    if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      if(!FX_SOFT) addBodyCls('fx-kick', 120);
      if(!FX_SOFT) hitstop(18, d);
      fxShock(x,y, 66);
      resetComboTier();
      sfx('bad', {});
      return;
    }

    if (t === 'miss'){
      addBodyCls('fx-miss', 220);
      if(!FX_SOFT) hitstop(18, d);
      fxBurst(x,y, 60);
      resetComboTier();
      sfx('miss', {});
      return;
    }

    // unknown -> mild
    addBodyCls('fx-hit-good', 140);
    fxBurst(x,y, 46);
    sfx('good', {});
  }

  // ---------- score/miss/end ----------
  DOC.addEventListener('hha:judge', onJudge);

  DOC.addEventListener('hha:score', (e)=>{
    if(FX_OFF) return;
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.score ?? d.delta ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), sc>=50?'big':'score');
    }
  });

  DOC.addEventListener('hha:miss', (e)=>{
    if(FX_OFF) return;
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    fxShock(x,y, 70);
    resetComboTier();
    sfx('miss', {});
  });

  DOC.addEventListener('hha:celebrate', ()=>{
    if(FX_OFF) return;
    fxCelebrate({ intensity: FX_SOFT ? 0.9 : 1.2 });
    sfx('celebrate', {});
  });

  DOC.addEventListener('hha:end', (e)=>{
    if(FX_OFF) return;
    addBodyCls('fx-endblink', 760);
    resetComboTier();
    // clear phase overlays on end
    setPhase('none');
    // clear overheat
    DOC.body.classList.remove('fx-overheat');

    const d = e?.detail || {};
    const grade = String(d.grade || '').toUpperCase();

    const boost =
      (grade === 'SSS') ? (FX_SOFT ? 1.8 : 3.0) :
      (grade === 'SS')  ? (FX_SOFT ? 1.4 : 2.2) :
      (grade === 'S')   ? (FX_SOFT ? 1.1 : 1.6) : 1.0;

    fxPop(innerWidth/2, innerHeight*0.24, grade ? `🏆 ${grade}` : '🏁 FINISH', grade ? 'big' : 'combo');
    sfx(grade ? 'grade' : 'end', { grade });

    setTimeout(()=>fxCelebrate({ intensity: boost }), 220);
    if(boost > 1.2 && !FX_SOFT){
      setTimeout(()=>fxCelebrate({ intensity: boost*0.8 }), 520);
    }
  });

  // dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;

    DOC.dispatchEvent(new CustomEvent('hha:danger', { detail:{ level:0.90 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:danger', { detail:{ level:0.20 } })), 1600);

    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'storm' } })), 220);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'boss' } })), 1200);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:boss', { detail:{ state:'rage' } })), 1600);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:boss', { detail:{ state:'hit', x:x-90, y:y+20 } })), 1950);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ phase:'none' } })), 2300);

    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:5 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:10 } })), 250);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:15 } })), 520);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:20 } })), 820);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:25 } })), 1140);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:30 } })), 1460);

    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end', { detail:{ grade:'SSS' } })), 2900);
  };

})();
