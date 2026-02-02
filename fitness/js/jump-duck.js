// === js/jump-duck.js — JumpDuck PACK 1–3 (Research-ready + AI + ML/DL hooks) ===
'use strict';

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

const elAiEnable = $('#jd-ai-enable');
const elAiModel  = $('#jd-ai-model');

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
const elHudQuest  = $('#hud-quest');
const elHudAi     = $('#hud-ai');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');
const elBossBanner= $('#jd-boss-banner');

const elHoldRing  = $('#jd-hold-ring');
const elHoldFill  = $('#jd-hold-fill');

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
const resPerfect      = $('#res-perfect');
const resGreat        = $('#res-great');
const resOk           = $('#res-ok');

function qsParam(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; }
}
function boolParam(k, d=false){
  const v = String(qsParam(k,'')||'').toLowerCase();
  if(!v) return d;
  return v==='1'||v==='true'||v==='yes';
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch(_){}
}

let judgeTimer = null;
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 520);
}
function fmtMs(ms){ if (!ms || ms<=0) return '-'; return ms.toFixed(0)+' ms'; }
function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test')     return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  return 'Play';
}

// ----- RNG deterministic for research/test -----
function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

// ----- Config (base) -----
const JD_DIFFS = {
  easy: {
    name:'easy',
    speedUnitsPerSec: 38,
    spawnIntervalMs: 1300,
    hitWindowMs: 240,
    stabilityDamageOnMiss: 9,
    stabilityGainOnHit: 3,
    scorePerHit: 12
  },
  normal: {
    name:'normal',
    speedUnitsPerSec: 48,
    spawnIntervalMs: 1000,
    hitWindowMs: 220,
    stabilityDamageOnMiss: 12,
    stabilityGainOnHit: 3,
    scorePerHit: 14
  },
  hard: {
    name:'hard',
    speedUnitsPerSec: 62,
    spawnIntervalMs: 820,
    hitWindowMs: 200,
    stabilityDamageOnMiss: 15,
    stabilityGainOnHit: 4,
    scorePerHit: 16
  }
};

// hit zone coords in % of track width
const SPAWN_X   = 100;
const CENTER_X  = 24;
const MISS_X    = 4;

// timing grading thresholds (ms)
const GRADE = {
  perfect: 70,
  great: 120,
  ok: 200
};

// obstacle types
// low/high (single), double (sequence), hold (duck hold), fake (brief shadow then reveal)
const OB_KIND = {
  SINGLE: 'single',
  DOUBLE: 'double',
  HOLD:   'hold',
  FAKE:   'fake'
};

// ----- State -----
let running   = false;
let state     = null;
let lastFrame = null;
let rafId     = null;

let lastAction = null; // { type:'jump'|'duck', time:number, isDown:boolean }
let holdDown = false;

let nextObstacleId = 1;

// AI
let aiEnabled = true;
let aiModelMode = 'heuristic';
let predictor = null;
let director  = null;
let coach     = null;

function pushEvent(row){
  if (!state) return;
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

function downloadText(filename, text){
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function buildSummary(){
  if (!state) return null;

  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const misses   = state.miss || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length
    ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length
    : 0;

  return {
    session_id: state.sessionId,
    mode: state.mode,
    diff: state.diffKey,
    duration_planned_s: (state.durationMs||0)/1000,
    duration_actual_s: (state.elapsedMs||0)/1000,
    seed: state.seed,
    ai_enabled: state.aiEnabled ? 1 : 0,
    ai_model: state.aiModel || '',
    obstacles_total: totalObs,
    hits_total: hits,
    miss_total: misses,
    jump_hit: state.jumpHit||0,
    duck_hit: state.duckHit||0,
    jump_miss: state.jumpMiss||0,
    duck_miss: state.duckMiss||0,
    perfect: state.perfect||0,
    great: state.great||0,
    ok: state.ok||0,
    acc_pct: +(acc*100).toFixed(2),
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,
    stability_min_pct: +(state.minStability||0).toFixed(1),
    score_final: Math.round(state.score||0),
    max_combo: state.maxCombo||0,
    participant_id: state.participant?.id || '',
    group:          state.participant?.group || '',
    note:           state.participant?.note || ''
  };
}

// ----- Quest system -----
function makeQuest(rng){
  // 3 quest types (simple & fun):
  // 1) perfect3: get 3 perfect in a row
  // 2) double2: clear 2 double sequences
  // 3) nomiss8: survive 8s without miss
  const r = rng();
  if (r < 0.34) return { key:'perfect3', desc:'Perfect 3 ติด', prog:0, done:false };
  if (r < 0.67) return { key:'double2',  desc:'ผ่าน Double 2 ชุด', prog:0, done:false };
  return { key:'nomiss8', desc:'ไม่พลาด 8 วิ', prog:0, done:false, startAtMs: 0 };
}

function updateQuestHud(){
  if (!elHudQuest || !state || !state.quest) return;
  const q = state.quest;
  if (q.done) elHudQuest.textContent = `✓ ${q.desc}`;
  else elHudQuest.textContent = `${q.desc} (${q.prog||0})`;
}

// ----- Game start/stop -----
async function initAIIfNeeded(mode, adaptiveOn){
  aiEnabled = !!(elAiEnable?.checked);
  aiModelMode = (elAiModel?.value || 'heuristic');

  // query overrides
  aiEnabled = boolParam('ai', aiEnabled);
  aiModelMode = (qsParam('aimodel', aiModelMode) || aiModelMode);

  if (!aiEnabled){
    predictor = null; director=null; coach=null;
    return;
  }

  // predictor
  if (window.JD_AI_PREDICTOR_FACTORY?.create){
    predictor = await window.JD_AI_PREDICTOR_FACTORY.create(aiModelMode);
  }else{
    predictor = null;
  }

  director = window.JD_AI_DIRECTOR_FACTORY?.createDirector
    ? window.JD_AI_DIRECTOR_FACTORY.createDirector()
    : null;

  coach = window.JD_AI_COACH_FACTORY?.createCoach
    ? window.JD_AI_COACH_FACTORY.createCoach()
    : null;

  // In research/test: director disabled even if AI enabled
  if (!adaptiveOn) director = null;
}

function startGameBase(opts){
  const mode      = opts.mode || 'training';
  const diffKey   = opts.diffKey || (elDiff?.value) || 'normal';
  const diffCfg   = JD_DIFFS[diffKey] || JD_DIFFS.normal;

  const durationMs= opts.durationMs ?? (parseInt((elDuration?.value)||'60',10)*1000 || 60000);
  const isTutorial= !!opts.isTutorial;

  // deterministic in research/test/tutorial
  const seedFromQ = qsParam('seed', null);
  const seed = Number(opts.seed ?? seedFromQ ?? Date.now());
  const deterministic = (mode === 'research' || mode === 'test' || isTutorial);

  const rng = deterministic ? makeRNG(seed) : Math.random;

  const participant = collectParticipant(mode);

  const now = performance.now();

  state = {
    sessionId: makeSessionId(),
    mode,
    isTutorial,
    diffKey,
    baseCfg: diffCfg,
    liveCfg: { ...diffCfg }, // mutable by director
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

    perfect: 0,
    great: 0,
    ok: 0,

    // quest
    quest: makeQuest(deterministic ? makeRNG(seed ^ 0xA5A5A5A5) : Math.random),

    // boss
    bossActive: false,
    bossStartedAt: 0,

    // rng
    rng,
    seed,

    // AI flags
    aiEnabled: aiEnabled ? 1 : 0,
    aiModel: aiModelMode,

    participant
  };

  running   = true;
  lastFrame = now;
  nextObstacleId = 1;
  lastAction = null;
  holdDown = false;

  // UI reset
  if (elHudMode) elHudMode.textContent = modeLabel(mode);
  if (elHudDiff) elHudDiff.textContent = diffKey;
  if (elHudDur)  elHudDur.textContent  = (durationMs/1000|0)+'s';
  if (elHudStab) elHudStab.textContent = '100%';
  if (elHudObs)  elHudObs.textContent  = '0 / 0';
  if (elHudScore)elHudScore.textContent= '0';
  if (elHudCombo)elHudCombo.textContent= '0';
  if (elHudTime) elHudTime.textContent = (durationMs/1000).toFixed(1);
  if (elHudAi)   elHudAi.textContent   = aiEnabled ? 'ON' : 'OFF';

  if (elObsHost) elObsHost.innerHTML = '';
  if (elAvatar)  elAvatar.classList.remove('jump','duck');
  if (elPlayArea) elPlayArea.classList.remove('shake');
  if (elBossBanner) elBossBanner.classList.add('jd-hidden');
  if (elHoldRing) elHoldRing.classList.add('jd-hidden');

  updateQuestHud();

  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  if (isTutorial){
    showJudge('Tutorial: Low=JUMP · High=DUCK · ลองให้คุ้นมือ!', 'ok');
  }else{
    showJudge('พร้อมแล้ว! เก็บ Perfect + คอมโบให้ยาว 🔥', 'ok');
  }
}

async function startGame(){
  const mode = (qsParam('mode', elMode?.value) || 'training');
  const diff = (qsParam('diff', elDiff?.value) || 'normal');
  const time = parseInt(qsParam('time', elDuration?.value||'60'),10);
  const durationMs = (isFinite(time)?time:60)*1000;

  const adaptiveOn = (mode === 'training'); // only training adapts
  await initAIIfNeeded(mode, adaptiveOn);

  startGameBase({ mode, diffKey: diff, durationMs, isTutorial:false });
}

async function startTutorial(){
  await initAIIfNeeded('tutorial', false);
  startGameBase({ mode:'training', diffKey:'easy', durationMs:15000, isTutorial:true });
}

function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }
  if (!state) return;

  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว! ไปเล่นรอบจริงกัน 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  fillResultView();
  showView('result');
}

// ----- Obstacles -----
function pickNextObstacleKind(progress){
  // Pack1: spice curve + boss at end
  // more variety later in game
  const rng = state.rng;
  const boss = state.bossActive;

  let pDouble = boss ? 0.28 : (progress>0.55 ? 0.22 : 0.12);
  let pHold   = boss ? 0.10 : (progress>0.35 ? 0.10 : 0.06);
  let pFake   = boss ? 0.14 : (progress>0.50 ? 0.12 : 0.06);

  const r = rng();
  if (r < pDouble) return OB_KIND.DOUBLE;
  if (r < pDouble + pHold) return OB_KIND.HOLD;
  if (r < pDouble + pHold + pFake) return OB_KIND.FAKE;
  return OB_KIND.SINGLE;
}

function spawnObstacle(ts){
  if (!elObsHost || !state) return;

  // spacing rule: avoid wall
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 72) return;

  const progress = clamp(state.elapsedMs / state.durationMs, 0, 1);
  const kind = pickNextObstacleKind(progress);

  const rng = state.rng;

  // base type
  const isHigh = rng() < 0.5;
  const type   = isHigh ? 'high' : 'low';
  const need   = isHigh ? 'duck' : 'jump';

  let seq = null;        // for double
  let holdMs = 0;        // for hold
  let fakeRevealMs = 0;  // for fake

  if (kind === OB_KIND.DOUBLE){
    // ensure two-step alternation often (fun!)
    const secondNeed = (rng() < 0.72) ? (need==='jump'?'duck':'jump') : need;
    seq = [need, secondNeed];
  }
  if (kind === OB_KIND.HOLD){
    // hold duck only (clear & fair)
    // if base need is jump, flip to duck
    if (need === 'jump'){
      // force high/duck
      // (we keep visual consistent by treating as high)
    }
    holdMs = 650 + Math.round(rng()*450); // 650–1100ms
  }
  if (kind === OB_KIND.FAKE){
    fakeRevealMs = 220 + Math.round(rng()*180); // 220–400ms
  }

  // Build DOM element
  const el = document.createElement('div');

  // visual base class by type (low/high)
  const visualType = (kind===OB_KIND.HOLD) ? 'high' : type;
  el.className = 'jd-obstacle ' + (visualType === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  // badges
  if (kind === OB_KIND.DOUBLE) el.classList.add('badge-double');
  if (kind === OB_KIND.HOLD)   el.classList.add('badge-hold');
  if (kind === OB_KIND.FAKE)   el.classList.add('badge-fake');

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const icon = document.createElement('span');
  icon.className = 'jd-obs-icon';

  const tag = document.createElement('span');
  tag.className = 'jd-obs-tag';

  const sub = document.createElement('span');
  sub.className = 'jd-obs-sub';

  // labeling
  if (kind === OB_KIND.DOUBLE){
    icon.textContent = '⇅';
    tag.textContent = 'DOUBLE';
    sub.textContent = `${seq[0].toUpperCase()}→${seq[1].toUpperCase()}`;
  }else if (kind === OB_KIND.HOLD){
    icon.textContent = '⏳';
    tag.textContent = 'HOLD';
    sub.textContent = `DUCK ${Math.round(holdMs/100)/10}s`;
  }else if (kind === OB_KIND.FAKE){
    icon.textContent = '❓';
    tag.textContent = 'FAKE';
    sub.textContent = 'ดูให้ชัวร์!';
  }else{
    icon.textContent = (visualType === 'high') ? '⬇' : '⬆';
    tag.textContent  = (visualType === 'high') ? 'DUCK' : 'JUMP';
    sub.textContent  = '—';
  }

  inner.appendChild(icon);
  inner.appendChild(tag);
  inner.appendChild(sub);
  el.appendChild(inner);
  elObsHost.appendChild(el);

  // obstacle state
  state.obstacles.push({
    id: nextObstacleId++,
    kind,
    type: (kind===OB_KIND.HOLD) ? 'high' : type,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    hit:false,
    miss:false,
    element: el,

    // timing
    centerTime: null,
    warned: false,

    // grading
    grade: '',

    // double
    seq: seq,
    seqIndex: 0,

    // hold
    holdMs,
    holdStartedAt: 0,
    holdOk: false,

    // fake
    fakeRevealMs,
    fakeRevealed: false,
    fakeTruthNeed: need // true required action (jump/duck) for fake
  });

  state.obstaclesSpawned++;
}

function maybeStartBoss(now){
  if(!state || state.bossActive) return;
  const left = state.remainingMs;
  if(left <= 10000 && left > 0){
    state.bossActive = true;
    state.bossStartedAt = now;
    if(elBossBanner) elBossBanner.classList.remove('jd-hidden');
    showJudge('⚡ BOSS STORM! เร็วขึ้น แต่คะแนนคูณ!', 'combo');
    playSfx('jd-sfx-boss');
  }
}

function computeLiveDifficulty(ts, progress){
  const base = state.baseCfg;
  const live = state.liveCfg;

  // Base training acceleration (Pack1)
  if (state.mode === 'training' && !state.isTutorial){
    // mild ramp
    const factor = 1 - 0.26*progress;
    live.spawnIntervalMs = base.spawnIntervalMs * clamp(factor, 0.60, 1.0);

    const speedFactor = 1 + 0.22*progress;
    live.speedUnitsPerSec = base.speedUnitsPerSec * speedFactor;

    // slight tighten
    live.hitWindowMs = clamp(base.hitWindowMs - Math.round(20*progress), 170, 320);
  }else{
    // fixed
    live.spawnIntervalMs = base.spawnIntervalMs;
    live.speedUnitsPerSec = base.speedUnitsPerSec;
    live.hitWindowMs = base.hitWindowMs;
  }

  // Boss storm multiplier (Pack1)
  if (state.bossActive){
    live.spawnIntervalMs = clamp(live.spawnIntervalMs * 0.72, 520, 1400);
    live.speedUnitsPerSec = clamp(live.speedUnitsPerSec * 1.18, 32, 90);
    live.hitWindowMs = clamp(live.hitWindowMs - 10, 150, 300);
  }

  // AI Director adjustment (Pack2) - only training (adaptiveOn)
  if (director && predictor && state.mode === 'training'){
    const recent = predictor.getRecent ? predictor.getRecent() : {};
    const pred = predictor.predict ? predictor.predict({
      ...recent,
      speed: live.speedUnitsPerSec,
      interval: live.spawnIntervalMs,
      boss: state.bossActive,
      stability: state.stability
    }) : null;

    const patch = director.tune(ts, {
      mode: state.mode,
      adaptiveOn: true,
      baseCfg: base,
      liveCfg: live,
      stats: recent,
      predictor: pred || {},
      boss: state.bossActive,
      progress
    });

    if (patch){
      live.spawnIntervalMs = patch.spawnIntervalMs;
      live.speedUnitsPerSec = patch.speedUnitsPerSec;
      live.hitWindowMs = patch.hitWindowMs;
    }

    // Coach tip
    if (coach && pred){
      const tip = coach.maybeTip(ts, { predictor: pred, stats: recent, boss: state.bossActive, diffKey: state.diffKey });
      if (tip){
        showJudge(tip.msg, tip.kind || 'ok');
      }
    }
  }
}

function loop(ts){
  if (!running || !state) return;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  // time
  state.elapsedMs   = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  if (elHudTime) elHudTime.textContent = (state.remainingMs/1000).toFixed(1);

  // boss trigger (last 10s)
  maybeStartBoss(ts);

  if (state.elapsedMs >= state.durationMs){
    endGame('timeout');
    return;
  }

  const progress = clamp(state.elapsedMs / state.durationMs, 0, 1);

  // compute live difficulty
  computeLiveDifficulty(ts, progress);

  // spawn
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);

    let interval = state.liveCfg.spawnIntervalMs;

    // boss burst randomness (still deterministic if rng deterministic)
    if (state.bossActive && state.rng() < 0.18){
      interval *= 0.72;
    }

    state.nextSpawnAt += interval;
  }

  // move & resolve
  updateObstacles(dt, ts);

  // HUD
  if (elHudStab) elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs){
    const tot = state.obstaclesSpawned;
    const ok  = state.hits;
    elHudObs.textContent = `${ok} / ${tot}`;
  }
  if (elHudScore) elHudScore.textContent = String(Math.round(state.score));
  if (elHudCombo) elHudCombo.textContent = String(state.combo);
  updateQuestHud();

  rafId = requestAnimationFrame(loop);
}

function gradeFromDt(dtMs){
  const a = Math.abs(dtMs);
  if (a <= GRADE.perfect) return 'perfect';
  if (a <= GRADE.great)   return 'great';
  if (a <= GRADE.ok)      return 'ok';
  return '';
}

function addGradeCount(g){
  if(!g || !state) return;
  if(g==='perfect') state.perfect++;
  else if(g==='great') state.great++;
  else if(g==='ok') state.ok++;
}

function scoreGainForGrade(base, grade, combo){
  let m = 1.0;
  if (grade === 'perfect') m = 1.35;
  else if (grade === 'great') m = 1.18;
  else if (grade === 'ok') m = 1.00;
  else m = 0.85; // should rarely happen on hit

  const comboM = 1 + Math.min(Math.max(combo-1,0), 7)*0.14;

  // boss score boost
  const bossM = state.bossActive ? 1.20 : 1.0;

  return Math.round(base * m * comboM * bossM);
}

function questOnHit(grade, obs){
  const q = state.quest;
  if(!q || q.done) return;

  if(q.key === 'perfect3'){
    if(grade === 'perfect') q.prog++;
    else q.prog = 0;
    if(q.prog >= 3){
      q.done = true;
      showJudge('✓ Quest Complete! ได้โล่กันพลาด 1 ครั้ง 🛡️', 'combo');
      // reward: one shield (ignore next miss stability dmg)
      state.shield = (state.shield||0) + 1;
    }
  }

  if(q.key === 'double2'){
    if(obs.kind === OB_KIND.DOUBLE && obs.resolved && obs.hit){
      q.prog++;
      if(q.prog >= 2){
        q.done = true;
        showJudge('✓ Quest Complete! ได้โบนัสคะแนน x2 5 วิ 🔥', 'combo');
        state.scoreBoostUntil = performance.now() + 5000;
      }
    }
  }

  if(q.key === 'nomiss8'){
    // nomiss timer tracked in updateObstacles
  }
}

function questOnMiss(){
  const q = state.quest;
  if(!q || q.done) return;
  if(q.key === 'nomiss8'){
    q.prog = 0;
    q.startAtMs = performance.now();
  }
  if(q.key === 'perfect3'){
    q.prog = 0;
  }
}

function updateHoldUI(ob, now){
  if(!elHoldRing || !elHoldFill) return;
  if(ob && ob.kind===OB_KIND.HOLD && ob.holdStartedAt>0 && !ob.resolved){
    const elapsed = now - ob.holdStartedAt;
    const ratio = clamp(elapsed / ob.holdMs, 0, 1);
    const deg = Math.round(ratio * 360);
    elHoldFill.style.background = `conic-gradient(var(--jd-purple) ${deg}deg, rgba(167,139,250,.12) 0deg)`;
    elHoldRing.classList.remove('jd-hidden');
  }else{
    elHoldRing.classList.add('jd-hidden');
  }
}

function updateObstacles(dt, now){
  const cfg = state.liveCfg;

  // move amount in %
  const move = cfg.speedUnitsPerSec * (dt/1000);

  const toRemove = [];

  // nomiss quest tracking
  if(state.quest && state.quest.key==='nomiss8' && !state.quest.done){
    if(!state.quest.startAtMs) state.quest.startAtMs = now;
    const okMs = now - state.quest.startAtMs;
    state.quest.prog = Math.floor(okMs/1000);
    if(okMs >= 8000){
      state.quest.done = true;
      showJudge('✓ Quest Complete! ได้ Stability +12%', 'combo');
      state.stability = Math.min(100, state.stability + 12);
      state.minStability = Math.min(state.minStability, state.stability);
    }
  }

  // optional score boost
  const scoreBoostOn = (state.scoreBoostUntil && now <= state.scoreBoostUntil) ? 2.0 : 1.0;

  for (const obs of state.obstacles){
    obs.x -= move;

    // DOM position
    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    // determine required action:
    let needType = (obs.type === 'high') ? 'duck' : 'jump';

    // fake: reveal after some time near center
    if(obs.kind === OB_KIND.FAKE){
      // until revealed, icon/tag show "??"
      if(!obs.fakeRevealed && obs.centerTime && (now - obs.centerTime) >= obs.fakeRevealMs){
        obs.fakeRevealed = true;
        // choose truth: use obs.fakeTruthNeed (preset)
        needType = obs.fakeTruthNeed;
        // update visual
        if(obs.element){
          const icon = obs.element.querySelector('.jd-obs-icon');
          const tag = obs.element.querySelector('.jd-obs-tag');
          const sub = obs.element.querySelector('.jd-obs-sub');
          if(icon) icon.textContent = (needType==='duck'?'⬇':'⬆');
          if(tag)  tag.textContent  = (needType==='duck'?'DUCK':'JUMP');
          if(sub)  sub.textContent  = 'REVEAL!';
        }
        playSfx('jd-sfx-beep');
      }
      // prior to reveal, require "none" (can't judge)
      if(!obs.fakeRevealed) needType = '';
    }

    // double: required action depends on seqIndex
    if(obs.kind === OB_KIND.DOUBLE){
      needType = obs.seq[obs.seqIndex] || obs.seq[0];
    }

    // hold: always duck and must hold
    if(obs.kind === OB_KIND.HOLD){
      needType = 'duck';
    }

    // mark centerTime when passing center threshold
    if (!obs.centerTime && obs.x <= CENTER_X){
      obs.centerTime = now;
    }

    // beep warning
    if (!obs.warned && obs.x <= CENTER_X + 18){
      obs.warned = true;
      playSfx('jd-sfx-beep');
    }

    // update hold UI if current obstacle is hold and near center
    updateHoldUI(obs.kind===OB_KIND.HOLD ? obs : null, now);

    // HIT WINDOW region
    const inZone = (!obs.resolved && obs.x <= CENTER_X + 6 && obs.x >= CENTER_X - 6);

    if(inZone && !obs.resolved){
      // --- HOLD logic ---
      if(obs.kind === OB_KIND.HOLD){
        // start hold when player presses duck (down)
        if(holdDown && !obs.holdStartedAt){
          obs.holdStartedAt = now;
          showJudge('HOLD... 🛡️', 'ok');
        }
        if(obs.holdStartedAt){
          const held = now - obs.holdStartedAt;
          // if released early -> miss
          if(!holdDown && held < obs.holdMs){
            applyMiss(obs, 'hold-released-early', needType, now);
            continue;
          }
          // if held long enough while still in zone -> success
          if(holdDown && held >= obs.holdMs){
            obs.holdOk = true;
            // treat as hit (perfect-ish)
            applyHit(obs, needType, now, Math.max(0, (obs.centerTime? (now-obs.centerTime):0)));
            continue;
          }
        }
      }

      // --- NORMAL / DOUBLE / FAKE (after reveal) ---
      if(needType){
        const action = lastAction;
        if (action && action.time){
          const dtAction = Math.abs(action.time - now);
          const matchPose= (action.type === needType);

          if (matchPose && dtAction <= cfg.hitWindowMs){
            // on double, require 2 hits
            if(obs.kind === OB_KIND.DOUBLE){
              // register step
              applyHitStepDouble(obs, needType, now, dtAction);
              continue;
            }else{
              applyHit(obs, needType, now, dtAction);
              continue;
            }
          }
        }
      }
    }

    // MISS when passed
    if (!obs.resolved && obs.x <= MISS_X){
      applyMiss(obs, 'late', needType, now);
      continue;
    }

    // remove far left
    if (obs.x < -22){
      if (obs.element){
        obs.element.remove();
        obs.element = null;
      }
      toRemove.push(obs);
    }
  }

  if (toRemove.length){
    state.obstacles = state.obstacles.filter(o => !toRemove.includes(o));
  }

  // clear lastAction after short time
  if (lastAction && now - lastAction.time > 260){
    lastAction = null;
  }

  // if holdDown but no hold obstacle: hide ring
  if(!state.obstacles.some(o=>o.kind===OB_KIND.HOLD && !o.resolved)){
    if(elHoldRing) elHoldRing.classList.add('jd-hidden');
  }

  function applyHitStepDouble(obs, needType, now, dtAction){
    // grade (for each step)
    const grade = gradeFromDt(dtAction) || 'ok';
    addGradeCount(grade);

    // feedback per step
    showJudge(`DOUBLE ${obs.seqIndex+1}/2: ${grade.toUpperCase()}!`, grade==='perfect'?'perfect':grade==='great'?'great':'okay');
    playSfx('jd-sfx-hit');

    // log hit-step
    pushEvent({
      session_id: state.sessionId,
      mode: state.mode,
      diff: state.diffKey,
      seed: state.seed,
      ai_enabled: state.aiEnabled,
      ai_model: state.aiModel,

      event_type: 'hit',
      obstacle_kind: obs.kind,
      obstacle_type: obs.type,
      required_action: needType,
      action: needType,
      rt_ms: Math.round(dtAction),
      timing_grade: grade,
      step: obs.seqIndex+1,
      step_total: 2,
      time_ms: Math.round(state.elapsedMs),
      combo_after: state.combo,
      score_after: Math.round(state.score),
      stability_after_pct: +state.stability.toFixed(1),
      participant_id: state.participant?.id || '',
      group: state.participant?.group || '',
      note: state.participant?.note || ''
    });

    // update state for step
    state.combo = (state.combo || 0) + 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // score for step
    const base = state.baseCfg.scorePerHit;
    let gain = scoreGainForGrade(base, grade, state.combo);
    gain = Math.round(gain * scoreBoostOn);
    state.score += gain;

    // stability a bit
    state.stability = Math.min(100, state.stability + state.baseCfg.stabilityGainOnHit);
    state.minStability = Math.min(state.minStability, state.stability);

    state.hits++;
    if (needType === 'jump') state.jumpHit++; else state.duckHit++;
    state.hitRTs.push(dtAction);

    // step advance
    obs.seqIndex++;
    if(obs.seqIndex >= 2){
      // resolve whole obstacle
      obs.resolved = true;
      obs.hit = true;

      if (obs.element){
        obs.element.classList.add('hit');
        setTimeout(()=> obs.element && obs.element.remove(), 240);
        obs.element = null;
      }

      // quest hook
      questOnHit(grade, obs);

      // combo fireworks
      if (state.combo >= 10){
        showJudge('COMBO x'+state.combo+' 🔥', 'combo');
        playSfx('jd-sfx-combo');
      }
    }
  }

  function applyHit(obs, needType, now, dtAction){
    obs.resolved = true;
    obs.hit = true;

    const grade = gradeFromDt(dtAction) || 'ok';
    obs.grade = grade;
    addGradeCount(grade);

    state.combo = (state.combo || 0) + 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    const base = state.baseCfg.scorePerHit;
    let gain = scoreGainForGrade(base, grade, state.combo);
    gain = Math.round(gain * scoreBoostOn);
    state.score += gain;

    state.hits++;
    if (needType === 'jump') state.jumpHit++; else state.duckHit++;

    state.stability = Math.min(100, state.stability + state.baseCfg.stabilityGainOnHit);
    state.minStability = Math.min(state.minStability, state.stability);

    const rt = dtAction;
    state.hitRTs.push(rt);

    // quest hook
    questOnHit(grade, obs);

    // predictor memory
    if(predictor && predictor.push){
      predictor.push({
        t_ms: Math.round(state.elapsedMs),
        hit: 1,
        rt_ms: Math.round(rt),
        action: needType,
        required: needType,
        obstacle_kind: obs.kind,
        quality: grade,
        missReason: ''
      });
    }

    // log
    pushEvent({
      session_id: state.sessionId,
      mode: state.mode,
      diff: state.diffKey,
      seed: state.seed,
      ai_enabled: state.aiEnabled,
      ai_model: state.aiModel,

      event_type: 'hit',
      obstacle_kind: obs.kind,
      obstacle_type: obs.type,
      required_action: needType,
      action: needType,
      rt_ms: Math.round(rt),
      timing_grade: grade,
      step: '',
      step_total: '',
      time_ms: Math.round(state.elapsedMs),
      combo_after: state.combo,
      score_delta: gain,
      score_after: Math.round(state.score),
      stability_after_pct: +state.stability.toFixed(1),
      boss: state.bossActive ? 1 : 0,
      participant_id: state.participant?.id || '',
      group: state.participant?.group || '',
      note: state.participant?.note || ''
    });

    if (obs.element){
      obs.element.classList.add('hit');
      setTimeout(()=> obs.element && obs.element.remove(), 240);
      obs.element = null;
    }

    // feedback
    if (grade === 'perfect'){
      showJudge('PERFECT ✨', 'perfect');
    }else if (grade === 'great'){
      showJudge('GREAT!', 'great');
    }else{
      showJudge(needType === 'jump' ? 'JUMP OK 🦘' : 'DUCK OK 🛡️', 'okay');
    }

    playSfx('jd-sfx-hit');

    if (state.combo >= 10){
      showJudge('COMBO x'+state.combo+' 🔥', 'combo');
      playSfx('jd-sfx-combo');
    }
  }

  function applyMiss(obs, reason, needType, now){
    obs.resolved = true;
    obs.miss = true;

    // shield reward from quest
    const hasShield = (state.shield||0) > 0;
    if(hasShield){
      state.shield--;
      showJudge('🛡️ SHIELD! กันพลาด 1 ครั้ง', 'ok');
    }else{
      state.miss++;
      state.combo = 0;

      if (needType === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - state.baseCfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      questOnMiss();

      showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      playSfx('jd-sfx-miss');

      if (elPlayArea){
        elPlayArea.classList.add('shake');
        setTimeout(()=> elPlayArea.classList.remove('shake'), 180);
      }
    }

    if (obs.element){
      obs.element.classList.add('miss');
      setTimeout(()=> obs.element && obs.element.remove(), 240);
      obs.element = null;
    }

    // predictor memory
    if(predictor && predictor.push){
      predictor.push({
        t_ms: Math.round(state.elapsedMs),
        hit: hasShield ? 1 : 0,
        rt_ms: 0,
        action: lastAction ? lastAction.type : '',
        required: needType,
        obstacle_kind: obs.kind,
        quality: '',
        missReason: reason || 'miss'
      });
    }

    // log miss
    pushEvent({
      session_id: state.sessionId,
      mode: state.mode,
      diff: state.diffKey,
      seed: state.seed,
      ai_enabled: state.aiEnabled,
      ai_model: state.aiModel,

      event_type: hasShield ? 'shield-block' : 'miss',
      obstacle_kind: obs.kind,
      obstacle_type: obs.type,
      required_action: needType,
      action: lastAction ? lastAction.type : '',
      rt_ms: '',
      timing_grade: '',
      step: '',
      step_total: '',
      miss_reason: reason || '',
      time_ms: Math.round(state.elapsedMs),
      combo_after: state.combo,
      score_after: Math.round(state.score),
      stability_after_pct: +state.stability.toFixed(1),
      boss: state.bossActive ? 1 : 0,
      participant_id: state.participant?.id || '',
      group: state.participant?.group || '',
      note: state.participant?.note || ''
    });
  }
}

// ----- Input -----
function setAvatarPose(type){
  if (!elAvatar) return;
  elAvatar.classList.remove('jump','duck');
  elAvatar.classList.add(type);
  setTimeout(()=> elAvatar && elAvatar.classList.remove(type), 180);
}

function triggerAction(type, isDown=false){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now, isDown: !!isDown };

  if(type === 'duck'){
    holdDown = !!isDown;
  }

  setAvatarPose(type);
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){
    ev.preventDefault();
    triggerAction('jump', true);
  }else if (ev.code === 'ArrowDown'){
    ev.preventDefault();
    triggerAction('duck', true);
  }
}
function handleKeyUp(ev){
  if (!running) return;
  if (ev.code === 'ArrowDown'){
    ev.preventDefault();
    holdDown = false;
  }
}
function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const y = ev.clientY;
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump', true);
  else triggerAction('duck', true);
}
function handlePointerUp(){
  if (!running) return;
  holdDown = false;
}

// ----- Result -----
function fillResultView(){
  const summary = buildSummary();
  if(!summary) return;

  if (resMode)         resMode.textContent         = modeLabel(state?.mode);
  if (resDiff)         resDiff.textContent         = state?.diffKey || 'normal';
  if (resDuration)     resDuration.textContent     = ((state.durationMs||60000)/1000).toFixed(0)+'s';
  if (resTotalObs)     resTotalObs.textContent     = String(summary.obstacles_total);
  if (resHits)         resHits.textContent         = String(summary.hits_total);
  if (resMiss)         resMiss.textContent         = String(summary.miss_total);
  if (resJumpHit)      resJumpHit.textContent      = String(summary.jump_hit);
  if (resDuckHit)      resDuckHit.textContent      = String(summary.duck_hit);
  if (resJumpMiss)     resJumpMiss.textContent     = String(summary.jump_miss);
  if (resDuckMiss)     resDuckMiss.textContent     = String(summary.duck_miss);
  if (resPerfect)      resPerfect.textContent      = String(summary.perfect);
  if (resGreat)        resGreat.textContent        = String(summary.great);
  if (resOk)           resOk.textContent           = String(summary.ok);

  const acc = (summary.acc_pct||0)/100;
  if (resAcc)          resAcc.textContent          = (acc*100).toFixed(1)+' %';
  if (resRTMean)       resRTMean.textContent       = fmtMs(summary.rt_mean_ms||0);
  if (resStabilityMin) resStabilityMin.textContent = (summary.stability_min_pct||0).toFixed(1)+' %';
  if (resScore)        resScore.textContent        = String(summary.score_final||0);

  if (resRank){
    let rank = 'C';
    const stab = summary.stability_min_pct ?? 0;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }
}

// ----- Menu UI -----
function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}

function initJD(){
  $('[data-action="start"]')?.addEventListener('click', ()=> startGame());
  $('[data-action="tutorial"]')?.addEventListener('click', ()=> startTutorial());
  $('[data-action="stop-early"]')?.addEventListener('click', ()=> running && endGame('manual'));
  $('[data-action="play-again"]')?.addEventListener('click', ()=> startGame());
  $$('[data-action="back-menu"]').forEach(btn=> btn.addEventListener('click', ()=> showView('menu')));

  $('[data-action="export-summary"]')?.addEventListener('click', ()=>{
    const s = buildSummary();
    if(!s) return;
    downloadText(`${s.session_id}-summary.json`, JSON.stringify(s,null,2));
  });
  $('[data-action="export-events"]')?.addEventListener('click', ()=>{
    if(!state) return;
    const csv = buildEventsCsv();
    downloadText(`${state.sessionId}-events.csv`, csv || '');
  });

  window.addEventListener('keydown', handleKeyDown, {passive:false});
  window.addEventListener('keyup', handleKeyUp, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});
  window.addEventListener('pointerup', handlePointerUp, {passive:true});

  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  showView('menu');
}

// ----- Export for research -----
window.JD_EXPORT = {
  getSummary(){ return buildSummary(); },
  getEventsCsv(){ return buildEventsCsv(); },
  isRunning(){ return !!running; }
};

window.addEventListener('DOMContentLoaded', initJD);