// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — shared, deterministic-ready, OFF by default
// ✅ Difficulty Director (adjust spawn/size/ratio) — fair & smooth
// ✅ AI Coach micro-tips (rate-limited, explainable)
// ✅ Pattern Generator (seeded patterns for boss/storm/spawn)
// NOTE: default disabled; engines may call hooks safely.

const ROOT = window;

function nowMs(){ return Date.now(); }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function makeAIHooks(opts={}){
  const cfg = Object.assign({
    enabled: false,               // master switch
    enableDifficulty: false,
    enableCoach: false,
    enablePattern: false,

    // research safety: if true -> keep deterministic + no adaptive changes
    researchMode: false,

    // coach rate limit
    coachMinGapMs: 3500,

    // difficulty smoothing
    diffLerp: 0.18,               // smaller = smoother

    rng: Math.random,             // pass seeded rng for deterministic patterns
    emit: null,                   // function(name, detail)
    tag: 'AI'
  }, opts || {});

  const S = {
    lastCoachAt: 0,

    // difficulty state (smoothed)
    spawnRateMs: null,            // target & current inside director
    sizeMin: null,
    sizeMax: null,
    goodWeight: null,
    junkWeight: null,

    // rolling performance
    hitsGood: 0,
    hitsJunk: 0,
    expireGood: 0,
    comboNow: 0,
    miss: 0,
    tStart: nowMs()
  };

  const emit = (name, detail)=>{
    if(typeof cfg.emit === 'function') cfg.emit(name, detail);
    else if(ROOT && ROOT.dispatchEvent){
      ROOT.dispatchEvent(new CustomEvent(name, { detail }));
    }
  };

  function perf(){
    const total = S.hitsGood + S.hitsJunk + S.expireGood;
    const acc = total>0 ? (S.hitsGood/total) : 1;
    const missRate = total>0 ? (S.miss/total) : 0;
    return {
      acc, missRate,
      total,
      comboNow: S.comboNow,
      timeSec: (nowMs()-S.tStart)/1000
    };
  }

  function lerp(cur, tar, k){
    if(cur == null) return tar;
    return cur + (tar-cur)*k;
  }

  // ---------- Difficulty Director ----------
  function difficultySuggest(base){
    // base = { spawnRateMs, sizeMin, sizeMax, goodWeight, junkWeight }
    // Output = adjusted suggestion (may equal base)
    if(!cfg.enabled || !cfg.enableDifficulty) return Object.assign({}, base);
    if(cfg.researchMode) return Object.assign({}, base);

    const p = perf();

    // heuristic: if acc low or miss high -> ease up; if acc high + combo -> harder
    const ease = clamp((0.78 - p.acc) * 1.2 + (p.missRate - 0.18) * 1.0, -0.35, 0.45);
    // ease > 0 => easier; ease < 0 => harder

    let spawn = base.spawnRateMs;
    let sMin  = base.sizeMin;
    let sMax  = base.sizeMax;

    // easier => slower spawn + bigger targets
    spawn = clamp(spawn * (1 + ease*0.55), 420, 1400);
    sMin  = clamp(sMin  * (1 + ease*0.35), 36, 92);
    sMax  = clamp(sMax  * (1 + ease*0.35), 44, 118);

    // keep junk fair: if struggling, reduce junk a bit
    let goodW = base.goodWeight;
    let junkW = base.junkWeight;
    if(ease > 0.12){
      junkW = clamp(junkW * (1 - ease*0.45), 0.12, 0.55);
      goodW = clamp(goodW * (1 + ease*0.12), 0.45, 0.88);
    }

    // smooth
    S.spawnRateMs = lerp(S.spawnRateMs, spawn, cfg.diffLerp);
    S.sizeMin     = lerp(S.sizeMin,     sMin,  cfg.diffLerp);
    S.sizeMax     = lerp(S.sizeMax,     sMax,  cfg.diffLerp);
    S.goodWeight  = lerp(S.goodWeight,  goodW, cfg.diffLerp);
    S.junkWeight  = lerp(S.junkWeight,  junkW, cfg.diffLerp);

    return {
      spawnRateMs: Math.round(S.spawnRateMs),
      sizeMin: Math.round(S.sizeMin),
      sizeMax: Math.round(S.sizeMax),
      goodWeight: Number(S.goodWeight.toFixed(3)),
      junkWeight: Number(S.junkWeight.toFixed(3)),
      _ai: { ease, acc:p.acc, missRate:p.missRate }
    };
  }

  // ---------- AI Coach (explainable micro-tips) ----------
  function coachTip(reason, msg){
    if(!cfg.enabled || !cfg.enableCoach) return;
    if(cfg.researchMode) return; // research default = no adaptive coaching
    const t = nowMs();
    if(t - S.lastCoachAt < cfg.coachMinGapMs) return;
    S.lastCoachAt = t;
    emit('hha:coach', { msg, tag: cfg.tag, reason });
  }

  function coachFromPerf(){
    if(!cfg.enabled || !cfg.enableCoach) return;
    if(cfg.researchMode) return;
    const p = perf();
    if(p.total < 6) return;

    if(p.acc < 0.72) coachTip('low-acc', 'ลอง “เล็งตรงกลาง” แล้วแตะทีเดียวให้ชัวร์ ✅');
    else if(p.missRate > 0.26) coachTip('high-miss', 'ใจเย็น ๆ เลือกเก็บ “ของดี” ก่อน แล้วค่อยเร่งสปีด 🧠');
    else if(p.comboNow >= 8) coachTip('high-combo', 'คอมโบกำลังมา! รักษาจังหวะต่ออีกนิด ⭐');
  }

  // ---------- Pattern Generator (seeded) ----------
  function patternNext(kind='spawn'){
    if(!cfg.enabled || !cfg.enablePattern) return null;
    // deterministic if rng is seeded
    const r = cfg.rng();
    if(kind === 'storm'){
      return (r < 0.5) ? { type:'ring', intensity:0.7 } : { type:'sweep', intensity:0.6 };
    }
    if(kind === 'boss'){
      return (r < 0.5) ? { type:'focus', windowMs:1200 } : { type:'shuffle', windowMs:900 };
    }
    // spawn
    return (r < 0.33) ? { type:'clusters', n:3 } : (r < 0.66) ? { type:'spread', n:4 } : { type:'zigzag', n:4 };
  }

  // ---------- Telemetry feed from engine ----------
  function onHitGood(){ S.hitsGood++; S.comboNow++; }
  function onHitJunk(){ S.hitsJunk++; S.miss++; S.comboNow=0; }
  function onExpireGood(){ S.expireGood++; S.miss++; S.comboNow=0; }
  function onResetCombo(){ S.comboNow=0; }
  function onStart(){ S.tStart = nowMs(); }

  return {
    cfg,
    state: S,

    // director
    difficultySuggest,

    // coach
    coachTip,
    coachFromPerf,

    // pattern
    patternNext,

    // feed
    onStart,
    onHitGood,
    onHitJunk,
    onExpireGood,
    onResetCombo
  };
}