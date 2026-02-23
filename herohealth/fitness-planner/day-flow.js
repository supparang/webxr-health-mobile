// === /herohealth/fitness-planner/day-flow.js ===
// Counterbalanced Day Flow (4-game) — deterministic by pid+day+seed

'use strict';

function fnv1a32(str){
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h>>>0;
}
function makeRng(seedStr){
  let x = fnv1a32(seedStr) || 13579;
  return function(){
    x ^= x<<13; x>>>=0;
    x ^= x>>17; x>>>=0;
    x ^= x<<5;  x>>>=0;
    return (x>>>0)/4294967296;
  };
}

// Balanced Latin-ish set for 4 items (classic 4x4 counterbalance)
const ORDERS_4 = [
  ['shadow','rhythm','jumpduck','balance'],
  ['rhythm','jumpduck','balance','shadow'],
  ['jumpduck','balance','shadow','rhythm'],
  ['balance','shadow','rhythm','jumpduck'],
  // reverse variants (helps if you want 8 patterns)
  ['shadow','balance','jumpduck','rhythm'],
  ['balance','jumpduck','rhythm','shadow'],
  ['jumpduck','rhythm','shadow','balance'],
  ['rhythm','shadow','balance','jumpduck'],
];

export function pickDayOrder(opts){
  const o = Object.assign({
    pid:'anon',
    dayKey:'',  // YYYY-MM-DD
    seed:'0',
    use8:true   // 8 patterns (recommended)
  }, opts||{});

  const rng = makeRng(`${o.pid}|${o.dayKey}|${o.seed}|dayflow`);
  const pool = o.use8 ? ORDERS_4 : ORDERS_4.slice(0,4);
  const idx = Math.floor(rng()*pool.length);
  const seq = pool[idx].slice();
  return { orderId: idx+1, seq };
}

// insert boss step rule
export function insertBoss(seq, where){
  // where: 'after2'|'end'|'none'
  const out = seq.slice();
  if(where === 'none') return out;
  const bossStep = 'boss';
  if(where === 'after2'){
    out.splice(2, 0, bossStep);
  } else {
    out.push(bossStep);
  }
  return out;
}

// map ids -> planner step descriptors (you can override)
export function mapToSteps(seq, defs){
  // defs: { shadow:stepObj, rhythm:stepObj, jumpduck:stepObj, balance:stepObj, boss:stepObj }
  return seq.map(id => defs[id]).filter(Boolean);
}