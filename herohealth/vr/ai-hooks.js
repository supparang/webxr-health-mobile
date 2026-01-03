// === /herohealth/vr/ai-hooks.js ===
// HeroHealth — AI Hooks (OFF by default in research)
// Purpose: central "plug points" for
//  (1) AI Difficulty Director
//  (2) AI Coach micro-tips (explainable + rate-limit)
//  (3) AI Pattern Generator (seeded/deterministic)
// This file does NOT enforce AI behavior; it only offers safe hooks + config.

'use strict';

(function(root){
  const DOC = root.document;
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ----------- Deterministic RNG (seeded) -----------
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

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ----------- Mode gating -----------
  const runMode = String(qs('run', qs('runMode','play'))).toLowerCase();
  const isResearch = (runMode === 'research' || runMode === 'study');

  // Query toggles (optional)
  // ai=on/off  (master)
  // aiCoach=on/off
  // aiDiff=on/off
  // aiPattern=on/off
  const qAI = String(qs('ai','')).toLowerCase();
  const qCoach = String(qs('aiCoach','')).toLowerCase();
  const qDiff  = String(qs('aiDiff','')).toLowerCase();
  const qPat   = String(qs('aiPattern','')).toLowerCase();

  // Default policy: Research OFF unless explicitly turned on
  function boolFromQ(v, def){
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
    return def;
  }

  const masterDefault = isResearch ? false : true;
  const masterOn = boolFromQ(qAI, masterDefault);

  const coachOn = masterOn && boolFromQ(qCoach, isResearch ? false : true);
  const diffOn  = masterOn && boolFromQ(qDiff,  isResearch ? false : true);
  const patOn   = masterOn && boolFromQ(qPat,   isResearch ? false : true);

  // ----------- Shared seed ----------
  // Prefer explicit seed param; fallback to sessionId/ts; else Date.now (still stable per run via ts param)
  const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
  const ts = String(qs('ts', Date.now()));
  const seed = String(qs('seed', sessionId ? (sessionId + '|' + ts) : ts));

  const rng = makeRng(seed + '|aih');
  const rngPattern = makeRng(seed + '|pattern');

  // ----------- Coach micro-tips (rate-limit + explainable) -----------
  function createCoach(opts={}){
    const cooldownMs = clamp(opts.cooldownMs ?? 2600, 800, 15000);
    const game = String(opts.game || 'game');
    const emitFn = typeof opts.emit === 'function' ? opts.emit : emit;

    let lastAt = 0;
    let lastKey = '';

    function say(key, msg, why, extra){
      if (!coachOn) return;
      const now = performance.now();
      if (now - lastAt < cooldownMs) return;
      if (key && key === lastKey && now - lastAt < cooldownMs*1.2) return;

      lastAt = now;
      lastKey = key || '';

      emitFn('hha:ai', {
        kind:'coach',
        game,
        key: key || '',
        msg: String(msg||''),
        why: String(why||''),
        ts: Date.now(),
        ...((extra && typeof extra==='object') ? extra : {})
      });
    }

    return { say };
  }

  // ----------- Difficulty Director (returns tuning suggestions) -----------
  // It does NOT mutate engine. Engine may call director.suggest(ctx) and apply it.
  function createDifficultyDirector(opts={}){
    const game = String(opts.game || 'game');
    const emitFn = typeof opts.emit === 'function' ? opts.emit : emit;

    // Smooth skill estimate
    let emaSkill = 0.45;

    function suggest(ctx){
      if (!diffOn) return null;

      // ctx: {accuracy, combo, missesRate, fatigue, frustration, inBoss, inStorm}
      const acc = clamp(ctx.accuracy ?? 0.7, 0, 1);
      const comboK = clamp(ctx.comboK ?? 0, 0, 1);
      const missRate = clamp(ctx.missRate ?? 0, 0, 1);
      const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
      const frustr  = clamp(ctx.frustration ?? 0, 0, 1);

      // base skill
      let skill = clamp(acc*0.70 + comboK*0.30, 0, 1);

      // penalties
      skill = clamp(skill - missRate*0.25 - frustr*0.18 - fatigue*0.10, 0, 1);

      // EMA
      emaSkill = emaSkill*0.88 + skill*0.12;

      // produce suggestions in a bounded range
      const spawnMul = clamp(0.92 + emaSkill*0.28, 0.85, 1.25); // higher skill -> faster spawn
      const sizeMul  = clamp(1.15 - emaSkill*0.35, 0.75, 1.20); // higher skill -> smaller
      const badMul   = clamp(0.90 + emaSkill*0.40, 0.80, 1.40); // higher skill -> more bad pressure

      const out = {
        game,
        emaSkill,
        spawnMul,
        sizeMul,
        badMul,
        ts: Date.now()
      };

      emitFn('hha:ai', { kind:'difficulty', ...out });
      return out;
    }

    return { suggest };
  }

  // ----------- Pattern Generator (seeded) -----------
  // Optionally used by engines for spawn sequences / boss patterns / storms.
  function createPatternGenerator(opts={}){
    const game = String(opts.game || 'game');
    const emitFn = typeof opts.emit === 'function' ? opts.emit : emit;
    const prng = opts.rng || rngPattern;

    function pick(list){
      if (!patOn) return null;
      if (!Array.isArray(list) || !list.length) return null;
      return list[Math.floor(prng() * list.length)];
    }

    function chance(p){
      if (!patOn) return false;
      return prng() < clamp(p,0,1);
    }

    function nextFloat(){
      return patOn ? prng() : Math.random();
    }

    function note(tag, payload){
      if (!patOn) return;
      emitFn('hha:ai', { kind:'pattern', game, tag:String(tag||''), ts:Date.now(), ...(payload||{}) });
    }

    return { pick, chance, nextFloat, note };
  }

  // ----------- Public API -----------
  const API = {
    version: '1.0.0',
    runMode,
    isResearch,
    enabled: { master: masterOn, coach: coachOn, diff: diffOn, pattern: patOn },
    seed,

    // factories
    createCoach,
    createDifficultyDirector,
    createPatternGenerator,

    // shared deterministic rng for light usage (non-critical)
    rng
  };

  // Expose
  root.AI_HOOKS = API;
  root.HHA_AI = API; // alias

  // One-time announce
  emit('hha:ai', {
    kind:'init',
    runMode,
    isResearch,
    enabled: API.enabled,
    seed,
    ts: Date.now()
  });

})(typeof window !== 'undefined' ? window : globalThis);