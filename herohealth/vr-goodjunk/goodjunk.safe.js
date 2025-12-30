// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard (DUAL-EYE READY)
// v5 HELL: Boss 2 phases + Decoy + Dynamic No-Junk Zone + Sudden Death + Fever Stun/Jitter

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
  await Promise.race([ Promise.all(tasks), new Promise(res=>setTimeout(res, 260)) ]);
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

function diffBase(diff, hell){
  diff = String(diff||'normal').toLowerCase();
  // HELL: spawn faster, ttl shorter, junk higher, missLimit tighter, boss harder
  if (diff === 'easy'){
    return hell
      ? { spawnMs: 820, ttlMs: 2000, size: 1.06, junk: 0.16, power: 0.040, maxT: 8, missLimit: 16, bossNeed1: 3, bossNeed2: 4, bossSec: 10, suddenSec: 10 }
      : { spawnMs: 980, ttlMs: 2350, size: 1.08, junk: 0.12, power: 0.038, maxT: 7, missLimit: 22, bossNeed1: 3, bossNeed2: 3, bossSec: 9, suddenSec: 9 };
  }
  if (diff === 'hard'){
    return hell
      ? { spawnMs: 560, ttlMs: 1320, size: 0.92, junk: 0.24, power: 0.020, maxT: 11, missLimit: 9, bossNeed1: 4, bossNeed2: 5, bossSec: 10, suddenSec: 12 }
      : { spawnMs: 700, ttlMs: 1580, size: 0.94, junk: 0.19, power: 0.026, maxT: 9, missLimit: 12, bossNeed1: 4, bossNeed2: 4, bossSec: 10, suddenSec: 10 };
  }
  return hell
    ? { spawnMs: 660, ttlMs: 1550, size: 0.98, junk: 0.21, power: 0.028, maxT: 10, missLimit: 12, bossNeed1: 3, bossNeed2: 4, bossSec: 10, suddenSec: 11 }
    : { spawnMs: 830, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.032, maxT: 8, missLimit: 16, bossNeed1: 3, bossNeed2: 3, bossSec: 9, suddenSec: 9 };
}

function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-layer, #gj-layer-l, #gj-layer-r, .gj-layer{
      position:absolute; inset:0; z-index:30;
      pointer-events:auto !important;
      touch-action:none;
    }
    .gj-target{
      position:absolute;
      left: var(--x, 50px);
      top:  var(--y, 50px);
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
    .gj-target.good{ border-color: rgba(34,197,94,.28); }
    .gj-target.junk{ border-color: rgba(239,68,68,.30); filter: saturate(1.15); }
    .gj-target.star{ border-color: rgba(34,211,238,.32); }
    .gj-target.shield{ border-color: rgba(168,85,247,.32); }
    .gj-target.boss{
      width: 86px; height: 86px;
      font-size: 42px;
      border-color: rgba(255,215,0,.38);
      box-shadow: 0 18px 60px rgba(0,0,0,.50), 0 0 0 2px rgba(255,215,0,.10) inset;
      background: rgba(2,6,23,.62);
    }
    .gj-target.decoy{
      width: 82px; height: 82px;
      font-size: 40px;
      border-color: rgba(244,63,94,.34);
      box-shadow: 0 18px 60px rgba(0,0,0,.50), 0 0 0 2px rgba(244,63,94,.10) inset;
      background: rgba(2,6,23,.60);
      filter: saturate(1.1);
    }
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
  `;
  DOC.head.appendChild(st);
}

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

function randPosEye(rng, safeMargins, eye, dual){
  const W = ROOT.innerWidth || 360;
  const H = ROOT.innerHeight || 640;
  const eyeW = dual ? (W * 0.5) : W;
  const xOff = (dual && eye === 1) ? eyeW : 0;

  let top = safeMargins?.top ?? 120;
  let bottom = safeMargins?.bottom ?? 170;
  let left = safeMargins?.left ?? 22;
  let right = safeMargins?.right ?? 22;

  if ((eyeW - left - right) < 160){ left = 10; right = 10; }
  if ((H - top - bottom) < 240){ top = Math.max(84, top - 22); bottom = Math.max(120, bottom - 22); }

  const avoid = buildAvoidRects();

  for (let i=0;i<18;i++){
    const lx = left + rng() * (eyeW - left - right);
    const y  = top  + rng() * (H - top - bottom);
    const gx = lx + xOff;

    let ok = true;
    for (const r of avoid){
      if (pointInRect(gx, y, { left:r.left-8, right:r.right+8, top:r.top-8, bottom:r.bottom+8 })){
        ok = false; break;
      }
    }
    if (ok) return { x: lx, y };
  }

  return { x: left + rng() * (eyeW - left - right), y: top + rng() * (H - top - bottom) };
}

const GOOD   = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK   = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS  = ['⭐','✨'];
const SHIELD = '🛡️';
const BOSS_DIAMOND = '💎';
const DECOYS = ['🪨','🔻','💥','🧨']; // หลอก

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.setProperty('--x', px);
  el.style.setProperty('--y', py);
  el.style.left = px;
  el.style.top  = py;
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

function updateFeverUI(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}
function setFeverClass(fever){
  const b = ROOT.document?.body;
  if (!b) return;
  b.classList.toggle('fever-high', fever >= 70);
  b.classList.toggle('fever-max',  fever >= 95);
}
function pulseShake(level=1){
  const b = ROOT.document?.body;
  if (!b) return;
  const cls = (level >= 2) ? 'shake-2' : 'shake-1';
  b.classList.add(cls);
  setTimeout(()=>{ try{ b.classList.remove(cls); }catch(_){} }, 220);
}

function makeSummary(S, reason){
  const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
  return {
    reason: String(reason||'end'),
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.misses|0,
    missLimit: S.missLimit|0,
    goalsCleared: S.goalsCleared|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniCleared|0,
    miniTotal: S.miniTotal|0,

    bossWon: !!S.bossWon,
    bossPhase: S.bossPhase|0,
    bossNeed1: S.bossNeed1|0,
    bossNeed2: S.bossNeed2|0,
    nHitBoss: S.bossHits|0,

    suddenDeath: !!S.suddenActive,
    suddenMissLeft: S.suddenMissLeft|0,

    nHitGood: S.hitGood|0,
    nHitJunk: S.hitJunk|0,
    nHitJunkGuard: S.hitJunkGuard|0,
    nExpireGood: S.expireGood|0,
    accuracyGoodPct: acc|0,
    grade: rankFromAcc(acc),

    feverEnd: Math.round(S.fever)|0,
    shieldEnd: S.shield|0,

    diff: S.diff,
    runMode: S.runMode,
    seed: S.seed,
    challenge: S.challenge,
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

function renderEndOverlay(summary, hubUrl){
  const DOC = ROOT.document;
  const host = DOC?.getElementById('end-summary');
  if (!host) return;

  const acc = summary?.accuracyGoodPct ?? 0;
  const grade = summary?.grade ?? '—';

  host.innerHTML = `
    <div style="
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(10px);
      z-index:200;
      padding: 14px;
    ">
      <div style="
        width:min(760px, 92vw);
        border:1px solid rgba(148,163,184,.20);
        border-radius:22px;
        background: rgba(2,6,23,.82);
        box-shadow: 0 18px 50px rgba(0,0,0,.45);
        padding: 16px;
      ">
        <div style="font-size:22px;font-weight:1000;">สรุปผล GoodJunkVR</div>
        <div style="margin-top:6px;color:rgba(148,163,184,.95);font-weight:900;font-size:13px;">
          reason=${summary.reason} • diff=${summary.diff} • run=${summary.runMode} • challenge=${summary.challenge}
        </div>

        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:10px;">
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(15,23,42,.55);">
            <div style="color:rgba(148,163,184,.9);font-weight:900;font-size:12px;">Score</div>
            <div style="font-weight:1000;font-size:26px;margin-top:2px;">${summary.scoreFinal}</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(15,23,42,.55);">
            <div style="color:rgba(148,163,184,.9);font-weight:900;font-size:12px;">Grade</div>
            <div style="font-weight:1000;font-size:26px;margin-top:2px;">${grade} <span style="font-size:14px;color:rgba(148,163,184,.9);">(${acc}%)</span></div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(15,23,42,.55);">
            <div style="color:rgba(148,163,184,.9);font-weight:900;font-size:12px;">Miss</div>
            <div style="font-weight:1000;font-size:22px;margin-top:2px;">${summary.misses}/${summary.missLimit}</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;background:rgba(15,23,42,.55);">
            <div style="color:rgba(148,163,184,.9);font-weight:900;font-size:12px;">Boss</div>
            <div style="font-weight:1000;font-size:22px;margin-top:2px;">
              ${summary.bossWon ? 'CLEAR ✅' : '—'} <span style="font-size:14px;color:rgba(148,163,184,.9);">(hits ${summary.nHitBoss})</span>
            </div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="btnEndReplay" style="
            flex:1; min-width: 180px; height:54px;border-radius:16px;
            border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.18);
            color:#eafff3;
            font-size:16px;font-weight:1000;
          ">เล่นอีกครั้ง</button>

          <button id="btnEndHub" style="
            flex:1; min-width: 180px; height:54px;border-radius:16px;
            border:1px solid rgba(148,163,184,.22);
            background: rgba(2,6,23,.65);
            color:#e5e7eb;
            font-size:16px;font-weight:1000;
          ">กลับ HUB</button>
        </div>
      </div>
    </div>
  `;

  const btnReplay = DOC.getElementById('btnEndReplay');
  const btnHub = DOC.getElementById('btnEndHub');

  btnReplay && btnReplay.addEventListener('click', ()=> location.reload());
  btnHub && btnHub.addEventListener('click', ()=>{
    const hub = hubUrl || qs('hub','');
    if (hub) location.href = hub;
    else location.href = './hub.html';
  });
}

export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerL = opts.layerEl || DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer') || DOC.querySelector('.gj-layer');
  const layerR = opts.layerElR || DOC.getElementById('gj-layer-r') || null;

  const crossL = opts.crosshairEl || DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair') || DOC.querySelector('.gj-crosshair');
  const crossR = opts.crosshairElR || DOC.getElementById('gj-crosshair-r') || null;

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');

  if (!layerL){
    console.warn('[GoodJunkVR] missing layer (gj-layer-l / gj-layer)');
    return;
  }

  const dual = !!layerR;
  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 18, right: 18 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','miss')).toLowerCase(); // time|all|miss
  const challenge = String(opts.challenge || qs('challenge','hell')).toLowerCase();

  const hell = (challenge === 'hell' || challenge === 'hardpp' || String(qs('hell','0')) === '1');
  const hardpp = (challenge === 'hardpp');

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};
  const hubUrl = qs('hub','');

  const base = diffBase(diff, hell);

  const S = {
    running:false, ended:false, flushed:false,

    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,
    tStart:0, left: timeSec,

    score:0, combo:0, comboMax:0,
    misses:0, missLimit: base.missLimit|0,
    hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,

    fever:0, shield:0,
    stunnedUntil:0,

    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,

    // boss 2 phases
    bossActive:false,
    bossDone:false,
    bossWon:false,
    bossPhase:0,               // 0 none, 1 phase1, 2 phase2
    bossNeed1: base.bossNeed1|0,
    bossNeed2: base.bossNeed2|0,
    bossHits:0,
    bossEndAt:0,
    bossSec: base.bossSec|0,

    // sudden death
    suddenActive:false,
    suddenEndAt:0,
    suddenSec: base.suddenSec|0,
    suddenMissLeft: 0,

    // no-junk zone (dynamic)
    noJunkOn: hell,             // เปิดเมื่อ hell
    noJunkRadius: isMobileLike() ? 128 : 112, // px
    noJunkMin: isMobileLike() ? 64 : 54,
    noJunkMax: isMobileLike() ? 160 : 140,

    warmupUntil:0,

    // spawn behavior
    spawnMs: base.spawnMs,
    ttlMs: base.ttlMs,
    size: base.size,
    junkP: base.junk,
    powerP: base.power,
    maxTargets: base.maxT,

    // tick accumulators
    lastTickAt: 0,
    spawnAcc: 0,

    uidSeq: 1
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(7, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
    safeMargins.left = Math.max(12, safeMargins.left);
    safeMargins.right = Math.max(12, safeMargins.right);
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

  function updateQuest(){
    if (S.suddenActive){
      const leftMs = Math.max(0, S.suddenEndAt - now());
      emit('quest:update', {
        goalTitle: `SUDDEN DEATH!`,
        goalNow: 0, goalTotal: 0,
        miniTitle: `พลาดได้อีก ${S.suddenMissLeft} ครั้ง`,
        miniNow: 0, miniTotal: 0,
        miniLeftMs: leftMs|0
      });
      emit('quest:progress', {
        goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
        miniCleared: S.miniCleared, miniTotal: S.miniTotal
      });
      return;
    }

    if (S.bossActive){
      const leftMs = Math.max(0, S.bossEndAt - now());
      const need = (S.bossPhase === 1) ? S.bossNeed1 : S.bossNeed2;
      emit('quest:update', {
        goalTitle: `BOSS PHASE ${S.bossPhase}: ยิง 💎 ให้ครบ`,
        goalNow: S.bossHits, goalTotal: need,
        miniTitle: (S.bossPhase === 2) ? `ระวัง DECOY! โดนหลอก = โทษหนัก` : `ห้ามพลาด!`,
        miniNow: 0, miniTotal: 0,
        miniLeftMs: leftMs|0
      });
      emit('quest:progress', {
        goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
        miniCleared: S.miniCleared, miniTotal: S.miniTotal
      });
      return;
    }

    emit('quest:update', {
      goalTitle: `Goal: เก็บของดีให้ครบ`,
      goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle: `Mini: คอมโบมาแล้ว!`,
      miniNow: S.miniCleared, miniTotal: S.miniTotal,
      miniLeftMs: 0
    });
    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });
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

  function burstAtEl(el, kind){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || el.dataset.type || '');
    }catch(_){}
  }

  function makeTarget(type, emoji, x, y, s, uid){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    el._ttl = setTimeout(()=> expireTargetBoth(el), S.ttlMs);

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitTarget(el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function expireTargetBoth(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');

    // miss only for good/boss expires
    if (tp === 'good' || tp === 'boss'){
      S.misses++; S.expireGood++; S.combo = 0;

      S.fever = clamp(S.fever + (hell ? 10 : 8), 0, 100);
      updateFeverUI(S.shield, S.fever);
      setFeverClass(S.fever);
      pulseShake(1);

      judge('warn', 'MISS (หมดเวลา)!');
      updateScore(); updateQuest();
      logEvent('miss_expire', { kind: tp, emoji: String(el.dataset.emoji||'') });

      if (S.suddenActive){
        S.suddenMissLeft = Math.max(0, S.suddenMissLeft - 1);
        if (S.suddenMissLeft <= 0) endGame('sudden_death');
      }

      if (endPolicy === 'miss' && S.misses >= S.missLimit) endGame('miss_limit');
    }

    el.classList.add('out');
    const mate = getMate(el);
    if (mate) mate.classList.add('out');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      if (mate){ try{ mate.remove(); }catch(_){ } }
    }, 160);
  }

  function scoreGood(){
    const mult = 1 + clamp(S.combo/28, 0, hell ? 1.05 : 0.85);
    const pts = Math.round((hell ? 96 : 92) * mult);
    S.score += pts;
    return pts;
  }

  function maybeTriggerStun(){
    if (S.fever < 100) return;
    if (now() < S.stunnedUntil) return;

    S.stunnedUntil = now() + (hell ? 1400 : 1200);
    pulseShake(2);
    coach('sad', 'STUN! 😵', 'พัก 1 วิ แล้วค่อยยิงต่อ!');
    judge('bad', 'STUN!');
  }

  function beginBoss(){
    if (S.bossDone || S.bossActive) return;
    S.bossActive = true;
    S.bossPhase = 1;
    S.bossHits = 0;
    S.bossEndAt = now() + (S.bossSec * 1000);

    coach('neutral', `BOSS PHASE 1! 💎`, `ยิงเพชรให้ครบ ${S.bossNeed1} ครั้ง`);
    emit('hha:celebrate', { kind:'mini', title:'BOSS PHASE 1 💎' });
    updateQuest();
  }

  function nextBossPhase2(){
    if (!S.bossActive) return;
    S.bossPhase = 2;
    S.bossHits = 0;
    S.bossEndAt = now() + (Math.round(S.bossSec * 0.95) * 1000);

    coach('neutral', `BOSS PHASE 2! 😈`, `ยิง 💎 ให้ครบ ${S.bossNeed2} แต่มี DECOY!`);
    emit('hha:celebrate', { kind:'mini', title:'BOSS PHASE 2 😈' });
    updateQuest();
  }

  function finishBoss(win){
    if (!S.bossActive) return;
    S.bossActive = false;
    S.bossDone = true;
    S.bossWon = !!win;

    if (win){
      const bonus = hell ? 860 : 650;
      S.score += bonus;
      coach('happy', 'BOSS CLEAR! 🏆', `ได้โบนัส +${bonus}`);
      judge('good', `BOSS +${bonus}`);
      emit('hha:celebrate', { kind:'goal', title:'BOSS CLEAR!' });

      // start sudden death (HELL only)
      if (hell && runMode === 'play'){
        startSuddenDeath();
      }
    } else {
      const penalty = hell ? 520 : 420;
      S.score = Math.max(0, S.score - penalty);
      S.fever = clamp(S.fever + (hell ? 22 : 18), 0, 100);
      updateFeverUI(S.shield, S.fever);
      setFeverClass(S.fever);
      pulseShake(2);
      coach('sad', 'BOSS FAIL 😵', `โดนโทษ -${penalty}`);
      judge('bad', `BOSS FAIL -${penalty}`);
      maybeTriggerStun();
    }

    updateScore(); updateQuest();
  }

  function startSuddenDeath(){
    if (S.suddenActive) return;
    S.suddenActive = true;
    S.suddenMissLeft = 1;
    S.suddenEndAt = now() + (S.suddenSec * 1000);

    coach('neutral', 'SUDDEN DEATH 🔥', `พลาดได้อีก ${S.suddenMissLeft} ครั้ง!`);
    emit('hha:celebrate', { kind:'mini', title:'SUDDEN DEATH 🔥' });

    // crank difficulty
    S.spawnMs = clamp(S.spawnMs * 0.78, 360, 900);
    S.ttlMs   = clamp(S.ttlMs * 0.78, 920, 2200);
    S.junkP   = clamp(S.junkP + 0.05, 0.10, 0.30);
    S.maxTargets = clamp(S.maxTargets + 2, 6, isMobileLike()? 12 : 14);

    updateQuest();
  }

  function applySuddenTimers(){
    if (!S.suddenActive) return;
    if (now() >= S.suddenEndAt){
      // survive -> win
      endGame('sudden_survive');
    }
  }

  function hitGood(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - (hell ? 2.2 : 2.6), 0, 100);
    updateFeverUI(S.shield, S.fever);
    setFeverClass(S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtEl(el, 'good');

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();

    // mini: combo thresholds
    if (S.miniCleared < S.miniTotal){
      const needCombo = (hell ? 5 : 4) + (S.miniCleared * (hell ? 2 : 2));
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! 🔥`, `ระวัง junk จะเริ่มรัว`);
        updateQuest();
      }
    }

    // goals: good hit milestones
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * (hell ? 10 : 9));
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', `Goal ผ่านแล้ว!`, `ใกล้ท้ายเกมมีบอส`);
        updateQuest();
      }
    }

    removeTargetBoth(el);
  }

  function hitShield(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFeverUI(S.shield, S.fever);

    S.score += (hell ? 90 : 80);
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    burstAtEl(el, 'shield');
    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitStar(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - (hell ? 7 : 6), 0, 100);
    updateFeverUI(S.shield, S.fever);
    setFeverClass(S.fever);

    const pts = (hell ? 190 : 160);
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    burstAtEl(el, 'star');
    logEvent('hit', { kind:'star', emoji:String(el.dataset.emoji||'⭐') });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitBoss(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.bossHits++;
    burstAtEl(el, 'star');
    const need = (S.bossPhase === 1) ? S.bossNeed1 : S.bossNeed2;
    judge('good', `💎 ${S.bossHits}/${need}`);
    logEvent('boss_hit', { phase:S.bossPhase, hits:S.bossHits, need });

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (S.bossHits >= need){
      if (S.bossPhase === 1) nextBossPhase2();
      else finishBoss(true);
    }
  }

  function hitDecoy(el){
    // DEC0Y = โทษหนัก + ลด progress + fever + shake
    S.hitAll++;

    // shield can block decoy as "fake hit"
    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFeverUI(S.shield, S.fever);

      judge('good', 'BLOCK DECOY!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'decoy', emoji:String(el.dataset.emoji||'') });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++; S.misses++; S.combo = 0;

    const penalty = hell ? 320 : 260;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + (hell ? 20 : 16), 0, 100);
    updateFeverUI(S.shield, S.fever);
    setFeverClass(S.fever);
    pulseShake(2);

    // reduce boss progress
    if (S.bossActive && S.bossPhase === 2){
      S.bossHits = Math.max(0, S.bossHits - 1);
    }

    judge('bad', `DECOY! -${penalty}`);
    coach('sad', 'โดนหลอก! 😈', 'โฟกัส 💎 เท่านั้น!');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'decoy', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever), boss:true });

    maybeTriggerStun();

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (S.suddenActive){
      S.suddenMissLeft = Math.max(0, S.suddenMissLeft - 1);
      if (S.suddenMissLeft <= 0) { endGame('sudden_death'); return; }
    }

    if (endPolicy === 'miss' && S.misses >= S.missLimit) endGame('miss_limit');
  }

  function hitJunk(el){
    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFeverUI(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return; // no miss (standard)
    }

    S.hitJunk++; S.misses++; S.combo = 0;

    const penalty = (S.bossActive ? (hell ? 300 : 260) : (hell ? 210 : 180));
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + (S.bossActive ? (hell ? 20 : 18) : (hell ? 14 : 13)), 0, 100);
    updateFeverUI(S.shield, S.fever);
    setFeverClass(S.fever);
    pulseShake(S.bossActive ? 2 : 1);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever), boss:S.bossActive });

    maybeTriggerStun();

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (S.suddenActive){
      S.suddenMissLeft = Math.max(0, S.suddenMissLeft - 1);
      if (S.suddenMissLeft <= 0) { endGame('sudden_death'); return; }
    }

    if (endPolicy === 'miss' && S.misses >= S.missLimit) endGame('miss_limit');
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    if (now() < S.stunnedUntil) return;

    const tp = String(el.dataset.type||'');
    if (tp === 'boss') return hitBoss(el);
    if (tp === 'decoy') return hitDecoy(el);
    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
  }

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;
    if (now() < S.stunnedUntil) return;

    const radius = isMobileLike() ? 64 : 52;

    const cL = crossL ? getCenter(crossL) : { x:(ROOT.innerWidth||360)*0.25, y:(ROOT.innerHeight||640)*0.5 };
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
    else {
      if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
      updateScore();
    }
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

  let _tickTimer = 0;
  function stopTick(){ try{ clearTimeout(_tickTimer); }catch(_){} }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    stopTick();
    clearAllTargets();

    const summary = makeSummary(S, reason);
    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');

    renderEndOverlay(summary, hubUrl);
  }

  function computeNoJunkRadius(acc, elapsed){
    if (!S.noJunkOn) return 0;

    // เล่นเก่ง = โซนหด, fever สูง = โซนขยาย, เวลาผ่านไป = โซนค่อย ๆ หด
    const skill = clamp((acc - 0.68) * 1.3 + clamp(S.combo/22,0,1)*0.55, 0, 1);
    const timeRamp = clamp((elapsed - 4) / 14, 0, 1);

    let r = S.noJunkMax - (skill * 70) - (timeRamp * 30);

    if (S.fever >= 70) r += 28;
    if (S.fever >= 95) r += 18;

    // Sudden death: โซนหดลงอีก (โหด)
    if (S.suddenActive) r -= 14;

    return clamp(r, S.noJunkMin, S.noJunkMax);
  }

  function posFarFromCrosshair(x, y, eye){
    if (!S.noJunkOn) return true;
    const r = S.noJunkRadius;
    if (r <= 0) return true;

    // ใช้ crosshair ของแต่ละตาเป็น center
    const c = (eye === 1 && crossR) ? getCenter(crossR) : (crossL ? getCenter(crossL) : { x:(ROOT.innerWidth||360)*0.5, y:(ROOT.innerHeight||640)*0.5 });
    // note: x,y เป็น local eye coords, ต้อง convert เป็น global เพื่อเทียบกับ rect
    const W = ROOT.innerWidth || 360;
    const eyeW = dual ? (W * 0.5) : W;
    const gx = x + ((dual && eye === 1) ? eyeW : 0);
    const gy = y;

    const d2 = dist2(gx, gy, c.x, c.y);
    return d2 >= (r*r);
  }

  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets(layerL) >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    // Boss spawns
    if (S.bossActive){
      const uid = String(S.uidSeq++);
      const s = clamp(S.size * (hell ? 1.06 : 1.04), 0.84, 1.22);

      // spawn diamond always
      let pL = randPosEye(S.rng, safeMargins, 0, dual);
      let tries = 0;
      while (!posFarFromCrosshair(pL.x, pL.y, 0) && tries++ < 10){
        pL = randPosEye(S.rng, safeMargins, 0, dual);
      }
      const elL = makeTarget('boss', BOSS_DIAMOND, pL.x, pL.y, s, uid);
      layerL.appendChild(elL);

      if (dual && layerR){
        let pR = randPosEye(S.rng, safeMargins, 1, dual);
        tries = 0;
        while (!posFarFromCrosshair(pR.x, pL.y, 1) && tries++ < 10){
          pR = randPosEye(S.rng, safeMargins, 1, dual);
        }
        const elR = makeTarget('boss', BOSS_DIAMOND, pR.x, pL.y, s, uid);
        layerR.appendChild(elR);
      }

      // Phase 2: add decoy spawns sometimes
      if (S.bossPhase === 2){
        const decoyChance = hell ? 0.70 : 0.55;
        if (S.rng() < decoyChance){
          const duid = String(S.uidSeq++);
          const de = pick(S.rng, DECOYS);
          let dpL = randPosEye(S.rng, safeMargins, 0, dual);
          let dtries = 0;
          while (!posFarFromCrosshair(dpL.x, dpL.y, 0) && dtries++ < 10){
            dpL = randPosEye(S.rng, safeMargins, 0, dual);
          }
          const dL = makeTarget('decoy', de, dpL.x, dpL.y, s * 0.98, duid);
          layerL.appendChild(dL);

          if (dual && layerR){
            let dpR = randPosEye(S.rng, safeMargins, 1, dual);
            dtries = 0;
            while (!posFarFromCrosshair(dpR.x, dpL.y, 1) && dtries++ < 10){
              dpR = randPosEye(S.rng, safeMargins, 1, dual);
            }
            const dR = makeTarget('decoy', de, dpR.x, dpL.y, s * 0.98, duid);
            layerR.appendChild(dR);
          }
        }
      }

      logEvent('spawn', { kind:'boss', phase:S.bossPhase, uid });
      return;
    }

    // Normal spawn
    let tp = 'good';
    const r = S.rng();
    const powerP = inWarm ? (S.powerP * 0.65) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.58)  : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.040) tp = 'star';
    else if (r < powerP + 0.040 + junkP) tp = 'junk';
    else tp = 'good';

    // Dynamic no-junk zone: reroll position for junk if too close crosshair
    const size = (inWarm ? (S.size * 1.06) : S.size);
    const uid = String(S.uidSeq++);

    const emoji =
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'star') ? pick(S.rng, STARS) :
      SHIELD;

    const s =
      (tp === 'junk') ? (size * 0.98) :
      (tp === 'shield') ? (size * 1.03) :
      (tp === 'star') ? (size * 1.02) :
      size;

    let pL = randPosEye(S.rng, safeMargins, 0, dual);
    if (tp === 'junk' && S.noJunkOn){
      let tries = 0;
      while (!posFarFromCrosshair(pL.x, pL.y, 0) && tries++ < 14){
        pL = randPosEye(S.rng, safeMargins, 0, dual);
      }
    }

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid);
    layerL.appendChild(elL);

    if (dual && layerR){
      // keep same Y for stereo feel
      let pR = randPosEye(S.rng, safeMargins, 1, dual);
      if (tp === 'junk' && S.noJunkOn){
        let tries = 0;
        while (!posFarFromCrosshair(pR.x, pL.y, 1) && tries++ < 14){
          pR = randPosEye(S.rng, safeMargins, 1, dual);
        }
      }
      const elR = makeTarget(tp, emoji, pR.x, pL.y, s, uid);
      layerR.appendChild(elR);
    }

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid });
  }

  function tick(){
    if (!S.running || S.ended) return;

    const t = now();
    const dt = S.lastTickAt ? (t - S.lastTickAt) : 0;
    S.lastTickAt = t;

    // handle STUN timeout (input uses stunnedUntil)
    if (t >= S.stunnedUntil && S.stunnedUntil !== 0){
      S.stunnedUntil = 0;
    }

    // time countdown
    S.left = Math.max(0, S.left - (dt/1000));
    updateTime();

    // end by time (unless sudden death decides earlier)
    if (S.left <= 0){
      endGame('time');
      return;
    }

    const elapsed = (t - S.tStart) / 1000;

    // boss trigger: last 35% time OR after goals cleared
    const timeRatio = S.left / S.timeSec;
    if (!S.bossDone && !S.bossActive){
      if (timeRatio <= 0.35 || (S.goalsCleared >= S.goalsTotal && elapsed > 6)){
        beginBoss();
      }
    }

    // boss timeout
    if (S.bossActive && t >= S.bossEndAt){
      finishBoss(false);
    }

    // sudden timers
    applySuddenTimers();

    // difficulty ramp
    if (S.runMode === 'play'){
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / (hell ? 16 : 18), 0, 1);

      const timeRamp = clamp((elapsed - 3) / (hell ? 9 : 10), 0, 1);
      const skill = clamp((acc - 0.65) * 1.25 + comboHeat * 0.90, 0, 1);
      const heat = clamp(timeRamp * (hell ? 0.62 : 0.55) + skill * (hell ? 0.88 : 0.75), 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * (hell ? 420 : 360), 360, 1400);
      S.ttlMs   = clamp(base.ttlMs   - heat * (hell ? 560 : 460), 920, 3000);
      S.size    = clamp(base.size    - heat * (hell ? 0.18 : 0.15), 0.82, 1.16);
      S.junkP   = clamp(base.junk    + heat * (hell ? 0.095 : 0.075), 0.08, 0.32);
      S.powerP  = clamp(base.power   + heat * (hell ? 0.012 : 0.010), 0.01, 0.070);

      const maxBonus = Math.round(heat * (hell ? 5 : 4));
      S.maxTargets = clamp(base.maxT + maxBonus, 6, isMobileLike() ? 12 : 14);

      // fever high => fair assist
      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - (hell ? 0.030 : 0.035), 0.08, 0.30);
        S.size  = clamp(S.size + 0.03, 0.82, 1.18);
      }

      // update no-junk radius
      if (S.noJunkOn){
        S.noJunkRadius = computeNoJunkRadius(acc, elapsed);
      }

    } else {
      // research stable
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    }

    // Boss phase spawn intensity
    if (S.bossActive){
      S.spawnMs = clamp(S.spawnMs * (hell ? 0.78 : 0.86), 320, 900);
      S.ttlMs   = clamp(S.ttlMs * (hell ? 0.84 : 0.90), 880, 2200);
      S.maxTargets = clamp(S.maxTargets + 2, 7, isMobileLike() ? 12 : 14);
    }

    // spawn accumulator
    S.spawnAcc += dt;
    const spawnCap = S.bossActive ? (hell ? 4 : 3) : (hell ? 3 : 3);
    let spawned = 0;
    while (S.spawnAcc >= S.spawnMs && spawned < spawnCap){
      S.spawnAcc -= S.spawnMs;
      spawnOne();
      spawned++;
    }

    // schedule next
    _tickTimer = setTimeout(tick, 80);
  }

  function start(){
    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.lastTickAt = S.tStart;
    S.left = timeSec;

    S.score = 0; S.combo = 0; S.comboMax = 0;
    S.misses = 0; S.hitAll = 0; S.hitGood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireGood = 0;

    S.fever = 0; S.shield = 0;
    updateFeverUI(S.shield, S.fever);
    setFeverClass(S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;

    S.bossActive = false; S.bossDone = false; S.bossWon = false; S.bossPhase = 0;
    S.bossHits = 0; S.bossEndAt = 0;

    S.suddenActive = false; S.suddenEndAt = 0; S.suddenMissLeft = 0;

    S.warmupUntil = now() + (hell ? 2200 : 2800);
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? (hell ? 8 : 7) : (hell ? 9 : 7));

    coach('neutral',
      hell ? 'HELL MODE 😈: ช่วงแรกนุ่ม ๆ แต่จะโหดขึ้นไว + บอส 2 เฟส + sudden death' : 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเอง 😈',
      `Miss limit: ${S.missLimit} • end=${S.endPolicy}`
    );

    updateScore(); updateTime(); updateQuest();

    logEvent('session_start', {
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      hell,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec,
      missLimit: S.missLimit
    });

    tick();
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