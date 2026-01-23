// === /herohealth/vr-groups/groups.safe.js ===
// PATCH: decorateTarget + emoji by group (same idea as Plate)

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { HHA_EMOJI, pickFrom } from '../vr/hha-emoji-pack.js';

// ... (ของเดิมทั้งหมด)

/* ✅ NEW: decorate target with emoji by group */
function decorateTarget(el, t){
  // กลุ่มอาหาร 1-5
  const key = ['g1','g2','g3','g4','g5'][t.groupIndex] || 'g1';

  // ถ้าเป็น GOOD -> โชว์ emoji ของหมู่นั้น (หลากหลาย)
  if(t.kind === 'good'){
    const emoji = pickFrom(HHA_EMOJI.groups[key], t.rng);
    el.textContent = emoji;
    el.style.fontSize = Math.max(18, Math.round(t.size * 0.40)) + 'px';
    el.style.fontWeight = '900';
    return;
  }

  // ถ้าเป็น JUNK/DECOY -> เลือก 1) ว่างไว้ 2) ใส่ junk emoji
  // ตัวเลือก A: ว่าง (ดูเป็นวงหลอกอย่างเดียว)
  el.textContent = '';

  // ตัวเลือก B: ใส่ junk emoji (ถ้าอยากให้เด็กรู้สึก “หลอกจริง”)
  // const emoji = pickFrom(HHA_EMOJI.junk, t.rng);
  // el.textContent = emoji;
  // el.style.fontSize = Math.max(18, Math.round(t.size * 0.40)) + 'px';
}

/* ตัวอย่าง: จุดที่สร้าง spawner (หา function makeSpawner / initSpawner ในไฟล์เดิม) */
function makeSpawner(mount){
  return spawnBoot({
    mount,
    seed: STATE.cfg.seed,              // ของเดิม
    spawnRate: STATE.spawnRateMs,      // ของเดิม (หรือ diff-based)
    sizeRange: [44,64],                // ของเดิมหรือปรับได้
    kinds: [
      { kind:'good', weight:0.75 },
      { kind:'junk', weight:0.25 },
    ],

    // ✅ NEW
    decorateTarget,

    // ของเดิม: onHit / onExpire
    onHit: (t)=>{ /* ... ของเดิม ... */ },
    onExpire: (t)=>{ /* ... ของเดิม ... */ },
  });
}

// ... (ของเดิมทั้งหมด)