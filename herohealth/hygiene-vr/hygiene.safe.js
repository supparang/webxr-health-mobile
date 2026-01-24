// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Missions BK + Storm/Boss/Shield BL)
// Emits: hha:start, hha:time, hha:judge, hha:end
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

// ------------------ Steps ------------------
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
const ICON_SHIELD = '🛡️';

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
  return [
    { id:'G1', text:'ความถูกต้องสูง (stepAcc ≥ 82%)', check:(S)=>S.stepAcc>=0.82 },
    { id:'G2', text:'MISS ต้องไม่เต็ม (misses ≤ 2)', check:(S)=>S.misses<=2 },
  ];
}

const MINI_POOL = [
  { id:'M_COMBO3', text:'ทำคอมโบให้ถึง 3 ภายในเวลา',  dur:12, check:(st)=>st.combo>=3 },
  { id:'M_FAST',   text:'ยิงถูก 4 ครั้งเร็ว ๆ (RT เฉลี่ย < 1200ms)', dur:14,
    check:(st)=> st._rtWindow.length>=4 && (st._rtWindow.reduce((a,b)=>a+b,0)/st._rtWindow.length) < 1200 },
  { id:'M_CLEAN10',text:'อย่าโดน 🦠 10 วินาที', dur:10, check:(st)=> (st._sinceHazSec >= 10) },
  { id:'M_RECOVER',text:'หลังยิงผิด ให้ยิงถูกติดกัน 2 ครั้ง', dur:14, check:(st)=> st._recoverStreak>=2 },
];

function pickMini(rng, ep){
  const pool = (ep===1) ? MINI_POOL.filter(m=>m.id!=='M_FAST') : MINI_POOL.slice();
  return pool[Math.floor(rng()*pool.length)] || pool[0];
}

// ------------------ Storm plan (EP2/EP3) ------------------
function getStormPlan(ep){
  // cycleSec: ทุกกี่วิเริ่มพายุ, durSec: พายุนานเท่าไร
  if(ep===2) return { cycleSec: 18, durSec: 6 };
  if(ep===3) return { cycleSec: 16, durSec: 8 };
  return { cycleSec: 9999, durSec: 0 }; // EP1 no storm
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // HUD handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillGoals= DOC.getElementById('pillGoals');
  const pillMini = DOC.getElementById('pillMini');
  const pillShield = DOC.getElementById('pillShield');
  const pillStorm = DOC.getElementById('pillStorm');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  // Boss UI
  const bossBar = DOC.getElementById('bossBar');
  const bossFill = DOC.getElementById('bossFill');
  const bossTitle = DOC.getElementById('bossTitle');
  const bossSub = DOC.getElementById('bossSub');

  // FX
  const stormFx = DOC.getElementById('stormFx');

  // Missions panel
  const missionsPanel = DOC.getElementById('missionsPanel');
  const goalsText = DOC.getElementById('goalsText');
  const miniText  = DOC.getElementById('miniText');
  const miniTimer = DOC.getElementById('miniTimer');
  const btnMissions = DOC.getElementById('btnMissions');

  // overlays
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

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.18, shieldRate:0.03 };
    if(diff==='hard') return { spawnPerSec:2.7, hazardRate:0.15, decoyRate:0.27, shieldRate:0.02 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, shieldRate:0.025 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.30],
    decoyRate:[0.10, 0.42]
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

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  let shieldPicked=0;
  let shieldBlocked=0;
  let shieldCharges=0;

  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // missions
  const GOALS = episodeGoals(episode);
  const goalsTotal = 2;
  let goalsCleared = 0;
  const goalDone = { G1:false, G2:false };

  const miniTotal = 3;
  let miniCleared = 0;
  let miniActive = null;
  let miniEndAtMs = 0;
  let miniWindowSecLeft = 0;

  const miniStats = {
    _rtWindow: [],
    _sinceHazSec: 0,
    _recoverArmed: false,
    _recoverStreak: 0,
    combo: 0
  };

  // Storm
  const stormPlan = getStormPlan(episode);
  let stormOn=false;
  let stormEndsAtMs=0;
  let stormSecondsTotal=0;

  // Boss (EP3)
  let bossOn=false;
  let bossHpMax=12;
  let bossHp=12;
  let bossDefeated=0;
  let bossReqStep=0; // ต้องทำ STEP 1..7 ต่อเนื่อง
  let bossHits=0;

  function nowMs(){ return performance.now ? performance.now() : Date.now(); }

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

  function elapsedSec(){ return running ? ((nowMs()-tStartMs)/1000) : 0; }

  function getMissCount(){
    // ✅ BL: ถ้าบล็อกเชื้อด้วย Shield -> ไม่นับเป็น miss
    return (wrongStepHits + hazHits);
  }

  function getStepAcc(){ return totalStepHits ? (correctHits/totalStepHits) : 0; }

  function setBossUI(){
    if(!bossBar) return;
    if(!bossOn){ bossBar.style.display='none'; return; }
    bossBar.style.display='block';
    if(bossTitle) bossTitle.textContent = '👑 BOSS: Handwash Master';
    const pct = clamp(bossHp / Math.max(1,bossHpMax), 0, 1) * 100;
    if(bossFill) bossFill.style.width = pct.toFixed(1)+'%';
    if(bossSub){
      const need = STEPS[bossReqStep]?.icon || '🫧';
      bossSub.textContent = `ต้องยิง STEP ต่อเนื่อง: ตอนนี้ ${need} (${bossReqStep+1}/7)`;
    }
  }

  function setStormUI(leftSec){
    if(!pillStorm) return;
    if(stormOn){
      pillStorm.style.display = '';
      pillStorm.textContent = `STORM ${Math.max(0, Math.ceil(leftSec))}s`;
      DOC.body.classList.add('is-storm');
    }else{
      pillStorm.style.display = 'none';
      DOC.body.classList.remove('is-storm');
    }
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    pillGoals && (pillGoals.textContent = `GOALS ${goalsCleared}/${goalsTotal}`);
    pillMini  && (pillMini.textContent  = `MINI ${miniCleared}/${miniTotal}`);
    pillShield && (pillShield.textContent = `SHIELD ${shieldCharges}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `EP${episode} • ${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

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

    setBossUI();
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

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function getLiveParams(){
    const P0 = dd ? dd.getParams() : base;
    // BL: Storm boosts params
    if(!stormOn) return P0;

    const boosted = {
      spawnPerSec: clamp(P0.spawnPerSec + 0.9, bounds.spawnPerSec[0], bounds.spawnPerSec[1]),
      hazardRate:  clamp(P0.hazardRate + 0.10, bounds.hazardRate[0], bounds.hazardRate[1]),
      decoyRate:   clamp(P0.decoyRate + 0.05, bounds.decoyRate[0], bounds.decoyRate[1]),
      shieldRate:  P0.shieldRate
    };
    return boosted;
  }

  function spawnOne(){
    // Boss mode: เน้นเป้าถูก step ที่ต้องทำต่อเนื่อง + มีเชื้อคั่นให้ลุ้น
    if(bossOn){
      const r = rng();
      if(r < 0.18) return createTarget('haz', ICON_HAZ, -1);
      if(r < 0.24) return createTarget('shield', ICON_SHIELD, -2);
      // good = STEP ที่ต้องการใน boss sequence
      const need = STEPS[bossReqStep];
      return createTarget('good', need.icon, bossReqStep);
    }

    const P = getLiveParams();
    const r = rng();

    // spawn shield occasionally (more during storm)
    const shieldRate = stormOn ? (P.shieldRate + 0.02) : P.shieldRate;
    if(r < shieldRate){
      return createTarget('shield', ICON_SHIELD, -2);
    }

    const r2 = rng();
    if(r2 < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r2 < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<5;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      const s = STEPS[stepIdx];
      return createTarget('good', s.icon, stepIdx);
    }
  }

  // ------------------ Missions logic ------------------
  function updateGoals(){
    const S = { loopsDone, hazHits, stepAcc:getStepAcc(), misses:getMissCount() };
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

    // BL: ให้โอกาสช่วยด้วย shield drop เล็กน้อย (รู้สึกแฟร์)
    if(shieldCharges===0 && rng()<0.55){
      createTarget('shield', ICON_SHIELD, -2);
      showBanner('🛡️ โผล่มาให้ช่วยแล้ว! เก็บได้ 1 ครั้ง');
    }
  }
  function clearMini(){
    if(!miniActive || miniActive._done) return;
    miniActive._done = true;
    miniCleared++;
    showBanner(`⚡ MINI สำเร็จ! (${miniCleared}/${miniTotal})`);
    setTimeout(()=>{ miniActive=null; }, 350);
  }
  function tickMini(dt){
    miniStats._sinceHazSec += dt;
    miniStats.combo = combo;

    if(!miniActive){
      if(elapsedSec() > 3 && miniCleared < miniTotal){
        if(elapsedSec() < 6 || (Math.floor(elapsedSec()) % 8 === 0)){
          startMini();
        }
      }
      return;
    }

    const t = nowMs();
    miniWindowSecLeft = (miniEndAtMs - t)/1000;

    if(t >= miniEndAtMs){ failMini(); return; }
    if(miniActive.check(miniStats)){ clearMini(); }
  }

  // ------------------ Storm logic ------------------
  function maybeStorm(){
    if(episode < 2) return;

    const e = elapsedSec();
    const cycle = stormPlan.cycleSec;
    const dur = stormPlan.durSec;

    // start storm at cycle boundary, but not if boss on
    if(bossOn) return;

    const phase = (cycle>0) ? (e % cycle) : 9999;

    if(!stormOn && phase < 0.20 && e > 6){
      stormOn = true;
      stormEndsAtMs = nowMs() + dur*1000;
      showBanner('🌀 STORM! พายุเชื้อมาแล้ว!');
    }

    if(stormOn){
      const left = (stormEndsAtMs - nowMs())/1000;
      setStormUI(left);
      if(left <= 0){
        stormOn=false;
        setStormUI(0);
        showBanner('✅ พายุสงบแล้ว');
      }else{
        stormSecondsTotal += (Math.max(0, Math.min(0.25, 1/60))); // approx add tiny each frame
      }
    }else{
      setStormUI(0);
    }
  }

  // ------------------ Boss logic (EP3) ------------------
  function maybeStartBoss(){
    if(episode !== 3) return;
    if(bossOn || bossDefeated) return;

    // Trigger: เมื่อ goals ครบ 2 และ mini ครบ 3 หรือเวลาเหลือน้อยกว่า ~40%
    const e = elapsedSec();
    const timeRatio = (timePlannedSec>0) ? (timeLeft/timePlannedSec) : 1;

    const ready = (goalsCleared>=2 && miniCleared>=3);
    const forced = (timeRatio < 0.42 && e > 18);

    if(ready || forced){
      bossOn = true;
      bossHpMax = 12;
      bossHp = 12;
      bossReqStep = 0;
      bossHits = 0;
      stormOn = false; // ไม่ซ้อนกับ storm
      setStormUI(0);

      showBanner('👑 บอสมาแล้ว! ทำ STEP ต่อเนื่องเพื่อชนะ!');
      if(bossBar) bossBar.style.display='block';
      setBossUI();

      // clear clutter แล้วเริ่มบอสด้วยเป้าชัด ๆ
      clearTargets();
      for(let i=0;i<6;i++) spawnOne();
    }
  }

  function bossAdvanceOnGoodHit(){
    bossHits++;
    bossHp = Math.max(0, bossHp - 1);

    bossReqStep++;
    if(bossReqStep >= 7){
      bossReqStep = 0;
      // bonus damage for completing full sequence
      bossHp = Math.max(0, bossHp - 2);
      showBanner('🏁 ครบ 7 ขั้นตอนต่อเนื่อง! โบนัสดาเมจ!');
    }else{
      showBanner(`👑 ดีมาก! ต่อไป ${STEPS[bossReqStep].icon} (${bossReqStep+1}/7)`);
    }

    setBossUI();

    if(bossHp <= 0){
      bossOn = false;
      bossDefeated = 1;
      if(bossBar) bossBar.style.display='none';
      showBanner('✨ ชนะบอสแล้ว! EP3 ผ่านได้!');
      // burst reward: give shield
      shieldCharges = Math.min(2, shieldCharges + 1);
    }
  }

  function bossResetOnMistake(kind){
    // เด็กป.5: ผิดแล้ว “ล้างใหม่จาก STEP1” (เข้าใจง่าย)
    bossReqStep = 0;
    showBanner(kind==='haz' ? '🦠 โดนเชื้อ! บอสรีเซ็ตกลับ STEP 1' : '⚠️ ผิดขั้น! บอสรีเซ็ตกลับ STEP 1');
    setBossUI();
  }

  // ------------------ Input ------------------
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

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // Shield pickup
    if(obj.kind === 'shield'){
      shieldCharges = Math.min(2, shieldCharges + 1);
      shieldPicked++;
      emit('hha:judge', { kind:'shield', rtMs: rt, source, extra, shieldCharges });
      showBanner(`🛡️ ได้โล่! (SHIELD ${shieldCharges})`);
      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;

      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      miniStats._rtWindow.push(rt);
      if(miniStats._rtWindow.length > 6) miniStats._rtWindow.shift();
      if(miniStats._recoverArmed){ miniStats._recoverStreak++; }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // Boss flow: good hit must match bossReqStep
      if(bossOn){
        if(obj.stepIdx === bossReqStep){
          bossAdvanceOnGoodHit();
        }else{
          // wrong step during boss counts as wrong (clear combo)
          wrongStepHits++;
          totalStepHits++; // treat as step attempt too
          combo = 0;
          miniStats._recoverArmed = true;
          miniStats._recoverStreak = 0;

          emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra, boss:true });
          bossResetOnMistake('wrong');
          warnMissLeft();
          checkFail();
        }
        removeTarget(obj);
        updateGoals();
        setHud();
        return;
      }

      // normal step progression
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

      miniStats._recoverArmed = true;
      miniStats._recoverStreak = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      if(bossOn) bossResetOnMistake('wrong');

      removeTarget(obj);
      warnMissLeft();
      checkFail();
      updateGoals();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      // ✅ Shield blocks hazard (not a miss)
      if(shieldCharges > 0){
        shieldCharges--;
        shieldBlocked++;
        combo = 0;
        miniStats._sinceHazSec = 0;

        emit('hha:judge', { kind:'shield_block', rtMs: rt, source, extra, shieldCharges });
        showBanner('🛡️ บล็อกเชื้อ! (ไม่เสีย MISS)');
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;
      miniStats._sinceHazSec = 0;

      coach?.onEvent('haz_hit', { stepAcc:getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner('🦠 โดนเชื้อ! ระวัง!');

      if(bossOn) bossResetOnMistake('haz');

      removeTarget(obj);
      warnMissLeft();
      checkFail();
      updateGoals();
      setHud();
      return;
    }
  }

  function tick(){
    if(!running) return;

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

    // Storm / Boss decisions
    maybeStorm();
    tickMini(dt);
    updateGoals();
    maybeStartBoss();

    // spawn
    const P = getLiveParams();
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

    shieldCharges=0; shieldPicked=0; shieldBlocked=0;

    // missions
    goalDone.G1=false; goalDone.G2=false;
    goalsCleared=0;
    miniCleared=0;
    miniActive=null;
    miniEndAtMs=0;
    miniWindowSecLeft=0;
    miniStats._sinceHazSec=0;
    miniStats._recoverArmed=false;
    miniStats._recoverStreak=0;
    miniStats._rtWindow=[];

    // storm/boss
    stormOn=false;
    stormEndsAtMs=0;
    stormSecondsTotal=0;
    setStormUI(0);

    bossOn=false;
    bossDefeated=0;
    bossHpMax=12; bossHp=12; bossReqStep=0; bossHits=0;
    if(bossBar) bossBar.style.display='none';

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

  function computeGrade(stepAcc, hazHits, misses, bossDefeated){
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1 && misses<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2 && misses<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';
    // EP3 boss bonus feel
    if(episode===3 && bossDefeated && (grade==='SS' || grade==='SSS')) grade='SSS';
    return grade;
  }

  function episodePassRule(S){
    if(S.reason==='fail') return false;
    if(S.episode===1) return (S.goalsCleared>=2 && S.miniCleared>=2);
    if(S.episode===2) return (S.goalsCleared>=2 && S.miniCleared>=3);
    // EP3 ต้องชนะบอสด้วย
    return (S.goalsCleared>=2 && S.miniCleared>=3 && S.misses<=2 && S.bossDefeated===1);
  }

  function updateProgressAfterRun(summary){
    const prog = loadProgress();
    const ep = summary.episode|0;
    const passed = summary.episodePassed === 1;

    if(passed && prog.unlockedMax < 3){
      if(ep === prog.unlockedMax && prog.unlockedMax < 3){
        prog.unlockedMax = Math.min(3, prog.unlockedMax + 1);
      }
    }

    const key = String(ep);
    const prev = prog.best[key] || null;
    const scoreKey = (s)=> (Number(s.stepAcc||0)*10000) - (Number(s.misses||0)*130) + (Number(s.comboMax||0)*2) + (Number(s.bossDefeated||0)*250);
    if(!prev || scoreKey(summary) > scoreKey(prev)){
      prog.best[key] = {
        stepAcc: summary.stepAcc,
        misses: summary.misses,
        comboMax: summary.comboMax,
        loopsDone: summary.loopsDone,
        bossDefeated: summary.bossDefeated,
        grade: summary.grade,
        timestampIso: summary.timestampIso
      };
    }

    saveProgress(prog);
    summary.unlockedMax = prog.unlockedMax;
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
    const grade = computeGrade(stepAcc, hazHits, misses, bossDefeated);

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.2.0-prod-bl',
      game:'hygiene',
      runMode, diff, view, seed,
      sessionId,
      timestampIso: nowIso(),

      episode,
      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      loopsDone,
      stepIdxEnd: stepIdx,

      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      // BL: shield/storm/boss
      shieldPicked,
      shieldBlocked,
      shieldChargesEnd: shieldCharges,
      stormSecondsApprox: Math.round(stormSecondsTotal),
      bossDefeated,
      bossHits,

      goalsTotal, goalsCleared,
      miniTotal, miniCleared,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses,
      medianStepMs: rtMed,
      grade
    };

    summary.episodePassed = episodePassRule(summary) ? 1 : 0;

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    updateProgressAfterRun(summary);

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    const passTxt = summary.episodePassed ? 'PASS ✅' : 'TRY AGAIN 🔁';
    endTitle.textContent = (reason==='fail') ? `จบเกม ❌ (Miss เต็ม)` : `จบเกม — ${passTxt}`;
    endSub.textContent =
      `EP${episode} ${passTxt} • Grade ${grade} • goals ${goalsCleared}/${goalsTotal} • mini ${miniCleared}/${miniTotal}` +
      (episode===3 ? ` • boss ${bossDefeated?'✅':'❌'}` : '') +
      ` • acc ${(stepAcc*100).toFixed(0)}% • miss ${misses} • shield🛡️ ${shieldBlocked}`;

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

  WIN.addEventListener('hha:shoot', onShoot);

  // initial
  setHud();
}