// === Hero Health Academy — game/modes/hydration.js (Level logic + Mini-Quest signals) ===
export const name = 'hydration';

/*
กติกาตามที่ต้องการ:
- ถ้าระดับน้ำ "สูงเกิน" แล้วยังคลิก "น้ำเปล่า" => หักคะแนน/หักคอมโบ (ให้เป็น 'bad')
- ถ้าระดับน้ำ "สูงเกิน" แล้วคลิก "น้ำหวาน" => ให้คะแนน + ไม่หักคอมโบ (ให้เป็น 'good')
- ถ้าระดับน้ำ "ต่ำ" แล้วคลิก "น้ำหวาน" => หักคะแนนและคอมโบ (ให้เป็น 'bad')
- กรณีปกติ: น้ำเปล่า 'good', น้ำหวาน 'ok' (ไม่แรง)
*/

const ST = {
  lang: 'TH',
  level: 50,         // 0..100
  lastZone: 'OK',    // 'LOW' | 'OK' | 'HIGH'
  initDone: false
};

// โซน
const Z = { LOW: 'LOW', OK: 'OK', HIGH: 'HIGH' };
const ZONE = {
  LOW_MAX: 39,      // <40 ต่ำ
  HIGH_MIN: 61      // >60 สูง
};

// ไอเท็ม
const ITEMS = [
  { id:'water',  kind:'water',  icon:'💧', labelTH:'น้ำเปล่า',  labelEN:'Water',  dLevel:+12 },
  { id:'sweet',  kind:'sweet',  icon:'🧃', labelTH:'น้ำหวาน',  labelEN:'Sweet',  dLevel:-10 },
  // จะเพิ่มประเภทอื่น เช่น ชา/กาแฟ ก็ทำได้ แต่หลัก ๆ ให้ตอบตาม requirement ก่อน
];

// ช่วยเลือกภาษา
const t = (th,en,lang)=> (lang==='EN'? en : th);

// ช่วยดูโซนจากระดับ
function zoneFor(level){
  if (level <= ZONE.LOW_MAX) return Z.LOW;
  if (level >= ZONE.HIGH_MIN) return Z.HIGH;
  return Z.OK;
}

// HUD
function showHydroHUD(show){
  const w = document.getElementById('hydroWrap');
  if (w) w.style.display = show?'block':'none';
}
function updateHydroHUD(){
  const bar = document.getElementById('hydroBar');
  const lab = document.getElementById('hydroLabel');
  const lang = ST.lang;
  const z = zoneFor(ST.level);
  if (bar){
    const pct = Math.max(0, Math.min(100, ST.level|0));
    bar.style.width = pct+'%';
  }
  if (lab){
    if (z===Z.LOW)  lab.textContent = t('ต่ำ', 'Low', lang);
    if (z===Z.OK)   lab.textContent = t('พอดี', 'Ideal', lang);
    if (z===Z.HIGH) lab.textContent = t('สูง', 'High', lang);
  }
}

// API ที่ main.js เรียก
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  // ตั้งค่าเริ่ม
  ST.level = 50;
  ST.lastZone = zoneFor(ST.level);
  ST.initDone = true;
  showHydroHUD(true);
  updateHydroHUD();
}

export function cleanup(){
  showHydroHUD(false);
}

// ให้ main.js ใช้สุ่มสปอนไอคอน พร้อม TTL (ขึ้นมาแล้วหายเอง)
export function pickMeta(diff, gameState){
  // ปรับโอกาสตามระดับน้ำ: ถ้าสูง ให้เจอน้ำหวานมากขึ้น; ถ้าต่ำ ให้เจอน้ำเปล่ามากขึ้น
  const z = zoneFor(ST.level);
  let pool;
  if (z===Z.HIGH){
    pool = [ ...weight('sweet', 4), ...weight('water', 1) ];
  } else if (z===Z.LOW){
    pool = [ ...weight('water', 4), ...weight('sweet', 1) ];
  } else {
    pool = [ ...weight('water', 3), ...weight('sweet', 2) ];
  }
  const pick = pool[(Math.random()*pool.length)|0];
  const it = ITEMS.find(x=>x.kind===pick) || ITEMS[0];

  // กำหนดว่า "กดแล้วจะดีไหม" ตามกฎ
  const good = judgeGoodness(it.kind, z);

  return {
    id: it.id,
    char: it.icon,
    kind: it.kind,
    good,                      // ผลดี/ไม่ดี (ให้ main คิดคะแนน/คอมโบตาม result ที่ onHit คืน)
    life: diff?.life || 3000   // TTL
  };
}

// กดไอคอน
export function onHit(meta, systems, gameState, hud){
  const z = zoneFor(ST.level);
  const before = ST.level|0;

  // ปรับระดับน้ำตามชนิดที่กด
  const delta = levelDelta(meta.kind, z);
  ST.level = clamp(ST.level + delta, 0, 100);
  const after = ST.level|0;

  // แจ้ง HUD
  updateHydroHUD();

  // แจ้ง coach ตามผล
  let res = 'ok';
  if (z===Z.HIGH){
    if (meta.kind==='water'){ // ห้ามในเงื่อนไขที่กำหนด
      systems.coach?.say?.(t('ตอนนี้น้ำเยอะไปแล้ว!', 'You\'re overhydrated!', ST.lang));
      res = 'bad';
    } else if (meta.kind==='sweet'){
      systems.coach?.say?.(t('ดี! ช่วยบาลานซ์', 'Nice! That helps balance.', ST.lang));
      res = 'good'; // ไม่หักคอมโบตามต้องการ (main จะเพิ่ม combo เมื่อเป็น good/perfect)
    }
  } else if (z===Z.LOW){
    if (meta.kind==='sweet'){
      systems.coach?.say?.(t('ยังขาดน้ำอยู่ เลี่ยงหวานก่อนนะ', 'You\'re low—skip sugary drinks now.', ST.lang));
      res = 'bad'; // หักคะแนน/คอมโบ
    } else if (meta.kind==='water'){
      systems.coach?.say?.(t('ดีมาก! เติมน้ำ', 'Good! Hydrate up.', ST.lang));
      res = 'good';
    }
  } else {
    // โซน OK: น้ำเปล่าดี, น้ำหวานพอได้ (ok)
    res = (meta.kind==='water') ? 'good' : 'ok';
  }

  // ยิงสัญญาณสำหรับ Mini Quests เฉพาะ hydration
  try{
    // hit ช็อตนี้
    window?.HHA_QUESTS?.event?.('hydro_click', {
      kind: meta.kind,           // 'water'|'sweet'
      zoneBefore: zoneFor(before),
      zoneAfter:  zoneFor(after),
      delta
    });
  }catch{}

  return res;
}

// อัปเดตต่อวินาที (ให้ส่งสถานะโซนเข้าระบบเควส)
export function tick(state, systems, hud){
  if (!ST.initDone) return;

  // แจ้งโซนปัจจุบันให้ระบบมินิเควส
  const z = zoneFor(ST.level);
  try{
    window?.HHA_QUESTS?.event?.('hydro_tick', {
      level: ST.level|0,
      zone: z,                   // 'LOW'|'OK'|'HIGH'
    });
  }catch{}

  // แจ้งข้ามโซน
  if (ST.lastZone !== z){
    const from = ST.lastZone; ST.lastZone = z;
    try{
      window?.HHA_QUESTS?.event?.('hydro_cross', { from, to:z });
    }catch{}
  }
}

// ---------- Utils ----------
function clamp(x,min,max){ return x<min?min:x>max?max:x; }
function weight(kind, n){ return new Array(n).fill(kind); }

// ตัดสินความดี/ไม่ดีล่วงหน้า (ใช้ใน pickMeta เพื่อช่วย main ปรับคะแนนพื้นฐาน)
function judgeGoodness(kind, zone){
  if (zone===Z.HIGH){
    if (kind==='water') return false;
    if (kind==='sweet') return true;
  } else if (zone===Z.LOW){
    if (kind==='sweet') return false;
    if (kind==='water') return true;
  } else {
    return kind==='water'; // OK zone: น้ำดี, หวาน neutral (จะปรับใน onHit เป็น 'ok')
  }
  return false;
}

// ปรับระดับน้ำตามไอเท็ม โดยคำนึงถึงโซนปัจจุบันเล็กน้อย
function levelDelta(kind, zone){
  if (kind==='water'){
    // ถ้าสูงอยู่แล้ว บวกน้อยลง
    if (zone===Z.HIGH) return +6;
    if (zone===Z.LOW)  return +14;
    return +10;
  }
  if (kind==='sweet'){
    // ช่วยลดเมื่อสูง, แต่ถ้าต่ำยิ่งแย่
    if (zone===Z.HIGH) return -10;
    if (zone===Z.LOW)  return -6;
    return -4;
  }
  return 0;
}
