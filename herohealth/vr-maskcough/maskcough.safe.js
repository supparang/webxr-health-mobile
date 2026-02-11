// === /herohealth/vr-maskcough/maskcough.safe.js ===
// MaskCoughVR SAFE — v1.0.1 (PRODUCTION PATCH)
// ✅ CONFIG_BY_DIFF (real tuning)
// ✅ research mode locks AI adaptation
// ✅ frontTouch uses real hitbox (no random triggers)
// ✅ Perfect Gate: 3 PERFECT COVER streak => bonus
// ✅ Fake COVER prompt once in Phase 3 (trap) — pressed cover => penalty
// ✅ Logging (events/sessions) + deterministic seed + end summary + back hub + flush-hardened

(function(){
  'use strict';
  const WIN = window, DOC = document;

  // --------------------------
  // DOM refs
  // --------------------------
  const qs = (s)=>DOC.querySelector(s);
  const elWrap = qs('#mc-wrap');
  const elLayer = qs('#mc-layer');
  const elPrompt = qs('#mc-prompt');
  const elFlash = qs('#mc-flash');

  const elScore = qs('#mc-score');
  const elCombo = qs('#mc-combo');
  const elMiss = qs('#mc-miss');
  const elMaskFit = qs('#mc-maskfit');
  const elMaskFitFill = qs('#mc-maskfit-fill');
  const elExposure = qs('#mc-exposure');
  const elExposureFill = qs('#mc-exposure-fill');
  const elTime = qs('#mc-time');

  const btnStart = qs('#mc-btn-start');
  const btnPause = qs('#mc-btn-pause');
  const btnRetry = qs('#mc-btn-retry');
  const btnCover = qs('#mc-btn-cover');

  const elEnd = qs('#mc-end');
  const endScore = qs('#mc-end-score');
  const endCombo = qs('#mc-end-combo');
  const endMiss = qs('#mc-end-miss');
  const endMaskFit = qs('#mc-end-maskfit');
  const endExposure = qs('#mc-end-exposure');
  const endChoice = qs('#mc-end-choice');
  const endNote = qs('#mc-end-note');
  const btnEndBack = qs('#mc-end-back');
  const btnEndClose = qs('#mc-end-close');

  // --------------------------
  // helpers
  // --------------------------
  const now = ()=>performance.now();
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const pick = (arr, rand)=>arr[Math.floor(rand()*arr.length)];
  const fmtPct = (v)=>String(Math.round(v))+'%';

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);

  function deviceTag(){
    const v = (q('view','pc')||'pc').toLowerCase();
    if(v==='cvr') return 'cvr';
    if(v==='vr') return 'vr';
    if(v==='mobile') return 'mobile';
    return 'pc';
  }

  // --------------------------
  // Seeded RNG (mulberry32)
  // --------------------------
  function toU32(x){
    const n = Number(x);
    if(Number.isFinite(n)) return (n >>> 0);
    const s = String(x||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed){
    let a = (seed >>> 0);
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --------------------------
  // Context
  // --------------------------
  const CTX = WIN.HHA_CTX || {
    projectTag:'HHA_MASKCOUGH',
    hub: q('hub',''),
    view: (q('view','pc')||'pc'),
    diff: (q('diff','normal')||'normal'),
    mode: (q('mode','play')||'play'),
    timeSec: Number(q('time','75')||75),
    seed: String(q('seed','')||Date.now()),
    log: q('log',''),
    studyId: q('studyId',''),
    phase: q('phase',''),
    conditionGroup: q('conditionGroup',''),
    pid: q('pid','') || q('studentKey',''),
    reason: q('reason',''),
  };

  const GAME_VERSION = 'maskcough.safe.js v1.0.1';
  const SEED_U32 = toU32(CTX.seed);
  const RAND = mulberry32(SEED_U32);

  function normMode(){
    const m = String(CTX.mode||'play').toLowerCase();
    return (m==='research'||m==='practice'||m==='play') ? m : 'play';
  }
  const MODE = normMode();
  const DIFF = String(CTX.diff||'normal').toLowerCase();
  const DIFF_KEY = (DIFF==='easy'||DIFF==='hard'||DIFF==='normal') ? DIFF : 'normal';

  // --------------------------
  // REAL TUNING CONFIG
  // --------------------------
  const CONFIG_BY_DIFF = {
    easy: {
      timeDefault: 75,
      waveAllowP: 0.78,
      choiceP: 0.22,
      coverWinOff: 0.16,
      coverWinOn: 0.24,
      waveHitBase: [9, 12],
      choiceBadBase: [7, 9],
      frontTouchBase: [6, 8],
      decayBasePctPerSec: 0.45,
      decayPhaseAdd: 0.14,
      shieldMs: 6500,
      tissueMs: 6500,
      cleanHandsChargesOnPickup: 1,
      pickupChance: 0.26,
      perfectGateNeed: 3,
      perfectGateBonusScore: 160,
      perfectGateBonusTimeSec: 5,
      fakeCoverEnabled: false,
      choiceTLimitMs: 3000,
    },
    normal: {
      timeDefault: 75,
      waveAllowP: 0.82,
      choiceP: 0.26,
      coverWinOff: 0.14,
      coverWinOn: 0.22,
      waveHitBase: [10, 14],
      choiceBadBase: [7, 10],
      frontTouchBase: [6, 9],
      decayBasePctPerSec: 0.60,
      decayPhaseAdd: 0.18,
      shieldMs: 6500,
      tissueMs: 6500,
      cleanHandsChargesOnPickup: 1,
      pickupChance: 0.22,
      perfectGateNeed: 3,
      perfectGateBonusScore: 200,
      perfectGateBonusTimeSec: 5,
      fakeCoverEnabled: true,
      choiceTLimitMs: 2400,
    },
    hard: {
      timeDefault: 75,
      waveAllowP: 0.88,
      choiceP: 0.30,
      coverWinOff: 0.12,
      coverWinOn: 0.19,
      waveHitBase: [12, 16],
      choiceBadBase: [8, 12],
      frontTouchBase: [7, 10],
      decayBasePctPerSec: 0.85,
      decayPhaseAdd: 0.22,
      shieldMs: 5500,
      tissueMs: 6500,
      cleanHandsChargesOnPickup: 1,
      pickupChance: 0.18,
      perfectGateNeed: 3,
      perfectGateBonusScore: 220,
      perfectGateBonusTimeSec: 4,
      fakeCoverEnabled: true,
      choiceTLimitMs: 1900,
    }
  };
  const CFG = CONFIG_BY_DIFF[DIFF_KEY];

  // --------------------------
  // AI hooks (safe) + research lock
  // --------------------------
  function makeAIStub(){
    return {
      getDifficulty: ()=>null,
      getTip: ()=>null,
      onEvent: ()=>{},
    };
  }
  const AI_RAW = (WIN.HHA && typeof WIN.HHA.createAIHooks==='function')
    ? (WIN.HHA.createAIHooks({ game:'maskcough', seed: SEED_U32, mode: MODE }) || makeAIStub())
    : makeAIStub();

  // research mode: lock adaptation (still allow tips/events logging)
  const AI = {
    onEvent: (ev)=>{ try{ AI_RAW.onEvent(ev); }catch(_){} },
    getTip: (ctx)=>{ try{ return AI_RAW.getTip(ctx); }catch(_){ return null; } },
    getDifficulty: (metrics)=>{
      if(MODE==='research') return null; // ✅ lock adaptation
      try{ return AI_RAW.getDifficulty(metrics); }catch(_){ return null; }
    }
  };

  // --------------------------
  // Logger (events + sessions)
  // --------------------------
  const LOG_ENDPOINT = (CTX.log||'').trim();
  const LOGQ = [];
  let FLUSHING = false;

  function isoNow(){ return new Date().toISOString(); }

  const STATE = {
    running:false, paused:false, ended:false,
    startAtIso:'', startT:0, lastT:0,
    tLeft: clamp(Number(CTX.timeSec||CFG.timeDefault), 30, 180),

    sessionId:'',
    score:0, combo:0, comboMax:0, misses:0,

    maskFitPct:0, maskFitSum:0, maskFitSamples:0, maskFitMin:100,
    maskFrontTouchCount:0,

    exposure:0, exposureMax:0,

    coverPerfect:0, coverGood:0, coverLate:0,
    perfectStreak:0, // ✅ Perfect Gate
    perfectGateFired:false,

    choiceTotal:0, choiceCorrect:0, choiceRT:[],

    waveSpawned:0, waveCleared:0, waveHit:0, nearMissCount:0,

    shieldActiveUntil:0,
    tissueActiveUntil:0,
    cleanHandsCharges:0,
    nShieldSpawned:0, nTissueSpawned:0, nCleanHandsSpawned:0,

    nodes:{ nose:'loose', left:'loose', right:'loose' },

    curWave:null,
    curPrompt:null,

    bossPhase:0, bossPhaseAt:0,

    dodgeX:0, dodgeTargetX:0,

    __ai:null,

    // ✅ Fake cover trap
    fakeCoverArmed:false,
    fakeCoverUsed:false,
    fakeCoverUntil:0,
  };

  function baseEvent(){
    return {
      timestampIso: isoNow(),
      projectTag: CTX.projectTag || 'HHA_MASKCOUGH',
      runMode: MODE,
      studyId: CTX.studyId || '',
      phase: CTX.phase || '',
      conditionGroup: CTX.conditionGroup || '',
      sessionId: STATE.sessionId || '',
      device: deviceTag(),
      view: (CTX.view||''),
      diff: DIFF_KEY,
      seed: String(CTX.seed||''),
      gameVersion: GAME_VERSION,
    };
  }

  function pushEvent(eventType, game, data){
    const ev = Object.assign(baseEvent(), {
      eventType,
      game: game || 'maskcough',
      __data: data || {},
    });
    LOGQ.push(ev);
    try{ AI.onEvent(ev); }catch(_){}
  }

  async function postJSON(url, payload){
    try{
      const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
      if(navigator.sendBeacon){
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return true;
      }
    }catch(_){}
    try{
      await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return true;
    }catch(_){
      return false;
    }
  }

  async function flush(reason){
    if(!LOG_ENDPOINT) return;
    if(FLUSHING) return;
    if(!LOGQ.length) return;
    FLUSHING = true;
    const batch = LOGQ.splice(0, LOGQ.length);
    await postJSON(LOG_ENDPOINT, { reason: reason||'flush', batch });
    FLUSHING = false;
  }

  WIN.HHA_MASKCOUGH = WIN.HHA_MASKCOUGH || {};
  WIN.HHA_MASKCOUGH.flush = flush;

  // --------------------------
  // UI helpers
  // --------------------------
  let PROMPT_TIMER = 0;
  function showPrompt(text, ms){
    if(!elPrompt) return;
    elPrompt.textContent = text || '';
    elPrompt.classList.add('show');
    clearTimeout(PROMPT_TIMER);
    PROMPT_TIMER = setTimeout(()=>elPrompt.classList.remove('show'), ms || 900);
  }
  function flashBad(){
    if(!elFlash) return;
    elFlash.style.opacity = '1';
    setTimeout(()=>{ elFlash.style.opacity = '0'; }, 180);
  }
  function setBar(elFill, elVal, v){
    const pct = clamp(v,0,100);
    if(elFill) elFill.style.width = pct.toFixed(1) + '%';
    if(elVal) elVal.textContent = fmtPct(pct);
  }
  function updateHUD(){
    if(elScore) elScore.textContent = String(Math.round(STATE.score));
    if(elCombo) elCombo.textContent = String(STATE.combo);
    if(elMiss) elMiss.textContent = String(STATE.misses);
    setBar(elMaskFitFill, elMaskFit, STATE.maskFitPct);
    setBar(elExposureFill, elExposure, STATE.exposure);
    if(elTime) elTime.textContent = String(Math.max(0, Math.ceil(STATE.tLeft)));
  }

  // --------------------------
  // Mask Fit System
  // --------------------------
  function nodePoints(level){
    if(level==='perfect') return 35;
    if(level==='ok') return 20;
    return 0;
  }
  function calcMaskFitPct(){
    const v = nodePoints(STATE.nodes.nose) + nodePoints(STATE.nodes.left) + nodePoints(STATE.nodes.right);
    return clamp((v/105)*100, 0, 100);
  }

  function addScore(v, keepCombo){
    STATE.score += v;
    if(keepCombo){
      STATE.combo += 1;
      if(STATE.combo > STATE.comboMax) STATE.comboMax = STATE.combo;
    }
  }

  function addExposure(v, cause){
    const mult = 1.0 + (1.0 - (STATE.maskFitPct/100)) * 0.8;
    let dmg = v * mult;
    if(now() < STATE.shieldActiveUntil) dmg *= 0.35;

    STATE.exposure = clamp(STATE.exposure + dmg, 0, 100);
    if(STATE.exposure > STATE.exposureMax) STATE.exposureMax = STATE.exposure;

    pushEvent('exposure:add','maskcough',{ delta:+dmg.toFixed(2), base:v, mult:+mult.toFixed(2), cause:cause||'' });

    if(STATE.exposure >= 100) endGame('exposure_full');
  }

  function upgradeNode(name){
    const prev = STATE.nodes[name];
    const next = (prev==='loose') ? 'ok' : (prev==='ok') ? 'perfect' : 'perfect';
    if(prev === next) return;
    STATE.nodes[name] = next;

    STATE.maskFitPct = calcMaskFitPct();

    const gain = (next==='ok') ? 40 : 70;
    addScore(gain, true);

    pushEvent('mask:fit','maskcough',{ node:name, from:prev, to:next, maskFitPct: STATE.maskFitPct });
    showPrompt(`✅ ปรับหน้ากาก: ${name.toUpperCase()} → ${next}`, 700);
  }

  // ✅ frontTouch only via real hitbox
  function frontTouch(){
    const forgiven = (STATE.cleanHandsCharges > 0);
    if(forgiven){
      STATE.cleanHandsCharges -= 1;
      pushEvent('mask:touch','maskcough',{ type:'front', forgiven:true, cleanHandsCharges: STATE.cleanHandsCharges });
      showPrompt('✨ Clean Hands กันพลาดจับด้านหน้า!', 900);
      return;
    }
    STATE.maskFrontTouchCount += 1;
    STATE.misses += 1;
    STATE.combo = 0;

    const base = CFG.frontTouchBase[0] + RAND()*(CFG.frontTouchBase[1]-CFG.frontTouchBase[0]);
    addExposure(base, 'front_touch');

    pushEvent('mask:touch','maskcough',{ type:'front', forgiven:false });
    showPrompt('❌ จับด้านหน้าหน้ากาก! (ควรจับสายคล้อง)', 1100);
    flashBad();

    try{
      const tip = AI.getTip({ type:'front_touch' });
      if(tip && tip.text) pushEvent('ai:tip','maskcough',{ tipId: tip.id||'front_touch', category:'mask', shown:true, text: tip.text });
    }catch(_){}
  }

  function decayMaskFit(dt){
    if(now() < STATE.shieldActiveUntil) return;

    const phase = STATE.bossPhase;
    let rate = CFG.decayBasePctPerSec + phase*CFG.decayPhaseAdd;

    // AI decay mul if enabled (not in research)
    const decayMul = aiMul('decayMul', 1.0);
    rate *= decayMul;

    const dec = rate * (dt/1000);
    if(dec <= 0) return;

    // degrade probabilistically
    const p = (dec/2.0);
    if(RAND() < p){
      const keys = ['nose','left','right'];
      const name = pick(keys, RAND);
      const cur = STATE.nodes[name];
      if(cur==='perfect') STATE.nodes[name] = 'ok';
      else if(cur==='ok') STATE.nodes[name] = 'loose';
    }
    STATE.maskFitPct = calcMaskFitPct();
  }

  // --------------------------
  // AI Difficulty (fair, capped)
  // --------------------------
  function computeMedian(arr){
    const a = arr.slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = a.length>>1;
    return (a.length%2)?a[m]:(a[m-1]+a[m])/2;
  }

  function difficultyMetrics(){
    const tPlayed = (STATE.startT ? (now()-STATE.startT)/1000 : 0);
    const choiceAcc = STATE.choiceTotal ? (STATE.choiceCorrect/STATE.choiceTotal) : 0;
    const waveAcc = STATE.waveSpawned ? (STATE.waveCleared/STATE.waveSpawned) : 0;
    const missRate = (tPlayed>0) ? (STATE.misses / tPlayed) : 0;
    const medianRT = computeMedian(STATE.choiceRT);

    return {
      tPlayedSec: +tPlayed.toFixed(1),
      maskFitPct: +STATE.maskFitPct.toFixed(1),
      exposure: +STATE.exposure.toFixed(1),
      choiceAcc: +choiceAcc.toFixed(3),
      waveAcc: +waveAcc.toFixed(3),
      missRate: +missRate.toFixed(3),
      medianRtChoiceMs: Math.round(medianRT||0),
      combo: STATE.combo,
      comboMax: STATE.comboMax,
    };
  }

  function clampAI(next){
    // Caps for fairness
    const cur = STATE.__ai || { waveSpeedMul:1, gapMul:1, decayMul:1, pickupMul:1 };
    const out = Object.assign({}, cur, next||{});

    const cap = (v,a,b)=>clamp(Number(v||1), a, b);
    out.waveSpeedMul = cap(out.waveSpeedMul, 0.90, 1.15);
    out.gapMul       = cap(out.gapMul,       0.85, 1.20);
    out.decayMul     = cap(out.decayMul,     0.90, 1.20);
    out.pickupMul    = cap(out.pickupMul,    0.90, 1.15);

    // Smooth step (max delta)
    const step = (a,b)=>clamp(b, a-0.05, a+0.05);
    out.waveSpeedMul = step(cur.waveSpeedMul, out.waveSpeedMul);
    out.gapMul       = step(cur.gapMul,       out.gapMul);
    out.decayMul     = step(cur.decayMul,     out.decayMul);
    out.pickupMul    = step(cur.pickupMul,    out.pickupMul);

    return out;
  }

  function maybeApplyAIDifficulty(){
    let out = null;
    try{ out = AI.getDifficulty(difficultyMetrics()); }catch(_){}
    if(!out) return;
    STATE.__ai = clampAI(out);
    pushEvent('ai:diff','maskcough',{ next: STATE.__ai, metrics: difficultyMetrics() });
  }

  function aiMul(k, def=1.0){
    return (STATE.__ai && Number.isFinite(STATE.__ai[k])) ? STATE.__ai[k] : def;
  }

  // --------------------------
  // Waves
  // --------------------------
  const WAVE_TYPES = ['single','double','sweep','cone_drop'];

  function spawnWave(){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const phase = STATE.bossPhase;
    let pool = WAVE_TYPES.slice();
    if(DIFF_KEY==='easy') pool = ['single','double','sweep'];
    if(DIFF_KEY==='hard') pool = ['single','double','sweep','cone_drop','sweep'];
    if(phase>=2) pool.push('cone_drop');
    if(phase>=3) pool.push('sweep','cone_drop');

    const waveType = pick(pool, RAND);
    const dir = pick(['L','R','C'], RAND);

    let speed = (DIFF_KEY==='easy') ? 0.85 : (DIFF_KEY==='hard') ? 1.15 : 1.0;
    speed *= aiMul('waveSpeedMul', 1.0);

    let width = (waveType==='cone_drop') ? 0.72 : (waveType==='sweep') ? 0.60 : 0.45;
    if(DIFF_KEY==='easy') width -= 0.08;
    if(DIFF_KEY==='hard') width += 0.06;

    const uid = `w_${Date.now().toString(36)}_${Math.floor(RAND()*1e6).toString(36)}`;

    const coverWin = (now() < STATE.tissueActiveUntil) ? CFG.coverWinOn : CFG.coverWinOff;

    const wave = {
      uid,
      type: waveType,
      dir,
      speed,
      width,
      t0: now(),
      ttl: (waveType==='sweep') ? 1300 : (waveType==='double') ? 1200 : 1050,
      coverAt: 0.52,
      coverWin,
    };
    STATE.curWave = wave;
    STATE.waveSpawned += 1;

    if(elLayer){
      const w = DOC.createElement('div');
      w.className = 'mc-wave';
      w.dataset.uid = uid;
      w.dataset.type = waveType;
      w.style.position = 'absolute';
      w.style.top = (10 + RAND()*70) + '%';
      w.style.left = (dir==='L') ? '-20%' : (dir==='R') ? '120%' : '50%';
      w.style.transform = (dir==='C') ? 'translateX(-50%)' : 'none';
      w.style.width = Math.round(width*100) + 'vw';
      w.style.height = '46px';
      w.style.borderRadius = '999px';
      w.style.border = '1px solid rgba(239,68,68,.32)';
      w.style.background = 'rgba(239,68,68,.14)';
      w.style.filter = 'blur(.2px)';
      w.style.pointerEvents = 'none';
      elLayer.appendChild(w);
      wave.__el = w;
    }

    pushEvent('cough:wave_spawn','maskcough',{ uid, waveType, dir, speed:+speed.toFixed(2), width:+width.toFixed(2), bossPhase: phase });
  }

  function resolveWave(result, extra){
    const w = STATE.curWave;
    if(!w) return;
    STATE.curWave = null;

    if(w.__el && w.__el.parentNode) w.__el.parentNode.removeChild(w.__el);

    if(result==='cleared'){
      STATE.waveCleared += 1;
      addScore(55, true);
      // cleared without perfect doesn't affect perfect streak
    }else if(result==='guard'){
      addScore(40, true);
    }else{
      STATE.waveHit += 1;
      STATE.misses += 1;
      STATE.combo = 0;

      const base = CFG.waveHitBase[0] + RAND()*(CFG.waveHitBase[1]-CFG.waveHitBase[0]);
      addExposure(base, 'wave_hit');
      flashBad();

      // break perfect streak
      STATE.perfectStreak = 0;
    }

    pushEvent('cough:wave_result','maskcough', Object.assign({
      uid: w.uid, waveType: w.type, result
    }, extra||{}));
  }

  function judgeDodge(){
    const w = STATE.curWave;
    if(!w) return;

    const t = (now() - w.t0) / w.ttl;
    if(t >= 1){
      const shield = (now() < STATE.shieldActiveUntil);
      resolveWave(shield ? 'guard' : 'hit', { timedOut:true });
      return;
    }

    if(w.__el){
      const dir = w.dir;
      let x = 0;
      if(dir==='L') x = -20 + t*140;
      else if(dir==='R') x = 120 - t*140;
      else x = 50;
      w.__el.style.left = x + '%';
      w.__el.style.opacity = String(0.35 + 0.55*(1-t));
    }

    const safe = (w.dir==='L') ? 0.6 : (w.dir==='R') ? -0.6 : (RAND()<0.5?-0.5:0.5);
    const dist = Math.abs(STATE.dodgeX - safe);
    const hitThreshold = 0.35 + (w.width*0.15);
    const near = 0.48;

    const impact = Math.abs(t - w.coverAt) < 0.07;
    if(impact){
      if(dist <= hitThreshold){
        const shield = (now() < STATE.shieldActiveUntil);
        resolveWave(shield ? 'guard' : 'hit', { dist:+dist.toFixed(2), dodgeX:+STATE.dodgeX.toFixed(2) });
      }else{
        if(dist < near){
          STATE.nearMissCount += 1;
          addScore(15, true);
          pushEvent('cough:near_miss','maskcough',{ uid:w.uid, dist:+dist.toFixed(2) });
        }
        resolveWave('cleared', { dist:+dist.toFixed(2), dodgeX:+STATE.dodgeX.toFixed(2) });
      }
    }
  }

  // --------------------------
  // ✅ Fake COVER trap (Phase 3 once)
  // --------------------------
  function armFakeCoverIfNeeded(){
    if(!CFG.fakeCoverEnabled) return;
    if(STATE.fakeCoverUsed) return;
    if(STATE.bossPhase !== 3) return;
    if(STATE.fakeCoverArmed) return;

    // arm once, trigger after short delay into phase 3
    STATE.fakeCoverArmed = true;
    const delay = 5200; // ~5s into phase 3
    setTimeout(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(STATE.fakeCoverUsed) return;
      // open a trap window
      STATE.fakeCoverUntil = now() + 1200;
      showPrompt('⚠️ COVER NOW!', 900); // intentionally misleading
      pushEvent('boss:fake_cover','maskcough',{ armed:true, windowMs:1200 });
    }, delay);
  }

  // Cover timing action
  function doCover(){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    // trap check
    if(STATE.fakeCoverUntil && now() < STATE.fakeCoverUntil && !STATE.fakeCoverUsed){
      STATE.fakeCoverUsed = true;
      STATE.fakeCoverUntil = 0;

      STATE.misses += 1;
      STATE.combo = 0;
      const base = CFG.choiceBadBase[0] + RAND()*(CFG.choiceBadBase[1]-CFG.choiceBadBase[0]);
      addExposure(base, 'fake_cover_trap');
      flashBad();

      pushEvent('cough:cover','maskcough',{ timing:'trap', trap:true });
      showPrompt('❌ หลอก! (บางคลื่นควร “หลบ” ไม่ใช่ COVER)', 1200);

      try{
        const tip = AI.getTip({ type:'fake_cover_trap' });
        if(tip && tip.text) pushEvent('ai:tip','maskcough',{ tipId: tip.id||'fake_cover', category:'boss', shown:true, text: tip.text });
      }catch(_){}
      return;
    }

    const w = STATE.curWave;
    const tNow = now();

    if(!w){
      showPrompt('✋ COVER (ไม่มีคลื่นตอนนี้)', 650);
      pushEvent('cough:cover','maskcough',{ timing:'none', windowMs:0 });
      return;
    }

    const t = (tNow - w.t0) / w.ttl;
    const dt = Math.abs(t - w.coverAt);
    const win = w.coverWin;

    let timing = 'late';
    if(dt <= win*0.45) timing = 'perfect';
    else if(dt <= win) timing = 'good';

    if(timing==='perfect'){
      STATE.coverPerfect += 1;
      addScore(80, true);

      // ✅ Perfect Gate streak
      STATE.perfectStreak += 1;

      resolveWave('cleared', { coverTiming: timing });
      showPrompt('✨ PERFECT COVER!', 800);

      // ✅ Perfect Gate fire once per session (or you can allow repeat by removing perfectGateFired guard)
      if(!STATE.perfectGateFired && STATE.perfectStreak >= CFG.perfectGateNeed){
        STATE.perfectGateFired = true;
        STATE.tLeft = clamp(STATE.tLeft + CFG.perfectGateBonusTimeSec, 0, 180);
        addScore(CFG.perfectGateBonusScore, true);
        pushEvent('gate:perfect','maskcough',{
          streak: STATE.perfectStreak,
          bonusTimeSec: CFG.perfectGateBonusTimeSec,
          bonusScore: CFG.perfectGateBonusScore
        });
        showPrompt(`🏆 PERFECT GATE! +${CFG.perfectGateBonusTimeSec}s +${CFG.perfectGateBonusScore} คะแนน`, 1200);
      }

    }else if(timing==='good'){
      STATE.coverGood += 1;
      addScore(55, true);
      // good breaks perfect streak
      STATE.perfectStreak = 0;
      resolveWave('cleared', { coverTiming: timing });
      showPrompt('✅ Good cover', 650);
    }else{
      STATE.coverLate += 1;
      addScore(10, true);
      // late breaks perfect streak
      STATE.perfectStreak = 0;
      showPrompt('⏳ ช้าไปนิด', 650);
    }

    pushEvent('cough:cover','maskcough',{ timing, t:+t.toFixed(3), coverAt:w.coverAt, win:+win.toFixed(3) });
  }

  // --------------------------
  // Choice prompts
  // --------------------------
  const PROMPTS = [
    { id:'dist_back', text:'เพื่อนถอดหน้ากากคุยใกล้ ๆ → ทำไง?', a:['ถอย 1 ก้าว','เฉย ๆ'], correct:0, domain:'distance' },
    { id:'mask_touch', text:'จะปรับหน้ากาก → จับตรงไหน?', a:['จับด้านหน้า','จับสายคล้อง'], correct:1, domain:'mask' },
    { id:'cough_elbow', text:'ไอ/จาม → วิธีถูกคือ?', a:['ใส่มือ','ข้อพับแขน'], correct:1, domain:'cough' },
    { id:'tissue_bin', text:'ใช้ทิชชู่แล้ว → ทำต่อ?', a:['ทิ้งลงถัง','เก็บไว้ในกระเป๋า'], correct:0, domain:'tissue' },
  ];

  function spawnChoice(){
    if(!STATE.running || STATE.paused || STATE.ended) return;
    if(STATE.curPrompt) return;

    const p = pick(PROMPTS, RAND);
    const tLimit = CFG.choiceTLimitMs;

    const prompt = {
      id: p.id,
      text: p.text,
      a: p.a.slice(),
      correct: p.correct,
      domain: p.domain,
      t0: now(),
      tLimit,
    };
    STATE.curPrompt = prompt;
    STATE.choiceTotal += 1;

    showPrompt(`${p.text}  [แตะซ้าย/ขวา]`, 1200);
    pushEvent('choice:prompt','maskcough',{ promptId:p.id, domain:p.domain, tLimitMs:tLimit });

    setTimeout(()=>{
      if(STATE.curPrompt && STATE.curPrompt.id === prompt.id){
        answerChoice(-1);
      }
    }, tLimit + 30);
  }

  function answerChoice(index){
    const pr = STATE.curPrompt;
    if(!pr) return;
    STATE.curPrompt = null;

    const rt = Math.max(0, now() - pr.t0);
    const correct = (index === pr.correct);
    const timeout = (index < 0);

    if(timeout){
      STATE.misses += 1;
      STATE.combo = 0;
      const base = CFG.choiceBadBase[0] + RAND()*(CFG.choiceBadBase[1]-CFG.choiceBadBase[0]);
      addExposure(base, 'choice_timeout');
      flashBad();
      showPrompt('⏱ หมดเวลา!', 850);
      STATE.perfectStreak = 0;
    }else if(correct){
      STATE.choiceCorrect += 1;
      STATE.choiceRT.push(rt);
      addScore(60, true);
      showPrompt('✅ ถูกต้อง!', 650);
    }else{
      STATE.misses += 1;
      STATE.combo = 0;
      const base = CFG.choiceBadBase[0] + RAND()*(CFG.choiceBadBase[1]-CFG.choiceBadBase[0]);
      addExposure(base, 'choice_wrong');
      flashBad();
      showPrompt('❌ ยังไม่ถูก', 750);
      STATE.perfectStreak = 0;
    }

    pushEvent('choice:answer','maskcough',{
      promptId: pr.id,
      answerId: index,
      correct: !!correct,
      timeout: !!timeout,
      rtMs: Math.round(rt),
    });

    try{
      const tip = AI.getTip({ type:'choice', promptId: pr.id, correct: !!correct, timeout: !!timeout });
      if(tip && tip.text){
        pushEvent('ai:tip','maskcough',{ tipId: tip.id||pr.id, category:'choice', shown:true, text: tip.text });
      }
    }catch(_){}
  }

  // --------------------------
  // Powerups (seeded)
  // --------------------------
  function spawnPickup(){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    let p = CFG.pickupChance * aiMul('pickupMul', 1.0);
    if(RAND() > p) return;

    const type = pick(['shield','tissue','cleanhands'], RAND);
    const uid = `p_${Date.now().toString(36)}_${Math.floor(RAND()*1e6).toString(36)}`;

    const x = 12 + RAND()*76;
    const y = 22 + RAND()*58;

    if(elLayer){
      const e = DOC.createElement('button');
      e.className = 'mc-pickup';
      e.type = 'button';
      e.dataset.uid = uid;
      e.dataset.type = type;
      e.textContent = (type==='shield')?'🛡':(type==='tissue')?'🧻':'✨';
      e.style.position='absolute';
      e.style.left=x+'%';
      e.style.top=y+'%';
      e.style.transform='translate(-50%,-50%)';
      e.style.width='54px';
      e.style.height='54px';
      e.style.borderRadius='18px';
      e.style.border='1px solid rgba(148,163,184,.20)';
      e.style.background='rgba(15,23,42,.55)';
      e.style.color='#e5e7eb';
      e.style.fontSize='22px';
      e.style.cursor='pointer';
      e.style.pointerEvents = (deviceTag()==='cvr') ? 'none' : 'auto';
      elLayer.appendChild(e);

      const ttl = 2400;
      const t0 = now();
      const tick = ()=>{
        if(!e.isConnected) return;
        const t = now()-t0;
        e.style.opacity = String(1 - (t/ttl)*0.65);
        if(t >= ttl){ e.remove(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      e.addEventListener('click', ()=>{
        pickup(type, uid);
        e.remove();
      }, {passive:true});

      if(type==='shield') STATE.nShieldSpawned += 1;
      if(type==='tissue') STATE.nTissueSpawned += 1;
      if(type==='cleanhands') STATE.nCleanHandsSpawned += 1;

      pushEvent('pickup:spawn','maskcough',{ type, uid, x:+x.toFixed(1), y:+y.toFixed(1) });
    }
  }

  function pickup(type, uid){
    const tNow = now();
    if(type==='shield'){
      STATE.shieldActiveUntil = Math.max(STATE.shieldActiveUntil, tNow + CFG.shieldMs);
      showPrompt('🛡 Shield Clip: กันโดน + หน้ากากไม่คลาย!', 1000);
    }else if(type==='tissue'){
      STATE.tissueActiveUntil = Math.max(STATE.tissueActiveUntil, tNow + CFG.tissueMs);
      showPrompt('🧻 Tissue Pack: จังหวะ COVER ง่ายขึ้น!', 1000);
    }else{
      STATE.cleanHandsCharges += CFG.cleanHandsChargesOnPickup;
      showPrompt('✨ Clean Hands: กันพลาดจับด้านหน้า 1 ครั้ง', 1000);
    }
    addScore(35, true);
    pushEvent('pickup','maskcough',{ type, uid });
  }

  // --------------------------
  // Boss phases
  // --------------------------
  function maybeAdvanceBoss(){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const tPlayed = (now()-STATE.startT)/1000;
    const p = (tPlayed < 25) ? 1 : (tPlayed < 50) ? 2 : 3;
    if(p !== STATE.bossPhase){
      STATE.bossPhase = p;
      STATE.bossPhaseAt = now();
      pushEvent('boss:phase','maskcough',{ phase:p });
      showPrompt(p===1?'😷 Phase 1: อุ่นเครื่อง':p===2?'🔥 Phase 2: เร็วขึ้น!':'⚡ Phase 3: ระวังคลื่นหนัก!', 1100);
      if(p===3) armFakeCoverIfNeeded(); // ✅
    }
  }

  // --------------------------
  // Input
  // --------------------------
  function setDodgeTarget(x){ STATE.dodgeTargetX = clamp(x, -1, 1); }

  WIN.addEventListener('keydown', (ev)=>{
    if(!STATE.running || STATE.paused || STATE.ended) return;
    if(ev.key==='ArrowLeft' || ev.key==='a' || ev.key==='A') setDodgeTarget(-0.8);
    if(ev.key==='ArrowRight'|| ev.key==='d' || ev.key==='D') setDodgeTarget(0.8);
    if(ev.key==='ArrowDown'|| ev.key==='s' || ev.key==='S') setDodgeTarget(0);
    if(ev.key===' '){
      ev.preventDefault();
      doCover();
    }
    if(ev.key==='1') answerChoice(0);
    if(ev.key==='2') answerChoice(1);
  }, {capture:true});

  let touch0 = null;
  WIN.addEventListener('touchstart', (ev)=>{
    if(!ev.touches || !ev.touches.length) return;
    const t = ev.touches[0];
    touch0 = { x:t.clientX, y:t.clientY, t: now() };
  }, {passive:true});
  WIN.addEventListener('touchend', (ev)=>{
    if(!touch0) return;
    const t1 = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0] : null;
    if(!t1){ touch0=null; return; }
    const dx = t1.clientX - touch0.x;
    const dy = t1.clientY - touch0.y;

    if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)){
      setDodgeTarget(dx>0 ? 0.8 : -0.8);
    }

    const dt = now() - touch0.t;
    if(dt < 250 && Math.abs(dx) < 12 && Math.abs(dy) < 12){
      const w = WIN.innerWidth || 1;
      if(STATE.curPrompt){
        answerChoice(t1.clientX < w/2 ? 0 : 1);
      }
    }
    touch0 = null;
  }, {passive:true});

  if(btnCover) btnCover.addEventListener('click', doCover, {passive:true});
  if(btnStart) btnStart.addEventListener('click', ()=>startGame(), {passive:true});
  if(btnPause) btnPause.addEventListener('click', ()=>togglePause(), {passive:true});
  if(btnRetry) btnRetry.addEventListener('click', ()=>restart(), {passive:true});

  if(btnEndClose) btnEndClose.addEventListener('click', ()=>{ if(elEnd) elEnd.hidden=true; }, {passive:true});
  if(btnEndBack) btnEndBack.addEventListener('click', ()=>backHub(), {passive:true});

  // VR UI shoot
  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;
    shootAt(x,y);
  });

  // --------------------------
  // Render nodes + REAL frontTouch hitbox
  // --------------------------
  function renderNodes(){
    if(!elLayer) return;

    // clear old
    elLayer.querySelectorAll('.mc-node,.mc-facehit').forEach(n=>n.remove());

    // ✅ Face hitbox (click/touch on front of mask)
    const face = DOC.createElement('button');
    face.type = 'button';
    face.className = 'mc-facehit';
    face.dataset.type = 'facehit';
    face.setAttribute('aria-label','หน้ากากด้านหน้า (ห้ามจับ)');
    face.style.position = 'absolute';
    face.style.left = '50%';
    face.style.top = '32%';
    face.style.transform = 'translate(-50%,-50%)';
    face.style.width = '180px';
    face.style.height = '140px';
    face.style.borderRadius = '28px';
    face.style.border = '1px dashed rgba(239,68,68,.20)';
    face.style.background = 'rgba(239,68,68,.04)';
    face.style.color = 'transparent';
    face.style.cursor = 'pointer';
    face.style.pointerEvents = (deviceTag()==='cvr') ? 'none' : 'auto';
    // debug hint (optional): uncomment if you want visible
    // face.textContent = 'NO TOUCH';
    elLayer.appendChild(face);
    face.addEventListener('click', frontTouch, {passive:true});

    const nodes = [
      { name:'nose', x:50, y:24 },
      { name:'left', x:36, y:38 },
      { name:'right', x:64, y:38 },
    ];

    for(const n of nodes){
      const b = DOC.createElement('button');
      b.type = 'button';
      b.className = 'mc-node';
      b.dataset.name = n.name;
      b.textContent = '●';
      b.style.position='absolute';
      b.style.left = n.x+'%';
      b.style.top = n.y+'%';
      b.style.transform='translate(-50%,-50%)';
      b.style.width='44px';
      b.style.height='44px';
      b.style.borderRadius='16px';
      b.style.border='1px solid rgba(34,197,94,.25)';
      b.style.background='rgba(34,197,94,.10)';
      b.style.color='#bbf7d0';
      b.style.fontSize='24px';
      b.style.fontWeight='900';
      b.style.cursor='pointer';
      b.style.pointerEvents = (deviceTag()==='cvr') ? 'none' : 'auto';
      b.style.boxShadow='0 8px 24px rgba(0,0,0,.22)';
      elLayer.appendChild(b);

      b.addEventListener('click', ()=>upgradeNode(n.name), {passive:true});
    }
  }

  function shootAt(x,y){
    const rect = elLayer ? elLayer.getBoundingClientRect() : null;
    if(!rect) return;
    const px = rect.left + x;
    const py = rect.top + y;

    const els = DOC.elementsFromPoint(px, py);

    // pickups
    const pickupEl = els.find(e=>e && e.classList && e.classList.contains('mc-pickup'));
    if(pickupEl){
      pickup(pickupEl.dataset.type, pickupEl.dataset.uid);
      pickupEl.remove();
      return;
    }

    // nodes
    const nodeEl = els.find(e=>e && e.classList && e.classList.contains('mc-node'));
    if(nodeEl){
      upgradeNode(nodeEl.dataset.name);
      return;
    }

    // face hitbox => frontTouch (ONLY if hitbox exists)
    const faceEl = els.find(e=>e && e.classList && e.classList.contains('mc-facehit'));
    if(faceEl){
      frontTouch();
      return;
    }

    // choice: left/right half
    if(STATE.curPrompt){
      const mid = rect.left + rect.width/2;
      answerChoice(px < mid ? 0 : 1);
    }
  }

  // --------------------------
  // Scheduling + Loop
  // --------------------------
  let RAF = 0;
  let waveTimer = 0;
  let choiceTimer = 0;
  let pickupTimer = 0;
  let aiTimer = 0;

  function schedule(){
    clearInterval(waveTimer);
    clearInterval(choiceTimer);
    clearInterval(pickupTimer);
    clearInterval(aiTimer);

    // waves gate
    waveTimer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(STATE.curWave) return;

      // allow probability * deterministic jitter
      const jitter = (RAND()*0.35 + 0.82);
      const phaseBoost = 1 - (STATE.bossPhase-1)*0.08;
      const allowP = CFG.waveAllowP * jitter * phaseBoost;

      if(RAND() < allowP){
        spawnWave();
      }
    }, 320);

    // choices
    choiceTimer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      if(RAND() < CFG.choiceP) spawnChoice();
    }, 900);

    // pickups
    pickupTimer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      spawnPickup();
    }, 1200);

    // AI adjust
    aiTimer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      maybeApplyAIDifficulty();
    }, 3200);
  }

  function loop(t){
    if(!STATE.running || STATE.ended){ RAF = 0; return; }
    if(STATE.paused){ RAF = requestAnimationFrame(loop); return; }

    if(!STATE.lastT) STATE.lastT = t;
    const dt = t - STATE.lastT;
    STATE.lastT = t;

    STATE.tLeft -= (dt/1000);
    if(STATE.tLeft <= 0){
      STATE.tLeft = 0;
      endGame('time_up');
      updateHUD();
      return;
    }

    // smooth dodge
    STATE.dodgeX += (STATE.dodgeTargetX - STATE.dodgeX) * clamp(dt/120, 0.05, 0.28);

    // decay + stats
    decayMaskFit(dt);
    const mf = calcMaskFitPct();
    STATE.maskFitPct = mf;
    STATE.maskFitSum += mf;
    STATE.maskFitSamples += 1;
    if(mf < STATE.maskFitMin) STATE.maskFitMin = mf;

    maybeAdvanceBoss();
    judgeDodge();

    updateHUD();
    RAF = requestAnimationFrame(loop);
  }

  // --------------------------
  // Start/Pause/End
  // --------------------------
  function newSessionId(){
    const t = Date.now().toString(36);
    const r = Math.floor(RAND()*1e9).toString(36);
    return `mc_${t}_${r}`;
  }

  function startGame(){
    if(STATE.running && !STATE.ended) return;

    Object.assign(STATE, {
      running:true, paused:false, ended:false,
      startAtIso: isoNow(),
      startT: now(),
      lastT: 0,
      tLeft: clamp(Number(CTX.timeSec||CFG.timeDefault), 30, 180),

      sessionId: newSessionId(),
      score:0, combo:0, comboMax:0, misses:0,

      maskFitPct:0, maskFitSum:0, maskFitSamples:0, maskFitMin:100,
      maskFrontTouchCount:0,

      exposure:0, exposureMax:0,

      coverPerfect:0, coverGood:0, coverLate:0,
      perfectStreak:0,
      perfectGateFired:false,

      choiceTotal:0, choiceCorrect:0, choiceRT:[],

      waveSpawned:0, waveCleared:0, waveHit:0, nearMissCount:0,

      shieldActiveUntil:0, tissueActiveUntil:0,
      cleanHandsCharges:0,

      nShieldSpawned:0, nTissueSpawned:0, nCleanHandsSpawned:0,

      nodes:{ nose:'loose', left:'loose', right:'loose' },

      curWave:null,
      curPrompt:null,

      bossPhase:0, bossPhaseAt:0,

      dodgeX:0, dodgeTargetX:0,

      __ai:null,

      fakeCoverArmed:false,
      fakeCoverUsed:false,
      fakeCoverUntil:0,
    });

    renderNodes();
    updateHUD();

    pushEvent('hha:start','maskcough',{
      hub: CTX.hub,
      run: CTX.run||'',
      mode: MODE,
      diff: DIFF_KEY,
      timeSec: Number(CTX.timeSec||CFG.timeDefault),
      seed: String(CTX.seed),
      studyId: CTX.studyId||'',
      phase: CTX.phase||'',
      conditionGroup: CTX.conditionGroup||'',
      pid: CTX.pid||'',
    });

    showPrompt('เริ่ม! ปรับหน้ากาก + หลบคลื่นไอ 😷', 1000);
    schedule();
    if(!RAF) RAF = requestAnimationFrame(loop);
  }

  function togglePause(){
    if(!STATE.running || STATE.ended) return;
    STATE.paused = !STATE.paused;
    showPrompt(STATE.paused ? '⏸ พักเกม' : '▶ เล่นต่อ', 700);
    pushEvent('hha:pause','maskcough',{ paused: STATE.paused });
  }

  function restart(){
    if(elEnd) elEnd.hidden = true;
    startGame();
  }

  function buildSessionRow(endReason){
    const durPlayed = (STATE.startT ? ((now()-STATE.startT)/1000) : 0);
    const maskAvg = STATE.maskFitSamples ? (STATE.maskFitSum/STATE.maskFitSamples) : STATE.maskFitPct;
    const choiceAcc = STATE.choiceTotal ? (STATE.choiceCorrect/STATE.choiceTotal)*100 : 0;
    const avgRT = STATE.choiceRT.length ? (STATE.choiceRT.reduce((a,b)=>a+b,0)/STATE.choiceRT.length) : 0;
    const medRT = computeMedian(STATE.choiceRT);

    return {
      timestampIso: isoNow(),
      projectTag: CTX.projectTag || 'HHA_MASKCOUGH',
      runMode: MODE,
      studyId: CTX.studyId || '',
      phase: CTX.phase || '',
      conditionGroup: CTX.conditionGroup || '',
      sessionId: STATE.sessionId,

      gameMode: MODE,
      diff: DIFF_KEY,
      durationPlannedSec: Number(CTX.timeSec||CFG.timeDefault),
      durationPlayedSec: +durPlayed.toFixed(2),

      scoreFinal: Math.round(STATE.score),
      comboMax: STATE.comboMax,
      misses: STATE.misses,

      maskFitAvgPct: +maskAvg.toFixed(2),
      maskFitMinPct: +STATE.maskFitMin.toFixed(2),
      maskFrontTouchCount: STATE.maskFrontTouchCount,

      exposureFinal: +STATE.exposure.toFixed(2),
      exposureMax: +STATE.exposureMax.toFixed(2),

      waveCleared: STATE.waveCleared,
      waveHit: STATE.waveHit,
      waveSpawned: STATE.waveSpawned,
      nearMissCount: STATE.nearMissCount,

      coverPerfect: STATE.coverPerfect,
      coverGood: STATE.coverGood,
      coverLate: STATE.coverLate,

      perfectStreakMax: CFG.perfectGateNeed, // reference
      perfectGateFired: !!STATE.perfectGateFired,

      choiceTotal: STATE.choiceTotal,
      choiceCorrect: STATE.choiceCorrect,
      choiceAccuracyPct: +choiceAcc.toFixed(2),
      avgRtChoiceMs: Math.round(avgRT),
      medianRtChoiceMs: Math.round(medRT),

      nShieldSpawned: STATE.nShieldSpawned,
      nTissueSpawned: STATE.nTissueSpawned,
      nCleanHandsSpawned: STATE.nCleanHandsSpawned,

      device: deviceTag(),
      view: CTX.view || '',
      seed: String(CTX.seed||''),
      gameVersion: GAME_VERSION,

      reason: endReason || '',
      startTimeIso: STATE.startAtIso || '',
      endTimeIso: isoNow(),

      pid: CTX.pid || '',
      __extraJson: JSON.stringify({ run: CTX.run||'', hub: CTX.hub||'' }),
    };
  }

  async function endGame(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;

    clearInterval(waveTimer);
    clearInterval(choiceTimer);
    clearInterval(pickupTimer);
    clearInterval(aiTimer);

    if(STATE.curWave && STATE.curWave.__el && STATE.curWave.__el.isConnected) STATE.curWave.__el.remove();
    STATE.curWave = null;
    STATE.curPrompt = null;

    pushEvent('hha:end','maskcough',{ reason: reason||'' });

    const row = buildSessionRow(reason||'');
    pushEvent('session:row','maskcough', row);

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        projectTag: row.projectTag,
        sessionId: row.sessionId,
        scoreFinal: row.scoreFinal,
        comboMax: row.comboMax,
        misses: row.misses,
        maskFitAvgPct: row.maskFitAvgPct,
        exposureFinal: row.exposureFinal,
        choiceAccuracyPct: row.choiceAccuracyPct,
        endTimeIso: row.endTimeIso,
        game: 'maskcough',
        version: GAME_VERSION,
      }));
    }catch(_){}

    if(endScore) endScore.textContent = String(row.scoreFinal);
    if(endCombo) endCombo.textContent = String(row.comboMax);
    if(endMiss) endMiss.textContent = String(row.misses);
    if(endMaskFit) endMaskFit.textContent = fmtPct(row.maskFitAvgPct);
    if(endExposure) endExposure.textContent = fmtPct(row.exposureFinal);
    if(endChoice) endChoice.textContent = fmtPct(row.choiceAccuracyPct);

    if(endNote){
      endNote.textContent = `seed=${CTX.seed} · diff=${DIFF_KEY} · mode=${MODE} · reason=${reason||''}`;
    }
    if(elEnd) elEnd.hidden = false;

    await flush('end');
  }

  function backHub(){
    flush('backHub');
    const hub = (CTX.hub||'').trim();
    location.href = hub || new URL('../hub.html', location.href).toString();
  }

  // --------------------------
  // Auto-init
  // --------------------------
  function init(){
    if(!DOC || !elWrap) return;
    elWrap.dataset.view = (CTX.view||'pc');
    elWrap.dataset.diff = DIFF_KEY;

    updateHUD();
    showPrompt('กด “เริ่ม” เพื่อเล่น 😷', 900);

    const stage = qs('#mc-stage');
    if(stage){
      stage.addEventListener('click', ()=>{
        if(!STATE.running && !STATE.ended) startGame();
      }, {passive:true});
    }

    pushEvent('hha:ready','maskcough',{ seed:String(CTX.seed), diff:DIFF_KEY, view:CTX.view, mode:MODE });

    // optional: auto-start practice
    // if(MODE==='practice') startGame();
  }

  // Expose API
  WIN.HHA_MASKCOUGH.start = startGame;
  WIN.HHA_MASKCOUGH.end = endGame;
  WIN.HHA_MASKCOUGH.flush = flush;

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();