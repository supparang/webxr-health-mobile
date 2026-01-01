// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (C: gameplay + research-ready)
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
  hudSetText(HUD.mini, state.mini ? `${state.mini.title} (${state.mini.cur}/${state.mini.target})` : '—');
}

// -------------------------
// Game Config
// -------------------------
function diffCfg(diff){
  diff = String(diff||'normal').toLowerCase();
  const base = {
    easy:   { timeMul:1.00, goodTarget:10, missLimit:7, spawnRate:1.15, junkRatio:0.35 },
    normal: { timeMul:1.00, goodTarget:14, missLimit:6, spawnRate:1.00, junkRatio:0.40 },
    hard:   { timeMul:1.00, goodTarget:18, missLimit:5, spawnRate:0.90, junkRatio:0.45 },
  };
  return base[diff] || base.normal;
}

function gradeFrom({acc, miss, score, comboMax}){
  // Simple but meaningful grading (tune later)
  // acc: 0-100
  // strong emphasis on accuracy & low miss; combo helps
  const a = Number(acc)||0;
  const m = Number(miss)||0;
  const c = Number(comboMax)||0;

  // SSS: very high accuracy + low miss
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
  // Chain minis — short, fun, research-safe
  // Each mini is deterministic sequence-driven (no adaptive required)
  return [
    { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
    { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false }, // cur counts seconds survived
    { type:'fast_hits',   title:'ยิงให้ไว', target:4, cur:0, done:false },   // count hits under threshold
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
    const thr = 520; // ms
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
    // break streak
    m.cur = 0;
  } else if(m.type === 'fast_hits'){
    // no change
  }
  if(m.type === 'avoid_junk'){
    // fail mini instantly
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
  if(state.miniIndex >= state.miniSeq.length){
    // finished chain
    state.mini = null;
    return;
  }
  state.mini = state.miniSeq[state.miniIndex];
  resetMini(state.mini);
  emit('quest:update', { mini:state.mini });
}

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
// Engine State
// -------------------------
function makeInitialState(cfg, opts){
  return {
    phase: 'ready', // ready | practice | play | end
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    // counts
    nSpawnGood: 0,
    nSpawnJunk: 0,
    nHitGood: 0,
    nHitJunk: 0,
    nExpireGood: 0,

    // timing
    timeTotalSec: opts.timeSec,
    timeLeftSec: opts.timeSec,
    playedSec: 0,

    // goal/mini
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

    // runtime
    grade: '—',
    rng: opts.rng,
    lastGoodHitAtMs: null,
    lastSpawnAtMs: 0,
  };
}

// -------------------------
// Logging (lightweight + compatible)
// -------------------------
function logEvent(type, payload){
  // If hha-cloud-logger exists, it may listen to events already.
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

  // deterministic seed for research
  const seed = opts.seed != null ? Number(opts.seed) : (isResearch ? 12345 : Date.now());
  const rng = makeSeededRng(seed);

  const cfg = diffCfg(diff);
  const timeSec = Math.max(20, Number(opts.time)||80) * (cfg.timeMul||1);

  const state = makeInitialState(cfg, { timeSec, rng });

  // mini start
  advanceMini(state);

  // Practice: only in play mode
  if(isResearch){
    state.phase = 'play';
  }else{
    state.phase = 'practice';
  }

  // Apply HUD once
  hudUpdate(state);

  // Let UI know session start (for sheets/logger)
  const meta = {
    projectTag: 'GoodJunkVR',
    runMode: run,
    diff,
    view,
    seed,
    durationPlannedSec: timeSec,
    studyId: opts.studyId || null,
    phase: opts.phase || null,
    conditionGroup: opts.conditionGroup || null,
    startTimeIso: new Date().toISOString(),
    gameVersion: 'gj-2026-01-01C'
  };
  emit('hha:start', meta);
  logEvent('start', meta);

  // Shooting / tapping: click targets + optional crosshair (vr-ui emits hha:shoot)
  function onShoot(ev){
    // if ev.detail has {x,y} we could raycast; here we just "tap to shoot" means click target
    // Keep for compatibility
  }
  ROOT.addEventListener('hha:shoot', onShoot, { passive:true });

  // Handle target clicks
  function onTargetClick(e){
    const el = e.target;
    if(!el || !el.dataset) return;
    const kind = el.dataset.kind;

    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const tNow = nowMs();
    let rt = null;
    if(state.lastSpawnAtMs) rt = Math.max(0, tNow - state.lastSpawnAtMs);

    if(kind === 'good'){
      state.nHitGood++;
      state.score += 10;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      // goal progress
      if(state.goal && !state.goal.done){
        state.goal.cur = clamp(state.goal.cur + 1, 0, state.goal.target);
        if(state.goal.cur >= state.goal.target){
          state.goal.done = true;
          state.goalsCleared = 1;
          emit('hha:goal-complete', { goal: state.goal });
        }
      }

      // mini update
      miniOnGoodHit(state, rt);
      if(state.mini && state.mini.done) advanceMini(state);

      logEvent('hit_good', { rtMs: rt, score: state.score, combo: state.combo });

    } else if(kind === 'junk'){
      state.nHitJunk++;
      state.score = Math.max(0, state.score - 6);

      // MISS rule (junk hit counts as miss) — shield-block handled externally if needed
      state.miss++;
      state.combo = 0;

      miniOnJunkHit(state);

      logEvent('hit_junk', { score: state.score, miss: state.miss });
    }

    // remove target instantly
    removeEl(el);
    hudUpdate(state);

    // Win/Lose checks
    if(state.goal?.done && state.phase === 'play'){
      // allow to continue until time ends (more data), but can end early if you want:
      // endGame('goal');
    }
    // miss limit (play only)
    const missLimit = cfg.missLimit ?? 6;
    if(state.miss >= missLimit && state.phase === 'play'){
      endGame('missLimit');
    }
  }

  layer.addEventListener('click', onTargetClick);
  layer.addEventListener('pointerdown', (e)=>{
    // mobile fast tap
    if(e.target && e.target.classList && e.target.classList.contains('gj-target')){
      // click handler already does it; keep for compatibility
    }
  }, { passive:true });

  // Spawn logic (simple, stable)
  const activeTargets = new Set();

  function spawnOne(){
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    // spawn good/junk by ratio
    const isJunk = (state.rng() < (cfg.junkRatio ?? 0.40));
    const kind = isJunk ? 'junk' : 'good';

    const emoji = pickEmoji(kind, state.rng);
    const el = createTargetEl(kind, emoji);

    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    // safe HUD top area
    const topPad = 140 + (Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px',''))||0);

    // spawn position
    const x = randIn(state.rng, 0.18, 0.82) * W;
    const y = randIn(state.rng, 0.25, 0.78) * H;
    el.style.left = `${x}px`;
    el.style.top  = `${Math.max(topPad, y)}px`;

    // size slightly varied
    const s = randIn(state.rng, 0.92, 1.18);
    el.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;

    // lifetime
    const lifeMs = (kind==='good') ? randIn(state.rng, 900, 1400) : randIn(state.rng, 900, 1500);
    const born = nowMs();
    state.lastSpawnAtMs = born;

    el.style.opacity = '1';

    layer.appendChild(el);
    activeTargets.add(el);

    if(kind==='good') state.nSpawnGood++; else state.nSpawnJunk++;
    logEvent('spawn', { kind });

    // expire
    setTimeout(()=>{
      if(!activeTargets.has(el)) return;
      activeTargets.delete(el);
      // if good expires => miss rule (good expired counts as miss)
      if(el.dataset.kind === 'good' && (state.phase==='practice' || state.phase==='play')){
        state.nExpireGood++;
        state.miss++;
        state.combo = 0;
        logEvent('expire_good', { miss: state.miss });
        // miss limit
        const missLimit = cfg.missLimit ?? 6;
        if(state.miss >= missLimit && state.phase === 'play'){
          removeEl(el);
          hudUpdate(state);
          endGame('missLimit');
          return;
        }
        hudUpdate(state);
      }
      removeEl(el);
    }, Math.floor(lifeMs));
  }

  let lastTick = nowMs();
  let spawnAcc = 0;

  function tick(){
    const t = nowMs();
    const dt = Math.min(0.05, (t - lastTick)/1000);
    lastTick = t;

    if(state.phase === 'practice'){
      state.practiceLeft = Math.max(0, state.practiceLeft - dt);
      miniTick(state, dt);
      if(state.practiceLeft <= 0){
        state.phase = 'play';
      }
      // show time HUD as practice remaining (nice)
      state.timeLeftSec = state.practiceLeft;
      hudSetText(HUD.time, Math.ceil(state.timeLeftSec));
    }
    else if(state.phase === 'play'){
      state.playedSec += dt;
      state.timeLeftSec = Math.max(0, state.timeTotalSec - state.playedSec);

      miniTick(state, dt);
      if(state.mini && state.mini.done) advanceMini(state);

      // end by time
      if(state.timeLeftSec <= 0){
        endGame('time');
        return;
      }

      // spawn pacing: cfg.spawnRate lower = faster (e.g., 1.0)
      // Use accumulator in "spawns per second" style
      const spawnsPerSec = 1.35 / (cfg.spawnRate || 1.0);
      spawnAcc += dt * spawnsPerSec;

      while(spawnAcc >= 1){
        spawnAcc -= 1;
        spawnOne();
      }

      hudUpdate(state);
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // End game
  let ended = false;
  function endGame(reason='time'){
    if(ended) return;
    ended = true;
    state.phase = 'end';

    // clear targets
    activeTargets.forEach(el=>removeEl(el));
    activeTargets.clear();

    const nTotalHits = state.nHitGood + state.nHitJunk;
    const accGood = (state.nHitGood + state.nExpireGood + 0) > 0
      ? (state.nHitGood / (state.nHitGood + state.nExpireGood)) * 100
      : 0;

    const grade = gradeFrom({
      acc: accGood,
      miss: state.miss,
      score: state.score,
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
      gameVersion: 'gj-2026-01-01C',
      startTimeIso: meta.startTimeIso,
      endTimeIso: new Date().toISOString(),
      hub: opts.hub || null,
    };

    // Save last summary (HHA standard memory)
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch{}

    // Emit end summary (UI overlay listens in HTML)
    emit('hha:end', summary);
    logEvent('end', summary);
  }

  // Safety: allow external force-end
  ROOT.addEventListener('hha:force-end', (ev)=>{
    endGame(ev?.detail?.reason || 'force');
  }, { passive:true });

  // (Optional) Back button flush-hardening: store last summary on unload too
  ROOT.addEventListener('pagehide', ()=>{
    try{
      // if ended, already stored; if not ended, store partial
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
          gameVersion:'gj-2026-01-01C',
          startTimeIso: meta.startTimeIso,
          endTimeIso: new Date().toISOString(),
        }));
      }
    }catch{}
  }, { passive:true });
}