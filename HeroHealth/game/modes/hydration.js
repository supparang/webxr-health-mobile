// === Hero Health Academy — game/modes/hydration.js (Hydration Bar + Flames + Rules) ===
export const name = 'hydration';

/**
 * กติกาหลัก (ตามที่กำหนด):
 * - ถ้า "ระดับน้ำสูง" แล้วคลิก "น้ำเปล่า" → หักคะแนน และหักคอมโบ (return 'bad')
 * - ถ้า "ระดับน้ำสูง" แล้วคลิก "น้ำหวาน" → ให้คะแนน และไม่หักคอมโบ (return 'good')
 * - ถ้า "ระดับน้ำต่ำ" แล้วคลิก "น้ำหวาน" → หักคะแนน และหักคอมโบ (return 'bad')
 * - ถ้า "ระดับน้ำต่ำ" แล้วคลิก "น้ำเปล่า" → ให้คะแนน (ถ้าดันเข้าช่วงพอดีให้ 'perfect')
 * - ช่วง "พอดี" (กลาง) คลิกน้ำเปล่า: 'good' / คลิกน้ำหวาน: 'ok' (ถ้าดันหลุดโซน กลายเป็น 'bad')
 *
 * ไอคอนโผล่-หายเอง ใช้ TTL จาก main.js (life)
 */

// ---------- Zones / thresholds ----------
const Z = { LOW: 0, MID: 1, HIGH: 2 };
const LOW_MAX  = 40;   // < 40% = ต่ำ
const MID_MAX  = 70;   // 40–70% = พอดี
// > 70% = สูง

// ---------- Items pool ----------
const ITEMS = [
  // น้ำเปล่า / ไม่มีน้ำตาล
  { id:'water',     kind:'water',  icon:'💧', labelTH:'น้ำเปล่า',  labelEN:'Water' },
  { id:'bottle',    kind:'water',  icon:'🫗', labelTH:'น้ำดื่ม',    labelEN:'Water Bottle' },
  { id:'tea',       kind:'water',  icon:'🍵', labelTH:'ชาไม่หวาน',  labelEN:'Unsweet Tea' },
  { id:'coffee',    kind:'water',  icon:'☕',  labelTH:'กาแฟดำ',     labelEN:'Black Coffee' },

  // น้ำหวาน / เครื่องดื่มให้พลังงาน
  { id:'soda',      kind:'sweet',  icon:'🥤', labelTH:'น้ำอัดลม',   labelEN:'Soda' },
  { id:'juice',     kind:'sweet',  icon:'🧃', labelTH:'น้ำผลไม้',   labelEN:'Juice' },
  { id:'milkshake', kind:'sweet',  icon:'🥤', labelTH:'มิลค์เชค',   labelEN:'Milkshake' },
  { id:'energy',    kind:'sweet',  icon:'⚡',  labelTH:'เอเนอร์จี้', labelEN:'Energy Drink' },
];

// ---------- Play state ----------
const ST = {
  lang: 'TH',
  level: 55,             // 0–100 (%)
  lastZone: Z.MID,
  difficulty: 'Normal',
  // ความเร็วการเปลี่ยนระดับน้ำต่อคลิก (สามารถปรับเพิ่ม/ลดตาม diff)
  delta: {
    waterLow:  +10,
    waterMid:  +6,
    waterHigh: +4,       // สูงแล้วกดน้ำ ก็ยัง + เพิ่ม (และโดนหักคะแนน)
    sweetLow:  +3,
    sweetMid:  +4,
    sweetHigh: +2
  }
};

// ---------- Utils ----------
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
function zoneOf(pct){
  if (pct < LOW_MAX) return Z.LOW;
  if (pct <= MID_MAX) return Z.MID;
  return Z.HIGH;
}
function t(th, en, lang){ return lang==='EN' ? en : th; }

// ---------- HUD (Hydration Bar) ----------
function ensureFlameHost(){
  const wrap = document.getElementById('hydroWrap');
  const barHost = wrap?.querySelector('.bar');
  if (!barHost) return;
  if (!barHost.classList.contains('hydroBarHost')){
    barHost.classList.add('hydroBarHost');
  }
  if (!wrap.querySelector('.hydroFlame')){
    const flame = document.createElement('div');
    flame.className = 'hydroFlame';
    barHost.appendChild(flame);
  }
}
function updateHydroBar(){
  const wrap = document.getElementById('hydroWrap');
  const bar  = document.getElementById('hydroBar');
  const lab  = document.getElementById('hydroLabel');
  if (!wrap || !bar) return;

  const lvl = Math.round(ST.level);
  const z = zoneOf(lvl);

  bar.style.width = `${lvl}%`;

  wrap.classList.remove('hydro-low','hydro-mid','hydro-high');
  if (z===Z.LOW)  wrap.classList.add('hydro-low');
  if (z===Z.MID)  wrap.classList.add('hydro-mid');
  if (z===Z.HIGH) wrap.classList.add('hydro-high');

  if (lab){
    lab.textContent = (ST.lang==='EN')
      ? (z===Z.LOW?'Low': z===Z.MID?'Optimal':'High')
      : (z===Z.LOW?'ต่ำ': z===Z.MID?'พอดี':'สูง');
  }
}

// ---------- Exported API ----------
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  ST.difficulty = gameState?.difficulty || 'Normal';

  // ตั้งค่าเริ่มตามความยาก (เริ่มกลางมาก-น้อยต่างกัน)
  ST.level = (ST.difficulty==='Easy') ? 55 : (ST.difficulty==='Hard') ? 50 : 53;
  ST.lastZone = zoneOf(ST.level);

  // ปรับเดลต้านิดหน่อยตามความยาก
  const scale = (ST.difficulty==='Hard') ? 1.15 : (ST.difficulty==='Easy') ? 0.9 : 1.0;
  for (const k of Object.keys(ST.delta)) ST.delta[k] = Math.round(ST.delta[k]*scale);

  // โชว์ HUD ของน้ำ + เอฟเฟกต์ไฟ
  const wrap = document.getElementById('hydroWrap');
  if (wrap) wrap.style.display = 'block';
  ensureFlameHost();
  updateHydroBar();

  // เปิดป้าย "เป้าหมาย" ไม่ใช้ในโหมดนี้
  const tw = document.getElementById('targetWrap');
  if (tw) tw.style.display = 'none';
}

export function cleanup(){
  // ไม่ซ่อน hydroWrap เพื่อให้ผู้เล่นเห็นค้างได้ แต่หากต้องซ่อน ให้ปลดคอมเมนต์
  // const wrap = document.getElementById('hydroWrap');
  // if (wrap) wrap.style.display = 'none';
}

export function tick(state, systems /*, hud */){
  // ดริฟต์เล็กน้อยกลับสู่โซนกลางช้าๆ เพื่อให้เกมลื่น
  const z = zoneOf(ST.level);
  if (z===Z.LOW) ST.level = clamp(ST.level + 0.6, 0, 100);
  if (z===Z.HIGH) ST.level = clamp(ST.level - 0.6, 0, 100);

  updateHydroBar();
}

// ให้ main.js เรียกตอนสไปว์น 1 ชิ้น
export function pickMeta(diff /*, gameState */){
  const z = zoneOf(ST.level);
  // โอกาสสุ่ม: ถ้า "ต่ำ" ให้เจอน้ำเปล่ามากหน่อย / ถ้า "สูง" ให้เจอน้ำหวานมากหน่อย
  const biasWater = (z===Z.LOW) ? 0.7 : (z===Z.MID) ? 0.5 : 0.35;
  const pickWater = Math.random() < biasWater;

  const pool = ITEMS.filter(x => (pickWater ? x.kind==='water' : x.kind==='sweet'));
  const it = pool[(Math.random()*pool.length)|0];

  // meta.good สำหรับ UI สี/คะแนนเบื้องต้น (main.js ใช้ประกอบ)
  const willBeGood =
    (z===Z.LOW && it.kind==='water') ||
    (z===Z.MID && it.kind==='water') ||
    (z===Z.HIGH && it.kind==='sweet');

  return {
    id: it.id,
    char: it.icon,
    kind: it.kind,       // 'water' | 'sweet'
    good: willBeGood,
    life: diff?.life || 2800
  };
}

// เมื่อคลิก 1 ชิ้น
export function onHit(meta, systems /*, gameState, hud */){
  const zBefore = zoneOf(ST.level);
  let res = 'ok';

  if (meta.kind === 'water'){
    // ผลตามโซนก่อนคลิก
    if (zBefore === Z.HIGH){
      // สูงแล้วกดน้ำ — หักคะแนน/คอมโบ
      ST.level = clamp(ST.level + ST.delta.waterHigh, 0, 100);
      systems.coach?.say?.(t('น้ำเกินแล้ว!', 'Already high!', ST.lang));
      res = 'bad';
    } else if (zBefore === Z.LOW){
      ST.level = clamp(ST.level + ST.delta.waterLow, 0, 100);
      const zAfter = zoneOf(ST.level);
      res = (zAfter===Z.MID) ? 'perfect' : 'good';
      systems.coach?.say?.(t('ดีมาก! เติมน้ำขึ้น', 'Nice! Hydrating up', ST.lang));
    } else { // MID
      ST.level = clamp(ST.level + ST.delta.waterMid, 0, 100);
      const zAfter = zoneOf(ST.level);
      res = (zAfter===Z.MID) ? 'good' : 'ok';
      if (zAfter!==Z.MID) systems.coach?.say?.(t('ระวังเกิน!', 'Careful not to overfill!', ST.lang));
    }
  } else if (meta.kind === 'sweet'){
    if (zBefore === Z.HIGH){
      // สูงแล้วกดน้ำหวาน — ให้คะแนนและ "ไม่หักคอมโบ" → ส่ง 'good'
      ST.level = clamp(ST.level + ST.delta.sweetHigh, 0, 100);
      systems.coach?.say?.(t('โอเค ยังไม่หักคอมโบ', 'Okay, combo stays', ST.lang));
      res = 'good';
    } else if (zBefore === Z.LOW){
      // ต่ำแล้วกดน้ำหวาน — หักคะแนน/คอมโบ
      ST.level = clamp(ST.level + ST.delta.sweetLow, 0, 100);
      systems.coach?.say?.(t('ยังไม่ใช่น้ำหวานนะ', 'Not sugary now', ST.lang));
      res = 'bad';
    } else { // MID
      ST.level = clamp(ST.level + ST.delta.sweetMid, 0, 100);
      const zAfter = zoneOf(ST.level);
      // กลางแล้วโดดไป HIGH ถือว่าไม่ดี
      res = (zAfter===Z.MID) ? 'ok' : 'bad';
      if (res==='bad') systems.coach?.say?.(t('เกินพอดีแล้ว!', 'Now it’s too much!', ST.lang));
    }
  } else {
    res = 'ok';
  }

  updateHydroBar();
  return res;
}

// (ออปชัน) ให้ main.js ถามความยาวพลัง (ถ้าในอนาคตจะใช้ power-ups ร่วม)
// ตอนนี้โหมด hydration ยังไม่ผูกพลังพิเศษ จึงไม่ต้องประกาศอะไร
export function getPowerDurations(){
  return { x2:0, freeze:0, magnet:0 };
}
