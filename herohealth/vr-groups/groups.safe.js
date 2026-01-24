// === /herohealth/vr-groups/groups.safe.js ===
// PATCH: decorateTarget + emoji by group (same idea as Plate)

import { boot as spawnBoot } from '../vr/mode-factory.js';
import { HHA_EMOJI, pickFrom } from '../vr/hha-emoji-pack.js';

// ... (ของเดิมทั้งหมดของคุณ)

// ✅ helper: map groupIndex -> key (g1..g5)
function groupKeyFromTarget(t){
  // ถ้า mode-factory ส่ง key มาแล้ว ใช้เลย
  if (t && typeof t.groupKey === 'string' && t.groupKey) return t.groupKey;

  // ถ้าส่ง groupIndex 0..4
  const idx = Number(t && t.groupIndex);
  const keys = ['g1','g2','g3','g4','g5'];
  if (Number.isFinite(idx) && idx >= 0 && idx < keys.length) return keys[idx];

  // fallback
  return 'g1';
}

/* ✅ NEW: decorate target with emoji by group */
function decorateTarget(el, t){
  try{
    const key = groupKeyFromTarget(t);

    // ✅ ทำให้ CSS render emoji ผ่าน data-emoji (คมกว่า textContent และจัดกึ่งกลางง่าย)
    // (CSS ด้านล่างจะใช้ attr(data-emoji) เป็นตัวแสดงผล)
    el.textContent = ''; // ให้ pseudo-element แสดงแทน
    el.setAttribute('data-emoji', '');

    // font size ตาม size ของ target (ถ้า size เป็น px หรือ scale ก็รองรับ)
    const s = Number(t && t.size);
    const scale = Number.isFinite(s) ? s : 1;
    const fs = Math.max(26, Math.round(44 * scale)); // ปรับได้
    el.style.setProperty('--emoji-fs', fs + 'px');

    if ((t && t.kind) === 'good'){
      const emoji = pickFrom(HHA_EMOJI.groups[key], t.rng);
      el.setAttribute('data-emoji', emoji);

      // optional: tag type เพื่อให้ CSS เพิ่ม glow/outline ได้
      el.classList.add('is-emoji');
      el.setAttribute('aria-label', 'good ' + key);
      return;
    }

    // ✅ JUNK/DECOY: default = ว่างไว้ (วงหลอกอย่างเดียว)
    el.classList.add('is-emoji');
    el.setAttribute('aria-label', String(t && t.kind || 'other'));

    // ---- OPTION: ถ้าอยากให้ “หลอกจริง” ใส่ junk emoji ให้เปิดตรงนี้ ----
    // if ((t && t.kind) === 'junk' || (t && t.kind) === 'decoy'){
    //   const emoji = pickFrom(HHA_EMOJI.junk, t.rng);
    //   el.setAttribute('data-emoji', emoji);
    // }

  }catch(_){}
}

/* จุดสร้าง spawner */
function makeSpawner(mount){
  return spawnBoot({
    mount,

    // ของเดิมของคุณ
    seed: STATE.cfg.seed,
    spawnRate: STATE.spawnRateMs,
    sizeRange: [44, 64],
    kinds: [
      { kind:'good', weight:0.75 },
      { kind:'junk', weight:0.25 },
    ],

    // ✅ NEW: ใส่ decorator
    decorateTarget,

    // ของเดิมของคุณ
    onHit: (t)=>{ /* ... ของเดิม ... */ },
    onExpire: (t)=>{ /* ... ของเดิม ... */ },
  });
}

// ... (ของเดิมทั้งหมดของคุณ)