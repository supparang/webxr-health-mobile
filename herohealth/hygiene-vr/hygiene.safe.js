// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (Kid-first + Evaluate/Create) — PATCH v20260221k
// ✅ Emoji A (nails=👇)
// ✅ FIX: “ตีแล้วไม่หาย” (is-dying + forced remove), TTL cleanup, cap
// ✅ FIX: “เล่น ๆ อยู่ค้าง” watchdog + safe RAF
// ✅ FIX: “เลื่อนตอบไม่ได้” overlay scroll lock (body.hw-lock)
// ✅ Kid Summary: 3 cards + sticker + playagain text
// ✅ Research Mode: JSON visible if toggled
// ✅ Analyze/Evaluate/Create stored in summary
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

// ✅ Emoji Set A (Kid-friendly, nails=👇)
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'✋', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🤝', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'👇', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];
const ICON_HAZ = '🦠';

function rectOf(id){
  try{
    const el = DOC.getElementById(id);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { r };
  }catch{ return null; }
}
function pointInRect(x,y, rr){
  if(!rr) return false;
  const r = rr.r || rr;
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

// 2D zones for Evaluate
const ZONES = [
  { id:'palm',  name:'ฝ่ามือ', zx:32, zy:62, stepKey:'palm'  },
  { id:'back',  name:'หลังมือ', zx:68, zy:62, stepKey:'back'  },
  { id:'gaps',  name:'ซอกนิ้ว', zx:35, zy:34, stepKey:'gaps'  },
  { id:'knuck', name:'ข้อนิ้ว', zx:50, zy:40, stepKey:'knuck' },
  { id:'thumb', name:'โป้ง',    zx:22, zy:44, stepKey:'thumb' },
  { id:'nails', name:'เล็บ',    zx:66, zy:30, stepKey:'nails' },
  { id:'wrist', name:'ข้อมือ',  zx:50, zy:82, stepKey:'wrist' },
];

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
    return;
  }

  // Overlay scroll lock helper
  function lockOverlay(on){
    try{ DOC.body.classList.toggle('hw-lock', !!on); }catch{}
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

  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // Kid summary
  const kidGrade   = DOC.getElementById('kidGrade');
  const kidStepAcc = DOC.getElementById('kidStepAcc');
  const kidSafe    = DOC.getElementById('kidSafe');
  const kidMiss    = DOC.getElementById('kidMiss');
  const kidTip     = DOC.getElementById('kidTip');
  const kidSticker = DOC.getElementById('kidSticker');

  // Eval/Create UI
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

  // Buttons
  const btnStart     = DOC.getElementById('btnStart');
  const btnPractice  = DOC.getElementById('btnPractice');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  const btnToggleDetails = DOC.getElementById('btnToggleDetails');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const fxOn = (qs('fx','1') !== '0') && !prefersReducedMotion();

  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.75, hazardRate:0.07, decoyRate:0.15, lifeMs:[1500, 2200] };
    if(diff==='hard') return { spawnPerSec:2.55, hazardRate:0.14, decoyRate:0.26, lifeMs:[1200, 1900] };
    return { spawnPerSec:2.15, hazardRate:0.11, decoyRate:0.22, lifeMs:[1300, 2100] };
  })();

  // AI optional
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.15, 4.00], hazardRate:[0.05, 0.24], decoyRate:[0.10, 0.38] }
  }) : null;

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
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // per-step stats -> heatmap
  const stepStats = STEPS.map(s=>({ key:s.key, label:s.label, ok:0, wrong:0, haz:0, rt:[] }));

  // missions / powerups
  let mission = { id:'', text:'', done:0, meta:{ pct:0 } };
  const power = { shield:0, focusUntil:0, freezeUntil:0 };

  // quiz
  let quizOpen=false;
  let quizRight=0, quizWrong=0;

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, dieAtMs, x,y, radius}
  let nextId=1;

  // end flow state
  let endSummary = null;
  let evalState = { active:false, pickedZone:null, pickedReason:null, topRiskZone:null, confirmed:false };
  let createState = { active:false, picked:[], score:null, left:30, t:null };

  // ---------------- helpers ----------------
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

  function zoneName(zoneId){
    const z = ZONES.find(a=>a.id===zoneId);
    return z ? z.name : (zoneId || '—');
  }

  function buildKidTip(summary){
    const top = summary?.analyze?.topRiskZone || null;
    const topName = zoneName(top);
    const miss = Number(summary?.misses||0);
    const haz  = Number(summary?.hazHits||0);

    if(miss===0 && haz===0) return 'สุดยอด! ลองเพิ่มความเร็วให้คงที่ แล้วไปโหมดยากขึ้น ✅';
    if(haz>0) return `ระวังเชื้อ 🦠 ลดให้เหลือ 0 จะได้เกรดสูงขึ้น! จุดเสี่ยง: ${topName}`;
    return `โฟกัส “${topName}” ให้แน่นขึ้น แล้วทำคอมโบให้ยาว 🔥`;
  }

  function pickStickerAndTone(summary){
    const acc = Number(summary?.stepAcc || 0);
    const miss = Number(summary?.misses || 0);
    const haz  = Number(summary?.hazHits || 0);

    if(acc >= 0.90 && haz === 0 && miss <= 1){
      return { sticker:'🌟 มือสะอาดระดับฮีโร่!', playText:'▶ เล่นอีกครั้ง (ไปเอา “SSS” กัน!)' };
    }
    if(acc >= 0.78 && haz <= 1){
      return { sticker:'🏅 เก่งมาก! ใกล้สุด ๆ', playText:'▶ เล่นอีกครั้ง (อีกนิดเดียวได้เกรดสูงขึ้น)' };
    }
    if(haz >= 2 || miss >= 3){
      return { sticker:'⚔️ ภารกิจท้าทาย! ลุยแก้จุดเสี่ยง', playText:'▶ ลองใหม่! (ล้ม 🦠 ให้เหลือ 0)' };
    }
    return { sticker:'🔥 พร้อมอัปเกรดความสะอาด!', playText:'▶ เล่นอีกครั้ง (เพิ่มคอมโบให้ยาวขึ้น)' };
  }

  // FX
  function fxHit(kind, obj){
    if(!fxOn) return;
    const P = WIN.Particles;
    if(!P || !obj) return;

    const x = Number(obj.x || WIN.innerWidth*0.5);
    const y = Number(obj.y || WIN.innerHeight*0.5);

    if(kind === 'good'){
      P.popText(x, y, '✅ +1', 'good');
      P.burst(x, y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(x, y, '⚠️ ผิด!', 'warn');
      P.burst(x, y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText(x, y, power.shield>0 ? '🛡️ กันได้!' : '🦠 โดนเชื้อ!', power.shield>0 ? 'cyan' : 'bad');
      P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
    }
  }

  // quiz
  function setQuizVisible(on){
    quizOpen = !!on;
    if(quizBox) quizBox.style.display = on ? 'block' : 'none';
  }
  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    return bank[Math.floor(rng()*bank.length)] || null;
  }
  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub) return;
    setQuizVisible(true);
    quizQ.textContent = `🧠 Quiz: ${q.q}`;

    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }
    quizSub.textContent = 'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
      + '  (ตอบโดย “ถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

    quizOpen._armed = true;
    quizOpen._t0 = nowMs();
    quizOpen._needStreak = 2;
    quizOpen._streak = 0;
  }
  function closeQuiz(msg){
    if(!quizOpen) return;
    setQuizVisible(false);
    quizOpen = false;
    quizOpen._armed = false;
    if(msg) showBanner(msg);
  }

  // metrics
  function getMissCount(){ return (wrongStepHits + hazHits); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }
  function median(arr){
    const a = (arr||[]).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = (a.length-1)/2;
    return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
  }

  // Spawn safe rect
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;

    const topSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 160;

    const hudTop = rectOf('hudTop');
    const bannerR = rectOf('banner');
    const quizR = rectOf('quizBox');

    let topSafe = topSafeVar;
    if(hudTop) topSafe = Math.max(topSafe, hudTop.r.top + hudTop.r.height + 12);
    if(bannerR) topSafe = Math.max(topSafe, bannerR.r.top + bannerR.r.height + 8);
    if(quizR && quizR.r.width>10 && quizR.r.height>10) topSafe = Math.max(topSafe, quizR.r.top + quizR.r.height + 10);

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

      let ok = true;
      for(const ot of targets){
        const dx = ot.x - x, dy = ot.y - y;
        const rr = (ot.radius||radius) + radius + 8;
        if((dx*dx + dy*dy) < rr*rr){ ok=false; break; }
      }
      if(ok) return { x,y,rect };
    }
    return { x:(rect.x0+rect.x1)/2, y:(rect.y0+rect.y1)/2, rect };
  }

  // HUD set
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

    if(pillQuest) pillQuest.textContent = `MISSION ${mission.text || 'ทำ STEP ให้ถูก!'}`;
    if(pillPower) pillPower.textContent = `POWER 🛡️${power.shield} • 🎯${(power.focusUntil>nowMs())?'ON':'OFF'} • ❄️${(power.freezeUntil>nowMs())?'ON':'OFF'}`;

    if(hudSub) hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • tgt=${targets.length}`;

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

  // target removal (fix “ตีแล้วไม่หาย”)
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
  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch{}
    }
  }

  function computeRt(obj){
    return clamp(nowMs() - obj.bornMs, 0, 60000);
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const tgtSize = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--tgtSize').replace('px','')) || 76;
    const radius = Math.max(26, (tgtSize*0.5));

    const {x,y,rect} = pickSpawnXY(radius);
    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const P = dd ? dd.getParams() : base;
    const lifeMin = (P.lifeMs && P.lifeMs[0]) ? Number(P.lifeMs[0]) : 1300;
    const lifeMax = (P.lifeMs && P.lifeMs[1]) ? Number(P.lifeMs[1]) : 2100;
    const lifeMs = clamp(lifeMin + rng()*(lifeMax-lifeMin), 900, 4000);

    const born = nowMs();
    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: born, dieAtMs: born + lifeMs, x,y, radius };
    targets.push(obj);

    if(kind==='good' && power.focusUntil > nowMs()){
      el.classList.add('is-focus');
    }

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> judgeHit(obj, 'tap', null), { passive:true });
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

  // missions
  function startMission(){
    const t = elapsedSec();
    const roll = rng();

    mission.done = 0;
    mission.meta = { pct:0 };

    if(roll < 0.34){
      mission.id = 'combo10';
      mission.text = 'ทำคอมโบถึง 10!';
      mission.meta.pct = clamp(combo / 10, 0, 1);
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

    const t = elapsedSec();
    if(!mission.id){
      if(t > 6) startMission();
      return;
    }
    if(mission.done) return;

    if(mission.id === 'combo10'){
      mission.meta.pct = clamp(combo / 10, 0, 1);
      if(combo >= 10) rewardMission();
    }else if(mission.id === 'noHaz10'){
      const until = Number(mission.meta.until||0);
      const left = clamp((until - t) / 10, 0, 1);
      mission.meta.pct = clamp(1 - left, 0, 1);
      if(t >= until) rewardMission();
    }else if(mission.id === 'fastStep'){
      if(stepIdx !== mission.meta.step){
        const dt = nowMs() - Number(mission.meta.t0||nowMs());
        mission.meta.pct = 1;
        if(dt <= 6500) rewardMission();
        else { mission.done = 1; showBanner('⏱️ พลาดภารกิจไว ลองใหม่รอบหน้า'); }
      }else{
        const dt = nowMs() - Number(mission.meta.t0||nowMs());
        mission.meta.pct = clamp(dt/6500, 0, 1);
      }
    }

    if(mission.done){
      mission._nextAt = t + (10 + rng()*8);
    }
    if(mission._nextAt && t >= mission._nextAt){
      mission.id = '';
      mission.text = '';
      mission.done = 0;
      mission._nextAt = 0;
    }
  }

  function onHazHit(){
    if(power.shield > 0){
      power.shield--;
      coachTip('โล่สบู่ช่วยกันเชื้อได้ 1 ครั้ง', 1200);
      return true;
    }
    return false;
  }

  // cVR shoot: gameplay OR end overlay
  function aimPickZone(lockPx){
    if(!handMap) return;
    const rect = handMap.getBoundingClientRect();
    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    if(cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) return;

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
      pickZone(best.dataset.zone || '');
      showBanner('🎯 เลือกจุดแล้ว!');
    }
  }

  function onShoot(e){
    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||30);

    // End overlay selection (evaluate)
    if(endOverlay && endOverlay.style.display === 'grid' && evalState.active && !evalState.confirmed){
      aimPickZone(lockPx);
      return;
    }

    // gameplay (cvr only)
    if(!running || paused) return;
    if(view !== 'cvr') return;

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

  // Evaluate/Create UI helpers
  function setZonePickedUI(zoneId){
    if(!handMap) return;
    const els = [...handMap.querySelectorAll('.hw-zone')];
    for(const el of els){
      const z = el.dataset.zone;
      el.classList.toggle('is-picked', z === zoneId);
    }
  }
  function setTopRiskPulse(topRiskId){
    if(!handMap) return;
    const els = [...handMap.querySelectorAll('.hw-zone')];
    for(const el of els){
      const z = el.dataset.zone;
      el.classList.toggle('is-risk', z === topRiskId);
    }
  }

  function pickZone(zoneId){
    evalState.pickedZone = zoneId;
    setZonePickedUI(zoneId);
    if(evalPicked) evalPicked.textContent = `เลือก: ${zoneName(zoneId)}`;
    refreshEvalConfirm();
  }
  function pickReason(reason){
    evalState.pickedReason = reason;
    if(evalReasons){
      const btns = [...evalReasons.querySelectorAll('.hw-reason')];
      for(const b of btns){
        const r = b.getAttribute('data-reason') || '';
        b.classList.toggle('is-picked', r === reason);
      }
    }
    refreshEvalConfirm();
  }
  function refreshEvalConfirm(){
    const ok = !!evalState.pickedZone && !!evalState.pickedReason && !evalState.confirmed;
    if(btnEvalConfirm) btnEvalConfirm.disabled = !ok;
  }

  function calcHeatmap2D(){
    const hm = STEPS.map((s,i)=>{
      const st = stepStats[i];
      const total = st.ok + st.wrong + st.haz;
      const risk = total ? ((st.wrong + st.haz) / total) : 0;
      const rtMed = median(st.rt);
      return {
        zoneId: s.key,
        label: s.label,
        ok: st.ok, wrong: st.wrong, haz: st.haz,
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

      btn.addEventListener('click', ()=>{
        if(view==='cvr') return;
        pickZone(z.id);
      }, { passive:true });

      handMap.appendChild(btn);
    }
  }

  // Create routine
  function toggleRoutineItem(text){
    if(!createState.active) return;

    const idx = createState.picked.indexOf(text);
    if(idx >= 0) createState.picked.splice(idx,1);
    else{
      if(createState.picked.length >= 3){ showBanner('เลือกได้สูงสุด 3 ข้อ'); return; }
      createState.picked.push(text);
    }

    if(routineOpts){
      const btns = [...routineOpts.querySelectorAll('.hw-rt')];
      for(const b of btns){
        const t = b.getAttribute('data-rt') || '';
        b.classList.toggle('is-picked', createState.picked.includes(t));
      }
    }

    if(createPicked) createPicked.textContent = `เลือกแล้ว: ${createState.picked.length}/3`;
    if(btnCreateConfirm) btnCreateConfirm.disabled = (createState.picked.length !== 3);
  }

  function scoreRoutine(picked){
    const core = ['ก่อนกินอาหาร/ขนม','หลังเข้าห้องน้ำ','หลังจับของสาธารณะ/ลูกบิด/มือถือ'];
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
    if(picked.length < 3){
      const fill = ['ก่อนกินอาหาร/ขนม','หลังเข้าห้องน้ำ','หลังจับของสาธารณะ/ลูกบิด/มือถือ','กลับถึงบ้านจากข้างนอก','หลังไอ/จาม/สั่งน้ำมูก'];
      for(const f of fill){
        if(picked.length>=3) break;
        if(!picked.includes(f)) picked.push(f);
      }
      createState.picked = picked;
      if(createPicked) createPicked.textContent = `เลือกแล้ว: ${picked.length}/3`;
      if(btnCreateConfirm) btnCreateConfirm.disabled = (picked.length !== 3);
    }

    const sc = scoreRoutine(picked);
    createState.score = sc;

    if(createScore) createScore.textContent = `คะแนน: ${sc.score}/100 (${sc.label}) • core=${sc.coreHit}/3`;
    showBanner(auto ? '⏱️ หมดเวลา! ระบบสรุป routine ให้อัตโนมัติ' : '✅ บันทึก routine แล้ว');

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

  function openCreate30s(){
    if(!createBox) return;
    createBox.style.display = 'block';

    createState.active = true;
    createState.picked = [];
    createState.score = null;
    createState.left = 30;

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
        finalizeCreate(true);
      }
    }, 1000);
  }

  // Evaluate confirm/skip
  function confirmEvaluate(){
    if(evalState.confirmed) return;
    evalState.confirmed = true;

    const picked = evalState.pickedZone;
    const top = evalState.topRiskZone;
    const match = (picked && top && picked === top);

    if(evalScore){
      evalScore.textContent = match
        ? `ผลประเมิน: ✅ เลือกถูกจุดเสี่ยงสุด (${zoneName(picked)})`
        : `ผลประเมิน: ⚠️ จุดเสี่ยงสุดอาจเป็น “${zoneName(top)}”`;
    }

    showBanner(match ? '✅ เก่งมาก! ชี้จุดเสี่ยงถูก' : '🧠 ดีมาก! ลองดูจุดที่กระพริบด้วยนะ');

    // open create
    openCreate30s();
  }

  function skipEvaluate(){
    evalState.confirmed = true;
    showBanner('ข้าม Evaluate แล้ว ไป Create ต่อ');
    openCreate30s();
  }

  function initEndFlow(){
    evalState.active = true;
    evalState.confirmed = false;
    evalState.pickedZone = null;
    evalState.pickedReason = null;

    const topRisk = endSummary?.analyze?.topRiskZone || null;
    evalState.topRiskZone = topRisk;

    if(evalHint){
      evalHint.textContent = (view==='cvr')
        ? 'โหมดแว่น: เล็งวงกลม แล้ว “ยิง” เพื่อเลือก'
        : 'แตะวงกลมเพื่อเลือก';
    }

    buildHandMapUI(endSummary?.analyze?.heatmap2d || []);
    setTopRiskPulse(topRisk);

    if(evalPicked) evalPicked.textContent = 'เลือก: —';
    if(evalScore) evalScore.textContent = 'ผลประเมิน: —';
    if(btnEvalConfirm) btnEvalConfirm.disabled = true;

    if(evalReasons){
      const btns = [...evalReasons.querySelectorAll('.hw-reason')];
      btns.forEach(b=>b.classList.remove('is-picked'));
    }

    if(createBox) createBox.style.display = 'none';
    createState.active = false;
    clearInterval(createState.t);

    showBanner('🧠 เลือก “จุดเสี่ยงสุด” แล้วเลือกเหตุผล 1 ข้อ');
  }

  // ------------- core judge -------------
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      stepStats[stepIdx].ok++;
      stepStats[stepIdx].rt.push(rt);

      if(quizOpen && quizOpen._armed){
        const within = (nowMs() - quizOpen._t0) <= 4000;
        if(within){
          quizOpen._streak++;
          if(quizOpen._streak >= (quizOpen._needStreak||2)){
            quizRight++;
            closeQuiz('✅ Quiz ผ่าน!');
          }
        }else{
          closeQuiz(null);
        }
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });
      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      fxHit('good', obj);
      removeTarget(obj);

      if(combo===6) coachTip('คอมโบสวย! อีกนิดได้ภารกิจ+พลัง', 1400);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.22) openRandomQuiz();
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

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      fxHit('wrong', obj);
      removeTarget(obj);

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      coachTip('ดู STEP ด้านบน แล้วแตะไอคอนให้ตรงนะ', 1400);

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

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo, blocked });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec(), blocked });
      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra, blocked });

      fxHit('haz', obj);
      removeTarget(obj);

      if(!blocked){
        showBanner('🦠 โดนเชื้อ! ระวัง!');
        coachTip('หลบ 🦠 ให้ดี ใช้คอมโบแลกพลังช่วยได้', 1600);
        if(getMissCount() >= missLimit) endGame('fail');
      }else{
        showBanner('🛡️ โล่สบู่กันเชื้อได้!');
      }

      setHud();
      return;
    }
  }

  // ------------- tick loop -------------
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

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    cleanupExpiredTargets();

    const P = dd ? dd.getParams() : base;
    const frozen = power.freezeUntil > t;
    const freezeMul = frozen ? 0.45 : 1.0;

    const miss = getMissCount();
    const fairnessMul = (miss>=2) ? 0.78 : 1.0;

    const mul = mobileThrottleFactor() * freezeMul * fairnessMul;
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

    if(targets.length > cap){
      const over = targets.length - cap;
      for(let k=0;k<over;k++){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });
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

  // ------------- start / reset / end -------------
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

    mission = { id:'', text:'', done:0, meta:{ pct:0 } };
    power.shield = 0;
    power.focusUntil = 0;
    power.freezeUntil = 0;

    quizRight=0; quizWrong=0;
    setQuizVisible(false);

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

    // close overlays & unlock scroll
    if(startOverlay) startOverlay.style.display = 'none';
    if(endOverlay) endOverlay.style.display = 'none';
    lockOverlay(false);

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });
    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);

    startWatchdog();
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    paused=false;
    stopWatchdog();

    clearTargets();
    setQuizVisible(false);

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
      version:'20260221k',
      game:'hygiene',
      gameMode:'hygiene',
      runMode, diff, view, seed, sessionId,
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

      quizRight, quizWrong,
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

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    // show end overlay + lock background scroll
    lockOverlay(true);
    try{ localStorage.setItem('HW_END_MODE', 'kid'); }catch(_){}

    endSummary = JSON.parse(JSON.stringify(Object.assign({ grade }, summary)));

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (พลาดครบ)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `เกรด ${grade} • ถูก ${(stepAcc*100).toFixed(0)}% • 🦠 ${hazHits} • พลาด ${getMissCount()} • loops ${loopsDone}`;

    if(endJson){
      endJson.textContent = JSON.stringify(endSummary, null, 2);
      endJson.setAttribute('hidden',''); // kid default
    }
    if(endOverlay) endOverlay.style.display = 'grid';

    // Kid cards
    try{
      if(kidGrade) kidGrade.textContent = `เกรด: ${grade}`;
      if(kidStepAcc) kidStepAcc.textContent = `ความถูกต้อง: ${(stepAcc*100).toFixed(0)}%`;
      if(kidSafe) kidSafe.textContent = `โดนเชื้อ 🦠: ${hazHits} ครั้ง`;
      if(kidMiss) kidMiss.textContent = `พลาดรวม: ${getMissCount()} ครั้ง`;
      if(kidTip) kidTip.textContent = `คำแนะนำ: ${buildKidTip(endSummary)}`;

      const st = pickStickerAndTone(endSummary);
      if(kidSticker) kidSticker.textContent = `🏅 สติ๊กเกอร์: ${st.sticker}`;
      if(btnPlayAgain) btnPlayAgain.textContent = st.playText;
    }catch{}

    initEndFlow();
  }

  function goHub(){
    try{
      if(hub) location.href = hub;
      else location.href = '../hub.html';
    }catch{}
  }

  // Details toggle (kid default hidden)
  if(btnToggleDetails && endJson){
    btnToggleDetails.addEventListener('click', ()=>{
      const shown = !endJson.hasAttribute('hidden');
      if(shown){
        endJson.setAttribute('hidden','');
        btnToggleDetails.textContent = '👩‍🏫 ดูรายละเอียดสำหรับครู/นักวิจัย';
      }else{
        endJson.removeAttribute('hidden');
        btnToggleDetails.textContent = '🙈 ซ่อนรายละเอียด';
      }
    }, { passive:true });
  }

  // Copy summary (kid first)
  btnCopyJson?.addEventListener('click', ()=>{
    const mode = (()=>{ try{ return localStorage.getItem('HW_END_MODE') || 'kid'; }catch(_){ return 'kid'; } })();
    const top = endSummary?.analyze?.topRiskZone || null;
    const topName = zoneName(top);

    const kidText =
`Hand Wash — สรุปผล (เด็กอ่านง่าย)
เกรด: ${endSummary?.grade || '—'}
ความถูกต้อง: ${Math.round((endSummary?.stepAcc||0)*100)}%
โดนเชื้อ 🦠: ${endSummary?.hazHits||0}
พลาดรวม: ${endSummary?.misses||0}
จุดเสี่ยงสุด: ${topName}
คำแนะนำ: ${buildKidTip(endSummary)}
`;

    const json = (endJson && endJson.textContent) ? endJson.textContent : JSON.stringify(endSummary||{}, null, 2);
    const payload = (String(mode).toLowerCase()==='research')
      ? (kidText + '\n---\n(Research JSON)\n' + json)
      : kidText;

    copyText(payload);
    showBanner('📋 คัดลอกสรุปแล้ว');
  }, { passive:true });

  // Start overlay exists at load -> lock background
  try{
    const so = DOC.getElementById('startOverlay');
    const eo = DOC.getElementById('endOverlay');
    const on = (so && so.style.display !== 'none') || (eo && eo.style.display !== 'none');
    lockOverlay(!!on);
  }catch{}

  // Buttons
  btnStart?.addEventListener('click', ()=>startGame(), { passive:true });
  btnPractice?.addEventListener('click', ()=>startGame(15), { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', ()=>startGame(), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // Evaluate events
  evalReasons?.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t || !t.classList.contains('hw-reason')) return;
    const r = t.getAttribute('data-reason') || '';
    if(r) pickReason(r);
  });

  btnEvalConfirm?.addEventListener('click', ()=>{
    if(btnEvalConfirm.disabled) return;
    const picked = evalState.pickedZone;
    const reason = evalState.pickedReason;
    const top = evalState.topRiskZone;
    const match = (picked && top && picked===top);

    endSummary.evaluate = {
      pickedZone: picked,
      pickedName: zoneName(picked),
      pickedReason: reason,
      topRiskZone: top,
      matchTopRisk: !!match,
      view,
      seed
    };
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    confirmEvaluate();
  }, { passive:true });

  btnEvalSkip?.addEventListener('click', ()=>{
    endSummary.evaluate = { skipped:true, view, seed };
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    skipEvaluate();
  }, { passive:true });

  // Create events
  routineOpts?.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t || !t.classList.contains('hw-rt')) return;
    const text = t.getAttribute('data-rt') || '';
    if(text) toggleRoutineItem(text);
  });

  btnCreateConfirm?.addEventListener('click', ()=>{
    if(btnCreateConfirm.disabled) return;
    finalizeCreate(false);
  }, { passive:true });

  // cVR shoot
  WIN.addEventListener('hha:shoot', onShoot);

  // Init
  setHud();
}