// === /herohealth/vr-goodjunk/GameEngine.js ===
// Good vs Junk VR — DOM Emoji Engine (Production Ready)
// 2025-12 FULL (patched: ES module export, layer+css-safe, miss definition,
// quest director wiring, adaptive size in PLAY only, robust spawn when camera not ready)

'use strict';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

const ROOT = window;
const A = ROOT.AFRAME;
const THREE = (A && A.THREE) || ROOT.THREE;

// ===== FX / UI =====
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

// ===== Helpers =====
function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function getCam(){
  const camEl = document.querySelector('a-camera');
  if (camEl && camEl.getObject3D){
    const c = camEl.getObject3D('camera');
    if (c) return c;
  }
  const scene = document.querySelector('a-scene');
  return (scene && scene.camera) ? scene.camera : null;
}

const tmpV = (THREE && THREE.Vector3) ? new THREE.Vector3() : null;

function projectWorld(pos){
  const cam = getCam();
  if (!cam || !tmpV || !pos) return null;
  tmpV.copy(pos).project(cam);
  if (tmpV.z < -1 || tmpV.z > 1) return null;
  return {
    x: (tmpV.x*0.5 + 0.5) * innerWidth,
    y: (-tmpV.y*0.5 + 0.5) * innerHeight
  };
}

function spawnWorldOrScreen(){
  // พยายาม spawn แบบ world → ถ้า camera ยังไม่พร้อม ให้ fallback เป็น screen coords
  if (!THREE) return { screen:true, x: Math.random()*innerWidth, y: Math.random()*innerHeight };

  const camEl = document.querySelector('a-camera');
  if (!camEl || !camEl.object3D){
    return { screen:true, x: innerWidth*(0.2+Math.random()*0.6), y: innerHeight*(0.22+Math.random()*0.62) };
  }

  const pos = new THREE.Vector3();
  camEl.object3D.getWorldPosition(pos);

  const dir = new THREE.Vector3();
  camEl.object3D.getWorldDirection(dir);

  // 2m in front + random offset
  pos.add(dir.multiplyScalar(2));
  pos.x += (Math.random()-0.5)*1.6;
  pos.y += (Math.random()-0.5)*1.2;
  return { screen:false, pos };
}

// ===== Difficulty base scale =====
function baseScaleForDiff(diff){
  const d = String(diff||'normal').toLowerCase();
  if (d === 'easy')   return { base:1.15, min:0.95, max:1.35 };
  if (d === 'hard')   return { base:0.88, min:0.68, max:1.05 };
  return               { base:1.00, min:0.80, max:1.20 };
}

// ===== Adaptive params =====
const WINDOW_SEC = 8;
const COMBO_REF  = 10;
const ENDGAME_AT = 18;
const STEP       = 0.07;

// Fever behavior
const FEVER_DURATION_MS = 8000;

// ===== Engine state =====
let running = false;
let layerEl = null;

let active = [];
let spawnTimer = null;
let rafId = null;

let score = 0;
let goodHits = 0;     // สำหรับ quest kind = goodHits
let combo = 0;        // current combo
let comboMax = 0;     // best combo (ทั้งเกม)
let misses = 0;       // ✅ MISS = good expired + junk hit (no shield block)

let diff = 'normal';
let runMode = 'play';
let timeLeft = 60;

let feverActive = false;
let feverUntilMs = 0;
let shield = 0;

// window stats for adaptive
let wGoodHit = 0;
let wMiss = 0;
let wComboBest = 0;
let wFeverSec = 0;
let wSecAcc = 0;

let currentScale = 1.0;

// Quest director
let Q = null;

// ===== Events =====
function emit(type, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
}

function emitScore(){
  emit('hha:score', { score, combo, misses, goodHits, comboMax });
}

function updateQuest(){
  if (!Q) return;
  Q.update({ score, goodHits, miss: misses, comboMax, timeLeft });
}

function finalizeQuest(){
  if (!Q) return { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
  return Q.finalize({ score, goodHits, miss: misses, comboMax, timeLeft });
}

// ===== Layer ensure =====
function ensureLayer(){
  layerEl = document.getElementById('gj-layer');
  if (!layerEl){
    layerEl = document.createElement('div');
    layerEl.id = 'gj-layer';
    document.body.appendChild(layerEl);
  }

  // สไตล์พื้นฐาน (กันกรณี html ลืมใส่)
  Object.assign(layerEl.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '649',
    pointerEvents: 'none'
  });
}

// ===== Target create/destroy =====
function createTarget(kind){
  if (!layerEl) return;

  const el = document.createElement('div');
  el.className = 'gj-target ' + (kind === 'good' ? 'gj-good' : 'gj-junk');

  let emoji = (kind === 'good')
    ? (Math.random() < 0.10 ? POWER[(Math.random()*3)|0] : GOOD[(Math.random()*GOOD.length)|0])
    : JUNK[(Math.random()*JUNK.length)|0];

  el.textContent = emoji;

  // ให้ระบบ gaze/reticle จับได้ (ตาม html ของคุณ)
  el.setAttribute('data-hha-tgt', '1');
  el.dataset.kind = (emoji === STAR)   ? 'star'
                : (emoji === FIRE)   ? 'diamond'
                : (emoji === SHIELD) ? 'shield'
                : kind;

  // ✅ ต้องให้คลิก/แตะได้ ถึงแม้ layer pointerEvents:none
  el.style.pointerEvents = 'auto';

  // ใช้ scale ปัจจุบัน
  el.style.setProperty('--gj-scale', String(currentScale));

  const spawn = spawnWorldOrScreen();
  const t = {
    el,
    kind,
    emoji,
    born: performance.now(),
    lifeMs: 2000 + Math.random()*400,
    worldPos: spawn.screen ? null : spawn.pos,
    screenPos: spawn.screen ? { x: spawn.x, y: spawn.y } : null,
  };

  active.push(t);
  layerEl.appendChild(el);

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    hit(t, e.clientX, e.clientY);
  }, { passive:false });

  setTimeout(()=>expire(t), t.lifeMs);
}

function destroy(t, wasHit){
  const i = active.indexOf(t);
  if (i >= 0) active.splice(i, 1);

  const el = t && t.el;
  if (!el) return;

  if (wasHit){
    el.classList.add('hit');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 120);
  } else {
    try{ el.remove(); }catch(_){ }
  }
}

function expire(t){
  if (!running) return;
  // ถ้าโดนยิงไปแล้วจะไม่อยู่ใน active
  if (active.indexOf(t) < 0) return;

  destroy(t, false);

  // ✅ Miss = ปล่อยของดีหลุด (good expired) + แตะขยะ
  if (t.kind === 'good'){
    misses += 1;
    wMiss  += 1;
    combo = 0;

    emit('hha:miss', { misses });
    emit('hha:judge', { label: 'MISS' });
    emitScore();
    updateQuest();
  }
}

// ===== Fever helpers =====
function setFeverState(on){
  const next = !!on;
  if (next === feverActive) return;
  feverActive = next;
  setFeverActive(!!feverActive);
  emit('hha:fever', { state: feverActive ? 'start' : 'end' });
}

// ===== Hit logic =====
function hit(t, x, y){
  // ป้องกัน double-tap
  if (!t || active.indexOf(t) < 0) return;

  destroy(t, true);

  // ----- power-ups -----
  if (t.emoji === STAR){
    score += 40;
    // STAR ถือเป็น good hit สำหรับ flow เด็ก ๆ (คอมโบขึ้น)
    combo += 1;
    comboMax = Math.max(comboMax, combo);
    wComboBest = Math.max(wComboBest, combo);
  }

  if (t.emoji === FIRE){
    // เปิด fever ตามเวลา
    feverUntilMs = performance.now() + FEVER_DURATION_MS;
    setFeverState(true);
  }

  if (t.emoji === SHIELD){
    shield = Math.min(3, shield + 1);
    setShield(shield);
    // SHIELD ถือเป็น good hit สำหรับ flow (คอมโบขึ้นนิด)
    combo += 1;
    comboMax = Math.max(comboMax, combo);
    wComboBest = Math.max(wComboBest, combo);
  }

  // ----- junk -----
  if (t.kind === 'junk'){
    // ✅ ถ้ามี Shield แล้ว block → ไม่ถือเป็น Miss
    if (shield > 0){
      shield -= 1;
      setShield(shield);

      // โดน block ให้คอมโบไม่พัง (ตามแนว “กันไว้”)
      emit('hha:judge', { label: 'BLOCK' });
      emitScore();
      updateQuest();
      return;
    }

    // ✅ junk hit = Miss
    misses += 1;
    wMiss  += 1;
    combo = 0;

    emit('hha:miss', { misses });
    emit('hha:judge', { label: 'MISS' });
    emitScore();
    updateQuest();
    return;
  }

  // ----- good -----
  goodHits += 1;
  wGoodHit += 1;

  combo += 1;
  comboMax = Math.max(comboMax, combo);
  wComboBest = Math.max(wComboBest, combo);

  // score: fever = x2
  const add = 10 * (feverActive ? 2 : 1);
  score += add;

  // FX
  if (Particles && Particles.scorePop){
    Particles.scorePop(x, y, '+' + add, { good:true });
  }

  emit('hha:judge', { label: (combo >= 6 ? 'PERFECT' : 'GOOD') });
  emitScore();
  updateQuest();
}

// ===== Adaptive step (PLAY only) =====
function adaptiveStep(){
  // เฉพาะ PLAY เท่านั้น
  if (runMode !== 'play') return;

  const cfg = baseScaleForDiff(diff);

  // window stats → skillScore
  const hitRateW = wGoodHit / Math.max(1, (wGoodHit + wMiss));
  let base = (hitRateW - 0.70) / 0.20; // 0.70 -> 0
  base = clamp(base, -1, 1);

  const comboNorm = clamp(wComboBest / COMBO_REF, 0, 1);
  let comboBoost = (comboNorm - 0.35) * 0.6;
  comboBoost = clamp(comboBoost, -0.30, 0.30);

  const feverNorm = clamp(wFeverSec / WINDOW_SEC, 0, 1);
  const feverBoost = feverNorm * 0.15;

  const endgame = clamp(1 - (timeLeft / ENDGAME_AT), 0, 1);
  const endPenalty = endgame * 0.25;

  let skillScore = base + comboBoost + feverBoost - endPenalty;
  skillScore = clamp(skillScore, -1, 1);

  // skillScore+ => ยากขึ้น => scale ลง
  let delta = -skillScore * STEP;

  // guard: ตอน fever ห้ามหดเร็วเกิน
  if (feverActive){
    delta = Math.max(delta, -0.04);
  }

  // guard: ช่วงท้ายเกม (<=10s) ห้าม “ยากขึ้น” เพิ่ม
  if (timeLeft <= 10 && delta < 0){
    delta = 0;
  }

  const target = clamp(currentScale + delta, cfg.min, cfg.max);
  currentScale = currentScale * 0.7 + target * 0.3;

  // อัปเดตเป้าที่มีอยู่ (เนียน ๆ)
  for (const t of active){
    if (t && t.el) t.el.style.setProperty('--gj-scale', String(currentScale));
  }
}

// ===== Main loops =====
function loop(){
  if (!running) return;

  for (const t of active){
    if (!t || !t.el) continue;

    let p = null;
    if (t.worldPos){
      p = projectWorld(t.worldPos);
    } else if (t.screenPos){
      p = t.screenPos;
    }

    // ถ้าโปรเจกต์ไม่ได้ (กล้องยังไม่ ready) ให้ fallback เป็นสุ่มบนจอครั้งเดียว
    if (!p){
      if (!t.screenPos){
        t.screenPos = { x: innerWidth*(0.2+Math.random()*0.6), y: innerHeight*(0.22+Math.random()*0.62) };
      }
      p = t.screenPos;
    }

    t.el.style.left = p.x + 'px';
    t.el.style.top  = p.y + 'px';
  }

  rafId = requestAnimationFrame(loop);
}

function spawn(){
  if (!running) return;
  if (active.length < 4) createTarget(Math.random() < 0.70 ? 'good' : 'junk');
  spawnTimer = setTimeout(spawn, 900);
}

// ===== Time / Fever ticking =====
let secondTimer = null;
function startSecondTicker(){
  if (secondTimer) clearInterval(secondTimer);
  secondTimer = setInterval(()=>{
    if (!running) return;

    // fever timeout
    if (feverActive && performance.now() >= feverUntilMs){
      setFeverState(false);
    }

    // window accounting
    wSecAcc += 1;
    if (feverActive) wFeverSec += 1;

    if (wSecAcc >= WINDOW_SEC){
      adaptiveStep();

      // reset window
      wGoodHit = 0;
      wMiss = 0;
      wComboBest = 0;
      wFeverSec = 0;
      wSecAcc = 0;
    }

    // quest update ให้ตาม timeLeft
    updateQuest();
  }, 1000);
}

function stopSecondTicker(){
  if (secondTimer) clearInterval(secondTimer);
  secondTimer = null;
}

// sync timeLeft from external HUD timer
function hookTimeLeft(){
  // ฟัง event จาก goodjunk-vr.html ที่ dispatch hha:time
  ROOT.addEventListener('hha:time', onTimeEvent);
}
function unhookTimeLeft(){
  ROOT.removeEventListener('hha:time', onTimeEvent);
}
function onTimeEvent(e){
  const d = (e && e.detail) || {};
  const sec = (d.sec|0);
  if (sec >= 0) timeLeft = sec;
}

// ===== API =====
function start(opts = {}){
  if (running) return;

  diff = String(opts.diff || 'normal').toLowerCase();
  runMode = (String(opts.runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';
  timeLeft = (typeof opts.durationSec === 'number') ? (opts.durationSec|0) : (opts.timeLeft|0) || 60;

  ensureLayer();

  // reset stats
  active = [];
  score = 0;
  goodHits = 0;
  combo = 0;
  comboMax = 0;
  misses = 0;

  feverActive = false;
  feverUntilMs = 0;
  shield = 0;

  // window reset
  wGoodHit = 0; wMiss = 0; wComboBest = 0; wFeverSec = 0; wSecAcc = 0;

  // scale init
  const cfg = baseScaleForDiff(diff);
  currentScale = cfg.base;

  // research: ล็อกขนาด = base ตลอด
  // play: เริ่มจาก base แล้วค่อย adaptive
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  // quest director
  Q = makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini: 3
  });
  Q.start({ timeLeft });

  running = true;

  hookTimeLeft();
  startSecondTicker();

  // ส่ง HUD เริ่มต้น
  emitScore();
  updateQuest(); // จะปล่อย quest:update “มี goal/mini จริง” ไม่ใช่ null

  loop();
  spawn();
}

function stop(reason='stop'){
  if (!running) return;

  running = false;

  if (spawnTimer) clearTimeout(spawnTimer);
  spawnTimer = null;

  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  stopSecondTicker();
  unhookTimeLeft();

  for (const t of active) destroy(t, false);
  active = [];

  const qsum = finalizeQuest();

  emit('hha:end', {
    reason,
    scoreFinal: score,
    score,
    goodHits,
    comboMax,
    misses,
    goalsCleared: qsum.goalsCleared,
    goalsTotal:   qsum.goalsTotal,
    miniCleared:  qsum.miniCleared,
    miniTotal:    qsum.miniTotal
  });
}

export const GameEngine = { start, stop };
export default GameEngine;
