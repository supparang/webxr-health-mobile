// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (C+FX PATCH + TWO-EYE + cVR SHOOT) — FULL (LATEST)
// ✅ FX: supports OLD + NEW Particles API (adapter)
// ✅ Emits: hha:judge / hha:score / hha:miss / hha:end for global FX Director
// ✅ MISS = good expired + junk hit (shield blocks junk miss => NO miss)
// ✅ Play: practice 15s (no penalty) then real play timer resets
// ✅ Research: deterministic seed, NO practice
// ✅ RT: avg / median / fast% + breakdown JSON
// ✅ VR-safe: no shake in VR/cVR, lighter FX frequency
// ✅ TWO-EYE: spawn pair L/R in VR/cVR + click/shoot removes BOTH + expire removes BOTH (miss counted once)
// ✅ cVR shoot: via event hha:shoot, aim-assist lockPx around center
// ✅ FALLBACK: target visible even if CSS fails (force absolute + injected fallback styles)
// ✅ PATCH A: anti double-hit (click/shoot/document bubbling) + accept only L target

'use strict';

const ROOT = window;
const DOC  = document;

// -------------------------
// Particles Adapter (OLD + NEW API)
// -------------------------
const P0 =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  {};

const Particles = {
  burstAt(x,y,kind){
    if (typeof P0.burstAt === 'function') return P0.burstAt(x,y,kind);
    if (typeof P0.burst === 'function') {
      const r = (kind==='gold' || kind==='star') ? 64 : (kind==='trap' ? 68 : 56);
      return P0.burst(x,y,{ r });
    }
    if (typeof P0.shockwave === 'function') return P0.shockwave(x,y,{ r: 60 });
  },
  scorePop(x,y,text,tag){
    if (typeof P0.scorePop === 'function') return P0.scorePop(x,y,text,tag);
    if (typeof P0.popText === 'function') return P0.popText(x,y,String(text||''), String(tag||'score'));
  },
  toast(text,tag){
    if (typeof P0.toast === 'function') return P0.toast(text,tag);
    if (typeof P0.popText === 'function') return P0.popText(innerWidth/2, innerHeight*0.25, String(text||''), String(tag||'toast'));
  },
  celebrate(payload){
    if (typeof P0.celebrate === 'function') return P0.celebrate(payload);
    if (typeof P0.burst === 'function') {
      for(let i=0;i<8;i++){
        setTimeout(()=>P0.burst(innerWidth/2+(Math.random()*2-1)*160, innerHeight*0.35+(Math.random()*2-1)*90, {r:28+Math.random()*38}), i*45);
      }
    }
  }
};

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

function rectCenter(el){
  try{
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
  }catch(_){
    return { cx: innerWidth/2, cy: innerHeight/2 };
  }
}

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
  combo: byId('hud-combo'), // (optional)
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
// UX: Danger warning overlay (VR-safe)
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
function isVRView(view){
  return view === 'vr' || view === 'cvr';
}
function setDanger(level01, view){
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

  // ✅ VR-safe: NO shake in VR/cVR
  if(!isVRView(view) && lv > 0.82) DOC.body.classList.add('gj-shake');
  else DOC.body.classList.remove('gj-shake');

  emit('hha:danger', { level: lv });
}

// -------------------------
// Practice hint
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
// FX helpers (VR-safe throttle)
// -------------------------
function makeFx(view){
  const vr = isVRView(view);
  let lastBurstAt = 0;
  let lastPopAt = 0;
  return {
    burst(cx,cy,kind){
      const t = Date.now();
      const minGap = vr ? 90 : 40;
      if(t - lastBurstAt < minGap) return;
      lastBurstAt = t;
      try{ Particles.burstAt && Particles.burstAt(cx, cy, kind); }catch(_){}
    },
    pop(cx,cy,text,tag){
      const t = Date.now();
      const minGap = vr ? 110 : 55;
      if(t - lastPopAt < minGap) return;
      lastPopAt = t;
      try{ Particles.scorePop && Particles.scorePop(cx, cy, text, tag); }catch(_){}
    },
    toast(text,tag){
      try{ Particles.toast && Particles.toast(text, tag); }catch(_){}
    },
    celebrate(payload){
      try{ Particles.celebrate && Particles.celebrate(payload); }catch(_){}
    }
  };
}

// -------------------------
// Low-time UI hooks
// -------------------------
function lowtimeInit(){
  const ring = DOC.querySelector('.gj-warning-ring');
  const overlay = DOC.querySelector('.gj-lowtime-overlay');
  const num = byId('gj-lowtime-num');
  return { ring, overlay, num };
}
function lowtimeApply(ui, timeLeftSec){
  if(!ui) return;
  const t = Math.max(0, Number(timeLeftSec)||0);

  const isLow10 = t > 0 && t <= 10.0;
  const isLow5  = t > 0 && t <= 5.05;

  DOC.body.classList.toggle('gj-lowtime', isLow10);
  DOC.body.classList.toggle('gj-lowtime5', isLow5);

  if(ui.overlay && ui.num){
    if(isLow5){
      const s = Math.max(1, Math.ceil(t));
      ui.num.textContent = String(s);
      ui.overlay.setAttribute('aria-hidden','false');
    }else{
      ui.overlay.setAttribute('aria-hidden','true');
    }
  }
}
function lowtimeTickPulse(secCeil){
  if(secCeil <= 10 && secCeil >= 1){
    DOC.body.classList.add('gj-tick');
    setTimeout(()=> DOC.body.classList.remove('gj-tick'), 90);
  }else{
    DOC.body.classList.remove('gj-tick');
  }
}

// -------------------------
// Fever + Shield UI render
// -------------------------
function feverInit(){
  return {
    fill: byId('feverFill'),
    text: byId('feverText'),
    pills: byId('shieldPills'),
  };
}
function feverCompute(state, missLimit){
  const missP = clamp(state.miss / Math.max(1, missLimit), 0, 1);
  const junkP = clamp(state.nHitJunk / 14, 0, 0.25);
  return clamp(missP + junkP, 0, 1);
}
function feverRender(ui, fever01){
  if(!ui) return;
  const pct = Math.round(clamp(fever01,0,1) * 100);
  if(ui.fill) ui.fill.style.width = `${pct}%`;
  if(ui.text) ui.text.textContent = `${pct}%`;
}
function shieldRender(ui, shieldSec){
  if(!ui || !ui.pills) return;
  const s = Math.max(0, Number(shieldSec)||0);
  const n = clamp(Math.ceil(s / 2), 0, 4);
  const arr = [];
  for(let i=0;i<n;i++) arr.push('🛡️');
  ui.pills.innerHTML = arr.length ? arr.map(x=>`<span style="display:inline-flex;align-items:center;justify-content:center;
    min-width:34px;height:28px;border-radius:999px;
    border:1px solid rgba(34,197,94,.26);
    background:rgba(34,197,94,.12);
    font: 1000 14px/1 system-ui;
  ">${x}</span>`).join('') : `<span style="opacity:.7;">—</span>`;
}

// -------------------------
// Config / Grade / Goal / Mini
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

  // ✅ fallback style
  el.style.position = 'absolute';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = (kind==='star' || kind==='shield') ? '46px' : '52px';
  el.style.lineHeight = '1';
  el.style.userSelect = 'none';
  el.style.cursor = 'pointer';
  el.style.zIndex = '5';
  el.style.filter = 'drop-shadow(0 10px 22px rgba(0,0,0,.35))';
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
// RT buckets
// -------------------------
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

    rtGoodCount:0,
    rtGoodSumMs:0,
    rtGoodFastCount:0,
    rtGoodArr:[],
    rtArrCap:120,

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
  const layer  = byId('gj-layer');
  if(!layer){ console.error('GoodJunkVR: missing #gj-layer'); return; }

  const layerR = byId('gj-layer-r'); // right eye layer (VR/cVR)

  // fallback: ensure layers
  const ensureLayerBox = (el)=>{
    if(!el) return;
    const cs = getComputedStyle(el);
    if(cs.position === 'static') el.style.position = 'fixed';
    if(!el.style.inset) el.style.inset = '0';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = el.style.zIndex || '2';
    if(!el.style.minHeight) el.style.minHeight = '60vh';
    if(!el.style.minWidth)  el.style.minWidth  = '60vw';
  };
  ensureLayerBox(layer);
  ensureLayerBox(layerR);

  if(!DOC.getElementById('gj-fallback-style')){
    const st = DOC.createElement('style');
    st.id = 'gj-fallback-style';
    st.textContent = `
      #gj-layer, #gj-layer-r { position: fixed; inset: 0; pointer-events:auto; }
      .gj-target{ position:absolute !important; transform:translate(-50%,-50%); }
      .gj-target.spawn{ opacity:1; }
    `;
    DOC.head.appendChild(st);
  }

  const view = String(opts.view||'mobile');
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run||'play').toLowerCase();
  const isResearch = (run === 'research');

  // ✅ crosshair in VR/cVR: force center (both eyes)
  (function fixCrosshairSplit(){
    if(view!=='vr' && view!=='cvr') return;
    const l = DOC.getElementById('crosshairL');
    const r = DOC.getElementById('crosshairR');
    if(l){ l.style.left='50%'; l.style.top='50%'; }
    if(r){ r.style.left='50%'; r.style.top='50%'; }
  })();

  const seed = opts.seed != null ? Number(opts.seed) : (isResearch ? 12345 : Date.now());
  const rng = makeSeededRng(seed);

  const cfg = diffCfg(diff);
  const timeSec = Math.max(20, Number(opts.time)||80) * (cfg.timeMul||1);
  const state = makeInitialState(cfg, { timeSec, rng });

  const fx = makeFx(view);
  const lowUI = lowtimeInit();
  const feverUI = feverInit();

  advanceMini(state, 'init');

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

  const meta = {
    projectTag:'GoodJunkVR', runMode:run, diff, view, seed,
    durationPlannedSec: timeSec,
    studyId: opts.studyId || null,
    phase: opts.phase || null,
    conditionGroup: opts.conditionGroup || null,
    startTimeIso: new Date().toISOString(),
    gameVersion:'gj-2026-01-03B-fx-director'
  };
  emit('hha:start', meta);
  logEvent('start', meta);

  if(!isResearch){
    showPracticeHint(state.phase === 'practice');
    ensurePracticeHint().querySelector('.gj-skip').onclick = ()=>{ state.practiceLeft = 0; };
  }

  // AI hooks (as-is)
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

  ROOT.addEventListener('hha:ai:hint', (ev)=>{
    const d = ev?.detail;
    if(!d || !d.text) return;
    fx.toast(d.text, 'AI');
    emit('hha:coach', { text: d.text, why: d.why, mood:'neutral' });
  }, { passive:true });

  let ended = false;

  // -------------------------
  // INPUT GUARD (anti double-hit) — PATCH A
  // -------------------------
  let inputLockUntil = 0;
  let lastHitPid = null;
  let lastHitAt = 0;

  function canAcceptHit(pid){
    const t = performance.now();
    if(t < inputLockUntil) return false;
    if(pid && pid === lastHitPid && (t - lastHitAt) < 140) return false;
    inputLockUntil = t + 70;
    lastHitPid = pid;
    lastHitAt = t;
    return true;
  }

  // Pair management
  let pairSeq = 1;
  const pairMap = new Map();     // pid -> { kind, l, r, bornAt, expireT }
  const elToPid = new WeakMap(); // element -> pid

  function nextPid(){ return String(pairSeq++); }
  function pairRemove(pid){
    const p = pairMap.get(pid);
    if(!p) return;
    pairMap.delete(pid);
    if(p.expireT){ try{ clearTimeout(p.expireT); }catch(_){} }
    if(p.l){ try{ removeEl(p.l); }catch(_){} }
    if(p.r){ try{ removeEl(p.r); }catch(_){} }
  }
  function pairFromEl(el){ return el ? elToPid.get(el) : null; }

  function onTargetClick(e){
    try{ e?.preventDefault?.(); e?.stopPropagation?.(); }catch(_){}

    const el0 = e?.target;
    if(!el0) return;
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const targetEl = el0.closest ? el0.closest('.gj-target') : el0;
    if(!targetEl || !targetEl.dataset) return;

    const pid = pairFromEl(targetEl) || targetEl.dataset.pid || null;
    if(!pid) return;

    const p = pairMap.get(pid);
    if(!p) return;

    // ✅ PATCH A: กันยิงซ้ำ/ดับเบิลอีเวนต์
    if(!canAcceptHit(pid)) return;

    // ✅ PATCH A: รับเฉพาะฝั่ง L (กันคลิก R ซ้อน)
    if(p.l && targetEl !== p.l) return;

    const kind = p.kind;
    const tNow = nowMs();

    const bornAt = Number(targetEl.dataset.bornAt || 0);
    const rt = bornAt ? Math.max(0, tNow - bornAt) : null;

    const { cx, cy } = rectCenter(targetEl);

    if(kind === 'good'){
      state.nHitGood++;
      state.score += 10;
      state.combo++;
      state.comboMax = Math.max(state.comboMax, state.combo);

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

        const ph = (state.phase === 'practice') ? 'practice' : 'play';
        const miniKey = state.mini ? String(state.mini.type || 'none') : 'none';
        pushRtBucket(state.rtByPhase[ph], rt, state.rtArrCap2, state.rng);
        pushRtBucket(state.rtByMini[miniKey] || state.rtByMini.none, rt, state.rtArrCap2, state.rng);
      }

      if(state.goal && !state.goal.done){
        state.goal.cur = clamp(state.goal.cur + 1, 0, state.goal.target);
        if(state.goal.cur >= state.goal.target){
          state.goal.done = true;
          state.goalsCleared = 1;
          emit('hha:goal-complete', { goal: state.goal });
          fx.celebrate({ kind:'GOAL', intensity:1.0 });
        }
      }

      miniOnGoodHit(state, rt);
      if(state.mini && state.mini.done) advanceMini(state, 'done');

      fx.burst(cx, cy, 'good');
      fx.pop(cx, cy, '+10', 'GOOD');

      emit('hha:judge', { type:'good', x: cx, y: cy, combo: state.combo, rtMs: rt });
      emit('hha:score', { score: 10, x: cx, y: cy });

      logEvent('hit_good', { rtMs: rt, score: state.score, combo: state.combo });

    } else if(kind === 'junk'){
      state.nHitJunk++;

      if(state.phase === 'practice'){
        state.combo = 0;
        miniOnJunkHit(state);

        fx.burst(cx, cy, 'trap');
        fx.pop(cx, cy, '', 'NOPE');

        emit('hha:judge', { type:'bad', x: cx, y: cy, reason:'hit-junk-practice' });
        emit('hha:score', { score: 0, x: cx, y: cy });

        logEvent('hit_junk_practice', { score: state.score, miss: state.miss });
      }
      else {
        if(state.shieldSec > 0){
          state.nHitJunkGuard++;
          state.score = Math.max(0, state.score - 1);
          state.combo = Math.max(0, state.combo - 1);

          fx.pop(cx, cy, '🛡️', 'BLOCK');
          fx.burst(cx, cy, 'power');

          emit('hha:judge', { type:'block', x: cx, y: cy, reason:'shield' });
          emit('hha:score', { score: -1, x: cx, y: cy });

          logEvent('hit_junk_guard', { score: state.score, shieldSec: state.shieldSec });
        }else{
          state.score = Math.max(0, state.score - 6);
          state.miss++;
          state.combo = 0;
          miniOnJunkHit(state);

          fx.pop(cx, cy, '', 'MISS');
          fx.burst(cx, cy, 'trap');

          emit('hha:judge', { type:'bad', x: cx, y: cy, reason:'hit-junk' });
          emit('hha:score', { score: -6, x: cx, y: cy });
          emit('hha:miss',  { x: cx, y: cy, reason:'hit-junk' });

          logEvent('hit_junk', { score: state.score, miss: state.miss });
        }
      }

    } else if(kind === 'star'){
      state.score += 18;
      state.miss = Math.max(0, state.miss - 1);
      state.combo = Math.max(state.combo, 1);

      fx.pop(cx, cy, '+18', 'STAR');
      fx.burst(cx, cy, 'gold');

      emit('hha:judge', { type:'good', x: cx, y: cy, reason:'star' });
      emit('hha:score', { score: 18, x: cx, y: cy });

      logEvent('pickup_star', { score: state.score, miss: state.miss });

    } else if(kind === 'shield'){
      state.shieldSec = Math.max(state.shieldSec, 6);
      state.score += 6;

      fx.pop(cx, cy, '+SHIELD', '🛡️');
      fx.burst(cx, cy, 'power');

      emit('hha:judge', { type:'good', x: cx, y: cy, reason:'shield' });
      emit('hha:score', { score: 6, x: cx, y: cy });

      logEvent('pickup_shield', { score: state.score, shieldSec: state.shieldSec });
    }

    pairRemove(pid);
    hudUpdate(state);

    const fever01 = feverCompute(state, missLimit);
    feverRender(feverUI, fever01);
    shieldRender(feverUI, state.shieldSec);

    if(state.phase === 'play'){
      setDanger(clamp((state.miss / Math.max(1, missLimit)), 0, 1), view);
      if(state.miss >= missLimit){
        endGame('missLimit');
      }
    }
  }

  // ✅ Keep ONLY ONE click source: LEFT layer
  layer.addEventListener('click', onTargetClick, { passive:false });

  // (PATCH A) ❌ REMOVE these to avoid double-hit:
  // if(layerR) layerR.addEventListener('click', onTargetClick, { passive:false });
  // DOC.addEventListener('click', ...)  // removed

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

    // keep pid deterministic-ish for pair map usage
    const pid = String((Math.random()*1e9)|0) + '-' + String(Date.now());
    const emoji = pickEmoji(kind, state.rng);

    const elL = createTargetEl(kind, emoji);
    elL.dataset.pid = pid;

    const elR = layerR ? createTargetEl(kind, emoji) : null;
    if(elR) elR.dataset.pid = pid;

    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    const sat = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--sat').replace('px',''))||0;
    const topPad = 130 + sat;

    const x = randIn(state.rng, 0.18, 0.82) * W;
    const y = randIn(state.rng, 0.25, 0.78) * H;

    elL.style.left = `${x}px`;
    elL.style.top  = `${Math.max(topPad, y)}px`;

    if(elR){
      elR.style.left = `${x}px`;
      elR.style.top  = `${Math.max(topPad, y)}px`;
    }

    const s = (kind==='star' || kind==='shield')
      ? randIn(state.rng, 0.95, 1.08)
      : randIn(state.rng, 0.92, 1.18);

    elL.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;
    if(elR) elR.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;

    const mobileMul = (view==='mobile') ? 1.18 : 1.0;
    let lifeMs;
    if(kind==='good') lifeMs = randIn(state.rng, 1500, 2400) * mobileMul;
    else if(kind==='junk') lifeMs = randIn(state.rng, 1300, 2200) * mobileMul;
    else lifeMs = randIn(state.rng, 1200, 2000) * mobileMul;

    const born = nowMs();
    elL.dataset.bornAt = String(born);
    if(elR) elR.dataset.bornAt = String(born);
    state.lastSpawnAtMs = born;

    layer.appendChild(elL);
    if(layerR && elR) layerR.appendChild(elR);

    requestAnimationFrame(()=> elL.classList.add('spawn'));
    if(elR) requestAnimationFrame(()=> elR.classList.add('spawn'));

    pairMap.set(pid, { kind, l: elL, r: elR, bornAt: born, expireT: 0 });
    elToPid.set(elL, pid);
    if(elR) elToPid.set(elR, pid);

    if(kind==='good') state.nSpawnGood++;
    else if(kind==='junk') state.nSpawnJunk++;
    else if(kind==='star') state.nSpawnStar++;
    else if(kind==='shield') state.nSpawnShield++;

    const expireT = setTimeout(()=>{
      if(ended) return;
      const p = pairMap.get(pid);
      if(!p) return;

      if(p.kind === 'good' && (state.phase==='practice' || state.phase==='play')){
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
            state.combo = 0;
            hudUpdate(state);

            const fever01 = feverCompute(state, missLimit);
            feverRender(feverUI, fever01);

            emit('hha:judge', { type:'miss', x: innerWidth/2, y: innerHeight/2, reason:'expire-good' });
            emit('hha:miss',  { x: innerWidth/2, y: innerHeight/2, reason:'expire-good' });

            setDanger(clamp(state.miss / Math.max(1, missLimit), 0, 1), view);
            if(state.miss >= missLimit){
              pairRemove(pid);
              endGame('missLimit');
              return;
            }
          }
        }
      }

      pairRemove(pid);
    }, Math.floor(lifeMs));

    const p0 = pairMap.get(pid);
    if(p0) p0.expireT = expireT;
  }

  // cVR shoot
  function pickByCrosshair(lockPx=46){
    const W = DOC.documentElement.clientWidth;
    const H = DOC.documentElement.clientHeight;

    // ✅ In VR/cVR (two-eye) use LEFT eye center (half-left)
    const cx = (view==='vr' || view==='cvr') ? (W * 0.25) : (W * 0.5);
    const cy = H * 0.5;

    let bestPid = null;
    let bestD2 = lockPx * lockPx;

    for(const [pid, p] of pairMap.entries()){
      const el = p?.l; // ✅ evaluate L only (stable)
      if(!el) continue;
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top  + r.height/2;
      const dx = tx - cx;
      const dy = ty - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 <= bestD2){
        bestD2 = d2;
        bestPid = pid;
      }
    }
    return bestPid;
  }

  function shoot(){
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    // ✅ lockPx adaptive based on HALF screen
    const W = DOC.documentElement.clientWidth;
    const halfW = Math.max(1, W * 0.5);
    let lock = Math.round(halfW * 0.06);
    lock = clamp(lock, 44, 78);

    const pid = pickByCrosshair(lock);
    if(!pid) return;

    const p = pairMap.get(pid);
    const el = p?.l;
    if(!el) return;
    onTargetClick({ target: el, preventDefault(){}, stopPropagation(){} });
  }
  ROOT.addEventListener('hha:shoot', shoot, { passive:true });

  // pacing
  let lastTick = nowMs();
  let spawnAcc = 0;
  let lastLowSec = 999;

  function tick(){
    if(ended) return;
    const t = nowMs();
    const dt = Math.min(0.05, (t - lastTick)/1000);
    lastTick = t;

    if(state.shieldSec > 0) state.shieldSec = Math.max(0, state.shieldSec - dt);
    shieldRender(feverUI, state.shieldSec);

    if(state.phase === 'practice'){
      showPracticeHint(true);

      state.practiceLeft = Math.max(0, state.practiceLeft - dt);
      miniTick(state, dt);

      state.timeLeftSec = state.practiceLeft;
      hudSetText(HUD.time, Math.ceil(state.timeLeftSec));

      DOC.body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');
      if(lowUI.overlay) lowUI.overlay.setAttribute('aria-hidden','true');

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
        state.phase = 'play';
        state.playTimerStarted = true;
        state.playedSec = 0;
        state.timeLeftSec = state.timeTotalSec;
        state.graceSec = 5;
        showPracticeHint(false);

        emit('hha:judge', { type:'good', x: innerWidth/2, y: innerHeight*0.25, label:'START!' });
        fx.toast('START!', 'PLAY');
      }

      hudUpdate(state);

      const fever01 = feverCompute(state, missLimit);
      feverRender(feverUI, fever01);
    }
    else if(state.phase === 'play'){
      state.playedSec += dt;
      state.timeLeftSec = Math.max(0, state.timeTotalSec - state.playedSec);
      state.graceSec = Math.max(0, state.graceSec - dt);

      lowtimeApply(lowUI, state.timeLeftSec);
      const secCeil = Math.ceil(state.timeLeftSec);
      if(secCeil !== lastLowSec){
        lastLowSec = secCeil;
        if(secCeil <= 10 && secCeil >= 1) lowtimeTickPulse(secCeil);
      }

      miniTick(state, dt);
      if(state.mini && state.mini.done) advanceMini(state, 'done');

      if(state.timeLeftSec <= 0){
        endGame('time');
        return;
      }

      const basePps = (cfg.spawnPps || 2.0);
      const aiApply = (qs('aiApply','0') === '1');
      const mul = (aiApply && !isResearch) ? (state.__aiSpawnMul || 1.0) : 1.0;

      const pps = (view==='mobile') ? (basePps * 0.90 * mul) : (basePps * mul);
      spawnAcc += dt * pps;

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

      setDanger(clamp(state.miss / Math.max(1, missLimit), 0, 1), view);

      const fever01 = feverCompute(state, missLimit);
      feverRender(feverUI, fever01);

      hudUpdate(state);

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
            fever: Math.round(fever01 * 100),
            shield: (state.shieldSec>0) ? 1 : 0,
            miniType: state.mini ? state.mini.type : 'none'
          };

          aiLast = ai.update(snap);

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
    setDanger(0, view);

    DOC.body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick');
    if(lowUI.overlay) lowUI.overlay.setAttribute('aria-hidden','true');

    for(const pid of pairMap.keys()){
      pairRemove(pid);
    }

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
      studyId: opts.studyId || null,
      phase: opts.phase || null,
      conditionGroup: opts.conditionGroup || null,
      gameVersion:'gj-2026-01-03B-fx-director',
      startTimeIso: meta.startTimeIso,
      endTimeIso: new Date().toISOString(),
      hub: opts.hub || null,
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}

    emit('hha:end', summary);
    logEvent('end', summary);

    fx.celebrate({ kind:'END', intensity:1.2 });
    fx.toast(`GRADE ${grade}`, 'RESULT');
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
          reason:'pagehide',
          scoreFinal: state.score,
          misses: state.miss,
          durationPlayedSec: state.playedSec,
          gameVersion:'gj-2026-01-03B-fx-director',
          startTimeIso: meta.startTimeIso,
          endTimeIso: new Date().toISOString(),
        }));
      }
    }catch(_){}
  }, { passive:true });
}