// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard (DUAL-EYE READY) — v4 WAVE++
// ✅ Spawn uses PLAYFIELD rect
// ✅ autostart option (boot gate)
// ✅ VR feel: mild drift + fever-driven ramp (play mode only)
// ✅ NEW: Boss Wave (hit good boss N times within timer)
// ✅ NEW: No-Junk Zone wave (survive timer, junk hit = fail wave)
// ✅ NEW: Panic Mode (fever>=80 => screen shake + red vignette via CSS class)
// ✅ NEW: Wave HUD (Boss / No-Junk) auto-injected (safe if missing CSS)

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
  if (diff === 'hard')  return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.19, power: 0.025, maxT: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

/* ---------- minimal target styles (safe) ---------- */
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
      will-change: transform, opacity, left, top;
    }
    .gj-target.good{ border-color: rgba(34,197,94,.28); }
    .gj-target.junk{ border-color: rgba(239,68,68,.30); filter: saturate(1.15); }
    .gj-target.star{ border-color: rgba(34,211,238,.32); }
    .gj-target.shield{ border-color: rgba(168,85,247,.32); }
    .gj-target.boss{
      width: 96px; height: 96px;
      font-size: 50px;
      border-color: rgba(34,197,94,.38);
      box-shadow: 0 22px 80px rgba(0,0,0,.55), 0 0 22px rgba(34,197,94,.18);
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

/* ---------- Wave HUD (auto inject) ---------- */
function ensureWaveHud(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gjWaveHud')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'gjWaveHud';
  wrap.className = 'gj-wave-hud';
  wrap.hidden = true;

  wrap.innerHTML = `
    <div class="wave-card">
      <div class="wave-top">
        <div class="wave-title" id="gjWaveTitle">—</div>
        <div class="wave-right">
          <span id="gjWaveRight">—</span>
        </div>
      </div>
      <div class="wave-bar"><div class="wave-fill" id="gjWaveFill"></div></div>
    </div>
  `;

  DOC.body.appendChild(wrap);
}
function setWaveHud(show, title, rightText, pct, kind){
  const DOC = ROOT.document;
  if (!DOC) return;
  ensureWaveHud();

  const hud = DOC.getElementById('gjWaveHud');
  const t = DOC.getElementById('gjWaveTitle');
  const r = DOC.getElementById('gjWaveRight');
  const f = DOC.getElementById('gjWaveFill');

  if (!hud || !t || !r || !f) return;

  hud.hidden = !show;
  t.textContent = String(title || '—');
  r.textContent = String(rightText || '—');
  f.style.width = `${clamp(pct, 0, 100).toFixed(1)}%`;

  // add semantic class for coloring (CSS optional)
  t.classList.remove('boss','nojunk');
  if (kind === 'boss') t.classList.add('boss');
  if (kind === 'nojunk') t.classList.add('nojunk');
}

/* ---------- Panic CSS class toggle ---------- */
function setPanic(fever){
  const DOC = ROOT.document;
  if (!DOC || !DOC.body) return;
  const p = clamp((fever - 78) / 22, 0, 1); // 0..1
  DOC.body.style.setProperty('--panic', String(p.toFixed(3)));
  DOC.body.classList.toggle('panic', p > 0.001);
}

const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';
const BOSS_EMOJI = '🥦';

function setXY(el, x, y){
  const px = x.toFixed(1) + 'px';
  const py = y.toFixed(1) + 'px';
  el.style.setProperty('--x', px);
  el.style.setProperty('--y', py);
  el.style.left = px;
  el.style.top  = py;
  el._x = x;
  el._y = y;
}
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}
function getCenter(el){
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){
    return { x: (ROOT.innerWidth||360)*0.5, y: (ROOT.innerHeight||640)*0.5 };
  }
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
function countTargets(layerEl){
  try{ return layerEl.querySelectorAll('.gj-target').length; }catch(_){ return 0; }
}

function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
  setPanic(fever);
}

/* ===== summary + flush ===== */
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

/* ===== Spawn helpers (use actual layer rect) ===== */
function getLayerSize(layerEl){
  try{
    const r = layerEl.getBoundingClientRect();
    return { w: Math.max(10, r.width|0), h: Math.max(10, r.height|0) };
  }catch(_){
    return { w: Math.max(10, (ROOT.innerWidth||360)|0), h: Math.max(10, (ROOT.innerHeight||640)|0) };
  }
}
function randPosInLayer(rng, layerEl, margins){
  const sz = getLayerSize(layerEl);
  let left = margins?.left ?? 18;
  let right = margins?.right ?? 18;
  let top = margins?.top ?? 12;
  let bottom = margins?.bottom ?? 12;

  if ((sz.w - left - right) < 140){ left = 10; right = 10; }
  if ((sz.h - top - bottom) < 180){ top = 8; bottom = 8; }

  const x = left + rng() * (sz.w - left - right);
  const y = top  + rng() * (sz.h - top - bottom);
  return { x, y };
}

/* ===== Wave schedule ===== */
function buildWaveSchedule(S){
  // deterministic schedule based on seed; research = fixed pattern, play = slightly dynamic but deterministic anyway
  const times = [];
  const waveEvery = (S.diff === 'hard') ? 14 : (S.diff === 'easy' ? 18 : 16);
  let t = 10; // first wave at 10s after start
  while (t < Math.max(8, S.timeSec - 8)){
    times.push(t);
    t += waveEvery;
  }
  // alternate boss/nojunk
  return times.map((sec, i)=>({
    atSec: sec,
    kind: (i % 2 === 0) ? 'boss' : 'nojunk'
  }));
}

export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return { start(){} };

  ensureTargetStyles();
  ensureWaveHud();

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
    return { start(){} };
  }

  const dual = !!layerR;

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

  const safeMargins = opts.safeMargins || { top: 12, bottom: 12, left: 18, right: 18 };

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

    // WAVES
    waves: [],
    waveIndex: 0,
    waveActive: null, // {kind, endAtMs, ...}
  };

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
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); }
  function updateQuest(){
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

  function makeTarget(type, emoji, x, y, s, uid){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    // drift velocity
    el._vx = (S.rng() * 2 - 1) * 0.65;
    el._vy = (S.rng() * 2 - 1) * 0.55;

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

  /* ===== WAVES (Boss / No-Junk) ===== */
  function waveClear(){
    S.waveActive = null;
    setWaveHud(false);
  }

  function startBossWave(){
    // duration + required hits by diff
    const need = (S.diff === 'easy') ? 3 : (S.diff === 'hard' ? 5 : 4);
    const durMs = (S.diff === 'hard') ? 9000 : 10000;

    S.waveActive = {
      kind:'boss',
      need,
      hit:0,
      endAt: now() + durMs
    };

    coach('neutral', `BOSS WAVE! ยิง 🥦 ให้ครบ ${need} ครั้ง`, 'อย่าเผลอโดนขยะ!');
    judge('info', `BOSS: ${need} hits`);

    // spawn boss now (big)
    spawnBossTarget();

    setWaveHud(true, `BOSS WAVE 🥦`, `0/${need}`, 0, 'boss');
    logEvent('wave_start', { kind:'boss', need, durMs });
  }

  function startNoJunkWave(){
    const durMs = (S.diff === 'hard') ? 9000 : 10000;
    S.waveActive = {
      kind:'nojunk',
      endAt: now() + durMs,
      ok:true
    };

    coach('neutral', `NO-JUNK ZONE! ห้ามโดนขยะ ${Math.round(durMs/1000)} วิ`, 'โฟกัสของดี + ใช้โล่ช่วยได้');
    judge('info', `NO-JUNK ${Math.round(durMs/1000)}s`);

    setWaveHud(true, `NO-JUNK ZONE 🚫🍟`, `0:${Math.round(durMs/1000)}s`, 0, 'nojunk');
    logEvent('wave_start', { kind:'nojunk', durMs });
  }

  function spawnBossTarget(){
    if (!S.running || S.ended) return;
    // keep only one boss alive at a time
    try{
      layerL.querySelectorAll('.gj-target.boss').forEach(el=>{ try{ el.remove(); }catch(_){} });
      if (dual && layerR) layerR.querySelectorAll('.gj-target.boss').forEach(el=>{ try{ el.remove(); }catch(_){} });
    }catch(_){}

    const uid = String(S.uidSeq++);
    const pL = randPosInLayer(S.rng, layerL, safeMargins);

    // Boss is clickable, uses special type 'boss'
    const elL = makeTarget('boss', BOSS_EMOJI, pL.x, pL.y, 1.0, uid);
    elL.style.setProperty('--s', '1'); // class sets size
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInLayer(S.rng, layerR, safeMargins);
      const elR = makeTarget('boss', BOSS_EMOJI, pR.x, pR.y, 1.0, uid);
      layerR.appendChild(elR);
    }
  }

  function bossHit(el){
    const W = S.waveActive;
    if (!W || W.kind !== 'boss') return;

    W.hit++;
    S.hitAll++;
    S.hitGood++; // count as good
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 160;
    S.score += pts;

    S.fever = clamp(S.fever - 5, 0, 100);
    updateFever(S.shield, S.fever);

    judge('good', `BOSS +${pts}`);
    burstAtEl(el, 'boss');
    logEvent('boss_hit', { hit:W.hit, need:W.need, score:S.score|0 });

    const pct = (W.need > 0) ? (W.hit / W.need) * 100 : 0;
    setWaveHud(true, `BOSS WAVE 🥦`, `${W.hit}/${W.need}`, pct, 'boss');

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (W.hit >= W.need){
      // clear boss wave reward
      S.score += 220;
      S.shield = clamp(S.shield + 1, 0, 9);
      updateFever(S.shield, S.fever);

      emit('hha:celebrate', { kind:'mini', title:'BOSS CLEAR! +SHIELD' });
      coach('happy', 'โค่นบอสแล้ว! สุดยอด 😈✅', 'ได้โล่เพิ่ม + คะแนนโบนัส');

      logEvent('wave_clear', { kind:'boss' });

      waveClear();
    }else{
      // respawn boss quickly to keep pressure
      setTimeout(()=>{ if (S.running && !S.ended && S.waveActive?.kind==='boss') spawnBossTarget(); }, 420);
    }
  }

  function nojunkFail(reason){
    const W = S.waveActive;
    if (!W || W.kind !== 'nojunk') return;
    W.ok = false;

    // extra penalty (but still fair)
    S.misses += 2;
    S.score = Math.max(0, S.score - 200);
    S.fever = clamp(S.fever + 10, 0, 100);
    updateFever(S.shield, S.fever);

    coach('sad', 'NO-JUNK พลาด! 😵', 'รอบหน้าโฟกัสของดี แล้วคุมจังหวะยิง');
    judge('bad', 'NO-JUNK FAIL');

    logEvent('wave_fail', { kind:'nojunk', reason:String(reason||'junk_hit') });

    updateScore(); updateQuest();
    waveClear();
  }

  function nojunkTick(){
    const W = S.waveActive;
    if (!W || W.kind !== 'nojunk') return;
    const leftMs = Math.max(0, W.endAt - now());
    const leftS = Math.ceil(leftMs/1000);
    const pct = 100 - (leftMs / (W._dur || (W._dur = (W.endAt - (W._start || (W._start = now())))))) * 100;

    setWaveHud(true, `NO-JUNK ZONE 🚫🍟`, `0:${leftS}s`, clamp(pct,0,100), 'nojunk');

    if (leftMs <= 0){
      // reward
      S.score += 260;
      S.shield = clamp(S.shield + 1, 0, 9);
      updateFever(S.shield, S.fever);

      emit('hha:celebrate', { kind:'mini', title:'NO-JUNK CLEAR! +SHIELD' });
      coach('happy', 'ผ่าน NO-JUNK แล้ว! ✅', 'ได้โล่เพิ่ม + โบนัส');

      logEvent('wave_clear', { kind:'nojunk' });
      waveClear();
    }
  }

  function waveTick(){
    if (!S.waveActive) return;
    const W = S.waveActive;

    if (W.kind === 'boss'){
      const leftMs = Math.max(0, W.endAt - now());
      const leftS = Math.ceil(leftMs/1000);
      const pct = (W.need > 0) ? (W.hit / W.need) * 100 : 0;
      setWaveHud(true, `BOSS WAVE 🥦`, `${W.hit}/${W.need} • ${leftS}s`, pct, 'boss');
      if (leftMs <= 0){
        coach('sad', 'BOSS หนีไป! 😵', 'เดี๋ยวมีบอสมาใหม่—เตรียมยิงให้ไว');
        judge('warn', 'BOSS TIMEOUT');
        logEvent('wave_fail', { kind:'boss', reason:'timeout' });
        waveClear();
      }
      return;
    }

    if (W.kind === 'nojunk'){
      nojunkTick();
      return;
    }
  }

  function tryStartWave(elapsedSec){
    if (!S.waves.length) return;
    if (S.waveIndex >= S.waves.length) return;
    if (S.waveActive) return;

    const next = S.waves[S.waveIndex];
    if (!next) return;

    if (elapsedSec >= next.atSec){
      S.waveIndex++;
      if (next.kind === 'boss') startBossWave();
      else startNoJunkWave();
    }
  }

  /* ===== Hits ===== */
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

    updateScore(); updateQuest();

    if (S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2);
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! +${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! ดีมาก 🔥`, `ทำคอมโบต่อได้อีก!`);
        updateQuest();
      }
    }
    if (S.goalsCleared < S.goalsTotal){
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

    // No-Junk wave: junk hit = instant fail (even if score logic continues)
    const nojunkActive = (S.waveActive && S.waveActive.kind === 'nojunk');

    if (S.shield > 0){
      // block does NOT count as miss (per your standard)
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

    // if no-junk wave and no shield -> fail wave first
    if (nojunkActive){
      // keep normal junk penalty too (pressure!)
      S.hitJunk++; S.misses++; S.combo = 0;
      S.score = Math.max(0, S.score - 170);
      S.fever = clamp(S.fever + 12, 0, 100);
      updateFever(S.shield, S.fever);

      judge('bad', `JUNK!`);
      burstAtEl(el, 'junk');
      logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever), wave:'nojunk' });

      updateScore(); updateQuest();
      removeTargetBoth(el);

      // then fail wave (extra penalty)
      nojunkFail('junk_hit');
      return;
    }

    // normal junk
    S.hitJunk++; S.misses++; S.combo = 0;

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

    if (tp === 'boss') return bossHit(el);
    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
  }

  /* ===== Spawn logic ===== */
  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets(layerL) >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    // wave modifiers (fair but intense)
    const inNoJunk = (S.waveActive && S.waveActive.kind === 'nojunk');
    const inBoss = (S.waveActive && S.waveActive.kind === 'boss');

    let powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    let junkP  = inWarm ? (S.junkP * 0.55) : S.junkP;

    // No-Junk wave fairness: reduce junk, increase shield
    if (inNoJunk){
      junkP = clamp(junkP - 0.05, 0.06, 0.22);
      powerP = clamp(powerP + 0.010, 0.01, 0.08);
    }

    // Boss wave pressure: a bit more junk + less star
    let starP = 0.035;
    if (inBoss){
      junkP = clamp(junkP + 0.03, 0.08, 0.28);
      starP = 0.020;
    }

    // choose type
    let tp = 'good';
    const r = S.rng();
    if (r < powerP) tp = 'shield';
    else if (r < powerP + starP) tp = 'star';
    else if (r < powerP + starP + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);
    const uid = String(S.uidSeq++);

    const pL = randPosInLayer(S.rng, layerL, safeMargins);
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

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInLayer(S.rng, layerR, safeMargins);
      const elR = makeTarget(tp, emoji, pR.x, pR.y, s, uid);
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

    // boss wave slightly faster spawns
    if (S.waveActive?.kind === 'boss') nextMs = Math.max(360, nextMs - 120);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 320, 1400));
  }

  function moveTargetsLayer(layerEl){
    if (!layerEl) return;
    const sz = getLayerSize(layerEl);
    const mx = Math.max(12, safeMargins.left);
    const my = Math.max(10, safeMargins.top);
    const maxX = Math.max(mx + 10, sz.w - Math.max(12, safeMargins.right));
    const maxY = Math.max(my + 10, sz.h - Math.max(10, safeMargins.bottom));

    const heat = clamp((S.fever - 40) / 60, 0, 1);
    const speedMult = 1 + heat * 1.25 + (S.waveActive?.kind === 'boss' ? 0.25 : 0);

    const list = layerEl.querySelectorAll('.gj-target');
    list.forEach(el=>{
      if (!el || !el.isConnected) return;

      const vx = (el._vx || 0) * speedMult;
      const vy = (el._vy || 0) * speedMult;

      let x = (typeof el._x === 'number') ? el._x : 50;
      let y = (typeof el._y === 'number') ? el._y : 50;

      x += vx;
      y += vy;

      if (x < mx){ x = mx; el._vx = Math.abs(el._vx || 0.4); }
      if (x > maxX){ x = maxX; el._vx = -Math.abs(el._vx || 0.4); }
      if (y < my){ y = my; el._vy = Math.abs(el._vy || 0.35); }
      if (y > maxY){ y = maxY; el._vy = -Math.abs(el._vy || 0.35); }

      setXY(el, x, y);

      // keep mate in sync
      const mate = getMate(el);
      if (mate){
        mate._vx = el._vx; mate._vy = el._vy;
        mate._x = x; mate._y = y;
        setXY(mate, x, y);
      }
    });
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    // drift
    moveTargetsLayer(layerL);
    if (dual) moveTargetsLayer(layerR);

    const elapsed = (now() - S.tStart) / 1000;

    // wave scheduler
    tryStartWave(elapsed);
    waveTick();

    if (S.left <= 0){ endGame('time'); return; }

    if (S.runMode === 'play'){
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.65) * 1.2 + comboHeat * 0.8, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.75, 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * 320, 420, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2600);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.12);
      S.junkP   = clamp(base.junk    + heat * 0.08, 0.08, 0.26);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 13);

      // fairness at high fever
      if (S.fever >= 82){
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

    waveClear();
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

  function start(){
    if (S.running) return;

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

    S.warmupUntil = now() + 3000;
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    // build deterministic wave schedule now
    S.waves = buildWaveSchedule(S);
    S.waveIndex = 0;
    S.waveActive = null;

    coach('neutral', 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วมี WAVE โหด ๆ 😈', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
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

  const api = {
    start,
    endGame,
    shoot: shootAtCrosshair,
    state: S
  };

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.start = start;
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}

  const autostart = (opts.autostart !== false);
  if (autostart) start();

  return api;
}