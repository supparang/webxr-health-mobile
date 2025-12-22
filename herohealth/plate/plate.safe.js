// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION SAFE, GoodJunk-style)
// PATCH 1) ยิงติดชัวร์: manual raycast + mesh stamp หลายรอบ + invisible hit-plane
// PATCH 2) VR-feel: world ไม่ดำ, spawn cone หน้า cam, failsafe spawn
// PATCH 3) เร้าใจแบบ GoodJunk: Danger Rush(10s) + Combo Gate + Mini Boss Plate + FX แตก/สั่น
// RULE: MISS = โดนขยะเท่านั้น (good/boss หมดเวลาไม่ +miss แต่ตัดคอมโบ/เตือน)

// Fix: Cloud Logger เป็น IIFE (window.HHACloudLogger) — ไม่ import named export

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const A = ROOT.AFRAME;
if (!A) { console.error('[PlateVR] AFRAME not found'); throw new Error('AFRAME not found'); }
const THREE = A.THREE;

const URLX = new URL(location.href);
const diffKey = String(URLX.searchParams.get('diff') || 'normal').toLowerCase();
const modeKey = String(URLX.searchParams.get('mode') || 'play').toLowerCase(); // play | research
const debug   = (URLX.searchParams.get('debug') === '1');

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const choice = (arr)=>arr[(Math.random()*arr.length)|0];
const nowMs = ()=>performance.now();
const nowIso = ()=>new Date().toISOString();
const uid = (p='id')=>`${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

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

// --------- Difficulty ----------
const DIFF_TABLE = {
  easy: {
    spawnMs: 920, lifeMs: 1850, maxActive: 4, scale: 0.92,
    junkRatio: 0.16, coneYawDeg: 52, conePitchUpDeg: 18, conePitchDownDeg: 12, dist: 3.05,
    scoreGood: 110, scorePerfect: 170, scoreJunk: -75,
    feverGood: 8, feverPerfect: 12, feverJunk: -16,
  },
  normal: {
    spawnMs: 800, lifeMs: 1650, maxActive: 5, scale: 0.84,
    junkRatio: 0.24, coneYawDeg: 48, conePitchUpDeg: 18, conePitchDownDeg: 14, dist: 2.95,
    scoreGood: 120, scorePerfect: 190, scoreJunk: -85,
    feverGood: 9, feverPerfect: 13, feverJunk: -18,
  },
  hard: {
    spawnMs: 680, lifeMs: 1450, maxActive: 6, scale: 0.77,
    junkRatio: 0.32, coneYawDeg: 45, conePitchUpDeg: 18, conePitchDownDeg: 16, dist: 2.80,
    scoreGood: 130, scorePerfect: 210, scoreJunk: -95,
    feverGood: 10, feverPerfect: 14, feverJunk: -20,
  }
};
function getBaseDiff(k){ return DIFF_TABLE[k] || DIFF_TABLE.normal; }

// --------- Run config ----------
const RUN_SECONDS = Number(URLX.searchParams.get('time') || 80);
const RUN_MS = Math.max(25, RUN_SECONDS) * 1000;

const S = {
  runId: uid('plateRun'),
  startAtMs: 0,
  endAtMs: 0,
  lastTickMs: 0,

  paused: false,
  ended: false,

  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,
  perfectCount: 0,
  fever: 0,

  plateSet: new Set(),
  platesCleared: 0,

  goals: [],
  goalIndex: 0,
  goalsCleared: 0,
  minisCleared: 0,
  activeMini: null,
  miniStartAt: 0,

  activeTargets: new Map(), // id -> targetObj
  clickableMeshes: [],      // meshes used for raycast
  lastSpawnAt: 0,
  lastAnyTargetAt: 0,
  failsafeAt: 0,

  rush: false,
  rushTickAt: 0,
  junkSuppressedUntil: 0,
  lastGateAt: 0,
  bossPending: false,
  bossLiveId: null,
  bossDeadlineAt: 0,
  _bossWin: 0,

  lastTapX: 0.5,
  lastTapY: 0.5,

  diffKey: (diffKey in DIFF_TABLE) ? diffKey : 'normal',
  modeKey,
  curDiff: getBaseDiff((diffKey in DIFF_TABLE) ? diffKey : 'normal'),
  adaptiveFactor: 1.0,
};

// --------- Groups / Emojis ----------
const GROUPS = [
  { key:'protein', label:'โปรตีน', emoji:'🥩' },
  { key:'carb',    label:'ข้าวแป้ง', emoji:'🍚' },
  { key:'veg',     label:'ผัก', emoji:'🥦' },
  { key:'fruit',   label:'ผลไม้', emoji:'🍎' },
  { key:'fat',     label:'ไขมันดี', emoji:'🥑' },
];
const JUNK = ['🍩','🍟','🥤','🍬','🧁','🍕','🌭'];

function groupProgressText(){ return `${S.plateSet.size}/5`; }
function resetPlate(){ S.plateSet.clear(); setHUD(); }
function clearPlate(){
  S.platesCleared += 1;
  resetPlate();
  Particles?.celebrate?.({ type:'plate', text:'🍽️ CLEAR!', power:1 });
  window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'plate', text:'🍽️ CLEAR!' }}));
  // Mini Boss every 2 plates
  if (S.platesCleared > 0 && (S.platesCleared % 2 === 0)) S.bossPending = true;
}

// --------- Grade ----------
function calcGrade(){
  const base = (S.score|0) + (S.perfectCount*30) + (S.platesCleared*200) - (S.miss*160);
  if (base >= 4200 && S.miss <= 2) return 'SSS';
  if (base >= 3200 && S.miss <= 4) return 'SS';
  if (base >= 2400) return 'S';
  if (base >= 1600) return 'A';
  if (base >= 900)  return 'B';
  return 'C';
}

// --------- Audio ----------
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

// --------- FX Layer (เสริม Particles ให้เหมือน GoodJunk) ----------
let fxLayer = null;
function ensureFXLayer(){
  if (fxLayer) return fxLayer;
  fxLayer = document.createElement('div');
  fxLayer.className = 'plate-fx-layer';
  Object.assign(fxLayer.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'999',
    overflow:'hidden'
  });
  document.body.appendChild(fxLayer);
  return fxLayer;
}
function spawnFragments(emoji='✨', x=0.5, y=0.5, n=8){
  const layer = ensureFXLayer();
  const W = window.innerWidth || 1;
  const H = window.innerHeight || 1;
  const cx = clamp(x,0,1)*W;
  const cy = clamp(y,0,1)*H;

  for (let i=0;i<n;i++){
    const s = document.createElement('div');
    s.textContent = emoji;
    const dx = rand(-120,120);
    const dy = rand(-140, -40);
    const rot = rand(-120,120);
    const sc  = rand(0.8,1.35);
    const dur = rand(420, 720);

    Object.assign(s.style, {
      position:'absolute',
      left: cx+'px',
      top:  cy+'px',
      transform:`translate(-50%,-50%) scale(${sc}) rotate(0deg)`,
      fontSize: (18 + rand(0,10))+'px',
      opacity:'1',
      filter:'drop-shadow(0 10px 18px rgba(0,0,0,.35))',
      willChange:'transform,opacity'
    });

    layer.appendChild(s);

    const t0 = performance.now();
    const tick = (t)=>{
      const p = clamp((t - t0)/dur, 0, 1);
      const ease = 1 - Math.pow(1-p, 3);
      const xx = dx * ease;
      const yy = dy * ease + (p*p*160); // gravity
      const rr = rot * ease;
      s.style.transform = `translate(calc(-50% + ${xx}px), calc(-50% + ${yy}px)) scale(${sc}) rotate(${rr}deg)`;
      s.style.opacity = String(1 - p);
      if (p < 1) requestAnimationFrame(tick);
      else s.remove();
    };
    requestAnimationFrame(tick);
  }
}

function screenShake(power=1.0, ms=160){
  const p = clamp(power, 0.5, 2.2);
  document.body.classList.add('plate-shake');
  document.body.style.setProperty('--plateShake', String(p));
  setTimeout(()=>document.body.classList.remove('plate-shake'), ms);
}

(function injectCSS(){
  const st = document.createElement('style');
  st.textContent = `
  body.plate-shake{
    animation: plateShake .16s linear;
  }
  @keyframes plateShake{
    0%{ transform:translate(0,0); }
    20%{ transform:translate(calc(-2px*var(--plateShake)), calc(1px*var(--plateShake))); }
    40%{ transform:translate(calc(2px*var(--plateShake)), calc(-1px*var(--plateShake))); }
    60%{ transform:translate(calc(-1px*var(--plateShake)), calc(-2px*var(--plateShake))); }
    80%{ transform:translate(calc(1px*var(--plateShake)), calc(2px*var(--plateShake))); }
    100%{ transform:translate(0,0); }
  }
  body.plate-rush #hudTop .card,
  body.plate-rush #hudLeft .card{
    box-shadow: 0 0 0 2px rgba(250,204,21,.20), 0 18px 40px rgba(0,0,0,.35);
    animation: plateRushPulse .9s infinite;
  }
  @keyframes plateRushPulse{
    0%{ filter:brightness(1); }
    50%{ filter:brightness(1.06); }
    100%{ filter:brightness(1); }
  }`;
  document.head.appendChild(st);
})();

// --------- World setup ----------
function ensureWorld(){
  if (!scene.querySelector('#plateSky')) {
    const sky = document.createElement('a-sky');
    sky.id = 'plateSky';
    sky.setAttribute('color', '#050a1a');
    scene.appendChild(sky);
  }
  if (!scene.querySelector('#plateGround')) {
    const g = document.createElement('a-entity');
    g.id = 'plateGround';
    g.setAttribute('geometry', 'primitive:circle; radius:22; segments:64');
    g.setAttribute('rotation', '-90 0 0');
    g.setAttribute('position', '0 0 0');
    g.setAttribute('material', 'color:#0b1226; shader:flat; opacity:0.98; side:double;');
    scene.appendChild(g);
  }
  if (!scene.querySelector('#plateHorizon')) {
    const h = document.createElement('a-entity');
    h.id = 'plateHorizon';
    h.setAttribute('geometry', 'primitive:torus; radius:9; radiusTubular:0.05; segmentsRadial:18; segmentsTubular:160;');
    h.setAttribute('position', '0 1.2 0');
    h.setAttribute('material', 'color:#18264a; shader:flat; opacity:0.55;');
    scene.appendChild(h);
  }
}

// --------- Goals (2 per run) ----------
const GOAL_DEFS = [
  { id:'g_plate2', label:'เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ 🍽️', hint:'เก็บให้ครบ 5 หมู่ แล้ววนใหม่',
    eval: ()=>S.platesCleared, targetByDiff:{easy:2, normal:2, hard:3} },
  { id:'g_perfect6', label:'ทำ PERFECT ให้ได้ 6 ครั้ง 🌟', hint:'ยิงให้โดน “กลางเป้า”',
    eval: ()=>S.perfectCount, targetByDiff:{easy:5, normal:6, hard:7} },
  { id:'g_combo15', label:'ทำ MAX COMBO ให้ถึง 15 🔥', hint:'อย่าพลาด/อย่าโดนขยะ',
    eval: ()=>S.comboMax, targetByDiff:{easy:12, normal:15, hard:18} },
  { id:'g_miss2', label:'ผ่านแบบ “MISS ไม่เกิน 2” 💎', hint:'MISS = โดนขยะเท่านั้น',
    eval: ()=> (S.miss|0), targetByDiff:{easy:3, normal:2, hard:1}, invert:true },
  { id:'g_boss1', label:'เก็บ “จานทอง” ให้ได้ 1 ครั้ง 🥇', hint:'บอสต้อง PERFECT ภายใน 3 วิ',
    eval: ()=> (S._bossWin|0), targetByDiff:{easy:1, normal:1, hard:2} }
];
function pickGoals(){
  const pool = GOAL_DEFS.slice();
  const a = pool.splice((Math.random()*pool.length)|0,1)[0];
  const b = pool.splice((Math.random()*pool.length)|0,1)[0];
  return [a,b];
}
function currentGoal(){ return S.goals[S.goalIndex] || null; }
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
    Particles?.celebrate?.({ type:'goal', text:'🎯 GOAL CLEAR!', power:1.1 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'goal', text:'🎯 GOAL CLEAR!' }}));
    spawnFragments('🎯', S.lastTapX, S.lastTapY, 10);
    screenShake(1.2, 170);
    beep(988, 80, 0.07);
  }
}

// --------- Minis ----------
const MINI_DEFS = [
  {
    id:'m_plateRush',
    label:'Plate Rush (8s)',
    hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ ✅',
    durMs: 8000,
    start: ()=>{ S._miniPlateStartClears = S.platesCleared; S._miniNoJunk = true; },
    onHit: (hitType)=>{ if (hitType === 'junk') S._miniNoJunk = false; },
    eval: ()=>{
      const clearedDelta = (S.platesCleared - (S._miniPlateStartClears|0));
      return (clearedDelta >= 1 && S._miniNoJunk);
    }
  },
  {
    id:'m_perfectStreak',
    label:'Perfect Streak',
    hint:'ทำ PERFECT ติดกัน 5 ครั้ง (พลาดตัดใหม่)!',
    durMs: 11000,
    start: ()=>{ S._miniPerfectStreak = 0; },
    onHit: (hitType, isPerfect)=>{
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
    start: ()=>{ S._miniGold = 0; },
    onHit: (_hitType, _isPerfect, meta)=>{
      if (meta?.isGold) S._miniGold = (S._miniGold|0) + 1;
    },
    eval: ()=> ((S._miniGold|0) >= 2)
  },
];
function startMini(def){
  S.activeMini = def;
  S.miniStartAt = nowMs();
  try{ def.start?.(); }catch(_){}
}
function maybeAdvanceMini(){
  const m = S.activeMini;
  if (!m) return;
  const elapsed = nowMs() - S.miniStartAt;
  const passed = !!(m.eval?.());
  const timeUp = elapsed >= (m.durMs|0);

  if (passed) {
    S.minisCleared += 1;
    Particles?.celebrate?.({ type:'mini', text:'🧩 MINI CLEAR!', power:1.0 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'mini', text:'🧩 MINI CLEAR!' }}));
    spawnFragments('🧩', S.lastTapX, S.lastTapY, 10);
    screenShake(1.1, 160);
    beep(1175, 70, 0.07);
    startMini(choice(MINI_DEFS));
    return;
  }

  if (timeUp) {
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
  const perf = (S.comboMax*0.12) + (S.platesCleared*0.8) - (S.miss*0.9);
  const f = clamp(1.0 + perf*0.03, 0.85, 1.25);
  S.adaptiveFactor = f;

  const base = getBaseDiff(S.diffKey);
  S.curDiff = {
    ...base,
    spawnMs: clamp(base.spawnMs / f, 520, 1150),
    lifeMs:  clamp(base.lifeMs / f, 950, 2200),
    maxActive: clamp(Math.round(base.maxActive * f), 3, 7),
    scale: clamp(base.scale / f, 0.62, 1.02),
    junkRatio: clamp(base.junkRatio * f, 0.10, 0.45),
    dist: clamp(base.dist, 2.6, 3.2),
  };
}

// --------- Spawn cone ----------
function getSpawnDirection(){
  const d = S.curDiff;
  const camObj = camEl.object3D;
  const camQuat = camObj.getWorldQuaternion(new THREE.Quaternion());

  const yaw = THREE.MathUtils.degToRad(rand(-d.coneYawDeg, d.coneYawDeg));
  const pitch = THREE.MathUtils.degToRad(rand(-d.conePitchDownDeg, d.conePitchUpDeg));

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
  p.y = clamp(p.y, 1.05, 2.35);
  return p;
}
function shouldSpawnJunk(){
  if (nowMs() < S.junkSuppressedUntil) return false;
  return Math.random() < S.curDiff.junkRatio;
}
function shouldSpawnGold(){
  const tLeft = timeLeftMs();
  if (tLeft < 12000) return Math.random() < 0.12;
  return Math.random() < 0.06;
}

// --------- Target creation (ยิงติดชัวร์) ----------
function stampClickable(ent){
  try{
    ent.object3D.traverse((o)=>{
      if (o?.isMesh) o.userData._plateEntity = ent;
    });
  }catch(_){}
}

function ensureHitPlane(ent, size=1.0){
  const hit = document.createElement('a-plane');
  hit.setAttribute('class','plateTarget');
  hit.setAttribute('width', String(0.62 * size));
  hit.setAttribute('height', String(0.62 * size));
  hit.setAttribute('material','color:#ffffff; opacity:0.001; transparent:true; shader:flat; side:double;');
  hit.setAttribute('position','0 0 0.002');
  ent.appendChild(hit);
  return hit;
}

function registerMeshes(ent){
  try{
    ent.object3D.traverse((o)=>{
      if (o?.isMesh && !S.clickableMeshes.includes(o)) S.clickableMeshes.push(o);
    });
  }catch(_){}
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

  const sc = clamp(d.scale * (isBoss ? 1.06 : 1.0) * (isGold ? 1.02 : 1.0), 0.62, 1.02);
  ent.setAttribute('scale', `${sc} ${sc} ${sc}`);

  const ring = document.createElement('a-ring');
  ring.setAttribute('radius-inner','0.20');
  ring.setAttribute('radius-outer','0.30');
  ring.setAttribute('material', `shader:flat; color:${isBoss ? '#facc15' : (type==='junk' ? '#fb7185' : '#22c55e')}; opacity:0.95;`);
  ring.setAttribute('position','0 0 0');
  ent.appendChild(ring);

  const txt = document.createElement('a-text');
  txt.setAttribute('value', opts.emoji || '🍽️');
  txt.setAttribute('align','center');
  txt.setAttribute('baseline','center');
  txt.setAttribute('width','2.4');
  txt.setAttribute('color','#ffffff');
  txt.setAttribute('position','0 0 0.01');
  ent.appendChild(txt);

  ensureHitPlane(ent, sc);

  ent.setAttribute('animation__in', 'property:scale; dur:110; easing:easeOutBack; from:0.001 0.001 0.001; to:'+`${sc} ${sc} ${sc}`);
  ent.setAttribute('look-at', '#cam');

  worldRoot.appendChild(ent);

  // stamp + register multiple times (มือถือบางรุ่น object3dset ช้า)
  const stampAll = ()=>{
    stampClickable(ent);
    registerMeshes(ent);
  };
  ent.addEventListener('object3dset', stampAll);
  setTimeout(stampAll, 90);
  setTimeout(stampAll, 240);
  setTimeout(stampAll, 600);

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
    t.ent.object3D.traverse((o)=>{
      const idx = S.clickableMeshes.indexOf(o);
      if (idx >= 0) S.clickableMeshes.splice(idx, 1);
    });
  }catch(_){}
  try{ t.ent.parentNode && t.ent.parentNode.removeChild(t.ent); }catch(_){}
  S.activeTargets.delete(id);
  if (S.bossLiveId === id) S.bossLiveId = null;
}

function spawnOneGuaranteed(){
  const remaining = GROUPS.filter(g => !S.plateSet.has(g.key));
  const g = remaining.length ? choice(remaining) : choice(GROUPS);
  return makeTarget({ type:'good', group:g, emoji:g.emoji, isGold:false, position:getSpawnPosition() });
}

// --------- Spawn loop ----------
function spawnTick(){
  const d = S.curDiff;
  if (S.activeTargets.size >= d.maxActive) return;

  // Boss
  if (S.bossPending && !S.bossLiveId) {
    S.bossPending = false;
    const boss = makeTarget({
      type:'boss', emoji:'🥇', isGold:true,
      lifeMs: 3200, position:getSpawnPosition()
    });
    S.bossLiveId = boss.id;
    S.bossDeadlineAt = nowMs() + 3000;
    Particles?.judge?.({ text:'🥇 BOSS!', kind:'boss' });
    spawnFragments('🥇', 0.5, 0.45, 12);
    screenShake(1.2, 160);
    beep(1046, 70, 0.06);
    return;
  }

  if (shouldSpawnJunk()) {
    makeTarget({ type:'junk', emoji:choice(JUNK) });
    return;
  }

  const g = (() => {
    const remaining = GROUPS.filter(x => !S.plateSet.has(x.key));
    if (remaining.length && Math.random() < 0.72) return choice(remaining);
    return choice(GROUPS);
  })();

  const gold = shouldSpawnGold();
  makeTarget({ type:'good', group:g, emoji: gold ? '⭐' : g.emoji, isGold: gold });
}

function failsafeTick(){
  const t = nowMs();
  if (S.activeTargets.size > 0) return;
  if ((t - S.lastAnyTargetAt) < 1800) return;
  if (t < S.failsafeAt) return;
  S.failsafeAt = t + 1200;
  spawnOneGuaranteed();
}

// RULE: good/boss หมดเวลา ไม่ +miss (แต่ตัดคอมโบ/เตือนให้ยังท้าทาย)
function expireTick(){
  const t = nowMs();
  for (const [id, obj] of S.activeTargets.entries()) {
    if (t >= obj.dieAt) {
      if (obj.type === 'junk') {
        // junk หมดเวลา ไม่ต้องลงโทษ (คนไม่ได้พลาด)
      } else {
        // good/boss หลุดมือ -> ตัดคอมโบ + เตือน (ไม่เพิ่ม miss)
        if (S.combo > 0) S.combo = 0;
        Particles?.judge?.({ text:'TOO SLOW', kind:'warn' });
        beep(260, 50, 0.025);
      }
      removeTarget(id);
    }
  }
}

// --------- Hit detection (manual raycast) ----------
function findEntityFromHitObject(obj){
  let cur = obj;
  for (let i=0;i<12;i++){
    if (!cur) break;
    if (cur.userData?._plateEntity) return cur.userData._plateEntity;
    cur = cur.parent;
  }
  return null;
}
function computePerfect(intersection, targetObj){
  try{
    const ent = targetObj.ent;
    const local = ent.object3D.worldToLocal(intersection.point.clone());
    const r = Math.sqrt(local.x*local.x + local.y*local.y);
    return r <= 0.11;
  }catch(_){}
  return false;
}
function screenPop(text, kind='good', emojiFrag='✨'){
  const x = (S.lastTapX||0.5);
  const y = (S.lastTapY||0.5);
  const px = x * (window.innerWidth||1);
  const py = y * (window.innerHeight||1);
  try{
    Particles?.scorePop?.({ text, kind, x:px, y:py });
    Particles?.burstAt?.({ x:px, y:py, kind });
  }catch(_){}
  spawnFragments(emojiFrag, x, y, kind==='perfect' ? 12 : 8);
}

const raycaster = new THREE.Raycaster();

function timeLeftMs(){
  if (!S.startAtMs) return RUN_MS;
  return clamp(S.endAtMs - nowMs(), 0, RUN_MS);
}

function applyHit(targetObj, isPerfect){
  const d = S.curDiff;

  // mini callbacks
  try{
    S.activeMini?.onHit?.(targetObj.type === 'junk' ? 'junk' : 'good', isPerfect, { isGold: targetObj.isGold, isBoss: targetObj.isBoss });
  }catch(_){}

  // Boss
  if (targetObj.isBoss) {
    if (isPerfect && nowMs() <= S.bossDeadlineAt) {
      S._bossWin = (S._bossWin|0) + 1;
      S.score += 650;
      S.combo += 2;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.fever = clamp(S.fever + 22, 0, 100);
      screenPop('🥇 +650', 'gold', '🥇');
      Particles?.celebrate?.({ type:'boss', text:'🥇 BOSS CLEAR!', power:1.2 });
      window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'boss', text:'🥇 BOSS CLEAR!' }}));
      screenShake(1.6, 180);
      beep(1320, 90, 0.08);
    } else {
      S.combo = 0;
      Particles?.judge?.({ text:'NOPE', kind:'warn' });
      beep(280, 55, 0.03);
    }
    removeTarget(targetObj.id);
    return;
  }

  // Junk hit => MISS + penalty
  if (targetObj.type === 'junk') {
    S.score += d.scoreJunk;
    S.miss += 1;
    S.combo = 0;
    S.fever = clamp(S.fever + d.feverJunk, 0, 100);
    screenPop(String(d.scoreJunk), 'bad', '💥');
    Particles?.judge?.({ text:'MISS', kind:'miss' });
    screenShake(1.4, 160);
    beep(220, 55, 0.03);
    removeTarget(targetObj.id);
    return;
  }

  // Good hit
  const isNewGroup = targetObj.groupKey && !S.plateSet.has(targetObj.groupKey);
  if (targetObj.groupKey && isNewGroup) S.plateSet.add(targetObj.groupKey);

  if (isPerfect) {
    S.score += d.scorePerfect + (targetObj.isGold ? 70 : 0);
    S.perfectCount += 1;
    S.fever = clamp(S.fever + d.feverPerfect, 0, 100);
    S.combo += 1;
    screenPop(`PERFECT +${d.scorePerfect}${targetObj.isGold ? '+70' : ''}`, 'perfect', targetObj.isGold ? '⭐' : '🌟');
    Particles?.judge?.({ text:'PERFECT', kind:'perfect' });
    screenShake(targetObj.isGold ? 1.5 : 1.2, 150);
    beep(988, 45, 0.055);
  } else {
    const add = d.scoreGood + (targetObj.isGold ? 45 : 0);
    S.score += add;
    S.fever = clamp(S.fever + d.feverGood, 0, 100);
    S.combo += 1;
    screenPop(`+${add}`, targetObj.isGold ? 'gold' : 'good', targetObj.isGold ? '⭐' : '✨');
    Particles?.judge?.({ text:'GOOD', kind:'good' });
    beep(740, 35, 0.04);
  }

  S.comboMax = Math.max(S.comboMax, S.combo);

  // Clear plate
  if (S.plateSet.size >= 5) clearPlate();

  // Combo Gate reward
  const t = nowMs();
  if ((S.combo === 10 || S.combo === 20) && (t - S.lastGateAt) > 600) {
    S.lastGateAt = t;
    S.junkSuppressedUntil = t + 3000;
    S.score += (S.combo === 10) ? 260 : 480;
    Particles?.celebrate?.({ type:'gate', text:`🔥 COMBO ${S.combo}!`, power:1.1 });
    window.dispatchEvent(new CustomEvent('hha:celebrate', { detail:{ type:'gate', text:`🔥 COMBO ${S.combo}!` }}));
    screenPop(`COMBO ${S.combo} BONUS`, 'good', '🔥');
    screenShake(1.2, 140);
    beep(1200, 65, 0.065);
  }

  removeTarget(targetObj.id);

  // evaluate after hit
  checkGoalProgress();
  maybeAdvanceMini();
  updateAdaptive();
}

function shoot(){
  if (S.paused || S.ended) return;

  const camObj = camEl.object3D;
  const origin = camObj.getWorldPosition(new THREE.Vector3());
  const dir = camObj.getWorldDirection(new THREE.Vector3());

  raycaster.set(origin, dir);
  raycaster.far = 12;

  const hits = raycaster.intersectObjects(S.clickableMeshes, true);
  if (!hits?.length) return;

  const h = hits[0];
  const ent = findEntityFromHitObject(h.object);
  if (!ent) return;

  const id = ent.getAttribute('id');
  const targetObj = S.activeTargets.get(id);
  if (!targetObj) return;

  const isPerfect = computePerfect(h, targetObj);
  applyHit(targetObj, isPerfect);
}

// --------- Rush (10s) ----------
function rushTick(){
  const tLeft = timeLeftMs();
  const inRush = (tLeft <= 10000 && !S.ended);
  if (inRush && !S.rush) {
    S.rush = true;
    document.body.classList.add('plate-rush');
    Particles?.judge?.({ text:'⚠️ RUSH!', kind:'warn' });
    screenShake(1.0, 120);
    beep(660, 80, 0.05);
  }
  if (!inRush && S.rush) {
    S.rush = false;
    document.body.classList.remove('plate-rush');
  }
  if (inRush) {
    const t = nowMs();
    if (t - S.rushTickAt > 820) {
      S.rushTickAt = t;
      beep(520, 45, 0.03);
    }
  }
}

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

  hud.grade && (hud.grade.textContent = calcGrade());
  hud.mode && (hud.mode.textContent = (S.modeKey === 'research') ? 'Research' : 'Play');
  hud.diff && (hud.diff.textContent = S.diffKey.charAt(0).toUpperCase() + S.diffKey.slice(1));
  hud.groupsHave && (hud.groupsHave.textContent = groupProgressText());
  hud.paused && (hud.paused.style.display = S.paused ? '' : 'none');

  const g = currentGoal();
  if (hud.goalLine) {
    if (!g) hud.goalLine.textContent = `All goals cleared ✅`;
    else {
      const v = g.eval();
      const tgt = goalTarget(g);
      const showV = (g.invert ? `${v}/${tgt} (ต้องไม่เกิน)` : `${v}/${tgt}`);
      hud.goalLine.textContent = `Goal ${Math.min(S.goalIndex+1,2)}/2: ${g.label}  (${showV})`;
    }
  }

  const m = S.activeMini;
  if (hud.miniLine && hud.miniHint) {
    if (!m) { hud.miniLine.textContent = '…'; hud.miniHint.textContent = '…'; }
    else {
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

// --------- Result ----------
function getMeta(){
  const meta = {};
  for (const [k,v] of URLX.searchParams.entries()) meta[k] = v;
  meta.schoolId  = meta.schoolId  || sessionStorage.getItem('HHA_SCHOOL_ID')  || '';
  meta.classId   = meta.classId   || sessionStorage.getItem('HHA_CLASS_ID')   || '';
  meta.studentId = meta.studentId || sessionStorage.getItem('HHA_STUDENT_ID') || '';
  meta.sessionId = meta.sessionId || sessionStorage.getItem('HHA_SESSION_ID') || '';
  return meta;
}

function logSession(stage='start'){
  const meta = getMeta();
  const payload = {
    stage, game:'PlateVR', runId:S.runId, timestampIso:nowIso(),
    mode:S.modeKey, diff:S.diffKey, timeSec:RUN_SECONDS,
    score:S.score|0, comboMax:S.comboMax|0, miss:S.miss|0, perfect:S.perfectCount|0,
    platesCleared:S.platesCleared|0, bossWin:(S._bossWin|0), grade:calcGrade(),
    meta
  };
  window.dispatchEvent(new CustomEvent('hha:log_session', { detail: payload }));
  if (debug) console.log('[PlateVR] log_session', payload);
}

function showResult(){
  S.ended = true;
  hud.resultBackdrop && (hud.resultBackdrop.style.display = 'flex');

  hud.rMode && (hud.rMode.textContent = (S.modeKey === 'research') ? 'Research' : 'Play');
  hud.rGrade && (hud.rGrade.textContent = calcGrade());
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
  hud.rGTotal && (hud.rGTotal.textContent = String(S.score|0));

  logSession('end');
}

// --------- Controls ----------
function setPaused(p){ S.paused = !!p; setHUD(); }
function restart(){ location.reload(); }

// --------- Inputs (PATCH 1: ยิงได้แม้แตะบน HUD ยกเว้นปุ่ม) ----------
function bindInputs(){
  window.addEventListener('pointerdown', (e)=>{
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    S.lastTapX = clamp(e.clientX / w, 0, 1);
    S.lastTapY = clamp(e.clientY / h, 0, 1);

    // “ปุ่ม” เท่านั้นที่ไม่ยิง (การ์ด HUD ยิงได้)
    const el = e.target;
    if (el?.closest?.('.btn')) return;

    try{ audioCtx?.resume?.(); }catch(_){}
    shoot();
  }, { passive:true });

  // cursor click (VR fuse)
  cursorEl?.addEventListener('click', ()=>{
    S.lastTapX = 0.5; S.lastTapY = 0.45;
    shoot();
  });

  hud.btnEnterVR?.addEventListener('click', ()=>{ try{ scene?.enterVR?.(); }catch(_){ } });
  hud.btnPause?.addEventListener('click', ()=>{
    setPaused(!S.paused);
  });
  hud.btnRestart?.addEventListener('click', ()=> restart());
  hud.btnPlayAgain?.addEventListener('click', ()=> restart());

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && !S.ended) setPaused(true);
  });
}

// --------- Main loop ----------
function startRun(){
  ensureWorld();

  S.goals = pickGoals();
  S.goalIndex = 0;
  S.goalsCleared = 0;
  S.minisCleared = 0;
  startMini(choice(MINI_DEFS));

  S.curDiff = getBaseDiff(S.diffKey);
  updateAdaptive();

  S.startAtMs = nowMs();
  S.endAtMs = S.startAtMs + RUN_MS;
  S.lastTickMs = nowMs();
  S.lastSpawnAt = 0;
  S.lastAnyTargetAt = nowMs();
  S.failsafeAt = 0;

  logSession('start');

  // initial guaranteed targets
  spawnOneGuaranteed();
  setTimeout(()=>spawnOneGuaranteed(), 280);
  setTimeout(()=>spawnTick(), 520);

  loop();
}

function loop(){
  if (S.ended) return;

  const t = nowMs();
  S.lastTickMs = t;

  if (!S.paused) {
    rushTick();

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

    if (t >= S.endAtMs) showResult();
  }

  setHUD();
  requestAnimationFrame(loop);
}

// --------- Boot ----------
(function boot(){
  try{
    if (CloudLogger?.init) CloudLogger.init({ endpoint: CloudLogger.endpoint || (URLX.searchParams.get('log')||''), debug });
  }catch(_){}
  bindInputs();
  startRun();
})();