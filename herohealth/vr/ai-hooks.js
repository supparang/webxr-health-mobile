// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — UNIVERSAL (All games)
// Provides ONE stable integration surface for:
// (1) Difficulty Director (adaptive, fair)
// (2) AI Coach micro-tips (explainable, rate-limited)
// (3) Pattern Generator (seeded/deterministic for research)
//
// Default: ALL OFF, especially in research mode.
// Usage:
//   import { createAIHooks } from '../vr/ai-hooks.js';
//   const AI = createAIHooks({ game:'hydration', runMode, diff, seed, emit });
//   AI.onStart(ctx); AI.onTick(ctx); AI.onEvent('hit', {...}); AI.onEnd(summary);
//   const p = AI.pattern.next(); // optional for spawn/sequence

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

function hashStr(s){
  s = String(s||'');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0) / 4294967296;
  };
}

// -------- Pattern Generator (seeded) --------
function createPatternGen({ seed='seed', mode='deterministic' } = {}){
  const rng = makeRng(seed + '|' + mode);

  // A small universal “pattern contract” you can extend later.
  // next() returns suggestions; engine MAY ignore.
  let t = 0;

  function next(ctx = {}){
    // ctx can include: stage, inStorm, inBoss, skill, fatigue, frustration...
    t++;

    // deterministic but varied
    const r1 = rng();
    const r2 = rng();

    // simple suggestions:
    // - spawnBias: move odds of good/bad/shield slightly
    // - tempoMul: multiply spawn delay
    // - sizeMul: multiply target size
    const stage = Number(ctx.stage||1);
    const inStorm = !!ctx.inStorm;
    const inBoss = !!ctx.inBoss;
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);

    let spawnBias = { good:0, bad:0, shield:0 };
    let tempoMul = 1.0;
    let sizeMul = 1.0;

    // gentle “director-like” pattern, deterministic:
    if (inBoss){
      spawnBias.bad += 0.10 + 0.08*(1-skill);
      spawnBias.good -= 0.08;
      tempoMul *= 0.92 + 0.06*(1-skill);
      sizeMul  *= 0.92 + 0.08*(1-skill);
    } else if (inStorm){
      spawnBias.shield += 0.06 + 0.04*(1-skill);
      tempoMul *= 0.94 + 0.10*(1-skill);
      sizeMul  *= 0.92 + 0.10*(1-skill);
    } else if (stage >= 2){
      // stage 2-3: slightly tighter
      tempoMul *= 0.96 + 0.06*(1-skill);
      sizeMul  *= 0.95 + 0.08*(1-skill);
    }

    // micro variation so it doesn’t feel robotic
    tempoMul *= (0.985 + 0.03*(r1));
    sizeMul  *= (0.99  + 0.03*(r2));

    return {
      tick:t,
      spawnBias,
      tempoMul: clamp(tempoMul, 0.70, 1.35),
      sizeMul:  clamp(sizeMul,  0.70, 1.45),
      // reserved: ring patterns, lanes, storm density etc.
      meta:{ r1, r2 }
    };
  }

  return { next };
}

// -------- Difficulty Director (fair adaptive) --------
// NOTE: This is a HOOK layer, not “the AI” itself.
// Returns tuning suggestions; engine MAY ignore.
// MUST be OFF by default in research.
function createDifficultyDirector({ emit } = {}){
  let emaSkill = 0.45;
  let emaFrustr = 0.15;
  let lastEmitAt = 0;

  function update(ctx = {}){
    const now = performance.now();

    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const frustration = clamp(ctx.frustration ?? 0.2, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0.2, 0, 1);

    emaSkill  = emaSkill*0.90 + skill*0.10;
    emaFrustr = emaFrustr*0.88 + frustration*0.12;

    // Fairness: never “punish” too hard; smooth.
    // Suggestion knobs:
    // - tempoMul (spawn speed)
    // - sizeMul (target size)
    // - aimAssistMul (if used)
    // - badMul / shieldMul
    let tempoMul = 1.0;
    let sizeMul = 1.0;
    let badMul = 1.0;
    let shieldMul = 1.0;

    // If high frustration or fatigue => help a bit
    const help = clamp(emaFrustr*0.65 + fatigue*0.35, 0, 1);

    // If high skill => tighten a bit
    const tighten = clamp(emaSkill, 0, 1);

    // Balanced blend
    tempoMul *= (1.06 - 0.18*tighten + 0.16*help);
    sizeMul  *= (1.05 - 0.22*tighten + 0.22*help);

    // reduce bad frequency slightly when struggling
    badMul    *= (1.03 + 0.14*tighten - 0.20*help);
    shieldMul *= (0.98 + 0.10*help);

    tempoMul = clamp(tempoMul, 0.78, 1.25);
    sizeMul  = clamp(sizeMul,  0.78, 1.35);
    badMul   = clamp(badMul,   0.75, 1.25);
    shieldMul= clamp(shieldMul,0.75, 1.35);

    // optional: sparse “explainable” director message
    if (emit && (now - lastEmitAt > 5500)){
      lastEmitAt = now;
      emit('hha:ai', {
        source:'difficulty-director',
        explain: (help > 0.55) ? 'ช่วยให้เล่นลื่นขึ้นเล็กน้อย (ลดความยากชั่วคราว)' :
                 (tighten > 0.70) ? 'เพิ่มความท้าทายนิดหน่อย (คุณเล่นแม่นมาก)' :
                 'ปรับความยากแบบสมดุล',
        suggestion:{ tempoMul, sizeMul, badMul, shieldMul },
        metrics:{ emaSkill, emaFrustr, fatigue }
      });
    }

    return { tempoMul, sizeMul, badMul, shieldMul, emaSkill, emaFrustr };
  }

  return { update };
}

// -------- AI Coach micro-tips (rate-limited, explainable) --------
function createCoach({ emit } = {}){
  let lastTipAt = 0;
  let tipCount = 0;

  function maybeTip(ctx = {}){
    if (!emit) return null;
    const now = performance.now();
    const cooldownMs = clamp(ctx.cooldownMs ?? 3200, 1200, 12000);
    if (now - lastTipAt < cooldownMs) return null;

    const inStorm = !!ctx.inStorm;
    const inEndWindow = !!ctx.inEndWindow;
    const waterZone = String(ctx.waterZone||'');
    const shield = Number(ctx.shield||0);
    const acc = clamp(ctx.acc ?? 0.5, 0, 1);
    const misses = Number(ctx.misses||0);

    let msg = null;
    let why = null;

    if (inStorm && inEndWindow && shield>0){
      msg = 'ตอนนี้เป็น End Window! ใช้ 🛡️ BLOCK ให้ผ่าน mini';
      why = 'ช่วงท้ายพายุคือหน้าต่างผ่านภารกิจ (End Window)';
    } else if (inStorm && waterZone==='GREEN'){
      msg = 'พายุมาแล้ว! ทำให้น้ำ LOW/HIGH ก่อน แล้วค่อย BLOCK ท้ายพายุ';
      why = 'Storm Mini ต้องไม่อยู่ GREEN';
    } else if (shield===0 && inStorm){
      msg = 'ลองเก็บ 🛡️ ก่อนพายุ จะช่วยผ่านช่วงท้ายได้';
      why = 'Shield คือเครื่องมือผ่าน End Window/Boss Window';
    } else if (acc < 0.6){
      msg = 'เล็งนิ่ง ๆ ก่อนยิง 0.2 วิ Accuracy จะดีขึ้น';
      why = 'Accuracy ต่ำ จะดึงเกรดลงเร็ว';
    } else if (misses >= 18){
      msg = 'MISS เยอะ: ลดการรัว + เลือกยิงเป้าที่ชัวร์';
      why = 'MISS เพิ่มแรงกดดันและลดคะแนน';
    }

    if (!msg) return null;

    lastTipAt = now;
    tipCount++;

    const payload = {
      source:'ai-coach',
      msg,
      why,
      ctx: {
        inStorm, inEndWindow, waterZone, shield,
        acc: Math.round(acc*100),
        misses
      },
      tipNo: tipCount
    };

    emit('hha:coach', payload);
    emit('hha:ai', { source:'ai-coach', ...payload });
    return payload;
  }

  return { maybeTip };
}

// -------- main facade --------
export function createAIHooks(opts = {}){
  const emit = (typeof opts.emit === 'function') ? opts.emit : null;

  const game = String(opts.game||'game');
  const runMode = String(opts.runMode||'play').toLowerCase();
  const diff = String(opts.diff||'normal').toLowerCase();
  const seed = String(opts.seed||Date.now());

  // flags (default OFF)
  // research: MUST default OFF
  const isResearch = (runMode === 'research');
  const flags = {
    enableDirector: !!opts.enableDirector && !isResearch,
    enableCoach:    !!opts.enableCoach, // can allow coach in research if you want, but default false
    enablePattern:  !!opts.enablePattern // deterministic safe if you want; default false
  };

  // Optional: allow URL toggles (still OFF by default)
  // ?ai=1 enables coach in play; ?aidirector=1 enables director; ?aipattern=1 enables pattern
  try{
    const q = new URLSearchParams(location.search);
    const ai = String(q.get('ai')||'');
    const dir = String(q.get('aidirector')||'');
    const pat = String(q.get('aipattern')||'');
    if (ai === '1') flags.enableCoach = true;
    if (dir === '1' && !isResearch) flags.enableDirector = true;
    if (pat === '1') flags.enablePattern = true;
  }catch(_){}

  const pattern = createPatternGen({
    seed: seed + '|' + game + '|' + diff,
    mode: isResearch ? 'deterministic' : 'play'
  });
  const director = createDifficultyDirector({ emit: flags.enableDirector ? emit : null });
  const coach = createCoach({ emit: flags.enableCoach ? emit : null });

  let lastSuggestion = null;

  function onStart(ctx = {}){
    if (emit) emit('hha:ai', {
      source:'ai-hooks',
      event:'start',
      game, runMode, diff,
      enabled:{...flags},
      note: isResearch ? 'research mode: director default OFF' : 'play mode'
    });
  }

  function onTick(ctx = {}){
    // ctx recommended fields:
    // stage,inStorm,inEndWindow,inBoss,waterZone,shield,skill,fatigue,frustration,acc,misses,combo
    let sug = { tempoMul:1, sizeMul:1, badMul:1, shieldMul:1 };

    if (flags.enableDirector){
      const d = director.update(ctx);
      sug.tempoMul *= d.tempoMul;
      sug.sizeMul  *= d.sizeMul;
      sug.badMul   *= d.badMul;
      sug.shieldMul*= d.shieldMul;
    }

    if (flags.enablePattern){
      const p = pattern.next(ctx);
      // pattern suggestion merges
      sug.tempoMul *= (p.tempoMul || 1);
      sug.sizeMul  *= (p.sizeMul  || 1);
      // spawnBias reserved for your engine use
      sug.spawnBias = p.spawnBias;
      sug.patternTick = p.tick;
    }

    // clamp final
    sug.tempoMul = clamp(sug.tempoMul, 0.70, 1.35);
    sug.sizeMul  = clamp(sug.sizeMul,  0.70, 1.45);
    sug.badMul   = clamp(sug.badMul,   0.65, 1.40);
    sug.shieldMul= clamp(sug.shieldMul,0.65, 1.55);

    lastSuggestion = sug;

    if (flags.enableCoach){
      coach.maybeTip(ctx);
    }

    return sug;
  }

  function onEvent(name, payload = {}){
    if (!emit) return;
    // minimal schema: do not spam; call only for major events
    emit('hha:ai', {
      source:'ai-hooks',
      event:'event',
      name,
      game, runMode,
      payload
    });
  }

  function onEnd(summary = {}){
    if (!emit) return;
    emit('hha:ai', {
      source:'ai-hooks',
      event:'end',
      game, runMode,
      enabled:{...flags},
      lastSuggestion,
      summaryLite:{
        scoreFinal: summary.scoreFinal,
        grade: summary.grade,
        accuracyGoodPct: summary.accuracyGoodPct,
        misses: summary.misses,
        stageCleared: summary.stageCleared
      }
    });
  }

  return {
    flags,
    pattern,
    onStart,
    onTick,
    onEvent,
    onEnd,
    getLastSuggestion: ()=>lastSuggestion
  };
}