// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (C: gameplay + research-ready) + Pack25–27
// ✅ MISS = good expired + junk hit (shield blocks junk miss => NO miss)
// ✅ Play: practice 15s (no penalty) then real play timer resets
// ✅ Research: deterministic seed (pid|protocol|diff|mode) if HHA_SESSION exists, NO practice
// ✅ RT: avg / median / fast% + breakdown JSON
// ✅ FX: Particles burst/scorePop/toast (if available) + spawn/gone CSS hooks
// ✅ Patch ticker: every ~6s emits session_patch (if HHA_PATCH_TICKER exists; fallback emits hha:patch)
// ✅ End summary: sessionId + hub + last summary storage
// ✅ AI hooks: OFF by default, research OFF unless aiForce=1

'use strict';

const ROOT = window;
const DOC  = document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, celebrate(){}, toast(){} };

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

function makeSeededRng(seed){
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

function medianOf(arr){
  if(!arr || !arr.length) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const n = a.length, m = (n/2)|0;
  return (n%2) ? a[m] : (a[m-1] + a[m]) / 2;
}

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
// Pack27: Patch ticker fallback
// -------------------------
function fallbackPatchEmit(meta, patch){
  // if logger listens to hha:patch, it can send to sheet
  emit('hha:patch', { ...meta, ...patch, type:'session_patch' });
}

// -------------------------
// UX: Danger warning overlay (เดิมของคุณ)
// -------------------------
function ensureDangerLayer(){
  let el = DOC.querySelector('.gj-danger');
  if(el) return el;
  el = DOC.createElement('div');
  el.className = 'gj-danger';
  el.style.cssText = `
    position:fixed; inset:0; z-index:40; pointer-events:none;
    opacity:0; transition: opacity .12s ease;
    box-shadow: inset 0 0 0 0 rgba(255,80,80,.0);
    border-radius: 28px;
  `;
  DOC.body.appendChild(el);

  if(!DOC.getElementById('gj-danger-style')){
    const st = DOC.createElement('style');
    st.id = 'gj-danger-style';
    st.textContent = `
      @keyframes gjPulse {
        0% { box-shadow: inset 0 0 0 0 rgba(255,80,80,.00); }
        50%{ box-shadow: inset 0 0 0 14px rgba(255,80,80,.22); }
        100%{ box-shadow: inset 0 0 0 0 rgba(255,80,80,.00); }
      }
      @keyframes gjShake {
        0%{ transform: translate(0,0); }
        25%{ transform: translate(0.6px,-0.8px); }
        50%{ transform: translate(-0.7px,0.6px); }
        75%{ transform: translate(0.5px,0.4px); }
        100%{ transform: translate(0,0); }
      }
      body.gj-shake { animation: gjShake .18s linear infinite; }
    `;
    DOC.head.appendChild(st);
  }
  return el;
}
function setDanger(level01){
  const layer = ensureDangerLayer();
  const lv = clamp(level01, 0, 1);
  if(lv <= 0){
    layer.style.opacity = '0';
    layer.style.animation = 'none';
    DOC.body.classList.remove('gj-shake');
    return;
  }
  layer.style.opacity = String(0.10 + 0.22*lv);
  layer.style.animation = `gjPulse ${lv>0.75?0.55:0.75}s ease-in-out infinite`;
  if(lv > 0.82) DOC.body.classList.add('gj-shake');
  else DOC.body.classList.remove('gj-shake');
  emit('hha:danger', { level: lv });
}

// -------------------------
// Practice hint (pack 14) — เดิม
// -------------------------
function ensurePracticeHint(){
  let el = DOC.querySelector('.gj-practice');
  if(el) return el;
  el = DOC.createElement('div');
  el.className = 'gj-practice';
  el.style.cssText = `
    position:fixed; left:12px; right:12px;
    top: calc(12px + var(--sat, 0px));
    z-index:70;
    background: rgba(2,6,23,.72);
    border: 1px solid rgba(148,163,184,.18);
    border-radius: 16px;
    padding: 10px 12px;
    color:#e5e7eb;
    display:none;
    backdrop-filter: blur(6px);
  `;
  el.innerHTML = `
    <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
      <div style="font: 900 13px/1.35 system-ui;">
        🧪 PRACTICE 15s: ฝึกยิง “ของดี” 🥦🍎 เลี่ยง “ขยะ” 🍟🍔 (ช่วงนี้ไม่โดนลงโทษ)
      </div>
      <button class="gj-skip" style="
        border:0; border-radius:12px;
        padding:8px 10px; font:900 12px/1 system-ui;
        background: rgba(148,163,184,.18); color:#e5e7eb;
      ">ข้าม</button>
    </div>
  `;
  DOC.body.appendChild(el);
  return el;
}
function showPracticeHint(show){
  const el = ensurePracticeHint();
  el.style.display = show ? 'block' : 'none';
}

// -------------------------
// Config
// -------------------------
function diffCfg(diff){
  diff = String(diff||'normal').toLowerCase();
  const base = {
    easy:   { timeMul:1.00, goodTarget:10, missLimit:7, spawnPps:1.8, junkRatio:0.34, starP:0.06, shieldP:0.05 },
    normal: { timeMul:1.00, goodTarget:14, missLimit:6, spawnPps:2.0, junkRatio:0.40, starP:0.06, shieldP:0.05 },
    hard:   { timeMul:1.00, goodTarget:18, missLimit:5, spawnPps:2.2, junkRatio:0.46, starP:0.05, shieldP:0.045 },
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
// Goal + Mini
// -------------------------
function pickGoal(cfg){
  return { type:'collect_good', title:'เก็บของดี', target: cfg.goodTarget, cur:0, done:false };
}
function pickMiniSequence(){
  return [
    { type:'streak_good', title:'เก็บดีติดกัน', target:3, cur:0, done:false },
    { type:'avoid_junk',  title:'อย่าโดนขยะ', target:6, cur:0, done:false },
    { type:'fast_hits',   title:'ยิงให้ไว', target:4, cur:0, done:false },
  ];
}
function resetMini(m){ m.cur=0; m.done=false; }

function miniOnGoodHit(state, rtMs){
  const m = state.mini; if(!m || m.done) return;
  if(m.type==='streak_good'){
    m.cur++;
    if(m.cur>=m.target){ m.done=true; state.miniCleared++; emit('quest:update',{mini:m}); }
  }else if(m.type==='fast_hits'){
    const thr = 560;
    if(rtMs!=null && rtMs<=thr){
      m.cur++;
      if(m.cur>=m.target){ m.done=true; state.miniCleared++; emit('quest:update',{mini:m}); }
    }
  }
}
function miniOnJunkHit(state){
  const m = state.mini; if(!m || m.done) return;
  if(m.type==='streak_good') m.cur = 0;
  if(m.type==='avoid_junk')  m.cur = 0;
}
function miniTick(state, dtSec){
  const m = state.mini; if(!m || m.done) return;
  if(m.type==='avoid_junk'){
    m.cur += dtSec;
    if(m.cur>=m.target){
      m.cur = m.target;
      m.done = true;
      state.miniCleared++;
      emit('quest:update',{mini:m});
    }
  }
}
function advanceMini(state, cause='init'){
  if(state.mini && !state.mini.done) return;
  state.miniIndex++;
  if(state.miniIndex >= state.miniSeq.length){
    state.mini = null;
    return;
  }
  state.mini = state.miniSeq[state.miniIndex];
  resetMini(state.mini);
  emit('quest:update',{mini:state.mini});

  if(cause !== 'init'){
    state.burstQueue = Math.max(state.burstQueue, 3);
    state.burstCooldown = 0.0;
  }
}

// -------------------------
// Targets
// -------------------------
function createTargetEl(kind, emoji){
  const el = DOC.createElement('div');
  el.className = 'gj-target';
  el.dataset.kind = kind;
  el.textContent = emoji;
  el.style.left = '0px';
  el.style.top  = '0px';
  return el;
}
function randIn(rng,a,b){ return a + (b-a)*rng(); }
function pickEmoji(kind, rng){
  if(kind==='star') return '⭐';
  if(kind==='shield') return '🛡️';
  const good = ['🍎','🍊','🍌','🥦','🥕','🍇','🍉','🥝','🍍'];
  const junk = ['🍟','🍔','🍕','🍩','🍪','🍫','🧋','🥤'];
  const arr = (kind==='good') ? good : junk;
  return arr[Math.floor(rng()*arr.length)] || (kind==='good'?'🍎':'🍟');
}
function removeEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 160);
  }catch(_){
    try{ el.remove(); }catch(__){}
  }
}

// -------------------------
// RT buckets (pack 12)
/// ------------------------
function pushRtBucket(bucket, rt, cap, rng){
  if(!bucket || rt==null) return;
  bucket.n++; bucket.sum += rt;
  if(rt <= 560) bucket.fast++;
  const arr = bucket.arr;
  if(arr.length < cap) arr.push(rt);
  else{
    const j = Math.floor((rng ? rng() : Math.random()) * cap);
    arr[j] = rt;
  }
}
function summarizeBucket(b){
  const n = b?.n || 0;
  const avg = n ? (b.sum / n) : 0;
  const med = medianOf(b.arr || []);
  const fastPct = n ? (b.fast / n) * 100 : 0;
  return { n, avgMs: Math.round(avg), medianMs: Math.round(med), fastPct: Number(fastPct.toFixed(2)) };
}

// -------------------------
// State
// -------------------------
function makeInitialState(cfg, opts){
  return {
    phase:'ready',
    score:0,
    combo:0,
    comboMax:0,
    miss:0,

    // ✅ Pack5: miss breakdown
    missFromExpire:0,
    missFromJunk:0,

    nSpawnGood:0, nSpawnJunk:0, nSpawnStar:0, nSpawnShield:0,
    nHitGood:0, nHitJunk:0, nHitJunkGuard:0,
    nExpireGood:0,

    timeTotalSec: opts.timeSec,
    timeLeftSec: opts.timeSec,
    playedSec:0,

    goal: pickGoal(cfg),
    goalsCleared:0, goalsTotal:1,

    miniSeq: pickMiniSequence(),
    miniIndex:-1,
    mini:null,
    miniCleared:0, miniTotal:3,

    practiceLeft:15,
    playTimerStarted:false,
    graceSec:5,

    shieldSec: 0,

    burstQueue: 0,
    burstCooldown: 0,

    grade:'—',
    rng: opts.rng,
    lastSpawnAtMs: 0,

    // RT main (sheet)
    rtGoodCount:0,
    rtGoodSumMs:0,
    rtGoodFastCount:0,
    rtGoodArr:[],
    rtArrCap:120,

    // RT breakdown
    rtByPhase: {
      practice: { n:0, sum:0, fast:0, arr:[] },
      play:     { n:0, sum:0, fast:0, arr:[] },
    },
    rtByMini: {
      streak_good: { n:0, sum:0, fast:0, arr:[] },
      avoid_junk:  { n:0, sum:0, fast:0, arr:[] },
      fast_hits:   { n:0, sum:0, fast:0, arr:[] },
      none:        { n:0, sum:0, fast:0, arr:[] },
    },
    rtArrCap2: 80,

    __aiSpawnMul: 1.0,
    __aiJunkDelta: 0.0,
  };
}

function logEvent(type, payload){ emit('hha:log', { type, ...payload }); }

// -------------------------
// Boot
// -------------------------
export function boot(opts={}){
  const layer = byId('gj-layer');
  if(!layer){ console.error('GoodJunkVR: missing #gj-layer'); return; }

  const view = String(opts.view||'mobile');
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run||'play').toLowerCase();
  const isResearch = (run === 'research');

  // ✅ Pack25: deterministic seed for research if deriveSeed exists
  let seed;
  if (opts.seed != null) seed = Number(opts.seed);
  else if (isResearch && ROOT.HHA_SESSION?.deriveSeed) {
    seed = ROOT.HHA_SESSION.deriveSeed({
      pid: qs('pid', qs('participant','')),
      protocol: qs('protocol',''),
      diff,
      gameMode: qs('mode', qs('gameMode','rush')),
      projectTag: 'GoodJunkVR'
    });
  } else {
    seed = Date.now();
  }

  const rng = makeSeededRng(seed);

  const cfg = diffCfg(diff);
  const timeSec = Math.max(20, Number(opts.time)||80) * (cfg.timeMul||1);
  const state = makeInitialState(cfg, { timeSec, rng });

  advanceMini(state, 'init');

  // ✅ practice only in play
  state.phase = isResearch ? 'play' : 'practice';
  if(isResearch){
    state.practiceLeft = 0;
    state.playTimerStarted = true;
    state.playedSec = 0;
    state.timeLeftSec = state.timeTotalSec;
  }

  const missLimitBase = cfg.missLimit ?? 6;
  const missLimit = (view === 'mobile') ? (missLimitBase + 2) : missLimitBase;

  hudUpdate(state);

  // ✅ Pack25: meta (prefer HHA_SESSION.buildMeta)
  const meta = (ROOT.HHA_SESSION && ROOT.HHA_SESSION.buildMeta)
    ? ROOT.HHA_SESSION.buildMeta('GoodJunkVR', { gameVersion:'gj-2026-01-02C', seed, view, diff, runMode:run, durationPlannedSec: timeSec })
    : {
        projectTag:'GoodJunkVR',
        runMode: run,
        diff,
        view,
        seed,
        durationPlannedSec: timeSec,
        studyId: opts.studyId || null,
        phase: opts.phase || null,
        conditionGroup: opts.conditionGroup || null,
        startTimeIso: new Date().toISOString(),
        gameVersion:'gj-2026-01-02C',
        sessionId: `S-${Date.now()}-${Math.floor(Math.random()*1e6)}`
      };

  meta.hub = opts.hub || meta.hub || null;

  emit('hha:start', meta);
  logEvent('start', meta);

  // ✅ Pack27: patch ticker
  const TICK = (ROOT.HHA_PATCH_TICKER && ROOT.HHA_PATCH_TICKER.makeTicker)
    ? ROOT.HHA_PATCH_TICKER.makeTicker({ everySec: 6, minDeltaScore: 10, minDeltaMiss: 1 })
    : null;

  if (TICK){
    TICK.start(meta, ()=>({
      sessionId: meta.sessionId,
      durationPlayedSec: Number(state.playedSec||0),
      scoreFinal: Number(state.score||0),
      comboMax: Number(state.comboMax||0),
      misses: Number(state.miss||0),
      goalsCleared: Number(state.goalsCleared||0),
      goalsTotal: Number(state.goalsTotal||0),
      miniCleared: Number(state.miniCleared||0),
      miniTotal: Number(state.miniTotal||0),
      accuracyGoodPct: (state.nHitGood + state.nExpireGood) > 0
        ? (state.nHitGood / (state.nHitGood + state.nExpireGood))*100 : 0,
      avgRtGoodMs: (state.rtGoodCount>0) ? (state.rtGoodSumMs/state.rtGoodCount) : 0,
      fastHitRatePct: (state.rtGoodCount>0) ? (state.rtGoodFastCount/state.rtGoodCount)*100 : 0,
    }));
  }

  // fallback patch (still useful if your logger listens)
  let patchAcc = 0;

  // practice hint UI
  if(!isResearch){
    showPracticeHint(state.phase === 'practice');
    ensurePracticeHint().querySelector('.gj-skip').onclick = ()=>{ state.practiceLeft = 0; };
  }

  // ✅ AI hooks (OFF default, research OFF)
  const ai = (ROOT.HHA_AI && ROOT.HHA_AI.createAIHooks)
    ? ROOT.HHA_AI.createAIHooks({
        enabled: (qs('ai','0') === '1'),
        aiMode: qs('aiMode','all'),
        runMode: run,
        seed: seed,
        pid: qs('pid', qs('participant','')),
        protocol: qs('protocol', qs('pid','')),
        conditionGroup: qs('cond', qs('conditionGroup','')),
        diff,
        gameTag: 'GoodJunkVR'
      })
    : null;
  let aiAcc = 0;
  let aiLast = null;

  // coach/ai hint -> toast + coach event
  ROOT.addEventListener('hha:ai:hint', (ev)=>{
    const d = ev?.detail;
    if(!d || !d.text) return;
    try{ Particles.toast && Particles.toast(d.text, 'AI'); }catch(_){}
    emit('hha:coach', { text: d.text, why: d.why, mood:'neutral' });
  }, { passive:true });

  const activeTargets = new Set();
  let ended = false;

  function onTargetClick(e){
    const el = e.target;
    if(!el || !el.dataset) return;
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const kind = el.dataset.kind;
    const tNow = nowMs();

    // ✅ RT from bornAt (per target)
    const bornAt = Number(el.dataset.bornAt || 0);
    const rt = bornAt ? Math.max(0, tNow - bornAt) : null;

    if(kind === 'good'){
      state.nHitGood++;
      state.score += 10;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

      // RT stats (main)
      if(rt != null){
        state.rtGoodCount++;
        state.rtGoodSumMs += rt;
        if(rt <= 560) state.rtGoodFastCount++;

        const arr = state.rtGoodArr;
        if(arr.length < state.rtArrCap) arr.push(rt);
        else{
          const j = Math.floor(state.rng() * state.rtArrCap);
          arr[j] = rt;
        }

        // RT breakdown
        const ph = (state.phase === 'practice') ? 'practice' : 'play';
        const miniKey = state.mini ? String(state.mini.type || 'none') : 'none';
        pushRtBucket(state.rtByPhase[ph], rt, state.rtArrCap2, state.rng);
        pushRtBucket(state.rtByMini[miniKey] || state.rtByMini.none, rt, state.rtArrCap2, state.rng);
      }

      // goal progress
      if(state.goal && !state.goal.done){
        state.goal.cur = clamp(state.goal.cur + 1, 0, state.goal.target);
        if(state.goal.cur >= state.goal.target){
          state.goal.done = true;
          state.goalsCleared = 1;
          emit('hha:goal-complete', { goal: state.goal });
          try{ Particles.celebrate && Particles.celebrate({ kind:'GOAL', intensity:1.0 }); }catch(_){}
        }
      }

      miniOnGoodHit(state, rt);
      if(state.mini && state.mini.done) advanceMini(state, 'done');

      // FX
      try{
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        Particles.burstAt && Particles.burstAt(cx, cy, 'good');
        Particles.scorePop && Particles.scorePop(cx, cy, '+10', 'GOOD');
      }catch(_){}

      logEvent('hit_good', { rtMs: rt, score: state.score, combo: state.combo });

    } else if(kind === 'junk'){
      state.nHitJunk++;

      // ✅ PRACTICE: no penalty
      if(state.phase === 'practice'){
        state.combo = 0;
        miniOnJunkHit(state);
        try{
          const r = el.getBoundingClientRect();
          Particles.burstAt && Particles.burstAt(r.left+r.width/2, r.top+r.height/2, 'trap');
          Particles.scorePop && Particles.scorePop(r.left+r.width/2, r.top+r.height/2, '', 'NOPE');
        }catch(_){}
        logEvent('hit_junk_practice', { score: state.score, miss: state.miss });
      }
      else {
        // ✅ PLAY: shield blocks miss
        if(state.shieldSec > 0){
          state.nHitJunkGuard++;
          state.score = Math.max(0, state.score - 1);
          state.combo = Math.max(0, state.combo - 1);
          try{
            const r = el.getBoundingClientRect();
            Particles.scorePop && Particles.scorePop(r.left+r.width/2, r.top+r.height/2, '🛡️', 'BLOCK');
            Particles.burstAt && Particles.burstAt(r.left+r.width/2, r.top+r.height/2, 'power');
          }catch(_){}
          logEvent('hit_junk_guard', { score: state.score, shieldSec: state.shieldSec });
        }else{
          state.score = Math.max(0, state.score - 6);
          state.miss++;
          state.missFromJunk++;
          state.combo = 0;
          miniOnJunkHit(state);
          try{
            const r = el.getBoundingClientRect();
            Particles.scorePop && Particles.scorePop(r.left+r.width/2, r.top+r.height/2, '', 'MISS');
            Particles.burstAt && Particles.burstAt(r.left+r.width/2, r.top+r.height/2, 'trap');
          }catch(_){}
          logEvent('hit_junk', { score: state.score, miss: state.miss });
        }
      }

    } else if(kind === 'star'){
      state.score += 18;
      state.miss = Math.max(0, state.miss - 1);
      // adjust breakdown safely
      if(state.missFromExpire > 0) state.missFromExpire--;
      else if(state.missFromJunk > 0) state.missFromJunk--;
      state.combo = Math.max(state.combo, 1);
      try{
        const r = el.getBoundingClientRect();
        Particles.scorePop && Particles.scorePop(r.left+r.width/2, r.top+r.height/2, '+18', 'STAR');
        Particles.burstAt && Particles.burstAt(r.left+r.width/2, r.top+r.height/2, 'gold');
      }catch(_){}
      logEvent('pickup_star', { score: state.score, miss: state.miss });

    } else if(kind === 'shield'){
      state.shieldSec = Math.max(state.shieldSec, 6);
      state.score += 6;
      try{
        const r = el.getBoundingClientRect();
        Particles.scorePop && Particles.scorePop(r.left+r.width/2, r.top+r.height/2, '+SHIELD', '🛡️');
        Particles.burstAt && Particles.burstAt(r.left+r.width/2, r.top+r.height/2, 'power');
      }catch(_){}
      logEvent('pickup_shield', { score: state.score, shieldSec: state.shieldSec });
    }

    removeEl(el);
    hudUpdate(state);

    // danger UI only matters in play
    if(state.phase === 'play'){
      setDanger(clamp((state.miss / Math.max(1, missLimit)), 0, 1));
      if(state.miss >= missLimit){
        endGame('missLimit');
      }
    }
  }

  layer.addEventListener('click', onTargetClick, { passive:false });

  function spawnOne(forceKind=null){
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    let kind = forceKind;

    if(!kind){
      const r = state.rng();
      const starP = cfg.starP ?? 0.06;
      const shieldP = cfg.shieldP ?? 0.05;

      if(r < shieldP){
        kind = 'shield';
      } else if(r < shieldP + starP){
        kind = 'star';
      } else {
        const baseJR = (cfg.junkRatio ?? 0.40);
        const aiJR = clamp(baseJR + (state.__aiJunkDelta || 0), 0.18, 0.70);
        kind = (state.rng() < aiJR) ? 'junk' : 'good';
      }
    }

    const emoji = pickEmoji(kind, state.rng);
    const el = createTargetEl(kind, emoji);

    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    // NOTE: we keep your old pad, but you already have VR-first stage in CSS
    const topPad = 130 + (Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px',''))||0);

    const x = randIn(state.rng, 0.18, 0.82) * W;
    const y = randIn(state.rng, 0.25, 0.78) * H;
    el.style.left = `${x}px`;
    el.style.top  = `${Math.max(topPad, y)}px`;

    const s = (kind==='star' || kind==='shield')
      ? randIn(state.rng, 0.95, 1.08)
      : randIn(state.rng, 0.92, 1.18);
    el.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;

    // lifetime (mobile a bit longer => less "ended too fast")
    const mobileMul = (view==='mobile') ? 1.18 : 1.0;
    let lifeMs;
    if(kind==='good') lifeMs = randIn(state.rng, 1500, 2400) * mobileMul;
    else if(kind==='junk') lifeMs = randIn(state.rng, 1300, 2200) * mobileMul;
    else lifeMs = randIn(state.rng, 1200, 2000) * mobileMul;

    const born = nowMs();
    el.dataset.bornAt = String(born);
    state.lastSpawnAtMs = born;

    layer.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('spawn')); // ✅ needs CSS .spawn
    activeTargets.add(el);

    if(kind==='good') state.nSpawnGood++;
    else if(kind==='junk') state.nSpawnJunk++;
    else if(kind==='star') state.nSpawnStar++;
    else if(kind==='shield') state.nSpawnShield++;

    setTimeout(()=>{
      if(!activeTargets.has(el) || ended) return;
      activeTargets.delete(el);

      if(el.dataset.kind === 'good' && (state.phase==='practice' || state.phase==='play')){
        if(state.phase === 'practice'){
          state.nExpireGood++;
          logEvent('expire_good_practice', {});
        }
        else {
          if(state.graceSec > 0){
            // no miss during grace
          }else{
            state.nExpireGood++;
            state.miss++;
            state.missFromExpire++;
            state.combo = 0;
            hudUpdate(state);

            setDanger(clamp(state.miss / Math.max(1, missLimit), 0, 1));
            if(state.miss >= missLimit){
              removeEl(el);
              endGame('missLimit');
              return;
            }
          }
        }
      }
      removeEl(el);
    }, Math.floor(lifeMs));
  }

  // spawn pacing
  let lastTick = nowMs();
  let spawnAcc = 0;

  function tick(){
    if(ended) return;
    const t = nowMs();
    const dt = Math.min(0.05, (t - lastTick)/1000);
    lastTick = t;

    // shield countdown
    if(state.shieldSec > 0) state.shieldSec = Math.max(0, state.shieldSec - dt);

    // ✅ fallback patch every ~6s (even if ticker module absent)
    patchAcc += dt;
    if(patchAcc >= 6.0){
      patchAcc = 0;
      if(!TICK){
        fallbackPatchEmit(meta, {
          sessionId: meta.sessionId,
          durationPlayedSec: Number(state.playedSec||0),
          scoreFinal: Number(state.score||0),
          misses: Number(state.miss||0),
          comboMax: Number(state.comboMax||0),
        });
      }
    }

    if(state.phase === 'practice'){
      if(!isResearch) showPracticeHint(true);

      state.practiceLeft = Math.max(0, state.practiceLeft - dt);
      miniTick(state, dt);

      state.timeLeftSec = state.practiceLeft;
      hudSetText(HUD.time, Math.ceil(state.timeLeftSec));

      // spawn a bit softer in practice
      const pps = (view==='mobile') ? (cfg.spawnPps * 0.85) : (cfg.spawnPps * 0.95);
      spawnAcc += dt * pps;

      const cap = (view==='mobile') ? 2 : 3;
      let spawned = 0;
      while(spawnAcc >= 1 && spawned < cap){
        spawnAcc -= 1;
        spawnOne();
        spawned++;
      }

      if(state.practiceLeft <= 0){
        // ✅ enter play: reset real timer
        state.phase = 'play';
        state.playTimerStarted = true;
        state.playedSec = 0;
        state.timeLeftSec = state.timeTotalSec;
        state.graceSec = 5;
        if(!isResearch) showPracticeHint(false);
        logEvent('practice_end', {});
        emit('hha:judge', { label:'START!' });
        try{ Particles.toast && Particles.toast('START!', 'PLAY'); }catch(_){}
      }

      hudUpdate(state);
    }
    else if(state.phase === 'play'){
      state.playedSec += dt;
      state.timeLeftSec = Math.max(0, state.timeTotalSec - state.playedSec);
      state.graceSec = Math.max(0, state.graceSec - dt);

      miniTick(state, dt);
      if(state.mini && state.mini.done) advanceMini(state, 'done');

      if(state.timeLeftSec <= 0){
        endGame('time');
        return;
      }

      // base spawn (+ optional AI apply)
      const basePps = (cfg.spawnPps || 2.0);
      const aiApply = (qs('aiApply','0') === '1');
      const mul = (aiApply && !isResearch) ? (state.__aiSpawnMul || 1.0) : 1.0;

      const pps = (view==='mobile') ? (basePps * 0.90 * mul) : (basePps * mul);
      spawnAcc += dt * pps;

      // burst
      if(state.burstQueue > 0){
        state.burstCooldown = Math.max(0, state.burstCooldown - dt);
        if(state.burstCooldown <= 0){
          spawnOne();
          state.burstQueue--;
          state.burstCooldown = 0.12;
        }
      }

      const cap = (view==='mobile') ? 2 : 3;
      let spawned = 0;
      while(spawnAcc >= 1 && spawned < cap){
        spawnAcc -= 1;
        spawnOne();
        spawned++;
      }

      setDanger(clamp(state.miss / Math.max(1, missLimit), 0, 1));
      hudUpdate(state);

      // ✅ AI update (~1s)
      if(ai && ai.enabled){
        aiAcc += dt;
        if(aiAcc >= 1.0){
          aiAcc = 0;

          const denom = (state.nHitGood + state.nExpireGood);
          const accGood = denom > 0 ? (state.nHitGood / denom) * 100 : 0;

          const avgRt = (state.rtGoodCount>0) ? (state.rtGoodSumMs/state.rtGoodCount) : 0;
          const fastPct = (state.rtGoodCount>0) ? (state.rtGoodFastCount/state.rtGoodCount)*100 : 0;

          const snap = {
            timeLeftSec: state.timeLeftSec,
            playedSec: state.playedSec,
            misses: state.miss,
            comboMax: state.comboMax,
            accuracyGoodPct: accGood,
            avgRtGoodMs: avgRt,
            fastHitRatePct: fastPct,
            fever: 0,
            shield: (state.shieldSec>0) ? 1 : 0,
            miniType: state.mini ? state.mini.type : 'none'
          };

          aiLast = ai.update(snap);

          // optional apply
          if((qs('aiApply','0')==='1') && !isResearch && aiLast && aiLast.director){
            state.__aiSpawnMul = aiLast.director.spawnPpsMul || 1.0;
            state.__aiJunkDelta = aiLast.director.junkRatioDelta || 0.0;
          }
        }
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  function endGame(reason='time'){
    if(ended) return;
    ended = true;
    state.phase = 'end';
    setDanger(0);

    try{ TICK?.stop?.(); }catch(_){}

    activeTargets.forEach(el=>removeEl(el));
    activeTargets.clear();

    const denom = (state.nHitGood + state.nExpireGood);
    const accGood = denom > 0 ? (state.nHitGood / denom) * 100 : 0;

    const avgRt = (state.rtGoodCount>0) ? (state.rtGoodSumMs/state.rtGoodCount) : 0;
    const medRt = medianOf(state.rtGoodArr);
    const fastPct = (state.rtGoodCount>0) ? (state.rtGoodFastCount/state.rtGoodCount)*100 : 0;

    const grade = gradeFrom({ acc: accGood, miss: state.miss, comboMax: state.comboMax });
    state.grade = grade;
    hudSetText(HUD.grade, grade);

    const rtDetail = {
      phase: {
        practice: summarizeBucket(state.rtByPhase.practice),
        play: summarizeBucket(state.rtByPhase.play),
      },
      mini: {
        streak_good: summarizeBucket(state.rtByMini.streak_good),
        avoid_junk:  summarizeBucket(state.rtByMini.avoid_junk),
        fast_hits:   summarizeBucket(state.rtByMini.fast_hits),
        none:        summarizeBucket(state.rtByMini.none),
      }
    };
    const rtBreakdownJson = JSON.stringify(rtDetail);

    const summary = {
      title: (reason==='missLimit') ? 'Game Over' : 'Completed',
      reason,
      projectTag: 'GoodJunkVR',
      runMode: run,
      diff,
      device: view,
      seed,
      sessionId: meta.sessionId,

      gameMode: qs('mode', qs('gameMode','rush')),
      durationPlannedSec: Number(meta.durationPlannedSec || state.timeTotalSec),
      durationPlayedSec: state.playedSec,

      scoreFinal: state.score,
      comboMax: state.comboMax,
      misses: state.miss,

      // ✅ miss breakdown
      missFromExpire: state.missFromExpire,
      missFromJunk: state.missFromJunk,

      goalsCleared: state.goalsCleared,
      goalsTotal: state.goalsTotal,
      miniCleared: state.miniCleared,
      miniTotal: state.miniTotal,

      nTargetGoodSpawned: state.nSpawnGood,
      nTargetJunkSpawned: state.nSpawnJunk,
      nTargetStarSpawned: state.nSpawnStar,
      nTargetShieldSpawned: state.nSpawnShield,

      nHitGood: state.nHitGood,
      nHitJunk: state.nHitJunk,
      nHitJunkGuard: state.nHitJunkGuard,
      nExpireGood: state.nExpireGood,

      accuracyGoodPct: accGood,
      avgRtGoodMs: avgRt,
      medianRtGoodMs: medRt,
      fastHitRatePct: fastPct,
      rtBreakdownJson,

      grade,

      studyId: opts.studyId || meta.studyId || null,
      phase: opts.phase || meta.phase || null,
      conditionGroup: opts.conditionGroup || meta.conditionGroup || null,

      gameVersion:'gj-2026-01-02C',
      startTimeIso: meta.startTimeIso,
      endTimeIso: new Date().toISOString(),
      hub: opts.hub || meta.hub || null,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    emit('hha:end', summary);
    logEvent('end', summary);

    try{
      Particles.celebrate && Particles.celebrate({ kind:'END', intensity:1.2 });
      Particles.toast && Particles.toast(`GRADE ${grade}`, 'RESULT');
    }catch(_){}
  }

  ROOT.addEventListener('hha:force-end', (ev)=> endGame(ev?.detail?.reason || 'force'), { passive:true });

  ROOT.addEventListener('pagehide', ()=>{
    try{
      if(!ended){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
          projectTag:'GoodJunkVR',
          runMode: run,
          diff,
          device:view,
          seed,
          sessionId: meta.sessionId,
          reason:'pagehide',
          scoreFinal: state.score,
          misses: state.miss,
          missFromExpire: state.missFromExpire,
          missFromJunk: state.missFromJunk,
          durationPlayedSec: state.playedSec,
          gameVersion:'gj-2026-01-02C',
          startTimeIso: meta.startTimeIso,
          endTimeIso: new Date().toISOString(),
          hub: meta.hub || null
        }));
      }
    }catch(_){}
  }, { passive:true });
}