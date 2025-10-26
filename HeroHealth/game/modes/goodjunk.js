// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์กับ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: เควสต์ 5 แบบ (สุ่มมา 3), adaptive life, Perfect tap, Power-ups (x2 / Freeze / Sweep), Traps

/* =========================
   1) คงที่ / ทรัพยากร
   ========================= */
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽','🫘','🥝','🫐'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃','🍗','🥓','🍨'];
const TRAPS   = ['💣','☠️','⚠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };

const POWER_RATE = { Easy:0.09, Normal:0.11, Hard:0.13 }; // โอกาสเกิด power ต่อการ spawn
const ENABLED_POWERS = ['scorex2','freeze','sweep'];       // เพิ่ม 'sweep' กวาดเก็บของดีบนจอ
const ENABLE_TRAPS = true;
const TRAP_RATE = 0.055;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// โควตาเควสต์ตามความยาก
const QUEST_NEED = { Easy: {A:8, B:0, C:5, D:2, E:4},  // A=collect, C=perfect, D=power, E=streak
                     Normal:{A:10,B:0, C:7, D:3, E:5},
                     Hard: {A:12,B:0, C:9, D:4, E:6} };
// อนุโลม “หลีกเลี่ยงของเสีย” (B) — จำนวน miss ได้สูงสุด
const QUEST_B_MISS_MAX = { Easy:4, Normal:3, Hard:2 };
// เวลาเควสต์แต่ละชิ้น
const QUEST_SECONDS = 45;

/* =========================
   2) ยูทิล
   ========================= */
const pick = (arr)=>arr[(Math.random()*arr.length)|0];
const shuffle = (arr)=>arr.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
function pickN(arr, n){ const a = shuffle(arr).slice(0, n); return a; }

// power icon
function iconOf(power){
  if (power==='scorex2') return '✖️2';
  if (power==='freeze')  return '🧊';
  if (power==='sweep')   return '🧹';
  return '✨';
}

// อายุวัตถุแบบ adaptive ตามความแม่น
function lifeAdaptive(diff, state, mul=1){
  const g = state.ctx?.gj;
  const hits = g?.hits||0, miss = g?.miss||0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

/* =========================
   3) โครงเควสต์ (5 แบบ)
   =========================
   A) เก็บของดีให้ครบ N ชิ้น
   B) หลีกเลี่ยงของเสีย (miss รวมไม่เกิน X) — เป็น “ข้อกำหนด” ที่ล้มเหลวได้
   C) Perfect tap N ครั้ง (แตะเร็ว ≤ PERFECT_WINDOW_MS)
   D) ใช้/เก็บพาวเวอร์ N ชิ้น
   E) ทำสตรีคของดีต่อเนื่อง N ครั้ง (good/perfect ติดกัน)
*/
function mkQuestTemplates(diff){
  const need = QUEST_NEED[diff] || QUEST_NEED.Normal;
  const missMax = QUEST_B_MISS_MAX[diff] ?? 3;
  const secs = QUEST_SECONDS;

  return [
    { id:'collect_good',  titleTH:'เก็บของดีให้ครบ', titleEN:'Collect healthy items', icon:'🥗',
      need:need.A, progress:0, remain:secs, done:false, fail:false },

    { id:'avoid_junk',    titleTH:'อย่าพลาดของเสีย', titleEN:'Avoid junk/mistakes', icon:'🛡️',
      // เควสต์นี้สำเร็จโดย "ไม่เกิน missMax" เมื่อหมดเวลา (ไม่มี progress/need ตัวเลขขึ้นทีละคลิก)
      need:missMax, progress:0, remain:secs, done:false, fail:false, meta:{ misses:0 } },

    { id:'perfect_hits',  titleTH:'ทำ PERFECT ให้ครบ', titleEN:'Make PERFECT taps', icon:'💯',
      need:need.C, progress:0, remain:secs, done:false, fail:false },

    { id:'power_user',    titleTH:'ใช้พลังช่วยให้ครบ', titleEN:'Use power-ups', icon:'⚡',
      need:need.D, progress:0, remain:secs, done:false, fail:false },

    { id:'good_streak',   titleTH:'ทำสตรีคของดีต่อเนื่อง', titleEN:'Consecutive good streak', icon:'🔥',
      need:need.E, progress:0, remain:secs, done:false, fail:false, meta:{ streak:0 } }
  ];
}

/* =========================
   4) API หลัก
   ========================= */
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  const gj = state.ctx.gj = {
    hits:0, miss:0,
    lastTapTs:0,
    // เควสต์: สร้าง 5 แล้วสุ่มเลือก 3
    quests: pickN(mkQuestTemplates(state.difficulty), 3),
  };

  // บัฟแสดงเควสต์ตอนเริ่ม (main จะ render จาก state.ctx.gj.quests)
  const active = gj.quests[0];
  try{ hud?.setFeverProgress?.(0); }catch{}
  try{ state?.coach?.say?.('พร้อมลุยเควสต์! เลือกเก็บของดีให้ครบ 💪'); }catch{}
  // ให้โค้ชผ่าน sys ใน onHit/tick แทน (main จะส่ง coach มากับ sys)
}

export function pickMeta(diff, state){
  const ts = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

  // power?
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // trap?
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // food
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state, hud){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj;

  if (!gj) return 'ok';

  // === POWER ===
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      try{ power?.apply?.('boost'); }catch{}
      fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
      addQuestProgress(gj, 'power_user', 1, fx, coach);
    } else if (meta.power === 'freeze'){
      const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
      state.freezeUntil = now + 2200;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' });
      addQuestProgress(gj, 'power_user', 1, fx, coach);
    } else if (meta.power === 'sweep'){
      // โชว์ข้อความ + นับเป็นใช้พลัง
      fx?.popText?.('SWEEP!', { color:'#66ffd2' });
      addQuestProgress(gj, 'power_user', 1, fx, coach);
      // ตัวเกมหลักจะเอาไปประยุกต์เพิ่มเอง (optional)
    }
    return 'power';
  }

  // === TRAP ===
  if (meta.type === 'trap'){
    gj.miss++;
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!', { color:'#ff9b9b' });
    noteAvoidQuestMiss(gj, coach);      // เควสต์ B
    resetStreakQuest(gj);               // รีเซ็ตสตรีค (E)
    coachSayRandom(coach, ['โอ๊ย! ระวังหน่อย!', 'ไม่เป็นไร ลุยต่อ! 💪']);
    return 'bad';
  }

  // === FOOD ===
  if (meta.type === 'food'){
    const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

    if (meta.good){
      gj.hits++;

      // A: สะสมของดี
      addQuestProgress(gj, 'collect_good', 1, fx, coach);

      // E: streak ของดี
      bumpStreakQuest(gj, fx, coach);

      // PERFECT?
      if (meta.ts && (now - meta.ts) <= PERFECT_WINDOW_MS){
        try{ sfx?.perfect?.(); }catch{ try{ sfx?.good?.(); }catch{} }
        fx?.popText?.('PERFECT',{ color:'#ccff88' });
        addQuestProgress(gj, 'perfect_hits', 1, fx, coach);  // C: perfect
        return 'perfect';
      }

      try{ sfx?.good?.(); }catch{}
      fx?.popText?.('GOOD',{ color:'#7fffd4' });
      return 'good';
    } else {
      gj.miss++;
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{ color:'#ff9b9b' });
      noteAvoidQuestMiss(gj, coach);     // B: หลีกเลี่ยงของเสีย
      resetStreakQuest(gj);              // E: สตรีคขาด
      coachSayRandom(coach, ['พลาดไปนิดเดียว! ลองใหม่!', 'ใจเย็น ๆ สู้ต่อ!']);
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys, hud){
  const { coach, fx } = sys || {};
  const gj = state.ctx?.gj; if (!gj?.quests) return;

  // ลดเวลาทุกเควสต์ที่ยังไม่จบ/ไม่ล้มเหลว
  let anyActive = false;
  for (const q of gj.quests){
    if (q.done || q.fail) continue;
    q.remain = Math.max(0, q.remain - 1);
    if (q.remain === 0){
      // เช็คเงื่อนไขจบ (โดยเฉพาะ B ที่สำเร็จได้ถ้า miss ไม่เกินกำหนด)
      if (q.id === 'avoid_junk'){
        const missMax = QUEST_B_MISS_MAX[state.difficulty] ?? 3;
        const misses = q.meta?.misses || 0;
        if (misses <= missMax){ // สำเร็จ
          q.done = true; fx?.popText?.('✅ เควสต์สำเร็จ',{color:'#a6ff9b'});
          coach?.say?.('ยอดเยี่ยม! ระวังได้ดีมาก ✨');
        } else {
          q.fail = true; fx?.popText?.('⌛ เควสต์ล้มเหลว',{color:'#ffb3b3'});
          coach?.say?.('ไม่เป็นไร! เควสต์อื่นยังไปต่อได้ 💪');
        }
      } else {
        // เควสต์ทั่วไป: ถ้ายังไม่ถึง need = fail
        if ((q.progress|0) >= (q.need|0)){
          q.done = true; fx?.popText?.('✅ เควสต์สำเร็จ',{color:'#a6ff9b'});
          coach?.say?.('สวย! ไปต่อเควสต์ถัดไปกัน 🚀');
        }else{
          q.fail = true; fx?.popText?.('⌛ หมดเวลาเควสต์',{color:'#ffb3b3'});
          coach?.say?.('ไม่เป็นไร เควสต์ถัดไปยังไหว!');
        }
      }
    } else {
      anyActive = true;
    }
  }

  // กระตุ้นผู้เล่นเบา ๆ
  if (anyActive && (state.timeLeft % 10 === 0)){
    const left = gj.quests.find(q=>!q.done && !q.fail);
    if (left){
      coachSayRandom(coach, [
        `สู้ ๆ! ${left.titleTH} เหลือ ${Math.max(0,left.need-left.progress)} ชิ้น`,
        'รักษาจังหวะนี้ไว้!',
        'ทำได้ดี! อย่าลดความเร็ว!'
      ]);
    }
  }
}

export function cleanup(state){
  // ไม่มีทรัพยากรค้างที่ต้องล้างนอกเหนือจาก state
}

/* =========================
   5) ตัวช่วยด้านเควสต์
   ========================= */
function addQuestProgress(gj, id, inc=1, fx, coach){
  const q = gj.quests?.find(x=>x.id===id && !x.done && !x.fail);
  if (!q) return;
  q.progress = Math.min(q.need|0, (q.progress|0) + inc);
  if ((q.progress|0) >= (q.need|0)){
    q.done = true;
    fx?.popText?.('🏁 Quest Complete!', { color:'#7fffd4' });
    coach?.say?.('เยี่ยม! เควสต์สำเร็จแล้ว 🏅');
  }
}
function noteAvoidQuestMiss(gj, coach){
  const q = gj.quests?.find(x=>x.id==='avoid_junk' && !x.done && !x.fail);
  if (!q) return;
  q.meta = q.meta || { misses:0 };
  q.meta.misses++;
  // แจ้งเตือนเมื่อเข้าใกล้เพดาน
  const missMax = QUEST_B_MISS_MAX[gj?.diff || 'Normal'] ?? 3; // เผื่อไม่มี diff ใน ctx
  if (q.meta.misses === missMax){
    coach?.say?.('ระวัง! ถ้าเสียอีกจะพลาดเควสต์นี้นะ 🫣');
  }
}
function bumpStreakQuest(gj, fx, coach){
  const q = gj.quests?.find(x=>x.id==='good_streak' && !x.done && !x.fail);
  if (!q) return;
  q.meta = q.meta || { streak:0 };
  q.meta.streak++;
  // อัปเดต progress = ค่าสูงสุดที่ทำได้ (หรือจะนับทุกครั้งก็ได้ตามดีไซน์)
  q.progress = Math.max(q.progress|0, q.meta.streak|0);
  if (q.progress >= (q.need|0)){
    q.done = true; fx?.popText?.('🔥 Streak Achieved!', { color:'#ffec99' });
    coach?.say?.('สุดยอด! สตรีคโหดมาก! 🔥');
  }else if (q.meta.streak % 3 === 0){
    coach?.say?.(`สตรีค ${q.meta.streak} แล้ว! ไปต่อ!`);
  }
}
function resetStreakQuest(gj){
  const q = gj.quests?.find(x=>x.id==='good_streak' && !x.done && !x.fail);
  if (!q) return;
  q.meta = q.meta || { streak:0 };
  q.meta.streak = 0;
}
function coachSayRandom(coach, arr){
  if (!coach || !coach.say) return;
  if (Math.random()<0.5) coach.say(pick(arr));
}
