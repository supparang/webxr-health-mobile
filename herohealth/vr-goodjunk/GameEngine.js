// === /HeroHealth/vr/vr-goodjunk/GameEngine.js (Good vs Junk VR – with HUD) ===
'use strict';

import { ensureFeverBar, setFever, setFeverActive, setShield } from './ui-fever.js';
import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';
import { Quest } from './quest-serial.js';

// --- Game-wide state (required by Quest) ---
let shield = 0;
let fever = 0;
let sceneEl = null;
let targetRoot = null;
let difficulty = new Difficulty();
let gameConfig = null;
let gameTimer = null;
let spawnTimer = null;
let timeLeftSec = 60;

// expose minimal globals for Quest.js
window.score = 0;
window.combo = 0;
window.misses = 0;
window.FEVER_ACTIVE = false;
window.running = false;

window.emit = function(name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {}
};

window.feverStart = function() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);
  Quest.onFever();
  window.emit('hha:fever', { state: 'start' });
};

window.popupText = function(text, pos, color = '#fff') {
  const worldPos = { x: 0, y: (pos && pos.y) || 1.4, z: -1.5 };
  floatScore(sceneEl, worldPos, text, color);
};

// --- HUD (Score + Combo + Miss + Time) ---
let hudEl = null;
function ensureHud() {
  if (hudEl && document.body.contains(hudEl)) return hudEl;

  const cssId = 'hha-hud-style';
  if (!document.getElementById(cssId)) {
    const st = document.createElement('style');
    st.id = cssId;
    st.textContent = `
      #hhaHud {
        position: fixed;
        left: 16px;
        bottom: 16px;
        padding: 10px 14px;
        border-radius: 14px;
        background: rgba(15,23,42,.86);
        border: 1px solid rgba(148,163,184,.75);
        color: #e5e7eb;
        font: 600 13px/1.5 system-ui, -apple-system, 'IBM Plex Sans Thai', sans-serif;
        z-index: 920;
        box-shadow: 0 16px 40px rgba(0,0,0,.45);
        backdrop-filter: blur(8px);
        min-width: 180px;
      }
      #hhaHud .row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      #hhaHud .label {
        opacity: .8;
      }
      #hhaHud .val {
        font-weight: 700;
      }
      #hhaHud .big {
        font-size: 16px;
      }
    `;
    document.head.appendChild(st);
  }

  hudEl = document.getElementById('hhaHud');
  if (!hudEl) {
    hudEl = document.createElement('div');
    hudEl.id = 'hhaHud';
    hudEl.setAttribute('data-hha-ui', '');
    document.body.appendChild(hudEl);
  }
  return hudEl;
}

function renderHud({ score, combo, misses, goodHits, timeLeft }) {
  const hud = ensureHud();
  hud.innerHTML = `
    <div class="row">
      <span class="label">คะแนน</span>
      <span class="val big">${score|0}</span>
    </div>
    <div class="row">
      <span class="label">คอมโบ</span>
      <span class="val">x${combo|0}</span>
    </div>
    <div class="row">
      <span class="label">เก็บของดี</span>
      <span class="val">${goodHits|0}</span>
    </div>
    <div class="row">
      <span class="label">พลาด</span>
      <span class="val">${misses|0}</span>
    </div>
    <div class="row">
      <span class="label">เวลา</span>
      <span class="val">${Math.max(0, timeLeft|0)}s</span>
    </div>
  `;
}

// --- internal helpers ---
function mult() {
  return window.FEVER_ACTIVE ? 2 : 1;
}

function gainFever(n) {
  if (window.FEVER_ACTIVE) return;
  fever = Math.max(0, Math.min(100, fever + n));
  setFever(fever);
  if (fever >= 100) {
    window.feverStart();
  }
}

function decayFever(base) {
  const d = window.FEVER_ACTIVE ? 10 : base;
  fever = Math.max(0, fever - d);
  setFever(fever);
  if (window.FEVER_ACTIVE && fever <= 0) {
    window.FEVER_ACTIVE = false;
    setFeverActive(false);
    window.emit('hha:fever', { state: 'end' });
  }
}

const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
const STAR = '⭐', DIA = '💎', SHIELD_EMOJI = '🛡️', FIRE = '🔥';
const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

let goodHits = 0;

// --- target spawn ---
function spawnTarget() {
  if (!window.running) return;

  const cfg = gameConfig;
  const isGood = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char;
  let type;
  let palette;

  if (usePower) {
    char = BONUS[(Math.random() * BONUS.length) | 0];
    type = 'good';
    palette = 'groups';
  } else if (isGood) {
    char = GOOD[(Math.random() * GOOD.length) | 0];
    type = 'good';
    palette = 'goodjunk';
  } else {
    char = JUNK[(Math.random() * JUNK.length) | 0];
    type = 'bad';
    palette = 'plate';
  }

  const scale = cfg.size * 0.6;
  const el = emojiImage(char, scale);
  el.dataset.type = type;
  el.dataset.char = char;
  el.dataset.palette = palette;
  el.setAttribute('data-hha-tgt', '1');

  const x = (Math.random() - 0.5) * 4;
  const y = 1.0 + Math.random() * 1.0;
  const z = -2.5 - Math.random() * 1.0;
  el.setAttribute('position', `${x} ${y} ${z}`);

  targetRoot.appendChild(el);

  // life / expire
  setTimeout(() => {
    if (!el.parentNode) return;
    if (type === 'good') {
      // miss good
      window.misses++;
      window.combo = 0;
      window.emit('hha:miss', {});
    } else {
      // dodged junk → little fever
      gainFever(4);
    }
    el.remove();
    renderHud({
      score: window.score,
      combo: window.combo,
      misses: window.misses,
      goodHits,
      timeLeft: timeLeftSec
    });
  }, cfg.life);

  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function onHitTarget(targetEl) {
  if (!targetEl || !targetEl.parentNode) return;

  const type = targetEl.dataset.type;
  const char = targetEl.dataset.char;
  const palette = targetEl.dataset.palette;

  const THREE = window.THREE;
  let pos = null;
  if (targetEl.object3D && THREE && THREE.Vector3) {
    pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());
  } else {
    pos = { x:0, y:1.4, z:-2.5 };
  }

  let scoreDelta = 0;

  if (type === 'good') {
    if (char === STAR) {
      scoreDelta = 40 * mult(); gainFever(10);
    } else if (char === DIA) {
      scoreDelta = 80 * mult(); gainFever(30);
    } else if (char === SHIELD_EMOJI) {
      scoreDelta = 20;
      shield = Math.min(3, shield + 1);
      setShield(shield);
    } else if (char === FIRE) {
      scoreDelta = 25;
      window.feverStart();
    } else {
      scoreDelta = (20 + window.combo * 2) * mult();
      gainFever(8 + window.combo * 0.6);
    }

    window.score += scoreDelta;
    window.combo++;
    goodHits++;
    Quest.onGood();
    burstAt(sceneEl, pos, { mode: palette || 'goodjunk' });
    floatScore(sceneEl, pos, `+${scoreDelta}`, '#22c55e');
  } else {
    // hit junk
    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, 'SHIELDED!', '#60a5fa');
    } else {
      scoreDelta = -15;
      window.score = Math.max(0, window.score + scoreDelta);
      window.combo = 0;
      window.misses++;
      decayFever(18);
      Quest.onBad();
      window.emit('hha:miss', {});
      burstAt(sceneEl, pos, { mode: palette || 'plate' });
      floatScore(sceneEl, pos, `${scoreDelta}`, '#ef4444');
    }
  }

  window.emit('hha:score', {
    score: window.score,
    combo: window.combo,
    delta: scoreDelta,
    goodHits,
    misses: window.misses
  });

  renderHud({
    score: window.score,
    combo: window.combo,
    misses: window.misses,
    goodHits,
    timeLeft: timeLeftSec
  });

  targetEl.remove();
}

function gameTick() {
  if (!window.running) return;

  timeLeftSec = Math.max(0, timeLeftSec - 1);

  decayFever(window.combo <= 0 ? 6 : 2);

  window.emit('hha:time', { sec: timeLeftSec });

  renderHud({
    score: window.score,
    combo: window.combo,
    misses: window.misses,
    goodHits,
    timeLeft: timeLeftSec
  });

  if (timeLeftSec <= 0) {
    // ให้ Launcher จัดการจอจบเกมผ่าน hha:end
    GameEngine.stop();
    window.emit('hha:end', { score: window.score });
  }
}

// --- public controller ---
export const GameEngine = {
  start(level = 'normal', durationSec = 60) {
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('A-Frame scene not found');
      return;
    }

    // cleanup old
    if (targetRoot && targetRoot.parentNode) targetRoot.parentNode.removeChild(targetRoot);
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'targetRoot';
    sceneEl.appendChild(targetRoot);

    ensureFeverBar();
    setShardMode('goodjunk');
    ensureHud();

    // reset state
    window.score = 0;
    window.combo = 0;
    window.misses = 0;
    shield = 0;
    fever = 0;
    goodHits = 0;
    window.FEVER_ACTIVE = false;
    window.running = true;
    timeLeftSec = durationSec | 0;

    setFever(0);
    setShield(0);
    setFeverActive(false);

    difficulty.set(level);
    gameConfig = difficulty.get();

    if (gameTimer) clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);

    gameTimer = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 1000);

    Quest.start();

    // click (VR trigger / mobile tap / mouse)
    sceneEl.addEventListener('click', (e) => {
      if (e.target && e.target.dataset && e.target.dataset.hhaTgt) {
        onHitTarget(e.target);
      }
    });

    // mouse-specific (desktop)
    sceneEl.addEventListener('mousedown', () => {
      if (!window.running) return;
      const cursor = document.getElementById('cursor');
      if (!cursor || !cursor.components || !cursor.components.raycaster) return;
      const raycaster = cursor.components.raycaster;
      const target = raycaster.intersectedEls && raycaster.intersectedEls[0];
      if (target && target.dataset && target.dataset.hhaTgt) {
        onHitTarget(target);
      }
    });

    renderHud({
      score: window.score,
      combo: window.combo,
      misses: window.misses,
      goodHits,
      timeLeft: timeLeftSec
    });

    window.emit('hha:score', { score: 0, combo: 0, delta: 0, goodHits: 0, misses: 0 });
    window.emit('hha:time', { sec: timeLeftSec });
  },

  stop() {
    if (!window.running) return;
    window.running = false;

    if (gameTimer) clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    gameTimer = null;
    spawnTimer = null;

    Quest.stop();

    if (targetRoot && targetRoot.parentNode) {
      targetRoot.parentNode.removeChild(targetRoot);
    }
    targetRoot = null;
  }
};

export default GameEngine;
