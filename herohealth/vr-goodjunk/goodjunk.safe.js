// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard (DUAL-EYE READY) — v3 (Stage-Rect + Boss + FX + EndSummary)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){} }
function qs(name, def){ try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; } }

function xmur3(str){
  str = String(str || '');
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seed){
  const g = xmur3(String(seed || 'seed'));
  return sfc32(g(), g(), g(), g());
}
function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

function isMobileLike(){
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { burstAt(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { set(){}, setShield(){} };

async function flushLogger(reason){
  emit('hha:flush', { reason: String(reason||'flush') });
  const fns = [];
  try{ if (ROOT.HHA_CLOUD_LOGGER && typeof ROOT.HHA_CLOUD_LOGGER.flush === 'function') fns.push(ROOT.HHA_CLOUD_LOGGER.flush.bind(ROOT.HHA_CLOUD_LOGGER)); }catch(_){}
  try{ if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.flush === 'function') fns.push(ROOT.HHACloudLogger.flush.bind(ROOT.HHACloudLogger)); }catch(_){}
  try{ if (ROOT.GAME_MODULES && ROOT.GAME_MODULES.CloudLogger && typeof ROOT.GAME_MODULES.CloudLogger.flush === 'function') fns.push(ROOT.GAME_MODULES.CloudLogger.flush.bind(ROOT.GAME_MODULES.CloudLogger)); }catch(_){}
  try{ if (typeof ROOT.hhaFlush === 'function') fns.push(ROOT.hhaFlush.bind(ROOT)); }catch(_){}
  const tasks = fns.map(fn=>{
    try{
      const r = fn({ reason:String(reason||'flush') });
      return (r && typeof r.then === 'function') ? r : Promise.resolve();
    }catch(_){ return Promise.resolve(); }
  });
  await Promise.race([ Promise.all(tasks), new Promise(res=>setTimeout(res, 280)) ]);
}

function logEvent(type, data){
  emit('hha:log_event', { type, data: data || {} });
  try{ if (typeof ROOT.hhaLogEvent === 'function') ROOT.hhaLogEvent(type, data||{}); }catch(_){}
}

function rankFromAcc(acc){
  if (acc >= 95) return 'SSS';
  if (acc >= 90) return 'SS';
  if (acc >= 85) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  return 'C';
}
function diffBase(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2300, size: 1.10, junk: 0.12, power: 0.035, maxT: 7, bossNeed: 6 };
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1650, size: 0.95, junk: 0.18, power: 0.025, maxT: 9, bossNeed: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.02, junk: 0.15, power: 0.030, maxT: 8, bossNeed: 8 };
}

/* -------------------- UI + Styles injection -------------------- */
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    /* FX overlay (fever vignette + subtle film) */
    #gj-stage::before{
      content:"";
      position:absolute; inset:-2px;
      pointer-events:none;
      opacity:0;
      transition: opacity 180ms ease;
      background:
        radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,.10) 55%, rgba(0,0,0,.35) 100%),
        radial-gradient(circle at 50% 55%, rgba(239,68,68,.16) 0%, rgba(239,68,68,0) 55%);
      mix-blend-mode: screen;
      z-index: 25;
    }
    body.fever-mid #gj-stage::before{ opacity:.55; }
    body.fever-high #gj-stage::before{ opacity:.85; }

    /* stage shake */
    #gj-stage.shake{
      animation: gjShake 140ms linear 1;
    }
    @keyframes gjShake{
      0%{ transform: translate(0,0); }
      20%{ transform: translate(-2px, 1px); }
      40%{ transform: translate(2px, -1px); }
      60%{ transform: translate(-2px, -1px); }
      80%{ transform: translate(2px, 1px); }
      100%{ transform: translate(0,0); }
    }

    /* layers */
    .gj-layer{
      position:absolute; inset:0;
      z-index:30;
      pointer-events:auto !important;
      touch-action:none;
    }

    .gj-target{
      position:absolute;
      transform: translate(-50%,-50%) scale(var(--s, 1));
      width: 74px; height: 74px;
      border-radius: 999px;
      display:flex; align-items:center; justify-content:center;
      font-size: 38px; line-height:1;
      user-select:none; -webkit-user-select:none;
      pointer-events:auto !important;
      touch-action: manipulation;
      background: rgba(2,6,23,.55);
      border: 1px solid rgba(148,163,184,.22);
      box-shadow: 0 16px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04) inset;
      backdrop-filter: blur(8px);
      will-change: transform, opacity;
    }
    .gj-target.good{ border-color: rgba(34,197,94,.30); }
    .gj-target.junk{ border-color: rgba(239,68,68,.34); filter: saturate(1.15); }
    .gj-target.star{ border-color: rgba(34,211,238,.36); }
    .gj-target.shield{ border-color: rgba(168,85,247,.36); }

    /* boss */
    .gj-target.boss{
      width: 112px; height: 112px;
      font-size: 56px;
      border-width: 2px;
      box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset;
    }
    .gj-target.boss.good{ border-color: rgba(34,197,94,.48); }
    .gj-target.boss.junk{ border-color: rgba(239,68,68,.52); }
    .gj-target.boss::after{
      content:"";
      position:absolute; inset:-8px;
      border-radius: 999px;
      border: 2px dashed rgba(34,197,94,.30);
      opacity:.35;
      pointer-events:none;
      animation: bossSpin 1.2s linear infinite;
    }
    .gj-target.boss.junk::after{
      border-color: rgba(239,68,68,.30);
    }
    @keyframes bossSpin{ from{ transform: rotate(0deg); } to{ transform: rotate(360deg); } }

    .gj-target.hit{
      transform: translate(-50%,-50%) scale(calc(var(--s,1) * 1.25));
      opacity:.18; filter: blur(.7px);
      transition: transform 120ms ease, opacity 120ms ease, filter 120ms ease;
    }
    .gj-target.out{
      opacity:0;
      transform: translate(-50%,-50%) scale(calc(var(--s,1) * 0.85));
      transition: transform 140ms ease, opacity 140ms ease;
    }

    /* end summary */
    #end-summary{
      position:fixed;
      inset:0;
      display:none;
      align-items:center;
      justify-content:center;
      z-index:140;
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(10px);
      padding: 18px;
    }
    #end-summary.show{ display:flex; }
    .gj-end-card{
      width: min(720px, 94vw);
      background: rgba(2,6,23,.86);
      border: 1px solid rgba(148,163,184,.22);
      border-radius: 22px;
      box-shadow: 0 20px 70px rgba(0,0,0,.55);
      padding: 16px;
    }
    .gj-end-title{
      font-weight: 1100;
      font-size: 22px;
      letter-spacing: .2px;
    }
    .gj-end-sub{
      margin-top: 6px;
      color: rgba(229,231,235,.80);
      font-weight: 900;
      font-size: 13px;
    }
    .gj-end-grid{
      margin-top: 12px;
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .gj-end-item{
      background: rgba(15,23,42,.60);
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 16px;
      padding: 10px 12px;
    }
    .gj-end-k{
      color: rgba(148,163,184,.95);
      font-weight: 900;
      font-size: 12px;
    }
    .gj-end-v{
      margin-top: 2px;
      font-weight: 1100;
      font-size: 20px;
    }
    .gj-end-actions{
      margin-top: 12px;
      display:flex;
      flex-wrap:wrap;
      gap: 10px;
    }
    .gj-end-btn{
      flex:1;
      min-width: 160px;
      height: 50px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.70);
      color: #e5e7eb;
      font-weight: 1100;
      cursor: pointer;
    }
    .gj-end-btn.primary{
      border-color: rgba(34,197,94,.35);
      background: rgba(34,197,94,.18);
      color: #eafff3;
    }
    .gj-end-btn:active{ transform: translateY(1px); }
  `;
  DOC.head.appendChild(st);
}

/* -------------------- Spawn geometry (IMPORTANT FIX) -------------------- */
function buildAvoidRects(){
  const DOC = ROOT.document;
  const rects = [];
  if (!DOC) return rects;

  const els = [
    DOC.querySelector('.hud-top'),
    DOC.querySelector('.hud-mid'),
    DOC.querySelector('.hha-controls'),
    DOC.getElementById('hhaFever')
  ].filter(Boolean);

  for (const el of els){
    try{
      const r = el.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) rects.push(r);
    }catch(_){}
  }
  return rects;
}
function pointInRect(x, y, r){
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function inflateRect(r, pad=8){
  return { left:r.left-pad, right:r.right+pad, top:r.top-pad, bottom:r.bottom+pad };
}

function getStageRect(DOC){
  const stage = DOC.getElementById('gj-stage');
  if (stage){
    try{
      const r = stage.getBoundingClientRect();
      if (r && r.width > 40 && r.height > 40) return r;
    }catch(_){}
  }
  const W = ROOT.innerWidth || 360, H = ROOT.innerHeight || 640;
  return { left:0, top:0, right:W, bottom:H, width:W, height:H };
}
function getEyeRects(DOC, dual){
  const stageR = getStageRect(DOC);
  if (!dual) return { stageR, eyeL: stageR, eyeR: null };
  const eyeLel = DOC.getElementById('eyeL');
  const eyeRel = DOC.getElementById('eyeR');
  try{
    const rL = eyeLel ? eyeLel.getBoundingClientRect() : null;
    const rR = eyeRel ? eyeRel.getBoundingClientRect() : null;
    if (rL && rR && rL.width > 20 && rR.width > 20) return { stageR, eyeL: rL, eyeR: rR };
  }catch(_){}
  // fallback split from stage
  const mid = stageR.left + stageR.width/2;
  const eyeL = { left:stageR.left, top:stageR.top, right:mid, bottom:stageR.bottom, width:mid-stageR.left, height:stageR.bottom-stageR.top };
  const eyeR = { left:mid, top:stageR.top, right:stageR.right, bottom:stageR.bottom, width:stageR.right-mid, height:stageR.bottom-stageR.top };
  return { stageR, eyeL, eyeR };
}

function safeInnerRect(baseRect, margins){
  const m = margins || {};
  let left = baseRect.left + (m.left ?? 12);
  let right = baseRect.right - (m.right ?? 12);
  let top = baseRect.top + (m.top ?? 12);
  let bottom = baseRect.bottom - (m.bottom ?? 12);

  // prevent collapse
  if ((right - left) < 180){
    const mid = (left + right) * 0.5;
    left = mid - 90;
    right = mid + 90;
  }
  if ((bottom - top) < 220){
    const mid = (top + bottom) * 0.5;
    top = mid - 110;
    bottom = mid + 110;
  }
  return { left, right, top, bottom };
}

function stereoPick(rng, eyeL, eyeR, margins, avoidRects){
  const L = safeInnerRect(eyeL, margins);
  const R = safeInnerRect(eyeR, margins);
  const avoid = (avoidRects||[]).map(r=>inflateRect(r, 10));

  for (let i=0;i<22;i++){
    const u = rng(); // 0..1
    const v = rng();
    const gxL = L.left + u * (L.right - L.left);
    const gxR = R.left + u * (R.right - R.left);
    const gy  = L.top  + v * (L.bottom - L.top);

    let ok = true;
    for (const rr of avoid){
      if (pointInRect(gxL, gy, rr) || pointInRect(gxR, gy, rr)){ ok = false; break; }
    }
    if (ok){
      return {
        gxL, gxR, gy,
        lx: gxL - eyeL.left, ly: gy - eyeL.top,
        rx: gxR - eyeR.left, ry: gy - eyeR.top
      };
    }
  }
  // fallback
  const u = rng(), v = rng();
  const gxL = L.left + u * (L.right - L.left);
  const gxR = R.left + u * (R.right - R.left);
  const gy  = L.top  + v * (L.bottom - L.top);
  return {
    gxL, gxR, gy,
    lx: gxL - eyeL.left, ly: gy - eyeL.top,
    rx: gxR - eyeR.left, ry: gy - eyeR.top
  };
}

/* -------------------- Target helpers -------------------- */
const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';
const BOSS_GOOD = ['🍉','🥗','🥦','🍓'];
const BOSS_JUNK = ['🍔','🍕','🍟','🧋'];

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.left = px;
  el.style.top  = py;
  el.style.setProperty('--x', px);
  el.style.setProperty('--y', py);
}
function countTargets(layerEl){
  try{ return layerEl.querySelectorAll('.gj-target').length; }catch(_){ return 0; }
}
function getCenter(el){
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){
    return { x: (ROOT.innerWidth||360)*0.5, y: (ROOT.innerHeight||640)*0.5 };
  }
}
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}
function findTargetNear(layerEl, cx, cy, radiusPx){
  const r2max = radiusPx * radiusPx;
  const list = layerEl.querySelectorAll('.gj-target');
  let best = null, bestD2 = 1e18;
  list.forEach(el=>{
    try{
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top + r.height/2;
      const d2 = dist2(cx, cy, tx, ty);
      if (d2 <= r2max && d2 < bestD2){ best = el; bestD2 = d2; }
    }catch(_){}
  });
  return best;
}
function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}
function applyFeverFX(DOC, fever){
  const b = DOC.body;
  const f = clamp(fever, 0, 100);
  b.classList.toggle('fever-mid', f >= 45);
  b.classList.toggle('fever-high', f >= 72);
}
function shakeStage(DOC, strength=1){
  const stage = DOC.getElementById('gj-stage');
  if (!stage) return;
  stage.classList.remove('shake');
  // reflow-ish
  void stage.offsetWidth;
  stage.classList.add('shake');
  if (strength >= 2){
    // extra shake pulse
    setTimeout(()=>{ try{ stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }catch(_){ } }, 90);
  }
  setTimeout(()=>{ try{ stage.classList.remove('shake'); }catch(_){ } }, 220);
}

function makeSummary(S, reason){
  const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
  return {
    reason: String(reason||'end'),
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    goalsCleared: S.goalsCleared|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0,
    nHitGood: S.hitGood|0,
    nHitJunk: S.hitJunk|0,
    nHitJunkGuard: S.hitJunkGuard|0,
    nExpireGood: S.expireGood|0,
    nHitAll: S.hitAll|0,
    accuracyGoodPct: acc|0,
    grade: rankFromAcc(acc),
    feverEnd: Math.round(S.fever)|0,
    shieldEnd: S.shield|0,
    diff: S.diff,
    runMode: S.runMode,
    seed: S.seed,
    bossHits: S.bossHits|0,
    bossNeed: S.bossNeed|0,
    durationPlayedSec: Math.round((now() - S.tStart)/1000)
  };
}
async function flushAll(summary, reason){
  try{
    if (summary){
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('hha_last_summary', JSON.stringify(summary));
    }
  }catch(_){}
  await flushLogger(reason || (summary?.reason) || 'flush');
}

/* -------------------- End Summary UI -------------------- */
function showEndSummary(DOC, summary){
  const box = DOC.getElementById('end-summary');
  if (!box) return;

  const hub = String(qs('hub','') || '');
  const canBack = !!hub;

  const acc = summary?.accuracyGoodPct ?? 0;
  const grade = summary?.grade ?? '—';

  box.innerHTML = `
    <div class="gj-end-card" role="dialog" aria-label="end summary">
      <div class="gj-end-title">สรุปผล GoodJunkVR • เกรด ${grade}</div>
      <div class="gj-end-sub">Accuracy ${acc}% • Miss ${summary?.misses ?? 0} • Boss ${summary?.bossHits ?? 0}/${summary?.bossNeed ?? 0}</div>

      <div class="gj-end-grid">
        <div class="gj-end-item"><div class="gj-end-k">Score</div><div class="gj-end-v">${summary?.scoreFinal ?? 0}</div></div>
        <div class="gj-end-item"><div class="gj-end-k">Max Combo</div><div class="gj-end-v">${summary?.comboMax ?? 0}</div></div>
        <div class="gj-end-item"><div class="gj-end-k">Good Hits</div><div class="gj-end-v">${summary?.nHitGood ?? 0}</div></div>
        <div class="gj-end-item"><div class="gj-end-k">Junk Hits</div><div class="gj-end-v">${summary?.nHitJunk ?? 0}</div></div>
      </div>

      <div class="gj-end-actions">
        <button class="gj-end-btn primary" id="btnPlayAgain" type="button">เล่นอีกครั้ง</button>
        <button class="gj-end-btn" id="btnCopyJson" type="button">Copy JSON</button>
        <button class="gj-end-btn" id="btnBackHub" type="button" ${canBack ? '' : 'disabled'}>กลับ HUB</button>
      </div>
    </div>
  `;
  box.classList.add('show');

  const btnAgain = DOC.getElementById('btnPlayAgain');
  const btnCopy  = DOC.getElementById('btnCopyJson');
  const btnHub   = DOC.getElementById('btnBackHub');

  btnAgain && btnAgain.addEventListener('click', ()=>{ ROOT.location.reload(); });

  btnCopy && btnCopy.addEventListener('click', async ()=>{
    try{
      const txt = JSON.stringify(summary || {}, null, 2);
      await navigator.clipboard.writeText(txt);
      emit('hha:judge', { kind:'good', text:'คัดลอก JSON แล้ว!' });
    }catch(_){
      // fallback: prompt
      try{ prompt('Copy JSON', JSON.stringify(summary||{})); }catch(__){}
    }
  });

  btnHub && btnHub.addEventListener('click', ()=>{
    if (!hub) return;
    ROOT.location.href = hub;
  });
}

/* -------------------- Engine -------------------- */
export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerL = opts.layerEl
    || DOC.getElementById('gj-layer-l')
    || DOC.getElementById('gj-layer')
    || DOC.querySelector('.gj-layer');

  const layerR = opts.layerElR
    || DOC.getElementById('gj-layer-r')
    || null;

  const crossL = opts.crosshairEl
    || DOC.getElementById('gj-crosshair-l')
    || DOC.getElementById('gj-crosshair')
    || DOC.querySelector('.gj-crosshair');

  const crossR = opts.crosshairElR
    || DOC.getElementById('gj-crosshair-r')
    || null;

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');

  if (!layerL){
    console.warn('[GoodJunkVR] missing layer (gj-layer-l / gj-layer)');
    return;
  }

  const dual = !!layerR;

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase(); // time|all|miss
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};
  const base = diffBase(diff);

  const S = {
    running:false, ended:false, flushed:false,
    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,
    tStart:0, left: timeSec,
    score:0, combo:0, comboMax:0,
    misses:0, hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,

    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,

    warmupUntil:0,
    spawnTimer:0, tickTimer:0,
    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,
    uidSeq: 1,

    // boss
    bossActive:false,
    bossPhase:0,
    bossHits:0,
    bossNeed: base.bossNeed,
    bossStartedAt:0,

    // rect cache
    rects:null,
    rectCacheUntil:0
  };

  // mild mobile tuning
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.15, S.size + 0.04);
  }

  function coach(mood, text, sub){
    emit('hha:coach', { mood: mood || 'neutral', text: String(text||''), sub: sub ? String(sub) : undefined });
  }
  function judge(kind, text){
    emit('hha:judge', { kind: kind || 'info', text: String(text||'') });
  }
  function updateScore(){
    emit('hha:score', { score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0 });
    const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); }

  function updateQuest(extraMiniTitle=null){
    // dynamic mini text
    let miniTitle = extraMiniTitle || `Mini: คอมโบมาแล้ว!`;
    let miniNow = S.miniCleared, miniTotal = S.miniTotal;

    if (S.bossActive){
      miniTitle = `BOSS: ต่อยบอสให้ครบ ${S.bossHits}/${S.bossNeed}`;
      miniNow = S.bossHits;
      miniTotal = S.bossNeed;
    }

    emit('quest:update', {
      goalTitle: `Goal: เก็บของดีให้ครบ`,
      goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle,
      miniNow, miniTotal,
      miniLeftMs: 0
    });
    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
  }

  function getRects(){
    const t = now();
    if (S.rects && t < S.rectCacheUntil) return S.rects;

    const avoid = buildAvoidRects();
    const { stageR, eyeL, eyeR } = getEyeRects(DOC, dual);
    S.rects = { stageR, eyeL, eyeR, avoid };
    S.rectCacheUntil = t + 520; // refresh twice per second
    return S.rects;
  }

  function getMate(el){
    if (!dual || !el) return null;
    const uid = el.dataset.uid;
    if (!uid) return null;
    const inR = el.parentElement === layerR;
    const mate = inR
      ? layerL.querySelector(`.gj-target[data-uid="${uid}"]`)
      : layerR.querySelector(`.gj-target[data-uid="${uid}"]`);
    return mate || null;
  }

  function removeTargetBoth(el){
    if (!el) return;
    try{ clearTimeout(el._ttl); }catch(_){}
    el.classList.add('hit');
    const mate = getMate(el);
    if (mate){
      try{ clearTimeout(mate._ttl); }catch(_){}
      mate.classList.add('hit');
      setTimeout(()=>{ try{ mate.remove(); }catch(_){ } }, 140);
    }
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 140);
  }

  function expireTargetBoth(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');

    // boss: don't expire too easily; but still can
    const isBoss = el.classList.contains('boss');

    if (tp === 'good'){
      S.misses++; S.expireGood++; S.combo = 0;
      S.fever = clamp(S.fever + (isBoss ? 10 : 7), 0, 100);
      updateFever(S.shield, S.fever);
      applyFeverFX(DOC, S.fever);
      shakeStage(DOC, (S.fever>=72)?2:1);

      judge('warn', isBoss ? 'MISS BOSS!' : 'MISS (หมดเวลา)!');
      updateScore(); updateQuest();
      logEvent('miss_expire', { kind:'good', boss:isBoss ? 1 : 0, emoji: String(el.dataset.emoji||'') });
    }

    el.classList.add('out');
    const mate = getMate(el);
    if (mate) mate.classList.add('out');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      if (mate){ try{ mate.remove(); }catch(_){ } }
    }, 160);
  }

  function makeTarget(type, emoji, x, y, s, uid, boss=false){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}` + (boss ? ' boss' : '');
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = boss ? '40' : '30';

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    // TTL
    const ttl = boss ? Math.max(900, S.ttlMs + 220) : S.ttlMs;
    el._ttl = setTimeout(()=> expireTargetBoth(el), ttl);

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitTarget(el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function burstAtEl(el, kind){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || el.dataset.type || '');
    }catch(_){}
  }

  function scoreGood(multBase=90){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(multBase * mult);
    S.score += pts;
    return pts;
  }

  function maybeStartBoss(){
    if (S.bossActive || S.ended) return;
    // start boss at ~last 18 sec (or last 22 sec if hard)
    const startAt = (diff === 'hard') ? 22 : 18;
    if (S.left <= startAt){
      S.bossActive = true;
      S.bossPhase = 1;
      S.bossHits = 0;
      S.bossStartedAt = now();
      coach('neutral', 'บอสมาแล้ว! 😈', `ตีบอส (ของดี) ให้ครบ ${S.bossNeed} ครั้ง ห้ามโดนบอสขยะ!`);
      emit('hha:celebrate', { kind:'mini', title:'BOSS PHASE!' });
      updateQuest();
      logEvent('boss_start', { need:S.bossNeed, left:S.left|0 });
    }
  }

  function bossRageLevel(){
    if (!S.bossActive) return 0;
    const t = (now() - S.bossStartedAt) / 1000;
    // phase2 after 6 sec OR when hits >= 60%
    if (S.bossPhase === 1 && (t >= 6 || S.bossHits >= Math.ceil(S.bossNeed*0.6))){
      S.bossPhase = 2;
      coach('happy', 'บอสคลั่งแล้ว! 🔥', 'เร็วขึ้น + โหดขึ้น ระวังขยะ!');
      emit('hha:celebrate', { kind:'mini', title:'RAGE MODE' });
      logEvent('boss_phase2', { t:Math.round(t*10)/10, hits:S.bossHits });
    }
    return (S.bossPhase === 2) ? 1 : 0;
  }

  function hitGood(el){
    const isBoss = el.classList.contains('boss');
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - (isBoss ? 3.2 : 2.2), 0, 100);
    updateFever(S.shield, S.fever);
    applyFeverFX(DOC, S.fever);

    const pts = scoreGood(isBoss ? 140 : 90);
    judge('good', `+${pts}`);
    burstAtEl(el, isBoss ? 'star' : 'good');

    if (isBoss && S.bossActive){
      S.bossHits++;
      judge('good', `BOSS +1  (${S.bossHits}/${S.bossNeed})`);
      updateQuest();
      if (S.bossHits >= S.bossNeed){
        emit('hha:celebrate', { kind:'end', title:'ชนะบอส!' });
        coach('happy', 'ชนะบอสแล้ว! 🏆', 'สุดยอด!');
        endGame('boss_win');
        removeTargetBoth(el);
        return;
      }
    }

    logEvent('hit', { kind:'good', boss:isBoss?1:0, emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    if (!S.bossActive) updateQuest();

    // mini via combo ladder (only before boss)
    if (!S.bossActive && S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2);
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! +${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! ดีมาก 🔥`, `ทำคอมโบต่อได้อีก!`);
        updateQuest();
      }
    }

    // goals via good count (only before boss)
    if (!S.bossActive && S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8);
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', `Goal ผ่านแล้ว!`, `คุมความแม่น + หลีกขยะ`);
        updateQuest();
        if (endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
          endGame('all_complete');
        }
      }
    }

    removeTargetBoth(el);
  }

  function hitShield(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    S.score += 70;
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    burstAtEl(el, 'shield');
    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore(); if (!S.bossActive) updateQuest();
    removeTargetBoth(el);
  }

  function hitStar(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 140;
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    burstAtEl(el, 'star');
    logEvent('hit', { kind:'star', emoji:String(el.dataset.emoji||'⭐') });

    updateScore(); if (!S.bossActive) updateQuest();
    removeTargetBoth(el);
  }

  function hitJunk(el){
    const isBoss = el.classList.contains('boss');
    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', boss:isBoss?1:0, emoji:String(el.dataset.emoji||'') });

      updateScore(); if (!S.bossActive) updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++; S.misses++; S.combo = 0;

    const penalty = isBoss ? 260 : 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + (isBoss ? 18 : 12), 0, 100);
    updateFever(S.shield, S.fever);
    applyFeverFX(DOC, S.fever);
    shakeStage(DOC, (isBoss || S.fever>=72) ? 2 : 1);

    judge('bad', isBoss ? `BOSS JUNK! -${penalty}` : `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', boss:isBoss?1:0, emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore(); if (!S.bossActive) updateQuest();
    removeTargetBoth(el);

    // optional: end by miss
    if (endPolicy === 'miss'){
      const missLimit = (diff === 'easy') ? 10 : (diff === 'hard') ? 7 : 8;
      if (S.misses >= missLimit){
        endGame('miss_limit');
      }
    }
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
  }

  function spawnOne(){
    if (!S.running || S.ended) return;

    // during boss: allow fewer total targets but bigger boss
    const maxT = S.bossActive ? Math.max(5, Math.min(S.maxTargets, 7)) : S.maxTargets;
    if (countTargets(layerL) >= maxT) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);
    const { eyeL, eyeR, avoid } = getRects();

    // boss logic
    maybeStartBoss();
    const rage = bossRageLevel();

    let tp = 'good';
    let boss = false;

    if (S.bossActive){
      boss = true;
      // boss: mostly boss-good with some boss-junk
      const r = S.rng();
      const junkBossP = clamp((diff==='hard'?0.32:0.26) + rage*0.10, 0.18, 0.45);
      tp = (r < junkBossP) ? 'junk' : 'good';
    } else {
      const r = S.rng();
      const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
      const junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

      if (r < powerP) tp = 'shield';
      else if (r < powerP + 0.035) tp = 'star';
      else if (r < powerP + 0.035 + junkP) tp = 'junk';
      else tp = 'good';
    }

    const uid = String(S.uidSeq++);

    // size
    let size = (inWarm ? (S.size * 1.06) : S.size);
    if (S.bossActive) size = clamp((diff==='hard'?1.04:1.08) - rage*0.05, 0.92, 1.12);

    const emoji =
      (S.bossActive && tp === 'good') ? pick(S.rng, BOSS_GOOD) :
      (S.bossActive && tp === 'junk') ? pick(S.rng, BOSS_JUNK) :
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'star') ? pick(S.rng, STARS) :
      SHIELD;

    const s =
      boss ? (size * 1.10) :
      (tp === 'junk') ? (size * 0.98) :
      (tp === 'shield') ? (size * 1.03) :
      (tp === 'star') ? (size * 1.02) :
      size;

    if (dual && eyeR){
      const pos = stereoPick(S.rng, eyeL, eyeR, { top: 10, bottom: 10, left: 10, right: 10 }, avoid);
      const elL = makeTarget(tp, emoji, pos.lx, pos.ly, s, uid, boss);
      layerL.appendChild(elL);
      const elR = makeTarget(tp, emoji, pos.rx, pos.ry, s, uid, boss);
      layerR.appendChild(elR);
    } else {
      // single eye: use eyeL rect as base; convert to local via subtract left/top
      const rr = safeInnerRect(eyeL, { top:10, bottom:10, left:10, right:10 });
      let gx = rr.left + S.rng()*(rr.right-rr.left);
      let gy = rr.top  + S.rng()*(rr.bottom-rr.top);

      // avoid HUD/controls even in single mode
      const avoid2 = (avoid||[]).map(r=>inflateRect(r, 10));
      for (let i=0;i<16;i++){
        let ok = true;
        for (const a of avoid2){ if (pointInRect(gx, gy, a)){ ok=false; break; } }
        if (ok) break;
        gx = rr.left + S.rng()*(rr.right-rr.left);
        gy = rr.top  + S.rng()*(rr.bottom-rr.top);
      }

      const elL = makeTarget(tp, emoji, gx - eyeL.left, gy - eyeL.top, s, uid, boss);
      layerL.appendChild(elL);
    }

    logEvent('spawn', { kind:tp, boss:boss?1:0, emoji:String(emoji||''), uid });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    spawnOne();

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let nextMs = S.spawnMs;

    if (S.bossActive){
      const rage = bossRageLevel();
      nextMs = clamp((diff==='hard'?520:580) - rage*120, 360, 900);
    } else if (inWarm){
      nextMs = Math.max(980, S.spawnMs + 240);
    }

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 320, 1400));
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    // time
    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    if (S.left <= 0){ endGame('time'); return; }

    // boss triggers late
    maybeStartBoss();

    if (S.runMode === 'play' && !S.bossActive){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.65) * 1.2 + comboHeat * 0.8, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.75, 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * 320, 420, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.18);
      S.junkP   = clamp(base.junk    + heat * 0.07, 0.08, 0.25);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

      // fairness: high fever → slightly reduce junk and slightly bigger targets
      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.22);
        S.size  = clamp(S.size + 0.03, 0.86, 1.22);
      }
    } else if (!S.bossActive) {
      // research fixed
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    } else {
      // boss keeps its own pacing (handled in loopSpawn), but we still clamp TTL a bit
      const rage = bossRageLevel();
      S.ttlMs = clamp((diff==='hard'?1300:1500) - rage*160, 980, 2000);
    }

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const radius = isMobileLike() ? 66 : 54;

    const cL = crossL ? getCenter(crossL) : { x:(ROOT.innerWidth||360)*0.5, y:(ROOT.innerHeight||640)*0.5 };
    const el1 = findTargetNear(layerL, cL.x, cL.y, radius);
    let best = el1, bestD2 = 1e18;

    if (best){
      const cc = getCenter(best);
      bestD2 = dist2(cL.x, cL.y, cc.x, cc.y);
    }

    if (dual && layerR && crossR){
      const cR = getCenter(crossR);
      const el2 = findTargetNear(layerR, cR.x, cR.y, radius);
      if (el2){
        const cc = getCenter(el2);
        const d2 = dist2(cR.x, cR.y, cc.x, cc.y);
        if (!best || d2 < bestD2){ best = el2; bestD2 = d2; }
      }
    }

    if (best) hitTarget(best);
    else { if (S.combo > 0) S.combo = Math.max(0, S.combo - 1); updateScore(); }
  }

  function bindInputs(){
    if (shootEl){
      shootEl.addEventListener('click', (e)=>{ e.preventDefault?.(); shootAtCrosshair(); });
      shootEl.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); }, { passive:false });
    }

    DOC.addEventListener('keydown', (e)=>{
      const k = String(e.key||'').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){
        e.preventDefault?.();
        shootAtCrosshair();
      }
    });

    const stage = DOC.getElementById('gj-stage');
    if (stage){
      stage.addEventListener('click', ()=>{
        if (isMobileLike()) return;
        shootAtCrosshair();
      });
    }
  }

  function bindFlushHard(){
    ROOT.addEventListener('pagehide', ()=>{ try{ flushAll(makeSummary(S, 'pagehide'), 'pagehide'); }catch(_){} }, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){ try{ flushAll(makeSummary(S, 'hidden'), 'hidden'); }catch(_){} }
    }, { passive:true });
  }

  function clearAllTargets(){
    const kill = (layer)=>{
      if (!layer) return;
      try{
        layer.querySelectorAll('.gj-target').forEach(el=>{
          try{ clearTimeout(el._ttl); }catch(_){}
          try{ el.remove(); }catch(_){}
        });
      }catch(_){}
    };
    kill(layerL);
    if (dual) kill(layerR);
  }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    clearTimers();
    clearAllTargets();

    const summary = makeSummary(S, reason);
    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');

    showEndSummary(DOC, summary);
  }

  function start(){
    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.left = timeSec;

    S.score = 0; S.combo = 0; S.comboMax = 0;
    S.misses = 0; S.hitAll = 0; S.hitGood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireGood = 0;
    S.fever = 0; S.shield = 0;
    updateFever(S.shield, S.fever);
    applyFeverFX(DOC, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;

    // boss reset
    S.bossActive = false;
    S.bossPhase = 0;
    S.bossHits = 0;
    S.bossStartedAt = 0;

    S.warmupUntil = now() + 3000;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    coach('neutral', 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    updateScore(); updateTime(); updateQuest();

    logEvent('session_start', {
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec
    });

    loopSpawn();
    adaptiveTick();
  }

  bindInputs();
  bindFlushHard();
  start();

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}
}