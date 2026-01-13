/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks (SAFE STUB → usable)
✅ disabled by default
✅ attach({enabled, runMode, seed})
✅ provides GroupsVR.__ai = { director, pattern, tip }
- director.spawnSpeedMul(acc, combo, misses)
- pattern.bias(meta)  // meta: accPct, combo, misses, pressureLevel, stormOn
- pattern.nextPos(rect, meta, kind) -> {x,y, explain, band}
*/

(function (root){
  'use strict';
  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0)||1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- Tip (rate-limited, explainable) ----------
  let lastTipAt = 0;
  function tip(text, mood, extra){
    const t = (root.performance && performance.now) ? performance.now() : Date.now();
    if (t - lastTipAt < 1400) return;
    lastTipAt = t;
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral'), explain: extra||null });
  }

  // ---------- Director ----------
  function makeDirector(){
    return {
      spawnSpeedMul(accPct, combo, misses){
        accPct = Number(accPct)||0;
        combo  = Number(combo)||0;
        misses = Number(misses)||0;

        // คุมไม่ให้โหดเกินสำหรับ ป.5
        let mul = 1.0;

        // เล่นดี → เร็วขึ้นนิด
        if (accPct >= 85) mul *= 0.96;
        if (combo >= 8)   mul *= 0.94;

        // พลาดเยอะ → ช้าลงนิด (ช่วยให้กลับมาได้)
        if (misses >= 8)  mul *= 1.08;
        if (misses >= 14) mul *= 1.14;

        return clamp(mul, 0.82, 1.18);
      }
    };
  }

  // ---------- Pattern Packs (spawn distribution) ----------
  function makePattern(seedStr){
    const rng = makeRng(hashSeed(seedStr + '::pattern'));
    let ringPhase = rng()*Math.PI*2;

    function bias(meta){
      meta = meta || {};
      const p = Number(meta.pressureLevel||0);
      const acc = Number(meta.accPct||meta.accPct===0?meta.accPct:meta.accPct)||Number(meta.accPct)||0;
      const storm = !!meta.stormOn;

      // bias > 0 => ยากขึ้น (wrong↑ junk↓) / bias <0 => ง่ายขึ้น
      let b = 0;

      // ฝีมือดี → ยากขึ้นนิด
      if (acc >= 88) b += 0.03;
      if (acc >= 92) b += 0.05;

      // กดดัน/พลาด → ง่ายลง (ช่วย recover)
      if (p >= 2) b -= 0.05;
      if (p >= 3) b -= 0.08;

      // storm: เลือกทำให้ “ท้าทาย” แต่ไม่ลงโทษเกิน
      if (storm) b += 0.01;

      return clamp(b, -0.10, 0.10);
    }

    function nextPos(rect, meta, kind){
      const W = rect.W, H = rect.H;
      const xMin = rect.xMin, xMax = rect.xMax;
      const yMin = rect.yMin, yMax = rect.yMax;

      // เลือกแพทเทิร์น: grid / ring / sweep
      const p = Number(meta && meta.pressureLevel || 0);
      const storm = !!(meta && meta.stormOn);
      const preferStable = (p>=2);     // pressure สูง → ให้แพทเทิร์น “คาดเดาได้” มากขึ้น

      const modePick = rng();
      let mode = 'grid';

      if (storm && modePick < 0.38) mode = 'ring';
      else if (modePick < 0.18) mode = 'sweep';
      else mode = preferStable ? 'grid' : (modePick < 0.55 ? 'grid' : 'ring');

      // ---- GRID9 (สุ่มจุดใน 3x3 band) ----
      if (mode === 'grid'){
        const gx = (rng()*3)|0; // 0..2
        const gy = (rng()*3)|0;

        const cellW = (xMax-xMin)/3;
        const cellH = (yMax-yMin)/3;

        // jitter ใน cell (กันมุมซ้ำ)
        const jx = (rng()*0.62 + 0.19);
        const jy = (rng()*0.62 + 0.19);

        const x = xMin + gx*cellW + jx*cellW;
        const y = yMin + gy*cellH + jy*cellH;

        return {
          x, y,
          band:`grid(${gx},${gy})`,
          explain: preferStable ? 'แรงกดดันสูง → ใช้แพทเทิร์น grid ให้เดาคาดได้' : 'แพทเทิร์น grid กระจายทั่วจอ'
        };
      }

      // ---- RING around crosshair ----
      if (mode === 'ring'){
        const cx = W*0.5;
        const cy = H*0.5;

        ringPhase += (0.55 + rng()*0.65);
        const rBase = Math.min((xMax-xMin),(yMax-yMin)) * (storm ? 0.34 : 0.28);
        const rJit  = rBase * (0.20 + rng()*0.30);
        const rr = clamp(rBase + (rng()<0.5?-rJit:rJit), 48, Math.min(W,H)*0.44);

        let x = cx + Math.cos(ringPhase) * rr;
        let y = cy + Math.sin(ringPhase) * rr;

        // clamp into rect
        x = clamp(x, xMin+6, xMax-6);
        y = clamp(y, yMin+6, yMax-6);

        return {
          x, y,
          band:'ring',
          explain: storm ? 'ช่วงพายุ → เป้าโผล่เป็นวงรอบจุดเล็ง' : 'แพทเทิร์น ring ช่วยฝึกเล็งรอบ ๆ crosshair'
        };
      }

      // ---- SWEEP band (ไล่แนวขวาง/ตั้ง) ----
      {
        const vertical = rng() < 0.5;
        const t = rng();
        if (vertical){
          const x = xMin + (xMax-xMin)*t;
          const y = yMin + (yMax-yMin)*(0.18 + rng()*0.64);
          return { x, y, band:'sweepV', explain:'แพทเทิร์น sweep แนวตั้ง เพิ่มความท้าทายการกวาดสายตา' };
        }else{
          const x = xMin + (xMax-xMin)*(0.18 + rng()*0.64);
          const y = yMin + (yMax-yMin)*t;
          return { x, y, band:'sweepH', explain:'แพทเทิร์น sweep แนวนอน เพิ่มความท้าทายการกวาดสายตา' };
        }
      }
    }

    return { bias, nextPos };
  }

  // ---------- Public attach ----------
  let attached = false;

  NS.AIHooks = {
    attach({ enabled=false, runMode='play', seed='' } = {}){
      runMode = String(runMode||'play').toLowerCase();
      if (runMode !== 'play') enabled = false;

      // always safe, but keep deterministic if enabled
      const seedStr = String(seed||Date.now());
      NS.__ai = NS.__ai || {};
      NS.__ai.tip = tip;

      if (!enabled){
        NS.__ai.director = null;
        NS.__ai.pattern = null;
        if (!attached){
          attached = true;
          tip('AI ปิดอยู่ (เปิดได้ด้วย ?ai=1) 🤖', 'neutral', { enabled:false });
        }
        return;
      }

      // enable
      NS.__ai.director = makeDirector();
      NS.__ai.pattern  = makePattern(seedStr);

      if (!attached){
        attached = true;
        tip('AI เปิดแล้ว: ปรับสปีด + แพทเทิร์นเกิดเป้า 🤖✨', 'happy', { enabled:true });
      }
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);