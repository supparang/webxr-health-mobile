// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION v10.7 (FULL)
// ✅ FIX: targets "move with view" (world-anchored, not stuck to camera)
// ✅ ADD 1: Real audio SFX + BGM (fallback beep if missing)
// ✅ ADD 2: Beat sync to BGM timeline (on-beat bonus)
// ✅ ADD 3: Target animations pop-in / pop-out
// ✅ Plate Rush: 5 groups in 8s + no junk, with ticking + edge pulse
// ✅ HUD-safe spawn (avoid HUD cards/buttons)
// ✅ Emits: hha:event (many), hha:score (realtime), hha:quest, hha:end (summary)
// Works with your HTML bridge (logger listens hha:event, hha:end)

'use strict';

const URLX = new URL(location.href);
const DIFF = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
const MODE = (URLX.searchParams.get('run') || 'play').toLowerCase() === 'research' ? 'research' : 'play';

let TIME = parseInt(URLX.searchParams.get('time') || '70', 10);
if (!Number.isFinite(TIME) || TIME <= 0) TIME = 70;
TIME = Math.max(20, Math.min(180, TIME));

const PROJECT_TAG = 'HeroHealth-PlateVR';
const VERSION = '10.7';

const BPM = Math.max(60, Math.min(160, parseInt(URLX.searchParams.get('bpm') || '96', 10) || 96));
const BEAT_MS = Math.round(60000 / BPM);
const BEAT_WIN = Math.max(60, Math.min(220, parseInt(URLX.searchParams.get('beatwin') || '140', 10) || 140));
const AUTO_MUSIC = (URLX.searchParams.get('music') || '') === '1';

window.DIFF = DIFF;
window.TIME = TIME;
window.MODE = MODE;

// --------------------- DOM helpers ---------------------
const $ = (id) => document.getElementById(id);
function setText(id, v) { const el = $(id); if (el) el.textContent = String(v); }
function showEl(id, on) { const el = $(id); if (el) el.style.display = on ? '' : 'none'; }
function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function clamp01(v){ v = Number(v)||0; return Math.max(0, Math.min(1, v)); }
function rnd(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function nowIso(){ return new Date().toISOString(); }

// --------------------- A-Frame / THREE refs ---------------------
const scene = document.querySelector('a-scene');
const cam = document.getElementById('cam');
let targetRoot = document.getElementById('targetRoot');

const THREE = window.THREE; // A-Frame provides THREE
if (!scene || !cam || !THREE) {
  console.error('[PlateVR] Missing scene/cam/THREE');
}

// --------------------- FX module fallback ---------------------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, toast(){}, celebrate(){} };

// =======================================================
// ✅ AUDIO (Real files) + fallback beep
// =======================================================
const AUDIO_BASE = './assets/audio/';
const AUDIO_FILES = {
  bgm:        AUDIO_BASE + 'bgm-plate.mp3',
  hitGood:    AUDIO_BASE + 'sfx-hit-good.wav',
  hitPerfect: AUDIO_BASE + 'sfx-hit-perfect.wav',
  hitPower:   AUDIO_BASE + 'sfx-hit-power.wav',
  hitBoss:    AUDIO_BASE + 'sfx-hit-boss.wav',
  bossClear:  AUDIO_BASE + 'sfx-boss-clear.wav',
  miniClear:  AUDIO_BASE + 'sfx-mini-clear.wav',
  miss:       AUDIO_BASE + 'sfx-miss.wav',
  tick:       AUDIO_BASE + 'sfx-tick.wav',
  near:       AUDIO_BASE + 'sfx-near.wav'
};

let __ac = null;
function ac(){
  if (__ac) return __ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  __ac = new Ctx();
  return __ac;
}
function tryResumeAudio(){ try { ac()?.resume?.(); } catch(_){} }

function beep(freq=880, dur=0.06, type='sine', gain=0.08){
  const ctx = ac(); if (!ctx) return;
  try{
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t+dur+0.02);
  }catch(_){}
}

const AudioMgr = (() => {
  const st = {
    enabled: true,
    sfxVol: 0.95,
    bgmVol: 0.55,
    buffers: new Map(),
    htmlSfx: new Map(),
    bgmEl: null,
    bgmOn: false
  };

  async function loadBuffer(key, url){
    const ctx = ac(); if (!ctx) return false;
    try{
      const res = await fetch(url, { cache:'force-cache' });
      if (!res.ok) return false;
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      st.buffers.set(key, buf);
      return true;
    }catch(_){ return false; }
  }
  function ensureHtml(key, url){
    if (st.htmlSfx.has(key)) return st.htmlSfx.get(key);
    const a = new Audio(url);
    a.preload = 'auto';
    a.volume = st.sfxVol;
    st.htmlSfx.set(key, a);
    return a;
  }

  async function preloadSfx(){
    const keys = [
      ['hitGood', AUDIO_FILES.hitGood],
      ['hitPerfect', AUDIO_FILES.hitPerfect],
      ['hitPower', AUDIO_FILES.hitPower],
      ['hitBoss', AUDIO_FILES.hitBoss],
      ['bossClear', AUDIO_FILES.bossClear],
      ['miniClear', AUDIO_FILES.miniClear],
      ['miss', AUDIO_FILES.miss],
      ['tick', AUDIO_FILES.tick],
      ['near', AUDIO_FILES.near]
    ];
    for (const [k,u] of keys){
      if (st.buffers.has(k) || st.htmlSfx.has(k)) continue;
      const ok = await loadBuffer(k, u);
      if (!ok) ensureHtml(k, u);
    }
  }

  function playSfx(key, opts={}){
    if (!st.enabled) return false;
    const vol = clamp((opts.vol ?? 1) * st.sfxVol, 0, 1);
    const rate = clamp(opts.rate ?? 1, 0.5, 1.6);

    const ctx = ac();
    const buf = st.buffers.get(key);
    if (ctx && buf){
      try{
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = vol;
        src.buffer = buf;
        src.playbackRate.value = rate;
        src.connect(g);
        g.connect(ctx.destination);
        src.start();
        return true;
      }catch(_){}
    }
    const base = st.htmlSfx.get(key);
    if (base){
      try{
        const a = base.cloneNode(true);
        a.volume = vol;
        a.playbackRate = rate;
        a.play().catch(()=>{});
        return true;
      }catch(_){}
    }

    // final fallback beep
    if (key === 'miss') beep(220, 0.10, 'sawtooth', 0.10);
    else if (key === 'tick') beep(1200, 0.04, 'square', 0.06);
    else if (key === 'near') beep(980, 0.035, 'triangle', 0.06);
    else beep(1000, 0.05, 'sine', 0.08);
    return false;
  }

  function ensureBgm(){
    if (st.bgmEl) return st.bgmEl;
    const a = new Audio(AUDIO_FILES.bgm);
    a.loop = true;
    a.preload = 'auto';
    a.volume = st.bgmVol;
    a.crossOrigin = 'anonymous';
    a.addEventListener('play', ()=>{ st.bgmOn = true; });
    a.addEventListener('pause', ()=>{ st.bgmOn = false; });
    st.bgmEl = a;
    return a;
  }

  async function startBgm(){
    if (!st.enabled) return false;
    const a = ensureBgm();
    tryResumeAudio();
    try{
      await a.play();
      st.bgmOn = true;
      return true;
    }catch(_){
      st.bgmOn = false;
      return false;
    }
  }
  function stopBgm(){
    const a = st.bgmEl;
    if (!a) return;
    try{ a.pause(); }catch(_){}
    st.bgmOn = false;
  }
  function toggleBgm(){
    if (st.bgmOn){ stopBgm(); return false; }
    startBgm();
    return true;
  }

  // beat time anchored to BGM if playing, else to session clock
  function beatTimeMs(fallbackMs){
    const a = st.bgmEl;
    if (a && st.bgmOn && Number.isFinite(a.currentTime)) return Math.max(0, Math.round(a.currentTime * 1000));
    return fallbackMs;
  }

  return {
    preloadSfx,
    playSfx,
    startBgm, stopBgm, toggleBgm,
    beatTimeMs,
    get bgmOn(){ return st.bgmOn; }
  };
})();

function sfxTick(){ AudioMgr.playSfx('tick', { vol: 0.9 }); }
function sfxMiniClear(){ AudioMgr.playSfx('miniClear', { vol: 0.95 }); }
function sfxBossClear(){ AudioMgr.playSfx('bossClear', { vol: 1.0 }); }
function sfxMiss(){ AudioMgr.playSfx('miss', { vol: 1.0 }); }
function sfxNear(){ AudioMgr.playSfx('near', { vol: 0.75 }); }

// =======================================================
// ✅ HUD exclusion (avoid spawning behind HUD cards/buttons)
// =======================================================
const SAFE = { hudPadPx: 16 };

function getHudExclusionRects(){
  const W = Math.max(1, window.innerWidth || 1);
  const H = Math.max(1, window.innerHeight || 1);
  const pad = SAFE.hudPadPx;

  const sels = [
    '#hudTop .card',
    '#hudBottom .card',
    '#hudLeft .card',
    '#hudRight .btn',
    '#questPanel', '#miniPanel',
    '#resultCard'
  ].join(',');

  const els = Array.from(document.querySelectorAll(sels));
  const rects = [];
  for (const el of els){
    if (!el || !el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (!r || r.width < 30 || r.height < 20) continue;

    rects.push({
      x0: clamp01((r.left - pad) / W),
      x1: clamp01((r.right + pad) / W),
      y0: clamp01((r.top - pad) / H),
      y1: clamp01((r.bottom + pad) / H)
    });
  }
  return rects;
}
function inAnyRect(nx, ny, rects){
  for (const a of rects){
    if (nx >= a.x0 && nx <= a.x1 && ny >= a.y0 && ny <= a.y1) return true;
  }
  return false;
}

// =======================================================
// ✅ World-anchored Target Root (FIX "เป้าไม่เลื่อน")
// - targetRoot follows camera POSITION but does NOT rotate with camera
// - targets spawned in world offsets around camera at spawn time
// =======================================================
let __rootRAF = 0;
const ROOT_FOLLOW_Y = 1; // follow camera y too (keep stable)
function ensureTargetRootWorld(){
  if (!scene || !cam) return false;
  if (!targetRoot) {
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    scene.appendChild(targetRoot);
  }

  // If targetRoot is inside cam (HTML), reparent to scene NOW:
  try{
    if (targetRoot.parentElement !== scene) scene.appendChild(targetRoot);
  }catch(_){}

  // Also ensure object3D parent
  try{
    if (scene.object3D && targetRoot.object3D && targetRoot.object3D.parent !== scene.object3D){
      scene.object3D.add(targetRoot.object3D);
    }
  }catch(_){}

  // lock root rotation to identity so it doesn't rotate with camera
  try{
    targetRoot.setAttribute('rotation', '0 0 0');
    targetRoot.object3D.rotation.set(0,0,0);
  }catch(_){}
  return true;
}
function startRootFollow(){
  if (__rootRAF) return;
  const camPos = new THREE.Vector3();

  const loop = () => {
    __rootRAF = requestAnimationFrame(loop);
    if (!scene || !scene.hasLoaded || !cam || !targetRoot) return;

    // follow camera world position
    try{
      cam.object3D.getWorldPosition(camPos);
      // keep y stable to camera y (or fixed if you prefer)
      targetRoot.object3D.position.set(camPos.x, camPos.y * ROOT_FOLLOW_Y, camPos.z);
      // IMPORTANT: do NOT rotate root with camera
      targetRoot.object3D.rotation.set(0,0,0);
    }catch(_){}
  };
  __rootRAF = requestAnimationFrame(loop);
}
function stopRootFollow(){
  if (__rootRAF) cancelAnimationFrame(__rootRAF);
  __rootRAF = 0;
}

// =======================================================
// ✅ Target animations (pop in / out)
// =======================================================
function applyPopIn(el, targetScale=1.0){
  try{
    el.setAttribute('animation__in_s', `property: scale; dur: 130; easing: easeOutBack; to: ${targetScale} ${targetScale} ${targetScale}; from: 0.01 0.01 0.01`);
    el.setAttribute('animation__in_o', 'property: material.opacity; dur: 130; easing: easeOutQuad; to: 0.98; from: 0.0');
  }catch(_){}
}
function applyPopOut(el){
  try{
    el.setAttribute('animation__out_s', 'property: scale; dur: 120; easing: easeInQuad; to: 0.01 0.01 0.01');
    el.setAttribute('animation__out_o', 'property: material.opacity; dur: 120; easing: easeInQuad; to: 0.0');
  }catch(_){}
}

// =======================================================
// Emoji texture helper (CanvasTexture)
// =======================================================
function makeEmojiTexture(emoji, opts={}){
  const size = opts.size || 256;
  const font = opts.font || '180px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0,0,size,size);

  // glow disc
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.44, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(15,23,42,0.70)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(148,163,184,0.40)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(size/2 - 18, size/2 - 18, size*0.16, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(emoji), size/2, size/2 + 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// =======================================================
// Screen projection for HUD-safe spawn
// =======================================================
function getSceneCamera(){
  return (scene && scene.camera) ? scene.camera : null;
}
function projectWorldToScreen(worldPos){
  try{
    const cam3 = getSceneCamera();
    if (!cam3) return null;
    const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    v.project(cam3);
    if (v.z > 1) return null;
    const sx = (v.x + 1)/2;
    const sy = (1 - (v.y + 1)/2);
    return { x: sx * window.innerWidth, y: sy * window.innerHeight };
  }catch(_){ return null; }
}

// =======================================================
// Difficulty (tuning)
// =======================================================
const DIFF_TABLE = {
  easy:   { spawnInterval: 980, maxActive: 4, scale: 0.92, lifeMs: 2600, junkRate: 0.12, powerRate: 0.11, bossRate: 0.05 },
  normal: { spawnInterval: 820, maxActive: 5, scale: 0.82, lifeMs: 2200, junkRate: 0.18, powerRate: 0.11, bossRate: 0.07 },
  hard:   { spawnInterval: 690, maxActive: 6, scale: 0.74, lifeMs: 1950, junkRate: 0.25, powerRate: 0.12, bossRate: 0.09 }
};
const DCFG0 = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// =======================================================
// Pools
// =======================================================
const POOL = {
  g1: { id:1, label:'หมู่ 1', emojis:['🥚','🥛','🐟','🍗','🫘'] },
  g2: { id:2, label:'หมู่ 2', emojis:['🍚','🍞','🍜','🥔','🌽'] },
  g3: { id:3, label:'หมู่ 3', emojis:['🥦','🥬','🥕','🍅','🥒'] },
  g4: { id:4, label:'หมู่ 4', emojis:['🍎','🍌','🍇','🍊','🍉'] },
  g5: { id:5, label:'หมู่ 5', emojis:['🥑','🫒','🥜','🧈','🍯'] },
  junk:{ id:0, label:'junk', emojis:['🍟','🍔','🍩','🧋','🍭','🥤'] }
};
const GROUP_KEYS = ['g1','g2','g3','g4','g5'];

// power-ups / boss
const POWER = {
  shield: { key:'shield', emoji:'🛡️', label:'SHIELD', durMs: 5200 },
  golden: { key:'golden', emoji:'⭐',  label:'GOLDEN', durMs: 4200 }
};
const BOSS = { emoji:'👿', hp: 3, lifeMs: 2600 };

// =======================================================
// Session / State
// =======================================================
const sessionId = `PLATE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const t0 = performance.now();

let started = false;
let ended = false;
let paused = false;

let tLeft = TIME;
let timerTick = null;
let spawnTimer = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let miss = 0;

let fever = 0;
let feverOn = false;
let feverUntil = 0;

let shieldOn = false;
let shieldUntil = 0;

let goldenOn = false;
let goldenUntil = 0;

let plateHave = {1:false,2:false,3:false,4:false,5:false};
let plateClean = true;            // no junk since plate started
let plateStartMs = 0;
let perfectPlates = 0;
let perfectCount = 0;

let goalsCleared = 0;
let goalsTotal = 2;

let minisCleared = 0;
let miniTotal = 0;

let currentMini = null; // { key, label, hint, target, prog, untilMs }
let miniSeq = 0;

let bossOn = false;
let bossHP = 0;

let beatHits = 0;
let beatTotal = 0;

// targets
let activeTargets = new Map(); // id -> { el, kind, groupId, emoji, spawnPerfMs, expireTO }
let targetSeq = 0;

// anti double hit
const recentHits = new Map();
const HIT_DEDUPE_MS = 240;
function wasRecentlyHit(targetId){
  const now = performance.now();
  for (const [k,t] of recentHits.entries()){
    if (now - t > 1000) recentHits.delete(k);
  }
  const t = recentHits.get(targetId);
  if (t && now - t < HIT_DEDUPE_MS) return true;
  recentHits.set(targetId, now);
  return false;
}

// =======================================================
// Emit helpers (for your logger bridge)
// =======================================================
function emit(type, detail){
  window.dispatchEvent(new CustomEvent(type, { detail }));
}
function emitEvent(payload){
  emit('hha:event', Object.assign({
    projectTag: PROJECT_TAG,
    sessionId,
    mode: 'PlateVR',
    runMode: MODE,
    difficulty: DIFF,
    timeFromStartMs: Math.round(performance.now() - t0),
    timeLeftSec: tLeft,
    totalScore: score,
    combo,
    misses: miss,
    feverState: feverOn ? 'ON' : 'OFF',
    feverValue: Math.round(fever)
  }, payload));
}
function computeGrade(){
  const allGoal = goalsCleared >= goalsTotal;
  if (allGoal && score >= 1400 && maxCombo >= 14 && miss <= 2) return 'SSS';
  if (allGoal && score >= 1000 && maxCombo >= 10 && miss <= 4) return 'SS';
  if (score >= 750) return 'S';
  if (score >= 550) return 'A';
  if (score >= 320) return 'B';
  return 'C';
}
function emitScore(){
  emit('hha:score', {
    projectTag: PROJECT_TAG,
    sessionId,
    mode: 'PlateVR',
    score,
    combo,
    comboMax: maxCombo,
    misses: miss,
    timeLeft: tLeft,
    fever: Math.round(fever),
    feverOn: feverOn ? 1 : 0,
    shieldOn: shieldOn ? 1 : 0,
    goldenOn: goldenOn ? 1 : 0,
    goalsCleared,
    goalsTotal,
    minisCleared,
    miniTotal,
    gradeNow: computeGrade()
  });
}
function emitQuest(){
  emit('quest:update', {
    projectTag: PROJECT_TAG,
    sessionId,
    mode: 'PlateVR',
    goal: { cleared: goalsCleared, total: goalsTotal },
    mini: currentMini ? { key: currentMini.key, prog: currentMini.prog, target: currentMini.target } : null
  });
}

// =======================================================
// HUD updates (direct DOM)
// =======================================================
function setFeverPct(pct){
  const p = clamp(pct, 0, 100);
  const bar = $('hudFever'); if (bar) bar.style.width = `${p}%`;
  setText('hudFeverPct', `${Math.round(p)}%`);
}
function countHave(){
  return Object.values(plateHave).filter(Boolean).length;
}
function hudUpdate(){
  setText('hudTime', tLeft);
  setText('hudScore', score);
  setText('hudCombo', combo);
  setText('hudMiss', miss);
  showEl('hudPaused', paused);

  setFeverPct(fever);

  setText('hudGrade', computeGrade());
  setText('hudMode', MODE === 'research' ? 'Research' : 'Play');
  setText('hudDiff', DIFF[0].toUpperCase() + DIFF.slice(1));
  setText('hudGroupsHave', `${countHave()}/5`);
  setText('hudPerfectCount', perfectPlates);

  setText('hudGoalLine', `ทำ PERFECT PLATE ให้ได้ ${goalsTotal} จาน • ตอนนี้ ${goalsCleared}/${goalsTotal}`);

  if (currentMini){
    setText('hudMiniLine', `${currentMini.label} • ${currentMini.prog}/${currentMini.target}`);
    setText('hudMiniHint', currentMini.hint || '');
  } else {
    setText('hudMiniLine', '…');
    setText('hudMiniHint', '…');
  }
}

// =======================================================
// Edge pulse (Plate Rush near end)
// =======================================================
function ensureEdgeOverlay(){
  let el = document.getElementById('plate-edge');
  if (!el){
    el = document.createElement('div');
    el.id = 'plate-edge';
    Object.assign(el.style, {
      position:'fixed', inset:'0', pointerEvents:'none', zIndex: 99998,
      border:'0px solid rgba(250,204,21,0)',
      boxShadow:'inset 0 0 0 rgba(0,0,0,0)',
      opacity:'0',
      transition:'opacity .14s ease'
    });
    document.body.appendChild(el);
  }
  return el;
}
function setEdgePulse(on){
  const el = ensureEdgeOverlay();
  if (on){
    el.style.opacity = '1';
    el.style.border = '10px solid rgba(250,204,21,0.45)';
    el.style.boxShadow = 'inset 0 0 60px rgba(250,204,21,0.35)';
  } else {
    el.style.opacity = '0';
    el.style.border = '0px solid rgba(250,204,21,0)';
    el.style.boxShadow = 'inset 0 0 0 rgba(0,0,0,0)';
  }
}

// =======================================================
// ✅ Beat sync (BGM timeline)
// =======================================================
function isOnBeat(){
  const fallback = Math.round(performance.now() - t0);
  const t = AudioMgr.beatTimeMs(fallback);
  const d = t % BEAT_MS;
  const dist = Math.min(d, BEAT_MS - d);
  beatTotal += 1;
  if (dist <= BEAT_WIN){ beatHits += 1; return true; }
  return false;
}

// =======================================================
// Spawn position: world offsets around camera-forward at spawn time
// - then root stays non-rotating -> turning view makes targets slide like VR
// =======================================================
function pickSpawnWorldOffset(){
  const cam3 = cam?.object3D;
  if (!cam3) return new THREE.Vector3(0, 0, -2.2);

  const camPos = new THREE.Vector3();
  cam3.getWorldPosition(camPos);

  const hudRects = getHudExclusionRects();
  const maxTry = 60;

  for (let i=0;i<maxTry;i++){
    const yawOff = THREE.MathUtils.degToRad(rnd(-55, 55));     // wider -> more "look around"
    const pitchOff = THREE.MathUtils.degToRad(rnd(-22, 22));  // keep away from extreme top/bottom
    const r = rnd(2.1, 2.7);

    // direction in camera-local, then rotate by camera quaternion (spawn-time)
    const dir = new THREE.Vector3(0, 0, -1);
    const e = new THREE.Euler(pitchOff, yawOff, 0, 'YXZ');
    dir.applyEuler(e);
    dir.applyQuaternion(cam3.quaternion);
    dir.normalize();

    const worldPos = camPos.clone().add(dir.clone().multiplyScalar(r));
    const sp = projectWorldToScreen(worldPos);
    if (!sp) continue;

    const nx = clamp01(sp.x / Math.max(1, window.innerWidth));
    const ny = clamp01(sp.y / Math.max(1, window.innerHeight));

    // keep away from very top/bottom
    if (ny < 0.18 || ny > 0.82) continue;
    if (inAnyRect(nx, ny, hudRects)) continue;

    // local offset from root (= camPos)
    return worldPos.sub(camPos);
  }

  // fallback
  return new THREE.Vector3(rnd(-0.8,0.8), rnd(-0.35,0.35), -2.3);
}

// =======================================================
// Create target entity
// =======================================================
function makeTarget(kind, groupId, emoji, scale, lifeMs){
  if (!scene || !targetRoot) return null;

  const el = document.createElement('a-entity');
  const id = `pt-${++targetSeq}`;
  el.setAttribute('id', id);
  el.setAttribute('class', 'plateTarget');
  el.classList.add('plateTarget');

  el.setAttribute('geometry', 'primitive: plane; width: 0.52; height: 0.52');
  el.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.0; side: double');

  el.dataset.kind = String(kind||'');
  el.dataset.groupId = String(groupId||0);
  el.dataset.emoji = String(emoji||'');
  el.dataset.dead = '0';

  // position: world offset relative to root (root follows cam pos, no rotation)
  const off = pickSpawnWorldOffset();
  el.setAttribute('position', `${off.x.toFixed(3)} ${off.y.toFixed(3)} ${off.z.toFixed(3)}`);

  // on loaded: set texture and pop-in
  el.addEventListener('loaded', () => {
    try{
      el.object3D.scale.set(0.01,0.01,0.01);
      const mesh = el.getObject3D('mesh');
      if (mesh && mesh.material){
        mesh.material.map = makeEmojiTexture(emoji);
        mesh.material.transparent = true;
        mesh.material.opacity = 0.0;
        mesh.material.needsUpdate = true;
      }
      applyPopIn(el, scale);
    }catch(_){}
  });

  // cursor click
  el.addEventListener('click', () => onHit(el, null));

  // mount
  targetRoot.appendChild(el);

  // expire
  const spawnPerfMs = performance.now();
  const expireTO = setTimeout(() => {
    if (ended || paused) return;
    if (!activeTargets.has(id)) return;
    onExpire(el);
  }, lifeMs);

  activeTargets.set(id, { id, el, kind, groupId, emoji, spawnPerfMs, lifeMs, expireTO });

  emitEvent({ type:'spawn', targetId:id, kind, emoji, groupId, lifeMs });
  return el;
}

function removeTarget(el, reason='remove'){
  if (!el) return;
  const id = el.getAttribute('id') || '';
  const rec = activeTargets.get(id);
  if (rec && rec.expireTO) { try{ clearTimeout(rec.expireTO); }catch(_){} }
  activeTargets.delete(id);

  try{ el.dataset.dead = '1'; }catch(_){}
  try{ el.classList.remove('plateTarget'); }catch(_){}

  applyPopOut(el);

  setTimeout(() => {
    try{ el.parentNode && el.parentNode.removeChild(el); }catch(_){}
  }, 140);

  emitEvent({ type:'remove', reason, targetId:id, kind: el.dataset.kind || '' });
}

// =======================================================
// Game logic: spawn selection
// =======================================================
function shouldSpawnBoss(){
  // boss appears sometimes, more in hard
  const p = (DIFF === 'hard') ? 0.10 : (DIFF === 'easy') ? 0.05 : 0.07;
  return !bossOn && Math.random() < p;
}
function spawnOne(){
  if (ended || paused) return;
  if (!targetRoot) return;
  if (activeTargets.size >= DCFG0.maxActive) return;

  // boss
  if (shouldSpawnBoss()){
    bossOn = true;
    bossHP = BOSS.hp + (DIFF === 'hard' ? 1 : 0);
    makeTarget('boss', 0, BOSS.emoji, DCFG0.scale*1.12, BOSS.lifeMs);
    return;
  }

  // power-up
  if (Math.random() < DCFG0.powerRate){
    const p = (Math.random() < 0.55) ? POWER.shield : POWER.golden;
    makeTarget('power', 0, p.emoji, DCFG0.scale*0.92, Math.round(DCFG0.lifeMs*1.15));
    return;
  }

  // junk
  if (Math.random() < DCFG0.junkRate){
    makeTarget('junk', 0, pick(POOL.junk.emojis), DCFG0.scale*0.92, DCFG0.lifeMs);
    return;
  }

  // good (pick a missing group more often)
  const missing = [];
  for (let g=1; g<=5; g++){ if (!plateHave[g]) missing.push(g); }
  const groupId = (missing.length && Math.random() < 0.70) ? pick(missing) : (1 + ((Math.random()*5)|0));
  const key = GROUP_KEYS[groupId-1];
  makeTarget('good', groupId, pick(POOL[key].emojis), DCFG0.scale, DCFG0.lifeMs);
}

// =======================================================
// Perfect plate & mini
// =======================================================
function resetPlateProgress(){
  plateHave = {1:false,2:false,3:false,4:false,5:false};
  plateClean = true;
  plateStartMs = performance.now();
  hudUpdate();
}
function checkPlateComplete(){
  if (countHave() < 5) return;

  const now = performance.now();
  const tookMs = Math.max(0, Math.round(now - plateStartMs));

  const isPerfect = plateClean;
  if (isPerfect){
    perfectPlates += 1;
    goalsCleared = Math.min(goalsTotal, perfectPlates);
    perfectCount += 1;

    // celebration
    AudioMgr.playSfx('hitPerfect', { vol: 1.0 });
    try{ Particles.celebrate?.({ label: 'PERFECT PLATE', heavy:true }); }catch(_){}
    emitEvent({ type:'plate_perfect', tookMs, perfectPlates, goalsCleared });
  } else {
    AudioMgr.playSfx('hitGood', { vol: 0.9 });
    emitEvent({ type:'plate_complete', tookMs });
  }

  // progress for Plate Rush mini
  if (currentMini && currentMini.key === 'plate_rush'){
    currentMini.prog = 5;
    clearMini(true);
  }

  // reset
  resetPlateProgress();
  emitScore();
  emitQuest();
}

function startMiniPlateRush(){
  // 5 groups in 8 sec + no junk hit while active
  const now = performance.now();
  currentMini = {
    key:'plate_rush',
    label:'🌀 Plate Rush!',
    hint:'ครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ',
    target: 5,
    prog: 0,
    untilMs: now + 8000,
    noJunkOk: true,
    ticked: {3:false,2:false,1:false}
  };
  miniTotal = Math.max(miniTotal, ++miniSeq);
  resetPlateProgress(); // make it fair
  emitEvent({ type:'mini_start', miniKey: currentMini.key });
  AudioMgr.playSfx('hitPower', { vol: 0.9, rate: 1.05 });
  hudUpdate();
  emitQuest();
}

function clearMini(success){
  if (!currentMini) return;
  const key = currentMini.key;
  emitEvent({ type:'mini_end', miniKey:key, success: success ? 1 : 0 });

  if (success){
    minisCleared += 1;
    sfxMiniClear();
    try{ Particles.celebrate?.({ label:'MINI CLEAR', heavy:true }); }catch(_){}
  } else {
    // small fail sound
    AudioMgr.playSfx('near', { vol: 0.7, rate: 0.95 });
  }

  setEdgePulse(false);
  currentMini = null;
  hudUpdate();
  emitQuest();
  emitScore();
}

function miniLoop(){
  if (!currentMini) return;

  if (currentMini.key === 'plate_rush'){
    const now = performance.now();
    const leftMs = Math.max(0, currentMini.untilMs - now);
    const leftS = Math.ceil(leftMs / 1000);

    // update progress = groups have
    currentMini.prog = countHave();

    // near end FX + ticking
    if (leftS <= 3 && leftS >= 1){
      setEdgePulse(true);
      if (!currentMini.ticked[leftS]){
        currentMini.ticked[leftS] = true;
        sfxTick();
      }
    }
    if (leftS <= 0){
      // fail if not complete or got junk
      clearMini(false);
      return;
    }
    if (!currentMini.noJunkOk){
      clearMini(false);
      return;
    }
    if (currentMini.prog >= 5){
      clearMini(true);
      return;
    }

    hudUpdate();
    emitQuest();
  }
}

// =======================================================
// Hits / Expires
// =======================================================
function addScore(pts){
  score += pts;
  if (score < 0) score = 0;
}
function bumpFever(delta, sustainMs=0){
  fever = clamp(fever + delta, 0, 100);
  const now = performance.now();
  if (fever >= 100 && !feverOn){
    feverOn = true;
    feverUntil = now + 6000;
    emitEvent({ type:'fever_on' });
    AudioMgr.playSfx('hitPower', { vol: 0.9, rate: 1.2 });
  }
  if (sustainMs > 0) feverUntil = Math.max(feverUntil, now + sustainMs);
}
function updateBuffs(){
  const now = performance.now();
  if (feverOn && now >= feverUntil){
    feverOn = false;
    fever = Math.max(35, fever); // keep some
    emitEvent({ type:'fever_off' });
  }
  if (shieldOn && now >= shieldUntil){
    shieldOn = false;
    emitEvent({ type:'shield_off' });
  }
  if (goldenOn && now >= goldenUntil){
    goldenOn = false;
    emitEvent({ type:'golden_off' });
  }
}

function onExpire(el){
  if (!el) return;
  const id = el.getAttribute('id') || '';
  const kind = el.dataset.kind || '';

  if (kind === 'good'){
    // missed good: small penalty, combo break
    combo = 0;
    miss += 1;
    sfxMiss();
    bumpFever(-18, 0);
    plateClean = false;
    emitEvent({ type:'expire_good', targetId:id });
  } else if (kind === 'boss'){
    // boss escaped -> miss
    bossOn = false;
    bossHP = 0;
    combo = 0;
    miss += 1;
    sfxMiss();
    bumpFever(-20, 0);
    emitEvent({ type:'boss_escape', targetId:id });
  } else {
    emitEvent({ type:'expire', targetId:id, kind });
  }

  removeTarget(el, 'expire');
  emitScore();
  hudUpdate();
}

function onHit(el, hitInfo){
  if (ended || paused) return;
  if (!el) return;
  const id = el.getAttribute('id') || '';
  if (!id) return;

  if (wasRecentlyHit(id)) return;

  const rec = activeTargets.get(id);
  if (!rec) return;

  // lock to avoid double triggers
  try{ el.dataset.dead = '1'; }catch(_){}

  const kind = rec.kind;
  const groupId = Number(rec.groupId)||0;
  const emoji = rec.emoji || '';
  const rtMs = Math.max(0, Math.round(performance.now() - rec.spawnPerfMs));

  // beat bonus (uses BGM timeline if playing)
  const onBeat = isOnBeat();

  let pts = 0;
  let judgment = '';

  if (kind === 'junk'){
    if (shieldOn){
      // blocked
      pts = 0;
      judgment = 'BLOCK';
      AudioMgr.playSfx('hitPower', { vol: 0.85, rate: 1.1 });
      emitEvent({ type:'hit', targetId:id, kind, emoji, rtMs, judgment, blocked:1 });
    } else {
      miss += 1;
      combo = 0;
      plateClean = false;

      pts = -20;
      judgment = 'JUNK!';
      sfxMiss();
      bumpFever(-22, 0);

      if (currentMini && currentMini.key === 'plate_rush'){
        currentMini.noJunkOk = false;
      }

      emitEvent({ type:'hit', targetId:id, kind, emoji, rtMs, judgment, blocked:0 });
    }
  }
  else if (kind === 'power'){
    // apply power
    if (emoji === POWER.shield.emoji){
      shieldOn = true;
      shieldUntil = performance.now() + POWER.shield.durMs;
      judgment = 'SHIELD';
      pts = 15;
      AudioMgr.playSfx('hitPower', { vol: 0.95, rate: 1.05 });
      emitEvent({ type:'power', targetId:id, power:'shield' });
    } else {
      goldenOn = true;
      goldenUntil = performance.now() + POWER.golden.durMs;
      judgment = 'GOLDEN';
      pts = 20;
      AudioMgr.playSfx('hitPower', { vol: 0.95, rate: 1.2 });
      emitEvent({ type:'power', targetId:id, power:'golden' });
    }
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    bumpFever(10, 1200);
  }
  else if (kind === 'boss'){
    // damage boss
    bossHP = Math.max(0, bossHP - 1);
    pts = onBeat ? 90 : 65;
    judgment = onBeat ? 'BOSS BEAT!' : 'BOSS HIT';
    AudioMgr.playSfx('hitBoss', { vol: 1.0, rate: onBeat ? 1.1 : 1.0 });

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    bumpFever(14, 1500);

    emitEvent({ type:'boss_hit', targetId:id, hpLeft: bossHP, rtMs, onBeat: onBeat?1:0 });

    if (bossHP <= 0){
      bossOn = false;
      sfxBossClear();
      try{ Particles.celebrate?.({ label:'BOSS CLEAR', heavy:true }); }catch(_){}
      addScore(120);
      emitEvent({ type:'boss_clear' });
    }
  }
  else {
    // good
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);

    const mult = feverOn ? 1.35 : 1.0;
    const gold = goldenOn ? 1.35 : 1.0;

    if (onBeat){
      judgment = 'PERFECT';
      pts = Math.round((55 + (combo>=10 ? 10 : 0)) * mult * gold);
      AudioMgr.playSfx('hitPerfect', { vol: 1.0, rate: 1.0 });
      bumpFever(9, 1200);
    } else {
      judgment = 'GOOD';
      pts = Math.round((35 + (combo>=10 ? 7 : 0)) * mult * gold);
      AudioMgr.playSfx('hitGood', { vol: 0.95, rate: 1.0 });
      bumpFever(6, 800);
    }

    // record plate group
    if (groupId >= 1 && groupId <= 5){
      plateHave[groupId] = true;
    }

    emitEvent({ type:'hit', targetId:id, kind, groupId, emoji, rtMs, judgment, onBeat: onBeat?1:0 });
  }

  // apply score
  addScore(pts);

  // FX: particle + score pop (best-effort)
  try{
    // approximate screen point from entity mesh
    const cam3 = getSceneCamera();
    if (cam3 && el.object3D){
      const w = new THREE.Vector3();
      el.object3D.getWorldPosition(w);
      const sp = projectWorldToScreen(w);
      if (sp){
        const x = sp.x, y = sp.y;
        Particles.burstAt?.(x, y, { label: kind==='junk'?'JUNK':'HIT', good: kind!=='junk', heavy:true, stars:true, confetti:true, count: onBeat ? 44 : 30 });
        Particles.scorePop?.(x, y-8, pts, '', { plain:true });
        Particles.scorePop?.(x, y-30, '', `[${kind.toUpperCase()}] ${judgment}`, { plain:true });
      }
    }
  }catch(_){}

  // remove (animated)
  removeTarget(el, 'hit');

  // plate completion
  checkPlateComplete();

  // update buffs / mini
  updateBuffs();
  miniLoop();

  // update HUD + emit
  emitScore();
  emitQuest();
  hudUpdate();
}

function nearMissPing(){
  // optional: when player hasn't hit for a while, ping
  sfxNear();
  emitEvent({ type:'near_ping' });
}

// =======================================================
// Main loop (timers)
// =======================================================
function startTimers(){
  if (timerTick) clearInterval(timerTick);
  timerTick = setInterval(() => {
    if (ended || paused) return;

    tLeft -= 1;
    if (tLeft < 0) tLeft = 0;

    updateBuffs();
    miniLoop();

    emit('hha:time', { projectTag: PROJECT_TAG, sessionId, mode:'PlateVR', sec:tLeft, paused: paused?1:0 });

    hudUpdate();
    emitScore();

    if (tLeft <= 0){
      endGame('timeup');
    }
  }, 1000);

  if (spawnTimer) clearInterval(spawnTimer);
  spawnTimer = setInterval(() => {
    if (ended || paused) return;
    spawnOne();
  }, DCFG0.spawnInterval);
}

// =======================================================
// Pause / Restart / VR buttons
// =======================================================
function bindButtons(){
  const btnVR = $('btnEnterVR');
  if (btnVR && scene){
    btnVR.addEventListener('click', async () => {
      tryResumeAudio();
      await AudioMgr.preloadSfx();
      if (AUTO_MUSIC && !AudioMgr.bgmOn) AudioMgr.startBgm();
      try { await scene.enterVR(); } catch(_) {}
    });
  }

  const btnPause = $('btnPause');
  if (btnPause){
    btnPause.addEventListener('click', () => {
      tryResumeAudio();
      paused = !paused;
      emitEvent({ type:'pause', paused: paused ? 1 : 0 });
      hudUpdate();
      emitScore();
    });
  }

  const btnRestart = $('btnRestart');
  if (btnRestart){
    btnRestart.addEventListener('click', () => location.reload());
  }

  const btnPlayAgain = $('btnPlayAgain');
  if (btnPlayAgain){
    btnPlayAgain.addEventListener('click', () => location.reload());
  }

  // Create optional MUSIC toggle button if missing
  if (!$('btnMusic')){
    const hudRight = $('hudRight');
    if (hudRight){
      const b = document.createElement('button');
      b.id = 'btnMusic';
      b.className = 'btn';
      b.textContent = '🎵 MUSIC: OFF';
      hudRight.insertBefore(b, hudRight.firstChild);
      b.addEventListener('click', async () => {
        tryResumeAudio();
        await AudioMgr.preloadSfx();
        const on = AudioMgr.toggleBgm();
        b.textContent = on ? '🎵 MUSIC: ON' : '🎵 MUSIC: OFF';
      });
    }
  }
}

// =======================================================
// Result modal
// =======================================================
function showResult(reason){
  const grade = computeGrade();

  setText('rMode', MODE === 'research' ? 'Research' : 'Play');
  setText('rGrade', grade);
  setText('rScore', score);
  setText('rMaxCombo', maxCombo);
  setText('rMiss', miss);
  setText('rPerfect', perfectPlates);

  setText('rGoals', `${goalsCleared}/${goalsTotal}`);
  setText('rMinis', `${minisCleared}/${Math.max(miniTotal, minisCleared)}`);

  // group counts (approx = times each group hit)
  // we can derive from plateHave not accurate; keep minimal:
  setText('rG1', '');
  setText('rG2', '');
  setText('rG3', '');
  setText('rG4', '');
  setText('rG5', '');
  setText('rGTotal', '');

  const bd = $('resultBackdrop');
  if (bd){
    bd.style.display = 'flex';
  }

  emitEvent({ type:'result', reason, grade });
}

// =======================================================
// End game
// =======================================================
function endGame(reason){
  if (ended) return;
  ended = true;

  try{ if (timerTick) clearInterval(timerTick); }catch(_){}
  try{ if (spawnTimer) clearInterval(spawnTimer); }catch(_){}
  stopRootFollow();
  setEdgePulse(false);

  // remove remaining targets
  for (const rec of activeTargets.values()){
    try{ rec.expireTO && clearTimeout(rec.expireTO); }catch(_){}
    try{ rec.el && rec.el.parentNode && rec.el.parentNode.removeChild(rec.el); }catch(_){}
  }
  activeTargets.clear();

  // final summary
  const playedSec = Math.max(0, Math.round((performance.now() - t0)/1000));
  const grade = computeGrade();
  const onBeatRate = beatTotal ? Math.round((beatHits/beatTotal)*1000)/10 : '';

  emit('hha:end', {
    projectTag: PROJECT_TAG,
    sessionId,
    runMode: MODE,
    mode: 'PlateVR',
    diff: DIFF,
    reason,
    durationPlayedSec: playedSec,

    score,
    comboMax: maxCombo,
    misses: miss,

    goalsCleared,
    goalsTotal,
    miniCleared: minisCleared,
    miniTotal: Math.max(miniTotal, minisCleared),

    perfectPlates,
    grade,

    beat: { bpm: BPM, beatWinMs: BEAT_WIN, onBeatRatePct: onBeatRate },

    endTimeIso: nowIso()
  });

  showResult(reason);
}

// =======================================================
// Mini scheduler
// =======================================================
function scheduleMinis(){
  // start 1st mini after a bit, then repeat
  setTimeout(() => {
    if (ended) return;
    startMiniPlateRush();
  }, 9000);

  setInterval(() => {
    if (ended || paused) return;
    if (currentMini) return;

    // rotate minis (now we only run Plate Rush as requested, but can add more later)
    startMiniPlateRush();
  }, 22000);
}

// =======================================================
// Start / user gesture for audio
// =======================================================
function bindUserGestureAudio(){
  const once = async () => {
    tryResumeAudio();
    await AudioMgr.preloadSfx();
    if (AUTO_MUSIC && !AudioMgr.bgmOn) AudioMgr.startBgm();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('touchstart', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once, { passive:true });
  window.addEventListener('touchstart', once, { passive:true });
  window.addEventListener('keydown', once, { passive:true });
}

// =======================================================
// INIT
// =======================================================
function startGame(){
  if (started) return;
  started = true;

  ensureTargetRootWorld();   // ✅ 핵심: ย้าย root ออกมาอยู่ scene + ไม่หมุนตามกล้อง
  startRootFollow();         // ✅ root ตาม "ตำแหน่ง" กล้อง แต่ไม่ตาม "การหมุน"

  bindButtons();
  bindUserGestureAudio();

  resetPlateProgress();
  goalsTotal = 2;
  goalsCleared = Math.min(goalsTotal, perfectPlates);

  hudUpdate();
  emitScore();
  emitQuest();

  startTimers();
  scheduleMinis();

  // fun: if no hit for long -> near ping
  setInterval(() => {
    if (ended || paused) return;
    // if there are many targets but player not hitting, ping
    if (activeTargets.size >= 3 && Math.random() < 0.18) nearMissPing();
  }, 6000);

  emitEvent({ type:'start', timePlannedSec: TIME, bpm: BPM, beatWinMs: BEAT_WIN, version: VERSION });
}

// Start when scene ready
if (scene && scene.hasLoaded){
  startGame();
} else if (scene){
  scene.addEventListener('loaded', () => startGame());
} else {
  // fallback
  window.addEventListener('load', () => startGame());
}