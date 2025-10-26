// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Mini-Quest 45s, Power-ups (x2 / Freeze)

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze']; // อาจเพิ่มภายหลัง
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// Mini-Quest: 45s เก็บของดีให้ครบตามความยาก
const QUEST_NEED = { Easy:8, Normal:10, Hard:12 };

// ---------- utils ----------
const pick = (arr)=>arr[(Math.random()*arr.length)|0];
function iconOf(power){
  if (power==='scorex2') return '✖️2';
  if (power==='freeze')  return '🧊';
  return '✨';
}
function lifeAdaptive(diff, state, mul=1){
  const hits = state?.ctx?.gj?.hits || 0;
  const miss = state?.ctx?.gj?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.00;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

// ---------- public API ----------
export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0, miss:0,
    quest:{
      need: QUEST_NEED[state.difficulty] ?? 10,
      progress: 0,
      remain: 45,
      done: false
    }
  };
}

export function pickMeta(diff, state){
  const ts = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

  // ลุ้นพาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // กับดักเล็ก ๆ
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    return { type:'trap', char: pick(TRAPS), good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // ไอเท็มอาหาร
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, quest:{ need:QUEST_NEED[state.difficulty]||10, progress:0, remain:45, done:false } });

  // ===== Power-ups =====
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      try{ power?.apply?.('boost'); }catch{}
      fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
    }else if (meta.power === 'freeze'){
      // รองรับทั้ง main แบบ timeScale และแบบเช็ค freezeUntil
      try{
        power.timeScale = 99;
        setTimeout(()=>{ power.timeScale = 1; }, 2000);
      }catch{}
      const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
      state.freezeUntil = now + 2000;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' });
    }
    return 'power';
  }

  // ===== Traps =====
  if (meta.type === 'trap'){
    gj.miss++;
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!', { color:'#ff9b9b' });
    return 'bad';
  }

  // ===== Food =====
  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++;

      // นับ Mini-Quest
      if (!gj.quest.done){
        gj.quest.progress++;
        if (gj.quest.progress >= gj.quest.need){
          gj.quest.done = true;
          fx?.popText?.('🏁 Quest Complete!', { color:'#7fffd4' });
        }
      }

      // Perfect tap (ภายในหน้าต่างเวลา)
      if (meta.ts){
        const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
        if (now - meta.ts <= PERFECT_WINDOW_MS){
          try{ sfx?.good?.(); }catch{}
          fx?.popText?.('PERFECT', { color:'#ccff88' });
          return 'perfect';
        }
      }
      try{ sfx?.good?.(); }catch{}
      fx?.popText?.('GOOD', { color:'#7fffd4' });
      return 'good';
    }else{
      gj.miss++;
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!', { color:'#ff9b9b' });
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state /* , sys */){
  // เดินเวลาของ Mini-Quest
  const gj = state.ctx?.gj; 
  if (!gj?.quest || gj.quest.done) return;
  gj.quest.remain = Math.max(0, gj.quest.remain - 1);
  // ถ้าหมดเวลาแล้วยังไม่ครบ ถือว่าเควสจบ (ไม่เด้งข้อความล้มเหลวเพื่อไม่รบกวนจอ)
  if (gj.quest.remain === 0 && !gj.quest.done){
    gj.quest.done = true;
  }
}

export function cleanup(/* state */){ /* no-op */ }
