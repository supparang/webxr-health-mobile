// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// PATCH: Food 5 groups mapping + decorateTarget style (like Plate)
// NOTE: เพิ่ม import นี้ไว้บนสุดของไฟล์ (ถ้าไฟล์เป็น module)
import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

/* ------------------------------------------------
 * (1) เพิ่ม helper: choose group + decorateTarget
 * ------------------------------------------------ */
function chooseGroupId(rng){
  // 1..5 เท่า ๆ กัน (จะทำ weighted ภายหลังได้)
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
}

function decorateTarget(el, t){
  // t.kind: 'good' | 'junk'
  // t.rng: rng function (seeded ใน research ได้)
  if(!el) return;

  if(t.kind === 'good'){
    const gid = t.groupId || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${labelForGroup(gid)} ${emo}`);
  }else{
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }
}

/* ------------------------------------------------
 * (2) เพิ่ม state สำหรับ mini quest (โบนัส) — ไม่ทำให้ซ้ำ Plate
 * ------------------------------------------------ */
const GJ_META = {
  // สำหรับ mini quest แบบ “เก็บครบ 3 หมู่ใน 12 วิ”
  windowSec: 12,
  windowStartAt: 0,
  windowGroups: new Set(), // เก็บ groupId ที่ยิง/แตะได้ในหน้าต่างเวลา
  miniDone: false
};

function resetMiniWindow(){
  GJ_META.windowStartAt = (performance.now ? performance.now() : Date.now());
  GJ_META.windowGroups.clear();
  GJ_META.miniDone = false;
}

// เรียกทุกครั้งที่ hit good
function onHitGoodMeta(groupId){
  const now = (performance.now ? performance.now() : Date.now());
  if(now - GJ_META.windowStartAt > GJ_META.windowSec*1000){
    resetMiniWindow();
  }
  GJ_META.windowGroups.add(groupId);

  // เป้าหมาย: ครบ 3 หมู่ภายใน 12 วิ
  const cur = GJ_META.windowGroups.size;
  const tar = 3;

  // ส่ง quest:update แบบ mini-only (ให้ HUD แสดงได้เหมือน Plate)
  try{
    window.dispatchEvent(new CustomEvent('quest:update', { detail:{
      goal:{ name:'แยกของดี/ของเสีย', sub:'เก็บของดี เลี่ยงของหวาน/ทอด', cur:0, target:1 },
      mini:{ name:`ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ`, sub:'โบนัส STAR/SHIELD', cur, target:tar, done:GJ_META.miniDone },
      allDone:false
    }}));
  }catch{}

  if(!GJ_META.miniDone && cur >= tar){
    GJ_META.miniDone = true;

    // โบนัส: ให้ STAR หรือ SHIELD (เลือกอย่างใดอย่างหนึ่ง)
    // ตรงนี้ให้คุณ “ผูกกับระบบ STAR/SHIELD เดิม” ของ GoodJunk
    try{
      window.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        msg:`สุดยอด! ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ 🎁 ได้โบนัส!`,
        tag:'Coach'
      }}));
    }catch{}

    // ตัวอย่าง: เพิ่มคะแนน/ลด miss/ให้ shield — เลือกตามระบบเดิมของคุณ
    // addScore(150); giveShield(); giveStar();
  }
}

/* ------------------------------------------------
 * (3) ตอนสร้าง target ของ GoodJunk: ใส่ groupId + เรียก decorateTarget()
 * ------------------------------------------------
 * จุดนี้ให้คุณ “เสียบ” ตอนที่คุณสร้าง element เป้า (div target) อยู่แล้ว
 * ตัวอย่าง pseudo-structure:
 *
 * const t = { kind:'good', rng, ... }
 * t.groupId = chooseGroupId(rng)
 * decorateTarget(el, t)
 * ------------------------------------------------ */

// ตัวอย่าง: ใน onSpawn หรือ createTarget ของคุณ
function patchApplyToTargetObject(t, el){
  // t.kind มีอยู่แล้ว
  if(t.kind === 'good'){
    t.groupId = chooseGroupId(t.rng);
  }
  decorateTarget(el, t);
}

/* ------------------------------------------------
 * (4) ตอน “ยิง/แตะโดน good” ให้เรียก onHitGoodMeta(groupId)
 * ------------------------------------------------
 * ใน handler ที่เดิมคุณเรียก onHitGood():
 *   onHitGood();
 * ให้เพิ่ม:
 *   onHitGoodMeta(t.groupId || 1);
 * ------------------------------------------------ */