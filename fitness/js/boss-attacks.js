// === /fitness/js/boss-attacks.js ===
// Universal Boss Attack Script (deterministic-friendly)

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr){
  let x = fnv1a32(seedStr) || 987654321;
  return function(){
    x ^= x<<13; x >>>= 0;
    x ^= x>>17; x >>>= 0;
    x ^= x<<5;  x >>>= 0;
    return (x>>>0)/4294967296;
  };
}

// attacks: storm / feint / shieldbreak
export function createBossAttackScript(opts){
  const o = Object.assign({
    seed:'0',
    pid:'anon',
    game:'unknown',
    // rate limits
    minGapMs: 3200,
    // tuning for ป.5
    stormMs: 2200,
    feintChance: 0.20,
    shieldHitsNeeded: 2
  }, opts||{});

  const rng = makeRng(`${o.seed}|${o.pid}|${o.game}|bossatk`);

  let lastAtkAt = -1e18;
  let active = null; // {type, t0, tEnd, ...}

  function canTrigger(nowMs){
    return (nowMs - lastAtkAt) >= o.minGapMs && !active;
  }

  function pickAttack(phase){
    // fair mix by phase
    // p1: mostly none/storm small
    // p2: storm + rare feint
    // burst: storm often + shieldbreak sometimes
    const r = rng();

    if(phase === 'p1'){
      if(r < 0.18) return 'storm';
      return null;
    }
    if(phase === 'p2'){
      if(r < 0.30) return 'storm';
      if(r < 0.42) return 'feint';
      return null;
    }
    // burst
    if(r < 0.55) return 'storm';
    if(r < 0.70) return 'shieldbreak';
    if(r < 0.82) return 'feint';
    return null;
  }

  function startAttack(type, nowMs){
    lastAtkAt = nowMs;
    if(type === 'storm'){
      active = { type:'storm', t0: nowMs, tEnd: nowMs + o.stormMs };
    } else if(type === 'feint'){
      // feint lasts short; gameplay effect handled by game mapping
      active = { type:'feint', t0: nowMs, tEnd: nowMs + 900 };
    } else if(type === 'shieldbreak'){
      active = { type:'shieldbreak', t0: nowMs, tEnd: nowMs + 5000, need: o.shieldHitsNeeded, got: 0 };
    } else {
      active = null;
    }
    return active;
  }

  function tick(nowMs, phase){
    // expire
    if(active && nowMs >= active.tEnd){
      const ended = active;
      active = null;
      return { ended };
    }

    // maybe trigger
    if(canTrigger(nowMs)){
      const next = pickAttack(phase);
      if(next){
        const a = startAttack(next, nowMs);
        return { started: a };
      }
    }

    return { active };
  }

  function onPlayerSuccess(){
    // called by game when player performs a correct boss-relevant action (hit)
    if(!active) return null;
    if(active.type === 'shieldbreak'){
      active.got++;
      if(active.got >= active.need){
        // complete shieldbreak
        const done = Object.assign({}, active, { completed:true });
        active = null;
        return { completed: done };
      }
      return { progress: Object.assign({}, active) };
    }
    return null;
  }

  function isStorm(){ return active && active.type==='storm'; }
  function isFeint(){ return active && active.type==='feint'; }
  function isShield(){ return active && active.type==='shieldbreak'; }

  function getActive(){ return active ? Object.assign({}, active) : null; }

  return { tick, onPlayerSuccess, isStorm, isFeint, isShield, getActive };
}