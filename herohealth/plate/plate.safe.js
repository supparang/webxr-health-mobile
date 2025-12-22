// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION SAFE, GoodJunk-style)
// PATCH 1) Hit reliability: raycast manual + parent-walk + mesh stamp on object3dset
// PATCH 2) VR feel: non-black world (sky+ground), spawn cone in front, failsafe spawn
// PATCH 3) Excitement: Danger Rush(10s), Combo Gate(10/20), Mini Boss Plate (every 2 plates)
// + Fix: Cloud Logger is IIFE (window.HHACloudLogger) — no named export import

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const A = ROOT.AFRAME;
if (!A) {
  console.error('[PlateVR] AFRAME not found');
  throw new Error('AFRAME not found');
}
const THREE = A.THREE;

const URLX = new URL(location.href);

// --------- Utilities ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const choice = (arr) => arr[(Math.random() * arr.length) | 0];
const nowMs = () => performance.now();
const nowIso = () => new Date().toISOString();
const uid = (p='id') => `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

// --------- Global modules (optional) ----------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, judge(){}, celebrate(){} };

const CloudLogger = ROOT.HHACloudLogger || null;

// --------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const hud = {
  time: $('#hudTime'),
  score: $('#hudScore'),
  combo: $('#hudCombo'),
  miss: $('#hudMiss'),
  feverBar: $('#hudFever'),
  feverPct: $('#hudFeverPct'),
  grade: $('#hudGrade'),
  mode: $('#hudMode'),
  diff: $('#hudDiff'),
  groupsHave: $('#hudGroupsHave'),
  perfect: $('#hudPerfectCount'),
  paused: $('#hudPaused'),

  goalLine: $('#hudGoalLine'),
  miniLine: $('#hudMiniLine'),
  miniHint: $('#hudMiniHint'),

  btnEnterVR: $('#btnEnterVR'),
  btnPause: $('#btnPause'),
  btnRestart: $('#btnRestart'),

  resultBackdrop: $('#resultBackdrop'),
  btnPlayAgain: $('#btnPlayAgain'),

  rMode: $('#rMode'),
  rGrade: $('#rGrade'),
  rScore: $('#rScore'),
  rMaxCombo: $('#rMaxCombo'),
  rMiss: $('#rMiss'),
  rPerfect: $('#rPerfect'),
  rGoals: $('#rGoals'),
  rMinis: $('#rMinis'),
  rG1: $('#rG1'),
  rG2: $('#rG2'),
  rG3: $('#rG3'),
  rG4: $('#rG4'),
  rG5: $('#rG5'),
  rGTotal: $('#rGTotal'),
};

const scene = document.querySelector('a-scene');
const rig   = document.querySelector('#rig');
const camEl = document.querySelector('#cam');
const worldRoot = document.querySelector('#worldTargets');
const cursorEl  = document.querySelector('#cursor');

// --------- Params / Mode ----------
const diffKey = String(URLX.searchParams.get('diff') || 'normal').toLowerCase();
const modeKey = String(URLX.searchParams.get('mode') || 'play').toLowerCase(); // play | research
const debug   = (URLX.searchParams.get('debug') === '1');

// --------- Difficulty Table ----------
const DIFF_TABLE = {
  easy: {
    spawnMs: 950,
    lifeMs: 1800,
    maxActive: 4,
    scale: 0.95,
    junkRatio: 0.15,
    coneYawDeg: 52,
    conePitchUpDeg: 18,
    conePitchDownDeg: 12,
    dist: 3.05,
    scoreGood: 110,
    scorePerfect: 170,
    scoreJunk: -70,
    feverGood: 8,
    feverPerfect: 12,
    feverJunk: -16,
  },
  normal: {
    spawnMs: 820,
    lifeMs: 1600,
    maxActive: 5,
    scale: 0.85,
    junkRatio: 0.22,
    coneYawDeg: 48,
    conePitchUpDeg: 18,
    conePitchDownDeg: 14,
    dist: 2.95,
    scoreGood: 120,
    scorePerfect: 190,
    scoreJunk: -80,
    feverGood: 9,
    feverPerfect: 13,
    feverJunk: -18,
  },
  hard: {
    spawnMs: 700,
    lifeMs: 1400,
    maxActive: 6,
    scale: 0.78,
    junkRatio: 0.30,
    coneYawDeg: 45,
    conePitchUpDeg: 18,
    conePitchDownDeg: 16,
    dist: 2.80,
    scoreGood: 130,
    scorePerfect: 210,
    scoreJunk: -90,
    feverGood: 10,
    feverPerfect: 14,
    feverJunk: -20,
  }
};

function getBaseDiff(k){
  return DIFF_TABLE[k] || DIFF_TABLE.normal;
}

// --------- Audio (lightweight) ----------
let audioCtx = null;
function beep(freq=880, ms=70, vol=0.05){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(()=>{ try{o.stop();}catch(_){} }, ms);
  }catch(_){}
}

// --------- World setup (PATCH #2) ----------
function ensureWorld(){
  // Sky
  if (!scene.querySelector('#plateSky')) {
    const sky = document.createElement('a-sky');
    sky.setAttribute('id', 'plateSky');
    sky.setAttribute('color', '#050a1a');
    scene.appendChild(sky);
  }
  // Soft ground (avoid "black void")
  if (!scene.querySelector('#plateGround')) {
    const g = document.createElement('a-entity');
    g.setAttribute('id', 'plateGround');
    g.setAttribute('geometry', 'primitive:circle; radius:22; segments:64');
    g.setAttribute('rotation', '-90 0 0');
    g.setAttribute('position', '0 0 0');
    g.setAttribute('material', 'color:#0b1226; shader:flat; opacity:0.98; side:double;');
    scene.appendChild(g);
  }
  // Horizon ring
  if (!scene.querySelector('#plateHorizon')) {
    const h = document.createElement('a-entity');
    h.setAttribute('id', 'plateHorizon');
    h.setAttribute('geometry', 'primitive:torus; radius:9; radiusTubular:0.05; segmentsRadial:18; segmentsTubular:160;');
    h.setAttribute('position', '0 1.2 0');
    h.setAttribute('material', 'color:#18264a; shader:flat; opacity:0.55;');
    scene.appendChild(h);
  }
}

// --------- Game State ----------
const RUN_SECONDS = Number(URLX.searchParams.get('time') || 80);
const RUN_MS = Math.max(25, RUN_SECONDS) * 1000;

const S = {
  runId: uid('plateRun'),
  startAtMs: 0,
  endAtMs: 0,
  lastTickMs: 0,

  paused: false,
  ended: false,

  // scoring
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfectCount: 0,
  fever: 0,

  // plate logic
  plateSet: new Set(),     // collected groups within current plate
  platesCleared: 0,

  // goals/minis
  goals: [],
  goalIndex: 0,
  goalsCleared: 0,
  minisCleared: 0,
  activeMini: null,
  miniStartAt: 0,

  // spawn
  activeTargets: new Map(), // id -> targetObj
  clickableMeshes: [],      // raycast list
  lastSpawnAt: 0,
  lastAnyTargetAt: 0,
  failsafeAt: 0,

  // excitement
  rush: false,
  rushTickAt: 0,
  junkSuppressedUntil: 0,
  lastGateAt: 0,
  bossPending: false,
  bossLiveId: null,
  bossDeadlineAt: 0,

  // input
  lastTapX: 0.5,
  lastTapY: 0.5,

  // diff/adaptive
  diffKey: (diffKey in DIFF_TABLE) ? diffKey : 'normal',
  modeKey,
  curDiff: getBaseDiff((diffKey in DIFF_TABLE) ? diffKey : 'normal'),
  adaptiveFactor: 1.0,
};

// --------- Food groups / Emojis ----------
const GROUPS = [
  { key:'protein', label:'โปรตีน', emoji:'🥩' },
  { key:'carb',    label:'ข้าวแป้ง', emoji:'🍚' },
  { key:'veg',     label:'ผัก', emoji:'🥦' },
  { key:'fruit',   label:'ผลไม้', emoji:'🍎' },
  { key:'fat',     label:'ไขมันดี', emoji:'🥑' },
];

const JUNK = ['🍩','🍟','🥤','🍬','🧁','🍕','🌭'];

function groupProgressText(){
  return `${S.plateSet.size}/5`;
}

function resetPlate(){
  S.plateSet.clear();
  setHUD();
}

function clearPlate(){
  S.platesCleared += 1;
  resetPlate();
  Particles && Particles.celebrate && Particles.celebrate({ type:'plate', text:'🍽️ CLEAR!', power:1 });
  window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'plate', text:'🍽️ CLEAR!' }}));
  // Mini Boss every 2 plates (PATCH #3)
  if (S.platesCleared > 0 && (S.platesCleared % 2 === 0)) {
    S.bossPending = true;
  }
}

// --------- Grade ----------
function calcGrade(){
  // Simple but punchy: score - miss penalty + bonus for perfect + plates
  const base = (S.score | 0) + (S.perfectCount * 30) + (S.platesCleared * 180) - (S.miss * 140);
  if (base >= 4200 && S.miss <= 2) return 'SSS';
  if (base >= 3200 && S.miss <= 4) return 'SS';
  if (base >= 2400) return 'S';
  if (base >= 1600) return 'A';
  if (base >= 900)  return 'B';
  return 'C';
}

// --------- Goals (GoodJunk style: 2 goals per run) ----------
const GOAL_DEFS = [
  {
    id:'g_plate2',
    label:'เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ 🍽️',
    hint:'เก็บให้ครบ 5 หมู่ แล้ววนใหม่',
    eval: ()=> S.platesCleared,
    targetByDiff:{ easy:2, normal:2, hard:3 }
  },
  {
    id:'g_perfect6',
    label:'ทำ PERFECT ให้ได้ 6 ครั้ง 🌟',
    hint:'ยิงให้โดน “กลางเป้า”',
    eval: ()=> S.perfectCount,
    targetByDiff:{ easy:5, normal:6, hard:7 }
  },
  {
    id:'g_combo15',
    label:'ทำ MAX COMBO ให้ถึง 15 🔥',
    hint:'อย่าพลาด/อย่าโดนขยะ',
    eval: ()=> S.comboMax,
    targetByDiff:{ easy:12, normal:15, hard:18 }
  },
  {
    id:'g_miss0',
    label:'ผ่านแบบ “MISS ไม่เกิน 2” 💎',
    hint:'ขยะโดน = MISS',
    eval: ()=> (S.miss|0),
    targetByDiff:{ easy:3, normal:2, hard:1 },
    invert:true // pass when v <= target
  },
  {
    id:'g_boss1',
    label:'เก็บ “จานทอง” ให้ได้ 1 ครั้ง 🥇',
    hint:'บอสต้อง PERFECT ภายใน 3 วิ',
    eval: ()=> (S._bossWin|0),
    targetByDiff:{ easy:1, normal:1, hard:2 }
  }
];

function pickGoals(){
  const pool = GOAL_DEFS.slice();
  // choose 2 without duplicates, prefer variety
  const a = pool.splice((Math.random()*pool.length)|0,1)[0];
  // avoid pick same style (plate+boss) repeatedly? simple:
  const b = pool.splice((Math.random()*pool.length)|0,1)[0];
  return [a,b];
}

function currentGoal(){
  return S.goals[S.goalIndex] || null;
}

function goalTarget(def){
  const t = def.targetByDiff || {};
  return (t[S.diffKey] != null) ? t[S.diffKey] : (t.normal || 1);
}

function checkGoalProgress(){
  const g = currentGoal();
  if (!g) return;
  const v = g.eval();
  const tgt = goalTarget(g);
  const pass = g.invert ? (v <= tgt) : (v >= tgt);
  if (pass) {
    S.goalsCleared += 1;
    S.goalIndex += 1;
    Particles && Particles.celebrate && Particles.celebrate({ type:'goal', text:'🎯 GOAL CLEAR!', power:1.1 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'goal', text:'🎯 GOAL CLEAR!' }}));
    beep(988, 80, 0.07);
  }
}

// --------- Minis (rotate / timed) ----------
const MINI_DEFS = [
  {
    id:'m_plateRush',
    label:'Plate Rush (8s)',
    hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ ✅',
    durMs: 8000,
    start: ()=> { S._miniPlateStartClears = S.platesCleared; S._miniNoJunk = true; },
    onHit: (hitType)=> { if (hitType === 'junk') S._miniNoJunk = false; },
    eval: ()=> {
      const clearedDelta = (S.platesCleared - (S._miniPlateStartClears|0));
      return (clearedDelta >= 1 && S._miniNoJunk);
    }
  },
  {
    id:'m_perfectStreak',
    label:'Perfect Streak',
    hint:'ทำ PERFECT ติดกัน 5 ครั้ง (พลาดตัดใหม่)!',
    durMs: 11000,
    start: ()=> { S._miniPerfectStreak = 0; },
    onHit: (hitType, isPerfect)=> {
      if (hitType !== 'good') return;
      if (isPerfect) S._miniPerfectStreak = (S._miniPerfectStreak|0) + 1;
      else S._miniPerfectStreak = 0;
    },
    eval: ()=> ((S._miniPerfectStreak|0) >= 5)
  },
  {
    id:'m_goldHunt',
    label:'Gold Hunt (12s)',
    hint:'เก็บ ⭐ Gold ให้ได้ 2 อันภายในเวลา!',
    durMs: 12000,
    start: ()=> { S._miniGold = 0; },
    onHit: (hitType, isPerfect, meta)=> {
      if (meta && meta.isGold) S._miniGold = (S._miniGold|0) + 1;
    },
    eval: ()=> ((S._miniGold|0) >= 2)
  },
];

function startMini(def){
  S.activeMini = def;
  S.miniStartAt = nowMs();
  try{ def.start && def.start(); }catch(_){}
}

function maybeAdvanceMini(){
  const m = S.activeMini;
  if (!m) return;
  const elapsed = nowMs() - S.miniStartAt;
  const passed = !!(m.eval && m.eval());
  const timeUp = elapsed >= (m.durMs|0);

  if (passed) {
    S.minisCleared += 1;
    Particles && Particles.celebrate && Particles.celebrate({ type:'mini', text:'🧩 MINI CLEAR!', power:1.0 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'mini', text:'🧩 MINI CLEAR!' }}));
    beep(1175, 70, 0.07);
    // next mini
    startMini(choice(MINI_DEFS));
    return;
  }

  if (timeUp) {
    // fail -> rotate new mini (keep it fun)
    beep(330, 60, 0.04);
    startMini(choice(MINI_DEFS));
  }
}

// --------- Adaptive (Play mode only) ----------
function updateAdaptive(){
  if (S.modeKey === 'research') {
    S.adaptiveFactor = 1.0;
    S.curDiff = getBaseDiff(S.diffKey);
    return;
  }
  // simple adaptive: based on combo & miss & plates
  const perf = (S.comboMax * 0.12) + (S.platesCleared * 0.8) - (S.miss * 0.9);
  const f = clamp(1.0 + perf * 0.03, 0.85, 1.25);
  S.adaptiveFactor = f;

  const base = getBaseDiff(S.diffKey);
  S.curDiff = {
    ...base,
    spawnMs: clamp(base.spawnMs / f, 520, 1150),
    lifeMs:  clamp(base.lifeMs / f, 900, 2200),
    maxActive: clamp(Math.round(base.maxActive * f), 3, 7),
    scale: clamp(base.scale / f, 0.62, 1.05),
    junkRatio: clamp(base.junkRatio * f, 0.10, 0.45),
    dist: clamp(base.dist, 2.6, 3.2),
  };
}

// --------- Spawn cone (PATCH #2) ----------
function getSpawnDirection(){
  const d = S.curDiff;
  const camObj = camEl.object3D;
  const camQuat = camObj.getWorldQuaternion(new THREE.Quaternion());

  const yaw = THREE.MathUtils.degToRad(rand(-d.coneYawDeg, d.coneYawDeg));
  const pitch = THREE.MathUtils.degToRad(rand(-d.conePitchDownDeg, d.conePitchUpDeg));

  // local forward
  const v = new THREE.Vector3(0, 0, -1);
  const e = new THREE.Euler(pitch, yaw, 0, 'YXZ');
  v.applyEuler(e);
  v.applyQuaternion(camQuat);
  v.normalize();
  return v;
}

function getSpawnPosition(){
  const d = S.curDiff;
  const camObj = camEl.object3D;
  const camPos = camObj.getWorldPosition(new THREE.Vector3());
  const dir = getSpawnDirection();
  const dist = clamp(d.dist + rand(-0.10, 0.12), 2.6, 3.25);

  const p = camPos.clone().add(dir.multiplyScalar(dist));
  // clamp height to feel reachable
  p.y = clamp(p.y, 1.05, 2.35);
  return p;
}

function shouldSpawnJunk(){
  const d = S.curDiff;
  // Combo Gate reward: suppress junk for a short window
  if (nowMs() < S.junkSuppressedUntil) return false;
  return Math.random() < d.junkRatio;
}

function shouldSpawnGold(){
  // small chance gold, plus mini gold hunt will count
  const tLeft = timeLeftMs();
  if (tLeft < 12000) return Math.random() < 0.12;
  return Math.random() < 0.06;
}

// --------- Target creation (PATCH #1) ----------
function stampClickable(ent){
  // ensure all meshes under this entity carry pointer to the entity (for parent-walk)
  try{
    ent.object3D.traverse((o)=>{
      if (o && o.isMesh) o.userData._plateEntity = ent;
    });
  }catch(_){}
}

function ensureHitPlane(ent, size=1.0){
  // Add an invisible plane behind text so raycast always hits something
  // (msdf text sometimes fails on mobile)
  const hit = document.createElement('a-plane');
  hit.setAttribute('class','plateTarget');
  hit.setAttribute('width', String(0.62 * size));
  hit.setAttribute('height', String(0.62 * size));
  hit.setAttribute('material','color:#ffffff; opacity:0.001; transparent:true; shader:flat;');
  hit.setAttribute('position','0 0 0.002');
  ent.appendChild(hit);
  return hit;
}

function makeTarget(opts={}){
  const d = S.curDiff;
  const id = uid('t');
  const type = opts.type || 'good'; // good|junk|boss
  const isGold = !!opts.isGold;
  const isBoss = (type === 'boss');

  const group = opts.group || null;

  const ent = document.createElement('a-entity');
  ent.setAttribute('id', id);
  ent.setAttribute('position', opts.position || getSpawnPosition());
  ent.setAttribute('rotation', '0 0 0');

  // base scale
  const sc = clamp(d.scale * (isBoss ? 1.08 : 1.0) * (isGold ? 1.02 : 1.0), 0.62, 1.05);
  ent.setAttribute('scale', `${sc} ${sc} ${sc}`);

  // create ring plate
  const ring = document.createElement('a-ring');
  ring.setAttribute('radius-inner','0.20');
  ring.setAttribute('radius-outer','0.30');
  ring.setAttribute('material', `shader:flat; color:${isBoss ? '#facc15' : (type==='junk' ? '#fb7185' : '#22c55e')}; opacity:0.95;`);
  ring.setAttribute('position','0 0 0');
  ent.appendChild(ring);

  // emoji text
  const txt = document.createElement('a-text');
  txt.setAttribute('value', opts.emoji || '🍽️');
  txt.setAttribute('align','center');
  txt.setAttribute('baseline','center');
  txt.setAttribute('width','2.4');
  txt.setAttribute('color','#ffffff');
  txt.setAttribute('position','0 0 0.01');
  ent.appendChild(txt);

  // reliable hit plane (PATCH #1)
  ensureHitPlane(ent, sc);

  // mark class for cursor raycaster too
  ent.classList.add('plateTargetWrap');

  // appear animation (pop)
  ent.setAttribute('animation__in', 'property:scale; dur:110; easing:easeOutBack; from:0.001 0.001 0.001; to:'+`${sc} ${sc} ${sc}`);

  // face camera (billboard)
  ent.setAttribute('look-at', '#cam');

  // attach and stamp on ready
  worldRoot.appendChild(ent);

  // stamp meshes after object3dset (PATCH #1)
  const stampOnce = () => {
    stampClickable(ent);
    // also register clickable meshes list (manual raycast)
    ent.object3D.traverse((o)=>{
      if (o && o.isMesh) {
        if (!S.clickableMeshes.includes(o)) S.clickableMeshes.push(o);
      }
    });
  };
  ent.addEventListener('object3dset', stampOnce, { once:true });
  // fallback stamp (some builds)
  setTimeout(stampOnce, 120);

  const life = (opts.lifeMs != null) ? opts.lifeMs : d.lifeMs;
  const born = nowMs();
  const dieAt = born + life;

  const obj = {
    id, ent,
    type,
    groupKey: group ? group.key : null,
    isGold,
    isBoss,
    born,
    dieAt,
    size: sc,
  };

  S.activeTargets.set(id, obj);
  S.lastAnyTargetAt = nowMs();

  return obj;
}

function removeTarget(id){
  const t = S.activeTargets.get(id);
  if (!t) return;
  try{
    // remove meshes from raycast list
    t.ent.object3D.traverse((o)=>{
      const idx = S.clickableMeshes.indexOf(o);
      if (idx >= 0) S.clickableMeshes.splice(idx, 1);
    });
  }catch(_){}
  try{ t.ent.parentNode && t.ent.parentNode.removeChild(t.ent); }catch(_){}
  S.activeTargets.delete(id);
  if (S.bossLiveId === id) {
    S.bossLiveId = null;
  }
}

function spawnOneGuaranteed(){
  // guaranteed good group not yet collected
  const remaining = GROUPS.filter(g => !S.plateSet.has(g.key));
  const g = remaining.length ? choice(remaining) : choice(GROUPS);
  return makeTarget({ type:'good', group:g, emoji:g.emoji, isGold:false, position:getSpawnPosition() });
}

// --------- Spawn loop ----------
function spawnTick(){
  const d = S.curDiff;

  if (S.activeTargets.size >= d.maxActive) return;

  // Mini Boss (PATCH #3): spawn when pending and no boss currently alive
  if (S.bossPending && !S.bossLiveId) {
    S.bossPending = false;
    const boss = makeTarget({
      type:'boss',
      emoji:'🥇',
      isGold:true,
      lifeMs: 3200, // must be fast
      position:getSpawnPosition()
    });
    S.bossLiveId = boss.id;
    S.bossDeadlineAt = nowMs() + 3000;
    S._bossWin = S._bossWin|0;
    Particles && Particles.judge && Particles.judge({ text:'🥇 BOSS!', kind:'boss' });
    beep(1046, 70, 0.06);
    return;
  }

  // Normal spawn
  const junk = shouldSpawnJunk();

  if (junk) {
    makeTarget({ type:'junk', emoji:choice(JUNK) });
    return;
  }

  const g = (() => {
    // prefer remaining groups to help plate completion feel fair
    const remaining = GROUPS.filter(x => !S.plateSet.has(x.key));
    if (remaining.length && Math.random() < 0.72) return choice(remaining);
    return choice(GROUPS);
  })();

  const gold = shouldSpawnGold();
  makeTarget({ type:'good', group:g, emoji: gold ? '⭐' : g.emoji, isGold: gold });
}

// Failsafe (PATCH #2): if nothing appears for a bit, spawn guaranteed
function failsafeTick(){
  const t = nowMs();
  if (S.activeTargets.size > 0) return;
  if ((t - S.lastAnyTargetAt) < 1800) return;
  if (t < S.failsafeAt) return;
  S.failsafeAt = t + 1200;
  spawnOneGuaranteed();
}

// Expire targets -> miss rules
function expireTick(){
  const t = nowMs();
  for (const [id, obj] of S.activeTargets.entries()) {
    if (t >= obj.dieAt) {
      // good expired counts as miss (keeps tension like GoodJunk)
      if (obj.type === 'good' || obj.type === 'boss') {
        S.miss += 1;
        S.combo = 0;
        Particles && Particles.judge && Particles.judge({ text:'MISS', kind:'miss' });
        beep(240, 55, 0.03);
      }
      removeTarget(id);
    }
  }
}

// --------- Hit detection (PATCH #1) ----------
function findEntityFromHitObject(obj){
  // 1) direct stamp
  let cur = obj;
  for (let i=0;i<10;i++){
    if (!cur) break;
    if (cur.userData && cur.userData._plateEntity) return cur.userData._plateEntity;
    cur = cur.parent;
  }
  return null;
}

function computePerfect(intersection, targetObj){
  // prefer local point radius check (works even if UV absent)
  try{
    const ent = targetObj.ent;
    const local = ent.object3D.worldToLocal(intersection.point.clone());
    // our hit plane is roughly 0.62*scale, ring inner ~0.20 outer~0.30
    // treat "perfect" when within a tight center radius
    const r = Math.sqrt(local.x*local.x + local.y*local.y);
    return r <= 0.11; // tight center
  }catch(_){}
  return false;
}

function screenPop(text, kind='good'){
  // use last tap position (normalized), map to screen
  const x = (S.lastTapX || 0.5) * (window.innerWidth || 1);
  const y = (S.lastTapY || 0.5) * (window.innerHeight || 1);
  try{
    Particles && Particles.scorePop && Particles.scorePop({ text, kind, x, y });
    Particles && Particles.burstAt && Particles.burstAt({ x, y, kind });
  }catch(_){}
}

// --------- Scoring / Effects ----------
function applyHit(targetObj, isPerfect, intersection){
  const d = S.curDiff;

  // mini callbacks
  try{
    if (S.activeMini && S.activeMini.onHit) {
      S.activeMini.onHit(targetObj.type === 'junk' ? 'junk' : 'good', isPerfect, { isGold: targetObj.isGold, isBoss: targetObj.isBoss });
    }
  }catch(_){}

  // Boss logic
  if (targetObj.isBoss) {
    if (isPerfect && nowMs() <= S.bossDeadlineAt) {
      S._bossWin = (S._bossWin|0) + 1;
      S.score += 600;
      S.combo += 2;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.fever = clamp(S.fever + 20, 0, 100);
      screenPop('🥇 +600', 'gold');
      Particles && Particles.celebrate && Particles.celebrate({ type:'boss', text:'🥇 BOSS CLEAR!', power:1.2 });
      window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'boss', text:'🥇 BOSS CLEAR!' }}));
      beep(1320, 90, 0.08);
    } else {
      // boss missed (no extra penalty, but breaks combo)
      S.combo = 0;
      Particles && Particles.judge && Particles.judge({ text:'NOPE', kind:'warn' });
      beep(280, 55, 0.03);
    }
    removeTarget(targetObj.id);
    return;
  }

  if (targetObj.type === 'junk') {
    S.score += d.scoreJunk;
    S.miss += 1;
    S.combo = 0;
    S.fever = clamp(S.fever + d.feverJunk, 0, 100);
    screenPop(String(d.scoreJunk), 'bad');
    Particles && Particles.judge && Particles.judge({ text:'MISS', kind:'miss' });
    beep(220, 55, 0.03);
    removeTarget(targetObj.id);
    return;
  }

  // good hit
  const isNewGroup = targetObj.groupKey && !S.plateSet.has(targetObj.groupKey);
  if (targetObj.groupKey && isNewGroup) S.plateSet.add(targetObj.groupKey);

  if (isPerfect) {
    S.score += d.scorePerfect + (targetObj.isGold ? 60 : 0);
    S.perfectCount += 1;
    S.fever = clamp(S.fever + d.feverPerfect, 0, 100);
    S.combo += 1;
    screenPop(`PERFECT +${d.scorePerfect}${targetObj.isGold ? '+60' : ''}`, targetObj.isGold ? 'gold' : 'good');
    Particles && Particles.judge && Particles.judge({ text:'PERFECT', kind:'perfect' });
    beep(988, 45, 0.05);
  } else {
    const add = d.scoreGood + (targetObj.isGold ? 40 : 0);
    S.score += add;
    S.fever = clamp(S.fever + d.feverGood, 0, 100);
    S.combo += 1;
    screenPop(`+${add}`, targetObj.isGold ? 'gold' : 'good');
    Particles && Particles.judge && Particles.judge({ text:'GOOD', kind:'good' });
    beep(740, 35, 0.035);
  }

  S.comboMax = Math.max(S.comboMax, S.combo);

  // clear plate when 5 unique groups collected
  if (S.plateSet.size >= 5) {
    clearPlate();
  }

  // Combo Gate (PATCH #3): at 10,20 -> reward & suppress junk for 3s
  const t = nowMs();
  if ((S.combo === 10 || S.combo === 20) && (t - S.lastGateAt) > 600) {
    S.lastGateAt = t;
    S.junkSuppressedUntil = t + 3000;
    S.score += (S.combo === 10) ? 220 : 420;
    Particles && Particles.celebrate && Particles.celebrate({ type:'gate', text:`🔥 COMBO ${S.combo}!`, power:1.1 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'gate', text:`🔥 COMBO ${S.combo}!` }}));
    screenPop(`COMBO ${S.combo} BONUS`, 'good');
    beep(1200, 65, 0.06);
  }

  removeTarget(targetObj.id);
}

// Manual shoot using THREE.Raycaster (PATCH #1)
const raycaster = new THREE.Raycaster();
const _tmpV = new THREE.Vector3();

function shoot(){
  if (S.paused || S.ended) return;

  const camObj = camEl.object3D;
  const origin = camObj.getWorldPosition(new THREE.Vector3());
  const dir = camObj.getWorldDirection(new THREE.Vector3()); // forward

  raycaster.set(origin, dir);
  raycaster.far = 12;

  const hits = raycaster.intersectObjects(S.clickableMeshes, true);
  if (!hits || !hits.length) {
    // small penalty only if in rush? keep it forgiving
    return;
  }

  const h = hits[0];
  const ent = findEntityFromHitObject(h.object);
  if (!ent) return;

  const id = ent.getAttribute('id');
  const targetObj = S.activeTargets.get(id);
  if (!targetObj) return;

  const isPerfect = computePerfect(h, targetObj);
  applyHit(targetObj, isPerfect, h);

  // evaluate goal/mini after hits
  checkGoalProgress();
  maybeAdvanceMini();

  // quick adaptive update
  updateAdaptive();
}

// --------- Danger Rush (PATCH #3) ----------
function timeLeftMs(){
  if (!S.startAtMs) return RUN_MS;
  return clamp(S.endAtMs - nowMs(), 0, RUN_MS);
}

function rushTick(){
  const tLeft = timeLeftMs();
  const inRush = (tLeft <= 10000 && !S.ended);
  if (inRush && !S.rush) {
    S.rush = true;
    document.body.classList.add('plate-rush');
    Particles && Particles.judge && Particles.judge({ text:'⚠️ RUSH!', kind:'warn' });
    beep(660, 80, 0.05);
  }
  if (!inRush && S.rush) {
    S.rush = false;
    document.body.classList.remove('plate-rush');
  }

  // tick sound near end
  if (inRush) {
    const t = nowMs();
    if (t - S.rushTickAt > 820) {
      S.rushTickAt = t;
      beep(520, 45, 0.03);
    }
  }
}

// Add a subtle rush css effect on the fly (no need to edit HTML)
(function injectRushCSS(){
  const st = document.createElement('style');
  st.textContent = `
  body.plate-rush #hudTop .card,
  body.plate-rush #hudLeft .card{
    box-shadow: 0 0 0 2px rgba(250,204,21,.20), 0 18px 40px rgba(0,0,0,.35);
    animation: plateRushPulse .9s infinite;
  }
  @keyframes plateRushPulse{
    0%{ transform:translateZ(0); filter:brightness(1); }
    50%{ transform:translateZ(0) scale(1.01); filter:brightness(1.06); }
    100%{ transform:translateZ(0); filter:brightness(1); }
  }`;
  document.head.appendChild(st);
})();

// --------- HUD ----------
function setHUD(){
  const tLeft = Math.ceil(timeLeftMs()/1000);
  hud.time && (hud.time.textContent = String(tLeft));
  hud.score && (hud.score.textContent = String(S.score|0));
  hud.combo && (hud.combo.textContent = String(S.combo|0));
  hud.miss && (hud.miss.textContent = String(S.miss|0));
  hud.perfect && (hud.perfect.textContent = String(S.perfectCount|0));

  const feverPct = clamp(Math.round(S.fever), 0, 100);
  hud.feverPct && (hud.feverPct.textContent = `${feverPct}%`);
  hud.feverBar && (hud.feverBar.style.width = `${feverPct}%`);

  const grade = calcGrade();
  hud.grade && (hud.grade.textContent = grade);

  hud.mode && (hud.mode.textContent = (S.modeKey === 'research') ? 'Research' : 'Play');
  hud.diff && (hud.diff.textContent = S.diffKey.charAt(0).toUpperCase() + S.diffKey.slice(1));
  hud.groupsHave && (hud.groupsHave.textContent = groupProgressText());

  hud.paused && (hud.paused.style.display = S.paused ? '' : 'none');

  // Goal line
  const g = currentGoal();
  if (hud.goalLine) {
    if (!g) {
      hud.goalLine.textContent = `All goals cleared ✅`;
    } else {
      const v = g.eval();
      const tgt = goalTarget(g);
      const showV = (g.invert ? `${v}/${tgt} (ต้องไม่เกิน)` : `${v}/${tgt}`);
      hud.goalLine.textContent = `Goal ${Math.min(S.goalIndex+1,2)}/2: ${g.label}  (${showV})`;
    }
  }

  // Mini line
  const m = S.activeMini;
  if (hud.miniLine && hud.miniHint) {
    if (!m) {
      hud.miniLine.textContent = '…';
      hud.miniHint.textContent = '…';
    } else {
      const left = clamp((m.durMs - (nowMs() - S.miniStartAt)) / 1000, 0, 999);
      let prog = '';
      if (m.id === 'm_perfectStreak') prog = `${S._miniPerfectStreak|0}/5`;
      else if (m.id === 'm_goldHunt') prog = `${S._miniGold|0}/2`;
      else if (m.id === 'm_plateRush') prog = `เคลียร์แล้ว ${Math.max(0, S.platesCleared - (S._miniPlateStartClears|0))}/1`;

      hud.miniLine.textContent = `MINI: ${m.label} • ${prog} • ${left.toFixed(1)}s`;
      hud.miniHint.textContent = m.hint || '';
    }
  }
}

// --------- Result modal ----------
function showResult(){
  S.ended = true;
  hud.resultBackdrop && (hud.resultBackdrop.style.display = 'flex');

  const grade = calcGrade();

  hud.rMode && (hud.rMode.textContent = (S.modeKey === 'research') ? 'Research' : 'Play');
  hud.rGrade && (hud.rGrade.textContent = grade);
  hud.rScore && (hud.rScore.textContent = String(S.score|0));
  hud.rMaxCombo && (hud.rMaxCombo.textContent = String(S.comboMax|0));
  hud.rMiss && (hud.rMiss.textContent = String(S.miss|0));
  hud.rPerfect && (hud.rPerfect.textContent = String(S.perfectCount|0));

  hud.rGoals && (hud.rGoals.textContent = `${S.goalsCleared}/2`);
  hud.rMinis && (hud.rMinis.textContent = `${S.minisCleared}/∞`);

  hud.rG1 && (hud.rG1.textContent = String(S.platesCleared|0));
  hud.rG2 && (hud.rG2.textContent = String(S.perfectCount|0));
  hud.rG3 && (hud.rG3.textContent = String(S.comboMax|0));
  hud.rG4 && (hud.rG4.textContent = String(S.miss|0));
  hud.rG5 && (hud.rG5.textContent = String(S._bossWin|0));
  hud.rGTotal && (hud.rGTotal.textContent = String((S.score|0)));

  // log session end
  logSession('end');
}

// --------- Cloud logger events (IIFE) ----------
function getMeta(){
  const meta = {};
  for (const [k,v] of URLX.searchParams.entries()) meta[k] = v;
  // common hub payload keys
  meta.schoolId = meta.schoolId || sessionStorage.getItem('HHA_SCHOOL_ID') || '';
  meta.classId  = meta.classId  || sessionStorage.getItem('HHA_CLASS_ID')  || '';
  meta.studentId= meta.studentId|| sessionStorage.getItem('HHA_STUDENT_ID')|| '';
  meta.sessionId= meta.sessionId|| sessionStorage.getItem('HHA_SESSION_ID')|| '';
  return meta;
}

function logSession(stage='start'){
  const meta = getMeta();
  const payload = {
    stage,
    game: 'PlateVR',
    runId: S.runId,
    timestampIso: nowIso(),
    mode: S.modeKey,
    diff: S.diffKey,
    timeSec: RUN_SECONDS,
    score: S.score|0,
    comboMax: S.comboMax|0,
    miss: S.miss|0,
    perfect: S.perfectCount|0,
    platesCleared: S.platesCleared|0,
    bossWin: (S._bossWin|0),
    grade: calcGrade(),
    meta
  };
  window.dispatchEvent(new CustomEvent('hha:log_session', { detail: payload }));
  if (debug) console.log('[PlateVR] log_session', payload);
}

function logEvent(name, extra={}){
  const meta = getMeta();
  const payload = {
    game: 'PlateVR',
    runId: S.runId,
    timestampIso: nowIso(),
    name,
    score: S.score|0,
    combo: S.combo|0,
    miss: S.miss|0,
    perfect: S.perfectCount|0,
    platesCleared: S.platesCleared|0,
    meta,
    ...extra
  };
  window.dispatchEvent(new CustomEvent('hha:log_event', { detail: payload }));
  if (debug) console.log('[PlateVR] log_event', payload);
}

// --------- Controls ----------
function setPaused(p){
  S.paused = !!p;
  setHUD();
}

function restart(){
  // keep query params
  location.reload();
}

// --------- Main loop ----------
function startRun(){
  ensureWorld();

  // goals/minis init
  S.goals = pickGoals();
  S.goalIndex = 0;
  S.goalsCleared = 0;
  S.minisCleared = 0;
  startMini(choice(MINI_DEFS));

  // base diff
  S.curDiff = getBaseDiff(S.diffKey);
  updateAdaptive();

  // timers
  S.startAtMs = nowMs();
  S.endAtMs = S.startAtMs + RUN_MS;
  S.lastTickMs = nowMs();
  S.lastSpawnAt = 0;
  S.lastAnyTargetAt = nowMs();
  S.failsafeAt = 0;

  // logger auto-init already done in IIFE; we only fire events
  logSession('start');

  // spawn a few initial guaranteed targets so never "black + nothing"
  spawnOneGuaranteed();
  setTimeout(()=>spawnOneGuaranteed(), 280);
  setTimeout(()=>spawnTick(), 520);

  loop();
}

function loop(){
  if (S.ended) return;

  const t = nowMs();
  const dt = t - S.lastTickMs;
  S.lastTickMs = t;

  if (!S.paused) {
    // Rush
    rushTick();

    // spawn interval (faster in rush)
    const d = S.curDiff;
    const spawnMs = (S.rush ? Math.max(420, d.spawnMs * 0.72) : d.spawnMs);

    if ((t - S.lastSpawnAt) >= spawnMs) {
      S.lastSpawnAt = t;
      spawnTick();
    }

    failsafeTick();
    expireTick();
    maybeAdvanceMini();
    checkGoalProgress();

    // end
    if (t >= S.endAtMs) {
      showResult();
    }
  }

  setHUD();
  requestAnimationFrame(loop);
}

// --------- Input bindings (tap anywhere + cursor click) ----------
function bindInputs(){
  // tap-anywhere
  window.addEventListener('pointerdown', (e)=>{
    // store last tap for FX pop
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    S.lastTapX = clamp(e.clientX / w, 0, 1);
    S.lastTapY = clamp(e.clientY / h, 0, 1);

    // ignore UI buttons area? (HUD buttons are pointer-events:auto; but still safe)
    const el = e.target;
    if (el && (el.closest && el.closest('.btn'))) return;

    // unlock audio on first gesture (chrome)
    try{ audioCtx && audioCtx.resume && audioCtx.resume(); }catch(_){}
    shoot();
  }, { passive:true });

  // cursor click (VR fuse / desktop)
  if (cursorEl) {
    cursorEl.addEventListener('click', ()=>{
      // In VR fuse, we don't have clientX/Y; keep center
      S.lastTapX = 0.5; S.lastTapY = 0.45;
      shoot();
    });
  }

  // Buttons
  hud.btnEnterVR && hud.btnEnterVR.addEventListener('click', ()=>{
    try{ scene && scene.enterVR && scene.enterVR(); }catch(_){}
  });

  hud.btnPause && hud.btnPause.addEventListener('click', ()=>{
    setPaused(!S.paused);
    logEvent(S.paused ? 'pause' : 'resume');
  });

  hud.btnRestart && hud.btnRestart.addEventListener('click', ()=>{
    logEvent('restart');
    restart();
  });

  hud.btnPlayAgain && hud.btnPlayAgain.addEventListener('click', ()=>{
    restart();
  });

  // pause on tab hide
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) setPaused(true);
  });
}

// --------- Boot ----------
(function boot(){
  try{
    // if endpoint exists, CloudLogger already auto-init, but keep safe:
    if (CloudLogger && CloudLogger.init) {
      // allow ?log= override already handled in IIFE; no-op safe
      CloudLogger.init({ endpoint: CloudLogger.endpoint || (URLX.searchParams.get('log')||''), debug: debug });
    }
  }catch(_){}

  bindInputs();
  startRun();
})();