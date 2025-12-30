// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard — v4 BOSS++
// ✅ returns controller { start, endGame, shoot }
// ✅ autoStart:false supported (Start-gate in boot.js)
// ✅ endPolicy: time | all | miss
// ✅ minis: rush / nojunk / boss
// ✅ boss rule: BLOCK fail when bossBad >= bossNeed (instant lose boss)

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
  if (diff === 'easy')  return { spawnMs: 980, ttlMs: 2350, size: 1.10, junk: 0.12, power: 0.038, maxT: 7, missLimit: 8, bossNeed: 6, bossDurMs: 9000 };
  if (diff === 'hard')  return { spawnMs: 700, ttlMs: 1600, size: 0.94, junk: 0.18, power: 0.025, maxT: 9, missLimit: 6, bossNeed: 7, bossDurMs: 8200 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8, missLimit: 7, bossNeed: 6, bossDurMs: 8600 };
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
      will-change: transform, opacity, filter;
    }
    .gj-target.good{ border-color: rgba(34,197,94,.30); }
    .gj-target.junk{ border-color: rgba(239,68,68,.32); filter: saturate(1.15); }
    .gj-target.star{ border-color: rgba(34,211,238,.34); }
    .gj-target.shield{ border-color: rgba(168,85,247,.34); }

    /* boss targets */
    .gj-target.boss{
      box-shadow: 0 18px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset;
      border-width: 2px;
    }
    .gj-target.boss.good{ border-color: rgba(34,197,94,.48); }
    .gj-target.boss.junk{ border-color: rgba(239,68,68,.55); }

    .gj-target.hit{
      transform: translate(-50%,-50%) scale(calc(var(--s,1) * 1.28));
      opacity:.16; filter: blur(.8px);
      transition: transform 120ms ease, opacity 120ms ease, filter 120ms ease;
    }
    .gj-target.out{
      opacity:0;
      transform: translate(-50%,-50%) scale(calc(var(--s,1) * 0.82));
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
    DOC.getElementById('bossBar'),
    DOC.querySelector('.hha-controls'),
    DOC.getElementById('hhaFever'),
    DOC.getElementById('hudPeek')
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
      if (pointInRect(gx, y, { left:r.left-10, right:r.right+10, top:r.top-10, bottom:r.bottom+10 })){
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

/* boss emoji set (เด่น + หลอกตา) */
const BOSS_GOOD = ['🥦','🥕','🍎','🥗'];
const BOSS_BAD  = ['🍟','🍔','🍕','🍩','🍬'];

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

function cssFeverFX(DOC, fever){
  try{
    const f = clamp(fever, 0, 100);
    DOC.documentElement.style.setProperty('--hha-fever', String(f));
    DOC.body.classList.toggle('fever70', f >= 70);
    DOC.body.classList.toggle('fever85', f >= 85);
  }catch(_){}
}
function updateFever(DOC, shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
  cssFeverFX(DOC, fever);
}

function rankSummary(S){
  const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
  return { acc, grade: rankFromAcc(acc) };
}

function makeSummary(S, reason){
  const { acc, grade } = rankSummary(S);
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
    endPolicy: S.endPolicy,
    missLimit: S.missLimit|0,
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
    console.warn('[GoodJunkVR] missing layer');
    return null;
  }

  const dual = !!layerR;

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase(); // time | all | miss
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase();

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};
  const base = diffBase(diff);

  const safeMargins = opts.safeMargins || { top: 128, bottom: 180, left: 18, right: 18 };

  const S = {
    running:false, ended:false, flushed:false,
    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,
    tStart:0, left: timeSec,

    score:0, combo:0, comboMax:0,
    misses:0, hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,

    goalsCleared:0, goalsTotal:2,
    goalNeedBase: 10,

    miniCleared:0, miniTotal:7,
    missLimit: base.missLimit,

    miniActive: null, // {type, ...}

    warmupUntil:0,
    spawnTimer:0, tickTimer:0, miniTimer:0,
    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,
    uidSeq: 1,

    // panic/boss
    panicUntil: 0,
    bossUsed: false,
    bossNeed: base.bossNeed,
    bossDurMs: base.bossDurMs,
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.14, S.size + 0.04);
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
    const { acc, grade } = rankSummary(S);
    emit('hha:rank', { grade, accuracy: acc });
  }
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); }

  function showBossUI(m){
    const bar = DOC.getElementById('bossBar');
    if (!bar) return;
    bar.hidden = false;

    const fill = DOC.getElementById('bossFill');
    const text = DOC.getElementById('bossText');
    const bfill = DOC.getElementById('bossBadFill');
    const btext = DOC.getElementById('bossBadText');
    const note = DOC.getElementById('bossNote');

    const need = Math.max(1, m.need|0);
    const got = clamp(m.got|0, 0, need);
    const bad = clamp(m.bad|0, 0, need);

    if (fill) fill.style.width = `${(got/need)*100}%`;
    if (text) text.textContent = `${got}/${need}`;
    if (bfill) bfill.style.width = `${(bad/need)*100}%`;
    if (btext) btext.textContent = `${bad}/${need}`;
    if (note) note.textContent = `ยิง GOOD ให้ครบ • ถ้า BAD ถึง ${need} = แพ้ทันที`;
  }
  function hideBossUI(){
    const bar = DOC.getElementById('bossBar');
    if (bar) bar.hidden = true;
  }
  function setBossClass(on){
    DOC.body.classList.toggle('boss-on', !!on);
  }

  function formatMini(){
    const m = S.miniActive;
    if (!m) return { miniTitle:`Mini: —`, miniNow:S.miniCleared, miniTotal:S.miniTotal, miniLeftMs:0 };

    const leftMs = Math.max(0, (m.tEndMs|0) - (now()|0));

    if (m.type === 'boss'){
      showBossUI(m);
      return {
        miniTitle: `Mini: BOSS ${m.got}/${m.need} (BAD ${m.bad}/${m.need})`,
        miniNow: S.miniCleared,
        miniTotal: S.miniTotal,
        miniLeftMs: leftMs
      };
    }

    hideBossUI();
    const title = (m.type === 'rush')
      ? `Mini: RUSH ${m.got}/${m.need}`
      : (m.type === 'nojunk')
        ? `Mini: NO-JUNK`
        : `Mini: ${m.title||'CHALLENGE'}`;

    return { miniTitle:title, miniNow:S.miniCleared, miniTotal:S.miniTotal, miniLeftMs:leftMs };
  }

  function updateQuest(){
    const needGood = (S.goalNeedBase + (S.goalsCleared * 8))|0;
    emit('quest:update', {
      goalTitle: `Goal: เก็บของดี`,
      goalNow: clamp(S.hitGood, 0, needGood),
      goalTotal: needGood,
      ...formatMini()
    });
    emit('quest:progress', {
      goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared, miniTotal: S.miniTotal
    });
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
    try{ clearTimeout(S.miniTimer); }catch(_){}
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

  function onMiniFail(reason){
    const m = S.miniActive;
    if (!m || m.failed) return;
    m.failed = true;

    if (m.type === 'boss'){
      setBossClass(false);
      hideBossUI();
      judge('bad', 'BOSS FAIL!');
      coach('sad', 'บอสแพ้แล้ว 😵', reason || 'รอบหน้าต้องคุม BAD ให้ได้!');
      emit('hha:celebrate', { kind:'mini-fail', title:'BOSS FAIL' });
      S.fever = clamp(S.fever + 18, 0, 100);
      updateFever(DOC, S.shield, S.fever);
      // remove boss now
      S.miniActive = null;
      updateQuest();
      return;
    }

    judge('warn', `Mini ล้มเหลว!`);
    coach('sad', 'Mini ไม่ผ่าน 😵', reason || 'ลองใหม่เดี๋ยวมาอีก!');
    emit('hha:celebrate', { kind:'mini-fail', title:'Mini FAIL' });
    S.miniActive = null;
    updateQuest();
  }

  function onMiniPass(){
    const m = S.miniActive;
    if (!m) return;

    if (m.type === 'boss'){
      setBossClass(false);
      hideBossUI();
      S.miniCleared++; // boss counts as 1 mini (โหดแต่แฟร์)
      emit('hha:celebrate', { kind:'mini', title:`BOSS CLEAR! ${S.miniCleared}/${S.miniTotal}` });
      coach('happy', 'บอสผ่านแล้ว! 🏆', 'สุดยอด! กลับไปคุมความแม่นต่อ');
      S.score += 420;
      updateScore();
      S.miniActive = null;
      updateQuest();
      return;
    }

    S.miniCleared++;
    emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
    coach('happy', `Mini ผ่านแล้ว! 🔥`, `ไปต่อ!`);
    S.miniActive = null;
    updateQuest();

    if (endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
      endGame('all_complete');
    }
  }

  function startMini(type){
    if (S.ended || !S.running) return;
    if (S.miniCleared >= S.miniTotal) return;
    if (S.miniActive) return;

    const t = now();

    if (type === 'boss'){
      S.bossUsed = true;
      S.miniActive = {
        type:'boss',
        need: S.bossNeed|0,
        got: 0,
        bad: 0,
        forbidJunk: false, // boss has its own rule
        tEndMs: (t + S.bossDurMs)|0,
        failed:false
      };
      setBossClass(true);
      showBossUI(S.miniActive);
      coach('neutral', 'BOSS มาแล้ว! 😈', `ยิง GOOD ให้ครบ ${S.bossNeed} ก่อนหมดเวลา`);
      judge('warn', 'BOSS START!');
      emit('hha:celebrate', { kind:'mini', title:'BOSS!' });
      tickMini();
      updateQuest();
      return;
    }

    if (type === 'nojunk'){
      const dur = (6500 + (S.miniCleared * 350))|0;
      S.miniActive = {
        type:'nojunk',
        need: 0,
        got: 0,
        forbidJunk: true,
        tEndMs: (t + dur)|0,
        failed:false
      };
      coach('neutral', 'Mini: ห้ามโดนขยะ!', `อยู่ให้รอด ${(dur/1000).toFixed(1)} วิ`);
      tickMini();
      updateQuest();
      return;
    }

    // rush
    const need = clamp(4 + S.miniCleared, 4, 10)|0;
    const dur  = clamp(7600 - (S.miniCleared*250), 4200, 7800)|0;
    S.miniActive = {
      type:'rush',
      need,
      got: 0,
      forbidJunk: false,
      tEndMs: (t + dur)|0,
      failed:false
    };
    coach('neutral', `Mini: RUSH!`, `เก็บดี ${need} ภายใน ${(dur/1000).toFixed(1)} วิ`);
    tickMini();
    updateQuest();
  }

  function tickMini(){
    if (!S.running || S.ended) return;
    const m = S.miniActive;
    if (!m) return;

    const left = m.tEndMs - now();
    if (left <= 0){
      if (m.type === 'rush'){
        if (m.got >= m.need) onMiniPass();
        else onMiniFail('ไม่ทันเวลา!');
      } else if (m.type === 'nojunk'){
        if (!m.failed) onMiniPass();
      } else if (m.type === 'boss'){
        if (m.got >= m.need) onMiniPass();
        else onMiniFail('BOSS TIMEOUT!');
      }
      return;
    }

    updateQuest();
    S.miniTimer = setTimeout(tickMini, 120);
  }

  function maybeScheduleMini(){
    if (S.miniActive) return;
    if (S.miniCleared >= S.miniTotal) return;

    const elapsed = (now() - S.tStart) / 1000;

    // Boss trigger: near end OR after both goals cleared OR mini near total
    const nearEnd = (S.left <= 18);
    const readyBoss = !S.bossUsed && (nearEnd || (S.goalsCleared >= S.goalsTotal) || (S.miniCleared >= Math.max(3, S.miniTotal-2)));
    if (readyBoss){
      startMini('boss');
      return;
    }

    if (elapsed < 3.8) return;

    // regular minis
    const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
    const heat = clamp((elapsed/18) + (acc-0.6), 0, 1);
    const p = 0.018 + heat*0.028;

    if (S.rng() < p){
      const type = (S.miniCleared % 2 === 0) ? 'rush' : 'nojunk';
      startMini(type);
    }
  }

  function expireTargetBoth(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    if (tp === 'good'){
      S.misses++; S.expireGood++; S.combo = 0;

      // fail mini nojunk if active
      if (S.miniActive && S.miniActive.type === 'nojunk'){
        onMiniFail('ปล่อยให้ของดีหมดเวลา!');
      }

      // boss: expire good doesn't instantly fail, but hurts fever
      if (S.miniActive && S.miniActive.type === 'boss'){
        S.fever = clamp(S.fever + 6, 0, 100);
      } else {
        S.fever = clamp(S.fever + 7, 0, 100);
      }

      updateFever(DOC, S.shield, S.fever);
      judge('warn', 'MISS (หมดเวลา)!');
      emit('hha:fx', { kind:'miss' });
      updateScore(); updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(el.dataset.emoji||'') });

      if (endPolicy === 'miss' && S.misses >= S.missLimit){
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

  function makeTarget(type, emoji, x, y, s, uid, isBoss=false){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}` + (isBoss ? ' boss' : '');
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    el.dataset.uid = String(uid||'');
    if (isBoss) el.dataset.boss = '1';

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
    const mult = 1 + clamp(S.combo/28, 0, 0.9);
    const pts = Math.round(92 * mult);
    S.score += pts;
    return pts;
  }

  function maybeGoalPass(){
    if (S.goalsCleared >= S.goalsTotal) return;
    const needGood = (S.goalNeedBase + (S.goalsCleared * 8))|0;
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

  function hitGood(el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    // reward: reduce fever
    S.fever = clamp(S.fever - 2.4, 0, 100);
    updateFever(DOC, S.shield, S.fever);

    // mini rush counts good hits
    if (S.miniActive && S.miniActive.type === 'rush'){
      S.miniActive.got++;
      if (S.miniActive.got >= S.miniActive.need){
        onMiniPass();
      }
    }

    // boss counts only boss-good (dataset.boss=1)
    if (S.miniActive && S.miniActive.type === 'boss' && el.dataset.boss === '1' && el.classList.contains('good')){
      S.miniActive.got++;
      showBossUI(S.miniActive);
      if (S.miniActive.got >= S.miniActive.need){
        onMiniPass();
      }
    }

    const pts = scoreGood();
    judge('good', `+${pts}`);
    emit('hha:fx', { kind:'hit' });
    burstAtEl(el, 'good');

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();
    maybeGoalPass();
    removeTargetBoth(el);
  }

  function hitShield(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(DOC, S.shield, S.fever);

    S.score += 75;
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

    const pts = 160;
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

    // shield blocks junk (no miss)
    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(DOC, S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      emit('hha:fx', { kind:'guard' });
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++; S.misses++; S.combo = 0;

    const penalty = 190;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 13, 0, 100);
    updateFever(DOC, S.shield, S.fever);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    emit('hha:fx', { kind:'hurt' });
    burstAtEl(el, 'junk');

    // mini nojunk fail
    if (S.miniActive && S.miniActive.type === 'nojunk'){
      onMiniFail('โดนขยะระหว่าง NO-JUNK!');
    }

    // BOSS: count BAD + BLOCK fail when bad >= need
    if (S.miniActive && S.miniActive.type === 'boss' && el.dataset.boss === '1'){
      S.miniActive.bad++;
      showBossUI(S.miniActive);
      if (S.miniActive.bad >= S.miniActive.need){
        // BLOCK immediate
        onMiniFail(`BAD ถึงลิมิต ${S.miniActive.need} (BLOCK)`);
      }
    }

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();
    removeTargetBoth(el);

    if (endPolicy === 'miss' && S.misses >= S.missLimit){
      endGame('miss_limit');
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
    if (countTargets(layerL) >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    const bossOn = !!(S.miniActive && S.miniActive.type === 'boss');
    if (bossOn){
      // boss: spawn ONLY boss targets (good/bad), faster + smaller a bit
      const uid = String(S.uidSeq++);
      const isBad = (S.rng() < 0.38);   // decoy rate
      const tp = isBad ? 'junk' : 'good';
      const emoji = isBad ? pick(S.rng, BOSS_BAD) : pick(S.rng, BOSS_GOOD);
      const size = clamp(S.size * (isBad ? 0.92 : 0.96), 0.84, 1.10);

      const pL = randPosEye(S.rng, safeMargins, 0, dual);
      const elL = makeTarget(tp, emoji, pL.x, pL.y, size, uid, true);
      layerL.appendChild(elL);

      if (dual && layerR){
        const pR = randPosEye(S.rng, safeMargins, 1, dual);
        const elR = makeTarget(tp, emoji, pR.x, pL.y, size, uid, true);
        layerR.appendChild(elR);
      }

      logEvent('spawn', { kind:`boss_${tp}`, emoji:String(emoji||''), uid });
      return;
    }

    // normal spawn
    let tp = 'good';
    const r = S.rng();
    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    let junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
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

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid, false);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosEye(S.rng, safeMargins, 1, dual);
      const elR = makeTarget(tp, emoji, pR.x, pL.y, s, uid, false);
      layerR.appendChild(elR);
    }

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;

    spawnOne();

    const bossOn = !!(S.miniActive && S.miniActive.type === 'boss');
    const t = now();
    const inWarm = (t < S.warmupUntil);

    let nextMs = S.spawnMs;
    if (bossOn) nextMs = clamp(S.spawnMs * 0.72, 260, 720);
    else if (inWarm) nextMs = Math.max(980, S.spawnMs + 240);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 220, 1500));
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    // time drain (if end=all, time can hit 0 but game continues)
    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    if (S.left <= 0 && endPolicy === 'time'){
      endGame('time');
      return;
    }

    maybeScheduleMini();

    // adaptive only in play, not in research
    if (S.runMode === 'play'){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 16, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1);
      const skill = clamp((acc - 0.62) * 1.25 + comboHeat * 0.85, 0, 1);
      const heat = clamp(timeRamp * 0.55 + skill * 0.80, 0, 1);

      S.spawnMs = clamp(base.spawnMs - heat * 340, 400, 1200);
      S.ttlMs   = clamp(base.ttlMs   - heat * 460, 1120, 2600);
      S.size    = clamp(base.size    - heat * 0.16, 0.84, 1.14);
      S.junkP   = clamp(base.junk    + heat * 0.08, 0.08, 0.28);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBonus = Math.round(heat * 5);
      S.maxTargets = clamp(base.maxT + maxBonus, 5, isMobileLike() ? 11 : 14);

      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.24);
        S.size  = clamp(S.size + 0.03, 0.84, 1.18);
      }
    } else {
      S.spawnMs = base.spawnMs;
      S.ttlMs   = base.ttlMs;
      S.size    = base.size;
      S.junkP   = base.junk;
      S.powerP  = base.power;
      S.maxTargets = base.maxT;
    }

    if (endPolicy === 'miss' && S.misses >= S.missLimit){
      endGame('miss_limit');
      return;
    }

    if (endPolicy === 'all' && S.left <= 0){
      S.left = 0;
      updateTime();
    }

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const radius = isMobileLike() ? 66 : 54;

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
      emit('hha:fx', { kind:'shot-miss' });
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
    setBossClass(false);
    hideBossUI();

    const summary = makeSummary(S, reason);
    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');
  }

  function setBossClass(on){ DOC.body.classList.toggle('boss-on', !!on); }

  function start(){
    if (S.running) return;

    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.left = timeSec;

    S.score = 0; S.combo = 0; S.comboMax = 0;
    S.misses = 0; S.hitAll = 0; S.hitGood = 0; S.hitJunk = 0; S.hitJunkGuard = 0; S.expireGood = 0;
    S.fever = 0; S.shield = 0; updateFever(DOC, S.shield, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;
    S.miniActive = null;

    S.bossUsed = false;
    setBossClass(false);
    hideBossUI();

    S.warmupUntil = now() + 3200;
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
      timeSec: S.timeSec,
      missLimit: S.missLimit|0,
      bossNeed: S.bossNeed|0
    });

    loopSpawn();
    adaptiveTick();
  }

  // bind once
  bindInputs();
  bindFlushHard();

  const controller = {
    start,
    endGame,
    shoot: shootAtCrosshair,
    getState: ()=>({ ...S }),
  };

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.controller = controller;
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
    ROOT.GoodJunkVR.start = start;
  }catch(_){}

  const autoStart = (opts.autoStart !== false);
  if (autoStart) start();

  return controller;
}