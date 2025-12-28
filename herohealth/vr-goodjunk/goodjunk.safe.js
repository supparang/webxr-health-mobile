// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard FINAL
// ✅ DOM targets on #gj-layer (+ stereo mirror to #gj-layerR)
// ✅ Warmup 3s "No-Junk Zone" (ยุติธรรมขึ้น: ช่วง warmup ไม่สุ่ม junk)
// ✅ Adaptive เฉพาะ run=play; research run=research fixed by diff
// ✅ click/tap target + shoot crosshair (button / Space / Enter)
// ✅ FIX: targets visible + correct z-index + pointer events
// ✅ HHA events: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Miss definition: good expire + junk hit (shield block NOT miss)
// ✅ End Summary = Research sheet (start/end ISO + spawn counts + RT + fast hit rate + junk error)
// ✅ Replay 2 modes: keep seed / reseed
// ✅ Back HUB: ?hub=... keep research params + flush-hardened

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function isoNow(){ try{ return new Date().toISOString(); }catch(_){ return ''; } }

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

function deviceLabel(){
  const ua = String(ROOT.navigator?.userAgent || '');
  const w = ROOT.innerWidth || 0;
  const h = ROOT.innerHeight || 0;
  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches) ? 'coarse' : 'fine';
  let plat = 'web';
  if (/android/i.test(ua)) plat = 'android';
  else if (/iphone|ipad|ipod/i.test(ua)) plat = 'ios';
  else if (/windows/i.test(ua)) plat = 'windows';
  else if (/mac os/i.test(ua)) plat = 'mac';
  const stereo = ROOT.document?.body?.classList?.contains('gj-stereo') ? 'stereo' : 'mono';
  return `${plat}/${coarse}/${stereo}/${w}x${h}`;
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
  if (diff === 'easy') return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7 };
  if (diff === 'hard') return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

// -------------------- CSS injection (hard safety) --------------------
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    #gj-stage{ position:fixed; inset:0; overflow:hidden; }
    #gj-layer, #gj-layerR{
      position:absolute; inset:0; z-index:30;
      pointer-events:auto; touch-action:none;
    }
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

// -------------------- engine assets --------------------
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

function getCenter(el, fallbackX, fallbackY){
  if (!el) return { x:fallbackX, y:fallbackY };
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){ return { x:fallbackX, y:fallbackY }; }
}

function dist2(ax, ay, bx, by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }

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
  try{ FeverUI.set({ value: clamp(fever,0,100), shield: clamp(shield,0,9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}

function avg(arr){
  const n = arr.length;
  if (!n) return 0;
  let s=0; for (const v of arr) s += (Number(v)||0);
  return s/n;
}
function median(arr){
  const n = arr.length;
  if (!n) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const mid = (n/2)|0;
  return (n%2) ? a[mid] : (a[mid-1]+a[mid])/2;
}

// -------------------- End Overlay (Research Sheet) --------------------
function renderEndSummary(summary){
  const DOC = ROOT.document;
  if (!DOC) return;

  const hostL = DOC.getElementById('end-summary');
  const hostR = DOC.getElementById('end-summaryR');
  if (!hostL) return;

  const acc = summary.accuracyGoodPct|0;
  const grade = summary.grade || '—';
  const reason = String(summary.reason || 'end');

  const fmt = (n)=>{
    n = Number(n)||0;
    try{ return n.toLocaleString('en-US'); }catch(_){ return String(n); }
  };

  const tags = [
    `diff:${summary.diff}`,
    `run:${summary.runMode}`,
    `end:${String(qs('end','time'))}`,
    `challenge:${String(qs('challenge','rush'))}`,
    `device:${summary.device||'-'}`
  ];

  const html = `
    <div class="end-overlay show">
      <div class="end-card">
        <div class="end-head">
          <div>
            <div class="end-title">สรุปผล (Research Sheet)</div>
            <div class="end-sub">
              reason: ${reason} • played: ${fmt(summary.durationPlayedSec)}s
              • start: ${String(summary.startTimeIso||'—')}
              • end: ${String(summary.endTimeIso||'—')}
            </div>
          </div>
          <div class="end-grade">
            <div class="g">${grade}</div>
            <div class="a">ACC ${acc}%</div>
          </div>
        </div>

        <div class="end-grid">
          <div class="end-item"><div class="k">Score</div><div class="v">${fmt(summary.scoreFinal)}</div></div>
          <div class="end-item"><div class="k">Combo Max</div><div class="v">${fmt(summary.comboMax)}</div></div>
          <div class="end-item"><div class="k">Miss</div><div class="v">${fmt(summary.misses)}</div></div>

          <div class="end-item"><div class="k">Good Hit</div><div class="v">${fmt(summary.nHitGood)}</div></div>
          <div class="end-item"><div class="k">Junk Hit</div><div class="v">${fmt(summary.nHitJunk)}</div></div>
          <div class="end-item"><div class="k">Shield Blocks</div><div class="v">${fmt(summary.nHitJunkGuard)}</div></div>

          <div class="end-item"><div class="k">Expire Good</div><div class="v">${fmt(summary.nExpireGood)}</div></div>
          <div class="end-item"><div class="k">JunkError %</div><div class="v">${fmt(summary.junkErrorPct||0)}%</div></div>
          <div class="end-item"><div class="k">Fever / Shield</div><div class="v">${fmt(summary.feverEnd||0)}% • ${fmt(summary.shieldEnd||0)}</div></div>

          <div class="end-item"><div class="k">RT avg (ms)</div><div class="v">${fmt(summary.avgRtGoodMs||0)}</div></div>
          <div class="end-item"><div class="k">RT median (ms)</div><div class="v">${fmt(summary.medianRtGoodMs||0)}</div></div>
          <div class="end-item"><div class="k">FastHit %</div><div class="v">${fmt(summary.fastHitRatePct||0)}%</div></div>

          <div class="end-item"><div class="k">Spawn GOOD</div><div class="v">${fmt(summary.nTargetGoodSpawned||0)}</div></div>
          <div class="end-item"><div class="k">Spawn JUNK</div><div class="v">${fmt(summary.nTargetJunkSpawned||0)}</div></div>
          <div class="end-item"><div class="k">Spawn STAR/SHIELD</div><div class="v">${fmt(summary.nTargetStarSpawned||0)} / ${fmt(summary.nTargetShieldSpawned||0)}</div></div>
        </div>

        <div class="end-row">
          <div class="end-tags">
            ${tags.map(t=>`<span class="tag">${t}</span>`).join('')}
            <span class="tag">seed:${String(summary.seed||'—').slice(0,22)}</span>
          </div>
        </div>

        <div class="end-actions">
          <button class="end-btn primary" id="btnHub">กลับ HUB</button>
          <button class="end-btn" id="btnReplayKeep">เล่นใหม่ (Seed เดิม)</button>
          <button class="end-btn" id="btnReplayNew">เล่นใหม่ (Seed ใหม่)</button>
        </div>
      </div>
    </div>
  `;

  hostL.innerHTML = html;
  if (hostR) hostR.innerHTML = html
    .replaceAll('btnHub','btnHubR')
    .replaceAll('btnReplayKeep','btnReplayKeepR')
    .replaceAll('btnReplayNew','btnReplayNewR');

  const allowParams = [
    'hub',
    'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName','gender','age','gradeLevel',
    'heightCm','weightKg','bmi','bmiGroup','vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'gameVersion'
  ];

  const buildHubUrl = ()=>{
    const hub = String(qs('hub','./index.html') || './index.html');
    let u;
    try{ u = new URL(hub, ROOT.location.href); }catch(_){ u = new URL('./index.html', ROOT.location.href); }

    try{
      const cur = new URL(ROOT.location.href);
      const sp = cur.searchParams;

      allowParams.forEach(k=>{
        const v = sp.get(k);
        if (v != null && v !== '') u.searchParams.set(k, v);
      });

      ['run','diff','vr','stereo'].forEach(k=>{
        const v = sp.get(k);
        if (v != null && v !== '') u.searchParams.set(k, v);
      });

      u.searchParams.set('hubFrom','goodjunk');
      u.searchParams.set('last','1');
    }catch(_){}

    return u.toString();
  };

  const buildReplayUrl = (keepSeed)=>{
    try{
      const u = new URL(ROOT.location.href);
      u.searchParams.set('ts', String(Date.now()));
      if (keepSeed){
        if (summary.seed) u.searchParams.set('seed', String(summary.seed));
      } else {
        u.searchParams.delete('seed');
      }
      return u.toString();
    }catch(_){
      return ROOT.location.href;
    }
  };

  const disableAll = ()=>{
    ['btnHub','btnReplayKeep','btnReplayNew','btnHubR','btnReplayKeepR','btnReplayNewR'].forEach(id=>{
      const b = ROOT.document.getElementById(id);
      if (b) b.disabled = true;
    });
  };

  const goHub = async ()=>{
    disableAll();
    try{ await flushLogger('back_hub'); }catch(_){}
    setTimeout(()=>{ ROOT.location.href = buildHubUrl(); }, 80);
  };

  const replayKeep = async ()=>{
    disableAll();
    try{ await flushLogger('replay_keep_seed'); }catch(_){}
    setTimeout(()=>{ ROOT.location.href = buildReplayUrl(true); }, 80);
  };

  const replayNew = async ()=>{
    disableAll();
    try{ await flushLogger('replay_new_seed'); }catch(_){}
    setTimeout(()=>{ ROOT.location.href = buildReplayUrl(false); }, 80);
  };

  const bind = (id, fn)=>{
    const b = ROOT.document.getElementById(id);
    if (b) b.onclick = (e)=>{ e.preventDefault?.(); fn(); };
  };

  bind('btnHub', goHub);
  bind('btnReplayKeep', replayKeep);
  bind('btnReplayNew', replayNew);
  bind('btnHubR', goHub);
  bind('btnReplayKeepR', replayKeep);
  bind('btnReplayNewR', replayNew);
}

// -------------------- exported boot --------------------
export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  ensureTargetStyles();

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  const layerElR = opts.layerElR || DOC.getElementById('gj-layerR');

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');

  const crosshairEl  = opts.crosshairEl  || DOC.getElementById('gj-crosshair');
  const crosshairElR = opts.crosshairElR || DOC.getElementById('gj-crosshairR');

  const ringEl  = opts.ringEl  || DOC.getElementById('atk-ring');
  const ringElR = opts.ringElR || DOC.getElementById('atk-ringR');

  const laserEl  = opts.laserEl  || DOC.getElementById('atk-laser');
  const laserElR = opts.laserElR || DOC.getElementById('atk-laserR');

  if (!layerEl){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

  const safeMargins = opts.safeMargins || { top: 138, bottom: 182, left: 26, right: 26 };

  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
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

  // -------- state --------
  const S = {
    running:false, ended:false, flushed:false,

    diff, runMode, timeSec, seed, rng: makeRng(seed),
    endPolicy, challenge,

    tStart:0,
    startTimeIso:'',
    endTimeIso:'',
    left: timeSec,

    score:0, combo:0, comboMax:0,

    misses:0,           // miss = good expire + junk hit (unblocked)
    hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0, expireGood:0,

    fever:0,
    shield:0,

    goalsCleared:0, goalsTotal:2,
    miniCleared:0,  miniTotal:7,

    // pacing
    warmupUntil:0,
    spawnTimer:0,
    tickTimer:0,

    // live params
    spawnMs: base.spawnMs,
    ttlMs:   base.ttlMs,
    size:    base.size,
    junkP:   base.junk,
    powerP:  base.power,
    maxTargets: base.maxT,

    // research metrics
    nTargetGoodSpawned:0,
    nTargetJunkSpawned:0,
    nTargetStarSpawned:0,
    nTargetShieldSpawned:0,

    rtGoodMs: [],
    fastHitGood: 0,     // count of good hits under threshold
    fastThresholdMs: 420,
  };

  // mobile tune
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
    safeMargins.left  = Math.max(18, safeMargins.left);
    safeMargins.right = Math.max(18, safeMargins.right);
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

  // ---------- stereo target linking ----------
  let idSeq = 1;
  const map = new Map(); // id -> { L:el, R:el }

  function removePair(id){
    const p = map.get(id);
    if (!p) return;
    try{ if (p.L) p.L.remove(); }catch(_){}
    try{ if (p.R) p.R.remove(); }catch(_){}
    map.delete(id);
  }

  function markPairClass(id, cls){
    const p = map.get(id);
    if (!p) return;
    try{ p.L && p.L.classList.add(cls); }catch(_){}
    try{ p.R && p.R.classList.add(cls); }catch(_){}
  }

  function clearPairTTL(id){
    const p = map.get(id);
    if (!p) return;
    try{ p.L && clearTimeout(p.L._ttl); }catch(_){}
    try{ p.R && clearTimeout(p.R._ttl); }catch(_){}
  }

  function burstAtEl(el, kind){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || el.dataset.type || '');
    }catch(_){}
  }

  function expireById(id){
    const p = map.get(id);
    const el = p?.L || p?.R;
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

    markPairClass(id, 'out');
    setTimeout(()=>{ removePair(id); }, 170);
  }

  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
  }

  function hitGood(id, el){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    // RT
    const t0 = Number(el._spawnAt)||0;
    if (t0 > 0){
      const rt = Math.max(0, now() - t0);
      S.rtGoodMs.push(rt);
      if (rt <= S.fastThresholdMs) S.fastHitGood++;
    }

    // fever down
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
        coach('happy', `คอมโบมาแล้ว! ดีมาก 🔥`, `ทำคอมโบต่อได้อีก!`);
        updateQuest();
      }
    }
    // goals by good hits
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

    // remove pair
    clearPairTTL(id);
    markPairClass(id, 'hit');
    setTimeout(()=>{ removePair(id); }, 140);
  }

  function hitShield(id, el){
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

    clearPairTTL(id);
    markPairClass(id, 'hit');
    setTimeout(()=>{ removePair(id); }, 140);
  }

  function hitStar(id, el){
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

    clearPairTTL(id);
    markPairClass(id, 'hit');
    setTimeout(()=>{ removePair(id); }, 140);
  }

  function hitJunk(id, el){
    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(el.dataset.emoji||'') });

      updateScore(); updateQuest();

      clearPairTTL(id);
      markPairClass(id, 'hit');
      setTimeout(()=>{ removePair(id); }, 140);
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
    coach('sad', 'โดนขยะแล้ว 😵', 'เล็งกลางแล้วกดยิง');
    burstAtEl(el, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(el.dataset.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore(); updateQuest();

    clearPairTTL(id);
    markPairClass(id, 'hit');
    setTimeout(()=>{ removePair(id); }, 150);
  }

  function hitById(id){
    if (!S.running || S.ended) return;
    const p = map.get(id);
    const el = p?.L || p?.R;
    if (!el || !el.isConnected) return;

    const tp = String(el.dataset.type||'');
    if (tp === 'good') return hitGood(id, el);
    if (tp === 'junk') return hitJunk(id, el);
    if (tp === 'shield') return hitShield(id, el);
    if (tp === 'star') return hitStar(id, el);
  }

  function makeTargetEl(layer, id, type, emoji, x, y, s){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.id = String(id);
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    setXY(el, x, y);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    el._spawnAt = now();

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitById(id);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function spawnOne(){
    if (!S.running || S.ended) return;
    if (countTargets(layerEl) >= S.maxTargets) return;

    const p = randPos(S.rng, safeMargins);
    const t = now();
    const inWarm = (t < S.warmupUntil);

    // choose type
    let tp = 'good';
    const r = S.rng();

    const powerP = inWarm ? (S.powerP * 0.7) : S.powerP;
    const junkP  = inWarm ? 0.0 : S.junkP; // ✅ No-Junk Zone: warmup no junk

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);

    const id = idSeq++;
    let emoji = '✨';
    if (tp === 'good') emoji = pick(S.rng, GOOD);
    if (tp === 'junk') emoji = pick(S.rng, JUNK);
    if (tp === 'shield') emoji = SHIELD;
    if (tp === 'star') emoji = pick(S.rng, STARS);

    // spawn counters
    if (tp === 'good') S.nTargetGoodSpawned++;
    if (tp === 'junk') S.nTargetJunkSpawned++;
    if (tp === 'star') S.nTargetStarSpawned++;
    if (tp === 'shield') S.nTargetShieldSpawned++;

    const elL = makeTargetEl(layerEl, id, tp, emoji, p.x, p.y, (tp==='junk'?size*0.98: size));
    layerEl.appendChild(elL);

    // stereo mirror (optional)
    let elR = null;
    if (layerElR && DOC.body.classList.contains('gj-stereo')){
      elR = makeTargetEl(layerElR, id, tp, emoji, p.x, p.y, (tp==='junk'?size*0.98: size));
      layerElR.appendChild(elR);
    }

    // shared TTL
    const ttl = setTimeout(()=> expireById(id), S.ttlMs);
    elL._ttl = ttl;
    if (elR) elR._ttl = ttl;

    map.set(id, { L: elL, R: elR });

    logEvent('spawn', { id, kind:tp, emoji:String(emoji||''), x:p.x, y:p.y });
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

  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;

    const cL = getCenter(crosshairEl, W*0.5, H*0.62);
    const r = isMobileLike() ? 62 : 52;

    const el = findTargetNear(layerEl, cL.x, cL.y, r);
    if (el){
      const id = Number(el.dataset.id)||0;
      if (id) hitById(id);
      return;
    }

    // miss shoot doesn't count as miss (friendly)
    if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
    updateScore();
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
      try{ flushAll(makeSummary('pagehide'), 'pagehide'); }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ flushAll(makeSummary('hidden'), 'hidden'); }catch(_){}
      }
    }, { passive:true });
  }

  function clearAllTargets(){
    try{
      for (const [id,p] of map.entries()){
        try{ p.L && clearTimeout(p.L._ttl); }catch(_){}
        try{ p.R && clearTimeout(p.R._ttl); }catch(_){}
      }
      map.clear();
      layerEl.querySelectorAll('.gj-target').forEach(el=>{ try{ el.remove(); }catch(_){ } });
      if (layerElR) layerElR.querySelectorAll('.gj-target').forEach(el=>{ try{ el.remove(); }catch(_){ } });
    }catch(_){}
  }

  function makeSummary(reason){
    const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
    const grade = rankFromAcc(acc);

    const junkErrorPct = S.hitAll > 0 ? Math.round((S.hitJunk / S.hitAll) * 100) : 0;
    const avgRt = Math.round(avg(S.rtGoodMs));
    const medRt = Math.round(median(S.rtGoodMs));
    const fastPct = S.hitGood > 0 ? Math.round((S.fastHitGood / S.hitGood) * 100) : 0;

    return {
      reason: String(reason||'end'),

      startTimeIso: S.startTimeIso || '',
      endTimeIso: S.endTimeIso || isoNow(),

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
      nHitAll: S.hitAll|0,

      accuracyGoodPct: acc|0,
      junkErrorPct: junkErrorPct|0,

      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,
      fastHitRatePct: fastPct|0,

      grade,

      feverEnd: Math.round(S.fever)|0,
      shieldEnd: S.shield|0,

      diff: S.diff,
      runMode: S.runMode,
      seed: S.seed,

      durationPlannedSec: S.timeSec|0,
      durationPlayedSec: Math.round((now() - S.tStart)/1000),

      device: deviceLabel(),
      gameVersion: ctx.gameVersion || 'goodjunk.safe.final'
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

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    clearTimers();
    clearAllTargets();

    S.endTimeIso = isoNow();
    const summary = makeSummary(reason);

    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    // show end overlay (research sheet)
    renderEndSummary(summary);

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
    S.startTimeIso = isoNow();
    S.endTimeIso = '';
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

    S.nTargetGoodSpawned = 0;
    S.nTargetJunkSpawned = 0;
    S.nTargetStarSpawned = 0;
    S.nTargetShieldSpawned = 0;

    S.rtGoodMs = [];
    S.fastHitGood = 0;

    S.fever = 0;
    S.shield = 0;
    updateFever(S.shield, S.fever);

    S.goalsCleared = 0;
    S.miniCleared = 0;

    // No-Junk warmup
    S.warmupUntil = now() + 3000;

    // warmup caps
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    coach('neutral', 'พร้อมลุย! ช่วงแรก No-Junk Zone แล้วโหดขึ้นเร็ว 😈', 'เล็งกลางแล้วกดยิง / แตะเป้าก็ได้');
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
      device: deviceLabel(),
      startTimeIso: S.startTimeIso
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