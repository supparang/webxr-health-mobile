// === Hero Health Academy — modes/hydration.js ===
// โหมด "สมดุลน้ำ": รักษาระดับน้ำให้อยู่ในโซน OK โดยคลิก "น้ำ 💧" หรือ "ของหวาน 🍬"
// - มีไอคอนเกิดทั่วไป (main.js สแปวน์) แต่มาเฉพาะสองชนิดนี้
// - ตรรกะคลิกจะเพิ่ม/ลดระดับน้ำ แล้วคำนวณผลลัพธ์ good/perfect/bad
// - ยิงอีเวนต์ Quests: 'hydro_tick', 'hydro_cross', 'hydro_click' ครบ
// - อัปเดต HUD.setPowerTimers(power.timers) ทุกวินาที

import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

// ----------------- ค่าพื้นฐานของโหมด -----------------
const CFG = {
  // ช่วงที่ถือว่า "พอดี"
  OK_MIN: 42,
  OK_MAX: 58,
  // ค่าระดับน้ำเริ่มต้น
  START: 50,
  // อัตราลดลงเองต่อวินาที (จำลองใช้พลังงาน)
  DECAY_PER_SEC: 2.2,
  // ผลจากการกด (หน่วยเป็นจุด)
  WATER_GAIN: 9,   // กดน้ำเพิ่มระดับ
  SWEET_DROP: 7,   // กดหวานช่วยลดระดับเมื่อ HIGH
  // เกณฑ์ให้ "perfect"
  PERFECT_MARGIN: 4, // หลังคลิกแล้วยังอยู่กลางโซน (ใกล้ 50) ใน ±4
  // โอกาส Golden
  GOLDEN_CHANCE: 0.08, // 8%
};

// ----------------- ภายในโหมด -----------------
let _prevZone = null;
let _lastTickMS = 0;

// แปลงระดับน้ำ -> โซน
function zoneOf(level, cfg){
  if (level < cfg.OK_MIN) return 'LOW';
  if (level > cfg.OK_MAX) return 'HIGH';
  return 'OK';
}

// ตัดให้อยู่ใน [0..100]
function clamp01(x){ return Math.max(0, Math.min(100, x)); }

// -------------- Exported API (ที่ main.js เรียก) --------------

// เริ่มรอบ: ตั้งค่าตัวแปรใน state และแสดง HUD ที่จำเป็น
export function init(state, hud /* , diff */){
  state.hyd     = CFG.START;
  state.hydMin  = CFG.OK_MIN;
  state.hydMax  = CFG.OK_MAX;
  state.hydVel  = 0;            // เผื่ออนาคต (เช่น inertial)
  state.hydCfg  = { ...CFG };   // เก็บคอนฟิกเผื่อโหมดอื่นต้องอ่าน

  _prevZone = zoneOf(state.hyd, state.hydCfg);

  // แสดงแถบ/ UI โหมดน้ำ (ถ้ามี)
  hud.showHydration?.();

  // แจ้งเควสต์ครั้งแรก (สถานะเริ่มต้น)
  Quests.event('hydro_tick', { zone: _prevZone });

  // เริ่มต้นอัปเดต Power timers บน HUD
  hud.setPowerTimers?.(state?.power?.timers || {});
}

// จบ/ล้างเมื่อออกจากโหมด
export function cleanup(state, hud){
  hud.hideHydration?.();
  _prevZone = null;
  _lastTickMS = 0;
}

// main.js จะเรียกเพื่อขอ "เมทาดาต้า" สำหรับสร้างไอคอน 1 ชิ้น
// เราจะสุ่มให้เป็น "น้ำ 💧" หรือ "หวาน 🍬" พร้อมกำหนด meta ให้เควสต์ใช้ได้
export function pickMeta(/* dyn, state */){
  // สุ่มชนิด
  const isWater = Math.random() < 0.65; // น้ำออกบ่อยกว่า
  const kind = isWater ? 'water' : 'sweet';

  // โอกาสทอง
  const golden = Math.random() < CFG.GOLDEN_CHANCE;

  return {
    id: kind,
    char: isWater ? '💧' : '🍬',
    label: isWater ? 'water' : 'sweet',
    aria: isWater ? 'drink water' : 'eat sweet treat',
    life: 2600,           // อยู่ไม่นานเพื่อเร่งจังหวะ
    golden,               // สำหรับเควสต์ golden
    // meta.good จะคำนวณตอนคลิก (ขึ้นกับโซนก่อนคลิก)
    // แต่ส่ง groupId ไว้ให้เควสต์ count_group ถ้าต้องการ
    groupId: isWater ? 'water' : 'sweet',
  };
}

// เมื่อคลิกไอคอนในโหมดนี้
// - อัปเดตระดับน้ำ
// - ตัดสินผลลัพธ์ good/perfect/bad
// - ยิง Quests.event('hydro_click', { zoneBefore, kind })
// - คืนค่า 'good'|'perfect'|'bad'|'ok' ให้ main.js นำไปคิดคะแนน/เอฟเฟกต์
export function onHit(meta, sys, state, hud){
  const { score, sfx, power, coach } = sys || {};
  const cfg = state.hydCfg || CFG;

  const before = state.hyd;
  const zoneBefore = zoneOf(before, cfg);
  const kind = meta.id === 'water' ? 'water' : 'sweet';

  // ผลจากการคลิก
  let after = before;
  if (kind === 'water'){
    after = before + cfg.WATER_GAIN;
  } else { // sweet
    // หวานจะช่วย "ลด" เมื่ออยู่ใน HIGH (ช่วยบาลานซ์), ถ้า LOW อาจยิ่งต่ำลง = ไม่ดี
    after = before - cfg.SWEET_DROP;
  }
  after = clamp01(after);

  // ตัดสิน good/perfect/bad
  const zAfter = zoneOf(after, cfg);
  let result = 'ok';
  let goodLogic = false;

  // กฎง่าย ๆ:
  // - LOW -> "น้ำ" = ดี, ถ้าหลังคลิกแล้วยังอยู่กลาง OK (ใกล้ 50) และ |after-50| <= PERFECT_MARGIN => perfect
  // - HIGH -> "หวาน" = ดี (ช่วยลด), เงื่อนไข perfect แบบเดียวกัน
  // - OK -> "น้ำ" ส่วนใหญ่ยังดี (เติมเล็กน้อย), "หวาน" มักจะไม่ดี (ทำให้ลงต่ำ)
  // - ทำให้หลุดจากโซน OK แบบรุนแรง => bad
  if (zoneBefore === 'LOW'){
    if (kind === 'water'){
      goodLogic = true;
      result = (Math.abs(after - 50) <= cfg.PERFECT_MARGIN) ? 'perfect' : 'good';
    } else {
      // LOW + sweet => เสี่ยงลงต่ำกว่าเดิม
      result = 'bad';
    }
  } else if (zoneBefore === 'HIGH'){
    if (kind === 'sweet'){
      goodLogic = true;
      result = (Math.abs(after - 50) <= cfg.PERFECT_MARGIN) ? 'perfect' : 'good';
    } else {
      // HIGH + water => เสี่ยงสูงขึ้นไปอีก
      result = 'bad';
    }
  } else { // zoneBefore === 'OK'
    if (kind === 'water'){
      // เติมเล็กน้อยยังพอรับได้
      goodLogic = zAfter !== 'HIGH'; // ถ้าทะลุ HIGH ถือว่า bad
      result = goodLogic ? ((Math.abs(after - 50) <= cfg.PERFECT_MARGIN) ? 'perfect' : 'good') : 'bad';
    } else { // sweet ใน OK มักจะพาไป LOW (แต่น้อย) => ส่วนใหญ่ ok หรือ bad
      goodLogic = (zAfter === 'OK'); // ถ้ายังอยู่ OK ก็พอรับได้
      result = goodLogic ? 'ok' : 'bad';
    }
  }

  // Golden ช่วยอภัย/บูสต์เล็กน้อย: ถ้า golden และผลไม่ดี ให้เลื่อนขึ้นหนึ่งระดับ
  if (meta.golden){
    if (result === 'bad') result = 'ok';
    else if (result === 'good') result = 'perfect';
  }

  // อัปเดตระดับน้ำจริง
  state.hyd = after;

  // ยิงอีเวนต์สำหรับ Quests (และ Progress ถูก main.js จัดการอยู่แล้ว)
  Quests.event('hydro_click', { zoneBefore, kind });

  // แจ้ง HUD Power timers ทุกครั้งที่มีอินพุต (เผื่อมีระบบ freeze/spawn ที่ผูกอยู่)
  hud.setPowerTimers?.(power?.timers || {});

  // โค้ชเบา ๆ (ทางเลือก)
  try {
    if (result === 'perfect') coach?.onPerfect?.();
    else if (result === 'good') coach?.onGood?.();
    else if (result === 'bad') coach?.onBad?.();
  } catch {}

  // คืนผลลัพธ์ให้ main.js
  return result;
}

// main.js จะเรียกทุกวินาที
export function tick(state, sys, hud){
  const { power } = sys || {};
  const cfg = state.hydCfg || CFG;

  const now = performance?.now?.() || Date.now();
  if (!_lastTickMS) _lastTickMS = now;
  const dt = Math.min(1200, now - _lastTickMS); // ms
  _lastTickMS = now;

  // ลดระดับน้ำตามเวลา
  const drop = cfg.DECAY_PER_SEC * (dt/1000);
  state.hyd = clamp01(state.hyd - drop);

  // โซนตอนนี้
  const zNow = zoneOf(state.hyd, cfg);

  // ถ้าโซนเปลี่ยน ยิง hydro_cross
  if (_prevZone && _prevZone !== zNow){
    Quests.event('hydro_cross', { from: _prevZone, to: zNow });
  }
  _prevZone = zNow;

  // ยิง hydro_tick ทุกวินาที (ให้เควสต์สะสมเวลาในโซน)
  Quests.event('hydro_tick', { zone: zNow });

  // อัปเดต Power timers ที่ HUD
  hud.setPowerTimers?.(power?.timers || {});
}

// (ไม่จำเป็นสำหรับ hydration แต่คง API ไว้ให้สอดคล้อง)
export const fx = {
  onSpawn(el /*, state */){
    // แต่งไอคอนนิดหน่อยให้มีแรงสปริงเล็ก ๆ
    el.style.transition = 'transform .18s ease, filter .15s';
    el.addEventListener('pointerenter', ()=>{ el.style.transform += ' translateZ(10px) scale(1.06)'; }, {passive:true});
    el.addEventListener('pointerleave', ()=>{ el.style.transform = el.style.transform.replace(' translateZ(10px) scale(1.06)',''); }, {passive:true});
  },
  onHit(x, y /* , meta, state */){
    // เอฟเฟกต์แตก/สปาร์ค ใช้ของกลางจาก main.js อยู่แล้ว
  }
};

// (ทางเลือก) ให้ main.js หรือ UI อื่นอ่านช่วงเวลา power ได้ถ้าต้องการ
export function getPowerDurations(){
  return { x2: 6, freeze: 3, magnet: 2 };
}
