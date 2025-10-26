// game/modes/goodjunk.js
// ดี vs ขยะ — ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// life แบบ adaptive + Perfect tap + พาวเวอร์ (x2, freeze → state.freezeUntil)

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];

const GOOD_RATIO   = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE   = { Easy:0.08, Normal:0.10, Hard:0.12 };
const ENABLED_POWERS = ['scorex2','freeze'];
const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF  = { Easy:2600, Normal:2200, Hard:1900 };
const FREEZE_SECONDS = 2;

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = { hits:0, miss:0 };
}

export function pickMeta(diff, state){
  const now = performance?.now?.() ?? Date.now();

  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char: (p==='scorex2'?'✖️2':'🧊'), life: clampLife(diff, state, 1.0), ts: now };
  }

  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life: clampLife(diff, state, 1.0), ts: now };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0 });

  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2', { color:'#b0ff66' }); }
    if (meta.power === 'freeze'){
      const now = performance?.now?.() ?? Date.now();
      state.freezeUntil = now + FREEZE_SECONDS*1000;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' });
    }
    return 'power';
  }

  if (meta.type !== 'food'){ try{ sfx?.bad?.(); }catch{} return 'bad'; }

  const ms = elapsed(meta.ts);
  const perfect = meta.good && (ms <= PERFECT_WINDOW_MS || state?.fever?.active);

  if (meta.good){
    gj.hits++; try{ sfx?.good?.(); }catch{}
    if (perfect){ fx?.popText?.('PERFECT!', { color:'#ccff88' }); return 'perfect'; }
    return 'good';
  } else {
    gj.miss++; try{ sfx?.bad?.(); }catch{}
    return 'bad';
  }
}

export function tick(){ /* no-op */ }
export function cleanup(state){ if (state?.ctx?.gj) state.ctx.gj = { hits:0, miss:0 }; }

/* Helpers */
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clampLife(diff, state, boost){
  const g = state.ctx?.gj || { hits:0, miss:0 };
  const tot = g.hits + g.miss;
  const acc = tot>0 ? g.hits/tot : 1;
  const adapt = acc < 0.60 ? 1.22 : (acc < 0.80 ? 1.10 : 0.98);
  const base = (diff?.life || 3000) * adapt * (boost||1);
  const minLife = MIN_LIFE_BY_DIFF[state.difficulty] || MIN_LIFE_BY_DIFF.Normal;
  return Math.max(minLife, Math.round(base));
}
function elapsed(ts){ const now = performance?.now?.() ?? Date.now(); return Math.max(0, now - (ts||now)); }
