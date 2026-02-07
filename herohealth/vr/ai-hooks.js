// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Seeded / Deterministic-ready)
// ✅ createAIHooks({game, runMode, diff, seed})
// ✅ getTuning(state) => { spawnMul,sizeMul,ttlMul,pBadAdd,driftMul,stormEverySec,bossMul,lockPx }
// ✅ getPattern(state) => { name, mode, params }  (seeded)
// ✅ getTip(state, recent) => { msg, why, code }
// ✅ onEvent(ev) (no-op default)
// Notes:
// - In research mode: deterministic suggestions (based on seed + counters), no adaptive randomness.
// - In play mode: adaptive but bounded, "fair" (no spikes).

(function(){
  'use strict';
  const WIN = window;

  function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }

  function makeRNG(seed){
    let x = (Number(seed) || Date.now()) >>> 0;
    return () => (x = (1664525 * x + 1013904223) >>> 0) / 4294967296;
  }

  function hashStr(s){
    s = String(s||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function normDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    return (diff==='easy'||diff==='hard') ? diff : 'normal';
  }

  // ---- Difficulty Director (lite but real)
  function computeTuning(ctx, state){
    const diff = normDiff(ctx.diff);
    const runMode = ctx.runMode;

    // skill signals
    const acc = clamp01((state.accuracyPct||0)/100);
    const combo = clamp(state.comboMax||0, 0, 50);
    const green = clamp01((state.greenHoldSec||0)/Math.max(1, state.timePlannedSec||70));
    const stormRate = (state.stormCycles>0) ? clamp01((state.stormOk||0)/state.stormCycles) : 0.7;

    // reaction estimate
    const rt = clamp(state.rtAvgMs||520, 250, 1200);
    const rtScore = clamp01((900 - rt) / 650); // faster => higher

    // composite skill (bounded)
    let skill = 0.28*acc + 0.22*rtScore + 0.18*green + 0.18*clamp01(combo/14) + 0.14*stormRate;
    skill = clamp01(skill);

    // base by diff
    const base = (diff==='easy') ? 0.90 : (diff==='hard') ? 1.12 : 1.00;

    // Play: adaptive, Research: fixed-ish (still deterministic based on state counters)
    const adapt = (runMode==='play') ? (0.88 + skill*0.38) : (0.96 + skill*0.12);

    // fairness guards: do not punish low skill too hard
    const safe = (runMode==='play') ? (0.92 + 0.10*green) : 1.0;

    let spawnMul = clamp(base*adapt*safe, 0.82, 1.35);
    let sizeMul  = clamp(1.00 - (spawnMul-1)*0.25, 0.86, 1.02);
    let ttlMul   = clamp(1.00 - (spawnMul-1)*0.18, 0.88, 1.05);

    // BAD probability shaping: more bad as skill rises, but bounded
    let pBadAdd  = clamp((skill-0.5)*0.10, -0.06, 0.08);

    // drift shaping: if player gets stuck out of green, drift helps slightly
    let driftMul = clamp(1.00 + (1-green)*0.20, 1.00, 1.18);

    // storm pacing: ensure storm appears sometimes even if player never leaves green
    // (for excitement + research events). In research, keep stable.
    let stormEverySec = (runMode==='play') ? clamp(18 - skill*6, 12, 18) : 16;

    // boss intensity
    let bossMul = clamp(0.96 + skill*0.22, 0.95, 1.20);

    // aim assist lockPx suggestion
    let lockPx = clamp(ctx.lockPx||28, 18, 46);
    if(runMode==='play' && rt>800) lockPx = clamp(lockPx+6, 18, 52);
    if(runMode==='play' && rt<380) lockPx = clamp(lockPx-2, 18, 52);

    return { spawnMul, sizeMul, ttlMul, pBadAdd, driftMul, stormEverySec, bossMul, lockPx, skill };
  }

  // ---- Pattern Generator (seeded)
  function pickPattern(ctx, state, rng){
    const phase = String(state.phase||'MAIN').toUpperCase();
    const n = state.patternIndex||0;

    // deterministic rotation
    const main = [
      {name:'sprinkle', mode:'scatter', params:{bias:'center'}},
      {name:'lane-left', mode:'lane', params:{side:'left'}},
      {name:'lane-right', mode:'lane', params:{side:'right'}},
      {name:'ring', mode:'ring', params:{radius:0.34}},
      {name:'zigzag', mode:'zigzag', params:{amp:0.28}},
    ];
    const storm = [
      {name:'storm-core', mode:'center-burst', params:{coreChance:0.16}},
      {name:'storm-ring', mode:'ring', params:{radius:0.38, coreChance:0.12}},
      {name:'storm-lanes', mode:'lane', params:{side:(rng()<0.5?'left':'right'), coreChance:0.14}},
    ];
    const boss = [
      {name:'boss-weakpoint', mode:'weakpoint', params:{weakChance:0.22}},
      {name:'boss-sweep', mode:'sweep', params:{dir:(rng()<0.5?'lr':'rl'), weakChance:0.18}},
    ];

    let list = main;
    if(phase==='STORM') list = storm;
    if(phase==='BOSS') list = boss;

    return list[n % list.length];
  }

  // ---- Coach Tips (explainable)
  function getCoachTip(ctx, state){
    // prioritize actionable, short
    const missShot = state.missShot||0;
    const missExpire = state.missExpireGood||0;
    const badHits = state.missBadHit||0;
    const zone = String(state.zone||'GREEN');
    const rt = Math.round(state.rtAvgMs||520);

    if(zone!=='GREEN' && (state.offGreenSec||0) > 2.5){
      return { msg:'หลุด GREEN นานไปแล้ว! ยิง 💧 1–2 ครั้งก่อน แล้วค่อยจัดการ 🥤', why:'เวลาหลุดโซนต้อง “ดึงกลับ” ก่อน ไม่งั้นจะยิ่งไหลออก', code:'zone_recover' };
    }
    if(missExpire >= 3){
      return { msg:'GOOD หมดเวลาเยอะ—เล็งที่เป้าใกล้กลางจอก่อน จะทันมากขึ้น', why:'มือถือ/VR เล็งกลางจอเร็วกว่า ลด GOOD expire', code:'expire_focus' };
    }
    if(missShot >= 3){
      return { msg:`ยิงพลาดบ่อย (RT~${rt}ms) ลองหยุดครึ่งจังหวะแล้วค่อยยิง จะนิ่งขึ้น`, why:'ยิงรัวทำให้ lock หลุด เป้าหลุดขอบ', code:'shot_pace' };
    }
    if(badHits >= 3){
      return { msg:'โดน 🥤 บ่อย—ถ้า Pct ใกล้ 40/70 ให้ “งดยิงสุ่ม” แล้วเลือกยิงเฉพาะ 💧', why:'ช่วงขอบโซน GREEN เสี่ยงหลุดมาก', code:'avoid_bad_edge' };
    }
    return { msg:'ฟอร์มดี! ลองคุมให้ GREEN ต่อเนื่อง แล้วเตรียมรับ STORM ให้ครบ', why:'สกิลหลักคือ “คุมโซน + คอมโบ”', code:'keep_green' };
  }

  function createAIHooks(opts){
    const ctx = Object.assign({
      game:'unknown',
      runMode:'play',
      diff:'normal',
      seed: Date.now(),
      lockPx: 28
    }, opts||{});

    const rng = makeRNG((Number(ctx.seed)||0) ^ hashStr(ctx.game));

    const api = {
      ctx,
      rng,
      getTuning: (state)=>computeTuning(ctx, state||{}),
      getPattern: (state)=>pickPattern(ctx, state||{}, rng),
      getTip: (state)=>getCoachTip(ctx, state||{}),
      onEvent: (_ev)=>{}
    };
    return api;
  }

  // expose
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = WIN.HHA.createAIHooks || createAIHooks;
})();