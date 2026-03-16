// === /herohealth/vr-goodjunk/goodjunk.model.js ===
// GoodJunk Model Runtime
// FULL PATCH v20260316b-GJ-MODEL-READY-BASE

'use strict';

import {
  GJ_FEATURE_SCHEMA_VERSION,
  featureVectorToArray,
  explainTopFactors
} from './goodjunk.features.js';

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function sigmoid(x){
  x = Number(x);
  if(!Number.isFinite(x)) x = 0;
  return 1 / (1 + Math.exp(-x));
}

function safeNum(v, d=0){
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}

export const GJ_MODEL_VERSION = 'gj-model-v2-ready-base';

export function createModelRuntime(opts = {}){
  const state = {
    mode: String(opts.mode || 'heuristic'), // heuristic | external
    modelVersion: String(opts.modelVersion || GJ_MODEL_VERSION),
    externalPredictor: typeof opts.externalPredictor === 'function' ? opts.externalPredictor : null,
    loaded: false,
    loadError: ''
  };

  async function load(){
    state.loaded = true;
    return {
      ok: true,
      modelVersion: state.modelVersion,
      mode: state.mode
    };
  }

  function predictHeuristic(features = {}){
    const accPct = safeNum(features.accPct);
    const junkConfusionRatio = safeNum(features.junkConfusionRatio);
    const expirePressureRatio = safeNum(features.expirePressureRatio);
    const comboBreakRate10s = safeNum(features.comboBreakRate10s);
    const rtMedian = safeNum(features.rtMedian);
    const goalPct = safeNum(features.goalPct);
    const bossHpPct = safeNum(features.bossHpPct);
    const timeLeftPct = safeNum(features.timeLeftPct);
    const scoreDelta5s = safeNum(features.scoreDelta5s);
    const isBoss = safeNum(features.isBoss);

    const frustrationRaw =
      (55 - accPct) * 0.05 +
      junkConfusionRatio * 1.7 +
      expirePressureRatio * 1.2 +
      comboBreakRate10s * 0.18;

    const fatigueRaw =
      (rtMedian - 700) * 0.0022 +
      expirePressureRatio * 1.0 +
      (timeLeftPct < 25 ? 0.55 : 0);

    const hazardRaw =
      (isBoss ? 0.55 : 0) +
      (bossHpPct > 60 ? 0.4 : 0) +
      junkConfusionRatio * 1.2 +
      expirePressureRatio * 0.7 +
      (accPct < 55 ? 0.5 : 0);

    const winRaw =
      (goalPct - 55) * 0.045 +
      (accPct - 70) * 0.03 -
      junkConfusionRatio * 1.0 -
      expirePressureRatio * 0.7 +
      (scoreDelta5s > 0 ? 0.4 : -0.25) -
      (isBoss && bossHpPct > 65 ? 0.6 : 0);

    const frustrationRisk = clamp(sigmoid(frustrationRaw), 0, 1);
    const fatigueRisk = clamp(sigmoid(fatigueRaw), 0, 1);
    const hazardRisk = clamp(sigmoid(hazardRaw), 0, 1);
    const winChance = clamp(sigmoid(winRaw), 0, 1);

    const junkConfusionRisk = clamp(junkConfusionRatio * 1.65, 0, 1);
    const attentionDropRisk = clamp((rtMedian > 1100 ? 0.55 : 0.18) + expirePressureRatio * 0.5, 0, 1);

    return {
      hazardRisk,
      frustrationRisk,
      winChance,
      fatigueRisk,
      junkConfusionRisk,
      attentionDropRisk
    };
  }

  function explainPrediction(pred, features){
    const factors = explainTopFactors(features);
    let coach = 'พร้อมแล้ว! ยิงของดี 🥦';
    let explainText = 'prediction-ready';

    if(pred.hazardRisk >= 0.78){
      coach = 'ช่วงนี้อันตรายมาก ระวังของไม่ดี!';
      explainText = 'ความเสี่ยงสูง ควรชะลอและเล็งให้ชัด';
    } else if(pred.frustrationRisk >= 0.72){
      coach = 'ค่อย ๆ เล่นทีละชิ้นก็ได้';
      explainText = 'เริ่มมีอาการกดพลาดต่อเนื่อง';
    } else if(pred.junkConfusionRisk >= 0.68){
      coach = 'ดูให้ชัดก่อนยิง เลือกของดีเท่านั้น';
      explainText = 'เริ่มสับสนของดีและของไม่ดี';
    } else if(pred.winChance >= 0.82){
      coach = 'เก่งมาก! รักษาจังหวะนี้ไว้';
      explainText = 'ตอนนี้มีโอกาสชนะสูง';
    } else if(pred.fatigueRisk >= 0.70){
      coach = 'พักใจนิดหนึ่ง แล้วค่อยยิงต่อ';
      explainText = 'เริ่มล้าและตอบสนองช้าลง';
    }

    return {
      coach,
      explainText,
      topFactors: factors
    };
  }

  async function predict(features = {}){
    if(!state.loaded) await load();

    if(state.mode === 'external' && state.externalPredictor){
      try{
        const vector = featureVectorToArray(features);
        const out = await state.externalPredictor({
          features,
          vector,
          featureSchemaVersion: GJ_FEATURE_SCHEMA_VERSION,
          modelVersion: state.modelVersion
        });

        const base = {
          hazardRisk: clamp(safeNum(out?.hazardRisk, 0.5), 0, 1),
          frustrationRisk: clamp(safeNum(out?.frustrationRisk, 0.5), 0, 1),
          winChance: clamp(safeNum(out?.winChance, 0.5), 0, 1),
          fatigueRisk: clamp(safeNum(out?.fatigueRisk, 0.5), 0, 1),
          junkConfusionRisk: clamp(safeNum(out?.junkConfusionRisk, 0.5), 0, 1),
          attentionDropRisk: clamp(safeNum(out?.attentionDropRisk, 0.5), 0, 1)
        };

        const exp = explainPrediction(base, features);

        return {
          ...base,
          ...exp,
          modelVersion: state.modelVersion,
          featureSchemaVersion: GJ_FEATURE_SCHEMA_VERSION,
          inferenceMode: 'external'
        };
      } catch (err){
        state.loadError = String(err?.message || err || 'external predictor failed');
      }
    }

    const base = predictHeuristic(features);
    const exp = explainPrediction(base, features);

    return {
      ...base,
      ...exp,
      modelVersion: state.modelVersion,
      featureSchemaVersion: GJ_FEATURE_SCHEMA_VERSION,
      inferenceMode: 'heuristic'
    };
  }

  return {
    load,
    predict,
    getMeta(){
      return {
        loaded: state.loaded,
        modelVersion: state.modelVersion,
        mode: state.mode,
        loadError: state.loadError,
        featureSchemaVersion: GJ_FEATURE_SCHEMA_VERSION
      };
    }
  };
}