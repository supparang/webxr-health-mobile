// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บอาหารดี หลีกเลี่ยงอาหารขยะ
// ส่งผลลัพธ์ให้ main.js ใช้คอมโบ/FEVER: 'good' | 'bad'
// มีการปรับอายุไอคอน (life) แบบ adaptive ตามความแม่นยำ

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];

// ตั้งค่าขั้นต่ำของ life ต่อความยาก (กัน “โผล่ไวหายไว” เกินไป)
const MIN_LIFE_BY_DIFF = {
  Easy:   2600,
  Normal: 2200,
  Hard:   1900
};

export function init(state /*, hud, diff */){
  // เตรียมคอนเท็กซ์สำหรับคำนวณความแม่นยำ
  state.ctx = state.ctx || {};
  state.ctx.gj = { hits:0, miss:0 };
}

export function pickMeta(diff, state){
  // 65% อาหารดี, 35% อาหารขยะ
  const isGood = Math.random() < 0.65;
  const char = isGood
    ? HEALTHY[(Math.random()*HEALTHY.length)|0]
    : JUNK[(Math.random()*JUNK.length)|0];

  // ===== ปรับ life แบบ adaptive จากความแม่นยำผู้เล่น =====
  const gj   = state.ctx?.gj || { hits:0, miss:0 };
  const total= gj.hits + gj.miss;
  const acc  = total > 0 ? (gj.hits / total) : 1; // ยังไม่มีข้อมูล = ถือว่าแม่น 100%

  // ถ้าแม่นน้อย → ยืดอายุไอคอนให้นานขึ้น, ถ้าแม่นสูง → สั้นลงเล็กน้อย
  const boost = acc < 0.60 ? 1.22 : (acc < 0.80 ? 1.10 : 0.98);
  const baseLife = (diff?.life || 3000) * boost;

  const minLife = MIN_LIFE_BY_DIFF[state.difficulty] || MIN_LIFE_BY_DIFF.Normal;
  const life = Math.max(minLife, Math.round(baseLife));

  return { type:'food', char, life, good:isGood };
}

export function onHit(meta, sys, state /*, hud */){
  // อัปเดตสถิติความแม่นยำ เพื่อใช้ปรับ life รอบต่อไป
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0 });

  if (meta.good){
    gj.hits++;
    // ไม่เพิ่มคะแนนที่นี่ ปล่อยให้ main.js จัดการ (รวม combo/fever ให้ด้วย)
    return 'good';
  } else {
    gj.miss++;
    return 'bad';
  }
}

export function tick(/* state, sys, hud */){
  // โหมดนี้ไม่ต้องทำอะไรเป็นรายวินาที
}

export function cleanup(state /*, hud */){
  if (state?.ctx?.gj){
    state.ctx.gj = { hits:0, miss:0 };
  }
}
