// === /fitness/js/ai-pattern.js ===
// Seeded Pattern Generator for Rhythm Boxer (Normal/Play)
// Research-safe: deterministic by seed; can be disabled in research
'use strict';

(function(){
  // ---- seeded rng (mulberry32) ----
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str){
    // stable hash for strings
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  // lanes: 0..4 => L2,L1,C,R1,R2
  const LANES = [0,1,2,3,4];

  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  function laneMirror(l){ return 4 - l; }

  // density profile per diff
  const DIFF = {
    easy:   { bpm:100, stepMin:1.0, stepMax:1.4, fakeRate:0.00, stormRate:0.06, jumpRate:0.08 },
    normal: { bpm:120, stepMin:0.75,stepMax:1.1, fakeRate:0.03, stormRate:0.10, jumpRate:0.12 },
    hard:   { bpm:140, stepMin:0.55,stepMax:0.95,fakeRate:0.07, stormRate:0.16, jumpRate:0.18 },
  };

  // “style” affects lane transitions
  const STYLES = {
    focus:   { centerBias:0.38, mirrorBias:0.18, zigzagBias:0.20 },
    mix:     { centerBias:0.25, mirrorBias:0.22, zigzagBias:0.28 },
    chaos:   { centerBias:0.18, mirrorBias:0.10, zigzagBias:0.40 },
    research:{ centerBias:0.30, mirrorBias:0.20, zigzagBias:0.22 },
  };

  function buildChart(opts){
    // opts: {seed, bpm, durationSec, diffKey, styleKey, boss:true/false}
    const dur = opts.durationSec || 32;
    const diffKey = opts.diffKey || 'normal';
    const styleKey = opts.styleKey || 'mix';

    const dcfg = DIFF[diffKey] || DIFF.normal;
    const scfg = STYLES[styleKey] || STYLES.mix;

    const seed = (typeof opts.seed === 'number')
      ? (opts.seed >>> 0)
      : hashSeed(String(opts.seed||'seed'));

    const rng = mulberry32(seed);

    const chart = [];
    let t = 2.0; // start after intro
    let lane = 2; // start center
    let lastLane = lane;

    const beat = 60 / (opts.bpm || dcfg.bpm || 120);

    // phases: 1..3 normal, optional boss in last segment
    const boss = !!opts.boss;
    const bossStart = dur * 0.68;
    const bossEnd   = dur - 2.0;

    // helper to choose next lane
    function nextLane(){
      const r = rng();
      // center bias
      if (r < scfg.centerBias) return 2;

      // mirror bias (left-right symmetry)
      if (r < scfg.centerBias + scfg.mirrorBias) {
        return laneMirror(lastLane);
      }

      // zigzag bias (jump across)
      if (r < scfg.centerBias + scfg.mirrorBias + scfg.zigzagBias) {
        const choices = [0,4,1,3];
        return pick(rng, choices);
      }

      // otherwise move small step
      const step = (rng()<0.5 ? -1 : 1) * (rng()<0.25 ? 2 : 1);
      return clamp(lastLane + step, 0, 4);
    }

    // “storm” => short burst of rapid notes
    function addStorm(at){
      const stormLen = 0.9 + rng()*0.8;       // 0.9–1.7s
      const stormBeat = beat * (0.55 + rng()*0.15); // faster
      let tt = at;
      while (tt < at + stormLen){
        const l = nextLane();
        chart.push({ time: tt, lane: l, type:'note', tag:'storm' });
        lastLane = l;
        tt += stormBeat;
      }
    }

    // “fake” note => does not score, but distracts
    function maybeFake(at, l){
      if (rng() < dcfg.fakeRate){
        chart.push({ time: at + beat*0.22, lane: l, type:'fake', tag:'fake' });
      }
    }

    // main timeline
    while (t < dur - 2.0){
      // boss phase: more intensity + patterns
      const inBoss = boss && t >= bossStart && t <= bossEnd;
      const localStep = inBoss
        ? beat * (0.52 + rng()*0.18)   // denser
        : beat * (dcfg.stepMin + rng()*(dcfg.stepMax-dcfg.stepMin));

      // storm burst
      if (!inBoss && rng() < dcfg.stormRate && t > 4.0 && t < dur-6.0){
        addStorm(t);
        t += 0.8 + rng()*0.8;
        continue;
      }

      // choose lane with style
      lane = nextLane();
      chart.push({ time: t, lane, type:'note', tag: inBoss ? 'boss' : 'main' });

      // optional fake note for distraction
      maybeFake(t, lane);

      // boss special: “double punch”
      if (inBoss && rng() < 0.22){
        const l2 = clamp(lane + (rng()<0.5?-1:1), 0, 4);
        chart.push({ time: t + beat*0.35, lane: l2, type:'note', tag:'boss2' });
        maybeFake(t + beat*0.35, l2);
        lastLane = l2;
      } else {
        lastLane = lane;
      }

      t += localStep;
    }

    // sort & finalize
    chart.sort((a,b)=>a.time-b.time);
    return { seed, chart, bossStart, bossEnd };
  }

  window.AI_PATTERN = {
    buildChart,
    hashSeed
  };
})();