// === /fitness/js/ai-pattern.js — Seeded Pattern Generator (deterministic) ===
'use strict';

(function(){
  // Deterministic RNG: mulberry32
  function hashSeed(s){
    // string -> uint32
    const str = String(s == null ? '' : s);
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:v>b?b:v; }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // lanes: 0..4 = L2 L1 C R1 R2
  const LANES = [0,1,2,3,4];

  // “แพทเทิร์นพื้นฐาน” (อ่านง่ายสำหรับเด็ก ป.5 แต่ยังเร้าใจ)
  const PATTERNS = {
    // ง่าย: สลับ C กับ L/R ใกล้ ๆ
    easy: [
      [2,1,2,3],
      [2,1,2,1],
      [2,3,2,3],
      [1,2,3,2],
      [1,2,1,2],
      [3,2,3,2]
    ],
    // ปกติ: เพิ่ม cross + double
    normal: [
      [1,2,3,2],
      [0,2,4,2],
      [1,3,1,3],
      [2,1,3,4],
      [2,3,1,0],
      [1,2,1,3],
      [3,2,3,1]
    ],
    // ยาก: เพิ่ม “ข้ามเลน” + “ไซด์สลับ” + “ดับเบิล”
    hard: [
      [0,2,4,2],
      [4,2,0,2],
      [0,1,3,4],
      [4,3,1,0],
      [1,4,2,0],
      [3,0,2,4],
      [0,3,1,4]
    ]
  };

  function difficultyFromTrack(trackId, fallback){
    // track diff meta อาจอยู่ใน engine อยู่แล้ว; ที่นี่กันพลาด
    if (trackId === 'n1') return 'easy';
    if (trackId === 'n2') return 'normal';
    if (trackId === 'n3') return 'hard';
    if (trackId === 'r1') return 'normal';
    return fallback || 'normal';
  }

  // generator: สร้าง chart = [{time,lane,type}]
  // opts:
  // - bpm, durationSec, seed, difficulty
  // - mods: {doubleI, ghostI, holdI, swapI} 0..1
  // - density: 0.8..1.35 (จำนวนโน้ตถี่ขึ้น)
  // - allowHolds: boolean
  function generateChart(opts){
    const bpm = Number(opts.bpm)||120;
    const dur = Number(opts.durationSec)||32;
    const seed = (opts.seed == null ? '' : opts.seed);
    const diff = opts.difficulty || 'normal';
    const density = clamp(opts.density == null ? 1.0 : opts.density, 0.75, 1.45);

    const mods = Object.assign({ doubleI:0, ghostI:0, holdI:0, swapI:0 }, opts.mods||{});
    const allowHolds = !!opts.allowHolds;

    const rng = mulberry32(hashSeed(seed + '::RBCHART::' + diff + '::' + bpm));

    // base beat
    const beat = 60 / bpm;
    const step = beat / density; // density>1 => ถี่ขึ้น

    // เริ่มหลัง 2s (เหมือน engine เดิม)
    let t = 2.0;

    const out = [];
    const total = Math.floor((dur - 3) / step);

    // อาจทำ swap side (ซ้าย/ขวาสลับ) เพื่อเร้าใจ แต่ต้อง deterministic
    const doSwap = (rng() < mods.swapI);

    const patternBank = PATTERNS[diff] || PATTERNS.normal;
    let pat = pick(rng, patternBank);
    let pi = 0;

    // helper swap lane
    function swapLane(l){
      if (!doSwap) return l;
      // 0<->4, 1<->3, 2 stays
      if (l===0) return 4;
      if (l===4) return 0;
      if (l===1) return 3;
      if (l===3) return 1;
      return 2;
    }

    for (let i=0;i<total && t < dur-2;i++){
      // เปลี่ยน pattern เป็นช่วง ๆ (กันจำเจ)
      if (i % 12 === 0 && i > 0 && rng() < 0.55){
        pat = pick(rng, patternBank);
        pi = 0;
      }

      let lane = pat[pi % pat.length];
      pi++;

      lane = swapLane(lane);

      // ghost: บางโน้ตกลายเป็น “ghost” (คะแนนน้อย/เป็นตัวล่อ)
      // (คุณจะตัดสินใน engine ว่ากด ghost แล้วได้คะแนนยังไง)
      const isGhost = (rng() < mods.ghostI*0.22);

      // hold: โน้ตค้าง (สำหรับอนาคต) — ตอนนี้ใส่ type ไว้ก่อน
      const isHold = allowHolds && (rng() < mods.holdI*0.18);

      out.push({
        time: Number(t.toFixed(3)),
        lane: lane,
        type: isHold ? 'hold' : (isGhost ? 'ghost' : 'note')
      });

      // double: บางจังหวะเพิ่มโน้ตที่เลนใกล้กัน (เร้าใจ)
      if (rng() < mods.doubleI*0.28){
        // เลนคู่: เลือกใกล้ lane (กันโหดเกิน)
        const neighbors = lane===2 ? [1,3] : lane===0 ? [1] : lane===4 ? [3] : [2];
        const lane2 = swapLane(pick(rng, neighbors));
        out.push({
          time: Number((t + step*0.08).toFixed(3)),
          lane: lane2,
          type: 'note'
        });
      }

      t += step;
    }

    // เรียงเวลาสุดท้าย
    out.sort((a,b)=>a.time-b.time);
    return out;
  }

  window.RbPatternGen = {
    generateChart,
    difficultyFromTrack
  };
})();