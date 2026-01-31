// === js/pattern-gen.js — AI Pattern Generator (deterministic) ===
'use strict';

(function(){
  // --- tiny seeded RNG (mulberry32) ---
  function hashSeed(str){
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h<<13) | (h>>>19);
    }
    return (h>>>0);
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t>>>15), t | 1);
      t ^= t + Math.imul(t ^ (t>>>7), t | 61);
      return ((t ^ (t>>>14)) >>> 0) / 4294967296;
    };
  }

  // --- helpers ---
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const LANES = [0,1,2,3,4];
  const sideOf = (lane)=> lane===2?'C':(lane<=1?'L':'R');

  // pattern states (DL-ish policy)
  const BASE_PATTERNS = {
    easy:   [2,1,3,2,1,3,2,3],
    normal: [2,3,1,2,3,4,2,3],
    hard:   [1,3,2,4,0,2,3,1]
  };

  // constraints: กัน “โหดเกิน” และกันซ้ำเลนเดิมติด ๆ
  function pickNextLane(rng, prevLane, diff, phase, skill){
    const temp = clamp(0.15 + (diff==='hard'?0.25:diff==='easy'?0.05:0.15) + (1-skill)*0.15, 0.08, 0.55);
    const biasCenter = (phase==='warmup') ? 0.22 : (phase==='boss') ? 0.08 : 0.14;

    // candidate weights
    const w = LANES.map(l=>{
      let wt = 1.0;
      if(l === prevLane) wt *= 0.25;            // กันซ้ำ
      if(sideOf(l) === sideOf(prevLane) && l!==2 && prevLane!==2) wt *= 0.85; // กันอยู่ข้างเดิมนาน
      if(l === 2) wt *= (1 + biasCenter);       // center ง่ายกว่าเล็กน้อย
      if(diff==='hard' && (l===0 || l===4)) wt *= 1.12; // hard ดันสุดขอบนิด
      if(phase==='boss') wt *= (l===2 ? 0.9 : 1.08);    // boss กระจายมากขึ้น
      // temperature
      wt = Math.pow(wt, 1/temp);
      return wt;
    });

    // sample
    const sum = w.reduce((s,x)=>s+x,0) || 1;
    let r = rng() * sum;
    for(let i=0;i<w.length;i++){
      r -= w[i];
      if(r <= 0) return LANES[i];
    }
    return 2;
  }

  // generate chart: bpm, durationSec, diff, seed, phaseMap, (optional) skill
  function generateChart(opts){
    const bpm = opts.bpm || 120;
    const dur = opts.durationSec || 32;
    const diff = (opts.diff || 'normal');
    const seedStr = String(opts.seed || ('RB-'+Date.now()));
    const rng = mulberry32(hashSeed(seedStr));
    const skill = clamp(opts.skillScore ?? 0.5, 0, 1);

    // beat
    const beat = 60 / bpm;
    let t = 2.0; // start after 2s
    const out = [];

    let prev = 2;
    const base = BASE_PATTERNS[diff] || BASE_PATTERNS.normal;
    let baseI = 0;

    const phaseAt = opts.phaseAt || function(songTime){
      if(songTime < 10.5) return 'warmup';
      if(songTime < 20.0) return 'build';
      if(songTime < 27.0) return 'boss';
      return 'finale';
    };

    while(t < dur - 2){
      const phase = phaseAt(t);

      // density scaling by phase (finale แน่นขึ้น)
      let step = beat;
      if(phase==='warmup') step = beat * 1.0;
      if(phase==='build')  step = beat * 0.95;
      if(phase==='boss')   step = beat * 0.90;
      if(phase==='finale') step = beat * 0.85;

      // DL-ish: ผสม base pattern + policy sampling
      const useBase = (rng() < (diff==='easy'?0.75:diff==='hard'?0.45:0.60));
      let lane;
      if(useBase){
        lane = base[baseI % base.length];
        baseI++;
        // คุมไม่ให้ซ้ำเลนเดิมติดกันเกิน
        if(lane === prev && rng() < 0.65){
          lane = pickNextLane(rng, prev, diff, phase, skill);
        }
      }else{
        lane = pickNextLane(rng, prev, diff, phase, skill);
      }

      // occasional burst (boss/finale) ทำให้ “เร้าใจ”
      if((phase==='boss' || phase==='finale') && rng() < (diff==='hard'?0.22:0.14)){
        // ใส่โน้ตแฝดเร็ว (half-beat)
        out.push({ time: t, lane, type:'note' });
        const lane2 = pickNextLane(rng, lane, diff, phase, skill);
        out.push({ time: t + step*0.5, lane: lane2, type:'note' });
      }else{
        out.push({ time: t, lane, type:'note' });
      }

      prev = lane;
      t += step;
    }

    return out;
  }

  window.RB_PatternGen = { generateChart };
})();