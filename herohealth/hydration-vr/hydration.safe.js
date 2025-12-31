// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — v5: Boss Rage+Decoy + Timed Mini Quests + VR Mini HUD
// ✅ Dual-eye targets for VR/cVR
// ✅ Panic (fever>=~80): shake + vignette (CSS)
// ✅ Waves: Boss / No-Junk
// ✅ NEW: Boss Rage + Decoy (fake broccoli)
// ✅ NEW: Mini Quests (timed + no-junk) + countdown + edge blink + safe beep
// ✅ NEW: VR/cVR still shows mission via Mini HUD + "ภารกิจ" button (auto-injected)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

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

/* ---------- minimal target styles (safe fallback) ---------- */
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-layer, #gj-layer-l, #gj-layer-r, .gj-layer{ position:absolute; inset:0; z-index:30; pointer-events:auto !important; touch-action:none; }
    .gj-target{
      position:absolute; left: var(--x, 50px); top: var(--y, 50px);
      transform: translate(-50%,-50%) scale(var(--s,1));
      width:74px; height:74px; border-radius:999px;
      display:flex; align-items:center; justify-content:center;
      font-size:38px; line-height:1;
      user-select:none; -webkit-user-select:none;
      pointer-events:auto !important; touch-action: manipulation;
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
    .gj-target.boss{ width:96px; height:96px; font-size:50px; border-color: rgba(34,197,94,.38); box-shadow: 0 22px 80px rgba(0,0,0,.55), 0 0 22px rgba(34,197,94,.18); }
    .gj-target.decoy{ border-color: rgba(239,68,68,.42); box-shadow: 0 22px 80px rgba(0,0,0,.55), 0 0 22px rgba(239,68,68,.18); }
    .gj-target.hit{ transform: translate(-50%,-50%) scale(calc(var(--s,1)*1.25)); opacity:.18; filter: blur(.7px); transition: transform 120ms ease, opacity 120ms ease, filter 120ms ease; }
    .gj-target.out{ opacity:0; transform: translate(-50%,-50%) scale(calc(var(--s,1)*0.85)); transition: transform 140ms ease, opacity 140ms ease; }
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
        <div class="wave-right"><span id="gjWaveRight">—</span></div>
      </div>
      <div class="wave-bar"><div class="wave-fill" id="gjWaveFill"></div></div>
    </div>`;
  DOC.body.appendChild(wrap);
}
function setWaveHud(show, title, rightText, pct, kind){
  const DOC = ROOT.document; if (!DOC) return;
  ensureWaveHud();
  const hud = DOC.getElementById('gjWaveHud');
  const t = DOC.getElementById('gjWaveTitle');
  const r = DOC.getElementById('gjWaveRight');
  const f = DOC.getElementById('gjWaveFill');
  if (!hud || !t || !r || !f) return;
  hud.hidden = !show;
  t.textContent = String(title||'—');
  r.textContent = String(rightText||'—');
  f.style.width = `${clamp(pct,0,100).toFixed(1)}%`;
  t.classList.remove('boss','nojunk');
  if (kind === 'boss') t.classList.add('boss');
  if (kind === 'nojunk') t.classList.add('nojunk');
}

/* ---------- Quest Toast + Peek (auto inject) ---------- */
function ensureQuestToast(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gjQuestToast')) return;
  const w = DOC.createElement('div');
  w.id = 'gjQuestToast';
  w.className = 'quest-toast';
  w.hidden = true;
  w.innerHTML = `
    <div class="toast-card">
      <div class="toast-title" id="gjToastTitle">—</div>
      <div class="toast-line" id="gjToastLine">—</div>
    </div>`;
  DOC.body.appendChild(w);
}
let _toastTimer = 0;
function showToast(title, line, ms=2200){
  const DOC = ROOT.document; if (!DOC) return;
  ensureQuestToast();
  const w = DOC.getElementById('gjQuestToast');
  const t = DOC.getElementById('gjToastTitle');
  const l = DOC.getElementById('gjToastLine');
  if (!w || !t || !l) return;
  t.textContent = String(title||'');
  l.textContent = String(line||'');
  w.hidden = false;
  try{ clearTimeout(_toastTimer); }catch(_){}
  _toastTimer = setTimeout(()=>{ w.hidden = true; }, clamp(ms, 900, 6000));
}

function ensureQuestPeek(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gjQuestPeek')) return;
  const p = DOC.createElement('div');
  p.id = 'gjQuestPeek';
  p.className = 'quest-peek';
  p.hidden = true;
  p.innerHTML = `
    <div class="peek-card">
      <div class="peek-title" id="gjPeekTitle">ภารกิจ</div>
      <div class="peek-line" id="gjPeekGoal">Goal: —</div>
      <div class="peek-line" id="gjPeekMini">Mini: —</div>
      <div class="peek-sub" id="gjPeekSub">แตะจอเพื่อปิด • ใน VR แนะนำ Fullscreen ก่อนเข้า cVR</div>
    </div>`;
  p.addEventListener('click', ()=>{ p.hidden = true; }, { passive:true });
  DOC.body.appendChild(p);
}
function showPeek(goalLine, miniLine){
  const DOC = ROOT.document; if (!DOC) return;
  ensureQuestPeek();
  const p = DOC.getElementById('gjQuestPeek');
  const g = DOC.getElementById('gjPeekGoal');
  const m = DOC.getElementById('gjPeekMini');
  if (!p || !g || !m) return;
  g.textContent = String(goalLine||'Goal: —');
  m.textContent = String(miniLine||'Mini: —');
  p.hidden = false;
}

/* ---------- VR Mini HUD (auto inject) ---------- */
function ensureVrMiniHud(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gjVrMiniHud')) return;

  const w = DOC.createElement('div');
  w.id = 'gjVrMiniHud';
  w.className = 'vr-mini-hud';
  w.style.display = 'none'; // shown only in view-vr/view-cvr via JS watcher
  w.innerHTML = `
    <div class="mini-row">
      <div class="mini-pill"><span>Score</span><b id="mScore">0</b></div>
      <div class="mini-pill"><span>Miss</span><b id="mMiss">0</b></div>
      <div class="mini-pill"><span>Time</span><b id="mTime">0</b></div>
      <div class="mini-pill"><span>Grade</span><b id="mGrade">—</b></div>
      <button class="mini-btn" id="mQuestBtn" type="button">ภารกิจ</button>
    </div>
  `;
  DOC.body.appendChild(w);

  const btn = DOC.getElementById('mQuestBtn');
  btn && btn.addEventListener('click', ()=>{
    // show latest lines from cached fields (set by engine)
    showPeek(_lastGoalLine, _lastMiniLine);
  });
}
function isVrView(){
  const b = ROOT.document?.body;
  return !!(b && (b.classList.contains('view-vr') || b.classList.contains('view-cvr')));
}
function syncVrMiniVisible(){
  const DOC = ROOT.document; if (!DOC) return;
  ensureVrMiniHud();
  const w = DOC.getElementById('gjVrMiniHud');
  if (!w) return;
  w.style.display = isVrView() ? 'block' : 'none';
}

let _lastGoalLine = 'Goal: —';
let _lastMiniLine = 'Mini: —';

function setPanic(fever){
  const DOC = ROOT.document;
  if (!DOC || !DOC.body) return;
  const p = clamp((fever - 78) / 22, 0, 1);
  DOC.body.style.setProperty('--panic', String(p.toFixed(3)));
  DOC.body.classList.toggle('panic', p > 0.001);
}

/* ---------- safe beep for countdown ---------- */
let _ac = null;
function beep(freq=740, dur=0.06, vol=0.04){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return;
    if (!_ac) _ac = new AC();
    if (_ac.state === 'suspended') _ac.resume?.();
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(_ac.destination);
    o.start();
    o.stop(_ac.currentTime + dur);
  }catch(_){}
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
  el._x = x; el._y = y;
}
function dist2(ax, ay, bx, by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function getCenter(el){
  try{ const r=el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; }
  catch(_){ return { x:(ROOT.innerWidth||360)*0.5, y:(ROOT.innerHeight||640)*0.5 }; }
}
function findTargetNear(layerEl, cx, cy, radiusPx){
  const r2max = radiusPx * radiusPx;
  const list = layerEl.querySelectorAll('.gj-target');
  let best=null, bestD2=1e18;
  list.forEach(el=>{
    try{
      const r=el.getBoundingClientRect();
      const tx=r.left+r.width/2, ty=r.top+r.height/2;
      const d2=dist2(cx,cy,tx,ty);
      if (d2<=r2max && d2<bestD2){ best=el; bestD2=d2; }
    }catch(_){}
  });
  return best;
}
function countTargets(layerEl){ try{ return layerEl.querySelectorAll('.gj-target').length; }catch(_){ return 0; } }

function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever,0,100), shield: clamp(shield,0,9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
  setPanic(fever);
}

function getLayerSize(layerEl){
  try{
    const r=layerEl.getBoundingClientRect();
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
  if ((sz.w-left-right) < 140){ left=10; right=10; }
  if ((sz.h-top-bottom) < 180){ top=8; bottom=8; }
  const x = left + rng() * (sz.w - left - right);
  const y = top  + rng() * (sz.h - top - bottom);
  return { x, y };
}

/* ===== Wave schedule ===== */
function buildWaveSchedule(S){
  const times = [];
  const waveEvery = (S.diff === 'hard') ? 14 : (S.diff === 'easy' ? 18 : 16);
  let t = 10;
  while (t < Math.max(8, S.timeSec - 8)){
    times.push(t);
    t += waveEvery;
  }
  return times.map((sec,i)=>({ atSec: sec, kind: (i%2===0)?'boss':'nojunk' }));
}

/* ===== Mini quests (timed, hard) ===== */
function buildMiniDefs(S){
  const d = S.diff;
  const scale = (d==='easy') ? 0.9 : (d==='hard'?1.15:1.0);

  return [
    { kind:'combo', title:'คอมโบมาแล้ว!', desc:'ทำคอมโบให้ถึง', need: Math.round(4*scale), durMs:0, forbidJunk:false },
    { kind:'combo_time', title:'Combo Rush', desc:'คอมโบภายในเวลา (ห้ามโดนขยะ)', need: Math.round(8*scale), durMs: Math.round(12000/scale), forbidJunk:true },
    { kind:'good_time', title:'Good Sprint', desc:'เก็บของดีให้ครบภายในเวลา (ห้ามโดนขยะ)', need: Math.round(6*scale), durMs: Math.round(8500/scale), forbidJunk:true },
    { kind:'streak', title:'แม่นยำ!', desc:'ของดีติดกัน (ห้ามโดนขยะ)', need: Math.round(5*scale), durMs:0, forbidJunk:true },
    { kind:'nojunk_survive', title:'No-Junk Mini', desc:'อยู่รอดโดยไม่โดนขยะ', need: 0, durMs: Math.round(9000/scale), forbidJunk:true },
    { kind:'boss_micro', title:'Mini Boss', desc:'ยิงบอสให้ครบภายในเวลา', need: Math.round(3*scale), durMs: Math.round(8000/scale), forbidJunk:false },
    { kind:'ultimate', title:'Ultimate', desc:'เก็บของดี 5 + โบนัส 1 ภายในเวลา (ห้ามโดนขยะ)', need: 6, needStar:1, durMs: Math.round(11000/scale), forbidJunk:true },
  ];
}

/* ===== Summary (kept) ===== */
function makeSummary(S, reason){
  const acc = S.hitAll>0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
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
async function flushLogger(){ /* optional hooks exist elsewhere */ }

export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return { start(){} };

  ensureTargetStyles();
  ensureWaveHud();
  ensureQuestToast();
  ensureQuestPeek();
  ensureVrMiniHud();
  syncVrMiniVisible();

  const layerL = opts.layerEl || DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer') || DOC.querySelector('.gj-layer');
  const layerR = opts.layerElR || DOC.getElementById('gj-layer-r') || null;
  const crossL = opts.crosshairEl || DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair') || DOC.querySelector('.gj-crosshair');
  const crossR = opts.crosshairElR || DOC.getElementById('gj-crosshair-r') || null;
  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');

  if (!layerL){
    console.warn('[GoodJunkVR] missing layer');
    return { start(){} };
  }
  const dual = !!layerR;

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';
  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;

  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || ts);

  const base = diffBase(diff);
  const safeMargins = opts.safeMargins || { top: 12, bottom: 12, left: 18, right: 18 };

  const S = {
    running:false, ended:false, flushed:false,
    diff, runMode, timeSec, seed, rng: makeRng(seed),
    tStart:0, left: timeSec,
    score:0, combo:0, comboMax:0,
    misses:0, hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,
    fever:0, shield:0,
    goalsCleared:0, goalsTotal:2,
    miniCleared:0, miniTotal:7,

    spawnTimer:0, tickTimer:0,
    spawnMs: base.spawnMs, ttlMs: base.ttlMs, size: base.size,
    junkP: base.junk, powerP: base.power, maxTargets: base.maxT,
    uidSeq: 1,

    // waves
    waves: [], waveIndex:0, waveActive:null,

    // minis
    miniDefs: [],
    miniIndex: 0,
    activeMini: null,  // {def, startAt, endAt, cur, curStar, streakGood, done}
    lastBeepSec: -1
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

  function updateMiniHud(){
    const ms = DOC.getElementById('mScore'); if (ms) ms.textContent = String(S.score|0);
    const mm = DOC.getElementById('mMiss');  if (mm) mm.textContent = String(S.misses|0);
    const mt = DOC.getElementById('mTime');  if (mt) mt.textContent = String(Math.max(0, S.left|0));
    const mg = DOC.getElementById('mGrade');
    if (mg){
      const acc = S.hitAll>0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
      mg.textContent = rankFromAcc(acc);
    }
  }

  function updateScore(){
    emit('hha:score', { score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0 });
    const acc = S.hitAll>0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
    updateMiniHud();
  }
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); updateMiniHud(); }

  function miniLine(){
    if (!S.activeMini) return 'Mini: —';
    const M = S.activeMini;
    const def = M.def;
    let extra = '';
    if (def.kind === 'ultimate') extra = ` (⭐ ${M.curStar||0}/${def.needStar||1})`;
    const leftMs = (def.durMs>0) ? Math.max(0, M.endAt - now()) : 0;
    const leftS = (def.durMs>0) ? ` • ${Math.ceil(leftMs/1000)}s` : '';
    return `Mini: ${def.title} ${M.cur||0}/${def.need||0}${extra}${leftS}`;
  }

  function updateQuest(){
    const goalTitle = `Goal: เก็บของดีให้ครบ`;
    const goalCount = `${S.goalsCleared}/${S.goalsTotal}`;

    const miniTitle = S.activeMini ? `Mini: ${S.activeMini.def.title}` : 'Mini: —';
    const miniCount = S.activeMini ? `${S.activeMini.cur||0}/${S.activeMini.def.need||0}` : `${S.miniCleared}/${S.miniTotal}`;

    const leftMs = (S.activeMini && S.activeMini.def.durMs>0) ? Math.max(0, S.activeMini.endAt - now()) : 0;

    emit('quest:update', {
      goalTitle, goalNow: S.goalsCleared, goalTotal: S.goalsTotal,
      miniTitle, miniNow: S.miniCleared, miniTotal: S.miniTotal,
      miniLeftMs: leftMs
    });

    _lastGoalLine = `${goalTitle} ${goalCount}`;
    _lastMiniLine = miniLine();

    // if VR view, show small toast sometimes
    if (isVrView() && S.activeMini && (S.activeMini._justStarted)){
      S.activeMini._justStarted = false;
      showToast('Mini Quest', _lastMiniLine, 2200);
    }
  }

  function clearTimers(){ try{ clearTimeout(S.spawnTimer); }catch(_){ } try{ clearTimeout(S.tickTimer); }catch(_){ } }

  function getMate(el){
    if (!dual || !el) return null;
    const uid = el.dataset.uid; if (!uid) return null;
    const inR = el.parentElement === layerR;
    return inR ? layerL.querySelector(`.gj-target[data-uid="${uid}"]`)
               : layerR.querySelector(`.gj-target[data-uid="${uid}"]`);
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
      miniOn('miss_good', {});
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

  /* ===== MINI SYSTEM ===== */
  function beginMini(index){
    const def = S.miniDefs[index];
    if (!def){ S.activeMini = null; return; }

    const M = {
      def,
      startAt: now(),
      endAt: def.durMs>0 ? (now() + def.durMs) : 0,
      cur: 0,
      curStar: 0,
      streakGood: 0,
      done: false,
      _justStarted: true
    };
    S.activeMini = M;

    // if boss mini: spawn boss immediately
    if (def.kind === 'boss_micro'){
      spawnBossTarget(/*isMicro*/true);
    }

    showToast('เริ่ม Mini!', `${def.title} — ${def.desc}`, 2400);
    updateQuest();
  }

  function failMini(reason='fail'){
    if (!S.activeMini) return;
    const def = S.activeMini.def;
    judge('warn', `Mini พลาด!`);
    coach('sad', 'Mini พลาด 😵', 'รีเซ็ตแล้วลองใหม่ทันที!');
    logEvent('mini_fail', { kind:def.kind, reason });
    // reset progress (stay on same mini)
    S.activeMini.startAt = now();
    S.activeMini.endAt = def.durMs>0 ? (now()+def.durMs) : 0;
    S.activeMini.cur = 0;
    S.activeMini.curStar = 0;
    S.activeMini.streakGood = 0;
    showToast('Mini รีเซ็ต', `${def.title} — ลองใหม่!`, 1800);
    updateQuest();
  }

  function clearMini(){
    if (!S.activeMini) return;
    const def = S.activeMini.def;
    S.miniCleared++;
    emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });

    // reward: small score + shield chance
    S.score += 220;
    if (S.miniCleared % 2 === 0) S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    coach('happy', 'Mini ผ่านแล้ว! 🔥', 'ไปต่อให้สุด!');
    logEvent('mini_clear', { kind:def.kind, miniCleared:S.miniCleared });

    S.activeMini.done = true;

    // next mini
    setTimeout(()=>{
      S.miniIndex++;
      if (S.miniIndex >= S.miniDefs.length){
        S.activeMini = null;
        showToast('Mini ครบแล้ว!', 'โหดมาก! เหลือเคลียร์ Goal + เอาตัวรอด', 2600);
        updateQuest();
      }else{
        beginMini(S.miniIndex);
      }
    }, 750);

    updateScore();
    updateQuest();
  }

  function miniTick(){
    // urgent edge blink + beeps for timed minis
    const b = DOC.body;
    if (!S.activeMini){ b.classList.remove('mini-urgent'); return; }

    const def = S.activeMini.def;
    if (def.durMs <= 0){ b.classList.remove('mini-urgent'); return; }

    const leftMs = Math.max(0, S.activeMini.endAt - now());
    const leftS = Math.ceil(leftMs/1000);

    // urgent when <=3s
    b.classList.toggle('mini-urgent', leftMs <= 3200);

    // beep once per second when urgent
    if (leftMs <= 3200 && leftS !== S.lastBeepSec){
      S.lastBeepSec = leftS;
      beep(720 + (3-leftS)*80, 0.05, 0.035);
    }

    // timeout => fail
    if (leftMs <= 0){
      failMini('timeout');
    }
  }

  function miniOn(ev, payload){
    if (!S.activeMini) return;
    const M = S.activeMini;
    const def = M.def;

    // forbid junk hit (shield block is NOT a junk hit for this rule)
    if (def.forbidJunk && ev === 'junk_hit'){
      failMini('junk_hit');
      return;
    }

    if (def.kind === 'combo'){
      if (ev === 'good_hit' || ev === 'star_hit' || ev === 'shield_hit' || ev === 'boss_hit'){
        M.cur = Math.max(M.cur, S.combo);
        if (M.cur >= def.need) clearMini();
      }
      return;
    }

    if (def.kind === 'combo_time'){
      if (ev === 'good_hit' || ev === 'star_hit' || ev === 'shield_hit' || ev === 'boss_hit'){
        M.cur = Math.max(M.cur, S.combo);
        if (M.cur >= def.need) clearMini();
      }
      if (ev === 'miss_good') { M.cur = 0; } // keep tough
      return;
    }

    if (def.kind === 'good_time'){
      if (ev === 'good_hit'){ M.cur++; if (M.cur >= def.need) clearMini(); }
      if (ev === 'miss_good'){ /* ignore for count but pressure exists */ }
      return;
    }

    if (def.kind === 'streak'){
      if (ev === 'good_hit'){ M.streakGood++; M.cur = M.streakGood; if (M.cur >= def.need) clearMini(); }
      if (ev === 'junk_hit' || ev === 'miss_good'){ M.streakGood = 0; M.cur = 0; }
      return;
    }

    if (def.kind === 'nojunk_survive'){
      // just survive time; any junk hit triggers fail by forbidJunk
      // clear when time passes in miniTick => if not failed, we clear by checking duration
      const leftMs = Math.max(0, M.endAt - now());
      const donePct = 100 - (leftMs / def.durMs) * 100;
      M.cur = Math.round(donePct);
      if (leftMs <= 0) clearMini();
      return;
    }

    if (def.kind === 'boss_micro'){
      if (ev === 'boss_hit'){
        M.cur++;
        if (M.cur >= def.need) clearMini();
      }
      return;
    }

    if (def.kind === 'ultimate'){
      if (ev === 'good_hit'){ M.cur++; }
      if (ev === 'star_hit'){ M.curStar++; }
      const okMain = (M.cur >= 5);
      const okStar = (M.curStar >= (def.needStar||1));
      if (okMain && okStar) clearMini();
      return;
    }
  }

  /* ===== WAVES ===== */
  function waveClear(){ S.waveActive=null; setWaveHud(false); }

  function spawnBossTarget(isMicro=false){
    if (!S.running || S.ended) return;

    // remove existing boss/decoy (keep clean)
    try{
      layerL.querySelectorAll('.gj-target.boss, .gj-target.decoy').forEach(el=>{ try{ el.remove(); }catch(_){} });
      if (dual && layerR) layerR.querySelectorAll('.gj-target.boss, .gj-target.decoy').forEach(el=>{ try{ el.remove(); }catch(_){} });
    }catch(_){}

    const uid = String(S.uidSeq++);
    const pL = randPosInLayer(S.rng, layerL, safeMargins);

    const elL = makeTarget('boss', BOSS_EMOJI, pL.x, pL.y, 1.0, uid);
    elL.classList.add('boss');
    elL._vx *= (isMicro ? 1.25 : 1.0);
    elL._vy *= (isMicro ? 1.25 : 1.0);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInLayer(S.rng, layerR, safeMargins);
      const elR = makeTarget('boss', BOSS_EMOJI, pR.x, pR.y, 1.0, uid);
      elR.classList.add('boss');
      elR._vx = elL._vx; elR._vy = elL._vy;
      layerR.appendChild(elR);
    }
  }

  function spawnDecoy(){
    if (!S.running || S.ended) return;
    const uid = String(S.uidSeq++);
    const pL = randPosInLayer(S.rng, layerL, safeMargins);

    // Decoy looks like broccoli but is "junk" logic
    const elL = makeTarget('decoy', BOSS_EMOJI, pL.x, pL.y, S.size * 0.98, uid);
    elL.classList.add('decoy');
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInLayer(S.rng, layerR, safeMargins);
      const elR = makeTarget('decoy', BOSS_EMOJI, pR.x, pR.y, S.size * 0.98, uid);
      elR.classList.add('decoy');
      layerR.appendChild(elR);
    }
  }

  function startBossWave(){
    const need = (S.diff==='easy') ? 3 : (S.diff==='hard'?5:4);
    const durMs = (S.diff==='hard') ? 9000 : 10000;

    S.waveActive = {
      kind:'boss',
      need,
      hit:0,
      endAt: now() + durMs,
      durMs,
      lastDecoyAt: 0
    };

    coach('neutral', `BOSS WAVE! ยิง 🥦 ให้ครบ ${need} ครั้ง`, 'ท้ายเวลาบอสจะเดือด + มีตัวปลอม!');
    judge('info', `BOSS: ${need} hits`);
    spawnBossTarget(false);
    setWaveHud(true, `BOSS WAVE 🥦`, `0/${need}`, 0, 'boss');
    showToast('WAVE!', 'BOSS WAVE เริ่มแล้ว 😈', 1800);
    logEvent('wave_start', { kind:'boss', need, durMs });
  }

  function startNoJunkWave(){
    const durMs = (S.diff==='hard') ? 9000 : 10000;
    S.waveActive = { kind:'nojunk', endAt: now() + durMs, durMs };
    coach('neutral', `NO-JUNK ZONE! ห้ามโดนขยะ ${Math.round(durMs/1000)} วิ`, 'โฟกัสของดี + โล่ช่วยได้');
    judge('info', `NO-JUNK ${Math.round(durMs/1000)}s`);
    setWaveHud(true, `NO-JUNK ZONE 🚫🍟`, `0:${Math.round(durMs/1000)}s`, 0, 'nojunk');
    showToast('WAVE!', 'NO-JUNK ZONE เริ่มแล้ว 🚫🍟', 1800);
    logEvent('wave_start', { kind:'nojunk', durMs });
  }

  function nojunkFail(){
    const W = S.waveActive;
    if (!W || W.kind !== 'nojunk') return;

    S.misses += 2;
    S.score = Math.max(0, S.score - 200);
    S.fever = clamp(S.fever + 10, 0, 100);
    updateFever(S.shield, S.fever);

    coach('sad', 'NO-JUNK พลาด! 😵', 'รอบหน้าใจเย็น ๆ แล้วคุมจังหวะยิง');
    judge('bad', 'NO-JUNK FAIL');
    showToast('WAVE FAIL', 'โดนขยะใน NO-JUNK!', 2000);

    logEvent('wave_fail', { kind:'nojunk' });

    updateScore(); updateQuest();
    waveClear();
  }

  function bossRageTick(){
    const W = S.waveActive;
    if (!W || W.kind !== 'boss') return;

    const leftMs = Math.max(0, W.endAt - now());
    const leftS = Math.ceil(leftMs/1000);

    const pct = (W.need>0) ? (W.hit/W.need)*100 : 0;

    // Rage factor 0..1 (stronger near end)
    const rage = clamp(1 - (leftMs / W.durMs), 0, 1);

    // spawn decoy when rage high
    if (rage >= 0.58){
      const gap = (rage >= 0.78) ? 900 : 1300;
      if (!W.lastDecoyAt || (now() - W.lastDecoyAt) > gap){
        W.lastDecoyAt = now();
        spawnDecoy();
      }
    }

    setWaveHud(true, `BOSS WAVE 🥦`, `${W.hit}/${W.need} • ${leftS}s`, pct, 'boss');

    if (leftMs <= 0){
      coach('sad', 'BOSS หนีไป! 😵', 'เดี๋ยวมีบอสมาใหม่—เตรียมยิงให้ไว');
      judge('warn', 'BOSS TIMEOUT');
      showToast('WAVE FAIL', 'BOSS TIMEOUT!', 1800);
      logEvent('wave_fail', { kind:'boss', reason:'timeout' });
      waveClear();
    }
  }

  function nojunkTick(){
    const W = S.waveActive;
    if (!W || W.kind !== 'nojunk') return;
    const leftMs = Math.max(0, W.endAt - now());
    const leftS = Math.ceil(leftMs/1000);
    const pct = 100 - (leftMs / W.durMs) * 100;

    setWaveHud(true, `NO-JUNK ZONE 🚫🍟`, `0:${leftS}s`, clamp(pct,0,100), 'nojunk');

    if (leftMs <= 0){
      S.score += 260;
      S.shield = clamp(S.shield + 1, 0, 9);
      updateFever(S.shield, S.fever);
      emit('hha:celebrate', { kind:'mini', title:'NO-JUNK CLEAR! +SHIELD' });
      coach('happy', 'ผ่าน NO-JUNK แล้ว! ✅', 'ได้โล่เพิ่ม + โบนัส');
      showToast('WAVE CLEAR', 'NO-JUNK CLEAR! +SHIELD', 2200);
      logEvent('wave_clear', { kind:'nojunk' });
      waveClear();
      updateScore(); updateQuest();
    }
  }

  function waveTick(){
    if (!S.waveActive) return;
    if (S.waveActive.kind === 'boss') bossRageTick();
    if (S.waveActive.kind === 'nojunk') nojunkTick();
  }

  function tryStartWave(elapsedSec){
    if (!S.waves.length) return;
    if (S.waveIndex >= S.waves.length) return;
    if (S.waveActive) return;

    const next = S.waves[S.waveIndex];
    if (elapsedSec >= next.atSec){
      S.waveIndex++;
      (next.kind === 'boss') ? startBossWave() : startNoJunkWave();
    }
  }

  /* ===== HIT LOGIC ===== */
  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
  }

  function hitBoss(el){
    const W = S.waveActive;
    if (W && W.kind === 'boss'){
      W.hit++;
    }

    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 160;
    S.score += pts;

    S.fever = clamp(S.fever - 5, 0, 100);
    updateFever(S.shield, S.fever);

    judge('good', `BOSS +${pts}`);
    burstAtEl(el, 'boss');
    logEvent('boss_hit', { score:S.score|0 });

    miniOn('boss_hit', {});

    updateScore(); updateQuest();
    removeTargetBoth(el);

    // keep pressure: respawn boss quickly during boss wave
    if (W && W.kind==='boss' && W.hit < W.need){
      setTimeout(()=>{ if (S.running && !S.ended && S.waveActive?.kind==='boss') spawnBossTarget(false); }, 420);
      const pct = (W.need>0) ? (W.hit/W.need)*100 : 0;
      setWaveHud(true, `BOSS WAVE 🥦`, `${W.hit}/${W.need}`, pct, 'boss');
    }

    // clear wave when reach need
    if (W && W.kind==='boss' && W.hit >= W.need){
      S.score += 220;
      S.shield = clamp(S.shield + 1, 0, 9);
      updateFever(S.shield, S.fever);
      emit('hha:celebrate', { kind:'mini', title:'BOSS CLEAR! +SHIELD' });
      coach('happy', 'โค่นบอสแล้ว! 😈✅', 'ได้โล่เพิ่ม + คะแนนโบนัส');
      showToast('WAVE CLEAR', 'BOSS CLEAR! +SHIELD', 2200);
      logEvent('wave_clear', { kind:'boss' });
      waveClear();
      updateScore(); updateQuest();
    }
  }

  function hitDecoy(el){
    // Decoy counts as junk hit (but looks like broccoli)
    S.hitAll++;

    if (S.shield > 0){
      // shield block: not a miss (per your standard)
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'DECOY BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'decoy' });

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++;
    S.misses++;
    S.combo = 0;

    S.score = Math.max(0, S.score - 220);
    S.fever = clamp(S.fever + 14, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', 'โดนตัวปลอม! 😵');
    coach('sad', 'หลอกแล้ว! (Decoy)', 'สังเกตขอบแดง/สั่น แล้วค่อยยิง');
    showToast('DECOY!', 'นี่คือตัวปลอม 😈', 1600);

    miniOn('junk_hit', { kind:'decoy' });

    updateScore(); updateQuest();
    burstAtEl(el, 'junk');
    removeTargetBoth(el);
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

    miniOn('good_hit', {});

    updateScore(); updateQuest();
    removeTargetBoth(el);

    // goals
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8);
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', 'Goal ผ่านแล้ว! ✅', 'ไปต่อ!');
        showToast('GOAL!', `ผ่านแล้ว ${S.goalsCleared}/${S.goalsTotal}`, 1800);
        updateQuest();
      }
    }
  }

  function hitShield(el){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    S.score += 70;
    judge('good', 'SHIELD +1');
    burstAtEl(el, 'shield');

    miniOn('shield_hit', {});

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
    burstAtEl(el, 'star');

    miniOn('star_hit', {});

    updateScore(); updateQuest();
    removeTargetBoth(el);
  }

  function hitJunk(el){
    S.hitAll++;

    // if no-junk wave active, junk hit => fail wave (unless blocked)
    const inNoJunkWave = (S.waveActive && S.waveActive.kind === 'nojunk');

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');

      updateScore(); updateQuest();
      removeTargetBoth(el);
      return;
    }

    S.hitJunk++;
    S.misses++;
    S.combo = 0;

    S.score = Math.max(0, S.score - 170);
    S.fever = clamp(S.fever + 12, 0, 100);
    updateFever(S.shield, S.fever);

    judge('bad', 'JUNK!');
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งกลางแล้วกดยิง');

    miniOn('junk_hit', { kind:'junk' });

    updateScore(); updateQuest();
    burstAtEl(el, 'junk');
    removeTargetBoth(el);

    if (inNoJunkWave) nojunkFail();
  }

  function hitTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    if (tp === 'boss') return hitBoss(el);
    if (tp === 'decoy') return hitDecoy(el);
    if (tp === 'good') return hitGood(el);
    if (tp === 'junk') return hitJunk(el);
    if (tp === 'shield') return hitShield(el);
    if (tp === 'star') return hitStar(el);
  }

  /* ===== Spawn loop ===== */
  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets(layerL) >= S.maxTargets) return;

    const inBoss = (S.waveActive?.kind === 'boss');
    const inNoJunk = (S.waveActive?.kind === 'nojunk');

    // base probabilities
    let powerP = S.powerP;
    let junkP  = S.junkP;
    let starP  = 0.035;

    // Boss wave -> more junk pressure + less star
    if (inBoss){
      starP = 0.020;
      junkP = clamp(junkP + 0.03, 0.08, 0.28);
    }
    // NoJunk wave -> fairer
    if (inNoJunk){
      junkP = clamp(junkP - 0.05, 0.06, 0.22);
      powerP = clamp(powerP + 0.010, 0.01, 0.08);
    }

    const r = S.rng();
    let tp = 'good';
    if (r < powerP) tp='shield';
    else if (r < powerP + starP) tp='star';
    else if (r < powerP + starP + junkP) tp='junk';
    else tp='good';

    const uid = String(S.uidSeq++);
    const pL = randPosInLayer(S.rng, layerL, safeMargins);
    const emoji =
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'star') ? pick(S.rng, STARS) :
      SHIELD;

    const s =
      (tp === 'junk') ? (S.size * 0.98) :
      (tp === 'shield') ? (S.size * 1.03) :
      (tp === 'star') ? (S.size * 1.02) :
      S.size;

    const elL = makeTarget(tp, emoji, pL.x, pL.y, s, uid);
    layerL.appendChild(elL);

    if (dual && layerR){
      const pR = randPosInLayer(S.rng, layerR, safeMargins);
      const elR = makeTarget(tp, emoji, pR.x, pR.y, s, uid);
      layerR.appendChild(elR);
    }
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    spawnOne();

    let nextMs = S.spawnMs;
    if (S.waveActive?.kind === 'boss') nextMs = Math.max(340, nextMs - 140);

    S.spawnTimer = setTimeout(loopSpawn, clamp(nextMs, 320, 1400));
  }

  function moveTargetsLayer(layerEl){
    if (!layerEl) return;
    const sz = getLayerSize(layerEl);
    const mx = Math.max(12, safeMargins.left);
    const my = Math.max(10, safeMargins.top);
    const maxX = Math.max(mx+10, sz.w - Math.max(12, safeMargins.right));
    const maxY = Math.max(my+10, sz.h - Math.max(10, safeMargins.bottom));

    const heat = clamp((S.fever - 40) / 60, 0, 1);
    const bossBoost = (S.waveActive?.kind==='boss') ? 0.35 : 0;
    const speedMult = 1 + heat * 1.25 + bossBoost;

    const list = layerEl.querySelectorAll('.gj-target');
    list.forEach(el=>{
      if (!el || !el.isConnected) return;

      const tp = String(el.dataset.type||'');
      const typeBoost = (tp==='boss' || tp==='decoy') ? 1.25 : 1.0;

      const vx = (el._vx || 0) * speedMult * typeBoost;
      const vy = (el._vy || 0) * speedMult * typeBoost;

      let x = (typeof el._x === 'number') ? el._x : 50;
      let y = (typeof el._y === 'number') ? el._y : 50;

      x += vx; y += vy;

      if (x < mx){ x = mx; el._vx = Math.abs(el._vx || 0.4); }
      if (x > maxX){ x = maxX; el._vx = -Math.abs(el._vx || 0.4); }
      if (y < my){ y = my; el._vy = Math.abs(el._vy || 0.35); }
      if (y > maxY){ y = maxY; el._vy = -Math.abs(el._vy || 0.35); }

      setXY(el, x, y);

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

    moveTargetsLayer(layerL);
    if (dual) moveTargetsLayer(layerR);

    const elapsed = (now() - S.tStart) / 1000;

    // schedule waves
    tryStartWave(elapsed);
    waveTick();

    // mini tick
    miniTick();
    updateQuest();

    if (S.left <= 0){ endGame('time'); return; }

    // Adaptive only in play
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
      try{
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        localStorage.setItem('hha_last_summary', JSON.stringify(summary));
      }catch(_){}
      await flushLogger();
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');
    showToast('จบเกม', `Grade ${summary.grade} • Acc ${summary.accuracyGoodPct}%`, 3000);
  }

  function start(){
    if (S.running) return;

    S.running = true;
    S.ended = false;
    S.flushed = false;

    S.tStart = now();
    S.left = timeSec;

    S.score=0; S.combo=0; S.comboMax=0;
    S.misses=0; S.hitAll=0; S.hitGood=0; S.hitJunk=0; S.hitJunkGuard=0; S.expireGood=0;
    S.fever=0; S.shield=0;
    updateFever(S.shield, S.fever);

    S.goalsCleared=0;
    S.miniCleared=0;

    // waves + minis
    S.waves = buildWaveSchedule(S);
    S.waveIndex = 0;
    S.waveActive = null;

    S.miniDefs = buildMiniDefs(S);
    S.miniTotal = S.miniDefs.length;
    S.miniIndex = 0;
    beginMini(0);

    coach('neutral', 'พร้อมลุย! มี WAVE + Mini จับเวลา โหดขึ้นเรื่อย ๆ 😈', 'ใน VR กด “ภารกิจ” ดูได้ตลอด');
    showToast('เริ่มเกม', 'ช่วงแรกนุ่ม ๆ แล้วค่อยเดือด 🔥', 2200);

    updateScore(); updateTime(); updateQuest();

    loopSpawn();
    adaptiveTick();
  }

  // watch body class changes for VR mini hud visibility (cheap polling)
  let _vwT = 0;
  function viewWatch(){
    syncVrMiniVisible();
    _vwT = setTimeout(viewWatch, 500);
  }
  viewWatch();

  bindInputs();

  const api = { start, endGame, shoot: shootAtCrosshair, state: S };
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