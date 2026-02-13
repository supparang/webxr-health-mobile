// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Random Quiz + FX)
// PATCH v20260211a
// ✅ FIX 1: target must disappear immediately on hit (no lingering)
// ✅ FIX 2: FX must pop at the hit target position
// ✅ FIX 3: prevent target overflow: cap + TTL + cheap cleanup (no sort in loop)
// ✅ FIX 4: mobile tap reliability: pointerdown + double-fire guard
// ✅ FIX 5: HUD-safe spawn respected via CSS vars --hw-top-safe/--hw-bottom-safe
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
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
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

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
    return;
  }

  // -------- UI handles --------
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

  const isTouch = (('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0);

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

  // -------- State --------
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
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, dead}
  let nextId=1;

  // perf/limits
  const LIMIT = {
    maxTargets: 18,       // hard cap
    ttlMs: 1650,          // target lifetime (auto disappear)
    cleanupEveryMs: 260,  // cleanup interval
    spawnClampHi: 6.0     // prevent insane spawnPerSec
  };

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1100);
  }

  // ✅ FX on hit (particles.js)
  function fxHit(kind, obj){
    const P = WIN.Particles;
    if(!P || !obj) return;

    // obj.x/y already viewport px (fixed position targets)
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
    // ✅ hygiene-quiz-bank.js must define window.HHA_HYGIENE_QUIZ_BANK
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    const q = bank[Math.floor(rng()*bank.length)];
    return q || null;
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

    quizSub.textContent =
      'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
      + '  (ตอบโดย “ถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

    // store quiz state in function object (safe)
    openRandomQuiz._armed = true;
    openRandomQuiz._t0 = nowMs();
    openRandomQuiz._needStreak = 2;
    openRandomQuiz._streak = 0;
    openRandomQuiz._ans = q.a;
  }

  function closeQuiz(msg){
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      openRandomQuiz._armed = false;
      if(msg) showBanner(msg);
    }
  }

  function getSpawnRect(){
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const cs = getComputedStyle(DOC.documentElement);

    const topSafe = Number(cs.getPropertyValue('--hw-top-safe')) || 170;
    const bottomSafe = Number(cs.getPropertyValue('--hw-bottom-safe')) || 190;

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    // guard if weird CSS => keep playable area
    return {
      x0: clamp(x0, 0, w-1),
      x1: clamp(x1, 1, w),
      y0: clamp(y0, 0, h-1),
      y1: clamp(y1, 1, h),
      w, h
    };
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
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el && t.el.remove(); }catch{}
    }
  }

  // ✅ remove instantly + mark dead (prevents double judge)
  function killTarget(obj){
    if(!obj || obj.dead) return;
    obj.dead = true;
    const el = obj.el;
    if(el){
      try{ el.classList.add('is-dead'); }catch{}
      try{ el.remove(); }catch{}
    }
    obj.el = null;
  }

  function removeTarget(obj){
    if(!obj) return;
    killTarget(obj);
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
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

    // store as viewport px (matches fixed positioning)
    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, dead:false };
    targets.push(obj);

    // ✅ input reliability: pointerdown (and prevent double fire)
    // cVR strict uses hha:shoot, so disable pointer events binding there
    if(view !== 'cvr'){
      const onDown = (ev)=>{
        if(!running || paused || obj.dead) return;
        // guard: prevent click after pointerdown (mobile)
        if(ev && ev.cancelable) { try{ ev.preventDefault(); }catch{} }
        judgeHit(obj, 'tap', null);
      };

      // pointerdown is best; fallback to click
      el.addEventListener('pointerdown', onDown, { passive:false });
      el.addEventListener('click', (ev)=>{
        // if pointerdown already fired, ignore
        if(obj.dead) return;
        onDown(ev);
      }, { passive:false });
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

  // cVR shoot: pick nearest target within lockPx
  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = (WIN.innerWidth||0)/2;
    const cy = (WIN.innerHeight||0)/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      if(!t || t.dead) continue;
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
    if(!obj || obj.dead) return;

    // ✅ kill immediately first (so no lingering / no double-hit)
    // but keep x/y for FX: already stored on obj
    const rt = computeRt(obj);
    const kind = obj.kind;

    // remove from UI instantly
    removeTarget(obj);

    if(kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // quiz logic: confirm by 2 consecutive "good hits" within 4s
      if(quizOpen && openRandomQuiz._armed){
        const within = (nowMs() - (openRandomQuiz._t0||0)) <= 4000;
        if(within){
          openRandomQuiz._streak = (openRandomQuiz._streak||0) + 1;
          if(openRandomQuiz._streak >= (openRandomQuiz._needStreak||2)){
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

      bumpQuestOnGoodHit();
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
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
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.25) openRandomQuiz();
        }
      }

      setHud();
      return;
    }

    if(kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      if(quizOpen && openRandomQuiz._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      fxHit('wrong', obj);

      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(kind === 'haz'){
      hazHits++;
      combo = 0;

      if(quizOpen && openRandomQuiz._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      fxHit('haz', obj);

      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
    }
  }

  // -------- Cleanup (cheap, no sort) --------
  let lastCleanupMs = 0;
  function cleanupTargets(now){
    if(now - lastCleanupMs < LIMIT.cleanupEveryMs) return;
    lastCleanupMs = now;

    // TTL cleanup + hard cap cleanup (remove oldest by scan)
    let oldestIdx = -1;
    let oldestBorn = 1e18;

    for(let i=targets.length-1;i>=0;i--){
      const t = targets[i];
      if(!t || t.dead){ targets.splice(i,1); continue; }

      // TTL
      if((now - t.bornMs) > LIMIT.ttlMs){
        killTarget(t);
        targets.splice(i,1);
        continue;
      }

      // track oldest
      if(t.bornMs < oldestBorn){
        oldestBorn = t.bornMs;
        oldestIdx = i;
      }
    }

    // hard cap
    while(targets.length > LIMIT.maxTargets){
      // remove oldest known; if missing, pop
      if(oldestIdx >= 0 && targets[oldestIdx]){
        const t = targets[oldestIdx];
        killTarget(t);
        targets.splice(oldestIdx,1);
      }else{
        const t = targets.shift();
        if(t) killTarget(t);
      }
      // recompute oldest cheaply once
      oldestIdx = -1; oldestBorn = 1e18;
      for(let i=0;i<targets.length;i++){
        const t = targets[i];
        if(t && !t.dead && t.bornMs < oldestBorn){
          oldestBorn = t.bornMs; oldestIdx = i;
        }
      }
    }
  }

  // -------- Main loop --------
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

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // cap spawn speed (avoid runaway if AI returns crazy)
    const P0 = dd ? dd.getParams() : base;
    const P = {
      spawnPerSec: clamp(P0.spawnPerSec, 0.8, LIMIT.spawnClampHi),
      hazardRate: clamp(P0.hazardRate, 0.02, 0.35),
      decoyRate: clamp(P0.decoyRate, 0.05, 0.55),
    };

    spawnAcc += (P.spawnPerSec * dt);

    // spawn bounded
    let loops = 0;
    while(spawnAcc >= 1 && loops < 5){
      spawnAcc -= 1;
      spawnOne();
      loops++;
    }

    cleanupTargets(t);

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
    setQuizVisible(false);

    openRandomQuiz._armed = false;
    openRandomQuiz._streak = 0;

    setHud();
  }

  function startGame(){
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
      version:'1.0.2-prod',
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

      medianStepMs: rtMed,
      isTouch
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
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // -------- UI binds --------
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

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: badge/coach visuals
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      const x = (WIN.innerWidth||0)*0.5;
      const y = (WIN.innerHeight||0)*0.22;
      WIN.Particles.popText(x, y, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
      WIN.Particles.burst(x, y, { count: 14, spread: 58, upBias: 0.9 });
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // initial
  setHud();
}