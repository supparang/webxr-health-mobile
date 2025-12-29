// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION) — DOM + WebXR(A-Frame)
// ✅ DOM mode: PC/Mobile/cVR (split) + safe margins
// ✅ XR mode: A-Frame targets in 3D when entering immersive VR
// ✅ miss definition: good expire + junk hit (unblocked). Shield blocks don't count miss.

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
function isCVR(){
  const v = String(qs('view','')).toLowerCase();
  return v === 'cvr';
}

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
function randPosInRect(rng, rect, safePad){
  const avoid = buildAvoidRects();
  const pad = safePad || 8;

  for (let i=0;i<20;i++){
    const x = rect.left + rng() * rect.width;
    const y = rect.top  + rng() * rect.height;
    let ok = true;
    for (const a of avoid){
      if (pointInRect(x,y,{ left:a.left-pad,right:a.right+pad, top:a.top-pad,bottom:a.bottom+pad })){
        ok = false; break;
      }
    }
    if (ok) return { x, y };
  }
  return { x: rect.left + rng()*rect.width, y: rect.top + rng()*rect.height };
}

const GOOD = ['🥦','🥬','🥕','🍎','🍌','🍊','🍉','🍓','🍍','🥗'];
const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🍪'];
const STARS = ['⭐','💎'];
const SHIELD = '🛡️';

function setXY(el, x, y){
  el.style.left = x.toFixed(1) + 'px';
  el.style.top  = y.toFixed(1) + 'px';
}
function countTargets(layerEl){
  try{ return layerEl.querySelectorAll('.gj-target').length; }catch(_){ return 0; }
}
function getCenterOf(el, fallbackX, fallbackY){
  if (!el) return { x: fallbackX, y: fallbackY };
  try{
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }catch(_){
    return { x: fallbackX, y: fallbackY };
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

/* -------------------- XR helpers (A-Frame) -------------------- */
function xrAvailable(sceneEl){
  return !!(sceneEl && sceneEl.isConnected && sceneEl.enterVR);
}
function xrIsActive(sceneEl){
  try{
    // A-Frame sets is('vr-mode') while in immersive (also for AR)
    return !!(sceneEl && sceneEl.is && sceneEl.is('vr-mode'));
  }catch(_){ return false; }
}
function clearXrTargets(xrTargetsEl){
  if (!xrTargetsEl) return;
  try{
    while (xrTargetsEl.firstChild) xrTargetsEl.removeChild(xrTargetsEl.firstChild);
  }catch(_){}
}
function makeXrTarget(AFRAME, type, emoji, pos, scale, twinId){
  // clickable entity: plane/circle + text
  const el = document.createElement('a-entity');
  el.classList.add('xr-target');
  el.setAttribute('data-type', type);
  el.setAttribute('data-emoji', emoji);
  if (twinId) el.setAttribute('data-twin', twinId);

  el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);

  // background disc
  el.setAttribute('geometry', 'primitive: circle; radius: 0.23');
  el.setAttribute('material', 'color: #081226; opacity: 0.85; shader: standard; metalness: 0.1; roughness: 0.35');

  // emoji text
  const txt = document.createElement('a-entity');
  txt.setAttribute('text', `value: ${emoji}; align: center; color: #FFFFFF; width: 2.2; baseline: center;`);
  txt.setAttribute('position', `0 0 0.01`);
  el.appendChild(txt);

  // subtle ring
  const ring = document.createElement('a-entity');
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.25; radiusOuter: 0.275');
  ring.setAttribute('material', 'color: #A3B1C6; opacity: 0.25; shader: flat');
  ring.setAttribute('position', `0 0 0.005`);
  el.appendChild(ring);

  return el;
}

export function boot(opts = {}) {
  const DOC = ROOT.document;
  if (!DOC) return;

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  const shootEl = opts.shootEl || DOC.getElementById('btnShoot');
  const crossL  = DOC.getElementById('gj-crosshair');
  const crossR  = DOC.getElementById('gj-crosshair-r');

  // XR hooks
  const sceneEl = opts.sceneEl || DOC.getElementById('xrScene');
  const xrTargetsEl = opts.xrTargetsEl || DOC.getElementById('xrTargets');
  const xrCam = opts.xrCam || DOC.getElementById('xrCam');

  if (!layerEl){
    console.warn('[GoodJunkVR] missing #gj-layer');
    return;
  }

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

  const base = diffBase(diff);

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

    misses:0,
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

    spawnMs: base.spawnMs,
    ttlMs: base.ttlMs,
    size: base.size,
    junkP: base.junk,
    powerP: base.power,
    maxTargets: base.maxT,

    cvr: isCVR(),
    twinSeq: 0,
    twinMap: new Map(),

    // XR state
    xrEnabled: xrAvailable(sceneEl),
    xrActive: false,
    xrTTL: new Map() // element -> timeout id
  };

  if (isMobileLike()){
    S.maxTargets = Math.max(6, S.maxTargets - 1);
    S.size = Math.min(1.12, S.size + 0.03);
  }

  const safeMargins = (function(){
    const portrait = (ROOT.innerHeight||0) > (ROOT.innerWidth||0);
    if (S.cvr){
      return portrait
        ? { top: 250, bottom: 150, left: 18, right: 18 }
        : { top: 165, bottom: 120, left: 18, right: 18 };
    }
    return portrait
      ? { top: 185, bottom: 165, left: 22, right: 22 }
      : { top: 145, bottom: 135, left: 22, right: 22 };
  })();

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
      goalNow: S.goalsCleared,
      goalTotal: S.goalsTotal,
      miniTitle: `Mini: คอมโบมาแล้ว!`,
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
  }

  function burstAtDomEl(el, kind){
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

  function hitGoodCommon(emoji){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.fever = clamp(S.fever - 2.2, 0, 100);
    updateFever(S.shield, S.fever);

    const pts = scoreGood();
    judge('good', `+${pts}`);
    logEvent('hit', { kind:'good', emoji:String(emoji||''), score:S.score|0, combo:S.combo|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();

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
  }

  function hitShieldCommon(){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.shield = clamp(S.shield + 1, 0, 9);
    updateFever(S.shield, S.fever);

    S.score += 70;
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    logEvent('hit', { kind:'shield', emoji:'🛡️', shield:S.shield|0 });

    updateScore();
    updateQuest();
  }

  function hitStarCommon(emoji){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = 140;
    S.score += pts;
    judge('good', `BONUS +${pts}`);
    emit('hha:celebrate', { kind:'mini', title:'BONUS ✨' });
    logEvent('hit', { kind:'star', emoji:String(emoji||'⭐') });

    updateScore();
    updateQuest();
  }

  function hitJunkCommon(emoji){
    S.hitAll++;

    if (S.shield > 0){
      S.shield = Math.max(0, S.shield - 1);
      S.hitJunkGuard++;
      updateFever(S.shield, S.fever);

      judge('good', 'SHIELD BLOCK!');
      logEvent('shield_block', { kind:'junk', emoji:String(emoji||'') });

      updateScore();
      updateQuest();
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
    logEvent('hit', { kind:'junk', emoji:String(emoji||''), score:S.score|0, fever:Math.round(S.fever) });

    updateScore();
    updateQuest();
  }

  /* -------------------- DOM target lifecycle -------------------- */
  function removeDomTarget(el){
    try{ clearTimeout(el._ttl); }catch(_){}
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 140);
  }

  function removeDomTwinById(twinId){
    const pair = S.twinMap.get(twinId);
    if (!pair) return;
    S.twinMap.delete(twinId);
    pair.forEach(x=>{ if (x && x.isConnected) removeDomTarget(x); });
  }

  function expireDomTarget(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    const twinId = el.dataset.twin || '';

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

    if (S.cvr && twinId) removeDomTwinById(twinId);
    else {
      el.classList.add('gone');
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
    }
  }

  function makeDomTarget(type, emoji, x, y, s, twinId){
    const el = DOC.createElement('div');
    el.className = `gj-target ${type}`;
    el.dataset.type = type;
    el.dataset.emoji = String(emoji||'✨');
    if (twinId) el.dataset.twin = twinId;

    el.style.position = 'absolute';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '30';
    el.style.width = '74px';
    el.style.height = '74px';
    el.style.borderRadius = '999px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '38px';
    el.style.background = 'rgba(2,6,23,.55)';
    el.style.border = '1px solid rgba(148,163,184,.22)';
    el.style.backdropFilter = 'blur(8px)';
    el.style.boxShadow = '0 16px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.04) inset';

    setXY(el, x, y);
    el.style.transform = `translate(-50%,-50%) scale(${Number(s||1).toFixed(3)})`;
    el.textContent = String(emoji||'✨');

    el._ttl = setTimeout(()=> expireDomTarget(el), S.ttlMs);

    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      hitDomTarget(el);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });
    el.addEventListener('click', onHit, { passive:false });

    return el;
  }

  function hitDomTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.dataset.type||'');
    const emoji = String(el.dataset.emoji||'');
    const twinId = el.dataset.twin || '';

    if (tp === 'good'){ hitGoodCommon(emoji); burstAtDomEl(el,'good'); }
    else if (tp === 'junk'){ hitJunkCommon(emoji); burstAtDomEl(el,'junk'); }
    else if (tp === 'shield'){ hitShieldCommon(); burstAtDomEl(el,'shield'); }
    else if (tp === 'star'){ hitStarCommon(emoji); burstAtDomEl(el,'star'); }

    if (S.cvr && twinId) removeDomTwinById(twinId);
    else removeDomTarget(el);
  }

  /* -------------------- XR target lifecycle -------------------- */
  function scheduleXrExpire(el){
    if (!el) return;
    const tid = setTimeout(()=>{
      expireXrTarget(el);
    }, S.ttlMs);
    S.xrTTL.set(el, tid);
  }
  function clearXrExpire(el){
    const tid = S.xrTTL.get(el);
    if (tid) {
      try{ clearTimeout(tid); }catch(_){}
      S.xrTTL.delete(el);
    }
  }
  function removeXrTarget(el){
    if (!el) return;
    clearXrExpire(el);
    try{ el.parentNode && el.parentNode.removeChild(el); }catch(_){}
  }
  function expireXrTarget(el){
    if (!el || !el.isConnected) return;
    const tp = String(el.getAttribute('data-type')||'');
    const emoji = String(el.getAttribute('data-emoji')||'');

    if (tp === 'good'){
      S.misses++;
      S.expireGood++;
      S.combo = 0;

      S.fever = clamp(S.fever + 7, 0, 100);
      updateFever(S.shield, S.fever);

      judge('warn', 'MISS (หมดเวลา)!');
      updateScore();
      updateQuest();
      logEvent('miss_expire', { kind:'good', emoji });
    }

    removeXrTarget(el);
  }

  function hitXrTarget(el){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const tp = String(el.getAttribute('data-type')||'');
    const emoji = String(el.getAttribute('data-emoji')||'');

    if (tp === 'good') hitGoodCommon(emoji);
    else if (tp === 'junk') hitJunkCommon(emoji);
    else if (tp === 'shield') hitShieldCommon();
    else if (tp === 'star') hitStarCommon(emoji);

    removeXrTarget(el);
  }

  /* -------------------- Spawning (DOM vs XR) -------------------- */
  function pickType(r, inWarm){
    const powerP = inWarm ? (S.powerP * 0.6) : S.powerP;
    const junkP  = inWarm ? (S.junkP * 0.55)  : S.junkP;

    if (r < powerP) return 'shield';
    if (r < powerP + 0.035) return 'star';
    if (r < powerP + 0.035 + junkP) return 'junk';
    return 'good';
  }

  function pickEmoji(tp){
    if (tp === 'good') return pick(S.rng, GOOD);
    if (tp === 'junk') return pick(S.rng, JUNK);
    if (tp === 'shield') return SHIELD;
    return pick(S.rng, STARS);
  }

  function spawnDOM(){
    if (!S.running || S.ended) return;
    if (countTargets(layerEl) >= S.maxTargets) return;

    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;

    const top = safeMargins.top, bottom = safeMargins.bottom, left = safeMargins.left, right = safeMargins.right;
    const usableH = Math.max(120, H - top - bottom);
    const usableW = Math.max(200, W - left - right);

    const t = now();
    const inWarm = (t < S.warmupUntil);

    const tp = pickType(S.rng(), inWarm);
    const emoji = pickEmoji(tp);
    const size = (inWarm ? (S.size * 1.06) : S.size);

    if (S.cvr){
      const halfW = W * 0.5;
      const rectL = { left: left, top: top, width: Math.max(140, halfW - left - right), height: usableH };
      const rectR = { left: halfW + left, top: top, width: Math.max(140, halfW - left - right), height: usableH };

      const pN = { u: S.rng(), v: S.rng() };
      const pL = randPosInRect(()=>pN.u, rectL, 10);
      const pR = randPosInRect(()=>pN.u, rectR, 10);
      pL.y = rectL.top + pN.v * rectL.height;
      pR.y = rectR.top + pN.v * rectR.height;

      const twinId = 't' + (++S.twinSeq);

      const elL = makeDomTarget(tp, emoji, pL.x, pL.y, (tp==='junk' ? size*0.98 : size), twinId);
      const elR = makeDomTarget(tp, emoji, pR.x, pR.y, (tp==='junk' ? size*0.98 : size), twinId);

      layerEl.appendChild(elL);
      layerEl.appendChild(elR);
      S.twinMap.set(twinId, [elL, elR]);

      logEvent('spawn', { kind:tp, emoji:String(emoji||''), twin:twinId, mode:'cvr' });
      return;
    }

    const rect = { left: left, top: top, width: usableW, height: usableH };
    const p = randPosInRect(S.rng, rect, 10);

    layerEl.appendChild(makeDomTarget(tp, emoji, p.x, p.y, (tp==='junk' ? size*0.98 : size)));
    logEvent('spawn', { kind:tp, emoji:String(emoji||''), mode:'dom' });
  }

  function xrTargetCount(){
    try{ return xrTargetsEl ? xrTargetsEl.querySelectorAll('.xr-target').length : 0; }catch(_){ return 0; }
  }

  function spawnXR(){
    if (!S.running || S.ended) return;
    if (!S.xrEnabled || !xrTargetsEl || !ROOT.AFRAME) return;
    if (xrTargetCount() >= S.maxTargets) return;

    const t = now();
    const inWarm = (t < S.warmupUntil);

    const tp = pickType(S.rng(), inWarm);
    const emoji = pickEmoji(tp);
    const size = (inWarm ? (S.size * 1.06) : S.size);

    // spawn in front of camera, within comfortable cone
    // x: [-1.0..1.0], y:[-0.55..0.55], z:-2.0 (slightly vary z)
    const x = (S.rng()*2 - 1) * 1.05;
    const y = (S.rng()*2 - 1) * 0.62;
    const z = -2.0 - S.rng()*0.35;

    const el = makeXrTarget(ROOT.AFRAME, tp, emoji, {x, y: (y + 1.45), z}, (tp==='junk' ? size*0.96 : size), '');
    xrTargetsEl.appendChild(el);

    // click from cursor
    el.addEventListener('click', (e)=>{
      e.stopPropagation?.();
      hitXrTarget(el);
    });

    scheduleXrExpire(el);
    logEvent('spawn', { kind:tp, emoji:String(emoji||''), mode:'xr' });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;

    // decide mode by XR active
    S.xrActive = xrIsActive(sceneEl);
    if (S.xrActive) spawnXR();
    else spawnDOM();

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

  // ยิงกลาง — ใช้สำหรับ DOM เท่านั้น (XR ใช้ cursor click)
  function shootAtCrosshair(){
    if (!S.running || S.ended) return;
    if (S.xrActive) return;

    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;

    const cL = getCenterOf(crossL, W*0.5, H*0.55);
    const cR = getCenterOf(crossR, W*0.75, H*0.55);

    const r = isMobileLike() ? 66 : 56;

    let best = null;
    let bestD2 = 1e18;

    const tL = findTargetNear(layerEl, cL.x, cL.y, r);
    if (tL){
      try{
        const br = tL.getBoundingClientRect();
        const tx = br.left+br.width/2, ty=br.top+br.height/2;
        const d2 = dist2(cL.x,cL.y,tx,ty);
        if (d2 < bestD2){ best = tL; bestD2 = d2; }
      }catch(_){}
    }

    if (S.cvr){
      const tR = findTargetNear(layerEl, cR.x, cR.y, r);
      if (tR){
        try{
          const br = tR.getBoundingClientRect();
          const tx = br.left+br.width/2, ty=br.top+br.height/2;
          const d2 = dist2(cR.x,cR.y,tx,ty);
          if (d2 < bestD2){ best = tR; bestD2 = d2; }
        }catch(_){}
      }
    }

    if (best){
      hitDomTarget(best);
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
      shootEl.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); }, { passive:false });
    }

    DOC.addEventListener('keydown', (e)=>{
      const k = String(e.key||'').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){
        e.preventDefault?.();
        shootAtCrosshair();
      }
    });
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
    // DOM
    try{
      const list = layerEl.querySelectorAll('.gj-target');
      list.forEach(el=>{
        try{ clearTimeout(el._ttl); }catch(_){}
        try{ el.remove(); }catch(_){}
      });
    }catch(_){}
    S.twinMap.clear();

    // XR
    if (xrTargetsEl){
      try{
        // clear TTL map
        for (const [el, tid] of S.xrTTL.entries()){
          try{ clearTimeout(tid); }catch(_){}
        }
        S.xrTTL.clear();
      }catch(_){}
      clearXrTargets(xrTargetsEl);
    }
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

    // warmup caps
    S.maxTargets = Math.min(S.maxTargets, isMobileLike() ? 6 : 7);

    coach('neutral',
      (S.cvr ? 'cVR: หมุนจอแนวนอนแล้วเล็งกลางแต่ละตา 👓' : 'พร้อมลุย! ช่วงแรกนุ่ม ๆ แล้วโหดขึ้นเร็ว 😈'),
      (S.xrEnabled ? 'WebXR: เข้า VR ได้ถ้าเครื่องรองรับ' : 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้')
    );

    updateScore();
    updateTime();
    updateQuest();

    logEvent('session_start', {
      projectTag: 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      endPolicy: S.endPolicy,
      challenge: S.challenge,
      seed: S.seed,
      sessionId: sessionId || '',
      timeSec: S.timeSec,
      view: S.cvr ? 'cvr' : (qs('view','')||'auto'),
      xrEnabled: !!S.xrEnabled
    });

    loopSpawn();
    adaptiveTick();
  }

  // XR enter/exit -> toggle behavior (targets switch automatically in loop)
  if (sceneEl){
    sceneEl.addEventListener('enter-vr', ()=>{
      S.xrActive = true;
      try{ coach('happy','เข้าโหมด WebXR แล้ว 👓','มองแล้วแตะ/คลิกที่เป้า'); }catch(_){}
      clearAllTargets(); // clear DOM clutter when entering XR
    });
    sceneEl.addEventListener('exit-vr', ()=>{
      S.xrActive = false;
      try{ coach('neutral','ออกจาก WebXR แล้ว','กลับมายิงแบบหน้าจอได้'); }catch(_){}
      clearAllTargets();
    });
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