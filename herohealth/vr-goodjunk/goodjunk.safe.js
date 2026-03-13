// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — SOLO STABLE MASTER PATCH
// FULL PATCH v20260313f-GJ-SAFE-SOLO-BOOTFIX-GATEFLOW
'use strict';

import {
  PHASES,
  createPhaseMachine,
  tickPhaseMachine,
  resetPhaseElapsed,
  chooseBossPersona,
  createPacingState,
  evaluatePhaseTransition,
  applyPhaseEntry,
  getPhaseBannerText,
  getCoachLineForPhase,
  choosePatternId,
  buildPatternPlan,
  getBossConfig
} from './goodjunk.patterns.js';

import {
  createRollingTracker,
  pushRollingEvent,
  trimRolling,
  extractRollingFeatures,
  buildPredictionSnapshot,
  buildDirectorAdjustment
} from './goodjunk.ai.js';

import {
  buildEndSummary,
  saveLastSummary,
  applySummaryToOverlay,
  injectCooldownButton,
  buildCooldownUrl,
  getCooldownDone,
  gradeFromPerformance
} from './goodjunk.summary.js';

import {
  createTelemetryStore,
  buildEventRow,
  logTelemetryEvent,
  logPredictionSnapshot,
  buildPredictionRow,
  buildSummaryRow,
  buildFlowRow,
  flushTelemetry
} from './goodjunk.telemetry.js';

export async function boot(cfg){
  cfg = cfg || {};

  const WIN = window;
  const DOC = document;
  const AI = cfg.ai || null;
  const SOUND = cfg.sound || null;

  const qs = (k, d='')=>{
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };
  const clamp = (v,a,b)=>{
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  function safeUrl(raw, fallback=''){
    try{
      if(!raw) return fallback;
      return new URL(raw, location.href).toString();
    }catch(_){
      return fallback;
    }
  }

  function median(arr){
    const a = Array.isArray(arr) ? arr.filter(Number.isFinite) : [];
    if(!a.length) return 0;
    a.sort((x,y)=>x-y);
    const m = Math.floor(a.length/2);
    return a.length % 2 ? a[m] : Math.round((a[m-1] + a[m]) / 2);
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }

  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr){
    const seed = xmur3(seedStr);
    return sfc32(seed(), seed(), seed(), seed());
  }

  function sfx(name, meta){
    try{ SOUND?.play?.(name, meta || {}); }catch(_){}
  }

  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const rPick = (arr)=> arr[(r01() * arr.length) | 0];

  const mode = 'solo';
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const nick = String(cfg.nick || qs('nick', pid)).trim() || pid;
  const hubUrl = safeUrl(cfg.hub || qs('hub','../hub.html'), '../hub.html');

  const HH_CAT = 'nutrition';
  const HH_ZONE = 'nutrition';
  const HH_GAME = 'goodjunk';

  const RESEARCH_MODE = String(qs('research','0')) === '1';
  const AI_PLAY_ADAPT = !RESEARCH_MODE && String(qs('ai','1')) !== '0';

  const layer = $('gj-layer');
  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  const hud = {
    score: $('hud-score'),
    time: $('hud-time'),
    miss: $('hud-miss'),
    grade: $('hud-grade'),
    goal: $('hud-goal'),
    goalCur: $('hud-goal-cur'),
    goalTarget: $('hud-goal-target'),
    goalDesc: $('goalDesc'),
    mini: $('hud-mini'),
    miniTimer: $('miniTimer'),
    aiRisk: $('aiRisk'),
    aiHint: $('aiHint'),
  };

  const coachInline = $('coachInline');
  const coachExplain = $('coachExplain');
  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');

  const missionTitle = $('missionTitle');
  const missionGoal = $('missionGoal');
  const missionHint = $('missionHint');
  const missionFill = $('missionFill');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss = $('endMiss');
  const endTime = $('endTime');
  const endDecision = $('endDecision');

  const uiView = $('uiView');
  const uiRun = $('uiRun');
  const uiDiff = $('uiDiff');

  const btnReplay = $('btnReplay');
  const btnBackHub = $('btnEndBackHub');
  const btnBackHubBottom = $('btnBackHub');

  const missionBox = $('missionBox');
  const aiBox = $('aiBox');

  const stageBanner = $('stageBanner');
  const stageBannerBig = $('stageBannerBig');
  const stageBannerSmall = $('stageBannerSmall');
  const milestoneBanner = $('milestoneBanner');
  const dangerOverlay = $('dangerOverlay');

  const battleDebug = $('battleDebug');
  const endMatchBox = endOverlay?.querySelector('.end-match-box');
  const compareBox = endOverlay?.querySelector('.compare-box');
  const endRematchStatus = $('endRematchStatus');
  const btnRequestRematch = $('btnRequestRematch');
  const btnAcceptRematch = $('btnAcceptRematch');
  const btnDeclineRematch = $('btnDeclineRematch');

  if (battleDebug) battleDebug.style.display = 'none';
  if (endMatchBox) endMatchBox.style.display = 'none';
  if (compareBox) compareBox.style.display = 'none';
  if (endRematchStatus) endRematchStatus.style.display = 'none';
  if (btnRequestRematch) btnRequestRematch.style.display = 'none';
  if (btnAcceptRematch) btnAcceptRematch.style.display = 'none';
  if (btnDeclineRematch) btnDeclineRematch.style.display = 'none';

  if(uiView) uiView.textContent = view;
  if(uiRun) uiRun.textContent = runMode;
  if(uiDiff) uiDiff.textContent = diff;

  const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS = ['⭐','💎','⚡'];
  const SHIELDS = ['🛡️','🛡️','🛡️'];
  const GREEN_FOCUS = ['🥦','🥬','🥒'];
  const WEAK = '🎯';

  const WIN_TARGET = (function(){
    let scoreTarget = 650;
    let goodTarget = 40;
    if(diff === 'easy'){ scoreTarget = 520; goodTarget = 32; }
    else if(diff === 'hard'){ scoreTarget = 780; goodTarget = 46; }
    if(view === 'cvr' || view === 'vr'){ scoreTarget = Math.round(scoreTarget * 0.96); }
    return { scoreTarget, goodTarget };
  })();

  const PRO = (diff === 'hard' && String(qs('pro','0')) === '1');

  function bossShieldBase(){
    if(diff === 'easy') return 4;
    if(diff === 'hard') return PRO ? 7 : 6;
    return 5;
  }

  const TUNE = (function(){
    let spawnBase = 0.78;
    let lifeMissLimit = 10;
    let ttlGood = 2.6;
    let ttlJunk = 2.9;
    let ttlBonus = 2.4;
    let bossHp = 18;

    if(diff === 'easy'){
      spawnBase = 0.68;
      lifeMissLimit = 14;
      ttlGood = 3.0;
      ttlJunk = 3.2;
      bossHp = 16;
    }else if(diff === 'hard'){
      spawnBase = 0.95;
      lifeMissLimit = 8;
      ttlGood = 2.2;
      ttlJunk = 2.4;
      bossHp = 22;
    }

    if(view === 'cvr' || view === 'vr'){
      ttlGood += 0.15;
      ttlJunk += 0.15;
    }

    if(PRO){
      spawnBase *= 1.10;
      ttlGood -= 0.12;
      ttlJunk -= 0.10;
      bossHp += 4;
      lifeMissLimit = Math.max(6, lifeMissLimit - 1);
    }

    return { spawnBase, lifeMissLimit, ttlGood, ttlJunk, ttlBonus, bossHp };
  })();

  const rollingTracker = createRollingTracker();

  const telemetryStore = createTelemetryStore({
    game: HH_GAME,
    pid,
    seed: seedStr,
    mode,
    diff,
    view
  });

  const bossPersona = chooseBossPersona({
    diff,
    rng: ()=> r01()
  });

  const phaseMachine = createPhaseMachine({
    plannedSec,
    goodTarget: WIN_TARGET.goodTarget
  });

  const pacingState = createPacingState({
    diff,
    bossPersona
  });

  let activePatternId = '';
  let activePatternPlan = null;
  let aiSnapshot = {
    input: null,
    pred: {
      hazardRisk: 0,
      frustrationRisk: 0,
      winChance: 0.5,
      fatigueRisk: 0,
      junkConfusionRisk: 0,
      attentionDropRisk: 0,
      coach: 'พร้อมแล้ว! ยิงของดี 🥦',
      explainText: 'prediction-ready',
      topFactors: []
    }
  };
  let aiDirectorState = {
    spawnMul: 1,
    ttlMul: 1,
    junkBias: 0,
    bonusBias: 0,
    assistMode: 'none'
  };
  let lastAiTickAt = 0;
  const AI_TICK_MS = 2000;

  let playing = true;
  let ended = false;
  let paused = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();
  const startTimeIso = nowIso();

  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;
  let combo = 0;
  let bestCombo = 0;
  let shield = 0;
  let goodHitCount = 0;
  let shots = 0;
  let hits = 0;
  let streakMiss = 0;
  let fever = 0;
  let comebackReady = false;
  const rtList = [];
  const mini = { name:'—', t:0 };

  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossShieldHp = bossShieldBase();
  let bossStormTimer = 0;
  let bossRage = false;
  let decoyWeakId = '';
  let mirrorWeakIds = [];
  let precisionWindow = 0;

  const targets = new Map();
  let spawnSeq = 0;
  let spawnAcc = 0;
  let lanePulse = 0;

  const fxLayer = DOC.createElement('div');
  fxLayer.style.position = 'fixed';
  fxLayer.style.inset = '0';
  fxLayer.style.pointerEvents = 'none';
  fxLayer.style.zIndex = '260';
  DOC.body.appendChild(fxLayer);

  const coach = DOC.createElement('div');
  coach.style.position = 'fixed';
  coach.style.left = '10px';
  coach.style.right = '10px';
  coach.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + 10px)`;
  coach.style.zIndex = '210';
  coach.style.pointerEvents = 'none';
  coach.style.display = 'flex';
  coach.style.justifyContent = 'center';
  coach.style.opacity = '0';
  coach.style.transform = 'translateY(6px)';
  coach.style.transition = 'opacity .18s ease, transform .18s ease';
  coach.innerHTML = `
    <div style="
      max-width:760px;width:100%;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.62);
      color:rgba(229,231,235,.96);
      border-radius:16px;
      padding:10px 12px;
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      backdrop-filter:blur(10px);
      font:900 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,Arial;">
      <span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span>
    </div>`;
  DOC.body.appendChild(coach);
  const coachText = coach.querySelector('#coachText');
  let coachLatchMs = 0;
  let lastWarningSfxAt = 0;

  function tGameMsNow(){
    return Math.max(0, Math.round((plannedSec - tLeft) * 1000));
  }

  function phaseNow(){
    return phaseMachine.phase;
  }

  function logGameEvent(eventName, payload = {}){
    const row = buildEventRow({
      store: telemetryStore,
      eventName,
      tGameMs: tGameMsNow(),
      phase: phaseNow(),
      payload
    });
    logTelemetryEvent(telemetryStore, row);
  }

  function flushGameTelemetry(reason = 'manual', extra = {}){
    return flushTelemetry({
      store: telemetryStore,
      key: `HHA_GJ_TELEMETRY_LAST:${pid}`,
      extra: {
        reason,
        pid,
        game: HH_GAME,
        ...extra
      }
    });
  }

  function emitPatternEvent(eventName, payload = {}){
    try{
      WIN.dispatchEvent(new CustomEvent('goodjunk:pattern-event', {
        detail: {
          game: HH_GAME,
          pid,
          seed: seedStr,
          seq: ++spawnSeq,
          eventName,
          tGameMs: tGameMsNow(),
          payload
        }
      }));
    }catch(_){}
  }

  function setCoachInline(msg, explain=''){
    if(coachInline) coachInline.textContent = String(msg || '—');
    if(coachExplain) coachExplain.textContent = String(explain || '');
  }

  function sayCoach(msg, bypass=false, explain=''){
    const t = nowMs();
    if(!bypass && (t - coachLatchMs < 3000)) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg || '');
    setCoachInline(msg, explain);
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{
      coach.style.opacity = '0';
      coach.style.transform = 'translateY(6px)';
    }, 2200);
  }

  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number'){
        hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      }
      if(hud.aiHint){
        hud.aiHint.textContent = pred.explainText || '—';
      }
      if(pred.coach) setCoachInline(pred.coach, pred.explainText || '');
    }catch(_){}
  }

  function getMasterState(){
    return {
      phase: phaseMachine.phase,
      phaseElapsed: phaseMachine.phaseElapsed,
      phaseIndex: phaseMachine.phaseIndex,
      score,
      shots,
      hits,
      missTotal,
      missGoodExpired,
      missJunkHit,
      combo,
      bestCombo,
      fever,
      shield,
      tLeft,
      plannedSec,
      goodHitCount,
      goodTarget: WIN_TARGET.goodTarget,
      bossActive,
      bossHp,
      bossHpMax,
      bossShieldHp,
      ended,
      paused
    };
  }

  function isBossPhase(phase = phaseMachine.phase){
    return (
      phase === PHASES.BOSS_INTRO ||
      phase === PHASES.BOSS_PHASE_1 ||
      phase === PHASES.BOSS_PHASE_2 ||
      phase === PHASES.LAST_STAND
    );
  }

  function legacyStageFromPhase(phase = phaseMachine.phase){
    if (phase === PHASES.WARM_OPEN || phase === PHASES.WARM_PRESSURE) return 0;
    if (phase === PHASES.TRICK_BURST || phase === PHASES.RELIEF || phase === PHASES.FINAL_RUSH) return 1;
    return 2;
  }

  function stageFinalLabelFromPhase(phase = phaseMachine.phase){
    if (phase === PHASES.WARM_OPEN || phase === PHASES.WARM_PRESSURE) return 'WARM';
    if (phase === PHASES.TRICK_BURST || phase === PHASES.RELIEF || phase === PHASES.FINAL_RUSH) return 'TRICK';
    if (isBossPhase(phase)) return 'BOSS';
    return 'WARM';
  }

  function getPhaseDisplayLabel(){
    const p = phaseMachine.phase;
    if (p === PHASES.WARM_OPEN || p === PHASES.WARM_PRESSURE) return 'WARM';
    if (p === PHASES.TRICK_BURST || p === PHASES.RELIEF || p === PHASES.FINAL_RUSH) return 'TRICK';
    if (isBossPhase(p)) return 'BOSS';
    return 'WARM';
  }

  function refreshPatternPlan(){
    activePatternId = choosePatternId({
      phase: phaseMachine.phase,
      persona: bossPersona,
      rng: ()=> r01(),
      lastPatternId: activePatternId
    });
    activePatternPlan = buildPatternPlan({
      phase: phaseMachine.phase,
      patternId: activePatternId,
      persona: bossPersona,
      pacing: pacingState,
      tLeft
    });
  }

  function showStageBanner(text){
    if(!stageBanner || !stageBannerBig) return;
    stageBannerBig.textContent = text || 'MODE';
    if(stageBannerSmall){
      stageBannerSmall.textContent =
        text === 'BOSS INCOMING' ? 'บอสมาแล้ว! เตรียมสติให้พร้อม' :
        text === 'FINAL RUSH' ? 'ช่วงท้ายเดือดขึ้นแล้ว!' :
        text === 'TRICK BURST' ? 'เร่งคอมโบและอ่านเป้าให้ไว!' :
        'ลุยต่อ!';
    }
    stageBanner.classList.add('show');
    setTimeout(()=> stageBanner.classList.remove('show'), 1400);
  }

  function showMilestone(text){
    if(!milestoneBanner) return;
    milestoneBanner.textContent = text || 'NICE!';
    milestoneBanner.classList.add('show');
    setTimeout(()=> milestoneBanner.classList.remove('show'), 1000);
  }

  function setDanger(on){
    if(dangerOverlay) dangerOverlay.style.opacity = on ? '1' : '0';
    if(on){
      const t = nowMs();
      if(t - lastWarningSfxAt > 1600){
        lastWarningSfxAt = t;
        sfx('warning');
      }
    }
  }

  function enterPhase(nextPhase){
    phaseMachine.phase = nextPhase;
    resetPhaseElapsed(phaseMachine);
    applyPhaseEntry(phaseMachine, pacingState);
    refreshPatternPlan();

    const bannerText = getPhaseBannerText(nextPhase);
    showStageBanner(bannerText);
    sayCoach(getCoachLineForPhase(nextPhase, bossPersona), true);

    emitPatternEvent('phase-change', {
      phase: nextPhase,
      phaseIndex: phaseMachine.phaseIndex,
      bannerText,
      patternId: activePatternId,
      bossPersona: bossPersona.id
    });

    logGameEvent('phase-change', {
      phase: nextPhase,
      phaseIndex: phaseMachine.phaseIndex,
      bannerText,
      patternId: activePatternId,
      bossPersona: bossPersona.id
    });

    if(nextPhase === PHASES.BOSS_INTRO){
      bossActive = true;

      const cfgBoss = getBossConfig({
        diff,
        baseBossHp: TUNE.bossHp,
        baseShield: bossShieldBase(),
        persona: bossPersona
      });

      bossHpMax = cfgBoss.bossHpMax;
      bossHp = bossHpMax;
      bossShieldHp = cfgBoss.bossShieldHp;
      bossRage = false;
      precisionWindow = 0;
      decoyWeakId = '';
      mirrorWeakIds = [];
      bossStormTimer = 0;

      setBossUI(true);
      setBossHpUI();

      emitPatternEvent('boss-start', {
        bossPersona: bossPersona.id,
        bossLabel: bossPersona.label,
        hpMax: bossHpMax,
        shieldHp: bossShieldHp
      });

      logGameEvent('boss-start', {
        bossPersona: bossPersona.id,
        bossLabel: bossPersona.label,
        hpMax: bossHpMax,
        shieldHp: bossShieldHp
      });
    }

    setMissionUI();
    setHUD();
  }

  function maybeTransitionPhase(){
    const next = evaluatePhaseTransition({
      ...getMasterState(),
      phase: phaseMachine.phase,
      phaseElapsed: phaseMachine.phaseElapsed
    });

    if(!next || next === phaseMachine.phase) return;

    if(next === PHASES.LAST_STAND){
      bossRage = true;
    }

    enterPhase(next);
  }

  function pushAiEvent(eventName, payload = {}){
    try{
      WIN.dispatchEvent(new CustomEvent('goodjunk:ai-event', {
        detail: {
          game: HH_GAME,
          pid,
          nick,
          seed: seedStr,
          room: '',
          mode,
          diff,
          view,
          eventName,
          tGameMs: tGameMsNow(),
          payload
        }
      }));
    }catch(_){}
  }

  function updateAiDirector(now){
    if((now - lastAiTickAt) < AI_TICK_MS) return;
    lastAiTickAt = now;

    trimRolling(rollingTracker, now);
    const rolling = extractRollingFeatures(rollingTracker, now);

    aiSnapshot = buildPredictionSnapshot({
      state: getMasterState(),
      rolling
    });

    aiDirectorState = buildDirectorAdjustment(
      aiSnapshot.input,
      aiSnapshot.pred,
      { researchMode: RESEARCH_MODE }
    );

    setAIHud(aiSnapshot.pred);
    pushAiEvent('predict', aiSnapshot.pred);

    const predRow = buildPredictionRow({
      store: telemetryStore,
      tGameMs: tGameMsNow(),
      phase: phaseNow(),
      prediction: aiSnapshot.pred,
      assistMode: aiDirectorState.assistMode
    });
    logPredictionSnapshot(telemetryStore, predRow);

    emitPatternEvent('prediction-snapshot', {
      hazardRisk: aiSnapshot.pred.hazardRisk,
      frustrationRisk: aiSnapshot.pred.frustrationRisk,
      winChance: aiSnapshot.pred.winChance,
      fatigueRisk: aiSnapshot.pred.fatigueRisk,
      junkConfusionRisk: aiSnapshot.pred.junkConfusionRisk,
      attentionDropRisk: aiSnapshot.pred.attentionDropRisk,
      assistMode: aiDirectorState.assistMode,
      topFactors: aiSnapshot.pred.topFactors
    });

    if(aiSnapshot.pred.coach){
      const urgent =
        aiSnapshot.pred.hazardRisk >= 0.68 ||
        aiSnapshot.pred.frustrationRisk >= 0.62 ||
        aiSnapshot.pred.winChance >= 0.84;
      if(urgent){
        sayCoach(aiSnapshot.pred.coach, false, aiSnapshot.pred.explainText || '');
      }
    }
  }

  function layerRect(){ return layer.getBoundingClientRect(); }

  function safeSpawnRect(){
    const r = layerRect();
    const W = r.width, H = r.height;
    const topPad = 120 + ((view === 'cvr' || view === 'vr') ? 20 : 0);
    const bottomPad = 120 + ((view === 'cvr' || view === 'vr') ? 10 : 0);
    const leftPad = 18, rightPad = 18;

    const x1 = r.left + leftPad;
    const x2 = r.left + Math.max(leftPad + 10, W - rightPad);
    const y1 = r.top + Math.min(H - 60, topPad);
    const y2 = r.top + Math.max(y1 + 60, H - bottomPad);
    return { x1, x2, y1, y2, W, H, left:r.left, top:r.top };
  }

  function spawnPoint(){
    const s = safeSpawnRect();
    return {
      x: s.x1 + (s.x2 - s.x1) * r01(),
      y: s.y1 + (s.y2 - s.y1) * r01()
    };
  }

  function spawnPointLane(laneIndex=1, total=3){
    const s = safeSpawnRect();
    const frac = (laneIndex + 0.5) / total;
    return {
      x: s.x1 + (s.x2 - s.x1) * frac,
      y: s.y1 + (s.y2 - s.y1) * (0.15 + r01() * 0.7)
    };
  }

  function spawnPointCenterBurst(){
    const s = safeSpawnRect();
    const cx = (s.x1 + s.x2) / 2;
    const cy = (s.y1 + s.y2) / 2;
    return {
      x: cx + (r01() * 180 - 90),
      y: cy + (r01() * 120 - 60)
    };
  }

  function setBossUI(on){
    if(bossBar) bossBar.style.display = on ? 'block' : 'none';
  }

  function setBossHpUI(){
    if(!bossFill) return;
    const p = bossHpMax ? clamp((bossHp / bossHpMax) * 100, 0, 100) : 0;
    bossFill.style.setProperty('--hp', p.toFixed(1) + '%');

    if(!bossHint) return;
    const bossName = bossPersona?.label || 'Boss';

    if(bossShieldHp > 0){
      bossHint.textContent = `${bossName} • 🛡️ โล่เหลือ ${bossShieldHp}`;
      return;
    }
    if (bossPersona?.id === 'decoy_trickster') {
      bossHint.textContent = `${bossName} • 🎯 เลือก weak point ให้ถูก! HP ${bossHp}/${bossHpMax}`;
      return;
    }
    if (bossPersona?.id === 'mirror_reader') {
      bossHint.textContent = `${bossName} • 🪞 เป้าคู่กระจก HP ${bossHp}/${bossHpMax}`;
      return;
    }
    if (bossPersona?.id === 'precision_sniper') {
      bossHint.textContent = precisionWindow > 0
        ? `${bossName} • 🎯 PRECISION OPEN! HP ${bossHp}/${bossHpMax}`
        : `${bossName} • ⏳ รอ precision window... HP ${bossHp}/${bossHpMax}`;
      return;
    }
    if (bossPersona?.id === 'rage_beast') {
      bossHint.textContent = bossRage
        ? `${bossName} • 😡 RAGE MODE! HP ${bossHp}/${bossHpMax}`
        : `${bossName} • 🎯 โจมตีบอส HP ${bossHp}/${bossHpMax}`;
      return;
    }
    if (bossPersona?.id === 'storm_chaos') {
      bossHint.textContent = `${bossName} • 🌪️ ระวัง junk storm HP ${bossHp}/${bossHpMax}`;
      return;
    }
    bossHint.textContent = `${bossName} • 🎯 โจมตีบอส HP ${bossHp}/${bossHpMax}`;
  }

  function gradeFromScore(){
    const acc = shots ? (hits / shots) * 100 : 0;
    return gradeFromPerformance({
      score,
      scoreTarget: WIN_TARGET.scoreTarget,
      accPct: acc,
      missTotal
    });
  }

  function setMissionUI(){
    const phase = phaseMachine.phase;
    const patternId = activePatternId || 'warm_open_good_arc';

    if(missionTitle) missionTitle.textContent = getPhaseDisplayLabel();

    if (phase === PHASES.WARM_OPEN) {
      if(missionGoal) missionGoal.textContent = 'เปิดเกมให้แม่น เก็บของดี';
      if(missionHint) missionHint.textContent = 'เริ่มเบา ๆ ก่อน อ่านเป้าให้ชัด';
    } else if (phase === PHASES.WARM_PRESSURE) {
      if(missionGoal) missionGoal.textContent = 'แยกของดี/ขยะให้เร็วขึ้น';
      if(missionHint) missionHint.textContent = 'เริ่มมีเป้าหลอกมากขึ้น';
    } else if (phase === PHASES.TRICK_BURST) {
      if(missionGoal) missionGoal.textContent = 'ช่วงเดือด ทำคอมโบให้ติด';
      if(missionHint) missionHint.textContent = 'โบนัสและหลอกตาจะมาเยอะขึ้น';
    } else if (phase === PHASES.RELIEF) {
      if(missionGoal) missionGoal.textContent = 'พักจังหวะ เก็บแต้มให้เนียน';
      if(missionHint) missionHint.textContent = 'ช่วงนี้เป็นหน้าต่างฟื้นตัว';
    } else if (phase === PHASES.FINAL_RUSH) {
      if(missionGoal) missionGoal.textContent = 'เร่งแต้มก่อนเข้าบอส';
      if(missionHint) missionHint.textContent = 'ช่วงท้ายก่อนบอส เกมจะถาโถมขึ้น';
    } else if (phase === PHASES.BOSS_INTRO) {
      if(missionGoal) missionGoal.textContent = bossPersona.label;
      if(missionHint) missionHint.textContent = bossPersona.introLine;
    } else if (phase === PHASES.BOSS_PHASE_1) {
      if(missionGoal) missionGoal.textContent = `${bossPersona.label} • Phase 1`;
      if(missionHint) missionHint.textContent = `pattern: ${patternId}`;
    } else if (phase === PHASES.BOSS_PHASE_2) {
      if(missionGoal) missionGoal.textContent = `${bossPersona.label} • Phase 2`;
      if(missionHint) missionHint.textContent = `pattern: ${patternId}`;
    } else if (phase === PHASES.LAST_STAND) {
      if(missionGoal) missionGoal.textContent = 'หมดหน้าตักแล้ว ลุยเต็มที่';
      if(missionHint) missionHint.textContent = 'last stand • ห้ามหลุดสมาธิ';
    } else {
      if(missionGoal) missionGoal.textContent = 'เก็บของดี';
      if(missionHint) missionHint.textContent = `pattern: ${patternId}`;
    }
  }

  function setHUD(){
    if(hud.score) hud.score.textContent = String(score | 0);
    if(hud.time) hud.time.textContent = String(Math.ceil(tLeft));
    if(hud.miss) hud.miss.textContent = String(missTotal | 0);
    if(hud.grade) hud.grade.textContent = gradeFromScore();
    if(hud.goal) hud.goal.textContent = getPhaseDisplayLabel();
    if(hud.goalCur) hud.goalCur.textContent = String(goodHitCount | 0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(WIN_TARGET.goodTarget | 0);
    if(hud.goalDesc) hud.goalDesc.textContent = activePatternId || phaseMachine.phase;
    if(hud.mini) hud.mini.textContent = mini.name || '—';
    if(hud.miniTimer) hud.miniTimer.textContent = String(Math.ceil(mini.t || 0));

    if(missionFill){
      const p = isBossPhase()
        ? (bossHpMax ? (1 - (bossHp / bossHpMax)) * 100 : 0)
        : clamp((goodHitCount / WIN_TARGET.goodTarget) * 100, 0, 100);
      missionFill.style.setProperty('--p', p.toFixed(1) + '%');
    }
  }

  function getPlayerProfile(){
    const accPct = shots ? Math.round((hits / shots) * 100) : 0;
    return {
      score,
      missTotal,
      missGoodExpired,
      missJunkHit,
      shots,
      hits,
      accPct,
      combo,
      comboBest: bestCombo,
      stage: legacyStageFromPhase(),
      phase: phaseMachine.phase,
      tLeft,
      plannedSec,
      bossHp,
      bossHpMax,
      scoreTarget: WIN_TARGET.scoreTarget,
      goodHitCount,
      goodTarget: WIN_TARGET.goodTarget,
      medianRtGoodMs: median(rtList),
      fever,
      shield,
      streakMiss
    };
  }

  function aiDirector(profile){
    let spawnMul = 1;
    let junkBias = 0;
    let ttlMul = 1;
    let coachTextHint = null;

    if(profile.accPct < 55 || profile.missTotal >= 7){
      spawnMul = 0.92;
      junkBias = -0.06;
      ttlMul = 1.08;
      coachTextHint = 'ค่อย ๆ เล็งของดีทีละชิ้น';
    }else if(profile.accPct > 85 && profile.missTotal <= 2){
      spawnMul = 1.08;
      junkBias = 0.05;
      ttlMul = 0.96;
      coachTextHint = 'เก่งมาก ลองเร่งคอมโบต่อ!';
    }

    if(profile.tLeft <= 10){
      spawnMul *= 1.12;
      coachTextHint = coachTextHint || 'ช่วงท้ายแล้ว เร่งเก็บแต้ม!';
    }

    return { spawnMul, junkBias, ttlMul, coach: coachTextHint };
  }

  function currentMedianRtGoodMs(){
    return median(rtList);
  }

  function currentFinishMs(){
    return Math.max(0, Math.round((plannedSec - tLeft) * 1000));
  }

  function maybeComebackBoost(){
    if(tLeft <= 20 && score < (WIN_TARGET.scoreTarget * 0.55) && missTotal >= 3){
      comebackReady = true;
      if(fever <= 0) enterFever(4);
      sayCoach('ยังกลับมาได้! ช่วง COMEBACK 🔥', true);
    }else{
      comebackReady = false;
    }
  }

  function enterFever(sec=6){
    fever = Math.max(fever, sec);
    mini.name = 'FEVER 🔥';
    mini.t = Math.max(mini.t, sec);
    sfx('fever');
    sayCoach('FEVER! แต้มคูณช่วงสั้น ๆ 🔥', true);
  }

  function fxFloatText(x,y,text,isBad){
    const n = DOC.createElement('div');
    n.textContent = text;
    n.style.position = 'absolute';
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.style.transform = 'translate(-50%,-50%)';
    n.style.font = '900 18px/1.1 system-ui,-apple-system,Segoe UI,Roboto,Arial';
    n.style.color = isBad ? 'rgba(255,110,110,.96)' : 'rgba(229,231,235,.98)';
    n.style.textShadow = '0 10px 30px rgba(0,0,0,.55)';
    fxLayer.appendChild(n);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01() * 14);

    function tickFloat(){
      const p = Math.min(1, (nowMs() - t0) / dur);
      n.style.top = `${y - rise * p}px`;
      n.style.opacity = String(1 - p);
      n.style.transform = `translate(-50%,-50%) scale(${1 + 0.08 * Math.sin(p * 3.14)})`;
      if(p < 1) requestAnimationFrame(tickFloat);
      else n.remove();
    }
    requestAnimationFrame(tickFloat);
  }

  function fxBurst(x,y){
    const count = 10 + ((r01() * 6) | 0);
    for(let i=0;i<count;i++){
      const dot = DOC.createElement('div');
      dot.style.position = 'absolute';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '999px';
      dot.style.background = 'rgba(229,231,235,.92)';
      dot.style.opacity = '1';
      dot.style.transform = 'translate(-50%,-50%)';
      fxLayer.appendChild(dot);

      const ang = r01() * Math.PI * 2;
      const sp = 40 + r01() * 80;
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp;
      const t0 = nowMs();
      const dur = 420 + r01() * 220;

      function tickBurst(){
        const p = Math.min(1, (nowMs() - t0) / dur);
        dot.style.left = `${x + vx * p}px`;
        dot.style.top = `${y + vy * p - 30 * p * p}px`;
        dot.style.opacity = String(1 - p);
        dot.style.transform = `translate(-50%,-50%) scale(${1 - 0.4 * p})`;
        if(p < 1) requestAnimationFrame(tickBurst);
        else dot.remove();
      }
      requestAnimationFrame(tickBurst);
    }
  }

  function makeTarget(type, emoji, ttl, point=null){
    const { x, y } = point || spawnPoint();
    const n = DOC.createElement('div');
    n.className = 'gj-target';
    n.dataset.type = type;
    n.textContent = emoji;

    n.style.position = 'absolute';
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.style.transform = 'translate(-50%,-50%)';
    n.style.fontSize = (type === 'bossweak') ? '54px' : (type === 'bossdecoy' ? '48px' : '46px');
    n.style.lineHeight = '1';
    n.style.userSelect = 'none';
    n.style.cursor = 'pointer';
    n.style.filter = 'drop-shadow(0 18px 40px rgba(0,0,0,.45))';
    n.style.textShadow = '0 14px 40px rgba(0,0,0,.55)';
    n.style.pointerEvents = 'auto';
    n.style.transition = 'transform .08s ease';

    layer.appendChild(n);

    const id = `${Date.now()}_${String(Math.random()).slice(2)}`;
    const born = nowMs();
    const t = { id, type, emoji, ttl, born, el:n };
    targets.set(id, t);

    emitPatternEvent('spawn', {
      type,
      emoji,
      ttl,
      x: Math.round(x),
      y: Math.round(y),
      phase: phaseNow(),
      patternId: activePatternId
    });

    logGameEvent('spawn', {
      type,
      emoji,
      ttl,
      x: Math.round(x),
      y: Math.round(y),
      phase: phaseNow(),
      patternId: activePatternId
    });

    n.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    return t;
  }

  function removeTarget(id){
    const t = targets.get(id);
    if(!t) return;
    targets.delete(id);
    try{ t.el.remove(); }catch(_){}
  }

  function spawnLaneRush(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    lanePulse = (lanePulse + 1) % 3;
    const goodLane = lanePulse;

    for(let i=0;i<3;i++){
      const pt = spawnPointLane(i, 3);
      if(i === goodLane){
        makeTarget('good', rPick(GOOD), (TUNE.ttlGood - 0.1) * ttlMul, pt);
      }else{
        makeTarget('junk', rPick(JUNK), (TUNE.ttlJunk - 0.1) * ttlMul, pt);
      }
    }
    emitPatternEvent('pattern', { pattern:'lane_rush', goodLane });
  }

  function spawnCenterBurst(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    for(let i=0;i<3;i++){
      makeTarget('good', rPick(GOOD), (TUNE.ttlGood - 0.15) * ttlMul, spawnPointCenterBurst());
    }
    if(r01() < 0.55){
      makeTarget('junk', rPick(JUNK), (TUNE.ttlJunk - 0.05) * ttlMul, spawnPointCenterBurst());
    }
    emitPatternEvent('pattern', { pattern:'center_burst' });
  }

  function spawnBossDecoyPattern(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    const trueWeak = makeTarget('bossweak', WEAK, 1.45 * ttlMul);
    decoyWeakId = trueWeak.id;

    if(r01() < 0.8){
      const d1 = makeTarget('bossdecoy', WEAK, 1.3 * ttlMul);
      if(r01() < 0.6) makeTarget('bossdecoy', WEAK, 1.2 * ttlMul);
      emitPatternEvent('boss-pattern', {
        pattern:'decoy_boss',
        trueWeakId:trueWeak.id,
        firstDecoyId:d1.id
      });
    }else{
      emitPatternEvent('boss-pattern', {
        pattern:'decoy_boss',
        trueWeakId:trueWeak.id
      });
    }
  }

  function spawnBossMirrorPattern(adaptive){
    const ttlMul = adaptive.ttlMul || 1;
    mirrorWeakIds = [];

    const s = safeSpawnRect();
    const centerY = s.y1 + (s.y2 - s.y1) * (0.25 + r01() * 0.5);
    const leftX = s.x1 + (s.x2 - s.x1) * 0.32;
    const rightX = s.x1 + (s.x2 - s.x1) * 0.68;

    const trueSideLeft = r01() < 0.5;
    const trueWeak = makeTarget('bossweak', WEAK, 1.45 * ttlMul, {
      x: trueSideLeft ? leftX : rightX,
      y: centerY
    });
    mirrorWeakIds.push(trueWeak.id);

    const mirror = makeTarget('bossdecoy', WEAK, 1.45 * ttlMul, {
      x: trueSideLeft ? rightX : leftX,
      y: centerY
    });
    mirrorWeakIds.push(mirror.id);

    emitPatternEvent('boss-pattern', {
      pattern:'mirror_boss',
      trueWeakId:trueWeak.id,
      mirrorId:mirror.id
    });
  }

  function openPrecisionWindow(sec=1.4){
    precisionWindow = Math.max(precisionWindow, sec);
    sayCoach('PRECISION WINDOW เปิดแล้ว! ยิงตอนนี้!', true);
    emitPatternEvent('boss-pattern', {
      pattern:'precision_window_open',
      sec
    });
  }

  function hitTarget(id){
    const t = targets.get(id);
    if(!t || !playing || paused) return;

    const eventNow = nowMs();
    const br = t.el.getBoundingClientRect();
    const x = br.left + br.width/2;
    const y = br.top + br.height/2;

    shots++;
    fxBurst(x, y);
    streakMiss = 0;

    if(t.type === 'good'){
      hits++;
      goodHitCount++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      let plus = 12 + Math.min(8, combo);
      if(activePatternId === 'warm_open_green_focus' && GREEN_FOCUS.includes(t.emoji)) plus += 6;
      if(fever > 0) plus = Math.round(plus * 1.35);

      score += plus;

      const rt = Math.max(80, Math.round(nowMs() - t.born));
      rtList.push(rt);

      pushRollingEvent(rollingTracker, {
        atMs: eventNow,
        type:'hit',
        good:true,
        junk:false,
        miss:false,
        expire:false,
        rt,
        comboBreak:false,
        scoreDelta:plus
      });

      logGameEvent('hit', {
        targetType:'good',
        good:true,
        junk:false,
        scoreDelta:plus,
        combo,
        rt
      });

      if(combo === 5 || combo === 10 || combo === 15 || combo === 20){
        showMilestone(combo >= 20 ? 'ULTRA COMBO!' : combo >= 15 ? 'MEGA COMBO!' : combo >= 10 ? 'AWESOME!' : 'NICE COMBO!');
      }

      sfx('hit-good');
      emitPatternEvent('hit', { targetType:'good', scorePlus:plus, combo, rt });
      fxFloatText(x, y, `+${plus}`, false);

      if(combo === 8 || combo === 14) enterFever(5);

    }else if(t.type === 'junk'){
      hits++;
      missTotal++;
      missJunkHit++;
      combo = 0;

      let minus = 8;
      if(tLeft <= 10) minus += 2;
      score = Math.max(0, score - minus);

      pushRollingEvent(rollingTracker, {
        atMs: eventNow,
        type:'hit',
        good:false,
        junk:true,
        miss:true,
        expire:false,
        rt:0,
        comboBreak:true,
        scoreDelta:-minus
      });

      logGameEvent('hit', {
        targetType:'junk',
        good:false,
        junk:true,
        scoreDelta:-minus,
        combo
      });

      sfx('hit-junk');
      emitPatternEvent('hit', { targetType:'junk', scoreMinus:minus });
      fxFloatText(x, y, `-${minus}`, true);

    }else if(t.type === 'bonus'){
      hits++;
      const bonusScore = fever > 0 ? 34 : 25;
      score += bonusScore;

      pushRollingEvent(rollingTracker, {
        atMs: eventNow,
        type:'hit',
        good:false,
        junk:false,
        miss:false,
        expire:false,
        rt:0,
        comboBreak:false,
        scoreDelta:bonusScore
      });

      logGameEvent('hit', {
        targetType:'bonus',
        good:false,
        junk:false,
        scoreDelta:bonusScore,
        combo
      });

      sfx('bonus');
      emitPatternEvent('hit', { targetType:'bonus', scorePlus:bonusScore });
      fxFloatText(x, y, `+${bonusScore}`, false);
      mini.name = 'BONUS ⚡';
      mini.t = 6;
      if(r01() < 0.35) enterFever(4);

    }else if(t.type === 'shield'){
      hits++;
      shield = Math.min(9, shield + 1);
      score += 6;

      pushRollingEvent(rollingTracker, {
        atMs: eventNow,
        type:'hit',
        good:false,
        junk:false,
        miss:false,
        expire:false,
        rt:0,
        comboBreak:false,
        scoreDelta:6
      });

      logGameEvent('hit', {
        targetType:'shield',
        good:false,
        junk:false,
        scoreDelta:6,
        shield
      });

      sfx('shield');
      emitPatternEvent('hit', { targetType:'shield', shield });
      fxFloatText(x, y, '+shield', false);

    }else if(t.type === 'bossdecoy'){
      hits++;
      missTotal++;
      missJunkHit++;
      combo = 0;
      score = Math.max(0, score - 10);

      pushRollingEvent(rollingTracker, {
        atMs: eventNow,
        type:'hit',
        good:false,
        junk:true,
        miss:true,
        expire:false,
        rt:0,
        comboBreak:true,
        scoreDelta:-10
      });

      logGameEvent('boss-hit', {
        targetType:'bossdecoy',
        good:false,
        junk:true,
        result:'decoy',
        scoreDelta:-10
      });

      sfx('hit-junk');
      emitPatternEvent('boss-hit', { result:'decoy-object', targetId:id });
      fxFloatText(x, y, 'DECOY!', true);

    }else if(t.type === 'bossweak'){
      hits++;

      const isWrongDecoy =
        (bossPersona.id === 'decoy_trickster' && decoyWeakId && id !== decoyWeakId) ||
        (bossPersona.id === 'mirror_reader' && mirrorWeakIds.length && mirrorWeakIds[0] && id !== mirrorWeakIds[0]);

      if(isWrongDecoy){
        missTotal++;
        missJunkHit++;
        combo = 0;
        score = Math.max(0, score - 10);

        pushRollingEvent(rollingTracker, {
          atMs: eventNow,
          type:'hit',
          good:false,
          junk:true,
          miss:true,
          expire:false,
          rt:0,
          comboBreak:true,
          scoreDelta:-10
        });

        logGameEvent('boss-hit', {
          targetType:'bossweak',
          good:false,
          junk:true,
          result:'wrong-target',
          scoreDelta:-10
        });

        sfx('hit-junk');
        emitPatternEvent('boss-hit', { result:'wrong-target', targetId:id });
        fxFloatText(x, y, 'DECOY!', true);

      }else if(bossPersona.id === 'precision_sniper' && precisionWindow <= 0){
        missTotal++;
        missJunkHit++;
        combo = 0;
        score = Math.max(0, score - 8);

        pushRollingEvent(rollingTracker, {
          atMs: eventNow,
          type:'hit',
          good:false,
          junk:true,
          miss:true,
          expire:false,
          rt:0,
          comboBreak:true,
          scoreDelta:-8
        });

        logGameEvent('boss-hit', {
          targetType:'bossweak',
          good:false,
          junk:true,
          result:'outside-window',
          scoreDelta:-8
        });

        sfx('hit-junk');
        emitPatternEvent('boss-hit', { result:'outside-window', targetId:id });
        fxFloatText(x, y, 'EARLY!', true);

      }else if(bossShieldHp > 0){
        bossShieldHp--;
        score += 8;

        logGameEvent('boss-hit', {
          targetType:'bossweak',
          good:true,
          junk:false,
          result:'shield-hit',
          scoreDelta:8,
          shieldLeft:bossShieldHp
        });

        sfx('boss-hit');
        emitPatternEvent('boss-hit', { result:'shield-hit', shieldLeft:bossShieldHp });
        fxFloatText(x, y, '🛡️', false);

      }else{
        let dmg = fever > 0 ? 2 : 1;
        if(bossPersona.id === 'precision_sniper' && precisionWindow > 0) dmg += 1;
        if(bossPersona.id === 'rage_beast' && bossRage) dmg += 1;

        bossHp = Math.max(0, bossHp - dmg);
        score += fever > 0 ? 16 : 10;

        pushRollingEvent(rollingTracker, {
          atMs: eventNow,
          type:'hit',
          good:true,
          junk:false,
          miss:false,
          expire:false,
          rt:0,
          comboBreak:false,
          scoreDelta:fever > 0 ? 16 : 10
        });

        logGameEvent('boss-hit', {
          targetType:'bossweak',
          good:true,
          junk:false,
          result:'hp-hit',
          scoreDelta:fever > 0 ? 16 : 10,
          hpLeft:bossHp
        });

        sfx('boss-hit');
        emitPatternEvent('boss-hit', { result:'hp-hit', damage:dmg, hpLeft:bossHp });
        fxFloatText(x, y, fever > 0 ? '💥' : '🎯', false);
      }

      setBossHpUI();
      if(bossHp <= 0){
        removeTarget(id);
        endGame('win');
        return;
      }
    }

    removeTarget(id);
    setHUD();

    if(missTotal >= TUNE.lifeMissLimit){
      endGame('miss-limit');
    }
  }

  function expireTargets(){
    const t = nowMs();
    for(const [id, obj] of targets){
      const age = (t - obj.born) / 1000;
      if(age >= obj.ttl){
        if(obj.type === 'good'){
          missTotal++;
          missGoodExpired++;
          streakMiss++;
          combo = 0;

          pushRollingEvent(rollingTracker, {
            atMs: t,
            type:'expire',
            good:false,
            junk:false,
            miss:false,
            expire:true,
            rt:0,
            comboBreak:true,
            scoreDelta:0
          });

          logGameEvent('expire', {
            targetType:'good',
            good:false,
            junk:false,
            scoreDelta:0
          });

          const r = obj.el.getBoundingClientRect();
          emitPatternEvent('expire', { targetType:'good', targetId:id });
          fxFloatText(r.left + r.width/2, r.top + r.height/2, 'ช้า!', true);
        }
        removeTarget(id);
      }
    }
  }

  function spawnOne(adaptive){
    if(!playing || paused) return;

    const plan = activePatternPlan || {};
    const ttlMul = (adaptive?.ttlMul || 1) * (aiDirectorState.ttlMul || 1);

    if(isBossPhase()){
      if(!bossActive) return;

      let hasWeak = false;
      for(const [,t] of targets){
        if(t.type === 'bossweak' || t.type === 'bossdecoy'){
          hasWeak = true;
          break;
        }
      }

      if(!hasWeak){
        if(plan.useBossDecoyPattern){
          spawnBossDecoyPattern({ ttlMul });
        }else if(plan.useBossMirrorPattern){
          spawnBossMirrorPattern({ ttlMul });
        }else{
          const weakTtl =
            plan.useBossRagePattern ? 1.05 :
            plan.useBossPrecisionPattern ? 1.20 :
            1.50;

          const weak = makeTarget('bossweak', WEAK, weakTtl * ttlMul);
          emitPatternEvent('boss-pattern', {
            pattern: activePatternId,
            targetId: weak.id,
            ttl: weakTtl * ttlMul
          });
        }
      }else{
        const extraJunkProb =
          plan.useBossStormPattern ? 0.84 :
          plan.useBossRagePattern ? 0.78 :
          0.56;

        if(r01() < extraJunkProb){
          const junk = makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * ttlMul);
          emitPatternEvent('boss-pattern', {
            pattern: `${activePatternId}-junk`,
            targetId: junk.id
          });
        }
      }
      return;
    }

    if(plan.useLaneRush && r01() < 0.55){
      spawnLaneRush({ ttlMul });
      return;
    }

    if(plan.useCenterBurst && r01() < 0.50){
      spawnCenterBurst({ ttlMul });
      return;
    }

    let pShield = (diff === 'hard') ? 0.10 : 0.12;
    let pBonus = 0.12 + (fever > 0 ? 0.04 : 0) + (plan.bonusWindow || 0) + (aiDirectorState.bonusBias || 0);
    let pJunk = (diff === 'easy') ? 0.28 : (diff === 'hard' ? 0.38 : 0.33);

    pJunk = clamp(
      pJunk +
      (adaptive?.junkBias || 0) +
      (aiDirectorState.junkBias || 0) +
      (plan.dangerBoost ? 0.04 : 0) -
      (plan.useReliefAssist ? 0.08 : 0),
      0.12,
      0.62
    );

    if(plan.useBonusCorridor) pBonus += 0.08;
    if(plan.useReliefAssist) pBonus += 0.06;

    const r = r01();
    if(r < pShield){
      makeTarget('shield', rPick(SHIELDS), 2.4 * ttlMul);
    }else if(r < pShield + pBonus){
      makeTarget('bonus', rPick(BONUS), TUNE.ttlBonus * ttlMul);
    }else if(r < pShield + pBonus + pJunk){
      makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * ttlMul);
    }else{
      let emoji = rPick(GOOD);
      if(activePatternId === 'warm_open_green_focus' && r01() < 0.40){
        emoji = rPick(GREEN_FOCUS);
      }
      makeTarget('good', emoji, TUNE.ttlGood * ttlMul);
    }
  }

  function dist2(ax,ay,bx,by){
    const dx = ax - bx;
    const dy = ay - by;
    return dx*dx + dy*dy;
  }

  function shootAtCenter(){
    if(!playing || paused) return;
    const r = layerRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let best = null;
    let bestD = Infinity;
    for(const [id, t] of targets){
      const br = t.el.getBoundingClientRect();
      const tx = br.left + br.width/2;
      const ty = br.top + br.height/2;
      const d = dist2(cx, cy, tx, ty);
      if(d < bestD){
        bestD = d;
        best = id;
      }
    }

    if(best){
      hitTarget(best);
    }else{
      shots++;
      streakMiss++;
      combo = 0;

      pushRollingEvent(rollingTracker, {
        atMs: nowMs(),
        type:'miss-shot',
        good:false,
        junk:false,
        miss:true,
        expire:false,
        rt:0,
        comboBreak:true,
        scoreDelta:0
      });

      logGameEvent('miss-shot', { reason:'no-target' });
      emitPatternEvent('miss-shot', { reason:'no-target' });
      setHUD();
    }
  }

  WIN.addEventListener('hha:shoot', ()=>{
    try{
      SOUND?.unlock?.();
      shootAtCenter();
    }catch(_){}
  });

  function buildEndDetail(reason){
    const accPct = shots ? Math.round((hits / shots) * 100) : 0;
    const grade = gradeFromScore();
    const timePlayedSec = Math.round(plannedSec - tLeft);

    return {
      game: HH_GAME,
      gameKey: HH_GAME,
      cat: HH_CAT,
      pid,
      nick,
      seed: seedStr,
      mode,
      run: runMode,
      diff,
      view,
      pro: PRO ? 1 : 0,
      score,
      scoreFinal: score,
      scoreTarget: WIN_TARGET.scoreTarget,
      goodTarget: WIN_TARGET.goodTarget,
      shots,
      hits,
      accPct,
      missTotal,
      missGoodExpired,
      missJunkHit,
      comboBest: bestCombo,
      goodHitCount,
      stageFinal: stageFinalLabelFromPhase(),
      phaseFinal: phaseMachine.phase,
      bossCleared: bossHp <= 0,
      bossHpLeft: bossHp,
      bossHpMax,
      bossPersona: bossPersona.id,
      bossPersonaLabel: bossPersona.label,
      fever,
      shield,
      grade,
      reason,
      win: reason === 'win',
      timePlayedSec,
      timePlannedSec: plannedSec,
      timeLeftSec: Math.max(0, Math.ceil(tLeft)),
      finishMs: currentFinishMs(),
      medianRtGoodMs: currentMedianRtGoodMs(),
      hub: hubUrl,
      battle: 0,
      room: '',
      studyId: String(qs('studyId','') || ''),
      phase: String(qs('phase','') || ''),
      conditionGroup: String(qs('conditionGroup','') || ''),
      planDay: String(qs('planDay','') || ''),
      planSlot: String(qs('planSlot','') || ''),
      planMode: String(qs('planMode','') || ''),
      zone: String(qs('zone', HH_ZONE) || HH_ZONE),
      startTimeIso,
      endTimeIso: nowIso()
    };
  }

  function renderDecision(detail){
    if(!endDecision) return;
    endDecision.textContent =
      detail.win
        ? `โหมดเดี่ยว • ผ่านเป้าหมายแล้ว • phase สุดท้าย ${detail.phaseFinal || detail.stageFinal || '-'}`
        : `โหมดเดี่ยว • เป้าหมายคือ score ${detail.scoreTarget} หรือชนะบอส • phase สุดท้าย ${detail.phaseFinal || detail.stageFinal || '-'}`;
  }

  function renderEndOverlay(detail){
    if(!endOverlay) return;
    endOverlay.style.display = 'flex';

    const summary = detail.summary || buildEndSummary(detail, aiSnapshot);

    applySummaryToOverlay({
      summary,
      detail,
      endTitleEl: endTitle,
      endSubEl: endSub,
      endGradeEl: endGrade,
      endScoreEl: endScore,
      endMissEl: endMiss,
      endTimeEl: endTime,
      endDecisionEl: endDecision,
      endTopEl: $('endTop'),
      panelEl: endOverlay?.querySelector('.panel')
    });

    const panel = endOverlay?.querySelector('.panel');
    if(panel && detail.bossPersonaLabel && !panel.querySelector('[data-gj-bosspersona="1"]')){
      const chip = DOC.createElement('div');
      chip.dataset.gjBosspersona = '1';
      chip.style.marginTop = '10px';
      chip.style.display = 'inline-flex';
      chip.style.padding = '8px 12px';
      chip.style.borderRadius = '999px';
      chip.style.border = '1px solid rgba(148,163,184,.18)';
      chip.style.background = 'rgba(15,23,42,.84)';
      chip.style.fontWeight = '1000';
      chip.textContent = `Boss Persona: ${detail.bossPersonaLabel}`;
      const endStats = panel.querySelector('.end-stats');
      if(endStats) panel.insertBefore(chip, endStats);
      else panel.appendChild(chip);
    }

    renderDecision(detail);

    injectCooldownButton({
      documentRef: DOC,
      endOverlayEl: endOverlay,
      endActionsEl: endOverlay?.querySelector('.end-actions'),
      hub: hubUrl,
      cat: HH_CAT,
      gameKey: HH_GAME,
      pid,
      currentUrl: location.href
    });
  }

  function endGame(reason){
    if(!playing || ended) return;
    ended = true;
    playing = false;
    paused = true;
    setDanger(false);

    for(const [, t] of targets){
      try{ t.el.remove(); }catch(_){}
    }
    targets.clear();

    const detail = buildEndDetail(reason);
    const summary = buildEndSummary(detail, aiSnapshot);
    detail.summary = summary;

    try{
      saveLastSummary({
        gameKey: HH_GAME,
        pid,
        detail,
        summary
      });
    }catch(e){
      console.warn('[GoodJunk] saveLastSummary failed', e);
    }

    try{
      const summaryRow = buildSummaryRow({
        store: telemetryStore,
        tGameMs: tGameMsNow(),
        phase: phaseNow(),
        detail,
        summary
      });
      logTelemetryEvent(telemetryStore, summaryRow);
    }catch(e){
      console.warn('[GoodJunk] summary row failed', e);
    }

    try{
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail }));
    }catch(_){}

    try{
      flushGameTelemetry('end-game', {
        outcome: detail.win ? 'win' : 'lose',
        reason: detail.reason || reason,
        scoreFinal: detail.scoreFinal
      });
    }catch(e){
      console.warn('[GoodJunk] flush end-game failed', e);
    }

    sfx(detail.win ? 'win' : 'lose');
    renderEndOverlay(detail);
  }

  function tick(){
    const t = nowMs();
    let dt = (t - lastTick) / 1000;
    lastTick = t;
    dt = clamp(dt, 0, 0.05);

    if(!playing) return;

    if(paused){
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    tickPhaseMachine(phaseMachine, dt);

    tLeft = Math.max(0, tLeft - dt);
    fever = Math.max(0, fever - dt);
    precisionWindow = Math.max(0, precisionWindow - dt);

    if(tLeft <= 0){
      const win = (score >= WIN_TARGET.scoreTarget) || (isBossPhase() && bossHp <= 0);
      endGame(win ? 'win' : 'time');
      return;
    }

    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t <= 0) mini.name = fever > 0 ? 'FEVER 🔥' : '—';
    }else if(fever > 0){
      mini.name = 'FEVER 🔥';
      mini.t = Math.max(1, fever);
    }

    const dangerNow =
      tLeft <= 10 ||
      (isBossPhase() && bossHpMax > 0 && bossHp / bossHpMax >= 0.55 && tLeft <= 18);

    setDanger(dangerNow);
    maybeComebackBoost();
    maybeTransitionPhase();

    let adaptive = { spawnMul:1, junkBias:0, ttlMul:1, coach:null };
    if(AI_PLAY_ADAPT){
      adaptive = aiDirector(getPlayerProfile());
    }

    updateAiDirector(t);

    let spawnMulFinal =
      (adaptive.spawnMul || 1) *
      (pacingState.spawnMul || 1) *
      (aiDirectorState.spawnMul || 1);

    let ttlMulFinal =
      (adaptive.ttlMul || 1) *
      (pacingState.ttlMul || 1) *
      (aiDirectorState.ttlMul || 1);

    if(fever > 0){
      spawnMulFinal *= 1.06;
      ttlMulFinal *= 0.98;
    }

    if(comebackReady){
      spawnMulFinal *= 1.05;
      ttlMulFinal *= 1.02;
    }

    adaptive = {
      ...adaptive,
      junkBias: (adaptive.junkBias || 0) + (pacingState.junkBias || 0),
      ttlMul: ttlMulFinal,
      spawnMul: spawnMulFinal
    };

    spawnAcc += dt * (1 / (TUNE.spawnBase / spawnMulFinal));
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne(adaptive);
    }

    if(isBossPhase() && bossPersona.id === 'storm_chaos'){
      bossStormTimer += dt;
      if(bossStormTimer >= 4){
        bossStormTimer = 0;
        for(let i=0;i<2;i++){
          const junk = makeTarget('junk', rPick(JUNK), TUNE.ttlJunk * (adaptive.ttlMul || 1));
          emitPatternEvent('boss-pattern', {
            pattern:'storm_chaos-extra-junk',
            targetId:junk.id
          });
          logGameEvent('boss-pattern', {
            pattern:'storm_chaos-extra-junk',
            targetId:junk.id
          });
        }
      }
    }

    if(isBossPhase() && bossPersona.id === 'precision_sniper'){
      bossStormTimer += dt;
      if(bossStormTimer >= 3.2){
        bossStormTimer = 0;
        openPrecisionWindow(1.25);
        logGameEvent('boss-pattern', {
          pattern:'precision_window_open',
          sec:1.25
        });
      }
    }

    if(isBossPhase() && bossPersona.id === 'rage_beast' && !bossRage){
      if(tLeft <= 12 || (bossHpMax > 0 && bossHp / bossHpMax <= 0.45)){
        bossRage = true;
        sayCoach('RAGE MODE! ระวังให้ดี!', true);
        emitPatternEvent('boss-phase', {
          boss:'rage_beast',
          phase:'rage'
        });
        logGameEvent('boss-phase', {
          boss:'rage_beast',
          phase:'rage'
        });
      }
    }

    expireTargets();
    setHUD();

    if(isBossPhase()){
      setBossUI(true);
      setBossHpUI();
    }else{
      setBossUI(false);
    }

    requestAnimationFrame(tick);
  }

  WIN.addEventListener('hha:flow-next', (ev)=>{
    try{
      const d = ev.detail || {};
      logTelemetryEvent(telemetryStore, buildFlowRow({
        store: telemetryStore,
        tGameMs: tGameMsNow(),
        phase: phaseNow(),
        eventName: String(d.action || 'flow-next'),
        payload: d
      }));
      flushGameTelemetry(String(d.action || 'flow-next'), d);
    }catch(_){}
  });

  WIN.addEventListener('pagehide', ()=>{
    try{
      flushGameTelemetry('pagehide', { phase: phaseNow(), score, tLeft });
    }catch(_){}
  });

  WIN.addEventListener('beforeunload', ()=>{
    try{
      flushGameTelemetry('beforeunload', { phase: phaseNow(), score, tLeft });
    }catch(_){}
  });

  if(missionBox){
    missionBox.addEventListener('click', ()=> missionBox.classList.toggle('compact'));
  }
  if(aiBox){
    aiBox.addEventListener('click', ()=> aiBox.classList.toggle('compact'));
  }

  if(btnReplay){
    btnReplay.onclick = ()=>{
      try{
        logTelemetryEvent(telemetryStore, buildFlowRow({
          store: telemetryStore,
          tGameMs: tGameMsNow(),
          phase: phaseNow(),
          eventName:'flow-next',
          payload:{ action:'replay' }
        }));
        flushGameTelemetry('replay', { action:'replay' });
      }catch(_){}
      location.href = new URL(location.href).toString();
    };
  }

  function handleBackHub(){
    const cdDone = getCooldownDone(HH_CAT, HH_GAME, pid);

    if(cdDone){
      try{
        logTelemetryEvent(telemetryStore, buildFlowRow({
          store: telemetryStore,
          tGameMs: tGameMsNow(),
          phase: phaseNow(),
          eventName:'flow-next',
          payload:{ action:'back-hub-direct' }
        }));
        flushGameTelemetry('back-hub-direct', { action:'back-hub-direct' });
      }catch(_){}
      location.href = hubUrl;
      return;
    }

    const sp = new URL(location.href).searchParams;
    const cdnext = sp.get('cdnext') || '';
    const nextAfterCooldown = cdnext || hubUrl || '../hub.html';
    const cdUrl = buildCooldownUrl({
      currentUrl: location.href,
      hub: hubUrl,
      nextAfterCooldown,
      cat: HH_CAT,
      gameKey: HH_GAME,
      pid
    });

    try{
      logTelemetryEvent(telemetryStore, buildFlowRow({
        store: telemetryStore,
        tGameMs: tGameMsNow(),
        phase: phaseNow(),
        eventName:'cooldown-enter',
        payload:{
          action:'back-hub-via-cooldown',
          cooldownUrl: cdUrl
        }
      }));
      flushGameTelemetry('back-hub-via-cooldown', { cooldownUrl: cdUrl });
    }catch(_){}

    location.href = cdUrl;
  }

  if(btnBackHub) btnBackHub.onclick = handleBackHub;
  if(btnBackHubBottom) btnBackHubBottom.onclick = handleBackHub;

  applyPhaseEntry(phaseMachine, pacingState);
  refreshPatternPlan();
  setMissionUI();
  setHUD();
  setCoachInline(getCoachLineForPhase(phaseMachine.phase, bossPersona), bossPersona.introLine || 'prediction-ready');

  logGameEvent('run-start', {
    phase: phaseNow(),
    patternId: activePatternId,
    bossPersona: bossPersona.id,
    diff,
    mode,
    view,
    plannedSec
  });

  sayCoach('พร้อมแล้ว! ยิงของดี 🥦', true);
  requestAnimationFrame(tick);
}
