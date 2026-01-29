// === /fitness/js/ml-frozen.js — Frozen ML model (LogReg) stub ===
'use strict';

// แปลง feature object -> vector ตามลำดับนี้ (ต้องตรงกับตอนเทรน)
export const FEATURE_ORDER = [
  'rt_mean','rt_sd','acc_ewma','miss_ewma','bomb_ewma','combo_ewma',
  'player_hp','boss_hp','shield',
  'boss_phase','diff_easy','diff_normal','diff_hard',
  'fever_on','miss_streak'
];

// weights ตัวอย่าง (ยังไม่ใช่ของจริง) — เอา weights จาก training มาแทน
let MODEL = {
  bias: -0.25,
  w: {
    rt_mean: 0.0012,
    rt_sd: 0.0020,
    acc_ewma: -1.30,
    miss_ewma: 1.40,
    bomb_ewma: 0.90,
    combo_ewma: -0.60,
    player_hp: -1.10,
    boss_hp: 0.15,
    shield: -0.18,
    boss_phase: 0.10,
    diff_easy: -0.12,
    diff_normal: 0.00,
    diff_hard: 0.18,
    fever_on: -0.22,
    miss_streak: 0.25
  }
};

function sigmoid(x){ return 1 / (1 + Math.exp(-x)); }
function toNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

export function setFrozenModel(newModel){
  // newModel: {bias:number, w:{...}}
  if (!newModel || typeof newModel !== 'object') return;
  if (typeof newModel.bias !== 'number') return;
  if (!newModel.w || typeof newModel.w !== 'object') return;
  MODEL = newModel;
}

export function predictFail5(featureObj){
  const w = MODEL.w || {};
  let z = MODEL.bias || 0;
  for (const k of FEATURE_ORDER){
    z += (w[k] || 0) * toNum(featureObj[k]);
  }
  return sigmoid(z); // 0..1
}