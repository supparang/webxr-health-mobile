// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (C: gameplay + research-ready)
// PATCH: faster spawn + longer lifetime + grace period + mobile missLimit+2
// ✅ START-gated (no spawn before start)
// ✅ Practice 15s (play only) + skip in research
// ✅ Goal + Mini Quest chain
// ✅ Miss rule: miss = good expired + junk hit; junk blocked by shield -> no miss (hook ready)
// ✅ Grade: SSS / SS / S / A / B / C
// ✅ End summary + Back hub + last summary localStorage
// ✅ Deterministic in research: seed + adaptive OFF

'use strict';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

function makeSeededRng(seed){
  // xorshift32
  let x = (Number(seed)||0) >>> 0;
  if(!x) x = (Date.now() >>> 0) ^ 0x9e3779b9;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x <<  5; x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function nowMs(){ return performance.now(); }
function byId(id){ return DOC.getElementById(id); }
function emit(name, detail){ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }

// -------------------------
// HUD
// -------------------------
const HUD = {
  score: byId('hud-score'),
  combo: byId('hud-combo'),
  miss:  byId('hud-miss'),
  time:  byId('hud-time'),
  grade: byId('hud-grade'),
  goal:  byId('hud-goal'),
  goalCur: byId('hud-goal-cur'),
  goalTarget: byId('hud-goal-target'),
  mini:  byId('hud-mini'),
};

function hudSetText(el, v){ if(el) el.textContent = String(v); }
function hudUpdate(state){
  hudSetText(HUD.score, state.score);
  hudSetText(HUD.combo, state.combo);
  hudSetText(HUD.miss,  state.miss);
  hudSetText(HUD.time,  state.timeLeftSec > 0 ? Math.ceil(state.timeLeftSec) : 0);
  hudSetText(HUD.grade, state.grade || '—');
  if(state.goal){
    hudSetText(HUD.goal, state.goal.title);
    hudSetText(HUD.goalCur, state.goal.cur);
    hudSetText(HUD.goalTarget, state.goal.target);
  }
  hudSetText(HUD.mini, state.mini ? `${state.mini.title} (${Math.floor(state.mini.cur)}/${state.mini.target})` : '—');
}

// -------------------------
// Game Config
// -------------------------
function diffCfg(diff){
  diff = String(diff||'normal').toLowerCase();
  // spawnPps = targets per second (ชัด ๆ)
  const base = {
    easy:   { timeMul:1.00, goodTarget:10, missLimit:7, spawnPps:1.8, junkRatio:0.34 },
    normal: { timeMul:1.00, goodTarget:14, missLimit:6, spawnPps:2.0, junkRatio:0.40 },
    hard:   { timeMul:1.00, goodTarget:18, missLimit:5, spawnPps:2.2, junkRatio:0.46 },
  };
  return base[diff] || base.normal;
}

function gradeFrom({acc, miss, comboMax}){
  const a = Number(acc)||0;
  const m = Number(miss)||0;
  const c = Number(comboMax)||0;
  if(a >= 92 && m <= 2 && c >= 10) return 'SSS';
  if(a >= 88 && m <= 3) return 'SS';
  if(a >= 82 && m <= 4) return 'S';
  if(a >= 72 && m <= 6) return 'A';
  if(a >= 60 && m <= 8) return 'B';
  return 'C';
}

// -------------------------
// Goal + Mini Quest
// -------------------------
function pickGoal(cfg){
  return {
    type:'collect_good',
    title:'เก็บของดี',
    target: cfg.goodTarget,
    cur: 0,
    done: false,
  };
}

function pickMiniSequence(){
  return [
    { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
    { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false }, // seconds survived
    { type:'fast_hits',   title:'ยิงให้ไว', target:4, cur:0, done:false },   // hits under threshold
  ];
}
function resetMini(m){ m.cur=0; m.done=false; }

function miniOnGoodHit(state, rtMs){
  const m = state.mini;
  if(!m || m.done) return;
  if(m.type === 'streak_good'){
    m.cur++;
    if(m.cur >= m.target){ m.done=true; state.miniCleared++; emit('quest:update', { mini:m }); }
  } else if(m.type === 'fast_hits'){
    const thr = 560; // ผ่อนให้ง่ายขึ้นนิด
    if(rtMs != null && rtMs <= thr){
      m.cur++;
      if(m.cur >= m.target){ m.done=true; state.miniCleared++; emit('quest:update', { mini:m }); }
    }
  }
}

function miniOnJunkHit(state){
  const m = state.mini;
  if(!m || m.done) return;
  if(m.type === 'streak_good'){
    m.cur = 0;
  }
  if(m.type === 'avoid_junk'){
    // fail mini style: reset progress (ไม่จบเกม)
    m.cur = 0;
  }
}

function miniTick(state, dtSec){
  const m = state.mini;
  if(!m || m.done) return;
  if(m.type === 'avoid_junk'){
    m.cur += dtSec;
    if(m.cur >= m.target){
      m.cur = m.target;
      m.done = true;
      state.miniCleared++;
      emit('quest:update', { mini:m });
    }
  }
}

function advanceMini(state){
  if(state.mini && !state.mini.done) return;
  state.miniIndex++;
  if(state.miniIndex >= rememberLen(state.miniSeq)){
    state.mini = null;
    return;
  }
  state.mini = state.miniSeq[state.miniIndex];
  resetMini(state.mini);
  emit('quest:update', { mini:state.mini });
}

function rememberLen(arr){ return Array.isArray(arr) ? arr.length : 0; }

// -------------------------
// Spawning (DOM emoji targets)
// -------------------------
function createTargetEl(kind, emoji){
  const el = DOC.createElement('div');
  el.className = 'gj-target';
  el.dataset.kind = kind;
  el.textContent = emoji;
  el.style.cssText = `
    position:absolute;
    left:0; top:0;
    transform: translate(-50%,-50%);
    font-size: 44px;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,.35));
    will-change: transform, opacity;
    opacity: 0;
    transition: opacity .10s ease;
    pointer-events:auto;
    user-select:none;
  `;
  return el;
}

function randIn(rng, a,b){ return a + (b-a)*rng(); }

function pickEmoji(kind, rng){
  const good = ['🍎','🍊','🍌','🥦','🥕','🍇','🍉','🥝','🍍'];
  const junk = ['🍟','🍔','🍕','🍩','🍪','🍫','🧋','🥤'];
  const arr = (kind==='good') ? good : junk;
  return arr[Math.floor(rng()*arr.length)] || (kind==='good'?'🍎':'🍟');
}

function removeEl(el){
  if(el && el.parentNode) el.parentNode.removeChild(el);
}

// -------------------------
// State
// -------------------------
function makeInitialState(cfg, opts){
  return {
    phase: 'ready', // ready | practice | play | end
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    nSpawnGood: 0,
    nSpawnJunk: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nExpireGood: 0,

    timeTotalSec: opts.timeSec,
    timeLeftSec: opts.timeSec,
    playedSec: 0,

    goal: pickGoal(cfg),
    goalsCleared: 0,
    goalsTotal: 1,

    miniSeq: pickMiniSequence(),
    miniIndex: -1,
    mini: null,
    miniCleared: 0,
    miniTotal: 3,

    // practice
    practiceLeft: 15,

    // PATCH: grace period (seconds) — only in PLAY phase
    graceSec: 5,

    grade: '—',
    rng: opts.rng,
    lastSpawnAtMs: 0,
  };
}

// -------------------------
// Logging hooks
// -------------------------
function logEvent(type, payload){
  emit('hha:log', { type, ...payload });
}

// -------------------------
// Main Boot
// -------------------------
export function boot(opts={}){
  const layer = byId('gj-layer');
  if(!layer){
    console.error('GoodJunkVR: missing #gj-layer');
    return;
  }

  const view = String(opts.view||'mobile');
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run||'play').toLowerCase();
  const isResearch = (run === 'research');

  const seed = opts.seed != null ? Number(opts.seed) : (isResearch ? 12345 : Date.now());
  const rng = makeSeededRng(seed);

  const cfg = diffCfg(diff);
  const timeSec = Math.max(20, Number(opts.time)||80) * (cfg.timeMul||1);

  const state = makeInitialState(cfg, { timeSec, rng });

  // Start mini chain
  advanceMini(state);

  // Practice only in play
  state.phase = isResearch ? 'play' : 'practice';

  // Mobile fairness: missLimit + 2 (patch)
  const missLimitBase = cfg.missLimit ?? 6;
  const missLimit = (view === 'mobile') ? (missLimitBase + 2) : missLimitBase;

  // HUD initial
  hudUpdate(state);

  const meta = {
    projectTag: 'GoodJunkVR',
    runMode: run,
    diff, view, seed,
    durationPlannedSec: timeSec,
    studyId: opts.studyId || null,
    phase: opts.phase || null,
    conditionGroup: opts.conditionGroup || null,
    startTimeIso: new Date().toISOString(),
    gameVersion: 'gj-2026-01-01C-speed'
  };
  emit('hha:start', meta);
  logEvent('start', meta);

  function onTargetClick(e){
    const el = e.target;
    if(!el || !el.dataset) return;

    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const kind = el.dataset.kind;
    const tNow = nowMs();
    const rt = state.lastSpawnAtMs ? Math.max(0, tNow - state.lastSpawnAtMs) : null;

    if(kind === 'good'){
      state.nHitGood++;
      state.score += 10;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      // goal
      if(state.goal && !state.goal.done){
        state.goal.cur = clamp(state.goal.cur + 1, 0, state.goal.target);
        if(state.goal.cur >= state.goal.target){
          state.goal.done = true;
          state.goalsCleared = 1;
          emit('hha:goal-complete', { goal: state.goal });
        }
      }

      miniOnGoodHit(state, rt);
      if(state.mini && state.mini.done) advanceMini(state);

      logEvent('hit_good', { rtMs: rt, score: state.score, combo: state.combo });

    } else if(kind === 'junk'){
      state.nHitJunk++;
      state.score = Math.max(0, state.score - 6);
      state.miss++;
      state.combo = 0;

      miniOnJunkHit(state);

      logEvent('hit_junk', { score: state.score, miss: state.miss });
    }

    removeEl(el);
    hudUpdate(state);

    // lose by miss limit (play only)
    if(state.phase === 'play' && state.miss >= missLimit){
      endGame('missLimit');
    }
  }

  layer.addEventListener('click', onTargetClick, { passive:false });

  // Spawn controls
  const activeTargets = new Set();
  let ended = false;

  function spawnOne(){
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const isJunk = (state.rng() < (cfg.junkRatio ?? 0.40));
    const kind = isJunk ? 'junk' : 'good';

    const emoji = pickEmoji(kind, state.rng);
    const el = createTargetEl(kind, emoji);

    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    const topPad = 130 + (Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px',''))||0);

    const x = randIn(state.rng, 0.18, 0.82) * W;
    const y = randIn(state.rng, 0.25, 0.78) * H;
    el.style.left = `${x}px`;
    el.style.top  = `${Math.max(topPad, y)}px`;

    const s = randIn(state.rng, 0.92, 1.18);
    el.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;

    // PATCH: lifetime longer (especially good)
    const lifeMs = (kind==='good')
      ? randIn(state.rng, 1400, 2200)
      : randIn(state.rng, 1200, 2000);

    const born = nowMs();
    state.lastSpawnAtMs = born;

    el.style.opacity = '1';
    layer.appendChild(el);
    activeTargets.add(el);

    if(kind==='good') state.nSpawnGood++; else state.nSpawnJunk++;

    // expire
    setTimeout(()=>{
      if(!activeTargets.has(el) || ended) return;
      activeTargets.delete(el);

      if(el.dataset.kind === 'good' && (state.phase==='practice' || state.phase==='play')){
        // PATCH: Grace period in PLAY => good expire not count as miss
        if(state.phase === 'play' && state.graceSec > 0){
          // no miss
        } else {
          state.nExpireGood++;
          state.miss++;
          state.combo = 0;
          hudUpdate(state);

          if(state.phase === 'play' && state.miss >= missLimit){
            removeEl(el);
            endGame('missLimit');
            return;
          }
        }
      }
      removeEl(el);
    }, Math.floor(lifeMs));
  }

  // PATCH: Faster spawn model (pps) + cap per frame to avoid burst
  let lastTick = nowMs();
  let spawnAcc = 0;

  function tick(){
    if(ended) return;
    const t = nowMs();
    const dt = Math.min(0.05, (t - lastTick)/1000);
    lastTick = t;

    if(state.phase === 'practice'){
      state.practiceLeft = Math.max(0, state.practiceLeft - dt);
      miniTick(state, dt);
      // show practice countdown in Time
      state.timeLeftSec = state.practiceLeft;
      hudSetText(HUD.time, Math.ceil(state.timeLeftSec));

      // spawn in practice too (รู้สึกว่ามีอะไรให้ทำ)
      spawnAcc += dt * (cfg.spawnPps * 0.95);

      const cap = (view==='mobile') ? 2 : 3;
      let spawned = 0;
      while(spawnAcc >= 1 && spawned < cap){
        spawnAcc -= 1;
        spawnOne();
        spawned++;
      }

      if(state.practiceLeft <= 0){
        state.phase = 'play';
        // reset grace at actual play start
        state.graceSec = 5;
      }
      hudUpdate(state);
    }
    else if(state.phase === 'play'){
      state.playedSec += dt;
      state.timeLeftSec = Math.max(0, state.timeTotalSec - state.playedSec);

      // grace countdown
      state.graceSec = Math.max(0, state.graceSec - dt);

      miniTick(state, dt);
      if(state.mini && state.mini.done) advanceMini(state);

      // end by time
      if(state.timeLeftSec <= 0){
        endGame('time');
        return;
      }

      // spawn faster
      spawnAcc += dt * (cfg.spawnPps || 2.0);

      const cap = (view==='mobile') ? 2 : 3;
      let spawned = 0;
      while(spawnAcc >= 1 && spawned < cap){
        spawnAcc -= 1;
        spawnOne();
        spawned++;
      }

      hudUpdate(state);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  function endGame(reason='time'){
    if(ended) return;
    ended = true;
    state.phase = 'end';

    // clear targets
    activeTargets.forEach(el=>removeEl(el));
    activeTargets.clear();

    const denom = (state.nHitGood + state.nExpireGood);
    const accGood = denom > 0 ? (state.nHitGood / denom) * 100 : 0;

    const grade = gradeFrom({
      acc: accGood,
      miss: state.miss,
      comboMax: state.comboMax
    });
    state.grade = grade;
    hudSetText(HUD.grade, grade);

    const summary = {
      title: (reason==='missLimit') ? 'Game Over' : 'Completed',
      reason,
      projectTag: 'GoodJunkVR',
      runMode: run,
      diff,
      device: view,
      seed,
      durationPlannedSec: state.timeTotalSec,
      durationPlayedSec: state.playedSec,
      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.miss,
      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,
      nTargetGoodSpawned: state.nSpawnGood,
      nTargetJunkSpawned: state.nSpawnJunk,
      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nExpireGood: state.nExpireGood,
      accuracyGoodPct: accGood,
      grade,
      studyId: opts.studyId || null,
      phase: opts.phase || null,
      conditionGroup: opts.conditionGroup || null,
      gameVersion: 'gj-2026-01-01C-speed',
      startTimeIso: meta.startTimeIso,
      endTimeIso: new Date().toISOString(),
      hub: opts.hub || null,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch{}
    emit('hha:end', summary);
    logEvent('end', summary);
  }

  ROOT.addEventListener('hha:force-end', (ev)=>{
    endGame(ev?.detail?.reason || 'force');
  }, { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      if(!ended){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
          projectTag:'GoodJunkVR',
          runMode: run,
          diff,
          device:view,
          seed,
          reason:'pagehide',
          scoreFinal: state.score,
          misses: state.miss,
          durationPlayedSec: state.playedSec,
          gameVersion:'gj-2026-01-01C-speed',
          startTimeIso: meta.startTimeIso,
          endTimeIso: new Date().toISOString(),
        }));
      }
    }catch{}
  }, { passive:true });
}