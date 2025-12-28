// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard + Stereo/Boss/Survival + End Summary + Metrics
// ✅ DOM targets on #gj-layer (+ #gj-layerR for stereo)
// ✅ Warmup 3s แล้วเร่งแบบเกมจริง
// ✅ Adaptive เฉพาะ run=play (โหมดธรรมดา)
// ✅ Research mode (run=research) : ยึดตาม diff (ไม่ adapt)
// ✅ ยิงกลาง + แตะเป้า
// ✅ Stereo: spawn เป้าซ้าย/ขวาคู่กัน (hit/expire/remove พร้อมกัน)
// ✅ Boss: ring/laser ทำงานจริง (กวาดเป้า -> good นับ miss)
// ✅ Survival: missLimit ตาม diff (miss = expire good + junk hit (unblocked))
// ✅ endPolicy=time|all : all = ไม่จบตามเวลา (จบเมื่อ goal+mini ครบ หรือ survival fail)
// ✅ End Summary Overlay: ปุ่มกลับ HUB / เล่นใหม่ + flush-hardened
// ✅ Metrics: spawned counts + accuracy + junkError + avg/median RT + fastHitRate + ISO timestamps

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function pad2(n){ n = n|0; return (n<10?'0':'')+n; }
function isoNow(){
  try{ return new Date().toISOString(); }catch(_){ return ''; }
}

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
function isStereoMode(){
  try{ return !!ROOT.document?.body?.classList.contains('gj-stereo'); }catch(_){ return false; }
}
function deviceTag(){
  const ua = String(ROOT.navigator?.userAgent||'');
  const mob = isMobileLike() ? 'mobile' : 'desktop';
  if (/oculus|quest/i.test(ua)) return 'quest';
  if (/android/i.test(ua)) return 'android-' + mob;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios-' + mob;
  return mob;
}

// optional modules
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { set(){}, get(){ return { value:0, state:'low', shield:0 }; }, setShield(){} };

// ---- tiny tick sound (WebAudio) ----
let _ac = null;
function ensureAudio(){
  try{
    if (_ac) return _ac;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    _ac = new AC();
    return _ac;
  }catch(_){ return null; }
}
function playTick(intensity = 0.6){
  const ac = ensureAudio();
  if (!ac) return;
  try{
    if (ac.state === 'suspended') ac.resume?.();
    const t0 = ac.currentTime + 0.001;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880 + 260*clamp(intensity,0,1), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06 * clamp(intensity,0,1), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    o.connect(g); g.connect(ac.destination);
    o.start(t0);
    o.stop(t0 + 0.10);
  }catch(_){}
}

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
  if (diff === 'easy') return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7, missLimit: 8 };
  if (diff === 'hard') return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9, missLimit: 5 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8, missLimit: 6 };
}

// -------------------- style injection (กัน "เป้าไม่โผล่") --------------------
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-layer, #gj-layerR{
      position:absolute; inset:0;
      z-index:20;
      pointer-events:auto;
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
      pointer-events:auto; touch-action: manipulation;
      background: rgba(2,6,23,.55);
      border: 1px solid rgba(148,163,184,.22);
      box-shadow: 0 16px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04) inset;
      backdrop-filter: blur(8px);
      will-change: transform, opacity;
      z-index: 30;
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
function buildAvoidRects(layerEl){
  const DOC = ROOT.document;
  const rects = [];
  if (!DOC) return rects;

  const eye = layerEl?.closest?.('.gj-eye') || DOC;
  const els = [
    eye.querySelector?.('.hud-top'),
    eye.querySelector?.('.hud-mid'),
    eye.querySelector?.('.hha-controls'),
    eye.querySelector?.('.hha-fever')
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
function getLayerSize(layerEl){
  try{
    const r = layerEl.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), rect: r };
  }catch(_){
    return { w: ROOT.innerWidth||360, h: ROOT.innerHeight||640, rect: {left:0,top:0} };
  }
}

// -------------------- gameplay helpers --------------------
const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

function setXY(el, x, y){
  el.style.left = x.toFixed(1) + 'px';
  el.style.top  = y.toFixed(1) + 'px';
}
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}
function getCrosshairCenter(crosshairEl){
  if (!crosshairEl){
    return { x: 0, y: 0 };
  }
  try{
    const r = crosshairEl.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){
    return { x: 0, y: 0 };
  }
}

// aim assist
function findTargetNear(layerEl, cx, cy, radiusPx){
  const r2max = radiusPx * radiusPx;
  const list = layerEl.querySelectorAll('.gj-target');
  let best = null;
  let bestScore = 1e18;

  list.forEach(el=>{
    try{
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width/2;
      const ty = r.top + r.height/2;
      const d2 = dist2(cx, cy, tx, ty);
      if (d2 > r2max) return;

      const tp = String(el.dataset.type||'');
      let penalty = 0;
      if (tp === 'junk') penalty = 1400;
      if (tp === 'shield') penalty = -450;
      if (tp === 'star') penalty = -220;
      if (tp === 'good') penalty = -120;

      const score = d2 + penalty;
      if (score < bestScore){
        bestScore = score;
        best = el;
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
  emit('hha:fever', { value: clamp(fever,0,100), shield: clamp(shield,0,9) });
}

// -------------------- End Summary Overlay --------------------
function buildHubUrl(allowParams){
  const hub = String(qs('hub','./index.html') || './index.html');
  let u;
  try{ u = new URL(hub, ROOT.location.href); }catch(_){ u = new URL('./index.html', ROOT.location.href); }

  // keep selected params from current url
  try{
    const cur = new URL(ROOT.location.href);
    const sp = cur.searchParams;
    for (const k of allowParams){
      const v = sp.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    }
    // also keep vr/stereo if present
    const keep2 = ['vr','stereo','diff','run','phase','studyId','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester'];
    keep2.forEach(k=>{
      const v = sp.get(k);
      if (v != null && v !== '') u.searchParams.set(k, v);
    });

    u.searchParams.set('hubFrom','goodjunk');
    u.searchParams.set('last','1');
  }catch(_){}

  return u.toString();
}

function renderEndSummary(summary){
  const DOC = ROOT.document;
  if (!DOC) return;

  const hostL = DOC.getElementById('end-summary');
  const hostR = DOC.getElementById('end-summaryR');

  if (!hostL) return;

  const acc = summary.accuracyGoodPct|0;
  const grade = summary.grade || '—';
  const reason = String(summary.reason || 'end');
  const dur = summary.durationPlayedSec|0;

  const tags = [
    `diff:${summary.diff}`,
    `run:${summary.runMode}`,
    `end:${String(qs('end','time'))}`,
    `seed:${String(summary.seed||'')}`.slice(0, 18)
  ];

  const html = `
    <div class="end-overlay show">
      <div class="end-card">
        <div class="end-head">
          <div>
            <div class="end-title">สรุปผลการเล่น</div>
            <div class="end-sub">เหตุผลจบ: ${reason} • เวลาเล่น: ${dur}s</div>
          </div>
          <div class="end-grade">
            <div class="g">${grade}</div>
            <div class="a">ACC ${acc}%</div>
          </div>
        </div>

        <div class="end-grid">
          <div class="end-item"><div class="k">Score</div><div class="v">${summary.scoreFinal|0}</div></div>
          <div class="end-item"><div class="k">Combo Max</div><div class="v">${summary.comboMax|0}</div></div>
          <div class="end-item"><div class="k">Miss</div><div class="v">${summary.misses|0}</div></div>

          <div class="end-item"><div class="k">Good Hit</div><div class="v">${summary.nHitGood|0}</div></div>
          <div class="end-item"><div class="k">Junk Hit</div><div class="v">${summary.nHitJunk|0}</div></div>
          <div class="end-item"><div class="k">Shield Blocks</div><div class="v">${summary.nHitJunkGuard|0}</div></div>

          <div class="end-item"><div class="k">Goals</div><div class="v">${summary.goalsCleared|0}/${summary.goalsTotal|0}</div></div>
          <div class="end-item"><div class="k">Minis</div><div class="v">${summary.miniCleared|0}/${summary.miniTotal|0}</div></div>
          <div class="end-item"><div class="k">RT (ms)</div><div class="v">${summary.medianRtGoodMs||0}</div></div>
        </div>

        <div class="end-row">
          <div class="end-tags">
            ${tags.map(t=>`<span class="tag">${t}</span>`).join('')}
          </div>
        </div>

        <div class="end-actions">
          <button class="end-btn primary" id="btnHub">กลับ HUB</button>
          <button class="end-btn" id="btnReplay">เล่นใหม่</button>
        </div>
      </div>
    </div>
  `;

  hostL.innerHTML = html;
  if (hostR) hostR.innerHTML = html.replaceAll('btnHub','btnHubR').replaceAll('btnReplay','btnReplayR');

  // hook buttons (flush-hardened)
  const allowParams = [
    'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'schoolYear','semester','studentKey','schoolCode','schoolName','classRoom','studentNo',
    'nickName','gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'gameVersion'
  ];

  const hubUrl = buildHubUrl(allowParams);

  const disableAll = () => {
    ['btnHub','btnReplay','btnHubR','btnReplayR'].forEach(id=>{
      const b = DOC.getElementById(id);
      if (b) b.disabled = true;
    });
  };

  const goHub = async () => {
    disableAll();
    try{ await flushLogger('back_hub'); }catch(_){}
    setTimeout(()=>{ ROOT.location.href = hubUrl; }, 80);
  };

  const replay = async () => {
    disableAll();
    try{ await flushLogger('replay'); }catch(_){}
    setTimeout(()=>{ ROOT.location.reload(); }, 80);
  };

  const b1 = DOC.getElementById('btnHub');
  const b2 = DOC.getElementById('btnReplay');
  const b1r = DOC.getElementById('btnHubR');
  const b2r = DOC.getElementById('btnReplayR');

  if (b1) b1.onclick = (e)=>{ e.preventDefault?.(); goHub(); };
  if (b2) b2.onclick = (e)=>{ e.preventDefault?.(); replay(); };
  if (b1r) b1r.onclick = (e)=>{ e.preventDefault?.(); goHub(); };
  if (b2r) b2r.onclick = (e)=>{ e.preventDefault?.(); replay(); };
}

// -------------------- exported boot --------------------
export function boot(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  const layerElR = opts.layerElR || DOC.getElementById('gj-layerR') || null;

  const crosshairEl = opts.crosshairEl || DOC.getElementById('gj-crosshair');
  const crosshairElR = opts.crosshairElR || DOC.getElementById('gj-crosshairR') || null;

  const ringEl = opts.ringEl || DOC.getElementById('atk-ring');
  const ringElR = opts.ringElR || DOC.getElementById('atk-ringR') || null;
  const laserEl = opts.laserEl || DOC.getElementById('atk-laser');
  const laserElR = opts.laserElR || DOC.getElementById('atk-laserR') || null;

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const shootElR = opts.shootElR || DOC.getElementById('btnShootR') || null;

  if (!layerEl){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run || qs('run','play')).toLowerCase();
  const runMode = (run === 'research') ? 'research' : 'play';

  const timeSec = clamp(Number(opts.time ?? qs('time','80')), 30, 600) | 0;
  const endPolicy = String(opts.endPolicy || qs('end','time')).toLowerCase(); // time|all
  const challenge = String(opts.challenge || qs('challenge','rush')).toLowerCase(); // rush|boss|survival

  const sessionId = String(opts.sessionId || qs('sessionId', qs('sid','')) || '');
  const seedIn = opts.seed || qs('seed', null);
  const ts = String(qs('ts', Date.now()));
  const seed = String(seedIn || (sessionId ? (sessionId + '|' + ts) : ts));

  const ctx = opts.context || {};
  const gameVersion = String(ctx.gameVersion || qs('gameVersion','goodjunk.safe.v1') || 'goodjunk.safe.v1');

  // state
  const base = diffBase(diff);
  const stereo = !!(layerElR && isStereoMode());

  const S = {
    running:false,
    ended:false,
    flushed:false,

    diff, runMode, timeSec, seed,
    rng: makeRng(seed),
    endPolicy, challenge,

    stereo,

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

    missLimit: base.missLimit,

    warmupUntil: 0,
    spawnTimer: 0,
    tickTimer: 0,
    bossTimer: 0,

    lastTickAt: 0,

    // live params
    spawnMs: base.spawnMs,
    ttlMs: base.ttlMs,
    size: base.size,
    junkP: base.junk,
    powerP: base.power,
    maxTargets: base.maxT,

    // metrics
    startTimeIso: '',
    endTimeIso: '',
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetShieldSpawned: 0,
    rtsGoodMs: [],
    fastHitGood: 0,

    // spawn timing by uid
    spawnTimeByUid: new Map()
  };

  // mobile tune
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
    safeMargins.left = Math.max(18, safeMargins.left);
    safeMargins.right = Math.max(18, safeMargins.right);
  }

  // ---- No-Junk Zone (ยุติธรรมขึ้น) ----
  // warmup 3s: junk ห้ามใกล้ crosshair เกินรัศมีนี้
  const noJunkRadiusPx = clamp(Number(qs('nojunk','0')) || (stereo ? 120 : 100), 60, 180);

  // stereo pair map
  const pairMap = new Map(); // uid -> { L, R }
  let uidSeq = 1;

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
    const leftShow = Math.max(0, S.left|0);
    emit('hha:time', { left: leftShow });
  }
  function updateQuest(){
    const goalTitle = (S.challenge === 'boss') ? `โหมดบอส: เก็บของดี + รอดสกิล` :
                      (S.challenge === 'survival') ? `SURVIVAL: ห้ามพลาดเกิน ${S.missLimit}` :
                      `เก็บของดีให้ครบ`;

    const miniTitle = `คอมโบให้ถึง!`;

    emit('quest:update', {
      goalTitle: `Goal: ${goalTitle}`,
      goalNow: S.goalsCleared,
      goalTotal: S.goalsTotal,
      miniTitle: `Mini: ${miniTitle}`,
      miniNow: S.miniCleared,
      miniTotal: S.miniTotal,
      miniLeftMs: 0
    });

    emit('quest:progress', {
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal
    });
  }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
    try{ clearTimeout(S.bossTimer); }catch(_){}
  }

  function burstAtEl(el, kind){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || el.dataset.type || '');
    }catch(_){}
  }

  function removePair(uid){
    const p = pairMap.get(uid);
    if (!p) return;
    pairMap.delete(uid);
    try{ if (p.L && p.L.isConnected) p.L.remove(); }catch(_){}
    try{ if (p.R && p.R.isConnected) p.R.remove(); }catch(_){}
  }

  function removeTarget(el){
    if (!el) return;
    const uid = el.dataset.uid;
    const p = uid ? pairMap.get(uid) : null;

    const kill = (node)=>{
      if (!node || !node.isConnected) return;
      try{ clearTimeout(node._ttl); }catch(_){}
      node.classList.add('hit');
      setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, 140);
    };

    if (p){
      kill(p.L); kill(p.R);
      pairMap.delete(uid);
    }else{
      kill(el);
    }
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

      if (S.challenge === 'survival' && S.misses >= S.missLimit){
        endGame('miss_limit');
        return;
      }
    }

    const uid = el.dataset.uid;
    const p = uid ? pairMap.get(uid) : null;
    const out = (node)=>{
      if (!node || !node.isConnected) return;
      node.classList.add('out');
      setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, 160);
    };

    if (p){
      out(p.L); out(p.R);
      pairMap.delete(uid);
    }else{
      out(el);
    }
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

    el._ttl = setTimeout(()=> expireTarget(el), S.ttlMs);

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitTarget(el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function countTargets(layer){
    try{ return layer.querySelectorAll('.gj-target').length; }catch(_){ return 0; }
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

    // RT for good
    try{
      const uid = String(el.dataset.uid||'');
      const t0 = S.spawnTimeByUid.get(uid);
      if (t0){
        const rt = Math.round(now() - t0);
        S.rtsGoodMs.push(rt);
        if (rt <= 450) S.fastHitGood++;
      }
    }catch(_){}

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtEl(el, 'good');

    logEvent('hit', { kind:'good', emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();

    // minis by combo thresholds
    if (S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2);
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! 🔥`, `ต่อให้สุด!`);
        updateQuest();
      }
    }

    // goals by total good hits
    if (S.goalsCleared < S.goalsTotal){
      const needGood = 10 + (S.goalsCleared * 8); // 10,18
      if (S.hitGood >= needGood){
        S.goalsCleared++;
        emit('hha:celebrate', { kind:'goal', title:`Goal ผ่าน! ${S.goalsCleared}/${S.goalsTotal}` });
        coach('happy', `Goal ผ่านแล้ว!`, `คุมความแม่น + หลีกขยะ`);
        updateQuest();
      }
    }

    if (S.endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
      endGame('all_complete');
      return;
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

    if (S.challenge === 'survival' && S.misses >= S.missLimit){
      endGame('miss_limit');
      return;
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

  function randPos(rng, safeMargins, layerEl){
    const { w:W, h:H, rect } = getLayerSize(layerEl);

    let top = safeMargins?.top ?? 120;
    let bottom = safeMargins?.bottom ?? 170;
    let left = safeMargins?.left ?? 22;
    let right = safeMargins?.right ?? 22;

    if ((W - left - right) < 180){ left = 12; right = 12; }
    if ((H - top - bottom) < 260){ top = Math.max(90, top - 24); bottom = Math.max(130, bottom - 24); }

    const avoid = buildAvoidRects(layerEl);

    for (let i=0;i<18;i++){
      const x = left + rng() * (W - left - right);
      const y = top + rng() * (H - top - bottom);

      const vx = rect.left + x;
      const vy = rect.top + y;

      let ok = true;
      for (const r of avoid){
        if (pointInRect(vx, vy, { left:r.left-8, right:r.right+8, top:r.top-8, bottom:r.bottom+8 })){
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

  function spawnOne(){
    if (!S.running || S.ended) return;

    if (countTargets(layerEl) >= S.maxTargets) return;

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

    // position
    let p = randPos(S.rng, safeMargins, layerEl);

    // No-Junk Zone: ช่วง warmup กัน junk ใกล้ crosshair
    if (inWarm && tp === 'junk'){
      const c = getCrosshairCenter(crosshairEl);
      const layerRect = layerEl.getBoundingClientRect();
      // convert local p -> viewport
      const vx = layerRect.left + p.x;
      const vy = layerRect.top + p.y;
      const d2 = dist2(vx, vy, c.x, c.y);

      if (d2 < (noJunkRadiusPx*noJunkRadiusPx)){
        // reroll up to 10 times
        for (let k=0;k<10;k++){
          const pp = randPos(S.rng, safeMargins, layerEl);
          const vx2 = layerRect.left + pp.x;
          const vy2 = layerRect.top + pp.y;
          if (dist2(vx2, vy2, c.x, c.y) >= (noJunkRadiusPx*noJunkRadiusPx)){
            p = pp; break;
          }
        }
      }
    }

    const size = (inWarm ? (S.size * 1.06) : S.size);
    const uid = String(uidSeq++);

    let emoji = '✨';
    let s = size;

    if (tp === 'good'){ emoji = pick(S.rng, GOOD); s = size; S.nTargetGoodSpawned++; }
    if (tp === 'junk'){ emoji = pick(S.rng, JUNK); s = size * 0.98; S.nTargetJunkSpawned++; }
    if (tp === 'shield'){ emoji = SHIELD; s = size * 1.03; S.nTargetShieldSpawned++; }
    if (tp === 'star'){ emoji = pick(S.rng, STARS); s = size * 1.02; S.nTargetStarSpawned++; }

    // record spawn time for RT
    try{ S.spawnTimeByUid.set(uid, now()); }catch(_){}

    const L = makeTarget(tp, emoji, p.x, p.y, s, uid);
    layerEl.appendChild(L);

    let R = null;
    if (S.stereo && layerElR){
      R = makeTarget(tp, emoji, p.x, p.y, s, uid);
      layerElR.appendChild(R);
    }

    pairMap.set(uid, { L, R });

    logEvent('spawn', { kind:tp, emoji:String(emoji||''), uid });
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

  // Boss hazards
  function setRing(show, gapStartDeg, gapSizeDeg){
    try{
      DOC.documentElement.style.setProperty('--ringGapStart', `${gapStartDeg}deg`);
      DOC.documentElement.style.setProperty('--ringGapSize', `${gapSizeDeg}deg`);
    }catch(_){}
    const on = !!show;
    try{ ringEl?.classList.toggle('show', on); }catch(_){}
    try{ ringElR?.classList.toggle('show', on); }catch(_){}
  }
  function setLaser(state){ // '', 'warn', 'fire'
    try{
      laserEl?.classList.remove('warn','fire');
      laserElR?.classList.remove('warn','fire');
      if (state) { laserEl?.classList.add(state); laserElR?.classList.add(state); }
    }catch(_){}
  }

  function sweepTargetsByPredicate(pred){
    const list = layerEl.querySelectorAll('.gj-target');
    list.forEach(el=>{
      try{
        const uid = el.dataset.uid;
        if (!uid) return;
        const p = pairMap.get(uid);
        if (!p || !p.L) return;

        const r = p.L.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;

        if (!pred(cx, cy)) return;

        const tp = String(p.L.dataset.type||'');
        if (tp === 'good'){
          S.misses++;
          S.expireGood++;
          S.combo = 0;
          S.fever = clamp(S.fever + 6, 0, 100);
          updateFever(S.shield, S.fever);
          judge('warn', 'BOSS SWEEP! (MISS)');
          updateScore();
          updateQuest();
          if (S.challenge === 'survival' && S.misses >= S.missLimit){
            endGame('miss_limit');
          }
        }

        expireTarget(p.L);
      }catch(_){}
    });
  }

  function bossPulse(){
    if (!S.running || S.ended) return;
    if (S.challenge !== 'boss') return;

    const pickHaz = (S.rng() < 0.52) ? 'ring' : 'laser';

    if (pickHaz === 'ring'){
      const gapStart = Math.round(S.rng() * 360);
      const gapSize  = Math.round(70 + S.rng() * 70); // 70..140
      setRing(true, gapStart, gapSize);

      setTimeout(()=>{
        if (!S.running || S.ended) return;

        const layerRect = layerEl.getBoundingClientRect();
        const cx0 = layerRect.left + layerRect.width/2;
        const cy0 = layerRect.top + layerRect.height/2;
        const safeR = Math.min(layerRect.width, layerRect.height) * (0.26 + S.rng()*0.05);

        sweepTargetsByPredicate((x,y)=>{
          const dx = x - cx0, dy = y - cy0;
          const d = Math.sqrt(dx*dx + dy*dy);
          return d > safeR;
        });

        S.fever = clamp(S.fever + 8, 0, 100);
        updateFever(S.shield, S.fever);
      }, 520);

      setTimeout(()=>{ setRing(false, gapStart, gapSize); }, 980);

    } else {
      setLaser('warn');

      setTimeout(()=>{
        if (!S.running || S.ended) return;
        setLaser('fire');

        const layerRect = layerEl.getBoundingClientRect();
        const y0 = layerRect.top + layerRect.height * (0.45 + (S.rng()*0.08 - 0.04));
        const band = Math.max(28, layerRect.height * 0.06);

        sweepTargetsByPredicate((x,y)=> Math.abs(y - y0) <= band );

        S.fever = clamp(S.fever + 10, 0, 100);
        updateFever(S.shield, S.fever);
      }, 520);

      setTimeout(()=>{ setLaser(''); }, 900);
    }

    const interval = clamp(3200 - (S.comboMax*6) - (S.hitGood*8), 1800, 3400);
    S.bossTimer = setTimeout(bossPulse, interval);
  }

  function adaptiveTick(){
    if (!S.running || S.ended) return;

    S.left = S.left - 0.14;
    updateTime();

    if (S.endPolicy !== 'all' && S.left <= 0){
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

    // panic tick
    try{
      const leftForPanic = Math.max(0, S.left);
      const panic = (S.endPolicy !== 'all' && leftForPanic <= 10.5) || (S.fever >= 78);
      ROOT.document?.body?.classList.toggle('gj-panic', !!panic);

      if (S.endPolicy !== 'all' && leftForPanic <= 10.0 && leftForPanic > 0){
        const t = now();
        const intensity = clamp(1 - (leftForPanic / 10), 0, 1);
        const interval = clamp(110 + (leftForPanic/10)*820, 140, 950);
        if ((t - (S.lastTickAt||0)) >= interval){
          S.lastTickAt = t;
          playTick(0.55 + intensity*0.45);
        }
      }
    }catch(_){}

    S.tickTimer = setTimeout(adaptiveTick, 140);
  }

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const c = getCrosshairCenter(crosshairEl);
    const vr = isStereoMode();
    const r = vr ? 86 : (isMobileLike() ? 66 : 54);

    const el = findTargetNear(layerEl, c.x, c.y, r);
    if (el){
      hitTarget(el);
    } else {
      if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
      updateScore();
    }
  }

  function bindInputs(){
    if (shootEl){
      shootEl.addEventListener('click', (e)=>{ e.preventDefault?.(); shootAtCrosshair(); });
      shootEl.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); }, { passive:false });
    }
    if (shootElR){
      shootElR.addEventListener('click', (e)=>{ e.preventDefault?.(); shootAtCrosshair(); });
      shootElR.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); }, { passive:false });
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

  function bindFlushHard(getSummary){
    ROOT.addEventListener('pagehide', ()=>{
      try{ flushAll(getSummary('pagehide'), 'pagehide'); }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ flushAll(getSummary('hidden'), 'hidden'); }catch(_){}
      }
    }, { passive:true });
  }

  function clearAllTargets(){
    try{
      const list = layerEl.querySelectorAll('.gj-target');
      list.forEach(el=>{
        try{ clearTimeout(el._ttl); }catch(_){}
        try{ el.remove(); }catch(_){}
      });
    }catch(_){}
    try{
      const listR = layerElR?.querySelectorAll?.('.gj-target');
      listR?.forEach?.(el=>{
        try{ clearTimeout(el._ttl); }catch(_){}
        try{ el.remove(); }catch(_){}
      });
    }catch(_){}
    pairMap.clear();
  }

  function computeRtStats(){
    const arr = (S.rtsGoodMs || []).slice().filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);
    if (!arr.length) return { avg:0, median:0, fastRate:0 };
    const sum = arr.reduce((a,b)=>a+b, 0);
    const avg = Math.round(sum / arr.length);
    const mid = (arr.length-1)/2;
    const median = Math.round(arr[Math.floor(mid)] + (arr[Math.ceil(mid)] - arr[Math.floor(mid)]) * (mid - Math.floor(mid)));
    const fastRate = Math.round((S.fastHitGood / Math.max(1, arr.length)) * 100);
    return { avg, median, fastRate };
  }

  function makeSummary(reason){
    const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
    const junkErr = S.hitAll > 0 ? Math.round((S.hitJunk / S.hitAll) * 100) : 0;
    const grade = rankFromAcc(acc);
    const rt = computeRtStats();

    return {
      timestampIso: isoNow(),
      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      studyId: ctx.studyId || '',
      phase: ctx.phase || '',
      conditionGroup: ctx.conditionGroup || '',
      sessionOrder: ctx.sessionOrder || '',
      blockLabel: ctx.blockLabel || '',
      siteCode: ctx.siteCode || '',
      schoolYear: ctx.schoolYear || '',
      semester: ctx.semester || '',
      sessionId: (sessionId || ''),
      gameMode: 'goodjunk',
      diff: S.diff,
      durationPlannedSec: S.timeSec|0,
      durationPlayedSec: Math.round((now() - S.tStart)/1000),

      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      goalsCleared: S.goalsCleared|0,
      goalsTotal: S.goalsTotal|0,
      miniCleared: S.miniCleared|0,
      miniTotal: S.miniTotal|0,

      nTargetGoodSpawned: S.nTargetGoodSpawned|0,
      nTargetJunkSpawned: S.nTargetJunkSpawned|0,
      nTargetStarSpawned: S.nTargetStarSpawned|0,
      nTargetShieldSpawned: S.nTargetShieldSpawned|0,

      nHitGood: S.hitGood|0,
      nHitJunk: S.hitJunk|0,
      nHitJunkGuard: S.hitJunkGuard|0,
      nExpireGood: S.expireGood|0,

      accuracyGoodPct: acc|0,
      junkErrorPct: junkErr|0,
      avgRtGoodMs: rt.avg|0,
      medianRtGoodMs: rt.median|0,
      fastHitRatePct: rt.fastRate|0,

      device: deviceTag(),
      gameVersion,
      reason: String(reason||'end'),

      startTimeIso: S.startTimeIso || '',
      endTimeIso: S.endTimeIso || '',

      studentKey: ctx.studentKey || '',
      schoolCode: ctx.schoolCode || '',
      schoolName: ctx.schoolName || '',
      classRoom: ctx.classRoom || '',
      studentNo: ctx.studentNo || '',
      nickName: ctx.nickName || '',
      gender: ctx.gender || '',
      age: ctx.age || '',
      gradeLevel: ctx.gradeLevel || '',
      heightCm: ctx.heightCm || '',
      weightKg: ctx.weightKg || '',
      bmi: ctx.bmi || '',
      bmiGroup: ctx.bmiGroup || '',
      vrExperience: ctx.vrExperience || '',
      gameFrequency: ctx.gameFrequency || '',
      handedness: ctx.handedness || '',
      visionIssue: ctx.visionIssue || '',
      healthDetail: ctx.healthDetail || '',
      consentParent: ctx.consentParent || '',

      seed: S.seed,
      grade
    };
  }

  async function flushAll(summary, reason){
    try{
      if (summary){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        localStorage.setItem('hha_last_summary', JSON.stringify(summary));
      }
    }catch(_){}
    // push summary event (logger can capture)
    try{ emit('hha:log_summary', { summary }); }catch(_){}
    try{ logEvent('summary', summary); }catch(_){}
    await flushLogger(reason || (summary?.reason) || 'flush');
  }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    clearTimers();
    clearAllTargets();

    try{ setRing(false, 40, 85); }catch(_){}
    try{ setLaser(''); }catch(_){}

    S.endTimeIso = isoNow();

    const summary = makeSummary(reason);

    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });
    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');

    // ✅ show overlay
    renderEndSummary(summary);
  }

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

    S.nTargetGoodSpawned = 0;
    S.nTargetJunkSpawned = 0;
    S.nTargetStarSpawned = 0;
    S.nTargetShieldSpawned = 0;
    S.rtsGoodMs = [];
    S.fastHitGood = 0;
    S.spawnTimeByUid.clear();

    S.startTimeIso = isoNow();
    S.endTimeIso = '';

    // Warmup 3s
    S.warmupUntil = now() + 3000;

    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    coach('neutral',
      (S.challenge === 'boss')
        ? 'โหมดบอสมาแล้ว! ระวังวงแหวน/เลเซอร์ 😈'
        : (S.challenge === 'survival')
          ? `SURVIVAL! ห้ามพลาดเกิน ${S.missLimit} 😱`
          : `พร้อมลุย! ช่วงแรกนุ่ม ๆ (No-Junk Zone) แล้วโหดขึ้นเร็ว 😈`,
      'เล็งกลางแล้วกดยิง / แตะเป้าก็ได้'
    );

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
      gameVersion
    });

    loopSpawn();
    adaptiveTick();

    if (S.challenge === 'boss'){
      setTimeout(()=> bossPulse(), 1200);
    }
  }

  bindInputs();

  bindFlushHard((reason)=> {
    // summary snapshot if tab hidden/pagehide
    const sum = makeSummary(reason);
    return sum;
  });

  start();

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}
}