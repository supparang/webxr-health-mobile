// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Universal plug points for all HeroHealth games
// Provides: window.HHA_AI = { cfg, rng, onEvent, onTick, get, suggest, decide, pattern }
// Default: SAFE (no-op). Research mode disables adaptive unless explicitly enabled.
//
// Usage:
// 1) Include before game safe.js (or at least before boot): <script src="../vr/ai-hooks.js" defer></script>
// 2) In game safe.js: call HHA_AI.onEvent(...), HHA_AI.onTick(...)
// 3) Ask for decisions:
//    - director: HHA_AI.decide('difficulty', {baseSpawnMs, baseSizePx, ...})
//    - pattern : HHA_AI.pattern('spawn', {t, stage, inStorm, ...})
//    - coach   : HHA_AI.suggest('tip', {state snapshot})
//
// Query flags:
// - run=research => adaptive OFF by default
// - ai=1 => enable AI (still deterministic if seed provided)
// - aiDirector=1 / aiCoach=1 / aiPattern=1 granular enable
// - seed=... deterministic RNG

'use strict';

(function(root){
  const DOC = root.document;
  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---------- Deterministic RNG ----------
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

  // ---------- Config ----------
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const seed = String(qs('seed', qs('sessionId', qs('studentKey','')) || qs('ts', Date.now())));

  const ai = String(qs('ai','')).toLowerCase();              // "1" => enable
  const aiDirector = String(qs('aiDirector','')).toLowerCase();
  const aiCoach = String(qs('aiCoach','')).toLowerCase();
  const aiPattern = String(qs('aiPattern','')).toLowerCase();

  const isResearch = (run === 'research' || run === 'study');

  // SAFE DEFAULT: in research, all off unless explicitly enabled
  const enableAll = (!isResearch) && (ai === '1' || ai === 'true');
  const enableDirector = (aiDirector === '1' || aiDirector === 'true') || enableAll;
  const enableCoach    = (aiCoach === '1' || aiCoach === 'true') || enableAll;
  const enablePattern  = (aiPattern === '1' || aiPattern === 'true') || enableAll;

  const cfg = {
    run, diff, seed, isResearch,
    enabled: enableAll || enableDirector || enableCoach || enablePattern,
    enableDirector: !!enableDirector,
    enableCoach: !!enableCoach,
    enablePattern: !!enablePattern,

    // Coach defaults
    coachCooldownMs: clamp(parseInt(qs('aiCoachCd','3000'),10)||3000, 800, 15000),
    coachExplain: String(qs('aiExplain','1')) !== '0',

    // Director bounds (safety rails)
    director: {
      spawnMulMin: 0.70,
      spawnMulMax: 1.25,
      sizeMulMin:  0.72,
      sizeMulMax:  1.18,
      jitterMulMin:0.70,
      jitterMulMax:1.30
    },

    // Pattern behavior
    pattern: {
      mode: String(qs('aiPatternMode','seeded')).toLowerCase(), // seeded | none
      // you can extend later
    }
  };

  const rng = makeRng(seed + '|HHA_AI');

  // ---------- Internal state buffer ----------
  const AI = {
    cfg, rng,

    // rolling snapshot of game signals
    state: {
      t: 0,
      lastEventAt: 0,
      events: [],
      lastTipAt: 0,
      // performance signals
      skill: 0.5,
      fatigue: 0,
      frustration: 0,
      // contextual
      stage: 1,
      inStorm: false,
      inBoss: false,
      view: String(qs('view','pc')).toLowerCase(),
      device: String(qs('device','')).toLowerCase()
    },

    // external callbacks (optional)
    handlers: {
      director: null,
      coach: null,
      pattern: null
    }
  };

  // ---------- Helpers ----------
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function pushEvent(type, payload){
    const e = { t: AI.state.t, type, ...payload };
    AI.state.events.push(e);
    if (AI.state.events.length > 120) AI.state.events.shift();
    AI.state.lastEventAt = performance.now();
  }

  // ---------- Default Director (simple, fair, bounded) ----------
  // Input: {baseSpawnMs, baseSizePx, baseJitter, inStorm, inBoss, skill, frustration, fatigue}
  // Output: {spawnMs, sizePx, jitterMs, notes}
  function defaultDirector(input){
    const d = cfg.director;
    const baseSpawn = Math.max(160, Number(input.baseSpawnMs)||600);
    const baseSize  = Math.max(28,  Number(input.baseSizePx)||64);
    const baseJit   = Math.max(0,   Number(input.baseJitter)||160);

    // If disabled => return base (no change)
    if (!cfg.enableDirector) return { spawnMs: baseSpawn, sizePx: baseSize, jitterMs: baseJit, notes:'director off' };

    const skill = clamp(Number(input.skill ?? AI.state.skill), 0, 1);
    const frus  = clamp(Number(input.frustration ?? AI.state.frustration), 0, 1);
    const fat   = clamp(Number(input.fatigue ?? AI.state.fatigue), 0, 1);

    // principle:
    // - higher skill => faster spawns, smaller targets
    // - high frustration/fatigue => ease slightly to keep flow
    let spawnMul = 1.00 - 0.30*skill + 0.15*frus + 0.10*fat;
    let sizeMul  = 1.00 - 0.22*skill + 0.18*frus + 0.10*fat;

    if (input.inStorm) { spawnMul *= 0.88; sizeMul *= 0.92; }
    if (input.inBoss)  { spawnMul *= 0.92; sizeMul *= 0.90; }

    spawnMul = clamp(spawnMul, d.spawnMulMin, d.spawnMulMax);
    sizeMul  = clamp(sizeMul,  d.sizeMulMin,  d.sizeMulMax);

    // jitter: slightly lower when frustration high (stability)
    let jitMul = 1.00 - 0.18*frus + 0.08*skill;
    jitMul = clamp(jitMul, d.jitterMulMin, d.jitterMulMax);

    return {
      spawnMs: clamp(baseSpawn*spawnMul, 180, 1500),
      sizePx:  clamp(baseSize*sizeMul,  34,  96),
      jitterMs: clamp(baseJit*jitMul, 0, 500),
      notes: `dir: skill=${skill.toFixed(2)} frus=${frus.toFixed(2)} fat=${fat.toFixed(2)}`
    };
  }

  // ---------- Default Pattern Generator (seeded) ----------
  // Returns a stable choice per tick context (does not peek future randomness beyond rng)
  function defaultPattern(key, ctx){
    if (!cfg.enablePattern) return null;
    if (cfg.pattern.mode !== 'seeded') return null;

    // Example patterns you can extend later:
    // spawn lanes, burst waves, boss timing offsets, etc.
    const r = rng();

    if (key === 'spawnKind'){
      // return deterministic bias
      // ctx: {inStorm, inBoss, diff}
      let pShield = ctx?.inStorm ? 0.10 : 0.06;
      let pBad    = ctx?.inStorm ? 0.38 : 0.28;
      if (ctx?.inBoss) { pBad += 0.10; }
      if (diff === 'hard') { pBad += 0.04; }
      pShield = clamp(pShield, 0.03, 0.18);
      pBad = clamp(pBad, 0.10, 0.70);
      const pGood = clamp(1 - (pShield + pBad), 0.15, 0.85);

      const x = r;
      if (x < pShield) return 'shield';
      if (x < pShield + pBad) return 'bad';
      return 'good';
    }

    if (key === 'spawnXYMode'){
      // seeded mode: 'centerBias' | 'uniform' | 'ring'
      const x = r;
      if (x < 0.18) return 'ring';
      if (x < 0.52) return 'centerBias';
      return 'uniform';
    }

    return null;
  }

  // ---------- Default Coach (micro tips; rate-limited) ----------
  function defaultCoach(topic, snap){
    if (!cfg.enableCoach) return null;

    const now = performance.now();
    if (now - AI.state.lastTipAt < cfg.coachCooldownMs) return null;

    const s = snap || {};
    const skill = clamp(Number(s.skill ?? AI.state.skill), 0, 1);
    const frus  = clamp(Number(s.frustration ?? AI.state.frustration), 0, 1);
    const inEnd = !!s.inEndWindow;
    const inStorm = !!s.inStorm;
    const shield = Number(s.shield||0);
    const zone = String(s.waterZone||'').toUpperCase();
    const miss = Number(s.misses||0);
    const acc  = Number(s.accuracyGoodPct||0);

    let msg=null;
    let why=null;

    if (inStorm && inEnd && shield <= 0){
      msg = '🛡️ ช่วงท้ายพายุ! เก็บ Shield ก่อน แล้วค่อย BLOCK ให้ชัวร์';
      why = 'End Window ต้อง BLOCK';
    } else if (zone === 'GREEN' && acc < 60){
      msg = '🎯 เล็งนิ่งขึ้นนิดนึง แล้วค่อยยิง 💧 เพื่อคุม GREEN';
      why = 'Accuracy ต่ำทำให้หลุด GREEN';
    } else if (miss >= 18 && frus > 0.55){
      msg = '😈 โหมดโหด: ลดการรัว เลือกยิง “เป้าชัวร์” ก่อน คอมโบจะกลับมาเอง';
      why = 'MISS เยอะทำให้เสีย flow';
    } else if (skill > 0.72 && !inStorm){
      msg = '⚡ ฟอร์มมาแล้ว! ลากคอมโบยาว ๆ แล้วค่อยเร่งตอนพายุ';
      why = 'เพิ่มคะแนนแบบปลอดภัย';
    } else {
      return null;
    }

    AI.state.lastTipAt = now;
    return { msg, why, explain: cfg.coachExplain ? why : undefined };
  }

  // ---------- Public API ----------
  function onEvent(type, payload){
    pushEvent(type, payload||{});
  }

  function onTick(snapshot){
    // snapshot should be a compact state from game per frame or per second
    // Example: {t, stage, skill, fatigue, frustration, inStorm, inBoss, ...}
    const s = snapshot || {};
    if (typeof s.t === 'number') AI.state.t = s.t;
    if (typeof s.stage === 'number') AI.state.stage = s.stage|0;
    if (typeof s.skill === 'number') AI.state.skill = clamp(s.skill,0,1);
    if (typeof s.fatigue === 'number') AI.state.fatigue = clamp(s.fatigue,0,1);
    if (typeof s.frustration === 'number') AI.state.frustration = clamp(s.frustration,0,1);
    if (typeof s.inStorm === 'boolean') AI.state.inStorm = s.inStorm;
    if (typeof s.inBoss === 'boolean') AI.state.inBoss = s.inBoss;
  }

  function decide(kind, input){
    if (kind === 'difficulty'){
      if (typeof AI.handlers.director === 'function'){
        try{ return AI.handlers.director(input||{}, AI); }catch(_){}
      }
      return defaultDirector(input||{});
    }
    return null;
  }

  function pattern(key, ctx){
    if (typeof AI.handlers.pattern === 'function'){
      try{
        const out = AI.handlers.pattern(key, ctx||{}, AI);
        if (out !== undefined) return out;
      }catch(_){}
    }
    return defaultPattern(key, ctx||{});
  }

  function suggest(topic, snapshot){
    if (typeof AI.handlers.coach === 'function'){
      try{
        const out = AI.handlers.coach(topic, snapshot||{}, AI);
        if (out) return out;
      }catch(_){}
    }
    return defaultCoach(topic, snapshot||{});
  }

  function get(){
    return {
      cfg: AI.cfg,
      state: { ...AI.state },
      events: AI.state.events.slice(-40)
    };
  }

  function setHandler(type, fn){
    if (type === 'director') AI.handlers.director = fn;
    if (type === 'coach') AI.handlers.coach = fn;
    if (type === 'pattern') AI.handlers.pattern = fn;
  }

  // expose
  root.HHA_AI = {
    cfg,
    rng,
    onEvent,
    onTick,
    decide,
    suggest,
    pattern,
    get,
    setHandler
  };

  emit('hha:ai_ready', { cfg });

})(window);