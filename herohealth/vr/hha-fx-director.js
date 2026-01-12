// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — ULTRA (shared event->FX router for ALL games)
// ✅ Requires: /vr/particles.js (Particles.scorePop/burstAt/shockwave/celebrate)
// ✅ Listens to: hha:judge, hha:celebrate, hha:score, hha:time, quest:update, hha:end, hha:enter-vr, hha:exit-vr
// ✅ Adds body classes: fx-storm, fx-boss, fx-rage, fx-lowtime, fx-hit, fx-miss, fx-block, fx-perfect, fx-combo
// ✅ Rate-limited to prevent spam on mobile
// ✅ Deterministic-friendly (no gameplay logic) — purely visuals

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const CFG = Object.assign({
    // thresholds (can override per game via window.HHA_FX_CONFIG)
    stormAtSec: 30,
    lowAtSec: 10,
    bossMissAt: 4,
    rageMissAt: 5,

    // intensity
    comboShockEvery: 6,         // combo step triggers small shockwave
    perfectRtMs: 320,           // if provided by game, treat <= as perfect
    judgeToastMaxPerSec: 6,     // limit judge label pops
    burstMaxPerSec: 10,         // limit bursts
    classPulseMs: 180,          // body pulse length
    stormPulseEveryMs: 650,     // periodic storm pulse

    // positioning fallback
    popDefaultX: 0.5,
    popDefaultY: 0.38,
  }, root.HHA_FX_CONFIG || {});

  // --------------------------------------------
  // helpers
  // --------------------------------------------
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };

  function P(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function vw(v){ return doc.documentElement.clientWidth * v; }
  function vh(v){ return doc.documentElement.clientHeight * v; }

  function centerXY(){
    return {
      x: Math.round(vw(CFG.popDefaultX)),
      y: Math.round(vh(CFG.popDefaultY)),
    };
  }

  function pulseBody(cls, ms){
    ms = ms || CFG.classPulseMs;
    try{
      doc.body.classList.add(cls);
      setTimeout(()=>{ try{ doc.body.classList.remove(cls); }catch(_){ } }, ms);
    }catch(_){}
  }

  // rate limiter
  function makeRate(maxPerSec){
    let t0 = now();
    let n = 0;
    return function allow(){
      const t = now();
      if(t - t0 >= 1000){
        t0 = t; n = 0;
      }
      if(n >= maxPerSec) return false;
      n++;
      return true;
    };
  }
  const allowJudge = makeRate(CFG.judgeToastMaxPerSec);
  const allowBurst = makeRate(CFG.burstMaxPerSec);

  // --------------------------------------------
  // state derived from events (visual only)
  // --------------------------------------------
  const S = {
    timeLeftSec: null,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    goal: null,
    mini: null,
    view: (doc.body && doc.body.dataset && doc.body.dataset.view) || qs('view', null),

    stormOn: false,
    bossOn: false,
    rageOn: false,
    lowOn: false,

    lastStormPulseAt: 0,
  };

  function setFlag(cls, on){
    try{
      doc.body.classList.toggle(cls, !!on);
    }catch(_){}
  }

  function recomputePhases(){
    const t = Number(S.timeLeftSec);
    const miss = Number(S.misses) || 0;

    const stormOn = (Number.isFinite(t) && t <= CFG.stormAtSec && t > 0);
    const lowOn   = (Number.isFinite(t) && t <= CFG.lowAtSec && t > 0);
    const bossOn  = (miss >= CFG.bossMissAt);
    const rageOn  = (miss >= CFG.rageMissAt);

    S.stormOn = !!stormOn;
    S.lowOn   = !!lowOn;
    S.bossOn  = !!bossOn;
    S.rageOn  = !!rageOn;

    setFlag('fx-storm', S.stormOn);
    setFlag('fx-lowtime', S.lowOn);
    setFlag('fx-boss', S.bossOn);
    setFlag('fx-rage', S.rageOn);
  }

  // --------------------------------------------
  // FX primitives (safe)
  // --------------------------------------------
  function scorePopAt(x,y,text, cls){
    const p = P();
    if(!p) return;
    try{
      if(typeof p.scorePop === 'function') p.scorePop(x,y,text, cls);
      else if(typeof p.popText === 'function') p.popText(x,y,text);
    }catch(_){}
  }

  function burstAt(x,y,kind){
    const p = P();
    if(!p) return;
    try{
      if(typeof p.burstAt === 'function') p.burstAt(x,y,kind);
    }catch(_){}
  }

  function shockAt(x,y,kind){
    const p = P();
    if(!p) return;
    try{
      if(typeof p.shockwave === 'function') p.shockwave(x,y,kind);
    }catch(_){}
  }

  function celebrate(kind){
    const p = P();
    if(!p) return;
    try{
      if(typeof p.celebrate === 'function') p.celebrate(kind);
    }catch(_){}
  }

  function smartXY(detail){
    // try clientX/Y, else x/y, else center
    const cx = Number(detail?.clientX);
    const cy = Number(detail?.clientY);
    if(Number.isFinite(cx) && Number.isFinite(cy)) return { x: Math.round(cx), y: Math.round(cy) };

    const x = Number(detail?.x);
    const y = Number(detail?.y);
    if(Number.isFinite(x) && Number.isFinite(y)) return { x: Math.round(x), y: Math.round(y) };

    return centerXY();
  }

  // --------------------------------------------
  // Event handlers
  // --------------------------------------------
  function onTime(ev){
    const t = Number(ev?.detail?.t ?? ev?.detail?.timeLeftSec ?? ev?.detail?.timeLeft ?? ev?.detail?.sec);
    if(!Number.isFinite(t)) return;
    S.timeLeftSec = t;
    recomputePhases();

    // storm periodic pulse
    if(S.stormOn){
      const tt = now();
      if(tt - S.lastStormPulseAt >= CFG.stormPulseEveryMs){
        S.lastStormPulseAt = tt;
        pulseBody('fx-storm-pulse', 140);
      }
    }
  }

  function onScore(ev){
    // optional: score/combo/miss info
    const d = ev?.detail || {};
    if(Number.isFinite(Number(d.score))) S.score = Number(d.score);
    if(Number.isFinite(Number(d.combo))) S.combo = Number(d.combo);
    if(Number.isFinite(Number(d.comboMax))) S.comboMax = Number(d.comboMax);
    if(Number.isFinite(Number(d.misses))) S.misses = Number(d.misses);
    recomputePhases();

    // combo wave
    if(S.combo > 0 && (S.combo % CFG.comboShockEvery) === 0){
      const c = centerXY();
      if(allowBurst()) shockAt(c.x, c.y, 'good');
      pulseBody('fx-combo', 120);
    }
  }

  function onQuestUpdate(ev){
    const d = ev?.detail || {};
    S.goal = d.goal || S.goal;
    S.mini = d.mini || S.mini;
  }

  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || d.msg || '').trim();
    if(!label) return;

    // update state if provided
    if(Number.isFinite(Number(d.misses))) S.misses = Number(d.misses);
    if(Number.isFinite(Number(d.timeLeftSec))) S.timeLeftSec = Number(d.timeLeftSec);
    recomputePhases();

    // pick visual type from label
    const L = label.toLowerCase();
    const xy = smartXY(d);

    if(!allowJudge()) return;

    if(L.includes('miss') || L.includes('oops') || L.includes('เสีย')){
      pulseBody('fx-miss', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'bad');
      scorePopAt(xy.x, xy.y, label, 'bad');
      return;
    }

    if(L.includes('block')){
      pulseBody('fx-block', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'block');
      scorePopAt(xy.x, xy.y, label, 'shield');
      return;
    }

    if(L.includes('star')){
      pulseBody('fx-hit', 120);
      if(allowBurst()) burstAt(xy.x, xy.y, 'star');
      scorePopAt(xy.x, xy.y, label, 'star');
      return;
    }

    if(L.includes('shield')){
      pulseBody('fx-hit', 120);
      if(allowBurst()) burstAt(xy.x, xy.y, 'shield');
      scorePopAt(xy.x, xy.y, label, 'shield');
      return;
    }

    if(L.includes('diamond')){
      pulseBody('fx-perfect', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'diamond');
      scorePopAt(xy.x, xy.y, label, 'diamond');
      return;
    }

    if(L.includes('goal')){
      pulseBody('fx-perfect', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'good');
      scorePopAt(xy.x, xy.y, label, 'good');
      return;
    }

    if(L.includes('mini')){
      pulseBody('fx-perfect', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'star');
      scorePopAt(xy.x, xy.y, label, 'star');
      return;
    }

    if(L.includes('fast')){
      pulseBody('fx-perfect', 160);
      if(allowBurst()) burstAt(xy.x, xy.y, 'star');
      scorePopAt(xy.x, xy.y, label, 'star');
      return;
    }

    // default: GOOD
    pulseBody('fx-hit', 120);
    if(allowBurst()) burstAt(xy.x, xy.y, 'good');
    scorePopAt(xy.x, xy.y, label, 'good');
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || 'end');
    celebrate(kind);

    // boss/rage emphasis
    if(kind === 'boss'){
      pulseBody('fx-boss', 240);
    }else if(kind === 'end'){
      pulseBody('fx-perfect', 220);
    }else if(kind === 'mini'){
      pulseBody('fx-perfect', 200);
    }
  }

  function onEnd(ev){
    // end summary -> celebrate
    const d = ev?.detail || {};
    // keep misses/time for class toggles
    if(Number.isFinite(Number(d.misses))) S.misses = Number(d.misses);
    if(Number.isFinite(Number(d.durationPlayedSec)) && Number.isFinite(Number(d.durationPlannedSec))){
      // nothing
    }
    // end visuals
    celebrate('end');
    pulseBody('fx-end', 360);
  }

  function onViewChange(){
    // optional: reflect view
    try{
      S.view = (doc.body && doc.body.dataset && doc.body.dataset.view) || S.view;
    }catch(_){}
  }

  // --------------------------------------------
  // Bind listeners (window + document)
  // --------------------------------------------
  function bind(target){
    if(!target || !target.addEventListener) return;

    target.addEventListener('hha:time', onTime, { passive:true });
    target.addEventListener('quest:update', onQuestUpdate, { passive:true });

    target.addEventListener('hha:score', onScore, { passive:true });
    target.addEventListener('hha:judge', onJudge, { passive:true });
    target.addEventListener('hha:celebrate', onCelebrate, { passive:true });
    target.addEventListener('hha:end', onEnd, { passive:true });

    target.addEventListener('hha:enter-vr', onViewChange, { passive:true });
    target.addEventListener('hha:exit-vr', onViewChange, { passive:true });
    target.addEventListener('hha:view', onViewChange, { passive:true });
  }

  bind(root);
  bind(doc);

  // --------------------------------------------
  // Bootstrap: add base class & initial flags
  // --------------------------------------------
  try{ doc.body.classList.add('hha-fx'); }catch(_){}
  recomputePhases();

})(window);