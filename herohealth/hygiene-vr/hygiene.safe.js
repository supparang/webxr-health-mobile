// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Coach + DD)
// PACK R/S/T: Practice 15s + Boss + Mini + Story 3 Days + Daily BG + SFX
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_STORY = 'HHA_HYGIENE_STORY';

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}
function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

// ------------------ Steps (emoji mapping) ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];
const ICON_HAZ = '🦠';

// ------------------ STORY (3 Days) ------------------
const DAYS = [
  {
    day: 1,
    title: '📚 Day 1 — ห้องเรียน',
    text: 'ครูประกาศ: “ก่อนกินขนม ต้องล้างมือ 7 ขั้นตอนให้ถูก!”\nยิงเฉพาะ STEP ปัจจุบัน และอย่าโดน 🦠',
    rule: { hazardMul: 1.00, decoyMul: 0.90, spawnMul: 0.95, bossHpDelta: -1 },
    goal: { type:'miss_max', value: 2, label:'ทำ MISS ≤ 2' },
    sticker: '📚 วันนี้: ยิงแม่น ๆ • MISS ≤ 2',
    bg: 'classroom'
  },
  {
    day: 2,
    title: '🍛 Day 2 — โรงอาหาร',
    text: 'วันนี้แถวยาว! รีบแต่ห้ามพลาด\nเชื้อเยอะขึ้น + ตัวหลอกเยอะขึ้น ต้องใจเย็น',
    rule: { hazardMul: 1.15, decoyMul: 1.18, spawnMul: 1.05, bossHpDelta: 0 },
    goal: { type:'boss_clear', value: 1, label:'ชนะบอส 1 ครั้ง' },
    sticker: '🍛 วันนี้: decoy เยอะ • ใจเย็นแล้วจะชนะ',
    bg: 'canteen'
  },
  {
    day: 3,
    title: '🛝 Day 3 — สนามเด็กเล่น',
    text: 'Germ King ตัวจริงโผล่! 👑🦠\nต้องรักษาคอมโบและยิง weak spot ให้แม่น',
    rule: { hazardMul: 1.28, decoyMul: 1.10, spawnMul: 1.12, bossHpDelta: +2 },
    goal: { type:'combo_min', value: 12, label:'ทำ COMBO ≥ 12' },
    sticker: '🛝 วันนี้: Germ King ดุ! • COMBO ≥ 12',
    bg: 'playground'
  }
];
function loadStory(){
  const fb = { unlockedDay:1, lastDayPlayed:1, clearedDays:[] };
  const s = loadJson(LS_STORY, fb);
  if(!s || typeof s !== 'object') return fb;
  if(!Array.isArray(s.clearedDays)) s.clearedDays = [];
  s.unlockedDay = clamp(s.unlockedDay||1, 1, 3);
  s.lastDayPlayed = clamp(s.lastDayPlayed||1, 1, 3);
  return s;
}
function saveStory(st){ saveJson(LS_STORY, st); }

// ------------------ PACK T: SFX (WebAudio, no asset) ------------------
function makeSFX(enabled){
  let ctx = null;
  function ensure(){
    if(!enabled) return null;
    if(ctx) return ctx;
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function beep(freq, durMs, type='sine', gain=0.04){
    const c = ensure(); if(!c) return;
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g); g.connect(c.destination);
      o.start();
      setTimeout(()=>{ try{o.stop();}catch{} }, durMs);
    }catch{}
  }
  return {
    ok(){ beep(880, 55, 'triangle', 0.05); },
    wrong(){ beep(220, 80, 'square', 0.035); },
    haz(){ beep(140, 120, 'sawtooth', 0.04); },
    mini(){ beep(660, 60, 'triangle', 0.05); setTimeout(()=>beep(990, 60,'triangle',0.05), 65); },
    bossSpawn(){ beep(330, 90,'sawtooth',0.05); setTimeout(()=>beep(220, 120,'sawtooth',0.05), 95); },
    bossClear(){ beep(523, 70,'triangle',0.05); setTimeout(()=>beep(784, 90,'triangle',0.05), 80); }
  };
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillBoss = DOC.getElementById('pillBoss');
  const bossFill = DOC.getElementById('bossFill');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');
  const dailySticker = DOC.getElementById('dailySticker');

  const startOverlay = DOC.getElementById('startOverlay');
  const storyOverlay = DOC.getElementById('storyOverlay');
  const storyTitle = DOC.getElementById('storyTitle');
  const storyText  = DOC.getElementById('storyText');
  const storyCountdown = DOC.getElementById('storyCountdown');
  const btnSkipStory = DOC.getElementById('btnSkipStory');

  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart   = DOC.getElementById('btnStart');
  const btnRestart = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // PACK T: SFX on/off
  const sfxOn = (qs('sfx', '1') !== '0') && (runMode !== 'study');
  const SFX = makeSFX(sfxOn);

  // PACK R: practice
  const practiceOn = (qs('practice','1') !== '0') && (runMode !== 'study');
  const practiceSec = clamp(qs('practiceSec', 15), 8, 40);

  // PACK S: story
  const storyOn = (qs('story','1') !== '0') && (runMode !== 'study');
  const story = loadStory();
  let dayReq = clamp(qs('day', story.lastDayPlayed || 1), 1, 3);
  if(storyOn && dayReq > story.unlockedDay) dayReq = story.unlockedDay;
  const dayCfg = DAYS.find(d=>d.day===dayReq) || DAYS[0];
  story.lastDayPlayed = dayReq;
  saveStory(story);

  // Apply daily BG + sticker
  try{ DOC.body.dataset.bg = dayCfg.bg; }catch{}
  if(dailySticker) dailySticker.textContent = dayCfg.sticker || '📌 วันนี้: —';

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  // Apply day multipliers
  const dayRule = storyOn ? (dayCfg.rule || {}) : {};
  const mul = (v,m)=>Number(v)*(m==null?1:Number(m));
  base.spawnPerSec = mul(base.spawnPerSec, dayRule.spawnMul);
  base.hazardRate  = clamp(mul(base.hazardRate, dayRule.hazardMul), 0.03, 0.50);
  base.decoyRate   = clamp(mul(base.decoyRate, dayRule.decoyMul), 0.05, 0.60);

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40]
  };

  // AI instances (optional)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let score=0;
  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // Practice + Real
  let isPractice = false;
  let realStarted = false;

  // Boss + Mini
  let bossMeter = 0;
  let bossActive = false;
  let bossHp = 0;
  let bossHpMax = 10;
  let bossLeft = 0;
  let bossClears = 0;

  let miniTimer = 0;
  let miniActive = false;

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // hygiene: miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function reduceMissOne(){
    if(hazHits > 0){ hazHits--; return true; }
    if(wrongStepHits > 0){ wrongStepHits--; return true; }
    return false;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}${storyOn?` • day=${dayCfg.day}`:''}`);

    // Boss HUD
    const pct = Math.max(0, Math.min(1, bossActive ? (bossHp/Math.max(1,bossHpMax)) : bossMeter));
    if(pillBoss){
      pillBoss.textContent = bossActive ? `BOSS HP ${(pct*100).toFixed(0)}%` : `BOSS ${(pct*100).toFixed(0)}%`;
    }
    if(bossFill){
      bossFill.style.width = `${pct*100}%`;
    }
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<5;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
  }

  function spawnMini(){
    miniActive = true;
    const obj = createTarget('mini', '🎯', -1);
    setTimeout(()=>{
      try{
        if(!running) return;
        if(targets.find(t=>t.id===obj.id)){
          removeTarget(obj);
          miniActive = false;
        }
      }catch{}
    }, 3000);
    return obj;
  }

  function spawnBoss(){
    const weak = STEPS[stepIdx].icon;
    const emoji = `👑${weak}`;
    bossActive = true;

    const delta = storyOn ? (dayCfg.rule?.bossHpDelta||0) : 0;
    bossHpMax = (diff==='hard') ? (12+delta) : (diff==='easy' ? (9+delta) : (10+delta));
    bossHpMax = clamp(bossHpMax, 7, 18);
    bossHp = bossHpMax;

    bossLeft = (diff==='hard') ? 12 : 10;

    SFX.bossSpawn();
    showBanner('🦠👑 BOSS มาแล้ว! ยิง weak spot ของ STEP ปัจจุบัน!');
    emit('hha:judge', { kind:'boss_spawn', hp: bossHpMax, day: storyOn?dayCfg.day:null });

    while(targets.length > 10){
      const t = targets.shift();
      t?.el?.remove();
    }
    return createTarget('boss', emoji, stepIdx);
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // MINI
    if(obj.kind === 'mini'){
      const reduced = reduceMissOne();
      combo = Math.min(combo+2, 999);
      score += 15;

      SFX.mini();
      showBanner(reduced ? '🎯 MINI สำเร็จ! ลด MISS -1' : '🎯 MINI! ได้โบนัสคอมโบ');
      emit('hha:judge', { kind:'mini_pass', reduced, rtMs: rt, source, extra });

      miniActive = false;
      removeTarget(obj);
      setHud();
      return;
    }

    // BOSS
    if(obj.kind === 'boss'){
      const weak = STEPS[stepIdx].icon;
      const text = (obj.el?.textContent || '');

      if(!bossActive){
        removeTarget(obj);
        return;
      }

      const ok = text.includes(weak);
      if(ok){
        bossHp--;
        score += 8;

        showBanner(`👑 โดนบอส! HP ${bossHp}/${bossHpMax}`);
        emit('hha:judge', { kind:'boss_hit', hp: bossHp, hpMax: bossHpMax, source, extra });

        if(bossHp <= 0){
          bossActive = false;
          bossClears++;
          score += 40;

          SFX.bossClear();
          showBanner('🏆 ชนะบอส! โบนัสใหญ่!');
          emit('hha:judge', { kind:'boss_clear', bossClears });

          timeLeft += 4;
          reduceMissOne();
        }else{
          SFX.ok();
        }
      }else{
        combo = Math.max(0, combo-3);
        score = Math.max(0, score-2);
        SFX.wrong();
        showBanner(`⚠️ บอสมี weak spot: ${weak} ตาม STEP ปัจจุบัน`);
        emit('hha:judge', { kind:'boss_wrong', weak, source, extra });
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // GOOD
    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      score += 5;
      rtOk.push(rt);

      SFX.ok();
      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // WRONG
    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      SFX.wrong();
      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    // HAZ
    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      SFX.haz();
      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    score=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    isPractice=false; realStarted=false;

    bossMeter=0; bossActive=false; bossHp=0; bossLeft=0; bossClears=0;
    miniTimer=0; miniActive=false;

    setHud();
  }

  function startRealRun(){
    realStarted = true;
    isPractice = false;

    clearTargets();
    timeLeft = timePlannedSec;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    showBanner(`เริ่ม RUN จริง! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, practice:false, storyOn, day: storyOn?dayCfg.day:null });

    requestAnimationFrame(tick);
  }

  let storyTimer = null;
  function showStoryThenStart(){
    if(!storyOn){
      startGame();
      return;
    }
    if(storyTitle) storyTitle.textContent = dayCfg.title;
    if(storyText) storyText.textContent = `${dayCfg.text}\n\n🎯 เป้าหมายวันนี้: ${dayCfg.goal.label}`;
    if(storyOverlay) storyOverlay.style.display = 'grid';

    let left = 5;
    if(storyCountdown) storyCountdown.textContent = String(left);

    clearInterval(storyTimer);
    storyTimer = setInterval(()=>{
      left--;
      if(storyCountdown) storyCountdown.textContent = String(Math.max(0,left));
      if(left <= 0){
        clearInterval(storyTimer);
        if(storyOverlay) storyOverlay.style.display = 'none';
        startGame();
      }
    }, 1000);
  }

  function startGame(){
    resetGame();
    running=true;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    if(practiceOn){
      isPractice = true;
      timeLeft = practiceSec;
      tStartMs = nowMs();
      tLastMs = tStartMs;

      showBanner(`ซ้อม ${practiceSec}s: ยิงเฉพาะ STEP ปัจจุบัน!`);
      emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec: practiceSec, practice:true, storyOn, day: storyOn?dayCfg.day:null });

      requestAnimationFrame(tick);
      return;
    }

    startRealRun();
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.1.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      day: storyOn ? dayCfg.day : null,
      dayTitle: storyOn ? dayCfg.title : null,

      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),

      bossClears,
      scoreFinal: score,

      medianStepMs: rtMed
    };

    // Story goal pass/unlock
    let dayPassed = false;
    if(storyOn){
      const g = dayCfg.goal;
      if(g.type === 'miss_max') dayPassed = (getMissCount() <= g.value);
      if(g.type === 'boss_clear') dayPassed = ((bossClears|0) >= g.value);
      if(g.type === 'combo_min') dayPassed = ((comboMax|0) >= g.value);
      summary.dayGoal = g;
      summary.dayPassed = dayPassed;

      if(dayPassed){
        const st = loadStory();
        if(!st.clearedDays.includes(dayCfg.day)) st.clearedDays.push(dayCfg.day);
        if(dayCfg.day >= st.unlockedDay && st.unlockedDay < 3){
          st.unlockedDay = Math.min(3, dayCfg.day + 1);
        }
        saveStory(st);
      }
      summary.storyUnlockedDay = loadStory().unlockedDay;
    }

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    let sub = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • score ${score}`;
    if(storyOn) sub += dayPassed ? ' • ✅ ผ่านเป้าหมายวันนี้' : ' • ❌ ยังไม่ผ่านเป้าหมายวันนี้';
    endSub.textContent = sub;

    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    // Practice: หมดเวลาแล้วเข้า real run
    if(isPractice && timeLeft <= 0){
      isPractice = false;
      startRealRun();
      return;
    }

    // Real: time out
    if(!isPractice && timeLeft <= 0){
      endGame('time');
      return;
    }

    // Mini timer (เฉพาะ real)
    if(!isPractice){
      miniTimer += dt;
      const miniEvery = (diff==='hard') ? 14 : 18;
      if(!miniActive && miniTimer >= miniEvery){
        miniTimer = 0;
        spawnMini();
        showBanner('🎯 MINI! ยิงให้ทันรับรางวัล!');
      }
    }

    // Boss logic (เฉพาะ real)
    if(!isPractice){
      if(!bossActive){
        const gain = (combo>=6 ? 0.012 : 0.007);
        bossMeter = clamp(bossMeter + gain*dt, 0, 1);
        if(bossMeter >= 1){
          bossMeter = 0;
          spawnBoss();
        }
      }else{
        bossLeft -= dt;
        if(rng() < 0.10 * dt){
          createTarget('haz', ICON_HAZ, -1);
        }
        if(bossLeft <= 0){
          bossActive = false;
          showBanner('🦠 บอสหนีไป! เก็บเกจใหม่');
          emit('hha:judge', { kind:'boss_escape' });
        }
      }
    }

    // spawn (always)
    const P = dd ? dd.getParams() : base;
    let spawnAcc = tick._acc || 0;
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }
    tick._acc = spawnAcc;

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });
    setHud();
    requestAnimationFrame(tick);
  }

  // UI binds
  btnStart?.addEventListener('click', showStoryThenStart, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', ()=>{ realStarted=false; showStoryThenStart(); }, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  btnSkipStory?.addEventListener('click', ()=>{
    clearInterval(storyTimer);
    if(storyOverlay) storyOverlay.style.display = 'none';
    startGame();
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // badge/unlock popups
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // initial
  setHud();
}