// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — HHA Standard (PC/Mobile + VR Cardboard)
// ✅ DOM targets on #gj-layer (and #gj-layer-r for VR)
// ✅ Start-gated via opts.autoStart !== false
// ✅ Stereo support: opts.layerEls = [leftLayer, rightLayer]
// ✅ Targets are "groups" (1 logical target replicated per eye) -> cap/miss/ttl counted once
// ✅ Click/tap targets + shoot-at-crosshair (button / Space / Enter)
// ✅ FIX: class names match CSS (.gj-target + gj-junk/gj-good/etc)
// ✅ Avoid HUD regions (best effort) + safe margins + relax if too tight
// ✅ Miss definition: good expire + junk hit (shield block NOT miss)
// ✅ HHA events: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate
// ✅ last summary -> localStorage HHA_LAST_SUMMARY + hha_last_summary
// ✅ End summary overlay + Back HUB + Replay
// ✅ flush-hardened: end/backhub/pagehide/visibilitychange/beforeunload

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

// -------------------- tiny utils --------------------
function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
}
function qs(name, def){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function toStr(v, d){ v = String(v ?? '').trim(); return v ? v : d; }

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

// -------------------- optional modules (best effort) --------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { set(){}, get(){ return { value:0, state:'low', shield:0 }; }, setShield(){} };

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

// -------------------- scoring helpers --------------------
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
  if (diff === 'easy'){
    return { spawnMs: 980, ttlMs: 2300, size: 1.08, junk: 0.12, power: 0.035, maxT: 7 };
  }
  if (diff === 'hard'){
    return { spawnMs: 720, ttlMs: 1650, size: 0.94, junk: 0.18, power: 0.025, maxT: 9 };
  }
  return { spawnMs: 840, ttlMs: 1950, size: 1.00, junk: 0.15, power: 0.030, maxT: 8 };
}

function updateFever(shield, fever){
  try{ FeverUI.set({ value: clamp(fever, 0, 100), shield: clamp(shield, 0, 9) }); }catch(_){}
  try{ if (typeof FeverUI.setShield === 'function') FeverUI.setShield(clamp(shield,0,9)); }catch(_){}
}

// -------------------- minimal safety CSS inject (only if missing) --------------------
function ensureTargetStyles(){
  const DOC = ROOT.document;
  if (!DOC || DOC.getElementById('gj-safe-style')) return;

  const st = DOC.createElement('style');
  st.id = 'gj-safe-style';
  st.textContent = `
    /* Safety fallback only: do NOT override your main CSS aggressively */
    #gj-layer, #gj-layer-r { pointer-events: auto !important; }
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
      opacity: 1;
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

// -------------------- avoid HUD (viewport coords) --------------------
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

// -------------------- target sets --------------------
const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

// -------------------- summary + end overlay --------------------
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

function buildHubUrl(hubBase){
  // keep study/context params from current URL, remove gameplay keys
  try{
    const cur = new URL(location.href);
    const hub = new URL(hubBase || '../hub.html', cur);

    const keep = new URLSearchParams(cur.searchParams);
    // remove game-play keys
    [
      'diff','time','run','end','endPolicy','challenge','view','cardboard',
      'autostart','ts','seed','sid','sessionId','log'
    ].forEach(k=>keep.delete(k));

    // merge into hub (do not wipe hub's own params)
    keep.forEach((v,k)=>{
      if (!hub.searchParams.has(k)) hub.searchParams.set(k, v);
    });

    return hub.toString();
  }catch(_){
    return hubBase || '../hub.html';
  }
}

function renderEndSummary(summary, hubUrl){
  const DOC = ROOT.document;
  if (!DOC) return;

  const host = DOC.getElementById('end-summary');
  if (!host) return;

  const acc = summary.accuracyGoodPct|0;
  const g = summary.grade || '—';

  host.innerHTML = `
    <div class="hha-end-overlay" style="
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:center; justify-content:center;
      background: rgba(2,6,23,.86);
      padding: 18px;">
      <div style="
        width:min(720px, 94vw);
        border-radius:22px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.94);
        box-shadow: 0 22px 70px rgba(0,0,0,.45);
        padding: 14px 14px 12px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="font-weight:1000; font-size:20px;">สรุปผล GoodJunkVR</div>
            <div style="margin-top:2px; color:#94a3b8; font-size:12px;">
              reason=${summary.reason} • diff=${summary.diff} • run=${summary.runMode} • time=${summary.durationPlayedSec}s
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#94a3b8; font-weight:900;">GRADE</div>
            <div style="font-size:28px; font-weight:1000;">${g}</div>
          </div>
        </div>

        <div style="
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:10px; margin-top:12px;">
          <div style="border:1px solid rgba(148,163,184,.18); border-radius:16px; padding:10px 12px; background: rgba(15,23,42,.45);">
            <div style="color:#94a3b8; font-size:12px; font-weight:900;">Score</div>
            <div style="font-size:22px; font-weight:1000;">${summary.scoreFinal}</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18); border-radius:16px; padding:10px 12px; background: rgba(15,23,42,.45);">
            <div style="color:#94a3b8; font-size:12px; font-weight:900;">Accuracy</div>
            <div style="font-size:22px; font-weight:1000;">${acc}%</div>
          </div>
          <div style="border:1px solid rgba(148,163,184,.18); border-radius:16px; padding:10px 12px; background: rgba(15,23,42,.45);">
            <div style="color:#94a3b8; font-size:12px; font-weight:900;">Miss</div>
            <div style="font-size:22px; font-weight:1000;">${summary.misses}</div>
          </div>
        </div>

        <div style="margin-top:10px; color:#cbd5e1; font-size:13px; line-height:1.55;">
          Goals: <b>${summary.goalsCleared}/${summary.goalsTotal}</b> •
          Minis: <b>${summary.miniCleared}/${summary.miniTotal}</b> •
          ComboMax: <b>${summary.comboMax}</b><br/>
          GoodHit: <b>${summary.nHitGood}</b> • JunkHit: <b>${summary.nHitJunk}</b> • Guard: <b>${summary.nHitJunkGuard}</b> • ExpireGood: <b>${summary.nExpireGood}</b>
        </div>

        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <button id="btnEndReplay" style="
            flex:1 1 220px; height:52px; border-radius:18px;
            border:1px solid rgba(148,163,184,.22);
            background: rgba(34,197,94,.16); color:#fff;
            font-weight:1000; font-size:16px;">เล่นใหม่</button>

          <button id="btnEndHub" style="
            flex:1 1 220px; height:52px; border-radius:18px;
            border:1px solid rgba(148,163,184,.22);
            background: rgba(96,165,250,.14); color:#fff;
            font-weight:1000; font-size:16px;">กลับ HUB</button>
        </div>

        <div style="margin-top:10px; color:#94a3b8; font-size:12px;">
          * ระบบบันทึกผลล่าสุดไว้แล้ว (HHA_LAST_SUMMARY)
        </div>
      </div>
    </div>
  `;

  const btnHub = DOC.getElementById('btnEndHub');
  const btnReplay = DOC.getElementById('btnEndReplay');

  if (btnReplay){
    btnReplay.onclick = ()=>{
      try{
        const u = new URL(location.href);
        u.searchParams.set('ts', String(Date.now()));
        u.searchParams.delete('seed'); // allow auto seed refresh unless you want fixed seed
        location.href = u.toString();
      }catch(_){
        location.reload();
      }
    };
  }
  if (btnHub){
    btnHub.onclick = ()=>{
      try{ location.href = hubUrl || '../hub.html'; }catch(_){}
    };
  }
}

// -------------------- exported boot --------------------
export function boot(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return null;

  ensureTargetStyles();

  // layers (mono or stereo)
  const layerEls = Array.isArray(opts.layerEls) ? opts.layerEls : null;
  const layerElL = (layerEls && layerEls[0]) || opts.layerEl || DOC.getElementById('gj-layer');
  const layerElR = (layerEls && layerEls[1]) || DOC.getElementById('gj-layer-r');

  const layers = [];
  if (layerElL) layers.push(layerElL);
  if (layerEls && layerElR) layers.push(layerElR);

  if (!layers.length){
    console.warn('[GoodJunkVR] missing layer element(s) #gj-layer');
    return null;
  }

  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const crosshairEl = DOC.getElementById('gj-crosshair'); // left eye crosshair id (works both mono/vr)

  // options / params
  const safeMargins = opts.safeMargins || { top: 128, bottom: 170, left: 26, right: 26 };

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
  const hubBase = toStr(opts.hub || qs('hub','../hub.html'), '../hub.html');
  const hubUrl = buildHubUrl(hubBase);

  // state
  const base = diffBase(diff);

  const S = {
    running:false,
    ended:false,
    flushed:false,

    diff, runMode, timeSec, seed,
    rng: makeRng(seed),
    endPolicy, challenge,

    tStart:0,
    left: timeSec,

    score:0,
    combo:0,
    comboMax:0,

    misses:0,        // miss = good expire + junk hit (unblocked)
    hitAll:0,
    hitGood:0,
    hitJunk:0,
    hitJunkGuard:0,
    expireGood:0,

    fever:0,
    shield:0,

    goalsCleared:0,
    goalsTotal:2,
    miniCleared:0,
    miniTotal:7,

    warmupUntil:0,
    spawnTimer:0,
    tickTimer:0,

    spawnMs: base.spawnMs,
    ttlMs:   base.ttlMs,
    size:    base.size,
    junkP:   base.junk,
    powerP:  base.power,
    maxTargets: base.maxT,

    // groups (logical targets)
    gidSeq: 0,
    groups: new Map(),          // gid -> group
    elToGroup: new WeakMap()    // element -> group
  };

  // mobile adjust
  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
  }

  // -------------------- HUD events --------------------
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

  // -------------------- group helpers --------------------
  function groupsCount(){ return S.groups.size; }

  function clearTimers(){
    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
  }

  function removeGroup(group){
    if (!group || group.removed) return;
    group.removed = true;

    try{ clearTimeout(group.ttl); }catch(_){}
    S.groups.delete(group.gid);

    for (const el of group.els){
      try{
        el.classList.add('hit');
        setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 140);
      }catch(_){}
    }
  }

  function expireGroup(group){
    if (!group || group.removed || !S.running || S.ended) return;

    if (group.type === 'good'){
      S.misses++;
      S.expireGood++;
      S.combo = 0;

      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever(S.shield, S.fever);

      judge('warn', 'MISS (หมดเวลา)!');
      updateScore();
      updateQuest();
      logEvent('miss_expire', { kind:'good', emoji: String(group.emoji||'') });
    }

    for (const el of group.els){
      try{ el.classList.add('out'); }catch(_){}
      try{ setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160); }catch(_){}
    }

    try{ clearTimeout(group.ttl); }catch(_){}
    S.groups.delete(group.gid);
  }

  function burstAtGroup(group, kind){
    try{
      // burst at left eye element center
      const el = group.els && group.els[0];
      if (!el) return;
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, kind || group.type || '');
    }catch(_){}
  }

  function scoreGood(){
    const mult = 1 + clamp(S.combo/40, 0, 0.6);
    const pts = Math.round(90 * mult);
    S.score += pts;
    return pts;
  }

  function hitGood(group){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    burstAtGroup(group, 'good');

    logEvent('hit', { kind:'good', emoji:String(group.emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();

    // mini progression (combo thresholds)
    if (S.miniCleared < S.miniTotal){
      const needCombo = 4 + (S.miniCleared * 2); // 4,6,8...
      if (S.combo >= needCombo){
        S.miniCleared++;
        emit('hha:celebrate', { kind:'mini', title:`Mini ผ่าน! ${S.miniCleared}/${S.miniTotal}` });
        coach('happy', `คอมโบมาแล้ว! ดีมาก 🔥`, `ทำคอมโบต่อได้อีก!`);
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

        if (endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
          endGame('all_complete');
          return;
        }
      }
    }

    removeGroup(group);
  }

  function hitShield(group){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    S.score += 70;
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    burstAtGroup(group, 'shield');

    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore();
    updateQuest();
    removeGroup(group);
  }

  function hitStar(group){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 140;
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    burstAtGroup(group, 'star');

    logEvent('hit', { kind:'star', emoji:String(group.emoji||'⭐') });

    updateScore();
    updateQuest();
    removeGroup(group);
  }

  function hitJunk(group){
    S.hitAll++;

    // shield blocks junk -> NOT a miss
    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      burstAtGroup(group, 'guard');
      logEvent('shield_block', { kind:'junk', emoji:String(group.emoji||'') });

      updateScore();
      updateQuest();
      removeGroup(group);
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
    burstAtGroup(group, 'junk');

    logEvent('hit', { kind:'junk', emoji:String(group.emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();
    removeGroup(group);
  }

  function hitGroup(group){
    if (!S.running || S.ended || !group || group.removed) return;
    if (group.type === 'good') return hitGood(group);
    if (group.type === 'junk') return hitJunk(group);
    if (group.type === 'shield') return hitShield(group);
    if (group.type === 'star') return hitStar(group);
  }

  // -------------------- spawn positions (supports mono/vr) --------------------
  function chooseSpawnUV(rng, margins){
    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;

    let top = margins?.top ?? 120;
    let bottom = margins?.bottom ?? 170;
    let left = margins?.left ?? 22;
    let right = margins?.right ?? 22;

    // relax if too tight
    if ((W - left - right) < 180){ left = 12; right = 12; }
    if ((H - top - bottom) < 260){ top = Math.max(90, top - 24); bottom = Math.max(130, bottom - 24); }

    return { u: rng(), v: rng(), top, bottom, left, right };
  }

  function pickSpawnForLayers(rng, margins){
    const avoid = buildAvoidRects();
    const layerRects = layers.map(el=>{
      try{ return el.getBoundingClientRect(); }catch(_){ return { left:0, top:0, width:(ROOT.innerWidth||360), height:(ROOT.innerHeight||640) }; }
    });

    // try multiple times
    for (let t=0;t<18;t++){
      const uv = chooseSpawnUV(rng, margins);

      let ok = true;
      const out = [];

      for (let i=0;i<layers.length;i++){
        const lr = layerRects[i];
        const w = Math.max(1, lr.width);
        const h = Math.max(1, lr.height);

        const left = clamp(uv.left, 0, w-1);
        const right = clamp(uv.right, 0, w-1);
        const top = clamp(uv.top, 0, h-1);
        const bottom = clamp(uv.bottom, 0, h-1);

        const innerW = Math.max(10, w - left - right);
        const innerH = Math.max(10, h - top - bottom);

        const xLocal = left + uv.u * innerW;
        const yLocal = top + uv.v * innerH;

        const vx = lr.left + xLocal;
        const vy = lr.top + yLocal;

        // avoid HUD in viewport
        for (const r of avoid){
          if (pointInRect(vx, vy, { left:r.left-8, right:r.right+8, top:r.top-8, bottom:r.bottom+8 })){
            ok = false; break;
          }
        }
        if (!ok) break;

        out.push({ xLocal, yLocal, vx, vy, layerRect: lr });
      }

      if (ok) return out;
    }

    // fallback: just use first attempt without avoid
    const uv = chooseSpawnUV(rng, margins);
    const layerRects = layers.map(el=>{
      try{ return el.getBoundingClientRect(); }catch(_){ return { left:0, top:0, width:(ROOT.innerWidth||360), height:(ROOT.innerHeight||640) }; }
    });
    return layerRects.map((lr)=>{
      const w = Math.max(1, lr.width);
      const h = Math.max(1, lr.height);

      const left = clamp(uv.left, 0, w-1);
      const right = clamp(uv.right, 0, w-1);
      const top = clamp(uv.top, 0, h-1);
      const bottom = clamp(uv.bottom, 0, h-1);

      const xLocal = left + uv.u * Math.max(10, w - left - right);
      const yLocal = top + uv.v * Math.max(10, h - top - bottom);
      return { xLocal, yLocal, vx: lr.left + xLocal, vy: lr.top + yLocal, layerRect: lr };
    });
  }

  function setXY(el, xLocal, yLocal){
    const px = xLocal.toFixed(1) + 'px';
    const py = yLocal.toFixed(1) + 'px';
    el.style.left = px;
    el.style.top  = py;
  }

  function makeElement(type, emoji, xLocal, yLocal, s){
    const el = DOC.createElement('div');

    // ✅ match CSS you already have
    // - base: .gj-target
    // - type: .good/.junk/.star/.shield (for injected fallback)
    // - css FX: .gj-junk/.gj-good/... (for your main CSS)
    el.className = `gj-target ${type} gj-${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';

    setXY(el, xLocal, yLocal);
    el.style.setProperty('--s', String(Number(s||1).toFixed(3)));
    el.textContent = String(emoji||'✨');

    // click/tap
    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      const g = S.elToGroup.get(el);
      if (g) hitGroup(g);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  // -------------------- spawn loop --------------------
  function spawnOne(){
    if (!S.running || S.ended) return;

    // cap by group count (not DOM count)
    if (groupsCount() >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    // choose type
    let tp = 'good';
    const r = S.rng();

    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.55) : S.junkP;

    if (r < powerP) tp = 'shield';
    else if (r < powerP + 0.035) tp = 'star';
    else if (r < powerP + 0.035 + junkP) tp = 'junk';
    else tp = 'good';

    const size = (inWarm ? (S.size * 1.06) : S.size);

    // choose positions for each layer (mono/vr)
    const pos = pickSpawnForLayers(S.rng, safeMargins);

    // create group
    const gid = (++S.gidSeq);
    const emoji =
      (tp === 'good') ? pick(S.rng, GOOD) :
      (tp === 'junk') ? pick(S.rng, JUNK) :
      (tp === 'shield') ? SHIELD :
      (tp === 'star') ? pick(S.rng, STARS) : '✨';

    const group = {
      gid,
      type: tp,
      emoji,
      removed: false,
      els: [],
      // viewport center for shoot logic (use left eye)
      vx: pos[0]?.vx ?? ((ROOT.innerWidth||360)*0.5),
      vy: pos[0]?.vy ?? ((ROOT.innerHeight||640)*0.5),
      ttl: 0
    };

    for (let i=0;i<layers.length;i++){
      const layer = layers[i];
      const p = pos[i] || pos[0];
      if (!layer || !p) continue;

      // tiny eye parallax (optional): very small x shift so stereo feels alive
      const eyeShift = (layers.length >= 2) ? (i === 0 ? -3 : 3) : 0;

      const el = makeElement(tp, emoji, p.xLocal + eyeShift, p.yLocal, size);
      group.els.push(el);
      S.elToGroup.set(el, group);

      try{ layer.appendChild(el); }catch(_){}
    }

    // TTL once per group
    group.ttl = setTimeout(()=> expireGroup(group), S.ttlMs);

    S.groups.set(gid, group);
    logEvent('spawn', { kind:tp, emoji:String(emoji||'') });
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

    // adaptive only in play
    if (S.runMode === 'play'){
      const elapsed = (now() - S.tStart) / 1000;
      const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0;
      const comboHeat = clamp(S.combo / 18, 0, 1);

      const timeRamp = clamp((elapsed - 3) / 10, 0, 1); // ramp quickly after warmup
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

  // -------------------- shoot at crosshair --------------------
  function getCrosshairCenter(){
    if (!crosshairEl){
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
  function findGroupNear(cx, cy, radiusPx){
    const r2max = radiusPx * radiusPx;
    let best = null;
    let bestD2 = 1e18;

    for (const g of S.groups.values()){
      if (!g || g.removed) continue;
      const d2 = dist2(cx, cy, g.vx, g.vy);
      if (d2 <= r2max && d2 < bestD2){
        best = g; bestD2 = d2;
      }
    }
    return best;
  }
  function shootAtCrosshair(){
    if (!S.running || S.ended) return;

    const c = getCrosshairCenter();
    const r = isMobileLike() ? 62 : 52;

    const g = findGroupNear(c.x, c.y, r);
    if (g){
      hitGroup(g);
    }else{
      // miss shot does not count as miss; just soften combo
      if (S.combo > 0) S.combo = Math.max(0, S.combo - 1);
      updateScore();
    }
  }

  // -------------------- input binds --------------------
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
      // quick exit -> hub
      if (k === 'escape'){
        e.preventDefault?.();
        if (!S.ended) endGame('escape');
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
    ROOT.addEventListener('pagehide', ()=>{
      try{ flushAll(makeSummary(S, 'pagehide'), 'pagehide'); }catch(_){}
    }, { passive:true });

    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ flushAll(makeSummary(S, 'hidden'), 'hidden'); }catch(_){}
      }
    }, { passive:true });

    ROOT.addEventListener('beforeunload', ()=>{
      try{ flushAll(makeSummary(S, 'beforeunload'), 'beforeunload'); }catch(_){}
    }, { passive:true });
  }

  function clearAllGroups(){
    try{
      for (const g of S.groups.values()){
        try{ clearTimeout(g.ttl); }catch(_){}
        for (const el of (g.els||[])){
          try{ el.remove(); }catch(_){}
        }
      }
    }catch(_){}
    S.groups.clear();
  }

  // -------------------- end game --------------------
  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    clearTimers();
    clearAllGroups();

    const summary = makeSummary(S, reason);

    // session_end
    logEvent('session_end', {
      reason: summary.reason,
      scoreFinal: summary.scoreFinal,
      accuracyGoodPct: summary.accuracyGoodPct,
      grade: summary.grade,
      durationPlayedSec: summary.durationPlayedSec,
      diff: S.diff,
      runMode: S.runMode,
      seed: S.seed,
      sessionId: sessionId || ''
    });

    if (!S.flushed){
      S.flushed = true;
      await flushAll(summary, 'end');
    }

    emit('hha:end', summary);
    emit('hha:celebrate', { kind:'end', title:'จบเกม!' });

    coach('neutral', 'จบเกมแล้ว!', 'กดกลับ HUB หรือเล่นใหม่ได้');

    // render end summary overlay (independent from HUD binder)
    renderEndSummary(summary, hubUrl);
  }

  // -------------------- start --------------------
  function start(){
    if (S.running) return;

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

    // warmup 3s
    S.warmupUntil = now() + 3000;

    // warmup cap
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
      timeSec: S.timeSec
    });

    loopSpawn();
    adaptiveTick();
  }

  // init
  bindInputs();
  bindFlushHard();

  // expose minimal API
  const api = {
    start,
    endGame,
    shoot: shootAtCrosshair
  };

  try{
    ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
    ROOT.GoodJunkVR.start = start;
    ROOT.GoodJunkVR.endGame = endGame;
    ROOT.GoodJunkVR.shoot = shootAtCrosshair;
  }catch(_){}

  // ✅ Start-gated (default autoStart unless explicitly false)
  if (opts.autoStart !== false){
    start();
  }

  return api;
}