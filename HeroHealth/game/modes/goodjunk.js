// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Mini-Quest 5 แบบ (สุ่มมา 3), Power-ups (x2 / Freeze), Trap, PERFECT tap

/* =========================
   ค่าคงที่ & ยูทิล
   ========================= */
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const ENABLE_TRAPS   = true;
const TRAP_RATE      = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF  = { Easy:2600, Normal:2200, Hard:1900 };

// Mini-Quest targets (จะสุ่มมา 3 แบบ)
const QUEST_TARGETS = {
  collect_good: (diff)=>({ Easy:10, Normal:12, Hard:14 }[diff] || 12),
  avoid_junk:   (diff)=>({ Easy: 4, Normal:  3, Hard:  2 }[diff] || 3),   // เกินนี้ = ล้มเหลว
  perfect_hits: (diff)=>({ Easy: 5, Normal:  7, Hard:  9 }[diff] || 7),
  power_user:   (diff)=>({ Easy: 2, Normal:  3, Hard:  4 }[diff] || 3),
  good_streak:  (diff)=>({ Easy:15, Normal: 18, Hard: 22 }[diff] || 18)
};

// ป้าย/ชื่อเควสต์ (ให้ครบทั้ง TH/EN เพื่อกัน undefined)
function mkQuestTemplates(diff){
  return [
    {
      id:'collect_good', icon:'🥗',
      titleTH:'เก็บของดีให้ครบ', titleEN:'Collect healthy items',
      need: QUEST_TARGETS.collect_good(diff),
      kind:'counter',  // นับจำนวน good/perfect ทั้งหมด
      progress:0, remain:45, done:false, fail:false
    },
    {
      id:'avoid_junk', icon:'🛡️',
      titleTH:'อย่าพลาดของเสีย', titleEN:'Avoid junk/mistakes',
      need: QUEST_TARGETS.avoid_junk(diff),
      kind:'max-bad',  // จำกัดจำนวน bad ได้ไม่เกิน need (ถ้าเกิน = fail)
      progress:0, remain:45, done:false, fail:false, badCount:0
    },
    {
      id:'perfect_hits', icon:'💯',
      titleTH:'ทำ PERFECT ให้ครบ', titleEN:'Make PERFECT taps',
      need: QUEST_TARGETS.perfect_hits(diff),
      kind:'perfect',  // นับเฉพาะ perfect
      progress:0, remain:45, done:false, fail:false
    },
    {
      id:'power_user', icon:'⚡',
      titleTH:'ใช้พลังช่วยให้ครบ', titleEN:'Use power-ups',
      need: QUEST_TARGETS.power_user(diff),
      kind:'power',    // นับตอนกดพาวเวอร์
      progress:0, remain:45, done:false, fail:false
    },
    {
      id:'good_streak', icon:'🔥',
      titleTH:'ทำสตรีคของดีต่อเนื่อง', titleEN:'Good streak combo',
      need: QUEST_TARGETS.good_streak(diff),
      kind:'streak',   // ต้องทำ streak ต่อเนื่องแตะเป้าสูงสุด
      progress:0, remain:45, done:false, fail:false, bestStreak:0, curStreak:0
    }
  ];
}

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function iconOf(power){
  if (power==='scorex2') return '✖️2';
  if (power==='freeze')  return '🧊';
  return '✨';
}
function safeTitle(q, lang){
  if (lang==='EN') return q.titleEN || q.titleTH || 'Quest';
  return q.titleTH || q.titleEN || 'เควสต์';
}
function lifeAdaptive(diff, state, mul=1){
  const hits = state.ctx?.gj?.hits || 0;
  const miss = state.ctx?.gj?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.00;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

/* =========================
   HUD helpers (แบบเบา ๆ)
   ========================= */
function qel(){ return document.getElementById('questChips'); }
function setMissionLine(text, show=true){
  const el = document.getElementById('missionLine');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (text!=null) el.textContent = text;
}
function renderQuestChips(state){
  const wrap = qel(); if (!wrap) return;
  const qlist = state.ctx?.gj?.quests || [];
  wrap.innerHTML = '';
  for (const q of qlist){
    const div = document.createElement('div');
    div.className = 'qchip' + (q.done ? ' done' : (q.fail?' fail':'' ));
    const title = safeTitle(q, state.lang);
    const pText = q.kind==='max-bad'
      ? `${q.badCount|0}/${q.need|0}`
      : `${q.progress|0}/${q.need|0}`;
    div.innerHTML = `
      <span class="qi">${q.icon || '🎯'}</span>
      <span class="qt">${title}</span>
      <span class="qp">${pText}</span>
    `;
    wrap.appendChild(div);
  }

  // อัปเดต missionLine โชว์เควสต์แรกที่ยังไม่เสร็จ
  const active = qlist.find(x=>!x.done && !x.fail);
  if (active){
    const pShow = active.kind==='max-bad' ? `${active.badCount|0}/${active.need|0}` : `${active.progress|0}/${active.need|0}`;
    setMissionLine(`🎯 ${safeTitle(active, state.lang)} • ${pShow} • ${active.remain|0}s`, true);
  }else{
    // ถ้าทั้งหมดเสร็จ/ล้มเหลวแล้ว ซ่อนหรือสรุปสั้น ๆ
    setMissionLine('🏁 Mini-Quests Completed', true);
  }
}

/* =========================
   Public API
   ========================= */
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  const templates = mkQuestTemplates(state.difficulty);
  // สุ่มเลือก 3 เควสต์ (แต่เรียงให้หลากหลาย)
  const pool = templates.slice();
  const chosen = [];
  while (chosen.length<3 && pool.length){
    const i = (Math.random()*pool.length)|0;
    chosen.push(pool.splice(i,1)[0]);
  }

  state.ctx.gj = {
    hits:0, miss:0,
    lastTs:0,
    quests: chosen
  };

  // เปิด HUD เควสต์
  try{ renderQuestChips(state); }catch{}
}

export function pickMeta(diff, state){
  const ts = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

  // โอกาสเกิด power
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // กับดัก
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // อาหาร
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state, hud){
  const { sfx, power, fx, coach } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, quests: mkQuestTemplates(state.difficulty).slice(0,3) });

  // ===== Power =====
  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      try{ power?.apply?.('boost'); }catch{}
      fx?.popText?.('SCORE ×2',{color:'#b0ff66'});
      // quest: power_user
      for (const q of gj.quests){
        if (q.kind==='power' && !q.done && !q.fail){
          q.progress++;
          if (q.progress >= q.need){ q.done=true; coach?.say?.(state.lang==='TH'?'พลังช่วยมาแล้ว!':'Power on!'); }
        }
      }
    } else if (meta.power === 'freeze'){
      const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
      state.freezeUntil = now + 2000;
      fx?.popText?.('FREEZE!',{color:'#66e0ff'});
      // quest: power_user เช่นกัน
      for (const q of gj.quests){
        if (q.kind==='power' && !q.done && !q.fail){
          q.progress++;
          if (q.progress >= q.need){ q.done=true; coach?.say?.(state.lang==='TH'?'พลังช่วยมาแล้ว!':'Power on!'); }
        }
      }
    }
    try{ renderQuestChips(state); }catch{}
    return 'power';
  }

  // ===== Trap =====
  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    gj.miss++;
    // quest: avoid_junk (badCount++)
    for (const q of gj.quests){
      if (q.kind==='max-bad' && !q.done && !q.fail){
        q.badCount = (q.badCount||0) + 1;
        if (q.badCount > q.need){ q.fail = true; coach?.say?.(state.lang==='TH'?'ระวังให้มากขึ้น!':'Watch out!'); }
      }
      if (q.kind==='streak'){ q.curStreak = 0; } // ตัด streak
    }
    try{ renderQuestChips(state); }catch{}
    return 'bad';
  }

  // ===== Food =====
  if (meta.type === 'food'){
    // PERFECT check
    const now = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
    const dt  = meta.ts ? (now - meta.ts) : 9999;
    const isPerfect = meta.good && (dt <= PERFECT_WINDOW_MS);

    if (meta.good){
      gj.hits++;

      // quests update
      for (const q of gj.quests){
        if (q.done || q.fail) continue;
        if (q.kind==='counter'){              // collects good/perfect
          q.progress++;
          if (q.progress>=q.need){ q.done=true; coach?.say?.(state.lang==='TH'?'สุดยอด! เควสต์สำเร็จ':'Great! Quest complete'); }
        }
        if (q.kind==='perfect' && isPerfect){ // perfect only
          q.progress++;
          if (q.progress>=q.need){ q.done=true; coach?.say?.(state.lang==='TH'?'เป๊ะมาก!':'Perfect!'); }
        }
        if (q.kind==='streak'){               // streak
          q.curStreak = (q.curStreak||0) + 1;
          q.bestStreak = Math.max(q.bestStreak||0, q.curStreak);
          q.progress = q.bestStreak;          // แสดงเป็น progress
          if (q.bestStreak>=q.need){ q.done=true; coach?.say?.(state.lang==='TH'?'สตรีคแรงมาก!':'Huge streak!'); }
        }
      }

      try{ renderQuestChips(state); }catch{}

      if (isPerfect){
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('PERFECT',{color:'#ccff88'});
        return 'perfect';
      }else{
        try{ sfx?.good?.(); }catch{}
        fx?.popText?.('GOOD',{color:'#7fffd4'});
        return 'good';
      }
    } else {
      gj.miss++;
      // quests: bad impact
      for (const q of gj.quests){
        if (q.kind==='max-bad' && !q.done && !q.fail){
          q.badCount = (q.badCount||0) + 1;
          if (q.badCount > q.need){ q.fail = true; coach?.say?.(state.lang==='TH'?'พลาดเกินโควตาแล้ว!':'Too many misses!'); }
        }
        if (q.kind==='streak'){ q.curStreak = 0; }
      }
      try{ renderQuestChips(state); }catch{}
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys){
  // เควสต์นับถอยหลัง
  const gj = state.ctx?.gj; if (!gj || !gj.quests) return;
  let changed = false;
  for (const q of gj.quests){
    if (q.done || q.fail) continue;
    q.remain = Math.max(0, (q.remain|0) - 1);
    if (q.remain === 0){
      // หมดเวลาแล้ว ถ้ายังไม่ผ่าน: fail
      q.fail = true;
      changed = true;
    }
  }
  if (changed){ try{ renderQuestChips(state); }catch{} }
}

export function cleanup(state){
  // no-op
}
