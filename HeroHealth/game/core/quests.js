// === core/quests.js (difficulty-scaled mini-quests, one-at-a-time) ===
export const Quests = (function(){
  let HUD = null, Coach = null;
  let mode = 'goodjunk', diff = 'Normal', lang = 'TH';
  let matchTime = 45;
  let cur = null;          // {key, icon, need, progress, label}
  let feverOn = false;     // tick fever seconds
  let feverSec = 0;
  let noMissStreak = 0;    // for "no-miss"
  let comboProg = 0;       // visual progress for "combo" quest (resets on miss)
  let lastScore = 0;       // for score target progress
  const rnd = (a,b)=> (a + Math.floor(Math.random()*(b-a+1)));

  // ---------- Difficulty scaling table ----------
  const SCALE = {
    Easy:   { good:[5,8], perfect:[2,4], star:[1,3], fever:[5,8],  nomiss:[3,5], combo:[6,9],  score:[600,1000], shield:[1,1],  golden:[1,3], avoid:[3,5] },
    Normal: { good:[6,10],perfect:[3,6], star:[2,4], fever:[6,12], nomiss:[4,7], combo:[8,12], score:[800,1400], shield:[1,2], golden:[2,4], avoid:[4,8] },
    Hard:   { good:[8,12],perfect:[4,7], star:[3,5], fever:[10,16],nomiss:[6,9], combo:[12,16],score:[1200,2000],shield:[2,3], golden:[3,5], avoid:[6,10] }
  };

  const LABEL = {
    TH: {
      good:   'แตะของดี',
      perfect:'ทำ PERFECT',
      star:   'เก็บดาว ⭐',
      fever:  'สะสมเวลา FEVER',
      nomiss: 'ไม่พลาดต่อเนื่อง',
      combo:  'คอมโบต่อเนื่อง',
      score:  'ทำคะแนนรวม',
      shield: 'เก็บโล่ 🛡️',
      golden: 'เก็บไอคอนทอง 🌟',
      avoid:  'เลี่ยงของไม่ดี (ไม่กด)'
    },
    EN: {
      good:   'Hit GOOD items',
      perfect:'Make PERFECT',
      star:   'Collect Stars ⭐',
      fever:  'FEVER time',
      nomiss: 'No-miss streak',
      combo:  'Combo streak',
      score:  'Total score',
      shield: 'Collect Shields 🛡️',
      golden: 'Collect Golden 🌟',
      avoid:  'Avoid Junk (don’t tap)'
    }
  };
  const ICON = { good:'🥗', perfect:'💥', star:'⭐', fever:'🔥', nomiss:'🟦', combo:'⚡', score:'🏆', shield:'🛡️', golden:'🌟', avoid:'🚫' };

  const ALL_KEYS = ['good','perfect','star','fever','nomiss','combo','score','shield','golden','avoid'];
  let lastKey = null;

  function targetFor(key){
    const S = SCALE[diff] || SCALE.Normal;
    const [a,b] = S[key];
    return rnd(a,b);
  }

  function chooseNext(){
    let pool = ALL_KEYS.slice();
    if (lastKey) pool = pool.filter(k=>k!==lastKey); // เลี่ยงซ้ำทันที
    const key = pool[(Math.random()*pool.length)|0];
    lastKey = key;
    cur = {
      key,
      icon: ICON[key],
      need: targetFor(key),
      progress: 0,
      label: (LABEL[lang==='EN'?'EN':'TH'][key] || key)
    };
    noMissStreak = 0;
    comboProg = 0;
    feverSec = 0;
    lastScore = 0;
    refreshHUD();
  }

  function refreshHUD(){
    if (!HUD) return;
    const chips = [{
      icon: cur.icon,
      label: cur.label,
      progress: (cur.key==='score' ? Math.min(cur.progress|0, cur.need|0) : cur.progress|0),
      need: cur.need|0,
      done: cur.progress >= cur.need,
      fail: false
    }];
    HUD.setQuestChips?.(chips);
    // mission line (ถ้ามี)
    try{
      const line = document.getElementById('missionLine');
      if (line){
        const showProg = cur.key==='score' ? `${Math.min(cur.progress|0,cur.need|0)}/${cur.need}` : `${cur.progress|0}/${cur.need}`;
        line.textContent = `${cur.icon} ${cur.label} • ${showProg}`;
        line.style.display = 'inline-block';
      }
    }catch{}
  }

  function completeQuest(){
    try{ Coach?.say?.(lang==='EN'?'Quest Complete!':'ภารกิจสำเร็จ!'); }catch{}
    chooseNext(); // สุ่มอันใหม่ต่อทันที
  }

  function bump(n=1){
    cur.progress += n|0;
    refreshHUD();
    if (cur.progress >= cur.need) completeQuest();
  }

  // ---------- Public APIs ----------
  function bindToMain(ctx){
    HUD   = ctx?.hud || null;
    Coach = ctx?.coach || null;
    return { refresh: refreshHUD };
  }

  function beginRun(m, d, ln='TH', t=45){
    mode = String(m||'goodjunk');
    diff = String(d||'Normal');
    lang = (String(ln||'TH').toUpperCase()==='EN'?'EN':'TH');
    matchTime = t|0;
    chooseNext();
  }

  function event(type, payload={}){
    if (!cur) return;

    // map events from main/mode
    if (type === 'feverOn'){ feverOn = true; return; }
    if (type === 'feverOff'){ feverOn = false; return; }

    if (type === 'power'){
      if (payload.kind === 'shield' && cur.key==='shield') bump(1);
      if (payload.kind === 'star'   && cur.key==='star')   bump(1);
      return;
    }

    if (type === 'miss'){
      // miss: รีเซ็ต streak เฉพาะบางภารกิจ
      noMissStreak = 0;
      if (cur.key==='combo')   comboProg = 0;          // ต้องเริ่มใหม่
      if (cur.key==='nomiss')  cur.progress = 0;       // นับใหม่
      // เลี่ยงของไม่ดี: นับเฉพาะ "หมดอายุของไม่ดี"
      if (cur.key==='avoid' && payload?.reason === 'expired.bad') bump(1);
      refreshHUD();
      return;
    }

    if (type === 'hit'){
      // ทุก hit → good
      if (cur.key==='good' && (payload?.meta?.good || payload?.kind==='good' || payload?.kind==='perfect')) bump(1);
      // perfect
      if (cur.key==='perfect' && payload?.kind==='perfect') bump(1);
      // golden
      if (cur.key==='golden' && payload?.meta?.golden===true) bump(1);
      // no-miss
      if (cur.key==='nomiss'){ noMissStreak++; if (noMissStreak > cur.progress) { cur.progress = noMissStreak; refreshHUD(); if (cur.progress>=cur.need) completeQuest(); } }
      // combo
      if (cur.key==='combo'){
        const c = Math.max(0, payload?.comboNow|0);
        comboProg = (payload?.missed?0:c);
        // เก็บค่า “ดีที่สุดตอนนี้” เพื่อความต่อเนื่อง
        if (c > cur.progress) { cur.progress = Math.min(c, cur.need); refreshHUD(); if (cur.progress>=cur.need) completeQuest(); }
      }
      return;
    }
  }

  function tick(ctx={}){
    // score target
    if (cur?.key==='score'){
      const s = Math.max(0, ctx.score|0);
      cur.progress = s;
      refreshHUD();
      if (cur.progress >= cur.need) completeQuest();
    }
    // fever seconds
    if (cur?.key==='fever' && (ctx.fever===true)){
      const add = Math.max(1, ctx.dtSec|0); // นับเป็นวินาที
      feverSec += add;
      cur.progress = feverSec;
      refreshHUD();
      if (cur.progress >= cur.need) completeQuest();
    }
  }

  function endRun(){
    // could return a summary later
    return [{ key: cur?.key||'', progress:cur?.progress|0, need:cur?.need|0 }];
  }

  return { bindToMain, beginRun, event, tick, endRun };
})();
