// === /herohealth/hydration-vr/hydration-ai-director.js ===
// Hydration AI Director — v20260426-AI-DIRECTOR
// ✅ AI Prediction: ทำนาย risk LOW/HIGH, miss risk, fatigue/frustration
// ✅ Adaptive Difficulty: ปรับ spawn pacing / target size / storm pressure แบบยุติธรรม
// ✅ Explainable AI: ให้เหตุผลสั้น ๆ สำหรับ coach / summary
// ✅ Research-safe: deterministic by seed, no external dependency
// ✅ ML/DL-ready: output feature vector + prediction schema สำหรับต่อ model จริงภายหลัง

'use strict';

export function createHydrationAIDirector(options = {}){
  const seed = String(options.seed || 'hydration-ai');
  const runMode = String(options.runMode || 'play');
  const difficulty = String(options.difficulty || 'normal');

  let tickCount = 0;
  let lastTipAt = 0;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function hash01(s){
    let h = 2166136261;
    for (let i=0;i<String(s).length;i++){
      h ^= String(s).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
  }

  function baseDifficultyFactor(){
    if (difficulty === 'easy' || difficulty === 'learn') return 0.82;
    if (difficulty === 'hard' || difficulty === 'power') return 1.18;
    return 1.0;
  }

  function featureVector(s){
    const totalHits = Math.max(1, (s.goodHits || 0) + (s.badHits || 0) + (s.misses || 0));
    const acc = clamp((s.goodHits || 0) / totalHits, 0, 1);
    const missRate = clamp((s.misses || 0) / Math.max(1, totalHits), 0, 1);
    const shieldRate = clamp((s.shieldBlocks || 0) / Math.max(1, (s.stormCycles || 1)), 0, 1);
    const stormRate = clamp((s.stormSuccess || 0) / Math.max(1, (s.stormCycles || 1)), 0, 1);

    return {
      timeSec: Number(s.elapsedSec || 0),
      stage: Number(s.stage || 1),
      waterPct: Number(s.waterPct || 50),
      waterZone: String(s.waterZone || 'GREEN'),
      score: Number(s.score || 0),
      combo: Number(s.combo || 0),
      comboMax: Number(s.comboMax || 0),
      misses: Number(s.misses || 0),
      goodHits: Number(s.goodHits || 0),
      badHits: Number(s.badHits || 0),
      shield: Number(s.shield || 0),
      stormActive: !!s.stormActive,
      endWindow: !!s.inEndWindow,
      bossActive: !!s.bossActive,
      accuracy: acc,
      missRate,
      shieldRate,
      stormRate
    };
  }

  function predictRisks(f){
    // Prediction แบบ rule-based/pseudo-ML
    // ต่อไปสามารถแทนด้วย logistic regression / small neural net ได้
    const lowDistance = clamp((40 - f.waterPct) / 40, 0, 1);
    const highDistance = clamp((f.waterPct - 70) / 30, 0, 1);

    const riskLow = clamp(
      lowDistance * 0.62 +
      f.missRate * 0.22 +
      (f.stormActive ? 0.10 : 0) +
      (f.stage >= 2 ? 0.06 : 0),
      0, 1
    );

    const riskHigh = clamp(
      highDistance * 0.62 +
      f.badHits * 0.015 +
      (f.combo > 8 ? 0.08 : 0) +
      (f.stormActive ? 0.08 : 0),
      0, 1
    );

    const frustrationRisk = clamp(
      f.missRate * 0.55 +
      (f.misses >= 12 ? 0.18 : 0) +
      (f.accuracy < 0.45 ? 0.20 : 0) -
      (f.comboMax >= 8 ? 0.08 : 0),
      0, 1
    );

    const mastery = clamp(
      f.accuracy * 0.46 +
      Math.min(1, f.comboMax / 14) * 0.24 +
      f.stormRate * 0.20 +
      (f.waterZone === 'GREEN' ? 0.10 : 0),
      0, 1
    );

    return {
      riskLow,
      riskHigh,
      frustrationRisk,
      mastery,
      dominantRisk:
        riskLow > 0.55 ? 'LOW' :
        riskHigh > 0.55 ? 'HIGH' :
        frustrationRisk > 0.55 ? 'FRUSTRATION' :
        mastery > 0.72 ? 'TOO_EASY' :
        'BALANCED'
    };
  }

  function recommendAdjustment(f, p){
    const base = baseDifficultyFactor();

    let spawnMsFactor = base;
    let targetSizeFactor = 1.0;
    let badRatioFactor = 1.0;
    let stormPressureFactor = 1.0;
    let aimAssistFactor = 1.0;

    let reason = 'สมดุลดี: คงความเร็วและความยากไว้';

    if (p.dominantRisk === 'LOW'){
      spawnMsFactor *= 0.96;
      targetSizeFactor *= 1.10;
      badRatioFactor *= 0.86;
      stormPressureFactor *= 0.88;
      aimAssistFactor *= 1.12;
      reason = 'เสี่ยง LOW: เพิ่มโอกาสเก็บน้ำดี ลดเป้า BAD และช่วยเล็งเล็กน้อย';
    } else if (p.dominantRisk === 'HIGH'){
      spawnMsFactor *= 1.02;
      targetSizeFactor *= 1.03;
      badRatioFactor *= 0.92;
      stormPressureFactor *= 0.92;
      aimAssistFactor *= 1.05;
      reason = 'เสี่ยง HIGH: ลดแรงกดดันและให้เวลาปรับสมดุล';
    } else if (p.dominantRisk === 'FRUSTRATION'){
      spawnMsFactor *= 1.10;
      targetSizeFactor *= 1.14;
      badRatioFactor *= 0.80;
      stormPressureFactor *= 0.82;
      aimAssistFactor *= 1.18;
      reason = 'ผู้เล่นเริ่มพลาดถี่: ลดความยากชั่วคราวให้กลับมาคุมเกมได้';
    } else if (p.dominantRisk === 'TOO_EASY' && runMode !== 'research'){
      spawnMsFactor *= 0.88;
      targetSizeFactor *= 0.94;
      badRatioFactor *= 1.10;
      stormPressureFactor *= 1.12;
      aimAssistFactor *= 0.94;
      reason = 'ผู้เล่นทำได้ดีมาก: เพิ่มความเร็วและความท้าทายเล็กน้อย';
    }

    // deterministic tiny variation เพื่อไม่ให้ทุก session เหมือนกันเกินไป
    const jitter = (hash01(seed + '|' + tickCount) - 0.5) * 0.04;

    return {
      spawnMsFactor: clamp(spawnMsFactor + jitter, 0.72, 1.28),
      targetSizeFactor: clamp(targetSizeFactor, 0.82, 1.22),
      badRatioFactor: clamp(badRatioFactor, 0.70, 1.25),
      stormPressureFactor: clamp(stormPressureFactor, 0.70, 1.25),
      aimAssistFactor: clamp(aimAssistFactor, 0.82, 1.24),
      reason
    };
  }

  function coachTip(f, p, adj, nowMs){
    if (nowMs - lastTipAt < 4500) return null;
    lastTipAt = nowMs;

    if (p.dominantRisk === 'LOW'){
      return {
        type: 'risk_low',
        text: 'น้ำเริ่มต่ำ เลือกเก็บ 💧 ก่อน แล้วค่อยรอจังหวะ Storm',
        reason: 'AI เห็นว่า water% ต่ำกว่าโซน GREEN และ miss เริ่มเพิ่ม'
      };
    }

    if (p.dominantRisk === 'HIGH'){
      return {
        type: 'risk_high',
        text: 'น้ำเริ่มสูงเกินไป อย่ารีบยิงทุกเป้า เลือกเป้าที่ช่วยคุมสมดุล',
        reason: 'AI เห็นว่า water% สูงกว่าโซน GREEN'
      };
    }

    if (p.dominantRisk === 'FRUSTRATION'){
      return {
        type: 'frustration',
        text: 'ช้าลงนิด เล็งเป้าใหญ่ก่อน เกมจะช่วยลดความยากชั่วคราว',
        reason: 'AI เห็นว่า miss rate สูงและ accuracy ลดลง'
      };
    }

    if (p.dominantRisk === 'TOO_EASY'){
      return {
        type: 'challenge_up',
        text: 'ทำได้ดีมาก! รอบนี้เกมจะเพิ่มจังหวะท้าทายขึ้นเล็กน้อย',
        reason: 'AI เห็นว่า accuracy และ combo สูง'
      };
    }

    return null;
  }

  function update(rawState = {}){
    tickCount++;

    const f = featureVector(rawState);
    const p = predictRisks(f);
    const adj = recommendAdjustment(f, p);
    const tip = coachTip(f, p, adj, performance.now());

    return {
      ok: true,
      version: 'hydration-ai-director-v20260426',
      tick: tickCount,
      mode: {
        runMode,
        difficulty
      },
      features: f,
      prediction: p,
      adjustment: adj,
      coachTip: tip,
      schema: {
        predictionType: 'rule_based_ml_ready',
        mlReady: true,
        dlReady: false,
        note: 'This module outputs feature vectors and prediction labels. Replace predictRisks() with trained ML/DL model later.'
      }
    };
  }

  function summarize(rawState = {}){
    const f = featureVector(rawState);
    const p = predictRisks(f);

    let label = 'Balanced';
    let explain = 'ผู้เล่นคุมสมดุลน้ำได้ค่อนข้างดี';

    if (p.dominantRisk === 'LOW'){
      label = 'Low-water risk';
      explain = 'มีแนวโน้มปล่อยให้น้ำต่ำช่วงพายุหรือพลาดเป้าบ่อย';
    } else if (p.dominantRisk === 'HIGH'){
      label = 'High-water risk';
      explain = 'มีแนวโน้มเก็บน้ำถี่เกินหรือเสียสมดุลไปทางสูง';
    } else if (p.dominantRisk === 'FRUSTRATION'){
      label = 'Frustration risk';
      explain = 'มีจังหวะพลาดถี่ ควรลดความยากหรือเพิ่มเป้าใหญ่ชั่วคราว';
    } else if (p.dominantRisk === 'TOO_EASY'){
      label = 'Ready for challenge';
      explain = 'ผู้เล่นพร้อมเพิ่มความเร็วหรือเพิ่ม pattern ยากขึ้น';
    }

    return {
      label,
      explain,
      prediction: p,
      features: f
    };
  }

  return {
    update,
    summarize,
    featureVector,
    predictRisks
  };
}