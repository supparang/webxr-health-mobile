// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลกลับไปให้ main.js เป็นผลลัพธ์สั้น ๆ: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์:
// - สุ่มสัดส่วนของดี/ขยะตามระดับความยาก
// - Power-ups: SCORE×2 (boost คะแนนผ่าน power.apply('boost')), FREEZE (ชะลอสแปวน์ชั่วคราว)
// - Perfect hit: แตะเร็วมากภายใน PERFECT_WINDOW_MS หลัง spawn → ได้ 'perfect'

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️']; // ตัวลวง (-คะแนนแน่)

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };  // โอกาสเกิด power-up ต่อหนึ่งสแปวน์
const ENABLED_POWERS = ['scorex2','freeze'];

const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06;

const PERFECT_WINDOW_MS = 320; // แตะทันทีหลัง spawn ภายในเวลานี้จะได้ 'perfect'
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// ---------- Public API ----------
export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = { hits:0, miss:0 };
}

export function pickMeta(diff, state){
  const ts = nowMs();

  // power-up?
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return {
      type:'power',
      power:p,
      char: iconOf(p),
      life: lifeAdaptive(diff, state, 1.0),
      ts
    };
  }

  // trap?
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return {
      type:'trap',
      char,
      good:false,
      life: lifeAdaptive(diff, state, 1.05),
      ts
    };
  }

  // healthy vs junk
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return {
    type:'food',
    char,
    good: wantGood,
    life: lifeAdaptive(diff, state, 1.0),
    ts
  };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0 });

  // ----- Power-ups -----
  if (meta.type === 'power'){
    try { sfx?.play?.('sfx-powerup'); } catch {}
    if (meta.power === 'scorex2'){
      // ใช้ระบบ boost กลาง (main.js จะคูณคะแนนช่วงเวลาหนึ่ง)
      try { power?.apply?.('boost'); } catch {}
      try { fx?.popText?.('SCORE ×2', { color:'#b0ff66' }); } catch {}
    } else if (meta.power === 'freeze'){
      // ชะลอสแปวน์ชั่วคราว โดยใช้ตัวคูณ timeScale (ยิ่งมากยิ่งช้า)
      try {
        const old = power.timeScale || 1;
        power.timeScale = Math.max(old, 1.8);
        setTimeout(()=>{ power.timeScale = 1; }, 2000);
      } catch {}
      try { fx?.popText?.('FREEZE!', { color:'#66e0ff' }); } catch {}
    }
    return 'power';
  }

  // ----- Traps -----
  if (meta.type === 'trap'){
    gj.miss++;
    try { sfx?.bad?.(); } catch {}
    try { fx?.popText?.('TRAP!', { color:'#ff9b9b' }); } catch {}
    return 'bad';
  }

  // ----- Foods -----
  if (meta.type === 'food'){
    const dt = Math.max(0, nowMs() - (meta.ts||nowMs()));
    const isPerfect = !!meta.good && (dt <= PERFECT_WINDOW_MS);

    if (meta.good){
      gj.hits++;
      try { sfx?.good?.(); } catch {}
      try { fx?.popText?.(isPerfect ? 'PERFECT!' : 'GOOD!', { color: isPerfect ? '#ccff88' : '#7fffd4' }); } catch {}
      return isPerfect ? 'perfect' : 'good';
    } else {
      gj.miss++;
      try { sfx?.bad?.(); } catch {}
      try { fx?.popText?.('JUNK!', { color:'#ff9b9b' }); } catch {}
      return 'bad';
    }
  }

  // เผื่อมีชนิดอื่น ๆ ในอนาคต
  return meta.good ? 'good' : 'bad';
}

export function tick(/* state, sys */){
  // โหมดนี้ไม่ต้องทำอะไรทุกวินาที
}

export function cleanup(state, sys){
  // คืนค่าที่อาจถูกปรับจาก power ในโหมดนี้
  try { if (sys?.power) sys.power.timeScale = 1; } catch {}
  if (state?.ctx?.gj){
    state.ctx.gj.hits = 0;
    state.ctx.gj.miss = 0;
  }
}

// ---------- Helpers ----------
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function iconOf(p){
  if (p === 'scorex2') return '✖️2';
  if (p === 'freeze')  return '🧊';
  return '✨';
}

function nowMs(){
  try { return performance.now(); } catch { return Date.now(); }
}

function lifeAdaptive(diff, state, mul){
  const base = (diff && diff.life) ? diff.life : 3000;
  const dkey = state?.difficulty || 'Normal';
  const minLife = MIN_LIFE_BY_DIFF[dkey] || 2000;

  // อย่าให้สั้นเกินไปในโหมด Hard แต่อยากให้เร็วกว่า Easy/Normal
  const t = Math.max(minLife, Math.round(base * (mul || 1)));
  return t;
}
