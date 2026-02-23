// === /herohealth/vr-bath/bath.safe.js ===
// BATH / BODY CLEAN — Hidden Dirt Quest (Top-down PC/Mobile)
// Skeleton Integration (T + U + W ready)
// Notes:
// - This is a production-oriented scaffold to merge with your existing game.
// - Replace DOM selectors to match your actual HTML.
// - Hook telemetry/logger functions to your HHA standard modules if already present.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  /* =========================================================
   * A) BASIC HELPERS / QUERY / SAFE ACCESS
   * =======================================================*/
  const $ = (s, el=DOC) => el.querySelector(s);
  const $$ = (s, el=DOC) => Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const now = ()=>Date.now();

  function qstr(k, d=''){
    try{
      const u = new URL(location.href);
      const v = u.searchParams.get(k);
      return (v == null || v === '') ? d : v;
    }catch(e){ return d; }
  }
  function qnum(k, d=0){ return Number(qstr(k, d)) || Number(d) || 0; }
  function qbool(k, d=false){
    const v = String(qstr(k, d ? '1' : '0')).toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  /* =========================================================
   * B) CONTEXT / HHA STUBS (replace with real modules if present)
   * =======================================================*/
  const HHA_CTX = WIN.HHA_CTX || (WIN.HHA_CTX = {
    hub: qstr('hub','../hub.html'),
    run: qstr('run','play'),
    diffQ: qstr('diff','normal'),
    timeQ: qnum('time', 80),
    seed: qstr('seed', String(Date.now())),
    pid: qstr('pid',''),
    api: qstr('api',''),
    studyId: qstr('studyId',''),
    phase: qstr('phase',''),
    conditionGroup: qstr('conditionGroup',''),
    log: qstr('log','1'),
    view: qstr('view','mobile')
  });

  // telemetry/logger stubs (replace with your actual HHA logger)
  const TELEMETRY = [];
  function tel(type, data){
    const evt = { ts: now(), type, ...(data||{}) };
    TELEMETRY.push(evt);
    // console.debug('[bath tel]', evt);
  }
  WIN.hhaEvent = function(type, data){ tel(type, data); };

  function hhaPrepareNewRunSession(){
    STATE.runId = `bath_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    STATE.sessionOpenedAt = now();
    STATE.finalized = false;
    tel('run_start', {
      runId: STATE.runId, diff: STATE.diff, mode: HHA_CTX.run,
      seed: HHA_CTX.seed, pid: HHA_CTX.pid
    });
  }

  async function hhaFlushNow(reason='manual'){
    // hook real flush here
    tel('flush_try', { reason, queued: TELEMETRY.length });
    return true;
  }

  function hhaFinalizeRunOnce(payload={}){
    if(STATE.finalized) return false;
    STATE.finalized = true;
    STATE.sessionClosedAt = now();

    const summary = {
      game: 'bath',
      runId: STATE.runId,
      completed: !!payload.completed,
      totalScore: Number(payload.totalScore||0),
      grade: String(payload.grade||'-'),
      residuePenalty: Number(payload.residuePenalty||0),
      fungusRisk: Number(payload.fungusRisk||0),
      durationMs: Math.max(0, STATE.sessionClosedAt - (STATE.sessionOpenedAt||STATE.sessionClosedAt)),
      diff: STATE.diff,
      runMode: HHA_CTX.run,
      seed: HHA_CTX.seed,
      pid: HHA_CTX.pid,
      ts: now()
    };

    try{
      localStorage.setItem('HHA_BATH_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(e){}

    tel('run_end', summary);
    return true;
  }

  // optional issue hook
  WIN.hhaHookIssue = function(kind, msg, meta){ tel('issue', { kind, msg, ...(meta||{}) }); };

  // stats helper
  function hhaGetStatsSafe(){ return STATE.stats; }
  function hhaTouchMetric(k, inc=1){
    STATE.stats[k] = (STATE.stats[k] || 0) + (Number(inc)||1);
  }

  /* =========================================================
   * C) GAME STATE (core loop)
   * =======================================================*/
  const PHASES = ['prep', 'wet', 'scrub', 'rinse', 'drydress', 'summary'];

  const STATE = {
    runId: '',
    sessionOpenedAt: 0,
    sessionClosedAt: 0,
    finalized: false,

    started: false,
    ended: false,
    paused: false,

    phase: 'prep',
    phaseIndex: 0,
    phaseStartedAt: 0,

    diff: 'normal',
    cfg: null,

    timeLeftSec: 80,
    totalElapsedMs: 0,
    heat: 0,
    sweat: 0,

    selectedTool: 'soap', // soap | sponge | shampoo | water | towel | clothes
    wetCoverage: 0,
    rinseCoverage: 0,
    dryCoverage: 0,

    bubble: 100,
    score: 0,
    finalScore: 0,
    finalGrade: '-',

    // simple top-down body zones / spots
    hiddenSpots: [],
    pointer: { down:false, x:0, y:0, nx:0, ny:0, moved:false },

    // boss
    boss: null,

    // stats for scoring + summary
    stats: {
      wrongOrder: 0,
      regrowCount: 0,
      spreadCount: 0,
      slips: 0,
      bossKilled: 0,
      residueGateFails: 0,
      miniQuestPass: 0,
      miniQuestFail: 0,
    },

    // runtime flags
    debug: qbool('debug', false),
    useNewSummary: true
  };

  function hhaGetPhase(){ return STATE.phase; }
  function hhaGetHeat(){ return STATE.heat; }

  /* =========================================================
   * D) TUNING (PACK T integrated, simplified bridge)
   * =======================================================*/
  const BATH_TUNING = {
    easy: {
      prepSec: 6, totalTimeSec: 95, hiddenSpotCount: 6, hiddenRevealOpacity: 0.34,
      hiddenMoveChance: 0.06, wetCoverageRequired: 0.72, scrubHoldMsBase: 650, scrubHoldMsHiddenMul: 1.15,
      rinseResidueTolerance: 0.22, dryCriticalCount: 3, fungusRiskRate: 0.45,
      heatRisePerSec: 0.8, heatDropOnGoodAction: 1.4, heatRegrowThreshold: 78,
      bubbleBudget: 110, soapEfficiencyIfNotWet: 0.70, comboWindowMs: 900, scoreMul: 1.0,
      boss: { enabled:true, chancePerRun:0.45, hp:5, durationSec:10, minSpawnSec:18 }
    },
    normal: {
      prepSec: 5, totalTimeSec: 80, hiddenSpotCount: 8, hiddenRevealOpacity: 0.24,
      hiddenMoveChance: 0.12, wetCoverageRequired: 0.80, scrubHoldMsBase: 780, scrubHoldMsHiddenMul: 1.30,
      rinseResidueTolerance: 0.14, dryCriticalCount: 4, fungusRiskRate: 0.70,
      heatRisePerSec: 1.15, heatDropOnGoodAction: 1.0, heatRegrowThreshold: 70,
      bubbleBudget: 95, soapEfficiencyIfNotWet: 0.55, comboWindowMs: 700, scoreMul: 1.15,
      boss: { enabled:true, chancePerRun:0.70, hp:8, durationSec:12, minSpawnSec:16 }
    },
    hard: {
      prepSec: 4, totalTimeSec: 68, hiddenSpotCount: 10, hiddenRevealOpacity: 0.16,
      hiddenMoveChance: 0.20, wetCoverageRequired: 0.88, scrubHoldMsBase: 920, scrubHoldMsHiddenMul: 1.45,
      rinseResidueTolerance: 0.08, dryCriticalCount: 5, fungusRiskRate: 1.05,
      heatRisePerSec: 1.55, heatDropOnGoodAction: 0.8, heatRegrowThreshold: 62,
      bubbleBudget: 82, soapEfficiencyIfNotWet: 0.42, comboWindowMs: 560, scoreMul: 1.35,
      boss: { enabled:true, chancePerRun:1.00, hp:12, durationSec:14, minSpawnSec:14 }
    }
  };

  const HIDDEN_SPOT_DEFS = [
    { id:'behind_ear_L', zone:'head',  label:'หลังหูซ้าย', x:0.39, y:0.17, r:0.035, weight:1.0, scrubMul:1.15, bossBias:0.10 },
    { id:'behind_ear_R', zone:'head',  label:'หลังหูขวา', x:0.61, y:0.17, r:0.035, weight:1.0, scrubMul:1.15, bossBias:0.10 },
    { id:'neck_back',    zone:'upper', label:'คอด้านหลัง', x:0.50, y:0.24, r:0.040, weight:1.2, scrubMul:1.20, bossBias:0.12 },
    { id:'armpit_L',     zone:'upper', label:'รักแร้ซ้าย', x:0.35, y:0.34, r:0.040, weight:1.4, scrubMul:1.35, bossBias:0.20 },
    { id:'armpit_R',     zone:'upper', label:'รักแร้ขวา', x:0.65, y:0.34, r:0.040, weight:1.4, scrubMul:1.35, bossBias:0.20 },
    { id:'elbow_fold_L', zone:'arm',   label:'ข้อพับแขนซ้าย', x:0.25, y:0.45, r:0.038, weight:1.1, scrubMul:1.20, bossBias:0.08 },
    { id:'elbow_fold_R', zone:'arm',   label:'ข้อพับแขนขวา', x:0.75, y:0.45, r:0.038, weight:1.1, scrubMul:1.20, bossBias:0.08 },
    { id:'knee_back_L',  zone:'leg',   label:'หลังเข่าซ้าย', x:0.43, y:0.68, r:0.040, weight:1.3, scrubMul:1.30, bossBias:0.14 },
    { id:'knee_back_R',  zone:'leg',   label:'หลังเข่าขวา', x:0.57, y:0.68, r:0.040, weight:1.3, scrubMul:1.30, bossBias:0.14 },
    { id:'toe_gap_L',    zone:'foot',  label:'ซอกนิ้วเท้าซ้าย', x:0.44, y:0.88, r:0.040, weight:1.5, scrubMul:1.45, bossBias:0.22 },
    { id:'toe_gap_R',    zone:'foot',  label:'ซอกนิ้วเท้าขวา', x:0.56, y:0.88, r:0.040, weight:1.5, scrubMul:1.45, bossBias:0.22 },
  ];

  function hash32(str){
    let h = 2166136261 >>> 0;
    str = String(str ?? '');
    for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededRng(seedText){ return mulberry32(hash32(seedText)); }

  function pickHiddenSpotsBySeed(seedText, diff='normal'){
    const cfg = BATH_TUNING[diff] || BATH_TUNING.normal;
    const rng = seededRng(`bath:${seedText}:${diff}`);
    const arr = HIDDEN_SPOT_DEFS.slice();

    // difficulty weights
    function w(d){
      let ww = d.weight || 1;
      if(diff === 'easy'){
        if(d.zone === 'foot') ww *= 0.65;
        if(d.zone === 'upper' || d.zone === 'head') ww *= 1.15;
      } else if(diff === 'hard'){
        if(d.zone === 'foot' || d.zone === 'upper') ww *= 1.2;
      }
      return ww;
    }

    const out = [];
    while(out.length < cfg.hiddenSpotCount && arr.length){
      const total = arr.reduce((s,d)=>s+w(d),0);
      let t = rng() * total;
      let idx = 0;
      for(let i=0;i<arr.length;i++){ t -= w(arr[i]); if(t<=0){ idx=i; break; } }
      const d = arr.splice(idx,1)[0];
      out.push({
        ...d,
        active: true,
        revealed: false,
        cleaned: false,
        residue: 0,
        risk: 0,
        severity: 0.65 + rng()*0.35,
        scrubNeedMs: Math.round(cfg.scrubHoldMsBase * (d.scrubMul||1) * (0.92 + rng()*0.2)),
        scrubAccMs: 0,
        revealAtMs: Math.round(500 + rng()*2200),
        regrowCooldownMs: 1200 + Math.round(rng()*1600),
        lastScrubTs: 0
      });
    }
    return out;
  }

  const TUNE = {
    comboCount: 0,
    comboExpireTs: 0,
    heatBand: 'stable',
    residuePenalty: 0,
    fungusRisk: 0,
    didBossSpawnThisRun: false
  };

  function hhaInitTuningForRun(){
    STATE.diff = ['easy','normal','hard'].includes(HHA_CTX.diffQ) ? HHA_CTX.diffQ : 'normal';
    STATE.cfg = BATH_TUNING[STATE.diff] || BATH_TUNING.normal;
    STATE.timeLeftSec = STATE.cfg.totalTimeSec;
    STATE.bubble = STATE.cfg.bubbleBudget;
    STATE.heat = 0;
    STATE.sweat = 0;
    STATE.wetCoverage = 0;
    STATE.rinseCoverage = 0;
    STATE.dryCoverage = 0;
    STATE.hiddenSpots = pickHiddenSpotsBySeed(HHA_CTX.seed, STATE.diff);

    TUNE.comboCount = 0;
    TUNE.comboExpireTs = 0;
    TUNE.heatBand = 'stable';
    TUNE.residuePenalty = 0;
    TUNE.fungusRisk = 0;
    TUNE.didBossSpawnThisRun = false;

    tel('tuning_init', { diff: STATE.diff, hiddenSpotCount: STATE.hiddenSpots.length, bubble: STATE.bubble });
  }

  function hhaGetHeatBand(v){
    if(v >= 85) return 'critical';
    if(v >= 70) return 'hot';
    if(v >= 40) return 'pressure';
    return 'stable';
  }

  function hhaTuningOnPhaseEnter(phase){
    tel('phase_enter_tuning', { phase, tMs: STATE.totalElapsedMs|0 });
  }

  function hhaComboBreak(reason=''){
    if(TUNE.comboCount > 0) tel('combo_break', { combo:TUNE.comboCount, reason });
    TUNE.comboCount = 0;
    TUNE.comboExpireTs = 0;
  }
  function hhaComboAdd(kind='clean'){
    const nowTs = now();
    if(TUNE.comboExpireTs && nowTs <= TUNE.comboExpireTs) TUNE.comboCount++;
    else TUNE.comboCount = 1;
    TUNE.comboExpireTs = nowTs + (STATE.cfg?.comboWindowMs || 700);

    if(TUNE.comboCount >= 2){
      STATE.heat = clamp(STATE.heat - (STATE.cfg?.heatDropOnGoodAction || 1), 0, 100);
      STATE.bubble = clamp(STATE.bubble + 1, 0, STATE.cfg?.bubbleBudget || 100);
    }
    tel('combo_add', { combo:TUNE.comboCount, kind });
  }

  function hhaBathPenaltyWrongOrder(meta={}){
    STATE.heat = clamp(STATE.heat + 6, 0, 100);
    hhaTouchMetric('wrongOrder', 1);
    hhaComboBreak('wrong_order');
    WIN.hhaHookIssue?.('wrong_order', 'sequence mistake', meta);
    BathFX.floatText?.('⚠️ ผิดลำดับ', 0.5, 0.17, 'bad');
  }
  function hhaBathPenaltyResidue(meta={}){
    STATE.heat = clamp(STATE.heat + 8, 0, 100);
    hhaTouchMetric('residueGateFails', 1);
    hhaComboBreak('residue');
    WIN.hhaHookIssue?.('residue_fail', 'residue remained', meta);
    BathFX.floatText?.('🫧 คราบ/ฟองตกค้าง', 0.5, 0.21, 'warn');
  }
  function hhaBathPenaltySlip(meta={}){
    hhaTouchMetric('slips', 1);
    hhaComboBreak('slip');
    WIN.hhaHookIssue?.('slip', 'slippery error', meta);
    BathFX.floatText?.('💦 ลื่น!', 0.5, 0.18, 'bad');
  }

  function hhaSetWetCoverage01(v){ STATE.wetCoverage = clamp(v,0,1); }
  function hhaSetRinseCoverage01(v){ STATE.rinseCoverage = clamp(v,0,1); }
  function hhaSetDryCoverage01(v){ STATE.dryCoverage = clamp(v,0,1); }

  function hhaOnScrubSpot(spotId, dtMs=16){
    const s = STATE.hiddenSpots.find(x=>x.id===spotId);
    if(!s || s.cleaned) return null;
    s.revealed = true;
    s.lastScrubTs = now();

    const wetOK = STATE.wetCoverage >= (STATE.cfg?.wetCoverageRequired || 0.8);
    const heatPenalty = STATE.heat >= 85 ? 0.8 : (STATE.heat >= 70 ? 0.9 : 1.0);
    const phasePenalty = wetOK ? 1.0 : (STATE.cfg?.soapEfficiencyIfNotWet || 0.55);

    s.scrubAccMs += (Number(dtMs)||16) * heatPenalty * phasePenalty;
    STATE.bubble = clamp(STATE.bubble - 0.03*(dtMs/16), 0, STATE.cfg?.bubbleBudget || 100);

    if(s.scrubAccMs >= s.scrubNeedMs){
      s.cleaned = true;
      s.residue = clamp(s.residue * 0.4, 0, 1);
      hhaComboAdd('hidden_clean');
      STATE.heat = clamp(STATE.heat - (STATE.cfg?.heatDropOnGoodAction || 1), 0, 100);
      tel('hidden_clean', { spotId:s.id, spotName:s.label, scrubNeedMs:s.scrubNeedMs });
      BathFX.emitRing?.(s.x, s.y, 'good');
      return { cleaned:true, spot:s };
    }
    return { cleaned:false, progress: clamp(s.scrubAccMs/s.scrubNeedMs,0,1), spot:s };
  }

  function hhaHiddenRevealAndRegrowTick(dtMs){
    const p = STATE.phase;
    if(!(p === 'scrub')) return;

    for(const s of STATE.hiddenSpots){
      if(s.cleaned) continue;

      if(!s.revealed && STATE.totalElapsedMs >= s.revealAtMs){
        s.revealed = true;
        tel('hidden_reveal', { spotId:s.id, spotName:s.label });
        BathFX.emitPulse?.(s.x, s.y, 'reveal');
        BathFX.emitSparkle?.(s.x, s.y, 8);
      }

      // regrow when hot and no recent scrub
      const hot = STATE.heat >= (STATE.cfg?.heatRegrowThreshold || 70);
      if(hot && s.revealed && !s.cleaned && (now() - (s.lastScrubTs||0) > s.regrowCooldownMs)){
        const base = (STATE.cfg?.hiddenMoveChance || 0.12) * (dtMs/1000) * 0.45;
        const mul = STATE.heat >= 85 ? 1.6 : 1.2;
        if(Math.random() < base * mul){
          s.severity = clamp(s.severity + 0.08, 0, 1);
          s.residue = clamp(s.residue + 0.05, 0, 1);
          hhaTouchMetric('regrowCount', 1);
          tel('regrow', { spotId:s.id, spotName:s.label });
        }
      }
    }
  }

  function hhaGetResidueAverage01(){
    if(!STATE.hiddenSpots.length) return 0;
    return STATE.hiddenSpots.reduce((a,s)=>a + clamp(s.residue||0,0,1), 0) / STATE.hiddenSpots.length;
  }

  /* =========================================================
   * E) MINI-BOSS (simplified)
   * =======================================================*/
  function maybeSpawnBoss(){
    const bcfg = STATE.cfg?.boss;
    if(!bcfg?.enabled) return;
    if(STATE.boss?.alive) return;
    if(STATE.phase !== 'scrub') return;
    if(STATE.timeLeftSec < 10) return;
    if(STATE.totalElapsedMs < (bcfg.minSpawnSec||15)*1000) return;

    let chance = (bcfg.chancePerRun || 0.5) * 0.01; // tick chance
    if(TUNE.didBossSpawnThisRun) chance *= (STATE.diff === 'hard' ? 0.5 : 0.35);
    if(STATE.heat >= 85) chance += 0.01;
    else if(STATE.heat >= 70) chance += 0.005;

    const candidates = STATE.hiddenSpots.filter(s => s.revealed && !s.cleaned);
    if(!candidates.length) return;

    if(Math.random() < chance){
      // pick weighted by severity+bias
      const total = candidates.reduce((a,s)=>a + (0.4 + (s.bossBias||0) + (s.severity||0)), 0);
      let t = Math.random()*total;
      let chosen = candidates[0];
      for(const s of candidates){ t -= (0.4 + (s.bossBias||0) + (s.severity||0)); if(t<=0){ chosen=s; break; } }

      const type = (chosen.zone === 'upper' || chosen.zone === 'foot') ? 'stink_monster' : 'oil_slick_boss';
      const hp = Math.max(3, Math.round((bcfg.hp||8) * (0.9 + Math.random()*0.2)));

      STATE.boss = {
        alive: true,
        type,
        spotId: chosen.id,
        spotName: chosen.label,
        x: chosen.x, y: chosen.y,
        hp, hpMax: hp,
        stage: 'spawned',
        spawnTs: now(),
        timeoutTs: now() + (bcfg.durationSec || 12)*1000
      };
      TUNE.didBossSpawnThisRun = true;

      tel('boss_spawn', { type, spotId:chosen.id, hp });
      BathFX.emitPulse?.(chosen.x, chosen.y, 'boss');
      BathFX.emitSparkle?.(chosen.x, chosen.y, 12);
      BathFX.floatText?.('🧪 MINI-BOSS!', chosen.x, chosen.y, 'bad');
    }
  }

  function bossTick(){
    if(!STATE.boss?.alive) return;
    if(now() >= STATE.boss.timeoutTs){
      STATE.boss.alive = false;
      STATE.heat = clamp(STATE.heat + 10, 0, 100);
      hhaTouchMetric('spreadCount', 1);
      tel('boss_timeout', { type:STATE.boss.type, spotId:STATE.boss.spotId });
      BathFX.floatText?.('☣️ กระจาย!', STATE.boss.x, STATE.boss.y, 'bad');
      return;
    }
  }

  // optional action API if you want real sequence for boss
  function hhaBossHit(action='scrub'){
    const b = STATE.boss;
    if(!b || !b.alive) return false;

    // simple: scrub is damaging; wet/rinse are support
    if(action === 'scrub'){
      b.hp = Math.max(0, b.hp - 1);
      tel('boss_hit', { action, hp:b.hp, hpMax:b.hpMax, type:b.type });
      BathFX.emitRing?.(b.x, b.y, 'bosshit');
      if(b.hp <= 0){
        b.alive = false;
        hhaTouchMetric('bossKilled', 1);
        STATE.heat = clamp(STATE.heat - 10, 0, 100);
        STATE.bubble = clamp(STATE.bubble + 8, 0, STATE.cfg?.bubbleBudget || 100);
        tel('boss_kill', { type:b.type });
        BathFX.floatText?.('🏆 BOSS DOWN!', b.x, b.y, 'good');
      }
      return true;
    }

    if(action === 'wet' || action === 'rinse' || action === 'soap'){
      tel('boss_setup', { action, type:b.type });
      return true;
    }

    hhaBathPenaltyWrongOrder({ kind:'boss', action });
    return false;
  }

  /* =========================================================
   * F) DOM / UI (gameplay HUD)
   * =======================================================*/
  const UI = {
    root: null,
    playArea: null,
    bodyCanvas: null,
    bodyCtx: null,

    btnStart: null,
    btnRetry: null,
    btnTools: [],
    btnPhaseNext: null,  // debug helper

    hudPhase: null,
    hudTime: null,
    hudHeat: null,
    hudBubble: null,
    hudScore: null,
    hudTip: null,
    hudBoss: null,

    // summary old/new bridge
    resultRoot: null,
  };

  function bindUI(){
    UI.root = $('#bathGame') || DOC.body;
    UI.playArea = $('#playArea') || $('.play-area') || UI.root;
    UI.bodyCanvas = $('#bathBodyCanvas');
    UI.bodyCtx = UI.bodyCanvas ? UI.bodyCanvas.getContext('2d') : null;

    UI.btnStart = $('#btnStartBath');
    UI.btnRetry = $('#btnRetryBath');
    UI.btnPhaseNext = $('#btnPhaseNext');

    UI.btnTools = $$('[data-tool]');
    UI.hudPhase = $('#hudPhase');
    UI.hudTime  = $('#hudTime');
    UI.hudHeat  = $('#hudHeat');
    UI.hudBubble= $('#hudBubble');
    UI.hudScore = $('#hudScore');
    UI.hudTip   = $('#hudTip');
    UI.hudBoss  = $('#hudBoss');

    UI.resultRoot = $('#viewResult') || $('#resultPanel');

    UI.btnStart?.addEventListener('click', startRun);
    UI.btnRetry?.addEventListener('click', restartGame);

    UI.btnTools.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        setTool(String(btn.dataset.tool || 'soap'));
      });
    });

    if(UI.btnPhaseNext && STATE.debug){
      UI.btnPhaseNext.hidden = false;
      UI.btnPhaseNext.addEventListener('click', ()=>advancePhaseManual());
    }

    bindPlayInput();
    resizePlayCanvas();
    WIN.addEventListener('resize', resizePlayCanvas, { passive:true });
  }

  function resizePlayCanvas(){
    if(!UI.bodyCanvas || !UI.playArea) return;
    const r = UI.playArea.getBoundingClientRect();
    const dpr = Math.min(2, WIN.devicePixelRatio || 1);
    UI.bodyCanvas.width = Math.max(1, Math.round(r.width * dpr));
    UI.bodyCanvas.height = Math.max(1, Math.round(r.height * dpr));
    UI.bodyCanvas.style.width = `${r.width}px`;
    UI.bodyCanvas.style.height = `${r.height}px`;

    const ctx = UI.bodyCtx;
    if(ctx){
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr, dpr);
    }
  }

  function setTool(tool){
    STATE.selectedTool = tool;
    UI.btnTools.forEach(b=>b.classList.toggle('is-active', String(b.dataset.tool) === tool));
    tel('tool_change', { tool });
  }

  function bindPlayInput(){
    if(!UI.playArea) return;

    UI.playArea.addEventListener('pointerdown', (e)=>{
      if(!STATE.started || STATE.ended) return;
      const p = getLocalPointer(e);
      STATE.pointer.down = true;
      updatePointerNorm(p.x, p.y);
      onGamePointer('down', p.x, p.y);
    }, { passive:true });

    UI.playArea.addEventListener('pointermove', (e)=>{
      if(!STATE.started || STATE.ended) return;
      const p = getLocalPointer(e);
      updatePointerNorm(p.x, p.y);
      if(STATE.pointer.down){
        STATE.pointer.moved = true;
        onGamePointer('move', p.x, p.y);
      }
    }, { passive:true });

    function onUp(e){
      if(!STATE.started || STATE.ended) return;
      const p = getLocalPointer(e);
      updatePointerNorm(p.x, p.y);
      onGamePointer('up', p.x, p.y);
      STATE.pointer.down = false;
    }
    UI.playArea.addEventListener('pointerup', onUp, { passive:true });
    UI.playArea.addEventListener('pointercancel', onUp, { passive:true });
  }

  function getLocalPointer(e){
    const r = UI.playArea.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  function updatePointerNorm(x, y){
    const r = UI.playArea.getBoundingClientRect();
    STATE.pointer.x = x;
    STATE.pointer.y = y;
    STATE.pointer.nx = clamp(x / Math.max(1,r.width), 0, 1);
    STATE.pointer.ny = clamp(y / Math.max(1,r.height), 0, 1);
  }

  /* =========================================================
   * G) TOP-DOWN BODY MAP + POINTER INTERACTIONS
   * =======================================================*/
  const BODY_ZONES = {
    head:   { x:0.5, y:0.16, r:0.12 },
    upper:  { x:0.5, y:0.31, r:0.18 },
    armL:   { x:0.27, y:0.45, r:0.13 },
    armR:   { x:0.73, y:0.45, r:0.13 },
    legL:   { x:0.43, y:0.67, r:0.11 },
    legR:   { x:0.57, y:0.67, r:0.11 },
    footL:  { x:0.44, y:0.88, r:0.08 },
    footR:  { x:0.56, y:0.88, r:0.08 }
  };

  function pointHitsNormCircle(nx, ny, cx, cy, rr){
    const dx = nx-cx, dy = ny-cy;
    return (dx*dx + dy*dy) <= rr*rr;
  }

  function onGamePointer(kind, px, py){
    tel('bath_action_input', { kind, phase:STATE.phase, tool:STATE.selectedTool });

    const nx = STATE.pointer.nx, ny = STATE.pointer.ny;

    // Phase-specific interactions
    if(STATE.phase === 'wet'){
      if(STATE.selectedTool !== 'water'){
        hhaBathPenaltyWrongOrder({ expected:'water', got:STATE.selectedTool, phase:'wet' });
        return;
      }
      handleWetCoverage(nx, ny, kind);
      return;
    }

    if(STATE.phase === 'scrub'){
      if(!(STATE.selectedTool === 'soap' || STATE.selectedTool === 'sponge' || STATE.selectedTool === 'shampoo')){
        hhaBathPenaltyWrongOrder({ expected:'soap/sponge', got:STATE.selectedTool, phase:'scrub' });
        return;
      }

      // hidden spots scrub
      for(const s of STATE.hiddenSpots){
        if(s.cleaned) continue;
        const hitR = Math.max(0.045, s.r * 1.35); // touch-friendly
        if(pointHitsNormCircle(nx, ny, s.x, s.y, hitR)){
          const out = hhaOnScrubSpot(s.id, 16);
          if(out?.cleaned){
            STATE.score += 8;
          }
        }
      }

      // boss interaction (simplified)
      if(STATE.boss?.alive){
        const b = STATE.boss;
        if(pointHitsNormCircle(nx, ny, b.x, b.y, 0.07)){
          hhaBossHit('scrub');
        }
      }

      // small penalty if scrubbing without enough wet coverage
      if(STATE.wetCoverage < (STATE.cfg?.wetCoverageRequired || 0.8) && Math.random() < 0.03){
        hhaBathPenaltyResidue({ reason:'scrub_before_wet_enough' });
      }
      return;
    }

    if(STATE.phase === 'rinse'){
      if(STATE.selectedTool !== 'water'){
        hhaBathPenaltyWrongOrder({ expected:'water', got:STATE.selectedTool, phase:'rinse' });
        return;
      }
      handleRinseCoverage(nx, ny, kind);
      if(STATE.boss?.alive && pointHitsNormCircle(nx, ny, STATE.boss.x, STATE.boss.y, 0.08)){
        hhaBossHit('rinse');
      }
      return;
    }

    if(STATE.phase === 'drydress'){
      if(STATE.selectedTool === 'towel'){
        handleDryCoverage(nx, ny, kind);
      } else if(STATE.selectedTool === 'clothes'){
        // dressing too early -> fungus risk / wrong order
        if(STATE.dryCoverage < 0.8){
          hhaBathPenaltyWrongOrder({ expected:'towel first', got:'clothes', phase:'drydress' });
          TUNE.fungusRisk = clamp(TUNE.fungusRisk + 5, 0, 100);
        } else {
          STATE.score += 5;
          tel('dress_ok', {});
        }
      } else {
        hhaBathPenaltyWrongOrder({ expected:'towel/clothes', got:STATE.selectedTool, phase:'drydress' });
      }
      return;
    }
  }

  // coverage maps (simple accumulators)
  const COVER = {
    wet: new Set(),
    rinse: new Set(),
    dry: new Set(),
    gridW: 10,
    gridH: 16
  };

  function gridKeyFromNorm(nx, ny){
    const gx = clamp(Math.floor(nx * COVER.gridW), 0, COVER.gridW-1);
    const gy = clamp(Math.floor(ny * COVER.gridH), 0, COVER.gridH-1);
    return `${gx},${gy}`;
  }

  function handleWetCoverage(nx, ny, kind){
    if(kind === 'down' || kind === 'move'){
      COVER.wet.add(gridKeyFromNorm(nx, ny));
      const max = COVER.gridW * COVER.gridH;
      hhaSetWetCoverage01(COVER.wet.size / max);
      STATE.score += 0.05;
      // heat relief from correct action
      STATE.heat = clamp(STATE.heat - (STATE.cfg?.heatDropOnGoodAction || 1)*0.12, 0, 100);
    }
  }
  function handleRinseCoverage(nx, ny, kind){
    if(kind === 'down' || kind === 'move'){
      COVER.rinse.add(gridKeyFromNorm(nx, ny));
      const max = COVER.gridW * COVER.gridH;
      hhaSetRinseCoverage01(COVER.rinse.size / max);
      STATE.score += 0.05;

      // reduce residues on nearby spots
      for(const s of STATE.hiddenSpots){
        const hitR = Math.max(0.05, s.r * 1.4);
        if(pointHitsNormCircle(nx, ny, s.x, s.y, hitR)){
          s.residue = clamp(s.residue - 0.06, 0, 1);
        }
      }
    }
  }
  function handleDryCoverage(nx, ny, kind){
    if(kind === 'down' || kind === 'move'){
      COVER.dry.add(gridKeyFromNorm(nx, ny));
      const max = COVER.gridW * COVER.gridH;
      hhaSetDryCoverage01(COVER.dry.size / max);
      STATE.score += 0.05;
    }
  }

  /* =========================================================
   * H) PHASE CONTROL
   * =======================================================*/
  function setPhase(next){
    if(STATE.phase === next) return;
    STATE.phase = next;
    STATE.phaseIndex = Math.max(0, PHASES.indexOf(next));
    STATE.phaseStartedAt = now();
    tel('phase_change', { phase: next, idx: STATE.phaseIndex });

    hhaHookPhaseChange(next);
    hhaTuningOnPhaseEnter(next);

    // auto tool suggestions
    if(next === 'wet') setTool('water');
    if(next === 'scrub') setTool('soap');
    if(next === 'rinse') setTool('water');
    if(next === 'drydress') setTool('towel');

    updateHudTip();
  }

  function hhaHookPhaseChange(phase){
    tel('phase_enter', { phase });
  }

  function advancePhaseManual(){
    const i = PHASES.indexOf(STATE.phase);
    if(i >= 0 && i < PHASES.length-1) setPhase(PHASES[i+1]);
  }

  function autoPhaseProgressTick(){
    // Prep countdown
    if(STATE.phase === 'prep'){
      const prepSec = STATE.cfg?.prepSec || 5;
      const t = (now() - STATE.phaseStartedAt) / 1000;
      if(t >= prepSec){
        setPhase('wet');
      }
      return;
    }

    // Wet complete threshold
    if(STATE.phase === 'wet'){
      if(STATE.wetCoverage >= (STATE.cfg?.wetCoverageRequired || 0.8)){
        setPhase('scrub');
      }
      return;
    }

    // Scrub complete when most hidden spots cleaned
    if(STATE.phase === 'scrub'){
      const total = STATE.hiddenSpots.length || 1;
      const cleaned = STATE.hiddenSpots.filter(s=>s.cleaned).length;
      if(cleaned >= Math.ceil(total * 0.8)){
        setPhase('rinse');
      }
      return;
    }

    // Rinse gate
    if(STATE.phase === 'rinse'){
      const residueAvg = hhaGetResidueAverage01();
      const tol = STATE.cfg?.rinseResidueTolerance || 0.14;
      if(STATE.rinseCoverage >= 0.75){
        if(residueAvg > tol){
          hhaBathPenaltyResidue({ residueAvg: +residueAvg.toFixed(2), tol });
          TUNE.residuePenalty = clamp(TUNE.residuePenalty + (residueAvg - tol)*30, 0, 100);
          // still allow progress if rinse enough + time pressure
          if(STATE.rinseCoverage >= 0.9) setPhase('drydress');
        } else {
          setPhase('drydress');
        }
      }
      return;
    }

    // Dry + dress complete
    if(STATE.phase === 'drydress'){
      if(STATE.dryCoverage >= 0.8){
        // if player hasn't clicked clothes, allow auto-complete after short delay
        if((now() - STATE.phaseStartedAt) > 1200){
          endGame(true);
        }
      }
    }
  }

  function updateHudTip(){
    if(!UI.hudTip) return;
    const tips = {
      prep: 'เลือกอุปกรณ์และเตรียมพร้อม (Prep)',
      wet: 'ฉีดน้ำให้ทั่วร่างกายก่อนฟอก',
      scrub: 'ตามหาคราบซ่อน แล้วถูให้ถูกจุด',
      rinse: 'ล้างฟองและคราบตกค้างให้หมด',
      drydress: 'เช็ดให้แห้งก่อนใส่เสื้อผ้า',
      summary: 'สรุปผลการเล่น'
    };
    UI.hudTip.textContent = tips[STATE.phase] || '';
  }

  /* =========================================================
   * I) UPDATE LOOP
   * =======================================================*/
  let RAF = 0;
  let LAST_TS = 0;

  function gameLoop(ts){
    RAF = requestAnimationFrame(gameLoop);
    if(!STATE.started || STATE.paused || STATE.ended) return;

    const dt = Math.min(33, LAST_TS ? (ts - LAST_TS) : 16);
    LAST_TS = ts;

    update(dt);
    render();
  }

  function update(dtMs){
    STATE.totalElapsedMs += dtMs;
    STATE.timeLeftSec = Math.max(0, (STATE.cfg?.totalTimeSec || 80) - (STATE.totalElapsedMs/1000));

    // base heat rise
    STATE.heat = clamp(STATE.heat + (STATE.cfg?.heatRisePerSec || 1.0) * (dtMs/1000), 0, 100);
    STATE.sweat = clamp(STATE.heat * 0.8, 0, 100);

    // band changes
    const band = hhaGetHeatBand(STATE.heat);
    if(band !== TUNE.heatBand){
      TUNE.heatBand = band;
      tel('heat_band_change', { band, heat: Math.round(STATE.heat) });
      if(band === 'critical') hhaTouchMetric('heatCriticalCount', 1);
    }

    // phase pressure effects
    hhaHiddenRevealAndRegrowTick(dtMs);
    maybeSpawnBoss();
    bossTick();

    // combo timeout
    if(TUNE.comboCount > 0 && now() > TUNE.comboExpireTs) hhaComboBreak('timeout');

    // fungus risk during drydress if not dry enough
    if(STATE.phase === 'drydress'){
      const needDry = ((STATE.cfg?.dryCriticalCount || 4) / 5);
      const lack = Math.max(0, needDry - STATE.dryCoverage);
      TUNE.fungusRisk = clamp(TUNE.fungusRisk + lack * (STATE.cfg?.fungusRiskRate || 0.7) * (dtMs/1000) * 2, 0, 100);
    }

    // time over
    if(STATE.timeLeftSec <= 0){
      endGame(false);
      return;
    }

    autoPhaseProgressTick();
    updateHud();
  }

  function updateHud(){
    if(UI.hudPhase) UI.hudPhase.textContent = `Phase: ${STATE.phase}`;
    if(UI.hudTime)  UI.hudTime.textContent  = `${Math.ceil(STATE.timeLeftSec)}s`;
    if(UI.hudHeat)  UI.hudHeat.textContent  = `${Math.round(STATE.heat)} (${TUNE.heatBand})`;
    if(UI.hudBubble)UI.hudBubble.textContent= `${Math.round(STATE.bubble)}`;
    if(UI.hudScore) UI.hudScore.textContent = `${Math.round(STATE.score)}`;

    if(UI.hudBoss){
      if(STATE.boss?.alive){
        const sec = Math.max(0, Math.ceil((STATE.boss.timeoutTs - now())/1000));
        UI.hudBoss.textContent = `🧪 ${STATE.boss.type} HP ${STATE.boss.hp}/${STATE.boss.hpMax} ${sec}s`;
        UI.hudBoss.hidden = false;
      } else {
        UI.hudBoss.hidden = true;
      }
    }
  }

  /* =========================================================
   * J) RENDER (Top-down body + spots)
   * =======================================================*/
  function render(){
    if(!UI.bodyCtx || !UI.bodyCanvas) return;

    const ctx = UI.bodyCtx;
    const r = UI.playArea.getBoundingClientRect();
    const w = r.width, h = r.height;

    ctx.clearRect(0,0,w,h);

    // Background
    ctx.fillStyle = '#08101d';
    ctx.fillRect(0,0,w,h);

    // heat tint
    if(STATE.heat >= 40){
      const a = STATE.heat >= 85 ? 0.18 : (STATE.heat >= 70 ? 0.12 : 0.06);
      ctx.fillStyle = `rgba(239,68,68,${a})`;
      ctx.fillRect(0,0,w,h);
    }

    // body silhouette
    drawBodySilhouette(ctx, w, h);

    // wet/rinse/dry overlays (light visualization)
    drawCoverageOverlay(ctx, w, h);

    // hidden spots (top-down indicators)
    drawHiddenSpots(ctx, w, h);

    // pointer cursor helper
    if(STATE.pointer.down){
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(147,197,253,.85)';
      ctx.lineWidth = 2;
      ctx.arc(STATE.pointer.x, STATE.pointer.y, 12, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function drawBodySilhouette(ctx, w, h){
    ctx.save();
    ctx.fillStyle = 'rgba(148,163,184,.16)';
    ctx.strokeStyle = 'rgba(148,163,184,.25)';
    ctx.lineWidth = 2;

    // head
    ellipsePath(ctx, w*0.5, h*0.16, w*0.12, h*0.065); ctx.fill(); ctx.stroke();

    // torso
    roundRectPath(ctx, w*0.34, h*0.24, w*0.32, h*0.26, 24); ctx.fill(); ctx.stroke();

    // arms
    roundRectPath(ctx, w*0.17, h*0.30, w*0.12, h*0.24, 18); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, w*0.71, h*0.30, w*0.12, h*0.24, 18); ctx.fill(); ctx.stroke();

    // legs
    roundRectPath(ctx, w*0.40, h*0.53, w*0.09, h*0.27, 16); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, w*0.51, h*0.53, w*0.09, h*0.27, 16); ctx.fill(); ctx.stroke();

    // feet
    roundRectPath(ctx, w*0.37, h*0.83, w*0.14, h*0.08, 16); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, w*0.49, h*0.83, w*0.14, h*0.08, 16); ctx.fill(); ctx.stroke();

    ctx.restore();
  }

  function drawCoverageOverlay(ctx, w, h){
    // Simple “washed” effect intensity from coverage values
    const wetAlpha = clamp(STATE.wetCoverage * 0.16, 0, 0.16);
    const rinseAlpha = clamp(STATE.rinseCoverage * 0.12, 0, 0.12);
    const dryAlpha = clamp(STATE.dryCoverage * 0.10, 0, 0.10);

    if(wetAlpha > 0){
      ctx.fillStyle = `rgba(59,130,246,${wetAlpha})`;
      ctx.fillRect(0,0,w,h);
    }
    if(rinseAlpha > 0){
      ctx.fillStyle = `rgba(16,185,129,${rinseAlpha})`;
      ctx.fillRect(0,0,w,h);
    }
    if(dryAlpha > 0){
      ctx.fillStyle = `rgba(245,158,11,${dryAlpha})`;
      ctx.fillRect(0,0,w,h);
    }
  }

  function drawHiddenSpots(ctx, w, h){
    const t = performance.now();

    for(const s of STATE.hiddenSpots){
      const x = s.x * w;
      const y = s.y * h;
      const rr = Math.max(9, s.r * Math.min(w,h));

      if(!s.revealed && !STATE.debug) continue;

      if(s.cleaned){
        ctx.beginPath();
        ctx.fillStyle = 'rgba(16,185,129,.95)';
        ctx.arc(x,y, rr*0.8, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(16,185,129,.35)';
        ctx.lineWidth = 2;
        ctx.arc(x,y, rr+4, 0, Math.PI*2);
        ctx.stroke();
      } else {
        const pulse = 1 + Math.sin(t*0.008 + x*0.01)*0.06;
        const opacity = STATE.cfg?.hiddenRevealOpacity || 0.24;

        // shadow/glow
        ctx.beginPath();
        ctx.fillStyle = `rgba(245,158,11,${opacity*0.6})`;
        ctx.arc(x,y, rr*1.6*pulse, 0, Math.PI*2);
        ctx.fill();

        // core
        ctx.beginPath();
        ctx.fillStyle = `rgba(245,158,11,${clamp(opacity+0.12,0,1)})`;
        ctx.arc(x,y, rr*pulse, 0, Math.PI*2);
        ctx.fill();

        // residue ring
        if((s.residue||0) > 0){
          ctx.beginPath();
          ctx.strokeStyle = `rgba(239,68,68,${0.2 + s.residue*0.5})`;
          ctx.lineWidth = 2 + s.residue*3;
          ctx.arc(x,y, rr+6, 0, Math.PI*2);
          ctx.stroke();
        }
      }
    }

    // boss indicator
    if(STATE.boss?.alive){
      const b = STATE.boss;
      const x = b.x * w, y = b.y * h;
      const pulse = 1 + Math.sin(t*0.012)*0.08;
      const sec = Math.max(0, (b.timeoutTs - now())/1000);
      const frac = clamp(sec / ((STATE.cfg?.boss?.durationSec)||12), 0, 1);

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239,68,68,.95)';
      ctx.lineWidth = 3;
      ctx.arc(x,y, 20*pulse, 0, Math.PI*2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239,68,68,.22)';
      ctx.lineWidth = 10;
      ctx.arc(x,y, 28*pulse, 0, Math.PI*2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(251,191,36,.95)';
      ctx.lineWidth = 4;
      ctx.arc(x,y, 34, -Math.PI/2, -Math.PI/2 + Math.PI*2*frac);
      ctx.stroke();
    }
  }

  function ellipsePath(ctx, cx, cy, rx, ry){
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
  }
  function roundRectPath(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  /* =========================================================
   * K) SUMMARY (PACK U integrated simplified + bridge)
   * =======================================================*/
  function hhaBuildBathHeatmapData(){
    return STATE.hiddenSpots.map(s => ({
      id: s.id, label: s.label, zone: s.zone, x:s.x, y:s.y, r:s.r,
      status: s.cleaned ? 'clean' : (s.revealed ? 'missed' : 'hidden'),
      residue: +clamp(s.residue||0,0,1).toFixed(2),
      scrubMs: Math.round(s.scrubAccMs||0),
      scrubNeedMs: Math.round(s.scrubNeedMs||0)
    }));
  }

  function hhaBathTopMistakes(){
    const s = STATE.stats;
    return [
      { key:'wrong_order', label:'ผิดลำดับการอาบ', count:s.wrongOrder||0 },
      { key:'residue_fail', label:'ล้างฟอง/คราบตกค้าง', count:s.residueGateFails||0 },
      { key:'regrow', label:'คราบฟื้นตัวเพราะช้า', count:s.regrowCount||0 },
      { key:'slip', label:'ลื่น/พลาดจังหวะ', count:s.slips||0 },
      { key:'spread', label:'เชื้อ/คราบกระจาย', count:s.spreadCount||0 },
    ].filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,3);
  }

  function hhaBathTopTips(){
    const tips = [];
    if(STATE.wetCoverage < (STATE.cfg?.wetCoverageRequired || 0.8)){
      tips.push({ label:'ฉีดน้ำให้ทั่วก่อนฟอก เพื่อให้สบู่ทำงานเต็มประสิทธิภาพ' });
    }
    if(hhaGetResidueAverage01() > (STATE.cfg?.rinseResidueTolerance || 0.14)){
      tips.push({ label:'ล้างฟองให้หมด โดยเฉพาะจุดอับและข้อพับ' });
    }
    if(STATE.dryCoverage < 0.8){
      tips.push({ label:'เช็ดให้แห้งจุดสำคัญ ลดความเสี่ยงเชื้อรา/อับชื้น' });
    }
    if((STATE.stats.wrongOrder||0) > 0){
      tips.push({ label:'ทำตามลำดับ: เปียก → ฟอก → ถู → ล้าง → เช็ด → เสื้อผ้า' });
    }
    if(STATE.heat >= 70){
      tips.push({ label:'เร่งจังหวะให้ต่อเนื่อง ลด Heat/Sweat เพื่อไม่ให้คราบฟื้นตัว' });
    }
    if(!tips.length){
      tips.push({ label:'ดีมาก! รอบหน้าลองทำคอมโบต่อเนื่องและฆ่าบอสให้ไวขึ้น' });
    }
    return tips.slice(0,3);
  }

  function hhaGradeBath(score, extra={}){
    if(!extra.completed) return 'C';
    if(score >= 90 && (extra.fungusRisk||0)<=10 && (extra.residuePenalty||0)<=8) return 'A+';
    if(score >= 85 && (extra.fungusRisk||0)<=15 && (extra.residuePenalty||0)<=10) return 'A';
    if(score >= 70) return 'B';
    if(score >= 55) return 'C';
    return 'D';
  }

  function hhaCalculateBathFinalScores({ completed=false }={}){
    const totalSpots = Math.max(1, STATE.hiddenSpots.length);
    const cleanedSpots = STATE.hiddenSpots.filter(s=>s.cleaned).length;
    const revealedSpots = STATE.hiddenSpots.filter(s=>s.revealed).length;

    const cleanScore = (cleanedSpots / totalSpots) * 40;
    const sequenceScore = Math.max(0, 20 - (STATE.stats.wrongOrder||0)*6);
    const coverageScore = clamp(STATE.wetCoverage,0,1)*8 + clamp(STATE.rinseCoverage,0,1)*8 + clamp(STATE.dryCoverage,0,1)*8;
    const comboBonus = Math.min(12, TUNE.comboCount * 1.2);
    const bossBonus = Math.min(10, (STATE.stats.bossKilled||0) * 6);
    const timeBonus = Math.max(0, Math.min(8, STATE.timeLeftSec * 0.12));

    let scoreRaw =
      cleanScore + sequenceScore + coverageScore + comboBonus + bossBonus + timeBonus
      - TUNE.residuePenalty * 2.0
      - TUNE.fungusRisk * 1.8
      - (STATE.stats.regrowCount||0) * 4
      - (STATE.stats.slips||0) * 3;

    scoreRaw *= (STATE.cfg?.scoreMul || 1);
    const totalScore = Math.round(clamp(scoreRaw, 0, 100));
    const grade = hhaGradeBath(totalScore, { completed, residuePenalty:TUNE.residuePenalty, fungusRisk:TUNE.fungusRisk });

    return {
      completed: !!completed,
      totalScore,
      grade,
      residuePenalty: Math.round(TUNE.residuePenalty),
      fungusRisk: Math.round(TUNE.fungusRisk),
      cleanScore: +cleanScore.toFixed(1),
      sequenceScore: +sequenceScore.toFixed(1),
      coverageScore: +coverageScore.toFixed(1),
      comboBonus: +comboBonus.toFixed(1),
      bossBonus: +bossBonus.toFixed(1),
      timeBonus: +timeBonus.toFixed(1),
      hidden: { totalSpots, revealedSpots, cleanedSpots },
      coverage: {
        wet:+STATE.wetCoverage.toFixed(2),
        rinse:+STATE.rinseCoverage.toFixed(2),
        dry:+STATE.dryCoverage.toFixed(2)
      },
      heat: { final: Math.round(STATE.heat), band: TUNE.heatBand },
      bubble: { left:+STATE.bubble.toFixed(1), max:STATE.cfg?.bubbleBudget || 100 },
      stats: { ...STATE.stats },
      topMistakes: hhaBathTopMistakes(),
      topTips: hhaBathTopTips(),
      heatmap: hhaBuildBathHeatmapData()
    };
  }

  // Minimal summary UI fallback (if PACK U panel not present)
  function showFallbackSummary(sum){
    if(!UI.resultRoot){
      alert(`Bath Summary\nScore: ${sum.totalScore}\nGrade: ${sum.grade}\nHeat: ${sum.heat.final}\nResidue: ${sum.residuePenalty}\nFungus Risk: ${sum.fungusRisk}`);
      return;
    }
    UI.resultRoot.hidden = false;
    UI.resultRoot.innerHTML = `
      <div style="padding:12px;color:#e5e7eb;background:#0f172a;border:1px solid rgba(148,163,184,.18);border-radius:12px">
        <h3 style="margin:0 0 8px">Bath Summary</h3>
        <div>Score: <b>${sum.totalScore}</b> | Grade: <b>${sum.grade}</b></div>
        <div>Heat: ${sum.heat.final} (${sum.heat.band}) | Bubble: ${Math.round(sum.bubble.left)}/${sum.bubble.max}</div>
        <div>Residue Penalty: ${sum.residuePenalty} | Fungus Risk: ${sum.fungusRisk}</div>
        <div style="margin-top:8px">
          <button id="bathFallbackRetry">Retry</button>
          <button id="bathFallbackHub">Back HUB</button>
        </div>
      </div>
    `;
    $('#bathFallbackRetry')?.addEventListener('click', restartGame);
    $('#bathFallbackHub')?.addEventListener('click', async ()=>{
      await hhaFlushNow('fallback-summary-backhub');
      location.href = HHA_CTX.hub || '../hub.html';
    });
  }

  /* =========================================================
   * L) BATH FX (PACK W lite in same file)
   * =======================================================*/
  const BathFX = WIN.BathFX || (() => {
    let els = null, raf = 0, last = 0;
    const fx = { trails:[], pulses:[], rings:[], sparkles:[] };

    function bind(){
      if(els) return els;
      els = {
        layer: $('#bathFxLayer'),
        cvs: $('#bathFxCanvas'),
        floatLayer: $('#bathFloatLayer'),
        bossChip: $('#bathBossChip'),
        heatVignette: $('#bathHeatVignette'),
      };
      if(!els.layer || !els.cvs || !UI.playArea) return null;
      resize();
      WIN.addEventListener('resize', resize, { passive:true });
      return els;
    }
    function resize(){
      if(!els || !UI.playArea) return;
      const r = UI.playArea.getBoundingClientRect();
      const dpr = Math.min(2, WIN.devicePixelRatio || 1);
      els.cvs.width = Math.max(1, Math.round(r.width*dpr));
      els.cvs.height= Math.max(1, Math.round(r.height*dpr));
      els.cvs.style.width = `${r.width}px`;
      els.cvs.style.height= `${r.height}px`;
    }
    function rect(){ return UI.playArea.getBoundingClientRect(); }
    function normToPx(nx,ny){ const r=rect(); return { x:nx*r.width, y:ny*r.height }; }

    function emitTrail(x,y,power=1){
      for(let i=0;i<2;i++){
        fx.trails.push({
          x:x + (Math.random()-0.5)*8, y:y + (Math.random()-0.5)*8,
          vx:(Math.random()-0.5)*0.5, vy:-0.2 - Math.random()*0.4,
          life:1, decay:0.03 + Math.random()*0.03, size:3 + Math.random()*6*power
        });
      }
    }
    function emitPulse(nx,ny,kind='reveal'){
      const p = normToPx(nx,ny);
      fx.pulses.push({ x:p.x, y:p.y, r:8, life:1, kind, grow:(kind==='boss'?3.6:2.4) });
    }
    function emitRing(nx,ny,color='good'){
      const p = normToPx(nx,ny);
      fx.rings.push({ x:p.x, y:p.y, r:10, life:1, color });
    }
    function emitSparkle(nx,ny,count=6){
      const p = normToPx(nx,ny);
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2, sp=0.4+Math.random()*1.2;
        fx.sparkles.push({ x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.2,life:1,decay:0.02+Math.random()*0.03,size:1+Math.random()*2.8 });
      }
    }
    function floatText(text,nx,ny,tone='good'){
      bind();
      if(!els?.floatLayer) return;
      const p = normToPx(nx,ny);
      const div = DOC.createElement('div');
      div.className = `bath-float-text ${tone}`;
      div.textContent = text;
      div.style.left = `${p.x}px`;
      div.style.top = `${p.y}px`;
      els.floatLayer.appendChild(div);
      setTimeout(()=>div.remove(), 900);
    }

    function tick(ts){
      raf = requestAnimationFrame(tick);
      bind();
      if(!els || !UI.playArea) return;
      const ctx = els.cvs.getContext('2d');
      const dpr = Math.min(2, WIN.devicePixelRatio || 1);
      const dt = Math.min(33, last ? ts-last : 16); last = ts;

      const W = els.cvs.width, H = els.cvs.height;
      const r = rect(), w = r.width, h = r.height;
      ctx.clearRect(0,0,W,H);
      ctx.save();
      ctx.scale(dpr,dpr);

      // heat vignette
      if(els.heatVignette){
        let o = 0;
        if(STATE.heat >= 85) o = 0.9;
        else if(STATE.heat >= 70) o = 0.55;
        else if(STATE.heat >= 40) o = 0.28;
        els.heatVignette.style.opacity = String(o);
      }

      // boss chip
      if(els.bossChip){
        if(STATE.boss?.alive){
          const sec = Math.max(0, Math.ceil((STATE.boss.timeoutTs - now())/1000));
          const nm = STATE.boss.type === 'stink_monster' ? 'Stink Monster' : 'Oil Slick Boss';
          els.bossChip.textContent = `⚠️ ${nm} • ${STATE.boss.spotName} • HP ${STATE.boss.hp}/${STATE.boss.hpMax} • ${sec}s`;
          els.bossChip.classList.remove('hidden');
        } else {
          els.bossChip.classList.add('hidden');
        }
      }

      // emit trail from pointer drag in scrub
      if(STATE.started && !STATE.ended && STATE.pointer.down && STATE.phase === 'scrub'){
        emitTrail(STATE.pointer.x, STATE.pointer.y, 0.8);
      }

      // trails
      for(let i=fx.trails.length-1;i>=0;i--){
        const t = fx.trails[i];
        t.x += t.vx * dt * 0.06; t.y += t.vy * dt * 0.06; t.life -= t.decay * (dt/16);
        if(t.life<=0){ fx.trails.splice(i,1); continue; }
        ctx.beginPath(); ctx.fillStyle = `rgba(147,197,253,${0.1 + t.life*0.22})`;
        ctx.arc(t.x,t.y,t.size*(0.4+t.life),0,Math.PI*2); ctx.fill();
      }
      // pulses
      for(let i=fx.pulses.length-1;i>=0;i--){
        const p = fx.pulses[i];
        p.life -= 0.028 * (dt/16); p.r += p.grow * (dt/16);
        if(p.life<=0){ fx.pulses.splice(i,1); continue; }
        let col = '245,158,11'; if(p.kind==='boss') col='239,68,68';
        ctx.beginPath(); ctx.strokeStyle=`rgba(${col},${0.45*p.life})`; ctx.lineWidth=(p.kind==='boss'?4:3);
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke();
      }
      // rings
      for(let i=fx.rings.length-1;i>=0;i--){
        const g=fx.rings[i];
        g.life -= 0.04*(dt/16); g.r += 2.8*(dt/16);
        if(g.life<=0){ fx.rings.splice(i,1); continue; }
        let col='16,185,129'; if(g.color==='bosshit') col='239,68,68';
        ctx.beginPath(); ctx.strokeStyle=`rgba(${col},${0.55*g.life})`; ctx.lineWidth=3;
        ctx.arc(g.x,g.y,g.r,0,Math.PI*2); ctx.stroke();
      }
      // sparkles
      for(let i=fx.sparkles.length-1;i>=0;i--){
        const s=fx.sparkles[i];
        s.x += s.vx * dt * 0.08; s.y += s.vy * dt * 0.08; s.vy += 0.015*(dt/16); s.life -= s.decay*(dt/16);
        if(s.life<=0){ fx.sparkles.splice(i,1); continue; }
        ctx.beginPath(); ctx.fillStyle=`rgba(255,255,255,${0.18+s.life*0.45})`;
        ctx.arc(s.x,s.y,s.size*(0.5+s.life),0,Math.PI*2); ctx.fill();
      }

      ctx.restore();
    }

    function start(){ bind(); cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(tick); }
    function stop(){ cancelAnimationFrame(raf); raf = 0; }
    return { start, stop, emitPulse, emitRing, emitSparkle, floatText };
  })();
  WIN.BathFX = BathFX;

  /* =========================================================
   * M) SUMMARY PANEL BRIDGE (if PACK U already added)
   * =======================================================*/
  const BathSummaryUI = WIN.BathSummaryUI || {
    show(summary){ showFallbackSummary(summary); },
    hide(){}
  };

  /* =========================================================
   * N) START / RESTART / END
   * =======================================================*/
  function resetRunState(){
    STATE.started = false;
    STATE.ended = false;
    STATE.paused = false;
    STATE.phase = 'prep';
    STATE.phaseIndex = 0;
    STATE.phaseStartedAt = 0;
    STATE.totalElapsedMs = 0;
    STATE.score = 0;
    STATE.finalScore = 0;
    STATE.finalGrade = '-';
    STATE.boss = null;
    STATE.pointer = { down:false, x:0,y:0,nx:0,ny:0,moved:false };
    STATE.stats = {
      wrongOrder: 0, regrowCount: 0, spreadCount: 0, slips: 0, bossKilled: 0,
      residueGateFails: 0, miniQuestPass: 0, miniQuestFail: 0,
    };

    COVER.wet.clear(); COVER.rinse.clear(); COVER.dry.clear();

    if(UI.resultRoot) UI.resultRoot.hidden = true;
  }

  function startRun(){
    resetRunState();

    hhaPrepareNewRunSession();   // HHA session
    hhaInitTuningForRun();       // tuning init

    STATE.started = true;
    STATE.phaseStartedAt = now();
    setPhase('prep');

    BathFX.start();              // visual fx start

    LAST_TS = 0;
    cancelAnimationFrame(RAF);
    RAF = requestAnimationFrame(gameLoop);

    updateHud();
    render();

    tel('start_click', { diff:STATE.diff, run:HHA_CTX.run });
  }

  function restartGame(){
    BathSummaryUI.hide?.();
    startRun();
  }

  async function endGame(completed){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.started = false;

    cancelAnimationFrame(RAF);
    BathFX.stop();

    setPhase('summary');

    const bathFinal = hhaCalculateBathFinalScores({ completed: !!completed });
    STATE.finalScore = bathFinal.totalScore;
    STATE.finalGrade = bathFinal.grade;

    hhaFinalizeRunOnce({
      completed: !!completed,
      totalScore: bathFinal.totalScore,
      grade: bathFinal.grade,
      residuePenalty: bathFinal.residuePenalty,
      fungusRisk: bathFinal.fungusRisk
    });

    // try flush
    try{ await hhaFlushNow('endGame'); }catch(e){}

    // show summary
    BathSummaryUI.show(bathFinal);
    tel('summary_show', { score:bathFinal.totalScore, grade:bathFinal.grade, completed:!!completed });
  }

  /* =========================================================
   * O) DEBUG API
   * =======================================================*/
  WIN.HHBathDebug = WIN.HHBathDebug || {};
  WIN.HHBathDebug.state = ()=>STATE;
  WIN.HHBathDebug.tel = ()=>TELEMETRY.slice(-200);
  WIN.HHBathDebug.start = startRun;
  WIN.HHBathDebug.restart = restartGame;
  WIN.HHBathDebug.end = (ok=true)=>endGame(!!ok);
  WIN.HHBathDebug.forceBoss = ()=>{
    if(!STATE.hiddenSpots.length) return null;
    const s = STATE.hiddenSpots.find(x=>x.revealed && !x.cleaned) || STATE.hiddenSpots[0];
    STATE.boss = {
      alive:true, type:'stink_monster', spotId:s.id, spotName:s.label, x:s.x, y:s.y,
      hp:6, hpMax:6, stage:'spawned', spawnTs:now(), timeoutTs:now()+12000
    };
    BathFX.emitPulse?.(s.x, s.y, 'boss');
    return STATE.boss;
  };
  WIN.HHBathDebug.revealAll = ()=>STATE.hiddenSpots.forEach(s=>s.revealed=true);
  WIN.HHBathDebug.cleanAll = ()=>STATE.hiddenSpots.forEach(s=>{ s.revealed=true; s.cleaned=true; });
  WIN.HHBathDebug.calcFinal = (ok=true)=>hhaCalculateBathFinalScores({ completed:!!ok });
  WIN.HHBathDebug.showSummary = ()=>BathSummaryUI.show(hhaCalculateBathFinalScores({ completed:true }));
  WIN.HHBathDebug.setPhase = (p)=>setPhase(p);
  WIN.HHBathDebug.bossHit = (a='scrub')=>hhaBossHit(a);

  /* =========================================================
   * P) BOOT
   * =======================================================*/
  function boot(){
    bindUI();

    // auto-bind defaults if no tool buttons exist
    if(!UI.btnTools.length){
      // no-op, game still works with selectedTool default
    }

    updateHudTip();
    render();

    // optional autostart for testing
    if(qbool('autostart', false)) startRun();

    tel('boot', { diffQ:HHA_CTX.diffQ, run:HHA_CTX.run, view:HHA_CTX.view, debug:STATE.debug });
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})();