// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — ULTRA (shared across games)
// ✅ Listens to: hha:judge, hha:time, hha:score, hha:end, hha:celebrate, quest:update
// ✅ Standard states:
//    - storm: timeLeft <= 30s
//    - boss : miss >= 4
//    - rage : miss >= 5
// ✅ Uses window.Particles (particles.js) if present; otherwise safe no-op
// ✅ Adds body classes for CSS-driven FX: hha-storm, hha-boss, hha-rage, hha-hitgood, hha-hitbad, hha-tick
// ✅ Exposes: window.HHA_FX = { setMode, pulse, burstAt, pop, sparkle, celebrate }
// Notes:
// - Never throws.
// - Works for DOM games (GoodJunk/Groups/Hydration/Plate) and can co-exist with A-Frame scenes.
// - Keep z-index sane: fx layer uses z-index 190, your HUD can be 180–185.

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  const CFG = Object.assign({
    // Mode thresholds (as requested)
    stormTimeSec: 30,
    bossMiss: 4,
    rageMiss: 5,

    // Pulse durations
    pulseMs: 180,
    tickMs: 120,

    // Rate limits
    minJudgeGapMs: 70,
    minBigFxGapMs: 180,

    // Try to guess XY from event.detail
    // fallback to screen center
  }, root.HHA_FX_CONFIG || {});

  // --- safe Particles access ---
  function P(){ return root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles) || null; }
  function hasP(fn){
    const p = P();
    return !!(p && typeof p[fn] === 'function');
  }

  // --- class helpers ---
  function addC(c){
    try{ DOC.body && DOC.body.classList.add(c); }catch(_){}
  }
  function rmC(c){
    try{ DOC.body && DOC.body.classList.remove(c); }catch(_){}
  }
  function pulse(cls, ms){
    try{
      const b = DOC.body;
      if(!b) return;
      b.classList.add(cls);
      setTimeout(()=>{ try{ b.classList.remove(cls); }catch(_){} }, ms||CFG.pulseMs);
    }catch(_){}
  }

  function centerXY(){
    const w = DOC.documentElement?.clientWidth || root.innerWidth || 1000;
    const h = DOC.documentElement?.clientHeight|| root.innerHeight|| 700;
    return { x: Math.floor(w/2), y: Math.floor(h/2) };
  }

  function pickXY(detail){
    try{
      // allow: {x,y} or {clientX,clientY} or {px,py}
      const d = detail || {};
      let x = d.x ?? d.clientX ?? d.px ?? null;
      let y = d.y ?? d.clientY ?? d.py ?? null;

      // GoodJunk sometimes emits without XY; attempt target rect if id given
      if((x==null || y==null) && d.targetId){
        const el = DOC.querySelector(`[data-id="${CSS && CSS.escape ? CSS.escape(String(d.targetId)) : String(d.targetId)}"]`);
        if(el && el.getBoundingClientRect){
          const r = el.getBoundingClientRect();
          x = r.left + r.width/2;
          y = r.top  + r.height/2;
        }
      }

      if(x==null || y==null) return centerXY();
      return { x: Math.floor(Number(x)||0), y: Math.floor(Number(y)||0) };
    }catch(_){
      return centerXY();
    }
  }

  // --- FX wrappers ---
  function pop(x,y,text,cls){
    try{
      if(hasP('popText')) P().popText(x,y,text,cls);
    }catch(_){}
  }
  function burstAt(x,y,kind){
    try{
      const k = String(kind||'good');
      const cls =
        (k==='good') ? 'fx-good' :
        (k==='bad')  ? 'fx-bad' :
        (k==='star') ? 'fx-warn' :
        (k==='shield') ? 'fx-violet' :
        (k==='diamond')? 'fx-violet' :
        '';
      if(hasP('burst')) P().burst(x,y,{ cls });
      else if(hasP('sparkle')) P().sparkle(x,y,{ cls });
    }catch(_){}
  }
  function sparkle(x,y,kind){
    try{
      const cls =
        (kind==='star') ? 'fx-warn' :
        (kind==='shield'||kind==='diamond') ? 'fx-violet' :
        '';
      if(hasP('sparkle')) P().sparkle(x,y,{ cls });
      else if(hasP('burst')) P().burst(x,y,{ cls, n: 8, spread: 80 });
    }catch(_){}
  }
  function celebrate(kind){
    try{
      const k = String(kind||'end');
      const c = centerXY();
      if(hasP('celebrate')){
        P().celebrate({ x:c.x, y:Math.floor(c.y*0.60), n: (k==='end'? 34 : 24), cls:'fx-warn' });
      }else{
        pop(c.x, Math.floor(c.y*0.60), '🎉', 'fx-warn');
      }
    }catch(_){}
  }

  // --- mode / state ---
  const S = {
    timeLeft: null,
    miss: null,
    score: null,
    modeStorm: false,
    modeBoss: false,
    modeRage: false,
    lastJudgeAt: 0,
    lastBigAt: 0,
  };

  function applyModes(){
    const t = (S.timeLeft==null) ? null : Number(S.timeLeft);
    const m = (S.miss==null) ? null : Number(S.miss);

    const storm = (t!=null && t <= CFG.stormTimeSec);
    const boss  = (m!=null && m >= CFG.bossMiss);
    const rage  = (m!=null && m >= CFG.rageMiss);

    if(storm !== S.modeStorm){
      S.modeStorm = storm;
      if(storm) addC('hha-storm'); else rmC('hha-storm');
      if(storm) pulse('hha-storm-pop', 240);
    }
    if(boss !== S.modeBoss){
      S.modeBoss = boss;
      if(boss) addC('hha-boss'); else rmC('hha-boss');
      if(boss) pulse('hha-boss-pop', 240);
    }
    if(rage !== S.modeRage){
      S.modeRage = rage;
      if(rage) addC('hha-rage'); else rmC('hha-rage');
      if(rage) pulse('hha-rage-pop', 240);
    }

    // If rage -> boss implicitly; keep both classes (ok)
    if(S.modeRage) addC('hha-boss');
  }

  function setMode(name, on){
    try{
      const v = !!on;
      if(name==='storm'){ S.modeStorm=v; v?addC('hha-storm'):rmC('hha-storm'); }
      if(name==='boss'){ S.modeBoss=v; v?addC('hha-boss'):rmC('hha-boss'); }
      if(name==='rage'){ S.modeRage=v; v?addC('hha-rage'):rmC('hha-rage'); }
    }catch(_){}
  }

  // --- judge handler (main) ---
  function onJudge(ev){
    try{
      const tNow = now();
      if(tNow - S.lastJudgeAt < CFG.minJudgeGapMs) return;
      S.lastJudgeAt = tNow;

      const d = ev && ev.detail ? ev.detail : {};
      const label = String(d.label || d.kind || '').trim().toLowerCase();
      const xy = pickXY(d);

      // normalize kinds
      let kind = d.kind || null;
      if(!kind){
        if(label.includes('good')) kind='good';
        else if(label.includes('oops') || label.includes('miss') || label.includes('bad')) kind='bad';
        else if(label.includes('star')) kind='star';
        else if(label.includes('shield') || label.includes('block')) kind='shield';
        else if(label.includes('diamond')) kind='diamond';
        else if(label.includes('mini')) kind='mini';
        else if(label.includes('goal')) kind='goal';
      }
      kind = String(kind || '').toLowerCase();

      // small pulses (CSS-driven)
      if(kind==='good'){ pulse('hha-hitgood', CFG.pulseMs); }
      if(kind==='bad'){ pulse('hha-hitbad',  CFG.pulseMs); }
      if(kind==='shield'){ pulse('hha-hitshield', CFG.pulseMs); }
      if(kind==='star'){ pulse('hha-hitstar', CFG.pulseMs); }
      if(kind==='diamond'){ pulse('hha-hitdiamond', CFG.pulseMs); }

      // FX calls
      if(kind==='good'){
        burstAt(xy.x, xy.y, 'good');
        // optional text
        if(d.text) pop(xy.x, xy.y, d.text, 'fx-good');
      }else if(kind==='bad'){
        burstAt(xy.x, xy.y, 'bad');
        // more aggressive when rage
        if(S.modeRage && (tNow - S.lastBigAt > CFG.minBigFxGapMs)){
          S.lastBigAt = tNow;
          if(hasP('shockwave')) P().shockwave(xy.x, xy.y, { size: 64, color:'rgba(255,255,255,.45)', dur: 520, cls:'fx-bad' });
          pop(xy.x, xy.y, 'MISS!', 'fx-bad');
        }else{
          pop(xy.x, xy.y, d.text || 'OOPS', 'fx-bad');
        }
      }else if(kind==='shield'){
        sparkle(xy.x, xy.y, 'shield');
        pop(xy.x, xy.y, d.text || 'BLOCK', 'fx-violet');
      }else if(kind==='star'){
        sparkle(xy.x, xy.y, 'star');
        pop(xy.x, xy.y, d.text || 'MISS -1', 'fx-warn');
      }else if(kind==='diamond'){
        // diamond = big reward
        if(tNow - S.lastBigAt > CFG.minBigFxGapMs){
          S.lastBigAt = tNow;
          if(hasP('celebrate')) P().celebrate({ x: xy.x, y: xy.y, n: 20, cls:'fx-violet', dur: 900 });
          else burstAt(xy.x, xy.y, 'diamond');
        }else{
          burstAt(xy.x, xy.y, 'diamond');
        }
        pop(xy.x, xy.y, d.text || 'BONUS!', 'fx-violet');
      }else if(kind==='mini'){
        // mini clear
        if(tNow - S.lastBigAt > CFG.minBigFxGapMs){
          S.lastBigAt = tNow;
          celebrate('mini');
        }else{
          burstAt(xy.x, xy.y, 'star');
        }
        pop(xy.x, xy.y, d.text || 'MINI!', 'fx-warn');
      }else if(kind==='goal'){
        if(tNow - S.lastBigAt > CFG.minBigFxGapMs){
          S.lastBigAt = tNow;
          celebrate('goal');
        }
        pop(xy.x, xy.y, d.text || 'GOAL!', 'fx-warn');
      }else{
        // fallback
        if(d.text || d.label) pop(xy.x, xy.y, d.text || d.label, '');
      }
    }catch(_){}
  }

  // --- time handler (storm + ticking) ---
  function onTime(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      const tLeft = (d.t != null) ? Number(d.t) : (d.timeLeftSec != null ? Number(d.timeLeftSec) : null);
      if(tLeft == null || !Number.isFinite(tLeft)) return;

      S.timeLeft = tLeft;
      applyModes();

      // tick when very low time (<=5)
      if(tLeft <= 5){
        pulse('hha-tick', CFG.tickMs);
      }
    }catch(_){}
  }

  // --- score handler (optional) ---
  function onScore(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      const sc = (d.score != null) ? Number(d.score) : null;
      if(sc == null || !Number.isFinite(sc)) return;
      S.score = sc;
    }catch(_){}
  }

  // --- hook miss from hha:end OR hha:log OR custom ---
  function onEnd(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      // capture miss if present
      if(d.misses != null) S.miss = Number(d.misses);
      if(d.miss != null)   S.miss = Number(d.miss);
      applyModes();
      // end celebration
      celebrate('end');
      pulse('hha-end', 380);
    }catch(_){}
  }

  // quest update may include current miss (optional)
  function onQuest(ev){
    try{
      const d = ev && ev.detail ? ev.detail : {};
      if(d && d.stats && d.stats.miss != null){
        S.miss = Number(d.stats.miss);
        applyModes();
      }
    }catch(_){}
  }

  // External setter for miss (GoodJunk can call if needed)
  function setMiss(m){
    S.miss = Number(m);
    applyModes();
  }

  // --- listen ---
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:time',  onTime,  { passive:true });
  root.addEventListener('hha:score', onScore, { passive:true });
  root.addEventListener('hha:end',   onEnd,   { passive:true });
  root.addEventListener('hha:celebrate', (ev)=>{ try{ celebrate(ev?.detail?.kind || 'end'); }catch(_){} }, { passive:true });

  // optional
  root.addEventListener('quest:update', onQuest, { passive:true });

  // allow games to inform miss changes (if they want)
  root.addEventListener('hha:miss', (ev)=>{
    try{
      const m = ev?.detail?.miss;
      if(m!=null) setMiss(m);
    }catch(_){}
  }, { passive:true });

  // expose
  root.HHA_FX = {
    setMode,
    setMiss,
    pulse,
    burstAt,
    pop,
    sparkle,
    celebrate,
    _state: S,
  };

  // initial: ensure layer exists early (optional)
  try{
    if(hasP('ensureLayer')) P().ensureLayer();
  }catch(_){}
})(window);