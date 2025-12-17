// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: layer+css, correct miss/combo, quest director, adaptive)
//
// Miss rule (สำคัญ):
//   MISS = goodExpired (พลาดของดีหลุด) + junkHit (แตะขยะ)
//   แต่ถ้าแตะขยะตอนมี Shield และ Shield กันไว้ -> ไม่ถือเป็น MISS
//
// Exports:
//   export const GameEngine = { start, stop }

'use strict';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

const ROOT = window;
const A = ROOT.AFRAME;
const THREE = (A && A.THREE) || ROOT.THREE;

// ===== FX / UI (global IIFE modules) =====
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles || { scorePop(){}, burstAt(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI || { ensureFeverBar(){}, setFever(){}, setFeverActive(){}, setShield(){} };

const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// ===== Emoji pools =====
const GOOD = ['🍎','🥦','🥕','🍌','🍉','🥛'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🥤'];
const STAR='⭐', FIRE='🔥', SHIELD='🛡️';
const POWER=[STAR,FIRE,SHIELD];

// ===== Difficulty baselines =====
const DIFF_BASE = {
  easy:   { spawnMs: 980, maxActive: 4, lifeMs: 2600, scale: 1.15 },
  normal: { spawnMs: 860, maxActive: 4, lifeMs: 2350, scale: 1.00 },
  hard:   { spawnMs: 720, maxActive: 5, lifeMs: 2100, scale: 0.92 }
};

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance.now(); }

function getCam(){
  const camEl = document.querySelector('a-camera');
  if (camEl && camEl.getObject3D) {
    const c = camEl.getObject3D('camera');
    if (c) return c;
  }
  const scene = document.querySelector('a-scene');
  return (scene && scene.camera) ? scene.camera : null;
}

const tmpV = THREE && new THREE.Vector3();

function project(pos){
  const cam = getCam();
  if (!cam || !tmpV || !pos) return null;

  tmpV.copy(pos).project(cam);
  if (tmpV.z < -1 || tmpV.z > 1) return null;

  return {
    x: (tmpV.x * 0.5 + 0.5) * innerWidth,
    y: (-tmpV.y * 0.5 + 0.5) * innerHeight
  };
}

function spawnWorld(){
  if (!THREE) return null;
  const camEl = document.querySelector('a-camera');
  if (!camEl || !camEl.object3D) return null;

  const pos = new THREE.Vector3();
  camEl.object3D.getWorldPosition(pos);

  const dir = new THREE.Vector3();
  camEl.object3D.getWorldDirection(dir);

  // 2.1m in front + random offset (กระจายกว้างขึ้น เพื่อไม่ซ้ำตำแหน่ง)
  pos.add(dir.multiplyScalar(2.1));
  pos.x += (Math.random() - 0.5) * 2.2;   // <- กว้างขึ้น
  pos.y += (Math.random() - 0.5) * 1.6;   // <- กว้างขึ้น
  return pos;
}

// ===== DOM layer + CSS =====
let styleInjected = false;

function ensureStyles(){
  if (styleInjected) return;
  styleInjected = true;

  const css = `
    #gj-layer{
      position:fixed;
      inset:0;
      z-index:649;              /* ต่ำกว่า HUD(650) เพื่อไม่บัง UI */
      pointer-events:none;      /* layer ไม่รับคลิก */
    }
    .gj-target{
      position:absolute;
      transform:translate(-50%,-50%) scale(var(--gj-scale, 1));
      font-size: clamp(34px, 6vw, 64px);
      line-height: 1;
      user-select:none;
      -webkit-user-select:none;
      pointer-events:auto;      /* ✅ เป้ารับคลิก/แตะได้ */
      cursor:pointer;
      filter: drop-shadow(0 10px 16px rgba(0,0,0,.45));
      transition: transform .08s ease-out, opacity .12s ease-out;
      opacity: 0.98;
      will-change: left, top, transform, opacity;
    }
    .gj-target.hit{
      transform:translate(-50%,-50%) scale(calc(var(--gj-scale, 1) * 1.25));
      opacity: 0;
    }
    .gj-target.gj-good{ }
    .gj-target.gj-junk{ }
  `;

  const st = document.createElement('style');
  st.setAttribute('data-gj-style','1');
  st.textContent = css;
  document.head.appendChild(st);
}

function ensureLayer(){
  let layer = document.getElementById('gj-layer');
  if (!layer){
    layer = document.createElement('div');
    layer.id = 'gj-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

// ===== Engine state =====
let running = false;
let rafId = null;
let spawnTimer = null;

let layerEl = null;
let diff = 'normal';
let runMode = 'play';

let score = 0;
let combo = 0;
let comboMax = 0;

// ✅ miss components
let goodHits = 0;
let junkHits = 0;      // แตะขยะแล้ว “โดนจริง” (ไม่ถูก shield กัน)
let goodExpired = 0;   // ของดีหลุด (timeout)
let misses = 0;        // = goodExpired + junkHits

let shield = 0;

// fever
let fever = 0;               // 0..100
let feverActive = false;
let feverEndAt = 0;

// adaptive (play only)
let adaptiveScale = 1.0;
let adaptiveSpawnMs = 900;
let adaptiveLifeMs = 2300;
let adaptiveMaxActive = 4;

// targets
let active = []; // { el, kind, emoji, pos, born, lifeMs }
let director = null;

function emit(type, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch(_){}
}

function recomputeMiss(){
  misses = (goodExpired | 0) + (junkHits | 0);
}

function resetComboOnMiss(){
  combo = 0;
}

function addComboOnGood(){
  combo += 1;
  comboMax = Math.max(comboMax, combo);
}

// ===== Adaptive tuning =====
function setAdaptiveFromBase(){
  const base = DIFF_BASE[diff] || DIFF_BASE.normal;
  adaptiveScale = base.scale;
  adaptiveSpawnMs = base.spawnMs;
  adaptiveLifeMs = base.lifeMs;
  adaptiveMaxActive = base.maxActive;
}

// โหมดเล่น: ปรับตาม combo/fever/timeLeft + miss rate แบบง่าย
function applyAdaptive(state){
  if (runMode === 'research') return;

  const base = DIFF_BASE[diff] || DIFF_BASE.normal;

  const timeLeft = (state && typeof state.timeLeft === 'number') ? state.timeLeft : 60;

  // performance indicators
  const combo01 = clamp(comboMax / (diff === 'hard' ? 14 : diff === 'easy' ? 10 : 12), 0, 1);
  const miss01  = clamp(misses / (diff === 'hard' ? 10 : diff === 'easy' ? 14 : 12), 0, 1);
  const time01  = clamp(1 - (timeLeft / 60), 0, 1); // ใกล้หมดเวลา -> 1

  // ถ้าเล่นดี (combo สูง, miss ต่ำ, fever active) -> ทำให้ยากขึ้นทีละนิด
  // ถ้าพลาดเยอะ -> ช่วยให้เล่นง่ายขึ้น
  let difficultyPush = (combo01 * 0.55) - (miss01 * 0.70) + (feverActive ? 0.25 : 0) + (time01 * 0.15);
  difficultyPush = clamp(difficultyPush, -0.65, 0.65);

  // scale: เล่นดี -> เล็กลง, พลาดเยอะ -> ใหญ่ขึ้น
  adaptiveScale = clamp(base.scale * (1 - difficultyPush * 0.35), 0.78, 1.35);

  // spawn: เล่นดี -> ถี่ขึ้น (ms ลด), พลาดเยอะ -> ช้าลง
  adaptiveSpawnMs = clamp(base.spawnMs * (1 - difficultyPush * 0.28), 520, 1400);

  // life: เล่นดี -> อยู่สั้นลง, พลาดเยอะ -> อยู่นานขึ้น
  adaptiveLifeMs = clamp(base.lifeMs * (1 - difficultyPush * 0.22), 1400, 3200);

  // maxActive: เล่นดี -> เพิ่มได้เล็กน้อย
  adaptiveMaxActive = clamp(Math.round(base.maxActive + (difficultyPush > 0.25 ? 1 : 0)), 3, 6);
}

// ===== Fever logic =====
function feverTick(){
  if (!running) return;

  if (feverActive){
    // ลดลงช้า ๆ ตอน fever
    fever = clamp(fever - 0.18, 0, 100);
    if (now() >= feverEndAt){
      feverActive = false;
      setFeverActive(false);
      emit('hha:fever', { state: 'end' });
    }
  }else{
    // decay
    fever = clamp(fever - 0.12, 0, 100);
  }

  setFever(Math.round(fever));
}

function feverGainOnGood(){
  if (feverActive) return;
  fever = clamp(fever + 8.5, 0, 100);
  setFever(Math.round(fever));
  if (fever >= 100){
    feverActive = true;
    feverEndAt = now() + 6500;
    setFeverActive(true);
    emit('hha:fever', { state: 'start' });
  }
}

// ===== Targets =====
function destroyTarget(t, wasHit){
  const i = active.indexOf(t);
  if (i >= 0) active.splice(i, 1);

  if (t && t.el){
    if (wasHit){
      t.el.classList.add('hit');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
    } else {
      try{ t.el.remove(); }catch(_){}
    }
  }
}

function expireTarget(t){
  if (!running) return;
  destroyTarget(t, false);

  // ✅ ปล่อยของดีหลุด -> MISS + reset combo
  if (t.kind === 'good'){
    goodExpired++;
    recomputeMiss();
    resetComboOnMiss();
    emit('hha:miss', { misses });
    emit('hha:judge', { label: 'MISS' });
    emitScore();
  }
}

function emitScore(){
  emit('hha:score', {
    score,
    combo,       // current combo (สำหรับ mood)
    comboMax,    // HUD ของคุณเก็บ max เองได้ แต่ส่งไว้ด้วย
    misses,
    goodHits,
    junkHits,
    goodExpired,
    shield
  });
}

// kind สำหรับ reticle color
function kindForReticle(kind, emoji){
  if (emoji === STAR) return 'star';
  if (emoji === FIRE) return 'diamond';
  if (emoji === SHIELD) return 'shield';
  return kind;
}

function hitTarget(t, clientX, clientY){
  destroyTarget(t, true);

  // powerups (นับเป็น good hit ถ้าเป็นของดี)
  if (t.kind === 'good'){
    goodHits++;
  }

  // ⭐ bonus
  if (t.emoji === STAR){
    score += 40;
  }

  // 🔥 fever trigger
  if (t.emoji === FIRE){
    // ให้ “เติมใกล้เต็ม” เพื่อเริ่ม fever ได้ไว
    fever = clamp(fever + 55, 0, 100);
    setFever(Math.round(fever));
    if (!feverActive && fever >= 100){
      feverActive = true;
      feverEndAt = now() + 6500;
      setFeverActive(true);
      emit('hha:fever', { state: 'start' });
    }
  }

  // 🛡️ shield
  if (t.emoji === SHIELD){
    shield = Math.min(3, shield + 1);
    setShield(shield);
  }

  // ---- junk ----
  if (t.kind === 'junk'){
    // ✅ shield block -> ไม่เป็น miss
    if (shield > 0){
      shield--;
      setShield(shield);
      emit('hha:judge', { label: 'BLOCK' });
      // combo ไม่ reset (กันไว้ได้)
      emitScore();
      return;
    }

    // โดนขยะจริง -> MISS
    junkHits++;
    recomputeMiss();
    resetComboOnMiss();

    emit('hha:miss', { misses });
    emit('hha:judge', { label: 'MISS' });
    emitScore();
    return;
  }

  // ---- good hit ----
  addComboOnGood();

  const mult = feverActive ? 2 : 1;
  score += 10 * mult;

  feverGainOnGood();

  // FX
  Particles.scorePop(clientX, clientY, `+${10*mult}`, { good:true });
  emit('hha:judge', { label: combo >= 6 ? 'PERFECT' : 'GOOD' });

  emitScore();
}

function createTarget(kind){
  if (!layerEl) return;

  const el = document.createElement('div');
  el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');

  const emoji =
    (kind === 'good')
      ? (Math.random() < 0.12 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
      : JUNK[(Math.random()*JUNK.length)|0];

  el.textContent = emoji;

  // ✅ ให้ raycaster/gaze system ของคุณจับได้ (HTML ฟัง [data-hha-tgt])
  el.setAttribute('data-hha-tgt', '1');
  el.dataset.kind = kindForReticle(kind, emoji);

  // ✅ scale จาก adaptive
  el.style.setProperty('--gj-scale', String(adaptiveScale));

  const t = {
    el,
    kind,
    emoji,
    pos: spawnWorld(),
    born: now(),
    lifeMs: adaptiveLifeMs
  };

  active.push(t);
  layerEl.appendChild(el);

  // ✅ pointerdown สำหรับมือถือ/เมาส์
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    hitTarget(t, e.clientX, e.clientY);
  }, { passive:false });

  // ✅ timeout -> expire
  setTimeout(()=>expireTarget(t), t.lifeMs);
}

function loop(){
  if (!running) return;

  // update fever gauge
  feverTick();

  // re-project all targets
  for (const t of active){
    const p = project(t.pos);
    if (!p) continue;
    t.el.style.left = p.x + 'px';
    t.el.style.top  = p.y + 'px';
  }

  rafId = requestAnimationFrame(loop);
}

function spawnLoop(){
  if (!running) return;

  if (active.length < adaptiveMaxActive){
    // good ratio: เล่นดีขึ้น -> ใส่ junk มากขึ้นนิด
    const junkBias = clamp(0.28 + (comboMax >= 8 ? 0.10 : 0) + (diff === 'hard' ? 0.05 : 0), 0.22, 0.55);
    const kind = (Math.random() < (1 - junkBias)) ? 'good' : 'junk';
    createTarget(kind);
  }

  spawnTimer = setTimeout(spawnLoop, adaptiveSpawnMs);
}

// ===== Quest director integration =====
function ensureDirector(){
  director = makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini:  3
  });
}

function directorStart(timeLeft){
  if (!director) return;
  director.start({ timeLeft });
  // director.start() จะ emit quest:update เองผ่าน emitHUD()
}

function directorUpdate(timeLeft){
  if (!director) return;
  director.update({
    score,
    goodHits,
    miss: misses,
    comboMax,
    timeLeft
  });
}

function directorFinalize(timeLeft){
  if (!director) return { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
  return director.finalize({
    score,
    goodHits,
    miss: misses,
    comboMax,
    timeLeft
  });
}

// ===== Public API =====
let lastTimeLeft = 60;

function start(d='normal', opts={}){
  if (running) return;

  diff = String(d || 'normal').toLowerCase();
  if (!DIFF_BASE[diff]) diff = 'normal';

  runMode = String(opts.runMode || 'play').toLowerCase() === 'research' ? 'research' : 'play';

  ensureStyles();
  layerEl = opts.layerEl || ensureLayer();

  // reset stats
  running = true;
  score = 0;
  combo = 0;
  comboMax = 0;
  goodHits = 0;
  junkHits = 0;
  goodExpired = 0;
  misses = 0;

  shield = 0;
  setShield(0);

  fever = 0;
  feverActive = false;
  feverEndAt = 0;

  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // baselines
  setAdaptiveFromBase();
  applyAdaptive({ timeLeft: lastTimeLeft });

  // quest
  ensureDirector();
  directorStart(lastTimeLeft);

  // initial HUD score
  emitScore();

  // start loops
  loop();
  spawnLoop();
}

// stop(reason, timeLeftOpt)
function stop(reason='end', timeLeftOpt){
  if (!running) return;

  running = false;

  if (spawnTimer) clearTimeout(spawnTimer);
  spawnTimer = null;

  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  // clear active targets
  const snapshot = active.slice();
  active.length = 0;
  snapshot.forEach(t=>destroyTarget(t,false));

  // finalize quest (ตัดสิน missMax ตอนจบ)
  const timeLeft = (typeof timeLeftOpt === 'number') ? timeLeftOpt : lastTimeLeft;
  const qsum = directorFinalize(timeLeft);

  // ส่ง end
  emit('hha:end', {
    reason,
    scoreFinal: score,
    score,
    comboMax,
    misses,
    goodHits,
    junkHits,
    goodExpired,
    goalsCleared: qsum.goalsCleared,
    goalsTotal:   qsum.goalsTotal,
    miniCleared:  qsum.miniCleared,
    miniTotal:    qsum.miniTotal
  });
}

// ให้ HTML อัปเดต timeLeft ให้ engine (เพื่อ adaptive + quest director)
function setTimeLeft(sec){
  lastTimeLeft = (sec|0);
  if (!running) return;

  // adaptive เฉพาะ play mode
  applyAdaptive({ timeLeft: lastTimeLeft });

  // quest update
  directorUpdate(lastTimeLeft);
}

// hook: ถ้าเกมมี event hha:time จาก HTML อยู่แล้ว ให้ engine ฟังเองได้
ROOT.addEventListener('hha:time', (e)=>{
  const d = (e && e.detail) || {};
  if (typeof d.sec === 'number') setTimeLeft(d.sec);
});

// expose for legacy + export
ROOT.GoodJunkVR = ROOT.GoodJunkVR || {};
ROOT.GoodJunkVR.GameEngine = { start, stop, setTimeLeft };

export const GameEngine = ROOT.GoodJunkVR.GameEngine;
