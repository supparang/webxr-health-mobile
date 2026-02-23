// === /fitness/js/rb-ai.js ===
// Rhythm Boxer AI Predictor + Assist Hooks (Prediction-first, Research-safe)
// v20260223a
// ✅ AI Prediction: fatigue risk / skill score / suggestedDifficulty / explainable tip
// ✅ Research lock: แสดง prediction ได้ แต่ไม่ adaptive
// ✅ Normal assist: เปิดด้วย ?ai=1 (prediction + hint only by default)
// ✅ Optional adaptive hooks prepared (OFF by default)
// ✅ Deterministic-ish smoothing (no random decisions in predict path)

'use strict';

(function () {
  const WIN = window;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v) { return clamp(v, 0, 1); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function ema(prev, x, alpha) {
    if (!Number.isFinite(prev)) return x;
    return prev + alpha * (x - prev);
  }

  function readQuery() {
    try { return new URL(location.href).searchParams; }
    catch (_) { return new URLSearchParams(''); }
  }

  const Q = readQuery();

  // ---- Modes / switches ----
  // ai=1 => enable assistant in normal mode (prediction + tips)
  // aiAssist=1 => explicit alias
  // aiAdaptive=1 => allow adaptive recommendations flag (still engine decides whether to apply)
  // aiDebug=1 => verbose state fields
  // mode=research => hard lock
  const URL_MODE = String(Q.get('mode') || '').toLowerCase();
  const AI_ON = ['1', 'true', 'on', 'yes'].includes(String(Q.get('ai') || Q.get('aiAssist') || '').toLowerCase());
  const AI_ADAPTIVE_ON = ['1', 'true', 'on', 'yes'].includes(String(Q.get('aiAdaptive') || '').toLowerCase());
  const AI_DEBUG = ['1', 'true', 'on', 'yes'].includes(String(Q.get('aiDebug') || '').toLowerCase());

  // research lock (can also be set by engine via setMode)
  let _mode = (URL_MODE === 'research') ? 'research' : 'normal';
  let _locked = (_mode === 'research');

  // ---- Internal rolling state ----
  const S = {
    t: 0,

    // smoothed inputs
    accPctEma: 80,
    missRateEma: 0,
    comboEma: 0,
    hpEma: 100,
    offsetAbsMsEma: 70,

    // trends
    accDrop: 0,
    hpDrop: 0,

    // prediction outputs (smoothed)
    fatigueRisk: 0.10,
    skillScore: 0.50,
    suggestedDifficulty: 'normal',
    tip: '',

    // anti-spam / explainability
    lastTipAt: -999,
    lastTipKey: '',
    lastSuggestAt: -999,
    stableSuggest: 'normal',
    suggestStabilityTicks: 0,

    // phase awareness proxy (based on progress)
    phase: 'warmup', // warmup | build | peak | finish
  };

  function setMode(mode) {
    _mode = (String(mode || '').toLowerCase() === 'research') ? 'research' : 'normal';
    _locked = (_mode === 'research');
  }

  function isLocked() { return !!_locked; }

  function isAssistEnabled() {
    // In research we may still "show prediction", but consider assist off for adaptation
    return AI_ON && !_locked;
  }

  // ---- Feature engineering (rule-based "ML-like" predictor) ----
  // snap expected from engine:
  // {
  //   accPct, hitMiss, hitPerfect, hitGreat, hitGood, combo,
  //   offsetAbsMean, hp, songTime, durationSec
  // }
  function buildFeatures(snap) {
    const t = Number(snap.songTime || 0);
    const dur = Math.max(1, Number(snap.durationSec || 60));
    const prog = clamp01(t / dur);

    const accPct = clamp(Number(snap.accPct || 0), 0, 100);
    const hp = clamp(Number(snap.hp || 100), 0, 100);
    const combo = Math.max(0, Number(snap.combo || 0));
    const miss = Math.max(0, Number(snap.hitMiss || 0));

    const p = Math.max(0, Number(snap.hitPerfect || 0));
    const g = Math.max(0, Number(snap.hitGreat || 0));
    const gd = Math.max(0, Number(snap.hitGood || 0));
    const hits = p + g + gd;
    const judged = hits + miss;

    // offsetAbsMean from engine is in seconds
    const offsetAbsMs = Number.isFinite(snap.offsetAbsMean) ? Math.max(0, snap.offsetAbsMean * 1000) : 90;

    const perfectRate = hits ? p / hits : 0;
    const goodRate = hits ? gd / hits : 0;
    const missRate = judged ? miss / judged : 0;

    return {
      t, dur, prog,
      accPct, hp, combo, miss, hits, judged,
      perfectRate, goodRate, missRate,
      offsetAbsMs
    };
  }

  function updatePhase(prog) {
    S.phase =
      prog < 0.20 ? 'warmup' :
      prog < 0.60 ? 'build' :
      prog < 0.88 ? 'peak' : 'finish';
  }

  function smoothInputs(F) {
    // EMA smoothing to avoid flicker
    const prevAcc = S.accPctEma;
    const prevHp = S.hpEma;

    S.accPctEma = ema(S.accPctEma, F.accPct, 0.18);
    S.hpEma = ema(S.hpEma, F.hp, 0.22);
    S.comboEma = ema(S.comboEma, F.combo, 0.20);
    S.missRateEma = ema(S.missRateEma, F.missRate, 0.22);
    S.offsetAbsMsEma = ema(S.offsetAbsMsEma, F.offsetAbsMs, 0.20);

    S.accDrop = clamp((prevAcc - S.accPctEma) / 12, -1, 1); // normalized-ish
    S.hpDrop = clamp((prevHp - S.hpEma) / 10, -1, 1);
  }

  // "Model" #1: fatigue risk
  // Interpretable weighted score (0..1)
  function predictFatigue(F) {
    const hpLow = clamp01((70 - S.hpEma) / 50);                 // hp < 70 raises risk
    const timingNoise = clamp01((S.offsetAbsMsEma - 55) / 85);  // >55ms gets risky
    const missBurden = clamp01(S.missRateEma / 0.35);
    const accDrop = clamp01(Math.max(0, S.accDrop));
    const hpDrop = clamp01(Math.max(0, S.hpDrop));
    const latePhase = clamp01((F.prog - 0.55) / 0.45);

    let z =
      0.26 * hpLow +
      0.22 * timingNoise +
      0.22 * missBurden +
      0.14 * accDrop +
      0.10 * hpDrop +
      0.06 * latePhase;

    // protective factor: stable combo reduces fatigue risk appearance
    const comboProtect = clamp01(S.comboEma / 22) * 0.10;
    z = clamp01(z - comboProtect);

    S.fatigueRisk = ema(S.fatigueRisk, z, 0.25);
    return S.fatigueRisk;
  }

  // "Model" #2: skill score
  // Interpretable weighted score (0..1)
  function predictSkill(F) {
    const acc = clamp01(S.accPctEma / 100);
    const perfect = clamp01(F.perfectRate / 0.55);              // 55% perfect ~= very good
    const timing = 1 - clamp01((S.offsetAbsMsEma - 35) / 95);   // lower offset => higher score
    const combo = clamp01(S.comboEma / 28);
    const missPenalty = clamp01(S.missRateEma / 0.30);

    let z =
      0.36 * acc +
      0.22 * perfect +
      0.20 * timing +
      0.16 * combo +
      0.06 * (1 - missPenalty);

    // slight penalty if HP is collapsing
    z -= 0.08 * clamp01((60 - S.hpEma) / 60);

    z = clamp01(z);
    S.skillScore = ema(S.skillScore, z, 0.22);
    return S.skillScore;
  }

  function chooseSuggestedDifficulty(F) {
    // Suggest only (engine may or may not apply)
    // Use hysteresis to prevent ping-pong
    const skill = S.skillScore;
    const fatigue = S.fatigueRisk;
    const acc = S.accPctEma;
    const off = S.offsetAbsMsEma;

    let raw = 'normal';

    const looksStrong =
      skill >= 0.78 &&
      fatigue <= 0.35 &&
      acc >= 88 &&
      off <= 65 &&
      F.combo >= 8;

    const looksStruggling =
      fatigue >= 0.68 ||
      acc <= 62 ||
      off >= 115 ||
      (F.hp <= 35 && F.prog > 0.35);

    if (looksStrong) raw = 'hard';
    else if (looksStruggling) raw = 'easy';
    else raw = 'normal';

    // phase-aware tone: avoid "hard" spike too early in warmup
    if (S.phase === 'warmup' && raw === 'hard') raw = 'normal';

    // hysteresis / stability ticks
    if (raw === S.stableSuggest) {
      S.suggestStabilityTicks = Math.min(999, S.suggestStabilityTicks + 1);
    } else {
      // require 2 confirmations to switch
      if (S.suggestStabilityTicks >= 1) {
        S.stableSuggest = raw;
        S.suggestStabilityTicks = 0;
      } else {
        S.suggestStabilityTicks += 1;
      }
    }

    S.suggestedDifficulty = S.stableSuggest;
    return S.suggestedDifficulty;
  }

  // Explainable coach tips (micro-tips, rate-limited)
  function chooseTip(F) {
    const t = F.t;
    const fatigue = S.fatigueRisk;
    const off = S.offsetAbsMsEma;
    const acc = S.accPctEma;
    const combo = S.comboEma;

    // rate limit: every ~2.2s minimum
    if (t - S.lastTipAt < 2.2) return S.tip || '';

    let tipKey = '';
    let tip = '';

    // Priority rules
    if (fatigue >= 0.75 && F.hp <= 45) {
      tipKey = 'recover-breath';
      tip = 'หายใจลึกสั้น ๆ 1 จังหวะ แล้วกลับมาโฟกัสช่องกลาง';
    } else if (off >= 110) {
      tipKey = 'timing-reset';
      tip = 'จังหวะคลาดเยอะ ลองมองเส้น Hit line แล้วกดตามบีตหลัก';
    } else if (acc < 65 && F.missRate > 0.22) {
      tipKey = 'reduce-greed';
      tip = 'อย่ารีบกดล่วงหน้า เน้น “โดนชัวร์” ก่อนคอมโบจะกลับมาเอง';
    } else if (combo >= 10 && fatigue < 0.45) {
      tipKey = 'keep-streak';
      tip = 'ดีมาก! รักษาจังหวะเดิมไว้ อย่าเร่งมือเกินเพลง';
    } else if (F.goodRate > 0.55 && off > 75) {
      tipKey = 'upgrade-good';
      tip = 'Good เยอะอยู่แล้ว ขยับเวลาอีกนิดให้เข้า Great/Perfect';
    } else if (S.phase === 'finish' && fatigue >= 0.55) {
      tipKey = 'finish-safe';
      tip = 'ช่วงท้ายแล้ว เน้นแม่นมากกว่าคอมโบยาว';
    } else if (S.phase === 'peak' && acc >= 82 && off <= 70) {
      tipKey = 'peak-push';
      tip = 'ฟอร์มกำลังดี! โฟกัสซ้าย-ขวาสลับให้คงที่';
    }

    // avoid repeating same tip too frequently
    if (tipKey && tipKey === S.lastTipKey && t - S.lastTipAt < 5.0) {
      return S.tip || '';
    }

    if (tipKey) {
      S.lastTipKey = tipKey;
      S.lastTipAt = t;
      S.tip = tip;
    } else {
      // keep previous tip briefly
      S.tip = '';
    }

    return S.tip;
  }

  // Optional adaptive recommendation payload (engine can ignore)
  function buildAdaptivePayload(F) {
    // Recommendation only (not applied here)
    const fatigue = S.fatigueRisk;
    const skill = S.skillScore;

    // Spawn density / note speed multiplier recommendations for future use
    let noteDensityMul = 1.0;   // <1 easier, >1 harder
    let hpDrainMul = 1.0;       // <1 safer, >1 harsher
    let fxIntensity = 1.0;      // cosmetic intensity suggestion

    if (skill > 0.80 && fatigue < 0.35) {
      noteDensityMul = 1.08;
      hpDrainMul = 1.05;
      fxIntensity = 1.15;
    } else if (fatigue > 0.70) {
      noteDensityMul = 0.90;
      hpDrainMul = 0.85;
      fxIntensity = 0.95;
    } else if (fatigue > 0.55) {
      noteDensityMul = 0.95;
      hpDrainMul = 0.92;
      fxIntensity = 1.00;
    }

    return {
      noteDensityMul: +noteDensityMul.toFixed(3),
      hpDrainMul: +hpDrainMul.toFixed(3),
      fxIntensity: +fxIntensity.toFixed(3),
      canApply: AI_ADAPTIVE_ON && !_locked && AI_ON
    };
  }

  // Main API used by engine
  function predict(snap) {
    const F = buildFeatures(snap);
    S.t = F.t;
    updatePhase(F.prog);
    smoothInputs(F);

    const fatigueRisk = predictFatigue(F);
    const skillScore = predictSkill(F);
    const suggestedDifficulty = chooseSuggestedDifficulty(F);
    const tip = chooseTip(F);
    const adaptive = buildAdaptivePayload(F);

    const out = {
      fatigueRisk: +fatigueRisk.toFixed(3),
      skillScore: +skillScore.toFixed(3),
      suggestedDifficulty,
      tip,

      // explainability
      explain: {
        phase: S.phase,
        accPctEma: +S.accPctEma.toFixed(2),
        hpEma: +S.hpEma.toFixed(2),
        missRateEma: +S.missRateEma.toFixed(4),
        offsetAbsMsEma: +S.offsetAbsMsEma.toFixed(2),
        comboEma: +S.comboEma.toFixed(2)
      },

      // recommendation payload for future engine adaptation
      adaptive,

      // policy flags
      aiLocked: _locked ? 1 : 0,
      aiAssistOn: (AI_ON && !_locked) ? 1 : 0
    };

    if (!AI_DEBUG) {
      delete out.explain;
    }

    return out;
  }

  // ---- "ML/DL" extensibility hooks (future) ----
  // For now: rule-based predictor + smoothing. These APIs are stubs/hooks so you can later
  // plug in TensorFlow.js / exported model without changing engine contract.
  let _externalModel = null;

  function registerModel(model) {
    // model.predict(features) -> {fatigueRisk, skillScore, suggestedDifficulty, tip?}
    _externalModel = model || null;
  }

  function predictWithModel(snap) {
    if (!_externalModel || typeof _externalModel.predict !== 'function') {
      return predict(snap);
    }
    try {
      const base = predict(snap); // keep explainability + smoothing baseline
      const F = buildFeatures(snap);
      const m = _externalModel.predict(F) || {};

      // Blend external model with rule baseline (safer)
      const fr = Number.isFinite(m.fatigueRisk) ? clamp01(m.fatigueRisk) : base.fatigueRisk;
      const ss = Number.isFinite(m.skillScore) ? clamp01(m.skillScore) : base.skillScore;

      base.fatigueRisk = +lerp(base.fatigueRisk, fr, 0.45).toFixed(3);
      base.skillScore  = +lerp(base.skillScore,  ss, 0.45).toFixed(3);

      if (typeof m.suggestedDifficulty === 'string' && m.suggestedDifficulty) {
        base.suggestedDifficulty = ['easy','normal','hard'].includes(m.suggestedDifficulty) ? m.suggestedDifficulty : base.suggestedDifficulty;
      }
      if (typeof m.tip === 'string' && m.tip.trim()) {
        // still rate-limit by reusing chooseTip timing policy lightly
        if (F.t - S.lastTipAt > 2.2) {
          S.lastTipAt = F.t;
          S.lastTipKey = 'external';
          base.tip = m.tip.trim();
        }
      }

      return base;
    } catch (_) {
      return predict(snap);
    }
  }

  // ---- Public API ----
  WIN.RB_AI = {
    // engine uses these
    predict: predictWithModel,
    isLocked,
    isAssistEnabled,

    // glue/UI can call
    setMode,
    registerModel,

    // debug / reset
    getState: function () {
      return {
        mode: _mode,
        locked: _locked,
        assistEnabled: AI_ON && !_locked,
        adaptiveEnabled: AI_ADAPTIVE_ON && !_locked && AI_ON,
        debug: AI_DEBUG,
        S: JSON.parse(JSON.stringify(S))
      };
    },
    reset: function () {
      S.t = 0;
      S.accPctEma = 80;
      S.missRateEma = 0;
      S.comboEma = 0;
      S.hpEma = 100;
      S.offsetAbsMsEma = 70;
      S.accDrop = 0;
      S.hpDrop = 0;
      S.fatigueRisk = 0.10;
      S.skillScore = 0.50;
      S.suggestedDifficulty = 'normal';
      S.tip = '';
      S.lastTipAt = -999;
      S.lastTipKey = '';
      S.lastSuggestAt = -999;
      S.stableSuggest = 'normal';
      S.suggestStabilityTicks = 0;
      S.phase = 'warmup';
    }
  };

})();