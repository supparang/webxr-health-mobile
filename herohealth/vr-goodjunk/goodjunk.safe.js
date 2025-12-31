// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard — v3 (Start-Gated via boot.js)
// ✅ DOM emoji targets (dual-eye VR/cVR)
// ✅ Stage-rect spawning (no HUD overlap / no "target behind" bug)
// ✅ HUD events: hha:score, hha:time, quest:update, hha:judge, hha:coach, hha:end
// ✅ FX: Particles burst
// ✅ STUN real (blocks shooting/hits)
// ✅ Waves: Storm + Boss (+ Phase2 enraged + Final Stand)
// ✅ Minis: Combo ladder + Perfect Chain (strict)
// ✅ End policy: time | all | miss (Sudden Death)
// ✅ Quest Peek: #gjPeek overlay (VR friendly)
// ✅ Flush hardened (pagehide/hidden/end) + localStorage last summary

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b,v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail||{} })); }catch(_){ } }
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
  const g = xmur3(String(seed||'seed'));
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
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2300, size: 1.10, junk: 0.12, power: 0.035, maxT: 7, missLimit: 6, bossNeed: 7 };
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9, missLimit: 4, bossNeed: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8, missLimit: 5, bossNeed: 8 };
}

function ensureTargetStyles(){
  if (!DOC || DOC.getElementById('gj-safe-style')) return;
  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    .gj-layer{ position:absolute; inset:0; z-index:30; pointer-events:auto !important; touch-action:none; }
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
    .gj-target.decoy{ border-color: rgba(245,158,11,.30); filter: saturate(1.2); }
    .gj-target.boss{ border-color: rgba(34,197,94,.42); box-shadow: 0 20px 70px rgba(0,0,0,.55); }
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

function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.setProperty('--x', px);
  el.style.setProperty('--y', py);
  el.style.left = px;
  el.style.top  = py;
}

function getRectSafe(el){
  try{
    const r = el.getBoundingClientRect();
    if (r && r.width>0 && r.height>0) return r;
  }catch(_){}
  return null;
}

function getPlayRect(stageEl){
  // 핵: spawn inside stage rect only
  const r = stageEl ? getRectSafe(stageEl) : null;
  if (r) return r;
  return { left:0, top:0, right:(ROOT.innerWidth||360), bottom:(ROOT.innerHeight||640),
           width:(ROOT.innerWidth||360), height:(ROOT.innerHeight||640) };
}

function randPosInStage(rng, stageRect, eye, dual){
  const W = stageRect.width || (ROOT.innerWidth||360);
  const H = stageRect.height || (ROOT.innerHeight||640);

  const eyeW = dual ? (W * 0.5) : W;
  const xBase = stageRect.left + (dual && eye===1 ? eyeW : 0);
  const yBase = stageRect.top;

  // margins inside stage (so targets not stick at edge)
  let left = 16, right = 16, top = 16, bottom = 16;

  // if landscape VR/cVR, lift y a bit (avoid "too low")
  const landscape = (ROOT.innerWidth||360) > (ROOT.innerHeight||640);
  if (dual && landscape){
    top = 10; bottom = 24;
  }

  const x = xBase + left + rng() * Math.max(40, (eyeW - left - right));
  const y = yBase + top  + rng() * Math.max(40, (H    - top  - bottom));

  return { x: x - stageRect.left, y: y - stageRect.top, gx: x, gy: y };
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

/* ---------- micro UX: toast + beep + quest peek ---------- */
function ensureToast(){
  if (!DOC || DOC.getElementById('gjToast')) return;
  const el = DOC.createElement('div');
  el.id = 'gjToast';
  el.style.cssText = `
    position:fixed; left:12px; right:12px;
    bottom: calc(12px + var(--sab,0px) + 92px);
    z-index:100; pointer-events:none;
    display:flex; justify-content:center;
  `;
  el.innerHTML = `<div style="
    min-width: min(520px, 92vw);
    background: rgba(2,6,23,.72);
    border:1px solid rgba(148,163,184,.20);
    border-radius:18px;
    padding:10px 12px;
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
    opacity:0; transform: translateY(10px);
    transition: opacity 160ms ease, transform 160ms ease;
  " id="gjToastCard">
    <div style="font-weight:1000" id="gjToastT">—</div>
    <div style="margin-top:4px; font-weight:900; color: rgba(148,163,184,.95)" id="gjToastS">—</div>
  </div>`;
  DOC.body.appendChild(el);
}
function showToast(title, sub, ms=1400){
  ensureToast();
  const card = DOC.getElementById('gjToastCard');
  const t = DOC.getElementById('gjToastT');
  const s = DOC.getElementById('gjToastS');
  if (!card || !t || !s) return;
  t.textContent = String(title||'');
  s.textContent = String(sub||'');
  card.style.opacity = '1';
  card.style.transform = 'translateY(0)';
  setTimeout(()=>{
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
  }, ms);
}

function beep(freq=520, dur=0.06, gain=0.04){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return;
    const ac = beep._ac || (beep._ac = new AC());
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = freq;
    o.type = 'sine';
    g.gain.value = gain;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }catch(_){}
}

function peekQuest(goalText, miniText, ms=1700){
  const el = DOC.getElementById('gjPeek');
  if (!el) return;
  const g = DOC.getElementById('gjPeekGoal');
  const m = DOC.getElementById('gjPeekMini');
  if (g) g.textContent = String(goalText||'Goal: —');
  if (m) m.textContent = String(miniText||'Mini: —');
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), ms);
}

/* ---------- summary ---------- */
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

/* ---------- STUN + multipliers ---------- */
function isStunned(S){ return now() < (S.stunUntil || 0); }

function setStun(S, ms=1100, why='stun'){
  S.stunUntil = Math.max(S.stunUntil||0, now() + ms);
  if (DOC && DOC.body){
    DOC.body.classList.add('stun');
    setTimeout(()=>{
      if (!DOC.body) return;
      if (!isStunned(S)) DOC.body.classList.remove('stun');
    }, ms + 60);
  }
  beep(220, 0.07, 0.035);
  showToast('STUN!', 'โดนช็อกชั่วคราว ยิงไม่ได้ 😵', 900);
  logEvent('stun', { why, ms });
}

function scoreMultiplier(S){
  const mCombo = clamp((S.combo||0)/20, 0, 1) * 0.8;
  let mRage = 0;
  if (S.wave && S.wave.kind === 'boss'){
    const rage = clamp(S.wave.rage||0, 0, 1);
    mRage = rage * 0.25;
  }
  let mPerfect = 0;
  const M = S.activeMini;
  if (M && M.kind === 'perfect_chain') mPerfect = 0.20;
  return 1 + mCombo + mRage + mPerfect;
}

/* ---------- game data ---------- */
const GOOD   = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK   = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS  = ['⭐','💎'];
const SHIELD = '🛡️';
const DECOY  = '😈';
const BOSS   = '🥦';

export function boot(opts = {}){
  if (!DOC) return;
  ensureTargetStyles();

  const layerL = opts.layerEl || DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer') || DOC.querySelector('.gj-layer');
  const layerR = opts.layerElR || DOC.getElementById('gj-layer-r') || null;
  const crossL = opts.crosshairEl || DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair') || DOC.querySelector('.gj-crosshair');
  const crossR = opts.crosshairElR || DOC.getElementById('gj-crosshair-r') || null;
  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const stageEl = opts.stageEl || DOC.getElementById('gj-stage');

  if (!layerL){ console.warn('[GoodJunkVR] missing layer'); return; }

  const dual = !!layerR;

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase(); // time|all|miss
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));
  const ctx  = opts.context || {};

  const base = diffBase(diff);

  const S = {
    running:false, ended:false, flushed:false,
    diff, runMode, timeSec, seed,
    rng: makeRng(seed),
    endPolicy, challenge,
    tStart:0, left: timeSec,
    score:0, combo:0, comboMax:0,
    misses:0, missLimit: base.missLimit,
    hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,
    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,
    warmupUntil:0,
    spawnTimer:0, tickTimer:0, waveTimer:0,
    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,
    uidSeq: 1,
    stunUntil: 0,
    wave: null,
    activeMini: null,
    stageEl
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.14, S.size + 0.03);
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
    const goalNeed = 10 + (S.goalsCleared * 8);
    const comboNeed = 4 + (S.miniCleared * 2);

    const goalText = `Goal: เก็บของดีรวม ${goalNeed} (ตอนนี้ ${S.hitGood}/${goalNeed})`;
    let miniText = `Mini: ทำคอมโบ ${comboNeed} (ตอนนี้ ${S.combo}/${comboNeed})`;

    if (S.activeMini && S.activeMini.kind === 'perfect_chain'){
      miniText = `Mini: PERFECT ${S.activeMini.cur}/${S.activeMini.need} (ห้ามพลาด!)`;
    }

    emit('quest:update', {
      goalTitle: goalText,
      goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle: miniText,
      miniNow: S.miniCleared, miniTotal: S.miniTotal,
      miniLeftMs: 0
    });
    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });

    // VR friendly: peek quest sometimes
    const b = DOC.body;
    if (b && (b.classList.contains('view-vr') || b.classList.contains('view-cvr'))){
      peekQuest(goalText, miniText, 1200);
    }
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
    try{ clearTimeout(S.waveTimer); }catch(_){}
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
      updateScore(); miniOn('miss_good'); updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(el.dataset.emoji||'') });

      // Sudden death
      if (S.endPolicy === 'miss' && S.misses >= S.missLimit) endGame('miss_limit');
    }
    el.classList.add('out');
    const mate = getMate(el);
    if (mate) mate.classList.add('out');
    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      if (mate){ try{ mate.remove(); }catch(_){ } }
    }, 160);
  }

  function makeTarget(type, emoji, x, y, s, uid){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');

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
    const pts = Math.round(90 * scoreMultiplier(S));
    S.score += pts;
    return pts;
  }

  /* ---------- mini system (strict perfect chain) ---------- */
  function startPerfectMini(){
    S.activeMini = { kind:'perfect_chain', cur:0, need:7, endAt: now()+9000 };
    showToast('PERFECT CHAIN', 'เก็บของดีติดกัน ห้ามพลาด!', 1600);
    coach('happy', 'Perfect Chain เริ่ม!', 'อย่าพลาด/อย่าโดนขยะ');
  }
  function miniOn(ev){
    const M = S.activeMini;
    if (M && M.kind === 'perfect_chain'){
      if (ev === 'junk_hit' || ev === 'miss_good'){
        // fail -> reset
        S.activeMini = null;
        showToast('PERFECT FAIL', 'พลาดแล้ว! เริ่มใหม่รอบหน้า', 1200);
        return;
      }
      if (ev === 'good_hit'){
        M.cur++;
        if (M.cur >= M.need){
          S.miniCleared++;
          emit('hha:celebrate', { kind:'mini', title:`Perfect! ${S.miniCleared}/${S.miniTotal}` });
          showToast('PERFECT!', 'สุดยอด ห้ามพลาดได้จริง 🔥', 1400);
          coach('happy','Perfect ผ่าน!','ต่อไปจะโหดขึ้นอีก');
          S.activeMini = null;
        }
      }
      return;
    }
  }

  function maybeTriggerPerfectMini(){
    if (S.activeMini) return;
    // trigger when player is hot
    if (S.combo >= 10 && S.miniCleared < S.miniTotal && (S.rng() < 0.06)){
      startPerfectMini();
    }
  }

  /* ---------- waves: storm + boss ---------- */
  function waveClear(){
    S.wave = null;
    // restore baseline-ish
    const b = diffBase(S.diff);
    if (S.runMode === 'play'){
      S.spawnMs = b.spawnMs; S.ttlMs = b.ttlMs; S.size = b.size;
      S.junkP = b.junk; S.powerP = b.power; S.maxTargets = b.maxT;
    }
  }

  function startStorm(){
    const durMs = 12000;
    S.wave = {
      kind:'storm',
      startAt: now(),
      endAt: now()+durMs,
      durMs,
    };
    showToast('STORM!', 'เป้าจะถี่ขึ้น + หมดเวลาไวขึ้น', 1600);
    coach('neutral','พายุมาแล้ว!','เล็งให้ไว แต่ต้องแม่น');
    logEvent('wave_start', { kind:'storm', durMs });
  }

  function startBoss(){
    const durMs = 14000;
    const need = diffBase(S.diff).bossNeed + (S.miniCleared>=4 ? 1 : 0);
    S.wave = {
      kind:'boss',
      startAt: now(),
      endAt: now()+durMs,
      durMs,
      need,
      hit: 0,
      rage: 0,
      phase2:false,
      finalStand:false,
      lastDecoyAt: 0
    };
    showToast('BOSS WAVE!', `ยิงบอสให้ครบ ${need} ครั้ง`, 1800);
    coach('neutral','บอสมาแล้ว!','ระวังตัวปลอม โดนแล้ว STUN');
    peekQuest(`Goal: ยิงบอส ${need} ครั้ง`, 'Mini: ระวัง decoy 😈', 1800);
    logEvent('wave_start', { kind:'boss', durMs, need });
  }

  function spawnBossTarget(){
    const W = S.wave;
    if (!W || W.kind!=='boss') return;
    if (countTargets(layerL) >= Math.max(S.maxTargets, 7)) return;

    const stageRect = getPlayRect(stageEl);
    const uid = String(S.uidSeq++);
    const pL = randPosInStage(S.rng, stageRect, 0, dual);
    const s = clamp(S.size*1.18, 0.95, 1.35);

    const elL = makeTarget('boss', BOSS, pL.x, pL.y, s, uid);
    elL.classList.add('boss');
    if (W.phase2) elL.classList.add('rage');
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInStage(S.rng, stageRect, 1, dual);
      const elR = makeTarget('boss', BOSS, pR.x, pL.y, s, uid);
      elR.classList.add('boss');
      if (W.phase2) elR.classList.add('rage');
      layerR.appendChild(elR);
    }
  }

  function spawnDecoy(){
    const W = S.wave;
    if (!W || W.kind!=='boss') return;
    if (countTargets(layerL) >= Math.max(S.maxTargets, 7)) return;

    const stageRect = getPlayRect(stageEl);
    const uid = String(S.uidSeq++);
    const pL = randPosInStage(S.rng, stageRect, 0, dual);
    const s = clamp(S.size*1.08, 0.92, 1.28);

    const elL = makeTarget('decoy', DECOY, pL.x, pL.y, s, uid);
    elL.classList.add('decoy');
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInStage(S.rng, stageRect, 1, dual);
      const elR = makeTarget('decoy', DECOY, pR.x, pL.y, s, uid);
      elR.classList.add('decoy');
      layerR.appendChild(elR);
    }
  }

  function bossTick(){
    const W = S.wave;
    if (!W || W.kind!=='boss') return;

    const leftMs = Math.max(0, W.endAt - now());
    const rage = clamp(1 - (leftMs / W.durMs), 0, 1);
    W.rage = rage;

    if (!W.phase2 && rage >= 0.72){
      W.phase2 = true;
      showToast('BOSS ENRAGED!', 'Phase2: decoy ถี่ขึ้น 😈', 1800);
      coach('neutral','บอสเดือดแล้ว!','โดน decoy = STUN');
      logEvent('boss_phase2', { rage:Number(rage.toFixed(3)) });
    }

    // final stand last 3s
    if (!W.finalStand && leftMs <= 3000){
      W.finalStand = true;
      showToast('FINAL STAND!', '3 วิท้าย ห้ามพลาดเด็ดขาด!', 1500);
      beep(740, 0.07, 0.05);
      logEvent('boss_final_stand', {});
    }

    // decoy frequency
    const gap = W.phase2 ? 650 : (rage >= 0.58 ? 1100 : 1600);
    if (rage >= 0.58){
      if (!W.lastDecoyAt || (now() - W.lastDecoyAt) > gap){
        W.lastDecoyAt = now();
        spawnDecoy();
        if (W.phase2 && (S.rng() < 0.38)) spawnDecoy();
      }
    }

    // keep boss target on board
    if (S.rng() < 0.22) spawnBossTarget();

    // timeout fail
    if (leftMs <= 0){
      showToast('WAVE FAIL', 'BOSS TIMEOUT!', 1400);
      coach('sad','บอสหนีไปแล้ว 😵','เดี๋ยวมาใหม่!');
      logEvent('wave_fail', { kind:'boss', reason:'timeout' });
      waveClear();
    }
  }

  /* ---------- hits ---------- */
  function hitGood(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtEl(el, 'good');

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    miniOn('good_hit');
    maybeTriggerPerfectMini();

    // goal clear
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8);
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy','Goal ผ่าน!','คุมความแม่น + หลีกขยะ');
        showToast('GOAL!', `ผ่านแล้ว ${S.goalsCleared}/${S.goalsTotal}`, 1200);
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

    S.score += Math.round(70 * scoreMultiplier(S));
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    burstAtEl(el, 'shield');
    logEvent('hit', { kind:'shield', shield:S.shield|0 });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitStar(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = Math.round(140 * scoreMultiplier(S));
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    burstAtEl(el, 'star');
    logEvent('hit', { kind:'star', pts });

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitJunkCore(el, why='junk'){
    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:why });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++; S.misses++; S.combo = 0;
    miniOn('junk_hit');

    const penalty = 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', `${why.toUpperCase()}! -${penalty}`);
    coach('sad', 'พลาดแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    burstAtEl(el, 'junk');
    setStun(S, why==='decoy'?1400:1150, why);

    logEvent('hit', { kind:why, score:S.score|0, fever:Math.round(S.fever) });

    // boss final stand punishment
    if (S.wave && S.wave.kind==='boss' && S.wave.finalStand){
      showToast('FINAL STAND FAIL', '3 วิท้ายห้ามพลาด! โดน SUPER STUN', 1600);
      setStun(S, 1800, 'final_stand');
      logEvent('boss_final_fail', { why });
    }

    updateScore(); updateQuest();
    removeTargetBoth(el);

    // Sudden death
    if (S.endPolicy === 'miss' && S.misses >= S.missLimit) endGame('miss_limit');
  }

  function hitBoss(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const W = S.wave;
    if (W && W.kind==='boss'){
      W.hit++;
      const pts = Math.round(160 * scoreMultiplier(S));
      S.score += pts;

      judge('good', `BOSS +${pts}`);
      burstAtEl(el, 'good');
      logEvent('boss_hit', { hit:W.hit, need:W.need, rage:Number((W.rage||0).toFixed(3)) });

      if (W.hit >= W.need){
        showToast('BOSS CLEAR!', 'สุดยอด! ผ่านบอสแล้ว 🥦', 1600);
        emit('hha:celebrate', { kind:'goal', title:'BOSS CLEAR!' });
        coach('happy','ผ่านบอส!','เตรียม wave ต่อไป');
        logEvent('wave_clear', { kind:'boss' });
        waveClear();
      }
    }

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    if (isStunned(S)) return;

    const tp = String(el.dataset.type||'');
    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunkCore(el,'junk');
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
    if (tp === 'decoy') return hitJunkCore(el,'decoy');
    if (tp === 'boss') return hitBoss(el);
  }

  /* ---------- spawn core ---------- */
  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets(layerL) >= S.maxTargets) return;

    // if boss wave active, prioritize boss/decoy handling in bossTick
    const W = S.wave;
    if (W && W.kind==='boss'){
      if (S.rng() < 0.25) spawnBossTarget();
      return;
    }

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

    const stageRect = getPlayRect(stageEl);
    const uid = String(S.uidSeq++);
    const pL = randPosInStage(S.rng, stageRect, 0, dual);

    const emoji =
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'star') ? pick(S.rng, STARS) :
      SHIELD;

    const size = (inWarm ? (S.size * 1.06) : S.size);
    const s =
      (tp === 'junk') ? (size * 0.98) :
      (tp === 'shield') ? (size * 1.03) :
      (tp === 'star') ? (size * 1.02) :
      size;

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInStage(S.rng, stageRect, 1, dual);
      const elR = makeTarget(tp, emoji, pR.x, pL.y, s, uid);
      layerR.appendChild(elR);
    }

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    spawnOne();

    const t = now();
    const inWarm = (t < S.warmupUntil);
    let nextMs = S.spawnMs;
    if (inWarm) nextMs = Math.max(980, S.spawnMs + 240);

    // storm intensifies
    if (S.wave && S.wave.kind==='storm') nextMs = Math.max(420, nextMs - 220);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 380, 1400));
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();
    if (S.left <= 0){ endGame('time'); return; }

    // wave update
    if (S.wave && S.wave.kind==='storm'){
      const leftMs = S.wave.endAt - now();
      if (leftMs <= 0){
        showToast('STORM END', 'กลับสู่โหมดปกติ', 1100);
        waveClear();
      }else{
        // make it hotter
        S.ttlMs = clamp(base.ttlMs - 520, 980, 2600);
        S.spawnMs = clamp(base.spawnMs - 260, 420, 1200);
        S.junkP = clamp(base.junk + 0.05, 0.08, 0.28);
        S.size = clamp(base.size - 0.06, 0.84, 1.14);
      }
    }
    if (S.wave && S.wave.kind==='boss'){
      bossTick();
    }

    // adaptive only in play & not in boss/storm overriding too much
    if (S.runMode === 'play' && (!S.wave || S.wave.kind!=='boss')){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.65) * 1.2 + comboHeat * 0.8, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.75, 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * 320, 420, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.14);
      S.junkP   = clamp(base.junk    + heat * 0.07, 0.08, 0.25);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.22);
        S.size  = clamp(S.size + 0.03, 0.86, 1.16);
      }
    }

    // schedule waves (play mode only)
    if (S.runMode === 'play'){
      if (!S.wave){
        const elapsed = (now()-S.tStart)/1000;
        // storm around ~18s then boss around ~36s (with randomness)
        if (elapsed > 16 && elapsed < 20 && (S.rng()<0.02)) startStorm();
        if (elapsed > 32 && elapsed < 42 && (S.rng()<0.02)) startBoss();
      }
    }

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;
    if (isStunned(S)) { judge('warn','STUN!'); return; }

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
    else { if (S.combo > 0) S.combo = Math.max(0, S.combo - 1); updateScore(); updateQuest(); }
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

    const stage = stageEl || DOC.getElementById('gj-stage');
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
    coach('neutral', 'จบเกมแล้ว!', 'กลับ HUB หรือเล่นใหม่ได้');
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
    S.activeMini = null;
    S.wave = null;
    S.stunUntil = 0;

    S.warmupUntil = now() + 2800;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    coach('neutral', 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈', 'เล็งกลางแล้วกดยิง / คลิกก็ได้');
    updateScore(); updateTime(); updateQuest();

    // first peek always
    peekQuest(`Goal: เก็บของดี`, `Mini: คอมโบ / Perfect Chain`, 1700);

    logEvent('session_start', {
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec,
      missLimit: S.missLimit
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