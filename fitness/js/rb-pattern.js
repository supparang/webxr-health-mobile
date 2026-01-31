// === /fitness/js/rb-pattern.js ===
// Dynamic pattern generator (play-only). Seeded RNG + storm segments.
// Research mode should keep fixed chart (no dynamic).

(function(){
  'use strict';

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v,a,b){ return v<a?a:v>b?b:v; }

  // lanes: 0..4 (L2 L1 C R1 R2)
  const LANES = [0,1,2,3,4];

  function pickWeighted(rng, items){
    // items: [{v, w}]
    let sum = 0;
    for(const it of items) sum += it.w;
    let r = rng() * sum;
    for(const it of items){
      r -= it.w;
      if(r <= 0) return it.v;
    }
    return items[items.length-1].v;
  }

  function neighborLanes(l){
    if(l === 0) return [0,1];
    if(l === 4) return [4,3];
    return [l-1, l, l+1];
  }

  function farJumpCandidates(l){
    // encourage switch side sometimes
    if(l <= 1) return [3,4,2];
    if(l >= 3) return [0,1,2];
    return [0,4,1,3];
  }

  function genNextLane(rng, prevLane, style){
    // style: 'flow' | 'zigzag' | 'center' | 'swap'
    if(style === 'center'){
      // center-biased
      return pickWeighted(rng, [
        {v:2,w:6},{v:1,w:2},{v:3,w:2},{v:0,w:1},{v:4,w:1}
      ]);
    }
    if(style === 'zigzag'){
      // alternate sides around center
      if(prevLane == null) return 2;
      if(prevLane <= 1) return pickWeighted(rng,[{v:3,w:4},{v:4,w:2},{v:2,w:2}]);
      if(prevLane >= 3) return pickWeighted(rng,[{v:1,w:4},{v:0,w:2},{v:2,w:2}]);
      return pickWeighted(rng,[{v:1,w:3},{v:3,w:3},{v:0,w:1},{v:4,w:1}]);
    }
    if(style === 'swap'){
      // cross-hand feel: L<->R often
      if(prevLane == null) return 2;
      const cand = farJumpCandidates(prevLane);
      return cand[Math.floor(rng()*cand.length)];
    }
    // flow default: neighbors mostly
    if(prevLane == null) return 2;
    const nb = neighborLanes(prevLane);
    return nb[Math.floor(rng()*nb.length)];
  }

  function buildDynamicChart(opts){
    // opts: { bpm, durationSec, baseBeatDiv, seed, difficulty01, storm=true }
    const bpm = opts.bpm || 120;
    const dur = opts.durationSec || 32;
    const seed = (opts.seed != null) ? opts.seed : Date.now();
    const rng = mulberry32(seed);

    // baseBeatDiv: 1 = quarter notes, 2 = eighths, 3 = triplet-ish (dense)
    const baseDiv = clamp(opts.baseBeatDiv || 1, 1, 4);
    const diff01 = clamp(opts.difficulty01 || 0.5, 0, 1);
    const beat = 60 / bpm;

    // density: higher diff => smaller step
    // step = beat / (baseDiv + extra)
    const extra = Math.floor(diff01 * 2.0); // 0..2
    const step = beat / (baseDiv + extra);

    // storm segment (single window near end-mid)
    const stormOn = !!opts.storm;
    const stormLen = 6 + Math.floor(rng()*3); // 6..8 sec
    const stormStart = stormOn ? (dur*0.55 + rng()* (dur*0.15)) : 9999;
    const stormEnd = stormStart + stormLen;

    const chart = [];
    let t = 2.0;
    let prevLane = null;

    while(t < dur - 2){
      const isStorm = stormOn && (t >= stormStart && t <= stormEnd);

      // choose style
      const style = isStorm
        ? pickWeighted(rng,[{v:'zigzag',w:4},{v:'swap',w:4},{v:'center',w:2}])
        : pickWeighted(rng,[{v:'flow',w:6},{v:'center',w:2},{v:'zigzag',w:2}]);

      // sometimes insert doubles (two notes close) in storm
      const doDouble = isStorm && (rng() < (0.18 + diff01*0.12));

      const lane = genNextLane(rng, prevLane, style);
      chart.push({ time: +t.toFixed(3), lane, type:'note' });
      prevLane = lane;

      if(doDouble){
        const lane2 = genNextLane(rng, prevLane, 'swap');
        chart.push({ time: +(t + step*0.5).toFixed(3), lane: lane2, type:'note' });
        prevLane = lane2;
      }

      // step jitter for human feel (but deterministic)
      const jitter = (rng()-0.5) * step * 0.15; // +-7.5%
      t += step + jitter;
    }

    // sort by time just in case
    chart.sort((a,b)=>a.time-b.time);
    return { chart, stormStart, stormEnd, seed };
  }

  window.RBPattern = {
    buildDynamicChart
  };
})();