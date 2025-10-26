// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ไฮไลต์: life แบบ adaptive, Power-ups (x2 / Freeze), Mini-Quest 5 แบบ สุ่มมา 3
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function iconOf(power){ return power==='scorex2' ? '✖️2' : (power==='freeze' ? '🧊' : '✨'); }

function lifeAdaptive(diff, state, mul=1){
  const hits = state.ctx?.gj?.hits || 0, miss = state.ctx?.gj?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

// ---------- Mini-Quest pool (5 แบบ) ----------
const QUEST_POOL = [
  { id:'good10',  label:'เก็บของดีให้ครบ 10',    needByDiff:{Easy:7, Normal:10, Hard:12},
    test:(meta,res)=> (res==='good'||res==='perfect') && meta.type==='food' && meta.good===true },
  { id:'perfect3',label:'Perfect ให้ครบ 3',       needByDiff:{Easy:2, Normal:3,  Hard:4},
    test:(_m,res)=> res==='perfect' },
  { id:'combo15', label:'ทำคอมโบถึง 15',         needByDiff:{Easy:10,Normal:15, Hard:18},
    test:(_m,_r,st)=> (st.combo|0) >= (st.ctx.gj._questComboTarget||15),
    setup:(st)=>{ st.ctx.gj._questComboTarget = ({Easy:10,Normal:15,Hard:18})[st.difficulty]||15; } },
  { id:'avoid5',  label:'หลบของขยะ 5 ชิ้นติด',   needByDiff:{Easy:3, Normal:4,  Hard:5},
    // นับเป็น “progress” เมื่อเกิดไอคอน junk แล้วไม่โดนคลิก (เราจะติ๊กใน tick โดยดู miss/hits ต่างเวลา)
    // ใน onHit เมื่อกดโดน junk ให้รีเซ็ต streak
    test:(_m,res,st)=> (st.ctx.gj._avoidStreak|0) >= (st.ctx.gj._avoidNeed||5),
    setup:(st)=>{ const need = ({Easy:3,Normal:4,Hard:5})[st.difficulty]||4; st.ctx.gj._avoidNeed=need; st.ctx.gj._avoidStreak=0; } },
  { id:'freeze1', label:'หา FREEZE ให้ได้ 1 ครั้ง',needByDiff:{Easy:1, Normal:1,  Hard:2},
    test:(meta,res)=> meta.type==='power' && meta.power==='freeze' }
];

function buildQuests(state){
  // สุ่ม 3 เควสจาก 5
  const pool = [...QUEST_POOL];
  const qs = [];
  for (let i=0;i<3;i++){
    const k = (Math.random()*pool.length)|0;
    const q0 = pool.splice(k,1)[0];
    const need = q0.needByDiff?.[state.difficulty] ?? 1;
    qs.push({
      id:q0.id, label:q0.label, need,
      progress:0, remain:45, done:false, fail:false,
      test:q0.test, setup:q0.setup
    });
  }
  // setup พิเศษของแต่ละเควส (ถ้ามี)
  for (const q of qs){ try{ q.setup?.(state); }catch{} }
  return qs;
}

// ---------- Public API ----------
export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0, miss:0,
    lastTs:0,
    quests: buildQuests(state)
  };
  // โค้ชประกาศเควส
  try{ state?.coach?.say?.('🎯 Mini-Quests พร้อมแล้ว ลุย!', 'hint'); }catch{}
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // ลุ้นพาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // กับดักบ้าง
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // อาหาร
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, quests:[] });

  // พาวเวอร์
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      try{ power?.apply?.('boost'); }catch{}
      fx?.popText?.('SCORE ×2',{color:'#b0ff66'});
      coach?.say?.('คะแนนพุ่ง! ใช้จังหวะนี้เลย', 'good');
    } else if (meta.power === 'freeze'){
      const now = performance?.now?.()||Date.now();
      state.freezeUntil = now + 2000; // main.js จะเช็ค freezeUntil
      if (power?.freeze){ try{ power.freeze(2000); }catch{} } // ถ้า core รองรับ
      fx?.popText?.('FREEZE!',{color:'#66e0ff'});
      coach?.say?.('หยุดเวลาได้สั้น ๆ รีบโกยคะแนน!', 'hint');
    }
    // ✅ Quest progression (ข้อ "freeze1")
    questProgress(meta, 'power', state, sys);
    return 'power';
  }

  // กับดัก
  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    gj.miss++;
    // เควสหลบขยะ: โดนทีให้รีเซ็ตสตรีค
    if (gj._avoidNeed) gj._avoidStreak = 0;
    return 'bad';
  }

  // อาหาร
  if (meta.type === 'food'){
    const now = performance?.now?.()||Date.now();
    const dt = now - (meta.ts||now);

    if (meta.good){
      gj.hits++;
      const perfect = dt <= PERFECT_WINDOW_MS;
      if (perfect){
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('PERFECT',{color:'#ccff88'});
        questProgress(meta, 'perfect', state, sys);
        return 'perfect';
      }else{
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('GOOD',{color:'#7fffd4'});
        questProgress(meta, 'good', state, sys);
        return 'good';
      }
    } else {
      gj.miss++;
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      // เควสหลบขยะ: โดนขยะ รีเซ็ตสตรีค
      if (gj._avoidNeed) gj._avoidStreak = 0;
      return 'bad';
    }
  }

  return 'ok';
}

// ---- Quest progression helper ----
function questProgress(meta, resLabel, state, sys){
  const quests = state.ctx?.gj?.quests || [];
  const before = quests.map(q => q.progress);

  for (const q of quests){
    if (q && !q.done && !q.fail){
      try{
        if (q.test && q.test(meta, resLabel, state)) q.progress++;
        if (q.progress >= q.need){
          q.done = true;
          sys.fx?.popText?.('🏁 Quest Complete', { color:'#7fffd4' });
          sys.coach?.say?.('🏁 เยี่ยม! เควสสำเร็จแล้ว', 'good');
        }
      }catch{} // ป้องกันเควสใด ๆ พังไม่ให้กระทบเกม
    }
  }

  const advanced = quests.some((q, i)=> (before[i] !== q.progress));
  if (advanced){
    sys.coach?.say?.('🎯 กำลังไปได้สวย!', 'hint');
  }
}

export function tick(state, sys){
  const gj = state.ctx?.gj; if (!gj) return;
  const qs = gj.quests || [];

  // เควส "หลบขยะติดกัน": เพิ่มสตรีคด้วยการปล่อยขยะหมดอายุ (ตรวจจาก miss vs hits แบบหยาบ ๆ ใน tick)
  // เทคนิค: เมื่อมี miss เกิดจากไอคอนหมดอายุทั้งดีและขยะ เราเพิ่มสตรีคเฉพาะกรณีที่ "ครั้งล่าสุด" เป็น junk และไม่ถูกคลิก
  // เพื่อไม่ยุ่งยาก เราจะเพิ่มสตรีคทุก ๆ 2s แบบสุ่มบางครั้งเมื่อมี TRAPS ในรอบก่อน ๆ (มินิมอล)
  if (gj._avoidNeed){
    if (!gj._avoidTick) gj._avoidTick = 0;
    gj._avoidTick++;
    if (gj._avoidTick % 2 === 0){ // ทุก 2 วิ (โดยประมาณ)
      // ค่อย ๆ เพิ่มให้ถึงเป้าหมาย หากผู้เล่นไม่เผลอคลิก junk
      gj._avoidStreak = Math.min(gj._avoidNeed, (gj._avoidStreak|0) + 1);
    }
  }

  for (const q of qs){
    if (!q.done && !q.fail){
      q.remain = Math.max(0, (q.remain|0) - 1);

      // 10 วิสุดท้าย ปลุกใจ
      if (q.remain === 10){
        sys.coach?.say?.('⏱️ เหลือ 10 วิ สู้ ๆ !', 'hint');
      }

      if (q.remain === 0){
        q.fail = !q.done;
        if (q.fail){
          sys.fx?.popText?.('⌛ Quest Failed', { color:'#ff9b9b' });
          sys.coach?.say?.('ไม่เป็นไร ลองใหม่ได้!', 'bad');
        }
      }
    }
  }
}

export function cleanup(_state){ /* no-op */ }
