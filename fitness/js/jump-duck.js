// === js/jump-duck.js — Jump Duck Rush (HHA Research-ready FULL) ===
'use strict';

const WIN = window;
const DOC = document;

const $  = (s)=>DOC.querySelector(s);
const $$ = (s)=>Array.from(DOC.querySelectorAll(s));

/* ---------- HHA storage keys ---------- */
const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

/* ---------- DOM refs ---------- */

const viewMenu   = $('#view-menu');
const viewPlay   = $('#view-play');
const viewResult = $('#view-result');

const elMode     = $('#jd-mode');
const elDiff     = $('#jd-diff');
const elDuration = $('#jd-duration');

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

const elHudProgFill = $('#hud-prog-fill');
const elHudProgText = $('#hud-prog-text');
const elHudFeverFill= $('#hud-fever-fill');
const elHudFeverSt  = $('#hud-fever-status');

const elPlayArea  = $('#jd-play-area');
const elAvatar    = $('#jd-avatar');
const elObsHost   = $('#jd-obstacles');
const elJudge     = $('#jd-judge');

/* Result */
const resMode         = $('#res-mode');
const resDiff         = $('#res-diff');
const resDuration     = $('#res-duration');
const resSeed         = $('#res-seed');
const resEndReason    = $('#res-end-reason');
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
const resMaxCombo     = $('#res-max-combo');
const resScore        = $('#res-score');
const resRank         = $('#res-rank');

/* ---------- helpers ---------- */

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}
function qnum(k, d=0){
  const v = Number(qs(k,''));
  return Number.isFinite(v) ? v : d;
}
function modeLabel(mode){
  if (mode === 'training') return 'Training';
  if (mode === 'test')     return 'Test';
  if (mode === 'research') return 'Research';
  if (mode === 'tutorial') return 'Tutorial';
  if (mode === 'practice') return 'Practice';
  return 'Play';
}

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

function playSfx(id){
  const el = DOC.getElementById(id);
  if (!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch{}
}

let judgeTimer = null;
function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=> elJudge.classList.remove('show'), 460);
}

function fmtMs(ms){
  if (!ms || ms<=0) return '-';
  return ms.toFixed(0)+' ms';
}

function makeSessionId(){
  const t = new Date();
  const pad = (n)=>String(n).padStart(2,'0');
  return `JD-${t.getFullYear()}${pad(t.getMonth()+1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
}

/* ---------- deterministic RNG ---------- */
function makeRNG(seed){
  let x = (Number(seed) || Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

/* ---------- config ---------- */

const JD_DIFFS = {
  easy:   { speedUnitsPerSec: 38, spawnIntervalMs: 1300, hitWindowMs: 260, stabilityDamageOnMiss: 10, stabilityGainOnHit: 3, scorePerHit: 12, feverGain: 12 },
  normal: { speedUnitsPerSec: 48, spawnIntervalMs: 1000, hitWindowMs: 220, stabilityDamageOnMiss: 13, stabilityGainOnHit: 3, scorePerHit: 14, feverGain: 14 },
  hard:   { speedUnitsPerSec: 62, spawnIntervalMs: 800,  hitWindowMs: 200, stabilityDamageOnMiss: 16, stabilityGainOnHit: 4, scorePerHit: 16, feverGain: 16 }
};

const SPAWN_X  = 100;
const CENTER_X = 24;
const MISS_X   = 4;

/* ---------- FEVER ---------- */
const FEVER = {
  threshold: 100,
  decayPerSec: 10,
  durationSec: 5,
  multiplier: 1.5
};

/* ---------- ctx passthrough ---------- */
function readCtx(){
  return {
    hub: qs('hub',''),
    run: qs('run','play'),
    studyId: qs('studyId',''),
    phase: qs('phase',''),
    conditionGroup: qs('conditionGroup',''),
    logEndpoint: qs('log',''), // URL
    seedQuery: qs('seed','')
  };
}

function applyHubLinks(){
  const ctx = readCtx();
  if (!ctx.hub) return;
  $$('.jd-backhub').forEach(a=>{
    a.setAttribute('href', ctx.hub);
  });
}

/* ---------- state ---------- */

let running = false;
let state = null;
let lastFrame = null;
let rafId = null;

let lastAction = null; // {type,time}

/* ---------- logging ---------- */

function pushEvent(row){
  if (!state) return;
  state.events.push(row);
}

function toCsv(rows){
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v)=>{
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c=>esc(r[c])).join(','));
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
    game: 'jump-duck',
    session_id: state.sessionId,
    created_at_iso: new Date().toISOString(),

    mode: state.mode,
    diff: state.diffKey,
    run: state.ctx.run,
    seed: state.seed,

    study_id: state.ctx.studyId,
    phase: state.ctx.phase,
    condition_group: state.ctx.conditionGroup,

    duration_planned_s: state.durationMs/1000,
    duration_actual_s: state.elapsedMs/1000,

    obstacles_total: totalObs,
    hits_total: hits,
    miss_total: misses,
    jump_hit: state.jumpHit,
    duck_hit: state.duckHit,
    jump_miss: state.jumpMiss,
    duck_miss: state.duckMiss,

    acc_pct: +(acc*100).toFixed(2),
    rt_mean_ms: rtMean ? +rtMean.toFixed(1) : 0,

    stability_min_pct: +state.minStability.toFixed(1),
    score_final: Math.round(state.score),
    max_combo: state.maxCombo,

    fever_triggers: state.feverTriggers,
    participant_id: state.participant.id,
    group: state.participant.group,
    note: state.participant.note
  };
}

function saveSummaryToLocal(summary){
  if (!summary) return;
  try{
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
    const histRaw = localStorage.getItem(LS_HIST);
    const hist = histRaw ? JSON.parse(histRaw) : [];
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    while (arr.length > 50) arr.pop();
    localStorage.setItem(LS_HIST, JSON.stringify(arr));
  }catch{}
}

function downloadText(filename, text){
  try{
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      URL.revokeObjectURL(url);
      a.remove();
    }, 250);
  }catch{}
}

/* ---------- flush-hardened logger (sendBeacon/fetch keepalive) ---------- */

async function postLogsBestEffort(payload){
  const ep = state?.ctx?.logEndpoint || '';
  if (!ep) return;

  const body = JSON.stringify(payload);
  const blob = new Blob([body], {type:'application/json'});

  // 1) sendBeacon (best for pagehide)
  try{
    if (navigator.sendBeacon && navigator.sendBeacon(ep, blob)) return;
  }catch{}

  // 2) fetch keepalive
  try{
    await fetch(ep, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body,
      keepalive:true,
      mode:'cors'
    });
  }catch{}
}

function buildLogPayload(){
  const summary = buildSummary();
  const eventsCsv = toCsv(state?.events||[]);
  return {
    kind: 'HHA_JUMP_DUCK',
    summary,
    events_csv: eventsCsv
  };
}

/* ---------- participant meta ---------- */

function collectParticipant(mode){
  if (mode !== 'research') return {id:'', group:'', note:''};
  return {
    id:    (elPid?.value || '').trim(),
    group: (elGroup?.value || '').trim(),
    note:  (elNote?.value || '').trim()
  };
}

/* ---------- seed rules ---------- */

function resolveSeed(mode){
  // If query has seed, always use it
  const q = qs('seed','');
  const n = Number(q);
  if (q !== '' && Number.isFinite(n)) return n;

  // For test/research prefer stable deterministic seed (still ok if generated once)
  if (mode === 'test' || mode === 'research'){
    const base = Date.now();
    return base;
  }

  return Date.now();
}

/* ---------- game start pipeline (practice -> real) ---------- */

function startFlow(){
  const mode = (elMode?.value) || 'training';

  // Test/Research: practice 15s then auto start real
  if (mode === 'test' || mode === 'research'){
    const seed = resolveSeed(mode);
    startGameBase({ mode:'practice', diffKey:'easy', durationMs:15000, isPractice:true, seed });
    showJudge('PRACTICE 15s: Low=JUMP 🦘 · High=DUCK 🛡️', 'ok');

    // schedule auto real start after practice ends
    state.afterPractice = {
      realMode: mode,
      realDiff: (elDiff?.value) || 'normal',
      realDurationMs: parseInt((elDuration?.value)||'60',10)*1000 || 60000,
      seed
    };
    return;
  }

  // Training: start directly
  startGameBase({ mode, diffKey:(elDiff?.value)||'normal', durationMs: parseInt((elDuration?.value)||'60',10)*1000 || 60000 });
}

function startTutorial(){
  startGameBase({ mode:'tutorial', diffKey:'easy', durationMs:15000, isTutorial:true });
  showJudge('Tutorial: Low = JUMP 🦘 · High = DUCK 🛡️', 'ok');
}

/* ---------- core init/start ---------- */

function startGameBase(opts){
  const ctx = readCtx();

  const mode = opts.mode || 'training';
  const diffKey = opts.diffKey || 'normal';
  const cfg = JD_DIFFS[diffKey] || JD_DIFFS.normal;

  const durationMs = opts.durationMs ?? 60000;
  const isTutorial = !!opts.isTutorial;
  const isPractice = !!opts.isPractice;

  const seed = (opts.seed ?? resolveSeed(mode));
  const rng  = makeRNG(seed);

  const participant = collectParticipant((mode === 'practice') ? (elMode?.value || 'training') : mode);

  const now = performance.now();

  state = {
    sessionId: makeSessionId(),
    ctx,
    mode,
    diffKey,
    cfg,
    durationMs,
    seed,
    rng,

    isTutorial,
    isPractice,
    afterPractice: null,

    startTime: now,
    elapsedMs: 0,
    remainingMs: durationMs,

    stability: 100,
    minStability: 100,

    obstacles: [],
    nextSpawnAt: now + 600,
    obstaclesSpawned: 0,
    hits: 0,
    miss: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hitRTs: [],

    jumpHit:0, duckHit:0, jumpMiss:0, duckMiss:0,

    // fever
    feverGauge: 0,
    feverActive: false,
    feverRemain: 0,
    feverTriggers: 0,

    // logs
    events: [],
    participant
  };

  running = true;
  lastFrame = now;

  // reset UI
  if (elHudMode)  elHudMode.textContent = modeLabel(mode);
  if (elHudDiff)  elHudDiff.textContent = diffKey;
  if (elHudDur)   elHudDur.textContent  = Math.round(durationMs/1000)+'s';
  if (elHudStab)  elHudStab.textContent = '100%';
  if (elHudObs)   elHudObs.textContent  = '0 / 0';
  if (elHudScore) elHudScore.textContent= '0';
  if (elHudCombo) elHudCombo.textContent= '0';
  if (elHudTime)  elHudTime.textContent = (durationMs/1000).toFixed(1);

  if (elHudProgFill) elHudProgFill.style.transform = 'scaleX(0)';
  if (elHudProgText) elHudProgText.textContent = '0%';
  if (elHudFeverFill) elHudFeverFill.style.transform = 'scaleX(0)';
  if (elHudFeverSt){
    elHudFeverSt.textContent = 'Ready';
    elHudFeverSt.classList.remove('on');
  }

  if (elObsHost) elObsHost.innerHTML = '';
  if (elAvatar)  elAvatar.classList.remove('jump','duck');
  if (elPlayArea) elPlayArea.classList.remove('shake');

  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  if (isPractice){
    showJudge('Practice 15s: เก็บจังหวะก่อนนะ ✨', 'ok');
  }else if (!isTutorial){
    showJudge('พร้อมแล้ว ลองจับจังหวะให้พอดี ✨', 'ok');
  }
}

/* ---------- end game ---------- */

async function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  if (!state) return;

  // Tutorial ends -> back menu
  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว ลองเล่นรอบจริงได้เลย! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  // Practice ends -> auto start real (no logs, no summary)
  if (state.isPractice && state.afterPractice){
    const p = state.afterPractice;
    showJudge('เริ่มรอบจริง! 🔥', 'combo');
    setTimeout(()=>{
      startGameBase({ mode:p.realMode, diffKey:p.realDiff, durationMs:p.realDurationMs, seed:p.seed });
    }, 500);
    return;
  }

  // finalize + result
  const summary = buildSummary();
  saveSummaryToLocal(summary);

  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length : 0;

  fillResultView(reason, acc, rtMean, totalObs);
  showView('result');

  // send logs if endpoint exists
  try{
    await postLogsBestEffort(buildLogPayload());
  }catch{}
}

/* ---------- Result view ---------- */

function fillResultView(endReason, acc, rtMean, totalObs){
  const durSec = (state.durationMs||60000)/1000;

  if (resMode)         resMode.textContent         = modeLabel(state.mode);
  if (resDiff)         resDiff.textContent         = state.diffKey;
  if (resDuration)     resDuration.textContent     = durSec.toFixed(0)+'s';
  if (resSeed)         resSeed.textContent         = String(state.seed);
  if (resEndReason)    resEndReason.textContent    = endReason || '-';

  if (resTotalObs)     resTotalObs.textContent     = String(totalObs);
  if (resHits)         resHits.textContent         = String(state.hits);
  if (resMiss)         resMiss.textContent         = String(state.miss);

  if (resJumpHit)      resJumpHit.textContent      = String(state.jumpHit);
  if (resDuckHit)      resDuckHit.textContent      = String(state.duckHit);
  if (resJumpMiss)     resJumpMiss.textContent     = String(state.jumpMiss);
  if (resDuckMiss)     resDuckMiss.textContent     = String(state.duckMiss);

  if (resAcc)          resAcc.textContent          = (acc*100).toFixed(1)+' %';
  if (resRTMean)       resRTMean.textContent       = fmtMs(rtMean);
  if (resStabilityMin) resStabilityMin.textContent = state.minStability.toFixed(1)+' %';
  if (resMaxCombo)     resMaxCombo.textContent     = String(state.maxCombo);
  if (resScore)        resScore.textContent        = String(Math.round(state.score));

  if (resRank){
    let rank = 'C';
    const stab = state.minStability;
    if (acc >= 0.90 && stab >= 85) rank='S';
    else if (acc >= 0.80 && stab >= 75) rank='A';
    else if (acc >= 0.65 && stab >= 60) rank='B';
    else if (acc < 0.40 || stab < 40)   rank='D';
    resRank.textContent = rank;
  }
}

/* ---------- obstacles ---------- */

let nextObstacleId = 1;

function spawnObstacle(ts){
  if (!elObsHost || !state) return;

  // กันกำแพง
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 72) return;

  const r = state.rng ? state.rng() : Math.random();
  const isHigh = r < 0.5;
  const type   = isHigh ? 'high' : 'low'; // high=duck, low=jump

  const el = DOC.createElement('div');
  el.className = 'jd-obstacle ' + (type === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = DOC.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = DOC.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = DOC.createElement('span');
  tagSpan.className = 'jd-obs-tag';
  tagSpan.textContent = isHigh ? 'DUCK' : 'JUMP';

  inner.appendChild(iconSpan);
  inner.appendChild(tagSpan);
  el.appendChild(inner);

  elObsHost.appendChild(el);

  state.obstacles.push({
    id: nextObstacleId++,
    type,
    x: SPAWN_X,
    createdAt: ts,
    resolved:false,
    element: el,
    warned:false
  });

  state.obstaclesSpawned++;
}

function updateFever(dtSec){
  if (!state) return;

  if (state.feverActive){
    state.feverRemain -= dtSec;
    if (state.feverRemain <= 0){
      state.feverActive = false;
      state.feverRemain = 0;
      showJudge('FEVER จบแล้ว สะสมใหม่อีกรอบ!', 'ok');
    }
  }else{
    state.feverGauge = Math.max(0, state.feverGauge - FEVER.decayPerSec * dtSec);
  }

  const ratio = clamp(state.feverGauge / 100, 0, 1);
  if (elHudFeverFill) elHudFeverFill.style.transform = `scaleX(${ratio.toFixed(3)})`;

  if (elHudFeverSt){
    if (state.feverActive){
      elHudFeverSt.textContent = 'FEVER!';
      elHudFeverSt.classList.add('on');
    }else{
      elHudFeverSt.textContent = 'Ready';
      elHudFeverSt.classList.remove('on');
    }
  }
}

function updateObstacles(dtSec, now, progress){
  if (!state) return;
  const cfg = state.cfg;

  let speed = cfg.speedUnitsPerSec;
  if (state.mode === 'training'){
    speed *= (1 + 0.25*progress);
  }
  const move = speed * dtSec;

  const keep = [];

  for (const obs of state.obstacles){
    if (obs.resolved && !obs.element) continue;

    obs.x -= move;

    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    const needType = (obs.type === 'high') ? 'duck' : 'jump';

    // beep ก่อนเข้าเขต
    if (!obs.warned && obs.x <= CENTER_X + 18){
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

          // combo/score
          state.combo++;
          state.maxCombo = Math.max(state.maxCombo, state.combo);

          const base = cfg.scorePerHit;
          const stabil = state.stability > 80 ? 1.10 : 1.0;
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const feverM = state.feverActive ? FEVER.multiplier : 1.0;

          const gain = Math.round(base * stabil * comboM * feverM);
          state.score += gain;

          state.hits++;
          if (needType === 'jump') state.jumpHit++; else state.duckHit++;

          state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);

          // fever gain
          state.feverGauge = Math.min(100, state.feverGauge + cfg.feverGain);
          if (state.feverGauge >= FEVER.threshold && !state.feverActive){
            state.feverActive = true;
            state.feverRemain = FEVER.durationSec;
            state.feverTriggers++;
            playSfx('jd-sfx-fever');
            showJudge('🔥 FEVER! กดให้รัว!', 'combo');
          }

          // RT
          state.hitRTs.push(dtAction);

          // log (skip practice)
          if (!state.isPractice){
            pushEvent({
              session_id: state.sessionId,
              created_at_iso: new Date().toISOString(),

              mode: state.mode,
              diff: state.diffKey,
              run: state.ctx.run,
              seed: state.seed,
              study_id: state.ctx.studyId,
              phase: state.ctx.phase,
              condition_group: state.ctx.conditionGroup,

              event_type: 'hit',
              obstacle_type: obs.type,
              required_action: needType,
              action: action.type,
              rt_ms: Math.round(dtAction),
              time_ms: Math.round(state.elapsedMs),
              combo_after: state.combo,
              score_delta: gain,
              score_after: Math.round(state.score),
              stability_after_pct: +state.stability.toFixed(1),
              fever_gauge: +state.feverGauge.toFixed(1),
              fever_active: state.feverActive ? 1 : 0,

              participant_id: state.participant.id || '',
              group: state.participant.group || '',
              note: state.participant.note || ''
            });
          }

          // feedback
          if (obs.element){
            obs.element.classList.add('hit');
            setTimeout(()=> obs.element && obs.element.remove(), 260);
            obs.element = null;
          }

          if (state.combo >= 8){
            showJudge('COMBO x'+state.combo+' 🔥', 'combo');
            playSfx('jd-sfx-combo');
          }else{
            showJudge(needType === 'jump' ? 'JUMP ดีมาก 🦘' : 'DUCK ทันเวลา 🛡️', 'ok');
            playSfx('jd-sfx-hit');
          }

          // clear action immediately
          lastAction = null;

          keep.push(obs);
          continue;
        }
      }
    }

    // MISS – ผ่าน zone
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      state.miss++;
      state.combo = 0;

      if (needType === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      // fever penalty
      state.feverGauge = Math.max(0, state.feverGauge - 18);

      if (!state.isPractice){
        pushEvent({
          session_id: state.sessionId,
          created_at_iso: new Date().toISOString(),

          mode: state.mode,
          diff: state.diffKey,
          run: state.ctx.run,
          seed: state.seed,
          study_id: state.ctx.studyId,
          phase: state.ctx.phase,
          condition_group: state.ctx.conditionGroup,

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
          fever_gauge: +state.feverGauge.toFixed(1),
          fever_active: state.feverActive ? 1 : 0,

          participant_id: state.participant.id || '',
          group: state.participant.group || '',
          note: state.participant.note || ''
        });
      }

      if (obs.element){
        obs.element.classList.add('miss');
        setTimeout(()=> obs.element && obs.element.remove(), 260);
        obs.element = null;
      }

      showJudge('MISS ลองใหม่อีกที ✨', 'miss');
      playSfx('jd-sfx-miss');
      if (elPlayArea){
        elPlayArea.classList.add('shake');
        setTimeout(()=> elPlayArea.classList.remove('shake'), 180);
      }
    }

    // remove far left
    if (obs.x < -20){
      if (obs.element){ obs.element.remove(); obs.element = null; }
      continue;
    }

    keep.push(obs);
  }

  state.obstacles = keep;
}

/* ---------- loop ---------- */

function loop(ts){
  if (!running || !state) return;
  const cfg = state.cfg;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  state.elapsedMs   = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  const remainingS = state.remainingMs / 1000;

  if (elHudTime) elHudTime.textContent = remainingS.toFixed(1);

  // end
  if (state.elapsedMs >= state.durationMs){
    // practice auto real / tutorial back / real to result
    endGame('timeout');
    return;
  }

  const progress = clamp(state.elapsedMs / state.durationMs, 0, 1);
  const dtSec = dt / 1000;

  // progress HUD
  if (elHudProgFill) elHudProgFill.style.transform = `scaleX(${progress.toFixed(3)})`;
  if (elHudProgText) elHudProgText.textContent = Math.round(progress*100)+'%';

  // spawn
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);

    let interval = cfg.spawnIntervalMs;

    // training: faster later
    if (state.mode === 'training'){
      const factor = 1 - 0.30*progress;
      interval = cfg.spawnIntervalMs * Math.max(0.6, factor);
    }

    state.nextSpawnAt += interval;
  }

  // move & resolve
  updateObstacles(dtSec, ts, progress);

  // fever
  updateFever(dtSec);

  // HUD
  if (elHudStab) elHudStab.textContent = state.stability.toFixed(1)+'%';
  if (elHudObs)  elHudObs.textContent  = `${state.hits} / ${state.obstaclesSpawned}`;
  if (elHudScore)elHudScore.textContent= String(Math.round(state.score));
  if (elHudCombo)elHudCombo.textContent= String(state.combo);

  rafId = requestAnimationFrame(loop);
}

/* ---------- input ---------- */

function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (elAvatar){
    elAvatar.classList.remove('jump','duck');
    elAvatar.classList.add(type);
    setTimeout(()=> elAvatar && elAvatar.classList.remove(type), 180);
  }
}

function handleKeyDown(ev){
  if (!running) return;
  if (ev.code === 'ArrowUp'){ ev.preventDefault(); triggerAction('jump'); }
  else if (ev.code === 'ArrowDown'){ ev.preventDefault(); triggerAction('duck'); }
}

function handlePointerDown(ev){
  if (!running || !elPlayArea) return;
  const rect = elPlayArea.getBoundingClientRect();
  const y = ev.clientY;
  const mid = rect.top + rect.height/2;
  if (y < mid) triggerAction('jump');
  else triggerAction('duck');
}

/* ---------- mode UI ---------- */

function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research') elResearchBlock.classList.remove('jd-hidden');
  else elResearchBlock.classList.add('jd-hidden');
}

/* ---------- actions ---------- */

function bindActions(){
  $('[data-action="start"]')?.addEventListener('click', startFlow);
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);

  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (running) endGame('manual');
  });

  $('[data-action="play-again"]')?.addEventListener('click', startFlow);
  $('[data-action="back-menu"]')?.addEventListener('click', ()=> showView('menu'));

  $('[data-action="dl-summary"]')?.addEventListener('click', ()=>{
    const s = buildSummary();
    if (!s) return;
    const csv = toCsv([s]);
    downloadText(`jump-duck-summary_${s.session_id}.csv`, csv);
  });

  $('[data-action="dl-events"]')?.addEventListener('click', ()=>{
    if (!state) return;
    const csv = toCsv(state.events);
    const sid = state.sessionId || 'JD';
    downloadText(`jump-duck-events_${sid}.csv`, csv);
  });

  WIN.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  elMode?.addEventListener('change', updateResearchVisibility);
}

/* ---------- export (research hooks) ---------- */

WIN.JD_EXPORT = {
  getSummary(){ return buildSummary(); },
  getEventsCsv(){ return toCsv(state?.events||[]); }
};

/* ---------- flush on pagehide ---------- */
WIN.addEventListener('pagehide', ()=>{
  try{
    if (!state) return;
    // Only flush if real session ended? If game still running, flush partial snapshot
    const payload = buildLogPayload();
    postLogsBestEffort(payload);
  }catch{}
});

/* ---------- init ---------- */

function initJD(){
  applyHubLinks();           // hub passthrough
  updateResearchVisibility();
  bindActions();
  showView('menu');
}

WIN.addEventListener('DOMContentLoaded', initJD);