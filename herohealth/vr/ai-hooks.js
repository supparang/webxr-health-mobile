// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks (Universal) — seeded/deterministic, research-safe (OFF by default)
// Provides:
// - AI Director hooks: difficulty multipliers, safe fairness
// - AI Coach hooks: explainable micro-tips + rate limit
// - AI Pattern hooks: seeded RNG + patterns for spawn/aim/storm/boss (hooks only)
// Usage:
//   import { createAIHooks } from '../vr/ai-hooks.js';
//   const AI = createAIHooks({ game:'hydration', run, diff, seed, emit });
//   AI.onStart(); AI.onUpdate(metrics); AI.onEnd(summary);
//   const mods = AI.director.mods(metrics, context);  // {spawnMul, sizeMul, pBadDelta, lockPxMul...}
//   const pat  = AI.pattern.nextSpawn(context);       // {xPct,yPct} or null
//   const tip  = AI.coach.maybeTip(metrics, context); // emits hha:coach via emit (optional)

'use strict';

export function createAIHooks(opts = {}) {
  const ROOT = (typeof window !== 'undefined') ? window : globalThis;
  const DOC  = ROOT.document;

  const game = String(opts.game || 'game').toLowerCase();
  const run  = String(opts.run  || 'play').toLowerCase();     // play | research
  const diff = String(opts.diff || 'normal').toLowerCase();
  const seed = String(opts.seed || Date.now());

  const emit = (typeof opts.emit === 'function')
    ? opts.emit
    : (name, detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} };

  // -------------------- query helpers --------------------
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // -------------------- deterministic RNG --------------------
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

  // pattern rng separate (so “director tuning” doesn’t change spawn geometry)
  const rngCore    = makeRng(`AI|core|${game}|${seed}`);
  const rngPattern = makeRng(`AI|pattern|${game}|${seed}`);
  const rngCoach   = makeRng(`AI|coach|${game}|${seed}`);

  // -------------------- enable policy (IMPORTANT) --------------------
  // Default: OFF in research; OFF in play unless ai=1 or aiDirector/aiCoach/aiPattern explicitly
  const aiParam = String(qs('ai','')).toLowerCase(); // 1 | 0 | on/off
  const forceAi = String(qs('forceAi','0')) === '1';

  const onByDefaultPlay = false;     // keep conservative
  const onByDefaultResearch = false; // ALWAYS false unless forceAi=1

  function parseOn(v){
    v = String(v ?? '').toLowerCase();
    return (v==='1' || v==='on' || v==='true' || v==='yes');
  }

  const directorParam = qs('aiDirector', '');
  const coachParam    = qs('aiCoach', '');
  const patternParam  = qs('aiPattern', '');

  const baseEnabled = (run === 'research')
    ? (forceAi ? (parseOn(aiParam) || parseOn(directorParam) || parseOn(coachParam) || parseOn(patternParam) || true) : onByDefaultResearch)
    : (parseOn(aiParam) ? true : onByDefaultPlay);

  // Each module can be enabled separately even if baseEnabled false (if explicitly on)
  const enabledDirector = baseEnabled && (directorParam==='' ? true : parseOn(directorParam));
  const enabledCoach    = baseEnabled && (coachParam===''    ? true : parseOn(coachParam));
  const enabledPattern  = baseEnabled && (patternParam===''  ? true : parseOn(patternParam));

  // hard safety: in research, if not forceAi then EVERYTHING OFF
  const hardOffResearch = (run === 'research' && !forceAi);
  const E = {
    base: baseEnabled && !hardOffResearch,
    director: enabledDirector && !hardOffResearch,
    coach: enabledCoach && !hardOffResearch,
    pattern: enabledPattern && !hardOffResearch
  };

  // -------------------- public config (tweakable) --------------------
  const CFG = {
    // Director intensity caps (keep fair, no spikes)
    directorMaxSpawnMulUp: 1.18,   // faster spawns (harder) cap
    directorMaxSpawnMulDn: 0.78,   // slower spawns (easier) cap
    directorMaxSizeMulUp:  1.16,   // bigger targets (easier) cap
    directorMaxSizeMulDn:  0.86,   // smaller targets (harder) cap
    directorMaxBadDelta:   0.10,   // add/remove bad probability
    directorMaxLockPxMul:  1.22,   // aim assist leniency up
    directorMinLockPxMul:  0.86,   // aim assist stricter down

    // Coach limits
    coachCooldownMs: 3200,
    coachBurstLimit: 2,        // max tips quickly
    coachBurstWindowMs: 14000,

    // Pattern defaults
    patternMode: String(qs('pattern','')) || 'softgrid', // softgrid | ring | chaos | centerPressure
    patternBiasSafe: 0.65,     // bias away from extreme edges
    patternLockDuringStorm: true
  };

  // -------------------- internal state --------------------
  const STATE = {
    started:false,
    t0:0,
    last:0,

    // rolling skill/fatigue/frustration (deterministic update)
    emaSkill: 0.45,
    emaFrustration: 0.25,
    emaFatigue: 0.10,

    // Coach rate limiting
    lastTipAt: 0,
    burst: [],

    // Pattern step
    step: 0,

    // Director smoothing
    lastMods: { spawnMul:1, sizeMul:1, pBadDelta:0, lockPxMul:1 }
  };

  function nowMs(){ return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function logAI(type, detail){
    // Lightweight debug event (optional)
    emit('hha:ai', { type, game, run, diff, seed, ...detail });
  }

  // -------------------- AI Director (HOOKS) --------------------
  const director = {
    enabled: E.director,

    // Return difficulty modifiers; game decides how to apply
    // metrics: {skill,fatigue,frustration,accuracy,combo,misses,inStorm,inEndWindow,...}
    mods(metrics={}, ctx={}){
      if (!E.director) return { spawnMul:1, sizeMul:1, pBadDelta:0, lockPxMul:1 };

      const skill = clamp(metrics.skill ?? metrics.skillK ?? 0.45, 0, 1);
      const fat   = clamp(metrics.fatigue ?? 0.1, 0, 1);
      const frus  = clamp(metrics.frustration ?? 0.2, 0, 1);

      // smooth (deterministic)
      STATE.emaSkill = STATE.emaSkill*0.88 + skill*0.12;
      STATE.emaFatigue = STATE.emaFatigue*0.92 + fat*0.08;
      STATE.emaFrustration = STATE.emaFrustration*0.88 + frus*0.12;

      // target “flow”:
      // - high skill => harder slowly (spawn faster, size smaller, more bad)
      // - high frustration => ease up quickly (spawn slower, size bigger, less bad, aim lenient)
      const kHard = clamp(STATE.emaSkill - 0.50, -0.25, 0.25) / 0.25;     // -1..+1
      const kEase = clamp(STATE.emaFrustration - 0.35, 0, 0.65) / 0.65;  // 0..1
      const kFat  = clamp(STATE.emaFatigue - 0.55, 0, 0.45) / 0.45;      // 0..1

      // spawnMul: >1 harder, <1 easier
      let spawnMul = 1 + (0.10*kHard) - (0.18*kEase) - (0.10*kFat);
      // sizeMul: >1 easier, <1 harder
      let sizeMul  = 1 - (0.08*kHard) + (0.16*kEase) + (0.10*kFat);

      // bad probability delta: positive = more bad (harder)
      let pBadDelta = (0.06*kHard) - (0.10*kEase) - (0.05*kFat);

      // aim assist lockPx multiplier: >1 more lenient
      let lockPxMul = 1 - (0.06*kHard) + (0.14*kEase) + (0.08*kFat);

      // Context safety: during storm/end-window/boss => avoid huge swings
      const inStorm = !!(metrics.inStorm || ctx.inStorm);
      const inEnd   = !!(metrics.inEndWindow || ctx.inEndWindow);
      if (inStorm || inEnd){
        spawnMul = 1 + (spawnMul-1)*0.55;
        sizeMul  = 1 + (sizeMul-1)*0.55;
        pBadDelta = pBadDelta*0.55;
        lockPxMul = 1 + (lockPxMul-1)*0.55;
      }

      // clamp
      spawnMul = clamp(spawnMul, CFG.directorMaxSpawnMulDn, CFG.directorMaxSpawnMulUp);
      sizeMul  = clamp(sizeMul,  CFG.directorMaxSizeMulDn,  CFG.directorMaxSizeMulUp);
      pBadDelta= clamp(pBadDelta, -CFG.directorMaxBadDelta, CFG.directorMaxBadDelta);
      lockPxMul= clamp(lockPxMul, CFG.directorMinLockPxMul, CFG.directorMaxLockPxMul);

      // smooth output to avoid “jump”
      const s = 0.18; // blend
      const out = {
        spawnMul: STATE.lastMods.spawnMul*(1-s) + spawnMul*s,
        sizeMul:  STATE.lastMods.sizeMul *(1-s) + sizeMul *s,
        pBadDelta:STATE.lastMods.pBadDelta*(1-s) + pBadDelta*s,
        lockPxMul:STATE.lastMods.lockPxMul*(1-s) + lockPxMul*s
      };
      STATE.lastMods = out;

      // optional debug
      // logAI('director', { out, emaSkill:STATE.emaSkill, emaFrustration:STATE.emaFrustration, emaFatigue:STATE.emaFatigue });

      return out;
    }
  };

  // -------------------- AI Coach (HOOKS) --------------------
  const coach = {
    enabled: E.coach,

    // call this each frame or on significant events
    maybeTip(metrics={}, ctx={}){
      if (!E.coach) return null;

      const t = nowMs();
      const cool = CFG.coachCooldownMs;
      if (t - STATE.lastTipAt < cool) return null;

      // burst limiter
      STATE.burst = STATE.burst.filter(x => (t - x) < CFG.coachBurstWindowMs);
      if (STATE.burst.length >= CFG.coachBurstLimit) return null;

      const acc = clamp(metrics.accuracy ?? metrics.accuracyGoodPct ?? 0, 0, 100);
      const miss = Number(metrics.misses ?? 0);
      const combo = Number(metrics.combo ?? 0);
      const inStorm = !!(metrics.inStorm || ctx.inStorm);
      const inEnd   = !!(metrics.inEndWindow || ctx.inEndWindow);

      // deterministic pick
      const r = rngCoach();

      const tips = [];

      if (acc < 55) tips.push({ code:'aim', text:'เล็งค้างนิดนึงก่อนยิง จะชัวร์ขึ้น (Accuracy จะพุ่ง)' });
      if (miss > 12) tips.push({ code:'miss', text:'MISS เยอะ: ลดการรัว + เลือกยิงเฉพาะเป้าที่ชัวร์' });
      if (combo >= 12) tips.push({ code:'combo', text:'คอมโบมาแล้ว! อย่ารัว—ยิงเป็นจังหวะเพื่อรักษา streak' });
      if (inStorm && !inEnd) tips.push({ code:'storm-prep', text:'พายุมา: เก็บ 🛡️ ไว้ก่อน แล้วค่อย BLOCK ช่วงท้าย' });
      if (inStorm && inEnd) tips.push({ code:'storm-end', text:'END WINDOW! ตอนนี้แหละ—ใช้ 🛡️ BLOCK ให้ครบ' });

      // fallback generic
      if (!tips.length) {
        tips.push({ code:'flow', text:(r<0.5 ? 'โฟกัสเป้าดี แล้วปล่อยเป้าแย่ผ่านไปบ้าง' : 'ยิงให้เป็นจังหวะ จะคุมความแม่นได้ดีกว่า') });
      }

      // pick one deterministic-ish
      const pick = tips[Math.floor(r * tips.length)];
      if (!pick) return null;

      STATE.lastTipAt = t;
      STATE.burst.push(t);

      // emit to your existing coach UI
      emit('hha:coach', {
        type:'ai-tip',
        code: pick.code,
        text: pick.text,
        explain: (pick.code==='aim')
          ? 'เหตุผล: ลดการยิงพลาด → คะแนน/คอมโบสูงขึ้น'
          : (pick.code==='storm-end')
            ? 'เหตุผล: ช่วงท้ายพายุต้อง “BLOCK” เพื่อผ่าน mini/boss'
            : 'เหตุผล: รักษา accuracy/คอมโบให้เสถียร'
      });

      return pick;
    }
  };

  // -------------------- AI Pattern Generator (HOOKS) --------------------
  // Returns suggested spawn position or pattern state; game may ignore
  const pattern = {
    enabled: E.pattern,

    // Suggest a position in percentages (0..100)
    nextSpawn(ctx={}){
      if (!E.pattern) return null;

      // lock patterns during storm if configured
      const inStorm = !!ctx.inStorm;
      if (inStorm && CFG.patternLockDuringStorm) {
        // keep it “clean”: softgrid only
        return softGrid(ctx);
      }

      const mode = String(ctx.patternMode || CFG.patternMode || 'softgrid').toLowerCase();
      if (mode === 'ring') return ring(ctx);
      if (mode === 'chaos') return chaos(ctx);
      if (mode === 'centerpressure') return centerPressure(ctx);
      return softGrid(ctx);
    }
  };

  function softGrid(ctx){
    // 3x3-ish but softened by RNG; avoids edges
    const step = (STATE.step++ % 9);
    const gx = (step % 3);
    const gy = Math.floor(step / 3);

    const baseX = (gx + 0.5) / 3; // 0.166..0.833
    const baseY = (gy + 0.5) / 3;

    // jitter
    const jx = (rngPattern()*2-1) * 0.10;
    const jy = (rngPattern()*2-1) * 0.10;

    let x = baseX + jx;
    let y = baseY + jy;

    // bias away from edges
    const b = CFG.patternBiasSafe;
    x = b*x + (1-b)*0.5;
    y = b*y + (1-b)*0.5;

    return { xPct: clamp(x*100, 8, 92), yPct: clamp(y*100, 10, 90) };
  }

  function ring(ctx){
    const cx = 0.5, cy = 0.52;
    const t = rngPattern() * Math.PI * 2;
    const rad = 0.18 + rngPattern()*0.18;
    const x = cx + Math.cos(t)*rad;
    const y = cy + Math.sin(t)*rad;
    return { xPct: clamp(x*100, 6, 94), yPct: clamp(y*100, 10, 90) };
  }

  function chaos(ctx){
    const x = 0.12 + rngPattern()*0.76;
    const y = 0.14 + rngPattern()*0.72;
    return { xPct: x*100, yPct: y*100 };
  }

  function centerPressure(ctx){
    // push spawns toward center when player struggling, else spread
    const struggle = clamp(ctx.frustration ?? 0.0, 0, 1);
    const spread = 0.36 - 0.18*struggle; // struggling => tighter
    const x = 0.5 + (rngPattern()*2-1)*spread;
    const y = 0.52 + (rngPattern()*2-1)*spread;
    return { xPct: clamp(x*100, 10, 90), yPct: clamp(y*100, 12, 88) };
  }

  // -------------------- lifecycle --------------------
  function onStart(){
    STATE.started = true;
    STATE.t0 = nowMs();
    STATE.last = STATE.t0;
    logAI('ai-hooks-ready', { enabled:E, cfg:CFG });
  }

  function onUpdate(metrics={}, ctx={}){
    if (!STATE.started) return;
    // coach optional (rate-limited)
    coach.maybeTip(metrics, ctx);
    // director is pull-based (game calls mods when needed)
  }

  function onEnd(summary={}){
    // optional
    logAI('ai-end', { summary: { grade:summary.grade, score:summary.scoreFinal, misses:summary.misses } });
  }

  return {
    game, run, diff, seed,
    enabled: E,
    config: CFG,
    rng: { core:rngCore, pattern:rngPattern, coach:rngCoach },
    director,
    coach,
    pattern,
    onStart,
    onUpdate,
    onEnd,
    _debug: { STATE }
  };
}