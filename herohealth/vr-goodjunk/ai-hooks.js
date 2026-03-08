// === /herohealth/vr-goodjunk/ai-hooks.js ===
// GoodJunk AI Hooks — prediction-ready / model-ready
// PATCH v20260308-GJ-AI-HOOKS-PREDICTION-READY
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}

function pickTopFactors(factors, n=3){
  return Object.entries(factors || {})
    .map(([k,v])=>({ key:k, value:Number(v||0)||0 }))
    .sort((a,b)=>b.value-a.value)
    .slice(0,n);
}

function softmax01(x){
  x = clamp(x, -8, 8);
  return 1 / (1 + Math.exp(-x));
}

function round2(v){
  v = Number(v||0) || 0;
  return Math.round(v * 100) / 100;
}

/**
 * NOTE:
 * ตอนนี้ยังเป็น heuristic predictor + model-ready API
 * ภายหลังสามารถเสียบ ML/DL model ได้โดยคง public interface เดิม:
 * - predict(snapshot)
 * - explain(snapshot)
 * - recommend(snapshot)
 * - emit(eventName, payload)
 */
export function createAIHooks(options={}){
  const cfg = {
    enabled: options.enabled !== false,
    mode: String(options.mode || 'predict-only'), // predict-only | adaptive
    modelVersion: String(options.modelVersion || 'heuristic-v1'),
    debug: !!options.debug
  };

  const eventBuffer = [];

  function emit(eventName, payload={}){
    if(!cfg.enabled) return;
    const row = {
      t: Date.now(),
      eventName: String(eventName || 'unknown'),
      payload: payload || {}
    };
    eventBuffer.push(row);
    try{
      WIN.dispatchEvent(new CustomEvent('goodjunk:ai-event', { detail: row }));
    }catch(_){}
  }

  function computeFeatures(snap={}){
    const score = Number(snap.score || 0) || 0;
    const missTotal = Number(snap.missTotal || 0) || 0;
    const missGoodExpired = Number(snap.missGoodExpired || 0) || 0;
    const missJunkHit = Number(snap.missJunkHit || 0) || 0;
    const shots = Number(snap.shots || 0) || 0;
    const hits = Number(snap.hits || 0) || 0;
    const accPct = Number(snap.accPct || 0) || 0;
    const combo = Number(snap.combo || 0) || 0;
    const comboBest = Number(snap.comboBest || 0) || 0;
    const tLeft = Number(snap.tLeft || 0) || 0;
    const plannedSec = Number(snap.plannedSec || 80) || 80;
    const stage = Number(snap.stage || 0) || 0;
    const bossHp = Number(snap.bossHp || 0) || 0;
    const bossHpMax = Number(snap.bossHpMax || 0) || 0;
    const scoreTarget = Number(snap.scoreTarget || 650) || 650;
    const goodHitCount = Number(snap.goodHitCount || 0) || 0;
    const goodTarget = Number(snap.goodTarget || 40) || 40;
    const rtMedian = Number(snap.medianRtGoodMs || 0) || 0;
    const fever = Number(snap.fever || 0) || 0;
    const shield = Number(snap.shield || 0) || 0;
    const streakMiss = Number(snap.streakMiss || 0) || 0;

    const timeRatio = plannedSec > 0 ? clamp(tLeft / plannedSec, 0, 1) : 0;
    const scoreRatio = scoreTarget > 0 ? clamp(score / scoreTarget, 0, 2) : 0;
    const progressRatio = goodTarget > 0 ? clamp(goodHitCount / goodTarget, 0, 2) : 0;
    const bossRatio = bossHpMax > 0 ? clamp(bossHp / bossHpMax, 0, 1) : 0;

    return {
      score, missTotal, missGoodExpired, missJunkHit, shots, hits,
      accPct, combo, comboBest, tLeft, plannedSec, stage,
      bossHp, bossHpMax, scoreTarget, goodHitCount, goodTarget,
      rtMedian, fever, shield, streakMiss,
      timeRatio, scoreRatio, progressRatio, bossRatio
    };
  }

  function predict(snapshot={}){
    const f = computeFeatures(snapshot);

    const factors = {
      lowAcc: clamp((70 - f.accPct) / 70, 0, 1),
      junkMistakes: clamp(f.missJunkHit / 8, 0, 1),
      slowCollection: clamp(f.missGoodExpired / 8, 0, 1),
      lowProgress: clamp((0.85 - f.scoreRatio), 0, 1),
      lowCombo: clamp((4 - f.combo) / 4, 0, 1),
      dangerTime: clamp((12 - f.tLeft) / 12, 0, 1),
      bossPressure: f.stage === 2 ? clamp(f.bossRatio, 0, 1) : 0,
      missStreak: clamp(f.streakMiss / 4, 0, 1)
    };

    const hazardLinear =
      factors.lowAcc * 1.15 +
      factors.junkMistakes * 1.25 +
      factors.slowCollection * 1.10 +
      factors.lowProgress * 1.00 +
      factors.lowCombo * 0.65 +
      factors.dangerTime * 1.20 +
      factors.bossPressure * 0.95 +
      factors.missStreak * 1.10 -
      clamp(f.fever / 10, 0, 0.35) -
      clamp(f.shield / 10, 0, 0.20);

    const hazardRisk = round2(softmax01(hazardLinear - 2.0));

    const topFactors = pickTopFactors(factors, 3);

    const next5 = [];
    if(factors.junkMistakes >= 0.45) next5.push('หลบ junk ก่อน แล้วค่อยเก็บ good');
    if(factors.slowCollection >= 0.45) next5.push('รีบเก็บ good ที่ขึ้นใกล้กลางจอ');
    if(factors.lowAcc >= 0.45) next5.push('เล็งให้ชัวร์ก่อนยิง ไม่ต้องรีบทุกชิ้น');
    if(f.stage === 2 && factors.bossPressure >= 0.45) next5.push('ตีโล่บอสให้แตกก่อน แล้วรัว weak point');
    if(f.tLeft <= 10) next5.push('ช่วงท้ายแล้ว เร่งแต้มและห้ามพลาด');
    if(f.combo < 4) next5.push('ปั้นคอมโบให้ถึง 5 เพื่อดันแต้ม');
    if(next5.length === 0) next5.push('รักษาจังหวะนี้ต่อไป กำลังดี');

    const winChance = round2(clamp(
      0.20 +
      f.scoreRatio * 0.38 +
      clamp(f.accPct / 100, 0, 1) * 0.18 +
      clamp(f.comboBest / 15, 0, 1) * 0.10 +
      (f.stage === 2 ? (1 - f.bossRatio) * 0.16 : f.progressRatio * 0.12) -
      clamp(f.missTotal / 14, 0, 0.25),
      0, 0.99
    ));

    const frustrationRisk = round2(clamp(
      factors.missStreak * 0.38 +
      factors.lowAcc * 0.22 +
      factors.junkMistakes * 0.22 +
      factors.slowCollection * 0.18,
      0, 1
    ));

    const prediction = {
      modelVersion: cfg.modelVersion,
      hazardRisk,
      winChance,
      frustrationRisk,
      topFactors,
      next5
    };

    emit('predict', prediction);
    return prediction;
  }

  function explain(snapshot={}){
    const p = predict(snapshot);
    const mapLabel = {
      lowAcc: 'ความแม่นต่ำ',
      junkMistakes: 'โดนของขยะบ่อย',
      slowCollection: 'เก็บของดีช้า',
      lowProgress: 'แต้มยังตามเป้า',
      lowCombo: 'คอมโบต่ำ',
      dangerTime: 'เวลาใกล้หมด',
      bossPressure: 'บอสยังเหลือเยอะ',
      missStreak: 'พลาดติดกัน'
    };

    const text = p.topFactors
      .filter(x => x.value > 0.15)
      .map(x => mapLabel[x.key] || x.key);

    return {
      ...p,
      explainText: text.length ? text.join(' + ') : 'สถานะค่อนข้างนิ่ง'
    };
  }

  function recommend(snapshot={}){
    const p = explain(snapshot);
    let coach = p.next5[0] || 'เล่นจังหวะเดิมต่อไป';

    if(p.frustrationRisk >= 0.65){
      coach = 'อย่ารีบมาก เลือกเป้าที่ชัวร์ก่อน จะคุมเกมกลับมาได้';
    }else if(p.hazardRisk >= 0.70){
      coach = 'อันตรายสูง! ระวัง junk และห้ามปล่อย good หลุด';
    }else if(p.winChance >= 0.75){
      coach = 'ได้เปรียบแล้ว รักษาคอมโบและอย่าพลาดฟรี';
    }

    const out = { ...p, coach };
    emit('recommend', out);
    return out;
  }

  function getEventBuffer(){
    return eventBuffer.slice();
  }

  return {
    enabled: cfg.enabled,
    mode: cfg.mode,
    modelVersion: cfg.modelVersion,
    emit,
    predict,
    explain,
    recommend,
    getEventBuffer
  };
}

export function createDefaultAIHooksFromQuery(){
  try{
    const url = new URL(location.href);
    const enabled = url.searchParams.get('ai') !== '0';
    const debug = url.searchParams.get('aiDebug') === '1';
    const mode = url.searchParams.get('aiMode') || 'predict-only';
    return createAIHooks({ enabled, debug, mode });
  }catch(_){
    return createAIHooks({});
  }
}

WIN.GJCreateAIHooks = createAIHooks;
WIN.GJCreateDefaultAIHooksFromQuery = createDefaultAIHooksFromQuery;