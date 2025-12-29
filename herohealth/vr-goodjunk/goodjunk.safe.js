// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard + Cardboard Stereo Sync
// ✅ DOM targets on #gj-layer (mono)
// ✅ Cardboard stereo sync: #gj-layerL/#gj-layerR (spawn/hit/expire/remove synced)
// ✅ Warmup 3s (นุ่ม ๆ) แล้ว "เร่งขึ้นเร็ว" แบบเกมจริง (B1+B2)
// ✅ Adaptive เฉพาะ run=play (โหมดธรรมดา) : spawn/ttl/size/maxTargets/junk เพิ่มตามความสามารถ
// ✅ Research mode (run=research) : ยึดตาม diff (ไม่ adapt)
// ✅ คลิก/แตะเป้าได้ + ยิงกลาง (ปุ่มยิง / Space / Enter)
// ✅ miss definition: good expire + junk hit (shield block ไม่เป็น miss)
// ✅ last summary -> localStorage HHA_LAST_SUMMARY (and hha_last_summary)
// ✅ flush-hardened: end/backhub/pagehide/visibilitychange (best effort)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
}

function qs(name, def){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}

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

// optional modules (best effort)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || {
    set(){},
    get(){ return { value:0, state:'low', shield:0 }; },
    setShield(){}
  };

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

  await Promise.race([
    Promise.all(tasks),
    new Promise(res=>setTimeout(res, 260))
  ]);
}

function logEvent(type, data){
  emit('hha:log_event', { type, data: data || {} });
  try{ if (typeof ROOT.hhaLogEvent === 'function') ROOT.hhaLogEvent(type, data||{}); }catch(_){}
}

// -------------------- UI helpers --------------------
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
  if (diff === 'easy') {
    return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7 };
  }
  if (diff === 'hard') {
    return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  }
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

// -------------------- CSS injection (กัน "เป้าไม่โผล่") --------------------
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-stage{ position:fixed; inset:0; overflow:hidden; }
    /* สำคัญ: ต้องเป็น auto ไม่งั้นลูกโดนไม่ได้ */
    #gj-layer, #gj-layerL, #gj-layerR{ position:absolute; inset:0; z-index:30; pointer-events:auto; touch-action:none; }

    /* fallback targets */
    .gj-target{
      position:absolute;
      left: var(--x, 50vw);
      top:  var(--y, 50vh);
      transform: translate(-50%,-50%) scale(var(--s, 1));
      width: 74px; height: 74px;
      border-radius: 999px;
      display:flex; align-items:center; justify-content:center;
      font-size: 38px; line-height:1;
      user-select:none; -webkit-user-select:none;
      pointer-events:auto; touch-action: manipulation;
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

// -------------------- spawn rect avoid HUD --------------------
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

function randPos(rng, safeMargins){
  const W = ROOT.innerWidth || 360;
  const H = ROOT.innerHeight || 640;

  let top = safeMargins?.top ?? 120;
  let bottom = safeMargins?.bottom ?? 170;
  let left = safeMargins?.left ?? 22;
  let right = safeMargins?.right ?? 22;

  // relax if too tight
  if ((W - left - right) < 180){ left = 12; right = 12; }
  if ((H - top - bottom) < 260){ top = Math.max(90, top - 24); bottom = Math.max(130, bottom - 24); }

  const avoid = buildAvoidRects();

  for (let i=0;i<18;i++){
    const x = left + rng() * (W - left - right);
    const y = top + rng() * (H - top - bottom);
    let ok = true;
    for (const r of avoid){
      if (pointInRect(x, y, { left:r.left-8, right:r.right+8, top:r.top-8, bottom:r.bottom+8 })){
        ok = false; break;
      }
    }
    if (ok) return { x, y };
  }

  return {
    x: left + rng() * (W - left - right),
    y: top + rng() * (H - top - bottom)
  };
}

// -------------------- engine --------------------
const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.setProperty('--x', px);
  el.style.setProperty('--y', py);
  // fallback
  el.style.left = px;
  el.style.top  = py;
}

function getCrosshairCenter(crosshairEl){
  if (!crosshairEl) {
    return { x: (ROOT.innerWidth||360)*0.5, y: (ROOT.innerHeight||640)*0.5 };
  }
  try{
    const r = crosshairEl.getBoundingClientRect();
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
  if (!layerEl) return null;
  const r2max = radiusPx * radiusPx;
  const list = layerEl.querySelectorAll('.gj-target');
  let best = null;
  let bestD2 = 1e18;

  list.forEach(el=>{
    try{
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top + r.height/2;
      const d2 = dist2(cx, cy, tx, ty);
      if (d2 <= r2max && d2 < bestD2){
        best = el; bestD2 = d2;
      }
    }catch(_){}
  });

  return best;
}

function updateFever(shield, fever){
  try{
    FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) });
  }catch(_){}
  try{
    if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9));
  }catch(_){}
}

function makeSummary(S, reason){
  const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
  const grade = rankFromAcc(acc);

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
    grade,

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

// -------------------- exported boot --------------------
export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerMono = opts.layerEl || DOC.getElementById('gj-layer');
  const layerL = DOC.getElementById('gj-layerL');
  const layerR = DOC.getElementById('gj-layerR');
  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const crosshairEl = DOC.getElementById('gj-crosshair');

  if (!layerMono && !(layerL && layerR)){
    console.warn('[GoodJunkVR] missing #gj-layer and stereo layers');
    return;
  }

  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase();
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const view = String(opts.view || qs('view','')).toLowerCase(); // 'cardboard' enables stereo
  const stereoOn = (view === 'cardboard') && !!(layerL && layerR);

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};

  // ---------- stereo group map ----------
  // gid -> { type, emoji, ttl, els:{m,l,r} }
  const groups = new Map();
  let gidSeq = 1;

  function activeLayers(){
    if (stereoOn) return { m:null, l:layerL, r:layerR };
    return { m:layerMono, l:null, r:null };
  }

  function countTargets(){
    const L = activeLayers();
    try{
      const base = (L.m ? L.m.querySelectorAll('.gj-target').length : 0);
      // stereo: นับจากตาซ้ายพอ (เพราะคู่เท่ากัน)
      if (stereoOn && L.l) return L.l.querySelectorAll('.gj-target').length;
      return base;
    }catch(_){ return 0; }
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
  function updateQuest(){
    const goalTitle = `เก็บของดีให้ครบ`;
    const goalNow = S.goalsCleared;
    const goalTotal = S.goalsTotal;

    const miniTitle = `คอมโบมาแล้ว!`;
    const miniNow = S.miniCleared;
    const miniTotal = S.miniTotal;

    emit('quest:update', {
      goalTitle: `Goal: ${goalTitle}`,
      goalNow, goalTotal,
      miniTitle: `Mini: ${miniTitle}`,
      miniNow, miniTotal,
      miniLeftMs: 0
    });

    emit('quest:progress', {
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal
    });
  }

  // state
  const S = {
    running:false,
    ended:false,
    flushed:false,

    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,
    view, stereoOn,

    tStart:0,
    left: timeSec,

    score:0,
    combo:0,
    comboMax:0,

    misses:0,           // miss = good expire + junk hit (unblocked)
    hitAll:0,
    hitGood:0,
    hitJunk:0,
    hitJunkGuard:0,
    expireGood:0,

    fever: 0,
    shield: 0,

    goalsCleared: 0,
    goalsTotal: 2,
    miniCleared: 0,
    miniTotal: 7,

    warmupUntil: 0,
    spawnTimer: 0,
    tickTimer: 0,

    spawnMs: 900,
    ttlMs: 2000,
    size: 1.0,
    junkP: 0.15,
    powerP: 0.03,
    maxTargets: 8
  };

  // set base
  const base = diffBase(diff);
  S.spawnMs = base.spawnMs;
  S.ttlMs = base.ttlMs;
  S.size = base.size;
  S.junkP = base.junk;
  S.powerP = base.power;
  S.maxTargets = base.maxT;

  // mobile adjust
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
    safeMargins.left = Math.max(18, safeMargins.left);
    safeMargins.right = Math.max(18, safeMargins.right);
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
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

  function removeGroup(gid){
    const g = groups.get(gid);
    if (!g) return;
    try{ clearTimeout(g.ttl); }catch(_){}
    const els = g.els || {};
    const arr = [els.m, els.l, els.r].filter(Boolean);
    arr.forEach(el=>{
      try{ el.classList.add('hit'); }catch(_){}
    });
    setTimeout(()=>{
      arr.forEach(el=>{ try{ el.remove(); }catch(_){ } });
    }, 140);
    groups.delete(gid);
  }

  function expireGroup(gid){
    const g = groups.get(gid);
    if (!g) return;
    const tp = String(g.type||'');
    const anyEl = (g.els && (g.els.m || g.els.l || g.els.r)) || null;

    if (tp === 'good'){
      S.misses++;
      S.expireGood++;
      S.combo = 0;

      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever(S.shield, S.fever);

      judge('warn', 'MISS (หมดเวลา)!');
      updateScore();
      updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(g.emoji||'') });
    }

    const els = g.els || {};
    [els.m, els.l, els.r].filter(Boolean).forEach(el=>{
      try{ el.classList.add('out'); }catch(_){}
    });
    setTimeout(()=>{
      [els.m, els.l, els.r].filter(Boolean).forEach(el=>{ try{ el.remove(); }catch(_){ } });
    }, 160);

    groups.delete(gid);
  }

  function hitGood(gid, elForFx){
    const g = groups.get(gid);
    if (!g) return;

    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);

    if (elForFx) burstAtEl(elForFx, 'good');
    logEvent('hit', { kind:'good', emoji:String(g.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();

    if (S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2); // 4,6,8,10...
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! +${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! ดีมาก 🔥`, `ทำคอมโบต่อได้อีก!`);
        updateQuest();
      }
    }
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8); // 10,18
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

    removeGroup(gid);
  }

  function hitShield(gid, elForFx){
    const g = groups.get(gid);
    if (!g) return;

    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    S.score += 70;
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });

    if (elForFx) burstAtEl(elForFx, 'shield');
    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore();
    updateQuest();
    removeGroup(gid);
  }

  function hitStar(gid, elForFx){
    const g = groups.get(gid);
    if (!g) return;

    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 140;
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });

    if (elForFx) burstAtEl(elForFx, 'star');
    logEvent('hit', { kind:'star', emoji:String(g.emoji||'⭐') });

    updateScore();
    updateQuest();
    removeGroup(gid);
  }

  function hitJunk(gid, elForFx){
    const g = groups.get(gid);
    if (!g) return;

    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      if (elForFx) burstAtEl(elForFx, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(g.emoji||'') });

      updateScore();
      updateQuest();
      removeGroup(gid);
      return;
    }

    S.hitJunk++;
    S.misses++;
    S.combo = 0;

    const penalty = 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    if (elForFx) burstAtEl(elForFx, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(g.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();
    removeGroup(gid);
  }

  function hitByGid(gid, elForFx){
    if (!S.running || S.ended) return;
    const g = groups.get(gid);
    if (!g) return;
    const tp = String(g.type||'');
    if (tp === 'good') return hitGood(gid, elForFx);
    if (tp === 'junk') return hitJunk(gid, elForFx);
    if (tp === 'shield') return hitShield(gid, elForFx);
    if (tp === 'star') return hitStar(gid, elForFx);
  }

  function makeTargetEl(type, emoji, x, y, s, eyeTag){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    if (eyeTag) el.dataset.eye = eyeTag;

    // fallback styles
    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const gid = Number(el.dataset.gid||0) || 0;
      if (gid) hitByGid(gid, el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function spawnGroup(type, emoji, x, y, s){
    const gid = gidSeq++;
    const L = activeLayers();

    const els = { m:null, l:null, r:null };

    // create els
    if (L.m){
      const e = makeTargetEl(type, emoji, x, y, s, 'm');
      e.dataset.gid = String(gid);
      els.m = e;
    }
    if (L.l){
      const e = makeTargetEl(type, emoji, x, y, s, 'l');
      e.dataset.gid = String(gid);
      els.l = e;
    }
    if (L.r){
      const e = makeTargetEl(type, emoji, x, y, s, 'r');
      e.dataset.gid = String(gid);
      els.r = e;
    }

    // commit group
    const g = { gid, type, emoji, els, ttl:null };
    g.ttl = setTimeout(()=> expireGroup(gid), S.ttlMs);
    groups.set(gid, g);

    // append to DOM (สำคัญ: append หลัง groups.set เพื่อกัน event race)
    try{ if (els.m) L.m.appendChild(els.m); }catch(_){}
    try{ if (els.l) L.l.appendChild(els.l); }catch(_){}
    try{ if (els.r) L.r.appendChild(els.r); }catch(_){}

    logEvent('spawn', { kind:type, emoji:String(emoji||''), stereo: !!stereoOn });
  }

  function spawnOne(){
    if (!S.running || S.ended) return;

    if (countTargets() >= S.maxTargets) return;

    const p = randPos(S.rng, safeMargins);

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let tp = 'good';
    const r = S.rng();

    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);

    if (tp === 'good'){  spawnGroup('good',   pick(S.rng, GOOD),  p.x, p.y, size); return; }
    if (tp === 'junk'){  spawnGroup('junk',   pick(S.rng, JUNK),  p.x, p.y, size * 0.98); return; }
    if (tp === 'shield'){spawnGroup('shield', SHIELD,             p.x, p.y, size * 1.03); return; }
    if (tp === 'star'){  spawnGroup('star',   pick(S.rng, STARS), p.x, p.y, size * 1.02); return; }
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;

    spawnOne();

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let nextMs = S.spawnMs;
    if (inWarm) nextMs = Math.max(980, S.spawnMs + 240);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 380, 1400));
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    if (S.left <= 0){
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

      S.spawnMs = clamp(base.spawnMs - heat * 320, 420, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.12);
      S.junkP   = clamp(base.junk    + heat * 0.07, 0.08, 0.25);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBase = base.maxT;
      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(maxBase + maxBonus, 5, isMobileLike() ? 11 : 13);

      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.22);
        S.size  = clamp(S.size + 0.03, 0.86, 1.15);
      }
    } else {
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    }

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  // ยิงกลาง (crosshair)
  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const c = getCrosshairCenter(crosshairEl);
    const r = isMobileLike() ? 62 : 52;

    // เลือก layer ที่ “active” เพื่อหาเป้าที่ใกล้ crosshair
    const L = activeLayers();
    let el = null;

    if (L.m) el = findTargetNear(L.m, c.x, c.y, r);
    else {
      // cardboard: หาใกล้สุดจากตาซ้ายก่อน (เท่ากัน)
      el = findTargetNear(L.l, c.x, c.y, r) || findTargetNear(L.r, c.x, c.y, r);
    }

    if (el) {
      const gid = Number(el.dataset.gid||0) || 0;
      if (gid) hitByGid(gid, el);
    } else {
      if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
      updateScore();
    }
  }

  function bindInputs(){
    if (shootEl){
      shootEl.addEventListener('click', (e)=>{
        e.preventDefault?.();
        shootAtCrosshair();
      });
      shootEl.addEventListener('pointerdown', (e)=>{
        e.preventDefault?.();
      }, { passive:false });
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
      stage.addEventListener('click', (e)=>{
        if (isMobileLike()) return;
        shootAtCrosshair();
      });
    }
  }

  function bindFlushHard(){
    ROOT.addEventListener('pagehide', ()=>{
      try{ flushAll(makeSummary(S, 'pagehide'), 'pagehide'); }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ flushAll(makeSummary(S, 'hidden'), 'hidden'); }catch(_){}
      }
    }, { passive:true });
  }

  function clearAllTargets(){
    try{
      // clear timers + dom via groups
      for (const [gid, g] of groups.entries()){
        try{ clearTimeout(g.ttl); }catch(_){}
        const els = g.els || {};
        [els.m, els.l, els.r].filter(Boolean).forEach(el=>{ try{ el.remove(); }catch(_){ } });
      }
      groups.clear();
    }catch(_){}
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
  }

  // -------------------- start --------------------
  function start(){
    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.left = timeSec;

    S.score = 0;
    S.combo = 0;
    S.comboMax = 0;

    S.misses = 0;
    S.hitAll = 0;
    S.hitGood = 0;
    S.hitJunk = 0;
    S.hitJunkGuard = 0;
    S.expireGood = 0;

    S.fever = 0;
    S.shield = 0;
    updateFever(S.shield, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;

    S.warmupUntil = now() + 3000;

    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    const viewMsg = S.stereoOn ? 'Cardboard (2 จอ)' : (isMobileLike() ? 'Mobile' : 'PC');
    coach('neutral', `พร้อมลุย! (${viewMsg}) ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈`, 'เล็งกลางแล้วกดยิง / แตะเป้าก็ได้');
    updateScore();
    updateTime();
    updateQuest();

    logEvent('session_start', {
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec,
      view: S.view,
      stereo: !!S.stereoOn
    });

    loopSpawn();
    adaptiveTick();
  }

  bindInputs();
  bindFlushHard();

  // start now
  start();

  // expose minimal API
  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
    ROOT.GoodJunkVR.isStereo = ()=>!!S.stereoOn;
  }catch(_){}
}