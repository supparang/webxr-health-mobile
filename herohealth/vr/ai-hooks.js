// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (OFF by default, deterministic-ready)
// Provides window.HHA_AI_HOOKS = { create(...) }
// Hooks: onStart, onUpdate, onSpawn, onShot, onHit, onStorm, onEnd
// Suggestions are optional. Game decides to apply.
//
// Determinism:
// - Provide rng() from seeded RNG in game (recommended)
// - No internal Math.random usage unless rng missing (then fallback)

(function (root) {
  'use strict';

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function makeEMA(alpha=0.12, init=0){
    let x = init;
    return {
      get: ()=>x,
      push: (v)=>{ x = x*(1-alpha) + v*alpha; return x; }
    };
  }

  function defaultPolicy({runMode}){
    // HARD RULE: research = OFF (unless explicitly enabled by query flag)
    // play = OFF by default but can be enabled by query/config
    return {
      enabled: false,
      allowDirector: false,
      allowPattern: false,
      allowCoach: true,     // coach tips can still run but rate-limited
      mode: runMode || 'play'
    };
  }

  function parseFlags(){
    try{
      const q = new URLSearchParams(location.search);
      const run = String(q.get('run') || q.get('runMode') || 'play').toLowerCase();
      const ai = String(q.get('ai') || '').toLowerCase(); // ai=on/off/director/pattern/coach
      const research = (run === 'research' || run === 'study');

      // Default off everywhere. In research, require ai=on explicitly.
      const baseEnabled = (!research && ai === 'on') || (research && ai === 'on');

      const allowDirector = baseEnabled && (ai === 'on' || ai === 'director');
      const allowPattern  = baseEnabled && (ai === 'on' || ai === 'pattern');
      const allowCoach    = (ai === 'on' || ai === 'coach' || ai === '') ? true : false;

      return { runMode: run, research, baseEnabled, allowDirector, allowPattern, allowCoach };
    }catch(_){
      return { runMode:'play', research:false, baseEnabled:false, allowDirector:false, allowPattern:false, allowCoach:true };
    }
  }

  function create(cfg={}){
    const flags = parseFlags();
    const policy = Object.assign(defaultPolicy({runMode: flags.runMode}), {
      enabled: !!flags.baseEnabled,
      allowDirector: !!flags.allowDirector,
      allowPattern: !!flags.allowPattern,
      allowCoach: !!flags.allowCoach
    }, cfg.policy || {});

    const rng = typeof cfg.rng === 'function' ? cfg.rng : ()=>Math.random();

    // Metrics
    const emaAcc = makeEMA(0.10, 0.55);
    const emaRt  = makeEMA(0.10, 450);
    const emaMissRate = makeEMA(0.08, 0.10);
    const emaFatigue  = makeEMA(0.05, 0.10);

    const S = {
      t0: 0,
      last: 0,
      shots: 0,
      hits: 0,
      misses: 0,
      hitRtN: 0,
      hitRtSum: 0,
      inStorm: false,
      inBoss: false,
      stage: 1
    };

    // ---- Suggestion objects (game may apply) ----
    function suggestDirector(ctx){
      // output knobs: spawnMul, sizeMul, badRateDelta, shieldRateDelta, aimLockDelta
      // keep suggestions small
      const acc = emaAcc.get();
      const rt  = emaRt.get();
      const missRate = emaMissRate.get();
      const fat = emaFatigue.get();

      // skill estimate
      const skill = clamp(acc*0.65 + clamp(1-(rt/900),0,1)*0.25 + clamp(1-missRate,0,1)*0.10, 0, 1);

      // fairness rule: when fatigue high, reduce intensity a bit
      const soften = clamp(fat*0.25, 0, 0.22);

      // director: if skill high -> harder (smaller + faster) ; if low -> easier
      const hardK = clamp((skill-0.5)*0.9, -0.35, 0.35);

      return {
        skill,
        spawnMul: clamp(1 - hardK + soften, 0.78, 1.22),
        sizeMul:  clamp(1 + hardK*0.35, 0.82, 1.18),
        badRateDelta: clamp(hardK*0.10, -0.08, 0.10),
        shieldRateDelta: clamp((-hardK)*0.06, -0.05, 0.08),
        aimLockDelta: clamp((-hardK)*6 + soften*8, -10, 12)
      };
    }

    function suggestPattern(ctx){
      // deterministic pattern hints: spawn bias ring / grid / waves
      // return pattern id + params
      const r = rng();
      const mode =
        r < 0.34 ? 'grid9' :
        r < 0.68 ? 'ring' :
        'free';

      const ringTight = clamp(0.6 + rng()*0.35, 0.55, 0.95);

      return {
        mode,
        ringTight,
        wave: clamp(rng(), 0, 1)
      };
    }

    function coachText(ctx){
      // keep it short + explainable
      const tips = [];
      if (ctx.inEndWindow && ctx.shield<=0) tips.push('เก็บ 🛡️ ก่อน End Window จะผ่าน Mini ง่ายขึ้น');
      if (ctx.acc < 0.6) tips.push('เล็งนิ่งขึ้นนิดก่อนยิง จะเพิ่ม Accuracy');
      if (ctx.misses > 10 && ctx.timeLeft < 25) tips.push('ช่วงท้ายอย่ารัวยิง เลือกเป้าชัวร์');
      if (ctx.inBoss && ctx.shield<=0) tips.push('Boss Window ต้องมี 🛡️ ไว้ BLOCK 🌩️');
      if (!tips.length) return null;
      return tips[(rng()*tips.length)|0];
    }

    // rate-limit coach
    let lastCoachAt = 0;

    function onStart(ctx){
      S.t0 = performance.now();
      S.last = S.t0;
      // reset EMAs with ctx baseline if provided
      if (ctx && typeof ctx.acc0 === 'number') emaAcc.push(clamp(ctx.acc0,0,1));
      if (ctx && typeof ctx.rt0 === 'number')  emaRt.push(clamp(ctx.rt0,80,1800));
    }

    function onUpdate(ctx){
      // ctx: {dt, acc, rt, missRate, fatigue, inStorm, inBoss, stage, ...}
      if (!ctx) return null;

      emaAcc.push(clamp(ctx.acc ?? emaAcc.get(), 0, 1));
      if (typeof ctx.rt === 'number') emaRt.push(clamp(ctx.rt, 80, 2000));
      emaMissRate.push(clamp(ctx.missRate ?? emaMissRate.get(), 0, 1));
      emaFatigue.push(clamp(ctx.fatigue ?? emaFatigue.get(), 0, 1));

      S.inStorm = !!ctx.inStorm;
      S.inBoss  = !!ctx.inBoss;
      S.stage   = ctx.stage|0;

      const out = { policy };

      // Director suggestions
      if (policy.enabled && policy.allowDirector){
        out.director = suggestDirector(ctx);
      }

      // Pattern suggestions (only when enabled)
      if (policy.enabled && policy.allowPattern){
        out.pattern = suggestPattern(ctx);
      }

      // Coach (allowed even when AI disabled, but only emits text)
      if (policy.allowCoach){
        const now = performance.now();
        if (now - lastCoachAt > (ctx.coachCooldownMs || 3200)){
          const txt = coachText({
            inEndWindow: !!ctx.inEndWindow,
            inBoss: !!ctx.inBoss,
            shield: ctx.shield|0,
            acc: clamp(ctx.acc ?? 0.7, 0, 1),
            misses: ctx.misses|0,
            timeLeft: ctx.timeLeft|0
          });
          if (txt){
            lastCoachAt = now;
            out.coach = { text: txt, type:'microtip' };
          }
        }
      }

      return out;
    }

    function onEnd(ctx){
      // final summary hook
      return {
        policy,
        stats: {
          accEma: emaAcc.get(),
          rtEma: emaRt.get(),
          missRateEma: emaMissRate.get(),
          fatigueEma: emaFatigue.get()
        }
      };
    }

    return { policy, onStart, onUpdate, onEnd };
  }

  root.HHA_AI_HOOKS = { create };

})(window);