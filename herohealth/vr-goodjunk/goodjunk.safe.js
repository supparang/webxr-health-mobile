// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (LATEST) — Storm/Boss/Rage + BossWave + RageDrain + Two-eye + cVR shoot + anti double-hit
// Rules:
//  - timeLeft <= 30s => STORM
//  - miss >= 4 => BOSS
//  - miss >= 5 => RAGE
//  - BossWave: periodic junk waves in boss/rage
//  - RageDrain: if no good hit for a short grace, score drains periodically
//  - TWO-EYE: spawn L/R pair; click either removes both; score counted once
//  - Anti-double: pidHandled set prevents double scoring from double click/shoot

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

/* =========================================================
   ✅ HUD SAFE VAR → px (calc-proof) + spawn bounds
   - This makes --gj-top-safe / --gj-bottom-safe usable even when they are calc(...)
   - Works across Android/Chrome/Samsung/Firefox etc.
========================================================= */
function cssVarPx(name, fallbackPx){
  try{
    const el = DOC.createElement('div');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.width = '0px';
    el.style.height = `var(${name})`;
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    DOC.body.appendChild(el);
    const h = el.getBoundingClientRect().height;
    el.remove();
    if(Number.isFinite(h) && h > 0) return h;
  }catch(_){}
  return Number(fallbackPx)||0;
}

function hudSafeBounds(){
  const W = DOC.documentElement.clientWidth || innerWidth;
  const H = DOC.documentElement.clientHeight || innerHeight;

  const topSafe = Math.max(0, cssVarPx('--gj-top-safe', 140));
  const bottomSafe = Math.max(0, cssVarPx('--gj-bottom-safe', 120));

  const edge = 18;
  const left = edge;
  const right = W - edge;

  // add extra headroom; bottom includes targetPad in spawn clamp too
  const top = Math.min(H - 80, topSafe);
  const bottom = Math.max(top + 80, H - bottomSafe);

  return { W, H, left, right, top, bottom, topSafe, bottomSafe };
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
// Danger warning overlay (VR-safe)
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
function isVRView(view){ return view === 'vr' || view === 'cvr'; }
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
  const overlay = DOC.querySelector('.gj-lowtime-overlay');
  const num = byId('gj-lowtime-num');
  return { overlay, num };
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

  // fallback style
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

    // Boss wave
    bossWaveCd: 0,
    bossWaveLeft: 0,

    // Rage drain
    rageGrace: 0,
    rageDrainAcc: 0,
  };
}

function logEvent(type, payload){ emit('hha:log', { type, ...payload }); }

// -------------------------
// Phase System (storm/boss/rage)
// -------------------------
let __phase = 'normal';

function applyPhaseBody(){
  DOC.body.classList.toggle('gj-storm', __phase === 'storm');
  DOC.body.classList.toggle('gj-boss',  __phase === 'boss');
  DOC.body.classList.toggle('gj-rage',  __phase === 'rage');
}

function computePhase(state){
  if(state.miss >= 5) return 'rage';
  if(state.miss >= 4) return 'boss';
  if(state.timeLeftSec <= 30.0) return 'storm';
  return 'normal';
}

function phaseDifficulty(cfg, state){
  const p = __phase;

  let spawnMul = 1.0;
  let junkAdd  = 0.0;
  let lifeMul  = 1.0;
  let sizeMul  = 1.0;

  if(p === 'storm'){
    spawnMul = 1.12;
    junkAdd  = 0.05;
    lifeMul  = 0.93;
    sizeMul  = 0.98;
  } else if(p === 'boss'){
    spawnMul = 1.20;
    junkAdd  = 0.08;
    lifeMul  = 0.88;
    sizeMul  = 0.97;
  } else if(p === 'rage'){
    spawnMul = 1.28;
    junkAdd  = 0.12;
    lifeMul  = 0.82;
    sizeMul  = 0.95;
  }

  if(state.__view === 'mobile'){
    spawnMul *= 0.93;
    junkAdd  *= 0.75;
    lifeMul  *= 1.06;
    sizeMul  *= 1.02;
  }

  return { spawnMul, junkAdd, lifeMul, sizeMul };
}

// -------------------------
// Boot
// -------------------------
export function boot(opts={}){
  const layer  = byId('gj-layer');
  if(!layer){ console.error('GoodJunkVR: missing #gj-layer'); return; }
  const layerR = byId('gj-layer-r'); // right eye layer

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

  const seed = opts.seed != null ? Number(opts.seed) : (isResearch ? 12345 : Date.now());
  const rng = makeSeededRng(seed);

  const cfg = diffCfg(diff);
  const timeSec = Math.max(20, Number(opts.time)||80) * (cfg.timeMul||1);
  const state = makeInitialState(cfg, { timeSec, rng });
  state.__view = view;

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
    gameVersion:'gj-2026-01-04-storm-boss-rage'
  };
  emit('hha:start', meta);
  logEvent('start', meta);

  if(!isResearch){
    showPracticeHint(state.phase === 'practice');
    ensurePracticeHint().querySelector('.gj-skip').onclick = ()=>{ state.practiceLeft = 0; };
  }

  let ended = false;

  // Pair management
  let pairSeq = 1;
  const pairMap = new Map();     // pid -> { kind, l, r, bornAt, expireT }
  const elToPid = new WeakMap(); // element -> pid
  const pidHandled = new Set();  // ✅ anti double scoring

  function nextPid(){ return String(pairSeq++); }
  function pairRemove(pid){
    const p = pairMap.get(pid);
    if(!p) return;
    pairMap.delete(pid);
    pidHandled.delete(pid);
    if(p.expireT){ try{ clearTimeout(p.expireT); }catch(_){} }
    if(p.l){ try{ removeEl(p.l); }catch(_){} }
    if(p.r){ try{ removeEl(p.r); }catch(_){} }
  }
  function pairFromEl(el){ return el ? elToPid.get(el) : null; }

  function onTargetClick(e){
    const el0 = e?.target;
    if(!el0) return;
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const targetEl = el0.closest ? el0.closest('.gj-target') : el0;
    if(!targetEl || !targetEl.dataset) return;

    const pid = pairFromEl(targetEl) || targetEl.dataset.pid || null;
    if(!pid) return;
    const p = pairMap.get(pid);
    if(!p) return;

    if(pidHandled.has(pid)) return;
    pidHandled.add(pid);

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

      state.rageGrace = 1.2;

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

      state.rageGrace = Math.max(state.rageGrace, 0.6);

      fx.pop(cx, cy, '+18', 'STAR');
      fx.burst(cx, cy, 'gold');

      emit('hha:judge', { type:'good', x: cx, y: cy, reason:'star' });
      emit('hha:score', { score: 18, x: cx, y: cy });

      logEvent('pickup_star', { score: state.score, miss: state.miss });

    } else if(kind === 'shield'){
      state.shieldSec = Math.max(state.shieldSec, 6);
      state.score += 6;

      state.rageGrace = Math.max(state.rageGrace, 0.6);

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

  layer.addEventListener('click', onTargetClick, { passive:false });
  if(layerR) layerR.addEventListener('click', onTargetClick, { passive:false });

  DOC.addEventListener('click', (e)=>{
    const t = e.target && e.target.closest ? e.target.closest('.gj-target') : null;
    if(t) onTargetClick({ target: t });
  }, { passive:false });

  // -------------------------
  // BossWave + RageDrain helpers
  // -------------------------
  function bossWavePlan(){
    const isRage = (__phase === 'rage');
    const gap = isRage
      ? randIn(state.rng, 5.2, 7.4)
      : randIn(state.rng, 6.2, 8.6);
    state.bossWaveCd = gap;

    const n = isRage
      ? (state.rng() < 0.55 ? 3 : 4)
      : (state.rng() < 0.70 ? 2 : 3);

    state.bossWaveLeft = n;

    try{
      emit('hha:judge', { type:'bad', x: innerWidth/2, y: innerHeight*0.18, reason:'wave' });
      fx.toast(isRage ? '🔥 RAGE WAVE!' : '⚔️ BOSS WAVE!', isRage ? 'RAGE' : 'BOSS');
    }catch(_){}
  }

  // -------------------------
  // Spawn
  // -------------------------
  function spawnOne(forceKind=null){
    if(state.phase !== 'practice' && state.phase !== 'play') return;

    const np = computePhase(state);
    if(np !== __phase){
      __phase = np;
      applyPhaseBody();
      if(__phase === 'storm') fx.toast('🌪️ STORM!', 'STORM');
      if(__phase === 'boss')  fx.toast('⚔️ BOSS!', 'BOSS');
      if(__phase === 'rage')  fx.toast('🔥 RAGE!', 'RAGE');
    }

    let kind = forceKind;
    const pd = phaseDifficulty(cfg, state);

    if(!kind){
      const r = state.rng();
      const starP0 = cfg.starP ?? 0.06;
      const shieldP0 = cfg.shieldP ?? 0.05;

      const powerMul = (__phase === 'rage') ? 0.82 : (__phase === 'boss' ? 0.90 : 1.0);
      const shieldP = shieldP0 * powerMul;
      const starP   = starP0   * powerMul;

      if(r < shieldP){
        kind = 'shield';
      } else if(r < shieldP + starP){
        kind = 'star';
      } else {
        const baseJR = (cfg.junkRatio ?? 0.40);
        const aiJR = clamp(baseJR + (state.__aiJunkDelta || 0), 0.18, 0.70);
        const phaseJR = clamp(aiJR + (pd.junkAdd || 0), 0.18, 0.74);
        kind = (state.rng() < phaseJR) ? 'junk' : 'good';
      }
    }

    const pid = nextPid();
    const emoji = pickEmoji(kind, state.rng);

    const elL = createTargetEl(kind, emoji);
    elL.dataset.pid = pid;

    const elR = layerR ? createTargetEl(kind, emoji) : null;
    if(elR) elR.dataset.pid = pid;

    const sizeMul = pd.sizeMul || 1.0;
    const sBase = (kind==='star' || kind==='shield')
      ? randIn(state.rng, 0.95, 1.08)
      : randIn(state.rng, 0.92, 1.18);

    const s = sBase * sizeMul;

    // ✅ HUD-safe bounds (calc-proof) + dynamic padding by target size
    const B = hudSafeBounds();

    const baseSize = (kind==='star' || kind==='shield') ? 46 : 52;
    const approxR = (baseSize * s) * 0.55;
    const pad = Math.max(18, Math.min(60, approxR));

    let x = randIn(state.rng, 0.0, 1.0) * (B.right - B.left) + B.left;
    let y = randIn(state.rng, 0.0, 1.0) * (B.bottom - B.top) + B.top;

    x = clamp(x, B.left + pad, B.right - pad);
    y = clamp(y, B.top  + pad, B.bottom - pad);

    elL.style.left = `${x}px`;
    elL.style.top  = `${y}px`;
    elL.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;

    if(elR){
      elR.style.left = `${x}px`;
      elR.style.top  = `${y}px`;
      elR.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`;
    }

    const mobileMul = (view==='mobile') ? 1.18 : 1.0;

    let lifeMs;
    if(kind==='good') lifeMs = randIn(state.rng, 1500, 2400) * mobileMul;
    else if(kind==='junk') lifeMs = randIn(state.rng, 1300, 2200) * mobileMul;
    else lifeMs = randIn(state.rng, 1200, 2000) * mobileMul;

    lifeMs *= (pd.lifeMul || 1.0);

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

  // cVR shoot (anti spam)
  let __shootLock = 0;
  function pickByCrosshair(lockPx=46){
    const cx = DOC.documentElement.clientWidth * 0.5;
    const cy = DOC.documentElement.clientHeight * 0.5;
    let bestPid = null;
    let bestD2 = lockPx * lockPx;

    for(const [pid, p] of pairMap.entries()){
      const el = p?.l;
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

    const t = nowMs();
    if(t - __shootLock < 85) return;
    __shootLock = t;

    const lock = (view === 'cvr' || view === 'vr') ? 58 : 46;
    const pid = pickByCrosshair(lock);
    if(!pid) return;
    const p = pairMap.get(pid);
    const el = p?.l;
    if(!el) return;
    onTargetClick({ target: el });
  }
  ROOT.addEventListener('hha:shoot', shoot, { passive:true });

  // pacing
  let lastTick = nowMs();
  let spawnAcc = 0;
  let lastLowSec = 999;

  // init wave timers
  state.bossWaveCd = 4.2;
  state.bossWaveLeft = 0;

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

      const pps0 = (cfg.spawnPps || 2.0);
      const pps = (view==='mobile') ? (pps0 * 0.85) : (pps0 * 0.95);
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

        state.bossWaveCd = 4.2;
        state.bossWaveLeft = 0;
        state.rageGrace = 0;
        state.rageDrainAcc = 0;

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

      const np = computePhase(state);
      if(np !== __phase){
        __phase = np;
        applyPhaseBody();
        if(__phase === 'storm') fx.toast('🌪️ STORM!', 'STORM');
        if(__phase === 'boss')  fx.toast('⚔️ BOSS!', 'BOSS');
        if(__phase === 'rage')  fx.toast('🔥 RAGE!', 'RAGE');
      }

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

      if(__phase === 'boss' || __phase === 'rage'){
        state.bossWaveCd = Math.max(0, (state.bossWaveCd || 0) - dt);
        if(state.bossWaveCd <= 0 && (state.bossWaveLeft || 0) <= 0){
          bossWavePlan();
        }
        if((state.bossWaveLeft || 0) > 0){
          state.burstQueue = Math.max(state.burstQueue, 1);
          if(state.burstCooldown <= 0.01){
            state.bossWaveLeft = Math.max(0, state.bossWaveLeft - 1);
          }
        }
      }

      const basePps = (cfg.spawnPps || 2.0);
      const aiApply = (qs('aiApply','0') === '1');
      const mulAi = (aiApply && !isResearch) ? (state.__aiSpawnMul || 1.0) : 1.0;

      const pd = phaseDifficulty(cfg, state);
      const mulPhase = pd.spawnMul || 1.0;

      const pps = (view==='mobile')
        ? (basePps * 0.90 * mulAi * mulPhase)
        : (basePps * mulAi * mulPhase);

      spawnAcc += dt * pps;

      if(state.burstQueue > 0){
        state.burstCooldown = Math.max(0, state.burstCooldown - dt);
        if(state.burstCooldown <= 0){
          const force = ((state.bossWaveLeft || 0) > 0) ? 'junk' : null;
          spawnOne(force);
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

      if(__phase === 'rage'){
        state.rageGrace = Math.max(0, (state.rageGrace || 0) - dt);
        if(state.rageGrace <= 0){
          state.rageDrainAcc = (state.rageDrainAcc || 0) + dt;
          const period = 0.85;
          while(state.rageDrainAcc >= period){
            state.rageDrainAcc -= period;
            state.score = Math.max(0, state.score - 2);
            state.combo = 0;

            emit('hha:judge', { type:'bad', x: innerWidth/2, y: innerHeight*0.22, reason:'rage-drain' });
            emit('hha:score', { score: -2, x: innerWidth/2, y: innerHeight*0.22 });
            fx.pop(innerWidth/2, innerHeight*0.22, '-2', 'RAGE');

            logEvent('rage_drain', { score: state.score });
          }
        }
      }

      setDanger(clamp(state.miss / Math.max(1, missLimit), 0, 1), view);

      const fever01 = feverCompute(state, missLimit);
      feverRender(feverUI, fever01);

      hudUpdate(state);

      if(state.miss >= missLimit){
        endGame('missLimit');
        return;
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

    state.rageGrace = 0;
    state.rageDrainAcc = 0;

    DOC.body.classList.remove('gj-lowtime','gj-lowtime5','gj-tick','gj-storm','gj-boss','gj-rage');
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
      gameVersion:'gj-2026-01-04-storm-boss-rage',
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
          gameVersion:'gj-2026-01-04-storm-boss-rage',
          startTimeIso: meta.startTimeIso,
          endTimeIso: new Date().toISOString(),
        }));
      }
    }catch(_){}
  }, { passive:true });
}