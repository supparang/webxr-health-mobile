// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard) — FULL PATCH (A+B) PACK 1–10
// PACK 1: HUD-safe spawn (no-spawn zones) + layer-rect anchoring
// PACK 2: Deterministic RNG + Pattern Generator (storm/boss) seeded
// PACK 3: Storm trigger hardened + escape-to-green rescue bias
// PACK 4: Boss 3 phases + pressure ramp + warnings
// PACK 5: Powerups (Shield/Slow/Magnet) + FX hooks
// PACK 6: Research logging schema (session/events) + flush-hardened
// PACK 7: Standard summary schema (canonical keys) + legacy aliases
// PACK 8: AI hooks interface (Director/Coach/Pattern) disabled by default in research
// PACK 9: Mobile/cVR aim assist stability + miss rules
// PACK10: Safe boot (overlay hidden lock) + auto-start when overlay not visible

'use strict';

const WIN = window;
const DOC = document;

// -------------------------
// Storage keys
// -------------------------
const LS_LAST  = 'HHA_LAST_SUMMARY';
const LS_HIST  = 'HHA_SUMMARY_HISTORY';
const LS_SESS  = 'HHA_SESSIONS_BUFFER';
const LS_EVTS  = 'HHA_EVENTS_BUFFER';

// -------------------------
// Helpers
// -------------------------
const clamp   = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const clamp01 = (v)=>clamp(v,0,1);

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const qn = (k, d=0)=> Number(qs(k, d)) || Number(d) || 0;

const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
const nowTs = ()=> Date.now();

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function safeText(id, txt){
  const el = DOC.getElementById(id);
  if(el) el.textContent = String(txt);
}

function safeDownload(filename, text, mime='text/plain'){
  try{
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1200);
  }catch(_){}
}

function safeCopy(text){
  try{ navigator.clipboard?.writeText(String(text)); }catch(_){}
}

// -------------------------
// Deterministic RNG (LCG)
// -------------------------
function makeRNG(seed){
  let x = (Number(seed) || nowTs()) >>> 0;
  return () => (x = (1664525 * x + 1013904223) >>> 0) / 4294967296;
}

function zoneFromPct(pct){
  pct = clamp(pct, 0, 100);
  if(pct >= 40 && pct <= 70) return 'GREEN';
  if(pct < 40) return 'LOW';
  return 'HIGH';
}

function gradeFromScore(score){
  if(score >= 2200) return 'S';
  if(score >= 1700) return 'A';
  if(score >= 1200) return 'B';
  if(score >= 700)  return 'C';
  return 'D';
}

function dist2(ax,ay,bx,by){
  const dx=ax-bx, dy=ay-by;
  return dx*dx + dy*dy;
}

// -------------------------
// AI Hooks (Director/Coach/Pattern) - SAFE STUB
// Enable only when ?ai=1 AND runMode=play (default)
// -------------------------
function createAIHooksSafe(){
  const enabled = String(qs('ai','0')||'0') === '1';
  const hooks = {
    enabled,
    getDifficulty: (_state)=>({ spawnMul:1, badMul:1, driftMul:1 }),
    getTip: (_state)=>null,
    getPattern: (_ctx)=>null,
    onEvent: (_ev)=>{}
  };

  try{
    if(typeof WIN.HHA?.createAIHooks === 'function'){
      const ext = WIN.HHA.createAIHooks({ game:'hydration', enabled });
      if(ext && typeof ext === 'object'){
        return Object.assign(hooks, ext);
      }
    }
  }catch(_){}
  return hooks;
}

// -------------------------
// Config by difficulty
// -------------------------
function cfgByDiff(diff){
  const base = {
    easy:   { spawnPerSec:0.95, size:74, ttl:1400, goodDelta: 9, badDelta:-9,  drift:0.22, lock:28, stormDur: 8500, stormNeed: 6, endMs: 9000, endNeed:5200, bossMs: 10000, bossNeed:7  },
    normal: { spawnPerSec:1.15, size:68, ttl:1250, goodDelta: 8, badDelta:-10, drift:0.28, lock:28, stormDur: 9000, stormNeed: 8, endMs:10000, endNeed:6200, bossMs: 11000, bossNeed:9  },
    hard:   { spawnPerSec:1.35, size:62, ttl:1100, goodDelta: 7, badDelta:-12, drift:0.33, lock:28, stormDur: 9500, stormNeed:10, endMs:11000, endNeed:7200, bossMs: 12000, bossNeed:11 },
  };
  return base[diff] || base.normal;
}

// -------------------------
// Layer resolution
// -------------------------
function getLayerIds(){
  const cfg = WIN.HHA_VIEW || {};
  const ids = Array.isArray(cfg.layers) && cfg.layers.length ? cfg.layers : ['hydration-layer'];
  return ids.map(String);
}

function resolveLayers(){
  const ids = getLayerIds();
  const layers = [];
  for(const id of ids){
    const el = DOC.getElementById(id);
    if(el) layers.push(el);
  }
  if(!layers.length){
    const pf = DOC.getElementById('playfield') || DOC.body;
    const el = DOC.createElement('div');
    el.id = ids[0] || 'hydration-layer';
    el.style.position='absolute';
    el.style.inset='0';
    pf.appendChild(el);
    layers.push(el);
  }
  for(const L of layers){
    L.style.position = L.style.position || 'absolute';
    L.style.inset = L.style.inset || '0';
    L.style.pointerEvents = 'auto';
  }
  return layers;
}

// -------------------------
// HUD-safe zones (PACK 1)
// -------------------------
function getNoSpawnRects(){
  const rects = [];
  const hud = DOC.querySelector('.hud');
  const quest = DOC.querySelector('.quest');
  const pf = DOC.getElementById('playfield') || DOC.body;
  const pfRect = pf.getBoundingClientRect();

  function pushEl(el, pad=10){
    if(!el) return;
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return;
    rects.push({
      x1: (r.left - pfRect.left) - pad,
      y1: (r.top  - pfRect.top ) - pad,
      x2: (r.right- pfRect.left) + pad,
      y2: (r.bottom-pfRect.top ) + pad
    });
  }

  pushEl(hud, 14);
  pushEl(quest, 14);

  // reserve top strip for VR UI buttons overlay
  rects.push({ x1:0, y1:0, x2:pfRect.width, y2:64 });

  for(const rr of rects){
    rr.x1 = clamp(rr.x1, 0, pfRect.width);
    rr.y1 = clamp(rr.y1, 0, pfRect.height);
    rr.x2 = clamp(rr.x2, 0, pfRect.width);
    rr.y2 = clamp(rr.y2, 0, pfRect.height);
  }
  return rects;
}

function pointInRect(x,y, rr){
  return x>=rr.x1 && x<=rr.x2 && y>=rr.y1 && y<=rr.y2;
}

function pickSpawnPoint(rect, rng, pad, noRects){
  for(let i=0;i<18;i++){
    const x = clamp(rect.width  * (0.10 + rng()*0.80), pad, rect.width  - pad);
    const y = clamp(rect.height * (0.18 + rng()*0.68), pad, rect.height - pad);
    let ok = true;
    for(const nr of noRects){
      if(pointInRect(x,y,nr)){ ok=false; break; }
    }
    if(ok) return { x,y };
  }
  return { x: rect.width*0.5, y: rect.height*0.55 };
}

// -------------------------
// Target creation
// -------------------------
function makeTargetEl(kind, x, y, sizePx, ttlMs){
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.dataset.kind = kind;

  const emoji = (kind==='GOOD') ? '💧' : (kind==='BAD') ? '🥤' : (kind==='STORM') ? '🌀' : (kind==='PWR') ? '✨' : '💧';
  el.textContent = emoji;

  el.style.position='absolute';
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width = `${sizePx}px`;
  el.style.height= `${sizePx}px`;
  el.style.transform='translate(-50%,-50%)';
  el.style.display='flex';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.style.borderRadius='999px';
  el.style.userSelect='none';
  el.style.webkitUserSelect='none';
  el.style.pointerEvents='auto';

  el.style.fontSize = `${Math.max(22, (sizePx*0.62)|0)}px`;
  el.style.background='rgba(15,23,42,.32)';
  el.style.border='1px solid rgba(148,163,184,.18)';
  el.style.boxShadow='0 18px 50px rgba(0,0,0,.30)';
  el.style.backdropFilter='blur(8px)';
  el.style.opacity='1';
  el.style.visibility='visible';
  el.style.zIndex='42';

  if(kind==='GOOD')  el.style.outline='2px solid rgba(34,197,94,.22)';
  if(kind==='BAD')   el.style.outline='2px solid rgba(239,68,68,.22)';
  if(kind==='STORM') el.style.outline='2px dashed rgba(34,211,238,.26)';
  if(kind==='PWR')   el.style.outline='2px solid rgba(245,158,11,.26)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl   = String(ttlMs||1200);

  return el;
}

function removeTarget(el){
  try{ Engine.targets.delete(el); }catch(_){}
  try{ el.remove(); }catch(_){}
}

function doShock(x,y){
  try{
    const layer = Engine.layers[0] || DOC.body;
    const fx = DOC.createElement('div');
    fx.className = 'hha-shock';
    fx.style.setProperty('--x', `${x}px`);
    fx.style.setProperty('--y', `${y}px`);
    layer.appendChild(fx);
    setTimeout(()=>fx.remove(), 650);
  }catch(_){}
}

// -------------------------
// Engine state
// -------------------------
const Engine = {
  started:false,
  running:false,
  ended:false,

  t0:0,
  lastT:0,
  rafId:0,

  runMode:'play',
  diff:'normal',
  timePlannedSec:70,
  seed:0,

  // legacy mirrors
  run:'play',
  timeSec:70,

  layers:[],
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  waterPct:50,
  greenHoldMs:0,
  zone:'GREEN',

  phase:'MAIN',
  stormCycles:0,
  stormOk:0,
  stormLeftMs:0,
  stormNeed:0,
  stormHit:0,

  endWindowMs:0,
  endNeedGreenMs:0,
  _endGreenMs:0,

  bossMs:0,
  bossNeed:0,
  bossHit:0,
  bossPhase:1,

  targets:new Set(),
  spawnAcc:0,

  logs:[],
  coachLastMs:0,

  pwr: { shield:0, slowUntil:0, magnetUntil:0 },

  _noSpawnRects:[],

  session: null,
  evtBuf: [],

  ai: null,

  _offGreenMs:0,
  _rescueMs:0,
};

function readCtx(){
  Engine.runMode = String(qs('run','play')).toLowerCase()==='research' ? 'research' : 'play';
  Engine.diff = (['easy','normal','hard'].includes(String(qs('diff','normal')).toLowerCase()))
    ? String(qs('diff','normal')).toLowerCase()
    : 'normal';

  Engine.timePlannedSec = clamp(qn('time', 70), 20, 600) | 0;
  Engine.seed = qn('seed', 0) ? (qn('seed',0)|0) : nowTs();

  Engine.run = Engine.runMode;
  Engine.timeSec = Engine.timePlannedSec;

  Engine.ai = createAIHooksSafe();
  if(Engine.runMode==='research') Engine.ai.enabled = false;
}

function logEv(type, data){
  const ev = { t: nowTs(), type, ...data };
  Engine.logs.push(ev);
  Engine.evtBuf.push(ev);
  try{ Engine.ai?.onEvent?.(ev); }catch(_){}
}

function coachTip(msg, cooldownMs=2800){
  const t = nowMs();
  if(t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;

  try{
    if(Engine.ai?.enabled){
      const tip = Engine.ai.getTip?.(getStateForAI());
      if(typeof tip === 'string' && tip.trim()) msg = tip.trim();
    }
  }catch(_){}

  emit('hha:coach', { msg, game:'hydration' });
  logEv('coach', { msg });
}

function setWaterUI(pct){
  pct = clamp(pct, 0, 100);
  const z = zoneFromPct(pct);

  safeText('water-pct', pct|0);
  safeText('water-zone', z);

  const bar = DOC.getElementById('water-bar');
  if(bar) bar.style.width = `${pct.toFixed(0)}%`;

  Engine.zone = z;
}

function setStatsUI(timeLeftSec){
  safeText('stat-score', Engine.score|0);
  safeText('stat-combo', Engine.combo|0);
  safeText('stat-time',  timeLeftSec|0);
  safeText('stat-miss',  Engine.miss|0);
  safeText('stat-grade', gradeFromScore(Engine.score));
}

function setQuestUI(){
  const z = Engine.zone;
  const phase = Engine.phase;

  const l1 = (phase==='MAIN')
    ? `คุมให้อยู่โซน GREEN ให้นานที่สุด`
    : (phase==='STORM')
      ? `🌀 STORM! เก็บ GOOD ให้ครบ`
      : (phase==='END')
        ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา`
        : `👑 BOSS PHASE ${Engine.bossPhase}/3! เก็บ GOOD ต่อเนื่อง`;

  const l2 = (phase==='STORM')
    ? `ต้องการ: ${Engine.stormHit}/${Engine.stormNeed} (เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s)`
    : (phase==='END')
      ? `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`
      : (phase==='BOSS')
        ? `ต้องการ: ${Engine.bossHit}/${Engine.bossNeed} (เหลือ ${(Engine.bossMs/1000).toFixed(1)}s)`
        : `ตอนนี้: โซน ${z}`;

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax} | Shield:${Engine.pwr.shield}`);

  safeText('storm-left', (Engine.phase==='STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);
  safeText('shield-count', Engine.pwr.shield|0);
}

// -------------------------
// Pattern Generator (PACK 2)
// -------------------------
function pickPatternType(rng){
  const r = rng();
  if(r < 0.25) return 'lane';
  if(r < 0.50) return 'ring';
  if(r < 0.75) return 'twin';
  return 'chaos';
}

function genPatternPoints(type, rect, rng, n){
  const pts = [];
  const w = rect.width, h = rect.height;

  if(type==='lane'){
    const lanes = 3;
    const laneW = w/(lanes+1);
    for(let i=0;i<n;i++){
      const lane = 1 + ((i + ((rng()*lanes)|0)) % lanes);
      const x = laneW*lane + (rng()*18-9);
      const y = h*(0.22 + rng()*0.55);
      pts.push({x,y});
    }
    return pts;
  }

  if(type==='ring'){
    const cx = w*0.5, cy = h*0.52;
    const R  = Math.min(w,h)*0.26;
    const a0 = rng()*Math.PI*2;
    for(let i=0;i<n;i++){
      const a = a0 + (i/n)*Math.PI*2;
      pts.push({ x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R*0.88 });
    }
    return pts;
  }

  if(type==='twin'){
    const cx = w*0.5, cy = h*0.52;
    const dx = Math.min(w,h)*0.18;
    for(let i=0;i<n;i++){
      const side = (i%2===0) ? -1 : 1;
      pts.push({ x: cx + side*dx + (rng()*16-8), y: cy + (rng()*h*0.35 - h*0.18) });
    }
    return pts;
  }

  for(let i=0;i<n;i++){
    pts.push({ x: w*(0.15 + rng()*0.70), y: h*(0.22 + rng()*0.55) });
  }
  return pts;
}

function getStateForAI(){
  return {
    runMode: Engine.runMode,
    diff: Engine.diff,
    phase: Engine.phase,
    zone: Engine.zone,
    score: Engine.score,
    combo: Engine.combo,
    comboMax: Engine.comboMax,
    miss: Engine.miss,
    waterPct: Engine.waterPct,
    stormCycles: Engine.stormCycles,
    stormOk: Engine.stormOk,
    bossPhase: Engine.bossPhase,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed
  };
}

// -------------------------
// Spawning logic
// -------------------------
function chooseKind(rng, isStorm, isBoss){
  let z = Engine.zone;
  let pBad = (z==='GREEN') ? 0.26 : 0.36;

  const rescue = (Engine._rescueMs > 0);
  if(rescue) pBad *= 0.55;

  if(isStorm) pBad = 0.22;
  if(isBoss)  pBad = 0.40;

  const pwrChance = (Engine.runMode==='play') ? 0.03 : 0.015;
  const stormCoreChance = isStorm ? 0.10 : 0.00;

  const r = rng();
  if(r < pwrChance) return 'PWR';
  if(stormCoreChance && r > 0.92) return 'STORM';
  return (rng() < pBad) ? 'BAD' : 'GOOD';
}

function spawnOne(rng, cfg){
  const layers = Engine.layers;
  if(!layers.length) return;

  const isStorm = (Engine.phase==='STORM');
  const isBoss  = (Engine.phase==='BOSS');

  for(const layer of layers){
    const rect = layer.getBoundingClientRect();
    const pad = Math.max(24, (cfg.size*0.55)|0);
    const noRects = Engine._noSpawnRects || [];

    let spawn = null;

    if(isStorm || isBoss){
      const key = (isStorm ? 'storm' : 'boss');
      const pool = Engine[`_${key}PatternPool`];
      if(Array.isArray(pool) && pool.length){
        spawn = pool.shift();
      }
      if(!spawn){
        const type = Engine[`_${key}PatternType`] || pickPatternType(rng);
        Engine[`_${key}PatternType`] = type;

        const pts = genPatternPoints(type, rect, rng, isStorm ? (cfg.stormNeed + 4) : (cfg.bossNeed + 5));
        const ok = pts.filter(p=>{
          let good = true;
          for(const nr of noRects){ if(pointInRect(p.x,p.y,nr)){ good=false; break; } }
          return good;
        });
        Engine[`_${key}PatternPool`] = ok.length ? ok : pts;
        spawn = Engine[`_${key}PatternPool`].shift();
      }
    }

    if(!spawn){
      spawn = pickSpawnPoint(rect, rng, pad, noRects);
    }

    const kind = chooseKind(rng, isStorm, isBoss);
    const ttl  = cfg.ttl + ((rng()*300)|0);
    const size = cfg.size + ((rng()*8)|0);

    const el = makeTargetEl(kind, spawn.x, spawn.y, size, ttl);
    layer.appendChild(el);
    Engine.targets.add(el);

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      hitTarget(el, { source:'pointer', x:e.clientX, y:e.clientY });
    }, { passive:false });

    setTimeout(()=>{
      if(!Engine.running) return;
      if(!el.isConnected) return;

      const k = el.dataset.kind;
      if((k==='GOOD' || k==='PWR') && (Engine.phase==='STORM' || Engine.phase==='BOSS')){
        Engine.miss += 1;
        Engine.combo = 0;
        coachTip('พลาดของสำคัญ! ลองเล็งนิ่ง ๆ แล้วแตะทีละช็อต');
        logEv('miss', { phase:Engine.phase, kind:k, source:'ttl' });
      }
      removeTarget(el);
    }, ttl);
  }
}

// -------------------------
// Powerups (PACK 5)
// -------------------------
function grantPower(kind){
  if(kind==='PWR'){
    const rng = Engine.rng;
    const r = rng();
    if(r < 0.34){
      Engine.pwr.shield = clamp((Engine.pwr.shield||0) + 1, 0, 5);
      coachTip('✨ ได้ SHIELD! กัน MISS จาก BAD ได้ 1 ครั้ง', 0);
      logEv('pwr', { p:'shield', v:Engine.pwr.shield });
    }else if(r < 0.67){
      Engine.pwr.slowUntil = nowMs() + 3500;
      coachTip('✨ SLOW TIME! เป้าออกช้าลงชั่วคราว', 0);
      logEv('pwr', { p:'slow', until:Engine.pwr.slowUntil });
    }else{
      Engine.pwr.magnetUntil = nowMs() + 3200;
      coachTip('✨ MAGNET! เล็งใกล้ ๆ ก็โดนง่ายขึ้น', 0);
      logEv('pwr', { p:'magnet', until:Engine.pwr.magnetUntil });
    }
  }
}

// -------------------------
// Core gameplay
// -------------------------
function adjustWater(delta){
  Engine.waterPct = clamp(Engine.waterPct + delta, 0, 100);
  setWaterUI(Engine.waterPct);
}

function addScore(pts){
  Engine.score += pts;
  emit('hha:score', { score:Engine.score, combo:Engine.combo, miss:Engine.miss });
}

function applyBadHit(cfg){
  if((Engine.pwr.shield|0) > 0){
    Engine.pwr.shield -= 1;
    coachTip('🛡️ SHIELD ป้องกันแล้ว! เหลือ ' + Engine.pwr.shield, 0);
    logEv('shield_block', { left:Engine.pwr.shield });
    return;
  }
  Engine.miss += 1;
  Engine.combo = 0;
  adjustWater(cfg.badDelta);
  addScore(-30);
  coachTip('โดน BAD! รีบกลับเข้า GREEN', 2300);
}

function hitTarget(el, info){
  if(!Engine.running || Engine.ended) return;
  if(!el || !el.isConnected) return;

  const kind = el.dataset.kind || 'GOOD';
  const cfg = cfgByDiff(Engine.diff);

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  if(kind==='GOOD'){
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+cfg.goodDelta);

    const bonus = 60 + Math.min(240, Engine.combo*10);
    addScore(80 + bonus);

    if(Engine.phase==='STORM') Engine.stormHit += 1;
    if(Engine.phase==='BOSS')  Engine.bossHit  += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);
  }
  else if(kind==='BAD'){
    applyBadHit(cfg);
  }
  else if(kind==='STORM'){
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta-3)));
    addScore(120);
    if(Engine.phase==='STORM') Engine.stormHit += 2;
    coachTip('🌀 STORM core! ได้แต้มพิเศษ', 2200);
  }
  else if(kind==='PWR'){
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    addScore(140);
    adjustWater(+Math.max(3, (cfg.goodDelta-4)));
    grantPower('PWR');
  }

  doShock(cx, cy);
  logEv('hit', {
    kind, phase:Engine.phase,
    score:Engine.score, water:Engine.waterPct, combo:Engine.combo,
    source: info?.source || 'unknown'
  });

  removeTarget(el);
}

function handleShootEvent(detail){
  if(!Engine.running || Engine.ended) return;
  if(!detail) return;

  const x = Number(detail.x);
  const y = Number(detail.y);
  if(!isFinite(x) || !isFinite(y)) return;

  const baseLock = clamp(Number(detail.lockPx) || 28, 10, 90);
  const lockPx = (nowMs() < (Engine.pwr.magnetUntil||0)) ? clamp(baseLock + 16, 10, 120) : baseLock;
  const lock2 = lockPx*lockPx;

  let best=null, bestD2=Infinity;

  for(const el of Engine.targets){
    if(!el || !el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const d2 = dist2(x,y,cx,cy);
    if(d2 < bestD2){ bestD2=d2; best=el; }
  }

  if(best && bestD2 <= lock2){
    hitTarget(best, { source: detail.source || 'hha:shoot', x,y });
  }else{
    if(Engine.phase==='STORM' || Engine.phase==='BOSS'){
      Engine.miss += 1;
      Engine.combo = 0;
      coachTip('พลาด! ลองเล็งนิ่งขึ้น (หรือเก็บ MAGNET/SHIELD)', 2300);
      logEv('miss', { phase:Engine.phase, source: detail.source || 'hha:shoot' });
    }
    doShock(x,y);
  }
}

// -------------------------
// Phase logic (PACK 3/4)
// -------------------------
function enterStorm(cfg){
  Engine.phase='STORM';
  Engine.stormCycles += 1;
  Engine.stormLeftMs = cfg.stormDur;
  Engine.stormNeed = cfg.stormNeed;
  Engine.stormHit = 0;
  Engine._stormPatternPool = null;
  Engine._stormPatternType = null;

  DOC.body.classList.add('hha-bossfx');
  coachTip('🌀 STORM! เก็บ GOOD ให้ครบ!', 0);
  logEv('phase', { phase:'STORM', stormNeed:Engine.stormNeed });
}

function exitStorm(success){
  Engine.phase='MAIN';
  DOC.body.classList.remove('hha-bossfx');
  if(success) Engine.stormOk += 1;

  coachTip(success ? 'ผ่าน STORM! กลับไปคุม GREEN ต่อ' : 'STORM ไม่ผ่าน! ระวัง BAD', 0);
  logEv('phase', { phase:'MAIN', stormSuccess:!!success });
}

function enterEndWindow(cfg){
  Engine.phase='END';
  Engine.endWindowMs = cfg.endMs;
  Engine.endNeedGreenMs = cfg.endNeed;
  Engine._endGreenMs = 0;

  DOC.body.classList.add('hha-endfx');
  coachTip('⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา', 0);
  logEv('phase', { phase:'END', needGreenMs:Engine.endNeedGreenMs });
}

function enterBoss(cfg){
  Engine.phase='BOSS';
  Engine.bossMs = cfg.bossMs;
  Engine.bossNeed = cfg.bossNeed;
  Engine.bossHit = 0;
  Engine.bossPhase = 1;

  Engine._bossPatternPool = null;
  Engine._bossPatternType = null;

  DOC.body.classList.add('hha-bossfx');
  coachTip('👑 BOSS! เก็บ GOOD ต่อเนื่อง ห้ามพลาด', 0);
  logEv('phase', { phase:'BOSS', bossNeed:Engine.bossNeed });
}

// -------------------------
// Main loop
// -------------------------
function step(t){
  if(!Engine.running) return;

  const cfg = cfgByDiff(Engine.diff);
  const dt = Math.min(0.06, Math.max(0, (t-Engine.lastT)/1000));
  Engine.lastT = t;

  const elapsed = (t-Engine.t0)/1000;
  const left = Math.max(0, Engine.timePlannedSec - elapsed);

  emit('hha:time', { t:elapsed, left, phase:Engine.phase });
  setStatsUI(left);

  let spawnRate = cfg.spawnPerSec;
  let driftMul = 1;

  if(Engine.runMode==='play'){
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 55);
    spawnRate = cfg.spawnPerSec * (0.9 + perf*0.35);
  }

  try{
    if(Engine.ai?.enabled){
      const d = Engine.ai.getDifficulty?.(getStateForAI());
      if(d && typeof d === 'object'){
        spawnRate *= clamp(Number(d.spawnMul)||1, 0.6, 1.8);
        driftMul *= clamp(Number(d.driftMul)||1, 0.6, 1.6);
      }
    }
  }catch(_){}

  if(Engine.runMode==='play'){
    const target = 55;
    const drift = cfg.drift * driftMul;

    const extra = (Engine._rescueMs > 0) ? 1.8 : 1.0;
    Engine.waterPct += (target - Engine.waterPct) * drift * dt * extra;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }

  setWaterUI(Engine.waterPct);

  if(Engine.zone==='GREEN') Engine.greenHoldMs += dt*1000;

  if(Engine.zone==='GREEN'){
    Engine._offGreenMs = 0;
    Engine._rescueMs = 0;
  }else{
    Engine._offGreenMs = (Engine._offGreenMs||0) + dt*1000;
    if(Engine._offGreenMs > 2800){
      Engine._rescueMs = Math.min(4000, (Engine._rescueMs||0) + dt*1000);
    }
  }

  const leftMs = left*1000;

  if(!Engine.ended && leftMs <= 18000 && Engine.phase==='MAIN'){
    enterEndWindow(cfg);
  }

  if(Engine.phase==='MAIN'){
    if(Engine._offGreenMs > 2400){
      Engine._offGreenMs = 0;
      enterStorm(cfg);
    }
  }

  if(Engine.phase==='STORM'){
    Engine.stormLeftMs -= dt*1000;
    if(Engine.stormHit >= Engine.stormNeed){
      exitStorm(true);
    }else if(Engine.stormLeftMs <= 0){
      Engine.miss += 2;
      Engine.combo = 0;
      exitStorm(false);
    }
  }

  if(Engine.phase==='END'){
    Engine.endWindowMs -= dt*1000;
    if(Engine.zone==='GREEN') Engine._endGreenMs += dt*1000;

    if(Engine.endWindowMs <= 0){
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  if(Engine.phase==='BOSS'){
    Engine.bossMs -= dt*1000;

    const total = cfg.bossMs;
    const remain = Engine.bossMs;
    const frac = clamp01(remain / Math.max(1,total));
    const phase = (frac > 0.66) ? 1 : (frac > 0.33) ? 2 : 3;
    if(phase !== Engine.bossPhase){
      Engine.bossPhase = phase;
      coachTip(phase===2 ? '⚠️ BOSS เข้มขึ้น! อย่าพลาด GOOD' : '🔥 FINAL PHASE! เร่งคอมโบ!', 0);
      logEv('boss_phase', { phase });
    }

    if(Engine.bossPhase===2) spawnRate *= 1.12;
    if(Engine.bossPhase===3) spawnRate *= 1.24;

    if(Engine.bossHit >= Engine.bossNeed) Engine.bossMs = 0;
    if(Engine.bossMs <= 0){
      endGame();
      return;
    }
  }

  if(nowMs() < (Engine.pwr.slowUntil||0)){
    spawnRate *= 0.72;
  }

  Engine.spawnAcc += dt * spawnRate;
  if(Engine.phase==='STORM') Engine.spawnAcc += dt * 0.45;
  if(Engine.phase==='BOSS')  Engine.spawnAcc += dt * (0.65 + (Engine.bossPhase-1)*0.10);

  const rng = Engine.rng;
  while(Engine.spawnAcc >= 1){
    Engine.spawnAcc -= 1;
    spawnOne(rng, cfg);
  }

  if((Engine._gcAcc = (Engine._gcAcc||0) + dt) > 0.7){
    Engine._gcAcc = 0;
    for(const el of Array.from(Engine.targets)){
      if(!el || !el.isConnected) Engine.targets.delete(el);
    }
  }

  setQuestUI();

  if(left <= 0.001 && !Engine.ended){
    endGame();
    return;
  }

  Engine.rafId = requestAnimationFrame(step);
}

// -------------------------
// Research logging (PACK 6)
// -------------------------
function buildSessionMeta(){
  const meta = {
    ts: nowTs(),
    game: 'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,

    pid: String(qs('pid','')||''),
    studyId: String(qs('studyId','')||''),
    phase: String(qs('phase','')||''),
    conditionGroup: String(qs('conditionGroup','')||''),
    view: String(qs('view','')||''),
    hub: String(qs('hub','')||''),
    gate: String(qs('gate','0')||'0'),

    ua: String(navigator.userAgent||'')
  };
  return meta;
}

function flushBuffers(reason){
  try{
    const sess = Engine.session;
    if(sess){
      sess.updatedAt = nowTs();
      sess.reason = reason || '';
      sess.score = Engine.score|0;
      sess.miss  = Engine.miss|0;
      sess.comboMax = Engine.comboMax|0;
      sess.waterPct = Math.round(Engine.waterPct);
      sess.zone = Engine.zone;
      sess.phase = Engine.phase;
    }

    const sBuf = JSON.parse(localStorage.getItem(LS_SESS) || '[]');
    if(sess){
      const idx = sBuf.findIndex(x=>x && x.sid===sess.sid);
      if(idx>=0) sBuf[idx] = sess;
      else sBuf.unshift(sess);
      localStorage.setItem(LS_SESS, JSON.stringify(sBuf.slice(0, 50)));
    }

    if(Engine.evtBuf && Engine.evtBuf.length){
      const eBuf = JSON.parse(localStorage.getItem(LS_EVTS) || '[]');
      const sid = sess?.sid || '';
      const packed = Engine.evtBuf.map(ev=>Object.assign({ sid }, ev));
      localStorage.setItem(LS_EVTS, JSON.stringify(packed.concat(eBuf).slice(0, 2500)));
      Engine.evtBuf.length = 0;
    }
  }catch(_){}
}

// -------------------------
// Summary schema (PACK 7)
// -------------------------
function buildSummary(){
  const shots = Engine.logs.filter(x=>x.type==='hit' || x.type==='miss').length;
  const hits  = Engine.logs.filter(x=>x.type==='hit').length;
  const acc   = shots ? Math.round((hits/shots)*100) : 0;

  const grade = gradeFromScore(Engine.score);
  const tier  = (grade==='S' || grade==='A') ? '🔥 Elite'
    : (grade==='B') ? '⚡ Skilled'
    : (grade==='C') ? '✅ Ok'
    : '🧊 Warm-up';

  return {
    game:'hydration',
    ts: nowTs(),

    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,

    scoreFinal: Engine.score|0,
    grade,
    tier,
    comboMax: Engine.comboMax|0,
    miss: Engine.miss|0,
    accuracyPct: acc,

    greenHoldSec: Math.round((Engine.greenHoldMs/1000)*10)/10,
    stormCycles: Engine.stormCycles|0,
    stormOk: Engine.stormOk|0,
    bossNeed: Engine.bossNeed|0,
    bossHit: Engine.bossHit|0,

    powerups: {
      shield: Engine.pwr.shield|0
    },

    logs: Engine.logs.slice(0, 4000),

    run: Engine.runMode,
    timeSec: Engine.timePlannedSec,
    score: Engine.score|0,
    accuracyPctLegacy: acc
  };
}

function saveSummary(summary){
  try{
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
    const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    hist.unshift({
      ts: summary.ts,
      scoreFinal: summary.scoreFinal,
      grade: summary.grade,
      diff: summary.diff,
      runMode: summary.runMode
    });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
  }catch(_){}
}

function summaryToCSV(summary){
  const s = summary;
  const sessionRows = [
    ['ts', s.ts],
    ['game', s.game],
    ['runMode', s.runMode],
    ['diff', s.diff],
    ['timePlannedSec', s.timePlannedSec],
    ['seed', s.seed],
    ['scoreFinal', s.scoreFinal],
    ['grade', s.grade],
    ['tier', s.tier],
    ['accuracyPct', s.accuracyPct],
    ['comboMax', s.comboMax],
    ['miss', s.miss],
    ['greenHoldSec', s.greenHoldSec],
    ['stormCycles', s.stormCycles],
    ['stormOk', s.stormOk],
    ['bossNeed', s.bossNeed],
    ['bossHit', s.bossHit],
    ['pwr_shield', s.powerups?.shield ?? 0],
  ];

  const lines = [];
  lines.push('session_key,session_value');
  for(const [k,v] of sessionRows) lines.push(`${k},${String(v).replace(/,/g,' ')}`);

  lines.push('');
  lines.push('event_t,event_type,event_phase,event_kind,event_score,event_water,event_combo,event_source,event_msg');

  for(const ev of (s.logs||[])){
    const row = [
      ev.t||'',
      ev.type||'',
      ev.phase||'',
      ev.kind||'',
      (ev.score ?? ''),
      (ev.water ?? ''),
      (ev.combo ?? ''),
      (ev.source ?? ''),
      (ev.msg ?? ''),
    ].map(x=>String(x).replace(/\n/g,' ').replace(/,/g,' '));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function bindResultButtons(summary){
  const hub = String(qs('hub','../hub.html'));

  DOC.getElementById('btnRetry')?.addEventListener('click', ()=>location.reload());
  DOC.getElementById('btnCloseSummary')?.addEventListener('click', ()=>{
    const back = DOC.getElementById('resultBackdrop');
    if(back) back.hidden = true;
    flushBuffers('close_summary');
  });

  DOC.getElementById('btnCopyJSON')?.addEventListener('click', ()=>safeCopy(JSON.stringify(summary, null, 2)));
  DOC.getElementById('btnDownloadCSV')?.addEventListener('click', ()=>{
    safeDownload(`hydration-${summary.diff}-${summary.runMode}-${summary.ts}.csv`, summaryToCSV(summary), 'text/csv');
  });

  DOC.querySelectorAll('.btnBackHub')?.forEach((b)=>
    b.addEventListener('click', ()=>{
      flushBuffers('back_hub');
      location.href = hub;
    })
  );
}

function showResult(summary){
  safeText('rScore', summary.scoreFinal);
  safeText('rGrade', summary.grade);
  safeText('rAcc', `${summary.accuracyPct}%`);
  safeText('rComboMax', summary.comboMax);
  safeText('rMiss', summary.miss);

  safeText('rGoals', `${Math.round(summary.greenHoldSec)}s GREEN`);
  safeText('rMinis', `${summary.stormOk}/${summary.stormCycles}`);
  safeText('rTier', summary.tier);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk/summary.stormCycles)*100) : 0;

  if(stormRate < 60) tips.push('• เคล็ดลับ: หลุด GREEN แล้ว “หยุดครึ่งจังหวะ” ยิง GOOD 1–2 ครั้งให้กลับก่อน');
  if(summary.miss > 6) tips.push('• เลี่ยง BAD: อย่ายิงรัวตอนเป้าแน่น ใช้ MAGNET/SHIELD แล้วค่อยลุย');
  if(summary.comboMax < 6) tips.push('• ทำคอมโบ: เลือกยิง GOOD ใกล้ศูนย์กลางก่อน จะติดง่ายในมือถือ');
  if((summary.powerups?.shield|0) === 0 && summary.runMode==='play') tips.push('• หา ✨ POWERUP เพื่อกันความผิดพลาดตอน STORM/BOSS');
  if(!tips.length) tips.push('• ฟอร์มดีมาก! ลอง diff=hard หรือ run=research เพื่อเก็บข้อมูล');

  const tipsEl = DOC.getElementById('rTips');
  if(tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if(nextEl) nextEl.textContent = `Next: diff=${summary.diff} | runMode=${summary.runMode} | seed=${summary.seed}`;

  const back = DOC.getElementById('resultBackdrop');
  if(back) back.hidden = false;

  bindResultButtons(summary);
}

// -------------------------
// Start/Stop/End
// -------------------------
function startGame(){
  if(Engine.running) return;

  readCtx();
  Engine.layers = resolveLayers();
  Engine.rng = makeRNG(Engine.seed);

  Engine.score=0;
  Engine.combo=0;
  Engine.comboMax=0;
  Engine.miss=0;

  Engine.waterPct=50;
  Engine.greenHoldMs=0;
  Engine.zone = zoneFromPct(Engine.waterPct);

  Engine.phase='MAIN';
  Engine.stormCycles=0;
  Engine.stormOk=0;

  Engine.targets = new Set();
  Engine.spawnAcc=0;

  Engine.logs=[];
  Engine.evtBuf=[];
  Engine.coachLastMs=0;

  Engine.pwr = { shield:0, slowUntil:0, magnetUntil:0 };

  Engine.ended=false;
  Engine.running=true;
  Engine.started=true;

  try{ Engine._noSpawnRects = getNoSpawnRects(); }catch(_){ Engine._noSpawnRects = []; }

  try{
    const back = DOC.getElementById('resultBackdrop');
    if(back) back.hidden = true;
  }catch(_){}

  setWaterUI(Engine.waterPct);
  setQuestUI();

  try{
    const meta = buildSessionMeta();
    Engine.session = Object.assign(meta, {
      sid: `hydr-${meta.ts}-${Math.random().toString(16).slice(2,8)}`,
      startedAt: nowTs(),
      updatedAt: nowTs()
    });
  }catch(_){
    Engine.session = { sid:`hydr-${nowTs()}` };
  }

  Engine.t0 = nowMs();
  Engine.lastT = Engine.t0;

  logEv('start', { runMode:Engine.runMode, diff:Engine.diff, timePlannedSec:Engine.timePlannedSec, seed:Engine.seed });

  emit('hha:start', {
    game:'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,
    run: Engine.runMode,
    time: Engine.timePlannedSec
  });

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });
  for(const L of Engine.layers){
    L.addEventListener('pointerdown', onLayerPointerDown, { passive:false });
  }

  Engine.rafId = requestAnimationFrame(step);
  coachTip('เริ่มเลย! คุมให้อยู่ GREEN แล้วเตรียมรับ STORM', 0);
}

function stopGame(){
  Engine.running=false;
  try{ cancelAnimationFrame(Engine.rafId); }catch(_){}

  WIN.removeEventListener('hha:shoot', onShoot);
  for(const L of Engine.layers||[]){
    try{ L.removeEventListener('pointerdown', onLayerPointerDown); }catch(_){}
  }

  for(const el of Array.from(Engine.targets)) removeTarget(el);
  Engine.targets.clear();

  flushBuffers('stop');
}

function endGame(){
  if(Engine.ended) return;
  Engine.ended=true;

  stopGame();

  const summary = buildSummary();
  saveSummary(summary);

  logEv('end', { scoreFinal: summary.scoreFinal, grade: summary.grade, miss: summary.miss });
  emit('hha:end', summary);

  flushBuffers('end');

  showResult(summary);
}

// -------------------------
// Input handlers
// -------------------------
function onShoot(e){
  handleShootEvent(e?.detail);
}

function onLayerPointerDown(e){
  if(!Engine.running || Engine.ended) return;
  e.preventDefault();
  handleShootEvent({ x:e.clientX, y:e.clientY, lockPx:28, source:'layer' });
}

// -------------------------
// Auto-boot hardened (PACK 10)
// -------------------------
(function boot(){
  try{
    const back = DOC.getElementById('resultBackdrop');
    if(back) back.hidden = true;
  }catch(_){}

  try{
    if(!DOC.getElementById('hydration-safe-style')){
      const st = DOC.createElement('style');
      st.id='hydration-safe-style';
      st.textContent = `
        .hvr-target{ opacity:1 !important; visibility:visible !important; display:flex !important; }
        [hidden]{ display:none !important; }
      `;
      DOC.head.appendChild(st);
    }
  }catch(_){}

  WIN.addEventListener('hha:start', ()=>startGame(), { passive:true });

  function isOverlayActuallyVisible(el){
    try{
      if(!el) return false;
      if(el.hidden) return false;
      const cs = getComputedStyle(el);
      if(cs.display==='none') return false;
      if(cs.visibility==='hidden') return false;
      if(Number(cs.opacity||'1') <= 0) return false;
      const r = el.getBoundingClientRect();
      if(r.width < 2 || r.height < 2) return false;
      return true;
    }catch(_){
      return true;
    }
  }

  setTimeout(()=>{
    const ov = DOC.getElementById('startOverlay');
    const visible = isOverlayActuallyVisible(ov);
    if(!visible && !Engine.started) startGame();
  }, 260);

  try{
    WIN.HydrationVR = {
      start: startGame,
      stop: stopGame,
      end: endGame,
      flush: ()=>flushBuffers('manual'),
      getState: ()=>JSON.parse(JSON.stringify(getStateForAI()))
    };
  }catch(_){}
})();

export {};