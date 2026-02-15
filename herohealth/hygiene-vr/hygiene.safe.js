// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Quest + Random Quiz + FX)
// PATCH v20260215a
// ✅ FIX: target must disappear immediately on hit (no lingering) + mobile pointerdown
// ✅ FIX: FX pops at hit target position (viewport px)
// ✅ FIX: TTL + cleanup + cap (no heavy sort every frame)
// ✅ FIX: anti-stall watchdog (auto pause + banner)
// ✅ FIX: HUD-safe spawn + keep-out band
// ✅ ADD: logging hooks (events) + flush-hardened stubs
// ✅ ADD: AI prediction stub (deterministic heuristic + optional external hook)
//
// Exports: boot()
// Emits: hha:start, hha:time, hha:judge, hha:end, hha:event
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

function safeInt(n, fb=0){ n = Number(n); return Number.isFinite(n) ? (n|0) : fb; }

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
  const runMode = (qs('run','play')||'play').toLowerCase();        // play | study | research | practice
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');
  const logOn = (qs('log','1') !== '0');                           // logging hook on by default

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.16 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.11, decoyRate:0.22 };
  })();

  // AI instances (optional) — disabled in research/study/practice by default
  const isResearchLike = (runMode === 'research' || runMode === 'study' || runMode === 'practice');
  const coachOn = (!isResearchLike) && (qs('coach','1') !== '0');
  const ddOn    = (!isResearchLike) && (qs('dd','1') !== '0');

  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.2, 4.2], hazardRate:[0.05, 0.26], decoyRate:[0.10, 0.40] }
  }) : null;

  // -------- logging hook (works even before Apps Script is plugged) ----------
  const session = {
    sid: `HW-${Date.now()}-${Math.floor(rng()*1e6)}`,
    t0: 0,
    events: []
  };

  function logEvent(type, data){
    if(!logOn) return;
    const ev = { t: Math.max(0, (nowMs() - (session.t0||nowMs()))), type, ...data };
    session.events.push(ev);
    emit('hha:event', ev);
    try{
      // optional external logger
      WIN.HHA_LOGGER?.logEvent?.('hygiene', session.sid, ev);
    }catch{}
  }
  function flushEvents(summary){
    if(!logOn) return;
    try{ WIN.HHA_LOGGER?.flush?.('hygiene', session.sid, session.events, summary); }catch{}
    // always keep a local copy for debugging/recovery
    try{ saveJson(`HHA_EVENTS_${session.sid}`, session.events.slice(-1500)); }catch{}
  }

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
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // active targets
  // {id, el, kind, stepIdx, bornMs, x,y, lifeMs, hit}
  const targets = [];
  let nextId=1;

  // watchdog
  let lastTickMs = nowMs();
  let watchdogId = 0;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function setQuizVisible(on){
    quizOpen = !!on;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
  }

  // ✅ FX on hit (particles.js)
  function fxHit(kind, obj){
    const P = WIN.Particles;
    if(!P || !obj) return;

    const x = Number(obj.x || WIN.innerWidth*0.5);
    const y = Number(obj.y || WIN.innerHeight*0.5);

    if(kind === 'good'){
      P.popText?.(x, y, '✅ +1', 'good');
      P.burst?.(x, y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText?.(x, y, '⚠️ ผิด!', 'warn');
      P.burst?.(x, y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText?.(x, y, '🦠 โดนเชื้อ!', 'bad');
      P.burst?.(x, y, { count: 14, spread: 54, upBias: 0.90 });
    }
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

    quizSub.textContent =
      'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
      + '  (ตอบโดย “ถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

    quizOpen._armed = true;
    quizOpen._t0 = nowMs();
    quizOpen._needStreak = 2;
    quizOpen._streak = 0;

    logEvent('quiz_open', { qTag: q.tag || '', q: q.q });
  }

  function closeQuiz(msg){
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      quizOpen._armed = false;
      if(msg) showBanner(msg);
      logEvent('quiz_close', { ok: String(msg||'').includes('✅') });
    }
  }

  // ---------- HUD-safe spawn ----------
  function getSpawnRect(){
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);

    const cs = getComputedStyle(DOC.documentElement);
    const topSafe = Number(cs.getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafe = Number(cs.getPropertyValue('--hw-bottom-safe')) || 160;

    // keep-out band to avoid HUD overlap even when HUD expands
    const keepOutTop = topSafe + 22;
    const keepOutBottom = bottomSafe + 16;

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = Math.min(h - pad, keepOutTop + pad);
    const y1 = Math.max(y0 + 10, h - keepOutBottom - pad);

    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){ return (wrongStepHits + hazHits); }

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
      try{ t.el?.remove(); }catch{}
    }
  }

  function removeTarget(obj){
    if(!obj) return;
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el?.remove(); }catch{}
  }

  // ✅ critical fix: mark hit + remove immediately (prevents lingering)
  function markHitAndRemove(obj){
    if(!obj || obj.hit) return;
    obj.hit = true;
    try{
      if(obj.el){
        obj.el.classList.add('is-hit');
        obj.el.disabled = true;
      }
    }catch{}
    // remove ASAP (next microtask-ish)
    setTimeout(()=>removeTarget(obj), 0);
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const rect = getSpawnRect();
    // ensure space exists (if HUD consumes too much)
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    // TTL (ms) — prevents overflow even if player stops hitting
    const lifeMs = (kind === 'haz')
      ? 2600
      : (kind === 'wrong')
        ? 2900
        : 3200;

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, lifeMs, hit:false };
    targets.push(obj);

    // Mobile/PC: pointerdown is more reliable than click
    if(view !== 'cvr'){
      const onDown = (ev)=>{
        try{ ev.preventDefault?.(); }catch{}
        onHitByPointer(obj, 'pointerdown');
      };
      el.addEventListener('pointerdown', onDown, { passive:false });
      // fallback click (desktop)
      el.addEventListener('click', ()=>onHitByPointer(obj, 'click'), { passive:true });
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
    if(!obj || obj.hit) return;
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
      if(!t || t.hit) continue;
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

  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

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
    logEvent('quest_new', { questText });
  }

  function updateQuestTick(){
    const t = elapsedSec();
    if(bumpQuestOnGoodHit._noHazUntil){
      if(t >= bumpQuestOnGoodHit._noHazUntil){
        questDone = 1;
        bumpQuestOnGoodHit._noHazUntil = 0;
        showBanner('🏅 QUEST ผ่าน!');
        logEvent('quest_done', { questText });
      }
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // IMPORTANT: remove immediately so it never lingers
    markHitAndRemove(obj);

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
            logEvent('quiz_answer', { ok:true, rtMs: rt });
          }
        }else{
          closeQuiz(null);
        }
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      logEvent('hit', { kind:'good', stepIdx, rtMs: rt, source });

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
            logEvent('quest_done', { questText, fast:true });
          }
        }

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          logEvent('loop_done', { loopsDone });
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.25) openRandomQuiz();
        }
      }else{
        showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      }

      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
        logEvent('quiz_answer', { ok:false, rtMs: rt });
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      logEvent('hit', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      fxHit('wrong', obj);

      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
        logEvent('quiz_answer', { ok:false, rtMs: rt, haz:true });
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      logEvent('hit', { kind:'haz', stepIdx, rtMs: rt, source });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      fxHit('haz', obj);

      if(getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }
  }

  // TTL cleanup (no sort)
  function cleanupExpired(){
    const t = nowMs();
    for(let i=targets.length-1; i>=0; i--){
      const obj = targets[i];
      if(!obj || obj.hit) continue;
      if((t - obj.bornMs) > (obj.lifeMs||3000)){
        // expire => remove silently (no miss in this game)
        try{
          obj.el?.classList.add('is-hit');
        }catch{}
        removeTarget(obj);
        logEvent('expire', { kind: obj.kind, stepIdx: obj.stepIdx });
      }
    }
  }

  // cap targets without heavy sort
  function capTargets(maxN){
    const n = targets.length|0;
    if(n <= maxN) return;

    // remove oldest by linear scan (cheap)
    let oldestIdx = -1;
    let oldestBorn = 1e18;
    for(let i=0;i<targets.length;i++){
      const t = targets[i];
      if(!t || t.hit) continue;
      if(t.bornMs < oldestBorn){
        oldestBorn = t.bornMs; oldestIdx = i;
      }
    }
    if(oldestIdx >= 0){
      const o = targets[oldestIdx];
      try{ o.el?.classList.add('is-hit'); }catch{}
      removeTarget(o);
      logEvent('cap_remove', { kind:o.kind, stepIdx:o.stepIdx });
    }
  }

  function tick(){
    if(!running){ return; }

    const t = nowMs();
    lastTickMs = t;

    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    // log time occasionally (not every frame)
    if((safeInt(timeLeft) % 5) === 0){
      if(!tick._lastTimeLog || (t - tick._lastTimeLog) > 900){
        tick._lastTimeLog = t;
        logEvent('time', { leftSec: Math.max(0, timeLeft) });
      }
    }

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    const P = dd ? dd.getParams() : base;
    spawnAcc += (P.spawnPerSec * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }

    cleanupExpired();
    capTargets(18);

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

    // reset quest timers
    bumpQuestOnGoodHit._nextAt = 0;
    bumpQuestOnGoodHit._noHazUntil = 0;
    bumpQuestOnGoodHit._fastStepT0 = 0;
    bumpQuestOnGoodHit._fastStepIdx = -1;

    setHud();
  }

  function startWatchdog(){
    stopWatchdog();
    watchdogId = setInterval(()=>{
      if(!running || paused) return;
      const t = nowMs();
      // if RAF/tick stalled
      if((t - lastTickMs) > 1600){
        paused = true;
        if(btnPause) btnPause.textContent = '▶ Resume';
        showBanner('⚠️ เกมสะดุด/ค้างชั่วคราว — กด Resume หรือ Reload');
        logEvent('stall', { dtMs: (t - lastTickMs) });
      }
    }, 650);
  }
  function stopWatchdog(){
    if(watchdogId){
      clearInterval(watchdogId);
      watchdogId = 0;
    }
  }

  function startGame(){
    resetGame();
    running=true;
    session.t0 = nowMs();
    session.events.length = 0;

    tStartMs = session.t0;
    tLastMs = tStartMs;
    lastTickMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, sessionId: session.sid });
    logEvent('start', { runMode, diff, seed, view, timePlannedSec });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    startWatchdog();
    requestAnimationFrame(tick);
  }

  // ---- AI prediction stub (deterministic heuristic) ----
  function predictRisk(summary){
    // allow external predictor (future ML/DL) — must be deterministic in research if used
    try{
      const ext = WIN.HHA_Predict?.predictRisk;
      if(typeof ext === 'function') return ext(summary);
    }catch{}

    const acc = Number(summary.stepAcc||0);
    const haz = Number(summary.hazHits||0);
    const miss = Number(summary.misses||0);
    const rt = Number(summary.medianStepMs||0);

    // simple heuristic: higher risk if low acc + many haz/miss + slow rt
    let score = 0.55*(1-acc) + 0.20*clamp(haz/6,0,1) + 0.15*clamp(miss/6,0,1) + 0.10*clamp(rt/3500,0,1);
    score = clamp(score, 0, 1);

    let level = 'low';
    if(score >= 0.66) level = 'high';
    else if(score >= 0.40) level = 'medium';

    return { score, level };
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    stopWatchdog();
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

    const summary = {
      version:'1.1.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId: session.sid,
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

    const pred = predictRisk(summary);
    if(pred) summary.predictedRisk = pred;

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    try{
      if(WIN.HHA_Badges){
        WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
      }
    }catch{}

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    logEvent('end', { reason, grade, stepAcc, hazHits, misses: getMissCount(), loopsDone });
    flushEvents(summary);

    emit('hha:end', summary);

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    // flush-hardened attempt (safe even if no logger)
    try{
      logEvent('nav_hub', {});
      flushEvents(loadJson(LS_LAST, null));
    }catch{}
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); logEvent('reset',{}); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    logEvent(paused ? 'pause':'resume', {});
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // optional: badge/coach visuals
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    try{
      if(WIN.Particles && WIN.Particles.popText){
        WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
        WIN.Particles.burst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, { count: 14, spread: 58, upBias: 0.9 });
      }
    }catch{}
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // flush-hardened: try to preserve session if tab hidden
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      try{
        if(running){
          saveJson(`HHA_DRAFT_${session.sid}`, {
            t: nowIso(),
            runMode, diff, view, seed,
            timeLeft, stepIdx, hitsInStep, loopsDone,
            combo, comboMax, wrongStepHits, hazHits, correctHits, totalStepHits
          });
          logEvent('hidden_save', {});
          flushEvents(null);
        }
      }catch{}
    }
  });

  // initial
  setHud();
}