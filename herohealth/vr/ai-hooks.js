// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (default OFF in study/research)
// Provides: window.HHA_AI = { init(), emit(), tip(), pattern(), difficulty() }
// - Deterministic-friendly: uses provided seed + runMode gating
// - Rate-limited micro tips
// - Pure hooks: does NOT force gameplay; only suggests + emits events (hha:ai)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function nowMs(){ return (WIN.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
  }

  // simple seeded rng for deterministic plans (mulberry32)
  function mulberry32(seed){
    let t = (seed >>> 0) || 1;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const H = {
    game: 'unknown',
    runMode: 'play',
    diff: 'normal',
    seed: 1,
    enabled: true,         // overall AI hooks (play default true, study default false)
    coachEnabled: true,
    difficultyEnabled: true,
    patternEnabled: true,

    tipCooldownMs: 6500,
    lastTipMs: 0,

    rng: mulberry32(1),
    _inited: false,
  };

  function init(cfg){
    cfg = cfg || {};
    H.game = cfg.game || H.game;
    H.runMode = cfg.runMode || H.runMode;
    H.diff = cfg.diff || H.diff;
    H.seed = Number(cfg.seed)||H.seed;

    // default gating: OFF for study/research unless explicitly enabled
    const isStudy = (String(H.runMode).toLowerCase() === 'study' || String(H.runMode).toLowerCase() === 'research');
    const defaultEnabled = !isStudy;

    H.enabled = (cfg.enabled != null) ? !!cfg.enabled : defaultEnabled;
    H.coachEnabled = (cfg.coachEnabled != null) ? !!cfg.coachEnabled : defaultEnabled;
    H.difficultyEnabled = (cfg.difficultyEnabled != null) ? !!cfg.difficultyEnabled : defaultEnabled;
    H.patternEnabled = (cfg.patternEnabled != null) ? !!cfg.patternEnabled : true; // allow plans in study too (safe)

    H.tipCooldownMs = clamp(cfg.tipCooldownMs || H.tipCooldownMs, 1500, 20000);
    H.lastTipMs = 0;

    H.rng = mulberry32(H.seed);

    H._inited = true;
    emit('hha:ai', { game:H.game, type:'init', runMode:H.runMode, diff:H.diff, seed:H.seed,
      enabled:H.enabled, coachEnabled:H.coachEnabled, difficultyEnabled:H.difficultyEnabled, patternEnabled:H.patternEnabled
    });
  }

  function aiEmit(type, data){
    if(!H._inited) init({});
    emit('hha:ai', { game:H.game, type, ...(data||{}) });
  }

  // ---------------- AI Coach micro tips (rate-limited) ----------------
  function tip(key, msg, mood, extra){
    if(!H._inited) init({});
    if(!H.enabled || !H.coachEnabled) return false;

    const t = nowMs();
    if(t - H.lastTipMs < H.tipCooldownMs) return false;
    H.lastTipMs = t;

    aiEmit('coach-tip', { key, msg, mood: mood||'neutral', ...(extra||{}) });

    // also emit a generic coach event so game can show it easily
    emit('hha:coach', { game:H.game, msg, mood: mood||'neutral', key });
    return true;
  }

  // ---------------- Difficulty Director (suggest only) ----------------
  // This returns "suggested" multipliers and rationale. Game may apply or ignore.
  function difficulty(signal){
    if(!H._inited) init({});
    if(!H.enabled || !H.difficultyEnabled) return null;

    signal = signal || {};
    const acc = clamp(signal.acc || 0, 0, 100);
    const miss = clamp(signal.miss || 0, 0, 999);
    const fever = clamp(signal.fever || 0, 0, 100);
    const rtAvg = clamp(signal.rtAvg || 800, 100, 4000);

    // Fair + smooth: small steps only
    let sizeMul = 1.0;
    if(acc < 65) sizeMul = 1.12;
    else if(acc < 75) sizeMul = 1.06;
    else if(acc > 92) sizeMul = 0.94;
    else if(acc > 86) sizeMul = 0.97;

    let spawnMul = 1.0;
    if(acc > 90 && rtAvg < 520 && miss <= 2) spawnMul = 1.08;
    else if(acc < 68 || miss >= 7) spawnMul = 0.92;

    let junkMul = 1.0;
    if(acc > 90 && miss <= 2) junkMul = 1.06;
    else if(acc < 70 || fever >= 85) junkMul = 0.93;

    // Fever safety: bias towards stability
    if(fever >= 85){
      spawnMul = Math.min(spawnMul, 1.0);
      junkMul  = Math.min(junkMul, 1.0);
      sizeMul  = Math.max(sizeMul, 1.0);
    }

    const sug = {
      sizeMul: clamp(sizeMul, 0.90, 1.18),
      spawnMul: clamp(spawnMul, 0.85, 1.12),
      junkMul: clamp(junkMul, 0.90, 1.12),
    };

    const rationale = {
      acc, miss, fever, rtAvg,
      why: (fever>=85) ? 'fever-safety' :
           (acc<70) ? 'assist-accuracy' :
           (acc>90 && rtAvg<520) ? 'challenge-skill' : 'steady'
    };

    aiEmit('difficulty-suggest', { suggest: sug, rationale });
    return { suggest: sug, rationale };
  }

  // ---------------- Pattern Generator (seeded plan) ----------------
  // Emits plans for storm/boss/spawn sequences; game can optionally adopt.
  function pattern(mode, ctx){
    if(!H._inited) init({});
    if(!H.patternEnabled) return null;

    ctx = ctx || {};
    const rng = mulberry32((Number(ctx.seed)||H.seed) ^ 0x9E3779B9);

    const plan = { mode, seed: Number(ctx.seed)||H.seed, steps: [] };

    if(mode === 'storm'){
      const cycles = clamp(ctx.cyclesPlanned || 3, 1, 5);
      for(let i=0;i<cycles;i++){
        plan.steps.push({
          cycle: i+1,
          atSec: (ctx.marks && ctx.marks[i]) ? ctx.marks[i] : Math.round(18 + i*22 + rng()*6),
          needGood: clamp(Math.round((ctx.baseNeedGood||9) + rng()*2), 8, 12),
          durationSec: clamp(Math.round((ctx.baseDuration||7) + rng()*1), 6, 9),
          forbidJunk: !!ctx.forbidJunk
        });
      }
    } else if(mode === 'boss'){
      plan.steps.push({
        atSec: Math.round(ctx.atSec || 55),
        needGood: clamp(ctx.needGood || 9, 7, 12),
        durationSec: clamp(ctx.durationSec || 10, 8, 14),
        forbidJunk: true
      });
    } else if(mode === 'spawn'){
      // spawn rhythm hints (non-binding)
      const blocks = clamp(ctx.blocks || 4, 1, 8);
      for(let i=0;i<blocks;i++){
        plan.steps.push({
          block:i+1,
          secFrom: Math.round((ctx.secFrom||0) + i*(ctx.blockLen||18)),
          secTo: Math.round((ctx.secFrom||0) + (i+1)*(ctx.blockLen||18)),
          bias: (rng()<0.5) ? 'good-streak' : 'mixed',
          note: 'hint-only'
        });
      }
    }

    aiEmit('pattern-plan', { plan });
    return plan;
  }

  WIN.HHA_AI = {
    init,
    emit: aiEmit,
    tip,
    difficulty,
    pattern
  };

})();