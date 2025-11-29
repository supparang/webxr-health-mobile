// === /HeroHealth/vr/GameEngine.js ===
// Good vs Junk — VR Engine (PC + Mobile + VR Headset)

'use strict';

import { ensureFeverBar, setFever, setFeverActive, setShield } from './ui-fever.js';
import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';
import { Quest } from './quest-serial.js';

// ---------- Global ที่ Quest / Coach ใช้ ----------
window.score        = 0;
window.combo        = 0;
window.misses       = 0;
window.FEVER_ACTIVE = false;
window.running      = false;

// ให้ Quest / Coach เรียกใช้ event / fever / popup ได้
function emit(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
}
window.emit = emit;

let shield = 0;
let fever  = 0;

function feverStart() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);
  Quest.onFever && Quest.onFever();
  emit('hha:fever', { state: 'start' });
}
window.feverStart = feverStart;

function popupText(text, pos, color = '#fff') {
  const scene = document.querySelector('a-scene');
  if (!scene) return;
  const worldPos = {
    x: 0,
    y: (pos && pos.y) || 1.4,
    z: -1.5
  };
  floatScore(scene, worldPos, text, color);
}
window.popupText = popupText;

// ---------- State ภายใน Engine ----------
let gameTimer   = null;
let spawnTimer  = null;
let sceneEl     = null;
let targetRoot  = null;
let gameConfig  = null;
const difficulty = new Difficulty();

const GOOD = [
  '🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇',
  '🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'
];
const JUNK = [
  '🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋',
  '🍫','🌭','🍰','🍬'
];

const STAR         = '⭐';
const DIA          = '💎';
const SHIELD_EMOJI = '🛡️';
const FIRE         = '🔥';
const BONUS        = [STAR, DIA, SHIELD_EMOJI, FIRE];

function mult() {
  return window.FEVER_ACTIVE ? 2 : 1;
}

function gainFever(n) {
  if (window.FEVER_ACTIVE) return;
  fever = Math.max(0, Math.min(100, fever + n));
  setFever(fever);
  if (fever >= 100) {
    feverStart();
  }
}

function decayFever(base) {
  const d = window.FEVER_ACTIVE ? 10 : base;
  fever = Math.max(0, fever - d);
  setFever(fever);
  if (window.FEVER_ACTIVE && fever <= 0) {
    window.FEVER_ACTIVE = false;
    setFeverActive(false);
    emit('hha:fever', { state: 'end' });
  }
}

// ---------- Spawn เป้า emoji ใน 3D ----------
function spawnTarget() {
  if (!window.running || !sceneEl || !targetRoot || !gameConfig) return;

  const cfg = gameConfig;

  const isGood   = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char;
  let type;
  let palette;

  if (usePower) {
    char    = BONUS[(Math.random() * BONUS.length) | 0];
    type    = 'good';          // power-ups นับเป็น good
    palette = 'groups';
  } else if (isGood) {
    char    = GOOD[(Math.random() * GOOD.length) | 0];
    type    = 'good';
    palette = 'goodjunk';
  } else {
    char    = JUNK[(Math.random() * JUNK.length) | 0];
    type    = 'bad';
    palette = 'plate';
  }

  const scale = cfg.size * 0.6; // 0.6 = scale base

  const el = emojiImage(char, scale);
  el.dataset.type    = type;
  el.dataset.char    = char;
  el.dataset.palette = palette;
  el.setAttribute('data-hha-tgt', '1');   // ให้ raycaster เล็งโดน

  // สุ่มตำแหน่งด้านหน้าผู้เล่น
  const x = (Math.random() - 0.5) * 4;     // -2..+2
  const y = 1.0 + Math.random() * 1.0;     // 1..2
  const z = -2.5 - Math.random() * 1.0;    // -2.5..-3.5
  el.setAttribute('position', `${x} ${y} ${z}`);

  targetRoot.appendChild(el);

  // หมดอายุ (life) = นับเป็น miss ของ good / safe avoid ของ junk
  setTimeout(() => {
    if (!el.parentNode) return;
    const t = el.dataset.type;
    if (t === 'good') {
      // พลาดของดี → miss
      window.misses++;
      window.combo = 0;
      emit('hha:miss', {});
    } else {
      // ปล่อยของขยะหลุด → ดี (ช่วยลดขยะ)
      gainFever(4);
    }
    el.remove();
  }, cfg.life);

  // นัด spawn ถัดไป
  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

// ---------- เมื่อยิงโดนเป้า ----------
function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type    = targetEl.dataset.type;
  const char    = targetEl.dataset.char;
  const palette = targetEl.dataset.palette || 'goodjunk';

  // ใช้ THREE จาก A-Frame (มีใน global แล้ว)
  const pos = targetEl.object3D
    ? targetEl.object3D.getWorldPosition(new THREE.Vector3())
    : { x: 0, y: 1.4, z: -2.5 };

  let scoreDelta = 0;

  if (type === 'good') {
    // ----- ของดี / Power-ups -----
    if (char === STAR) {
      scoreDelta = 40 * mult();
      gainFever(10);
    } else if (char === DIA) {
      scoreDelta = 80 * mult();
      gainFever(30);
    } else if (char === SHIELD_EMOJI) {
      scoreDelta = 20;
      shield     = Math.min(3, shield + 1);
      setShield(shield);
    } else if (char === FIRE) {
      scoreDelta = 25;
      feverStart();
    } else {
      scoreDelta = (20 + window.combo * 2) * mult();
      gainFever(8 + window.combo * 0.6);
    }

    window.score += scoreDelta;
    window.combo++;
    Quest.onGood && Quest.onGood();

    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
  } else {
    // ----- ของขยะ -----
    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
    } else {
      scoreDelta   = -15;
      window.score = Math.max(0, window.score + scoreDelta);
      window.combo = 0;
      decayFever(18);
      Quest.onBad && Quest.onBad();
      emit('hha:miss', {});
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
    }
  }

  emit('hha:score', {
    score: window.score,
    combo: window.combo,
    delta: scoreDelta
  });

  targetEl.remove();
}

// ---------- Tick ทุก 1 วินาที ----------
function gameTick() {
  if (!window.running) return;
  decayFever(window.combo <= 0 ? 6 : 2);
}

// ---------- ผูก input (click / trigger / gaze) ----------
let inputBound = false;
function bindInputOnce() {
  if (inputBound) return;
  if (!sceneEl)   return;

  inputBound = true;

  // ใช้ click ของ A-Frame (รองรับ headset + mobile gaze)
  sceneEl.addEventListener('click', (e) => {
    if (!window.running) return;
    const t = e.target;
    if (t && t.dataset && t.dataset.hhaTgt) {
      onHitTarget(t);
    }
  });

  // Mouse บน PC: ยิงด้วย raycaster จาก <a-cursor>
  const setupMouse = () => {
    const canvas = sceneEl.canvas || (sceneEl.renderer && sceneEl.renderer.domElement);
    if (!canvas) return;

    canvas.addEventListener('mousedown', () => {
      if (!window.running) return;
      const cursor = document.getElementById('cursor');
      if (!cursor || !cursor.components || !cursor.components.raycaster) return;

      const raycaster = cursor.components.raycaster;
      const hit = raycaster.intersectedEls && raycaster.intersectedEls[0];
      if (hit && hit.dataset && hit.dataset.hhaTgt) {
        onHitTarget(hit);
      }
    });
  };

  if (sceneEl.hasLoaded) {
    setupMouse();
  } else {
    sceneEl.addEventListener('loaded', setupMouse, { once: true });
  }
}

// ---------- Export: GameEngine ----------
export const GameEngine = {
  start(level = 'normal') {
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GameEngine] A-Frame scene not found');
      return;
    }

    // เคลียร์ targetRoot เก่า
    if (targetRoot && targetRoot.parentNode) {
      targetRoot.parentNode.removeChild(targetRoot);
    }
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    sceneEl.appendChild(targetRoot);

    // UI / FX
    ensureFeverBar();
    setFever(0);
    setShield(0);
    setFeverActive(false);
    setShardMode('goodjunk');

    // reset ค่า global
    window.score        = 0;
    window.combo        = 0;
    window.misses       = 0;
    window.FEVER_ACTIVE = false;
    window.running      = true;
    shield              = 0;
    fever               = 0;

    // ตั้งค่าความยาก
    difficulty.set(level);
    gameConfig = difficulty.get(); // { size, rate, life }

    // timer
    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer  = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    // เริ่ม Quest
    Quest.start && Quest.start();

    // ผูก input
    bindInputOnce();

    // แจ้งเริ่มเกม
    emit('hha:score', { score: 0, combo: 0 });
  },

  stop() {
    if (!window.running) return;
    window.running = false;

    if (gameTimer)  clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer  = null;
    spawnTimer = null;

    Quest.stop && Quest.stop();

    if (targetRoot && targetRoot.parentNode) {
      targetRoot.parentNode.removeChild(targetRoot);
    }
    targetRoot = null;

    // ลบ UI ที่ติด data-hha-ui
    document.querySelectorAll('[data-hha-ui]').forEach(el => {
      try { el.remove(); } catch (e) {}
    });

    emit('hha:end', { score: window.score });
  }
};

export default GameEngine;
