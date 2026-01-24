// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Coach + DD + Missions BK)
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// Progress: HHA_HYGIENE_PROGRESS (unlockedMax + best per episode)
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_PROGRESS = 'HHA_HYGIENE_PROGRESS';

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

// ------------------ Progress / Episodes ------------------
function loadProgress(){
  const p = loadJson(LS_PROGRESS, null);
  if(p && typeof p === 'object'){
    return {
      unlockedMax: clamp(p.unlockedMax||1, 1, 3)|0,
      best: (p.best && typeof p.best==='object') ? p.best : {}
    };
  }
  return { unlockedMax:1, best:{} };
}
function saveProgress(p){ saveJson(LS_PROGRESS, p); }

// ------------------ Missions (Goals + Mini quests) ------------------
// Design for Grade 5: goals clear, short text, not too hard.
// Each episode uses: goalsTotal=2, miniTotal=3
function episodeGoals(ep){
  if(ep===1){
    return [
      { id:'G1', text:'ทำครบ 7 ขั้นตอนอย่างน้อย 1 รอบ (loops ≥ 1)', check:(S)=>S.loopsDone>=1 },
      { id:'G2', text:'ห้ามโดนเชื้อเลย (hazHits = 0)', check:(S)=>S.hazHits===0 },
    ];
  }
  if(ep===2){
    return [
      { id:'G1', text:'ทำครบ 7 ขั้นตอนอย่างน้อย 1 รอบ (loops ≥ 1)', check:(S)=>S.loopsDone>=1 },
      { id:'G2', text:'โดนเชื้อได้ไม่เกิน 2 (hazHits ≤ 2)', check:(S)=>S.hazHits<=2 },
    ];
  }
  // ep3
  return [
    { id:'G1', text:'ความถูกต้องสูง (stepAcc ≥ 82%)', check:(S)=>S.stepAcc>=0.82 },
    { id:'G2', text:'MISS ต้องไม่เต็ม (misses ≤ 2)', check:(S)=>S.misses<=2 },
  ];
}

// Mini quest pool (time-limited)
const MINI_POOL = [
  { id:'M_COMBO3', text:'ทำคอมโบให้ถึง 3 ภายในเวลา',  dur:12, check:(st)=>st.combo>=3 },
  { id:'M_FAST',   text:'ยิงถูก 4 ครั้งเร็ว ๆ (RT เฉลี่ย < 1200ms)', dur:14,
    check:(st)=> st._rtWindow.length>=4 && (st._rtWindow.reduce((a,b)=>a+b,0)/st._rtWindow.length) < 1200 },
  { id:'M_CLEAN10',text:'อย่าโดน 🦠 10 วินาที', dur:10, check:(st)=> (st._sinceHazSec >= 10) },
  { id:'M_RECOVER',text:'หลังยิงผิด ให้ยิงถูกติดกัน 2 ครั้ง', dur:14, check:(st)=> st._recoverStreak>=2 },
];

// Pick mini deterministically by RNG
function pickMini(rng, ep){
  // EP1 ง่ายกว่า: ตัด M_FAST ออก
  const pool = (ep===1) ? MINI_POOL.filter(m=>m.id!=='M_FAST') : MINI_POOL.slice();
  return pool[Math.floor(rng()*pool.length)] || pool[0];
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
  const pillGoals= DOC.getElementById('pillGoals');
  const pillMini = DOC.getElementById('pillMini');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const missionsPanel = DOC.getElementById('missionsPanel');
  const goalsText = DOC.getElementById('goalsText');
  const miniText  = DOC.getElementById('miniText');
  const miniTimer = DOC.getElementById('miniTimer');
  const btnMissions = DOC.getElementById('btnMissions');

  const startOverlay = DOC.getElementById('startOverlay');
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
  const episode = clamp(qs('episode', 1), 1, 3)|0;

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.7, hazardRate:0.15, decoyRate:0.27 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40]
  };

  // AI instances
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms
  let spawnAcc=0;

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // Missions state
  const GOALS = episodeGoals(episode);
  const goalsTotal = 2;
  let goalsCleared = 0;
  const goalDone = { G1:false, G2:false };

  const miniTotal = 3;
  let miniCleared = 0;
  let miniActive = null; // {id,text,dur,endsAtMs,startedAtMs}
  let miniEndAtMs = 0;
  let miniWindowSecLeft = 0;

  // mini helper stats
  const miniStats = {
    _rtWindow: [],
    _sinceHazSec: 0,
    _recoverArmed: false,
    _recoverStreak: 0
  };

  function nowMs(){ return performance.now ? performance.now() : Date.now(); }

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  // spawn rect
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

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    // missions counters
    pillGoals && (pillGoals.textContent = `GOALS ${goalsCleared}/${goalsTotal}`);
    pillMini  && (pillMini.textContent  = `MINI ${miniCleared}/${miniTotal}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `EP${episode} • ${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    // missions panel text
    if(goalsText){
      goalsText.textContent =
        `G1: ${GOALS[0].text} ${goalDone.G1?'✅':''}\n` +
        `G2: ${GOALS[1].text} ${goalDone.G2?'✅':''}`;
    }
    if(miniText){
      miniText.textContent = miniActive ? (`${miniActive.text} ${miniActive._done?'✅':''}`) : 'กำลังรอ mini quest…';
    }
    if(miniTimer){
      miniTimer.textContent = miniActive ? (`เหลือเวลา: ${Math.max(0, Math.ceil(miniWindowSecLeft))}s`) : '—';
    }
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
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

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, lockPx = from vr-ui config
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

  // ---- Missions helpers ----
  function updateGoals(){
    const S = {
      loopsDone,
      hazHits,
      stepAcc: getStepAcc(),
      misses: getMissCount()
    };

    let changed=false;
    if(!goalDone.G1 && GOALS[0].check(S)){ goalDone.G1=true; changed=true; }
    if(!goalDone.G2 && GOALS[1].check(S)){ goalDone.G2=true; changed=true; }

    const newCleared = (goalDone.G1?1:0) + (goalDone.G2?1:0);
    if(newCleared !== goalsCleared){
      goalsCleared = newCleared;
      if(changed) showBanner(`🎯 GOAL สำเร็จ! (${goalsCleared}/${goalsTotal})`);
    }
  }

  function startMini(){
    if(miniCleared >= miniTotal) return;
    if(miniActive) return;

    const m = pickMini(rng, episode);
    miniActive = { ...m, startedAtMs: nowMs(), _done:false };
    miniEndAtMs = miniActive.startedAtMs + (miniActive.dur*1000);

    // reset per-mini window stats
    miniStats._rtWindow = [];
    miniStats._recoverArmed = false;
    miniStats._recoverStreak = 0;
    miniWindowSecLeft = miniActive.dur;

    showBanner(`⚡ MINI: ${miniActive.text}`);
  }

  function failMini(){
    if(!miniActive) return;
    showBanner(`⏳ MINI ไม่ทันเวลา!`);
    miniActive = null;
  }

  function clearMini(){
    if(!miniActive || miniActive._done) return;
    miniActive._done = true;
    miniCleared++;
    showBanner(`⚡ MINI สำเร็จ! (${miniCleared}/${miniTotal})`);
    // small delay then next mini can start
    setTimeout(()=>{ miniActive=null; }, 350);
  }

  function tickMini(dt){
    // dt seconds
    miniStats._sinceHazSec += dt;

    if(!miniActive){
      // spawn mini after 3 seconds of play, then every time cleared/failed
      if(elapsedSec() > 3 && miniCleared < miniTotal){
        // start with small probability / or time gate
        if(elapsedSec() < 6 || (Math.floor(elapsedSec()) % 8 === 0)){
          startMini();
        }
      }
      return;
    }

    const t = nowMs();
    miniWindowSecLeft = (miniEndAtMs - t)/1000;

    if(t >= miniEndAtMs){
      failMini();
      return;
    }

    // check pass condition
    if(miniActive.check(miniStats)){
      clearMini();
    }
  }

  // ---- Gameplay judge ----
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // mini: record RT window
      miniStats._rtWindow.push(rt);
      if(miniStats._rtWindow.length > 6) miniStats._rtWindow.shift();

      // mini: recover logic
      if(miniStats._recoverArmed){
        miniStats._recoverStreak++;
      }

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

      updateGoals();
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      // mini: arm recover quest
      miniStats._recoverArmed = true;
      miniStats._recoverStreak = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      warnMissLeft();
      checkFail();
      updateGoals();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      // mini: reset safe timer
      miniStats._sinceHazSec = 0;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      warnMissLeft();
      checkFail();
      updateGoals();
      setHud();
      return;
    }
  }

  function warnMissLeft(){
    const miss = getMissCount();
    const left = missLimit - miss;
    if(left === 2) showBanner('⚠️ MISS เหลือ 2');
    if(left === 1) showBanner('🔥 MISS เหลือ 1 (ระวัง!)');
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // spawn
    const P = dd ? dd.getParams() : base;
    spawnAcc += (P.spawnPerSec * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    // missions tick
    tickMini(dt);
    updateGoals();

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;

    // missions reset
    goalDone.G1 = false; goalDone.G2 = false;
    goalsCleared = 0;
    miniCleared = 0;
    miniActive = null;
    miniEndAtMs = 0;
    miniWindowSecLeft = 0;
    miniStats._sinceHazSec = 0;
    miniStats._recoverArmed = false;
    miniStats._recoverStreak = 0;
    miniStats._rtWindow = [];

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, episode });
    showBanner(`เริ่ม! EP${episode} • STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function calcMedian(arr){
    const a = (arr||[]).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = (a.length-1)/2;
    return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
  }

  function computeGrade(stepAcc, hazHits, misses){
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1 && misses<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2 && misses<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';
    return grade;
  }

  function episodePassRule(S){
    // PASS requires: goals cleared + mini cleared + not fail
    if(S.reason==='fail') return false;

    // EP1: ต้องทำ goals 2/2 และ mini >=2
    if(S.episode===1) return (S.goalsCleared>=2 && S.miniCleared>=2);

    // EP2: goals 2/2 และ mini 3/3
    if(S.episode===2) return (S.goalsCleared>=2 && S.miniCleared>=3);

    // EP3: goals 2/2 และ mini 3/3 และ miss ไม่เต็ม (ย้ำ)
    return (S.goalsCleared>=2 && S.miniCleared>=3 && S.misses<=2);
  }

  function updateProgressAfterRun(summary){
    const prog = loadProgress();
    const ep = summary.episode|0;
    const passed = summary.episodePassed === 1;

    // unlock next episode if passed
    if(passed && prog.unlockedMax < 3){
      if(ep === prog.unlockedMax && prog.unlockedMax < 3){
        prog.unlockedMax = Math.min(3, prog.unlockedMax + 1);
      }
    }

    // best record per episode (simple compare: higher acc then lower miss then higher combo)
    const key = String(ep);
    const prev = prog.best[key] || null;

    const scoreKey = (s)=> (Number(s.stepAcc||0)*10000) - (Number(s.misses||0)*100) + (Number(s.comboMax||0)*1);
    if(!prev || scoreKey(summary) > scoreKey(prev)){
      prog.best[key] = {
        stepAcc: summary.stepAcc,
        misses: summary.misses,
        comboMax: summary.comboMax,
        loopsDone: summary.loopsDone,
        grade: summary.grade,
        timestampIso: summary.timestampIso
      };
    }

    saveProgress(prog);
    summary.unlockedMax = prog.unlockedMax; // attach to summary for map
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    const rtMed = calcMedian(rtOk);

    const misses = getMissCount();
    const grade = computeGrade(stepAcc, hazHits, misses);

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.1.0-prod-bk',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId,
      timestampIso: nowIso(),

      episode,
      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      // progress
      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      // missions
      goalsTotal,
      goalsCleared,
      miniTotal,
      miniCleared,

      // core metrics
      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses,

      medianStepMs: rtMed,

      // ✅ put grade into summary (map needs)
      grade
    };

    // decide pass/fail for episode
    summary.episodePassed = episodePassRule(summary) ? 1 : 0;

    // attach AI extras
    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    // badges/unlocks (optional)
    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    // update progress unlock + best
    updateProgressAfterRun(summary);

    // save last + history
    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    // show end UI
    const passTxt = summary.episodePassed ? 'PASS ✅' : 'TRY AGAIN 🔁';
    endTitle.textContent = (reason==='fail') ? `จบเกม ❌ (Miss เต็ม)` : `จบเกม — ${passTxt}`;
    endSub.textContent = `EP${episode} ${passTxt} • Grade ${grade} • goals ${goalsCleared}/${goalsTotal} • mini ${miniCleared}/${miniTotal} • acc ${(stepAcc*100).toFixed(0)}% • miss ${misses}`;
    endJson.textContent = JSON.stringify(summary, null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  btnMissions?.addEventListener('click', ()=>{
    if(!missionsPanel) return;
    const isOpen = missionsPanel.style.display !== 'none';
    missionsPanel.style.display = isOpen ? 'none' : 'block';
    showBanner(isOpen ? 'ซ่อน Missions' : 'แสดง Missions');
  }, { passive:true });

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

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // particles hooks (optional)
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