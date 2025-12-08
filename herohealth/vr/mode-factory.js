// === /herohealth/vr/mode-factory.js ===
'use strict';

import { HHA_DIFF_TABLE } from './hha-diff-table.js';

// เลือก engine config จากตารางกลาง
function pickEngineConfig(modeKey, diffKey) {
  const table = HHA_DIFF_TABLE[modeKey] || {};
  const row =
    table[diffKey] ||
    table.normal ||
    Object.values(table)[0] || {};   // fallback แถวแรกถ้าไม่เจอ
  return row.engine || {};
}

export async function boot(opts = {}) {
  const modeKey = String(opts.modeKey || 'goodjunk').toLowerCase();
  const diffKey = String(opts.difficulty || 'normal').toLowerCase();

  // ⬇ ใช้ config จาก HHA_DIFF_TABLE
  const engCfg = pickEngineConfig(modeKey, diffKey);

  const SPAWN_INTERVAL = engCfg.SPAWN_INTERVAL ?? 1000;
  const ITEM_LIFETIME  = engCfg.ITEM_LIFETIME  ?? 2200;
  const MAX_ACTIVE     = engCfg.MAX_ACTIVE     ?? 4;
  const SIZE_FACTOR    = engCfg.SIZE_FACTOR    ?? 1.0;

  const GOOD_RATIO     = engCfg.GOOD_RATIO     ?? 0.65;
  const POWER_RATIO    = engCfg.POWER_RATIO    ?? 0.10;
  const FEVER_GAIN_HIT = engCfg.FEVER_GAIN_HIT ?? 6;
  const FEVER_DECAY_SEC= engCfg.FEVER_DECAY_SEC?? 5;

  // จากนั้นใช้ค่าเหล่านี้ใน logic spawn/ judge ตามที่มีอยู่เดิม…
  // เช่น:
  //
  // let spawnTimer = 0;
  // function tickSpawn(dt) { ... }
  //
  // และเอา SIZE_FACTOR ไปใช้คูณขนาดเป้าเวลาสร้าง target

  // สุดท้ายคืน controller ตามที่เคยทำ
  return {
    stop() {
      // cleanup เดิมของ factoryBoot
    }
  };
}

export default { boot };