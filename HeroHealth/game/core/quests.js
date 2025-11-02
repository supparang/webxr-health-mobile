// === core/quests.js (Mini Quests v1.0: random-from-10, focus-one, auto-advance) ===

/*
API ที่ main.js ใช้:
- Quests.bindToMain({ hud, coach })
- Quests.beginRun(modeKey, diff, lang, matchTime)
- Quests.event(type, payload)   // 'hit' | 'miss' | 'fever' | 'power'
- Quests.tick({ score, dt, fever })
- Quests.endRun({ score })  -> summary object { totalDone, doneList, failList }

การแสดงผล:
- เราจะแสดง "ชิปเดียว" (focused quest) ผ่าน hud.setQuestChips([chip])
- เมื่อสำเร็จ (done) หรือ fail -> เด้งไปเควสต์ถัดไปอัตโนมัติ (ดีเลย์สั้น ๆ)
*/

export const Quests = (function(){
  // ---- runtime refs ----
  let HUD = null, COACH = null;
  let LANG = 'TH';
  let IN_RUN = false;
  let SCORE = 0;
  let MATCH_TIME = 45;

  // ---- state ----
  let _catalog = [];         // 10 รายการ
  let _queue = [];           // คิวที่สุ่มแล้ว
  let _idx = -1;             // current quest index (ในคิว)
  let _cur = null;           // current quest object (live)
  let _doneList = [];
  let _failList = [];

  // ตัวช่วยเวลา/สตรีค
  let _sinceAnyMiss = 0;     // นับเวลาตั้งแต่ miss ครั้งล่าสุด (วินาที)
  let _sinceJunkMiss = 0;    // นับเวลาตั้งแต่ junk miss ล่าสุด
  let _hitStreak = 0;        // ฮิตติดกัน (นับจาก miss จะรีเซ็ต)
  let _feverOn = false;

  // ---- utils ----
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  function sayCoach(th, en){ if(!COACH) return; COACH.say(LANG==='EN'?en:th); }
  function refreshHUD(){
    if(!HUD) return;
    if(!_cur){
      HUD.setQuestChips([]);
      return;
    }
    const pct = _cur.need>0 ? Math.min(100, Math.round((_cur.progress/_cur.need)*100)) : 0;
    HUD.setQuestChips([{
      key   : _cur.key,
      label : _cur.label,
      icon  : _cur.icon,
      progress: _cur.progress|0,
      need  : _cur.need|0,
      done  : !!_cur.done,
      fail  : !!_cur.fail,
      pct
    }]);
  }
  function nextQuest(delayMs=500){
    // เก็บผลสรุป
    if(_cur){
      if(_cur.done) _doneList.push(_cur.key);
      else if(_cur.fail) _failList.push(_cur.key);
    }
    // ดึงถัดไปจากคิว
    setTimeout(()=>{
      _idx++;
      if(_idx >= _queue.length){
        // เติมคิวใหม่แบบสุ่มต่อเนื่อง
        _queue = shuffle(_catalog.map(cloneQuest));
        _idx = 0;
      }
      _cur = _queue[_idx];
      // รีเซ็ตตัวนับที่ binding กับภารกิจ
      _cur.progress = 0;
      _cur.done = false;
      _cur.fail = false;
      _cur._time = 0;        // time counter ภายในเควสต์
      refreshHUD();
      // แจ้งโค้ชชื่อเควสต์
      sayCoach(`เควสต์: ${_cur.label}`, `Quest: ${_cur.label}`);
    }, delayMs);
  }
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }
  function cloneQuest(q){ return JSON.parse(JSON.stringify(q)); }

  // ---- 10 เควสต์มาตรฐาน (ออกแบบให้สัญญาณจาก main/goodjunk เพียงพอ) ----
  function buildCatalog(diff='Normal'){
    const easy = (diff==='Easy');
    const hard = (diff==='Hard');

    return [
      // 1) สะสม Good/Perfect ให้ครบ N
      { key:'goods_10', icon:'🥦', label:(LANG==='EN'?'Get 10 good items':'เก็บของดี 10 ชิ้น'), type:'count_hit_good',
        need: hard?14 : easy?8 : 10, progress:0 },

      // 2) เลี่ยง Junk X วินาที (reset เมื่อมี junk miss)
      { key:'avoid_junk_7s', icon:'🧹', label:(LANG==='EN'?'Avoid junk for 7s':'เลี่ยงของขยะ 7 วิ'), type:'time_no_junk',
        need: hard?9 : easy?5 : 7, progress:0 },

      // 3) คอมโบถึง X
      { key:'combo_10', icon:'⚡', label:(LANG==='EN'?'Reach combo 10':'ทำคอมโบ 10'), type:'reach_combo',
        need: hard?12 : easy?8 : 10, progress:0 },

      // 4) Perfect ให้ครบ N
      { key:'perfect_5', icon:'💯', label:(LANG==='EN'?'5 PERFECT hits':'PERFECT 5 ครั้ง'), type:'count_perfect',
        need: hard?6 : easy?4 : 5, progress:0 },

      // 5) ติด FEVER หนึ่งครั้ง (หรือกำหนดเป็นเวลาได้ แต่เอาง่ายก่อน)
      { key:'fever_once', icon:'🔥', label:(LANG==='EN'?'Trigger FEVER once':'เปิดโหมด FEVER 1 ครั้ง'), type:'fever_on',
        need:1, progress:0 },

      // 6) เก็บดาวทอง ⭐/🌟 N ชิ้น
      { key:'star_3', icon:'⭐', label:(LANG==='EN'?'Collect 3 stars':'เก็บดาว 3 ดวง'), type:'count_gold',
        need: hard?4 : easy?2 : 3, progress:0 },

      // 7) คะแนนถึง X
      { key:'score_800', icon:'🏅', label:(LANG==='EN'?'Reach score 800':'ทำคะแนนถึง 800'), type:'reach_score',
        need: hard?1000 : easy?600 : 800, progress:0 },

      // 8) ไม่มี miss ใด ๆ ต่อเนื่อง X วิ (reset เมื่อ miss)
      { key:'no_miss_8s', icon:'🛡️', label:(LANG==='EN'?'No miss for 8s':'ไม่พลาด 8 วิ'), type:'time_no_any_miss',
        need: hard?10 : easy?6 : 8, progress:0 },

      // 9) สะสมคอมโบต่อเนื่อง X (เทียบ comboNow)
      { key:'combo_streak_8', icon:'🎯', label:(LANG==='EN'?'Hit-streak 8':'ติดกัน 8 ครั้ง'), type:'reach_combo_strict',
        need: hard?10 : easy?6 : 8, progress:0 },

      // 10) อยู่รอด X วิ (เน้นเล่นต่อเนื่อง)
      { key:'survive_15s', icon:'⌛', label:(LANG==='EN'?'Survive 15s':'เอาตัวรอด 15 วิ'), type:'time_survive',
        need: hard?18 : easy?12 : 15, progress:0 },
    ];
  }

  // ---- core evaluators ----
  function onHit(payload){
    // payload: { result:'good'|'perfect', points, ui, meta:{gold?}, comboNow }
    if(!_cur) return;

    // อัปเดต streak
    _hitStreak = (_hitStreak|0) + 1;

    switch(_cur.type){
      case 'count_hit_good': {
        // นับทุก hit ที่ไม่ใช่ miss (ทั้ง good/perfect)
        _cur.progress++;
        break;
      }
      case 'count_perfect': {
        if(payload?.result==='perfect') _cur.progress++;
        break;
      }
      case 'reach_combo': {
        if((payload?.comboNow|0) >= (_cur.need|0)) _cur.progress = _cur.need;
        break;
      }
      case 'reach_combo_strict': {
        // ใช้ comboNow เช่นกัน
        if((payload?.comboNow|0) >= (_cur.need|0)) _cur.progress = _cur.need;
        break;
      }
      case 'count_gold': {
        if(payload?.meta?.gold) _cur.progress++;
        break;
      }
      // reach_score / time_xxx ประเมินใน tick
    }

    checkDoneOrFail();
  }

  function onMiss(info){
    // info.kind เช่น 'junk_click', 'junk_timeout', 'good_timeout', 'gold_timeout' ...
    _hitStreak = 0;        // รีเซ็ตสตรีคเสมอ
    _sinceAnyMiss = 0;     // รีเซ็ตตัวจับเวลา no-miss
    if(String(info?.kind||'').startsWith('junk')) _sinceJunkMiss = 0;

    if(!_cur) return;

    switch(_cur.type){
      case 'time_no_junk': {
        // มี junk miss -> รีเซ็ตความก้าวหน้า
        if(String(info?.kind||'').startsWith('junk')) _cur.progress = 0;
        break;
      }
      case 'time_no_any_miss': {
        // มี miss ใด ๆ -> รีเซ็ต
        _cur.progress = 0;
        break;
      }
      // เควสต์อื่น ๆ ไม่ต้อง fail ทันที (คงความยืดหยุ่น)
    }

    checkDoneOrFail();
  }

  function onFever(payload){
    _feverOn = !!payload?.on;
    if(!_cur) return;

    if(_cur.type==='fever_once' && _feverOn){
      _cur.progress = _cur.need;
      checkDoneOrFail();
    }
  }

  function onPower(payload){
    // ไม่ต้องทำอะไรพิเศษ: เก็บ star ทำใน onHit(meta.gold)
  }

  function onTick(t){
    // t: { score, dt, fever }
    SCORE = t?.score|0;

    // ตัวจับเวลา global
    _sinceAnyMiss += t?.dt||0;
    _sinceJunkMiss += t?.dt||0;

    if(!_cur) return;
    _cur._time = (_cur._time||0) + (t?.dt||0);

    switch(_cur.type){
      case 'reach_score': {
        if(SCORE >= (_cur.need|0)) _cur.progress = _cur.need;
        break;
      }
      case 'time_no_junk': {
        // เพิ่มเวลาต่อเนื่องที่ไม่มี junk miss
        _cur.progress = Math.min(_cur.need, Math.floor(_sinceJunkMiss));
        break;
      }
      case 'time_no_any_miss': {
        _cur.progress = Math.min(_cur.need, Math.floor(_sinceAnyMiss));
        break;
      }
      case 'time_survive': {
        // อยู่รอดตามเวลา (ไม่สน miss)
        _cur.progress = Math.min(_cur.need, Math.floor(_cur._time));
        break;
      }
      // reach_combo / streak evaluated in onHit via comboNow
    }

    checkDoneOrFail();
  }

  function checkDoneOrFail(){
    if(!_cur) return;
    const done = (_cur.progress|0) >= (_cur.need|0);
    if(done){
      _cur.done = true;
      refreshHUD();
      sayCoach('เยี่ยม! ผ่านเควสต์แล้ว', 'Nice! Quest cleared');
      nextQuest(600);
      return;
    }
    // (ออปชัน) บางเควสต์อาจมีเงื่อนไข fail ทันที—ตอนนี้ออกแบบเป็นแนวรีเซ็ต ไม่ fail
    refreshHUD();
  }

  // ---- Public API ----
  function bindToMain({hud, coach}={}){
    HUD = hud||null; COACH = coach||null;
    return { refresh: refreshHUD };
  }

  function beginRun(modeKey, diff, lang='TH', matchTime=45){
    IN_RUN = true;
    LANG = (lang||'TH').toUpperCase();
    MATCH_TIME = matchTime|0;

    _catalog = buildCatalog(diff||'Normal');
    _queue = shuffle(_catalog.map(cloneQuest));
    _idx = -1;
    _cur = null;

    _doneList = [];
    _failList = [];

    _sinceAnyMiss = 0;
    _sinceJunkMiss = 0;
    _hitStreak = 0;
    _feverOn = false;

    nextQuest(0); // เริ่มเควสต์แรกทันที
  }

  function endRun({score}={}){
    const summary = {
      totalDone: _doneList.length|0,
      doneList: _doneList.slice(0),
      failList: _failList.slice(0),
      lastQuest: _cur ? { key:_cur.key, progress:_cur.progress, need:_cur.need } : null
    };
    // แสดงบน HUD (หาก main เรียก hud.showResult อยู่แล้ว ก็ใช้ข้อมูลนี้)
    return summary;
  }

  function event(type, payload){
    if(!IN_RUN) return;
    switch(type){
      case 'hit':   onHit(payload||{}); break;
      case 'miss':  onMiss(payload||{}); break;
      case 'fever': onFever(payload||{}); break;
      case 'power': onPower(payload||{}); break;
    }
  }

  function tick(t){ if(!IN_RUN) return; onTick(t||{}); }

  return { bindToMain, beginRun, endRun, event, tick };
})();
