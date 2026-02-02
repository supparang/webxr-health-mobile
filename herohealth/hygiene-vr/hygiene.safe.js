// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Quiz Answer 1–4 + FX + SFX/VIB)
// ✅ Exports: boot()
// Emits: hha:start, hha:time, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
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

// Quiz answer tokens
const QUIZ_TOKENS = ['1️⃣','2️⃣','3️⃣','4️⃣'];

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
    return;
  }

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillQuest= DOC.getElementById('pillQuest');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');

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

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  // FX load info
  const particlesLow = !!WIN.Particles?.lowPower;

  // A) SFX/VIB toggles
  const sfxOn = (qs('sfx','1') !== '0');
  const vibOn = (qs('vib','1') !== '0');

  // Minimal kid-friendly beep SFX (no external files)
  const SFX = (() => {
    let ctx = null;
    let unlocked = false;

    function ensureCtx(){
      if(!sfxOn) return null;
      if(ctx) return ctx;
      try{
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(!AC) return null;
        ctx = new AC();
        return ctx;
      }catch{ return null; }
    }

    function unlock(){
      const c = ensureCtx();
      if(!c) return false;
      if(c.state === 'suspended'){
        c.resume().catch(()=>{});
      }
      unlocked = true;
      return true;
    }

    function beep(freq, ms, type, gain){
      const c = ensureCtx();
      if(!c || !unlocked) return;
      try{
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq || 660;
        g.gain.value = Math.max(0.0001, Math.min(0.25, Number(gain)||0.08));
        o.connect(g);
        g.connect(c.destination);
        const t0 = c.currentTime;
        o.start(t0);
        g.gain.setValueAtTime(g.gain.value, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (ms||120)/1000);
        o.stop(t0 + (ms||120)/1000 + 0.02);
      }catch{}
    }

    function good(){ beep(740, particlesLow?90:120, 'triangle', 0.08); }
    function wrong(){ beep(380, particlesLow?110:150, 'sawtooth', 0.07); }
    function haz(){ beep(220, particlesLow?140:180, 'square', 0.065); }
    function quiz(){ beep(520, 110, 'triangle', 0.06); }
    function quest(){ beep(880, 120, 'triangle', 0.07); }

    return { unlock, good, wrong, haz, quiz, quest };
  })();

  function vibrate(pattern){
    if(!vibOn) return;
    try{
      if(WIN.navigator?.vibrate) WIN.navigator.vibrate(pattern);
    }catch{}
  }

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.16 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.11, decoyRate:0.22 };
  })();

  // AI instances (optional)
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.2, 4.2], hazardRate:[0.05, 0.26], decoyRate:[0.10, 0.40] }
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
  const rtOk = []; // ms
  let spawnAcc=0;

  // quest/quiz
  let questText = 'ทำ STEP ให้ถูก!';
  let questDone = 0;

  // Quiz runtime
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;
  let quizData = null;           // {q,a,wrong[]...}
  let quizOptions = [];          // 4 strings
  let quizCorrectIdx = 0;        // 0..3
  let quizUntilMs = 0;
  let quizTargets = [];          // ids of quiz targets currently spawned

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, quizIdx?}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // --- FX helpers (FX at real target center) ---
  function getTargetCenterPx(obj){
    try{
      const r = obj?.el?.getBoundingClientRect?.();
      if(r && isFinite(r.left) && isFinite(r.top)){
        return { x: r.left + r.width/2, y: r.top + r.height/2 };
      }
    }catch{}
    return { x: WIN.innerWidth*0.5, y: WIN.innerHeight*0.5 };
  }

  // A+B) FX: colored text + colored beam when shooting + lower intensity in VR/cVR
  function fxHit(kind, obj, source){
    const P = WIN.Particles;
    if(!P) return;

    const pt = getTargetCenterPx(obj);
    const x = pt.x, y = pt.y;

    let cls = '';
    if(kind === 'good') cls = 'good';
    else if(kind === 'wrong') cls = 'warn';
    else if(kind === 'haz') cls = 'bad';
    else if(kind === 'quiz') cls = 'cyan';

    if(source === 'shoot' && typeof P.beam === 'function'){
      const cx = WIN.innerWidth*0.5;
      const cy = WIN.innerHeight*0.5;
      P.beam(cx, cy, x, y, { className: cls, thickness: P.lowPower ? 3 : 4, ms: P.lowPower ? 110 : 140 });
    }

    const low = !!P.lowPower;
    if(kind === 'good'){
      P.popText(x, y, '✅ +1', 'good');
      if(P.burst) P.burst(x, y, { count: low ? 7 : 12, spread: low ? 34 : 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(x, y, '⚠️ ผิด!', 'warn');
      if(P.burst) P.burst(x, y, { count: low ? 6 : 10, spread: low ? 30 : 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText(x, y, '🦠 โดนเชื้อ!', 'bad');
      if(P.burst) P.burst(x, y, { count: low ? 7 : 14, spread: low ? 36 : 54, upBias: 0.90 });
    }else if(kind === 'quiz'){
      P.popText(x, y, '🧠', 'cyan');
      if(P.burst) P.burst(x, y, { count: low ? 6 : 10, spread: low ? 26 : 36, upBias: 0.72 });
    }
  }

  function setQuizVisible(on){
    quizOpen = !!on;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    return bank[Math.floor(rng()*bank.length)] || null;
  }

  // --- spawn geometry ---
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 160;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h, topSafe, bottomSafe };
  }

  function getMissCount(){
    return (wrongStepHits + hazHits);
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

    pillQuest && (pillQuest.textContent = `QUEST ${questText}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • fx=${particlesLow?'low':'hi'}`);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el && t.el.remove(); }catch{}
    }
    quizTargets = [];
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el && obj.el.remove(); }catch{}
  }

  function createTarget(kind, emoji, stepRef, extra){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const rect = getSpawnRect();

    // default random position
    let x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    let y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);
    let scale = 0.90 + rng()*0.25;

    // quiz answer targets: fixed row near bottom (clear of HUD)
    if(kind === 'quiz'){
      const qi = Number(extra?.quizIdx ?? 0);
      const slots = 4;
      const rowY = rect.h - (rect.bottomSafe * 0.55); // above bottom safe
      const span = Math.max(200, rect.w * 0.70);
      const cx = rect.w * 0.5;
      const left = cx - span/2;
      const step = span/(slots-1);
      x = clamp(left + step*qi, rect.x0, rect.x1);
      y = clamp(rowY, rect.y0, rect.y1);
      scale = (particlesLow ? 1.02 : 1.08);
      el.classList.add('quiz');
    }

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (scale).toFixed(3));

    const obj = {
      id: nextId++,
      el,
      kind,
      stepIdx: stepRef,
      bornMs: nowMs(),
      quizIdx: (kind==='quiz') ? Number(extra?.quizIdx ?? -1) : undefined
    };
    targets.push(obj);

    // tap/click only when not cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
    if(quizOpen) return null; // C) during quiz, stop normal spawns

    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

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

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shoot: pick nearest target within lockPx
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      let r;
      try{ r = t.el.getBoundingClientRect(); }catch{ r=null; }
      const tx = r ? (r.left + r.width/2) : cx;
      const ty = r ? (r.top + r.height/2) : cy;

      const dx = (tx - cx), dy = (ty - cy);
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

  // ------------------ C) Quiz (answer 1–4) ------------------
  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub) return;

    quizData = q;

    // build 4 options (1 correct + 3 wrong)
    const opts = [q.a].concat((q.wrong||[]).slice(0,3));
    while(opts.length < 4) opts.push((q.wrong||[])[0] || '—');

    // shuffle but keep track correct index
    const arr = opts.slice(0,4);
    // Fisher-Yates with index tracking
    let correctIdx = 0;
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [arr[i],arr[j]] = [arr[j],arr[i]];
    }
    correctIdx = arr.findIndex(x=>x===q.a);
    if(correctIdx < 0) correctIdx = 0;

    quizOptions = arr;
    quizCorrectIdx = correctIdx;

    setQuizVisible(true);
    quizQ.textContent = `🧠 Quiz: ${q.q}`;
    quizSub.textContent =
      arr.map((x,i)=>`${i+1}) ${x}`).join('  •  ') +
      `  (ตอบให้ถูกก่อนหมดเวลา)`;

    // spawn 4 answer targets
    clearQuizTargetsOnly();
    for(let i=0;i<4;i++){
      const t = createTarget('quiz', QUIZ_TOKENS[i], -1, { quizIdx:i });
      quizTargets.push(t.id);
    }

    quizUntilMs = nowMs() + (particlesLow ? 5200 : 6500);

    SFX.quiz();
    showBanner('🧠 QUIZ มาแล้ว! เลือก 1–4');
  }

  function clearQuizTargetsOnly(){
    // remove only kind=quiz
    for(let i=targets.length-1;i>=0;i--){
      const t = targets[i];
      if(t.kind==='quiz'){
        try{ t.el && t.el.remove(); }catch{}
        targets.splice(i,1);
      }
    }
    quizTargets = [];
  }

  function closeQuiz(msg){
    if(!quizOpen) return;
    setQuizVisible(false);
    quizOpen = false;
    quizData = null;
    quizOptions = [];
    quizCorrectIdx = 0;
    quizUntilMs = 0;
    clearQuizTargetsOnly();
    if(msg) showBanner(msg);
  }

  function answerQuiz(idx, source, obj){
    if(!quizOpen) return;
    const ok = (Number(idx) === Number(quizCorrectIdx));

    if(ok){
      quizRight++;
      combo += 2; // bonus
      comboMax = Math.max(comboMax, combo);
      showBanner('✅ ตอบถูก! +คอมโบ');
      SFX.good();
      vibrate([18, 24, 18]);
      fxHit('quiz', obj, source);
      closeQuiz('✅ Quiz ผ่าน!');
    }else{
      quizWrong++;
      // penalty = 1 miss (count as wrongStepHits to keep miss logic consistent)
      wrongStepHits++;
      combo = 0;
      showBanner('❌ ตอบผิด!');
      SFX.wrong();
      vibrate([30, 40, 30]);
      fxHit('quiz', obj, source);
      closeQuiz('❌ Quiz พลาด!');
      if(getMissCount() >= missLimit) endGame('fail');
    }

    setHud();
  }

  // ------------------ Quest ------------------
  function bumpQuestOnGoodHit(){
    const t = elapsedSec();
    if(t < 2) return;

    if(!bumpQuestOnGoodHit._nextAt){
      bumpQuestOnGoodHit._nextAt = 10 + rng()*10;
      return;
    }
    if(t < bumpQuestOnGoodHit._nextAt) return;

    bumpQuestOnGoodHit._nextAt = t + (12 + rng()*10);

    const roll = rng();
    if(roll < 0.34){
      questText = 'คอมโบถึง 8!';
      questDone = (combo >= 8) ? 1 : 0;
    }else if(roll < 0.67){
      questText = 'อย่าโดน 🦠 10 วิ!';
      questDone = 0;
      bumpQuestOnGoodHit._noHazUntil = t + 10;
    }else{
      questText = 'ผ่าน STEP นี้ไว!';
      questDone = 0;
      bumpQuestOnGoodHit._fastStepT0 = nowMs();
      bumpQuestOnGoodHit._fastStepIdx = stepIdx;
    }

    SFX.quest();
    showBanner(`🎯 QUEST: ${questText}`);
  }

  function updateQuestTick(){
    const t = elapsedSec();
    if(bumpQuestOnGoodHit._noHazUntil){
      if(t >= bumpQuestOnGoodHit._noHazUntil){
        questDone = 1;
        bumpQuestOnGoodHit._noHazUntil = 0;
        showBanner('🏅 QUEST ผ่าน!');
      }
    }
  }

  // ------------------ Judge hit ------------------
  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // C) Quiz targets
    if(obj.kind === 'quiz'){
      answerQuiz(obj.quizIdx, source, obj);
      removeTarget(obj); // safe (closeQuiz will also clear)
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      bumpQuestOnGoodHit();
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      SFX.good();
      vibrate(12);
      fxHit('good', obj, source);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const prevStep = stepIdx;

        stepIdx++;
        hitsInStep=0;

        if(bumpQuestOnGoodHit._fastStepIdx === prevStep){
          const dt = nowMs() - (bumpQuestOnGoodHit._fastStepT0||nowMs());
          if(dt <= 6500){
            questDone = 1;
            showBanner('🏅 QUEST ผ่าน! (ไวมาก)');
          }
        }

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.25) openRandomQuiz();
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      SFX.wrong();
      vibrate([25, 35, 25]);
      fxHit('wrong', obj, source);

      removeTarget(obj);
      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      SFX.haz();
      vibrate([35, 45, 35, 45, 35]);
      fxHit('haz', obj, source);

      removeTarget(obj);
      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
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

    // quiz timer
    if(quizOpen && quizUntilMs && nowMs() >= quizUntilMs){
      // timeout = wrong
      quizWrong++;
      wrongStepHits++;
      combo = 0;
      closeQuiz('⌛ Quiz หมดเวลา!');
      showBanner('⌛ Quiz หมดเวลา!');
      SFX.wrong();
      vibrate([28, 38, 28]);
      if(getMissCount() >= missLimit){ endGame('fail'); return; }
    }

    // normal spawns only when no quiz
    const P = dd ? dd.getParams() : base;
    spawnAcc += (P.spawnPerSec * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      if(!quizOpen){
        spawnOne();
        // cap active targets
        const cap = particlesLow ? 14 : 18;
        if(targets.length > cap){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });
    updateQuestTick();
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

    questText = 'ทำ STEP ให้ถูก!';
    questDone = 0;

    quizRight = 0;
    quizWrong = 0;
    quizData = null;
    quizOptions = [];
    quizCorrectIdx = 0;
    quizUntilMs = 0;
    setQuizVisible(false);

    setHud();
  }

  function startGame(){
    // unlock audio on user gesture
    SFX.unlock();

    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });
    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();
    setQuizVisible(false);

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
      version:'1.0.3-prod',
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
      questText,
      questDone,

      medianStepMs: rtMed
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
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • quiz ${quizRight}/${quizRight+quizWrong}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    if(!paused) SFX.unlock();
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: badge/coach visuals
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
      WIN.Particles.burst && WIN.Particles.burst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, { count: particlesLow ? 8 : 14, spread: particlesLow ? 44 : 58, upBias: 0.9 });
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  setHud();
}