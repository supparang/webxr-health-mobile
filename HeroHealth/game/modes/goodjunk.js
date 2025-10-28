// === Hero Health Academy — game/modes/goodjunk.js (anti-repeat + soft penalty + streak goals + end-speedup) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍜','🍝🧈','🍧','🍨','🍮','🥓','🍗🧈','🍞🍯','🧂'];

let _lastEmoji = null;
function pickNonRepeat(pool){
  let e, tries=0;
  do { e = pool[(Math.random()*pool.length)|0]; } while (e===_lastEmoji && tries++<3);
  _lastEmoji = e; return e;
}
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

export function init(state){ state._gjStreakMilestone = 0; }
export function cleanup(){}

export function pickMeta(diff={}, state={}){
  // 60% good, 40% junk
  const goodPick = Math.random() < 0.60;
  const char = goodPick ? pickNonRepeat(GOOD) : pickNonRepeat(JUNK);
  const golden = goodPick && Math.random()<0.06;
  const life = clamp(Number(diff.life)||3000, 800, 4500);
  return { char, aria: goodPick?'Healthy':'Junk', label: char, isGood: goodPick, good: goodPick, golden, life };
}

export function onHit(meta={}, sys={}, state={}){
  const { sfx } = sys;
  if (meta.isGood){
    // Streak micro goal
    const totalGood = (state.stats?.good|0) + (state.stats?.perfect|0) + 1;
    if (totalGood >= (state._gjStreakMilestone+10)){
      state._gjStreakMilestone += 10;
      try{ sys.fx?.text?.( 'STREAK +10', {x:0,y:0}); }catch{}
    }
    try{ if (meta.golden) sfx?.play?.('sfx-perfect'); else sfx?.play?.('sfx-good'); }catch{}
    return meta.golden ? 'perfect' : 'good';
  }else{
    // soft penalty: reset combo + −8 + micro-freeze spawn 300ms (ทำใน main ผ่าน result=bad)
    try{ sfx?.play?.('sfx-bad'); }catch{}
    if (state.freezeUntil) state.freezeUntil = Math.max(state.freezeUntil, performance.now()+300);
    else state.freezeUntil = performance.now() + 300;
    return 'bad';
  }
}

export function tick(state, sys){
  // Speed-up 15s สุดท้าย (เร่ง spawn และลด life เล็กน้อย—ทำใน main ผ่าน acc-based อยู่แล้ว; ไม่ต้องซ้ำ)
}
export const fx = {};
