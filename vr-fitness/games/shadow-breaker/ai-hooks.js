/* === Shadow Breaker — AI Hooks Pack (OFF by default) ===
   A) Difficulty Director (fair adaptive, research-deterministic friendly)
   B) AI Coach micro-tips (explainable + rate-limit)
   C) Pattern Generator (seeded spawn "style")

   Usage:
   - Include before shadow-breaker.js
   - In game, call: const ai = window.SB_AI_HOOKS?.create(ctx)
   - If disabled => returns no-op hooks
*/
(function(){
  'use strict';

  // ---------- small utils ----------
  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }

  function hash32(str){
    // xfnv1a-ish
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- enable switch (OFF by default) ----------
  function isEnabled(){
    const v = (qs('ai','')||'').toLowerCase();
    return (v==='1' || v==='true' || v==='on');
  }

  // ---------- create hooks ----------
  function create(ctx){
    const enabled = isEnabled();
    if(!enabled){
      return {
        enabled:false,
        // difficulty director
        dd: { tick: ()=>({}), apply: ()=>{} },
        // coach
        coach: { maybeTip: ()=>null },
        // pattern
        pattern: { pick: ()=>({ kind:'random' }), nextXY: null },
      };
    }

    const gameId = ctx?.gameId || 'shadow-breaker';
    const isResearch = !!ctx?.isResearch;

    // Deterministic seed when research: prefer seed/studyId; else Date.now ok
    const seedStr =
      (ctx?.seed && String(ctx.seed).trim()) ||
      (ctx?.studyId && String(ctx.studyId).trim()) ||
      (isResearch ? 'research-default-seed' : String(Date.now()));

    const seed = hash32(seedStr + '|' + gameId + '|AI');
    const rnd = mulberry32(seed);

    // ---------- internal state for prediction ----------
    const st = {
      // EMAs (0..1)
      hitRate: 0.5,
      missRate: 0.5,
      // proxy reaction: faster hits => better
      speed: 0.5,
      // streaks
      missStreak: 0,
      hitStreak: 0,
      // last update time
      lastTs: 0,

      // difficulty controls
      // (we return small deltas; game chooses how to apply)
      ddLevel: 0.0, // -1..+1
      lastDecisionAt: 0,

      // coach
      lastTipAt: 0,
      tipCooldownMs: 3500,
    };

    function updateEma(prev, x, a){ return prev + a*(x - prev); }

    // A) Difficulty Director
    // Predict "risk of fail soon" from: missStreak + recent missRate + low speed
    function ddTick(snapshot){
      const now = snapshot?.now || performance.now();

      // decision every 1s
      if(now - st.lastDecisionAt < 1000) return { changed:false };
      st.lastDecisionAt = now;

      const missRisk =
        clamp(0.35*st.missRate + 0.35*(1-st.speed) + 0.30*clamp(st.missStreak/5,0,1), 0, 1);

      const flowGood =
        clamp(0.50*st.hitRate + 0.30*st.speed + 0.20*clamp(st.hitStreak/6,0,1), 0, 1);

      // ddLevel: negative => ease, positive => harder
      let target = 0;
      if(missRisk > 0.62) target = -0.35;     // ease
      else if(flowGood > 0.72) target = +0.25; // harder
      else target = 0;                         // steady

      // smooth
      st.ddLevel = st.ddLevel + 0.35*(target - st.ddLevel);

      // suggested knobs (small deltas)
      // spawnMs multiplier: ease => slower spawns, hard => faster
      const spawnMul = clamp(1 - (st.ddLevel*0.18), 0.78, 1.28);
      // target size multiplier: ease => bigger, hard => smaller
      const sizeMul  = clamp(1 - (st.ddLevel*0.10), 0.88, 1.14);
      // boss hp delta: ease => -hp, hard => +hp (bounded)
      const bossHpDelta = Math.round(st.ddLevel * 1); // -1..+1 typically

      return {
        changed:true,
        ddLevel: st.ddLevel,
        // “prediction” outputs (explainable)
        pred: { missRisk: +missRisk.toFixed(3), flowGood: +flowGood.toFixed(3) },
        // suggested controls
        control: { spawnMul, sizeMul, bossHpDelta }
      };
    }

    // call on events from game
    function onHit(info){
      // speed proxy: if deltaMs small => good
      const dt = clamp(info?.dtMs ?? 600, 120, 1800);
      const speed = clamp(1 - ((dt-120)/(1800-120)), 0, 1); // 1=fast

      st.hitRate = updateEma(st.hitRate, 1, 0.08);
      st.missRate = updateEma(st.missRate, 0, 0.08);
      st.speed = updateEma(st.speed, speed, 0.10);

      st.hitStreak++;
      st.missStreak = 0;
    }
    function onMiss(){
      st.hitRate = updateEma(st.hitRate, 0, 0.08);
      st.missRate = updateEma(st.missRate, 1, 0.08);
      st.speed = updateEma(st.speed, 0.45, 0.04);

      st.missStreak++;
      st.hitStreak = 0;
    }

    // B) AI Coach micro-tips (rate-limited + explainable)
    function maybeTip(snapshot){
      const now = snapshot?.now || performance.now();
      if(now - st.lastTipAt < st.tipCooldownMs) return null;

      // only tip when clear signal
      const missRisk = clamp(0.35*st.missRate + 0.35*(1-st.speed) + 0.30*clamp(st.missStreak/5,0,1), 0, 1);

      let tip = null;
      if(st.missStreak >= 3){
        tip = { kind:'recover', textTH:'ช้าลงนิดนึงก่อน แล้วค่อยเร่ง! เน้นโดนต่อเนื่อง 3 ครั้ง', textEN:'Slow a bit, get 3 clean hits, then speed up.' };
      }else if(missRisk > 0.62){
        tip = { kind:'aim', textTH:'เล็ง “กลางจอ” แล้วค่อยแตะ/ยิง (อย่าไล่ตามเป้าเร็วเกิน)', textEN:'Aim center first, then tap/shoot. Don’t chase too hard.' };
      }else if(st.hitStreak >= 6){
        tip = { kind:'challenge', textTH:'ฟอร์มดีมาก! ลองทำคอมโบยาว ๆ ต่อเลย 🔥', textEN:'Great flow! Go for a longer combo 🔥' };
      }

      if(!tip) return null;

      st.lastTipAt = now;
      // explainable signals for research logs (optional)
      tip.explain = {
        missStreak: st.missStreak,
        hitStreak: st.hitStreak,
        hitRate: +st.hitRate.toFixed(2),
        missRate:+st.missRate.toFixed(2),
        speed:   +st.speed.toFixed(2)
      };
      return tip;
    }

    // C) Pattern Generator (seeded “feel”)
    const patterns = ['random','sweep','cluster','zigzag'];
    const picked = patterns[Math.floor(rnd()*patterns.length)] || 'random';

    // optional XY generator (game may ignore)
    let sweepT = 0;
    function nextXY(rect, size){
      // return normalized 0..1
      const pad = 0.06;
      const w = rect?.width || 1, h = rect?.height || 1;
      const nx = (picked==='sweep')
        ? (pad + (1-2*pad)*((Math.sin((sweepT+=0.22))+1)/2))
        : (pad + (1-2*pad)*rnd());
      const ny = (picked==='zigzag')
        ? (pad + (1-2*pad)*((Math.cos((sweepT+=0.24))+1)/2))
        : (pad + (1-2*pad)*rnd());
      // cluster: keep close-ish
      const cx = 0.5, cy = 0.55;
      const kx = (picked==='cluster') ? (cx + (rnd()-0.5)*0.22) : nx;
      const ky = (picked==='cluster') ? (cy + (rnd()-0.5)*0.22) : ny;
      return { nx: clamp(kx, pad, 1-pad), ny: clamp(ky, pad, 1-pad) };
    }

    return {
      enabled:true,
      pattern: { pick: ()=>({ kind:picked, seed: seedStr }), nextXY },
      coach: { maybeTip },
      dd: {
        tick: ddTick,
        onHit,
        onMiss
      }
    };
  }

  window.SB_AI_HOOKS = { create };
})();