// === Hero Health Academy — modes/goodjunk.js (resilient drop-in) ===
export const name = 'goodjunk';

/* ------------------------------------------------------------------ */
/* 1) Catalog (อาหารดี/ขยะ) — ใช้ emoji เป็นไอคอนเริ่มต้น
   หากต้องการรูปภาพจริง ให้ผูกแปลง id -> URL ใน engine กลางแทน
/* ------------------------------------------------------------------ */
const GOOD = [
  { id:'apple',    labelEN:'Apple',     labelTH:'แอปเปิล',    icon:'🍎' },
  { id:'carrot',   labelEN:'Carrot',    labelTH:'แครอท',      icon:'🥕' },
  { id:'broccoli', labelEN:'Broccoli',  labelTH:'บรอกโคลี',  icon:'🥦' },
  { id:'rice',     labelEN:'Rice',      labelTH:'ข้าว',       icon:'🍚' },
  { id:'fish',     labelEN:'Fish',      labelTH:'ปลา',        icon:'🐟' },
  { id:'egg',      labelEN:'Egg',       labelTH:'ไข่',        icon:'🥚' },
  { id:'milk',     labelEN:'Milk',      labelTH:'นม',         icon:'🥛' },
];

const JUNK = [
  { id:'donut',    labelEN:'Donut',     labelTH:'โดนัท',       icon:'🍩' },
  { id:'burger',   labelEN:'Burger',    labelTH:'เบอร์เกอร์',  icon:'🍔' },
  { id:'fries',    labelEN:'Fries',     labelTH:'เฟรนช์ฟรายส์',icon:'🍟' },
  { id:'soda',     labelEN:'Soda',      labelTH:'น้ำอัดลม',    icon:'🥤' },
  { id:'candy',    labelEN:'Candy',     labelTH:'ลูกอม',       icon:'🍬' },
  { id:'cookie',   labelEN:'Cookie',    labelTH:'คุกกี้',      icon:'🍪' },
  { id:'pizza',    labelEN:'Pizza',     labelTH:'พิซซ่า',      icon:'🍕' },
];

/* ------------------------------------------------------------------ */
/* 2) Local state (โหมดนี้เท่านั้น)                                     */
/* ------------------------------------------------------------------ */
const ST = {
  lang: 'TH',
  needGood: 0,
  gotGood: 0,
  x2Until: 0,
  // สำหรับภารกิจ/สถิติพื้นฐาน
  streakGood: 0,
  avoidJunkTimerMs: 0,
  lastTickTs: 0,
  // refs สำหรับ clean up ถ้ามี timer/pointer ภายหลัง
  _timers: [],
};

function resetLocal() {
  ST.gotGood = 0;
  ST.streakGood = 0;
  ST.avoidJunkTimerMs = 0;
  ST.x2Until = 0;
  ST.lastTickTs = performance.now();
  // ยกเลิก timer เก่า (ถ้ามี)
  ST._timers.forEach(id => clearInterval(id));
  ST._timers.length = 0;
}

/* ------------------------------------------------------------------ */
/* 3) Safe i18n helper                                                 */
/* ------------------------------------------------------------------ */
function t(th, en, lang) { return lang === 'EN' ? en : th; }

/* ------------------------------------------------------------------ */
/* 4) (Optional) FX import แบบปลอดภัย — ไม่บังคับ path absolute        */
/*    - จะพยายาม import fx.js จาก 2 path: relative กับ absolute เดิม   */
/* ------------------------------------------------------------------ */
let FX = {
  add3DTilt: () => {},
  shatter3D: () => {}
};

(async () => {
  // พยายาม relative ก่อน (อยู่คู่กับ main engine ปัจจุบัน)
  try {
    const m = await import('../game/core/fx.js').catch(() => null);
    if (m) FX = { add3DTilt: m.add3DTilt || (()=>{}), shatter3D: m.shatter3D || (()=>{}) };
  } catch(e) {}
  // สำรอง: path absolute แบบโปรเจ็กต์เดิม
  if (!FX.add3DTilt || !FX.shatter3D) {
    try {
      const m2 = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(() => null);
      if (m2) FX = { add3DTilt: m2.add3DTilt || (()=>{}), shatter3D: m2.shatter3D || (()=>{}) };
    } catch(e) {}
  }
})();

/* ------------------------------------------------------------------ */
/* 5) Engine hooks                                                      */
/*    สอดคล้องสัญญา A–D (missions-safe):                              */
/*    - init(gameState, hud, diff)                                     */
/*    - cleanup()                                                      */
/*    - tick(dtMs?, now?)  (optional)                                  */
/*    - pickMeta(diff) -> meta                                         */
/*    - onHit(meta, systems) -> 'good'|'bad'|'ignore' (ผลให้ engineแปลเป็นคะแนน) */
/*    - getPowerDurations(), powers.*                                  */
/*    - fx.onSpawn/ onHit                                              */
/* ------------------------------------------------------------------ */

export function init(gameState = {}, hud = null, diff = {}) {
  ST.lang = (localStorage.getItem('hha_lang') || gameState.lang || 'TH').toUpperCase();
  resetLocal();

  // กำหนด “จำนวนของดีขั้นต่ำ” เพื่อให้ภารกิจดูมีเป้าหมาย
  // (ตัวเลขนี้ใช้เป็นแนวทาง ไม่บังคับจบเกม)
  const d = (gameState?.difficulty || diff?.name || '').toString().toLowerCase();
  ST.needGood = d === 'hard' ? 20 : (d === 'easy' ? 10 : 15);

  // ถ้า engine ใช้ภารกิจ ให้แจ้ง “เป้าหมายเบื้องต้น”
  try {
    hud?.mission?.setPrimary?.(
      t(`เก็บอาหารดีอย่างน้อย ${ST.needGood} ชิ้น`,
        `Collect at least ${ST.needGood} healthy items`,
        ST.lang)
    );
  } catch(e) {}
}

export function cleanup() {
  resetLocal();
}

export function tick(dtMs = 0, now = performance.now()) {
  // ใช้คำนวณ Mission: “หลีกเลี่ยงของขยะ n วินาที”
  // โดย dtMs จะถูกส่งมาจาก engine (ถ้าไม่มี ให้คำนวณเอง)
  if (!dtMs) {
    dtMs = now - (ST.lastTickTs || now);
  }
  ST.lastTickTs = now;
  ST.avoidJunkTimerMs += dtMs;
}

/* ------------------------------------------------------------------ */
/* 6) Spawn meta: engine จะใช้เมทาเพื่อสร้างเป้าหมายบนฉาก             */
/*    - สัดส่วน GOOD:JUNK ~ 60:40                                     */
/*    - life (TTL) มีเพดาน/พื้น                                        */
/*    - mult = 2 เมื่ออยู่ในช่วง x2Until                               */
/*    - points ใส่เพื่อ backward-compat (engine เก่าอาจอ่าน meta.points) */
/* ------------------------------------------------------------------ */
export function pickMeta(diff = {}) {
  const isGood = Math.random() < 0.6;
  const pool = isGood ? GOOD : JUNK;
  const it = pool[(Math.random() * pool.length) | 0];

  const golden = performance.now() < ST.x2Until;
  const mult = golden ? 2 : 1;

  const baseLife = Number(diff.life) > 0 ? Number(diff.life) : 3000;
  const life = clamp(baseLife, 700, 4500);

  // คะแนนพื้นฐาน ถ้า engine ใหม่คิดคะแนนเองจาก 'good/bad' ก็ไม่เป็นไร
  const basePoints = isGood ? 10 : -5;

  return {
    // identity
    id: it.id,
    labelEN: it.labelEN,
    labelTH: it.labelTH,
    char: it.icon,

    // gameplay
    good: isGood,
    points: basePoints, // for backward compatibility
    mult,
    life,
    golden,

    // hint เพิ่มเติมให้ engine ใช้ได้
    // e.g., category:'food', rarity:'common'
  };
}

/* ------------------------------------------------------------------ */
/* 7) Hit logic: ส่งผลกลับให้ engine                                  */
/*    return: 'good' | 'bad' | 'ignore'                                */
/* ------------------------------------------------------------------ */
export function onHit(meta = {}, systems = {}) {
  const coach = systems.coach;
  // ถ้าโดน “ดี”
  if (meta.good) {
    ST.gotGood++;
    ST.streakGood++;
    ST.avoidJunkTimerMs = 0; // รีเซ็ตมิชชั่น “เลี่ยงขยะ”

    // โค้ชพูด (ไม่รบกวนถ้าไม่มีระบบ coach)
    safeCoachSay(
      coach,
      t('เยี่ยม! อาหารดี', 'Great! Healthy pick', ST.lang)
    );

    // ปล่อยอีเวนต์ mission (ถ้า engine ฟัง)
    systems.mission?.emit?.('good-pick', { streakGood: ST.streakGood, gotGood: ST.gotGood });

    // แจ้ง HUD ความคืบหน้าเป้าหมายหลัก
    try {
      systems.hud?.mission?.setProgress?.(ST.gotGood / Math.max(1, ST.needGood));
    } catch(e) {}

    return 'good';
  }

  // โดน “ขยะ”
  ST.streakGood = 0;
  ST.avoidJunkTimerMs = 0;

  safeCoachSay(
    coach,
    t('ระวังของขยะ!', 'Careful, junk!', ST.lang)
  );

  systems.mission?.emit?.('junk-hit', {});

  return 'bad';
}

/* ------------------------------------------------------------------ */
/* 8) Powers & durations: ให้ engine ผูกกับ UI bar ได้                  */
/* ------------------------------------------------------------------ */
export function getPowerDurations() {
  return { x2: 8, freeze: 3, magnet: 0 };
}

export const powers = {
  x2Target() {
    ST.x2Until = performance.now() + 8000;
  },
  freezeTarget() {
    // ให้ engine จัดการ freeze spawn โดยรวม
  },
  magnetNext() {
    // โหมดนี้ไม่ใช้แม่เหล็ก (เว้นไว้ให้ engine ข้าม)
  },
};

/* ------------------------------------------------------------------ */
/* 9) FX hooks: เรียกผ่าน engine ตอน spawn/hit                         */
/* ------------------------------------------------------------------ */
export const fx = {
  onSpawn(el/*, state*/) {
    try { FX.add3DTilt?.(el); } catch(e) {}
  },
  onHit(x, y/*, meta, state*/) {
    try { FX.shatter3D?.(x, y); } catch(e) {}
  }
};

/* ------------------------------------------------------------------ */
/* 10) Utils                                                           */
/* ------------------------------------------------------------------ */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function safeCoachSay(coach, text) {
  try { coach?.say?.(text); } catch(e) {}
}
