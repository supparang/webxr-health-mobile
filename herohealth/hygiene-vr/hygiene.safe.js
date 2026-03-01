// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard) — PATCH v20260301a (ALL-IN)
// ✅ Gameplay: Survival + Practice 15s + Missions + Power-ups + FX
// ✅ Quiz: clickable options (mobile/pc) + cVR shoot-to-pick
// ✅ Analyze: Heatmap2D + topRisk pulse
// ✅ Evaluate: pick zone + pick reason (mobile/pc click) + cVR aim-shoot
// ✅ Create: routine 30s pick 3 + score rubric + auto-fill on timeout
// ✅ FIX: “ตีแล้วไม่หาย” (is-dying + forced remove), TTL cleanup, watchdog anti-stall, spawn cap + mobile throttle
// Exports: boot()
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
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

function isTouchDevice(){
  try{ return ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0; }catch{ return false; }
}
function prefersReducedMotion(){
  try{ return WIN.matchMedia && WIN.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{ return false; }
}

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

function rectOf(id){
  try{
    const el = DOC.getElementById(id);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { r, x:r.left, y:r.top, w:r.width, h:r.height };
  }catch{ return null; }
}
function pointInRect(x,y, rr){
  if(!rr) return false;
  const r = rr.r || rr;
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
    return;
  }

  // HUD
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillQuest= DOC.getElementById('pillQuest');
  const pillPower= DOC.getElementById('pillPower');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const barStep  = DOC.getElementById('barStep');
  const barLoop  = DOC.getElementById('barLoop');

  // Quiz UI
  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');
  const quizOpts = DOC.getElementById('quizOpts');
  const optEls   = [DOC.getElementById('opt0'), DOC.getElementById('opt1'), DOC.getElementById('opt2'), DOC.getElementById('opt3')];

  // Overlays
  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // End overlay (Evaluate/Create)
  const evalBox       = DOC.getElementById('evalBox');
  const evalSub       = DOC.getElementById('evalSub');
  const evalHint      = DOC.getElementById('evalHint');
  const handMap       = DOC.getElementById('handMap');
  const evalPicked    = DOC.getElementById('evalPicked');
  const evalScore     = DOC.getElementById('evalScore');
  const evalReasons   = DOC.getElementById('evalReasons');
  const btnEvalConfirm= DOC.getElementById('btnEvalConfirm');
  const btnEvalSkip   = DOC.getElementById('btnEvalSkip');

  const createBox     = DOC.getElementById('createBox');
  const routineOpts   = DOC.getElementById('routineOpts');
  const createPicked  = DOC.getElementById('createPicked');
  const createScore   = DOC.getElementById('createScore');
  const createTimerEl = DOC.getElementById('createTimer');
  const btnCreateConfirm = DOC.getElementById('btnCreateConfirm');

  // Controls
  const btnStart     = DOC.getElementById('btnStart');
  const btnPractice  = DOC.getElementById('btnPractice');
  const btnRestart   = DOC.getElementById('btnRestart');
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

  const fxOn = (qs('fx','1') !== '0') && !prefersReducedMotion();

  // base difficulty (DD can override)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.75, hazardRate:0.07, decoyRate:0.15, lifeMs:[1500, 2400] };
    if(diff==='hard') return { spawnPerSec:2.55, hazardRate:0.14, decoyRate:0.26, lifeMs:[1200, 2100] };
    return { spawnPerSec:2.15, hazardRate:0.11, decoyRate:0.22, lifeMs:[1300, 2300] };
  })();

  // optional AI packs
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.15, 4.00], hazardRate:[0.05, 0.24], decoyRate:[0.10, 0.38] }
  }) : null;

  // game state
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
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // per-step stats -> heatmap
  const stepStats = STEPS.map(s=>({ key:s.key, label:s.label, ok:0, wrong:0, haz:0, rt:[] }));

  // missions/powerups
  let mission = { id:'', text:'', done:0, meta:{}, _nextAt:0 };
  const power = { shield:0, focusUntil:0, freezeUntil:0 };

  // quiz runtime
  let quizOpen = false;
  let quizRight = 0, quizWrong = 0;
  let curQuiz = null;              // {q,a,wrong[]}
  let curQuizOptions = [];         // [opt0..3]
  let curQuizAnswerIndex = -1;     // index in curQuizOptions
  let quizAnswered = false;

  // targets
  const targets = []; // {id,el,kind,stepIdx,bornMs,dieAtMs,x,y,radius}
  let nextId=1;

  // end overlay flow state
  let endSummary = null;
  let evalState = { active:false, confirmed:false, pickedZone:null, pickedReason:null, topRiskZone:null };
  let createState = { active:false, picked:[], score:null, left:30, t:null };

  // 2D zones (percent positions in handMap)
  const ZONES = [
    { id:'palm',  name:'ฝ่ามือ', zx:32, zy:62, stepKey:'palm'  },
    { id:'back',  name:'หลังมือ', zx:68, zy:62, stepKey:'back'  },
    { id:'gaps',  name:'ซอกนิ้ว', zx:35, zy:34, stepKey:'gaps'  },
    { id:'knuck', name:'ข้อนิ้ว', zx:50, zy:40, stepKey:'knuck' },
    { id:'thumb', name:'โป้ง',    zx:22, zy:44, stepKey:'thumb' },
    { id:'nails', name:'เล็บ',    zx:66, zy:30, stepKey:'nails' },
    { id:'wrist', name:'ข้อมือ',  zx:50, zy:82, stepKey:'wrist' },
  ];

  // ---------- UX helpers ----------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function coachTip(text, cooldownMs){
    const now = nowMs();
    const cd = Number(cooldownMs||1400);
    if(!coachTip._t || (now - coachTip._t) > cd){
      coachTip._t = now;
      if(text) showBanner(`🤖 ${text}`);
    }
  }

  function fxHit(kind, obj){
    if(!fxOn) return;
    const P = WIN.Particles;
    if(!P || !obj) return;

    // obj.x/y are viewport px
    const x = Number(obj.x || WIN.innerWidth*0.5);
    const y = Number(obj.y || WIN.innerHeight*0.5);

    if(kind === 'good'){
      P.popText(x, y, '✅ +1', 'good');
      P.burst(x, y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(x, y, '⚠️ ผิด!', 'warn');
      P.burst(x, y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      const blocked = (power.shield>0);
      P.popText(x, y, blocked ? '🛡️ กันได้!' : '🦠 โดนเชื้อ!', blocked ? 'cyan' : 'bad');
      P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
    }
  }

  // ---------- Derived metrics ----------
  function getMissCount(){ return (wrongStepHits + hazHits); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function median(arr){
    const a = (arr||[]).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = (a.length-1)/2;
    return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
  }

  // ---------- Spawn safe rect (HUD occlusion aware) ----------
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;

    const topSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 180;
    const bottomSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 220;

    const hudTop = rectOf('hudTop');
    const bannerR = rectOf('banner');
    const quizR = rectOf('quizBox');

    let topSafe = topSafeVar;
    if(hudTop) topSafe = Math.max(topSafe, hudTop.y + hudTop.h + 12);
    if(bannerR) topSafe = Math.max(topSafe, bannerR.y + bannerR.h + 8);
    if(quizR && quizR.w>10 && quizR.h>10) topSafe = Math.max(topSafe, quizR.y + quizR.h + 10);

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafeVar - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function pickSpawnXY(radius){
    const rect = getSpawnRect();
    const tries = 18;

    for(let t=0;t<tries;t++){
      const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

      if(pointInRect(x,y, rectOf('hudTop'))) continue;
      if(pointInRect(x,y, rectOf('banner'))) continue;
      if(pointInRect(x,y, rectOf('startOverlay'))) continue;
      if(pointInRect(x,y, rectOf('endOverlay'))) continue;

      // overlap
      let ok = true;
      for(const ot of targets){
        const dx = ot.x - x, dy = ot.y - y;
        const rr = (ot.radius||radius) + radius + 8;
        if((dx*dx + dy*dy) < rr*rr){ ok=false; break; }
      }
      if(ok) return {x,y,rect};
    }

    // fallback center safe
    const x = clamp((rect.x0+rect.x1)/2, rect.x0, rect.x1);
    const y = clamp((rect.y0+rect.y1)/2, rect.y0, rect.y1);
    return {x,y,rect};
  }

  // ---------- HUD ----------
  function setHud(){
    const s = STEPS[stepIdx];

    if(pillStep) pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`;
    if(pillHits) pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`;
    if(pillCombo) pillCombo.textContent = `COMBO ${combo}`;
    if(pillMiss) pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`;

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    if(pillRisk) pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`;
    if(pillTime) pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`;

    const missionText = mission && mission.text ? mission.text : '—';
    if(pillQuest) pillQuest.textContent = `MISSION ${missionText}`;
    if(pillPower){
      const now = nowMs();
      pillPower.textContent =
        `POWER 🛡️${power.shield} • 🎯${(power.focusUntil>now)?'ON':'OFF'} • ❄️${(power.freezeUntil>now)?'ON':'OFF'}`;
    }

    if(hudSub){
      hudSub.textContent =
        `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • tgt=${targets.length}`
        + (quizOpen ? ' • QUIZ' : '');
    }

    if(barStep){
      const pct = clamp(hitsInStep / Math.max(1, s.hitsNeed), 0, 1);
      barStep.style.width = (pct*100).toFixed(1) + '%';
    }
    if(barLoop){
      const stepAcross = (stepIdx + (hitsInStep / Math.max(1, s.hitsNeed))) / 7;
      let m = 0;
      if(mission && mission.meta && mission.meta.pct != null) m = clamp(mission.meta.pct, 0, 1);
      const pct = clamp(Math.max(stepAcross, m), 0, 1);
      barLoop.style.width = (pct*100).toFixed(1) + '%';
    }
  }

  // ---------- Targets ----------
  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch{}
    }
  }

  // immediate kill (fix “ตีแล้วไม่หาย”)
  function killTarget(obj){
    if(!obj || !obj.el) return;
    try{
      obj.el.classList.add('is-dying');
      const el = obj.el;
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 170);
    }catch{}
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    killTarget(obj);
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    // radius based on CSS var
    let tgtSize = 76;
    try{
      const v = getComputedStyle(DOC.documentElement).getPropertyValue('--tgtSize').trim();
      const px = Number(String(v).replace('px',''));
      if(Number.isFinite(px) && px>10) tgtSize = px;
    }catch{}
    const radius = Math.max(26, (tgtSize*0.5));

    const {x,y,rect} = pickSpawnXY(radius);
    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    // TTL
    const P = dd ? dd.getParams() : base;
    const lifeMin = (P.lifeMs && P.lifeMs[0]) ? Number(P.lifeMs[0]) : 1300;
    const lifeMax = (P.lifeMs && P.lifeMs[1]) ? Number(P.lifeMs[1]) : 2300;
    const lifeMs = clamp(lifeMin + rng()*(lifeMax-lifeMin), 900, 4200);

    const born = nowMs();
    const obj = {
      id: nextId++,
      el,
      kind,
      stepIdx: stepRef,
      bornMs: born,
      dieAtMs: born + lifeMs,
      x, y,
      radius
    };
    targets.push(obj);

    // focus highlight
    if(kind==='good' && power.focusUntil > nowMs()){
      try{ el.classList.add('is-focus'); }catch{}
    }

    // click only when not cVR strict (cVR uses hha:shoot)
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
    const P = dd ? dd.getParams() : base;
    const s = STEPS[stepIdx];

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<7;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    if(quizOpen) return; // quiz must be answered by buttons (prevents accidental taps)
    judgeHit(obj, source, null);
  }

  // ---------- Quiz ----------
  function setQuizVisible(on){
    quizOpen = !!on;
    quizAnswered = false;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
    // ensure quiz is above targets (targets z=10, HUD z=50 already)
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    const q = bank[Math.floor(rng()*bank.length)];
    return q || null;
  }

  function renderQuizOptions(options){
    for(let i=0;i<4;i++){
      const el = optEls[i];
      if(!el) continue;
      const t = el.querySelector('.t');
      if(t) t.textContent = String(options[i] ?? '—');
      el.classList.remove('is-right','is-wrong');
      el.disabled = false;
    }
  }

  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub || optEls.some(x=>!x)) return;

    curQuiz = q;
    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    // shuffle
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }
    curQuizOptions = options;
    curQuizAnswerIndex = options.indexOf(q.a);

    setQuizVisible(true);
    quizQ.textContent = `🧠 Quiz: ${q.q}`;
    quizSub.textContent = 'เลือกคำตอบที่ถูกต้อง (แตะปุ่ม 1–4)';

    renderQuizOptions(options);

    // small hint for cVR
    if(view==='cvr'){
      quizSub.textContent = 'โหมด cVR: เล็ง crosshair ไปที่ปุ่ม 1–4 แล้ว “ยิง” เพื่อเลือก';
    }

    showBanner('🧠 Quiz มาแล้ว! เลือกคำตอบ');
  }

  function closeQuiz(msg){
    if(!quizOpen) return;
    setQuizVisible(false);
    curQuiz = null;
    curQuizOptions = [];
    curQuizAnswerIndex = -1;
    if(msg) showBanner(msg);
  }

  function answerQuiz(idx, source){
    if(!quizOpen || quizAnswered) return;
    idx = Number(idx);
    if(!(idx>=0 && idx<4)) return;

    quizAnswered = true;

    const right = (idx === curQuizAnswerIndex);
    if(right) quizRight++; else quizWrong++;

    // decorate buttons
    for(let i=0;i<4;i++){
      const el = optEls[i];
      if(!el) continue;
      el.disabled = true;
      if(i === curQuizAnswerIndex) el.classList.add('is-right');
      if(i === idx && !right) el.classList.add('is-wrong');
    }

    // reward/punish feel
    if(right){
      power.focusUntil = Math.max(power.focusUntil, nowMs() + 5000);
      timeLeft = clamp(timeLeft + 2, 0, 9999);
      coachTip('ตอบถูก! ได้ Focus 5 วิ', 900);
      showBanner('✅ Quiz ถูก! +Focus +2s');
    }else{
      combo = 0;
      wrongStepHits++; // count as mistake (fair)
      coachTip('ยังไม่ใช่ ลองจำจุดสำคัญให้แม่นนะ', 900);
      showBanner('❌ Quiz ผิด! คอมโบรีเซ็ต');
      if(getMissCount() >= missLimit){
        // end quickly
        setTimeout(()=>endGame('fail'), 250);
      }
    }

    // close after short delay
    setTimeout(()=>closeQuiz(right ? 'ไปต่อ!' : 'ไปต่อ!'), 520);
    setHud();

    // emit optional
    emit('hha:quiz', {
      q: curQuiz ? curQuiz.q : '',
      pickedIndex: idx,
      pickedText: String(curQuizOptions[idx] ?? ''),
      correctIndex: curQuizAnswerIndex,
      correctText: String(curQuizOptions[curQuizAnswerIndex] ?? ''),
      right,
      source: source || 'tap'
    });
  }

  // Bind quiz buttons
  if(quizOpts){
    quizOpts.addEventListener('click', (e)=>{
      const t = e.target;
      if(!t) return;
      const btn = t.closest('.hw-quiz-opt');
      if(!btn) return;
      const id = btn.id || '';
      const idx = (id==='opt0')?0:(id==='opt1')?1:(id==='opt2')?2:(id==='opt3')?3:-1;
      if(idx>=0) answerQuiz(idx, 'tap');
    }, { passive:true });
  }

  // ---------- Missions & Power-ups ----------
  function startMission(){
    const t = elapsedSec();
    const roll = rng();

    mission.done = 0;
    mission.meta = { pct: 0 };
    mission._nextAt = 0;

    if(roll < 0.34){
      mission.id = 'combo10';
      mission.text = 'ทำคอมโบถึง 10!';
      mission.meta.need = 10;
      mission.meta.pct = clamp(combo/10,0,1);
    }else if(roll < 0.67){
      mission.id = 'noHaz10';
      mission.text = 'อย่าโดน 🦠 10 วิ!';
      mission.meta.until = t + 10;
      mission.meta.pct = 0;
    }else{
      mission.id = 'fastStep';
      mission.text = 'ผ่าน STEP นี้ไว (≤ 6.5 วิ)!';
      mission.meta.step = stepIdx;
      mission.meta.t0 = nowMs();
      mission.meta.pct = 0;
    }
    showBanner(`🎯 MISSION: ${mission.text}`);
  }

  function rewardMission(){
    mission.done = 1;

    const roll = rng();
    if(roll < 0.34){
      power.shield = clamp(power.shield + 1, 0, 2);
      showBanner('🏅 ได้พลัง: 🛡️ Soap Shield (+1)');
    }else if(roll < 0.67){
      power.focusUntil = nowMs() + 6000;
      showBanner('🏅 ได้พลัง: 🎯 Focus 6s');
    }else{
      power.freezeUntil = nowMs() + 4500;
      showBanner('🏅 ได้พลัง: ❄️ Freeze 4.5s');
    }

    timeLeft = clamp(timeLeft + 3, 0, 9999);
  }

  function updateMissionTick(){
    if(!running) return;
    if(quizOpen) return;

    const t = elapsedSec();
    if(!mission.id){
      if(t > 6) startMission();
      return;
    }
    if(mission.done){
      if(mission._nextAt && t >= mission._nextAt){
        mission = { id:'', text:'', done:0, meta:{}, _nextAt:0 };
      }
      return;
    }

    if(mission.id === 'combo10'){
      mission.meta.pct = clamp(combo/10,0,1);
      if(combo >= 10){
        rewardMission();
        mission._nextAt = t + (10 + rng()*8);
      }
    }else if(mission.id === 'noHaz10'){
      const until = Number(mission.meta.until||0);
      const left = clamp((until - t)/10,0,1);
      mission.meta.pct = clamp(1-left,0,1);
      if(t >= until){
        rewardMission();
        mission._nextAt = t + (10 + rng()*8);
      }
    }else if(mission.id === 'fastStep'){
      if(stepIdx !== mission.meta.step){
        const dt = nowMs() - Number(mission.meta.t0||nowMs());
        mission.meta.pct = 1;
        if(dt <= 6500){
          rewardMission();
        }else{
          mission.done = 1;
          showBanner('⏱️ พลาดภารกิจไว ลองใหม่รอบหน้า');
        }
        mission._nextAt = t + (10 + rng()*8);
      }else{
        const dt = nowMs() - Number(mission.meta.t0||nowMs());
        mission.meta.pct = clamp(dt/6500,0,1);
      }
    }
  }

  function onHazHit(){
    if(power.shield > 0){
      power.shield--;
      coachTip('โล่สบู่ช่วยกันเชื้อได้ 1 ครั้ง!', 1100);
      return true;
    }
    return false;
  }

  // ---------- Judge hits ----------
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // per-step
      stepStats[stepIdx].ok++;
      stepStats[stepIdx].rt.push(rt);

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs:rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs:rt, elapsedSec:elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs:rt, source, extra });

      fxHit('good', obj);
      removeTarget(obj);

      if(combo===6) coachTip('คอมโบสวย! ทำต่อได้เลย', 1400);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep = 0;

        if(stepIdx >= STEPS.length){
          stepIdx = 0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          // quiz after full loop (not too frequent)
          if(!quizOpen && rng() < 0.75) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          // occasional quiz
          if(!quizOpen && rng() < 0.18) openRandomQuiz();
        }
      }else{
        if(combo % 7 === 0 && combo>0){
          showBanner(`🔥 COMBO ${combo}!`);
          if(combo===7 && power.shield<2) power.shield = clamp(power.shield+1,0,2);
        }
      }

      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      stepStats[stepIdx].wrong++;

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx:obj.stepIdx, rtMs:rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs:rt, elapsedSec:elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx:obj.stepIdx, rtMs:rt, source, extra });

      fxHit('wrong', obj);
      removeTarget(obj);

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      coachTip('ดู STEP ด้านบน แล้วแตะให้ตรงนะ', 1400);

      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      const blocked = onHazHit();
      if(!blocked){
        hazHits++;
        combo = 0;
        stepStats[stepIdx].haz++;
      }

      coach?.onEvent?.('haz_hit', { stepAcc:getStepAcc(), combo, blocked });
      dd?.onEvent?.('haz_hit', { elapsedSec:elapsedSec(), blocked });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs:rt, source, extra, blocked });

      fxHit('haz', obj);
      removeTarget(obj);

      if(!blocked){
        showBanner('🦠 โดนเชื้อ! ระวัง!');
        coachTip('หลบ 🦠 ให้ดี แล้วทำคอมโบแลกพลังช่วย', 1600);
        if(getMissCount() >= missLimit) endGame('fail');
      }else{
        showBanner('🛡️ โล่สบู่กันเชื้อได้!');
      }

      setHud();
      return;
    }
  }

  // ---------- cVR shoot: gameplay OR quiz OR end overlay ----------
  function pickNearestTargetWithin(lockPx){
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
    return best ? { best, dist: bestDist } : null;
  }

  function aimPickQuizOption(lockPx){
    // aim at option buttons (opt0..3)
    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9, bestIdx=-1;
    for(let i=0;i<4;i++){
      const el = optEls[i];
      if(!el) continue;
      const r = el.getBoundingClientRect();
      const ox = (r.left + r.right)/2;
      const oy = (r.top + r.bottom)/2;
      const dist = Math.hypot(ox - cx, oy - cy);
      if(dist < lockPx && dist < bestDist){
        best = el; bestDist = dist; bestIdx = i;
      }
    }
    if(bestIdx>=0){
      answerQuiz(bestIdx, 'shoot');
      return true;
    }
    return false;
  }

  function onShoot(e){
    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||30);

    // If end overlay visible and evaluate active -> select zones
    if(endOverlay && endOverlay.style.display === 'grid' && evalState.active && !evalState.confirmed){
      aimPickZone(lockPx);
      return;
    }

    // If quiz open -> pick option
    if(quizOpen){
      aimPickQuizOption(lockPx);
      return;
    }

    // Gameplay only in cVR
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const hit = pickNearestTargetWithin(lockPx);
    if(hit && hit.best){
      judgeHit(hit.best, 'shoot', { lockPx, dist: hit.dist });
    }
  }

  // ---------- Tick loop / anti-stall ----------
  function cleanupExpiredTargets(){
    const t = nowMs();
    for(let i=targets.length-1;i>=0;i--){
      const obj = targets[i];
      if(t >= obj.dieAtMs){
        targets.splice(i,1);
        killTarget(obj);
      }
    }
  }

  function mobileThrottleFactor(){
    const touch = isTouchDevice();
    const n = targets.length|0;
    if(!touch) return 1.0;
    if(n >= 14) return 0.65;
    if(n >= 10) return 0.80;
    return 0.95;
  }

  function tick(){
    if(!running) return;

    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;
    tick._lastBeat = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    // time
    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // cleanup expired
    cleanupExpiredTargets();

    // if quiz open, slow down gameplay spawn slightly
    const quizMul = quizOpen ? 0.35 : 1.0;

    const P = dd ? dd.getParams() : base;

    // powerups
    const frozen = power.freezeUntil > t;
    const freezeMul = frozen ? 0.45 : 1.0;

    // fairness: if miss high, slow spawn
    const miss = getMissCount();
    const fairnessMul = (miss>=2) ? 0.78 : 1.0;

    const mul = mobileThrottleFactor() * freezeMul * fairnessMul * quizMul;
    spawnAcc += (P.spawnPerSec * mul * dt);

    const cap = (view==='cvr') ? 16 : 18;

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      if(targets.length >= cap) break;
      const obj = spawnOne();
      if(obj && obj.kind==='good' && power.focusUntil > nowMs()){
        try{ obj.el.classList.add('is-focus'); }catch{}
      }
    }

    // hard cap remove oldest
    if(targets.length > cap){
      const over = targets.length - cap;
      for(let k=0;k<over;k++){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });
    updateMissionTick();

    setHud();
    requestAnimationFrame(tick);
  }

  function startWatchdog(){
    clearInterval(startWatchdog._t);
    startWatchdog._t = setInterval(()=>{
      if(!running || paused) return;
      const now = nowMs();
      const last = tick._lastBeat || 0;
      if(last && (now - last) > 1800){
        console.warn('[Hygiene] watchdog nudge', now-last);
        showBanner('⚠️ เกมสะดุด… กำลังดึงกลับมา');
        try{ requestAnimationFrame(tick); }catch{}
      }
    }, 700);
  }
  function stopWatchdog(){ clearInterval(startWatchdog._t); }

  // ---------- Analyze / Heatmap2D ----------
  function calcHeatmap2D(){
    const hm = STEPS.map((s,i)=>{
      const st = stepStats[i];
      const total = st.ok + st.wrong + st.haz;
      const risk = total ? ((st.wrong + st.haz) / total) : 0;
      const rtMed = median(st.rt);
      return {
        zoneId: s.key,
        stepKey: s.key,
        label: s.label,
        ok: st.ok,
        wrong: st.wrong,
        haz: st.haz,
        risk,
        heat: (risk>=0.34) ? 2 : (risk>=0.18 ? 1 : 0),
        medianRtMs: rtMed
      };
    });

    const top = hm.slice().sort((a,b)=>{
      if(b.risk!==a.risk) return b.risk-a.risk;
      if(b.haz!==a.haz) return b.haz-a.haz;
      return b.wrong-a.wrong;
    })[0] || null;

    return { heatmap: hm, topRisk: top ? top.zoneId : null };
  }

  function buildHandMapUI(heatmap2d){
    if(!handMap) return;
    handMap.innerHTML = '';

    const byId = new Map((heatmap2d||[]).map(z=>[z.zoneId, z]));

    for(const z of ZONES){
      const hz = byId.get(z.id) || { heat:0, risk:0 };

      const btn = DOC.createElement('button');
      btn.type='button';
      btn.className = `hw-zone heat-${hz.heat||0}`;
      btn.dataset.zone = z.id;
      btn.style.setProperty('--zx', z.zx);
      btn.style.setProperty('--zy', z.zy);

      const riskPct = Math.round((hz.risk||0)*100);
      btn.innerHTML = `<div class="zlab">${z.name}<span class="zmini">${riskPct}%</span></div>`;

      // pc/mobile click
      btn.addEventListener('click', ()=>{
        if(view==='cvr') return; // cVR uses shoot
        pickZone(z.id);
      }, { passive:true });

      handMap.appendChild(btn);
    }
  }

  function setZonePickedUI(zoneId){
    if(!handMap) return;
    const els = [...handMap.querySelectorAll('.hw-zone')];
    for(const el of els){
      const z = el.dataset.zone;
      if(z === zoneId) el.classList.add('is-picked');
      else el.classList.remove('is-picked');
    }
  }

  function setTopRiskPulse(topRiskId){
    if(!handMap) return;
    const els = [...handMap.querySelectorAll('.hw-zone')];
    for(const el of els){
      const z = el.dataset.zone;
      if(z === topRiskId) el.classList.add('is-risk');
      else el.classList.remove('is-risk');
    }
  }

  function pickZone(zoneId){
    evalState.pickedZone = zoneId;
    setZonePickedUI(zoneId);
    const z = ZONES.find(x=>x.id===zoneId);
    if(evalPicked) evalPicked.textContent = `เลือก: ${z ? z.name : zoneId}`;
    refreshEvalConfirm();
  }

  function pickReason(reason){
    evalState.pickedReason = reason;
    if(evalReasons){
      const btns = [...evalReasons.querySelectorAll('.hw-reason')];
      for(const b of btns){
        const r = b.getAttribute('data-reason') || '';
        if(r === reason) b.classList.add('is-picked');
        else b.classList.remove('is-picked');
      }
    }
    refreshEvalConfirm();
  }

  function refreshEvalConfirm(){
    const ok = !!evalState.pickedZone && !!evalState.pickedReason && !evalState.confirmed;
    if(btnEvalConfirm) btnEvalConfirm.disabled = !ok;
  }

  function aimPickZone(lockPx){
    if(!handMap) return;

    const mapRect = handMap.getBoundingClientRect();
    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    // only allow pick if crosshair inside map
    if(cx < mapRect.left || cx > mapRect.right || cy < mapRect.top || cy > mapRect.bottom) return;

    let best=null, bestDist=1e9;
    const els = [...handMap.querySelectorAll('.hw-zone')];
    for(const el of els){
      const r = el.getBoundingClientRect();
      const zx = (r.left + r.right)/2;
      const zy = (r.top + r.bottom)/2;
      const dist = Math.hypot(zx - cx, zy - cy);
      if(dist < lockPx && dist < bestDist){
        best = el; bestDist = dist;
      }
    }
    if(best){
      const zoneId = best.dataset.zone;
      pickZone(zoneId);
      showBanner('🎯 เลือกจุดแล้ว!');
    }
  }

  function evalScoreText(matchTop, pickedName){
    return matchTop
      ? `ผลประเมิน: ✅ เลือกถูกจุดเสี่ยงสุด (${pickedName})`
      : `ผลประเมิน: ⚠️ จุดเสี่ยงสุดอาจเป็นอีกจุด (ดูวงที่กระพริบ)`;
  }

  function confirmEvaluate(){
    if(evalState.confirmed) return;
    evalState.confirmed = true;

    const picked = evalState.pickedZone;
    const top = evalState.topRiskZone;
    const match = (picked && top && picked === top);
    const pickedName = (ZONES.find(z=>z.id===picked)?.name) || picked || '—';

    if(evalScore) evalScore.textContent = evalScoreText(match, pickedName);
    if(btnEvalConfirm) btnEvalConfirm.disabled = true;

    showBanner(match ? '✅ Evaluate: คุณชี้จุดเสี่ยงได้ถูกต้อง!' : '🧠 Evaluate: ดีมาก! ลองดูจุดเสี่ยงที่วงกระพริบด้วยนะ');

    openCreate30s(false);
  }

  function skipEvaluate(){
    evalState.confirmed = true;
    showBanner('ข้าม Evaluate แล้ว ไป Create ต่อ');
    openCreate30s(true);
  }

  // ---------- Create routine ----------
  function openCreate30s(skipped){
    if(!createBox) return;

    createBox.style.display = 'block';
    createState.active = true;
    createState.picked = [];
    createState.score = null;
    createState.left = 30;

    // reset routine UI
    if(routineOpts){
      const btns = [...routineOpts.querySelectorAll('.hw-rt')];
      btns.forEach(b=>b.classList.remove('is-picked'));
    }
    if(createPicked) createPicked.textContent = 'เลือกแล้ว: 0/3';
    if(createScore) createScore.textContent = 'คะแนน: —';
    if(btnCreateConfirm) btnCreateConfirm.disabled = true;

    clearInterval(createState.t);
    if(createTimerEl) createTimerEl.textContent = String(createState.left);

    createState.t = setInterval(()=>{
      if(!createState.active) return;
      createState.left = Math.max(0, (createState.left|0) - 1);
      if(createTimerEl) createTimerEl.textContent = String(createState.left);
      if(createState.left <= 0){
        clearInterval(createState.t);
        if(!createState.score) finalizeCreate(true);
      }
    }, 1000);

    if(skipped && evalSub){
      // keep copy gentle
      evalSub.textContent = 'ข้าม Evaluate แล้ว — มาสร้าง Routine 3 ข้อแทน';
    }
  }

  function toggleRoutineItem(text){
    if(!createState.active) return;

    const idx = createState.picked.indexOf(text);
    if(idx >= 0){
      createState.picked.splice(idx,1);
    }else{
      if(createState.picked.length >= 3){
        showBanner('เลือกได้สูงสุด 3 ข้อ');
        return;
      }
      createState.picked.push(text);
    }

    if(routineOpts){
      const btns = [...routineOpts.querySelectorAll('.hw-rt')];
      for(const b of btns){
        const t = b.getAttribute('data-rt') || '';
        if(createState.picked.includes(t)) b.classList.add('is-picked');
        else b.classList.remove('is-picked');
      }
    }

    if(createPicked) createPicked.textContent = `เลือกแล้ว: ${createState.picked.length}/3`;
    if(btnCreateConfirm) btnCreateConfirm.disabled = (createState.picked.length !== 3);
  }

  function scoreRoutine(picked){
    const core = [
      'ก่อนกินอาหาร/ขนม',
      'หลังเข้าห้องน้ำ',
      'หลังจับของสาธารณะ/ลูกบิด/มือถือ'
    ];
    let coreHit = 0;
    for(const c of core) if(picked.includes(c)) coreHit++;

    const score = coreHit===3 ? 95 : (coreHit===2 ? 78 : (coreHit===1 ? 60 : 45));
    const label = coreHit===3 ? 'ยอดเยี่ยม' : (coreHit===2 ? 'ดี' : (coreHit===1 ? 'พอใช้' : 'ควรปรับ'));
    const tip = coreHit===3 ? 'ครบ 3 ช่วงสำคัญ! โอกาสป่วยลดลงชัด' :
                coreHit===2 ? 'เกือบครบ—เพิ่ม “อีก 1 ช่วงหลัก” จะดีมาก' :
                coreHit===1 ? 'ยังขาดช่วงหลักหลายข้อ ลองเลือกช่วงที่เจอบ่อย' :
                'ลองเริ่มจาก 3 ช่วงหลักก่อนนะ';

    return { score, label, coreHit, tip };
  }

  function finalizeCreate(auto){
    if(createState.score) return;

    createState.active = false;
    clearInterval(createState.t);

    const picked = createState.picked.slice(0,3);

    // auto fill if not 3
    if(picked.length < 3){
      const fill = [
        'ก่อนกินอาหาร/ขนม',
        'หลังเข้าห้องน้ำ',
        'หลังจับของสาธารณะ/ลูกบิด/มือถือ',
        'กลับถึงบ้านจากข้างนอก',
        'หลังไอ/จาม/สั่งน้ำมูก',
        'ก่อนจับหน้า/ตา/ปาก'
      ];
      for(const f of fill){
        if(picked.length>=3) break;
        if(!picked.includes(f)) picked.push(f);
      }
      createState.picked = picked;

      if(routineOpts){
        const btns = [...routineOpts.querySelectorAll('.hw-rt')];
        for(const b of btns){
          const t = b.getAttribute('data-rt') || '';
          if(picked.includes(t)) b.classList.add('is-picked');
        }
      }
      if(createPicked) createPicked.textContent = `เลือกแล้ว: ${picked.length}/3`;
    }

    const sc = scoreRoutine(picked);
    createState.score = sc;

    if(createScore) createScore.textContent = `คะแนน: ${sc.score}/100 (${sc.label}) • core=${sc.coreHit}/3`;
    showBanner(auto ? '⏱️ หมดเวลา! ระบบสรุป routine ให้อัตโนมัติ' : '✅ Create: บันทึก routine แล้ว');

    if(endSummary){
      endSummary.create = {
        routine: picked,
        score: sc.score,
        label: sc.label,
        coreHit: sc.coreHit,
        tip: sc.tip,
        auto: !!auto,
        secondsLeft: createState.left|0
      };
      if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    }
  }

  function confirmCreate(){
    if(btnCreateConfirm && btnCreateConfirm.disabled) return;
    finalizeCreate(false);
  }

  // ---------- Reset/Start/End ----------
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

    for(let i=0;i<stepStats.length;i++){
      stepStats[i].ok=0; stepStats[i].wrong=0; stepStats[i].haz=0;
      stepStats[i].rt.length=0;
    }

    mission = { id:'', text:'', done:0, meta:{}, _nextAt:0 };
    power.shield = 0;
    power.focusUntil = 0;
    power.freezeUntil = 0;

    quizRight=0; quizWrong=0;
    closeQuiz(null);

    endSummary = null;
    evalState = { active:false, confirmed:false, pickedZone:null, pickedReason:null, topRiskZone:null };
    createState = { active:false, picked:[], score:null, left:30, t:null };
    clearInterval(createState.t);

    if(createBox) createBox.style.display = 'none';

    setHud();
  }

  function startGame(playSeconds){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    if(Number.isFinite(playSeconds) && playSeconds>0){
      timeLeft = clamp(playSeconds, 5, timePlannedSec);
    }

    if(startOverlay) startOverlay.style.display = 'none';
    if(endOverlay) endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });
    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);

    startWatchdog();
    setHud();
    requestAnimationFrame(tick);
  }

  function initEndFlow(){
    if(!endSummary) return;

    // show eval box
    if(evalBox) evalBox.style.display = 'block';
    if(createBox) createBox.style.display = 'none';

    evalState.active = true;
    evalState.confirmed = false;
    evalState.pickedZone = null;
    evalState.pickedReason = null;

    const topRisk = endSummary?.analyze?.topRiskZone || null;
    evalState.topRiskZone = topRisk;

    if(evalHint){
      evalHint.textContent = (view==='cvr')
        ? 'โหมด cVR: เล็ง crosshair ไปที่วงกลม แล้ว “ยิง” เพื่อเลือก'
        : 'แตะวงกลมเพื่อเลือก';
    }
    if(evalPicked) evalPicked.textContent = 'เลือก: —';
    if(evalScore) evalScore.textContent = 'ผลประเมิน: —';
    if(btnEvalConfirm) btnEvalConfirm.disabled = true;

    // reset reason picks
    if(evalReasons){
      const btns = [...evalReasons.querySelectorAll('.hw-reason')];
      btns.forEach(b=>b.classList.remove('is-picked'));
    }

    buildHandMapUI(endSummary?.analyze?.heatmap2d || []);
    setTopRiskPulse(topRisk);

    showBanner('🧠 เลือก “จุดเสี่ยงสุด” แล้วเลือกเหตุผล 1 ข้อ');
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    paused=false;
    stopWatchdog();

    clearTargets();
    closeQuiz(null);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    const rtMed = median(rtOk);

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const hm2 = calcHeatmap2D();

    const summary = {
      version:'20260301a',
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

      quizRight,
      quizWrong,
      missionLast: mission.text || '',
      powerEnd: { ...power },

      medianStepMs: rtMed,

      analyze: {
        heatmap2d: hm2.heatmap,
        topRiskZone: hm2.topRisk
      },
      evaluate: null,
      create: null
    };

    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras() || {});
    if(dd?.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras() || {});

    if(WIN.HHA_Badges?.evaluateBadges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endSummary = JSON.parse(JSON.stringify(Object.assign({grade}, summary)));

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';

    initEndFlow();
  }

  // ---------- Navigation ----------
  function goHub(){
    try{
      if(hub) location.href = hub;
      else location.href = '../hub.html';
    }catch{}
  }

  // ---------- Bind UI ----------
  btnStart?.addEventListener('click', ()=>startGame(), { passive:true });
  btnPractice?.addEventListener('click', ()=>startGame(15), { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', ()=>startGame(), { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // Evaluate reason clicks
  evalReasons?.addEventListener('click', (e)=>{
    const t = e.target;
    const btn = t && t.closest ? t.closest('.hw-reason') : null;
    if(!btn) return;
    const r = btn.getAttribute('data-reason') || '';
    if(r) pickReason(r);
  }, { passive:true });

  btnEvalConfirm?.addEventListener('click', ()=>{
    if(btnEvalConfirm.disabled) return;

    const picked = evalState.pickedZone;
    const reason = evalState.pickedReason;
    const top = evalState.topRiskZone;
    const match = (picked && top && picked===top);

    const pickedName = (ZONES.find(z=>z.id===picked)?.name) || picked || '';

    if(endSummary){
      endSummary.evaluate = {
        pickedZone: picked,
        pickedName,
        pickedReason: reason,
        topRiskZone: top,
        matchTopRisk: !!match,
        view,
        seed
      };
      if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    }

    confirmEvaluate();
  }, { passive:true });

  btnEvalSkip?.addEventListener('click', ()=>{
    if(endSummary){
      endSummary.evaluate = { skipped:true, view, seed };
      if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    }
    skipEvaluate();
  }, { passive:true });

  // Create routine clicks
  routineOpts?.addEventListener('click', (e)=>{
    const t = e.target;
    const btn = t && t.closest ? t.closest('.hw-rt') : null;
    if(!btn) return;
    const text = btn.getAttribute('data-rt') || '';
    if(text) toggleRoutineItem(text);
  }, { passive:true });

  btnCreateConfirm?.addEventListener('click', ()=>confirmCreate(), { passive:true });

  // cVR shoot
  WIN.addEventListener('hha:shoot', onShoot);

  // badge popup (optional)
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(fxOn && WIN.Particles?.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
      WIN.Particles.burst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, { count: 14, spread: 58, upBias: 0.9 });
    }
  });

  // ---------- Start state ----------
  setHud();
}