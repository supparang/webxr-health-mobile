// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — เก็บของดี หลีกเลี่ยงของขยะ
// ส่งผลลัพธ์ให้ main.js: 'good' | 'bad' | 'perfect' | 'power'
// ไฮไลต์: life แบบ adaptive, Perfect tap, Power-ups (x2 / Freeze)

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

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.gj = { hits:0, miss:0 };
}

export function pickMeta(diff, state){
  const ts = performance?.now?.() || Date.now();

  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal) && ENABLED_POWERS.length){
    const p = pick(ENABLED_POWERS);
    return { type:'power', power:p, char:iconOf(p), life: lifeAdaptive(diff, state, 1.0), ts };
  }

  if (ENABLE_TRAPS && Math.random() < TRAP_RATE){
    const char = TRAPS[(Math.random()*TRAPS.length)|0];
    return { type:'trap', char, good:false, life: lifeAdaptive(diff, state, 1.05), ts };
  }

  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty] || GOOD_RATIO.Normal);
  const char = wantGood ? HEALTHY[(Math.random()*HEALTHY.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  return { type:'food', char, good:wantGood, life: lifeAdaptive(diff, state, 1.0), ts };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const gj = state.ctx?.gj || (state.ctx.gj = { hits:0, miss:0 });

  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power === 'scorex2'){ try{ power?.apply?.('boost'); }catch{} fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); }
    else if (meta.power === 'freeze'){ const now = performance?.now?.()||Date.now(); state.freezeUntil = now + 2000; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); }
    return 'power';
  }

  if (meta.type === 'trap'){
    try{ sfx?.bad?.(); }catch{} fx?.popText?.('TRAP!',{color:'#ff9b9b'}); gj.miss++; return 'ba
