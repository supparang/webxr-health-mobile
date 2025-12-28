/* === /herohealth/vr-groups/groups-quests.js ===
Groups QuestDirector — STYLE-AWARE (hard/feel/mix)
- Emits quest:update (goal + mini)
- Exposes window.GroupsVR.QuestDirector { reset, getState }
- Tracks:
  - good hits via GroupsVR.GameEngine.getState()
  - perfect switches via hha:judge text 'PERFECT SWITCH!'
  - boss down via groups:progress kind 'boss_down'
  - storm cycle via groups:storm on/off
  - powerups via hha:judge text 'MAGNET!' / 'FREEZE!' and celebrate OVERDRIVE
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function styleFromAny(x){
    const s = String(x||'mix').toLowerCase();
    return (['hard','feel','mix'].includes(s) ? s : 'mix');
  }
  function diffFromAny(x){
    const d = String(x||'normal').toLowerCase();
    return (['easy','normal','hard'].includes(d) ? d : 'normal');
  }

  function thresholds(style, diff, runMode){
    style = styleFromAny(style);
    diff  = diffFromAny(diff);
    runMode = (String(runMode||'play').toLowerCase()==='research') ? 'research' : 'play';

    // base by diff
    let good = (diff==='easy'? 12 : diff==='hard'? 18 : 15);
    let combo= (diff==='easy'? 10 : diff==='hard'? 16 : 13);
    let perf = (diff==='easy'? 1  : diff==='hard'? 2  : 2);
    let boss = (diff==='hard'? 2 : 1);

    // style tuning
    if (style==='hard'){
      good += 6; combo += 4; perf += 1; boss += 0;
    } else if (style==='feel'){
      good -= 3; combo -= 2; perf -= 1; boss = 1;
    } else { // mix
      good += 0; combo += 0;
    }

    // research should be stable: do NOT reduce too much; keep fair
    if (runMode==='research'){
      good = Math.max(good, (diff==='hard'? 18 : 15));
      combo = Math.max(combo, (diff==='hard'? 16 : 13));
      perf = clamp(perf, 1, 3);
      boss = clamp(boss, 1, 2);
    }

    // minis
    let poofNeed = (style==='hard'? 6 : style==='feel'? 3 : 4);
    let stormNeed = (style==='hard'? 2 : 1);

    return { good, combo, perf, boss, poofNeed, stormNeed };
  }

  const Q = {
    runMode:'play',
    diff:'normal',
    style:'mix',
    startedAt:0,

    goalsTotal:3,
    goalsCleared:0,
    goalIndex:0,

    miniTotal:6,
    miniCleared:0,
    miniIndex:0,

    // tracked
    hitGood:0,
    hitAll:0,
    comboMax:0,
    misses:0,

    perfectSwitch:0,
    bossDown:0,

    stormOn:false,
    stormsCompleted:0,

    gotMagnet:false,
    gotFreeze:false,
    poofCount:0,
    gotOverdrive:false,

    // internal
    lastPollAt:0,
  };

  function goalDef(t){
    const th = thresholds(Q.style, Q.diff, Q.runMode);

    const goals = [
      { title:`เก็บอาหารถูกหมู่ ${th.good} ครั้ง`,    need: th.good,   get: ()=>Q.hitGood },
      { title:`ทำ PERFECT SWITCH ${th.perf} ครั้ง หรือ คอมโบ ${th.combo}`, need: 1, get: ()=>((Q.perfectSwitch>=th.perf)||(Q.comboMax>=th.combo)) ? 1 : 0,
        sub:`PERFECT ${Q.perfectSwitch}/${th.perf} • COMBO ${Q.comboMax}/${th.combo}`
      },
      { title:`โค่น BOSS ${th.boss} ตัว`,              need: th.boss,   get: ()=>Q.bossDown },
    ];
    return goals[t] || goals[0];
  }

  function miniDef(i){
    const th = thresholds(Q.style, Q.diff, Q.runMode);

    const minis = [
      { title:'เก็บ ⭐ เพื่อเปิด MAGNET', need:1, get: ()=> Q.gotMagnet ? 1 : 0 },
      { title:'เก็บ ❄️ เพื่อเปิด FREEZE', need:1, get: ()=> Q.gotFreeze ? 1 : 0 },
      { title:`ยิงตุ๊กตา POOF! ${th.poofNeed} ครั้ง`, need: th.poofNeed, get: ()=> Q.poofCount },
      { title:'ทำ OVERDRIVE x2 ให้ได้', need:1, get: ()=> Q.gotOverdrive ? 1 : 0 },
      { title:`ผ่านพายุ STORM ${th.stormNeed} รอบ`, need: th.stormNeed, get: ()=> Q.stormsCompleted },
      { title:'ทำคอมโบ 8 ระหว่างพายุ (หรือไม่โดนขยะ 8 วินาที)', need:1, get: ()=> (Q.comboMax>=8 ? 1 : 0) },
    ];
    return minis[i] || minis[0];
  }

  function pollEngine(){
    const eng = NS.GameEngine;
    if (!eng || typeof eng.getState !== 'function') return;

    const s = eng.getState();
    Q.hitGood = s.hitGood|0;
    Q.hitAll  = s.hitAll|0;
    Q.misses  = s.misses|0;
    Q.comboMax = Math.max(Q.comboMax|0, s.comboMax ? (s.comboMax|0) : 0);
  }

  function emitUpdate(){
    const g = goalDef(Q.goalIndex);
    const gVal = g.get();
    const gNeed = g.need;
    const gText = g.sub ? `${g.title} (${g.sub})` : g.title;

    const m = miniDef(Q.miniIndex);
    const mVal = m.get();
    const mNeed= m.need;

    emit('quest:update', {
      goalTitle: gText,
      goalProgress: gVal,
      goalNeed: gNeed,
      goalsCleared: Q.goalsCleared|0,
      goalsTotal: Q.goalsTotal|0,

      miniTitle: m.title,
      miniProgress: mVal,
      miniNeed: mNeed,
      miniCleared: Q.miniCleared|0,
      miniTotal: Q.miniTotal|0,

      diff: Q.diff,
      runMode: Q.runMode,
      style: Q.style,
    });
  }

  function checkGoal(){
    const g = goalDef(Q.goalIndex);
    const ok = (g.get() >= g.need);
    if (!ok) return false;

    Q.goalsCleared++;
    Q.goalIndex = Math.min(Q.goalIndex + 1, Q.goalsTotal-1);

    emit('hha:celebrate', { kind:'goal', title:`GOAL ${Q.goalsCleared}/${Q.goalsTotal} สำเร็จ!` });
    emitUpdate();
    return true;
  }

  function checkMini(){
    const m = miniDef(Q.miniIndex);
    const ok = (m.get() >= m.need);
    if (!ok) return false;

    Q.miniCleared++;
    Q.miniIndex = Math.min(Q.miniIndex + 1, Q.miniTotal-1);

    emit('hha:celebrate', { kind:'mini', title:`MINI ${Q.miniCleared}/${Q.miniTotal} สำเร็จ!` });
    emitUpdate();
    return true;
  }

  function reset(opts){
    opts = opts || {};
    Q.runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    Q.diff = diffFromAny(opts.diff || 'normal');
    Q.style = styleFromAny(opts.style || 'mix');

    Q.startedAt = now();

    Q.goalsCleared = 0;
    Q.goalIndex = 0;

    Q.miniCleared = 0;
    Q.miniIndex = 0;

    Q.hitGood = 0;
    Q.hitAll  = 0;
    Q.comboMax= 0;
    Q.misses  = 0;

    Q.perfectSwitch = 0;
    Q.bossDown = 0;

    Q.stormOn = false;
    Q.stormsCompleted = 0;

    Q.gotMagnet = false;
    Q.gotFreeze = false;
    Q.poofCount = 0;
    Q.gotOverdrive = false;

    Q.lastPollAt = 0;

    emitUpdate();
  }

  function getState(){
    return {
      goalsCleared: Q.goalsCleared|0,
      goalsTotal: Q.goalsTotal|0,
      miniCleared: Q.miniCleared|0,
      miniTotal: Q.miniTotal|0,
      style: Q.style,
      runMode: Q.runMode,
      diff: Q.diff,
      // extras (nice for logger)
      perfectSwitch: Q.perfectSwitch|0,
      bossDown: Q.bossDown|0,
      stormsCompleted: Q.stormsCompleted|0,
      hitGood: Q.hitGood|0,
      hitAll: Q.hitAll|0,
    };
  }

  // ---------- Event hooks ----------
  root.addEventListener('hha:score', ()=>{
    pollEngine();
    emitUpdate();
    checkMini();
    checkGoal();
  });

  root.addEventListener('hha:judge', (e)=>{
    const d = (e && e.detail) ? e.detail : {};
    const text = String(d.text||'').toUpperCase();

    if (text.includes('PERFECT SWITCH')) Q.perfectSwitch++;

    if (text.includes('MAGNET')) Q.gotMagnet = true;
    if (text.includes('FREEZE')) Q.gotFreeze = true;
    if (text.includes('POOF'))   Q.poofCount++;

    emitUpdate();
    checkMini();
    checkGoal();
  });

  root.addEventListener('hha:celebrate', (e)=>{
    const d = (e && e.detail) ? e.detail : {};
    const title = String(d.title||'').toUpperCase();
    if (title.includes('OVERDRIVE')) Q.gotOverdrive = true;

    emitUpdate();
    checkMini();
  });

  root.addEventListener('groups:progress', (e)=>{
    const d = (e && e.detail) ? e.detail : {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind === 'boss_down') Q.bossDown++;

    emitUpdate();
    checkGoal();
  });

  root.addEventListener('groups:storm', (e)=>{
    const d = (e && e.detail) ? e.detail : {};
    const on = !!d.on;

    // count completed cycle: on->off
    if (Q.stormOn && !on) Q.stormsCompleted++;
    Q.stormOn = on;

    emitUpdate();
    checkMini();
  });

  // expose
  NS.QuestDirector = { reset, getState };

  // initial reset from URL (safe)
  (function bootReset(){
    let sp; try{ sp = new URLSearchParams(location.search);}catch{ sp=new URLSearchParams(''); }
    reset({
      runMode: sp.get('run') || sp.get('mode') || 'play',
      diff: sp.get('diff') || 'normal',
      style: sp.get('style') || 'mix'
    });
  })();

})(typeof window !== 'undefined' ? window : globalThis);
