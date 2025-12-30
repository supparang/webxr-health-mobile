// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard (DUAL-EYE READY) — v3 START-GATED + BOSS P2 FAKE100 + LAST5 SFX

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
function diffBase(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7 };
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

/* ===== SFX: tick + heartbeat (WebAudio) ===== */
function makeSFX(){
  let ctx = null;
  let unlocked = false;

  function ensure(){
    if (ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  async function unlock(){
    const c = ensure();
    if (!c) return;
    try{
      if (c.state === 'suspended') await c.resume();
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      o.frequency.value = 440;
      o.connect(g); g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.02);
      unlocked = true;
    }catch(_){}
  }

  function beep(freq=880, dur=0.05, vol=0.05, type='square'){
    const c = ensure();
    if (!c) return;
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;

      const t0 = c.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      o.connect(g); g.connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.01);
    }catch(_){}
  }

  function tick(intense=false){
    beep(intense ? 980 : 860, intense ? 0.045 : 0.05, intense ? 0.07 : 0.055, 'square');
  }

  function heartbeat(intense=false){
    beep(intense ? 150 : 120, 0.07, intense ? 0.09 : 0.07, 'sine');
    setTimeout(()=>beep(intense ? 170 : 140, 0.06, intense ? 0.07 : 0.055, 'sine'), 130);
  }

  return { unlock, tick, heartbeat, get unlocked(){ return unlocked; } };
}

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
    .gj-target.fake{
      /* FAKE GOOD LOOK: make junk look like good */
      border-color: rgba(34,197,94,.22) !important;
      filter: saturate(1.05) !important;
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
    DOC.getElementById('hhaFever'),
    DOC.querySelector('.hud-peek')
  ].filter(Boolean);

  for (const el of els){
    try{
      const r = el.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) rects.push(r);
    }catch(_){}
  }
  return rects;
}
function pointInRect(x, y, r){ return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }

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

const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

/* boss face-good set */
const BOSS_GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];

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
  if (!DOC) return null;

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
    return null;
  }

  const dual = !!layerR;
  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 18, right: 18 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase();
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};
  const base = diffBase(diff);

  const S = {
    running:false, ended:false, flushed:false, started:false,
    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,
    tStart:0, left: timeSec,
    score:0, combo:0, comboMax:0,
    misses:0, hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,

    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:3,

    warmupUntil:0,
    spawnTimer:0, tickTimer:0,

    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,

    uidSeq: 1,

    // boss mini state (ท้ายเกม)
    boss: {
      active:false,
      phase:0,
      tEnd:0,
      tPhase2:0,
      badNeed: 3,    // โดนหลอกครบ 3 = FAIL
      badHit: 0,
      goodHit: 0,
      _tickNextAt: 0,
      _hbNextAt: 0
    },

    sfx: makeSFX()
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
    safeMargins.left = Math.max(12, safeMargins.left);
    safeMargins.right = Math.max(12, safeMargins.right);
  }

  function setBossClasses(){
    DOC.body.classList.toggle('boss-last5', S.boss.active && (S.boss.tEnd - now() <= 5000));
    DOC.body.classList.toggle('boss-p2', S.boss.active && S.boss.phase === 2);
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

  function updateQuest(miniLeftMs=0){
    const m = S.boss;
    const miniTitle = m.active
      ? (m.phase === 2 ? `Mini: BOSS P2 (FakeGood 100%) ห้ามโดนหลอก ≥ ${m.badNeed}` : `Mini: BOSS P1 คัดแยก! ห้ามพลาด ≥ ${m.badNeed}`)
      : `Mini: ทำคอมโบให้ถึงเป้า`;

    const miniNow = S.miniCleared;
    const miniTotal = S.miniTotal;

    const goalTitle = `Goal: เก็บของดีให้ครบ`;
    const goalNow = S.goalsCleared;
    const goalTotal = S.goalsTotal;

    emit('quest:update', {
      goalTitle,
      goalNow, goalTotal,
      miniTitle,
      miniNow, miniTotal,
      miniLeftMs: Math.max(0, miniLeftMs|0)
    });

    emit('quest:progress', {
      goalsCleared: goalNow, goalsTotal: goalTotal,
      miniCleared: miniNow, miniTotal: miniTotal
    });
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
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
    }
    el.classList.add('out');
    const mate = getMate(el);
    if (mate) mate.classList.add('out');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      if (mate){ try{ mate.remove(); }catch(_){ } }
    }, 160);
  }

  function makeTarget(type, emoji, x, y, s, uid, extraClass=''){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}${extraClass ? ' '+extraClass : ''}`;
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

  function endBossIfNeeded(){
    if (!S.boss.active) return;

    const t = now();
    if (t >= S.boss.tEnd){
      // PASS if badHit < badNeed
      if (S.boss.badHit < S.boss.badNeed){
        S.miniCleared = Math.min(S.miniTotal, S.miniCleared + 1);
        emit('hha:celebrate', { kind:'mini', title:`BOSS ผ่าน! (${S.miniCleared}/${S.miniTotal})` });
        coach('happy', 'BOSS ผ่านแล้ว! สุดยอด 🔥', 'คุมสติ + ความแม่น');
      } else {
        emit('hha:celebrate', { kind:'mini', title:'BOSS FAIL!' });
        coach('sad', 'โดนหลอกเยอะไป 😵', 'ลองใหม่! ระวังตัวหลอก');
      }

      S.boss.active = false;
      S.boss.phase = 0;
      DOC.body.classList.remove('boss-last5','boss-p2');
      updateQuest(0);

      // optional: end policy miss/boss fail can end game
      if (endPolicy === 'all'){
        // keep playing until time ends (หรือคุณจะเลือก end ได้)
      }
    }
  }

  function hitGood(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtEl(el, 'good');

    if (S.boss.active){
      S.boss.goodHit++;
    }

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();

    // goals
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8);
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', `Goal ผ่านแล้ว!`, `คุมความแม่น + หลีกขยะ`);
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
    updateFever(S.shield, S.fever);

    S.score += 70;
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

    const pts = 140;
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    burstAtEl(el, 'star');
    logEvent('hit', { kind:'star', emoji:String(el.dataset.emoji||'⭐') });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitJunk(el){
    S.hitAll++;

    // boss bad hit count (even if shield blocks? — ตรงนี้ “ไม่นับ miss ถ้า shield บล็อก” ตามมาตรฐานคุณ)
    if (S.boss.active){
      // จะนับเฉพาะตอนทะลุโล่ (fair)
    }

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++;
    S.misses++;
    S.combo = 0;

    if (S.boss.active){
      S.boss.badHit++;
      if (S.boss.badHit >= S.boss.badNeed){
        // boss fail pressure
        coach('sad', 'โดนหลอกเยอะแล้ว!', `BAD ${S.boss.badHit}/${S.boss.badNeed}`);
      }
    }

    const penalty = 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();
    removeTargetBoth(el);
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
    if (countTargets(layerL) >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let tp = 'good';
    let emoji = '✨';
    let extra = '';
    const uid = String(S.uidSeq++);

    const bossOn = S.boss.active;
    if (bossOn){
      // Boss: phase1 mix good/junk, phase2 fake-good 100%
      const m = S.boss;
      const isBad = (S.rng() < (m.phase === 2 ? 0.42 : 0.34));

      if (isBad){
        tp = 'junk';
      } else {
        tp = 'good';
      }

      // Phase 2: Fake Good 100% (BAD looks like GOOD)
      if (m.phase === 2){
        emoji = pick(S.rng, BOSS_GOOD);
        if (isBad) extra = 'fake';
      } else {
        emoji = isBad ? pick(S.rng, JUNK) : pick(S.rng, GOOD);
      }
    } else {
      const r = S.rng();
      const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
      const junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

      if (r < powerP) tp = 'shield';
      else if (r < powerP + 0.035) tp = 'star';
      else if (r < powerP + 0.035 + junkP) tp = 'junk';
      else tp = 'good';

      emoji =
        (tp === 'good') ? pick(S.rng, GOOD) :
        (tp === 'junk') ? pick(S.rng, JUNK) :
        (tp === 'star') ? pick(S.rng, STARS) :
        SHIELD;
    }

    const size = (inWarm ? (S.size * 1.06) : S.size);
    const s =
      (tp === 'junk') ? (size * 0.98) :
      (tp === 'shield') ? (size * 1.03) :
      (tp === 'star') ? (size * 1.02) :
      size;

    const pL = randPosEye(S.rng, safeMargins, 0, dual);
    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid, extra);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosEye(S.rng, safeMargins, 1, dual);
      const elR = makeTarget(tp, emoji, pR.x, pL.y, s, uid, extra);
      layerR.appendChild(elR);
    }

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid, boss: bossOn ? { phase:S.boss.phase, fake: !!extra } : null });
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

  function maybeStartBoss(){
    if (S.boss.active) return;

    // boss starts near end: last 14s (p1 7s, p2 7s)
    if (S.left <= 14){
      const t = now();
      S.boss.active = true;
      S.boss.phase = 1;
      S.boss.tEnd = t + 14000;
      S.boss.tPhase2 = t + 7000;
      S.boss.badHit = 0;
      S.boss.goodHit = 0;
      S.boss._tickNextAt = 0;
      S.boss._hbNextAt = 0;

      coach('neutral', 'BOSS มาแล้ว! คัดแยกให้ดี 😈', `ห้ามโดนหลอกถึง ${S.boss.badNeed} ครั้ง`);
      emit('hha:celebrate', { kind:'mini', title:'BOSS INCOMING!' });
      updateQuest(14000);
      setBossClasses();
    }
  }

  function bossTick(){
    if (!S.boss.active) return;

    const t = now();
    if (t >= S.boss.tPhase2 && S.boss.phase === 1){
      S.boss.phase = 2; // FakeGood 100%
      coach('warn', 'BOSS P2: ของดีเต็มจอ… แต่มีหลอก!', `ระวัง! ห้ามโดนหลอก ≥ ${S.boss.badNeed}`);
      setBossClasses();
      updateQuest(Math.max(0, S.boss.tEnd - t));
    }

    const leftMs = Math.max(0, S.boss.tEnd - t);
    updateQuest(leftMs);

    // last5 pressure: tick + heartbeat
    const last5 = leftMs <= 5000;
    const last2 = leftMs <= 2000;
    if (last5){
      setBossClasses();
      const intense = (S.boss.phase === 2) || last2;

      const gap = last2 ? 140 : 260;
      if (t >= (S.boss._tickNextAt||0)){
        S.boss._tickNextAt = t + gap;
        try{ S.sfx && S.sfx.tick(intense); }catch(_){}
      }
      if (t >= (S.boss._hbNextAt||0)){
        S.boss._hbNextAt = t + (last2 ? 520 : 820);
        try{ S.sfx && S.sfx.heartbeat(intense); }catch(_){}
      }
    }
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    // countdown
    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    if (S.left <= 0){ endGame('time'); return; }

    // start boss near end
    maybeStartBoss();

    // boss update
    bossTick();
    endBossIfNeeded();

    // difficulty adapt (play only)
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

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

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

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const radius = isMobileLike() ? 62 : 52;

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

    DOC.body.classList.remove('boss-last5','boss-p2');

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
    if (S.running || S.ended) return;
    S.started = true;
    S.running = true;
    S.ended = false;
    S.flushed = false;

    // unlock audio on user gesture path (start button)
    try{ S.sfx && S.sfx.unlock && S.sfx.unlock(); }catch(_){}

    S.tStart = now();
    S.left = timeSec;

    S.score = 0; S.combo = 0; S.comboMax = 0;
    S.misses = 0; S.hitAll = 0; S.hitGood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireGood = 0;
    S.fever = 0; S.shield = 0; updateFever(S.shield, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;

    S.warmupUntil = now() + 3000;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    S.boss.active = false;
    S.boss.phase = 0;

    coach('neutral', 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    updateScore(); updateTime(); updateQuest(0);

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

  // START GATE: don't auto-start unless autoStart=true
  const autoStart = (opts.autoStart !== false);
  if (autoStart) start();

  const api = {
    start,
    endGame,
    shoot: shootAtCrosshair,
    getState: ()=>({ running:S.running, ended:S.ended, left:S.left, boss:{...S.boss} })
  };

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.api = api;
  }catch(_){}

  return api;
}