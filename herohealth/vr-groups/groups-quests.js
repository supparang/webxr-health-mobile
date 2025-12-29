/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest System (Goals sequential + Minis chain)
✅ Listens: groups:progress (from GameEngine)
✅ Emits: quest:update (FLAT + NESTED) + hha:celebrate + hha:coach
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{} };

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

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function normDiff(d){
    d = String(d||'normal').toLowerCase();
    return (d==='easy'||d==='hard'||d==='normal') ? d : 'normal';
  }

  function goalPlan(diff){
    diff = normDiff(diff);
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

  function miniLibrary(diff){
    diff = normDiff(diff);
    const noJunkSec = (diff==='easy') ? 7 : (diff==='hard') ? 10 : 8;
    const bossSec   = (diff==='easy') ? 12 : (diff==='hard') ? 9 : 10;
    const streakHit = (diff==='easy') ? 8 : (diff==='hard') ? 12 : 10;
    const stormNeed = (diff==='easy') ? 4 : (diff==='hard') ? 7 : 5;

    return [
      { id:'nojunk',   title:'No-Junk Rush', desc:`ห้ามพลาด/โดนขยะ ${noJunkSec} วิ`, kind:'timer', target:noJunkSec, icon:'🚫🍟' },
      { id:'perfect',  title:'Perfect Switch', desc:'สลับหมู่แบบเพอร์เฟกต์ 1 ครั้ง', kind:'count', target:1, icon:'✨' },
      { id:'streak',   title:'Combo Streak', desc:`ทำ hit ต่อเนื่อง ${streakHit} ครั้ง (ห้ามพลาด)`, kind:'count', target:streakHit, icon:'🔥' },
      { id:'storm',    title:'Storm Survivor', desc:`ช่วง STORM ต้อง hit ให้ได้ ${stormNeed} ครั้ง และห้ามพลาด`, kind:'storm', target:stormNeed, icon:'⛈️' },
      { id:'bossrush', title:'Boss Rush', desc:`เมื่อบอสโผล่ ต้องโค่นให้ได้ใน ${bossSec} วิ`, kind:'boss', target:1, extra:bossSec, icon:'👑' },
      { id:'clean10',  title:'Clean 10', desc:`เก็บดีให้ได้ 10 ครั้งภายในเวลา (ห้ามพลาด)`, kind:'count_timer', target:10, extra:(diff==='easy')?14:(diff==='hard')?10:12, icon:'✅' }
    ];
  }

  NS.createGroupsQuest = function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff = normDiff(opts.diff);
    const seed = String(opts.seed || 'seed');

    const rng = makeRng(seed + '|groupsQuest|' + diff + '|' + runMode);

    const goalDefs = goalPlan(diff);
    const goalsAll = goalDefs.map(g=>({
      id:g.id, icon:g.icon||'🎯',
      title:g.title, target:Math.max(1, g.target|0),
      cur:0, done:false
    }));

    const miniDefs = shuffle(miniLibrary(diff), rng);
    const minisAll = miniDefs.map(m=>({
      id:m.id, icon:m.icon||'⭐',
      title:m.title, desc:m.desc, kind:m.kind,
      target:Math.max(1, m.target|0),
      extra:m.extra||0,
      cur:0, done:false, failed:false,
      startMs:0, endMs:0,
      leftSec:0, urgent:false,
      inStorm:false,
      bossArmed:false, bossDeadline:0
    }));

    const Q = {
      started:false, stopped:false,
      goalIndex:0, miniIndex:0,
      goalsCleared:0, miniCleared:0,
      comboMax:0,
      _tickTimer:0,
      _lastPushAt:0,
      get activeGoal(){ return goalsAll[Q.goalIndex] || null; },
      get activeMini(){ return minisAll[Q.miniIndex] || null; }
    };

    function celebrate(kind, title){ emit('hha:celebrate', { kind: kind||'mini', title: title||'Nice!' }); }
    function coach(text, mood){ emit('hha:coach', { text: String(text||''), mood: mood||'happy' }); }

    function pushUpdate(force){
      const t = now();
      if (!force && (t - Q._lastPushAt < 120)) return;
      Q._lastPushAt = t;

      const g = Q.activeGoal;
      const m = Q.activeMini;

      const goal = g ? ({
        id:g.id,
        title:`${g.icon} ${g.title}`,
        cur:g.cur|0, target:g.target|0,
        done:!!g.done,
        pct: g.target ? Math.round((g.cur/g.target)*100) : 0
      }) : null;

      const mini = m ? ({
        id:m.id,
        title:`${m.icon} ${m.title}`,
        desc:m.desc,
        cur:m.cur|0, target:m.target|0,
        done:!!m.done, failed:!!m.failed,
        leftSec:m.leftSec|0,
        urgent:!!m.urgent,
        pct: m.target ? Math.round((m.cur/m.target)*100) : 0
      }) : null;

      // ✅ ยิงแบบเดิม (flat) ให้ HUD ของคุณใช้ได้ทันที
      emit('quest:update', {
        goalTitle: goal ? goal.title : '—',
        goalPct:   goal ? goal.pct   : 0,
        goalNow:   goal ? goal.cur   : 0,
        goalTotal: goal ? goal.target: 1,

        miniTitle: mini ? mini.title : '—',
        miniPct:   mini ? mini.pct   : 0,
        miniNow:   mini ? mini.cur   : 0,
        miniTotal: mini ? mini.target: 1,

        miniTimeLeftSec: mini ? mini.leftSec : 0,
        miniUrgent: mini ? mini.urgent : false,

        // ✅ และแบบใหม่ (nested)
        goal, mini,
        goalsCleared: Q.goalsCleared|0,
        goalsTotal: goalsAll.length|0,
        miniCleared: Q.miniCleared|0,
        miniTotal: minisAll.length|0
      });
    }

    function goalAdvance(){
      const g = Q.activeGoal;
      if (!g || g.done) return;
      g.done = true;
      Q.goalsCleared++;
      celebrate('goal', `GOAL CLEAR! (${Q.goalsCleared}/${goalsAll.length})`);
      coach(`เก่งมาก! ผ่าน Goal แล้ว 🎉`, 'happy');
      Q.goalIndex = Math.min(goalsAll.length, Q.goalIndex + 1);
      pushUpdate(true);
      if (!Q.activeGoal){
        celebrate('goal', `ALL GOALS COMPLETE!`);
        coach(`สุดยอด! ผ่าน Goal ครบแล้ว ✅`, 'happy');
      }
    }

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

      m.inStorm = false;
      m.bossArmed = false;
      m.bossDeadline = 0;

      celebrate('mini', `MINI START: ${m.title}`);
      coach(`Mini เริ่มแล้ว: ${m.title} 💥`, 'neutral');
      pushUpdate(true);
    }

    function miniFail(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      m.failed = true;
      celebrate('mini', `MINI FAIL`);
      coach(`พลาด! ลองใหม่ใน Mini ถัดไปนะ 😄`, 'sad');
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

    function goalSwapProgress(){
      const g = Q.activeGoal;
      if (!g || g.done || g.id !== 'swap') return;
      g.cur = clamp(g.cur + 1, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate(true);
    }

    function goalBossProgress(){
      const g = Q.activeGoal;
      if (!g || g.done || g.id !== 'boss') return;
      g.cur = clamp(g.cur + 1, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate(true);
    }

    function goalComboProgress(combo){
      combo = Number(combo)||0;
      Q.comboMax = Math.max(Q.comboMax, combo);
      const g = Q.activeGoal;
      if (!g || g.done || g.id !== 'combo') return;
      g.cur = clamp(Q.comboMax, 0, g.target);
      if (g.cur >= g.target) goalAdvance();
      pushUpdate();
    }

    function miniOnGoodHit(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;

      if (m.kind === 'count' || m.kind === 'count_timer'){
        m.cur = clamp(m.cur + 1, 0, m.target);
        if (m.cur >= m.target){ miniClear(); return; }
      }

      if (m.kind === 'storm' && m.inStorm){
        m.cur = clamp(m.cur + 1, 0, m.target);
      }

      pushUpdate();
    }

    function miniOnBadHit(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;

      if (m.id === 'nojunk') return miniFail();
      if (m.id === 'streak') return miniFail();
      if (m.id === 'clean10') return miniFail();
      if (m.id === 'storm' && m.inStorm) return miniFail();
      if (m.id === 'bossrush' && m.bossArmed) return miniFail();

      pushUpdate();
    }

    function miniPerfectSwitch(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'perfect') return;
      m.cur = 1;
      miniClear();
    }

    function miniBossSpawn(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'bossrush') return;
      m.bossArmed = true;
      m.bossDeadline = now() + (Math.max(6, m.extra|0)*1000);
      celebrate('mini', `BOSS RUSH!`);
      coach(`บอสมาแล้ว! รีบโค่นภายใน ${m.extra} วิ!`, 'neutral');
      pushUpdate(true);
    }

    function miniBossDown(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'bossrush' || !m.bossArmed) return;
      m.cur = 1;
      miniClear();
    }

    function miniStormOn(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'storm') return;
      m.inStorm = true;
      m.cur = 0;
      coach(`STORM! เก็บให้ได้ ${m.target} ครั้ง ห้ามพลาด!`, 'neutral');
      pushUpdate(true);
    }

    function miniStormOff(){
      const m = Q.activeMini;
      if (!m || m.done || m.failed) return;
      if (m.id !== 'storm') return;
      if (!m.inStorm) return;
      m.inStorm = false;
      if (m.cur >= m.target) miniClear();
      else miniFail();
    }

    function tick(){
      if (Q.stopped) return;

      const m = Q.activeMini;
      const t = now();

      if (m && !m.done && !m.failed){
        let left = 0;

        if (m.kind === 'timer' || m.kind === 'count_timer'){
          left = Math.max(0, Math.ceil((m.endMs - t)/1000));
          m.leftSec = left;
          m.urgent = (left <= 3);

          if (m.kind === 'timer'){
            if (left <= 0){
              m.cur = m.target;
              miniClear();
            } else {
              m.cur = clamp(m.target - left, 0, m.target);
              pushUpdate();
            }
          } else {
            if (left <= 0){
              if (m.cur >= m.target) miniClear();
              else miniFail();
            } else {
              pushUpdate();
            }
          }
        } else if (m.kind === 'boss' && m.bossArmed){
          left = Math.max(0, Math.ceil((m.bossDeadline - t)/1000));
          m.leftSec = left;
          m.urgent = (left <= 3);
          if (left <= 0) miniFail();
          else pushUpdate();
        } else {
          m.leftSec = 0;
          m.urgent = false;
        }
      }

      Q._tickTimer = root.setTimeout(tick, 200);
    }

    function start(){
      if (Q.started) return;
      Q.started = true;
      Q.stopped = false;
      if (Q.activeMini) miniStart();
      pushUpdate(true);
      tick();
    }

    function stop(){
      Q.stopped = true;
      try{ root.clearTimeout(Q._tickTimer); }catch{}
    }

    function onProgress(ev){
      const d = (ev && ev.detail) ? ev.detail : (ev || {});
      const kind = String(d.kind || '').toLowerCase();
      const type = String(d.type || '').toLowerCase();

      if (type === 'hit'){
        const correct = !!d.correct;
        if (correct) miniOnGoodHit();
        else miniOnBadHit();
      }

      if (kind === 'hit_good') miniOnGoodHit();
      if (kind === 'hit_bad') miniOnBadHit();

      if (kind === 'combo'){
        const c = Number(d.combo)||0;
        goalComboProgress(c);
        const m = Q.activeMini;
        if (m && !m.done && !m.failed && m.id === 'streak'){
          m.cur = clamp(c, 0, m.target);
          if (m.cur >= m.target) miniClear();
        }
        pushUpdate();
      }

      if (kind === 'group_swap') goalSwapProgress();
      if (kind === 'perfect_switch') miniPerfectSwitch();
      if (kind === 'storm_on') miniStormOn();
      if (kind === 'storm_off') miniStormOff();
      if (kind === 'boss_spawn') miniBossSpawn();
      if (kind === 'boss_down'){ goalBossProgress(); miniBossDown(); }
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