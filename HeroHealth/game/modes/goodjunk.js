// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Mini-Quest 5 แบบ (สุ่มมา 3 ต่อรอบ), Power-ups (x2 / Freeze) + Coaching

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

// Mini-Quests: เตรียม 5 แบบ แล้วสุ่มมา 3 แบบ/รอบ
const QUEST_POOL = [
  { id:'streak5',     titleTH:'กดดีติดกัน 5 ครั้ง',              need:5,   type:'streak' },
  { id:'collect10',   titleTH:'เก็บของดี 10 ชิ้น',                 need:10,  type:'goodCount' },
  { id:'avoid5',      titleTH:'หลบของขยะ 5 ครั้งติด',             need:5,   type:'avoidStreak' },
  { id:'perfect3',    titleTH:'PERFECT 3 ครั้ง',                   need:3,   type:'perfect' },
  { id:'time15',      titleTH:'ทำคะแนนต่อเนื่อง 15 วินาที',       need:15,  type:'timeCombo' }
];

const QUEST_TIME = 45; // แต่ละเควสมีเวลาของตัวเอง

const pick = (arr)=>arr[(Math.random()*arr.length)|0];
const iconOf = (p)=> p==='scorex2' ? '✖️2' : (p==='freeze' ? '🧊' : '✨');

function lifeAdaptive(diff, state, mul=1){
  const hits = state.ctx?.gj?.hits || 0, miss = state.ctx?.gj?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

function sampleQuests(){
  const pool = [...QUEST_POOL];
  const out = [];
  while (out.length<3 && pool.length){
    const i = (Math.random()*pool.length)|0;
    out.push(pool.splice(i,1)[0]);
  }
  return out.map(q=>({
    id:q.id, titleTH:q.titleTH, type:q.type,
    need:q.need, progress:0, remain:QUEST_TIME, done:false, success:false
  }));
}

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0, miss:0,
    streak:0,
    avoidStreak:0,
    lastTapTs:0,
    quests: sampleQuests()
  };
  // แจ้งภารกิจกับโค้ช
  state.coach?.say?.('ภารกิจย่อยเริ่มแล้ว! เลือกเก็บของดี หลีกเลี่ยงของขยะ ✊');
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, streak:0, avoidStreak:0, quests: sampleQuests() });

  // พาวเวอร์
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); coach?.say?.('คะแนนพุ่ง! ×2 ไปเลย!'); }
    else if (meta.power === 'freeze'){ const now=performance?.now?.()||Date.now(); state.freezeUntil = now + 2200; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); coach?.say?.('พักหายใจ สแปวน์ช้าลงชั่วคราว!'); }
    return 'power';
  }

  // กับดัก
  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    gj.miss++; gj.streak=0; // รีสตรีค
    coach?.say?.('ไม่เป็นไร ลุยต่อได้! ✊');
    return 'bad';
  }

  // อาหาร
  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++; gj.streak++; gj.avoidStreak++;
      const now = performance?.now?.()||Date.now();
      const dt = now - (meta.ts||now);
      // perfect window
      if (dt <= PERFECT_WINDOW_MS){
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('PERFECT',{color:'#ccff88'});
        updateQuest('perfect', gj, 1, coach);
        updateQuest('streak', gj, 1, coach); // perfect ก็นับ streak ต่อ
        return 'perfect';
      }else{
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('GOOD',{color:'#7fffd4'});
        updateQuest('goodCount', gj, 1, coach);
        updateQuest('streak', gj, 1, coach);
        updateQuest('timeCombo', gj, 1, coach); // นับเป็นวินาทีใน tick แต่ให้กำลังใจที่ onHit
        return 'good';
      }
    } else {
      gj.miss++; gj.streak=0; gj.avoidStreak=0;
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      coach?.say?.('พลาดนิดหน่อยเอง สู้ต่อ! 💪');
      return 'bad';
    }
  }
  return 'ok';
}

function updateQuest(kind, gj, val, coach){
  for (const q of gj.quests){
    if (q.done) continue;
    if (kind==='perfect' && q.type==='perfect'){ q.progress+=val; cheer(q, coach); }
    if (kind==='goodCount' && q.type==='goodCount'){ q.progress+=val; cheer(q, coach); }
    if (kind==='streak' && q.type==='streak'){ if (gj.streak>0){ q.progress=Math.max(q.progress, gj.streak); cheer(q, coach);} }
    if (kind==='avoid' && q.type==='avoidStreak'){ if (gj.avoidStreak>0){ q.progress=Math.max(q.progress, gj.avoidStreak); cheer(q, coach);} }
  }
}
function cheer(q, coach){
  if (q.done) return;
  const pct = Math.min(100, Math.round((q.progress/q.need)*100));
  if (pct===50) coach?.say?.('ครึ่งทางแล้ว! เดินหน้าต่อ 👟');
  if (pct>=100){ q.done=true; q.success=true; coach?.say?.('🏁 เควสสำเร็จ! เยี่ยมมาก!'); }
}

export function tick(state, sys){
  const { coach } = sys || {};
  const gj = state.ctx?.gj; if (!gj) return;

  // เควส: ลดเวลา และอัปเดต timeCombo / avoidStreak
  for (const q of gj.quests){
    if (q.done) continue;
    q.remain = Math.max(0, q.remain - 1);
    if (q.type==='timeCombo'){ if (state.combo>0) q.progress++; cheer(q, coach); }
    if (q.type==='avoidStreak'){ /* จะเพิ่มใน onHit ผ่าน avoidStreak */ }
    if (q.remain===0 && !q.done){ q.done=true; q.success = q.progress>=q.need; if(!q.success) coach?.say?.('⌛ เควสหมดเวลา ไปรอบถัดไป!'); }
  }
}

export function cleanup(){ /* no-op */ }
