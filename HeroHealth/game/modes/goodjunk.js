// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ + Mini Quest 45s
// คืนค่ากลับให้ main.js: 'good' | 'bad' | 'perfect' | 'power'

/* =========================
   1) คอนฟิก
   ========================= */
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO  = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE  = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];

const ENABLE_TRAPS = true;
const TRAP_RATE    = 0.06;

const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF  = { Easy:2600, Normal:2200, Hard:1900 };

/* =========================
   2) Mini Quest: ภารกิจย่อย 45s
   kind:
     - 'collect_good'    : เก็บของดีให้ครบภายในเวลา
     - 'collect_perfect' : เก็บ PERFECT ให้ครบภายในเวลา
   ========================= */
const QUEST_NEED = {
  collect_good   : { Easy: 7,  Normal: 9,  Hard: 11 },
  collect_perf   : { Easy: 3,  Normal: 4,  Hard: 5  },
};
function newMiniQuest(state){
  const diff = state.difficulty || 'Normal';
  const kinds = ['collect_good','collect_perfect'];
  const kind  = kinds[(Math.random()*kinds.length)|0];

  const need = (kind==='collect_perfect'
    ? (QUEST_NEED.collect_perf[diff] ?? 4)
    : (QUEST_NEED.collect_good[diff] ?? 9));

  return { kind, need, progress:0, remain:45, done:false, fail:false };
}
function setMissionLine(text){
  const el = document.getElementById('missionLine');
  if (!el) return;
  el.style.display = text ? 'block' : 'none';
  if (text) el.textContent = text;
}
function missionDesc(q){
  if (!q) return '';
  if (q.done) return q.fail ? '⌛ Mission Failed' : '🏁 Mission Complete';
  if (q.kind==='collect_perfect') return `🌟 PERFECT ${q.progress}/${q.need} • ${q.remain|0}s`;
  return `🎯 ของดี ${q.progress}/${q.need} • ${q.remain|0}s`;
}
function refreshMissionHUD(state){
  const q = state.ctx?.gj?.mission;
  setMissionLine(missionDesc(q));
}

/* =========================
   3) Public API
   ========================= */
export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = {
    hits:0,
    miss:0,
    mission: newMiniQuest(state)
  };
  refreshMissionHUD(state);
}

export function pickMeta(diff, state){
  const ts = nowMs();

  // power-up?
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  // trap?
  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = pick(TRAPS);
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  // healthy vs junk
  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0, mission:null });
  const q  = gj.mission;

  // ----- Power-ups -----
  if (meta.type === 'power'){
    try { sfx?.play?.('sfx-powerup'); } catch {}
    if (meta.power === 'scorex2'){
      try { power?.apply?.('boost'); } catch {}
      try { fx?.popText?.('SCORE ×2', { color:'#b0ff66' }); } catch {}
    } else if (meta.power === 'freeze'){
      try { power.timeScale = Math.max(1.8, power.timeScale || 1); setTimeout(()=> power.timeScale = 1, 2000); } catch {}
      try { fx?.popText?.('FREEZE!', { color:'#66e0ff' }); } catch {}
    }
    return 'power';
  }

  // ----- Trap -----
  if (meta.type === 'trap'){
    gj.miss++;
    try { sfx?.bad?.(); } catch {}
    try { fx?.popText?.('TRAP!', { color:'#ff9b9b' }); } catch {}
    // ภารกิจ (เฉพาะ collect_good/collect_perfect) ไม่เพิ่มความคืบหน้า
    return 'bad';
  }

  // ----- Food -----
  if (meta.type === 'food'){
    const dt = Math.max(0, nowMs() - (meta.ts||nowMs()));
    const isPerfect = !!meta.good && (dt <= PERFECT_WINDOW_MS);

    if (meta.good){
      gj.hits++;
      try { sfx?.good?.(); } catch {}
      try { fx?.popText?.(isPerfect?'PERFECT!':'GOOD!', { color: isPerfect ? '#ccff88' : '#7fffd4' }); } catch {}

      // นับให้มินิควิสต์
      if (q && !q.done){
        if (q.kind==='collect_perfect'){
          if (isPerfect) q.progress++;
        } else { // collect_good
          q.progress++;
        }
        // ผ่านควิสต์
        if (q.progress >= q.need){
          q.done = true; q.fail = false;
          try { fx?.popText?.('🏁 Mission Complete', { color:'#7fffd4' }); } catch {}
          try { sfx?.play?.('sfx-perfect'); } catch {}
        }
        refreshMissionHUD(state);
      }

      return isPerfect ? 'perfect' : 'good';
    } else {
      gj.miss++;
      try { sfx?.bad?.(); } catch {}
      try { fx?.popText?.('JUNK!', { color:'#ff9b9b' }); } catch {}
      return 'bad';
    }
  }

  return meta.good ? 'good' : 'bad';
}

export function tick(state, sys /*, hud */){
  // เคาน์ดาวน์ควิสต์
  const q = state.ctx?.gj?.mission;
  if (!q || q.done) return;

  q.remain = Math.max(0, q.remain - 1);
  if (q.remain === 0 && !q.done){
    q.done = true; q.fail = (q.progress < q.need);
    if (q.fail){
      try { sys?.fx?.popText?.('⌛ Mission Failed', { color:'#ff9b9b' }); } catch {}
    }
  }
  refreshMissionHUD(state);
}

export function cleanup(state, sys){
  try { if (sys?.power) sys.power.timeScale = 1; } catch {}
  if (state?.ctx?.gj){
    state.ctx.gj.hits = 0;
    state.ctx.gj.miss = 0;
    state.ctx.gj.mission = null;
  }
  setMissionLine(''); // ซ่อน HUD ภารกิจ
}

/* =========================
   4) Helpers
   ========================= */
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function iconOf(p){ return p==='scorex2' ? '✖️2' : (p==='freeze' ? '🧊' : '✨'); }
function nowMs(){ try { return performance.now(); } catch { return Date.now(); } }
function lifeAdaptive(diff, state, mul){
  const base = (diff && diff.life) ? diff.life : 3000;
  const dkey = state?.difficulty || 'Normal';
  const minLife = MIN_LIFE_BY_DIFF[dkey] || 2000;
  return Math.max(minLife, Math.round(base * (mul || 1)));
}
