// === /herohealth/hygiene-vr/hygiene.progression.js ===
// Season XP + Level (Local)
// - study/research: no gain/unlock by default (fair research)
// Exposes: window.HHA_HW_XP = { get(), addFromSummary(summary, opts), levelFromXp(xp), reset() }

'use strict';

(function(){
  const WIN = window;
  const K = 'HHA_HW_XP_STATE';

  function load(fb){
    try{ const s = localStorage.getItem(K); return s? JSON.parse(s): fb; }catch{ return fb; }
  }
  function save(obj){ try{ localStorage.setItem(K, JSON.stringify(obj)); }catch{} }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function levelFromXp(xp){
    xp = Math.max(0, Number(xp)||0);
    // Curve: level 1..: need grows slowly
    // L1:0, L2:120, L3:270, L4:450, L5:660 ...
    let lvl = 1, need = 0, step = 120;
    while(true){
      if(xp < need + step) break;
      xp -= step;
      lvl++;
      step = Math.round(step * 1.22); // growth
      if(lvl>50) break;
    }
    return { level:lvl, into:xp, step, pct: step? (xp/step):0 };
  }

  function get(){
    const st = load(null) || {};
    if(!st || typeof st !== 'object') return { xp:0, level:1, seasonId:'S1' };
    const xp = Math.max(0, Number(st.xp)||0);
    const L = levelFromXp(xp);
    return { xp, level:L.level, seasonId: st.seasonId || 'S1', progress:L };
  }

  function calcXp(summary){
    // Reward good behavior:
    // - accuracy dominates
    // - loops/boss reward
    // - penalize misses/haz
    const acc = clamp(summary.stepAcc, 0, 1);
    const loops = clamp(summary.loopsDone, 0, 99);
    const boss = clamp(summary.bossClears||0, 0, 99);
    const mini = clamp(summary.miniBossClears||0, 0, 99);
    const miss = clamp(summary.misses||0, 0, 999);
    const haz  = clamp(summary.hazHits||0, 0, 999);

    let xp = 40;
    xp += Math.round(acc * 160);
    xp += loops * 18;
    xp += boss * 60 + mini * 35;
    xp -= miss * 18 + haz * 12;
    xp = clamp(xp, 0, 260);
    return xp;
  }

  function addFromSummary(summary, opts={}){
    if(!summary || summary.game!=='hygiene') return { gained:0, state:get(), blocked:true };

    const runMode = String(summary.runMode||'play').toLowerCase();
    const allowInResearch = !!opts.allowInResearch;

    const blocked = (runMode !== 'play') && !allowInResearch;
    const gained = blocked ? 0 : calcXp(summary);

    const st0 = load({ xp:0, seasonId:'S1' });
    st0.xp = Math.max(0, Number(st0.xp)||0) + gained;

    save(st0);

    const st = get();

    WIN.dispatchEvent(new CustomEvent('hha:xp', { detail:{ gained, blocked, state:st } }));
    return { gained, blocked, state:st };
  }

  function reset(){ save({ xp:0, seasonId:'S1' }); }

  WIN.HHA_HW_XP = { get, addFromSummary, levelFromXp, reset };
})();