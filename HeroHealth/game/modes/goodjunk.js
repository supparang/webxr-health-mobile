// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: 5 Mini-Quests (สุ่มมา 3), Power-ups (x2/freeze), Trap, Perfect tap, Adaptive life

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

const QUEST_TARGETS = {
  Easy:   { good:9, perfect:3, combo:6, power:2, streak:4 },
  Normal: { good:12, perfect:5, combo:9, power:3, streak:6 },
  Hard:   { good:15, perfect:6, combo:12, power:4, streak:8 }
};
const QUEST_SECONDS = 45;

const pick = (arr)=>arr[(Math.random()*arr.length)|0];
const iconOf = (p)=> p==='scorex2'?'✖️2' : (p==='freeze'?'🧊':'✨');

function lifeAdaptive(diff, state, mul=1){
  const hits = state.ctx?.gj?.hits || 0, miss = state.ctx?.gj?.miss || 0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;
  const boost= acc < 0.55 ? 1.25 : acc < 0.75 ? 1.12 : 1.0;
  const base = (diff?.life || 3000) * boost * mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

// ===== Quests =====
function buildQuestPool(state){
  const L = state.lang==='EN' ? {
    good:   { t:'Collect healthy',  s:'Healthy' },
    perfect:{ t:'Make PERFECT hits',s:'Perfect' },
    combo:  { t:'Reach combo',      s:'Combo'   },
    power:  { t:'Use power-ups',    s:'Power'   },
    streak: { t:'Good streak',      s:'Streak'  },
  } : {
    good:   { t:'เก็บของดี',       s:'ของดี'   },
    perfect:{ t:'กด PERFECT',       s:'Perfect' },
    combo:  { t:'ทำคอมโบถึง',      s:'คอมโบ'   },
    power:  { t:'ใช้พาวเวอร์',      s:'พาวเวอร์' },
    streak: { t:'ต่อเนื่องไม่พลาด', s:'ต่อเนื่อง' },
  };
  const Q = QUEST_TARGETS[state.difficulty] || QUEST_TARGETS.Normal;
  return [
    { key:'good',    title:`${L.good.t} ${Q.good}`,     titleShort:L.good.s,    need:Q.good,    progress:0, remain:QUEST_SECONDS, done:false, fail:false },
    { key:'perfect', title:`${L.perfect.t} ${Q.perfect}`,titleShort:L.perfect.s,need:Q.perfect, progress:0, remain:QUEST_SECONDS, done:false, fail:false },
    { key:'combo',   title:`${L.combo.t} ${Q.combo}`,   titleShort:L.combo.s,   need:Q.combo,   progress:0, remain:QUEST_SECONDS, done:false, fail:false },
    { key:'power',   title:`${L.power.t} ${Q.power}`,   titleShort:L.power.s,   need:Q.power,   progress:0, remain:QUEST_SECONDS, done:false, fail:false },
    { key:'streak',  title:`${L.streak.t} ${Q.streak}`, titleShort:L.streak.s,  need:Q.streak,  progress:0, remain:QUEST_SECONDS, done:false, fail:false }
  ];
}
function chooseThree(pool){
  const arr = pool.slice();
  const out = [];
  while (out.length<3 && arr.length){
    const i = (Math.random()*arr.length)|0;
    out.push(arr.splice(i,1)[0]);
  }
  return out;
}
function renderQuestChips(state){
  const host = document.getElementById('questChips'); if(!host) return;
  host.innerHTML = '';
  for (const q of state.ctx.gj.quests){
    const chip = document.createElement('div');
    chip.className = 'quest-chip';
    chip.dataset.key = q.key;
    chip.innerHTML = `
      <b class="q-title">${q.titleShort||q.title}</b>
      <span class="q-val">${q.progress}/${q.need}</span>
      <div class="bar slim"><div style="width:${(q.remain/QUEST_SECONDS)*100}%"></div></div>
    `;
    host.appendChild(chip);
  }
}
function updateQuestChip(q){
  const chip = document.querySelector(`.quest-chip[data-key="${q.key}"]`);
  if (!chip) return;
  chip.querySelector('.q-val').textContent = `${q.progress}/${q.need}`;
  const bar = chip.querySelector('.bar>div');
  if (bar) bar.style.width = Math.max(0, Math.min(100, (q.remain/QUEST_SECONDS)*100)) + '%';
  chip.classList.toggle('done', !!q.done && !q.fail);
  chip.classList.toggle('fail', !!q.fail);
}

// ===== API =====
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0, miss:0,
    lastTs:0,
    streak:0,
    usedPower:0,
    perfectCount:0,
    quests: chooseThree(buildQuestPool(state))
  };
  renderQuestChips(state);
  // บอกโค้ชว่าเราได้เควสอะไรบ้าง
  state._coach?.onQuestsAssigned?.(state.ctx.gj.quests);
  // แสดง mission line (สั้น)
  const ml = document.getElementById('missionLine');
  if (ml){
    const names = state.ctx.gj.quests.map(q=>q.titleShort||q.title).join(' • ');
    ml.textContent = names + ` • ${QUEST_SECONDS}s`;
    ml.style.display = 'block';
  }
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  // power-up
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }
  // trap
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }
  // food
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

function bumpQuest(state, key, delta=1){
  const qs = state.ctx?.gj?.quests||[];
  const q = qs.find(x=>x.key===key && !x.done);
  if (!q) return;
  q.progress = Math.min(q.need, q.progress + delta);
  if (q.progress >= q.need){
    q.done = true;
    state._coach?.onQuestComplete?.(q);
  }else{
    state._coach?.onQuestProgress?.(q);
  }
  updateQuestChip(q);
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  state._coach = state._coach || sys?.coach;

  const gj = state.ctx?.gj || (state.ctx.gj = {
    hits:0, miss:0, streak:0, usedPower:0, perfectCount:0, quests:[]
  });

  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){
      power?.apply?.('boost');
      fx?.popText?.('SCORE ×2',{color:'#b0ff66'});
      gj.usedPower++; bumpQuest(state, 'power', 1);
    } else if (meta.power === 'freeze'){
      const now = performance?.now?.()||Date.now();
      state.freezeUntil = now + 2000;
      fx?.popText?.('FREEZE!',{color:'#66e0ff'});
      gj.usedPower++; bumpQuest(state, 'power', 1);
    }
    return 'power';
  }

  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{}
    fx?.popText?.('TRAP!',{color:'#ff9b9b'});
    gj.miss++; gj.streak = 0;
    state._coach?.onBad?.();
    return 'bad';
  }

  if (meta.type === 'food'){
    if (meta.good){
      gj.hits++; gj.streak++;
      bumpQuest(state, 'good', 1);
      // PERFECT window
      if (meta.ts){
        const dt = (performance?.now?.()||Date.now()) - meta.ts;
        if (dt <= PERFECT_WINDOW_MS){
          gj.perfectCount++; bumpQuest(state, 'perfect', 1);
          state._coach?.onPerfect?.();
          try{ sfx?.good?.(); }catch{}
          fx?.popText?.('PERFECT',{color:'#ccff88'});
          return 'perfect';
        }
      }
      state._coach?.onGood?.();
      try{ sfx?.good?.(); }catch{}
      fx?.popText?.('GOOD',{color:'#7fffd4'});
      return 'good';
    } else {
      gj.miss++; gj.streak = 0;
      state._coach?.onBad?.();
      try{ sfx?.bad?.(); }catch{}
      fx?.popText?.('JUNK!',{color:'#ff9b9b'});
      return 'bad';
    }
  }
  return 'ok';
}

export function tick(state){
  // นับถอยหลังของทุกเควส + เควส combo/streak ตามสถานะล่าสุด
  const qs = state.ctx?.gj?.quests||[];
  for (const q of qs){
    if (q.done) continue;
    q.remain = Math.max(0, q.remain - 1);
    if (q.key==='combo'){
      // อัปเดตรันไทม์ (ถ้าคอมโบปัจจุบันสูงกว่า progress ให้เท่ากับ)
      const curCombo = state.combo||0;
      if (curCombo > q.progress){ q.progress = Math.min(q.need, curCombo); }
    }
    if (q.key==='streak'){
      const cur = state.ctx?.gj?.streak||0;
      if (cur > q.progress){ q.progress = Math.min(q.need, cur); }
    }
    if (q.remain===0 && !q.done){ q.done=true; q.fail=true; state._coach?.onQuestFailed?.(q); }
    updateQuestChip(q);
  }
  // อัปเดต missionLine ย่อ
  const ml = document.getElementById('missionLine');
  if (ml){
    const left = Math.max(0, ...qs.map(q=>q.remain));
    ml.style.display = 'block';
    ml.textContent = qs.map(q => `${q.titleShort||q.title} ${q.progress}/${q.need}`).join(' • ') + ` • ${left}s`;
  }
}

export function cleanup(state){
  const ml = document.getElementById('missionLine');
  if (ml) ml.style.display = 'none';
  const host = document.getElementById('questChips');
  if (host) host.innerHTML = '';
}
