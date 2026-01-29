// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — STANDARD (SAFE, NO-CRASH)
// ✅ Always returns methods: getDifficulty(), getTip(), onEvent(), isEnabled()
// ✅ Deterministic-ready: uses provided rng when needed
// ✅ Default is "OFF" in research by convention (mode !== 'play') unless explicitly enabled
// ✅ Does NOT implement real ML/DL; it's a stable hook surface for later AI modules.

'use strict';

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'HHA').trim();
  const mode = String(cfg.mode || 'play').trim().toLowerCase();   // play | research | study
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  // If user passes ?ai=1 you may enable later; for now keep simple:
  const forceAI = Boolean(cfg.forceAI);
  const enabled = forceAI || (mode === 'play'); // default: ON only in play

  // lightweight memory for heuristics (NOT ML):
  const mem = {
    lastTipAtSec: -999,
    lastEvents: [],
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    comboBreak: 0,
    t0: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  };

  function nowSec(){
    const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return (t - mem.t0) / 1000;
  }

  function pushEvent(name, data){
    mem.lastEvents.push({ name, t: nowSec(), data: data || null });
    if(mem.lastEvents.length > 50) mem.lastEvents.shift();
  }

  function onEvent(name, data){
    if(!enabled) return;
    const n = String(name || '').toLowerCase();
    if(n === 'hitgood') mem.hitGood++;
    else if(n === 'hitjunk') mem.hitJunk++;
    else if(n === 'miss') mem.miss++;
    else if(n === 'combobreak') mem.comboBreak++;
    pushEvent(n, data);
  }

  // ✅ The function you are missing: getDifficulty(playedSec, base)
  // Returns an object with spawnMs + probabilities.
  function getDifficulty(playedSec, base){
    // base must exist
    const B = base || { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };

    // If not enabled -> return base unchanged
    if(!enabled) return { ...B };

    const t = Math.max(0, Number(playedSec) || 0);

    // simple heuristics (fair + fun):
    // - if player misses a lot -> slightly slow spawn + add powerups
    // - if player is doing well -> slightly faster spawn + increase junk a bit
    const missRate = mem.miss / Math.max(1, (mem.hitGood + mem.hitJunk + mem.miss));
    const doingWell = (missRate < 0.18 && mem.hitGood >= 10);

    let spawnMs = B.spawnMs;
    let pGood   = B.pGood;
    let pJunk   = B.pJunk;
    let pStar   = B.pStar;
    let pShield = B.pShield;

    // ramp over time a tiny bit
    spawnMs = Math.max(520, spawnMs - Math.min(220, t * 2.5));
    pJunk   = pJunk + Math.min(0.08, t * 0.0018);
    pGood   = pGood - Math.min(0.08, t * 0.0016);

    if(missRate >= 0.30){
      spawnMs = Math.min(1100, spawnMs + 120);
      pShield += 0.02;
      pStar   += 0.01;
      pJunk   -= 0.03;
      pGood   += 0.00;
    }else if(doingWell){
      spawnMs = Math.max(500, spawnMs - 70);
      pJunk   += 0.03;
      pShield -= 0.01;
      pStar   -= 0.005;
    }

    // tiny randomness (seeded rng allowed)
    const jitter = (rng() - 0.5) * 40;
    spawnMs = Math.max(480, Math.round(spawnMs + jitter));

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood /= s; pJunk /= s; pStar /= s; pShield /= s;

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  function getTip(playedSec){
    if(!enabled) return null;

    const t = Math.max(0, Number(playedSec) || 0);
    // rate limit tips: every >= 7s
    if(t - mem.lastTipAtSec < 7) return null;
    mem.lastTipAtSec = t;

    // simple explainable tips
    const missRate = mem.miss / Math.max(1, (mem.hitGood + mem.hitJunk + mem.miss));
    if(missRate > 0.28){
      return { msg:'ลองช้าลงนิดนึง เน้น “ของดี” ก่อนนะ ✅', tag:'Coach' };
    }
    if(mem.hitJunk >= 4 && mem.hitGood < mem.hitJunk){
      return { msg:'ระวังของทอด/หวาน 🍟🍩 เล็งให้ชัดแล้วค่อยยิง', tag:'Coach' };
    }
    if(mem.hitGood >= 12 && missRate < 0.18){
      return { msg:'ฟอร์มดีมาก! ลองทำคอมโบต่อเนื่องให้ยาวขึ้น 🔥', tag:'Coach' };
    }
    return null;
  }

  function isEnabled(){ return enabled; }

  // ✅ STANDARD API guaranteed
  return Object.freeze({
    game, mode,
    isEnabled,
    onEvent,
    getTip,
    getDifficulty
  });
}