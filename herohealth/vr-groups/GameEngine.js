// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Emoji Pop Targets (เวอร์ชันง่าย ให้เป้า emoji โผล่แน่นอนก่อน)
// ใช้ร่วมกับ: vr/emoji-image.js (emojiTexture)

'use strict';

import { emojiTexture } from '../vr/emoji-image.js';

export const GameEngine = (function () {
  const A = window.AFRAME;

  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || {
      ensureFeverBar () {},
      setFever () {},
      setFeverActive () {},
      setShield () {}
    };

  // ---------- ชุด emoji ตามหมู่ ----------
  const GROUP1 = ['🍚','🍞','🥖','🥐','🥨','🥯'];         // ข้าว-แป้ง
  const GROUP2 = ['🥩','🍗','🍖','🐟','🍳'];             // โปรตีน
  const GROUP3 = ['🥛','🧀','🥚'];                      // นม/ผลิตภัณฑ์นม
  const GROUP4 = ['🥦','🥕','🍅','🥬','🍌','🍎','🍊'];   // ผัก-ผลไม้

  // รวมเป็น "ของดี"
  const GOOD = [...GROUP1, ...GROUP2, ...GROUP3, ...GROUP4];
  // สมมุติของขยะ
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🍰','🧋','🥤'];

  // ---------- state หลัก ----------
  let sceneEl = null;
  let running = false;
  let spawnTimer = null;
  let activeTargets = [];

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  // difficulty (ง่าย / ปกติ / ยาก)
  let SPAWN_INTERVAL  = 1000;
  let TARGET_LIFETIME = 1300;
  let MAX_ACTIVE      = 4;

  // fever ง่าย ๆ ไว้ขยับ bar
  const FEVER_MAX      = 100;
  const FEVER_HIT_GAIN = 14;
  const FEVER_MISS_LOSS = 26;
  let fever = 0;
  let feverActive = false;

  // ---------- helpers ----------
  function emit (type, detail) {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function clamp (v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function setFever (value, stateHint) {
    fever = clamp(value, 0, FEVER_MAX);
    if (FeverUI && FeverUI.setFever) FeverUI.setFever(fever);
    emit('hha:fever', {
      state: stateHint || (feverActive ? 'active' : 'charge'),
      value: fever,
      max: FEVER_MAX
    });
  }

  function emitScore () {
    emit('hha:score', { score, combo, misses });
  }

  function emitMiss () {
    emit('hha:miss', { misses });
  }

  function emitJudge (label) {
    emit('hha:judge', { label });
  }

  function coach (text) {
    if (!text) return;
    emit('hha:coach', { text });
  }

  function removeTarget (el) {
    activeTargets = activeTargets.filter(t => t !== el);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---------- สร้างเป้า emoji ในฉาก A-Frame ----------
  function createTargetEntity (emoji, kind) {
    if (!sceneEl) return null;

    const root = document.createElement('a-entity');

    const x = -1.2 + Math.random() * 2.4;   // [-1.2, 1.2]
    const y = 1.8  + Math.random() * 1.0;   // [1.8, 2.8]
    const z = -3.0;

    root.setAttribute('position', { x, y, z });
    root.setAttribute('scale', { x: 1, y: 1, z: 1 });
    root.dataset.kind = kind;
    root.dataset.emoji = emoji;
    root.dataset.spawnAt = String(performance.now() || Date.now());

    // วงกลมพื้นหลัง (สีดี/ขยะ)
    const circle = document.createElement('a-circle');
    circle.setAttribute('radius', 0.4);
    circle.setAttribute('material', {
      color: kind === 'good' ? '#22c55e' : '#f97316',
      opacity: 0.32,
      metalness: 0,
      roughness: 1
    });

    // emoji ด้านหน้า (ใช้ texture จาก emojiTexture)
    const sprite = document.createElement('a-plane');
    sprite.setAttribute('width', 0.75);
    sprite.setAttribute('height', 0.75);
    sprite.setAttribute('position', { x: 0, y: 0, z: 0.01 });
    sprite.setAttribute('material', {
      src: emojiTexture(emoji, 220),
      transparent: true,
      alphaTest: 0.01
    });

    // ให้ raycaster เห็น
    circle.setAttribute('data-hha-tgt', '1');
    sprite.setAttribute('data-hha-tgt', '1');

    const hitHandler = () => onHit(root);
    circle.addEventListener('click', hitHandler);
    sprite.addEventListener('click', hitHandler);

    root.appendChild(circle);
    root.appendChild(sprite);
    sceneEl.appendChild(root);

    // หมดเวลา = MISS (สำหรับของดี)
    setTimeout(() => {
      if (!running) return;
      if (!root.parentNode) return;
      onExpire(root);
    }, TARGET_LIFETIME);

    return root;
  }

  // ---------- เมื่อโดนตีเป้า ----------
  function onHit (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      combo += 1;
      comboMax = Math.max(comboMax, combo);
      const base = 10 + combo * 2;
      const before = score;
      score += base;
      const gain = score - before;

      setFever(fever + FEVER_HIT_GAIN, 'charge');

      coach(`เยี่ยม! เลือก ${emoji} ได้ถูกหมู่แล้ว ✨`);
      emitScore();
      emitJudge('Good + ' + gain);
    } else {
      // junk
      misses += 1;
      combo = 0;
      score = Math.max(0, score - 8);
      setFever(fever - FEVER_MISS_LOSS, 'charge');

      coach('เผลอแตะของขยะแล้ว ระวังพวก 🍔🍟🍩 อีกนะ');
      emitMiss();
      emitScore();
      emitJudge('Miss');
    }
  }

  // ---------- หมดเวลาแล้วยังไม่ได้แตะ (ของดี) ----------
  function onExpire (el) {
    if (!running || !el || !el.parentNode) return;

    const kind = el.dataset.kind || 'good';
    const emoji = el.dataset.emoji || '';

    removeTarget(el);

    if (kind === 'good') {
      misses += 1;
      combo = 0;
      setFever(fever - FEVER_MISS_LOSS, 'charge');

      coach(`พลาด ${emoji} ไป ลองเล็งให้ตรงขึ้นอีกนิดนะ 😊`);
      emitMiss();
      emitScore();
      emitJudge('Miss');
    }
  }

  // ---------- สุ่ม spawn ----------
  function pickType () {
    // ง่าย ๆ: ส่วนใหญ่เป็นของดี บางครั้งใส่ของขยะ
    const r = Math.random();
    return r < 0.78 ? 'good' : 'junk';
  }

  function tickSpawn () {
    if (!running) return;
    if (activeTargets.length >= MAX_ACTIVE) return;

    const type = pickType();
    const emoji = (type === 'good'
      ? GOOD[Math.floor(Math.random() * GOOD.length)]
      : JUNK[Math.floor(Math.random() * JUNK.length)]
    );

    const el = createTargetEntity(emoji, type);
    if (el) activeTargets.push(el);
  }

  // ---------- difficulty ----------
  function applyDifficulty (diffKey) {
    const d = String(diffKey || 'normal').toLowerCase();
    if (d === 'easy') {
      SPAWN_INTERVAL  = 1300;
      TARGET_LIFETIME = 1500;
      MAX_ACTIVE      = 3;
    } else if (d === 'hard') {
      SPAWN_INTERVAL  = 800;
      TARGET_LIFETIME = 1000;
      MAX_ACTIVE      = 5;
    } else {
      SPAWN_INTERVAL  = 1000;
      TARGET_LIFETIME = 1300;
      MAX_ACTIVE      = 4;
    }
  }

  // ---------- start / stop ----------
  function start (diffKey) {
    if (running) return;

    sceneEl = document.querySelector('a-scene');
    if (!sceneEl) {
      console.error('[FoodGroupsVR] ไม่พบ <a-scene>');
      return;
    }

    running = true;
    score = 0;
    combo = 0;
    comboMax = 0;
    misses = 0;
    fever = 0;
    feverActive = false;

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    applyDifficulty(diffKey);

    if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    if (FeverUI && FeverUI.setFever)      FeverUI.setFever(0);
    if (FeverUI && FeverUI.setFeverActive)FeverUI.setFeverActive(false);

    emitScore();
    emitJudge('');
    coach('แตะอาหารดีจากแต่ละหมู่ให้ครบตามภารกิจเลย ✨');

    tickSpawn();
    spawnTimer = setInterval(tickSpawn, SPAWN_INTERVAL);
  }

  function stop (reason) {
    if (!running) return;
    running = false;

    clearInterval(spawnTimer);
    spawnTimer = null;

    activeTargets.forEach(el => el.parentNode && el.parentNode.removeChild(el));
    activeTargets = [];

    coach('จบเกมแล้ว! ดูสรุปคะแนนด้านบนได้เลย 🎉');

    emit('hha:end', {
      mode: 'FoodGroupsVR',
      score,
      comboMax,
      misses,
      reason: reason || 'normal'
    });
  }

  return { start, stop };
})();