// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ฟีเจอร์: life แบบ adaptive, Power-ups (x2 / Freeze), Mini-Quest 5 แบบ (สุ่มมา 3 แบบ/รอบ)

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

// ---------- Mini-Quest ----------
// เลือก 3 จาก 5 ประเภทต่อรอบ
// 1) เก็บของดีให้ครบ (collect_good)
// 2) หลีกเลี่ยงของขยะ X วิ (avoid_junk_timer)
// 3) ทำคอมโบถึง Y (reach_combo)
// 4) ได้ PERFECT ให้ครบ P ครั้ง (perfect_hits)
// 5) เก็บพาวเวอร์อัปให้ครบ Q ครั้ง (power_collect)

const QUEST_PARAMS = {
  Easy:   { good:8,  avoidSec:12, combo:8,  perfect:3, power:2 },
  Normal: { good:10, avoidSec:15, combo:12, perfect:4, power:3 },
  Hard:   { good:12, avoidSec:18, combo:16, perfect:5, power:3 },
};

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
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

// ---------- Quest factory ----------
function buildQuestPool(diffKey){
  const P = QUEST_PARAMS[diffKey] || QUEST_PARAMS.Normal;
  return [
    { id:'collect_good', icon:'✅', need:P.good,    timed:false,
      label:(lang)=> lang==='EN' ? `Collect healthy ${P.good}` : `เก็บของดีให้ครบ ${P.good}`,
      fmt:(q)=> `${q.progress}/${q.need}` },
    { id:'avoid_junk_timer', icon:'⏱️', need:P.avoidSec, timed:true, remain:P.avoidSec,
      label:(lang)=> lang==='EN' ? `Avoid junk ${P.avoidSec}s` : `หลีกเลี่ยงของขยะ ${P.avoidSec}วิ`,
      fmt:(q)=> `${q.remain|0}s` },
    { id:'reach_combo', icon:'🔥', need:P.combo,   timed:false,
      label:(lang)=> lang==='EN' ? `Reach combo ${P.combo}` : `ทำคอมโบให้ถึง ${P.combo}`,
      fmt:(q)=> `best ${q.best||0}/${q.need}` },
    { id:'perfect_hits', icon:'✨', need:P.perfect, timed:false,
      label:(lang)=> lang==='EN' ? `Perfect x${P.perfect}` : `PERFECT ${P.perfect} ครั้ง`,
      fmt:(q)=> `${q.progress}/${q.need}` },
    { id:'power_collect', icon:'⚡', need:P.power,  timed:false,
      label:(lang)=> lang==='EN' ? `Power-ups x${P.power}` : `พาวเวอร์อัป ${P.power} ครั้ง`,
      fmt:(q)=> `${q.progress}/${q.need}` },
  ];
}
function pick3Unique(pool){
  const src = pool.slice();
  const out = [];
  for (let i=0; i<3 && src.length; i++){
    const k = (Math.random()*src.length)|0;
    out.push(src.splice(k,1)[0]);
  }
  // เติมฟิลด์สถานะ
  for (const q of out){
    q.progress = q.progress||0;
    q.done = false;
    q.fail = false;
    if (q.timed && typeof q.remain!=='number') q.remain = q.need;
  }
  return out;
}
function updateMissionLine(state){
  const el = document.getElementById('missionLine'); if (!el) return;
  const L = state.lang || 'TH';
  const qs = state.ctx?.gj?.quests || [];
  if (!qs.length){ el.style.display='none'; return; }
  const parts = qs.map(q=>{
    const head = `${q.icon} ${q.label(L)}`;
    if (q.done) return head + ' ✅';
    if (q.fail) return head + ' ❌';
    return `${head} • ${q.fmt(q)}`;
  });
  el.textContent = parts.join('  |  ');
  el.style.display = 'block';
}

// ---------- Public API ----------
export function init(state){
  state.ctx = state.ctx || {};
  const pool = buildQuestPool(state.difficulty);
  const quests = pick3Unique(pool);
  state.ctx.gj = {
    hits:0, miss:0,
    quests,
    perfectTapCount:0,     // นับ PERFECT สะสม
    powersTaken:0,         // นับพาวเวอร์อัป
  };
  updateMissionLine(state);
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
  const { sfx, power, fx, score } = sys || {};
  const ctx = state.ctx || (state.ctx={});
  const gj  = ctx.gj || (ctx.gj = { hits:0, miss:0, quests:[] });

  // ===== Power-ups =====
  if (meta.type === 'power'){
    gj.powersTaken = (gj.powersTaken||0) + 1;

    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      try{ power?.apply?.('boost'); }catch{}
      fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
    }else if (meta.power === 'freeze'){
      try{ power.timeScale = 99; setTimeout(()=> power.timeScale=1, 2000); }catch{}
      const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
      state.freezeUntil = now + 2000;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' });
    }

    // อัปเควสที่เกี่ยวกับ power
    for (const q of (gj.quests||[])){
      if (q.done || q.fail) continue;
      if (q.id==='power_collect'){
        q.progress = (q.progress||0) + 1;
        if (q.progress >= q.need) { q.done = true; fx?.popText?.('🏁 Power Quest!', { color:'#7fffd4' }); }
      }
    }
    updateMissionLine(state);
    return 'power';
  }

  // ===== Trap =====
  if (meta.type === 'trap'){
    gj.miss++;
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!', { color:'#ff9b9b' });
    // ถ้ามีเควส avoid_junk ให้ล้มทันที
    for (const q of (gj.quests||[])){
      if (!q.done && !q.fail && q.id==='avoid_junk_timer'){ q.fail = true; }
    }
    updateMissionLine(state);
    return 'bad';
  }

  // ===== Food =====
  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++;

      // เควส collect_good
      for (const q of (gj.quests||[])){
        if (q.done || q.fail) continue;
        if (q.id==='collect_good'){
          q.progress = (q.progress||0) + 1;
          if (q.progress >= q.need){ q.done = true; fx?.popText?.('🏁 Good Quest!', { color:'#7fffd4' }); }
        }
      }

      // PERFECT window
      let isPerfect = false;
      if (meta.ts){
        const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
        if (now - meta.ts <= PERFECT_WINDOW_MS){
          isPerfect = true;
          gj.perfectTapCount = (gj.perfectTapCount||0) + 1;
          // เควส perfect_hits
          for (const q of (gj.quests||[])){
            if (q.done || q.fail) continue;
            if (q.id==='perfect_hits'){
              q.progress = (q.progress||0) + 1;
              if (q.progress >= q.need){ q.done = true; fx?.popText?.('🏁 Perfect Quest!', { color:'#7fffd4' }); }
            }
          }
        }
      }

      try{ sfx?.good?.(); }catch{}
      fx?.popText?.(isPerfect?'PERFECT':'GOOD', { color: isPerfect ? '#ccff88' : '#7fffd4' });

      // เควส reach_combo (อ่านจากระบบคะแนนถ้ามี)
      const curCombo = score?.combo ?? 0;
      for (const q of (gj.quests||[])){
        if (q.done || q.fail) continue;
        if (q.id==='reach_combo'){
          q.best = Math.max(q.best||0, curCombo);
          if (q.best >= q.need){ q.done = true; fx?.popText?.('🏁 Combo Quest!', { color:'#7fffd4' }); }
        }
      }

      updateMissionLine(state);
      return isPerfect ? 'perfect' : 'good';
    }else{
      gj.miss++;
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!', { color:'#ff9b9b' });

      // ถ้ามีเควส avoid_junk_timer ให้ล้มทันที
      for (const q of (gj.quests||[])){
        if (!q.done && !q.fail && q.id==='avoid_junk_timer'){ q.fail = true; }
      }
      updateMissionLine(state);
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys){
  // เดินเวลาเฉพาะเควสแบบจับเวลา
  const qs = state.ctx?.gj?.quests || [];
  let needUpdate = false;
  for (const q of qs){
    if (!q.timed || q.done || q.fail) continue;
    q.remain = Math.max(0, (q.remain||0) - 1);
    if (q.remain === 0 && !q.done){ q.fail = true; needUpdate = true; }
    else needUpdate = true;
  }
  if (needUpdate) updateMissionLine(state);
}

export function cleanup(state){
  // ซ่อนบรรทัดภารกิจหากมี
  const el = document.getElementById('missionLine');
  if (el) el.style.display = 'none';
}
