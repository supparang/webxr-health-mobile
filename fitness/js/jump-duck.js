// === js/jump-duck.js — Jump Duck Rush (Research-ready v2.1 PATCH) ===
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
  easy: {
    name:'easy',
    speedUnitsPerSec: 38,
    spawnIntervalMs: 1300,
    hitWindowMs: 260,
    stabilityDamageOnMiss: 10,
    stabilityGainOnHit: 3,
    scorePerHit: 12
  },
  normal: {
    name:'normal',
    speedUnitsPerSec: 48,
    spawnIntervalMs: 1000,
    hitWindowMs: 220,
    stabilityDamageOnMiss: 13,
    stabilityGainOnHit: 3,
    scorePerHit: 14
  },
  hard: {
    name:'hard',
    speedUnitsPerSec: 62,
    spawnIntervalMs: 800,
    hitWindowMs: 200,
    stabilityDamageOnMiss: 16,
    stabilityGainOnHit: 4,
    scorePerHit: 16
  }
};

// พิกัด hit zone (หน่วยเป็นเปอร์เซ็นต์ของความกว้างเส้นทาง)
const SPAWN_X   = 100; // เริ่มที่ขวาสุด
const CENTER_X  = 24;  // ใกล้ตัวผู้เล่น
const MISS_X    = 4;   // ผ่านตัวไปถือว่าชน

/* ---------- State ---------- */

let running   = false;
let state     = null;
let lastFrame = null;
let rafId     = null;

let judgeTimer = null;

/* input state */
let lastAction = null; // { type:'jump'|'duck', time:number }

/* ---------- deterministic RNG (for test/research) ---------- */

function readQuery(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}
function makeRNG(seed){
  // LCG deterministic
  let x = (Number(seed) || Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}

/* ---------- Helper: view switching ---------- */

function showView(name){
  [viewMenu,viewPlay,viewResult].forEach(v=> v && v.classList.add('jd-hidden'));
  if (name === 'menu'   && viewMenu)   viewMenu.classList.remove('jd-hidden');
  if (name === 'play'   && viewPlay)   viewPlay.classList.remove('jd-hidden');
  if (name === 'result' && viewResult) viewResult.classList.remove('jd-hidden');
}

/* ---------- SFX ---------- */

function playSfx(id){
  const el = document.getElementById(id);
  if (!el) return;
  try{
    el.currentTime = 0;
    el.play().catch(()=>{});
  }catch{}
}

/* ---------- HUD & Judge ---------- */

function showJudge(text, kind){
  if (!elJudge) return;
  elJudge.textContent = text;
  elJudge.className = 'jd-judge show';
  if (kind) elJudge.classList.add(kind);
  if (judgeTimer) clearTimeout(judgeTimer);
  judgeTimer = setTimeout(()=>{
    elJudge.classList.remove('show');
  }, 460);
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

/* ---------- Event logging helpers ---------- */

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
  const rtMean   = state.hitRTs.length
    ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length
    : 0;

  return {
    session_id: state.sessionId,
    mode: state.mode,
    diff: state.diffKey,
    seed: state.seed,
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

/* ---------- Game init / start / stop ---------- */

function collectParticipant(metaMode){
  if (metaMode !== 'research') return {id:'', group:'', note:''};
  return {
    id:    (elPid?.value || '').trim(),
    group: (elGroup?.value || '').trim(),
    note:  (elNote?.value || '').trim()
  };
}

function resolveSeed(mode){
  // ✅ test/research: deterministic by default
  // - if ?seed= provided use it
  // - else: use stable-ish generated seed stored in state (Date.now) but still recorded
  const q = readQuery('seed', '');
  const n = Number(q);
  if (Number.isFinite(n) && q !== '') return n;

  // training/tutorial: ok to random, but still store
  return Date.now();
}

function startGameBase(opts){
  const mode       = opts.mode || 'training';
  const diffKey    = opts.diffKey || (elDiff?.value) || 'normal';
  const diffCfg    = JD_DIFFS[diffKey] || JD_DIFFS.normal;
  const durationMs = opts.durationMs ?? (parseInt((elDuration?.value)||'60',10)*1000 || 60000);
  const isTutorial = !!opts.isTutorial;

  const seed = opts.seed ?? resolveSeed(mode);
  const rng  = makeRNG(seed);

  const participant = collectParticipant(mode);
  const now = performance.now();

  state = {
    sessionId: makeSessionId(),
    mode,
    isTutorial,
    diffKey,
    cfg: diffCfg,

    seed,
    rng,

    durationMs,
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
    events: [],

    jumpHit: 0,
    duckHit: 0,
    jumpMiss: 0,
    duckMiss: 0,

    participant
  };

  running   = true;
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

  if (elObsHost) elObsHost.innerHTML = '';
  if (elAvatar)  elAvatar.classList.remove('jump','duck');
  if (elPlayArea) elPlayArea.classList.remove('shake');

  showView('play');

  if (rafId!=null) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  if (isTutorial){
    showJudge('Tutorial: Low = JUMP 🦘 · High = DUCK 🛡️', 'ok');
  }else{
    showJudge('พร้อมแล้ว ลองจับจังหวะให้พอดี ✨', 'ok');
  }
}

function startGame(){
  const mode = (elMode?.value) || 'training';
  startGameBase({ mode, isTutorial:false });
}

function startTutorial(){
  startGameBase({
    mode: 'training',
    diffKey: 'easy',
    durationMs: 15000,
    isTutorial: true
  });
}

function endGame(reason){
  running = false;
  if (rafId!=null){ cancelAnimationFrame(rafId); rafId=null; }

  if (!state) return;

  // ถ้าเป็น tutorial → กลับเมนู ไม่ต้องขึ้นหน้าสรุป
  if (state.isTutorial){
    showJudge('จบ Tutorial แล้ว ลองเล่นรอบจริงได้เลย! 🎉', 'ok');
    setTimeout(()=> showView('menu'), 650);
    return;
  }

  // สร้างสรุปสำหรับแสดงผล
  const totalObs = state.obstaclesSpawned || 0;
  const hits     = state.hits || 0;
  const acc      = totalObs ? hits/totalObs : 0;
  const rtMean   = state.hitRTs.length
    ? state.hitRTs.reduce((a,b)=>a+b,0)/state.hitRTs.length
    : 0;

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

  // Rank S / A / B / C / D
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

/* ---------- Loop & obstacle logic ---------- */

function loop(ts){
  if (!running || !state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  const dt = ts - (lastFrame||ts);
  lastFrame = ts;

  // เวลา
  state.elapsedMs   = ts - state.startTime;
  state.remainingMs = Math.max(0, state.durationMs - state.elapsedMs);

  if (elHudTime){
    elHudTime.textContent = (state.remainingMs/1000).toFixed(1);
  }

  if (state.elapsedMs >= state.durationMs){
    endGame('timeout');
    return;
  }

  const progress = Math.min(1, state.elapsedMs / state.durationMs);

  // spawn obstacles — Training mode จะค่อย ๆ เร็วขึ้น
  while (ts >= state.nextSpawnAt){
    spawnObstacle(ts);

    let interval = cfg.spawnIntervalMs;

    // ✅ Training เร่งขึ้นช่วงท้าย
    if (state.mode === 'training' && !state.isTutorial){
      const factor = 1 - 0.30*progress; // 0–30% เร็วขึ้น
      interval = cfg.spawnIntervalMs * Math.max(0.6, factor);
    }

    // ✅ Test/Research: คงที่
    state.nextSpawnAt += interval;
  }

  // move & resolve obstacles
  updateObstacles(dt, ts, progress);

  // update HUD
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

let nextObstacleId = 1;

function spawnObstacle(ts){
  if (!elObsHost || !state) return;

  // ======= กันกำแพง: ถ้าตัวล่าสุดยังอยู่ใกล้ขวา (x>72) ไม่ spawn =======
  const last = state.obstacles[state.obstacles.length - 1];
  if (last && last.x > 72) return;

  // ✅ deterministic ใน test/research (ใช้ rng), training ก็ใช้ rng ที่ seed ไว้ด้วย (เพื่อ replay ได้ถ้าอยาก)
  const r = state.rng ? state.rng() : Math.random();
  const isHigh = r < 0.5;

  const type = isHigh ? 'high' : 'low'; // high=DUCK, low=JUMP

  const el = document.createElement('div');
  el.className = 'jd-obstacle ' + (type === 'high' ? 'jd-obstacle--high' : 'jd-obstacle--low');
  el.dataset.id = String(nextObstacleId);

  const inner = document.createElement('div');
  inner.className = 'jd-obstacle-inner';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'jd-obs-icon';
  iconSpan.textContent = isHigh ? '⬇' : '⬆';

  const tagSpan = document.createElement('span');
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
    hit:false,
    miss:false,
    element: el,
    centerTime: null,
    warned: false
  });

  state.obstaclesSpawned++;
}

function updateObstacles(dt, now, progress){
  if (!state) return;
  const cfg = state.cfg || JD_DIFFS.normal;

  let speed = cfg.speedUnitsPerSec;

  // Training mode: เพิ่มความเร็วเล็กน้อยช่วงท้าย
  if (state.mode === 'training' && !state.isTutorial){
    const speedFactor = 1 + 0.25*progress; // +0–25%
    speed *= speedFactor;
  }

  const move = speed * (dt/1000);
  const toRemove = [];

  for (const obs of state.obstacles){
    if (obs.resolved && !obs.element){
      toRemove.push(obs);
      continue;
    }

    obs.x -= move;

    // update DOM position (left%)
    if (obs.element){
      obs.element.style.left = obs.x + '%';
    }

    const needType = (obs.type === 'high') ? 'duck' : 'jump';

    // mark centerTime
    if (!obs.centerTime && obs.x <= CENTER_X){
      obs.centerTime = now;
    }

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
          // HIT
          obs.resolved = true;
          obs.hit      = true;

          state.combo = (state.combo || 0) + 1;
          if (state.combo > state.maxCombo) state.maxCombo = state.combo;

          const base   = cfg.scorePerHit;
          const stabil = state.stability > 80 ? 1.10 : 1.0;
          const comboM = 1 + Math.min(state.combo-1, 6)*0.15;
          const gain   = Math.round(base * stabil * comboM);
          state.score += gain;

          state.hits++;
          if (needType === 'jump') state.jumpHit++; else state.duckHit++;

          state.stability = Math.min(100, state.stability + cfg.stabilityGainOnHit);
          // minStability ควรเป็นค่าต่ำสุดตลอดเกม (hit ไม่ทำให้ต่ำลงอยู่แล้ว)
          state.minStability = Math.min(state.minStability, state.stability);

          if (obs.element){
            obs.element.classList.add('hit');
            setTimeout(()=> obs.element && obs.element.remove(), 260);
            obs.element = null;
          }

          const rt = dtAction;
          state.hitRTs.push(rt);

          pushEvent({
            session_id: state.sessionId,
            mode: state.mode,
            diff: state.diffKey,
            seed: state.seed,
            event_type: 'hit',
            obstacle_type: obs.type,
            required_action: needType,
            action: action.type,
            rt_ms: Math.round(rt),
            time_ms: Math.round(state.elapsedMs),
            combo_after: state.combo,
            score_after: Math.round(state.score),
            stability_after_pct: +state.stability.toFixed(1),
            participant_id: state.participant?.id || '',
            group:          state.participant?.group || '',
            note:           state.participant?.note || ''
          });

          // ✅ เคลียร์ action ทันที กันกดครั้งเดียวไปโดนสองอัน
          lastAction = null;

          if (state.combo >= 8){
            showJudge('COMBO x'+state.combo+' 🔥', 'combo');
            playSfx('jd-sfx-combo');
          }else if (needType === 'jump'){
            showJudge('JUMP ดีมาก 🦘', 'ok');
            playSfx('jd-sfx-hit');
          }else{
            showJudge('DUCK ทันเวลา 🛡️', 'ok');
            playSfx('jd-sfx-hit');
          }
          continue;
        }
      }
    }

    // MISS – ผ่าน zone แล้ว
    if (!obs.resolved && obs.x <= MISS_X){
      obs.resolved = true;
      obs.miss     = true;
      state.miss++;
      state.combo = 0;

      if (needType === 'jump') state.jumpMiss++; else state.duckMiss++;

      state.stability = Math.max(0, state.stability - cfg.stabilityDamageOnMiss);
      state.minStability = Math.min(state.minStability, state.stability);

      if (obs.element){
        obs.element.classList.add('miss');
        setTimeout(()=> obs.element && obs.element.remove(), 260);
        obs.element = null;
      }

      pushEvent({
        session_id: state.sessionId,
        mode: state.mode,
        diff: state.diffKey,
        seed: state.seed,
        event_type: 'miss',
        obstacle_type: obs.type,
        required_action: needType,
        action: lastAction ? lastAction.type : '',
        rt_ms: '',
        time_ms: Math.round(state.elapsedMs),
        combo_after: state.combo,
        score_after: Math.round(state.score),
        stability_after_pct: +state.stability.toFixed(1),
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

    // remove when far left
    if (obs.x < -20){
      if (obs.element){
        obs.element.remove();
        obs.element = null;
      }
      toRemove.push(obs);
    }
  }

  if (toRemove.length){
    const kill = new Set(toRemove);
    state.obstacles = state.obstacles.filter(o => !kill.has(o));
  }

  // เคลียร์ action ถ้าเก่ามาก
  if (lastAction && now - lastAction.time > 260){
    lastAction = null;
  }
}

/* ---------- Input (Jump / Duck) ---------- */

function triggerAction(type){
  if (!state || !running) return;
  const now = performance.now();
  lastAction = { type, time: now };

  if (!elAvatar) return;
  elAvatar.classList.remove('jump','duck');
  elAvatar.classList.add(type);
  setTimeout(()=>{
    if (!elAvatar) return;
    elAvatar.classList.remove(type);
  }, 180);
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

function handlePointerDown(ev){
  if (!running) return;
  if (!elPlayArea) return;

  const rect = elPlayArea.getBoundingClientRect();
  const y = ev.clientY;
  const mid = rect.top + rect.height/2;

  if (y < mid) triggerAction('jump');
  else         triggerAction('duck');
}

/* ---------- Init & mode UI ---------- */

function updateResearchVisibility(){
  const mode = (elMode?.value) || 'training';
  if (!elResearchBlock) return;
  if (mode === 'research'){
    elResearchBlock.classList.remove('jd-hidden');
  }else{
    elResearchBlock.classList.add('jd-hidden');
  }
}

function initJD(){
  // start
  $('[data-action="start"]')?.addEventListener('click', startGame);

  // tutorial
  $('[data-action="tutorial"]')?.addEventListener('click', startTutorial);

  // stop early
  $('[data-action="stop-early"]')?.addEventListener('click', ()=>{
    if (running) endGame('manual');
  });

  // play again
  $('[data-action="play-again"]')?.addEventListener('click', startGame);

  // back menu
  $$('[data-action="back-menu"]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView('menu'));
  });

  // input listeners
  window.addEventListener('keydown', handleKeyDown, {passive:false});
  elPlayArea?.addEventListener('pointerdown', handlePointerDown, {passive:false});

  // mode change
  elMode?.addEventListener('change', updateResearchVisibility);
  updateResearchVisibility();

  showView('menu');
}

/* ---------- Export interface for research ---------- */

window.JD_EXPORT = {
  getSummary(){ return buildSummary(); },
  getEventsCsv(){ return buildEventsCsv(); }
};

window.addEventListener('DOMContentLoaded', initJD);