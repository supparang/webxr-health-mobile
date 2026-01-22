// === /herohealth/vr/hha-badges.js ===
// HHA Badges + Unlocks + Teacher Quests — PRODUCTION
// ✅ Works with summary object (HHA_LAST_SUMMARY schema-ish)
// ✅ Stores: HHA_BADGES, HHA_UNLOCKS, HHA_TEACHER_QUESTS
// ✅ Emits: hha:badge (for FX popup), hha:unlock
// ✅ Research-safe: if run=research => badges ok, unlocks optional locked

(function(root){
  'use strict';
  const LS_BADGES = 'HHA_BADGES';
  const LS_UNLOCKS = 'HHA_UNLOCKS';
  const LS_TQUEST = 'HHA_TEACHER_QUESTS';

  const clamp01 = (x)=>Math.max(0, Math.min(1, Number(x)||0));
  const nowIso = ()=>{ try{return new Date().toISOString();}catch{ return '';} };

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const emit = (n,d)=>{ try{ root.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

  function load(key, fb){
    try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
  }
  function save(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
  }

  // ---------- Badge catalog ----------
  // id: unique, title, desc, icon, rule(summary)=>boolean, tier(optional)
  const BADGES = [
    // Skill / Hygiene-centric
    { id:'hw_step_master', icon:'🧼', title:'Step Master', desc:'ทำขั้นตอนถูกแม่น', rule:(S)=> (S.stepAcc||0) >= 0.85 },
    { id:'hw_speedy', icon:'⚡', title:'Speedy Cleaner', desc:'ทำเร็วแต่ยังแม่น', rule:(S)=> (S.medianStepMs||99999) <= 1100 && (S.stepAcc||0) >= 0.75 },
    { id:'hw_safe_hands', icon:'☣️', title:'Hazard Dodger', desc:'โดนปนเปื้อนน้อยมาก', rule:(S)=> (S.hazHits||0) <= 1 },
    { id:'hw_combo_10', icon:'🔥', title:'Focus Streak', desc:'คอมโบถึง 10+', rule:(S)=> (S.comboMax||0) >= 10 },
    { id:'hw_boss_breaker', icon:'🌩️', title:'Boss Breaker', desc:'ผ่านบอสได้', rule:(S)=> (S.bossDefeated||0) >= 1 },

    // Universal fun badges (ใช้ได้ทุกเกม)
    { id:'u_no_miss', icon:'🎯', title:'Clean Run', desc:'Miss = 0', rule:(S)=> (S.misses||0) === 0 },
    { id:'u_quest_sweeper', icon:'🏁', title:'Quest Sweeper', desc:'ผ่าน goal/mini ครบ', rule:(S)=> (S.goalsTotal!=null && S.miniTotal!=null && (S.goalsCleared||0)===(S.goalsTotal||0) && (S.miniCleared||0)===(S.miniTotal||0)) },
    { id:'u_risk_low', icon:'🛡️', title:'Safety Pro', desc:'ความเสี่ยงต่ำ', rule:(S)=> (S.riskIncomplete||0) < 0.25 && (S.riskUnsafe||0) < 0.25 },
  ];

  // ---------- Unlock catalog (cosmetic only) ----------
  // unlocks are “meta rewards” (title/skin/fx). Keep small & safe.
  const UNLOCKS = [
    { id:'title_handwash_hero', icon:'🏅', title:'TITLE: Handwash Hero', need:['hw_step_master','hw_safe_hands'] },
    { id:'fx_confetti_green', icon:'✨', title:'FX: Confetti', need:['u_quest_sweeper'] },
    { id:'skin_neon_cyan', icon:'🟦', title:'Skin: Neon Cyan', need:['hw_combo_10'] },
    { id:'sticker_thumb', icon:'👍', title:'Sticker: Thumb Master', need:['hw_step_master'] },
  ];

  // ---------- Teacher quests ----------
  // quests evaluate from latest-per-student (recommended) OR from last session.
  const DEFAULT_TQUESTS = [
    { id:'q_reduce_risk_unsafe', icon:'☣️', title:'ลด Risk Unsafe', desc:'ให้ทุกคนต่ำกว่า 40%', metric:'riskUnsafe', target:0.40, op:'<', scope:'latestPerStudent' },
    { id:'q_raise_stepacc', icon:'🧼', title:'เพิ่ม Step Accuracy', desc:'เฉลี่ยห้อง ≥ 75%', metric:'stepAcc', target:0.75, op:'>=', scope:'latestPerStudentMean' },
    { id:'q_hazard_low', icon:'🛡️', title:'Hazard hits น้อย', desc:'เฉลี่ยห้อง ≤ 2', metric:'hazHits', target:2, op:'<=', scope:'latestPerStudentMean' },
  ];

  function getState(){
    const st = load(LS_BADGES, { earned:{}, lastEarned:[] });
    if(!st.earned) st.earned = {};
    if(!Array.isArray(st.lastEarned)) st.lastEarned = [];
    return st;
  }
  function getUnlockState(){
    const st = load(LS_UNLOCKS, { unlocked:{}, lastUnlocked:[] });
    if(!st.unlocked) st.unlocked = {};
    if(!Array.isArray(st.lastUnlocked)) st.lastUnlocked = [];
    return st;
  }
  function getTeacherQuests(){
    const q = load(LS_TQUEST, null);
    if(q && Array.isArray(q.items) && q.items.length) return q;
    return { updatedIso: nowIso(), items: DEFAULT_TQUESTS };
  }
  function setTeacherQuests(q){ save(LS_TQUEST, q); }

  // ---------- Earn badges from a summary ----------
  function evaluateBadges(summary, opts){
    opts = opts || {};
    const runMode = String(summary.runMode || summary.run || qs('run','play') || 'play').toLowerCase();
    const research = runMode === 'research';
    const allowUnlockInResearch = !!opts.allowUnlockInResearch;

    const st = getState();
    const ust = getUnlockState();

    const newly = [];
    for(const b of BADGES){
      if(st.earned[b.id]) continue;
      let ok = false;
      try{ ok = !!b.rule(summary); }catch{ ok = false; }
      if(ok){
        st.earned[b.id] = { at: nowIso(), game: summary.game||summary.gameMode||'', sessionId: summary.sessionId||'' };
        newly.push(b);
      }
    }

    // update lastEarned (keep 12)
    if(newly.length){
      st.lastEarned = newly.map(b=>b.id).concat(st.lastEarned).slice(0,12);
      save(LS_BADGES, st);
      // emit for FX
      newly.forEach(b=>{
        emit('hha:badge', { id:b.id, icon:b.icon, title:b.title, desc:b.desc });
      });
    }

    // Unlock evaluation
    const newlyU = [];
    for(const u of UNLOCKS){
      if(ust.unlocked[u.id]) continue;
      const hasAll = (u.need||[]).every(id=>!!st.earned[id]);
      if(hasAll){
        if(research && !allowUnlockInResearch){
          // in research: don't unlock, but we could “preview” (optional)
          continue;
        }
        ust.unlocked[u.id] = { at: nowIso(), title:u.title };
        newlyU.push(u);
      }
    }
    if(newlyU.length){
      ust.lastUnlocked = newlyU.map(u=>u.id).concat(ust.lastUnlocked).slice(0,12);
      save(LS_UNLOCKS, ust);
      newlyU.forEach(u=>{
        emit('hha:unlock', { id:u.id, icon:u.icon, title:u.title });
      });
    }

    return { newlyBadges:newly, newlyUnlocks:newlyU, research };
  }

  // ---------- Teacher quest evaluation from summaries history ----------
  // Input: summaries array (HHA_SUMMARY_HISTORY)
  function evalTeacherQuestsFromHistory(summaries){
    summaries = Array.isArray(summaries) ? summaries : [];
    const q = getTeacherQuests();

    // latest per student
    const byStudent = new Map();
    for(const s of summaries){
      const sk = String(s.studentKey||'').trim();
      if(!sk) continue;
      if(!byStudent.has(sk)) byStudent.set(sk, s);
    }
    const latest = Array.from(byStudent.values());
    const mean = (xs)=> {
      xs = (xs||[]).map(Number).filter(x=>isFinite(x));
      if(!xs.length) return 0;
      return xs.reduce((a,b)=>a+b,0)/xs.length;
    };

    function cmp(op, a, b){
      if(op === '<') return a < b;
      if(op === '<=') return a <= b;
      if(op === '>=') return a >= b;
      if(op === '>') return a > b;
      return false;
    }

    const results = q.items.map(item=>{
      const metric = item.metric;
      let value = 0;
      let pass = false;

      if(item.scope === 'latestPerStudent'){
        // pass if EVERY student meets condition (strict)
        const vals = latest.map(s=>Number(s[metric]||0));
        pass = vals.length ? vals.every(v=>cmp(item.op, v, item.target)) : false;
        value = vals.length ? Math.max(...vals) : 0; // show worst case
      }else if(item.scope === 'latestPerStudentMean'){
        value = mean(latest.map(s=>Number(s[metric]||0)));
        pass = cmp(item.op, value, item.target);
      }else{
        // fallback: last session
        const last = summaries[0] || {};
        value = Number(last[metric]||0);
        pass = cmp(item.op, value, item.target);
      }

      return Object.assign({}, item, { value, pass });
    });

    return { updatedIso: nowIso(), results };
  }

  // ---------- expose ----------
  root.HHA_Badges = {
    BADGES,
    UNLOCKS,
    getState,
    getUnlockState,
    evaluateBadges,
    getTeacherQuests,
    setTeacherQuests,
    evalTeacherQuestsFromHistory
  };

})(window);