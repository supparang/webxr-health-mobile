// === core/quests.js — Focused Mini-Quests (pick 3/10 per run) ===
export const Quests = (function(){
  // ---------- State ----------
  let _hud=null, _coach=null;
  let _diff='Normal', _mode='goodjunk', _lang='TH';
  let _duration=45;
  let _picked=[];          // 3 เควสต์ที่สุ่มได้
  let _activeIdx=0;        // index เควสต์ที่กำลังทำ
  let _onRefresh=null;     // callback ให้ main เรียก hud.setQuestChips
  let _summary=null;       // เก็บผลรวมไว้โชว์ตอนท้าย

  // โครงสร้างเควสต์ 10 แบบ (key, label, need โดยขึ้นกับ diff)
  const ALL = [
    { key:'gold',        icon:'🌟', label:'Gold Hits',            base:3,  inc:[+0,+0,+1] },
    { key:'perfect',     icon:'✨', label:'Perfect Hits',         base:10, inc:[-3, 0, +4] },
    { key:'combo10',     icon:'🔥', label:'Reach Combo 10',       base:1,  inc:[-1, 0, +1] },
    { key:'fever',       icon:'💥', label:'Trigger FEVER',        base:1,  inc:[ 0, 0,  0] },
    { key:'usepower',    icon:'🔸', label:'Use Any Power',        base:3,  inc:[-1, 0, +1] },
    { key:'shield',      icon:'🛡️', label:'Shield Pickups',      base:2,  inc:[-1, 0, +1] },
    { key:'avoidJunk',   icon:'🚫', label:'Avoid Junk (sec)',     base:12, inc:[-4, 0, +6], time:true },
    { key:'noMiss',      icon:'🧭', label:'No Miss (sec)',        base:12, inc:[-2, 0, +6], time:true },
    { key:'streakPerf3', icon:'⭐', label:'Perfect ×3 streak',     base:1,  inc:[ 0, 0, +1] },
    { key:'goodOrPerf',  icon:'✅', label:'Good/Perfect Hits',    base:22, inc:[-6, 0, +8] },
  ];

  function byKey(k){ return ALL.find(x=>x.key===k); }
  function needFor(def){
    const di = (_diff==='Easy'?0: _diff==='Hard'?2:1);
    return Math.max(1, (def.base + (def.inc[di]||0))|0);
  }

  // ---------- Runtime quest objs ----------
  function makeQuest(def){
    const q = {
      key:def.key, icon:def.icon, label:def.label, need:needFor(def),
      progress:0, done:false, fail:false, timeMode:!!def.time, // timeMode = นับวินาทีต่อเนื่อง
      _timer:0, _streak:0
    };
    return q;
  }

  // ---------- Pick 3 quests ----------
  function pickThree(){
    const keys = ALL.map(x=>x.key);
    // กระจายให้มีทั้ง hit / time / utility อย่างน้อย 1
    const groupA = ['gold','perfect','goodOrPerf','streakPerf3','combo10'];
    const groupB = ['avoidJunk','noMiss'];
    const groupC = ['fever','usepower','shield'];

    function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }

    const chosen = new Set();
    chosen.add(rnd(groupA));
    chosen.add(rnd(groupB));
    chosen.add(rnd(groupC));
    // เติมให้ครบ 3 (กันซ้ำ)
    while(chosen.size<3){
      chosen.add(keys[(Math.random()*keys.length)|0]);
    }
    return Array.from(chosen).map(k=>makeQuest(byKey(k)));
  }

  // ---------- Public: bind / begin / end ----------
  function bindToMain({hud,coach}){
    _hud=hud; _coach=coach;
    return {
      refresh(){ if(_onRefresh) _onRefresh(); },
      onRefresh(fn){ _onRefresh = fn; }   // main จะส่ง callback มา
    };
  }

  function beginRun(mode, diff, lang, duration){
    _mode=mode; _diff=diff; _lang=(lang||'TH').toUpperCase();
    _duration=duration|0;
    _picked = pickThree();
    _activeIdx = 0;
    _summary = { done:0, list:[], start:performance.now() };
    if(_onRefresh) _onRefresh();
  }

  function endRun({score}={}){
    // คืนสรุป
    const totalDone = _picked.filter(q=>q.done && !q.fail).length;
    const res = {
      totalDone,
      items: _picked.map(q=>({ key:q.key, label:q.label, progress:q.progress, need:q.need, done:q.done, fail:q.fail }))
    };
    _summary.end = performance.now();
    _summary.score = score|0;
    return res;
  }

  // ---------- Visible chips (แสดงเฉพาะ active) ----------
  function getActive(){ return _picked[_activeIdx]; }
  function getVisibleChips(){
    const q = getActive();
    if(!q) return [];
    return [{
      key:q.key, icon:q.icon, label:q.label,
      progress:q.timeMode ? Math.floor(q._timer) : q.progress,
      need:q.need,
      done:q.done, fail:q.fail, active:true
    }];
  }
  function advanceIfDone(){
    const q = getActive(); if(!q) return;
    if(q.done && _activeIdx<(_picked.length-1)){ _activeIdx++; if(_onRefresh) _onRefresh(); }
  }

  // ---------- Event hooks ----------
  function event(kind, payload){
    const q = getActive(); if(!q) return;
    switch(kind){
      case 'hit': {
        const meta = payload?.meta||{};
        const isGood  = (payload?.result==='good'||payload?.result==='perfect');
        const isPerf  = (payload?.result==='perfect');
        const isGold  = !!meta.gold;

        if(q.key==='gold' && isGold){ q.progress++; if(q.progress>=q.need) q.done=true; }
        if(q.key==='perfect' && isPerf){ q.progress++; if(q.progress>=q.need) q.done=true; }
        if(q.key==='goodOrPerf' && isGood){ q.progress++; if(q.progress>=q.need) q.done=true; }
        if(q.key==='streakPerf3'){
          q._streak = isPerf ? (q._streak+1) : 0;
          if(q._streak>=3){ q.progress=1; q.done=true; }
        }
        if(q.key==='combo10'){
          const comboNow = payload?.comboNow|0;
          if(comboNow>=10){ q.progress=1; q.done=true; }
        }
        if(q.key==='usepower' && (payload?.usedPower)){ q.progress++; if(q.progress>=q.need) q.done=true; }
        // time-based จะนับใน tick()
        advanceIfDone();
        if(_onRefresh) _onRefresh();
        break;
      }
      case 'miss': {
        if(q.key==='noMiss'){ q._timer = 0; } // รีเซ็ตเวลา
        if(q.key==='avoidJunk' && (payload?.junk===true)){ q._timer = 0; }
        if(q.key==='streakPerf3'){ q._streak = 0; }
        if(_onRefresh) _onRefresh();
        break;
      }
      case 'power': {
        if(q.key==='usepower'){ q.progress++; if(q.progress>=q.need) q.done=true; }
        if(q.key==='shield' && payload?.kind==='shield'){ q.progress++; if(q.progress>=q.need) q.done=true; }
        advanceIfDone();
        if(_onRefresh) _onRefresh();
        break;
      }
      case 'fever': {
        if(q.key==='fever' && payload?.on){ q.progress=1; q.done=true; advanceIfDone(); if(_onRefresh) _onRefresh(); }
        break;
      }
    }
  }

  function tick({score,dt,fever}){
    const q = getActive(); if(!q) return;
    if(q.timeMode){
      // noMiss: เพิ่มหาก “ไม่มี miss” ในช่วงที่ผ่าน
      // avoidJunk: เพิ่มหาก “ไม่มีการกด junk” — ระบบจะรีเซ็ตใน event('miss', {junk:true})
      q._timer += Math.max(0, dt||0);
      const goal = q.need|0;
      if(Math.floor(q._timer) >= goal){ q.done=true; }
      if(_onRefresh) _onRefresh();
      if(q.done) advanceIfDone();
    }
  }

  // ให้ main เรียกกรณีอยากบังคับ refresh รอบนี้
  function refreshNow(){ if(_onRefresh) _onRefresh(); }

  return {
    bindToMain, beginRun, endRun, event, tick,
    getVisibleChips, refreshNow
  };
})();
