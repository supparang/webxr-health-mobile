// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard) PACK K v1.5.0
// + Daily Challenge (run=daily or ?daily=1)
// + Sticker Book unlocks (HHA_STICKERS)
// + Last Chance 5s (3 correct-in-a-row to forgive 1 miss)

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_STK  = 'HHA_STICKERS';

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
function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
}

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

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼';
const ICON_BOSS = '👑🦠';

function getLocalDateKey(){
  try{
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }catch{ return '1970-01-01'; }
}

function safeArr(x){ return Array.isArray(x)? x : []; }

function addSticker(stk){
  const list = safeArr(loadJson(LS_STK, []));
  if(list.some(s=>s && s.id===stk.id)) return false;
  const item = {
    id: String(stk.id),
    title: String(stk.title||'Sticker'),
    icon: String(stk.icon||'✨'),
    at: nowIso(),
    game: 'hygiene'
  };
  list.unshift(item);
  saveJson(LS_STK, list.slice(0, 200));
  WIN.dispatchEvent(new CustomEvent('hha:unlock', { detail: item }));
  return true;
}

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
  const pillPerfect = DOC.getElementById('pillPerfect');
  const pillShield  = DOC.getElementById('pillShield');
  const pillHeart   = DOC.getElementById('pillHeart');
  const pillMission = DOC.getElementById('pillMission');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const missionBar = DOC.getElementById('missionBar');
  const missionText= DOC.getElementById('missionText');
  const missionSub = DOC.getElementById('missionSub');
  const missionFill= DOC.getElementById('missionFill');

  const wheelRow = DOC.getElementById('wheelRow');
  const wheelSub = DOC.getElementById('wheelSub');

  const miniBoss = DOC.getElementById('miniBoss');
  const miniSoap = DOC.getElementById('miniSoap');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endTips      = DOC.getElementById('endTips');
  const endJson      = DOC.getElementById('endJson');

  const teacherPanel = DOC.getElementById('teacherPanel');
  const teacherSub   = DOC.getElementById('teacherSub');
  const teacherBars  = DOC.getElementById('teacherBars');
  const teacherFoot  = DOC.getElementById('teacherFoot');

  const btnStart   = DOC.getElementById('btnStart');
  const btnRestart = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode0 = (qs('run','play')||'play').toLowerCase(); // play | study | daily
  const dailyFlag = (qs('daily','0')==='1');
  const runMode = (runMode0==='daily' || dailyFlag) ? 'daily' : runMode0;

  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');
  const teacherOn = (qs('teacher','0') === '1');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed0 = Number(qs('seed', Date.now()));
  const dateKey = qs('dateKey', getLocalDateKey());

  let seed = seed0;
  let rng = makeRNG(seed);

  const rhythmOn = (qs('rhythm','1') !== '0');
  const ghostOn  = (qs('ghost','1') !== '0');
  const explainOn= (qs('explain','1') !== '0');

  // optional AI
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, bpm:96 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, bpm:116 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, bpm:106 };
  })();
  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    bpm:[84, 132]
  };

  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // Mission / Daily
  let mission = null;
  let daily = null;

  async function loadMissionOrDaily(){
    if(runMode === 'daily'){
      try{
        const mod = await import('./hygiene.daily.js');
        daily = mod.getDailyChallenge({ dateKey, seed: seed0, diff });
        // override seed deterministically by daily seed
        seed = Number(daily.seed) || seed0;
        rng = makeRNG(seed);
      }catch{}
      mission = daily ? {
        id: daily.id,
        name: daily.name,
        story: daily.desc,
        rules: daily.rules
      } : null;
    }else{
      try{
        const mod = await import('./hygiene.missions.js');
        mission = (typeof mod?.pickMission === 'function') ? mod.pickMission({ seed, runMode, diff }) : null;
      }catch{}
    }

    if(missionBar){
      missionBar.style.display = mission ? 'block' : 'none';
      if(mission && pillMission) pillMission.textContent = `🎯 ${mission.name}`;
      if(mission && missionText) missionText.textContent = `${mission.name} • ${mission.story}`;
      if(mission && missionSub) missionSub.textContent = (runMode==='daily')
        ? `Daily ${dateKey} • ทำสำเร็จเพื่อปลดล็อกสติกเกอร์ 🧩`
        : `ทำให้สำเร็จเพื่อปลดล็อกตรา 🎖️`;
    }
  }

  // ------------------ State ------------------
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

  // PACK K: Miss forgiveness via LastChance
  let missForgiven = 0;     // subtract from miss count
  let lastChanceUsed = 0;   // only once
  let lastChanceOn = false;
  let lastChanceEndsAt = 0;
  let lastChanceNeed = 3;
  let lastChanceStreak = 0;
  let pendingForgive = 0;

  // Heart rescue
  let heartMax = 1;
  let heart = 1;
  let rescuedCount = 0;

  let perfect = 0;
  let shield = 0;

  // Soap meter
  let soap = 0;
  let soapBoostUntilMs = 0;

  // Boss
  let bossActive = false;
  let bossHP = 0;
  let bossHPMax = 0;
  let bossClears = 0;
  let bossNextAtMs = 0;
  let bossEndsAtMs = 0;
  let bossObj = null;
  let bossWeakIdx = 0;
  let bossWeakUntilMs = 0;
  let bossPhase2 = false;

  // Mist
  let mistUntilMs = 0;

  let correctHits=0;
  let totalStepHits=0;

  // mistakes per step
  const wrongByStep = new Array(STEPS.length).fill(0);

  // streak rewards
  let streak10 = 0, streak20 = 0, streak30 = 0;

  // targets
  const targets = [];
  let nextId=1;

  // rhythm
  let beatMs = 0;
  let nextBeatAt = 0;
  let beatCount = 0;

  // ------------------ Helpers ------------------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }
  function setMist(on){ DOC.body.classList.toggle('is-mist', !!on); }
  function setBoss2(on){ DOC.body.classList.toggle('is-boss2', !!on); }
  function setLastChance(on){ DOC.body.classList.toggle('is-lastchance', !!on); }

  function explain(kind, obj){
    if(!explainOn) return '';
    const cur = STEPS[stepIdx];
    if(kind==='wrong'){
      const wrong = (obj && obj.stepIdx>=0) ? STEPS[obj.stepIdx] : null;
      return `ผิดขั้นตอน → ตอนนี้ต้อง ${cur.icon} ${cur.label}${wrong?` (ที่กดคือ ${wrong.icon})`:''}`;
    }
    if(kind==='haz'){
      return shield>0 ? `🛡 กันเชื้อไว้ 1 ครั้ง!` : `โดนเชื้อ 🦠 → หลบก่อนยิง`;
    }
    if(kind==='boss_hint'){
      const w = STEPS[bossWeakIdx];
      return `บอสแพ้: ${w.icon} ${w.label}`;
    }
    if(kind==='lastchance'){
      return `โอกาสสุดท้าย! ถูก ${lastChanceNeed} ครั้งติดเพื่อ “ลบ 1 MISS”`;
    }
    return '';
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }

  function getMissCountRaw(){ return (wrongStepHits + hazHits); }
  function getMissCount(){
    // PACK K: forgiveness subtract
    const raw = getMissCountRaw();
    return Math.max(0, raw - missForgiven);
  }

  function setWheel(){
    if(!wheelRow) return;
    wheelRow.innerHTML = '';
    STEPS.forEach((s,i)=>{
      const d = DOC.createElement('div');
      d.className = 'hw-chip' + (i===stepIdx?' is-now':'') + (i<stepIdx?' is-done':'');
      d.textContent = s.icon;
      wheelRow.appendChild(d);
    });
    if(wheelSub){
      wheelSub.textContent = `ตอนนี้: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label} • รอบที่ทำแล้ว: ${loopsDone}`;
    }
  }

  function missionProgress(){
    if(!mission || !mission.rules) return { pct:0, done:false, text:'—' };
    const r = mission.rules;
    const stepAcc = getStepAcc();

    if(r.minLoops != null){
      const pct = clamp(loopsDone / Math.max(1, r.minLoops), 0, 1);
      const done = loopsDone >= r.minLoops;
      return { pct, done, text:`loops ${loopsDone}/${r.minLoops}` };
    }
    if(r.minComboMax != null){
      const pct = clamp(comboMax / Math.max(1, r.minComboMax), 0, 1);
      const done = comboMax >= r.minComboMax;
      return { pct, done, text:`comboMax ${comboMax}/${r.minComboMax}` };
    }
    if(r.maxHazHits != null){
      // show remaining
      const rem = Math.max(0, r.maxHazHits - hazHits);
      const pct = clamp(rem / Math.max(1, r.maxHazHits), 0, 1);
      const done = (hazHits <= r.maxHazHits) && (timeLeft <= 0 || (!running && !bossActive));
      return { pct, done, text:`haz left ${rem}/${r.maxHazHits}` };
    }
    if(r.minStepAcc != null){
      const pct = clamp(stepAcc / Math.max(0.01, r.minStepAcc), 0, 1);
      const done = stepAcc >= r.minStepAcc;
      return { pct, done, text:`acc ${(stepAcc*100).toFixed(0)}%/${Math.round(r.minStepAcc*100)}%` };
    }
    if(r.minBossClears != null){
      const pct = clamp(bossClears / Math.max(1, r.minBossClears), 0, 1);
      const done = bossClears >= r.minBossClears;
      return { pct, done, text:`boss ${bossClears}/${r.minBossClears}` };
    }
    return { pct:0, done:false, text:'—' };
  }

  let missionDoneFired = false;
  function updateMissionUI(){
    if(!missionBar || !missionFill || !missionText) return;
    if(!mission){ missionBar.style.display='none'; return; }

    const p = missionProgress();
    missionFill.style.width = (p.pct*100).toFixed(1) + '%';
    missionText.textContent = `${mission.name} • ${p.text}`;

    if(p.done && !missionDoneFired){
      missionDoneFired = true;
      showBanner(`🎯 สำเร็จ! ${mission.name}`);

      emit('hha:mission', { id: mission.id, name: mission.name, done:true, dateKey, runMode });

      // PACK K: sticker for daily
      if(runMode === 'daily'){
        addSticker({ id:`daily_${dateKey}`, title:`Daily Clear ${dateKey}`, icon:'📅' });
      }else{
        WIN.dispatchEvent(new CustomEvent('hha:badge',{detail:{icon:'🎯',title:'Mission Clear',id:'hw_mission'}}));
      }
    }
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    pillPerfect && (pillPerfect.textContent = `PERFECT ${perfect}`);
    pillShield && (pillShield.textContent = `🛡 ${shield}`);
    pillHeart && (pillHeart.textContent = `💖 ${heart}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);

    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    hudSub && (hudSub.textContent =
      `${runMode.toUpperCase()} • diff=${diff} • date=${dateKey} • seed=${seed} • view=${view} • ${rhythmOn?'rhythm':'flow'} bpm=${Math.round(bpm)}`
    );

    miniSoap && (miniSoap.textContent = `🧼 Soap: ${Math.round(soap)}%`);
    if(bossActive){
      const w = STEPS[bossWeakIdx];
      const ph = bossPhase2 ? 'PHASE2' : 'PHASE1';
      miniBoss && (miniBoss.textContent = `👑 ${ph} HP ${bossHP}/${bossHPMax} • แพ้: ${w.icon} ${w.label}`);
    }else{
      miniBoss && (miniBoss.textContent = `👑 Boss: จะมาอีกใน ${Math.max(0, Math.ceil((bossNextAtMs-nowMs())/1000))}s`);
    }

    setWheel();
    updateMissionUI();

    if(lastChanceOn){
      showBanner(explain('lastchance') || 'LAST CHANCE!');
    }
  }

  // ---------- Targets ----------
  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
    bossObj = null;
  }
  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
    if(bossObj && obj.id === bossObj.id) bossObj = null;
  }

  function createTarget(kind, emoji, stepRef, forcePos=null){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    let x, y;
    if(forcePos){ x = forcePos.x; y = forcePos.y; }
    else{
      x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);
    }

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));

    let s = (kind==='boss') ? 1.15 : (0.90 + rng()*0.25);
    if(bossPhase2 && kind!=='boss') s *= 0.86;
    if(lastChanceOn && kind==='good') s *= 1.15; // make it slightly bigger in last chance
    el.style.setProperty('--s', s.toFixed(3));

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

  // ---------- Rhythm ----------
  function setupRhythm(){
    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    beatMs = 60000 / Math.max(40, bpm);
    nextBeatAt = nowMs() + beatMs;
    beatCount = 0;
  }

  // ---------- Boss ----------
  function scheduleNextBoss(){
    const baseGap = (diff==='easy') ? 22 : (diff==='hard' ? 16 : 19);
    const jitter = (runMode==='study') ? 0 : Math.floor(rng()*4);
    bossNextAtMs = nowMs() + (baseGap + jitter)*1000;
  }
  function pickWeakIdx(){
    bossWeakIdx = Math.floor(rng()*STEPS.length);
    bossWeakUntilMs = nowMs() + (bossPhase2 ? 2100 : 2500);
  }
  function startBoss(){
    if(bossActive) return;
    bossActive = true;

    bossHPMax = (diff==='easy') ? 6 : (diff==='hard' ? 8 : 7);
    bossHP = bossHPMax;

    bossPhase2 = false;
    setBoss2(false);

    bossEndsAtMs = nowMs() + (bossHPMax>=8 ? 12000 : 11000);
    mistUntilMs = bossEndsAtMs;
    setMist(true);

    pickWeakIdx();

    const cx = WIN.innerWidth*0.5;
    const cy = WIN.innerHeight*0.44;
    bossObj = createTarget('boss', ICON_BOSS, -9, { x:cx, y:cy });

    emit('hha:boss_enter', { hp: bossHP, atSec: elapsedSec(), weakIdx: bossWeakIdx });
    showBanner(`👑 King Germ มาแล้ว! ${explain('boss_hint')}`);
  }
  function rotateWeaknessIfNeeded(){
    if(!bossActive) return;
    const t = nowMs();
    if(t >= bossWeakUntilMs){
      pickWeakIdx();
      showBanner(`👑 เปลี่ยนจุดอ่อน! ${explain('boss_hint')}`);
    }
  }
  function endBossTimeout(){
    if(!bossActive) return;
    bossActive = false;
    bossPhase2 = false;
    setBoss2(false);

    if(bossObj) removeTarget(bossObj);
    setMist(false);
    scheduleNextBoss();
    showBanner(`👑 บอสหนีไป! ลองใหม่รอบหน้า`);
  }
  function enterBossPhase2(){
    if(bossPhase2) return;
    bossPhase2 = true;
    setBoss2(true);
    showBanner(`😈 PHASE 2! หมอกหนาขึ้น + เป้าเล็กลง`);
    emit('hha:boss_phase2', { atSec: elapsedSec() });
  }
  function bossDamageByStepHit(hitStepIdx, source, extra){
    if(!bossActive) return false;
    if(hitStepIdx !== bossWeakIdx) return false;

    if(soap < 12){
      showBanner(`🧼 Soap น้อยไป!`);
      emit('hha:judge', { kind:'boss_needsoap', stepIdx, source, extra, soap, weakIdx: bossWeakIdx });
      return false;
    }

    soap = clamp(soap - 12, 0, 100);
    bossHP -= 1;

    if(bossHP <= Math.ceil(bossHPMax/2)) enterBossPhase2();

    emit('hha:judge', { kind:'boss_dmg', stepIdx, source, extra, bossHP, soap, weakIdx: bossWeakIdx });
    showBanner(`👑 โดนบอส! (HP ${bossHP})`);

    if(bossHP <= 0){
      bossClears++;
      emit('hha:boss_clear', { clears: bossClears, atSec: elapsedSec(), phase2: bossPhase2 });

      shield++;
      soapBoostUntilMs = nowMs() + 7000;
      timeLeft += 7;
      showBanner(`🏆 ชนะบอส! +🛡 +เวลา +Soap Boost`);

      // Sticker unlocks
      addSticker({ id:'boss_clear_1', title:'Boss Clear!', icon:'👑' });

      if(bossObj) removeTarget(bossObj);
      bossActive = false;
      bossPhase2 = false;
      setBoss2(false);
      setMist(false);
      scheduleNextBoss();
    }
    return true;
  }

  // ---------- Spawn ----------
  function spawnOne(){
    const cur = STEPS[stepIdx];
    const P0 = dd ? dd.getParams() : base;

    // last chance: only spawn "correct good" (no hazards/decoys) + faster
    if(lastChanceOn){
      return createTarget('good', cur.icon, stepIdx);
    }

    const boost = nowMs() < soapBoostUntilMs;
    const P = {
      hazardRate: clamp(P0.hazardRate * (boost ? 0.55 : 1), 0.02, 0.40),
      decoyRate:  clamp(P0.decoyRate  * (boost ? 0.85 : 1), 0.05, 0.55),
    };

    if(!bossActive && rng() < (boost ? 0.02 : 0.035)){
      return createTarget('soap', ICON_SOAP, -2);
    }

    if(bossActive && rng() < (bossPhase2 ? 0.62 : 0.55)){
      const w = STEPS[bossWeakIdx];
      return createTarget('good', w.icon, bossWeakIdx);
    }

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', cur.icon, stepIdx);
    }
  }

  // ---------- Input ----------
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

  // ---------- Heart Rescue ----------
  function tryRescue(kind){
    if(heart <= 0) return false;
    heart--;
    rescuedCount++;
    showBanner(`💖 เซฟ! ยังไม่โดน MISS (${kind})`);
    emit('hha:judge', { kind:'rescue', cause: kind, atSec: elapsedSec(), heart });
    combo = 0; perfect = 0;
    return true;
  }

  // ---------- Streak rewards ----------
  function grantStreakReward(){
    if(combo >= 10 && streak10 === 0){
      streak10 = 1;
      soap = clamp(soap + 22, 0, 100);
      showBanner(`🔥 COMBO 10! +🧼 Soap`);
      emit('hha:reward', { type:'combo10', soap });
    }
    if(combo >= 20 && streak20 === 0){
      streak20 = 1;
      heartMax = clamp(heartMax + 1, 1, 2);
      heart = clamp(heart + 1, 0, heartMax);
      showBanner(`⚡ COMBO 20! +💖 Rescue`);
      emit('hha:reward', { type:'combo20', heart, heartMax });
      addSticker({ id:'combo20', title:'Combo 20!', icon:'⚡' });
    }
    if(combo >= 30 && streak30 === 0){
      streak30 = 1;
      shield++;
      showBanner(`💥 COMBO 30! +🛡 Shield`);
      emit('hha:reward', { type:'combo30', shield });
      addSticker({ id:'combo30', title:'Combo 30!', icon:'💥' });
    }
  }

  // ---------- PACK K: Last Chance ----------
  function startLastChance(){
    if(lastChanceUsed) return false;
    lastChanceUsed = 1;
    lastChanceOn = true;
    lastChanceEndsAt = nowMs() + 5000;
    lastChanceNeed = 3;
    lastChanceStreak = 0;
    pendingForgive = 1;

    clearTargets();
    setLastChance(true);
    showBanner(`🧯 LAST CHANCE! ถูก ${lastChanceNeed} ครั้งติดเพื่อกู้คืน!`);
    emit('hha:lastchance', { start:true, need:lastChanceNeed, atSec: elapsedSec() });
    return true;
  }

  function finishLastChance(success){
    if(!lastChanceOn) return;
    lastChanceOn = false;
    setLastChance(false);

    if(success){
      if(pendingForgive){
        missForgiven = clamp(missForgiven + 1, 0, 99);
        pendingForgive = 0;
      }
      showBanner(`✅ กู้คืนสำเร็จ! ลบ 1 MISS`);
      emit('hha:lastchance', { start:false, success:true, missForgiven, atSec: elapsedSec() });

      // sticker
      addSticker({ id:'lastchance_save', title:'Last Chance Save!', icon:'🧯' });
    }else{
      emit('hha:lastchance', { start:false, success:false, atSec: elapsedSec() });
      endGame('fail');
    }
  }

  // ---------- Judge ----------
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'boss'){
      showBanner(explain('boss_hint') || 'ยิง STEP ที่บอสแพ้!');
      emit('hha:judge', { kind:'boss_click', stepIdx, source, extra, weakIdx: bossWeakIdx });
      setHud();
      return;
    }

    if(obj.kind === 'soap'){
      soap = clamp(soap + 35, 0, 100);
      soapBoostUntilMs = nowMs() + 6500;
      shield++;
      emit('hha:soap_pick', { soap, shield, atSec: elapsedSec() });
      showBanner(`🧼 เก็บสบู่! Soap Boost +🛡`);
      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'good'){
      if(bossActive){
        rotateWeaknessIfNeeded();
        bossDamageByStepHit(obj.stepIdx, source, extra);
      }

      correctHits++;
      totalStepHits++;

      if(obj.stepIdx === stepIdx){
        hitsInStep++;
      }

      const isPerfect = rt <= 900;
      if(isPerfect){
        perfect++;
        if(perfect === 20) addSticker({ id:'perfect20', title:'Perfect 20!', icon:'✨' });
        if(perfect % 4 === 0){
          shield++;
          showBanner(`🛡 ได้โล่! (Perfect x${perfect})`);
        }
      }

      combo++;
      comboMax = Math.max(comboMax, combo);

      // PACK K: last chance streak progress
      if(lastChanceOn){
        lastChanceStreak++;
        showBanner(`🧯 กู้คืน ${lastChanceStreak}/${lastChanceNeed}`);
        if(lastChanceStreak >= lastChanceNeed){
          finishLastChance(true);
        }
      }

      grantStreakReward();

      soap = clamp(soap + (isPerfect ? 12 : 8), 0, 100);

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, perfect:isPerfect });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, hitStepIdx: obj.stepIdx, rtMs: rt, source, extra, perfect:isPerfect, soap });

      if(!lastChanceOn){
        showBanner(isPerfect ? `✨ PERFECT! ${STEPS[obj.stepIdx].icon} +1` : `✅ ถูกต้อง! ${STEPS[obj.stepIdx].icon} +1`);
      }

      if(obj.stepIdx === stepIdx){
        if(hitsInStep >= STEPS[stepIdx].hitsNeed){
          stepIdx++;
          hitsInStep=0;

          if(stepIdx >= STEPS.length){
            stepIdx=0;
            loopsDone++;
            heart = heartMax;

            streak10 = 0; streak20 = 0; streak30 = 0;
            showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone}) +💖 รีชาร์จ`);
          }else{
            showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          }
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      if(lastChanceOn){
        // fail last chance instantly
        showBanner(`❌ กู้คืนพลาด!`);
        finishLastChance(false);
        return;
      }

      if(tryRescue('wrong')){
        totalStepHits++;
        wrongByStep[stepIdx] = (wrongByStep[stepIdx]||0) + 1;
        removeTarget(obj);
        setHud();
        return;
      }

      wrongStepHits++;
      totalStepHits++;
      wrongByStep[stepIdx] = (wrongByStep[stepIdx]||0) + 1;

      combo = 0;
      perfect = 0;
      soap = clamp(soap - 10, 0, 100);

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra, soap });
      showBanner(`⚠️ ${explain('wrong', obj) || 'ผิดขั้นตอน!'}`);

      removeTarget(obj);
      checkFailOrLastChance();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      combo = 0;
      perfect = 0;

      if(lastChanceOn){
        showBanner(`❌ โดนเชื้อระหว่างกู้คืน!`);
        finishLastChance(false);
        return;
      }

      if(shield > 0){
        shield--;
        emit('hha:judge', { kind:'haz_block', stepIdx, rtMs: rt, source, extra, shield });
        showBanner(`🛡 กันเชื้อไว้!`);
        removeTarget(obj);
        setHud();
        return;
      }

      if(tryRescue('haz')){
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      soap = clamp(soap - 16, 0, 100);

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra, soap });
      showBanner(`🦠 ${explain('haz', obj) || 'โดนเชื้อ!'}`);

      removeTarget(obj);
      checkFailOrLastChance();
      setHud();
      return;
    }
  }

  function checkFailOrLastChance(){
    if(getMissCount() >= missLimit){
      // PACK K: instead of end immediately, try last chance
      if(startLastChance()){
        return;
      }
      endGame('fail');
    }
  }

  // ---------- Main loop ----------
  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    // last chance timer
    if(lastChanceOn && t >= lastChanceEndsAt){
      showBanner(`❌ หมดเวลา Last Chance!`);
      finishLastChance(false);
      return;
    }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(!bossActive && t >= bossNextAtMs) startBoss();
    if(bossActive) rotateWeaknessIfNeeded();
    if(bossActive && t >= bossEndsAtMs) endBossTimeout();

    if(t >= mistUntilMs && !bossActive) setMist(false);

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    if(rhythmOn){
      while(t >= nextBeatAt){
        nextBeatAt += beatMs;
        beatCount++;

        // last chance: spawn faster but only good
        if(lastChanceOn){
          spawnOne();
          spawnOne();
        }else{
          const b = (beatCount % 4) || 4;
          if(b === 1) spawnOne();
          if(b === 2){ spawnOne(); if(diff==='hard' && rng()<0.25) spawnOne(); }
          if(b === 3){ if(rng()<0.85) spawnOne(); }
          if(b === 4){ spawnOne(); if(diff==='hard' && rng()<0.35) spawnOne(); }
        }

        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }else{
      const P = dd ? dd.getParams() : base;
      tick.spawnAcc = (tick.spawnAcc || 0) + ((lastChanceOn ? (P.spawnPerSec*2.0) : P.spawnPerSec) * dt);
      while(tick.spawnAcc >= 1){
        tick.spawnAcc -= 1;
        spawnOne();
        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }

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

    wrongByStep.fill(0);

    perfect = 0;
    shield = 0;

    heartMax = 1;
    heart = heartMax;
    rescuedCount = 0;

    soap = 0;
    soapBoostUntilMs = 0;

    bossActive = false;
    bossPhase2 = false;
    setBoss2(false);
    bossHP = 0; bossHPMax = 0;
    bossClears = 0;
    bossEndsAtMs = 0;
    bossObj = null;
    bossWeakIdx = 0;
    bossWeakUntilMs = 0;

    mistUntilMs = 0;
    setMist(false);

    streak10 = 0; streak20 = 0; streak30 = 0;

    // last chance
    missForgiven = 0;
    lastChanceUsed = 0;
    lastChanceOn = false;
    pendingForgive = 0;
    setLastChance(false);

    missionDoneFired = false;

    setupRhythm();
    scheduleNextBoss();
    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, rhythmOn, ghostOn, explainOn, teacherOn, dateKey });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function maxIndex(arr){
    let mi=0, mv=-1;
    for(let i=0;i<arr.length;i++){
      if(arr[i] > mv){ mv = arr[i]; mi = i; }
    }
    return mi;
  }

  function renderTeacherChart(summary){
    if(!teacherOn || !teacherPanel || !teacherBars) return;
    teacherPanel.style.display = 'block';
    const wb = summary.wrongByStep || new Array(STEPS.length).fill(0);
    const maxV = Math.max(1, ...wb);

    teacherSub && (teacherSub.textContent =
      `ผิดมากสุด: ${STEPS[maxIndex(wb)].icon} ${STEPS[maxIndex(wb)].label} • miss=${summary.misses} • haz=${summary.hazHits} • acc=${Math.round(summary.stepAcc*100)}%`
    );

    teacherBars.innerHTML = '';
    for(let i=0;i<STEPS.length;i++){
      const v = Number(wb[i]||0);
      const row = DOC.createElement('div');
      row.className = 'hw-bar' + (v>0 ? ' bad' : '');
      row.innerHTML = `
        <div class="lab">${STEPS[i].icon}</div>
        <div class="track"><div class="fill" style="width:${(v/maxV*100).toFixed(1)}%"></div></div>
        <div class="val">${v}</div>
      `;
      teacherBars.appendChild(row);
    }

    teacherFoot && (teacherFoot.textContent =
      `แนะแนว: ให้เด็ก “พูดชื่อ STEP” ก่อนยิง เช่น “ซอกนิ้ว!” เพื่อ reinforce การจำขั้นตอน`
    );
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    setMist(false);
    bossPhase2 = false;
    setBoss2(false);
    lastChanceOn = false;
    setLastChance(false);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;
    const mp = missionProgress();

    const summary = {
      version:'1.5.0-prod',
      game:'hygiene',
      runMode, diff, view, seed, dateKey,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      loopsDone,
      stepIdxEnd: stepIdx,

      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      stepAcc,
      riskIncomplete,
      riskUnsafe,

      comboMax,
      perfectCount: perfect,
      shieldEnd: shield,
      soapEnd: soap,

      bossClears,
      heartUsed: rescuedCount,
      heartMaxEnd: heartMax,

      missesRaw: getMissCountRaw(),
      missForgiven,
      misses: getMissCount(),

      lastChanceUsed,

      rhythmOn, ghostOn, explainOn, teacherOn,

      missionId: mission ? mission.id : null,
      missionName: mission ? mission.name : null,
      missionDone: !!mp.done,
      missionPct: mp.pct,

      wrongByStep
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras());
    if(dd) Object.assign(summary, dd.getSummaryExtras());

    // Sticker unlock rules (simple, fun, kid-friendly)
    if(summary.hazHits === 0) addSticker({ id:'no_germs', title:'No Germs!', icon:'🫧' });
    if(summary.comboMax >= 25) addSticker({ id:'combo25', title:'Combo 25!', icon:'🔥' });
    if(summary.bossClears >= 1) addSticker({ id:'boss_hunter', title:'Boss Hunter', icon:'👑' });
    if(summary.stepAcc >= 0.90) addSticker({ id:'accuracy90', title:'Accuracy 90%', icon:'🎯' });
    if(runMode === 'daily' && mp.done) addSticker({ id:`daily_master_${dateKey}`, title:`Daily Master ${dateKey}`, icon:'🏁' });

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌' : 'จบเกม ✅';
    endSub.textContent =
      `Grade ${grade} • acc ${(stepAcc*100).toFixed(1)}% • boss ${bossClears} • haz ${hazHits} • miss ${summary.misses} (forgive ${missForgiven}) • loops ${loopsDone}`;

    if(endTips){
      // quick kid tip
      const top = maxIndex(wrongByStep);
      endTips.textContent =
        `📌 ทิป: พลาดบ่อยสุด = ${STEPS[top].icon} ${STEPS[top].label} • ลอง “อ่าน STEP ก่อนยิง” 1 วิ`;
    }

    renderTeacherChart(summary);

    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
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

  // cVR shoot
  WIN.addEventListener('hha:shoot', onShoot);

  // mission/daily load then init
  loadMissionOrDaily().finally(()=>{ resetGame(); });
}