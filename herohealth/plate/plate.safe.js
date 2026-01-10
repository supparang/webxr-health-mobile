// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard)
// ✅ DOM targets via mode-factory (seeded RNG + safezone + true bounds rect)
// ✅ Supports PC click/tap + cVR crosshair shooting via hha:shoot
// ✅ Quest (GOAL + MINI) + combo + judge + coach (rate-limit)
// ✅ Adaptive in play; deterministic in research
// ✅ End summary + emits hha:end {summary}
// ✅ Optional Cloud logger integration (hha-cloud-logger listens hha:end)
// ---------------------------------------------------------------

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

// --------------------- Globals / helpers ---------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,min,max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
function nowMs(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isoNow(){
  try { return new Date().toISOString(); } catch { return String(Date.now()); }
}

// Seeded RNG (mulberry32) for deterministic research
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(str){
  // simple string hash -> uint32
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --------------------- Context (HHA Standard) ---------------------
const CTX = ROOT.HHA_RUN_CONTEXT || {};
const RUN = (qs('run', CTX.run || 'play') || 'play').toLowerCase(); // play | research | study
const DIFF = (qs('diff', CTX.diff || 'normal') || 'normal').toLowerCase();
const TIME_PLANNED = clamp(qs('time', CTX.time || 70), 10, 600);

const SEED_RAW = qs('seed', CTX.seed || '');
const IS_RESEARCH = (RUN === 'research' || RUN === 'study');

const SEED = IS_RESEARCH
  ? (SEED_RAW ? hashSeed(SEED_RAW) : hashSeed(`${Date.now()}`)) // if not provided, still deterministic per run start
  : hashSeed(`${Date.now()}`); // play: unique each time

const RNG = mulberry32(SEED);

// Difficulty presets
const DIFF_PRESET = {
  easy:   { spawnPerSec: 1.1, junkRate: 0.22, bonusRate: 0.08, baseScore: 10, comboDecayMs: 1400 },
  normal: { spawnPerSec: 1.4, junkRate: 0.28, bonusRate: 0.10, baseScore: 12, comboDecayMs: 1200 },
  hard:   { spawnPerSec: 1.8, junkRate: 0.34, bonusRate: 0.12, baseScore: 14, comboDecayMs: 980  }
}[DIFF] || { spawnPerSec: 1.4, junkRate: 0.28, bonusRate: 0.10, baseScore: 12, comboDecayMs: 1200 };

// Adaptive director (play only)
const ADAPTIVE = !IS_RESEARCH;

// --------------------- DOM nodes ---------------------
const elLayer   = DOC.getElementById('plate-layer');
const elHud     = DOC.getElementById('hud');

const uiScore   = DOC.getElementById('uiScore');
const uiCombo   = DOC.getElementById('uiCombo');
const uiTime    = DOC.getElementById('uiTime');

const uiGoalText = DOC.getElementById('uiGoalText');
const uiGoalMeta = DOC.getElementById('uiGoalMeta');
const uiGoalFill = DOC.getElementById('uiGoalFill');

const uiMiniText = DOC.getElementById('uiMiniText');
const uiMiniMeta = DOC.getElementById('uiMiniMeta');
const uiMiniTimer= DOC.getElementById('uiMiniTimer');
const uiMiniFill = DOC.getElementById('uiMiniFill');

const coachCard = DOC.getElementById('coachCard');
const coachMsg  = DOC.getElementById('coachMsg');
const coachDot  = DOC.getElementById('coachDot');

const hitFx = DOC.getElementById('hitFx');

// --------------------- Game state ---------------------
const state = {
  started: false,
  ended: false,

  startTimeIso: '',
  endTimeIso: '',

  durationPlannedSec: TIME_PLANNED,
  durationPlayedSec: 0,
  timeLeftMs: TIME_PLANNED * 1000,

  score: 0,
  combo: 0,
  comboMax: 0,

  misses: 0, // in Plate: "miss" = wrong hits + expired good? (we'll count carefully)
  nSpawnGood: 0,
  nSpawnJunk: 0,
  nHitGood: 0,
  nHitJunk: 0,
  nExpireGood: 0,

  // RT tracking (good hits only)
  rtGood: [],

  goalsCleared: 0,
  goalsTotal: 3,

  miniCleared: 0,
  miniTotal: 4,

  // spawn pacing
  spawnAccumulator: 0,
  spawnPerSec: DIFF_PRESET.spawnPerSec,
  junkRate: DIFF_PRESET.junkRate,
  bonusRate: DIFF_PRESET.bonusRate,

  // combo timeout
  lastHitMs: 0,

  // active mini quest
  mini: null,

  // factory runtime
  factory: null,
};

// --------------------- UI helpers ---------------------
function setText(el, t){ if(el) el.textContent = String(t ?? ''); }

function fmtTime(ms){
  ms = Math.max(0, ms|0);
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2,'0')}`;
}

function uiUpdateAll(){
  setText(uiScore, state.score);
  setText(uiCombo, state.combo);
  setText(uiTime,  fmtTime(state.timeLeftMs));

  // Goal: we treat goal as "complete X balanced plates" (score milestones)
  // We'll map score progress into goal progress to keep it kid-friendly
  const goalTarget = 3; // 3 big goal steps
  const goalCur = clamp(state.goalsCleared, 0, goalTarget);
  setText(uiGoalText, 'จัดจานให้สมดุล (เก็บของดี + เลี่ยงของไม่ดี)');
  setText(uiGoalMeta, `${goalCur}/${goalTarget}`);
  if (uiGoalFill) uiGoalFill.style.width = `${(goalCur/goalTarget)*100}%`;

  // MINI
  if (state.mini){
    setText(uiMiniText, state.mini.text);
    setText(uiMiniMeta, `${state.mini.cur}/${state.mini.target}`);
    const left = Math.max(0, state.mini.deadlineMs - nowMs());
    setText(uiMiniTimer, `${Math.ceil(left/1000)}s`);
    if (uiMiniFill) uiMiniFill.style.width = `${clamp(state.mini.cur/state.mini.target,0,1)*100}%`;
  } else {
    setText(uiMiniText, '—');
    setText(uiMiniMeta, `0/0`);
    setText(uiMiniTimer, `--`);
    if (uiMiniFill) uiMiniFill.style.width = `0%`;
  }
}

let coachLastMs = 0;
function coachSay(msg, mood='good'){
  const t = nowMs();
  if (t - coachLastMs < 650) return; // rate limit
  coachLastMs = t;

  if (!coachCard) return;
  coachCard.setAttribute('aria-hidden','false');
  setText(coachMsg, msg);

  const map = { good:'#22c55e', warn:'#f59e0b', bad:'#ef4444', info:'#22d3ee' };
  if (coachDot) coachDot.style.background = (map[mood] || map.good);

  // auto hide
  clearTimeout(coachSay._tm);
  coachSay._tm = setTimeout(()=>{ coachCard.setAttribute('aria-hidden','true'); }, 1400);

  // emit
  ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg, mood } }));
}

function fxText(x,y,text,cls=''){
  if(!hitFx) return;
  hitFx.textContent = text;
  hitFx.className = `hitfx ${cls}`.trim();
  hitFx.style.left = `${x}px`;
  hitFx.style.top  = `${y}px`;
  hitFx.setAttribute('aria-hidden','false');
  clearTimeout(fxText._tm);
  fxText._tm = setTimeout(()=> hitFx.setAttribute('aria-hidden','true'), 420);
}

// --------------------- Quest logic ---------------------
const MINI_POOL = [
  { id:'veg',   text:'เก็บ “ผัก” ให้ได้ 3 ชิ้น!', target:3, goodTag:'veg' },
  { id:'fruit', text:'เก็บ “ผลไม้” ให้ได้ 3 ชิ้น!', target:3, goodTag:'fruit' },
  { id:'protein',text:'เก็บ “โปรตีน” ให้ได้ 3 ชิ้น!', target:3, goodTag:'protein' },
  { id:'water', text:'เก็บ “น้ำ” ให้ได้ 2 ชิ้น!', target:2, goodTag:'water' },
];

function pickMini(){
  // deterministic order in research
  const idx = Math.floor(RNG() * MINI_POOL.length);
  const base = MINI_POOL[idx];
  return {
    id: base.id,
    text: base.text,
    target: base.target,
    cur: 0,
    goodTag: base.goodTag,
    deadlineMs: nowMs() + 15000, // 15s
    done: false
  };
}

function startMini(){
  state.mini = pickMini();
  coachSay('มินิเควสท์มาแล้ว! ทำให้ทันเวลา!', 'info');
}

function onMiniProgress(tag){
  const m = state.mini;
  if(!m || m.done) return;
  if(tag !== m.goodTag) return;

  m.cur++;
  if(m.cur >= m.target){
    m.done = true;
    state.miniCleared++;
    coachSay('เยี่ยม! ผ่านมินิเควสท์!', 'good');
    ROOT.dispatchEvent(new CustomEvent('quest:update', { detail:{ kind:'mini', done:true, id:m.id } }));
    // next mini shortly if time remains
    setTimeout(()=>{ if(!state.ended) startMini(); }, 1200);
  } else {
    ROOT.dispatchEvent(new CustomEvent('quest:update', { detail:{ kind:'mini', cur:m.cur, target:m.target, id:m.id } }));
  }
}

function tickMini(){
  const m = state.mini;
  if(!m || m.done) return;
  if(nowMs() > m.deadlineMs){
    m.done = true;
    coachSay('เสียดาย! หมดเวลาแล้ว ลองใหม่อันถัดไป!', 'warn');
    ROOT.dispatchEvent(new CustomEvent('quest:update', { detail:{ kind:'mini', fail:true, id:m.id } }));
    setTimeout(()=>{ if(!state.ended) startMini(); }, 800);
  }
}

// Goal: complete 3 “plate steps” by reaching score thresholds (kid-friendly)
const GOAL_THRESH = [120, 260, 420];
function tickGoal(){
  while(state.goalsCleared < state.goalsTotal){
    const need = GOAL_THRESH[state.goalsCleared] ?? Infinity;
    if(state.score >= need){
      state.goalsCleared++;
      coachSay('GOAL สำเร็จ! ไปต่อ!', 'good');
      ROOT.dispatchEvent(new CustomEvent('quest:update', { detail:{ kind:'goal', cur:state.goalsCleared, total:state.goalsTotal } }));
    } else break;
  }
}

// --------------------- Judge / scoring ---------------------
function bumpCombo(){
  const t = nowMs();
  if (t - state.lastHitMs > DIFF_PRESET.comboDecayMs) state.combo = 0;
  state.combo++;
  state.comboMax = Math.max(state.comboMax, state.combo);
  state.lastHitMs = t;
}

function addScore(base, x, y, label='+'){
  const bonus = Math.min(18, Math.floor(state.combo/3));
  const inc = base + bonus;
  state.score += inc;
  fxText(x,y,`${label}${inc}`,'fx-good');
  ROOT.dispatchEvent(new CustomEvent('hha:score', { detail:{ score: state.score, inc } }));
}

function badHit(x,y, why='junk'){
  state.combo = 0;
  state.misses++;
  fxText(x,y,'MISS','fx-bad');
  coachSay(why==='junk' ? 'อุ๊ย! อันนี้ไม่ดีนะ เลี่ยง!' : 'ผิดชิ้น! ตั้งใจอีกนิด', 'bad');
  ROOT.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'bad', why } }));
}

function goodHit(x,y, tag, rtMs){
  bumpCombo();
  state.nHitGood++;
  if (rtMs!=null && isFinite(rtMs)) state.rtGood.push(rtMs|0);
  addScore(DIFF_PRESET.baseScore, x, y, '+');
  ROOT.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind:'good', tag, combo:state.combo } }));
  onMiniProgress(tag);
  tickGoal();
}

function expireGood(){
  // Expired good target counts as miss pressure (like dropped good food)
  state.nExpireGood++;
  state.misses++;
  state.combo = 0;
  coachSay('พลาดแล้ว! รีบเก็บของดีให้ทัน!', 'warn');
}

// --------------------- Target spawning ---------------------
// Plate targets: GOOD categories + JUNK + BONUS (star/diamond etc.)
const GOOD_TAGS = [
  { tag:'veg',     label:'ผัก',     emoji:'🥦' },
  { tag:'fruit',   label:'ผลไม้',   emoji:'🍎' },
  { tag:'protein', label:'โปรตีน', emoji:'🍗' },
  { tag:'carb',    label:'ข้าว-แป้ง',emoji:'🍚' },
  { tag:'water',   label:'น้ำ',     emoji:'💧' },
];

const JUNK_TAGS = [
  { tag:'junk', label:'ขนม',  emoji:'🍟' },
  { tag:'junk', label:'หวาน', emoji:'🍩' },
  { tag:'junk', label:'น้ำอัดลม', emoji:'🥤' },
];

const BONUS_TAGS = [
  { tag:'star', label:'โบนัส', emoji:'⭐', kind:'star' },
  { tag:'diamond', label:'เพชร', emoji:'💎', kind:'diamond' },
];

// Create a DOM target element
function makeTarget(def){
  const el = DOC.createElement('button');
  el.type = 'button';
  el.className = `tgt ${def.kind||def.tag}`;
  el.setAttribute('aria-label', def.label || def.tag);

  el.dataset.kind = def.kind || def.tag;
  el.dataset.tag  = def.tag;
  el.dataset.spawnMs = String(nowMs());

  el.innerHTML = `<span class="emoji">${def.emoji||'🍽️'}</span>`;
  return el;
}

function pickSpawn(){
  const r = RNG();
  if (r < state.junkRate){
    const j = JUNK_TAGS[Math.floor(RNG()*JUNK_TAGS.length)];
    return { ...j, kind:'junk' };
  }
  const rb = RNG();
  if (rb < state.bonusRate){
    const b = BONUS_TAGS[Math.floor(RNG()*BONUS_TAGS.length)];
    return { tag:b.kind, kind:b.kind, label:b.label, emoji:b.emoji };
  }
  const g = GOOD_TAGS[Math.floor(RNG()*GOOD_TAGS.length)];
  return { ...g, kind:'good' };
}

// --------------------- Factory integration ---------------------
function initFactory(){
  if(!elLayer) throw new Error('plate-layer missing');

  // Ensure layer exists in DOM
  elLayer.setAttribute('aria-hidden','false');

  // Compute safezone rects from HUD/quest area so targets won't spawn under HUD
  // mode-factory supports cfg.safeZones (array of DOM elements or rects)
  const safeZones = [];
  if (elHud) safeZones.push(elHud);

  // Boot factory
  state.factory = factoryBoot({
    spawnHost: elLayer,
    boundsHost: elLayer,         // important: uses real bounds rect (edge-fix in mode-factory)
    safeZones,                   // exclude HUD region
    seeded: true,
    seed: SEED,                  // deterministic in research if seed supplied
    rng: RNG,
    spawnStrategy: 'grid9',      // helps prevent "spawn same spot"
    spawnAroundCrosshair: false, // uniform within playRect
    maxLive: 7,
    ttlMs: 1450,                 // targets disappear if not hit
    sizePx: (DIFF==='easy'?112:(DIFF==='hard'?92:102)),
    onSpawn(el, meta){
      // count
      const kind = el.dataset.kind;
      if (kind==='junk') state.nSpawnJunk++;
      else state.nSpawnGood++;

      // attach hit handlers (PC click/tap)
      el.addEventListener('click', (ev)=>{
        ev.preventDefault();
        handleHit(el, ev);
      }, { passive:false });

      // expire callback stored in meta? we use factory onExpire
    },
    onExpire(el){
      // Called when target TTL ends (if mode-factory supports it)
      const kind = el?.dataset?.kind;
      if (kind === 'good'){
        expireGood();
      }
      // remove node just in case
      try{ el.remove(); }catch{}
    }
  });

  // Crosshair shooting (cVR/mobile) — vr-ui emits hha:shoot
  ROOT.addEventListener('hha:shoot', (ev)=>{
    if(state.ended) return;
    const d = ev?.detail || {};
    const x = Number(d.x);
    const y = Number(d.y);
    if(!isFinite(x)||!isFinite(y)) return;
    // Find nearest target to (x,y)
    const hit = findNearestTarget(x,y, Number(d.lockPx)||28);
    if(hit){
      // synthesize hit event
      handleHit(hit.el, { clientX:x, clientY:y, _from:'shoot', preventDefault(){} });
    }
  });
}

function findNearestTarget(x,y, lockPx){
  const nodes = elLayer ? Array.from(elLayer.querySelectorAll('.tgt')) : [];
  let best = null;
  let bestD = Infinity;
  for(const el of nodes){
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < bestD){
      bestD = dist;
      best = { el, dist };
    }
  }
  if(best && best.dist <= lockPx) return best;
  return null;
}

function handleHit(el, ev){
  if(!el || state.ended) return;

  const kind = el.dataset.kind;
  const tag  = el.dataset.tag;
  const spawnMs = Number(el.dataset.spawnMs || 0);
  const rt = spawnMs ? (nowMs() - spawnMs) : null;

  // position for FX
  const x = ev?.clientX ?? (el.getBoundingClientRect().left + el.getBoundingClientRect().width/2);
  const y = ev?.clientY ?? (el.getBoundingClientRect().top  + el.getBoundingClientRect().height/2);

  // remove immediately
  try{ el.remove(); }catch{}

  if (kind === 'junk'){
    state.nHitJunk++;
    badHit(x,y,'junk');
    return;
  }

  if (kind === 'star'){
    bumpCombo();
    state.score += 25;
    fxText(x,y,'+25','fx-perfect');
    coachSay('โบนัส!', 'good');
    return;
  }

  if (kind === 'diamond'){
    bumpCombo();
    state.score += 40;
    fxText(x,y,'+40','fx-perfect');
    coachSay('เพชรโบนัส!', 'good');
    return;
  }

  // good
  goodHit(x,y, tag, rt);
}

// --------------------- Game loop ---------------------
let lastTick = 0;

function tick(t){
  if(!state.started || state.ended) return;

  const dt = (t - lastTick);
  lastTick = t;

  // time
  state.timeLeftMs -= dt;
  state.durationPlayedSec = Math.floor((state.durationPlannedSec*1000 - state.timeLeftMs)/1000);

  // mini timer
  tickMini();

  // spawn pacing
  state.spawnAccumulator += dt/1000;

  // Adaptive: in play only (simple fairness)
  if (ADAPTIVE){
    // if misses rising, relax junkRate slightly; if combo high, ramp spawn a bit
    const missPressure = clamp(state.misses/8, 0, 1);
    const comboBoost = clamp(state.comboMax/15, 0, 1);
    state.junkRate = clamp(DIFF_PRESET.junkRate + (comboBoost*0.04) - (missPressure*0.05), 0.18, 0.42);
    state.spawnPerSec = clamp(DIFF_PRESET.spawnPerSec + (comboBoost*0.25) - (missPressure*0.20), 0.9, 2.2);
  }

  // spawn
  const step = 1 / state.spawnPerSec;
  while(state.spawnAccumulator >= step){
    state.spawnAccumulator -= step;
    spawnOne();
  }

  uiUpdateAll();

  // end by time
  if (state.timeLeftMs <= 0){
    endGame('time');
    return;
  }

  ROOT.requestAnimationFrame(tick);
}

function spawnOne(){
  if(!state.factory || !elLayer) return;

  const def = pickSpawn();
  const el = makeTarget(def);

  // Let factory place it with safezone + bounds
  state.factory.spawn(el, { kind:def.kind, tag:def.tag });
}

// --------------------- Start / End ---------------------
function startGame(){
  if(state.started) return;
  state.started = true;
  state.startTimeIso = isoNow();

  // Initial quest
  state.goalsTotal = 3;
  state.miniTotal  = 4;
  state.goalsCleared = 0;
  state.miniCleared  = 0;
  startMini();

  coachSay(IS_RESEARCH ? 'โหมดวิจัย: เล่นตามปกติได้เลย' : 'เริ่มเลย! จัดจานให้สมดุล!', 'good');

  ROOT.dispatchEvent(new CustomEvent('hha:start', {
    detail:{
      gameId:'plate',
      runMode: RUN,
      diff: DIFF,
      seed: SEED,
      durationPlannedSec: state.durationPlannedSec
    }
  }));

  lastTick = nowMs();
  ROOT.requestAnimationFrame(tick);
}

function median(arr){
  if(!arr || !arr.length) return null;
  const a = Array.from(arr).sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
}
function avg(arr){
  if(!arr || !arr.length) return null;
  const s = arr.reduce((p,c)=>p+(Number(c)||0),0);
  return Math.round(s/arr.length);
}

function endGame(reason='end'){
  if(state.ended) return;
  state.ended = true;
  state.endTimeIso = isoNow();

  // stop spawning / clear remaining targets
  try{
    if(elLayer) elLayer.querySelectorAll('.tgt').forEach(n=>n.remove());
  }catch{}

  const accuracy = (state.nSpawnGood>0) ? (state.nHitGood/state.nSpawnGood*100) : null;
  const junkError = ( (state.nHitGood + state.nHitJunk) > 0 )
    ? (state.nHitJunk/(state.nHitGood+state.nHitJunk)*100)
    : null;

  const summary = {
    timestampIso: state.endTimeIso,
    projectTag: 'herohealth',
    sessionId: qs('sessionId','') || (CTX.sessionId || ''),
    gameMode: 'plate',
    runMode: RUN,
    diff: DIFF,
    durationPlannedSec: state.durationPlannedSec,
    durationPlayedSec: clamp(state.durationPlayedSec,0,state.durationPlannedSec),
    scoreFinal: state.score,
    comboMax: state.comboMax,
    misses: state.misses,
    goalsCleared: state.goalsCleared,
    goalsTotal: state.goalsTotal,
    miniCleared: state.miniCleared,
    miniTotal: state.miniTotal,
    nTargetGoodSpawned: state.nSpawnGood,
    nTargetJunkSpawned: state.nSpawnJunk,
    nHitGood: state.nHitGood,
    nHitJunk: state.nHitJunk,
    nExpireGood: state.nExpireGood,
    accuracyGoodPct: (accuracy==null?null: Number(accuracy.toFixed(2))),
    junkErrorPct: (junkError==null?null: Number(junkError.toFixed(2))),
    avgRtGoodMs: avg(state.rtGood),
    medianRtGoodMs: median(state.rtGood),
    device: qs('view','') || 'auto',
    gameVersion: qs('v','') || 'plate.safe.js@prod',
    reason,
    startTimeIso: state.startTimeIso,
    endTimeIso: state.endTimeIso,

    // pass-through research fields
    studyId: qs('studyId', CTX.studyId||'') || '',
    phase: qs('phase', CTX.phase||'') || '',
    conditionGroup: qs('conditionGroup', CTX.conditionGroup||'') || '',
    sessionOrder: qs('sessionOrder', CTX.sessionOrder||'') || '',
    blockLabel: qs('blockLabel', CTX.blockLabel||'') || ''
  };

  // Emit end (plate-vr.html will show overlay; logger will upload)
  ROOT.dispatchEvent(new CustomEvent('hha:end', { detail:{ summary, reason } }));

  // also emit force_end for flush hardening
  ROOT.dispatchEvent(new CustomEvent('hha:force_end', { detail:{ summary, reason } }));
}

// --------------------- Init ---------------------
function boot(){
  if(!DOC || !elLayer) return;

  // Ensure layer is clickable, HUD doesn't block (CSS should do pointer-events:none for HUD)
  // But as a safety, ensure HUD only if needed.
  try{
    if (elHud) elHud.style.pointerEvents = 'none';
  }catch{}

  initFactory();

  // auto start after short tick so bounds rect is correct (important for spawn distribution)
  setTimeout(()=> startGame(), 60);
}

boot();