// === fitness/js/jump-duck.js — Jump Duck Rush (BOSS + AI Predictor v2.1) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

/* ---------- DOM refs ---------- */

const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');
const elAiToggle = $('#jd-ai');

const elResearchBlock = $('#jd-research-block');
const elPid     = $('#jd-participant-id');
const elGroup   = $('#jd-group');
const elNote    = $('#jd-note');

const elHudMode   = $('#hud-mode');
const elHudDiff   = $('#hud-diff');
const elHudDur    = $('#hud-duration');
const elHudStab   = $('#hud-stability');
const elHudObs    = $('#hud-obstacles');
const elHudScore  = $('#hud-score');
const elHudCombo  = $('#hud-combo');
const elHudTime   = $('#hud-time');
const elHudPhase  = $('#hud-phase');

const elBossPhase = $('#boss-phase');
const elBossHpTxt = $('#boss-hp-text');
const elBossHpFill= $('#boss-hp-fill');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

/* Result */
const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resTotalObs     = $('#res-total-obs');
const resHits         = $('#res-hits');
const resMiss         = $('#res-miss');
const resJumpHit      = $('#res-jump-hit');
const resDuckHit      = $('#res-duck-hit');
const resJumpMiss     = $('#res-jump-miss');
const resDuckMiss     = $('#res-duck-miss');
const resAcc          = $('#res-acc');
const resRTMean       = $('#res-rt-mean');
const resStabilityMin = $('#res-stability-min');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

/* ---------- Config ---------- */

const JD_DIFFS = {
  easy:   { name:'easy',   speedUnitsPerSec: 38, spawnIntervalMs: 1300, hitWindowMs: 260, stabilityDamageOnMiss: 10, stabilityGainOnHit: 3, scorePerHit: 12 },
  normal: { name:'normal', speedUnitsPerSec: 48, spawnIntervalMs: 1000, hitWindowMs: 220, stabilityDamageOnMiss: 13, stabilityGainOnHit: 3, scorePerHit: 14 },
  hard:   { name:'hard',   speedUnitsPerSec: 62, spawnIntervalMs:  800, hitWindowMs: 200, stabilityDamageOnMiss: 16, stabilityGainOnHit: 4, scorePerHit: 16 }
};

// hit zone coordinates (% of track width)
const SPAWN_X   = 100;
const CENTER_X  = 24;
const MISS_X    = 4;

/* ---------- Seeded RNG (research-friendly) ---------- */

function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function getSeed(){
  try{
    const q = new URL(location.href).searchParams;
    const s = q.get('seed');
    if(s != null && s !== ''){
      const n = Number(s);
      if(Number.isFinite(n)) return Math.floor(n);
      // hash string seed
      let h = 2166136261;
      for(let i=0;i<String(s).length;i++){
        h ^= String(s).charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
  }catch{}
  return Date.now() >>> 0;
}

/* ---------- AI Predictor (online learning แบบเบา ๆ) ---------- */
/**
 * เป้าหมาย: ทำให้ “ท้าทายพอดีมือ” (flow)
 * - ไม่โกง: ไม่อ่านใจล่วงหน้า แต่ปรับสัดส่วน/แพทเทิร์นตามสถิติเก่า
 * - deterministic เมื่อ seed คงที่ (เพราะสุ่มผ่าน rng)
 */
function createAIPredictor(rng){
  const S = {
    enabled: true,
    // EMA skill per action
    jumpAccEMA: 0.75,
    duckAccEMA: 0.75,
    jumpRtEMA:  220,
    duckRtEMA:  220,

    // online weights (simple logistic) ต่อ action
    wJump: [0,0,0,0], // [bias, combo, stability, phase]
    wDuck: [0,0,0,0],
    lr: 0.06,

    // targets
    targetP: 0.70,     // เราอยากให้ถูก ~70%
    minVarGap: 2,      // อย่าให้ซ้ำ action เดิมเกิน
    lastTypes: [],     // history of required actions
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function sigmoid(z){ return 1/(1+Math.exp(-z)); }

  function features(state){
    // normalize
    const combo = clamp((state.combo||0)/10, 0, 1);
    const stab  = clamp((state.stability||0)/100, 0, 1);
    const ph    = clamp((state.phase||1)/3, 0, 1);
    return [1, combo, stab, ph];
  }

  function predictP(action, state){
    const x = features(state);
    const w = (action==='jump') ? S.wJump : S.wDuck;
    const z = w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3];
    const p = sigmoid(z);
    // blend with EMA acc เพื่อความนิ่ง
    const base = (action==='jump') ? S.jumpAccEMA : S.duckAccEMA;
    return clamp(0.55*p + 0.45*base, 0.05, 0.95);
  }

  function update(action, state, wasHit, rtMs){
    const x = features(state);
    const y = wasHit ? 1 : 0;

    // update logistic weights
    const w = (action==='jump') ? S.wJump : S.wDuck;
    const p = sigmoid(w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3]);
    const err = (y - p);
    for(let i=0;i<w.length;i++){
      w[i] += S.lr * err * x[i];
    }

    // update EMA accuracy
    const a = 0.10;
    if(action==='jump') S.jumpAccEMA = (1-a)*S.jumpAccEMA + a*(y);
    else               S.duckAccEMA = (1-a)*S.duckAccEMA + a*(y);

    // update EMA rt (only on hit with rt)
    if(wasHit && rtMs && rtMs>0){
      const r = 0.08;
      if(action==='jump') S.jumpRtEMA = (1-r)*S.jumpRtEMA + r*rtMs;
      else               S.duckRtEMA = (1-r)*S.duckRtEMA + r*rtMs;
    }

    // history
    S.lastTypes.push(action);
    if(S.lastTypes.length > 10) S.lastTypes.shift();
  }

  function chooseNextRequiredAction(state){
    // ถ้าอยาก flow: เลือก action ที่ p ใกล้ target
    // และบังคับ balance ทั้ง jump/duck
    const pJ = predictP('jump', state);
    const pD = predictP('duck', state);

    // anti-boring: ถ้าซ้ำมาก ให้บังคับสลับ
    const last = S.lastTypes[S.lastTypes.length-1] || '';
    const last2= S.lastTypes[S.lastTypes.length-2] || '';
    const tooSame = (last && last===last2);

    // score closeness to target
    const scoreJ = Math.abs(pJ - S.targetP);
    const scoreD = Math.abs(pD - S.targetP);

    let pick = (scoreJ < scoreD) ? 'jump' : 'duck';

    if(tooSame){
      pick = (last==='jump') ? 'duck' : 'jump';
    }else{
      // small randomness to prevent predictability
      const jitter = rng();
      if(jitter < 0.18) pick = (pick==='jump') ? 'duck' : 'jump';
    }

    // phase 3: เน้น “ทั้งคู่” มากขึ้น → สลับถี่ขึ้น
    if(state.phase === 3){
      if(rng() < 0.55) pick = (last==='jump') ? 'duck' : 'jump';
    }

    return pick;
  }

  function snapshot(){
    return JSON.parse(JSON.stringify({
      enabled: S.enabled,
      jumpAccEMA: +S.jumpAccEMA.toFixed(3),
      duckAccEMA: +S.duckAccEMA.toFixed(3),
      jumpRtEMA:  Math.round(S.jumpRtEMA),
      duckRtEMA:  Math.round(S.duckRtEMA),
      wJump: S.wJump.map(v=>+v.toFixed(3)),
      wDuck: S.wDuck.map(v=>+v.toFixed(3))
    }));
  }

  return {
    setEnabled(v){ S.enabled = !!v; },
    isEnabled(){ return !!S.enabled; },
    chooseNextRequiredAction,
    predictP,
    update,
    snapshot
  };
}

/* ---------- Boss / Phase design ---------- */
/**
 * 3 phases:
 * Phase 1 (warm-up): จังหวะปกติ + pattern ง่าย
 * Phase 2 (mix): เริ่ม feint + burst เล็ก ๆ
 * Phase 3 (boss): storm + feint หนัก + bossHP (ชนะได้ก่อนหมดเวลา)
 */
const PHASE_THRESH = [0.33, 0.70]; // progress <0.33 => 1, <0.70 => 2, else 3

/* ---------- State ---------- */

let running   = false;
let state     = null;
let lastFrame = null;
let rafId     = null;

let judgeTimer = null;
let lastAction = null; // { type:'jump'|'duck', time:number }

let rng = null;
let AI  = null;

/* ---------- Helper ---------- */

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{
    el.currentTime = 0;
    el.play().catch(()=>{});
  }catch{}
}

function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{ elJudge.classList.remove('show'); }, 460);
}

function fmtMs(ms){
  if (!ms || ms<=0) return '-';
  return ms.toFixed(0)+' ms';
}
function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test')     return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

function pushEvent(row){
  if (!state) return;
  if (!state.events) state.events = [];
  state.events.push(row);
}

function buildEventsCsv(){
  if (!state || !state.events || !state.events.length) return '';
  const rows = state.events;
  const cols = Object.keys(rows[0]);
  const esc = (v)=>{
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')){
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows){
    lines.push(cols.map(c=>esc(r[c])).join(','));
  }
  return lines.join('\n');
}

function buildSummary(){
  if (!state) return null;
  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const misses   = state.miss || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  return {
    session_id: state.sessionId,
    seed: state.seed,
    mode: state.mode,
    diff: state.diffKey,
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: (state.elapsedMs||0)/1000,
    obstacles_total: totalObs,
    hits_total: hits,
    miss_total: misses,
    jump_hit: state.jumpHit||0,
    duck_hit: state.duckHit||0,
    jump_miss: state.jumpMiss||0,
    duck_miss: state.duckMiss||0,
    acc_pct: +(acc*100).toFixed(2),
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
    stability_min_pct: +(state.minStability||0).toFixed(1),
    score_final: Math.round(state.score||0),
    boss_hp_end: Math.round(state.bossHp||0),
    boss_defeated: state.bossDefeated ? 1 : 0,
    ai_enabled: state.aiEnabled ? 1 : 0,
    participant_id: state.participant?.id || '',
    group:          state.participant?.group || '',
    note:           state.participant?.note || ''
  };
}

function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

function collectParticipant(metaMode){
  if (metaMode !== 'research') return {id:'', group:'', note:''};
  return {
    id:    (elPid?.value || '').trim(),
    group: (elGroup?.value || '').trim(),
    note:  (elNote?.value || '').trim()
  };
}

function safeRemoveEl(el){
  try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch{}
}

function hardClearPlayfield(){
  if(elObsHost) elObsHost.innerHTML = '';
  if(elPlayArea) elPlayArea.classList.remove('shake', 'jd-boss-warn');
  if(elAvatar) elAvatar.classList.remove('jump','duck');
  if(elJudge){
    elJudge.classList.remove('show','ok','miss','combo');
    elJudge.textContent = 'READY';
  }
  lastAction = null;
}

function setPhaseClass(phase){
  if(!document.body) return;
  document.body.classList.remove('jd-phase-1','jd-phase-2','jd-phase-3');
  document.body.classList.add('jd-phase-'+phase);
}

/* ---------- Controls install (bottom buttons + invisible tap zones) ---------- */

function installPlayControls(){
  if(!elPlayArea) return;
  if(elPlayArea.querySelector('.jd-controls')) return;

  const zones = document.createElement('div');
  zones.className = 'jd-tapzones';
  zones.innerHTML = `
    <div class="jd-tapzone" data-z="jump"></div>
    <div class="jd-tapzone" data-z="duck"></div>
  `;
  zones.addEventListener('pointerdown', (ev)=>{
    if(!running) return;
    const z = ev.target && ev.target.getAttribute('data-z');
    if(z === 'jump') triggerAction('jump');
    else if(z === 'duck') triggerAction('duck');
  }, {passive:false});

  const controls = document.createElement('div');
  controls.className = 'jd-controls';
  controls.innerHTML = `
    <button class="jd-control-btn jump" type="button" data-act="jump" aria-label="Jump">
      <span class="jd-control-icon">⬆</span>
      <span class="jd-control-label">JUMP</span>
    </button>
    <button class="jd-control-btn duck" type="button" data-act="duck" aria-label="Duck">
      <span class="jd-control-icon">⬇</span>
      <span class="jd-control-label">DUCK</span>
    </button>
  `;
  controls.addEventListener('pointerdown', (ev)=>{
    if(!running) return;
    const btn = ev.target.closest('button[data-act]');
    if(!btn) return;
    ev.preventDefault();
    const act = btn.getAttribute('data-act');
    if(act === 'jump') triggerAction('jump');
    if(act === 'duck') triggerAction('duck');
  }, {passive:false});

  elPlayArea.appendChild(zones);
  elPlayArea.appendChild(controls);
}

/* ---------- Game start / stop ---------- */

function startGameBase(opts){
  const mode       = opts.mode || 'training';
  const diffKey    = opts.diffKey || (elDiff?.value) || 'normal';
  const diffCfg    = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? (parseInt((elDuration?.value)||'60',10)*1000 || 60000);
  const isTutorial = !!opts.isTutorial;

  // seed + rng
  const seed = getSeed();
  rng = mulberry32(seed);
  AI  = createAIPredictor(rng);

  // AI enable rules:
  // - Training default = checkbox
  // - Test/Research default = off unless user forces
  let aiEnabled = !!(elAiToggle ? elAiToggle.checked : true);
  if(mode !== 'training') aiEnabled = !!(elAiToggle ? elAiToggle.checked : false);
  AI.setEnabled(aiEnabled);

  const participant = collectParticipant(mode);
  const now = performance.now();

  state = {
    sessionId: makeSessionId(),
    seed,
    mode,
    isTutorial,
    diffKey,
    cfg: diffCfg,
    aiEnabled,

    durationMs,
    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    obstacles: [],
    nextSpawnAt: now + 650,
    obstaclesSpawned: 0,
    hits: 0,
    miss: 0,

    score: 0,
    combo: 0,
    maxCombo: 0,

    hitRTs: [],
    events: [],

    jumpHit: 0,
    duckHit: 0,
    jumpMiss: 0,
    duckMiss: 0,

    // boss
    phase: 1,
    bossHp: 100,
    bossDefeated: false,

    // pattern helpers
    patternCooldown: 0, // ms
    lastRequired: '',

    participant
  };

  running = true;
  lastFrame = now;

  // Reset UI
  if (elHudMode)  elHudMode.textContent = modeLabel(mode);
  if (elHudDiff)  elHudDiff.textContent = diffKey;
  if (elHudDur)   elHudDur.textContent  = (durationMs/1000|0)+'s';
  if (elHudStab)  elHudStab.textContent = '100%';
  if (elHudObs)   elHudObs.textContent  = '0 / 0';
  if (elHudScore) elHudScore.textContent= '0';
  if (elHudCombo) elHudCombo.textContent= '0';
  if (elHudTime)  elHudTime.textContent = (durationMs/1000).toFixed(1);
  if (elHudPhase) elHudPhase.textContent= '1';

  if (elBossPhase) elBossPhase.textContent = '1';
  if (elBossHpTxt) elBossHpTxt.textContent = '100';
  if (elBossHpFill) elBossHpFill.style.transform = 'scaleX(1)';

  hardClearPlayfield();
  setPhaseClass(1);

  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  if (isTutorial){
    showJudge('Tutorial: Low = JUMP 🦘 · High = DUCK 🛡️', 'ok');
  }else{
    showJudge('พร้อมแล้ว! เฟส 1: วอร์มอัพ ✨', 'ok');
  }
}

function startGame(){
  const mode = (elMode?.value) || 'training';
  startGameBase({ mode, isTutorial:false });
}

function startTutorial(){
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  // tutorial ends back to menu
  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! ไปบู๊บอสกัน 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  hardClearPlayfield();

  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  fillResultView(acc, rtMean, totalObs);
  showView('result');
}

/* ---------- Result view ---------- */

function fillResultView(acc, rtMean, totalObs){
  const durSec = (state && state.durationMs ? state.durationMs : 60000)/1000;

  if (resMode)         resMode.textContent         = modeLabel(state?.mode);
  if (resDiff)         resDiff.textContent         = state?.diffKey || 'normal';
  if (resDuration)     resDuration.textContent     = durSec.toFixed(0)+'s';
  if (resTotalObs)     resTotalObs.textContent     = String(totalObs);
  if (resHits)         resHits.textContent         = String(state?.hits||0);
  if (resMiss)         resMiss.textContent         = String(state?.miss||0);
  if (resJumpHit)      resJumpHit.textContent      = String(state?.jumpHit||0);
  if (resDuckHit)      resDuckHit.textContent      = String(state?.duckHit||0);
  if (resJumpMiss)     resJumpMiss.textContent     = String(state?.jumpMiss||0);
  if (resDuckMiss)     resDuckMiss.textContent     = String(state?.duckMiss||0);
  if (resAcc)          resAcc.textContent          = (acc*100).toFixed(1)+' %';
  if (resRTMean)       resRTMean.textContent       = fmtMs(rtMean);
  if (resStabilityMin) resStabilityMin.textContent = (state?.minStability||0).toFixed(1)+' %';
  if (resScore)        resScore.textContent        = String(Math.round(state?.score||0));

  if (resRank){
    let rank = 'C';
    const stab = state?.minStability ?? 0;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }
}

/* ---------- Phase logic ---------- */

function computePhase(progress){
  if(progress < PHASE_THRESH[0]) return 1;
  if(progress < PHASE_THRESH[1]) return 2;
  return 3;
}

function setBossHp(v){
  if(!state) return;
  state.bossHp = Math.max(0, Math.min(100, v));
  if(elBossHpTxt) elBossHpTxt.textContent = String(Math.round(state.bossHp));
  if(elBossHpFill) elBossHpFill.style.transform = `scaleX(${(state.bossHp/100).toFixed(3)})`;
}

/* ---------- Loop ---------- */

function loop(ts){
  if (!running || !state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  // time
  state.elapsedMs   = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  if (elHudTime) elHudTime.textContent = (state.remainingMs/1000).toFixed(1);

  const progress = Math.min(1, state.elapsedMs / state.durationMs);

  // phase update
  const newPhase = computePhase(progress);
  if(newPhase !== state.phase){
    state.phase = newPhase;
    setPhaseClass(newPhase);
    if(elHudPhase) elHudPhase.textContent = String(newPhase);
    if(elBossPhase) elBossPhase.textContent = String(newPhase);

    if(newPhase === 2){
      showJudge('เฟส 2: เริ่มปั่น! มี FEINT แล้วนะ 👀', 'ok');
      if(elPlayArea) elPlayArea.classList.add('jd-boss-warn');
      setTimeout(()=> elPlayArea && elPlayArea.classList.remove('jd-boss-warn'), 420);
    }
    if(newPhase === 3){
      showJudge('🔥 BOSS PHASE! สลับ Jump/Duck ให้ไว!', 'combo');
      if(elPlayArea) elPlayArea.classList.add('jd-boss-warn');
      setTimeout(()=> elPlayArea && elPlayArea.classList.remove('jd-boss-warn'), 520);
    }
  }

  // end by time
  if (state.elapsedMs >= state.durationMs){
    endGame('timeout');
    return;
  }

  // boss win early (phase3 + bossHp 0)
  if(state.phase === 3 && state.bossHp <= 0 && !state.bossDefeated){
    state.bossDefeated = true;
    showJudge('🏆 BOSS DEFEATED!', 'combo');
    // โบนัส
    state.score += 250;
    endGame('boss-defeated');
    return;
  }

  // spawn obstacles
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts, progress);

    let interval = cfg.spawnIntervalMs;

    // Training: ramp faster
    if (state.mode === 'training' && !state.isTutorial){
      const factor = 1 - 0.30*progress;
      interval = cfg.spawnIntervalMs * Math.max(0.58, factor);
    }

    // Phase 2: slightly faster bursts
    if(state.phase === 2) interval *= 0.92;

    // Phase 3 boss storm
    if(state.phase === 3) interval *= 0.78;

    state.nextSpawnAt += interval;
  }

  // movement
  updateObstacles(dt, ts, progress);

  // HUD
  if (elHudStab) elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs){
    const tot = state.obstaclesSpawned;
    const ok  = state.hits;
    elHudObs.textContent = `${ok} / ${tot}`;
  }
  if (elHudScore) elHudScore.textContent = String(Math.round(state.score));
  if (elHudCombo) elHudCombo.textContent = String(state.combo);

  rafId = requestAnimationFrame(loop);
}

/* ---------- Obstacles ---------- */

let nextObstacleId = 1;

function spawnObstacle(ts, progress){
  if (!elObsHost || !state) return;

  // cooldown pattern gate
  if(state.patternCooldown > 0){
    state.patternCooldown -= 1;
  }

  // spacing: phase 3 อนุญาต burst ถี่ขึ้น
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > (state.phase === 3 ? 82 : 70)) return;

  // decide required action
  let required = '';
  if(state.aiEnabled && AI && AI.isEnabled()){
    required = AI.chooseNextRequiredAction({
      combo: state.combo,
      stability: state.stability,
      phase: state.phase
    });
  }else{
    required = (rng() < 0.5) ? 'jump' : 'duck';
    // phase 3 bias to alternate
    if(state.phase === 3 && state.lastRequired){
      if(rng() < 0.62) required = (state.lastRequired==='jump') ? 'duck' : 'jump';
    }
  }
  state.lastRequired = required;

  // translate to obstacle type
  let type = (required === 'duck') ? 'high' : 'low';

  // FEINT: phase2/3 บางครั้งแสดง icon ผิดก่อน แล้ว flip ใกล้ center
  const feintChance = (state.phase === 2) ? 0.16 : (state.phase === 3 ? 0.28 : 0);
  const isFeint = !state.isTutorial && (rng() < feintChance);

  // BOSS pattern burst: phase3 บางครั้งทำ “คู่สลับ” (double)
  const doDouble = (!state.isTutorial && state.phase === 3 && rng() < 0.22);

  createObstacleDom(ts, type, required, isFeint, false);

  if(doDouble){
    // spawn second quickly with opposite required to force both
    setTimeout(()=>{
      if(!running || !state) return;
      const req2 = (required === 'jump') ? 'duck' : 'jump';
      const type2 = (req2 === 'duck') ? 'high' : 'low';
      createObstacleDom(performance.now(), type2, req2, rng()<0.20, true);
    }, 120);
  }

  state.obstaclesSpawned++;
}

function createObstacleDom(ts, type, required, isFeint, isBurst){
  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (type === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = (required === 'duck') ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = (required === 'duck') ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);

  // mark feint in dataset
  el.dataset.required = required;
  el.dataset.feint = isFeint ? '1' : '0';

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    required,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    hit:false,
    miss:false,
    element: el,
    centerTime: null,
    warned: false,
    feint: isFeint,
    flipped: false,
    burst: !!isBurst
  });
}

function maybeFlipFeint(obs){
  if(!obs || !obs.element || !obs.feint || obs.flipped) return;
  // flip ใกล้ center
  if(obs.x <= CENTER_X + 12){
    obs.flipped = true;
    // swap required
    obs.required = (obs.required === 'jump') ? 'duck' : 'jump';
    obs.type = (obs.required === 'duck') ? 'high' : 'low';

    // update DOM classes + icon/tag
    obs.element.classList.toggle('jd-obstacle--high', obs.type === 'high');
    obs.element.classList.toggle('jd-obstacle--low',  obs.type === 'low');

    const icon = obs.element.querySelector('.jd-obs-icon');
    const tag  = obs.element.querySelector('.jd-obs-tag');
    if(icon) icon.textContent = (obs.required === 'duck') ? '⬇' : '⬆';
    if(tag)  tag.textContent  = (obs.required === 'duck') ? 'DUCK' : 'JUMP';

    // subtle warn
    if(elPlayArea){
      elPlayArea.classList.add('jd-boss-warn');
      setTimeout(()=> elPlayArea && elPlayArea.classList.remove('jd-boss-warn'), 220);
    }
  }
}

function updateObstacles(dt, now, progress){
  if (!state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  let speed = cfg.speedUnitsPerSec;

  if (state.mode === 'training' && !state.isTutorial){
    speed *= (1 + 0.25*progress);
  }
  if(state.phase === 2) speed *= 1.05;
  if(state.phase === 3) speed *= 1.12;

  const move = speed * (dt/1000);
  const toRemove = [];

  for (const obs of state.obstacles){
    if (obs.resolved && !obs.element){
      toRemove.push(obs);
      continue;
    }

    obs.x -= move;

    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    // feint flip
    if(!obs.resolved) maybeFlipFeint(obs);

    const needType = obs.required; // 'jump'|'duck'

    if (!obs.centerTime && obs.x <= CENTER_X){
      obs.centerTime = now;
    }

    if (!obs.warned && obs.x <= CENTER_X + (state.phase===3 ? 22 : 18)){
      obs.warned = true;
      playSfx('jd-sfx-beep');
    }

    // HIT window
    if (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6){
      const action = lastAction;
      if (action && action.time){
        const dtAction = Math.abs(action.time - now);
        const matchPose= (action.type === needType);

        if (matchPose && dtAction <= cfg.hitWindowMs){
          obs.resolved = true;
          obs.hit      = true;

          state.combo = (state.combo || 0) + 1;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;

          // score
          const base   = cfg.scorePerHit;
          const stabil = state.stability > 80 ? 1.10 : 1.0;
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;

          // phase multiplier
          const phaseM = (state.phase === 1) ? 1.0 : (state.phase === 2 ? 1.12 : 1.25);
          const gain   = Math.round(base * stabil * comboM * phaseM);

          state.score += gain;

          state.hits++;
          if (needType === 'jump') state.jumpHit++; else state.duckHit++;

          // stability
          state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
          state.minStability = Math.min(state.minStability, state.stability);

          // boss hp (phase3)
          if(state.phase === 3){
            // ต้อง “ทั้งคู่” ถึงจะละลายเลือดบอสไว
            const dmg = (needType === 'jump' ? 7 : 7) + Math.min(6, state.combo)*0.35;
            setBossHp(state.bossHp - dmg);
          }

          // remove DOM fast
          if (obs.element){
            obs.element.classList.add('hit');
            const old = obs.element;
            obs.element = null;
            setTimeout(()=> safeRemoveEl(old), 210);
          }

          const rt = dtAction;
          state.hitRTs.push(rt);

          // AI update
          if(state.aiEnabled && AI && AI.isEnabled()){
            AI.update(needType, {combo: state.combo, stability: state.stability, phase: state.phase}, true, rt);
          }

          pushEvent({
            session_id: state.sessionId,
            seed: state.seed,
            mode: state.mode,
            diff: state.diffKey,
            phase: state.phase,
            ai_enabled: state.aiEnabled ? 1 : 0,
            event_type: 'hit',
            obstacle_type: obs.type,
            required_action: needType,
            action: action.type,
            rt_ms: Math.round(rt),
            time_ms: Math.round(state.elapsedMs),
            combo_after: state.combo,
            score_delta: gain,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            boss_hp_after: +state.bossHp.toFixed(1),
            feint: obs.feint ? 1 : 0,
            participant_id: state.participant?.id || '',
            group:          state.participant?.group || '',
            note:           state.participant?.note || ''
          });

          // Feedback
          if (state.combo >= 10){
            showJudge('COMBO x'+state.combo+' 🔥', 'combo');
            playSfx('jd-sfx-combo');
          }else{
            showJudge((needType==='jump') ? 'JUMP! 🦘' : 'DUCK! 🛡️', 'ok');
            playSfx('jd-sfx-hit');
          }
          continue;
        }
      }
    }

    // MISS
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      obs.miss     = true;
      state.miss++;
      state.combo = 0;

      if (needType === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      // boss punish
      if(state.phase === 3){
        setBossHp(state.bossHp + 3.5); // miss ทำบอสฟื้นเล็กน้อย
      }

      if (obs.element){
        obs.element.classList.add('miss');
        const old = obs.element;
        obs.element = null;
        setTimeout(()=> safeRemoveEl(old), 210);
      }

      // AI update
      if(state.aiEnabled && AI && AI.isEnabled()){
        AI.update(needType, {combo: state.combo, stability: state.stability, phase: state.phase}, false, 0);
      }

      pushEvent({
        session_id: state.sessionId,
        seed: state.seed,
        mode: state.mode,
        diff: state.diffKey,
        phase: state.phase,
        ai_enabled: state.aiEnabled ? 1 : 0,
        event_type: 'miss',
        obstacle_type: obs.type,
        required_action: needType,
        action: lastAction ? lastAction.type : '',
        rt_ms: '',
        time_ms: Math.round(state.elapsedMs),
        combo_after: state.combo,
        score_delta: 0,
        score_after: Math.round(state.score),
        stability_after_pct: +state.stability.toFixed(1),
        boss_hp_after: +state.bossHp.toFixed(1),
        feint: obs.feint ? 1 : 0,
        participant_id: state.participant?.id || '',
        group:          state.participant?.group || '',
        note:           state.participant?.note || ''
      });

      showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      playSfx('jd-sfx-miss');
      if (elPlayArea){
        elPlayArea.classList.add('shake');
        setTimeout(()=> elPlayArea.classList.remove('shake'), 180);
      }
    }

    // remove far left
    if (obs.x < -20){
      if (obs.element){
        safeRemoveEl(obs.element);
        obs.element = null;
      }
      toRemove.push(obs);
    }
  }

  if (toRemove.length){
    state.obstacles = state.obstacles.filter(o => !toRemove.includes(o));
  }

  // clear action after short time
  if (lastAction && now - lastAction.time > 260){
    lastAction = null;
  }
}

/* ---------- Input ---------- */

function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (!elAvatar) return;
  elAvatar.classList.remove('jump','duck');
  elAvatar.classList.add(type);
  setTimeout(()=>{ if(elAvatar) elAvatar.classList.remove(type); }, 180);
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){
    ev.preventDefault();
    triggerAction('jump');
  }else if (ev.code === 'ArrowDown'){
    ev.preventDefault();
    triggerAction('duck');
  }
}

/* ---------- Mode UI ---------- */

function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');

  // suggest AI off in test/research (user still can override)
  if(elAiToggle){
    if(mode !== 'training'){
      // do not force off if user already changed, but default to off once
      if(!elAiToggle.dataset.touched){
        elAiToggle.checked = false;
      }
    }else{
      if(!elAiToggle.dataset.touched){
        elAiToggle.checked = true;
      }
    }
  }
}

function initJD(){
  installPlayControls();

  // mark ai touched
  elAiToggle?.addEventListener('change', ()=>{
    elAiToggle.dataset.touched = '1';
  });

  $('[data-action="start"]')?.addEventListener('click', ()=> startGame());
  $('[data-action="tutorial"]')?.addEventListener('click', ()=> startTutorial());

  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (running) endGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click', ()=> startGame());

  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  window.addEventListener('keydown', handleKeyDown, {passive:false});

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  showView('menu');
}

/* ---------- Export interface ---------- */

window.JD_EXPORT = {
  getSummary(){ return buildSummary(); },
  getEventsCsv(){ return buildEventsCsv(); },
  getModel(){
    try{ return AI ? AI.snapshot() : null; }catch{ return null; }
  }
};

window.addEventListener('DOMContentLoaded', initJD);