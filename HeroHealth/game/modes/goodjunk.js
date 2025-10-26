// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Perfect tap (กดไวได้คะแนน/คอมโบดีขึ้น), Power-ups (x2 / Freeze)

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️']; // ถ้าจะปิดกับดัก ให้ตั้ง ENABLE_TRAPS=false

/* ====== ปรับแต่งง่าย ๆ ตรงนี้ ====== */
// สัดส่วน “ของดี” ตามระดับความยาก
const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
// อัตราเกิดพาวเวอร์อัปต่อการสแปวน์ (0..1)
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
// ประเภทพาวเวอร์ที่เปิดใช้
const ENABLED_POWERS = ['scorex2','freeze']; // ลองเพิ่ม 'heal' ได้ถ้าทำระบบ HP
// เปิด/ปิดกับดัก (จะสุ่มไอคอน TRAPS ด้วยความน่าจะเป็นเล็กน้อย)
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06; // 6% มีไอคอนกับดัก

// เกณฑ์ PERFECT tap (ms) — กดทันทีหลังเกิดเร็วกว่า X ms จะได้ perfect
const PERFECT_WINDOW_MS = 320;

// ขั้นต่ำ life ต่อความยาก (กันหายเร็วเกินคลิกไม่ทัน)
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// เมื่อกด power_freeze จะหยุด/ชะลอ spawn ชั่วคราว (วินาที)
const FREEZE_SECONDS = 2;

/* =================================== */

export function init(state /*, hud, diff */){
  state.ctx = state.ctx || {};
  state.ctx.gj = { hits:0, miss:0 };
}

export function pickMeta(diff, state){
  const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

  // 1) โอกาสพาวเวอร์อัป
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return {
      type: 'power',
      power: p,                   // 'scorex2' | 'freeze' | ...
      char: powerIcon(p),
      life: clampLife(diff, state, {boost:1.0}),
      ts: now
    };
  }

  // 2) โอกาสกับดัก
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = TRAPS[(Math.random()*TRAPS.length)|0];
    return {
      type: 'trap',
      char,
      good: false,
      life: clampLife(diff, state, {boost:1.05}), // ให้อยู่บนจอนานนิดเพื่อให้เห็นและหลบ
      ts: now
    };
  }

  // 3) ของดี/ของขยะ
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood
    ? HEALTHY[(Math.random()*HEALTHY.length)|0]
    : JUNK[(Math.random()*JUNK.length)|0];

  return {
    type: 'food',
    char,
    good: wantGood,
    life: clampLife(diff, state, {boost:1.0}),
    ts: now
  };
}

export function onHit(meta, sys, state /*, hud */){
  const { score, sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0 });

  // ---- Power-ups ----
  if (meta.type === 'power'){
    try { sfx?.play?.('sfx-powerup'); } catch {}
    // จัดการพาวเวอร์ตามชนิด
    if (meta.power === 'scorex2'){
      // ใช้ระบบบูสต์คะแนนจาก PowerUpSystem (ถ้ามี)
      try { power?.apply?.('boost'); } catch {}
      fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
    } else if (meta.power === 'freeze'){
      // ชะลอสแปวน์ชั่วคราว
      const old = power?.timeScale ?? 1;
      if (power) power.timeScale = 99;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' });
      setTimeout(()=>{ if(power) power.timeScale = old||1; }, FREEZE_SECONDS*1000);
    }
    return 'power';
  }

  // ---- Traps ----
  if (meta.type === 'trap'){
    try { sfx?.bad?.(); } catch {}
    fx?.popText?.('TRAP!', { color:'#ff7a7a' });
    gj.miss++;
    return 'bad';
  }

  // ---- Foods ----
  if (meta.type !== 'food'){
    // กันข้อมูลประหลาด
    try { sfx?.bad?.(); } catch {}
    return 'bad';
  }

  const quickMs = elapsedSince(meta);
  const isPerfectTap = (meta.good && quickMs <= PERFECT_WINDOW_MS) || (state?.fever?.active);

  if (meta.good){
    gj.hits++;
    try { sfx?.good?.(); } catch {}
    if (isPerfectTap){
      fx?.popText?.('PERFECT!', { color:'#ccff88' });
      return 'perfect';
    }
    return 'good';
  } else {
    gj.miss++;
    try { sfx?.bad?.(); } catch {}
    return 'bad';
  }
}

export function tick(/* state, sys, hud */){
  // โหมดนี้ไม่ต้องทำงานรายวินาทีเป็นพิเศษ
}

export function cleanup(state /*, hud */){
  if (state?.ctx?.gj){ state.ctx.gj = { hits:0, miss:0 }; }
}

/* ========== Helpers ========== */
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function powerIcon(kind){
  if (kind==='scorex2') return '✖️2';
  if (kind==='freeze')  return '🧊';
  return '✨';
}

function clampLife(diff, state, {boost=1.0}={}){
  // ปรับ life ตามความแม่นยำล่าสุด
  const cfg = diff || {};
  const g = state.ctx?.gj || { hits:0, miss:0 };
  const tot = g.hits + g.miss;
  const acc = tot>0 ? g.hits/tot : 1;

  // แม่นน้อย → อยู่นานขึ้น, แม่นสูง → สั้นลงบางส่วน
  const adapt = acc < 0.60 ? 1.22 : (acc < 0.80 ? 1.10 : 0.98);
  const baseLife = (cfg.life || 3000) * adapt * boost;

  const minLife = MIN_LIFE_BY_DIFF[state.difficulty] || MIN_LIFE_BY_DIFF.Normal;
  return Math.max(minLife, Math.round(baseLife));
}

function elapsedSince(meta){
  const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
  const ts  = meta?.ts || now;
  return Math.max(0, now - ts);
}
