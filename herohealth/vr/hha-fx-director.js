// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Universal)
// ✅ Works with ../vr/particles.js (minimal or full)
// ✅ Listens: hha:judge, hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Adds body pulses / classes + safe rate-limit
// ✅ Boss++ hooks: sets body classes: gj-boss / gj-rage / gj-storm (generic also: hha-boss/hha-rage/hha-storm)
// ✅ Does NOT require per-game imports (plain script)

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function safeNum(x, d=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  }
  function clamp(v, a, b){
    v = safeNum(v, a);
    return v < a ? a : (v > b ? b : v);
  }
  function body(){ return DOC.body; }

  // Add a class briefly (pulse)
  function pulse(cls, ms=160){
    const b = body(); if(!b) return;
    b.classList.add(cls);
    setTimeout(()=>{ try{ b.classList.remove(cls); }catch(_){} }, ms);
  }

  // Persistent state classes (boss/storm/rage)
  function setStateClass(cls, on){
    const b = body(); if(!b) return;
    if(on) b.classList.add(cls);
    else b.classList.remove(cls);
  }

  // ------------------------------------------------------------
  // Particles fallback (if minimal particles.js only has popText)
  // ------------------------------------------------------------
  const P = root.Particles || {};
  function popText(x,y,text){
    try{
      if(P && typeof P.popText === 'function'){
        P.popText(x,y,text);
        return true;
      }
    }catch(_){}
    return false;
  }

  // Safe screen center pop
  function popCenter(text){
    const w = root.innerWidth || 360;
    const h = root.innerHeight || 640;
    popText(w*0.5, h*0.42, text);
  }

  // ------------------------------------------------------------
  // Rate limit (avoid spam)
  // ------------------------------------------------------------
  const RL = {
    judge: 0,
    score: 0,
    coach: 0,
    time: 0
  };
  function ok(key, gapMs){
    const t = now();
    if(t - (RL[key]||0) >= gapMs){
      RL[key] = t;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------
  // Interpret judge events across games
  // ------------------------------------------------------------
  function kindFromJudge(d){
    // Typical: good / junk / perfect / miss / block / expire / star / shield
    const k = String(d?.kind || d?.judge || d?.type || '').toLowerCase();
    if(k) return k;

    // fallback heuristics
    if(safeNum(d?.deltaMiss,0) > 0) return 'miss';
    if(safeNum(d?.deltaScore,0) < 0) return 'bad';
    if(safeNum(d?.deltaScore,0) > 0) return 'good';
    return 'tick';
  }

  // ------------------------------------------------------------
  // Boss/Storm/Rage state inference hooks
  // ------------------------------------------------------------
  // These can be driven explicitly by detail.phase/state, or inferred by tags.
  function updateCombatState(d){
    const state = String(d?.state || d?.phase || d?.mode || '').toLowerCase();
    const tag   = String(d?.tag || d?.flag || '').toLowerCase();

    // explicit on/off booleans supported too
    const bossOn  = (d?.boss === true) || state.includes('boss')  || tag.includes('boss');
    const rageOn  = (d?.rage === true) || state.includes('rage')  || tag.includes('rage');
    const stormOn = (d?.storm=== true) || state.includes('storm') || tag.includes('storm');

    // generic classes (all games)
    setStateClass('hha-boss', bossOn);
    setStateClass('hha-rage', rageOn);
    setStateClass('hha-storm', stormOn);

    // per GoodJunk hooks (css already has these)
    setStateClass('gj-boss', bossOn);
    setStateClass('gj-rage', rageOn);
    setStateClass('gj-storm', stormOn);
  }

  // ------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------
  function onJudge(ev){
    if(!ok('judge', 40)) return; // very fast events allowed but throttled
    const d = ev?.detail || null;
    const k = kindFromJudge(d);

    // Try to read screen position if provided
    const x = safeNum(d?.x, NaN);
    const y = safeNum(d?.y, NaN);
    const hasXY = Number.isFinite(x) && Number.isFinite(y);

    // state updates (boss/rage/storm)
    updateCombatState(d);

    // Core pulses (GoodJunk CSS listens to these too)
    if(k === 'junk' || k === 'bad'){
      pulse('gj-junk-hit', 240);
      pulse('hha-junk-hit', 240);
      if(hasXY) popText(x,y,'💥'); else popCenter('💥');
      return;
    }
    if(k === 'block' || k === 'guard'){
      pulse('hha-block', 160);
      if(hasXY) popText(x,y,'🛡️'); else popCenter('🛡️');
      return;
    }
    if(k === 'miss' || k === 'expire'){
      // GoodJunk uses good expired as miss too
      pulse('gj-good-expire', 190);
      pulse('hha-miss', 190);
      if(hasXY) popText(x,y,'⚠️'); else popCenter('⚠️');
      return;
    }
    if(k === 'perfect'){
      pulse('hha-perfect', 160);
      if(hasXY) popText(x,y,'✨'); else popCenter('✨');
      return;
    }
    if(k === 'star'){
      pulse('hha-star', 160);
      if(hasXY) popText(x,y,'⭐'); else popCenter('⭐');
      return;
    }
    if(k === 'shield'){
      pulse('hha-shield', 160);
      if(hasXY) popText(x,y,'🛡️+'); else popCenter('🛡️+');
      return;
    }
    if(k === 'mini' || k === 'mini_clear' || k === 'mini-clear'){
      pulse('gj-mini-clear', 240);
      pulse('hha-mini-clear', 240);
      if(hasXY) popText(x,y,'✅ MINI'); else popCenter('✅ MINI');
      return;
    }

    // default gentle tick
    pulse('gj-tick', 140);
    pulse('hha-tick', 140);
  }

  function onScore(ev){
    if(!ok('score', 120)) return;
    const d = ev?.detail || null;
    // optional: show score pop when big delta
    const ds = safeNum(d?.deltaScore, 0);
    if(Math.abs(ds) >= 80){
      popCenter(ds > 0 ? `+${ds}` : `${ds}`);
      pulse('hha-score-pop', 180);
    }
  }

  function onTime(ev){
    // time updates can be frequent; handle low-time carefully
    const d = ev?.detail || null;
    const tLeft = safeNum(d?.timeLeftSec, safeNum(d?.t, NaN));
    if(!Number.isFinite(tLeft)) return;

    // only react around last 6 seconds (you asked Phase2-6s)
    // 6..1 => lowtime ring already handled by game, but add body tint for drama
    if(tLeft <= 6 && tLeft > 1){
      if(ok('time', 220)){
        setStateClass('gj-lowtime', true);
        pulse('gj-tick', 120);
      }
    }
    if(tLeft <= 5){
      setStateClass('gj-lowtime5', true);
    }else{
      setStateClass('gj-lowtime5', false);
    }
    if(tLeft > 6){
      setStateClass('gj-lowtime', false);
      setStateClass('gj-lowtime5', false);
    }
  }

  function onQuestUpdate(ev){
    // update peek text? UI does that already; here we can celebrate milestones
    const d = ev?.detail || null;
    const goal = d?.goal || null;
    const mini = d?.mini || null;

    // Celebrate goal complete (generic hint)
    if(goal && goal.done === true){
      pulse('hha-goal-clear', 220);
      // limit celebration pop
      if(ok('coach', 420)) popCenter('🎯 GOAL ✅');
    }
    if(mini && mini.done === true){
      pulse('hha-mini-clear', 220);
      pulse('gj-mini-clear', 240);
      if(ok('coach', 420)) popCenter('✅ MINI!');
    }
  }

  function onCoach(ev){
    // optional sparkle when coach speaks (avoid spam)
    if(!ok('coach', 900)) return;
    const d = ev?.detail || null;
    const msg = String(d?.text || d?.msg || '').trim();
    if(!msg) return;
    pulse('hha-coach', 180);
    // short popup only
    const short = msg.length > 16 ? (msg.slice(0,16) + '…') : msg;
    popCenter('💬 ' + short);
  }

  function onEnd(ev){
    const d = ev?.detail || null;
    updateCombatState({ boss:false, rage:false, storm:false });

    // cleanup lowtime states
    setStateClass('gj-lowtime', false);
    setStateClass('gj-lowtime5', false);

    // final celebration pulse
    const reason = String(d?.reason || '').toLowerCase();
    if(reason === 'misslimit' || reason === 'gameover'){
      pulse('hha-end-bad', 240);
      popCenter('💥');
    }else{
      pulse('hha-end-good', 240);
      popCenter('🎉');
    }
  }

  // ------------------------------------------------------------
  // Bind listeners (window + document)
  // ------------------------------------------------------------
  function bind(target){
    try{
      target.addEventListener('hha:judge', onJudge, { passive:true });
      target.addEventListener('hha:score', onScore, { passive:true });
      target.addEventListener('hha:time',  onTime,  { passive:true });
      target.addEventListener('quest:update', onQuestUpdate, { passive:true });
      target.addEventListener('hha:coach', onCoach, { passive:true });
      target.addEventListener('hha:end', onEnd, { passive:true });
    }catch(_){}
  }
  bind(root);
  bind(DOC);

  // Also accept legacy/custom names if some game emits differently
  function alias(){
    root.addEventListener('hha:celebrate', (ev)=>{
      pulse('hha-mini-clear', 220);
      popCenter('🎉');
    }, { passive:true });
  }
  alias();

  // Debug helper (optional): press `\` to force a pop
  root.addEventListener('keydown', (e)=>{
    if(e.key === '\\'){
      popCenter('FX OK');
      pulse('hha-tick', 140);
    }
  }, { passive:true });

})(window);