// === fitness/js/main-shadow.js (Shadow Breaker bootstrap + boss/diff — 2025-11-24) ===
'use strict';

import { computeShadowSpawnParams, ShadowBossState } from './shadow-config.js';
// สมมติ engine หลักของคุณ export class ShadowEngine ไว้
import { ShadowEngine } from './js/engine.js';

function getParam(name, def) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || def;
}

window.addEventListener('DOMContentLoaded', () => {
  const diffKey = getParam('diff', 'easy');  // easy / normal / hard
  const durSec  = parseInt(getParam('time', '60'), 10) || 60;

  const host = document.querySelector('#shadowRoot') || document.body;

  const bossState = new ShadowBossState(diffKey);

  // เตรียมค่า spawn ชุดแรก (phase 1, HP เต็ม)
  let spawnParams = computeShadowSpawnParams(diffKey, 1.0);

  const engine = new ShadowEngine({
    host,
    durationSec: durSec,
    difficulty: diffKey,
    // ค่าพื้นฐาน start ด้วยจาก spawnParams แรก
    spawnInterval: spawnParams.spawnInterval,
    targetLifetime: spawnParams.lifetime,
    maxActiveTargets: spawnParams.maxActive,
    targetSizePx: spawnParams.sizePx,
    weights: spawnParams.weights,
    bossMaxHP: bossState.maxHP
  });

  // 🔹 hook: เวลา engine จะ spawn เป้าใหม่ → ดึงค่าที่อัปเดตตาม HP/phase
  engine.onBeforeSpawnTarget = function () {
    const ratio = bossState.hp / bossState.maxHP;
    spawnParams = computeShadowSpawnParams(diffKey, ratio);

    // อัปเดตค่าต่าง ๆ ใน engine
    engine.setSpawnInterval(spawnParams.spawnInterval);
    engine.setTargetLifetime(spawnParams.lifetime);
    engine.setMaxActiveTargets(spawnParams.maxActive);
    engine.setTargetSizeRange(spawnParams.sizePx);
    engine.setTargetWeights(spawnParams.weights);

    // ถ้า phase เปลี่ยนหรือ near-death เปลี่ยน → ส่ง event ให้ HUD / เอฟเฟกต์
    engine.updatePhase(spawnParams.phase, spawnParams.nearDeath);
  };

  // 🔹 hook: เวลา player ตีบอสโดน
  engine.onBossHit = function (damage) {
    const info = bossState.hit(damage || 1);

    if (info.phaseChanged || info.nearDeathChanged) {
      // แจ้ง HUD / เอฟเฟกต์บอส (งานใหญ่ 2 จะเอาไปใช้ต่อ)
      engine.updatePhase(info.phase, info.nearDeath);
    }

    engine.updateBossHP(info.hp, bossState.maxHP);

    if (info.hp <= 0) {
      engine.finishBoss(true); // clear stage
    }
  };

  // ถ้ามี HUD ให้เซ็ตค่าเริ่มต้น/label ต่าง ๆ ตรงนี้ได้
  if (engine.setBossLabel) {
    engine.setBossLabel(diffKey.toUpperCase());
  }

  engine.start();
});
