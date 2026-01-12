// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Shared for ALL games)
// ✅ Rules (default):
//    - timeLeftSec <= 30  => STORM
//    - miss >= 4          => BOSS
//    - miss >= 5          => RAGE
// ✅ Boss model (optional): HP by diff 10/12/14, Phase2 lasts 6s
// ✅ Adds body classes: fx-storm, fx-boss, fx-rage, fx-lowtime, fx-hit-good, fx-hit-bad, fx-block, fx-mini, fx-end
// ✅ Hooks:
//    - listens: hha:time, hha:judge, quest:update, hha:end, hha:log
//    - exposes: window.HHA_FX.setBossHP(hp), window.HHA_FX.hitBoss(dmg=1), window.HHA_FX.reset()
// Config (optional):
//    window.HHA_FX_CFG = {
//      stormAtSec: 30,
//      bossAtMiss: 4,
//      rageAtMiss: 5,
//      lowTimeAtSec: 10,
//      pulseMs: 160,
//      bossHP: { easy:10, normal:12, hard:14 },
//      bossPhase2Sec: 6,
//      bossDmgPerGood: 1,
//      bossHitFxEvery: 1, // 1 = every hit
//    }

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const now = ()=> performance.now();

  const CFG = Object.assign({
    stormAtSec: 30,
    bossAtMiss: 4,
    rageAtMiss: 5,
    lowTimeAtSec: 10,
    pulseMs: 160,

    bossHP: { easy:10, normal:12, hard:14 },
    bossPhase2Sec: 6,
    bossDmgPerGood: 1,
    bossHitFxEvery: 1,
  }, root.HHA_FX_CFG || {});

  const B = DOC.body;

  // -------- state --------
  const S = {
    timeLeftSec: null,
    miss: 0,
    diff: 'normal',
    runMode: 'play',
    view: null,

    // boss model (optional)
    bossActive: false,
    bossRage: false,
    bossHP: 0,
    bossHPMax: 0,
    bossPhase: 1,
    bossPhase2Left: 0,

    // rate limits
    lastPulseAt: 0,
    lastJudgeAt: 0,
    lastStormBeatAt: 0,
  };

  // -------- helpers --------
  function setCls(name,on){
    try{ B.classList.toggle(name, !!on); }catch(_){}
  }
  function pulse(name, ms){
    ms = Math.max(60, Number(ms)||CFG.pulseMs);
    const t = now();
    // rate limit pulses per-class
    if(t - S.lastPulseAt < 55) return;
    S.lastPulseAt = t;

    try{
      B.classList.add(name);
      setTimeout(()=>{ try{ B.classList.remove(name); }catch(_){ } }, ms);
    }catch(_){}
  }

  function readQs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }

  function inferDiff(){
    const d = String(readQs('diff','normal')||'normal').toLowerCase();
    if(d==='easy'||d==='hard'||d==='normal') return d;
    return 'normal';
  }

  function ensureBossHP(){
    const map = CFG.bossHP || {easy:10,normal:12,hard:14};
    const hp = Number(map[S.diff] ?? map.normal ?? 12) || 12;
    S.bossHPMax = hp;
    if(!S.bossHP) S.bossHP = hp;
  }

  function enterStorm(on){
    setCls('fx-storm', on);
    if(on){
      // slight vignette for tension (if Particles supports)
      try{ root.Particles?.vignette?.(true, 1); }catch(_){}
    }else{
      try{ root.Particles?.vignette?.(false, 1); }catch(_){}
    }
  }

  function enterBoss(on){
    S.bossActive = !!on;
    setCls('fx-boss', on);
    if(on){
      ensureBossHP();
      // boss start boom
      try{ root.Particles?.burstAt?.(DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight*0.22, 'bad'); }catch(_){}
      pulse('fx-boss-in', 260);
    }else{
      S.bossPhase = 1;
      S.bossPhase2Left = 0;
      S.bossHP = 0;
      S.bossHPMax = 0;
      setCls('fx-boss-p2', false);
      setCls('fx-boss-dead', false);
    }
  }

  function enterRage(on){
    S.bossRage = !!on;
    setCls('fx-rage', on);
    if(on){
      try{ root.Particles?.vignette?.(true, 3); }catch(_){}
      pulse('fx-rage-in', 260);
    }else{
      // if boss still active, keep some vignette
      try{ root.Particles?.vignette?.(S.bossActive || (S.timeLeftSec!=null && S.timeLeftSec<=CFG.stormAtSec), S.bossActive?2:1); }catch(_){}
    }
  }

  function applyTimeFX(){
    const t = S.timeLeftSec;
    if(t == null) return;

    // low time (<=10) purely visual (separate from storm)
    setCls('fx-lowtime', t <= CFG.lowTimeAtSec);

    // storm
    enterStorm(t <= CFG.stormAtSec);

    // heartbeat beat for storm (visual tick)
    if(t <= CFG.stormAtSec){
      const nt = now();
      if(nt - S.lastStormBeatAt > (t<=10 ? 520 : 760)){
        S.lastStormBeatAt = nt;
        pulse('fx-storm-beat', 140);
      }
    }
  }

  function applyMissFX(){
    // boss trigger
    if(!S.bossActive && S.miss >= CFG.bossAtMiss){
      enterBoss(true);
    }
    // rage trigger
    if(!S.bossRage && S.miss >= CFG.rageAtMiss){
      enterRage(true);
    }
  }

  // -------- boss damage model (optional hook) --------
  function hitBoss(dmg=1){
    if(!S.bossActive) return;
    ensureBossHP();

    dmg = Math.max(0, Number(dmg)||1);
    S.bossHP = clamp(S.bossHP - dmg, 0, S.bossHPMax);

    // hit feedback
    pulse('fx-boss-hit', 120);

    // Phase2 when HP low (<= 40%) => lasts 6s
    if(S.bossPhase === 1 && S.bossHPMax > 0 && (S.bossHP / S.bossHPMax) <= 0.40){
      S.bossPhase = 2;
      S.bossPhase2Left = CFG.bossPhase2Sec;
      setCls('fx-boss-p2', true);
      pulse('fx-boss-p2-in', 220);
      try{ root.Particles?.burstAt?.(DOC.documentElement.clientWidth/2, DOC.documentElement.clientHeight*0.22, 'diamond'); }catch(_){}
    }

    // dead
    if(S.bossHP <= 0){
      setCls('fx-boss-dead', true);
      pulse('fx-boss-dead', 320);
      try{ root.Particles?.celebrate?.('boss'); }catch(_){}
      // keep class for a moment then exit boss mode
      setTimeout(()=> enterBoss(false), 900);
    }
  }

  function setBossHP(hp){
    S.bossHP = Math.max(0, Number(hp)||0);
    S.bossHPMax = Math.max(S.bossHPMax, S.bossHP);
  }

  // -------- event handlers --------
  function onTime(ev){
    const d = ev?.detail || {};
    const t = Number(d.t);
    if(Number.isFinite(t)){
      S.timeLeftSec = t;
      applyTimeFX();
      // phase2 countdown (boss)
      if(S.bossActive && S.bossPhase === 2 && S.bossPhase2Left > 0){
        // decrease roughly by delta? we only have absolute time, so do coarse tick
        S.bossPhase2Left = Math.max(0, S.bossPhase2Left - 0.25);
        if(S.bossPhase2Left <= 0){
          // phase2 ends but boss continues
          setCls('fx-boss-p2', false);
          S.bossPhase = 1; // allow re-enter? keep simple: drop to phase1 visuals
        }
      }
    }
  }

  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || '').toLowerCase();
    const t = now();
    if(t - S.lastJudgeAt < 35) return;
    S.lastJudgeAt = t;

    if(label.includes('good') || label.includes('perfect') || label.includes('nice')){
      pulse('fx-hit-good', 120);
      // optional: boss takes damage when player hits good during boss/rage
      if(S.bossActive){
        hitBoss(CFG.bossDmgPerGood || 1);
      }
      return;
    }
    if(label.includes('oops') || label.includes('miss') || label.includes('bad')){
      pulse('fx-hit-bad', 140);
      return;
    }
    if(label.includes('block')){
      pulse('fx-block', 120);
      return;
    }
    if(label.includes('mini')){
      pulse('fx-mini', 240);
      try{ root.Particles?.celebrate?.('mini'); }catch(_){}
      return;
    }
    if(label.includes('goal')){
      pulse('fx-goal', 220);
      return;
    }
  }

  function onLog(ev){
    // allow game to feed miss changes via hha:log {type:'miss', value:n}
    const d = ev?.detail || {};
    if(d && d.type === 'miss'){
      const m = Number(d.value);
      if(Number.isFinite(m)){
        S.miss = Math.max(0, Math.floor(m));
        applyMissFX();
      }
    }
    // allow explicit mode info
    if(d && d.type === 'meta'){
      if(d.diff) S.diff = String(d.diff).toLowerCase();
      if(d.runMode) S.runMode = String(d.runMode).toLowerCase();
    }
  }

  function onEnd(){
    setCls('fx-end', true);
    pulse('fx-end-in', 380);
    try{ root.Particles?.celebrate?.('end'); }catch(_){}
    setTimeout(()=> setCls('fx-end', false), 1600);
    // soften overlays
    try{ root.Particles?.vignette?.(false, 1); }catch(_){}
  }

  function onQuestUpdate(ev){
    // no heavy logic, but gives consistent tiny pulse
    const d = ev?.detail || {};
    if(d && d.mini && d.mini.done){
      pulse('fx-mini', 220);
    }
  }

  // -------- init --------
  function init(){
    S.diff = inferDiff();
    S.runMode = String(readQs('run','play')||'play').toLowerCase();

    // allow view from body dataset (boot may set)
    S.view = DOC.body?.dataset?.view || readQs('view', null);

    // listen events
    root.addEventListener('hha:time', onTime, { passive:true });
    root.addEventListener('hha:judge', onJudge, { passive:true });
    root.addEventListener('quest:update', onQuestUpdate, { passive:true });
    root.addEventListener('hha:end', onEnd, { passive:true });
    root.addEventListener('hha:log', onLog, { passive:true });

    // initial FX reset
    setCls('fx-storm', false);
    setCls('fx-boss', false);
    setCls('fx-rage', false);
    setCls('fx-lowtime', false);
    setCls('fx-end', false);
  }

  // public hooks for games
  root.HHA_FX = {
    reset(){
      enterStorm(false);
      enterBoss(false);
      enterRage(false);
      setCls('fx-lowtime', false);
      setCls('fx-end', false);
    },
    setMiss(m){
      S.miss = Math.max(0, Math.floor(Number(m)||0));
      applyMissFX();
    },
    setTimeLeft(t){
      S.timeLeftSec = Number(t);
      applyTimeFX();
    },
    setBossHP,
    hitBoss,
    getState(){
      return JSON.parse(JSON.stringify({
        timeLeftSec:S.timeLeftSec, miss:S.miss, diff:S.diff,
        bossActive:S.bossActive, bossRage:S.bossRage,
        bossHP:S.bossHP, bossHPMax:S.bossHPMax,
        bossPhase:S.bossPhase, bossPhase2Left:S.bossPhase2Left
      }));
    }
  };

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
  else init();

})(window);