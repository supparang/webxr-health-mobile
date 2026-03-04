// === /herohealth/vr/battle-mirror.js ===
// Battle Mirror Spawner — deterministic by roomSeed + timeStep
// ✅ createMirrorSpawner({ roomSeed, stepMs, getElapsedMs, tune, onSpawn })
// ✅ reset(), tick(ctx)
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
function makeRng(seedStr){
  const seed = xmur3(seedStr);
  return sfc32(seed(), seed(), seed(), seed());
}
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }

const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
const BONUS = ['⭐','💎','⚡'];

export function createMirrorSpawner(opts){
  opts = opts || {};
  const stepMs = clamp(opts.stepMs ?? 100, 40, 500);
  const getElapsedMs = typeof opts.getElapsedMs === 'function' ? opts.getElapsedMs : ()=>0;
  const onSpawn = typeof opts.onSpawn === 'function' ? opts.onSpawn : ()=>{};
  const tune = Object.assign({
    spawnBase: 0.78,
    stormMult: 1.0,
    ttlGood: 2.6,
    ttlJunk: 2.9,
    ttlBonus: 2.4,
    bossHp: 18
  }, opts.tune || {});

  let roomSeed = String(opts.roomSeed || 'seed');
  let rng = makeRng(roomSeed + '::0');
  let lastStep = -1;
  let spawnAcc = 0;

  function r01(){ return rng(); }
  function rPick(arr){ return arr[(r01()*arr.length)|0]; }

  function reseedForStep(step){
    rng = makeRng(`${roomSeed}::${step}`);
  }

  function reset(newSeed){
    if(newSeed) roomSeed = String(newSeed);
    lastStep = -1;
    spawnAcc = 0;
    rng = makeRng(roomSeed + '::0');
  }

  function tick(ctx){
    ctx = ctx || {};
    const plannedSec = clamp(ctx.plannedSec ?? 80, 10, 600);
    const tLeftSec = clamp(ctx.tLeftSec ?? plannedSec, 0, plannedSec);
    const rageOn = !!ctx.rageOn;
    const bossActive = !!ctx.bossActive;
    const bossPhase = Number(ctx.bossPhase||0);

    const elapsedMs = Math.max(0, Number(getElapsedMs())||0);
    const step = Math.floor(elapsedMs / stepMs);
    if(step <= lastStep) return;

    // catch up each step (deterministic)
    for(let s = lastStep + 1; s <= step; s++){
      reseedForStep(s);

      const dt = stepMs / 1000;
      const stormOn = (tLeftSec <= Math.min(40, plannedSec*0.45));
      const mult = stormOn ? tune.stormMult : 1.0;
      const base = tune.spawnBase * mult * (rageOn ? 1.18 : 1.0);

      spawnAcc += base * dt;

      while(spawnAcc >= 1){
        spawnAcc -= 1;

        let kind = 'good';
        const p = r01();

        // boss token spawns only if bossActive (game decides when boss activates)
        if(bossActive && (r01() < 0.22)){
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

        let emoji = '🥦';
        let ttlSec = 2.5;

        if(kind==='good'){ emoji = rPick(GOOD); ttlSec = tune.ttlGood; }
        else if(kind==='junk'){ emoji = rPick(JUNK); ttlSec = tune.ttlJunk; }
        else if(kind==='bonus'){ emoji = rPick(BONUS); ttlSec = tune.ttlBonus; }
        else if(kind==='shield'){ emoji = '🛡️'; ttlSec = 2.6; }
        else if(kind==='boss'){
          emoji = (bossPhase===0) ? '🛡️' : '🎯';
          ttlSec = 2.2;
        }

        onSpawn({ kind, emoji, ttlSec });
      }
    }

    lastStep = step;
  }

  return { reset, tick };
}