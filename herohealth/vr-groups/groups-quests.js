// === /herohealth/vr-groups/groups-quests.js ===
// Food Groups VR — Quest System (ALL-IN)
// ✅ goals 3, minis 7 (chain)
// ✅ active group progression + group change drama event
// ✅ provides group emojis list for power-charge system

(function(){
  'use strict';

  const ROOT = window;
  const dispatch = (name, detail) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {}
  };

  // 5 food groups + emoji pool (feel free to tweak)
  const GROUPS = [
    { key:1, label:'หมู่ 1 โปรตีน 🥚🥛', emojis:['🥚','🍳','🥛','🧀','🐟','🍗','🥩','🌰'] },
    { key:2, label:'หมู่ 2 คาร์บ ⚡🍚', emojis:['🍚','🍞','🥔','🍠','🥨','🥐','🍜','🍙'] },
    { key:3, label:'หมู่ 3 ผัก 🥦',     emojis:['🥦','🥬','🥒','🥕','🌽','🍄','🫛','🍆'] },
    { key:4, label:'หมู่ 4 ผลไม้ 🍎',   emojis:['🍎','🍌','🍊','🍇','🍉','🍓','🥭','🍍'] },
    { key:5, label:'หมู่ 5 ไขมัน 🥑',   emojis:['🥑','🫒','🥜','🧈','🍯','🥥','🍫','🧴'] }
  ];

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function quotaByDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return 6;
    if (diff === 'hard') return 8;
    return 7;
  }

  function makeGoals(diff){
    diff = String(diff||'normal').toLowerCase();

    const t1 = (diff==='easy') ? 24 : (diff==='hard' ? 32 : 28);
    const t2 = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);
    const t3 = (diff==='easy') ? 1  : (diff==='hard' ? 2  : 2);

    return [
      {
        id:'g1',
        label:'เก็บอาหาร “ถูกหมู่” ให้ได้ 🧠',
        prog:0, target:t1, done:false
      },
      {
        id:'g2',
        label:'ทำคอมโบให้ถึง 🔥',
        prog:0, target:t2, done:false
      },
      {
        id:'g3',
        label:'ทุบ “บอสขยะ” ให้แตก 😈',
        prog:0, target:t3, done:false
      }
    ];
  }

  function makeMinis(diff){
    diff = String(diff||'normal').toLowerCase();
    const w1 = (diff==='easy') ? 10 : (diff==='hard' ? 7 : 8);
    const w2 = (diff==='easy') ? 9  : (diff==='hard' ? 6 : 7);

    return [
      { id:'m1', label:'Clean Streak ⚡ (ถูกหมู่ติดกัน)', prog:0, target:6, done:false, windowSec:null, tLeft:null },
      { id:'m2', label:'Speed Eat ⏱ (ถูกหมู่ 5 ในเวลาจำกัด)', prog:0, target:5, done:false, windowSec:w1, tLeft:w1, _armed:false },
      { id:'m3', label:'No Junk Zone 🚫 (30 วิ ห้ามโดนขยะ)', prog:0, target:30, done:false, windowSec:30, tLeft:30, _armed:true },
      { id:'m4', label:'Combo Climb 🧗 (คอมโบ 8 โดยไม่พลาด)', prog:0, target:8, done:false, windowSec:null, tLeft:null },
      { id:'m5', label:'Fruit Sprint 🍎 (ถูกหมู่ 4 จำนวน 6)', prog:0, target:6, done:false, windowSec:null, tLeft:null },
      { id:'m6', label:'Veg Heal 🌿 (ถูกหมู่ 3 จำนวน 7)', prog:0, target:7, done:false, windowSec:null, tLeft:null },
      { id:'m7', label:'Boss Breaker 💥 (ทุบบอสอีก 1)', prog:0, target:1, done:false, windowSec:w2, tLeft:w2, _armed:false }
    ];
  }

  function createFoodGroupsQuest(diff='normal'){
    diff = String(diff||'normal').toLowerCase();

    const q = {
      diff,
      goals: makeGoals(diff),
      minis: makeMinis(diff),

      _activeIdx: 0,
      _quota: quotaByDiff(diff),
      _groupHits: 0,
      _groupMiss: 0,

      _goodHits: 0,
      _junkHits: 0,
      _comboMax: 0,
      _bossBreaks: 0,

      _streakGroup: 0,        // streak for mini
      _streakAny: 0,
      _speedArmedAt: 0,
      _speedStartAt: 0,

      getActiveGroup(){
        return GROUPS[clamp(this._activeIdx,0,GROUPS.length-1)];
      },

      _changeGroup(){
        this._activeIdx = (this._activeIdx + 1) % GROUPS.length;
        this._groupHits = 0;
        this._groupMiss = 0;

        const g = this.getActiveGroup();
        dispatch('groups:group_change', { key:g.key, label:g.label, quota:this._quota });
        dispatch('hha:coach', { text:`เปลี่ยนหมู่! → ${g.label} ✨ ยิงถูกหมู่เพื่อชาร์จสกิล!` });
      },

      _hitMatchesActive(emoji){
        const g = this.getActiveGroup();
        return !!(g && Array.isArray(g.emojis) && g.emojis.includes(emoji));
      },

      // Called by engine
      onGoodHit(groupId, combo){
        const g = this.getActiveGroup();

        // groupId comes from engine mapping (active group most of time)
        const hitActive = (groupId|0) === (g.key|0);
        if (hitActive){
          this._groupHits++;
          this._goodHits++;
          this._streakGroup++;
          this._streakAny++;

          // Goal1: correct-group hits
          const goal1 = this.goals[0];
          if (goal1 && !goal1.done){
            goal1.prog = clamp(goal1.prog + 1, 0, goal1.target);
            if (goal1.prog >= goal1.target) goal1.done = true;
          }

          // Mini1: Clean streak (correct-group consecutive)
          const m1 = this.minis[0];
          if (m1 && !m1.done){
            m1.prog = clamp(this._streakGroup, 0, m1.target);
            if (m1.prog >= m1.target) m1.done = true;
          }

          // Mini2: Speed Eat (armed when first active hit)
          const m2 = this.minis[1];
          if (m2 && !m2.done){
            if (!m2._armed){
              m2._armed = true;
              m2.windowSec = m2.windowSec|0;
              m2.tLeft = m2.windowSec|0;
              this._speedStartAt = Date.now();
            }
            m2.prog = clamp(m2.prog + 1, 0, m2.target);
            if (m2.prog >= m2.target) m2.done = true;
          }

          // Mini5: Fruit Sprint
          const m5 = this.minis[4];
          if (m5 && !m5.done && g.key === 4){
            m5.prog = clamp(m5.prog + 1, 0, m5.target);
            if (m5.prog >= m5.target) m5.done = true;
          }

          // Mini6: Veg Heal
          const m6 = this.minis[5];
          if (m6 && !m6.done && g.key === 3){
            m6.prog = clamp(m6.prog + 1, 0, m6.target);
            if (m6.prog >= m6.target) m6.done = true;
          }

          // group quota -> change group
          if (this._groupHits >= this._quota){
            this._changeGroup();
          }

        } else {
          // hit good but not active-group -> considered neutral
          this._goodHits++;
          this._streakAny++;
          this._streakGroup = 0;
        }

        // Goal2: combo max
        this._comboMax = Math.max(this._comboMax, combo|0);
        const goal2 = this.goals[1];
        if (goal2 && !goal2.done){
          goal2.prog = clamp(this._comboMax, 0, goal2.target);
          if (goal2.prog >= goal2.target) goal2.done = true;
        }

        // Mini4: Combo climb (combo 8 no miss)
        const m4 = this.minis[3];
        if (m4 && !m4.done){
          m4.prog = clamp(combo|0, 0, m4.target);
          if (m4.prog >= m4.target) m4.done = true;
        }
      },

      onJunkHit(/*groupId*/){
        this._junkHits++;
        this._streakAny = 0;
        this._streakGroup = 0;

        // Mini3: No Junk Zone (fails by hit -> reset timer/prog)
        const m3 = this.minis[2];
        if (m3 && !m3.done){
          m3.prog = 0;
          m3.tLeft = m3.windowSec|0;
        }

        // Mini4: combo climb reset by miss is handled by engine side; here keep it simple
      },

      onBossBreak(){
        this._bossBreaks++;
        const goal3 = this.goals[2];
        if (goal3 && !goal3.done){
          goal3.prog = clamp(goal3.prog + 1, 0, goal3.target);
          if (goal3.prog >= goal3.target) goal3.done = true;
        }

        // Mini7: Boss breaker (armed when boss appears -> give short window)
        const m7 = this.minis[6];
        if (m7 && !m7.done){
          m7.prog = clamp(m7.prog + 1, 0, m7.target);
          if (m7.prog >= m7.target) m7.done = true;
        }
      },

      // called each second by engine
      second(){
        // Mini2: Speed Eat countdown only after armed
        const m2 = this.minis[1];
        if (m2 && !m2.done && m2._armed){
          m2.tLeft = Math.max(0, (m2.tLeft|0) - 1);
          if ((m2.tLeft|0) <= 0){
            // fail -> reset
            m2._armed = false;
            m2.prog = 0;
            m2.tLeft = m2.windowSec|0;
          }
        }

        // Mini3: No Junk Zone countdown (always armed)
        const m3 = this.minis[2];
        if (m3 && !m3.done && m3._armed){
          m3.tLeft = Math.max(0, (m3.tLeft|0) - 1);
          m3.prog = clamp(m3.prog + 1, 0, m3.target);
          if (m3.prog >= m3.target){
            m3.done = true;
          }
          if ((m3.tLeft|0) <= 0 && !m3.done){
            // reset window
            m3.tLeft = m3.windowSec|0;
            m3.prog = 0;
          }
        }

        // Mini7: Boss breaker short window logic (optional: countdown if armed)
        const m7 = this.minis[6];
        if (m7 && !m7.done){
          if (!m7._armed){
            // arm it periodically when late game? keep simple:
            m7._armed = true;
            m7.windowSec = m7.windowSec|0;
            m7.tLeft = m7.windowSec|0;
          } else {
            m7.tLeft = Math.max(0, (m7.tLeft|0) - 1);
            if ((m7.tLeft|0) <= 0 && !m7.done){
              // re-arm
              m7.tLeft = m7.windowSec|0;
            }
          }
        }
      }
    };

    // start with drama once
    const g0 = q.getActiveGroup();
    dispatch('groups:group_change', { key:g0.key, label:g0.label, quota:q._quota });
    dispatch('hha:coach', { text:`เริ่มเลย! หมู่แรก: ${g0.label} ✨ ยิงถูกหมู่เพื่อชาร์จสกิล ⚡` });

    return q;
  }

  ROOT.GroupsQuest = ROOT.GroupsQuest || {};
  ROOT.GroupsQuest.createFoodGroupsQuest = createFoodGroupsQuest;

})();