// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Quiz 1-4 + FX + Boss + Streak)
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

function centerOfEl(el){
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
  }catch{
    return { x: WIN.innerWidth*0.5, y: WIN.innerHeight*0.5, w: 0, h: 0 };
  }
}

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
  const optEls = [
    DOC.getElementById('opt1'),
    DOC.getElementById('opt2'),
    DOC.getElementById('opt3'),
    DOC.getElementById('opt4'),
  ];
  const optBtns = [...DOC.querySelectorAll('[data-quizopt]')];

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

  // quest
  let questText = 'ทำ STEP ให้ถูก!';
  let questDone = 0;

  // slow-mo FX factor (gameplay feel)
  let slowmoUntil = 0;   // ms timestamp
  let slowmoK = 1.0;     // 1 normal, <1 slower spawns

  // ------------------ NEW: Shield + Streak ------------------
  // Quiz Boss: correct streak >= 3 => gain 1 shield (caps)
  let shield = 0;               // charges
  let shieldGained = 0;
  let shieldUsed = 0;

  // Perfect step: complete step without mistakes (wrong/haz that counts) => +2s + streak
  let stepMistThis = 0;         // wrongStep hits this step
  let stepHazThis = 0;          // haz hits this step (not blocked)
  let perfectStepStreak = 0;
  let perfectStepStreakMax = 0;
  let perfectStepsTotal = 0;

  // quiz state
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;
  let quizObj = null;          // current quiz object
  let quizCorrectIdx = -1;     // 0..3
  let quizOptions = [];        // 4 strings

  // quiz boss streak
  let quizCorrectStreak = 0;
  let quizCorrectStreakMax = 0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // ✅ FX on hit — always center of the real target element
  function fxHit(kind, obj){
    const P = WIN.Particles;
    if(!P || !obj || !obj.el) return;
    const c = centerOfEl(obj.el);

    if(kind === 'good'){
      P.popText(c.x, c.y, '✅ +1', 'good');
      P.burst(c.x, c.y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(c.x, c.y, '⚠️ ผิด!', 'warn');
      P.burst(c.x, c.y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText(c.x, c.y, '🦠 โดนเชื้อ!', 'bad');
      P.burst(c.x, c.y, { count: 14, spread: 54, upBias: 0.90 });
    }else if(kind === 'shield'){
      P.popText(c.x, c.y, '🛡 กันไว้!', 'cyan');
      P.burst(c.x, c.y, { count: 18, spread: 74, upBias: 0.95 });
    }
  }

  function fxComboMilestone(){
    const P = WIN.Particles;
    if(!P) return;
    if(combo > 0 && combo % 5 === 0){
      const x = WIN.innerWidth*0.5;
      const y = Math.max(80, WIN.innerHeight*0.24);
      P.popText(x, y, `🔥 COMBO ${combo}!`, 'cyan');
      P.burst(x, y, { count: 16, spread: 72, upBias: 0.92 });
      showBanner(`🔥 คอมโบ ${combo}!`);
    }
  }

  function fxConfettiCenter(title){
    const P = WIN.Particles;
    if(!P) return;
    const x = WIN.innerWidth*0.5;
    const y = Math.max(96, WIN.innerHeight*0.22);
    P.popText(x, y, title || '🎉 7 STEPS CLEAR!', 'good');
    for(let i=0;i<5;i++){
      const dx = (rng()*2-1) * 120;
      const dy = (rng()*2-1) * 40;
      P.burst(x + dx, y + dy, { count: 18, spread: 90, upBias: 0.95 });
    }
  }

  function fxPerfectStep(){
    const P = WIN.Particles;
    if(!P) return;
    const x = WIN.innerWidth*0.5;
    const y = Math.max(96, WIN.innerHeight*0.26);
    P.popText(x, y, `✨ PERFECT STEP! (+2s)`, 'good');
    P.burst(x, y, { count: 18, spread: 84, upBias: 0.95 });
  }

  function fxShieldGain(){
    const P = WIN.Particles;
    if(!P) return;
    const x = WIN.innerWidth*0.5;
    const y = Math.max(96, WIN.innerHeight*0.22);
    P.popText(x, y, `🛡 SHIELD +1`, 'cyan');
    P.burst(x, y, { count: 22, spread: 96, upBias: 0.95 });
  }

  function setQuizVisible(on){
    quizOpen = !!on;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
    if(on){
      optBtns.forEach(b=>{ b.classList.remove('correct','wrong'); b.disabled = false; });
    }else{
      optBtns.forEach(b=>{ b.classList.remove('correct','wrong'); b.disabled = true; });
    }
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    return bank[Math.floor(rng()*bank.length)] || null;
  }

  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub || !optEls.length) return;

    quizObj = q;
    quizQ.textContent = `🧠 Quiz: ${q.q}`;
    quizSub.textContent = 'เลือกคำตอบให้ถูก (1–4)';

    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }
    quizOptions = options.slice(0,4);
    quizCorrectIdx = quizOptions.findIndex(x=>x===q.a);

    for(let i=0;i<4;i++){
      if(optEls[i]) optEls[i].textContent = quizOptions[i] ?? '—';
    }

    setQuizVisible(true);

    // focus mode: slow spawns a bit
    slowmoUntil = Math.max(slowmoUntil, nowMs() + 1200);
    slowmoK = Math.min(slowmoK, 0.72);

    showBanner(`🧠 Quiz มาแล้ว! (Boss streak: ${quizCorrectStreak}/3)`);
  }

  function closeQuiz(msg){
    if(!quizOpen) return;
    setQuizVisible(false);
    quizObj = null;
    quizCorrectIdx = -1;
    quizOptions = [];
    if(msg) showBanner(msg);
  }

  // ------------------ NEW: Quiz Boss (streak -> shield) ------------------
  function maybeGrantShieldFromQuizBoss(){
    // award when reaching 3 streak, caps at 1 (simple for kids)
    if(quizCorrectStreak >= 3 && shield < 1){
      shield = 1;
      shieldGained++;
      fxShieldGain();
      showBanner('🛡 ได้โล่! กัน 🦠 ได้ 1 ครั้ง (ไม่เสีย MISS)');
      // keep streak (so it shows mastery), but prevent repeated grants by cap
    }
  }

  function judgeQuizPick(idx){
    if(!quizOpen) return;

    // lock fast to prevent double
    optBtns.forEach(b=>{ b.disabled = true; });

    const P = WIN.Particles;
    const x = WIN.innerWidth*0.5;
    const y = Math.max(96, WIN.innerHeight*0.28);

    if(idx === quizCorrectIdx){
      quizRight++;
      quizCorrectStreak++;
      quizCorrectStreakMax = Math.max(quizCorrectStreakMax, quizCorrectStreak);
      optBtns[idx]?.classList.add('correct');
      P?.popText(x, y, '✅ ถูกต้อง!', 'good');
      P?.burst(x, y, { count: 18, spread: 84, upBias: 0.95 });

      // reward: time bonus
      timeLeft = Math.min(timePlannedSec, timeLeft + 3);
      questDone = 1;

      maybeGrantShieldFromQuizBoss();

      setTimeout(()=>closeQuiz(`✅ Quiz ผ่าน! +3s (streak ${quizCorrectStreak}/3)`), 520);
    }else{
      quizWrong++;
      quizCorrectStreak = 0; // boss reset on wrong
      optBtns[idx]?.classList.add('wrong');
      optBtns[quizCorrectIdx]?.classList.add('correct');
      P?.popText(x, y, '❌ ยังไม่ถูก', 'bad');
      P?.burst(x, y, { count: 16, spread: 76, upBias: 0.92 });

      // penalty: counts as wrong-step miss (kid-friendly, still respects missLimit)
      wrongStepHits++;
      stepMistThis++;
      combo = 0;

      setTimeout(()=>closeQuiz('❌ Quiz พลาด! (streak reset)'), 650);

      if(getMissCount() >= missLimit) endGame('fail');
    }
    setHud();
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 170;
    const bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
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

    // ✅ show shield & perfect step streak in quest pill (no HTML changes needed)
    const shieldTxt = shield > 0 ? ` • 🛡${shield}` : '';
    const psTxt = perfectStepStreak > 0 ? ` • ✨${perfectStepStreak}` : '';
    pillQuest && (pillQuest.textContent = `QUEST ${questText}${shieldTxt}${psTxt}`);

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);
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

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs() };
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

  // ✅ cVR shoot: (1) quiz pick by elementFromPoint (2) else nearest target by centers
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    if(quizOpen){
      const el = DOC.elementFromPoint(cx, cy);
      const btn = el && (el.closest ? el.closest('[data-quizopt]') : null);
      if(btn){
        const n = Number(btn.getAttribute('data-quizopt'))||0;
        if(n>=1 && n<=4){
          judgeQuizPick(n-1);
          return;
        }
      }
    }

    let best=null, bestDist=1e9;
    for(const t of targets){
      if(!t.el) continue;
      const c = centerOfEl(t.el);
      const dx = (c.x - cx), dy = (c.y - cy);
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

  function applySlowmoTick(){
    const t = nowMs();
    if(t < slowmoUntil){
      slowmoK = Math.max(0.55, slowmoK - 0.02);
      return;
    }
    slowmoK = Math.min(1.0, slowmoK + 0.03);
  }

  function onStepStart(){
    stepMistThis = 0;
    stepHazThis = 0;
  }

  function onStepCompleted(prevStepIdx){
    // ✅ Perfect Step Streak reward
    if(stepMistThis === 0 && stepHazThis === 0){
      perfectStepsTotal++;
      perfectStepStreak++;
      perfectStepStreakMax = Math.max(perfectStepStreakMax, perfectStepStreak);

      // reward: +2s and tiny slowmo pop
      timeLeft = Math.min(timePlannedSec, timeLeft + 2);
      slowmoUntil = Math.max(slowmoUntil, nowMs() + 600);
      slowmoK = Math.min(slowmoK, 0.78);

      fxPerfectStep();
      showBanner(`✨ PERFECT STEP! สตรีค ${perfectStepStreak} (+2s)`);
    }else{
      // break streak
      perfectStepStreak = 0;
    }

    // reset counters for next step
    onStepStart();

    // quest fast-step check (kept)
    if(bumpQuestOnGoodHit._fastStepIdx === prevStepIdx){
      const dt = nowMs() - (bumpQuestOnGoodHit._fastStepT0||nowMs());
      if(dt <= 6500){
        questDone = 1;
        showBanner('🏅 QUEST ผ่าน! (ไวมาก)');
      }
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

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
      fxHit('good', obj);
      fxComboMilestone();

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const prevStep = stepIdx;

        stepIdx++;
        hitsInStep=0;

        // ✅ evaluate perfect step for the step we just finished
        onStepCompleted(prevStep);

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;

          // BIG MOMENT: slowmo + confetti
          slowmoUntil = nowMs() + 900;
          slowmoK = Math.min(slowmoK, 0.70);
          fxConfettiCenter(`🎉 ครบ 7 ขั้น! (loops ${loopsDone})`);
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.28) openRandomQuiz();
        }
      }else{
        showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      stepMistThis++;
      totalStepHits++;
      combo = 0;

      // wrong resets quiz boss streak (but only if quiz open? keep simple: wrong gameplay doesn't reset quiz streak)
      // (we leave quizCorrectStreak unchanged here)

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      fxHit('wrong', obj);

      removeTarget(obj);
      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      // ✅ Shield blocks haz and does NOT count as miss
      if(shield > 0){
        shield--;
        shieldUsed++;
        combo = 0;

        showBanner('🛡 โล่กันเชื้อ! (ไม่เสีย MISS)');
        fxHit('shield', obj);

        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      stepHazThis++;
      combo = 0;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner('🦠 โดนเชื้อ! ระวัง!');
      fxHit('haz', obj);

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

    applySlowmoTick();

    const P0 = dd ? dd.getParams() : base;

    // when quiz open: reduce spawn slightly
    const quizK = quizOpen ? 0.80 : 1.0;

    spawnAcc += (P0.spawnPerSec * dt * slowmoK * quizK);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
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

    // quiz
    quizRight = 0;
    quizWrong = 0;
    quizCorrectStreak = 0;
    quizCorrectStreakMax = 0;
    closeQuiz(null);

    // shield + streak
    shield = 0;
    shieldGained = 0;
    shieldUsed = 0;

    stepMistThis = 0;
    stepHazThis = 0;
    perfectStepStreak = 0;
    perfectStepStreakMax = 0;
    perfectStepsTotal = 0;

    slowmoUntil = 0;
    slowmoK = 1.0;

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    onStepStart();

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });
    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();
    closeQuiz(null);

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
      version:'1.0.4-prod',
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
      quizCorrectStreakMax,

      // new
      shieldGained,
      shieldUsed,
      perfectStepsTotal,
      perfectStepStreakMax,

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
    if(endSub) endSub.textContent =
      `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • 🛡${shieldGained}/${shieldUsed} • ✨max ${perfectStepStreakMax} • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
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
  }, { passive:true });

  // quiz buttons
  optBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(!quizOpen) return;
      const n = Number(btn.getAttribute('data-quizopt'))||0;
      if(n>=1 && n<=4) judgeQuizPick(n-1);
    }, { passive:true });
  });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: badge/coach visuals
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
      WIN.Particles.burst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, { count: 14, spread: 58, upBias: 0.9 });
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // initial
  setQuizVisible(false);
  setHud();
}