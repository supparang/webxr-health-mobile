// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — v1.4.0-prod (PACK AS)
// ✅ Step Tutor micro-lesson per step (learn mode)
// ✅ Wrong => micro-tip + tutor pulse
// ✅ Adaptive from last summaries (play only), deterministic in study
// ✅ Stores stepBreakdown in summary
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
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

// ------------------ Steps ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6, tip:'ถูฝ่ามือให้ทั่ว', cue:'ถูวน 2–3 รอบ' },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6, tip:'ถูหลังมือซ้าย/ขวา', cue:'วางมือทับแล้วถู' },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6, tip:'สอดนิ้วถูซอก', cue:'สอดนิ้วถูไป-กลับ' },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6, tip:'ถูข้อนิ้ววน ๆ', cue:'กำมือถูที่ฝ่ามือ' },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6, tip:'จับถูหัวแม่มือ', cue:'จับหมุนถูรอบนิ้ว' },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6, tip:'ขัดปลายนิ้ว/เล็บ', cue:'ขัดปลายนิ้วบนฝ่ามือ' },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6, tip:'ถูข้อมือทั้งสอง', cue:'ถูวนรอบข้อมือ' },
];

const ICON_HAZ    = '🦠';
const ICON_SHIELD = '🧼';
const ICON_FEVER  = '🔥';

// ------------------ Quest ------------------
function makeQuestForStep(stepIdx, diff, emphasis=false){
  const base = (diff==='easy') ? { need: 4, sec: 7 }
             : (diff==='hard') ? { need: 6, sec: 6 }
             : { need: 5, sec: 7 };

  let need = base.need, sec = base.sec;

  // เน้นขั้นอ่อน: ให้ “สำเร็จได้” แต่บังคับให้ “ต้องทำจริง”
  if(emphasis){
    sec = clamp(sec + 1, 4, 10);
    need = clamp(need, 3, 7);
  }

  const k = STEPS[stepIdx]?.key || '';
  if(k === 'nails'){ need += 1; sec -= (diff==='easy'?0:1); }
  if(k === 'wrist'){ sec  -= (diff==='easy'?0:1); }

  need = clamp(need, 3, 8);
  sec  = clamp(sec, 4, 10);

  return { stepIdx, needHits: need, limitSec: sec, startedAtMs: 0, hitsNow: 0, passed: false, fails: 0, emphasis };
}
function questText(q){
  if(!q) return '🎯 QUEST: —';
  const s = STEPS[q.stepIdx];
  const left = Math.max(0, Math.ceil(q.limitSec - ((q.startedAtMs? (nowMs()-q.startedAtMs)/1000 : 0))));
  const done = q.passed ? '✅' : '';
  const em = q.emphasis ? '⭐' : '';
  return `🎯 QUEST${em}: ${done} ตี ${s.icon} ${q.hitsNow}/${q.needHits} ภายใน ${left}s`;
}

// ------------------ SFX + Haptics (no asset) ------------------
function makeSFX(){
  let ctx=null, master=null;
  const enabled = (qs('sfx','1') !== '0');

  function ensure(){
    if(!enabled) return null;
    if(ctx) return ctx;
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);
    return ctx;
  }
  function beep(freq, durMs, type='sine'){
    const c = ensure();
    if(!c) return;
    if(c.state === 'suspended'){ c.resume().catch(()=>{}); }
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(master);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
    o.start(t0);
    o.stop(t0 + (durMs/1000) + 0.02);
  }
  function vibe(ms){
    if(qs('vibe','1') === '0') return;
    try{ WIN.navigator?.vibrate?.(ms); }catch{}
  }
  function play(name){
    switch(name){
      case 'good':   beep(760, 60, 'triangle'); vibe(12); break;
      case 'wrong':  beep(220, 90, 'sawtooth'); vibe(30); break;
      case 'haz':    beep(140, 120, 'square');  vibe(45); break;
      case 'shield': beep(520, 85, 'sine');     vibe(18); break;
      case 'block':  beep(420, 70, 'triangle'); vibe(20); break;
      case 'fever':  beep(980, 120, 'triangle'); beep(1240, 120, 'triangle'); vibe(35); break;
      case 'storm':  beep(320, 160, 'sawtooth'); vibe(25); break;
      default: break;
    }
  }
  return { play };
}

// ------------------ History -> weak step (play only) ------------------
function getWeakStepFromHistory(){
  const hist = loadJson(LS_HIST, []);
  const arr = Array.isArray(hist) ? hist : [];
  const recent = arr.filter(x=>x && x.game==='hygiene').slice(0,5);
  if(!recent.length) return { weakKey:null, weakIdx:-1, reason:'no_history' };

  // ใช้ stepBreakdown ถ้ามี (ใหม่), ถ้าไม่มีใช้ fallback ว่าง
  const scoreByKey = new Map(); // lower = weaker
  for(const s of recent){
    const bd = s.stepBreakdown || null;
    if(!bd) continue;
    for(const k of Object.keys(bd)){
      const o = bd[k] || {};
      const good = Number(o.good||0);
      const wrong = Number(o.wrong||0);
      const haz = Number(o.haz||0);
      const total = Math.max(1, good + wrong);
      const acc = good / total;
      const unsafe = haz; // penalty
      const weakScore = (1-acc) + clamp(unsafe/6, 0, 1)*0.35; // รวม “ทำไม่ครบ” + “ไม่ปลอดภัย”
      scoreByKey.set(k, (scoreByKey.get(k)||0) + weakScore);
    }
  }

  if(!scoreByKey.size) return { weakKey:null, weakIdx:-1, reason:'no_breakdown' };

  let bestK=null, bestV=1e9;
  for(const [k,v] of scoreByKey.entries()){
    if(v < bestV){ bestV=v; bestK=k; }
  }
  // bestV ต่ำ = แข็งแรง => เราอยาก “อ่อน” => เลือกค่ามากสุดแทน
  bestK=null; bestV=-1;
  for(const [k,v] of scoreByKey.entries()){
    if(v > bestV){ bestV=v; bestK=k; }
  }

  const idx = STEPS.findIndex(s=>s.key===bestK);
  return { weakKey: bestK, weakIdx: idx, reason:'history' };
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // HUD
  const pillStep   = DOC.getElementById('pillStep');
  const pillHits   = DOC.getElementById('pillHits');
  const pillCombo  = DOC.getElementById('pillCombo');
  const pillMiss   = DOC.getElementById('pillMiss');
  const pillRisk   = DOC.getElementById('pillRisk');
  const pillTime   = DOC.getElementById('pillTime');
  const pillQuest  = DOC.getElementById('pillQuest');
  const pillFever  = DOC.getElementById('pillFever');
  const pillShield = DOC.getElementById('pillShield');
  const hudSub     = DOC.getElementById('hudSub');
  const banner     = DOC.getElementById('banner');
  const hudRoot    = DOC.querySelector('.hw-hud');

  // Tutor
  const tutor = DOC.getElementById('stepTutor');
  const tutorEmoji = DOC.getElementById('tutorEmoji');
  const tutorTitle = DOC.getElementById('tutorTitle');
  const tutorSub   = DOC.getElementById('tutorSub');
  const tutorCue   = DOC.getElementById('tutorCue');
  const tutorHint  = DOC.getElementById('tutorHint');

  // overlays
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

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // learn mode: default ON in play, OFF in study
  const learnOn = (() => {
    const forced = qs('learn', null);
    if(forced === '1') return true;
    if(forced === '0') return false;
    return runMode === 'play';
  })();

  const SFX = makeSFX();

  // difficulty base
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, shieldRate:0.045 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, shieldRate:0.030 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, shieldRate:0.038 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    shieldRate:[0.015, 0.08],
  };

  // optional AI packs
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd    = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // history emphasis (play only)
  const weakInfo = (runMode==='play') ? getWeakStepFromHistory() : { weakKey:null, weakIdx:-1, reason:'study_off' };
  const emphasisIdx = (weakInfo.weakIdx>=0) ? weakInfo.weakIdx : -1;

  // ---------------- State ----------------
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft=timePlannedSec;

  let stepIdx=0, hitsInStep=0, loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0, hazHits=0;
  const missLimit = 3;

  let correctHits=0, totalStepHits=0;
  const rtOk=[];

  let spawnAcc=0;

  // Step breakdown (PACK AS)
  const stepGood = Array(STEPS.length).fill(0);
  const stepWrongAgainst = Array(STEPS.length).fill(0); // ผิดตอนที่ควรถูกขั้นนี้
  const stepHazAgainst = Array(STEPS.length).fill(0);   // โดนเชื้อตอนขั้นนี้
  const stepRt = Array.from({length:STEPS.length}, ()=>[]);

  // Quest
  let quest=null; let miniCleared=0, miniTotal=0;

  // Powerups
  let shield=0;
  let fever=0, feverOn=false, feverLeftMs=0;
  let score=0, scoreMult=1;

  // Storm
  let stormOn=false, stormLeftMs=0, nextStormAtSec=22, stormCount=0;

  // targets
  const targets=[]; let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1100);
  }
  function shakeHud(){
    if(!hudRoot) return;
    hudRoot.classList.add('shake');
    setTimeout(()=>hudRoot.classList.remove('shake'), 220);
  }

  // Tutor show/hide
  function showTutorForStep(idx, mode='enter'){
    if(!learnOn || !tutor) return;

    const s = STEPS[idx];
    tutorEmoji && (tutorEmoji.textContent = s.icon);
    tutorTitle && (tutorTitle.textContent = `STEP ${idx+1}/7 ${s.label}${(idx===emphasisIdx && runMode==='play')?' ⭐ เน้นขั้นนี้':''}`);
    tutorSub && (tutorSub.textContent = s.tip);
    tutorCue && (tutorCue.textContent = `Cue: ${s.cue}`);
    tutorHint && (tutorHint.textContent = `ตีเป้า ${s.icon} เท่านั้น • หลบ 🦠 • เก็บ 🧼 ได้`);

    tutor.classList.remove('out');
    tutor.style.display = 'grid';

    // อยู่สั้น ๆ 2.6s (ถ้าเป็น wrong mode แสดงนานขึ้นนิด)
    const stay = (mode==='wrong') ? 3200 : 2600;
    clearTimeout(showTutorForStep._t);
    showTutorForStep._t = setTimeout(()=>{
      tutor.classList.add('out');
      setTimeout(()=>{ if(tutor) tutor.style.display='none'; }, 170);
    }, stay);
  }

  function getSpawnRect(){
    const w=WIN.innerWidth, h=WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 150;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 130;
    const pad=14;
    return { x0:pad, x1:w-pad, y0:topSafe+pad, y1:h-bottomSafe-pad, w, h };
  }

  function getMissCount(){ return wrongStepHits + hazHits; }
  function missLeft(){ return Math.max(0, missLimit - getMissCount()); }
  function getStepAcc(){ return totalStepHits ? (correctHits/totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs()-tStartMs)/1000) : 0; }

  function setQuestPill(){ if(pillQuest) pillQuest.textContent = questText(quest); }
  function setPowerPills(){
    if(pillShield) pillShield.textContent = `🧼 SHIELD ${shield}`;
    const need = Math.max(0, 100 - Math.round(fever));
    if(pillFever) pillFever.textContent = `${ICON_FEVER} FEVER ${Math.round(fever)}%${feverOn?' (x2)':(need<=30?` (อีก ${need}%)`:'')}`;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}${(stepIdx===emphasisIdx && runMode==='play')?' ⭐':''}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS เหลือ ${missLeft()}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1-stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits/Math.max(1,(loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    hudSub && (hudSub.textContent =
      `${s.tip} • SCORE ${score} • ${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}${learnOn?' • learn:on':''}${stormOn?' • 🌪 STORM!':''}`);

    setQuestPill();
    setPowerPills();
  }

  function newQuestForCurrentStep(){
    const emphasis = (runMode==='play' && stepIdx===emphasisIdx);
    quest = makeQuestForStep(stepIdx, diff, emphasis);
    quest.startedAtMs = nowMs();
    quest.hitsNow=0; quest.passed=false;
    miniTotal++;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow:0, passed:false, emphasis } });
    setQuestPill();

    // เน้นขั้นอ่อน: เปิด Tutor ตอนเริ่ม step
    showTutorForStep(stepIdx, 'enter');
  }

  function resetQuestBecauseFail(){
    if(!quest || quest.passed) return;
    quest.fails++;
    quest.startedAtMs = nowMs();
    quest.hitsNow = 0;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow:0, passed:false, fails: quest.fails, emphasis: quest.emphasis } });
    showBanner(`🔁 QUEST รีเซ็ต! ทำให้ทัน ${quest.limitSec}s`);
    setQuestPill();
  }

  function passQuest(){
    if(!quest || quest.passed) return;
    quest.passed=true;
    miniCleared++;
    emit('quest:update', { stepIdx, quest: { needHits: quest.needHits, limitSec: quest.limitSec, hitsNow: quest.hitsNow, passed:true, emphasis: quest.emphasis } });

    addFever(18);
    addScore(40, 'quest');
    combo += 2; comboMax = Math.max(comboMax, combo);
    showBanner(`🏅 QUEST ผ่าน! +โบนัส +FEVER`);
    setQuestPill();
  }

  function clearTargets(){
    while(targets.length){
      const t=targets.pop();
      t.el?.remove();
    }
  }

  function markHit(obj){
    try{
      obj.el.classList.add('hit','burst');
      setTimeout(()=>obj.el && obj.el.remove(), 160);
    }catch(_){}
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind} pop`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    stage.appendChild(el);

    const rect=getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.92 + rng()*0.22).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view!=='cvr'){
      el.addEventListener('click', ()=>{ if(running && !paused) judgeHit(obj,'tap',null); }, { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function computeRt(obj){ return clamp(nowMs()-obj.bornMs, 0, 60000); }

  function addScore(basePts, reason){
    const pts = Math.round(basePts * scoreMult);
    score += pts;
    emit('hha:score', { score, pts, reason, mult: scoreMult, feverOn });
  }

  function addFever(d){
    fever = clamp(fever + d, 0, 100);
    if(!feverOn && fever>=100) startFever();
  }
  function decayFever(d){ fever = clamp(fever - d, 0, 100); }

  function startFever(){
    feverOn=true; feverLeftMs=8000;
    scoreMult=2;
    DOC.body.classList.add('fever-on');
    SFX?.play('fever');
    showBanner(`${ICON_FEVER} FEVER ON! คะแนน x2`);
  }
  function endFever(){
    feverOn=false; feverLeftMs=0; scoreMult=1;
    DOC.body.classList.remove('fever-on');
    showBanner(`✅ FEVER จบแล้ว`);
  }

  function startStorm(){
    stormOn=true; stormLeftMs=6000; stormCount++;
    SFX?.play('storm');
    showBanner(`🌪 STORM WAVE! หลบเชื้อให้ดี`);
  }
  function endStorm(){
    stormOn=false; stormLeftMs=0;
    showBanner(`✅ STORM ผ่าน!`);
  }

  function currentSpawnParams(){
    const P0 = dd ? dd.getParams() : base;
    let P = { ...P0 };

    // เน้นขั้นอ่อน: 5 วินาทีแรกหลังเข้า step ให้ good มากขึ้นเล็กน้อย (เฉพาะ play)
    const emphasis = (runMode==='play' && stepIdx===emphasisIdx);
    const stepAgeSec = quest?.startedAtMs ? ((nowMs()-quest.startedAtMs)/1000) : 99;
    if(emphasis && stepAgeSec <= 5.0){
      P.decoyRate = clamp(P.decoyRate - 0.05, bounds.decoyRate[0], bounds.decoyRate[1]);
      P.hazardRate = clamp(P.hazardRate - 0.02, bounds.hazardRate[0], bounds.hazardRate[1]);
      P.spawnPerSec = clamp(P.spawnPerSec * 1.05, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
    }

    if(stormOn){
      P.spawnPerSec = clamp(P.spawnPerSec * 1.25, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
      P.hazardRate  = clamp(P.hazardRate + 0.06, bounds.hazardRate[0], bounds.hazardRate[1]);
      P.decoyRate   = clamp(P.decoyRate + 0.04, bounds.decoyRate[0], bounds.decoyRate[1]);
      P.shieldRate  = clamp(P.shieldRate + 0.020, bounds.shieldRate[0], bounds.shieldRate[1]);
    }
    if(feverOn){
      P.spawnPerSec = clamp(P.spawnPerSec * 1.15, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
      P.hazardRate  = clamp(P.hazardRate - 0.02, bounds.hazardRate[0], bounds.hazardRate[1]);
    }
    return P;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = currentSpawnParams();
    const r = rng();

    if(shield<1 && r < P.shieldRate){
      return createTarget('good', ICON_SHIELD, -2);
    }
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j=pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
      return true;
    }
    if(missLeft()===2) showBanner(`⚠️ MISS เหลือ 2`);
    if(missLeft()===1) showBanner(`🚨 MISS เหลือ 1`);
    return false;
  }

  // Smart aim assist for cVR
  function pickTargetSmart(ax, ay, lockPx){
    const cand=[];
    for(const t of targets){
      const dx=t.x-ax, dy=t.y-ay;
      const dist=Math.hypot(dx,dy);
      if(dist<=lockPx) cand.push({t,dist});
    }
    if(!cand.length) return null;

    const cur = stepIdx;
    cand.sort((a,b)=>{
      const aGoodCur = (a.t.kind==='good' && a.t.stepIdx===cur);
      const bGoodCur = (b.t.kind==='good' && b.t.stepIdx===cur);
      if(aGoodCur !== bGoodCur) return aGoodCur ? -1 : 1;

      const aShield = (a.t.kind==='good' && a.t.stepIdx===-2);
      const bShield = (b.t.kind==='good' && b.t.stepIdx===-2);
      if(aShield !== bShield) return aShield ? -1 : 1;

      return a.dist - b.dist;
    });
    return cand[0].t;
  }

  function onShoot(e){
    if(!running || paused) return;
    if(view!=='cvr') return;

    const d=(e && e.detail) || {};
    const lockPx=Number(d.lockPx || 28);

    let ax=(typeof d.x==='number') ? d.x : (WIN.innerWidth/2);
    let ay=(typeof d.y==='number') ? d.y : (WIN.innerHeight/2);
    if(ax<=1 && ay<=1){ ax*=WIN.innerWidth; ay*=WIN.innerHeight; }

    const t = pickTargetSmart(ax, ay, lockPx);
    if(t) judgeHit(t, 'shoot', { lockPx, ax, ay });
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // quest timeout check
    if(quest && !quest.passed){
      const dtQ = (nowMs()-quest.startedAtMs)/1000;
      if(dtQ > quest.limitSec) resetQuestBecauseFail();
    }

    // Shield pickup
    if(obj.kind==='good' && obj.stepIdx===-2){
      shield=1;
      addScore(25,'shield_pickup');
      addFever(10);
      SFX?.play('shield');
      showBanner(`🧼 ได้ SHIELD! กันเชื้อ 1 ครั้ง`);
      markHit(obj); removeTarget(obj); setHud(); return;
    }

    // Good
    if(obj.kind==='good'){
      correctHits++; totalStepHits++; hitsInStep++;
      combo++; comboMax=Math.max(comboMax, combo);
      rtOk.push(rt);

      stepGood[stepIdx]++; stepRt[stepIdx].push(rt);

      addScore(10,'hit_good');
      addFever(feverOn?3:6);
      SFX?.play('good');

      if(quest && !quest.passed){
        quest.hitsNow++;
        emit('quest:update', { stepIdx, quest:{ needHits:quest.needHits, limitSec:quest.limitSec, hitsNow:quest.hitsNow, passed:false, emphasis:quest.emphasis }});
        if(quest.hitsNow >= quest.needHits) passQuest();
        else setQuestPill();
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs:rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs:rt, elapsedSec:elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs:rt, source, extra });

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        if(quest && !quest.passed) resetQuestBecauseFail();

        stepIdx++; hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0; loopsDone++;
          addScore(60,'loop_clear');
          addFever(12);
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }

        newQuestForCurrentStep();
      }else{
        showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      }

      markHit(obj); removeTarget(obj); setHud(); return;
    }

    // Wrong (ตีผิดตอนที่ควรทำ stepIdx ปัจจุบัน)
    if(obj.kind==='wrong'){
      wrongStepHits++; totalStepHits++;
      stepWrongAgainst[stepIdx]++;

      combo=0; decayFever(18);
      SFX?.play('wrong'); shakeHud();

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx:obj.stepIdx, rtMs:rt, source, extra });

      showBanner(`⚠️ ผิดขั้น! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      showTutorForStep(stepIdx, 'wrong'); // PACK AS: สอนทันที

      if(quest && !quest.passed) resetQuestBecauseFail();

      markHit(obj); removeTarget(obj);
      if(checkFail()) return;
      setHud(); return;
    }

    // Hazard
    if(obj.kind==='haz'){
      if(shield>0){
        shield=0;
        addScore(15,'shield_block');
        addFever(8);
        SFX?.play('block');
        showBanner(`🧼 SHIELD บล็อกเชื้อ!`);
        markHit(obj); removeTarget(obj); setHud(); return;
      }

      hazHits++;
      stepHazAgainst[stepIdx]++;

      combo=0; decayFever(24);
      SFX?.play('haz'); shakeHud();

      emit('hha:judge', { kind:'haz', stepIdx, rtMs:rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! MISS เหลือ ${missLeft()}`);
      showTutorForStep(stepIdx, 'wrong');

      if(quest && !quest.passed) resetQuestBecauseFail();

      markHit(obj); removeTarget(obj);
      if(checkFail()) return;
      setHud(); return;
    }
  }

  function tick(){
    if(!running) return;
    const t=nowMs();
    const dt=Math.max(0, (t-tLastMs)/1000);
    tLastMs=t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec:timeLeft, elapsedSec:elapsedSec() });
    if(timeLeft<=0){ endGame('time'); return; }

    const es=elapsedSec();

    if(!stormOn && es>=nextStormAtSec){
      startStorm();
      nextStormAtSec = es + 22 + Math.floor(rng()*7);
    }
    if(stormOn){
      stormLeftMs -= dt*1000;
      if(stormLeftMs<=0) endStorm();
    }

    if(feverOn){
      feverLeftMs -= dt*1000;
      if(feverLeftMs<=0){
        endFever();
        fever=40;
      }
    }

    if(quest && !quest.passed){
      const dtQ=(nowMs()-quest.startedAtMs)/1000;
      if(dtQ>quest.limitSec) resetQuestBecauseFail();
      else setQuestPill();
    }

    const P=currentSpawnParams();
    spawnAcc += (P.spawnPerSec*dt);
    while(spawnAcc>=1){
      spawnAcc-=1;
      spawnOne();
      if(targets.length>18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec:es });
    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();

    timeLeft=timePlannedSec;
    stepIdx=0; hitsInStep=0; loopsDone=0;

    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;

    // breakdown reset
    for(let i=0;i<STEPS.length;i++){
      stepGood[i]=0; stepWrongAgainst[i]=0; stepHazAgainst[i]=0;
      stepRt[i].length=0;
    }

    quest=null; miniCleared=0; miniTotal=0;

    shield=0;
    fever=0; feverOn=false; feverLeftMs=0;
    score=0; scoreMult=1;

    stormOn=false; stormLeftMs=0; nextStormAtSec=22; stormCount=0;
    DOC.body.classList.remove('fever-on');

    if(tutor){ tutor.style.display='none'; tutor.classList.remove('out'); }

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs=nowMs();
    tLastMs=tStartMs;

    startOverlay.style.display='none';
    endOverlay.style.display='none';

    newQuestForCurrentStep();

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, learnOn, emphasisStepKey: (emphasisIdx>=0?STEPS[emphasisIdx].key:null), emphasisReason: weakInfo.reason });
    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    DOC.body.classList.remove('fever-on');
    if(tutor){ tutor.style.display='none'; tutor.classList.remove('out'); }

    const durationPlayedSec=Math.max(0, Math.round(elapsedSec()));
    const stepAcc=getStepAcc();
    const riskIncomplete=clamp(1-stepAcc, 0, 1);
    const riskUnsafe=clamp(hazHits/Math.max(1,(loopsDone+1)*2), 0, 1);

    const rtMed=(()=>{
      const a=rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m=(a.length-1)/2;
      return (a.length%2)? a[m|0] : (a[m|0]+a[(m|0)+1])/2;
    })();

    // step breakdown object
    const stepBreakdown = {};
    for(let i=0;i<STEPS.length;i++){
      const s=STEPS[i];
      const rts = stepRt[i].slice().sort((a,b)=>a-b);
      const med = rts.length ? (rts.length%2 ? rts[(rts.length-1)/2|0] : (rts[(rts.length/2-1)|0] + rts[(rts.length/2)|0]) / 2) : 0;

      const good = stepGood[i];
      const wrong = stepWrongAgainst[i];
      const total = Math.max(1, good + wrong);
      const acc = good/total;

      stepBreakdown[s.key] = {
        good, wrong,
        acc,
        haz: stepHazAgainst[i],
        medianRtMs: Math.round(med),
      };
    }

    // weak step in this run (for end screen hint)
    let weakKey=null, weakScore=-1;
    for(const k of Object.keys(stepBreakdown)){
      const o = stepBreakdown[k];
      const sc = (1 - Number(o.acc||0)) + clamp(Number(o.haz||0)/6, 0, 1)*0.35;
      if(sc > weakScore){ weakScore=sc; weakKey=k; }
    }

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1 && score>=900) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2 && score>=700) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3 && score>=520) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId=`HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary={
      version:'1.4.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode, diff, view, seed, sessionId,
      timestampIso: nowIso(),

      learnOn,
      emphasisFromHistory: (runMode==='play'),
      emphasisStepKey: (emphasisIdx>=0?STEPS[emphasisIdx].key:null),
      emphasisReason: weakInfo.reason,

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
      misses: getMissCount(),

      score,
      stormCount,
      miniCleared,
      miniTotal,

      medianStepMs: rtMed,

      weakStepThisRun: weakKey,
      stepBreakdown
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras());
    if(dd) Object.assign(summary, dd.getSummaryExtras());

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0,200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (MISS เต็ม)' : 'จบเกม ✅';
    const weakLabel = weakKey ? (STEPS.find(s=>s.key===weakKey)?.label || weakKey) : '-';
    endSub.textContent =
      `Grade ${grade} • SCORE ${score} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • quest ${miniCleared}/${miniTotal} • จุดที่ควรฝึก: ${weakLabel}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display='grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  function goHub(){ location.href = hub || '../hub.html'; }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused=!paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // badge/unlock popups (optional)
  WIN.addEventListener('hha:badge', (e)=>{
    const b=(e && e.detail) || {};
    WIN.Particles?.popText?.(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u=(e && e.detail) || {};
    WIN.Particles?.popText?.(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d=(e && e.detail) || {};
    if(d?.text) showBanner(`🤖 ${d.text}`);
  });

  // initial
  setHud();
}