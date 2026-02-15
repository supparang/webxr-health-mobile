// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Random Quiz + FX)
// PATCH v20260215b
// ✅ FIX: target must disappear immediately on hit (hard hide + remove)
// ✅ FIX: mobile tap reliability (pointerdown + double-hit guard)
// ✅ FIX: prevent target overflow without sort (O(n) oldest scan)
// ✅ ADD: Practice 15s (no haz, no miss, auto into real game)
// Exports: boot()
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
  const pillPractice = DOC.getElementById('pillPractice');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');

  const startOverlay = DOC.getElementById('startOverlay');
  const practiceOverlay = DOC.getElementById('practiceOverlay');
  const practiceCounter = DOC.getElementById('practiceCounter');

  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart   = DOC.getElementById('btnStart');
  const btnPractice = DOC.getElementById('btnPractice');
  const btnPracticeGo = DOC.getElementById('btnPracticeGo');
  const btnPracticeSkip = DOC.getElementById('btnPracticeSkip');
  const btnPracticeCancel = DOC.getElementById('btnPracticeCancel');

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
  let isPractice=false;
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
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // practice
  const PRACTICE_SEC = 15;
  let practiceLeft = PRACTICE_SEC;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, _hit?}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // ✅ FX on hit (particles.js)
  function fxHit(kind, obj){
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
      P.popText(x, y, '🦠 โดนเชื้อ!', 'bad');
      P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
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
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      quizOpen._armed = false;
      if(msg) showBanner(msg);
    }
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 160;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    return isPractice ? 0 : (wrongStepHits + hazHits);
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    if(pillPractice){
      pillPractice.style.display = isPractice ? 'inline-flex' : 'none';
    }

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = isPractice
      ? `PRACTICE • focus STEP ${(stepIdx+1)}/7`
      : `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`
    );

    const tShow = isPractice ? practiceLeft : Math.max(0, Math.ceil(timeLeft));
    pillTime && (pillTime.textContent = `TIME ${tShow}`);

    pillQuest && (pillQuest.textContent = `QUEST ${questText}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}${isPractice?' • PRACTICE':''}`);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el && (t.el.style.display='none'); }catch{}
      t.el?.remove();
    }
  }

  function hardKillTarget(obj){
    if(!obj || !obj.el) return;
    try{
      obj._hit = true;
      obj.el.style.pointerEvents = 'none';
      obj.el.style.opacity = '0';
      obj.el.style.transform = 'translate(-50%,-50%) scale(0.70)';
      obj.el.style.display = 'none'; // ✅ หายทันที (แก้อาการค้าง)
    }catch{}
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ hardKillTarget(obj); }catch{}
    try{ obj.el?.remove(); }catch{}
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

    // vw/vh percent
    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, _hit:false };
    targets.push(obj);

    // ✅ Mobile reliability: pointerdown (not click) + guard double-hit
    if(view !== 'cvr'){
      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault?.();
        onHitByPointer(obj, 'tap');
      }, { passive:false });
    }
    return obj;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

    // ✅ practice: no haz
    const hazardRate = isPractice ? 0 : P.hazardRate;
    const decoyRate  = P.decoyRate;

    const r = rng();
    if(r < hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < hazardRate + decoyRate){
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
    if(!obj || obj._hit) return;
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
      if(t._hit) continue;
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

  function judgeHit(obj, source, extra){
    if(!obj || obj._hit) return;
    obj._hit = true;

    // ✅ hide instantly (even before logic)
    hardKillTarget(obj);

    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

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

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, practice:isPractice });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec(), practice:isPractice });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra, practice:isPractice });

      bumpQuestOnGoodHit();
      fxHit('good', obj);

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
          if(!quizOpen && !isPractice) openRandomQuiz();
        }else{
          if(!quizOpen && !isPractice && rng() < 0.25) openRandomQuiz();
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      if(!isPractice){
        wrongStepHits++;
      }
      totalStepHits++;
      combo = 0;

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo, practice:isPractice });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec(), practice:isPractice });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra, practice:isPractice });

      fxHit('wrong', obj);

      removeTarget(obj);
      if(!isPractice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      if(!isPractice){
        hazHits++;
      }
      combo = 0;

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo, practice:isPractice });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec(), practice:isPractice });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra, practice:isPractice });

      fxHit('haz', obj);

      removeTarget(obj);
      if(!isPractice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }
  }

  // ✅ oldest scan without sort
  function dropOldestIfNeeded(maxN){
    const n = targets.length|0;
    if(n <= maxN) return;
    let bestIdx = -1;
    let bestBorn = 1e18;
    for(let i=0;i<n;i++){
      const t = targets[i];
      if(!t || t._hit) continue;
      if(t.bornMs < bestBorn){
        bestBorn = t.bornMs;
        bestIdx = i;
      }
    }
    if(bestIdx >= 0){
      const t = targets[bestIdx];
      removeTarget(t);
    }else{
      // fallback: pop something
      const t = targets[0];
      if(t) removeTarget(t);
    }
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    if(isPractice){
      practiceLeft -= dt;
      if(practiceCounter) practiceCounter.textContent = String(Math.max(0, Math.ceil(practiceLeft)));

      if(practiceLeft <= 0){
        // auto into real game
        endPracticeAndStartReal();
        return;
      }
    }else{
      timeLeft -= dt;
      emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });
      if(timeLeft <= 0){
        endGame('time');
        return;
      }
    }

    const P = dd ? dd.getParams() : base;
    const spawnRate = isPractice ? Math.max(1.9, P.spawnPerSec) : P.spawnPerSec;
    spawnAcc += (spawnRate * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      dropOldestIfNeeded(isPractice ? 14 : 18);
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec(), practice:isPractice });
    if(!isPractice) updateQuestTick();
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
    setQuizVisible(false);

    isPractice = false;
    practiceLeft = PRACTICE_SEC;

    setHud();
  }

  function startGameReal(){
    resetGame();
    running=true;
    isPractice=false;

    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    practiceOverlay && (practiceOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });
    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function startPracticeUI(){
    // show practice overlay first (no running yet)
    practiceLeft = PRACTICE_SEC;
    if(practiceCounter) practiceCounter.textContent = String(PRACTICE_SEC);
    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');
    practiceOverlay && (practiceOverlay.style.display = 'grid');
    showBanner('🧪 เปิดโหมด Practice');
    setHud();
  }

  function startPracticeRun(){
    resetGame();
    running=true;
    isPractice=true;

    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    practiceOverlay && (practiceOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    showBanner('🧪 Practice เริ่ม! (ไม่มี 🦠 / ไม่คิด MISS)');
    setHud();
    requestAnimationFrame(tick);
  }

  function endPracticeAndStartReal(){
    // stop practice quickly and start real
    running=false;
    clearTargets();
    isPractice=false;
    practiceLeft = PRACTICE_SEC;
    showBanner('✅ Practice จบ → เข้าเกมจริง!');
    // slight delay so banner/cleanup feel smooth
    setTimeout(()=>startGameReal(), 220);
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
      misses: (wrongStepHits + hazHits),

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
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${(wrongStepHits+hazHits)} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // UI binds
  btnStart?.addEventListener('click', startGameReal, { passive:true });
  btnPractice?.addEventListener('click', startPracticeUI, { passive:true });
  btnPracticeGo?.addEventListener('click', startPracticeRun, { passive:true });
  btnPracticeSkip?.addEventListener('click', ()=>{ practiceOverlay && (practiceOverlay.style.display='none'); startGameReal(); }, { passive:true });
  btnPracticeCancel?.addEventListener('click', ()=>{ practiceOverlay && (practiceOverlay.style.display='none'); startOverlay && (startOverlay.style.display='grid'); }, { passive:true });

  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); startOverlay && (startOverlay.style.display='grid'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGameReal, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

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
  setHud();
}