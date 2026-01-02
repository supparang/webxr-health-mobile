// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION
// ✅ EdgeFX (vignette + chromatic) : storm/boss/danger/urgent
// ✅ Procedural Shake (playLayer) : living shake by pressure
// ✅ Combo Chain FX : aura + pitch ping + particles milestone burst
//
// Requires (optional):
// - ../vr/particles.js -> window.Particles.{popText,burst,celebrate}
// - SOUND PACK functions in window: clicky (or it will fallback silently)
// - Uses existing classes: mini-urgent / groups-storm-urgent if present
//
// Safe to include with defer before groups.safe.js (or after) — it binds events only.

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // -------------------- Particles helpers (optional) --------------------
  function P(){ return WIN.Particles || (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || null; }
  function hasParticles(){
    const p=P();
    return !!(p && (p.popText || p.burst || p.celebrate));
  }
  function centerXY(){
    return { x: WIN.innerWidth/2, y: WIN.innerHeight/2 };
  }
  function fxBurstAtCenter(n){
    const p=P(); if(!p || !p.burst) return;
    const {x,y}=centerXY();
    try{ p.burst(x,y,n); }catch(_){}
  }
  function fxCelebrate(){
    const p=P(); if(!p || !p.celebrate) return;
    try{ p.celebrate(); }catch(_){}
  }

  // -------------------- Sound helpers (optional) --------------------
  function clickySafe(opts){
    try{
      if (typeof WIN.clicky === 'function') WIN.clicky(opts);
    }catch(_){}
  }

  // ============================================================
  // 10) EDGE FX (vignette + chromatic)
  // ============================================================
  function ensureEdge(){
    let el = DOC.querySelector('.hha-edgefx');
    if(el) return el;
    el = DOC.createElement('div');
    el.className = 'hha-edgefx';
    DOC.body.appendChild(el);
    return el;
  }
  ensureEdge();

  function setBody(cls,on){ DOC.body.classList.toggle(cls, !!on); }

  // boss/storm via groups:progress or judge
  WIN.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if(k==='storm_on'){
      setBody('fx-storm', true);
      setBody('fx-boss', false);
    }
    if(k==='storm_off'){
      setBody('fx-storm', false);
      setBody('fx-boss', false);
      setBody('fx-danger', false);
      setBody('fx-urgent', false);
    }
    if(k==='boss_spawn'){
      setBody('fx-boss', true);
      setBody('fx-storm', true);
    }
    if(k==='boss_clear'){
      setBody('fx-boss', false);
      setBody('fx-danger', false);
      setBody('fx-urgent', false);
    }
  }, {passive:true});

  WIN.addEventListener('hha:judge', (ev)=>{
    const kind = String((ev.detail||{}).kind||'').toLowerCase();
    if(kind==='storm') setBody('fx-storm', true);
    if(kind==='boss'){ setBody('fx-boss', true); setBody('fx-storm', true); }
    if(kind==='bad'){
      setBody('fx-danger', true);
      setTimeout(()=>setBody('fx-danger', false), 520);
    }
    if(kind==='miss'){
      setBody('fx-danger', true);
      setTimeout(()=>setBody('fx-danger', false), 360);
    }
  }, {passive:true});

  // urgent pulse: reuse your existing class mini-urgent/groups-storm-urgent
  setInterval(()=>{
    const urgent = DOC.body.classList.contains('mini-urgent') || DOC.body.classList.contains('groups-storm-urgent');
    setBody('fx-urgent', urgent);
  }, 200);

  WIN.addEventListener('hha:end', ()=>{
    setBody('fx-storm', false);
    setBody('fx-boss', false);
    setBody('fx-danger', false);
    setBody('fx-urgent', false);
  }, {passive:true});

  // ============================================================
  // 11) PROCEDURAL SHAKE (shake playLayer only)
  // ============================================================
  const SHAKE = {
    intensity:0, // 0..1
    target:0,    // 0..1
    t0: performance.now()
  };

  function getShakeLayer(){
    return DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }
  const shakeLayer = getShakeLayer();

  function bump(x){
    SHAKE.target = clamp(Math.max(SHAKE.target, x), 0, 1);
  }

  // triggers
  WIN.addEventListener('hha:judge', (ev)=>{
    const k=String((ev.detail||{}).kind||'').toLowerCase();
    if(k==='good') bump(0.04);
    if(k==='block') bump(0.10);
    if(k==='bad') bump(0.22);
    if(k==='miss') bump(0.16);
    if(k==='boss') bump(0.30);
  }, {passive:true});

  WIN.addEventListener('groups:progress', (ev)=>{
    const k=String((ev.detail||{}).kind||'').toLowerCase();
    if(k==='storm_on') bump(0.18);
    if(k==='boss_spawn') bump(0.32);
    if(k==='boss_clear') bump(0.18);
  }, {passive:true});

  // urgent = constant vibration
  setInterval(()=>{
    const urgent = DOC.body.classList.contains('mini-urgent') || DOC.body.classList.contains('groups-storm-urgent');
    if(urgent) bump(0.16);
  }, 220);

  function shakeFrame(now){
    const dt = Math.min(0.05, Math.max(0.001, (now - SHAKE.t0)/1000));
    SHAKE.t0 = now;

    // smooth follow target then decay
    SHAKE.intensity = SHAKE.intensity*0.86 + SHAKE.target*0.14;
    SHAKE.target = Math.max(0, SHAKE.target - dt*0.22);

    const s = SHAKE.intensity;
    if (s <= 0.001){
      try{ shakeLayer.style.transform = ''; }catch(_){}
      requestAnimationFrame(shakeFrame);
      return;
    }

    // procedural offsets (non-repeating-ish)
    const n = now*0.001;
    const ax = (Math.sin(n*17.7)+Math.sin(n*29.1)*0.55+Math.sin(n*41.3)*0.25);
    const ay = (Math.cos(n*19.2)+Math.cos(n*31.7)*0.50+Math.cos(n*43.9)*0.22);
    const ar = (Math.sin(n*13.1)+Math.sin(n*21.7)*0.50);

    // combo boost (optional)
    const comboBoost = DOC.body.classList.contains('combo-4') ? 1.08 : DOC.body.classList.contains('combo-3') ? 1.04 : 1.0;

    const px = (ax * 6.0 * s) * comboBoost;
    const py = (ay * 5.0 * s) * comboBoost;
    const rot = (ar * 0.65 * s) * comboBoost;

    try{
      shakeLayer.style.transform = `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0) rotate(${rot.toFixed(3)}deg)`;
    }catch(_){}
    requestAnimationFrame(shakeFrame);
  }
  requestAnimationFrame(shakeFrame);

  WIN.addEventListener('hha:end', ()=>{
    SHAKE.intensity=0; SHAKE.target=0;
    try{ shakeLayer.style.transform=''; }catch(_){}
  }, {passive:true});

  // ============================================================
  // 12) COMBO CHAIN FX (aura + pitch ping + particles milestone)
  // ============================================================
  let lastCombo = 0;
  let lastMilestone = 0;

  function comboLevel(c){
    if(c>=40) return 4;
    if(c>=25) return 3;
    if(c>=12) return 2;
    if(c>=5)  return 1;
    return 0;
  }
  function setComboClass(level){
    DOC.body.classList.remove('combo-1','combo-2','combo-3','combo-4');
    if(level>=1) DOC.body.classList.add('combo-1');
    if(level>=2) DOC.body.classList.add('combo-2');
    if(level>=3) DOC.body.classList.add('combo-3');
    if(level>=4) DOC.body.classList.add('combo-4');
  }

  function pingCombo(c){
    const lvl = comboLevel(c);
    if(lvl<=0) return;

    // pitch climbs with combo
    const f = 520 + Math.min(900, c*14);
    const v = 0.035 + lvl*0.012;
    clickySafe({freq:f, dur:0.04, vol:v, type:'triangle'});
  }

  function burstMilestone(c){
    const ms = (c>=40)?40:(c>=30)?30:(c>=20)?20:(c>=10)?10:0;
    if(ms && ms!==lastMilestone){
      lastMilestone = ms;

      // particles
      if (hasParticles()){
        fxBurstAtCenter(18 + ms/2);
        if (ms>=20) fxCelebrate();
      }

      // stronger sound + haptic
      clickySafe({freq: 880 + ms*6, dur:0.07, vol:0.09, type:'sawtooth'});
      try{ if(navigator.vibrate) navigator.vibrate([20,30,20,30,40]); }catch(_){}
    }
    if(c<8) lastMilestone = 0; // reset when combo drops low
  }

  WIN.addEventListener('hha:score', (ev)=>{
    const d=ev.detail||{};
    const c = Number(d.combo||0)|0;

    if(c !== lastCombo){
      setComboClass(comboLevel(c));

      // ping only when combo increases
      if(c > lastCombo) pingCombo(c);

      burstMilestone(c);
      lastCombo = c;
    }
  }, {passive:true});

  WIN.addEventListener('hha:end', ()=>{
    setComboClass(0);
    lastCombo = 0;
    lastMilestone = 0;
  }, {passive:true});

})();