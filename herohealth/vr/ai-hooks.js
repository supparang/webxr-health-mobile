// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Pack 1-4 (Risk Predictor + Director + Coach + Pattern Waves)
// ✅ Exposes: window.HHA.AIHooks.create(opts)
// ✅ Works with GoodJunk safe.js (calls AI.getDifficulty / AI.getTip / AI.onEvent)
// ✅ Play mode only by default; research mode => AI OFF (deterministic baseline)
// ✅ Explainable tips + rate limit
// ✅ Pattern waves (warmup/groove/rush) + boss intensifier

(function(){
  'use strict';
  const WIN = window;

  // Ensure namespace
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.AIHooks = WIN.HHA.AIHooks || {};

  // ---------------------------
  // utilities
  // ---------------------------
  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function nowMs(){ try{ return (performance && performance.now) ? performance.now() : Date.now(); }catch{ return Date.now(); } }

  // hash + rng (deterministic without consuming engine rng)
  function hashStr(s){
    s = String(s||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seedU32){
    let a = (seedU32 >>> 0) || 0x12345678;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sigmoid(x){ return 1 / (1 + Math.exp(-x)); }

  // ---------------------------
  // Risk Predictor (Pack 1)
  // ---------------------------
  function makeRiskModel(seedStr){
    // Logistic model (tiny + fast) — can be replaced by ML weights later
    // features normalized into roughly [-1..+1] bands
    const baseSeed = hashStr('HHA-RISK:' + seedStr);
    const r = mulberry32(baseSeed);

    // Start with sensible weights; add tiny deterministic jitter (so not identical across studies if desired)
    const W = {
      b: -0.8 + (r()-0.5)*0.10,
      // Higher miss/expire => higher risk
      missRate:  2.2 + (r()-0.5)*0.15,
      expireRate: 2.0 + (r()-0.5)*0.15,
      // Low accuracy => higher risk
      acc:      -2.4 + (r()-0.5)*0.15,
      // Slow RT => higher risk
      rt:        1.8 + (r()-0.5)*0.15,
      // High alive density => higher risk
      density:   1.2 + (r()-0.5)*0.12,
      // Boss phase => higher baseline risk
      boss:      0.9 + (r()-0.5)*0.08,
      // Low time => higher risk (panic)
      lowTime:   0.8 + (r()-0.5)*0.08
    };

    function score(feat){
      const x =
        W.b +
        W.missRate   * feat.missRate +
        W.expireRate * feat.expireRate +
        W.acc        * feat.acc +
        W.rt         * feat.rt +
        W.density    * feat.density +
        W.boss       * feat.boss +
        W.lowTime    * feat.lowTime;
      return sigmoid(x);
    }

    return { score, W };
  }

  // rolling stats helper (EWMA)
  function ewma(prev, val, alpha){
    if(!Number.isFinite(val)) return prev;
    if(!Number.isFinite(prev)) return val;
    return prev + alpha * (val - prev);
  }

  // ---------------------------
  // Pattern Generator (Pack 4)
  // ---------------------------
  function patternWave(playedSec, seedStr){
    // returns wave object describing intensity (0..1) + type
    // deterministic per time block
    const block = Math.floor(playedSec / 4); // 4s blocks
    const rng = mulberry32(hashStr(seedStr + ':WAVE:' + block));
    const tInBlock = (playedSec % 4) / 4;

    // schedule: warmup (0-12s), groove (12-45s), rush bursts afterwards
    let type = 'groove';
    let intensity = 0.35;

    if(playedSec < 12){
      type = 'warmup';
      intensity = 0.18 + (playedSec/12)*0.18; // ramp
    }else if(playedSec < 45){
      type = 'groove';
      intensity = 0.32 + 0.10*Math.sin(playedSec/3.8);
    }else{
      // rush chance every block
      const rush = (rng() < 0.22); // 22% blocks become rush
      if(rush){
        type = 'rush';
        // pulse in the middle of the block
        const pulse = 1 - Math.abs(tInBlock - 0.5) / 0.5; // 0..1..0
        intensity = 0.70 + 0.25*pulse;
      }else{
        type = 'groove';
        intensity = 0.42 + 0.12*Math.sin(playedSec/5.2);
      }
    }

    intensity = clamp(intensity, 0, 1);
    return { type, intensity };
  }

  // ---------------------------
  // Coach (Pack 3)
  // ---------------------------
  function makeCoach(){
    const tips = [
      { key:'expire', cause:'expire', msg:'⏱️ ของดีหายบ่อย! ลอง “ยิงทันทีที่เห็น” ก่อนคิดนานนะ', cool:7 },
      { key:'junk',   cause:'junk',   msg:'🧨 โดนของเสียติดกัน! ลอง “รอของดี” แล้วค่อยยิง ลดพลาดได้เยอะ', cool:7 },
      { key:'dense',  cause:'dense',  msg:'🎯 เป้าหนาแน่น! โฟกัส “เป้าที่ใกล้สุด” ทีละอัน จะคุมเกมง่ายขึ้น', cool:7 },
      { key:'boss',   cause:'boss',   msg:'⚡ ช่วงบอสมาแล้ว! เน้นของดีเพื่อลด HP บอส และหลบของเสีย', cool:7 },
      { key:'lowtime',cause:'lowtime',msg:'⏳ ใกล้หมดเวลา! เล็งให้ชัวร์ก่อนยิง 1 จังหวะ จะได้คะแนนพุ่ง', cool:7 },
      { key:'combo',  cause:'combo',  msg:'🔥 คอมโบกำลังมา! รักษาจังหวะเดิม แล้วคะแนนจะวิ่งแรงมาก', cool:7 }
    ];

    let lastTipAt = 0;
    let lastKey = '';

    function pick(cause){
      // avoid repeating the same key too often
      const pool = tips.filter(t=>t.cause === cause && t.key !== lastKey);
      const t = pool[0] || tips.find(t=>t.cause===cause) || null;
      return t;
    }

    function getTip(cause){
      const t = pick(cause);
      if(!t) return null;

      const now = nowMs();
      if(now - lastTipAt < (t.cool*1000)) return null;

      lastTipAt = now;
      lastKey = t.key;

      return { msg: t.msg, tag:'AI Coach', cause:t.cause };
    }

    return { getTip };
  }

  // ---------------------------
  // Difficulty Director (Pack 2)
  // ---------------------------
  function applyDirector(base, ctx){
    // ctx: {risk, wave, accEwma, rtEwma, missRateEwma, expireEwma, boss, lowTime}
    // Goal: "แฟร์" — ถ้าเสี่ยงพลาดสูง ให้ผ่อนนิด แต่ถ้าเล่นเก่งให้เร้าใจขึ้น
    const out = Object.assign({}, base);

    const risk = clamp(ctx.risk, 0, 1);
    const waveI = clamp(ctx.wave?.intensity ?? 0.35, 0, 1);
    const waveType = String(ctx.wave?.type || 'groove');

    // skill proxy: acc high + rt fast => skill high
    const skill = clamp(
      ( (ctx.accEwma ?? 0.75) - 0.70 ) * 1.8 +
      ( (0.55 - (ctx.rtEwma ?? 0.45)) ) * 1.2,
      -1, 1
    );

    // intensity target from wave + skill, reduced a bit by risk
    let intensity = waveI + (skill*0.18) - (risk*0.22);
    if(ctx.boss) intensity += 0.18;
    intensity = clamp(intensity, 0.10, 0.95);

    // spawnMs: lower = harder
    const spawnHardness = intensity; // 0.1..0.95
    out.spawnMs = clamp(
      base.spawnMs * (1.05 - 0.40*spawnHardness),
      520,
      1150
    );

    // probability shaping
    // more intensity => more junk, less good; risk => add relief via star/shield
    const relief = clamp((risk - 0.55) * 0.20, 0, 0.10); // up to +0.10 total relief
    const junkBoost = clamp(0.10*intensity + (skill>0?0.05:0) - (risk>0.65?0.06:0), -0.06, 0.18);

    out.pJunk = clamp(base.pJunk + junkBoost, 0.16, 0.58);
    out.pGood = clamp(base.pGood - junkBoost - relief*0.6, 0.34, 0.82);

    // relief split
    out.pStar   = clamp(base.pStar   + relief*0.45 + (waveType==='rush'?0.01:0), 0.01, 0.08);
    out.pShield = clamp(base.pShield + relief*0.55 + (ctx.lowTime?0.01:0), 0.01, 0.10);

    // normalize later in engine (safe.js already normalizes)
    return out;
  }

  // ---------------------------
  // CREATE entry
  // ---------------------------
  WIN.HHA.AIHooks.create = function create(opts){
    opts = opts || {};

    const run = String(opts.mode || qs('run','play')).toLowerCase();
    const enabled = (run === 'play'); // play only
    const seedStr = String(qs('seed', '') || opts.seed || 'seedless');

    const coach = makeCoach();
    const riskModel = makeRiskModel(seedStr);

    // rolling stats (EWMA)
    const S = {
      enabled: !!enabled,
      // event counters in short windows
      shots:0,
      hitGood:0,
      hitJunk:0,
      expireGood:0,

      // EWMAs
      accEwma: 0.78,        // 0..1
      rtEwma: 0.42,         // seconds
      missRateEwma: 0.10,   // 0..1
      expireEwma: 0.08,     // 0..1
      densityEwma: 0.25,    // 0..1
      lastEventAt: 0,

      // tip timing
      lastCause: '',
      boss: false,
      lowTime: false
    };

    // For RT approximation: measure time since last shoot to next judged event
    let lastShootAt = 0;
    let awaitingJudge = false;

    function updateRollingFromWindow(){
      const judged = Math.max(1, S.hitGood + S.hitJunk + S.expireGood);
      const acc = clamp(S.hitGood / judged, 0, 1);
      const missRate = clamp((S.hitJunk + S.expireGood) / judged, 0, 1);
      const expireRate = clamp(S.expireGood / judged, 0, 1);

      S.accEwma = ewma(S.accEwma, acc, 0.22);
      S.missRateEwma = ewma(S.missRateEwma, missRate, 0.22);
      S.expireEwma = ewma(S.expireEwma, expireRate, 0.22);

      // decay window counts a bit (so it keeps reacting)
      S.shots *= 0.35;
      S.hitGood *= 0.35;
      S.hitJunk *= 0.35;
      S.expireGood *= 0.35;
    }

    function computeRisk(playedSec, base){
      // features normalized
      const acc = clamp(S.accEwma, 0.2, 0.98);
      const rt = clamp(S.rtEwma, 0.12, 0.95);

      // map to centered ranges
      const feat = {
        // higher -> risk
        missRate: clamp((S.missRateEwma - 0.10) / 0.22, -1, 1),
        expireRate: clamp((S.expireEwma - 0.08) / 0.22, -1, 1),
        acc: clamp((acc - 0.80) / 0.12, -1, 1), // high acc reduces risk (negative weight)
        rt: clamp((rt - 0.38) / 0.18, -1, 1),
        density: clamp((S.densityEwma - 0.28) / 0.22, -1, 1),
        boss: S.boss ? 1 : 0,
        lowTime: S.lowTime ? 1 : 0
      };

      const risk = riskModel.score(feat);
      return clamp(risk, 0, 1);
    }

    function pickCauseForTip(risk, playedSec){
      // explainable cause selection
      if(S.boss) return 'boss';
      if(S.lowTime) return 'lowtime';

      if(S.expireEwma > 0.16) return 'expire';
      if(S.missRateEwma > 0.20 && S.hitJunk > S.hitGood*0.4) return 'junk';
      if(S.densityEwma > 0.38) return 'dense';
      if(S.accEwma > 0.86 && playedSec > 10) return 'combo';

      if(risk > 0.72) return 'dense';
      return '';
    }

    return {
      enabled: !!enabled,

      // engine calls this on shoot/hit/miss events
      onEvent: function(type, payload){
        if(!S.enabled) return;
        type = String(type||'').toLowerCase();
        const t = nowMs();

        if(type === 'shoot'){
          S.shots += 1;
          lastShootAt = t;
          awaitingJudge = true;
        }

        if(type === 'hitgood'){
          S.hitGood += 1;
          if(awaitingJudge && lastShootAt){
            const rtSec = clamp((t - lastShootAt)/1000, 0.08, 1.2);
            S.rtEwma = ewma(S.rtEwma, rtSec, 0.18);
            awaitingJudge = false;
          }
          updateRollingFromWindow();
        }

        if(type === 'hitjunk'){
          S.hitJunk += 1;
          if(awaitingJudge && lastShootAt){
            const rtSec = clamp((t - lastShootAt)/1000, 0.08, 1.2);
            S.rtEwma = ewma(S.rtEwma, rtSec, 0.18);
            awaitingJudge = false;
          }
          updateRollingFromWindow();
        }

        if(type === 'miss'){ // good expired miss in safe.js
          S.expireGood += 1;
          awaitingJudge = false;
          updateRollingFromWindow();
        }

        // Optional: external signals
        if(type === 'boss'){
          S.boss = !!(payload && payload.active);
        }
        if(type === 'lowtime'){
          S.lowTime = !!(payload && payload.active);
        }

        S.lastEventAt = t;
      },

      // engine calls every tick to get difficulty values
      getDifficulty: function(playedSec, base){
        // research mode => no AI
        if(!S.enabled) return Object.assign({}, base||{});

        // measure density quickly from DOM (cheap)
        try{
          const alive = document.querySelectorAll('.gj-target').length || 0;
          const dens = clamp(alive / 10, 0, 1); // 10 alive ~ dense
          S.densityEwma = ewma(S.densityEwma, dens, 0.20);
        }catch(_){}

        // low time heuristic
        S.lowTime = (playedSec != null && playedSec > 0) ? ((Number(qs('time','80'))||80) - playedSec <= 6) : S.lowTime;

        // compute wave + risk
        const wave = patternWave(Number(playedSec)||0, seedStr);
        const risk = computeRisk(Number(playedSec)||0, base);

        // director output
        const out = applyDirector(base||{}, {
          risk,
          wave,
          accEwma: S.accEwma,
          rtEwma: S.rtEwma,
          missRateEwma: S.missRateEwma,
          expireEwma: S.expireEwma,
          boss: S.boss,
          lowTime: S.lowTime
        });

        // keep for coach selection
        S._lastRisk = risk;
        S._lastWave = wave;

        return out;
      },

      // engine sometimes calls for a tip
      getTip: function(playedSec){
        if(!S.enabled) return null;

        const risk = clamp(S._lastRisk ?? 0.4, 0, 1);
        const cause = pickCauseForTip(risk, Number(playedSec)||0);
        if(!cause) return null;

        // rate-limited inside coach
        const tip = coach.getTip(cause);
        return tip || null;
      }
    };
  };

  // Backward compat if some game calls this older name
  WIN.HHA.createAIHooks = WIN.HHA.createAIHooks || function(opts){
    try{ return WIN.HHA.AIHooks.create(opts); }catch(_){ return { enabled:false, onEvent:()=>{}, getTip:()=>null, getDifficulty:(_t,b)=>Object.assign({},b||{}) }; }
  };
})();