// === /fitness/js/ai-packA.js ===
// Pack A: AI-lite for fun (Play only). Deterministic-ready if you pass seed later.
'use strict';

export function createAIPackA(opts = {}) {
  const cfg = {
    enabled: !!opts.enabled,
    // toggles
    usePredictor: !!opts.usePredictor,
    useTips: !!opts.useTips,
    usePattern: !!opts.usePattern,
    usePacing: !!opts.usePacing,

    // pacing limits (fair)
    spawnMulMin: 0.82,   // ผ่อนสุด ~18%
    spawnMulMax: 1.18,   // เร่งสุด ~18%
    lifeMulMin: 0.88,    // เป้าอยู่ได้นานขึ้นนิด
    lifeMulMax: 1.12,

    // tips
    tipCooldownMs: 5500,
    minEventsBeforeTips: 6,

    ...opts
  };

  // runtime signals
  const S = {
    // performance
    hits: 0,
    misses: 0,
    missStreak: 0,
    hitStreak: 0,
    lastRT: null,
    rtEwma: null,          // EWMA ของ RT
    rtVarEwma: 0,          // คร่าว ๆ
    lastEventAt: 0,

    // pacing outputs
    spawnMul: 1.0,
    lifeMul: 1.0,

    // pattern
    patternIndex: 0,
    patternSeq: [],
    lastPatternKey: '',

    // tips
    tipLastAt: 0,
    eventsSeen: 0,
  };

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

  function ewma(prev, x, alpha){
    return prev == null ? x : (alpha * x + (1 - alpha) * prev);
  }

  // --- PREDICTOR: risk score จาก RT + streak ---
  function riskScore() {
    // base from RT (เร็ว=ดี)
    const rt = S.rtEwma == null ? 420 : S.rtEwma;
    let r = 0;
    if (rt > 520) r += 0.35;
    else if (rt > 430) r += 0.18;

    // streak penalties
    if (S.missStreak >= 2) r += 0.22;
    if (S.missStreak >= 4) r += 0.28;

    // low confidence if very few events
    if (S.eventsSeen < 6) r *= 0.65;

    return clamp(r, 0, 1);
  }

  // --- PACING: ปรับ spawn/lifetime แบบยุติธรรม ---
  function updatePacing() {
    if (!cfg.usePacing) return;

    const r = cfg.usePredictor ? riskScore() : clamp(S.missStreak * 0.12, 0, 1);

    // risk สูง -> ผ่อน (spawn ช้าลง, lifetime นานขึ้น)
    // risk ต่ำ -> เร่ง
    const t = (0.5 - r); // + = เร่ง, - = ผ่อน
    const spawnMul = clamp(1.0 + t * 0.36, cfg.spawnMulMin, cfg.spawnMulMax);
    const lifeMul  = clamp(1.0 - t * 0.26, cfg.lifeMulMin, cfg.lifeMulMax);

    // smooth
    S.spawnMul = ewma(S.spawnMul, spawnMul, 0.25);
    S.lifeMul  = ewma(S.lifeMul, lifeMul, 0.25);
  }

  // --- PATTERN: สร้างแพทเทิร์นตาม boss/phase (อ่านเกมได้) ---
  function ensurePattern(bossIndex, bossPhase) {
    if (!cfg.usePattern) return;
    const key = `${bossIndex}:${bossPhase}`;
    if (S.lastPatternKey === key && S.patternSeq.length) return;

    S.lastPatternKey = key;
    S.patternIndex = 0;

    // pattern แบบง่ายแต่รู้สึกได้
    // 0 Bubble: normal เยอะ + heal บ้าง
    // 1 Spark: bomb/decoy เพิ่ม
    // 2 Shadow: decoy เยอะขึ้น (หลอก)
    // 3 Galaxy: เร็ว + บอสเฟส 3 มี bossface โอกาสเพิ่ม (ใน engine มีเงื่อนไขอยู่แล้ว)

    const base =
      bossIndex === 0 ? ['normal','normal','normal','heal','shield','normal','decoy'] :
      bossIndex === 1 ? ['normal','bomb','normal','decoy','normal','shield','bomb'] :
      bossIndex === 2 ? ['decoy','normal','decoy','normal','bomb','normal','shield'] :
                        ['normal','decoy','bomb','normal','shield','normal','decoy'];

    // phase ทำให้ “โหดขึ้น”
    let seq = base.slice();
    if (bossPhase === 2) seq = seq.concat(['normal','bomb']);
    if (bossPhase === 3) seq = seq.concat(['decoy','bomb','normal']);

    // shuffle เบา ๆ เพื่อไม่จำได้เป๊ะ (แต่ยังมีธีม)
    seq = softShuffle(seq, 0.35);

    S.patternSeq = seq;
  }

  function softShuffle(arr, strength=0.3){
    const a = arr.slice();
    for(let i=0;i<a.length;i++){
      if (Math.random() < strength){
        const j = Math.floor(Math.random()*a.length);
        const t=a[i]; a[i]=a[j]; a[j]=t;
      }
    }
    return a;
  }

  function nextTargetType(bossIndex, bossPhase) {
    if (!cfg.usePattern) return null;
    ensurePattern(bossIndex, bossPhase);
    const seq = S.patternSeq;
    if (!seq.length) return null;
    const v = seq[S.patternIndex % seq.length];
    S.patternIndex++;
    return v;
  }

  // --- TIPS: explainable micro tips (ไม่ถี่) ---
  function shouldTip(now) {
    if (!cfg.useTips) return false;
    if (S.eventsSeen < cfg.minEventsBeforeTips) return false;
    return (now - S.tipLastAt) >= cfg.tipCooldownMs;
  }

  function pickTip(now) {
    if (!shouldTip(now)) return null;

    // rules
    if (S.missStreak >= 3) return tip(now, 'พลาดติดกัน ลอง “มองก่อนกด” 1 จังหวะ แล้วค่อยชก 🎯');
    if (S.rtEwma != null && S.rtEwma > 520) return tip(now, 'ช้าไปนิด—ลอง “เตรียมมือค้างไว้” แล้วแตะทันทีเมื่อเห็นเป้า 👊');
    if (S.hits >= 8 && S.misses === 0) return tip(now, 'ฟอร์มดีมาก! ลองเพิ่ม Hard หรือเปิดเสียงเพื่อจับจังหวะ 🔥');
    if (S.hitStreak >= 6) return tip(now, 'คอมโบมาแล้ว! อย่าหลงเป้าลวง—ดูสี/ไอคอนก่อนชก 👀');

    return null;
  }

  function tip(now, text){
    S.tipLastAt = now;
    return { text };
  }

  // --- public API ---
  return {
    cfg, S,

    onHit(rtMs, targetType) {
      if (!cfg.enabled) return;
      const now = performance.now();
      S.eventsSeen++;
      S.hits++;
      S.hitStreak++;
      S.missStreak = 0;
      S.lastRT = rtMs;

      // update RT EWMA
      S.rtEwma = ewma(S.rtEwma, rtMs, 0.18);
      const err = (rtMs - (S.rtEwma || rtMs));
      S.rtVarEwma = ewma(S.rtVarEwma, err*err, 0.08);

      updatePacing();

      return pickTip(now);
    },

    onMiss() {
      if (!cfg.enabled) return;
      const now = performance.now();
      S.eventsSeen++;
      S.misses++;
      S.missStreak++;
      S.hitStreak = 0;

      updatePacing();

      return pickTip(now);
    },

    // ใช้ตอนจะ spawn
    planSpawn(stateLike) {
      if (!cfg.enabled) return { spawnMul: 1, lifeMul: 1, forcedType: null };

      const forcedType = cfg.usePattern
        ? nextTargetType(stateLike.bossIndex, stateLike.bossPhase)
        : null;

      return {
        spawnMul: S.spawnMul || 1,
        lifeMul: S.lifeMul || 1,
        forcedType
      };
    }
  };
}