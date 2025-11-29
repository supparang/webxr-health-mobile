// === /HeroHealth/vr/GameEngine.js (Good vs Junk VR — Production Ready) ===

import { ensureFeverBar, setFever, setFeverActive, setShield } from './ui-fever.js';
import { Difficulty } from './difficulty.js';
import { emojiImage } from './emoji-image.js';
import { burstAt, floatScore, setShardMode } from './aframe-particles.js';
import { Quest } from './quest-serial.js';

// ---- util: emit event แบบสั้น ๆ ----
function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}
// ให้โมดูลอื่นที่เคยใช้ window.emit ใช้ต่อได้
window.emit = emit;

// ---- ค่าพื้นฐานของเกม ----
const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

const STAR  = '⭐';
const DIA   = '💎';
const SHIELD_EMOJI = '🛡️';
const FIRE  = '🔥';
const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

// ---- state ภายใน Engine ----
let sceneEl       = null;
let targetRoot    = null;
let difficulty    = new Difficulty();
let difficultyLvl = 'normal';

let durationSec   = 60;
let elapsedSec    = 0;
let timeLeftSec   = 60;

let score         = 0;
let combo         = 0;
let comboMax      = 0;
let goodHits      = 0;
let junkHits      = 0;
let goodMissTimeout = 0; // ของดีหลุดจอ
let misses        = 0;   // พลาดรวม (โดนขยะ + ของดีหลุดจอ)

let shield        = 0;
let fever         = 0;
let FEVER_ACTIVE  = false;
let running       = false;

let spawnTimer    = null;
let gameTimer     = null;

// เพื่อกันการ bind ซ้ำเวลากดเล่นหลายรอบ
let inputBound    = false;

// HUD elements
let hudRoot = null;
let hudScoreEl = null;
let hudComboEl = null;
let hudGoodEl  = null;
let hudMissEl  = null;
let hudTimeEl  = null;

// ---- Global สำหรับ Quest.js ที่คาดหวังตัวแปรบน window ----
window.score        = 0;
window.combo        = 0;
window.misses       = 0;
window.FEVER_ACTIVE = false;
window.running      = false;

// ให้ Quest เรียกเปิดโหมด FEVER ได้
window.feverStart = function feverStart() {
  if (FEVER_ACTIVE) return;
  FEVER_ACTIVE = true;
  window.FEVER_ACTIVE = true;
  fever = 100;
  setFever(fever);
  setFeverActive(true);
  Quest.onFever();
  emit('hha:fever', { state: 'start' });
};

// ---- HUD (Score / Combo / Good / Miss / Time) ----
function ensureHudCss() {
  if (document.getElementById('hha-hud-style')) return;

  const st = document.createElement('style');
  st.id = 'hha-hud-style';
  st.textContent = `
  #hha-hud{
    position:fixed;
    left:16px;
    top:16px;
    z-index:905;
    pointer-events:none;
    font-family: system-ui, -apple-system, 'IBM Plex Sans Thai', sans-serif;
  }
  #hha-hud .card{
    background:linear-gradient(145deg, rgba(15,23,42,.92), rgba(30,64,175,.88));
    border-radius:18px;
    padding:10px 14px;
    box-shadow:0 14px 30px rgba(15,23,42,.7);
    border:1px solid rgba(148,163,184,.7);
    min-width:190px;
    color:#e5e7eb;
  }
  #hha-hud .row{
    display:flex;
    justify-content:space-between;
    align-items:center;
    font-size:13px;
    margin:2px 0;
  }
  #hha-hud .row .label{
    opacity:.9;
  }
  #hha-hud .row .val{
    font-weight:700;
    margin-left:8px;
  }
  #hha-hud .row .val.big{
    font-size:17px;
  }
  @media (max-width:600px){
    #hha-hud .card{
      padding:8px 10px;
      min-width:170px;
    }
    #hha-hud .row{
      font-size:12px;
    }
  }
  `;
  document.head.appendChild(st);
}

function ensureHud() {
  ensureHudCss();
  if (hudRoot) return;

  hudRoot = document.createElement('div');
  hudRoot.id = 'hha-hud';
  hudRoot.setAttribute('data-hha-ui', '1');
  hudRoot.innerHTML = `
    <div class="card">
      <div class="row">
        <span class="label">⭐ คะแนน</span>
        <span class="val big" data-hha-hud="score">0</span>
      </div>
      <div class="row">
        <span class="label">🔥 คอมโบ</span>
        <span class="val" data-hha-hud="combo">x0</span>
      </div>
      <div class="row">
        <span class="label">🥦 ของดี</span>
        <span class="val" data-hha-hud="good">0</span>
      </div>
      <div class="row">
        <span class="label">❌ พลาด</span>
        <span class="val" data-hha-hud="miss">0</span>
      </div>
      <div class="row">
        <span class="label">⏱ เวลา</span>
        <span class="val" data-hha-hud="time">60s</span>
      </div>
    </div>
  `;
  document.body.appendChild(hudRoot);

  hudScoreEl = hudRoot.querySelector('[data-hha-hud="score"]');
  hudComboEl = hudRoot.querySelector('[data-hha-hud="combo"]');
  hudGoodEl  = hudRoot.querySelector('[data-hha-hud="good"]');
  hudMissEl  = hudRoot.querySelector('[data-hha-hud="miss"]');
  hudTimeEl  = hudRoot.querySelector('[data-hha-hud="time"]');
}

function renderHud() {
  if (!hudRoot) return;
  if (hudScoreEl) hudScoreEl.textContent = String(score | 0);
  if (hudComboEl) hudComboEl.textContent = 'x' + String(combo | 0);
  if (hudGoodEl)  hudGoodEl.textContent  = String(goodHits | 0);
  if (hudMissEl)  hudMissEl.textContent  = String(misses | 0);
  if (hudTimeEl)  hudTimeEl.textContent  = String(Math.max(0, timeLeftSec | 0)) + 's';
}

// ---- FEVER / Shield helpers ----
function mult() {
  return FEVER_ACTIVE ? 2 : 1;
}

function gainFever(n) {
  if (FEVER_ACTIVE) return;
  fever = Math.max(0, Math.min(100, fever + n));
  setFever(fever);
  if (fever >= 100) {
    window.feverStart();
  }
}

function decayFever(base) {
  const d = FEVER_ACTIVE ? 10 : base;
  fever = Math.max(0, fever - d);
  setFever(fever);
  if (FEVER_ACTIVE && fever <= 0) {
    FEVER_ACTIVE = false;
    window.FEVER_ACTIVE = false;
    setFeverActive(false);
    emit('hha:fever', { state: 'end' });
  }
}

// ---- Input Binding (PC + Mobile + VR) ----
function bindInputHandlers(scene) {
  if (inputBound || !scene) return;
  inputBound = true;

  // รองรับ trigger / tap (A-Frame จะยิง event 'click' ใส่ entity)
  scene.addEventListener('click', (e) => {
    if (!running) return;
    const t = e.target;
    if (t && t.dataset && t.dataset.hhaTgt) {
      onHitTarget(t);
    }
  });

  // รองรับ mouse บน PC โดยอ่านจาก raycaster ของ <a-cursor>
  scene.addEventListener('mousedown', () => {
    if (!running) return;
    const cursor = document.getElementById('cursor');
    if (!cursor || !cursor.components || !cursor.components.raycaster) return;
    const rc = cursor.components.raycaster;
    const target = rc.intersectedEls && rc.intersectedEls[0];
    if (target && target.dataset && target.dataset.hhaTgt) {
      onHitTarget(target);
    }
  });
}

// ---- สร้างเป้า ----
function spawnTarget() {
  if (!running || !sceneEl || !targetRoot) return;

  const cfg = difficulty.get(difficultyLvl) || { size: 0.8, rate: 800, life: 2200 };

  const isGood = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char, type, palette;
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
  el.dataset.type    = type;
  el.dataset.char    = char;
  el.dataset.palette = palette;
  el.dataset.hhaTgt  = '1';

  const x = (Math.random() - 0.5) * 4;     // -2..+2
  const y = 1.0 + Math.random() * 1.0;     // 1..2
  const z = -2.5 - Math.random() * 1.0;    // -2.5..-3.5
  el.setAttribute('position', `${x} ${y} ${z}`);

  targetRoot.appendChild(el);

  // อายุของเป้า
  const lifeMs = cfg.life;
  const timeoutId = setTimeout(() => {
    if (!el.parentNode) return;
    // ถ้าเป็นของดีแล้วปล่อยหลุด = พลาด
    if (type === 'good') {
      goodMissTimeout++;
      misses++;
      combo = 0;
      window.combo = combo;
      emit('hha:miss', { reason: 'timeout-good' });
      decayFever(10);
    } else {
      // หลบของขยะ = พฤติกรรมดี → +เฟเวอร์เล็กน้อย
      gainFever(4);
    }
    try { el.remove(); } catch (_) {}
    renderHud();
  }, lifeMs);

  // ถ้าเกมหยุดกลางคัน
  el.addEventListener('removed', () => clearTimeout(timeoutId));

  // plan spawn ถัดไป
  const nextDelay = cfg.rate;
  spawnTimer = setTimeout(spawnTarget, nextDelay);
}

// ---- ยิงโดนเป้า ----
function onHitTarget(targetEl) {
  if (!running || !targetEl || !targetEl.parentNode || !sceneEl) return;

  const type    = targetEl.dataset.type;
  const char    = targetEl.dataset.char;
  const palette = targetEl.dataset.palette || 'default';

  let pos;
  try {
    // THREE มาจาก A-Frame
    // eslint-disable-next-line no-undef
    pos = targetEl.object3D.getWorldPosition(new THREE.Vector3());
  } catch (_) {
    pos = { x: 0, y: 1.4, z: -1.8 };
  }

  let delta = 0;

  if (type === 'good') {
    // Power-ups
    if (char === STAR) {
      delta = 40 * mult();
      score += delta;
      gainFever(10);
    } else if (char === DIA) {
      delta = 80 * mult();
      score += delta;
      gainFever(30);
    } else if (char === SHIELD_EMOJI) {
      delta = 20;
      score += delta;
      shield = Math.min(3, shield + 1);
      setShield(shield);
    } else if (char === FIRE) {
      delta = 25;
      score += delta;
      window.feverStart();
    } else {
      // ของดีปกติ
      delta = (20 + combo * 2) * mult();
      score += delta;
      gainFever(8 + combo * 0.6);
    }

    goodHits++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    Quest.onGood();

    burstAt(sceneEl, pos, { mode: palette });
    floatScore(sceneEl, pos, '+' + delta, '#22c55e');

  } else {
    // ตีโดนของขยะ
    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, pos, { mode: 'hydration' });
      floatScore(sceneEl, pos, '🛡️', '#60a5fa');
    } else {
      delta = -15;
      score = Math.max(0, score + delta);
      combo = 0;
      junkHits++;
      misses++;
      decayFever(18);
      Quest.onBad();
      emit('hha:miss', { reason: 'hit-junk' });
      burstAt(sceneEl, pos, { mode: palette });
      floatScore(sceneEl, pos, String(delta), '#ef4444');
    }
  }

  window.score  = score;
  window.combo  = combo;
  window.misses = misses;

  emit('hha:score', { score, combo, delta });

  try { targetEl.remove(); } catch (_) {}
  renderHud();
}

// ---- tick รายวินาที ----
function gameTick() {
  if (!running) return;
  elapsedSec += 1;
  timeLeftSec = Math.max(0, durationSec - elapsedSec);

  // decay fever ตาม combo
  if (combo <= 0) decayFever(6);
  else            decayFever(2);

  emit('hha:time', { sec: timeLeftSec });
  renderHud();
}

// ---- Reset state ตอนเริ่มเกมใหม่ ----
function resetState() {
  score           = 0;
  combo           = 0;
  comboMax        = 0;
  goodHits        = 0;
  junkHits        = 0;
  goodMissTimeout = 0;
  misses          = 0;
  shield          = 0;
  fever           = 0;
  FEVER_ACTIVE    = false;

  elapsedSec  = 0;
  timeLeftSec = durationSec;

  window.score        = 0;
  window.combo        = 0;
  window.misses       = 0;
  window.FEVER_ACTIVE = false;
}

// ---- Public API ----
export const GameEngine = {
  /**
   * start(level, opts?)
   *  level: 'easy' | 'normal' | 'hard'
   *  opts.durationSec: เวลาเล่น (วินาที) [optional, default 60]
   */
  start(level = 'normal', opts = {}) {
    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[GameEngine] A-Frame <a-scene> not found');
      return;
    }

    difficultyLvl = String(level || 'normal').toLowerCase();
    durationSec   = (opts && Number.isFinite(opts.durationSec))
      ? Math.max(20, Math.min(180, opts.durationSec | 0))
      : 60;
    timeLeftSec   = durationSec;
    elapsedSec    = 0;

    resetState();
    ensureFeverBar();
    setFever(0);
    setFeverActive(false);
    setShield(0);
    setShardMode('goodjunk');
    ensureHud();
    renderHud();

    bindInputHandlers(sceneEl);

    // Reset target root
    if (targetRoot && targetRoot.parentNode) {
      targetRoot.parentNode.removeChild(targetRoot);
    }
    targetRoot = document.createElement('a-entity');
    targetRoot.id = 'hha-target-root';
    sceneEl.appendChild(targetRoot);

    // set difficulty
    difficulty.set(difficultyLvl);

    // timers
    if (gameTimer) clearInterval(gameTimer);
    if (spawnTimer) clearTimeout(spawnTimer);
    running       = true;
    window.running = true;

    gameTimer  = setInterval(gameTick, 1000);
    spawnTimer = setTimeout(spawnTarget, 900);

    Quest.start(); // เริ่มระบบ Mini Quest แบบ serial

    emit('hha:score', { score, combo, delta: 0 });
    emit('hha:time', { sec: timeLeftSec });
  },

  stop() {
    if (!running) return;
    running       = false;
    window.running = false;

    if (gameTimer) { clearInterval(gameTimer); gameTimer = null; }
    if (spawnTimer) { clearTimeout(spawnTimer); spawnTimer = null; }

    Quest.stop();

    // ล้างเป้า
    if (targetRoot && targetRoot.parentNode) {
      targetRoot.parentNode.removeChild(targetRoot);
    }
    targetRoot = null;

    // ลบ UI (HUD / Fever bar / Coach ฯลฯ)
    document.querySelectorAll('[data-hha-ui]').forEach(el => {
      try { el.remove(); } catch (_) {}
    });
    hudRoot = null;
    hudScoreEl = hudComboEl = hudGoodEl = hudMissEl = hudTimeEl = null;

    // ส่งสรุปสำหรับ research logger
    emit('hha:end', {
      mode:            'Good vs Junk VR',
      difficulty:      difficultyLvl,
      duration:        durationSec,
      score,
      comboMax,
      goodHits,
      junkHits,
      goodMissTimeout,
      misses
    });
  },

  // สำหรับ debug / วิจัยเพิ่มเติม
  getState() {
    return {
      running,
      difficulty: difficultyLvl,
      durationSec,
      timeLeftSec,
      score,
      combo,
      comboMax,
      goodHits,
      junkHits,
      goodMissTimeout,
      misses,
      shield,
      fever,
      FEVER_ACTIVE
    };
  }
};

export default GameEngine;
