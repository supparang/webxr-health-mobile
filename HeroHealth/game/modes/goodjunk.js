// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Mini-Quests (5 แบบ สุ่มมา 3), Power-ups (x2 / Freeze),
//          Coach พูดเมื่อเริ่ม/สำเร็จ/พลาด และอัปเดต missionLine ตลอดเวลา

/* =========================
   1) คอนสแตนต์ & ยูทิล
   ========================= */
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO   = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE   = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const TRAP_RATE    = 0.06;
const PERFECT_WIN  = 320; // ms
const MIN_LIFE     = { Easy:2600, Normal:2200, Hard:1900 };

// เควสทั้งหมด (จะสุ่มเลือกมา 3 แบบ/รอบ)
const QUEST_POOL = [
  { id:'collect_good', icon:'🥦', color:'#7fffd4' },
  { id:'avoid_junk',   icon:'🚫🍔', color:'#ffd54a' },
  { id:'perfect',      icon:'✨', color:'#ccff88' },
  { id:'powerups',     icon:'✖️2/🧊', color:'#b0ff66' },
  { id:'reach_combo',  icon:'🔥', color:'#ffca28' }
];

const QUEST_NEED = {
  collect_good: { Easy: 8, Normal:10, Hard:12 },
  avoid_junk:   { Easy:10, Normal:12, Hard:15 },   // วินาทีที่ต้องไม่โดน JUNK
  perfect:      { Easy: 3, Normal: 4, Hard: 5 },
  powerups:     { Easy: 2, Normal: 3, Hard: 3 },
  reach_combo:  { Easy:10, Normal:12, Hard:15 }    // คอมโบเป้าหมาย
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function pick3Distinct(arr){
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
  return a.slice(0,3);
}
function iconOf(power){ return power==='scorex2'?'✖️2':(power==='freeze'?'🧊':'✨'); }

function lifeAdaptive(diff, state, mul=1){
  const gj = state.ctx?.gj || {};
  const hits = gj.hits|0, miss = gj.miss|0;
  const acc = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost = acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.00;
  const base = (diff?.life||3000) * boost * mul;
  const minL = MIN_LIFE[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

/* =========================
   2) Mission HUD helpers
   ========================= */
function questTitle(q, lang='TH'){
  const need = q.need|0, p = q.progress|0;
  const leftSec = q.remain|0;
  const mapTH = {
    collect_good: `เก็บของดี ${p}/${need}`,
    avoid_junk:   `เลี่ยงของขยะ ${p}/${need}s`,
    perfect:      `Perfect Tap ${p}/${need}`,
    powerups:     `เก็บพลังพิเศษ ${p}/${need}`,
    reach_combo:  `คอมโบให้ถึง ${need} (ปัจจุบัน ${q.comboNow|0})`
  };
  const mapEN = {
    collect_good: `Collect healthy ${p}/${need}`,
    avoid_junk:   `Avoid junk ${p}/${need}s`,
    perfect:      `Perfect taps ${p}/${need}`,
    powerups:     `Grab power-ups ${p}/${need}`,
    reach_combo:  `Reach combo ${need} (now ${q.comboNow|0})`
  };
  const body = (lang==='EN'?mapEN:mapTH)[q.id] || q.id;
  return `${q.icon} ${body} • ${leftSec}s`;
}

function updateMissionLine(state){
  const el = document.getElementById('missionLine');
  if (!el) return;
  const lang = state.lang || 'TH';
  const gj = state.ctx?.gj;
  if (!gj || !gj.quests){ el.style.display='none'; return; }

  // แสดง 2 งานแรกที่ยังไม่เสร็จ (หรือทั้งหมดถ้าอยาก)
  const open = gj.quests.filter(q=>!q.done && !q.fail);
  const show = (open.length?open:gj.quests).slice(0,2);
  const text = show.map(q=>questTitle(q, lang)).join(' • ');
  el.textContent = text || (lang==='EN'?'All quests done!':'เควสครบแล้ว!');
  el.style.display = 'block';
}

function questSay(coach, msg){
  try{ coach?.say?.(msg); }catch{}
}

/* =========================
   3) Public API
   ========================= */
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  // สุ่มเควส 3/5
  const selected = pick3Distinct(QUEST_POOL).map(q=>({ ...q }));
  // ใส่ need / progress / timer
  for (const q of selected){
    const need = (QUEST_NEED[q.id]||{} )[state.difficulty] ?? 10;
    Object.assign(q, {
      need,
      progress: 0,
      remain: 45,     // แต่ละเควสมีเวลา 45s เท่ากัน
      done: false,
      fail: false,
      // ใช้สำหรับเควสเฉพาะ
      comboNow: 0,
      avoidTimer: 0,  // สะสมวินาทีที่ "ไม่โดน JUNK" ติดต่อกัน
      icon: q.icon
    });
  }

  state.ctx.gj = {
    hits:0, miss:0,
    lastTapTs:0,
    quests: selected
  };

  // บอกโค้ชเมื่อเริ่ม
  questSay(state?.coach, state.lang==='EN'
    ? 'Mini-quests started! Complete 3 goals in 45s.'
    : 'เริ่มมินิเควสแล้ว! ทำให้ครบ 3 เป้าหมายใน 45 วินาที');

  updateMissionLine(state);
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // สุ่มพาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }
  // กับดัก
  if (Math.random() < TRAP_RATE){
    return { type:'trap', char: pick(TRAPS), good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }
  // อาหารดี/ขยะ
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, quests:[] });

  // ---------- Power ----------
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    // เควส powerups
    const qP = gj.quests?.find(q=>q.id==='powerups' && !q.done && !q.fail);
    if (qP){ qP.progress = Math.min(qP.need, (qP.progress|0)+1); if (qP.progress>=qP.need){ qP.done=true; fx?.popText?.('Quest ✓',{color:qP.color}); questSay(coach, state.lang==='EN'?'Power-up quest complete!':'เควสพลังพิเศษสำเร็จ!'); } }

    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2', { color:'#b0ff66' }); }
    else if (meta.power === 'freeze'){ const now = performance?.now?.()||Date.now(); state.freezeUntil = now + 2000; fx?.popText?.('FREEZE!', { color:'#66e0ff' }); }

    updateMissionLine(state);
    return 'power';
  }

  // ---------- Trap ----------
  if (meta.type === 'trap'){
    gj.miss++;
    // กระแทกเควส avoid_junk (รีเซ็ตสะสม)
    const qA = gj.quests?.find(q=>q.id==='avoid_junk' && !q.done && !q.fail);
    if (qA){ qA.avoidTimer = 0; }
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!', { color:'#ff9b9b' });
    updateMissionLine(state);
    return 'bad';
  }

  // ---------- Food ----------
  if (meta.type === 'food'){
    const now = performance?.now?.() || Date.now();
    if (meta.good){
      gj.hits++;

      // เควส collect_good
      const qC = gj.quests?.find(q=>q.id==='collect_good' && !q.done && !q.fail);
      if (qC){ qC.progress = Math.min(qC.need, (qC.progress|0)+1); if (qC.progress>=qC.need){ qC.done=true; fx?.popText?.('Quest ✓',{color:qC.color}); questSay(coach, state.lang==='EN'?'Great! Healthy items collected.':'เยี่ยม! เก็บของดีครบแล้ว'); } }

      // เควส reach_combo (ดูจาก state.combo ปัจจุบัน)
      const qR = gj.quests?.find(q=>q.id==='reach_combo' && !q.done && !q.fail);
      if (qR){ qR.comboNow = Math.max(qR.comboNow|0, state.combo|0); if ((state.combo|0) >= (qR.need|0)){ qR.done=true; fx?.popText?.('Quest ✓',{color:qR.color}); questSay(coach, state.lang==='EN'?'Combo quest complete!':'คอมโบถึงเป้าหมาย!'); } }

      // Perfect tap
      let isPerfect = false;
      if (meta.ts){ const dt = (now - meta.ts)|0; if (dt <= PERFECT_WIN){ isPerfect = true; } }
      if (isPerfect){
        // เควส perfect
        const qPf = gj.quests?.find(q=>q.id==='perfect' && !q.done && !q.fail);
        if (qPf){ qPf.progress = Math.min(qPf.need, (qPf.progress|0)+1); if (qPf.progress>=qPf.need){ qPf.done=true; fx?.popText?.('Quest ✓',{color:qPf.color}); questSay(coach, state.lang==='EN'?'Perfect quest complete!':'เควส Perfect สำเร็จ!'); } }
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('PERFECT',{color:'#ccff88'});
        updateMissionLine(state);
        return 'perfect';
      }

      try{ sfx?.good?.(); }catch{}
      fx?.popText?.('GOOD',{color:'#7fffd4'});
      updateMissionLine(state);
      return 'good';

    } else {
      gj.miss++;
      // โดน JUNK → รีเซ็ตตัวนับของเควส avoid_junk
      const qA = gj.quests?.find(q=>q.id==='avoid_junk' && !q.done && !q.fail);
      if (qA){ qA.avoidTimer = 0; }
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      updateMissionLine(state);
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state /*, sys */){
  // อัปเดตตัวนับเวลา/ความคืบหน้าของเควส (ทุก 1 วินาที)
  const gj = state.ctx?.gj; if (!gj || !gj.quests) return;

  for (const q of gj.quests){
    if (q.done || q.fail) continue;

    // นับถอยหลัง
    q.remain = Math.max(0, (q.remain|0) - 1);

    // เควส avoid_junk: สะสมเวลา "ปลอด JUNK" (เพิ่ม 1s/ติ๊ก ถ้าไม่โดน JUNK)
    if (q.id === 'avoid_junk'){
      q.avoidTimer = Math.min(q.need, (q.avoidTimer|0) + 1);
      q.progress = q.avoidTimer;
      if (q.progress >= q.need){
        q.done = true;
        try{ state?.coach?.say?.(state.lang==='EN'?'Clean eating!':'สะอาด! เลี่ยงของขยะสำเร็จ'); }catch{}
      }
    }

    // หมดเวลาแล้วยังไม่ถึงเป้า → fail
    if (q.remain === 0 && !q.done){
      q.fail = true;
      try{ state?.coach?.say?.(state.lang==='EN'?'Quest failed. Try again!':'พลาดเควส ลองใหม่ได้!'); }catch{}
    }
  }

  updateMissionLine(state);
}

export function cleanup(/* state */){ /* no-op */ }
