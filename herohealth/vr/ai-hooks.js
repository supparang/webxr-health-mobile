// === /herohealth/vr/ai-hooks.js ===
// HeroHealth — AI Hooks (PRODUCTION, default OFF for research)
// ✅ AI Difficulty Director (fair, smooth) — optional
// ✅ AI Coach micro-tips (explainable + rate-limit) — optional
// ✅ AI Pattern Generator (seeded) — optional
// ✅ Deterministic in study by default: ALL AI OFF unless explicitly allowed
// ✅ Emits: hha:adaptive (if director), hha:coach (if coach), hha:log (optional)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function qbool(k, def=false){
  const v = String(qs(k,'')||'').toLowerCase();
  if(!v) return !!def;
  if(['1','true','yes','y','on','enable','enabled'].includes(v)) return true;
  if(['0','false','no','n','off','disable','disabled'].includes(v)) return false;
  return !!def;
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

function softSign(x){ x=Number(x)||0; return x/(1+Math.abs(x)); }

// ------------------------- Config policy -------------------------
// Default rules (สำคัญ):
// - runMode=study => AI OFF (director/coach/pattern) unless aiStudy=1
// - runMode=play  => AI optional via ?ai=1 OR explicit flags
// - You can granularly enable: ?aidir=1&aicoach=1&aipattern=1
function resolveEnable({ runMode }){
  const isStudy = (runMode === 'study' || runMode === 'research');
  const allowStudy = qbool('aiStudy', false); // must opt-in explicitly
  const master = qbool('ai', false);

  const dir = qbool('aidir', master);
  const coach = qbool('aicoach', master);
  const pattern = qbool('aipattern', master);

  if(isStudy && !allowStudy){
    return { dir:false, coach:false, pattern:false };
  }
  return { dir, coach, pattern };
}

// ------------------------- AI Coach (micro tips) -------------------------
function createAICoach({ game='unknown', seed=1 }){
  const rng = mulberry32((seed ^ 0xC0ACh) >>> 0);
  let lastTipAt = 0;
  let coolMs = clamp(qs('coachCooldown', 2600), 900, 120000);

  function canTip(){
    const now = Date.now();
    if(now - lastTipAt < coolMs) return false;
    lastTipAt = now;
    return true;
  }

  function tip(msg, mood='neutral', why=''){
    if(!canTip()) return;
    emit('hha:coach', { game, msg, mood, why, source:'ai-coach' });
    emit('hha:log', { game, kind:'ai_tip', msg, mood, why, t:Date.now() });
  }

  // Make short, explainable tips based on state signals
  function onUpdate(state){
    // state: { acc, miss, fever, combo, rtAvg, shield, tLeftSec, miniActive, miniTimeLeft, goalKey }
    if(!state) return;

    const acc = Number(state.acc)||0;
    const miss = Number(state.miss)||0;
    const fever = Number(state.fever)||0;
    const rtAvg = Number(state.rtAvg)||0;
    const shield = Number(state.shield)||0;

    // 1) High fever
    if(fever >= 85){
      tip('🔥 FEVER สูงมาก! โฟกัส “ดี” ก่อน ลดการเสี่ยงโดนขยะ', 'fever', 'fever>=85');
      return;
    }

    // 2) Accuracy struggling
    if(acc > 0 && acc < 72 && miss >= 3){
      tip('🎯 ลอง “ช้าลงนิด” แล้วเลือกเป้าดีให้ชัวร์ (คอมโบจะกลับมาเอง)', 'sad', 'low-acc');
      return;
    }

    // 3) Great performance => push challenge
    if(acc >= 90 && rtAvg > 0 && rtAvg < 520){
      if(rng() < 0.5){
        tip('⚡ เร็วมาก! ลองเก็บ “หมู่ที่ยังขาด” แบบต่อเนื่อง 3 ตัวติด', 'happy', 'high-skill');
      }else{
        tip('😎 สวย! ต่อไปคุมไม่ให้โดนขยะเลยนะ จะได้เกรด S/SSS', 'happy', 'high-skill');
      }
      return;
    }

    // 4) Shield reminder
    if(shield >= 2 && fever >= 65){
      tip('🛡 มีโล่แล้ว! ใช้กันพลาดช่วง FEVER ได้ แต่ยังอย่าเสี่ยงเกิน', 'neutral', 'shield-remind');
      return;
    }

    // 5) Mini end window cues
    if(state.miniActive && state.miniTimeLeft != null){
      const tl = Number(state.miniTimeLeft)||0;
      if(tl <= 3.2 && tl > 0){
        tip('⏱ ใกล้หมดเวลา MINI! เลือกหมู่ที่ “ขาด” ก่อน!', 'warn', 'mini-end');
        return;
      }
    }
  }

  return { tip, onUpdate };
}

// ------------------------- AI Difficulty Director -------------------------
// Goal: keep "challenge band" fair & smooth; never abrupt.
// Output: { sizeMul, spawnMul, junkMul } (multipliers)
function createAIDirector({ seed=1 }){
  const rng = mulberry32((seed ^ 0xD1RECT0R) >>> 0);

  // internal smooth state
  let out = { sizeMul:1.0, spawnMul:1.0, junkMul:1.0 };
  let lastAt = 0;

  // aggressiveness: 0..1 (default 0.35)
  const alpha = clamp(qs('aidAlpha', 0.35), 0.05, 0.9);
  const maxStep = clamp(qs('aidStep', 0.06), 0.01, 0.20);

  function lerp(a,b,t){ return a+(b-a)*t; }
  function nudge(cur, target){
    const delta = clamp(target - cur, -maxStep, +maxStep);
    return cur + delta;
  }

  function update(state){
    // state: { acc, miss, rtAvg, fever, combo, tLeftSec }
    const now = Date.now();
    if(now - lastAt < 160) return out; // throttle
    lastAt = now;

    const acc = clamp(state?.acc ?? 0, 0, 100);
    const miss = clamp(state?.miss ?? 0, 0, 999);
    const rtAvg = clamp(state?.rtAvg ?? 800, 120, 2500);
    const fever = clamp(state?.fever ?? 0, 0, 100);

    // target band: acc 78–90, rt 520–760, miss pressure low
    // performance score p: -1..+1
    const pAcc = softSign((acc - 84) / 10);
    const pRt  = softSign((680 - rtAvg) / 220); // faster -> positive
    const pMiss= softSign((3 - miss) / 2.2);
    const pFv  = softSign((55 - fever) / 18);   // lower fever -> positive
    let p = 0.42*pAcc + 0.28*pRt + 0.20*pMiss + 0.10*pFv;
    p = clamp(p, -1, 1);

    // Convert to targets
    // If p positive => harder: smaller size, higher spawn, higher junk
    // If p negative => easier: bigger size, lower spawn, lower junk
    const tgtSize  = clamp(1.0 - p*0.10, 0.86, 1.18);
    const tgtSpawn = clamp(1.0 + p*0.14, 0.82, 1.22);
    const tgtJunk  = clamp(1.0 + p*0.10, 0.85, 1.22);

    // Smooth + step-limited
    out.sizeMul  = clamp(nudge(out.sizeMul,  lerp(out.sizeMul,  tgtSize,  alpha)),  0.84, 1.24);
    out.spawnMul = clamp(nudge(out.spawnMul, lerp(out.spawnMul, tgtSpawn, alpha)),  0.80, 1.28);
    out.junkMul  = clamp(nudge(out.junkMul,  lerp(out.junkMul,  tgtJunk,  alpha)),  0.82, 1.28);

    // Optional gentle randomness (very small) to avoid static feel (still deterministic via seed)
    if(qbool('aidJitter', true)){
      const j = (rng()-0.5) * 0.008;
      out.spawnMul = clamp(out.spawnMul + j, 0.80, 1.28);
    }

    return out;
  }

  return { update, get:()=>({ ...out }) };
}

// ------------------------- AI Pattern Generator (seeded) -------------------------
// Helps vary spawn kind distribution + “streak shaping” (still fair).
function createAIPattern({ seed=1 }){
  const rng = mulberry32((seed ^ 0xPA77ERN) >>> 0);
  let streakGood = 0;
  let streakJunk = 0;

  // call per spawn decision
  function decideKind({ baseJunkRate=0.25, fever=0, shield=0 }){
    // base junk rate modified mildly by fever
    let jr = clamp(baseJunkRate + (fever/100)*0.04, 0.08, 0.60);

    // streak shaping:
    // avoid too many junk in a row, avoid too many good in a row (keeps rhythm)
    if(streakJunk >= 2) jr *= 0.62;
    if(streakGood >= 6) jr *= 1.22;

    // shield available => can allow slightly more junk (pressure)
    if(shield >= 2) jr *= 1.06;

    jr = clamp(jr, 0.08, 0.62);

    const isJunk = rng() < jr;
    if(isJunk){ streakJunk++; streakGood = 0; }
    else { streakGood++; streakJunk = 0; }
    return isJunk ? 'junk' : 'good';
  }

  // tiny chance spawn shield when struggle
  function maybeShield({ fever=0, shield=0, isStudy=false }){
    if(isStudy) return false;
    if(shield >= 3) return false;
    const p = (fever >= 70) ? 0.06 : 0.02;
    return (rng() < p);
  }

  return { decideKind, maybeShield };
}

// ------------------------- Factory -------------------------
export function createAIHooks(opts = {}){
  const runMode = opts.runMode || 'play';
  const seed = Number(opts.seed)||1;
  const game = opts.game || 'unknown';

  const en = resolveEnable({ runMode });

  const coach = en.coach ? createAICoach({ game, seed }) : null;
  const director = en.dir ? createAIDirector({ seed }) : null;
  const pattern = en.pattern ? createAIPattern({ seed }) : null;

  function onUpdate(state){
    if(coach) coach.onUpdate(state);
  }

  function getDirectorMult(state){
    if(!director) return null;
    const m = director.update(state);
    emit('hha:adaptive', { game, source:'ai-director', adapt:{...m}, t:Date.now() });
    return m;
  }

  return {
    enabled: { ...en },
    coach,
    director,
    pattern,
    onUpdate,
    getDirectorMult
  };
}