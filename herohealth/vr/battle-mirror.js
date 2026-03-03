// === /herohealth/vr/battle-mirror.js ===
// Deterministic mirror spawner for 2-player duel
// Uses: roomSeed + stepIndex => identical decisions across clients
// FULL v20260304-MIRROR

'use strict';

function xmur3(str){
  str = String(str||'');
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function rngFrom(seed){
  const s = xmur3(seed);
  return sfc32(s(), s(), s(), s());
}

export function createMirrorSpawner(opts){
  opts = opts || {};

  const roomSeed = String(opts.roomSeed || 'seed');
  const stepMs = Math.max(40, Math.min(250, Number(opts.stepMs || 100))); // 10Hz default
  const getElapsedMs = typeof opts.getElapsedMs === 'function' ? opts.getElapsedMs : ()=>0;

  // callouts
  const onSpawn = typeof opts.onSpawn === 'function' ? opts.onSpawn : ()=>{};

  // tuning bundle (all primitives only)
  const tune = Object.assign({
    spawnBase: 0.85,
    stormMult: 1.10,
    ttlGood: 2.4,
    ttlJunk: 2.7,
    ttlBonus: 2.2,
    bossHp: 18
  }, opts.tune || {});

  const pools = Object.assign({
    GOOD: ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'],
    JUNK: ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'],
    BONUS:['⭐','💎','⚡'],
    SHIELD:['🛡️','🛡️','🛡️']
  }, opts.pools || {});

  let lastStep = -1;

  function pick(arr, r){ return arr[(r()*arr.length)|0]; }

  function decideSpawn(stepIndex, ctx){
    // ctx = { tLeftSec, plannedSec, rageOn, bossActive, bossPhase }
    const r = rngFrom(`${roomSeed}|${stepIndex}`);

    const plannedSec = Number(ctx.plannedSec || 80);
    const tLeft = Number(ctx.tLeftSec || plannedSec);

    const stormOn = (tLeft <= Math.min(40, plannedSec*0.45));
    const mult = stormOn ? tune.stormMult : 1.0;
    const rageBoost = ctx.rageOn ? 1.18 : 1.0;
    const base = tune.spawnBase * mult * rageBoost;

    // we map base to a probability per step: p = base*(stepMs/1000)
    const pSpawn = Math.max(0, Math.min(0.98, base * (stepMs/1000)));
    if(r() > pSpawn) return null;

    // decide kind
    let kind = 'good';
    const p = r();

    const bossActive = !!ctx.bossActive;
    const bossPhase = Number(ctx.bossPhase||0);

    if(bossActive && (r() < 0.22)){
      kind = 'boss';
    }else if(p < 0.64){
      kind = 'good';
    }else if(p < 0.86){
      kind = 'junk';
    }else if(p < 0.94){
      kind = 'bonus';
    }else{
      kind = 'shield';
    }

    let emoji = '🍎';
    let ttl = tune.ttlGood;

    if(kind==='good'){ emoji = pick(pools.GOOD, r); ttl = tune.ttlGood; }
    else if(kind==='junk'){ emoji = pick(pools.JUNK, r); ttl = tune.ttlJunk; }
    else if(kind==='bonus'){ emoji = pick(pools.BONUS, r); ttl = tune.ttlBonus; }
    else if(kind==='shield'){ emoji = pick(pools.SHIELD, r); ttl = 2.6; }
    else if(kind==='boss'){
      emoji = (bossPhase===0) ? '🛡️' : '🎯';
      ttl = 2.2;
    }

    return { kind, emoji, ttlSec: ttl, stepIndex };
  }

  function tick(ctx){
    // ctx must be deterministic across both clients (we use server elapsed)
    const elapsedMs = Math.max(0, Number(getElapsedMs()||0));
    const step = Math.floor(elapsedMs / stepMs);
    if(step <= lastStep) return;

    // catch up in case of lag
    for(let i=lastStep+1; i<=step; i++){
      const s = decideSpawn(i, ctx || {});
      if(s) onSpawn(s);
    }
    lastStep = step;
  }

  function reset(){
    lastStep = -1;
  }

  return { tick, reset, stepMs };
}