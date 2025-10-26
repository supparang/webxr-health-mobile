// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Mini-Quest 5 แบบ (สุ่มมา 3), Power-ups (x2 / Freeze)

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

const QUEST_NEED = { Easy:8, Normal:10, Hard:12 };

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function iconOf(power){ return power==='scorex2'?'✖️2':(power==='freeze'?'🧊':'✨'); }

function lifeAdaptive(diff, state, mul=1){
  const g = state.ctx?.gj;
  const hits = g?.hits||0, miss = g?.miss||0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

// ===== Mini-Quests =====
// 5 แบบ: เก็บของดี N, ห้ามโดนขยะ X วิ, PERFECT N ครั้ง, สตรีค N, ความแม่น ≥Y% ตอนหมดเวลา
function rollQuests(diffKey){
  const base = {
    collect_good: { titleTH:'เก็บของดีให้ครบ', need: QUEST_NEED[diffKey] ?? 10, progress:0, remain:45 },
    avoid_junk:   { titleTH:'อย่าโดนขยะ',       need: 1,  progress:0, remain: 20 }, // สำเร็จถ้า 20 วิไม่โดน junk
    perfect_n:    { titleTH:'PERFECT ให้ได้',    need: Math.max(3, (diffKey==='Hard'?6:(diffKey==='Normal'?5:4))), progress:0, remain:45 },
    streak_n:     { titleTH:'สตรีคของดีติดกัน',  need: (diffKey==='Hard'?10:(diffKey==='Normal'?8:6)), progress:0, remain:45 },
    accuracy_end: { titleTH:'ความแม่น ≥ 80%',    need: 80, progress:0, remain:45 }  // วัดตอนหมดเวลาเควส
  };
  const keys = Object.keys(base).sort(()=>Math.random()-0.5).slice(0,3);
  return keys.map(k=>({ id:k, ...base[k], done:false, fail:false }));
}

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0, miss:0, perfect:0,
    lastTs:0,
    streak:0,
    quests: rollQuests(state.difficulty),
    questTick: 0, // for 1s countdown
  };
}

export function getQuests(state){
  // สำหรับ HUD (main.js จะเรียกทุกวินาที)
  const langTH = (state.lang||'TH')==='TH';
  return (state.ctx?.gj?.quests || []).map(q=>{
    let title = q.titleTH;
    if (q.id==='avoid_junk') title = `${q.titleTH} ${q.remain|0}s`;
    if (q.id==='accuracy_end') title = q.titleTH;
    return { title, need:q.need, progress:q.progress, remain:q.remain, done:q.done, fail:q.fail };
  });
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // power-up roll
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // trap roll
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // normal food
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const g = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, perfect:0, streak:0, quests: rollQuests(state.difficulty) });

  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); }
    else if (meta.power === 'freeze'){ const now = performance?.now?.()||Date.now(); state.freezeUntil = now + 2000; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); }
    return 'power';
  }

  if (meta.type === 'trap'){
    g.miss++; g.streak=0;
    try{ sfx?.bad?.(); }catch{} fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    // เควส avoid_junk ล้มเหลว
    g.quests?.forEach(q=>{ if(q.id==='avoid_junk' && !q.done) { q.fail=true; q.done=true; } });
    return 'bad';
  }

  if (meta.type === 'food'){
    const now = performance?.now?.()||Date.now();
    if (meta.good){
      g.hits++; g.streak++;
      // collect_good
      g.quests?.forEach(q=>{ if(q.id==='collect_good' && !q.done){ q.progress++; if(q.progress>=q.need){ q.done=true; fx?.popText?.('Quest ✓',{color:'#7fffd4'}); } }});
      // streak_n
      g.quests?.forEach(q=>{ if(q.id==='streak_n' && !q.done){ q.progress = Math.max(q.progress||0, g.streak); if(q.progress>=q.need){ q.done=true; fx?.popText?.('Streak ✓',{color:'#7fffd4'}); } }});
      // perfect window
      let isPerfect = false;
      if (meta.ts){ const dt = now - meta.ts; if (dt <= PERFECT_WINDOW_MS){ isPerfect=true; g.perfect++; } }
      if (isPerfect){
        try{ sfx?.good?.(); }catch{} fx?.popText?.('PERFECT',{color:'#ccff88'});
        // perfect_n
        g.quests?.forEach(q=>{ if(q.id==='perfect_n' && !q.done){ q.progress++; if(q.progress>=q.need){ q.done=true; fx?.popText?.('Perfect ✓',{color:'#7fffd4'});} }});
        return 'perfect';
      }else{
        try{ sfx?.good?.(); }catch{} fx?.popText?.('GOOD',{color:'#7fffd4'});
        return 'good';
      }
    } else {
      g.miss++; g.streak=0;
      try{ sfx?.bad?.(); }catch{} fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      // avoid_junk fail
      g.quests?.forEach(q=>{ if(q.id==='avoid_junk' && !q.done){ q.fail=true; q.done=true; } });
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state){
  // เคาน์เตอร์เวลาเควส และ accuracy_end ประเมินเมื่อหมดเวลา
  const g = state.ctx?.gj; if(!g?.quests) return;

  // 1 วินาที ต่อครั้ง
  g.questTick = (g.questTick||0) + 1;
  if (g.questTick < 1) return;
  g.questTick = 0;

  g.quests.forEach(q=>{
    if(q.done) return;
    if (q.remain!=null){
      q.remain = Math.max(0, (q.remain|0) - 1);
      if (q.remain===0){
        if (q.id==='avoid_junk') { // ถ้าไม่ fail จนหมดเวลา = สำเร็จ
          if (!q.fail){ q.done=true; }
        } else if (q.id==='accuracy_end'){
          const total = (g.hits|0) + (g.miss|0);
          const acc = total>0 ? Math.round((g.hits|0)/total*100) : 0;
          q.progress = acc;
          q.done = acc >= q.need;
          if (!q.done) q.fail = true;
        } else {
          // collect_good / perfect_n / streak_n หมดเวลาแต่ยังไม่ถึงเป้า = fail
          if ((q.progress||0) < (q.need||0)){ q.fail=true; q.done=true; }
        }
      }
    }
  });
}

export function cleanup(){ /* no-op */ }
