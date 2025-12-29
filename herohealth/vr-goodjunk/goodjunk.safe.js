// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard
// ✅ DOM emoji targets on #gj-layer
// ✅ Warmup 3s (นุ่ม ๆ) แล้ว "เร่งขึ้นเร็ว" แบบเกมจริง (B1+B2)
// ✅ Adaptive เฉพาะ run=play : spawn/ttl/size/maxTargets/junk เพิ่มตามความสามารถ
// ✅ Research mode (run=research) : ยึดตาม diff (ไม่ adapt)
// ✅ คลิก/แตะเป้าได้ + ยิงกลาง (ปุ่มยิง / Space / Enter)
// ✅ FIX: target class ให้เข้ากับ goodjunk-vr.css (.gj-target.gj-junk ฯลฯ)
// ✅ FIX: inject style แบบ "ไม่ชน" CSS หลัก (ไม่ override #gj-layer)
// ✅ Spawn หลีก HUD (top/mid/controls/fever) + clamp safe zone
// ✅ VR/Cardboard adjust: crosshair กลางขึ้น + spawn สูงขึ้นเมื่อ view=vr|cardboard
// ✅ HHA events: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ miss definition: good expire + junk hit (shield block ไม่เป็น miss)
// ✅ End summary overlay (#end-summary) + back HUB (?hub=...) + play again
// ✅ last summary -> localStorage HHA_LAST_SUMMARY (and hha_last_summary)
// ✅ flush-hardened: end/backhub/pagehide/visibilitychange/beforeunload (best effort)

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

function qsp(){
  try{ return (new URL(ROOT.location.href)).searchParams; }catch(_){ return new URLSearchParams(); }
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
function getViewMode(){
  const v = String(qs('view','') || qs('mode','') || '').toLowerCase();
  if (v.includes('card') || v.includes('stereo')) return 'cardboard';
  if (v.includes('vr')) return 'vr';
  return '';
}
function isVrLike(){
  const v = getViewMode();
  return (v === 'vr' || v === 'cardboard');
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
    return { spawnMs: 980, ttlMs: 2400, size: 1.10, junk: 0.12, power: 0.035, maxT: 7 };
  }
  if (diff === 'hard') {
    return { spawnMs: 720, ttlMs: 1700, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  }
  return { spawnMs: 840, ttlMs: 2050, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

// -------------------- safe CSS injection (ไม่ override #gj-layer) --------------------
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    /* only target fallback style — do NOT touch #gj-layer */
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
      will-change: transform, opacity, filter;
    }
    .gj-target.spawn{ transform: translate(-50%,-50%) scale(.25); opacity:0; }
    .gj-target.gone{ transform: translate(-50%,-50%) scale(.85); opacity:0; }

    .gj-target.gj-good{ border-color: rgba(34,197,94,.28); }
    .gj-target.gj-junk{ border-color: rgba(239,68,68,.30); filter: saturate(1.15); }
    .gj-target.gj-star{ border-color: rgba(34,211,238,.32); }
    .gj-target.gj-shield{ border-color: rgba(96,165,250,.32); }
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

// -------------------- target helpers --------------------
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

function countTargets(layerEl){
  try{ return layerEl.querySelectorAll('.gj-target').length; }catch(_){ return 0; }
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
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}

function burstAtEl(el, kind){
  try{
    const r = el.getBoundingClientRect();
    Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || '');
    Particles.scorePop?.(r.left + r.width/2, r.top + r.height/2, kind || '');
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

// -------------------- End Summary UI --------------------
function renderEndSummary(summary, opts){
  const DOC = ROOT.document;
  const wrap = DOC.getElementById('end-summary');
  if (!wrap) return;

  const hub = String(opts?.hub || qs('hub','') || '').trim();
  const canHub = !!hub;

  wrap.innerHTML = '';
  wrap.style.pointerEvents = 'auto';

  const el = DOC.createElement('div');
  el.className = 'gj-end';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.zIndex = '120';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.padding = '18px';
  el.style.background = 'rgba(2,6,23,.82)';

  const card = DOC.createElement('div');
  card.style.width = 'min(560px, 94vw)';
  card.style.borderRadius = '22px';
  card.style.border = '1px solid rgba(148,163,184,.22)';
  card.style.background = 'rgba(2,6,23,.94)';
  card.style.boxShadow = '0 22px 70px rgba(0,0,0,.42)';
  card.style.padding = '16px 16px 14px';
  card.style.color = '#e5e7eb';
  card.style.backdropFilter = 'blur(8px)';

  const title = DOC.createElement('div');
  title.textContent = 'สรุปผล';
  title.style.fontSize = '22px';
  title.style.fontWeight = '1000';

  const meta = DOC.createElement('div');
  meta.textContent = `Grade ${summary.grade} • Accuracy ${summary.accuracyGoodPct}% • Miss ${summary.misses}`;
  meta.style.marginTop = '6px';
  meta.style.color = '#cbd5e1';
  meta.style.fontWeight = '900';

  const grid = DOC.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(2, minmax(0,1fr))';
  grid.style.gap = '10px';
  grid.style.marginTop = '12px';

  function box(k, v){
    const b = DOC.createElement('div');
    b.style.border = '1px solid rgba(148,163,184,.18)';
    b.style.borderRadius = '16px';
    b.style.background = 'rgba(15,23,42,.55)';
    b.style.padding = '10px 12px';
    const kk = DOC.createElement('div');
    kk.textContent = k;
    kk.style.fontSize = '12px';
    kk.style.color = '#94a3b8';
    kk.style.fontWeight = '900';
    const vv = DOC.createElement('div');
    vv.textContent = String(v);
    vv.style.fontSize = '20px';
    vv.style.fontWeight = '1000';
    vv.style.marginTop = '2px';
    b.appendChild(kk); b.appendChild(vv);
    return b;
  }

  grid.appendChild(box('Score', summary.scoreFinal));
  grid.appendChild(box('Combo Max', summary.comboMax));
  grid.appendChild(box('Goals', `${summary.goalsCleared}/${summary.goalsTotal}`));
  grid.appendChild(box('Minis', `${summary.miniCleared}/${summary.miniTotal}`));

  const btnRow = DOC.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '10px';
  btnRow.style.marginTop = '12px';

  const btnAgain = DOC.createElement('button');
  btnAgain.textContent = 'เล่นอีกครั้ง';
  btnAgain.style.flex = '1';
  btnAgain.style.height = '52px';
  btnAgain.style.borderRadius = '18px';
  btnAgain.style.border = '1px solid rgba(148,163,184,.22)';
  btnAgain.style.background = 'rgba(34,197,94,.16)';
  btnAgain.style.color = '#fff';
  btnAgain.style.fontWeight = '1000';
  btnAgain.style.fontSize = '16px';

  const btnHub = DOC.createElement('button');
  btnHub.textContent = canHub ? 'กลับ HUB' : 'ปิด';
  btnHub.style.flex = '1';
  btnHub.style.height = '52px';
  btnHub.style.borderRadius = '18px';
  btnHub.style.border = '1px solid rgba(148,163,184,.22)';
  btnHub.style.background = 'rgba(2,6,23,.84)';
  btnHub.style.color = '#fff';
  btnHub.style.fontWeight = '1000';
  btnHub.style.fontSize = '16px';

  btnRow.appendChild(btnAgain);
  btnRow.appendChild(btnHub);

  const hint = DOC.createElement('div');
  hint.textContent = `เหตุผลจบ: ${summary.reason} • เวลาเล่น: ${summary.durationPlayedSec}s`;
  hint.style.marginTop = '8px';
  hint.style.fontSize = '12px';
  hint.style.color = '#94a3b8';
  hint.style.fontWeight = '900';

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(grid);
  card.appendChild(btnRow);
  card.appendChild(hint);

  el.appendChild(card);
  wrap.appendChild(el);

  btnAgain.onclick = () => {
    // reload same URL (keep params)
    try{ location.reload(); }catch(_){}
  };

  btnHub.onclick = async () => {
    try{ await flushAll(summary, 'back_hub'); }catch(_){}
    if (!canHub){
      try{ el.remove(); }catch(_){}
      return;
    }
    try{
      // keep hub + context params (safe)
      const cur = new URL(location.href);
      const hubUrl = new URL(hub);
      // ส่งต่อพารามิเตอร์หลักกลับ hub (ไม่ยัด summary ลง url)
      const keepKeys = [
        'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
        'schoolYear','semester','studentKey','schoolCode','schoolName','classRoom','studentNo',
        'nickName','gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
        'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
        'gameVersion'
      ];
      keepKeys.forEach(k=>{
        const v = cur.searchParams.get(k);
        if (v != null && v !== '') hubUrl.searchParams.set(k, v);
      });
      hubUrl.searchParams.set('hubReturn', '1');
      location.href = hubUrl.toString();
    }catch(_){
      location.href = hub;
    }
  };
}

// -------------------- exported boot --------------------
export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const crosshairEl = DOC.getElementById('gj-crosshair');

  if (!layerEl){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

  // safe margins (will be tuned below)
  const safeMargins = Object.assign({ top: 128, bottom: 170, left: 26, right: 26 }, (opts.safeMargins || {}));

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
  const hub = String(opts.hub || qs('hub','') || '').trim();

  // VR/cardboard adjust: crosshair สูงขึ้น + spawn สูงขึ้นนิด
  if (isVrLike()){
    try{
      if (crosshairEl) crosshairEl.style.top = '50%';
    }catch(_){}
    safeMargins.top = Math.max(90, safeMargins.top - 42);
    safeMargins.bottom = Math.max(120, safeMargins.bottom - 46);
  }

  // mobile adjust
  if (isMobileLike()){
    safeMargins.left = Math.max(18, safeMargins.left);
    safeMargins.right = Math.max(18, safeMargins.right);
  }

  // state
  const S = {
    running:false,
    ended:false,
    flushed:false,

    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,

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

  const base = diffBase(diff);
  S.spawnMs = base.spawnMs;
  S.ttlMs = base.ttlMs;
  S.size = base.size;
  S.junkP = base.junk;
  S.powerP = base.power;
  S.maxTargets = base.maxT;

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

  function calcAcc(){
    return S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
  }
  function updateScore(){
    const acc = calcAcc();
    const grade = rankFromAcc(acc);
    emit('hha:score', { score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0, grade, accuracy: acc });
    emit('hha:rank', { grade, accuracy: acc });
  }
  function updateTime(){
    emit('hha:time', { left: Math.max(0, S.left|0) });
  }
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

  function removeTarget(el){
    try{ clearTimeout(el._ttl); }catch(_){}
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }

  function expireTarget(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    if (tp === 'good'){
      S.misses++;
      S.expireGood++;
      S.combo = 0;

      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever(S.shield, S.fever);

      judge('warn', 'MISS (หมดเวลา)!');
      updateScore();
      updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(el.dataset.emoji||'') });
    }
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 170);
  }

  function classForType(type){
    if (type === 'good') return 'gj-good';
    if (type === 'junk') return 'gj-junk';
    if (type === 'star') return 'gj-star';
    if (type === 'shield') return 'gj-shield';
    return 'gj-good';
  }

  function makeTarget(type, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = `gj-target ${classForType(type)} spawn`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');

    // fallback safety
    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = (type === 'junk') ? '31' : (type === 'star' ? '32' : (type === 'shield' ? '33' : '30'));

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    // animate in
    requestAnimationFrame(()=>{ try{ el.classList.remove('spawn'); }catch(_){ } });

    // TTL
    el._ttl = setTimeout(()=> expireTarget(el), S.ttlMs);

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitTarget(el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    logEvent('spawn', { kind:type, emoji:String(emoji||'') });
    return el;
  }

  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
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

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();

    if (S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2); // 4,6,8,10...
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
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

    removeTarget(el);
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

    updateScore();
    updateQuest();
    removeTarget(el);
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

    updateScore();
    updateQuest();
    removeTarget(el);
  }

  function hitJunk(el){
    S.hitAll++;

    // shield blocks junk -> NOT a miss
    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore();
      updateQuest();
      removeTarget(el);
      return;
    }

    // unblocked junk = miss
    S.hitJunk++;
    S.misses++;
    S.combo = 0;

    const penalty = 170;
    S.score = Math.max(0, S.score - penalty);

    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งดี ๆ แล้วกดยิงกลาง');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();
    removeTarget(el);
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
    if (countTargets(layerEl) >= S.maxTargets) return;

    const p = randPos(S.rng, safeMargins);

    const t = now();
    const inWarm = (t < S.warmupUntil);

    let tp = 'good';
    const r = S.rng();

    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.55) : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);

    if (tp === 'good'){
      layerEl.appendChild(makeTarget('good', pick(S.rng, GOOD), p.x, p.y, size));
      return;
    }
    if (tp === 'junk'){
      layerEl.appendChild(makeTarget('junk', pick(S.rng, JUNK), p.x, p.y, size * 0.98));
      return;
    }
    if (tp === 'shield'){
      layerEl.appendChild(makeTarget('shield', SHIELD, p.x, p.y, size * 1.03));
      return;
    }
    if (tp === 'star'){
      layerEl.appendChild(makeTarget('star', pick(S.rng, STARS), p.x, p.y, size * 1.02));
      return;
    }
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
      S.ttlMs   = clamp(base.ttlMs   - heat * 420, 1180, 2800);
      S.size    = clamp(base.size    - heat * 0.14, 0.86, 1.16);
      S.junkP   = clamp(base.junk    + heat * 0.07, 0.08, 0.25);
      S.powerP  = clamp(base.power   + heat * 0.012, 0.01, 0.06);

      const maxBase = base.maxT;
      const maxBonus = Math.round(heat * 4);
      S.maxTargets = clamp(maxBase + maxBonus, 5, isMobileLike() ? 11 : 13);

      if (S.fever >= 70){
        S.junkP = clamp(S.junkP - 0.03, 0.08, 0.22);
        S.size  = clamp(S.size + 0.03, 0.86, 1.18);
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

    const c = getCrosshairCenter(crosshairEl);
    const r = isMobileLike() ? 62 : 52;
    const el = findTargetNear(layerEl, c.x, c.y, r);
    if (el) {
      hitTarget(el);
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
      stage.addEventListener('click', ()=>{
        if (isMobileLike()) return;
        shootAtCrosshair();
      });
    }
  }

  function bindFlushHard(){
    const doFlush = (why)=>{
      try{ flushAll(makeSummary(S, why), why); }catch(_){}
    };

    ROOT.addEventListener('pagehide', ()=>doFlush('pagehide'), { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') doFlush('hidden');
    }, { passive:true });

    ROOT.addEventListener('beforeunload', ()=>doFlush('beforeunload'), { passive:true });
  }

  function clearAllTargets(){
    try{
      const list = layerEl.querySelectorAll('.gj-target');
      list.forEach(el=>{
        try{ clearTimeout(el._ttl); }catch(_){}
        try{ el.remove(); }catch(_){}
      });
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

    // render end overlay
    renderEndSummary(summary, { hub });
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

    coach('neutral', 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
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
      view: getViewMode() || (isMobileLike() ? 'mobile' : 'pc')
    });

    loopSpawn();
    adaptiveTick();
  }

  bindInputs();
  bindFlushHard();
  start();

  // expose minimal API
  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}
}