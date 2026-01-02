// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — standard plug points (OFF by default, esp. research)
// Supports:
//  (1) AI Difficulty Director (fair, smooth)
//  (2) AI Coach micro-tips (rate-limited, explainable)
//  (3) AI Pattern Generator (seeded/deterministic)
// Notes:
//  - Default: DISABLED unless ai=1 AND run!=research
//  - In research: always OFF unless ai=force (explicit)

// API:
//   const AI = createAIHooks({ game, run, diff, seed, emit })
//   AI.enabled -> boolean
//   AI.flags -> { director, coach, pattern }
//   AI.onStart({ getState, getTune })
//   AI.onUpdate({ dt, stateSnapshot, tuneSnapshot })
//   AI.onEvent(name, detail)  // forward important events
//   AI.applyDirector({ propose }) -> director suggestions (not auto-apply unless you call propose.apply())
//   AI.applyPattern({ propose }) -> pattern suggestions
//   AI.getCoachTip(stateSnapshot) -> optional tip string (rate-limited)
//   AI.debug() -> current AI internal values

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function hashStr(s){
  s=String(s||''); let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function makeRng(seedStr){
  let x = hashStr(seedStr) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0)/4294967296;
  };
}

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
}

function parseBool(v, def=false){
  if (v==null) return def;
  const s=String(v).toLowerCase();
  if (s==='1'||s==='true'||s==='yes'||s==='on') return true;
  if (s==='0'||s==='false'||s==='no'||s==='off') return false;
  return def;
}

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'game');
  const run  = String(opts.run  || 'play').toLowerCase();
  const diff = String(opts.diff || 'normal').toLowerCase();
  const seed = String(opts.seed || Date.now());

  const emit = (typeof opts.emit === 'function') ? opts.emit : (name, detail)=>{
    try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  };

  // ---- Flags (default OFF) ----
  // ai=1 enables in play; research stays OFF unless ai=force
  const aiParam = String(qs('ai', qs('aiHooks','')) || '');
  const force = (aiParam.toLowerCase()==='force');

  const enabledDefault =
    (force && aiParam) ? true :
    (parseBool(aiParam, false) && run !== 'research');

  const flags = {
    director: enabledDefault && parseBool(qs('aiDiff', '1'), true),
    coach:    enabledDefault && parseBool(qs('aiCoach','1'), true),
    pattern:  enabledDefault && parseBool(qs('aiPattern','1'), true),
  };

  const enabled = !!(flags.director || flags.coach || flags.pattern);

  // Seeded RNG for pattern/director choices (deterministic when enabled)
  const rng = makeRng(`${seed}|${game}|AIHOOKS|${run}|${diff}`);

  // ---- Internal state (kept deterministic-ish) ----
  const M = {
    started:false,
    t0:0,
    lastTipAt:0,
    tipCooldownMs: 3200,

    // director smoothing
    emaSkill: 0.45,
    emaStress: 0.25,
    emaMissRate: 0.20,
    emaAcc: 0.70,

    // pattern schedule (optional)
    patternMode: 'neutral', // neutral | pressure | recovery
    patternTimer: 0,
    nextPatternSwitchIn: 6.0,

    // last proposals
    lastDirector: null,
    lastPattern: null,
  };

  function now(){ return performance.now(); }

  function onStart(ctx = {}){
    M.started = true;
    M.t0 = now();
    M.lastTipAt = 0;
    M.patternTimer = 0;
    M.nextPatternSwitchIn = 6.0 + rng()*3.0;
    emit('hha:ai', { type:'start', game, run, diff, seed, enabled, flags });
  }

  // Explainable coach tip (rate-limited)
  function getCoachTip(s){
    if (!enabled || !flags.coach) return null;
    const t = now();
    if (t - M.lastTipAt < M.tipCooldownMs) return null;

    // Expect s includes: acc(0-1), combo, misses, inStorm, inEndWindow, waterZone, shield
    const acc = clamp(s.acc||0, 0, 1);
    const combo = (s.combo|0);
    const miss = (s.misses|0);
    const inStorm = !!s.inStorm;
    const inEnd = !!s.inEndWindow;
    const zone = String(s.waterZone||'');
    const shield = (s.shield|0);

    // Choose 1 tip with reasons (explainable)
    let tip = null;

    if (inStorm && inEnd){
      if (shield<=0) tip = `⚠️ End Window แล้ว แต่ไม่มี 🛡️ — เก็บโล่ก่อนพายุ 1–2 อัน จะ BLOCK ได้ชัวร์`;
      else tip = `✅ End Window! ตอนนี้โฟกัส BLOCK (ใช้ 🛡️) ให้ผ่าน Mini`;
    } else if (inStorm && zone==='GREEN'){
      tip = `🌀 STORM: ต้องทำให้น้ำไม่ GREEN (LOW/HIGH) ก่อน แล้วค่อยรอ End Window เพื่อ BLOCK`;
    } else if (!inStorm && shield<=0){
      tip = `🛡️ ทิป: เก็บโล่ไว้ก่อนพายุ จะผ่าน Stage2/Stage3 ง่ายขึ้น`;
    } else if (acc < 0.60){
      tip = `🎯 Accuracy ต่ำ (${Math.round(acc*100)}%) — เล็งค้างนิดเดียวแล้วค่อยยิง อย่ารัว`;
    } else if (miss >= 18){
      tip = `💥 MISS เยอะ — เลือกยิงเป้าที่ชัวร์ ลดการสุ่มยิง`;
    } else if (combo >= 10 && acc >= 0.78){
      tip = `⚡ ฟอร์มดีมาก! รักษาคอมโบยาว ๆ แล้วเกรดจะพุ่ง`;
    }

    if (!tip) return null;
    M.lastTipAt = t;
    return tip;
  }

  // Director: propose gentle tuning changes (DO NOT auto-apply unless caller applies)
  // propose({ spawnMul, sizeMul, badMul, shieldMul, reason })
  function applyDirector({ propose } = {}){
    if (!enabled || !flags.director) return null;

    // propose is callback you supply; we only compute suggestion
    // Expect snapshots from onUpdate caller
    // We'll use M.emaSkill etc. already updated in onUpdate
    const skill = clamp(M.emaSkill, 0, 1);
    const stress = clamp(M.emaStress, 0, 1);

    // Fair adaptive: if stress high -> ease; if skill high -> pressure
    let spawnMul = 1.0;
    let sizeMul  = 1.0;
    let badMul   = 1.0;
    let shieldMul= 1.0;

    if (stress > 0.72){
      spawnMul *= 1.08;  // slower
      sizeMul  *= 1.10;  // bigger
      badMul   *= 0.92;  // fewer bad
      shieldMul*= 1.12;  // slightly more shields
    } else if (skill > 0.78 && stress < 0.45){
      spawnMul *= 0.92;  // faster
      sizeMul  *= 0.94;  // smaller
      badMul   *= 1.08;  // more bad
      shieldMul*= 0.96;  // fewer shields
    } else {
      // neutral
    }

    const suggestion = {
      spawnMul: clamp(spawnMul, 0.85, 1.20),
      sizeMul:  clamp(sizeMul, 0.88, 1.18),
      badMul:   clamp(badMul,  0.85, 1.18),
      shieldMul:clamp(shieldMul,0.85, 1.25),
      reason: `director: skill=${skill.toFixed(2)} stress=${stress.toFixed(2)}`
    };

    M.lastDirector = suggestion;
    emit('hha:ai', { type:'director', ...suggestion });

    if (typeof propose === 'function') propose(suggestion);
    return suggestion;
  }

  // Pattern: propose phase flavor (pressure/recovery) to modify spawn mix temporarily
  function applyPattern({ propose } = {}){
    if (!enabled || !flags.pattern) return null;

    const suggestion = {
      mode: M.patternMode,
      // multipliers applied to probabilities (caller decides how)
      pGoodMul: (M.patternMode==='pressure') ? 0.92 : (M.patternMode==='recovery') ? 1.08 : 1.00,
      pBadMul:  (M.patternMode==='pressure') ? 1.12 : (M.patternMode==='recovery') ? 0.88 : 1.00,
      pShieldMul:(M.patternMode==='pressure')? 0.96 : (M.patternMode==='recovery') ? 1.10 : 1.00,
      reason: `pattern:${M.patternMode}`
    };

    M.lastPattern = suggestion;
    emit('hha:ai', { type:'pattern', ...suggestion });

    if (typeof propose === 'function') propose(suggestion);
    return suggestion;
  }

  // Update smoothing values using stateSnapshot
  function onUpdate(payload = {}){
    if (!enabled) return;

    const s = payload.stateSnapshot || {};
    const dt = clamp(payload.dt || 0, 0, 0.2);

    // Inputs expected in snapshot:
    //  acc(0-1), missRate(0-1), frustration(0-1), fatigue(0-1), inStorm, inEndWindow
    const acc = clamp(s.acc ?? s.accuracy ?? 0.75, 0, 1);
    const missRate = clamp(s.missRate ?? 0.15, 0, 1);
    const frustration = clamp(s.frustration ?? 0.2, 0, 1);
    const fatigue = clamp(s.fatigue ?? 0.2, 0, 1);
    const combo = clamp(s.combo ?? 0, 0, 999);

    // skill proxy
    const skill = clamp(acc*0.72 + clamp(combo/20,0,1)*0.28, 0, 1);
    const stress = clamp(frustration*0.55 + fatigue*0.25 + missRate*0.20, 0, 1);

    // EMA
    const a = clamp(dt*2.5, 0.02, 0.22);
    M.emaSkill = M.emaSkill*(1-a) + skill*a;
    M.emaStress = M.emaStress*(1-a) + stress*a;
    M.emaAcc = M.emaAcc*(1-a) + acc*a;
    M.emaMissRate = M.emaMissRate*(1-a) + missRate*a;

    // Pattern switching (seeded)
    M.patternTimer += dt;
    if (M.patternTimer >= M.nextPatternSwitchIn){
      M.patternTimer = 0;
      M.nextPatternSwitchIn = 5.5 + rng()*4.5;

      // choose mode based on stress/skill
      const r = rng();
      if (M.emaStress > 0.70){
        M.patternMode = (r<0.65) ? 'recovery' : 'neutral';
      } else if (M.emaSkill > 0.78 && M.emaStress < 0.45){
        M.patternMode = (r<0.60) ? 'pressure' : 'neutral';
      } else {
        M.patternMode = (r<0.15) ? 'pressure' : (r<0.30) ? 'recovery' : 'neutral';
      }
    }
  }

  function onEvent(name, detail){
    if (!enabled) return;
    emit('hha:ai', { type:'event', name, detail: detail||null });
  }

  function debug(){
    return {
      enabled, flags,
      emaSkill: M.emaSkill, emaStress: M.emaStress, emaAcc: M.emaAcc, emaMissRate: M.emaMissRate,
      patternMode: M.patternMode,
      lastDirector: M.lastDirector,
      lastPattern: M.lastPattern
    };
  }

  return { enabled, flags, onStart, onUpdate, onEvent, applyDirector, applyPattern, getCoachTip, debug };
}