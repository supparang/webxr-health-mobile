// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Coach + DD)
// PACK AN: Boss + Soap + Event Pack (localStorage HHA_HYGIENE_EVENTS_LAST)
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY, HHA_HYGIENE_EVENTS_LAST

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';
const LS_EVENTS = 'HHA_HYGIENE_EVENTS_LAST';

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

function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
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

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼';

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillBoss = DOC.getElementById('pillBoss');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

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

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const bossOn  = (qs('boss','1') !== '0');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, soapRate:0.06 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, soapRate:0.07 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, soapRate:0.065 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    soapRate:[0.03, 0.10]
  };

  // AI instances
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // ------------------ Events buffer (PACK AN) ------------------
  const events = [];
  let evFlushT = 0;

  function pushEvent(type, payload){
    const e = Object.assign({
      type,
      ts: Date.now(),
      t: Number(elapsedSec().toFixed(3))
    }, payload || {});
    events.push(e);
  }

  function buildEventsMeta(){
    return {
      version:'1.0.0-prod+AN',
      game:'hygiene',
      runMode, diff, view, seed,
      timePlannedSec,
      sessionId: currentSessionId || '',
      timestampIso: nowIso()
    };
  }

  function flushEvents(reason){
    try{
      const pack = { meta: buildEventsMeta(), events: events.slice(0) };
      saveJson(LS_EVENTS, pack);
      pushEvent('flush', { reason: reason || 'manual', n: pack.events.length });
    }catch(_){}
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
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms
  let spawnAcc=0;

  // protection: soap shield
  let soapShield = 0;         // blocks next haz hit
  let soapPicked = 0;         // metric

  // boss state (PACK AN)
  let bossActive = false;
  let bossPhase = 0;
  let bossTimeLeft = 0;
  let bossSoapNeed = 0;
  let bossSoapGot = 0;
  let bossClears = 0;
  let bossFails  = 0;

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  let currentSessionId = '';

  // banner helper
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  // safe rect for spawn
  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const rootStyle = getComputedStyle(DOC.documentElement);
    const topSafe = parseFloat(rootStyle.getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(rootStyle.getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;

    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    // Hygiene: miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    const bossTxt = bossOn
      ? (bossActive
          ? `BOSS P${bossPhase} • SOAP ${bossSoapGot}/${bossSoapNeed} • ${Math.ceil(bossTimeLeft)}s`
          : `BOSS ready • clears ${bossClears} • fails ${bossFails}`)
      : `BOSS off`;
    pillBoss && (pillBoss.textContent = bossTxt);

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • shield=${soapShield}`);
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function createTarget(kind, emoji, stepRef, opts){
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
    el.style.setProperty('--s', (opts?.scale ?? (0.90 + rng()*0.25)).toFixed(3));

    if(opts?.bossGlow) el.classList.add('bossGlow');

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    // click/tap only for non-cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, lockPx = from vr-ui config
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
      pushEvent('shot', { lockPx, hit:true, kind: best.kind });
    }else{
      pushEvent('shot', { lockPx, hit:false });
    }
  }

  // ---- Boss logic (PACK AN) ----
  function shouldEnterBoss(){
    if(!bossOn) return false;
    if(bossActive) return false;
    if(!running) return false;

    // เข้า boss แบบเป็นจังหวะ: ทุกครั้งที่ครบ 7 ขั้นตอน (loopsDone เพิ่ม)
    // และต้องเหลือเวลาอย่างน้อย 14s
    if(loopsDone > 0 && stepIdx === 0 && hitsInStep === 0){
      if(timeLeft >= 14){
        // จำกัดถี่: อย่างน้อยห่างกัน 10s
        if(elapsedSec() - (shouldEnterBoss._last||-1e9) > 10){
          shouldEnterBoss._last = elapsedSec();
          return true;
        }
      }
    }
    return false;
  }

  function enterBoss(){
    bossActive = true;
    bossPhase++;
    bossTimeLeft = (diff==='easy') ? 12 : (diff==='hard' ? 10 : 11);

    bossSoapNeed = (diff==='easy') ? 2 : (diff==='hard' ? 3 : 2);
    bossSoapGot = 0;

    showBanner(`👹 BOSS P${bossPhase}! เก็บสบู่ ${bossSoapNeed} ชิ้นใน ${Math.ceil(bossTimeLeft)}s`);
    pushEvent('boss_enter', { phase: bossPhase, timeLimitSec: bossTimeLeft, soapNeed: bossSoapNeed });

    // spawn boss-like hazards immediately (visual excitement)
    for(let i=0;i<2;i++){
      createTarget('haz', ICON_HAZ, -1, { bossGlow:true, scale: 1.12 });
    }
    // spawn soap
    createTarget('soap', ICON_SOAP, -1, { bossGlow:true, scale: 1.10 });
    pushEvent('soap_spawn', { phase: bossPhase, n: 1 });
    setHud();
  }

  function clearBoss(){
    bossActive = false;
    bossClears++;
    showBanner(`🏆 BOSS CLEAR! +Shield`);
    soapShield = Math.max(soapShield, 1); // bonus protection
    pushEvent('boss_clear', { phase: bossPhase, soapGot: bossSoapGot, shieldNow: soapShield });
    setHud();
  }

  function failBoss(){
    bossActive = false;
    bossFails++;
    // penalty: +1 haz hit (นับเป็น miss)
    hazHits++;
    combo = 0;
    showBanner(`💥 BOSS FAIL! ระวังเชื้อ (+1 MISS)`);
    pushEvent('boss_fail', { phase: bossPhase, soapGot: bossSoapGot, missNow: getMissCount() });
    checkFail();
    setHud();
  }

  // ---- Spawn rules ----
  function spawnOne(){
    const s = STEPS[stepIdx];
    const P0 = dd ? dd.getParams() : base;

    // During boss: make it spicier
    const P = bossActive
      ? {
          spawnPerSec: clamp(P0.spawnPerSec * 1.20, bounds.spawnPerSec[0], bounds.spawnPerSec[1]),
          hazardRate:  clamp(P0.hazardRate  * 1.25, bounds.hazardRate[0], bounds.hazardRate[1]),
          decoyRate:   clamp(P0.decoyRate   * 1.10, bounds.decoyRate[0], bounds.decoyRate[1]),
          soapRate:    clamp(P0.soapRate    * 1.55, bounds.soapRate[0], bounds.soapRate[1])
        }
      : P0;

    const r = rng();

    // soap chance
    if(r < P.soapRate){
      pushEvent('soap_spawn', { phase: bossPhase, boss: bossActive ? 1 : 0 });
      return createTarget('soap', ICON_SOAP, -1, { bossGlow: bossActive, scale: bossActive ? 1.05 : undefined });
    }

    // hazard
    if(r < P.soapRate + P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1, { bossGlow: bossActive, scale: bossActive ? 1.08 : undefined });
    }

    // wrong step (decoy)
    if(r < P.soapRate + P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j, { bossGlow: bossActive ? (rng()<0.25) : false });
    }

    // correct step
    return createTarget('good', s.icon, stepIdx, { bossGlow: bossActive ? (rng()<0.25) : false });
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // SOAP
    if(obj.kind === 'soap'){
      soapPicked++;
      soapShield++; // each soap gives 1 block
      pushEvent('soap_pick', { shieldNow: soapShield, boss: bossActive ? 1 : 0, phase: bossPhase });

      showBanner(`🧼 +Shield (${soapShield})`);
      coach?.onEvent?.('soap_pick', { shieldNow: soapShield, boss: bossActive, phase: bossPhase });

      if(bossActive){
        bossSoapGot++;
        // if boss requires soap, check clear
        if(bossSoapGot >= bossSoapNeed){
          removeTarget(obj);
          clearBoss();
          return;
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // GOOD
    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      pushEvent('step_hit', { ok:true, stepIdx, rtMs: rt, source });
      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        pushEvent('step_clear', { stepIdx, loop: loopsDone });
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          pushEvent('loop_complete', { loopsDone });

          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // WRONG STEP
    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      pushEvent('step_hit', { ok:false, stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source });
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    // HAZARD
    if(obj.kind === 'haz'){
      // shield blocks hazard once (PACK AN)
      if(soapShield > 0){
        soapShield--;
        pushEvent('haz_block', { shieldLeft: soapShield, boss: bossActive ? 1 : 0, phase: bossPhase, source });
        showBanner(`🛡️ กันเชื้อ! (shield ${soapShield})`);
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;

      pushEvent('haz_hit', { missNow: getMissCount(), boss: bossActive ? 1 : 0, phase: bossPhase, source });
      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });

      showBanner(`🦠 โดนเชื้อ! ระวัง!`);
      removeTarget(obj);

      checkFail();
      setHud();
      return;
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){
      requestAnimationFrame(tick);
      return;
    }

    // time
    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });
    pushEvent('time', { leftSec: Number(timeLeft.toFixed(3)) });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // boss timer
    if(bossActive){
      bossTimeLeft -= dt;
      if(bossTimeLeft <= 0){
        failBoss();
      }
    }else{
      if(shouldEnterBoss()){
        enterBoss();
      }
    }

    // spawn
    const P = dd ? dd.getParams() : base;
    const mult = bossActive ? 1.20 : 1.00;

    spawnAcc += (P.spawnPerSec * mult * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets
      if(targets.length > 18){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

    // periodic events flush (crash safety)
    if(elapsedSec() - evFlushT > 2.0){
      evFlushT = elapsedSec();
      try{
        saveJson(LS_EVENTS, { meta: buildEventsMeta(), events: events.slice(-900) }); // keep last 900
      }catch(_){}
    }

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

    soapShield=0;
    soapPicked=0;

    bossActive=false;
    bossPhase=0;
    bossTimeLeft=0;
    bossSoapNeed=0;
    bossSoapGot=0;
    bossClears=0;
    bossFails=0;

    events.length = 0;
    evFlushT = 0;

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    currentSessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    pushEvent('start', { sessionId: currentSessionId, runMode, diff, seed, view, timePlannedSec });
    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, sessionId: currentSessionId });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();

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

    // grade (simple)
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const summary = {
      version:'1.0.0-prod+AN',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId: currentSessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      soapPicked,
      soapShieldEnd: soapShield,

      bossPhaseMax: bossPhase,
      bossClears,
      bossFails,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),

      medianStepMs: rtMed
    };

    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras());
    if(dd?.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras());

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    // save last + history
    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    // end event + flush pack
    pushEvent('end', { reason, grade, misses: getMissCount(), loopsDone, hazHits, soapPicked, bossClears, bossFails });
    try{
      saveJson(LS_EVENTS, { meta: buildEventsMeta(), events: events.slice(0) });
    }catch(_){}

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (MISS เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone} • boss clears ${bossClears}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{
    resetGame();
    showBanner('รีเซ็ตแล้ว');
    pushEvent('reset', {});
    try{ saveJson(LS_EVENTS, { meta: buildEventsMeta(), events: events.slice(0) }); }catch(_){}
  }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
    pushEvent('pause_toggle', { paused: paused ? 1 : 0 });
  }, { passive:true });

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // safety flush on background
  WIN.addEventListener('pagehide', ()=>{ try{ saveJson(LS_EVENTS, { meta: buildEventsMeta(), events }); }catch(_){ } });
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      try{ saveJson(LS_EVENTS, { meta: buildEventsMeta(), events }); }catch(_){ }
    }
  });

  // optional particles / coach
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  setHud();
}