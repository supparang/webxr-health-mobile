// === /HeroHealth/vr-goodjunk/game-engine-goodjunk-vr.js ===
// สมองเกม Good vs Junk (VR) – spawn เป้า, คะแนน, FEVER, เควสต์
// ใช้ร่วมกับ input-cross.js

import { ensureFeverBar, setFever, setFeverActive, setShield } from "../vr/ui-fever.js";
import { Difficulty } from "../vr/difficulty.js";
import { emojiImage } from "../vr/emoji-image.js";
import { setShardMode, burstAt, floatScore } from "../vr/aframe-particles.js";
import { Quest } from "../vr/quest-serial.js";

const GOOD = [
  "🥦","🥕","🍎","🐟","🥛","🍊","🍌","🍇",
  "🥬","🍚","🥜","🍞","🍓","🍍","🥝","🍐"
];
const JUNK = [
  "🍔","🍟","🍕","🍩","🍪","🧁","🥤","🧋",
  "🍫","🌭","🍰","🍬"
];

const STAR = "⭐";
const DIA  = "💎";
const SHIELD_EMOJI = "🛡️";
const FIRE = "🔥";
const BONUS = [STAR, DIA, SHIELD_EMOJI, FIRE];

let sceneEl = null;
let targetRoot = null;
let difficulty = new Difficulty();
let gameConfig = null;

let score = 0;
let combo = 0;
let misses = 0;
let shield = 0;
let fever = 0;

let running = false;
let gameTimer = null;
let spawnTimer = null;

function emit(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_) {}
}

function syncGlobals() {
  window.score = score;
  window.combo = combo;
  window.misses = misses;
  window.FEVER_ACTIVE = combo >= 0 && fever > 0; // flag คร่าว ๆ
  window.running = running;
}

function mult() {
  return window.FEVER_ACTIVE ? 2 : 1;
}

function feverStart() {
  if (window.FEVER_ACTIVE) return;
  fever = 100;
  setFever(fever);
  window.FEVER_ACTIVE = true;
  setFeverActive(true);
  Quest.onFever();
  emit("hha:fever", { state: "start" });
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
    emit("hha:fever", { state: "end" });
  }
}

function ensureSceneAndRoot() {
  if (!sceneEl) sceneEl = document.querySelector("a-scene");
  if (!sceneEl) return;
  if (!targetRoot) {
    targetRoot = document.createElement("a-entity");
    targetRoot.id = "hhaTargetRoot";
    sceneEl.appendChild(targetRoot);
  }
}

function spawnTarget() {
  if (!running) return;
  ensureSceneAndRoot();
  if (!sceneEl || !targetRoot) return;

  const cfg = gameConfig;
  const isGood = Math.random() < 0.65;
  const usePower = Math.random() < 0.08;

  let char;
  let type;
  let palette;

  if (usePower) {
    char = BONUS[(Math.random() * BONUS.length) | 0];
    type = "good";       // power-ups ถือเป็น good
    palette = "groups";  // สีฟ้า/เหลือง
  } else if (isGood) {
    char = GOOD[(Math.random() * GOOD.length) | 0];
    type = "good";
    palette = "goodjunk";
  } else {
    char = JUNK[(Math.random() * JUNK.length) | 0];
    type = "bad";
    palette = "plate";
  }

  const scale = cfg.size * 0.6;
  const el = emojiImage(char, scale);
  el.dataset.type = type;
  el.dataset.char = char;
  el.dataset.palette = palette;
  el.dataset.hhaTgt = "1"; // ให้ raycaster ยิงโดน

  const x = (Math.random() - 0.5) * 4;      // -2..2
  const y = 1.0 + Math.random() * 1.0;      // 1..2
  const z = -2.5 - Math.random() * 1.0;     // -2.5..-3.5
  el.setAttribute("position", `${x} ${y} ${z}`);

  targetRoot.appendChild(el);

  // หมดอายุ
  setTimeout(() => {
    if (!running || !el.parentNode) return;
    if (type === "good") {
      // ปล่อยของดีหลุด → พลาด
      misses++;
      combo = 0;
      emit("hha:miss", {});
    } else {
      // หลบของขยะ → เพิ่ม fever เล็กน้อย
      gainFever(4);
    }
    el.remove();
    syncGlobals();
  }, cfg.life);

  // รอบถัดไป
  spawnTimer = setTimeout(spawnTarget, cfg.rate);
}

function gameTick() {
  if (!running) return;
  decayFever(combo <= 0 ? 6 : 2);
}

/**
 * ใช้ยิงเป้าเมื่อ input-cross ระบุว่ามี target ถูกเล็งอยู่
 */
function hitTarget(targetEl) {
  if (!running || !targetEl || !targetEl.parentNode) return;

  ensureSceneAndRoot();
  if (!sceneEl) return;

  const type = targetEl.dataset.type;
  const char = targetEl.dataset.char;
  const palette = targetEl.dataset.palette || "goodjunk";

  const worldPos = new THREE.Vector3();
  targetEl.object3D.getWorldPosition(worldPos);

  let delta = 0;

  if (type === "good") {
    // ----- ของดี / power-ups -----
    if (char === STAR) {
      delta = 40 * mult();
      gainFever(10);
    } else if (char === DIA) {
      delta = 80 * mult();
      gainFever(30);
    } else if (char === SHIELD_EMOJI) {
      delta = 20;
      shield = Math.min(3, shield + 1);
      setShield(shield);
    } else if (char === FIRE) {
      delta = 25;
      feverStart();
    } else {
      delta = (20 + combo * 2) * mult();
      gainFever(8 + combo * 0.6);
    }

    score += delta;
    combo++;
    Quest.onGood();
    burstAt(sceneEl, worldPos, { mode: palette });
    floatScore(sceneEl, worldPos, `+${delta}`, "#22c55e");
  } else {
    // ----- กดโดนของขยะ -----
    if (shield > 0) {
      shield--;
      setShield(shield);
      burstAt(sceneEl, worldPos, { mode: "hydration" });
      floatScore(sceneEl, worldPos, "SHIELDED!", "#60a5fa");
    } else {
      delta = -15;
      score = Math.max(0, score + delta);
      combo = 0;
      misses++;
      decayFever(18);
      Quest.onBad();
      emit("hha:miss", {});
      burstAt(sceneEl, worldPos, { mode: palette });
      floatScore(sceneEl, worldPos, `${delta}`, "#ef4444");
    }
  }

  emit("hha:score", { score, combo, delta });
  targetEl.remove();
  syncGlobals();
}

/* ===== Public API ===== */

function start(level = "normal") {
  ensureSceneAndRoot();
  if (!sceneEl) {
    console.error("[GameEngineVR] A-Frame scene not found.");
    return;
  }

  // reset state
  score = 0;
  combo = 0;
  misses = 0;
  shield = 0;
  fever = 0;
  running = true;

  // FEVER / เกราะ HUD
  ensureFeverBar();
  setFever(0);
  setShield(0);
  setFeverActive(false);
  setShardMode("goodjunk");

  // difficulty
  difficulty.set(level);
  gameConfig = difficulty.get(); // { size, rate, life }

  // เคลียร์ของเก่า
  if (targetRoot) targetRoot.innerHTML = "";

  if (gameTimer) clearInterval(gameTimer);
  if (spawnTimer) clearTimeout(spawnTimer);
  gameTimer = setInterval(gameTick, 1000);
  spawnTimer = setTimeout(spawnTarget, 900);

  // เริ่มเควสต์
  Quest.start();

  syncGlobals();
  emit("hha:score", { score: 0, combo: 0 });
}

function stop() {
  if (!running) return;
  running = false;

  if (gameTimer) clearInterval(gameTimer);
  if (spawnTimer) clearTimeout(spawnTimer);
  gameTimer = null;
  spawnTimer = null;

  if (targetRoot) targetRoot.innerHTML = "";

  Quest.stop();
  emit("hha:end", { score });
  syncGlobals();
}

export const GameEngineVR = {
  start,
  stop,
  hitTarget
};

export default GameEngineVR;
