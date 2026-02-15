// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + 7 Steps + Quest + Quiz + FX)
// PATCH v20260215b
// ✅ FIX: target disappears immediately on hit (hit-pop + remove now)
// ✅ FIX: prevent target flood: TTL + cap + cheap cleanup (no sort in hot loop)
// ✅ FIX: HUD-safe spawn measured from HUD (auto sets --hw-top-safe/--hw-bottom-safe)
// ✅ FIX: mobile reliability: pointerdown + double-fire guard
// ✅ FIX: freeze guard: heartbeat + simple loop
// ✅ NEW: Practice 15s via ?run=practice => auto redirect to run=play
// ✅ AI hooks attach point (play only, enable with ?ai=1) — safe if missing
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
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

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
  const hudTop   = DOC.getElementById('hudTop');

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
  const runModeRaw = (qs('run','play')||'play').toLowerCase();
  const isPractice = (runModeRaw === 'practice');
  const runMode = isPractice ? 'practice' : 'play';

  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  // ✅ practice time fixed
  const timePlannedSec = isPractice ? 15 : clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.16 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.11, decoyRate:0.22 };
  })();

  // ✅ AI enable only in play + ai=1
  const aiOn = (!isPractice && (qs('ai','0') === '1'));
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  const coach = (aiOn && coachOn && WIN.HHA_AICoach)
    ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode:'play', lang:'th' })
    : null;

  const dd = (aiOn && ddOn && WIN.HHA_DD)
    ? WIN.HHA_DD.create({
        seed, runMode:'play',
        base,
        bounds:{ spawnPerSec:[1.2, 4.2], hazardRate:[0.05, 0.26], decoyRate:[0.10, 0.40] }
      })
    : null;

  // ✅ optional external AI hooks stub
  const hooks = (()=> {
    try{
      const f = WIN.HHA?.createAIHooks;
      if(typeof f === 'function' && aiOn){
        return f({ gameId:'hygiene', seed, diff, view });
      }
    }catch{}
    return null;
  })();

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

  const missLimit = isPractice ? 9999 : 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // quest/quiz
  let questText = isPractice ? 'WARMUP: ยิงให้โดน + ลองคอมโบ!' : 'ทำ STEP ให้ถูก!';
  let questDone = 0;
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, ttlMs, gone}
  let nextId=1;

  // anti double-fire (mobile)
  let lastFireAt = 0;

  // TTL + cap
  const TTL_MS = isPractice ? 1200 : 1600;
  const CAP = isPractice ? 14 : 18;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // ✅ measured HUD safe zones (prevents HUD blocking targets)
  function updateMeasuredSafeZones(){
    try{
      if(!hudTop) return;
      const r = hudTop.getBoundingClientRect();
      const topSafe = Math.ceil(r.bottom + 14); // hud bottom + margin
      // bottom safe = keep space for mobile bottom bars / safe area; keep default unless overlays exist
      const bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 190;

      DOC.documentElement.style.setProperty('--hw-top-safe', `${clamp(topSafe, 120, 380)}px`);
      DOC.documentElement.style.setProperty('--hw-bottom-safe', `${clamp(bottomSafe, 140, 420)}px`);
    }catch{}
  }

  // FX (fallback if particles missing)
  function fxHit(kind, obj){
    const P = WIN.Particles;
    const x = Number(obj?.x || WIN.innerWidth*0.5);
    const y = Number(obj?.y || WIN.innerHeight*0.5);

    if(P && (P.popText || P.burst)){
      if(kind === 'good'){
        P.popText && P.popText(x, y, isPractice ? '✅ nice!' : '✅ +1', 'good');
        P.burst && P.burst(x, y, { count: 12, spread: 46, upBias: 0.86 });
      }else if(kind === 'wrong'){
        P.popText && P.popText(x, y, '⚠️ ผิด!', 'warn');
        P.burst && P.burst(x, y, { count: 10, spread: 40, upBias: 0.82 });
      }else if(kind === 'haz'){
        P.popText && P.popText(x, y, '🦠 โดนเชื้อ!', 'bad');
        P.burst && P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
      }
      return;
    }

    // fallback: small banner only
    if(kind==='good') showBanner('✅');
    else if(kind==='wrong') showBanner('⚠️');
    else showBanner('🦠');
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
    if(isPractice) return; // practice: no quiz
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
      'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ') +
      '  (ตอบโดย “ถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

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

    return { x0, x1, y0, y1, w, h, topSafe, bottomSafe };
  }

  function getMissCount(){ return (wrongStepHits + hazHits); }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit===9999 ? '∞' : missLimit}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    pillQuest && (pillQuest.textContent = `QUEST ${questText}`);

    hudSub && (hudSub.textContent =
      `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}` +
      (aiOn ? ' • AI=ON' : '')
    );
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch{}
    }
  }

  function removeTarget(obj){
    if(!obj || obj.gone) return;
    obj.gone = true;
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);

    try{
      obj.el?.classList?.add('is-hit');
      // remove now (don't wait), but keep try/catch safe
      obj.el?.remove();
    }catch{}
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    // measured safe zones
    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, ttlMs: TTL_MS, gone:false };
    targets.push(obj);

    // tap/click only when not cVR strict
    if(view !== 'cvr'){
      el.addEventListener('pointerdown', (ev)=>{
        // reliability on mobile
        ev.preventDefault?.();

        const t = nowMs();
        if(t - lastFireAt < 55) return; // double-fire guard
        lastFireAt = t;

        onHitByPointer(obj, 'tap');
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
      if(t.gone) continue;
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      const now = nowMs();
      if(now - lastFireAt < 55) return;
      lastFireAt = now;
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function judgeHit(obj, source, extra){
    if(!obj || obj.gone) return;
    const rt = computeRt(obj);

    // AI hooks
    try{ hooks?.onEvent?.('hit_attempt', { kind: obj.kind, stepIdx, source, rtMs: rt }); }catch{}

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      if(!isPractice && quizOpen && quizOpen._armed){
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

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      fxHit('good', obj);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          if(!isPractice){
            showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
            if(!quizOpen) openRandomQuiz();
          }
        }else{
          if(!isPractice){
            showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
            if(!quizOpen && rng() < 0.25) openRandomQuiz();
          }
        }
      }

      // ✅ disappear immediately
      removeTarget(obj);
      setHud();
      try{ hooks?.onEvent?.('hit', { kind:'good', stepIdx, rtMs: rt, combo }); }catch{}
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      if(!isPractice && quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      if(!isPractice) showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      fxHit('wrong', obj);

      removeTarget(obj);
      if(!isPractice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      try{ hooks?.onEvent?.('hit', { kind:'wrong', stepIdx, rtMs: rt }); }catch{}
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      if(!isPractice && quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent?.('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      if(!isPractice) showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      fxHit('haz', obj);

      removeTarget(obj);
      if(!isPractice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      try{ hooks?.onEvent?.('hit', { kind:'haz', stepIdx, rtMs: rt }); }catch{}
      return;
    }
  }

  function cleanupExpired(){
    const now = nowMs();
    for(let i=targets.length-1;i>=0;i--){
      const t = targets[i];
      if(t.gone) { targets.splice(i,1); continue; }
      if((now - t.bornMs) > t.ttlMs){
        // expire -> just remove (no miss)
        removeTarget(t);
      }
    }
  }

  function tick(){
    if(!running) return;

    // heartbeat for boot anti-stall
    try{ WIN.HHA_HEARTBEAT && WIN.HHA_HEARTBEAT(); }catch{}
    WIN.HHA_RUNNING = true;

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

    // measured safe zones occasionally (HUD height can change on mobile)
    if((t|0) % 900 < 20) updateMeasuredSafeZones();

    const P = dd ? dd.getParams() : base;
    const sp = isPractice ? Math.max(1.4, P.spawnPerSec * 0.78) : P.spawnPerSec;

    spawnAcc += (sp * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      if(targets.length > CAP){
        // remove oldest without sort
        let oldest = targets[0];
        for(let k=1;k<targets.length;k++){
          if(targets[k].bornMs < oldest.bornMs) oldest = targets[k];
        }
        if(oldest) removeTarget(oldest);
      }
    }

    cleanupExpired();
    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    WIN.HHA_RUNNING = false;

    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;

    questText = isPractice ? 'WARMUP: ยิงให้โดน + ลองคอมโบ!' : 'ทำ STEP ให้ถูก!';
    questDone = 0;
    quizRight = 0;
    quizWrong = 0;
    setQuizVisible(false);
    setHud();
  }

  function startGame(){
    resetGame();
    updateMeasuredSafeZones();

    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, aiOn });

    // cVR calibration helper
    if(view==='cvr'){
      showBanner('📦 cVR: แนะนำกด RECENTER ก่อนเริ่ม (ปุ่ม VR UI)');
    }

    showBanner(isPractice ? '🧪 PRACTICE 15s: ยิงให้โดน + ลองคอมโบ!' : `เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function buildRedirectToPlayUrl(){
    const cur = new URL(location.href);
    cur.searchParams.set('run','play');
    cur.searchParams.set('warm','1');
    return cur.toString();
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    WIN.HHA_RUNNING = false;

    clearTargets();
    setQuizVisible(false);

    if(isPractice){
      showBanner('✅ Practice จบ! กำลังเข้าเกมจริง…');
      setTimeout(()=>{ try{ location.href = buildRedirectToPlayUrl(); }catch{ location.reload(); } }, 520);
      return;
    }

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
      version:'v20260215b',
      game:'hygiene',
      gameMode:'hygiene',
      runMode:'play',
      diff, view, seed,
      aiOn: !!aiOn,
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

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);
    try{ hooks?.onEvent?.('end', summary); }catch{}

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  // binds
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

  WIN.addEventListener('hha:shoot', onShoot);

  // badge/coach banners (optional)
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
      WIN.Particles.burst(WIN.innerWidth*0.5, WIN.innerHeight*0.22, { count: 14, spread: 58, upBias: 0.9 });
    }else{
      showBanner(`${b.icon||'🏅'} ${b.title||'Badge!'}`);
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // init
  updateMeasuredSafeZones();
  setHud();

  if(isPractice){
    showBanner('🧪 PRACTICE: 15s วอร์มอัป แล้วจะเข้าเกมจริงอัตโนมัติ');
  }else if(view==='cvr'){
    showBanner('📦 cVR: กด RECENTER ก่อนเริ่มจะเล็งง่ายขึ้น');
  }
}