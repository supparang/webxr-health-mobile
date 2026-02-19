// === /fitness/js/ai-difficulty.js ===
// AI-lite Difficulty Director (deterministic, research-friendly)

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr){
  // xorshift32
  let x = fnv1a32(seedStr) || 123456789;
  return function(){
    x ^= x<<13; x >>>= 0;
    x ^= x>>17; x >>>= 0;
    x ^= x<<5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

// stateful director
export function createDifficultyDirector(opts){
  const o = Object.assign({
    seed: '0',
    pid: 'anon',
    game: 'unknown',
    targetMiss: 0.30,      // เป้าหมาย miss rate
    targetRt: 650,         // เป้าหมาย rt mean (ms)
    minD: 0.25,
    maxD: 1.75,
    adaptRate: 0.08,       // ความเร็วในการปรับ (ยิ่งน้อยยิ่งนิ่ง)
    windowN: 20,           // ใช้เหตุการณ์ล่าสุด N ตัว
  }, opts||{});

  const rng = makeRng(`${o.seed}|${o.pid}|${o.game}|director`);
  let D = 1.0;             // difficulty scalar
  let hist = [];           // {type:'hit/miss', rt}
  let lastUpdateAt = 0;

  function pushEvent(ev){
    // ev: {type:'hit'|'miss', rt?}
    if(!ev || (ev.type!=='hit' && ev.type!=='miss')) return;
    hist.push({ type: ev.type, rt: (typeof ev.rt==='number'? ev.rt : null) });
    if(hist.length > o.windowN) hist.shift();
  }

  function computeStats(){
    const acts = hist.length;
    if(!acts) return null;
    const hits = hist.filter(x=>x.type==='hit').length;
    const miss = acts - hits;
    const missRate = miss / acts;

    const rts = hist.map(x=>x.rt).filter(x=>x!=null && isFinite(x));
    const rtMean = rts.length ? (rts.reduce((a,b)=>a+b,0)/rts.length) : null;

    return { acts, hits, miss, missRate, rtMean };
  }

  function update(nowMs){
    // ปรับเป็นช่วง ๆ ไม่ถี่เกิน
    if(nowMs != null){
      if(nowMs - lastUpdateAt < 600) return D;
      lastUpdateAt = nowMs;
    }

    const s = computeStats();
    if(!s) return D;

    // error signals (normalize)
    const eMiss = (s.missRate - o.targetMiss);           // >0 แปลว่ายากไป
    const eRt = (s.rtMean==null) ? 0 : ((s.rtMean - o.targetRt) / o.targetRt); // >0 แปลว่ายากไป

    // combine with weights
    let e = 0.65*eMiss + 0.35*eRt;

    // noise (deterministic tiny) เพื่อไม่ให้ stuck ที่ขอบ แต่ยัง reproducible
    const jitter = (rng()-0.5) * 0.02;
    e += jitter;

    // move difficulty opposite direction (ถ้ายากไป → ลด D)
    const step = clamp(e, -0.35, 0.35) * o.adaptRate;
    D = clamp(D * (1 - step), o.minD, o.maxD);

    return D;
  }

  // map difficulty scalar to knobs (เกมเอาไปใช้)
  function params(){
    // D สูง = ยากขึ้น
    // spawnRate: ยิ่งยากยิ่งถี่ (mult <1 คือถี่ขึ้น)
    const spawnMult = lerp(1.25, 0.70, (D- o.minD)/(o.maxD-o.minD)); // easy->slow, hard->fast
    const speedMult = lerp(0.85, 1.30, (D- o.minD)/(o.maxD-o.minD)); // easy->slower, hard->faster
    const sizeMult  = lerp(1.20, 0.85, (D- o.minD)/(o.maxD-o.minD)); // easy->bigger, hard->smaller
    return { D, spawnMult, speedMult, sizeMult };
  }

  return { pushEvent, update, params, getD:()=>D };
}