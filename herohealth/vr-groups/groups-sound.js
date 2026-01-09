/* === /herohealth/vr-groups/groups.sound.js ===
GroupsVR Sound Router — PRODUCTION (Research-safe)
✅ Hooks: hha:judge, groups:progress, hha:end
✅ Uses: window.GroupsVR.Audio (audio.js)
✅ Rate-limit + priority (avoid spam)
✅ Auto OFF in run=research|practice unless ?sound=1
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;
  if (root.__HHA_GROUPS_SOUND_LOADED__) return;
  root.__HHA_GROUPS_SOUND_LOADED__ = true;

  const qs = (k, d=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  function runMode(){
    const r = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
    if (r.includes('research')) return 'research';
    if (r.includes('practice')) return 'practice';
    return 'play';
  }

  const CFG = Object.assign({
    enabled: true,

    // default: silent in research/practice
    silentInNonPlay: true,

    // allow override: ?sound=1
    allowOverrideOn: true,

    // limiter
    minGapMs: 70,        // any sound
    minGapHitMs: 55,     // hit sounds
    minGapBadMs: 90,     // bad/miss
    minGapBossMs: 140,   // boss

    // mix rules
    tickIntervalUrgentMs: 520,
    tickIntervalNormalMs: 760,

    // end behavior
    endCelebrateRank: ['S','SS','SSS'],
  }, root.HHA_GROUPS_SOUND_CONFIG || {});

  const RM = runMode();
  let enabled = CFG.enabled;

  // research/practice -> disable unless override ?sound=1
  if (CFG.silentInNonPlay && RM !== 'play') {
    enabled = false;
    if (CFG.allowOverrideOn){
      const s = String(qs('sound','0')||'0').toLowerCase();
      if (s === '1' || s === 'true') enabled = true;
    }
  }

  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.__sound = { enabled, runMode: RM };

  function A(){
    return root.GroupsVR && root.GroupsVR.Audio;
  }

  // ---------- Unlock policy ----------
  // call Audio.unlock on first user gesture
  let unlocked = false;
  function tryUnlock(){
    if (unlocked) return;
    const audio = A();
    try{
      if (audio && audio.unlock) audio.unlock();
      unlocked = true;
    }catch(_){}
  }

  // use pointerdown/touchstart/keydown
  DOC.addEventListener('pointerdown', tryUnlock, { passive:true, once:false });
  DOC.addEventListener('touchstart', tryUnlock, { passive:true, once:false });
  DOC.addEventListener('keydown', tryUnlock, { passive:true, once:false });

  // ---------- Limiter ----------
  const tNow = ()=> (root.performance && performance.now) ? performance.now() : Date.now();
  let lastAny = 0, lastHit = 0, lastBad = 0, lastBoss = 0;

  function allowAny(gap){
    const t = tNow();
    if (t - lastAny < gap) return false;
    lastAny = t;
    return true;
  }
  function allowHit(){
    const t = tNow();
    if (t - lastHit < CFG.minGapHitMs) return false;
    lastHit = t;
    return true;
  }
  function allowBad(){
    const t = tNow();
    if (t - lastBad < CFG.minGapBadMs) return false;
    lastBad = t;
    return true;
  }
  function allowBoss(){
    const t = tNow();
    if (t - lastBoss < CFG.minGapBossMs) return false;
    lastBoss = t;
    return true;
  }

  // ---------- Tick loop (urgent) ----------
  let tickTmr = 0;
  function tickLoop(){
    clearTimeout(tickTmr);
    if (!enabled) { tickTmr = setTimeout(tickLoop, 1200); return; }

    const audio = A();
    if (!audio) { tickTmr = setTimeout(tickLoop, 900); return; }

    const urgent =
      DOC.body.classList.contains('mini-urgent') ||
      DOC.body.classList.contains('groups-mini-urgent') ||
      DOC.body.classList.contains('groups-storm-urgent');

    // only tick if urgent
    if (urgent){
      tryUnlock();
      try{ audio.tick && audio.tick(); }catch(_){}
      tickTmr = setTimeout(tickLoop, CFG.tickIntervalUrgentMs);
    }else{
      tickTmr = setTimeout(tickLoop, CFG.tickIntervalNormalMs);
    }
  }
  tickLoop();

  // ---------- Event routing ----------
  root.addEventListener('hha:judge', (ev)=>{
    if (!enabled) return;
    const audio = A();
    if (!audio) return;

    const d = (ev && ev.detail) || {};
    const k = String(d.kind || '').toLowerCase();
    if (!k) return;

    // general limiter
    if (!allowAny(CFG.minGapMs)) return;

    tryUnlock();

    if (k === 'good' || k === 'celebrate'){
      if (!allowHit()) return;
      try{ audio.good && audio.good(); }catch(_){}
      return;
    }
    if (k === 'bad'){
      if (!allowBad()) return;
      try{ audio.bad && audio.bad(); }catch(_){}
      return;
    }
    if (k === 'miss'){
      if (!allowBad()) return;
      try{ audio.bad && audio.bad(); }catch(_){}
      return;
    }
    if (k === 'perfect'){
      if (!allowHit()) return;
      // reuse good for perfect
      try{ audio.good && audio.good(); }catch(_){}
      return;
    }
    if (k === 'storm'){
      if (!allowBoss()) return;
      try{ audio.storm && audio.storm(); }catch(_){}
      return;
    }
    if (k === 'boss'){
      if (!allowBoss()) return;
      try{ audio.boss && audio.boss(); }catch(_){}
      return;
    }
  }, { passive:true });

  root.addEventListener('groups:progress', (ev)=>{
    if (!enabled) return;
    const audio = A();
    if (!audio) return;

    const d = (ev && ev.detail) || {};
    const kind = String(d.kind || '').toLowerCase();

    tryUnlock();

    if (kind === 'storm_on'){
      if (!allowBoss()) return;
      try{ audio.storm && audio.storm(); }catch(_){}
    }
    if (kind === 'boss_spawn'){
      if (!allowBoss()) return;
      try{ audio.boss && audio.boss(); }catch(_){}
    }
    if (kind === 'boss_down'){
      if (!allowHit()) return;
      try{ audio.good && audio.good(); }catch(_){}
    }
    if (kind === 'perfect_switch'){
      if (!allowHit()) return;
      try{ audio.good && audio.good(); }catch(_){}
    }
  }, { passive:true });

  root.addEventListener('hha:end', (ev)=>{
    // always stop tick urgency classes
    try{
      DOC.body.classList.remove('mini-urgent','groups-mini-urgent','groups-storm-urgent');
    }catch(_){}

    if (!enabled) return;

    const audio = A();
    if (!audio) return;

    const d = (ev && ev.detail) || {};
    const rm = String(d.runMode || RM || 'play').toLowerCase();
    if (rm !== 'play') return;

    tryUnlock();

    // optional celebrate for S+
    const grade = String(d.grade || '').toUpperCase();
    if (CFG.endCelebrateRank.includes(grade)){
      try{ audio.good && audio.good(); }catch(_){}
      try{ audio.good && audio.good(); }catch(_){}
    }
  }, { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);