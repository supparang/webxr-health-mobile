// === Hero Health Academy — core/quests.js (10 quests + focus + summary) ===
'use strict';

export const Quests = (function(){
  // ----- refs to main/HUD/Coach -----
  let HUD=null, COACH=null;

  // ----- per-run state -----
  let runActive=false, lang='TH', diff='Normal', mode='goodjunk', matchTime=45;

  // chosen 3 quests this run
  let activeList=[];    // [{key,label,icon,need,progress,done,fail,meta:{...}}]
  let activeIdx=0;      // focus index (0..2)

  // global counters this run
  let counters = {
    score: 0,
    hits: 0,
    perfect: 0,
    gold: 0,
    power: 0,
    junkClicks: 0,
    goodTimeout: 0,
    comboNow: 0,
    comboBest: 0,
    feverOn: false,
    feverSecs: 0,
    secsNoJunk: 0,         // for "avoid_junk" quest
    _hadJunkInThisSecond: false,
  };

  // difficulty presets
  const DZ = {
    Easy:   { GOOD:25, PERFECT:4, GOLD:2, NOJUNK_SECS:10, COMBO1:8, COMBOHOLD:8, FEVER_TIMES:1, FEVER_SECS:6, NOMICSMOOTH:10, POWER:2 },
    Normal: { GOOD:35, PERFECT:6, GOLD:3, NOJUNK_SECS:12, COMBO1:10, COMBOHOLD:10, FEVER_TIMES:1, FEVER_SECS:9, NOMICSMOOTH:12, POWER:3 },
    Hard:   { GOOD:45, PERFECT:8, GOLD:4, NOJUNK_SECS:15, COMBO1:12, COMBOHOLD:12, FEVER_TIMES:2, FEVER_SECS:12, NOMICSMOOTH:14, POWER:4 },
  };

  // 10 quest definitions (key, label, icon, needFromDZ, updater hooks)
  const ALL_QUESTS = [
    { key:'good_hits',   icon:'🥗', labelTH:'ตีของดีให้ครบ',         labelEN:'Hit good items',
      need:(dz)=>dz.GOOD,                    tick:null, onHit:(e)=> (e.kind==='good'||e.kind==='perfect') && !e.meta?.junk, },

    { key:'perfect_hits',icon:'💥', labelTH:'PERFECT ให้ครบ',         labelEN:'Make PERFECT hits',
      need:(dz)=>dz.PERFECT,                 tick:null, onHit:(e)=> (e.kind==='perfect') },

    { key:'gold_collect',icon:'🌟', labelTH:'เก็บ GOLD ให้ครบ',       labelEN:'Collect GOLD',
      need:(dz)=>dz.GOLD,                    tick:null, onHit:(e)=> (e.kind==='perfect' && e.meta?.gold===true) },

    { key:'avoid_junk',  icon:'🚫🍔',labelTH:'เลี่ยง JUNK ต่อเนื่อง', labelEN:'Avoid JUNK (seconds)',
      need:(dz)=>dz.NOJUNK_SECS,             tick:(sec)=> sec>0 && !counters._hadJunkInThisSecond, onMiss:(m)=> m.kind==='junk' },

    { key:'combo_once',  icon:'🔗', labelTH:'ทำคอมโบถึงเป้า',         labelEN:'Reach combo target',
      need:(dz)=>dz.COMBO1,                  tick:null, onAny:()=> counters.comboNow>=needOf('combo_once') },

    { key:'combo_hold',  icon:'⏱️', labelTH:'รักษาคอมโบ (วินาที)',    labelEN:'Hold combo (sec)',
      need:(dz)=>dz.COMBOHOLD,               tick:(sec)=> counters.comboNow>=needOf('combo_once') ? sec>0 : 0 },

    { key:'fever_enter', icon:'🔥', labelTH:'เข้า FEVER',             labelEN:'Enter FEVER',
      need:(dz)=>dz.FEVER_TIMES,             tick:null, onFever:(on)=> !!on },

    { key:'fever_time',  icon:'⏳🔥',labelTH:'เวลาใน FEVER (วินาที)',  labelEN:'Time in FEVER (sec)',
      need:(dz)=>dz.FEVER_SECS,              tick:(sec)=> counters.feverOn ? sec : 0 },

    { key:'no_miss_10',  icon:'🎯', labelTH:'ไม่พลาดต่อเนื่อง',       labelEN:'No-miss streak',
      need:(dz)=>dz.NOMICSMOOTH,             tick:null, onAny:()=> counters.comboNow>=needOf('no_miss_10') },

    { key:'power_collect',icon:'🛡️',labelTH:'เก็บพลังพิเศษ',          labelEN:'Collect power-ups',
      need:(dz)=>dz.POWER,                   tick:null, onPower:()=> true },
  ];

  function needOf(key){
    const dz = DZ[diff] || DZ.Normal;
    const q = ALL_QUESTS.find(q=>q.key===key);
    return q ? q.need(dz) : 0;
  }

  // pick 3 quests randomly (consistent labels per lang)
  function pickThree(){
    const arr = [...ALL_QUESTS];
    shuffle(arr);
    return arr.slice(0,3).map(q=>({
      key:q.key, icon:q.icon,
      label: (lang==='EN'? q.labelEN : q.labelTH),
      need: q.need(DZ[diff]||DZ.Normal),
      progress: 0, done:false, fail:false, meta:{}
    }));
  }

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

  // HUD chips refresh
  function refresh(){
    if(!HUD || !HUD.setQuestChips) return;
    const list = activeList.map((m,idx)=>({
      key:m.key, label:m.label, icon:m.icon,
      progress:m.progress|0, need:m.need|0, done:!!m.done, fail:!!m.fail,
      active:(idx===activeIdx)
    }));
    // render + mark active
    HUD.setQuestChips(list);
    // paint active using data-active
    const root = document.getElementById('questChips');
    if(root){
      [...root.children].forEach((el,i)=>{ if(i===activeIdx) el.setAttribute('data-active','1'); else el.removeAttribute('data-active'); });
    }
  }

  function focus(i){
    activeIdx = clamp(i|0,0,Math.max(0,activeList.length-1));
    refresh();
  }

  function advanceFocus(){
    let i = activeIdx;
    for(let k=0;k<activeList.length;k++){
      const idx = (i+k)%activeList.length;
      if(!activeList[idx].done && !activeList[idx].fail){ activeIdx = idx; refresh(); return; }
    }
    // all finished -> keep last
    refresh();
  }

  function incProgress(key, by=1){
    const q = activeList.find(x=>x.key===key);
    if(!q) return;
    if(q.done || q.fail) return;
    q.progress = clamp((q.progress|0)+(by|0), 0, q.need|0);
    if(q.progress>=q.need){ q.done=true; COACH?.say(lang==='EN'?'Quest complete!':'ภารกิจสำเร็จ!'); }
  }

  function tickSeconds(secGone){
    if(!runActive || secGone<=0) return;
    const a = activeList[activeIdx];

    // fever time (accumulates even if not focused)
    incQuestByTick('fever_time', secGone);

    // avoid_junk: increase if this second had no junk
    if(!counters._hadJunkInThisSecond){
      incQuestByTick('avoid_junk', secGone);
      counters.secsNoJunk += secGone;
    } else {
      counters.secsNoJunk = 0;
    }

    // combo_hold
    if(counters.comboNow >= needOf('combo_once')){
      incQuestByTick('combo_hold', secGone);
    }

    counters._hadJunkInThisSecond = false;
    refresh();
  }

  function incQuestByTick(key, sec){
    const q = activeList.find(x=>x.key===key);
    if(!q || q.done || q.fail) return;
    q.progress = clamp((q.progress|0)+(sec|0), 0, q.need|0);
    if(q.progress>=q.need){ q.done=true; COACH?.say(lang==='EN'?'Quest complete!':'ภารกิจสำเร็จ!'); }
  }

  // ---------------- Public API ----------------
  function bindToMain({hud,coach}){
    HUD=hud||HUD; COACH=coach||COACH;
    return { refresh };
  }

  function beginRun(_mode,_diff,_lang,_timeSec){
    mode=_mode||'goodjunk'; diff=_diff||'Normal'; lang=(_lang||'TH').toUpperCase(); matchTime=_timeSec|0;
    counters = { score:0,hits:0,perfect:0,gold:0,power:0,junkClicks:0,goodTimeout:0,
                 comboNow:0,comboBest:0,feverOn:false,feverSecs:0,secsNoJunk:0,_hadJunkInThisSecond:false };
    activeList = pickThree();
    activeIdx = 0;
    runActive=true;
    refresh();
  }

  // hit/miss/power/fever events sent by main/modes
  function event(type, payload={}){
    if(!runActive) return;
    switch(type){
      case 'hit': {
        counters.hits++;
        counters.comboNow = payload.comboNow|0;
        if(payload.points>0) counters.score += (payload.points|0);
        if(payload.kind==='perfect') counters.perfect++;
        if(payload.meta?.gold===true){ counters.gold++; incProgress('gold_collect',1); }

        // good_hits / perfect_hits
        if(payload.kind==='perfect'){ incProgress('perfect_hits',1); incProgress('good_hits',1); }
        else if(payload.kind==='good'){ incProgress('good_hits',1); }

        // combo_once / no_miss_10
        if(counters.comboNow> (counters.comboBest|0)) counters.comboBest = counters.comboNow|0;
        if(counters.comboNow >= needOf('combo_once')) incProgress('combo_once',0); // marked by onAny()
        if(counters.comboNow >= needOf('no_miss_10')) incProgress('no_miss_10',0);

        refresh();
        break;
      }
      case 'miss': {
        counters.comboNow = 0;
        if(payload.kind==='junk'){ counters.junkClicks++; counters._hadJunkInThisSecond = true; }
        refresh();
        break;
      }
      case 'power': {
        counters.power++;
        incProgress('power_collect',1);
        refresh();
        break;
      }
      case 'fever': {
        counters.feverOn = !!payload.on;
        if(payload.on){ incProgress('fever_enter',1); COACH?.say(lang==='EN'?'FEVER!':'ไฟลุก!'); }
        refresh();
        break;
      }
      case 'quest:advance': {
        // manual ask to go next
        advanceFocus();
        break;
      }
    }
  }

  function tick({score=0, dt=0, fever=false}={}){
    counters.score = score|0;
    if(fever && !counters.feverOn){ counters.feverOn=true; } // sync
    if(!fever && counters.feverOn){ counters.feverOn=false; }
    if(fever && dt>0){ counters.feverSecs += dt; }

    if(dt>0){ tickSeconds(dt|0); }

    // auto-advance focus if current quest completed
    const cur = activeList[activeIdx];
    if(cur && (cur.done || cur.fail)) advanceFocus();
  }

  function endRun({score=0}={}){
    runActive=false;
    const totalDone = activeList.filter(q=>q.done).length;
    return { totalDone };
  }

  function getStatSnapshot(){
    return { ...counters };
  }

  function buildSummary(){
    const lines=[];
    const cz = getStatSnapshot();
    lines.push(`Quests: ${activeList.filter(q=>q.done).length}/${activeList.length}`);
    for(const q of activeList){
      const mark = q.done ? '✓' : (q.fail ? '✗' : `${q.progress}/${q.need}`);
      lines.push(`${q.icon} ${q.label}: ${mark}`);
    }
    lines.push(`Gold: ${cz.gold}, Perfect: ${cz.perfect}, Best Combo: ${cz.comboBest}`);
    lines.push(`Fever time: ${Math.round(cz.feverSecs)}s`);
    return lines;
  }

  function profile(){ return {}; }

  return {
    bindToMain, beginRun, endRun, event, tick, getStatSnapshot, buildSummary, profile,
    focus, // optional public
  };
})();
