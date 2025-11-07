// === Hero Health — modes/hydration.quest.js (Production) ===
// โหมด: ควบคุมระดับน้ำ (LOW/GREEN/HIGH) + Mini-Quest เฉพาะ Hydration
// ทำงานร่วมกับ vr/mode-factory.js (สปอว์น/คะแนน/เอฟเฟกต์/HUD)

import { boot as factoryBoot } from '../vr/mode-factory.js';

// -------- พูลไอคอนเครื่องดื่ม --------
// ดีต่อการเติมน้ำ (แนว no/low sugar)
const DRINK_GOOD = ['💧','🥛','🧃','🥥','🍵','🫗']; // น้ำ, นม, น้ำผลไม้ไม่หวานจัด, น้ำมะพร้าว, ชาอุ่น, ของเหลว
// ไม่ดี (น้ำตาลสูง/แอลกอฮอล์/ชานมไข่มุก ฯลฯ)
const DRINK_BAD  = ['🧋','🥤','🍺','🍷','🍸','🍹','🥃','🍾'];

// -------- โซนระดับน้ำ --------
const ZONE = {
  LOW:   'LOW',    // ต่ำไป
  GREEN: 'GREEN',  // พอดี (เป้าหมาย)
  HIGH:  'HIGH'    // สูงไป
};
function getZone(lv){
  if (lv < 40)  return ZONE.LOW;
  if (lv <= 70) return ZONE.GREEN;
  return ZONE.HIGH;
}

// -------- เควสต์เฉพาะ Hydration --------
// - Perfect Balance 20s → อยู่โซน GREEN ต่อเนื่องครบ 20 วินาที
// - Hydration Streak 10 → กดถูกต้องติดกัน 10 ครั้ง
// - Overdrink Warning → ลากจาก HIGH กลับ GREEN ได้ภายใน 3 วินาที (ตั้งแต่เริ่ม HIGH)
function makeQuestState(){
  return {
    // stat หลัก
    correct: 0,        // จำนวนครั้งที่เลือกถูกต้องสะสม
    combo: 0,          // จะเท่ากับ ctx.combo จาก factory เป็นหลัก (เผื่อ double-check)
    // perfect balance
    greenSec: 0,       // วินาทีที่อยู่ใน GREEN ต่อเนื่อง
    greenBest: 0,
    // streak
    streakBest: 0,
    // overdrink → recover
    enteredHighAt: null,
    recoveredIn3s: false,
    // flags สำเร็จ
    qPerfect: false,
    qStreak:  false,
    qRecover: false
  };
}
function questText(qs, lv){
  const z = getZone(lv);
  const p1 = qs.qPerfect ? '✅' : `GREEN ${qs.greenSec}/20s`;
  const p2 = qs.qStreak  ? '✅' : `Streak ${qs.combo}/10`;
  const p3 = qs.qRecover ? '✅' : 'Recover HIGH→GREEN ≤3s';
  return `Hydration — Zone: ${z} | ${p1} | ${p2} | ${p3}`;
}

// -------- Logic ให้คะแนนตาม "บริบทโซน" --------
// กติกาตามที่สั่ง:
// - ถ้าอยู่ "HIGH": เลือกของ "ไม่ดี" (BAD) จะได้คะแนน (เพราะช่วยลดระดับกลับสู่พอดี)
// - ถ้าอยู่ "LOW" : เลือก "ไม่ดี" จะโดนโทษหนักขึ้น
// - ถ้าอยู่ "LOW": เลือก "ดี" จะได้คะแนนเพิ่ม และช่วยดันระดับขึ้น
// - ถ้าอยู่ "HIGH": เลือก "ดี" จะโดนหัก/เตือน (เพราะจะยิ่งสูง)
export async function boot(config = {}){
  const diff = config.difficulty || 'normal';
  const duration = config.duration ?? 60;

  // เป้าหมายหลัก: “รักษาโซน GREEN ให้ได้นาน + เก็บแต้มรวม”
  const GOAL_BY_DIFF = { easy: 18, normal: 28, hard: 38 };
  const goal = GOAL_BY_DIFF[diff] ?? 28;

  // state ภายในโหมด
  let level = 50;        // เริ่มกลางๆ
  let correctClicks = 0; // ใช้ส่ง goal เคลียร์
  const qs = makeQuestState();

  // แจ้ง HUD เควสต์ตั้งต้น
  try {
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: questText(qs, level) }
    }));
  } catch {}

  // อัปเดตเควสต์ตามเวลา (วินาทีละครั้ง)
  const timers = [];
  const secTick = setInterval(()=>{
    // นับ perfect balance (GREEN ต่อเนื่อง)
    if (getZone(level) === ZONE.GREEN) {
      qs.greenSec += 1;
      qs.greenBest = Math.max(qs.greenBest, qs.greenSec);
      if (!qs.qPerfect && qs.greenSec >= 20) qs.qPerfect = true;
    } else {
      qs.greenSec = 0;
    }

    // HIGH → กำลังจับเวลา recover 3s
    if (!qs.qRecover && qs.enteredHighAt != null) {
      const elapsed = (performance.now() - qs.enteredHighAt) / 1000;
      // หากตอนนี้อยู่ GREEN และใช้เวลา ≤3s นับผ่าน
      if (getZone(level) === ZONE.GREEN && elapsed <= 3.0) {
        qs.qRecover = true;
        qs.recoveredIn3s = true;
      }
      // ถ้าพ้น 3s แล้วยังไม่ GREEN ก็เลิกนับรอบนี้ รอเข้าช่วง HIGH ใหม่
      if (elapsed > 3.0 && getZone(level) !== ZONE.GREEN) {
        qs.enteredHighAt = null;
      }
    }

    // แจ้ง HUD เควสต์
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: questText(qs, level) }
    }));
  }, 1000);
  timers.push(secTick);

  // ฟังก์ชันช่วยปรับ level ให้อยู่ใน 0..100
  function setLevel(newLv){
    level = Math.max(0, Math.min(100, newLv));
    // เข้าสู่ HIGH → เริ่มจับเวลา recover 3s
    if (!qs.qRecover && getZone(level) === ZONE.HIGH && qs.enteredHighAt == null) {
      qs.enteredHighAt = performance.now();
    }
    // หากลดจาก HIGH ลงมา GREEN ได้สำเร็จและยังไม่นับผ่าน
    if (!qs.qRecover && qs.enteredHighAt != null && getZone(level) === ZONE.GREEN) {
      const elapsed = (performance.now() - qs.enteredHighAt) / 1000;
      if (elapsed <= 3.0) {
        qs.qRecover = true;
        qs.recoveredIn3s = true;
      }
      // จบรอบการจับเวลา
      qs.enteredHighAt = null;
    }

    // อัปเดตข้อความเควสต์ทันที (รู้สึก responsive)
    try {
      window.dispatchEvent(new CustomEvent('hha:quest', {
        detail: { text: questText(qs, level) }
      }));
    } catch {}
  }

  // judge ด้วย closure (เข้าถึง level/qs ได้)
  function judgeHydration(char, ctx){
    // timeout → ค่อยๆ เสียน้ำเล็กน้อย
    if (char == null) {
      setLevel(level - 2);
      qs.combo = Math.max(0, ctx.combo||0);
      return { good:false, scoreDelta:-3 };
    }

    const zone = getZone(level);
    const isGood = DRINK_GOOD.includes(char);
    const isBad  = DRINK_BAD.includes(char);

    // ค่าปรับระดับน้ำ (หน่วยแบบง่าย ๆ)
    const DELTA = {
      goodUp:  +8,
      goodDown:-6,    // ดื่ม "ดี" ตอน HIGH → ลดแต้ม/ลดระดับนิดเพื่อกดลง
      badUp:   +6,    // ดื่ม "ไม่ดี" ตอน LOW → ยิ่งแย่
      badDown: -10    // ดื่ม "ไม่ดี" ตอน HIGH → ใช้เป็น "เบรก" ลดลงแรง
    };

    let score = 0;
    let correct = false;

    if (isGood) {
      if (zone === ZONE.LOW)    { score = 12; setLevel(level + DELTA.goodUp);  correct = true; }
      else if (zone === ZONE.GREEN){ score = 10; setLevel(level + 4);            correct = true; }
      else /* HIGH */           { score = -6; setLevel(level + DELTA.goodDown); }
    } else if (isBad) {
      if (zone === ZONE.HIGH)   { score = 12; setLevel(level + DELTA.badDown); correct = true; }
      else if (zone === ZONE.GREEN){ score = -4; setLevel(level + 4); }
      else /* LOW */            { score = -8; setLevel(level + DELTA.badUp); }
    } else {
      // ไม่นับเป็นเครื่องดื่ม → ไม่ให้คะแนน
      score = 0;
    }

    // อัปเดตสถิติชุดเควสต์
    qs.combo = Math.max(qs.combo, (ctx.combo||0)+ (correct?1:0));
    if (correct) {
      qs.correct += 1;
      if (!qs.qStreak && ((ctx.combo||0)+1) >= 10) qs.qStreak = true;
    }

    // ถ้าทำถูกนับ goal หลัก (นับเฉพาะ correct)
    if (correct) correctClicks++;

    return { good: correct, scoreDelta: score };
  }

  // แจ้ง “คำอธิบายเปิดฉาก”
  try {
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: `Hydration — รักษาระดับน้ำให้อยู่โซน GREEN (40–70) | Perfect 20s, Streak×10, Recover HIGH→GREEN ≤3s` }
    }));
  } catch {}

  // เรียกแกนเกม
  const api = await factoryBoot({
    name: 'hydration',
    pools: { good: DRINK_GOOD, bad: DRINK_BAD },
    judge: judgeHydration,
    goal: goal,
    ...config
  });

  // เมื่อเกมจบ → ล้าง timer ภายใน
  const onEnd = ()=>{
    try{ timers.forEach(t=>clearInterval(t)); }catch{}
    window.removeEventListener('hha:end', onEnd);
  };
  window.addEventListener('hha:end', onEnd);

  return api;
}

export default { boot };