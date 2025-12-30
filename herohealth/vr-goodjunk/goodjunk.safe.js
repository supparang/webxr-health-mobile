// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard — v4 "ALL-IN HARD PACK"
// ✅ Gaze-hold auto-fire + hold ring (VR/cVR default ON)
// ✅ Boss Wave (HP multi-hit + decoys + timer pressure)
// ✅ Mini: No-Junk Zone (junk hit => fail mini + penalty)
// ✅ Miss definition preserved: miss = expire good + junk hit (shield-block does NOT count)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){ } }
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
function bodyHas(cls){
  try{ return document.body && document.body.classList.contains(cls); }catch(_){ return false; }
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
function diffBase(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2400, size: 1.08, junk: 0.12, power: 0.035, maxT: 7, missLimit: 30, gazeHoldMs: 330 };
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1700, size: 0.94, junk: 0.18, power: 0.025, maxT: 9, missLimit: 18, gazeHoldMs: 230 };
  return { spawnMs: 840, ttlMs: 2000, size: 1.00, junk: 0.15, power: 0.030, maxT: 8, missLimit: 22, gazeHoldMs: 280 };
}

const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';
const DRIFTS = ['drift-1','drift-2','drift-3','drift-4'];

function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-stage{ position:fixed; inset:0; overflow:hidden; }
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

    /* Boss target: bigger + stronger glow */
    .gj-target.boss{
      width: 94px; height: 94px;
      font-size: 46px;
      border-color: rgba(239,68,68,.42);
      box-shadow: 0 18px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset, 0 0 22px rgba(239,68,68,.20);
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

    /* Gaze hold ring (uses --holdP 0..1) */
    .gj-target::after{
      content:"";
      position:absolute;
      inset:-6px;
      border-radius:999px;
      pointer-events:none;
      opacity:0;
      background:
        conic-gradient(
          rgba(34,197,94,.85) calc(var(--holdP, 0) * 360deg),
          rgba(148,163,184,.14) 0
        );
      filter: drop-shadow(0 0 10px rgba(34,197,94,.18));
      -webkit-mask: radial-gradient(transparent 62%, #000 63%);
              mask: radial-gradient(transparent 62%, #000 63%);
      transition: opacity 80ms ease;
    }
    .gj-target.gaze::after{ opacity:1; }

    /* drift classes (CSS animations are in goodjunk-vr.css, but safe fallback) */
    .gj-target.drift-1, .gj-target.drift-2, .gj-target.drift-3, .gj-target.drift-4{
      animation-duration: 1.8s;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }
  `;
  DOC.head.appendChild(st);
}

function ensureBossUI(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gjBossBar')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'gjBossBar';
  wrap.className = 'gj-bossbar';
  wrap.innerHTML = `
    <div class="gj-boss-card">
      <div class="gj-boss-top">
        <div class="gj-boss-name" id="gjBossName">BOSS WAVE</div>
        <div class="gj-boss-time" id="gjBossTime">0.0s</div>
      </div>
      <div class="gj-boss-hp"><div class="gj-boss-fill" id="gjBossFill"></div></div>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

function bossUISet(on, hpPct, leftSec, name){
  const DOC = ROOT.document;
  const bar = DOC && DOC.getElementById('gjBossBar');
  if (!bar) return;
  bar.classList.toggle('on', !!on);

  const fill = DOC.getElementById('gjBossFill');
  const t = DOC.getElementById('gjBossTime');
  const n = DOC.getElementById('gjBossName');
  if (fill) fill.style.width = clamp(hpPct, 0, 100).toFixed(1) + '%';
  if (t) t.textContent = (Math.max(0, leftSec) || 0).toFixed(1) + 's';
  if (n && name) n.textContent = String(name);
}

function buildAvoidRects(){
  const DOC = ROOT.document;
  const rects = [];
  if (!DOC) return rects;

  const els = [
    DOC.querySelector('.hud-top'),
    DOC.querySelector('.hud-mid'),
    DOC.querySelector('.hha-controls'),
    DOC.getElementById('hhaFever'),
    DOC.getElementById('gjBossBar')
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

function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
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

export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();
  ensureBossUI();

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
  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 18, right: 18 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase();   // time | all | miss
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  // gaze: default ON in VR/cVR, optional elsewhere via &gaze=1
  const gazeParam = qs('gaze', null);
  const gazeForced = (String(gazeParam||'').toLowerCase() === '1' || String(gazeParam||'').toLowerCase() === 'true');
  const gazeOff    = (String(gazeParam||'').toLowerCase() === '0' || String(gazeParam||'').toLowerCase() === 'false');

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

    // quests
    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,

    // mini system (chain)
    miniIndex:0,
    miniActive:null,         // {type,title,target,windowMs,forbidJunk,cur,until}
    miniUntil:0,
    miniFailCount:0,

    warmupUntil:0,
    spawnTimer:0, tickTimer:0, gazeTimer:0, bossTimer:0,
    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,
    missLimit: base.missLimit,
    heat:0,
    rageNext:0,
    rageUntil:0,
    lastHitAt:0,
    uidSeq: 1,

    // gaze
    gazeHoldMsBase: base.gazeHoldMs,
    gazeEnabled: false,
    gazeUid: '',
    gazeHoldMs: 0,
    gazeHoldAccum: 0,
    gazeRadius: isMobileLike() ? 66 : 54,

    // boss
    bossOn:false,
    bossUid:'',
    bossHP:0,
    bossHPMax:0,
    bossUntil:0,
    bossNext:0
  };

  // mobile balance
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
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
  function updateTime(){
    emit('hha:time', { left: Math.max(0, S.left|0) });
  }

  function miniMakeList(){
    // 7 minis: สลับ combo + no-junk + rush สร้างความหลากหลาย
    // target numbers ปรับอัตโนมัติตาม diff/heat ใน play
    return [
      { type:'combo',   title:'คอมโบมาแล้ว!',        target: 4,  windowMs: 999999, forbidJunk:false },
      { type:'nojunk',  title:'No-Junk Zone!',        target: 5,  windowMs: 6500,   forbidJunk:true  },
      { type:'combo',   title:'คอมโบต่อเนื่อง!',     target: 6,  windowMs: 999999, forbidJunk:false },
      { type:'rush',    title:'RUSH 5 ใน 7 วิ!',      target: 5,  windowMs: 7200,   forbidJunk:true  },
      { type:'nojunk',  title:'No-Junk Zone PRO!',    target: 7,  windowMs: 7500,   forbidJunk:true  },
      { type:'combo',   title:'คอมโบระดับไฟลุก!',    target: 8,  windowMs: 999999, forbidJunk:false },
      { type:'bossprep',title:'เตรียมรับบอส! (ห้ามพลาด)', target: 6, windowMs: 6500, forbidJunk:true },
    ];
  }

  const MINI_LIST = miniMakeList();

  function miniStart(index){
    S.miniIndex = clamp(index, 0, MINI_LIST.length-1);
    const def = MINI_LIST[S.miniIndex];
    if (!def) { S.miniActive = null; return; }

    // scale per diff
    let target = def.target;
    let windowMs = def.windowMs;

    if (S.runMode === 'play'){
      if (S.diff === 'easy'){ target = Math.max(3, target - 1); windowMs = windowMs === 999999 ? windowMs : (windowMs + 900); }
      if (S.diff === 'hard'){ target = target + 1; windowMs = windowMs === 999999 ? windowMs : Math.max(4200, windowMs - 700); }
    }

    S.miniActive = {
      type: def.type,
      title: def.title,
      target,
      windowMs,
      forbidJunk: !!def.forbidJunk,
      cur: 0,
      until: (windowMs >= 999999) ? 0 : (now() + windowMs)
    };
    S.miniUntil = S.miniActive.until || 0;

    coach('neutral', `Mini เริ่ม: ${S.miniActive.title}`, S.miniActive.forbidJunk ? 'ห้ามโดนขยะระหว่างทำ!' : 'เก็บของดีต่อเนื่อง!');
    updateQuest();
    logEvent('mini_start', { idx:S.miniIndex, type:S.miniActive.type, target:S.miniActive.target, windowMs:S.miniActive.windowMs, forbidJunk:S.miniActive.forbidJunk?1:0 });
  }

  function miniFail(reason){
    if (!S.miniActive) return;
    S.miniFailCount++;

    // penalty: fever + score down (play only)
    if (S.runMode === 'play'){
      S.fever = clamp(S.fever + 10, 0, 100);
      S.score = Math.max(0, S.score - 140);
      updateFever(S.shield, S.fever);
      updateScore();
    }
    judge('bad', 'MINI FAIL!');
    coach('sad', `Mini ล้มเหลว 😵`, String(reason||'ลองใหม่!'));
    logEvent('mini_fail', { idx:S.miniIndex, reason:String(reason||'fail') });

    // restart same mini (fresh timer)
    miniStart(S.miniIndex);
  }

  function miniSucceed(){
    if (!S.miniActive) return;
    S.miniCleared++;
    emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
    coach('happy', `Mini ผ่านแล้ว! 🔥`, (S.miniCleared < S.miniTotal) ? 'เตรียมมินิถัดไป!' : 'สุดยอด!');

    logEvent('mini_complete', { idx:S.miniIndex });

    // next mini
    if (S.miniCleared < S.miniTotal){
      miniStart(S.miniIndex + 1);
    } else {
      S.miniActive = null;
    }
    updateQuest();

    // boss trigger when mini 4 cleared (pressure)
    if (S.runMode === 'play' && S.miniCleared === 4){
      bossScheduleSoon();
    }
  }

  function updateQuest(){
    const mini = S.miniActive;
    let miniTitle = mini ? `Mini: ${mini.title}` : `Mini: —`;
    let miniNow = mini ? mini.cur : S.miniCleared;
    let miniTotal = mini ? mini.target : S.miniTotal;

    let miniLeftMs = 0;
    if (mini && mini.until){
      miniLeftMs = Math.max(0, mini.until - now());
    }

    emit('quest:update', {
      goalTitle: `Goal: เก็บของดีให้ครบ`,
      goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle,
      miniNow, miniTotal,
      miniLeftMs
    });

    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
    try{ clearTimeout(S.gazeTimer); }catch(_){}
    try{ clearTimeout(S.bossTimer); }catch(_){}
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
    if (tp === 'good'){
      S.misses++; S.expireGood++; S.combo = 0;
      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever(S.shield, S.fever);
      judge('warn', 'MISS (หมดเวลา)!');
      updateScore(); updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(el.dataset.emoji||'') });

      if (S.endPolicy === 'miss' && S.misses >= S.missLimit){
        endGame('miss_limit');
      }
    }
    el.classList.add('out');
    const mate = getMate(el);
    if (mate) mate.classList.add('out');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      if (mate){ try{ mate.remove(); }catch(_){ } }
    }, 160);
  }

  function makeTarget(type, emoji, x, y, s, uid, motionCls, extraClass){
    const el = DOC.createElement('div');
    const cls = `gj-target ${type}${motionCls ? ` ${motionCls}` : ''}${extraClass ? ` ${extraClass}` : ''}`;
    el.className = cls;

    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    // TTL: boss has no expire by ttl (handled by boss timer)
    if (!extraClass || !String(extraClass).includes('boss')){
      el._ttl = setTimeout(()=> expireTargetBoth(el), S.ttlMs);
    }

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

  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
  }

  function miniGoodProgress(){
    const m = S.miniActive;
    if (!m) return;

    // combo mini uses combo count
    if (m.type === 'combo'){
      m.cur = Math.max(m.cur, S.combo);
      if (m.cur >= m.target) miniSucceed();
      return;
    }

    // nojunk / rush / bossprep use good hits count within window
    m.cur = clamp(m.cur + 1, 0, m.target);
    if (m.cur >= m.target) miniSucceed();
  }

  function hitGood(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    // reduce fever slightly
    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtEl(el, 'good');
    S.lastHitAt = now();

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    // Mini progress
    if (S.miniCleared < S.miniTotal && S.miniActive){
      // if timed mini expired -> fail
      if (S.miniActive.until && now() > S.miniActive.until){
        miniFail('หมดเวลา');
      } else {
        miniGoodProgress();
      }
    }

    // Goals (simple)
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8);
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', `Goal ผ่านแล้ว!`, `เตรียมรับบอส/เร่งสปีด 😈`);
        updateQuest();

        // Boss schedule after first goal to spice
        if (S.runMode === 'play' && S.goalsCleared === 1){
          bossScheduleSoon();
        }

        if (S.endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
          endGame('all_complete');
        }
      }
    }

    updateScore(); updateQuest();
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
    S.lastHitAt = now();
    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore(); updateQuest();
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
    S.lastHitAt = now();
    logEvent('hit', { kind:'star', emoji:String(el.dataset.emoji||'⭐') });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function bossHit(el){
    // boss requires multiple hits
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const dmg = 1;
    S.bossHP = Math.max(0, S.bossHP - dmg);

    S.score += 160;
    judge('warn', `BOSS HIT! (${S.bossHP}/${S.bossHPMax})`);
    burstAtEl(el, 'boss');
    logEvent('boss_hit', { hp:S.bossHP, hpMax:S.bossHPMax });

    updateScore();

    if (S.bossHP <= 0){
      bossEnd(true, 'boss_down');
    } else {
      // keep boss target; do not remove on hit
      // quick flash effect
      el.classList.add('hit');
      const mate = getMate(el);
      if (mate) mate.classList.add('hit');
      setTimeout(()=>{
        try{ el.classList.remove('hit'); }catch(_){}
        try{ mate && mate.classList.remove('hit'); }catch(_){}
      }, 90);
    }
  }

  function hitJunk(el){
    S.hitAll++;

    // No-Junk Mini check BEFORE shield block? (fairness: shield block does NOT fail mini)
    const m = S.miniActive;
    const wouldFailMini = !!(m && m.forbidJunk && S.miniCleared < S.miniTotal);

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      S.lastHitAt = now();
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      // shield block DOES NOT fail mini (per your standard)
      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++; S.misses++; S.combo = 0;

    const penalty = 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', `MISS ${S.misses}/${S.missLimit}`);
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    // fail mini if forbids junk
    if (wouldFailMini){
      miniFail('โดนขยะในช่วง No-Junk');
    }

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (S.endPolicy === 'miss' && S.misses >= S.missLimit){
      endGame('miss_limit');
    }
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    const isBoss = el.classList.contains('boss');

    if (isBoss) return bossHit(el);

    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
  }

  // ============ Boss system ============
  function bossScheduleSoon(){
    if (S.runMode !== 'play') return;
    const t = now();
    if (!S.bossNext) S.bossNext = t + 9000;
    S.bossNext = Math.min(S.bossNext, t + 5200);
  }

  function bossStart(){
    if (S.bossOn || S.ended || !S.running) return;
    S.bossOn = true;

    const heat = clamp(S.heat, 0, 1);
    S.bossHPMax = (S.diff === 'hard') ? 7 : (S.diff === 'easy' ? 5 : 6);
    S.bossHP = S.bossHPMax;

    const dur = clamp(7.2 - heat*1.2, 5.6, 7.4);
    S.bossUntil = now() + dur*1000;

    const uid = String(S.uidSeq++);
    S.bossUid = uid;

    const pL = randPosEye(S.rng, safeMargins, 0, dual);
    const emoji = '👹';

    const elL = makeTarget('good', emoji, pL.x, pL.y, S.size*1.0, uid, pick(S.rng, DRIFTS), 'boss');
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosEye(S.rng, safeMargins, 1, dual);
      const elR = makeTarget('good', emoji, pR.x, pL.y, S.size*1.0, uid, pick(S.rng, DRIFTS), 'boss');
      layerR.appendChild(elR);
    }

    bossUISet(true, 100, dur, 'BOSS WAVE 👹');
    judge('warn', 'BOSS WAVE!');
    coach('happy', 'บอสมาแล้ว! ยิงหลายครั้งให้ล้ม!', 'ระวังดีคอย + ขยะพุ่ง!');
    logEvent('boss_start', { hpMax:S.bossHPMax, durSec:dur });

    // boss loop tick
    bossTick();
  }

  function bossEnd(win, reason){
    if (!S.bossOn) return;
    S.bossOn = false;

    // remove boss targets
    const killBoss = (layer)=>{
      if (!layer) return;
      try{
        layer.querySelectorAll(`.gj-target.boss[data-uid="${S.bossUid}"]`).forEach(el=>{
          try{ clearTimeout(el._ttl); }catch(_){}
          try{ el.remove(); }catch(_){}
        });
      }catch(_){}
    };
    killBoss(layerL);
    if (dual) killBoss(layerR);

    bossUISet(false, 0, 0, '');

    if (win){
      const bonus = 520 + Math.round(S.heat*220);
      S.score += bonus;
      S.fever = clamp(S.fever - 12, 0, 100);
      updateFever(S.shield, S.fever);

      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN! +BONUS' });
      coach('happy', 'ล้มบอสได้! สุดจัด 🔥', `โบนัส +${bonus}`);
      judge('good', `BOSS DOWN +${bonus}`);
      logEvent('boss_end', { win:1, reason:String(reason||'win'), bonus });

      // push difficulty spike after boss (play only)
      if (S.runMode === 'play'){
        S.rageUntil = Math.max(S.rageUntil, now() + 1200);
      }
    } else {
      // punish
      S.score = Math.max(0, S.score - 260);
      S.fever = clamp(S.fever + 18, 0, 100);
      updateFever(S.shield, S.fever);

      coach('sad', 'บอสหนีไปแล้ว 😵', 'เดี๋ยวมาใหม่! ตั้งหลักก่อน');
      judge('bad', 'BOSS ESCAPED!');
      logEvent('boss_end', { win:0, reason:String(reason||'lose') });
    }

    updateScore(); updateQuest();

    // schedule next boss (8–16s)
    if (S.runMode === 'play'){
      const heat = clamp(S.heat, 0, 1);
      const gap = clamp(15000 - heat*6000, 8500, 16000);
      S.bossNext = now() + gap;
    }
  }

  function bossTick(){
    if (!S.running || S.ended) return;
    if (!S.bossOn) return;

    const left = Math.max(0, (S.bossUntil - now())/1000);
    const hpPct = (S.bossHPMax > 0) ? (S.bossHP / S.bossHPMax) * 100 : 0;
    bossUISet(true, hpPct, left, 'BOSS WAVE 👹');

    // spawn decoys during boss
    if (S.runMode === 'play'){
      if (S.rng() < 0.65) spawnOne(true);
      if (S.rng() < 0.45) spawnOne(true);
    }

    if (now() >= S.bossUntil){
      bossEnd(false, 'timeout');
      return;
    }

    S.bossTimer = setTimeout(bossTick, 120);
  }

  // ============ Spawning ============
  function spawnOne(isBossContext=false){
    if (!S.running || S.ended) return;
    if (countTargets(layerL) >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);
    const inRage = (t < S.rageUntil);
    const inBoss = S.bossOn;

    let tp = 'good';
    const r = S.rng();

    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    let junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

    // boss pressure
    if (inBoss) junkP = clamp(junkP + 0.10, 0.10, 0.35);
    if (inRage) junkP = clamp(junkP + 0.08, 0.08, 0.33);

    // during boss, more decoys (junk + stars)
    const starBoost = inBoss ? 0.06 : 0.035;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + starBoost) tp = 'star';
    else if (r < powerP + starBoost + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);
    const uid = String(S.uidSeq++);

    const pL = randPosEye(S.rng, safeMargins, 0, dual);
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

    // drift probability increases with heat (play only, not research)
    let motion = '';
    if (S.runMode === 'play' && !inWarm){
      const p = clamp(0.12 + (S.heat * 0.48) + (inBoss ? 0.10 : 0), 0, 0.70);
      if (S.rng() < p) motion = pick(S.rng, DRIFTS);
    }

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid, motion, '');
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosEye(S.rng, safeMargins, 1, dual);
      const elR = makeTarget(tp, emoji, pR.x, pL.y, s, uid, motion, '');
      layerR.appendChild(elR);
    }

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid, boss: inBoss ? 1 : 0, rage: inRage ? 1 : 0, ctx: isBossContext ? 'boss' : 'main' });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;

    // boss has its own pressure; still spawn base
    if (!S.bossOn) spawnOne(false);
    else if (S.rng() < 0.55) spawnOne(true);

    // Rage wave makes density spike
    if (now() < S.rageUntil){
      if (S.rng() < 0.70) spawnOne(true);
      if (S.rng() < 0.35) spawnOne(true);
    }

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let nextMs = S.spawnMs;
    if (inWarm) nextMs = Math.max(980, S.spawnMs + 240);
    if (t < S.rageUntil) nextMs = clamp(nextMs - 220, 260, 900);
    if (S.bossOn) nextMs = clamp(nextMs - 200, 220, 720);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 220, 1400));
  }

  // ============ Shooting / Crosshair ============
  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const radius = S.gazeRadius;
    const cL = crossL ? getCenter(crossL) : { x:(ROOT.innerWidth||360)*0.25, y:(ROOT.innerHeight||640)*0.5 };

    let best = null, bestD2 = 1e18;

    const el1 = findTargetNear(layerL, cL.x, cL.y, radius);
    if (el1){
      const cc = getCenter(el1);
      best = el1;
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
      if (S.runMode === 'play' && (S.diff === 'hard' || S.heat > 0.65)){
        S.fever = clamp(S.fever + 1.5, 0, 100);
        updateFever(S.shield, S.fever);
      }
      updateScore();
    }
  }

  // ============ Gaze-hold auto-fire ============
  function gazeReset(){
    S.gazeUid = '';
    S.gazeHoldAccum = 0;
  }
  function gazeMark(el, p){
    if (!el) return;
    try{
      el.classList.add('gaze');
      el.style.setProperty('--holdP', String(clamp(p, 0, 1)));
      const mate = getMate(el);
      if (mate){
        mate.classList.add('gaze');
        mate.style.setProperty('--holdP', String(clamp(p, 0, 1)));
      }
    }catch(_){}
  }
  function gazeUnmark(uid){
    if (!uid) return;
    const clear = (layer)=>{
      if (!layer) return;
      try{
        layer.querySelectorAll(`.gj-target.gaze`).forEach(el=>{
          if (!uid || el.dataset.uid === uid){
            el.classList.remove('gaze');
            el.style.removeProperty('--holdP');
          }
        });
      }catch(_){}
    };
    clear(layerL);
    if (dual) clear(layerR);
  }

  function gazeTick(){
    if (!S.running || S.ended) return;

    // decide enabled
    const inVR = bodyHas('view-vr') || bodyHas('view-cvr');
    S.gazeEnabled = !gazeOff && (gazeForced || inVR);

    if (!S.gazeEnabled){
      gazeUnmark(S.gazeUid);
      gazeReset();
      S.gazeTimer = setTimeout(gazeTick, 80);
      return;
    }

    // dynamic hold time (harder when heat high)
    const heat = clamp(S.heat, 0, 1);
    S.gazeHoldMs = clamp(S.gazeHoldMsBase - heat*70, 170, 360);

    // find nearest target in radius (prefer boss if present)
    const radius = S.gazeRadius;
    const cL = crossL ? getCenter(crossL) : { x:(ROOT.innerWidth||360)*0.5, y:(ROOT.innerHeight||640)*0.5 };
    let best = null;
    let bestD2 = 1e18;

    // boss priority
    try{
      const bossL = layerL.querySelector(`.gj-target.boss`);
      if (bossL){
        const cc = getCenter(bossL);
        const d2 = dist2(cL.x, cL.y, cc.x, cc.y);
        if (d2 <= radius*radius){ best = bossL; bestD2 = d2; }
      }
    }catch(_){}

    if (!best){
      const el1 = findTargetNear(layerL, cL.x, cL.y, radius);
      if (el1){
        const cc = getCenter(el1);
        best = el1;
        bestD2 = dist2(cL.x, cL.y, cc.x, cc.y);
      }
    }

    if (dual && layerR && crossR && !best){
      const cR = getCenter(crossR);
      const el2 = findTargetNear(layerR, cR.x, cR.y, radius);
      if (el2){
        const cc = getCenter(el2);
        const d2 = dist2(cR.x, cR.y, cc.x, cc.y);
        if (!best || d2 < bestD2){ best = el2; bestD2 = d2; }
      }
    }

    if (!best){
      gazeUnmark(S.gazeUid);
      gazeReset();
      S.gazeTimer = setTimeout(gazeTick, 70);
      return;
    }

    const uid = best.dataset.uid || '';
    if (uid !== S.gazeUid){
      gazeUnmark(S.gazeUid);
      S.gazeUid = uid;
      S.gazeHoldAccum = 0;
    }

    S.gazeHoldAccum += 70;
    const p = clamp(S.gazeHoldAccum / S.gazeHoldMs, 0, 1);
    gazeMark(best, p);

    if (S.gazeHoldAccum >= S.gazeHoldMs){
      // fire!
      gazeUnmark(S.gazeUid);
      gazeReset();
      shootAtCrosshair();
    }

    S.gazeTimer = setTimeout(gazeTick, 70);
  }

  // ============ Adaptive ============
  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    if (S.endPolicy !== 'miss' && S.left <= 0){
      endGame('time');
      return;
    }

    if (S.runMode === 'play'){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.65) * 1.2 + comboHeat * 0.8, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.75, 0, 1);
      S.heat = heat;

      S.spawnMs = clamp(base.spawnMs - heat * 340, 360, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 460, 1020, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.84, 1.12);
      S.junkP   = clamp(base.junk    + heat * 0.08, 0.08, 0.28);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

      // combo decay
      if (S.combo > 0 && S.lastHitAt > 0){
        const idle = (now() - S.lastHitAt) / 1000;
        if (idle >= 2.1){
          S.combo = Math.max(0, S.combo - 1);
          updateScore();
          S.lastHitAt = now();
        }
      }

      // Rage schedule
      if (!S.rageNext) S.rageNext = now() + 9000;
      if (now() >= S.rageNext){
        const dur = clamp(1600 + heat*900, 1500, 2600);
        S.rageUntil = now() + dur;
        const gap = clamp(13000 - heat*5000, 7500, 15000);
        S.rageNext = now() + gap;

        judge('warn', 'RAGE WAVE!');
        coach('happy', 'Rage มาแล้ว! เล็งเร็วขึ้น 😈', 'หลบขยะให้ได้!');
        logEvent('rage_start', { durMs: dur|0, gapMs: gap|0, heat: Math.round(heat*100) });
      }

      // Boss schedule
      if (!S.bossNext) S.bossNext = now() + 12000;
      if (!S.bossOn && now() >= S.bossNext){
        bossStart();
      }

      // fairness: if fever too high => slight assist
      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.24);
        S.size  = clamp(S.size + 0.03, 0.84, 1.16);
      }

    } else {
      S.heat = 0;
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    }

    // mini timeout check
    if (S.miniActive && S.miniActive.until && now() > S.miniActive.until){
      miniFail('หมดเวลา');
    }

    // boss ui tick when boss is on
    if (S.bossOn){
      const left = Math.max(0, (S.bossUntil - now())/1000);
      const hpPct = (S.bossHPMax > 0) ? (S.bossHP / S.bossHPMax) * 100 : 0;
      bossUISet(true, hpPct, left, 'BOSS WAVE 👹');
    }

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  // ============ Inputs ============
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
    bossUISet(false, 0, 0, '');
    clearAllTargets();

    const summary = makeSummary(S, reason);
    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');
  }

  function start(){
    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.left = timeSec;

    S.score = 0; S.combo = 0; S.comboMax = 0;
    S.misses = 0; S.hitAll = 0; S.hitGood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireGood = 0;
    S.fever = 0; S.shield = 0; updateFever(S.shield, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;
    S.miniFailCount = 0;

    S.warmupUntil = now() + 3000;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    S.rageNext = now() + 9000;
    S.rageUntil = 0;
    S.lastHitAt = now();

    S.bossOn = false;
    S.bossNext = now() + 15000;

    // init mini chain
    miniStart(0);

    coach('neutral',
      'พร้อมลุย! โหมดนี้ “โหดจริง” : มี GAZE ยิงออโต้ + No-Junk + บอส 😈',
      `จบเกม: ${endPolicy} • MISS ${S.missLimit} • seed=${S.seed}`
    );

    updateScore(); updateTime(); updateQuest();

    logEvent('session_start', {
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec,
      missLimit: S.missLimit,
      gaze: (!gazeOff ? 1 : 0)
    });

    loopSpawn();
    adaptiveTick();
    gazeTick();
  }

  bindInputs();
  bindFlushHard();
  start();

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
    ROOT.GoodJunkVR.bossStart = ()=>bossStart();
  }catch(_){}
}