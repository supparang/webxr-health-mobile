// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — UNIVERSAL (seeded, research-safe)
// FULL v20260223-aihooks-uni
// ✅ Deterministic RNG (seed string)
// ✅ Collect event stream (spawn/hit/expire/tick/end)
// ✅ Simple prediction baseline (hazard risk) — showable in HUD
// ✅ Research lock: no adaptive changes, only prediction output

'use strict';

export function createAIHooks(cfg = {}) {
  const seed = String(cfg.seed ?? '0');
  const runMode = String(cfg.runMode ?? 'play').toLowerCase();
  const game = String(cfg.game ?? 'unknown');
  const diff = String(cfg.diff ?? 'normal');
  const device = String(cfg.device ?? 'mobile');

  // deterministic RNG
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
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
  const g = xmur3(seed);
  const rng = sfc32(g(), g(), g(), g());
  const r01 = ()=> rng();

  // rolling stats for prediction
  const st = {
    t0: Date.now(),
    lastTick: performance.now(),
    sec: 0,

    // counts
    spawn: { good:0, junk:0, star:0, shield:0, diamond:0, skull:0, bomb:0 },
    hit:   { good:0, junk:0, star:0, shield:0, diamond:0, skull:0, bomb:0 },
    expire:{ good:0, junk:0, star:0, shield:0, diamond:0, skull:0, bomb:0 },

    // miss model inputs
    missGoodExpired: 0,
    missJunkHit: 0,
    shield: 0,
    fever: 0,
    combo: 0,

    // prediction output
    pred: {
      hazardRisk: 0,     // 0..1
      next5: [],         // suggested "watchouts"
      note: ''
    },

    // event buffer (small)
    events: []
  };

  const researchLocked = (runMode === 'research');

  function pushEvent(type, detail){
    const e = {
      ts: Date.now(),
      t: +( (performance.now() - st.lastTick) / 1000 ).toFixed(3), // relative-ish; not strict
      type,
      detail: detail || null
    };
    st.events.push(e);
    // cap buffer
    if(st.events.length > 1200) st.events.splice(0, 200);
  }

  function updateInputs(p = {}){
    if(Number.isFinite(p.missGoodExpired)) st.missGoodExpired = p.missGoodExpired|0;
    if(Number.isFinite(p.missJunkHit)) st.missJunkHit = p.missJunkHit|0;
    if(Number.isFinite(p.shield)) st.shield = p.shield|0;
    if(Number.isFinite(p.fever)) st.fever = +p.fever;
    if(Number.isFinite(p.combo)) st.combo = p.combo|0;
  }

  // Simple deterministic risk model (baseline)
  function computePrediction(){
    const miss = (st.missGoodExpired|0) + (st.missJunkHit|0);
    const shield = Math.max(0, st.shield|0);
    const fever = Math.max(0, Math.min(100, +st.fever||0));

    // hazard risk increases with miss & fever, decreases with shield
    let risk =
      0.10 +
      0.12 * Math.min(6, miss) +
      0.004 * fever -
      0.08 * Math.min(3, shield);

    risk += (r01() - 0.5) * 0.04; // tiny deterministic jitter
    risk = Math.max(0, Math.min(1, risk));

    const next5 = [];
    if(risk >= 0.66){
      next5.push('💣 ระวัง Bomb');
      next5.push('💀 ระวัง Skull');
      next5.push('🛡️ เก็บ Shield');
    }else if(risk >= 0.38){
      next5.push('🍟 Junk โผล่ถี่ขึ้น');
      next5.push('⭐ หา Star ลด MISS');
      next5.push('🛡️ เตรียม Block');
    }else{
      next5.push('🥦 เน้น Good + Combo');
      next5.push('⭐ Star เป็นกันชน');
      next5.push('💎 Diamond โบนัส');
    }

    st.pred = {
      hazardRisk: risk,
      next5,
      note: researchLocked
        ? 'Research: prediction only (no adaptive)'
        : 'Play: prediction available'
    };
    return st.pred;
  }

  function onSpawn(kind, extra){
    if(st.spawn[kind] != null) st.spawn[kind]++;
    pushEvent('spawn', { kind, ...extra });
  }
  function onHit(kind, extra){
    if(st.hit[kind] != null) st.hit[kind]++;
    pushEvent('hit', { kind, ...extra });
  }
  function onExpire(kind, extra){
    if(st.expire[kind] != null) st.expire[kind]++;
    pushEvent('expire', { kind, ...extra });
  }

  function onTick(dtSec, inputs){
    st.sec += (dtSec || 0);
    if(inputs) updateInputs(inputs);
    const pred = computePrediction();
    pushEvent('tick', { dt: +(dtSec||0).toFixed(3), pred: { hazardRisk: +pred.hazardRisk.toFixed(3) } });

    // IMPORTANT: return pred only; DO NOT change game mechanics here.
    return pred;
  }

  function onEnd(summary){
    pushEvent('end', { summary: summary || null });
    return {
      meta: { game, diff, device, runMode, seed, researchLocked },
      stats: {
        spawn: st.spawn,
        hit: st.hit,
        expire: st.expire,
        missGoodExpired: st.missGoodExpired,
        missJunkHit: st.missJunkHit,
      },
      predictionLast: st.pred,
      events: st.events
    };
  }

  return {
    meta: { game, diff, device, runMode, seed, researchLocked },
    updateInputs,
    onSpawn,
    onHit,
    onExpire,
    onTick,
    onEnd,
    getPrediction: ()=> st.pred,
    getEvents: ()=> st.events
  };
}