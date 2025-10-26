// game/modes/goodjunk.js
const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒','🥬','🌽'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'];
const TRAPS   = ['💣','☠️'];

const GOOD_RATIO = { Easy:0.72, Normal:0.65, Hard:0.58 };
const POWER_RATE = { Easy:0.08, Normal:0.10, Hard:0.12 };
const TRAP_RATE  = 0.06;
const PERFECT_WINDOW_MS = 320;
const MIN_LIFE_BY_DIFF = { Easy:2600, Normal:2200, Hard:1900 };

// 5 เควส – จะสุ่มมา 3 ข้อ
const ALL_QUESTS = [
  { key:'veg5',     icon:'🥦', need:{Easy:6,Normal:8,Hard:10}, test:(m)=>m.type==='food'&&m.good&&'🥦🥕🥬🌽🥒'.includes(m.char) },
  { key:'fruit4',   icon:'🍎', need:{Easy:5,Normal:7,Hard:9},  test:(m)=>m.type==='food'&&m.good&&'🍎🍌🍇🍓🍊🍉'.includes(m.char) },
  { key:'nojunk15', icon:'🚫', need:{Easy:8,Normal:10,Hard:12}, test:(m,res)=>res!=='bad' }, // เก็บอะไรก็ได้แต่ห้ามพลาด
  { key:'perfect3', icon:'✨', need:{Easy:2,Normal:3,Hard:4},  test:(m,res)=>res==='perfect' },
  { key:'streak7',  icon:'🔥', need:{Easy:5,Normal:6,Hard:7},  test:(_m,_res,state)=> (state.combo||0)>=7 } // เก็บขณะคอมโบ>=7
];

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function lifeAdaptive(diff, state, mul=1){
  const st = state._accHist || [1];
  const acc = st.reduce((s,x)=>s+x,0)/st.length;
  const boost = acc<0.55?1.25: acc<0.75?1.12: 1.0;
  const base = (diff?.life||3000)*boost*mul;
  const minL = MIN_LIFE_BY_DIFF[state.difficulty] || 2100;
  return Math.max(minL, Math.round(base));
}

function iconOf(power){
  if (power==='x2') return '✖️2';
  if (power==='freeze') return '🧊';
  if (power==='sweep') return '🧹';
  return '✨';
}

export function init(state, hud, diff){
  // สุ่มเควส 3 ข้อ
  const pool = [...ALL_QUESTS];
  const chosen=[];
  while(chosen.length<3 && pool.length){ chosen.push(pool.splice((Math.random()*pool.length)|0,1)[0]); }
  const quests = chosen.map(q=>({
    key:q.key, icon:q.icon, need:q.need[state.difficulty]||q.need.Normal, progress:0, remain:45, done:false, fail:false, test:q.test
  }));
  state.ctx = state.ctx||{};
  state.ctx.gj = { hits:0, miss:0, quests, lastTs:0 };

  hud.setQuestChips(quests);
}

export function pickMeta(diff, state){
  const ts = performance?.now?.()||Date.now();

  // โอกาสพาวเวอร์
  if (Math.random() < (POWER_RATE[state.difficulty]||POWER_RATE.Normal)){
    const roll = Math.random();
    const power = roll<0.7 ? 'x2' : roll<0.92 ? 'freeze' : 'sweep'; // sweep หายาก
    return { type:'power', power, char:iconOf(power), life:lifeAdaptive(diff,state,1.0), ts };
  }

  // กับดัก
  if (Math.random() < TRAP_RATE){
    return { type:'trap', char:pick(TRAPS), good:false, life:lifeAdaptive(diff,state,1.05), ts };
  }

  const wantGood = Math.random() < (GOOD_RATIO[state.difficulty]||GOOD_RATIO.Normal);
  const char = wantGood ? pick(HEALTHY) : pick(JUNK);
  return { type:'food', char, good:wantGood, life:lifeAdaptive(diff,state,1.0), ts };
}

export function onHit(meta, sys, state, hud){
  const { sfx, power, fx } = sys||{};
  const ctx = state.ctx?.gj || (state.ctx.gj={hits:0,miss:0,quests:[]});

  // Power-ups
  if (meta.type==='power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.power==='x2'){ power?.apply?.('x2',{sec:7}); }
    else if (meta.power==='freeze'){ power?.apply?.('freeze',{sec:2}); }
    else if (meta.power==='sweep'){
      power?.apply?.('sweep',{sec:1,onSweep:()=>{ // เคลียร์ของขยะ
        document.querySelectorAll('.item').forEach(n=>{
          if(['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁','🍪','🧃'].includes(n.textContent)){ try{ n.remove(); }catch{} }
        });
      }});
    }
    return 'power';
  }

  // Trap
  if (meta.type==='trap'){
    ctx.miss++; try{ sfx?.bad?.(); }catch{}; hud?.flashDanger?.();
    return 'bad';
  }

  // Food
  if (meta.type==='food'){
    if (meta.good){
      ctx.hits++;
      // Perfect?
      const dt = (performance?.now?.()||Date.now()) - (meta.ts||Date.now());
      const perfect = dt<=PERFECT_WINDOW_MS;
      // เควส
      for(const q of ctx.quests){
        const ok = q.test.length===2 ? q.test(meta, perfect?'perfect':'good', state) : q.test(meta, perfect?'perfect':'good', state);
        if (ok && !q.done && !q.fail){ q.progress++; }
      }
      hud?.setQuestChips?.(ctx.quests);
      if (perfect){ try{ sfx?.good?.(); }catch{}; return 'perfect'; }
      try{ sfx?.good?.(); }catch{}; return 'good';
    }else{
      ctx.miss++; try{ sfx?.bad?.(); }catch{}; return 'bad';
    }
  }

  return 'ok';
}

export function tick(state, sys, hud){
  const ctx = state.ctx?.gj; if(!ctx) return;
  // นับเวลาของทุกเควส
  let changed=false, cheer=false;
  for(const q of ctx.quests){
    if (q.done||q.fail) continue;
    q.remain = Math.max(0, q.remain-1);
    if (q.progress>=q.need){ q.done=true; cheer=true; }
    else if (q.remain===0){ q.fail=true; }
    if (q.done||q.fail) changed=true;
  }
  if (changed) hud?.setQuestChips?.(ctx.quests);
  if (cheer) sys?.coach?.onQuestDone?.(hud);
}

export function cleanup(){ /* no-op */ }
