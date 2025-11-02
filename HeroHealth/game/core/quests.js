// === core/quests.js (Mini Quests 10 แบบ + Random 3/Run + Focus + Gold count + Summary) ===
'use strict';

export const Quests = (function(){
  let H=null, Coach=null;

  // สถิติภาพรวมของรอบ
  const stat = {
    mode:'', diff:'', lang:'TH',
    timeTotal:0,
    score:0,
    hitsGood:0,
    hitsPerfect:0,
    hitsGold:0,            // ← นับ 🌟/⭐ gold/power
    stars:0,               // ← ใช้แสดงบน HUD
    penalties:0,           // junk กดผิด
    misses:0,              // good ไม่ทันเวลา
    feverTime:0
  };

  // เควสต์ทั้งหมด (10 แบบ)
  const QUEST_DEFS = [
    { key:'hits_20',      icon:'👆', label:'Tap goods 20',           need:20,  kind:'countHit' },
    { key:'perfect_8',    icon:'💥', label:'Perfect 8',              need:8,   kind:'countPerfect' },
    { key:'combo_10',     icon:'🔥', label:'Combo 10',               need:10,  kind:'comboMax' },
    { key:'gold_3',       icon:'⭐', label:'Collect 3 stars',         need:3,   kind:'countGold' },     // ← นับ gold ตรงนี้
    { key:'nojunk_12',    icon:'🚫', label:'12 goods no junk',       need:12,  kind:'goodsNoJunk' },
    { key:'streak_7s',    icon:'⏱️', label:'7s no miss',            need:7,   kind:'timeNoMiss' },
    { key:'fever_1',      icon:'⚡', label:'Enter FEVER once',       need:1,   kind:'feverEnter' },
    { key:'score_800',    icon:'🏅', label:'Score ≥ 800',            need:800, kind:'reachScore' },
    { key:'good_30',      icon:'🥗', label:'30 goods',               need:30,  kind:'countGood' },
    { key:'end_nopen',    icon:'🛡️', label:'Finish < 3 penalties',  need:3,   kind:'limitPenalty' }
  ];

  // เควสต์ที่ใช้งานในรอบปัจจุบัน (3 ชิ้น) — activeIndex โฟกัสทีละอัน
  let current = [];
  let activeIndex = 0;

  // ตัวแปรช่วย
  let comboNow = 0;
  let junkSince = 0;
  let missFreeTimer = 0;
  let feverOn = false;
  let feverEntered = 0;

  function bindToMain({hud,coach}={}){
    H = hud || H;
    Coach = coach || Coach;
    return { refresh(){ if(H) H.setQuestChips(view()); } };
  }

  function beginRun(mode, diff, lang, matchTimeSec){
    // reset stat
    Object.assign(stat, {
      mode: mode||'', diff: diff||'Normal', lang: (lang||'TH').toUpperCase(),
      timeTotal: matchTimeSec|0, score:0,
      hitsGood:0, hitsPerfect:0, hitsGold:0, stars:0,
      penalties:0, misses:0, feverTime:0
    });

    // pick 3 quests แบบสุ่มจาก 10
    current = draftThree();
    activeIndex = 0;

    // reset helpers
    comboNow = 0; junkSince = 0; missFreeTimer = 0; feverOn = false; feverEntered = 0;

    // HUD
    if (H){
      H.setQuestChips(view());
      H.setStars(stat.stars);
    }
  }

  function draftThree(){
    const pool = [...QUEST_DEFS];
    // Fisher-Yates shuffle เล็ก ๆ
    for(let i=pool.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [pool[i],pool[j]] = [pool[j],pool[i]];
    }
    // ทำสำเนาพร้อม progress
    return pool.slice(0,3).map(q => ({
      key:q.key, label:q.label, icon:q.icon, kind:q.kind, need:q.need,
      progress:0, done:false, fail:false, active:false
    }));
  }

  function setActiveVisual(){
    for(let i=0;i<current.length;i++){
      current[i].active = (i===activeIndex && !current[i].done && !current[i].fail);
    }
    if(H) H.setQuestChips(view());
  }

  function goNextIfDone(){
    // ถ้า active quest done/fail ให้เลื่อน
    if(activeIndex<current.length && (current[activeIndex].done || current[activeIndex].fail)){
      activeIndex++;
      if(activeIndex<current.length){
        Coach?.say?.('Quest next!');
        setActiveVisual();
      }
    }
  }

  function applyProgress(kind, amount=1){
    const q = current[activeIndex];
    if(!q || q.done || q.fail) return;

    switch(q.kind){
      case 'countHit':
        if(kind==='good' || kind==='perfect' || kind==='gold'){ q.progress+=amount; }
        break;
      case 'countPerfect':
        if(kind==='perfect'){ q.progress+=amount; }
        break;
      case 'comboMax':
        if(kind==='combo'){ q.progress=Math.max(q.progress, amount); } // amount=comboNow
        break;
      case 'countGold':
        if(kind==='gold'){ q.progress+=amount; }   // ✅ gold นับที่นี่
        break;
      case 'goodsNoJunk':
        if(kind==='good' || kind==='perfect' || kind==='gold'){ q.progress+=amount; }
        if(kind==='penalty'){ q.fail=true; } // เจอ junk ระหว่างภารกิจนี้ = fail
        break;
      case 'timeNoMiss':
        if(kind==='tick'){ q.progress = Math.min(q.need, amount); } // amount = missFreeTimer(s)
        if(kind==='miss'){ q.progress=0; } // reset
        break;
      case 'feverEnter':
        if(kind==='feverEnter'){ q.progress = Math.min(q.need, q.progress+1); }
        break;
      case 'reachScore':
        if(kind==='score'){ q.progress = Math.min(q.need, amount); } // amount = score now
        break;
      case 'countGood':
        if(kind==='good'){ q.progress+=amount; }
        break;
      case 'limitPenalty':
        if(kind==='penaltyCount'){ q.progress = Math.min(q.need, amount); } // amount = penalties so far
        break;
      default: break;
    }

    if(q.need>0 && q.progress>=q.need && !q.fail){
      q.done = true;
      Coach?.say?.('Quest complete!');
    }
    if(H) H.setQuestChips(view());
    if(q.done || q.fail) goNextIfDone();
  }

  // === Events from main ===
  function event(ev, payload={}){
    switch(ev){
      case 'hit': {
        const {kind='good', points=0, meta={}} = payload;
        stat.score += (points|0);
        if(kind==='gold' || meta.golden){ stat.hitsGold++; stat.stars++; applyProgress('gold',1); }
        if(kind==='perfect'){ stat.hitsPerfect++; applyProgress('perfect',1); }
        if(meta.good || kind==='good' || kind==='perfect' || kind==='gold'){
          stat.hitsGood++; junkSince++; applyProgress('good',1); applyProgress('countHit',1);
        }
        // combo จะถูกอัปเดตจาก main ผ่าน 'combo' แยก (อ่านต่อด้านล่าง)
        if(H){ H.setStars(stat.stars); H.updateHUD(stat.score, undefined); }
        break;
      }
      case 'combo': {
        comboNow = payload.now|0;
        applyProgress('combo', comboNow);
        break;
      }
      case 'penalty': {
        stat.penalties++;
        junkSince = 0;          // ทำลายภารกิจ goods-no-junk
        applyProgress('penalty',1);
        applyProgress('penaltyCount', stat.penalties);
        break;
      }
      case 'miss': {
        stat.misses++;
        missFreeTimer = 0;      // time-no-miss reset
        applyProgress('miss',1);
        break;
      }
      case 'fever': {
        if(payload.on && !feverOn){ feverOn=true; feverEntered++; applyProgress('feverEnter',1); }
        if(!payload.on && feverOn){ feverOn=false; }
        break;
      }
      default: break;
    }
  }

  // === Ticking from main each second
  function tick({dt=1, score=0, fever=false}={}){
    // เวลาปลอด miss สำหรับภารกิจ timeNoMiss
    missFreeTimer += dt;
    applyProgress('tick', Math.floor(missFreeTimer));

    // คะแนน/fever/time
    stat.score = score|0;
    if(fever) stat.feverTime += dt;

    // reachScore เควสต์
    applyProgress('score', stat.score);

    if(H){
      H.setQuestChips(view());
    }
  }

  // === แสดงรายการเควสต์สำหรับ HUD
  function view(){
    return current.map((q,i)=>({
      key:q.key, label:q.label, icon:q.icon, need:q.need,
      progress:q.progress|0, done:!!q.done, fail:!!q.fail,
      active: (i===activeIndex && !q.done && !q.fail)
    }));
  }

  function endRun({score=0}={}){
    stat.score = score|0;
    const totalDone = current.filter(q=>q.done).length;
    const summary = {
      totalDone,
      selected: current.map(q=>({ key:q.key, label:q.label, need:q.need, progress:q.progress|0, done:!!q.done, fail:!!q.fail })),
      stars: stat.stars,
      hitsGold: stat.hitsGold,
      penalties: stat.penalties,
      misses: stat.misses,
      feverTime: Math.round(stat.feverTime)
    };
    return summary;
  }

  // snapshot สั้น ๆ ให้ main/hud ใช้
  function getStatSnapshot(){
    return {
      stars: stat.stars,
      hitsGold: stat.hitsGold,
      penalties: stat.penalties,
      misses: stat.misses,
      score: stat.score
    };
  }

  return {
    bindToMain,
    beginRun,
    endRun,
    event,
    tick,
    getStatSnapshot
  };
})();
