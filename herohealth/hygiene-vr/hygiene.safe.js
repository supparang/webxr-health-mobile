// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (v1.5.0-prod)
// ✅ Perfect/Good/Miss popups + SFX
// ✅ Streak badges (10/20/30) -> hha:badge + saved in summary
// ✅ Boss patterns 3 types (deterministic by seed) rotate every 5s
// ✅ Boss HP + Soap shield + last-3 countdown + siren + heartbeat
// Params: run,diff,view,time,seed,hub,win=both|loop,kids=0|1,sfx=0|1
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

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
async function copyText(text){
  try{ await navigator.clipboard.writeText(String(text||'')); }catch(_){}
}
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

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

// ------------------ SFX+ (WebAudio) ------------------
function makeSFX(enabled){
  let ctx = null;
  let sirenTimer = null;
  let heartbeatTimer = null;

  function ensure(){
    if(!enabled) return null;
    if(ctx) return ctx;
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function unlock(){
    const c = ensure();
    if(!c) return;
    try{
      if(c.state === 'suspended') c.resume();
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.01);
    }catch(_){}
  }
  function tone(freq, durMs, type='sine', vol=0.05){
    const c = ensure();
    if(!c) return;
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = Math.max(40, freq);
      const t0 = c.currentTime;
      const t1 = t0 + Math.max(0.02, durMs/1000);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t1);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t1 + 0.02);
    }catch(_){}
  }
  function chord(freqs, durMs, type='sine', vol=0.03){
    freqs.forEach((f,i)=> setTimeout(()=>tone(f, durMs, type, vol), i*8));
  }
  function stopSiren(){
    if(sirenTimer){ clearInterval(sirenTimer); sirenTimer = null; }
  }
  function stopHeartbeat(){
    if(heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }
  function sirenStart(){
    if(!enabled) return;
    stopSiren();
    let up = true;
    let f = 520;
    sirenTimer = setInterval(()=>{
      f += up ? 80 : -80;
      if(f >= 920) up = false;
      if(f <= 520) up = true;
      tone(f, 70, 'square', 0.035);
    }, 90);
  }
  function heartbeatStart(){
    if(!enabled) return;
    stopHeartbeat();
    heartbeatTimer = setInterval(()=>{
      tone(110, 65, 'sine', 0.05);
      setTimeout(()=>tone(140, 55, 'sine', 0.04), 85);
    }, 520);
  }

  return {
    unlock,

    ok(){ tone(880, 70, 'triangle', 0.055); },
    wrong(){ tone(220, 120, 'sawtooth', 0.05); },
    haz(){ tone(140, 140, 'square', 0.05); },

    perfect(){ chord([988,1318], 70, 'sine', 0.05); },
    good(){ tone(784, 55, 'sine', 0.045); },
    miss(){ chord([330,247], 90, 'sawtooth', 0.035); },

    bossStart(){ chord([520,740], 90, 'square', 0.045); },
    bossHit(){ tone(660, 60, 'triangle', 0.055); },
    bossClear(){ chord([988,1318,1567], 120, 'triangle', 0.05); },

    questClear(){ chord([784,1046], 90, 'sine', 0.045); },

    comboUp(level){
      const base = level >= 15 ? 988 : (level >= 10 ? 880 : 784);
      chord([base, base*1.26, base*1.5], 70, 'sine', 0.04);
    },
    comboBreak(){ chord([330,247], 90, 'sawtooth', 0.035); },

    countdownTick(n){
      const f = n===3 ? 520 : (n===2 ? 740 : 988);
      tone(f, 85, 'triangle', 0.05);
    },

    sirenStart,
    sirenStop: stopSiren,

    heartbeatStart,
    heartbeatStop: stopHeartbeat,
  };
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep  = DOC.getElementById('pillStep');
  const pillHits  = DOC.getElementById('pillHits');
  const pillCombo = DOC.getElementById('pillCombo');
  const pillMiss  = DOC.getElementById('pillMiss');
  const pillRisk  = DOC.getElementById('pillRisk');
  const pillTime  = DOC.getElementById('pillTime');
  const pillQuest = DOC.getElementById('pillQuest');
  const hudSub    = DOC.getElementById('hudSub');
  const banner    = DOC.getElementById('banner');

  // Boss UI (optional in html)
  const bossBar   = DOC.getElementById('bossBar');
  const bossTitle = DOC.getElementById('bossTitle');
  const bossSub   = DOC.getElementById('bossSub');
  const bossFill  = DOC.getElementById('bossFill');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart     = DOC.getElementById('btnStart');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff    = (qs('diff','normal')||'normal').toLowerCase();
  const view    = (qs('view','pc')||'pc').toLowerCase();
  const hub     = qs('hub', '');
  const winMode = (qs('win','both')||'both').toLowerCase();
  const kids    = (qs('kids','0') === '1');
  const sfxOn   = (qs('sfx','1') !== '0');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

  // SFX+
  const SFX = makeSFX(sfxOn);

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();

  // kids mode soften
  const tuned = {
    spawnPerSec: kids ? base.spawnPerSec*0.88 : base.spawnPerSec,
    hazardRate:  kids ? base.hazardRate*0.75 : base.hazardRate,
    decoyRate:   kids ? base.decoyRate*0.85 : base.decoyRate,
  };

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0, hitsInStep=0, loopsDone=0;
  let combo=0, comboMax=0;
  let comboBreaks=0;

  let wrongStepHits=0, hazHits=0;
  let missLimit = kids ? 4 : 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  let spawnAcc=0;

  // Boss (15s)
  const bossLenSec = 15;
  let bossActive=false;
  let bossCleared=false;
  let bossHits=0;
  let bossHitsNeed=(diff==='easy')?10:(diff==='hard'?14:12);
  if(kids) bossHitsNeed = Math.max(8, bossHitsNeed - 2);

  let soapShieldUntilMs=0;
  let bossBonus=0;

  // boss warning
  let bossWarnOn=false;

  // last-3 countdown
  let lastCountdownMark = 0;
  let last3On=false;

  // Boss patterns (rotate 5s, deterministic)
  const PATTERNS = ['STORM','DECOY','SOAP'];
  const bossPatternSeq = makeBossPatternSeq(seed);
  let bossPattern = 'STORM';
  let bossPatternIndex = 0;

  // Streak badges
  const streakUnlocked = new Set();
  let streak10=false, streak20=false, streak30=false;

  // targets
  const targets=[];
  let nextId=1;

  function makeBossPatternSeq(seed0){
    // deterministic shuffle 3 patterns using seed
    const r = makeRNG((seed0>>>0) ^ 0xA51B9C3D);
    const a = PATTERNS.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(r()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    // ensure length >= 3; repeat cycle
    return a;
  }

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function fxBurst(x, y, kind, text=null){
    if(WIN.Particles?.popText && text){
      try{ WIN.Particles.popText(x, y, text, kind); }catch(_){}
    }
    if(WIN.Particles?.burst){
      try{ WIN.Particles.burst(x, y, kind); }catch(_){}
      return;
    }
    try{
      const fx = DOC.createElement('div');
      fx.className = `hw-fx ${kind||'good'}`;
      fx.style.left = `${x}px`;
      fx.style.top  = `${y}px`;
      fx.textContent = text || (kind==='bad' ? '!' : '✦');
      stage.appendChild(fx);
      setTimeout(()=>fx.remove(), 520);
    }catch(_){}
  }

  // Big judge popup center: PERFECT / GOOD / MISS
  function judgePop(type){
    try{
      const el = DOC.createElement('div');
      el.className = `hw-judge ${type}`;
      el.textContent = (type==='perfect') ? 'PERFECT!' : (type==='good') ? 'GOOD!' : 'MISS!';
      stage.appendChild(el);
      setTimeout(()=>el.remove(), 520);
    }catch(_){}
  }

  function centerCountdown(n){
    try{
      const el = DOC.createElement('div');
      el.className = 'hw-count';
      el.textContent = String(n);
      stage.appendChild(el);
      setTimeout(()=>el.remove(), 420);
    }catch(_){}
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 150;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 130;
    const pad = 14;
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function getMissCount(){ return wrongStepHits + hazHits; }
  function getStepAcc(){ return totalStepHits ? (correctHits/totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs()-tStartMs)/1000) : 0; }

  function setBossUI(){
    if(!bossBar) return;
    if(!bossActive){
      bossBar.style.display='none';
      return;
    }
    bossBar.style.display='block';
    if(bossTitle) bossTitle.textContent = bossCleared ? '✅ BOSS CLEARED!' : `🚨 BOSS: ${bossPattern}`;
    if(bossSub){
      const left = Math.max(0, Math.ceil(timeLeft));
      bossSub.textContent = bossCleared
        ? `โบนัส +${bossBonus}`
        : `HP ${bossHits}/${bossHitsNeed} • เหลือ ${left}s • pattern ${bossPatternIndex+1}/3`;
    }
    if(bossFill){
      const p = bossHitsNeed ? clamp((bossHits/bossHitsNeed)*100, 0, 100) : 0;
      bossFill.style.width = `${p.toFixed(1)}%`;
    }
  }

  function setUrgentUI(){
    if(pillTime){
      const urgent = timeLeft <= 10;
      pillTime.classList.toggle('urgent', urgent);
    }
    DOC.body.classList.toggle('boss-warn', bossWarnOn);
    DOC.body.classList.toggle('last3', last3On);
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep  && (pillStep.textContent  = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits  && (pillHits.textContent  = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss  && (pillMiss.textContent  = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1-stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    if(pillQuest){
      if(bossActive && !bossCleared) pillQuest.textContent = `BOSS 🎯 ${bossHits}/${bossHitsNeed} • ${bossPattern}`;
      else if(bossActive && bossCleared) pillQuest.textContent = `BOSS ✅ +${bossBonus}`;
      else pillQuest.textContent = `QUEST —`;
    }

    setBossUI();
    setUrgentUI();

    hudSub && (hudSub.textContent =
      `${runMode.toUpperCase()} • diff=${diff} • kids=${kids?1:0} • win=${winMode} • sfx=${sfxOn?1:0} • seed=${seed} • view=${view}`
    );
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch(_){}
    }
  }
  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el?.remove(); }catch(_){}
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
    el.style.setProperty('--s', (0.92 + rng()*0.28).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> judgeHit(obj, 'tap', null), { passive:true });
    }
    return obj;
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function getJudgeTier(rtMs){
    // kids ใจดีขึ้นนิด
    const p = kids ? 360 : 320;
    const g = kids ? 700 : 620;
    if(rtMs <= p) return 'perfect';
    if(rtMs <= g) return 'good';
    return 'ok';
  }

  function applyPatternRates(baseRates, pattern){
    // baseRates = {haz, decoy, soap} additive scaling
    if(pattern === 'STORM'){
      return {
        haz:  clamp(baseRates.haz * 1.55, 0.06, 0.32),
        decoy:clamp(baseRates.decoy * 0.95, 0.08, 0.38),
        soap: clamp(baseRates.soap * 0.95, 0.06, 0.26),
      };
    }
    if(pattern === 'DECOY'){
      return {
        haz:  clamp(baseRates.haz * 0.95, 0.05, 0.28),
        decoy:clamp(baseRates.decoy * 1.70, 0.12, 0.48),
        soap: clamp(baseRates.soap * 0.90, 0.06, 0.26),
      };
    }
    // SOAP
    return {
      haz:  clamp(baseRates.haz * 0.90, 0.05, 0.26),
      decoy:clamp(baseRates.decoy * 0.90, 0.10, 0.40),
      soap: clamp(baseRates.soap * 1.85, 0.10, 0.32),
    };
  }

  function spawnOne(){
    const s = STEPS[stepIdx];

    // Boss phase uses patterns
    if(bossActive && !bossCleared){
      const baseRates = {
        soap: kids ? 0.16 : 0.12,
        haz:  clamp(tuned.hazardRate*0.85, 0.04, 0.22),
        decoy: clamp(tuned.decoyRate*0.70, 0.08, 0.30),
      };
      const P = applyPatternRates(baseRates, bossPattern);

      const r = rng();
      if(r < P.soap) return createTarget('soap', ICON_SOAP, -2);
      if(r < P.soap + P.haz) return createTarget('haz', ICON_HAZ, -1);
      if(r < P.soap + P.haz + P.decoy){
        let j = stepIdx;
        for(let k=0;k<6;k++){
          const pick = Math.floor(rng()*STEPS.length);
          if(pick !== stepIdx){ j = pick; break; }
        }
        return createTarget('wrong', STEPS[j].icon, j);
      }
      return createTarget('good', s.icon, stepIdx);
    }

    // Normal
    const r = rng();
    if(r < tuned.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < tuned.hazardRate + tuned.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
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
    if(best) judgeHit(best, 'shoot', { lockPx, dist: bestDist });
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function startBossWarning(){
    if(bossWarnOn) return;
    bossWarnOn = true;
    SFX.sirenStart();
    showBanner('🚨 ใกล้ BOSS! เตรียมตัว!');
    setHud();
  }
  function stopBossWarning(){
    if(!bossWarnOn) return;
    bossWarnOn = false;
    SFX.sirenStop();
    setHud();
  }

  function setBossPatternByTime(){
    // During boss: rotate every 5 seconds, deterministic cycle from bossPatternSeq
    if(!bossActive || bossCleared) return;
    const bossElapsed = Math.max(0, bossLenSec - Math.max(0, Math.ceil(timeLeft))); // approx
    const idx = Math.floor(bossElapsed / 5) % 3;
    if(idx !== bossPatternIndex){
      bossPatternIndex = idx;
      bossPattern = bossPatternSeq[idx] || 'STORM';
      showBanner(`⚡ BOSS PATTERN: ${bossPattern}`);
      setHud();
    }
  }

  function maybeStartBoss(){
    if(bossActive) return;

    // Warning window: (18..16] seconds
    if(timeLeft <= 18 && timeLeft > 15){
      startBossWarning();
    }else{
      stopBossWarning();
    }

    if(timeLeft <= 15){
      stopBossWarning();

      bossActive = true;
      bossCleared = false;
      bossHits = 0;
      soapShieldUntilMs = 0;
      bossBonus = 0;

      bossPatternIndex = 0;
      bossPattern = bossPatternSeq[0] || 'STORM';

      SFX.bossStart();
      showBanner(`🚨 BOSS TIME! ยิงให้ได้ ${bossHitsNeed} ใน 15 วิ`);
      setHud();
    }
  }

  function maybeLast3Countdown(){
    const ceilT = Math.ceil(timeLeft);
    if(ceilT <= 3 && ceilT > 0){
      if(!last3On){
        last3On = true;
        SFX.heartbeatStart();
        setHud();
      }
      if(ceilT !== lastCountdownMark){
        lastCountdownMark = ceilT;
        SFX.countdownTick(ceilT);
        centerCountdown(ceilT);
      }
    }else{
      if(last3On){
        last3On = false;
        SFX.heartbeatStop();
        setHud();
      }
    }
  }

  function onComboBreak(){
    comboBreaks++;
    SFX.comboBreak();
    SFX.miss();
    judgePop('miss');
    showBanner('💥 คอมโบขาด!');
  }

  function unlockStreakBadge(n){
    const key = `streak_${n}`;
    if(streakUnlocked.has(key)) return;
    streakUnlocked.add(key);

    const badge = {
      id: key,
      title: `Streak ${n}!`,
      icon: n===10 ? '🔥' : (n===20 ? '⚡' : '👑'),
      note: 'ยิงถูกต่อเนื่องแบบไม่พลาด',
      n
    };
    emit('hha:badge', badge);
    fxBurst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, 'good', `${badge.icon} STREAK ${n}!`);
    showBanner(`${badge.icon} ได้ Badge: Streak ${n}!`);
  }

  function maybeComboStreakSfx(){
    const step = kids ? 7 : 5;
    if(combo > 0 && combo % step === 0){
      SFX.comboUp(combo);
      showBanner(`🔥 COMBO ${combo}!`);
    }
    if(combo === 10){ streak10=true; unlockStreakBadge(10); }
    if(combo === 20){ streak20=true; unlockStreakBadge(20); }
    if(combo === 30){ streak30=true; unlockStreakBadge(30); }
  }

  function judgeHit(obj, source, extra){
    if(!running || paused) return;
    const rt = computeRt(obj);

    if(obj.kind === 'soap'){
      soapShieldUntilMs = nowMs() + (kids ? 3600 : 3000);
      SFX.ok();
      showBanner('🧼 โล่ฟอง! (กันเชื้อชั่วคราว)');
      fxBurst(obj.x, obj.y, 'good', '🫧');
      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;

      // judge tier
      const tier = getJudgeTier(rt);
      if(tier === 'perfect'){ SFX.perfect(); judgePop('perfect'); }
      else if(tier === 'good'){ SFX.good(); judgePop('good'); }
      else { SFX.ok(); }

      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      if(bossActive && !bossCleared){
        bossHits++;
        SFX.bossHit();
        fxBurst(obj.x, obj.y, 'good', '✨');

        if(bossHits >= bossHitsNeed){
          bossCleared = true;
          bossBonus = kids ? 140 : 120;
          SFX.bossClear();
          SFX.questClear();
          showBanner(`🏆 BOSS CLEARED! +${bossBonus}`);
        }
      }else{
        fxBurst(obj.x, obj.y, 'good', '🫧');
      }

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, tier, source, extra });

      maybeComboStreakSfx();

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;

          SFX.questClear();
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          if(winMode === 'loop'){
            endGame('win_loop');
            return;
          }
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;

      if(combo > 0) onComboBreak();
      combo = 0;

      SFX.wrong();
      fxBurst(obj.x, obj.y, 'warn', '⚠️');
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      const shieldOn = nowMs() < soapShieldUntilMs;
      if(shieldOn){
        SFX.good();
        judgePop('good');
        showBanner('🛡️ โล่ฟองกันเชื้อ!');
        fxBurst(obj.x, obj.y, 'good', '🛡️');
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;

      if(combo > 0) onComboBreak();
      combo = 0;

      SFX.haz();
      SFX.miss();
      judgePop('miss');

      fxBurst(obj.x, obj.y, 'bad', '🦠');
      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function tick(){
    if(!running) return;
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    // boss
    maybeStartBoss();
    setBossPatternByTime();

    // last-3
    maybeLast3Countdown();

    // spawn
    const bossBoost = bossActive ? (kids ? 1.25 : 1.35) : 1.0;
    const spawnPerSec = clamp(tuned.spawnPerSec * bossBoost, 0.8, 6.0);

    spawnAcc += spawnPerSec * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0; comboBreaks=0;

    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;

    bossActive=false; bossCleared=false; bossHits=0;
    soapShieldUntilMs=0; bossBonus=0;
    bossWarnOn=false;
    lastCountdownMark=0;
    last3On=false;

    bossPatternIndex=0;
    bossPattern=bossPatternSeq[0] || 'STORM';

    streakUnlocked.clear();
    streak10=streak20=streak30=false;

    SFX.sirenStop();
    SFX.heartbeatStop();

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    SFX.unlock();

    startOverlay && (startOverlay.style.display='none');
    endOverlay && (endOverlay.style.display='none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, winMode, kids, sfxOn });

    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    SFX.sirenStop();
    SFX.heartbeatStop();

    clearTargets();

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1-stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const scoreFinal = Math.max(0, Math.round(
      correctHits*10 +
      loopsDone*90 +
      comboMax*6 +
      bossBonus +
      (streak30?150:0) + (streak20?80:0) + (streak10?35:0) -
      (getMissCount()*18 + hazHits*12 + comboBreaks*6)
    ));

    const summary = {
      version:'1.5.0-prod',
      game:'hygiene',
      runMode, diff, view, seed, winMode,
      kids, sfxOn,
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

      bossActive,
      bossCleared,
      bossHits,
      bossHitsNeed,
      bossBonus,
      bossPatternSeq,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      comboBreaks,
      misses: getMissCount(),

      streak10, streak20, streak30,
      scoreFinal,
      grade
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent =
      (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' :
      (reason==='win_loop') ? 'ผ่าน B ✅ (ครบ 7 ขั้นตอน)' :
      'จบเกม ✅';

    endSub.textContent =
      `Grade ${grade} • score ${scoreFinal} • boss ${bossCleared?'✅':'❌'} (${bossHits}/${bossHitsNeed}) • streak ${streak30?30:(streak20?20:(streak10?10:0))} • miss ${getMissCount()} • loops ${loopsDone}`;

    endJson.textContent = JSON.stringify(summary, null, 2);
    endOverlay && (endOverlay.style.display='grid');
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });

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

  // init
  setHud();
}