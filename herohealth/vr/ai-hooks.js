// === /herohealth/vr/ai-hooks.js ===
// HeroHealth — AI Hooks (OFF by default)
// Purpose: provide deterministic + audit-friendly hook points for:
// 1) Difficulty Director (adaptive fairness)
// 2) Coach Micro-tips (explainable + rate limit)
// 3) Pattern Generator (spawn/boss/storm patterns) seeded
//
// ✅ Default: ALL disabled unless explicitly enabled
// ✅ Research mode: FORCE deterministic + adaptive OFF (unless explicitly override)
// ✅ Emits optional hha:ai event for logging/audit

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

// -------- deterministic RNG --------
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
    return (x>>>0) / 4294967296;
  };
}

// -------- core factory --------
export function createAIHooks(opts={}){
  const game = String(opts.game || qs('gameMode','game') || 'game');
  const runMode = String(opts.runMode || qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const isResearch = (runMode === 'research' || runMode === 'study');

  // master switches (URL can override)
  // ai=off/on/auto
  // aiDirector=off/on
  // aiCoach=off/on
  // aiPattern=off/on
  const aiQ = String(qs('ai','auto')).toLowerCase();
  const dirQ = String(qs('aiDirector','auto')).toLowerCase();
  const coachQ = String(qs('aiCoach','auto')).toLowerCase();
  const patQ = String(qs('aiPattern','auto')).toLowerCase();

  function qOn(v){
    return (v==='on'||v==='1'||v==='true'||v==='yes');
  }
  function qOff(v){
    return (v==='off'||v==='0'||v==='false'||v==='no');
  }

  // defaults: all off, but allow "ai=on" to enable (except research forces adaptive off)
  const enabledMaster =
    qOn(aiQ) ? true :
    qOff(aiQ) ? false :
    false; // auto => off (safe)

  const enabledDirector =
    qOn(dirQ) ? true :
    qOff(dirQ) ? false :
    enabledMaster;

  const enabledCoach =
    qOn(coachQ) ? true :
    qOff(coachQ) ? false :
    enabledMaster;

  const enabledPattern =
    qOn(patQ) ? true :
    qOff(patQ) ? false :
    enabledMaster;

  // deterministic seed: prefer explicit seed param
  const seed = String(opts.seed || qs('seed', qs('sessionId', qs('studentKey','')) + '|' + qs('ts', Date.now())));

  // Research: force director OFF unless explicitly forced on (still deterministic)
  const directorActive = isResearch ? qOn(dirQ) : enabledDirector;
  const coachActive    = enabledCoach;   // coach tips can be allowed in play; in research you might keep off via URL
  const patternActive  = enabledPattern;

  // internal RNG for pattern decisions (separate stream)
  const rng = makeRng(`${seed}|aihooks|${game}`);

  // State snapshot for audit
  const H = {
    game, runMode, isResearch,
    seed,
    enabled: {
      master: enabledMaster,
      director: directorActive,
      coach: coachActive,
      pattern: patternActive
    },
    director: {
      // difficulty scalar: 0..1 (0 easy -> 1 hard)
      k: clamp(Number(opts.k ?? 0.5), 0, 1),
      // smoothing
      emaSkill: 0.45
    },
    coach: {
      lastTipAt: 0,
      cooldownMs: clamp(Number(opts.cooldownMs ?? 3000), 800, 20000),
      maxPerRun: clamp(Number(opts.maxTips ?? 12), 0, 50),
      sent: 0
    },
    pattern: {
      // you can store phase indexes etc.
      stormPhase: 0,
      bossPhase: 0
    },
    last: {
      t: 0,
      metrics: null
    }
  };

  function audit(type, data){
    emit('hha:ai', {
      game: H.game,
      runMode: H.runMode,
      seed: H.seed,
      type,
      data
    });
  }

  // ---------- Difficulty Director ----------
  // Input: metrics -> output suggested tuning scalars
  function directorSuggest(metrics){
    if (!H.enabled.director) return null;

    // skill: 0..1, frustration: 0..1, fatigue: 0..1
    const skill = clamp(metrics?.skill ?? 0.5, 0, 1);
    const frustration = clamp(metrics?.frustration ?? 0.3, 0, 1);
    const fatigue = clamp(metrics?.fatigue ?? 0.2, 0, 1);

    // smoothing skill
    H.director.emaSkill = H.director.emaSkill*0.88 + skill*0.12;

    // fairness rule: don’t ramp hard when frustration high or fatigue high
    let targetK = H.director.emaSkill;              // base by skill
    targetK -= 0.30*frustration;
    targetK -= 0.18*fatigue;
    targetK = clamp(targetK, 0, 1);

    // ease-in/out
    H.director.k = H.director.k*0.90 + targetK*0.10;

    // translate to concrete knobs (generic)
    const out = {
      difficultyK: H.director.k,                   // 0..1
      spawnMul: clamp(1.00 + (H.director.k-0.5)*0.35, 0.82, 1.22),
      sizeMul:  clamp(1.00 - (H.director.k-0.5)*0.28, 0.82, 1.20),
      badMul:   clamp(1.00 + (H.director.k-0.5)*0.30, 0.80, 1.25),
      aimAssistMul: clamp(1.00 - (H.director.k-0.5)*0.25, 0.80, 1.25)
    };

    audit('director:suggest', { in:{skill,frustration,fatigue}, out });
    return out;
  }

  // ---------- Coach Micro-tips ----------
  function coachMaybeTip(metrics, rules=[]){
    if (!H.enabled.coach) return null;

    const now = performance.now();
    if (H.coach.sent >= H.coach.maxPerRun) return null;
    if (now - H.coach.lastTipAt < H.coach.cooldownMs) return null;

    // rules: array of { when:(m)=>bool, tip:{code,msg,why,action} }
    for (const r of (rules||[])){
      try{
        if (r && typeof r.when==='function' && r.when(metrics)){
          H.coach.lastTipAt = now;
          H.coach.sent++;
          const tip = r.tip || { code:'tip', msg:'Keep going', why:'', action:'' };
          audit('coach:tip', tip);
          return tip;
        }
      }catch(_){}
    }
    return null;
  }

  // ---------- Pattern Generator ----------
  // Provide deterministic decisions: next kind mix / storm schedule / boss phase etc.
  function patternPick(name, choices){
    // choices: [{w:0.5, v:'good'}, ...]
    if (!H.enabled.pattern) return null;
    const arr = Array.isArray(choices) ? choices : [];
    const sum = arr.reduce((a,c)=>a+Math.max(0,Number(c.w||0)), 0) || 1;
    let r = rng() * sum;
    for (const c of arr){
      const w = Math.max(0, Number(c.w||0));
      r -= w;
      if (r <= 0) { audit('pattern:pick', { name, v:c.v }); return c.v; }
    }
    const v = arr[arr.length-1]?.v;
    audit('pattern:pick', { name, v });
    return v;
  }

  function patternNextStorm(baseSec, jitterSec=1.0){
    if (!H.enabled.pattern) return null;
    const j = (rng()*2-1) * jitterSec;
    const v = Math.max(3, Number(baseSec||10) + j);
    audit('pattern:stormSchedule', { baseSec, jitterSec, v });
    return v;
  }

  // ---------- lifecycle ----------
  function onStart(meta={}){
    H.last.t = performance.now();
    audit('start', { meta, enabled:H.enabled });
  }
  function onUpdate(metrics={}){
    H.last.metrics = metrics;
    H.last.t = performance.now();
    return {
      director: directorSuggest(metrics),
      // coach tip is opt-in via coachMaybeTip(rules)
    };
  }
  function onEnd(summary={}){
    audit('end', { summary, coachSent:H.coach.sent, directorK:H.director.k });
  }

  return {
    meta: () => ({ game:H.game, runMode:H.runMode, isResearch:H.isResearch, seed:H.seed, enabled:H.enabled }),
    audit,
    onStart,
    onUpdate,
    onEnd,

    directorSuggest,
    coachMaybeTip,

    patternPick,
    patternNextStorm
  };
}