/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest System (Goals sequential + Minis chain)
✅ Listens: window 'groups:progress' (from GameEngine.js)
   - kind: 'hit_good'|'hit_bad'|'combo'|'group_swap'|'perfect_switch'|'storm_on'|'storm_off'|'boss_spawn'|'boss_down'
   - type: 'hit' {correct:boolean} (fallback; e.g., star/ice/boss)
✅ Emits: 'quest:update' (for HUD) + 'hha:celebrate' (fx) + optional 'hha:coach'
✅ Deterministic mini order by seed (important for research)
✅ Minis have timers + urgent flag (<= 3s)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});

  const emit = (name, detail)=>{
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
  };

  // ---------- Seeded RNG ----------
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const g = xmur3(seed);
    return sfc32(g(), g(), g(), g());
  }
  function shuffle(arr, rng){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor((rng ? rng() : Math.random()) * (i+1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------- Helpers ----------
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function normDiff(d){
    d = String(d||'normal').toLowerCase();
    return (d==='easy'||d==='hard'||d==='normal') ? d : 'normal';
  }

  // ---------- Goal params ----------
  function goalPlan(diff){
    diff = normDiff(diff);
    // โฟกัส “สลับหมู่” เป็นแกนหลัก + boss/combo เป็นความเร้าใจ
    if (diff === 'easy'){
      return [
        { id:'swap',  title:'สลับหมู่ให้สำเร็จ', target:3, icon:'🔁' },
        { id:'boss',  title:'โค่นบอสให้ได้',   target:1, icon:'👑' },
        { id:'combo', title:'ทำคอมโบสูงสุดให้ถึง', target:10, icon:'🔥' },
      ];
    }
    if (diff === 'hard'){
      return [
        { id:'swap',  title:'สลับหมู่ให้สำเร็จ', target:5, icon:'🔁' },
        { id:'boss',  title:'โค่นบอสให้ได้',   target:2, icon:'👑' },
        { id:'combo', title:'ทำคอมโบสูงสุดให้ถึง', target:18, icon:'🔥' },
      ];
    }
    return [
      { id:'swap',  title:'สลับหมู่ให้สำเร็จ', target:4, icon:'🔁' },
      { id:'boss',  title:'โค่นบอสให้ได้',   target:1, icon:'👑' },
      { id:'combo', title:'ทำคอมโบสูงสุดให้ถึง', target:14, icon:'🔥' },
    ];
  }

  // ---------- Mini library ----------
  function miniLibrary(diff){
    diff = normDiff(diff);
    // เวลา/เงื่อนไขเพิ่มความกดดันตาม diff
    const noJunkSec = (diff==='easy') ? 7 : (diff==='hard') ? 10 : 8;
    const bossSec   = (diff==='easy') ? 12 : (diff==='hard') ? 9 : 10;
    const streakHit = (diff==='easy') ? 8 : (diff==='hard') ? 12 : 10;
    const stormNeed = (diff==='easy') ? 4 : (diff==='hard') ? 7 : 5;

    return [
      {
        id:'nojunk',
        title:`No-Junk Rush`,
        desc:`ห้ามพลาด/โดนขยะ ${noJunkSec} วิ`,
        kind:'timer',
        target: noJunkSec,
        icon:'🚫🍟'
      },
      {
        id:'perfect',
        title:`Perfect Switch`,
        desc:`สลับหมู่แบบเพอร์เฟกต์ 1 ครั้ง`,
        kind:'count',
        target: 1,
        icon:'✨'
      },
      {
        id:'streak',
        title:`Combo Streak`,
        desc:`ทำ hit ต่อเนื่อง ${streakHit} ครั้ง (ห้ามพลาด)`,
        kind:'count',
        target: streakHit,
        icon:'🔥'
      },
      {
        id:'storm',
        title:`Storm Survivor`,
        desc:`ช่วง STORM ต้อง hit ให้ได้ ${stormNeed} ครั้ง และห้ามพลาด`,
        kind:'storm',
        target: stormNeed,
        icon:'⛈️'
      },
      {
        id:'bossrush',
        title:`Boss Rush`,
        desc:`เมื่อบอสโผล่ ต้องโค่นให้ได้ใน ${bossSec} วิ`,
        kind:'boss',
        target: 1,
        extra: bossSec,
        icon:'👑'
      },
      {
        id:'clean10',
        title:`Clean 10`,
        desc:`เก็บดีให้ได้ 10 ครั้งภายในเวลา (ห้ามพลาด)`,
        kind:'count_timer',
        target: 10,
        extra: (diff==='easy') ? 14 : (diff==='hard') ? 10 : 12,
        icon:'✅'
      }
    ];
  }

  // ---------- Quest factory ----------
  NS.createGroupsQuest = function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff = normDiff(opts.diff);
    const seed = String(opts.seed || 'seed');

    const rng = makeRng(seed + '|groupsQuest|' + diff + '|' + runMode);

    // Goal state
    const goalDefs = goalPlan(diff);
    const goalsAll = goalDefs.map(g=>({
      id:g.id,
      title:g.title,
      icon:g.icon||'🎯',
      target: Math.max(1, g.target|0),
      cur: 0,
      done:false
    }));

    // Mini state
    const miniDefs = shuffle(miniLibrary(diff), rng);
    const minisAll = miniDefs.map(m=>({
      id:m.id,
      title:m.title,
      desc:m.desc,
      icon:m.icon||'⭐',
      kind:m.kind,
      target: Math.max(1, m.target|0),
      extra: m.extra || 0,
      cur: 0,
      done:false,
      failed:false,
      // timers
      startMs:0,
      endMs:0,
      leftSec:0,
      urgent:false,
      // storm/boss flags
      inStorm:false,
      bossArmed:false,
      bossDeadline:0,
    }));

    const Q = {
      started:false,
      stopped:false,

      goalIndex:0,
      miniIndex:0,

      goalsCleared:0,
      miniCleared:0,

      // runtime trackers
      comboNow:0,
      comboMax:0,
      hitStreak:0,
      lastHitMs:0,

      // active references
      get activeGoal(){ return goalsAll[Q.goalIndex] || null; },
      get activeMini(){ return minisAll[Q.miniIndex] || null; },

      // ticker
      _tickTimer:0,
      _lastPushAt:0,
    };

    // ---------- Emit helpers ----------
    function pushUpdate(force){
      const t = now();
      if (!force && (t - Q._lastPushAt < 120)) return;
      Q._lastPushAt = t;

      const g = Q.activeGoal;
      const m = Q.activeMini;

      const gObj = g ? {
        title: `${g.icon} ${g.title}`,
        cur: g.cur|0,
        target: g.target|0,
        done: !!g.done,
        pct: g.target ? Math.round((g.cur/g.target)*100) : 0
      } : null;

      const mObj = m ? {
        title: `${m.icon} ${m.title}`,
        desc: m.desc,
        cur: m.cur|0,
        target: m.target|0,
        done: !!m.done,
        failed: !!m.failed,
        leftSec: m.leftSec|0,
        urgent: !!m.urgent,
        pct: m.target ? Math.round((m.cur/m.target)*100) : 0
      } : null;

      emit('quest:update', {
        goal: gObj,
        mini: mObj,
        goalsCleared: Q.goalsCleared|0,
        goalsTotal: goalsAll.length|0,
        miniCleared: Q.miniCleared|0,
        miniTotal: minisAll.length|0
      });
    }

    function celebrate(kind, title){
      emit('hha:celebrate', { kind: kind || 'mini', title: title || 'Nice!' });
    }

    function coach(text, mood){
      emit('hha:coach', { text: String(text||''), mood: mood||'happy' });
    }

    // ---------- Goal logic ----------
    function goalAdvance(){
      const g = Q.activeGoal;
      if (!g || g.done) return;

      g.done = true;
      Q.goalsCleared++;

      celebrate('goal', `GOAL CLEAR! (${Q.goalsCleared}/${goalsAll.length})`);
      coach(`เก่งมาก! ผ่าน Goal แล้ว 🎉`, 'happy');

      Q.goalIndex = Math.min(goalsAll.length, Q.goalIndex + 1);
      pushUpdate(true);

      // all goals done -> still allow minis but show end-ready
      if (!Q.activeGoal){
        celebrate('goal', `ALL GOALS COMPLETE!`);
        coach(`สุดยอด! ผ่าน Goal ครบแล้ว ✅`, 'happy');
      }
    }

    function goalProgressSwap(){
      const g = Q.activeGoal;
      if (!g || g.done) return;
      if (g.id !== 'swap') return;
      g.cur = clamp(g.cur + 1, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate(true);
    }

    function goalProgressBossDown(){
      const g = Q.activeGoal;
      if (!g || g.done) return;
      if (g.id !== 'boss') return;
      g.cur = clamp(g.cur + 1, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate(true);
    }

    function goalProgressComboMax(combo){
      Q.comboMax = Math.max(Q.comboMax, combo|0);
      const g = Q.activeGoal;
      if (!g || g.done) return;
      if (g.id !== 'combo') return;
      g.cur = clamp(Q.comboMax, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate();
    }

    // ---------- Mini lifecycle ----------
    function miniStart(){
      const m = Q.activeMini;
      if (!m || m.done) return;

      m.failed = false;
      m.cur = 0;
      m.startMs = now();
      m.urgent = false;

      if (m.kind === 'timer'){
        m.endMs = m.startMs + (m.target*1000);
      } else if (m.kind === 'count_timer'){
        m.endMs = m.startMs + (Math.max(1, m.extra|0)*1000);
      } else {
        m.endMs = 0;
      }

      if (m.kind === 'storm'){
        m.inStorm = false; // จะเริ่มนับเมื่อ storm_on
      }
      if (m.kind === 'boss'){
        m.bossArmed = false;
        m.bossDeadline = 0;
      }

      celebrate('mini', `MINI START: ${m.title}`);
      coach(`Mini เริ่มแล้ว: ${m.title} 💥`, 'neutral');

      pushUpdate(true);
    }

    function miniFail(reason){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      m.failed = true;

      celebrate('mini', `MINI FAIL`);
      coach(`พลาด! ลองใหม่ใน Mini ถัดไปนะ 😄`, 'sad');

      // ไป mini ถัดไปทันที (แบบ “เกมจริง”)
      Q.miniIndex = Math.min(minisAll.length, Q.miniIndex + 1);
      pushUpdate(true);
      if (Q.activeMini) miniStart();
    }

    function miniClear(){
      const m = Q.activeMini;
      if (!m || m.done) return;
      m.done = true;
      Q.miniCleared++;

      celebrate('mini', `MINI CLEAR! (${Q.miniCleared}/${minisAll.length})`);
      coach(`ผ่าน Mini แล้ว! ✨`, 'happy');

      Q.miniIndex = Math.min(minisAll.length, Q.miniIndex + 1);
      pushUpdate(true);
      if (Q.activeMini) miniStart();
    }

    // ---------- Mini progress updates ----------
    function miniOnGoodHit(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;

      // generic streak tracking
      Q.hitStreak++;
      Q.lastHitMs = now();

      if (m.kind === 'count'){
        if (m.id === 'perfect') return; // perfect handled separately
      }

      if (m.kind === 'count_timer' || m.kind === 'count'){
        m.cur = clamp(m.cur + 1, 0, m.target);
        if (m.cur >= m.target){
          miniClear();
          return;
        }
      }

      if (m.kind === 'storm' && m.inStorm){
        m.cur = clamp(m.cur + 1, 0, m.target);
      }

      pushUpdate();
    }

    function miniOnBadHit(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;

      // bad hit breaks streak
      Q.hitStreak = 0;

      // fail rules
      if (m.id === 'nojunk') return miniFail('hit_bad');
      if (m.id === 'streak') return miniFail('hit_bad');
      if (m.id === 'clean10') return miniFail('hit_bad');
      if (m.id === 'storm' && m.inStorm) return miniFail('hit_bad');
      if (m.id === 'bossrush' && m.bossArmed) return miniFail('hit_bad');

      pushUpdate();
    }

    function miniOnPerfectSwitch(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'perfect') return;
      m.cur = 1;
      miniClear();
    }

    function miniOnBossSpawn(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'bossrush') return;

      m.bossArmed = true;
      m.bossDeadline = now() + (Math.max(6, m.extra|0) * 1000);
      celebrate('mini', `BOSS RUSH!`);
      coach(`บอสมาแล้ว! รีบโค่นภายใน ${m.extra} วิ!`, 'neutral');
      pushUpdate(true);
    }

    function miniOnBossDown(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'bossrush') return;
      if (!m.bossArmed) return;

      m.cur = 1;
      miniClear();
    }

    function miniOnStormOn(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'storm') return;
      m.inStorm = true;
      m.cur = 0;
      coach(`STORM! เก็บให้ได้ ${m.target} ครั้ง ห้ามพลาด!`, 'neutral');
      pushUpdate(true);
    }

    function miniOnStormOff(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'storm') return;

      // หาก storm จบ แล้วเก็บครบ -> clear, ไม่ครบ -> fail
      if (m.inStorm){
        m.inStorm = false;
        if (m.cur >= m.target) miniClear();
        else miniFail('storm_not_enough');
      }
    }

    // ---------- Ticker: timer/urgent ----------
    function tick(){
      if (Q.stopped) return;

      const m = Q.activeMini;
      const t = now();

      if (m && !m.done && !m.failed){
        let left = 0;
        let urgent = false;

        if (m.kind === 'timer' || m.kind === 'count_timer'){
          left = Math.max(0, Math.ceil((m.endMs - t)/1000));
          urgent = (left <= 3);
          m.leftSec = left;
          m.urgent = urgent;

          // timer fail/clear logic
          if (m.kind === 'timer'){
            // NoJunk Rush: ชนะเมื่อครบเวลา
            if (left <= 0){
              m.cur = m.target;
              miniClear();
            } else {
              // progress bar as time
              m.cur = clamp(m.target - left, 0, m.target);
              pushUpdate();
            }
          } else {
            // count_timer: fail when time out (ถ้ายังไม่ครบ)
            if (left <= 0){
              if (m.cur >= m.target) miniClear();
              else miniFail('time_out');
            } else {
              pushUpdate();
            }
          }
        } else if (m.kind === 'boss' && m.bossArmed){
          left = Math.max(0, Math.ceil((m.bossDeadline - t)/1000));
          urgent = (left <= 3);
          m.leftSec = left;
          m.urgent = urgent;
          if (left <= 0){
            miniFail('boss_time_out');
          } else {
            pushUpdate();
          }
        } else {
          // non-timed mini
          m.leftSec = 0;
          m.urgent = false;
        }
      }

      Q._tickTimer = root.setTimeout(tick, 200);
    }

    // ---------- Public methods ----------
    function start(){
      if (Q.started) return;
      Q.started = true;
      Q.stopped = false;

      // start first mini
      if (Q.activeMini) miniStart();

      // push initial
      pushUpdate(true);

      // ticker
      tick();
    }

    function stop(){
      Q.stopped = true;
      try{ root.clearTimeout(Q._tickTimer); }catch{}
    }

    function onProgress(ev){
      if (!ev) return;
      const d = ev.detail || {};

      // normalize events for quest
      const kind = String(d.kind || '').toLowerCase();
      const type = String(d.type || '').toLowerCase();

      // fallback: star/ice/boss emits {type:'hit', correct:true} without kind
      if (type === 'hit'){
        const correct = !!d.correct;
        if (correct){
          // treat as good-like hit for mini streak progress (but not for goal swap)
          miniOnGoodHit();
        } else {
          miniOnBadHit();
        }
      }

      // explicit kinds
      if (kind === 'hit_good'){
        miniOnGoodHit();
      }
      if (kind === 'hit_bad'){
        miniOnBadHit();
      }
      if (kind === 'combo'){
        const c = Number(d.combo)||0;
        Q.comboNow = c;
        goalProgressComboMax(c);

        // mini streak completion
        const m = Q.activeMini;
        if (m && !m.done && !m.failed && m.id === 'streak'){
          m.cur = clamp(c, 0, m.target);
          if (m.cur >= m.target) miniClear();
        }

        pushUpdate();
      }
      if (kind === 'group_swap'){
        // goal swap progress
        goalProgressSwap();

        // extra excitement: after group swap, if mini is clean10 and not started, restart window
        const m = Q.activeMini;
        if (m && !m.done && !m.failed && m.id === 'clean10'){
          m.startMs = now();
          m.endMs = m.startMs + (Math.max(6, m.extra|0)*1000);
          m.leftSec = Math.ceil((m.endMs - now())/1000);
          pushUpdate(true);
        }
      }
      if (kind === 'perfect_switch'){
        miniOnPerfectSwitch();
      }
      if (kind === 'storm_on'){
        miniOnStormOn();
      }
      if (kind === 'storm_off'){
        miniOnStormOff();
      }
      if (kind === 'boss_spawn'){
        miniOnBossSpawn();
      }
      if (kind === 'boss_down'){
        goalProgressBossDown();
        miniOnBossDown();
      }
    }

    function getState(){
      return {
        goalsCleared: Q.goalsCleared|0,
        goalsTotal: goalsAll.length|0,
        miniCleared: Q.miniCleared|0,
        miniTotal: minisAll.length|0
      };
    }

    return { start, stop, onProgress, pushUpdate, getState };
  };

})(typeof window !== 'undefined' ? window : globalThis);