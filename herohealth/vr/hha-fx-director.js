// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// ✅ Listens to common events across HeroHealth games
// ✅ Works with ../vr/particles.js (either minimal or extended API)
// ✅ Provides consistent "juice": pop / burst / ring / celebrate / body pulses
// ✅ Rate-limited to avoid spam
// ✅ Safe: no dependency on specific game DOM structure

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;
  if(WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // ----------------------- helpers -----------------------
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function P(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  function pop(x,y,text,cls=null,opts=null){
    const p = P();
    try{
      if(p && typeof p.popText === 'function') return p.popText(x,y,text,cls,opts);
      if(p && typeof p.scorePop === 'function') return p.scorePop(x,y,text);
    }catch(_){}
  }

  function burst(x,y,kind='good',opts=null){
    const p = P();
    try{
      if(p && typeof p.burstAt === 'function') return p.burstAt(x,y,kind,opts);
    }catch(_){}
  }

  function ring(x,y,kind='good',opts=null){
    const p = P();
    try{
      if(p && typeof p.ringPulse === 'function') return p.ringPulse(x,y,kind,opts);
    }catch(_){}
  }

  function celebrate(kind='win',opts=null){
    const p = P();
    try{
      if(p && typeof p.celebrate === 'function') return p.celebrate(kind,opts);
    }catch(_){}
  }

  function bodyPulse(cls, ms=220){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=> DOC.body.classList.remove(cls), ms);
    }catch(_){}
  }

  function centerXY(){
    const w = DOC.documentElement.clientWidth || innerWidth || 800;
    const h = DOC.documentElement.clientHeight || innerHeight || 600;
    return { x: Math.floor(w/2), y: Math.floor(h/2) };
  }

  // ----------------------- config -----------------------
  // Optional user override:
  // window.HHA_FX_CONFIG = { enabled:true, intensity:1, mute:false }
  const CFG = Object.assign({
    enabled: true,
    intensity: 1.0, // 0.6..1.4 recommended
    mute: false,    // if true => no particles (still body pulses minimal)
    maxPopPerSec: 14,
    maxBurstPerSec: 18,
    maxRingPerSec: 10,
  }, WIN.HHA_FX_CONFIG || {});

  // allow url flags: ?fx=0 or ?fx=1
  const fxQ = qs('fx', null);
  if(fxQ === '0') CFG.enabled = false;
  if(fxQ === '1') CFG.enabled = true;

  // ----------------------- rate limit -----------------------
  function makeLimiter(maxPerSec){
    let t0 = now();
    let used = 0;
    return function ok(){
      const t = now();
      if(t - t0 >= 1000){ t0 = t; used = 0; }
      used++;
      return used <= maxPerSec;
    };
  }
  const okPop = makeLimiter(CFG.maxPopPerSec);
  const okBurst = makeLimiter(CFG.maxBurstPerSec);
  const okRing = makeLimiter(CFG.maxRingPerSec);

  function safeXY(d){
    const w = DOC.documentElement.clientWidth || innerWidth || 800;
    const h = DOC.documentElement.clientHeight || innerHeight || 600;

    let x = Number(d?.x);
    let y = Number(d?.y);

    if(!Number.isFinite(x) || !Number.isFinite(y)){
      const c = centerXY();
      x = c.x; y = c.y;
    }
    x = clamp(x, 18, w-18);
    y = clamp(y, 18, h-18);
    return {x,y};
  }

  function emitTinyCoach(msg){
    // optional: forward to any coach UI listener
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail: { kind:'fx', msg } })); }catch(_){}
  }

  // ----------------------- event handlers -----------------------
  function onJudge(ev){
    if(!CFG.enabled) return;
    const d = ev?.detail || {};
    const type = String(d.type || '').toLowerCase(); // good/bad/perfect/miss/block
    const label = String(d.label || '').trim();
    const {x,y} = safeXY(d);

    const intensity = clamp(Number(CFG.intensity)||1, 0.4, 1.6);

    // subtle body cues
    if(type === 'bad') bodyPulse('hha-fx-bad', 180);
    else if(type === 'miss') bodyPulse('hha-fx-miss', 140);
    else if(type === 'perfect') bodyPulse('hha-fx-perfect', 180);

    if(CFG.mute) return;

    if(label && okPop()){
      const cls =
        (type==='bad') ? 'bad' :
        (type==='miss') ? 'bad' :
        (type==='block') ? 'cyan' :
        (type==='perfect') ? 'good' : 'good';
      pop(x,y,label,cls,{ size: Math.round(14 + 6*intensity) });
    }

    // particles
    if(okBurst()){
      const kind =
        (type==='bad' || type==='miss') ? 'bad' :
        (type==='block') ? 'shield' :
        (type==='perfect') ? 'star' : 'good';
      burst(x,y,kind,{ count: Math.round(8*intensity) });
    }
    if(okRing()){
      const kind =
        (type==='bad' || type==='miss') ? 'bad' :
        (type==='block') ? 'shield' :
        (type==='perfect') ? 'star' : 'good';
      ring(x,y,kind,{ size: Math.round(120 + 40*intensity) });
    }
  }

  function onStorm(ev){
    if(!CFG.enabled) return;
    const d = ev?.detail || {};
    const on = !!d.on;
    const c = centerXY();

    if(on){
      bodyPulse('hha-fx-storm', 420);
      emitTinyCoach('STORM! เป้าจะป่วนขึ้นเล็กน้อย');
      if(!CFG.mute){
        if(okRing()) ring(c.x, Math.floor(c.y*0.65), 'star', { size: 280 });
        if(okPop()) pop(c.x, Math.floor(c.y*0.62), 'STORM!', 'warn', { size: 22 });
        if(okBurst()) burst(c.x, Math.floor(c.y*0.65), 'star', { count: 18 });
      }
    }else{
      bodyPulse('hha-fx-storm-off', 220);
      if(!CFG.mute){
        if(okPop()) pop(c.x, Math.floor(c.y*0.62), 'CLEAR', 'good', { size: 16 });
      }
    }
  }

  function onBoss(ev){
    if(!CFG.enabled) return;
    const d = ev?.detail || {};
    const on = !!d.on;
    const phase = Number(d.phase || 0);
    const hp = Number(d.hp ?? 0);
    const hpMax = Number(d.hpMax ?? 0);
    const rage = !!d.rage;
    const c = centerXY();

    if(on){
      if(phase === 1){
        bodyPulse('hha-fx-boss', 520);
        emitTinyCoach('BOSS! โฟกัสดี ๆ');
        if(!CFG.mute){
          if(okRing()) ring(c.x, Math.floor(c.y*0.68), 'violet', { size: 320 });
          if(okPop()) pop(c.x, Math.floor(c.y*0.62), `BOSS! HP ${hp}/${hpMax}`, 'violet', { size: 20 });
        }
      }else if(phase === 2){
        bodyPulse('hha-fx-phase2', 520);
        emitTinyCoach('PHASE 2! เร็วขึ้น—แต่ยังแฟร์');
        if(!CFG.mute){
          if(okRing()) ring(c.x, Math.floor(c.y*0.68), 'bad', { size: 360 });
          if(okPop()) pop(c.x, Math.floor(c.y*0.62), `PHASE 2`, 'bad', { size: 22 });
        }
      }

      if(rage){
        bodyPulse('hha-fx-rage', 620);
        if(!CFG.mute && okPop()) pop(c.x, Math.floor(c.y*0.74), 'RAGE!', 'bad', { size: 18 });
      }
    }else{
      bodyPulse('hha-fx-boss-down', 520);
      emitTinyCoach('BOSS DOWN!');
      if(!CFG.mute){
        celebrate('boss', { count: 22 });
        if(okPop()) pop(c.x, Math.floor(c.y*0.62), 'BOSS DOWN!', 'good', { size: 22 });
      }
    }
  }

  function onEnd(ev){
    if(!CFG.enabled) return;
    const d = ev?.detail || {};
    const grade = String(d.grade || '').trim();
    const reason = String(d.reason || '').trim();
    const c = centerXY();

    bodyPulse('hha-fx-end', 520);

    if(CFG.mute) return;

    // celebrate depends on grade/reason
    const kind = (reason === 'missLimit') ? 'fail' : 'win';
    celebrate(kind, { count: (kind==='fail' ? 10 : 18) });

    if(okPop()){
      if(kind==='fail'){
        pop(c.x, Math.floor(c.y*0.62), 'GAME OVER', 'bad', { size: 24 });
      }else{
        const g = grade ? `GRADE ${grade}` : 'COMPLETED';
        pop(c.x, Math.floor(c.y*0.62), g, 'good', { size: 24 });
      }
    }
  }

  function onCelebrate(ev){
    if(!CFG.enabled) return;
    const d = ev?.detail || {};
    const kind = String(d.kind || 'win');
    if(CFG.mute) return;
    // gentle: don't explode every time
    if(kind === 'mini'){
      if(okBurst()) burst(centerXY().x, Math.floor(centerXY().y*0.60), 'star', { count: 12 });
    }else if(kind === 'boss'){
      celebrate('boss', { count: 22 });
    }else if(kind === 'end'){
      celebrate('win', { count: 18 });
    }
  }

  // ----------------------- bind events -----------------------
  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:storm', onStorm, { passive:true });
  WIN.addEventListener('hha:boss',  onBoss,  { passive:true });
  WIN.addEventListener('hha:end',   onEnd,   { passive:true });
  WIN.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  // Also listen on document (some games dispatch there)
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:storm', onStorm, { passive:true });
  DOC.addEventListener('hha:boss',  onBoss,  { passive:true });
  DOC.addEventListener('hha:end',   onEnd,   { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  // ----------------------- minimal css pulses (inject once) -----------------------
  try{
    const st = DOC.createElement('style');
    st.textContent = `
      body.hha-fx-bad{ animation: hhaBad .14s ease; }
      body.hha-fx-miss{ animation: hhaMiss .12s ease; }
      body.hha-fx-perfect{ animation: hhaOk .16s ease; }
      body.hha-fx-storm{ animation: hhaStorm .42s ease; }
      body.hha-fx-storm-off{ animation: hhaOk .18s ease; }
      body.hha-fx-boss{ animation: hhaBoss .52s ease; }
      body.hha-fx-phase2{ animation: hhaPhase2 .52s ease; }
      body.hha-fx-rage{ animation: hhaRage .62s ease; }
      body.hha-fx-boss-down{ animation: hhaOk .52s ease; }
      body.hha-fx-end{ animation: hhaEnd .52s ease; }

      @keyframes hhaBad{ 0%{ filter: none; } 40%{ filter: saturate(1.15) brightness(.98); } 100%{ filter:none; } }
      @keyframes hhaMiss{ 0%{ filter:none; } 40%{ filter: brightness(.98) contrast(1.06); } 100%{ filter:none; } }
      @keyframes hhaOk{ 0%{ filter:none; } 40%{ filter: saturate(1.06) brightness(1.02); } 100%{ filter:none; } }
      @keyframes hhaStorm{ 0%{ filter:none; } 40%{ filter: saturate(1.18); } 100%{ filter:none; } }
      @keyframes hhaBoss{ 0%{ filter:none; } 40%{ filter: saturate(1.12) contrast(1.06); } 100%{ filter:none; } }
      @keyframes hhaPhase2{ 0%{ filter:none; } 40%{ filter: saturate(1.20) contrast(1.10); } 100%{ filter:none; } }
      @keyframes hhaRage{ 0%{ filter:none; } 40%{ filter: saturate(1.25) contrast(1.12); } 100%{ filter:none; } }
      @keyframes hhaEnd{ 0%{ filter:none; } 40%{ filter: saturate(1.10) brightness(1.03); } 100%{ filter:none; } }
    `;
    DOC.head.appendChild(st);
  }catch(_){}

})();