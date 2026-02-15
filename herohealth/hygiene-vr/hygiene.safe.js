// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Practice + Pause + Logger + Boss/Storm + AI)
// PATCH v20260216a
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
  if(!stage){ console.error('[Hygiene] stage not found'); return; }

  // UI
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
  const practiceOverlay = DOC.getElementById('practiceOverlay');
  const pauseOverlay = DOC.getElementById('pauseOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');

  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart   = DOC.getElementById('btnStart');
  const btnPractice= DOC.getElementById('btnPractice');
  const btnPracticeGo = DOC.getElementById('btnPracticeGo');
  const btnPracticeBack = DOC.getElementById('btnPracticeBack');

  const btnRestart = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  const btnResume = DOC.getElementById('btnResume');
  const btnQuit = DOC.getElementById('btnQuit');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.08, decoyRate:0.16 };
    if(diff==='hard') return { spawnPerSec:2.7, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.25, hazardRate:0.11, decoyRate:0.22 };
  })();

  // Optional AI packs (existing) + new AI predictor
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.2, 4.2], hazardRate:[0.05, 0.26], decoyRate:[0.10, 0.40] }
  }) : null;
  const ai = (WIN.HHA_HYGIENE_AI && WIN.HHA_HYGIENE_AI.create) ? WIN.HHA_HYGIENE_AI.create({ seed, runMode }) : null;

  // Logger (optional, enabled by ?log=1)
  const logger = (WIN.HHA_LOGGER && WIN.HHA_LOGGER.create) ? WIN.HHA_LOGGER.create({
    gameId: 'hygiene',
    sessionId: `HW-${Date.now()}-${Math.floor(rng()*1e6)}`,
    meta: { runMode, diff, view, seed, hub }
  }) : null;

  // state
  let running=false, paused=false, practice=false;
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

  // quest / storm / boss
  let questText = 'ทำ STEP ให้ถูก!';
  let questDone = 0;

  let stormUntilSec = 0;     // storm window
  let nextStormAtSec = 12 + rng()*10;

  let bossActive=false;
  let bossHp=0;

  // quiz
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, hp?}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  // FX
  function fxHit(kind, obj){
    const P = WIN.Particles;
    if(!P || !obj) return;

    let x = Number(obj.x);
    let y = Number(obj.y);

    // fallback from element rect (more accurate if something shifts)
    if(obj.el && (!Number.isFinite(x) || !Number.isFinite(y))){
      try{
        const r = obj.el.getBoundingClientRect();
        x = r.left + r.width/2;
        y = r.top + r.height/2;
      }catch{}
    }
    if(!Number.isFinite(x)) x = WIN.innerWidth*0.5;
    if(!Number.isFinite(y)) y = WIN.innerHeight*0.5;

    if(kind === 'good'){
      P.popText(x, y, '✅ +1', 'good');
      P.burst(x, y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(x, y, '⚠️ ผิด!', 'warn');
      P.burst(x, y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText(x, y, '🦠 โดนเชื้อ!', 'bad');
      P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
    }else if(kind === 'boss'){
      P.popText(x, y, '💥!', 'warn');
      P.burst(x, y, { count: 16, spread: 62, upBias: 0.92 });
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

    quizSub.textContent =
      'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
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

  // ✅ HUD-safe spawn rect (real HUD rect first)
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;

    let topSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 170;
    let bottomSafe = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 190;

    try{
      if(hudTop){
        const r = hudTop.getBoundingClientRect();
        // HUD bottom + small margin
        topSafe = Math.max(topSafe, Math.ceil(r.bottom + 10));
      }
    }catch{}

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafe - pad;

    // guard
    const yy1 = Math.max(y0 + 40, y1);
    return { x0, x1, y0, y1: yy1, w, h };
  }

  function getMissCount(){ return (wrongStepHits + hazHits); }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}` + (bossActive? ' • BOSS!':'' ));
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}` + (bossActive? ` • HP ${bossHp}`:'' ));
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    const storm = (elapsedSec() < stormUntilSec);
    const qTxt = storm ? '🌪 STORM!' : questText;
    pillQuest && (pillQuest.textContent = `QUEST ${qTxt}`);

    hudSub && (hudSub.textContent =
      `${practice?'PRACTICE':'PLAY'} • diff=${diff} • seed=${seed} • view=${view}`
      + (logger && logger._cfg && logger._cfg.enabled ? ' • log=1':'')
      + (WIN.HHA_HYGIENE_AI && WIN.HHA_HYGIENE_AI.enabled ? ' • ai=1':'' )
    );
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch{}
    }
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    try{ obj.el?.remove(); }catch{}
  }

  // ✅ NEW: fast “hit → vanish”
  function markHitAndRemoveFast(obj){
    if(!obj || !obj.el) { removeTarget(obj); return; }
    try{
      obj.el.classList.add('is-hit');
      obj.el.disabled = true;
      obj.el.style.pointerEvents = 'none';
    }catch{}
    // remove quickly (feels immediate)
    setTimeout(()=> removeTarget(obj), 140);
  }

  function createTarget(kind, emoji, stepRef, extra){
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

    const obj = {
      id: nextId++,
      el,
      kind,
      stepIdx: stepRef,
      bornMs: nowMs(),
      x, y,
      hp: (extra && extra.hp) ? Number(extra.hp)||0 : 0
    };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shoot: nearest target within lockPx
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
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function showPause(on){
    if(!pauseOverlay) return;
    pauseOverlay.style.display = on ? 'grid' : 'none';
  }

  // ===== Spawn logic with storm/boss =====
  function getParams(){
    const P = dd ? dd.getParams() : base;
    const t = elapsedSec();
    const inStorm = (t < stormUntilSec);

    // storm increases chaos
    let spawnPerSec = P.spawnPerSec * (inStorm ? 1.25 : 1.0);
    let hazardRate  = clamp(P.hazardRate + (inStorm ? 0.06 : 0), 0.03, 0.40);
    let decoyRate   = clamp(P.decoyRate + (inStorm ? 0.06 : 0), 0.05, 0.55);

    // boss slows spawns but high tension
    if(bossActive){
      spawnPerSec = Math.max(1.6, spawnPerSec * 0.72);
      hazardRate = clamp(hazardRate + 0.04, 0, 0.45);
      decoyRate  = clamp(decoyRate + 0.03, 0, 0.60);
    }

    return { spawnPerSec, hazardRate, decoyRate };
  }

  function spawnBoss(){
    bossActive = true;
    bossHp = 3;
    // big “correct step” target (must hit 3 times)
    showBanner('👹 BOSS! ตีให้แตก 3 ที!');
    logger?.event('boss_start', { t: elapsedSec(), stepIdx });
    return createTarget('wrong', '👹', stepIdx, { hp: 3 });
  }

  function spawnOne(){
    // boss cadence: every 2 loops (after start)
    if(!bossActive && loopsDone>0 && loopsDone % 2 === 0 && rng() < 0.08){
      return spawnBoss();
    }

    const s = STEPS[stepIdx];
    const P = getParams();

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

  function bumpQuest(){
    const t = elapsedSec();
    if(t < 2) return;

    // storm schedule
    if(t >= nextStormAtSec){
      stormUntilSec = t + (6 + rng()*5);
      nextStormAtSec = t + (16 + rng()*12);
      showBanner('🌪 STORM! เป้าจะถี่ขึ้น ระวัง 🦠');
      logger?.event('storm_start', { t, until: stormUntilSec });
    }

    // quest rotate (light)
    if(!bumpQuest._nextAt){
      bumpQuest._nextAt = 10 + rng()*10;
      return;
    }
    if(t < bumpQuest._nextAt) return;
    bumpQuest._nextAt = t + (12 + rng()*10);

    const roll = rng();
    questDone = 0;
    if(roll < 0.33){
      questText = 'คอมโบถึง 8!';
    }else if(roll < 0.66){
      questText = 'อย่าโดน 🦠 10 วิ!';
      bumpQuest._noHazUntil = t + 10;
    }else{
      questText = 'ผ่าน STEP นี้ไว!';
      bumpQuest._fastStepT0 = nowMs();
      bumpQuest._fastStepIdx = stepIdx;
    }
    showBanner(`🎯 QUEST: ${questText}`);
    logger?.event('quest_new', { t, questText });
  }

  function updateQuestTick(){
    const t = elapsedSec();
    if(bumpQuest._noHazUntil){
      if(t >= bumpQuest._noHazUntil){
        questDone = 1;
        bumpQuest._noHazUntil = 0;
        showBanner('🏅 QUEST ผ่าน!');
        logger?.event('quest_done', { t, questText });
      }
    }
  }

  function closeIfQuizTimeout(){
    if(quizOpen && quizOpen._armed){
      const within = (nowMs() - quizOpen._t0) <= 5200;
      if(!within) closeQuiz(null);
    }
  }

  function aiTick(){
    if(!ai) return;
    // compute rates for AI
    const stepAcc = getStepAcc();
    const t = Math.max(1, elapsedSec());
    const hazRate = clamp(hazHits / (t/10), 0, 1);     // per 10s
    const missRate= clamp(getMissCount() / (t/10), 0, 1);
    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 1200;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();
    ai.onEvent('perf', { stepAcc, hazRate, missRate, rtMed, combo });
    const pred = ai.predict();
    if(pred && pred.tip && rng() < 0.06){
      showBanner(`🤖 ${pred.tip}`);
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // already removed/being removed
    if(!obj || !obj.el) return;

    // boss special
    if(bossActive && obj.kind === 'wrong' && obj.el && obj.el.innerText.includes('👹')){
      bossHp = Math.max(0, bossHp-1);
      logger?.event('boss_hit', { t: elapsedSec(), bossHp, source, extra });

      fxHit('boss', obj);
      if(bossHp <= 0){
        bossActive = false;
        showBanner('🏆 BOSS แตก!');
        markHitAndRemoveFast(obj);
        // reward: skip hazard penalty
        combo = Math.max(combo, 5);
      }else{
        // keep it but show hit pop quickly (no vanish)
        try{ obj.el.classList.add('is-hit'); }catch{}
        setTimeout(()=>{ try{ obj.el.classList.remove('is-hit'); }catch{} }, 140);
      }
      setHud();
      return;
    }

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
        }
      }

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      logger?.event('judge', { kind:'good', stepIdx, rtMs: rt, source, extra, combo });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      fxHit('good', obj);

      markHitAndRemoveFast(obj); // ✅ immediate feel

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        const prevStep = stepIdx;

        stepIdx++;
        hitsInStep=0;

        if(bumpQuest._fastStepIdx === prevStep){
          const dt = nowMs() - (bumpQuest._fastStepT0||nowMs());
          if(dt <= 6500){
            questDone = 1;
            showBanner('🏅 QUEST ผ่าน! (ไวมาก)');
            logger?.event('quest_done', { t: elapsedSec(), questText });
          }
        }

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          logger?.event('loop_done', { loopsDone, t: elapsedSec() });
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.25) openRandomQuiz();
        }
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
      }

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      logger?.event('judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      fxHit('wrong', obj);

      markHitAndRemoveFast(obj);
      if(!practice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      if(quizOpen && quizOpen._armed){
        quizWrong++;
        closeQuiz('❌ Quiz พลาด!');
      }

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      logger?.event('judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      fxHit('haz', obj);

      markHitAndRemoveFast(obj);
      if(!practice && getMissCount() >= missLimit) endGame('fail');
      setHud();
      return;
    }
  }

  // ===== anti-stall + tick =====
  let lastAliveMs = nowMs();
  function heartbeat(){
    lastAliveMs = nowMs();
  }
  function watchdog(){
    if(!running) return;
    const dt = nowMs() - lastAliveMs;
    if(dt > 3500){
      // stalled
      showBanner('⚠️ เกมสะดุด/ค้าง — แนะนำ Reload (มือถือหน่วง/JS error)');
      logger?.event('stall_warn', { dtMs: dt, t: elapsedSec(), targets: targets.length });
      heartbeat();
    }
    setTimeout(watchdog, 1200);
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = clamp((t - tLastMs)/1000, 0, 0.08); // clamp for mobile spikes
    tLastMs = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    heartbeat();

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    const P = getParams();
    spawnAcc += (P.spawnPerSec * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets
      const cap = (view==='mobile') ? 16 : (view==='cvr' ? 14 : 18);
      if(targets.length > cap){
        const oldest = targets.reduce((a,b)=> (a.bornMs<b.bornMs?a:b));
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });
    logger?.event('tick', { t: elapsedSec(), left: timeLeft, n: targets.length });

    bumpQuest();
    updateQuestTick();
    closeIfQuizTimeout();
    aiTick();

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

    bossActive=false; bossHp=0;

    questText = 'ทำ STEP ให้ถูก!';
    questDone = 0;

    stormUntilSec = 0;
    nextStormAtSec = 12 + rng()*10;

    quizRight = 0;
    quizWrong = 0;
    setQuizVisible(false);

    setHud();
  }

  function startGame(opts){
    resetGame();
    practice = !!(opts && opts.practice);
    running=true;
    paused=false;

    const planned = practice ? 15 : timePlannedSec;
    timeLeft = planned;

    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    practiceOverlay && (practiceOverlay.style.display = 'none');
    pauseOverlay && (pauseOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    logger?.event('start', { practice, runMode, diff, seed, view, plannedSec: planned });
    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec: planned, practice });

    showBanner(practice ? '🧪 Practice เริ่มแล้ว!' : `เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    // start watchdog once
    if(!startGame._wd){
      startGame._wd = true;
      setTimeout(watchdog, 1200);
    }

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();
    setQuizVisible(false);
    showPause(false);

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
      version:'20260216a',
      game:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId: logger?._cfg?.sessionId || `HW-${Date.now()}-${Math.floor(rng()*1e6)}`,
      timestampIso: nowIso(),

      practice,
      reason,
      durationPlannedSec: practice ? 15 : timePlannedSec,
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

    logger?.event('end', summary);
    logger?.flush('end');

    // practice does not store research summary by default
    if(!practice){
      if(WIN.HHA_Badges){
        WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
      }
      saveJson(LS_LAST, summary);
      const hist = loadJson(LS_HIST, []);
      const arr = Array.isArray(hist) ? hist : [];
      arr.unshift(summary);
      saveJson(LS_HIST, arr.slice(0, 200));
      emit('hha:end', summary);
    }

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : (practice ? 'Practice จบ ✅' : 'จบเกม ✅');
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    try{ logger?.flush('back_hub'); }catch{}
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    showPause(paused);
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    logger?.event('pause', { paused, t: elapsedSec() });
  }

  // ===== UI binds =====
  btnStart?.addEventListener('click', ()=> startGame({practice:false}), { passive:true });
  btnPractice?.addEventListener('click', ()=>{
    if(startOverlay) startOverlay.style.display='none';
    if(practiceOverlay) practiceOverlay.style.display='grid';
  }, { passive:true });
  btnPracticeGo?.addEventListener('click', ()=> startGame({practice:true}), { passive:true });
  btnPracticeBack?.addEventListener('click', ()=>{
    if(practiceOverlay) practiceOverlay.style.display='none';
    if(startOverlay) startOverlay.style.display='grid';
  }, { passive:true });

  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', ()=> startGame({practice:false}), { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });

  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', togglePause, { passive:true });
  btnResume?.addEventListener('click', ()=>{ if(paused) togglePause(); }, { passive:true });
  btnQuit?.addEventListener('click', goHub, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // badges + coach
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

  // flush-hardened (extra)
  WIN.addEventListener('beforeunload', ()=>{ try{ logger?.flush('beforeunload'); }catch{} });

  // initial
  setHud();
}