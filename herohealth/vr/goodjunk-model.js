// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk ML Model (Runtime) — v1 (logistic regression stub)
// Replace weights by exporting from /herohealth/ml/train_goodjunk.py
'use strict';

export const GOODJUNK_MODEL_V1 = {
  version: 'goodjunk-logreg-v1',
  trainedAt: '2026-03-01',
  // Features (must match order in ai-goodjunk.js extractFeatures())
  features: [
    'bias',
    'diff_easy',
    'diff_normal',
    'diff_hard',
    'view_mobile',
    'view_pc',
    'time_left_norm',
    'miss_rate',
    'junk_rate',
    'combo_norm',
    'rt_good_norm',
    'fever_norm'
  ],
  // Initial hand-tuned weights (reasonable default). Replace after training.
  // risk = sigmoid(sum(w_i * x_i))
  weights: [
    -1.10, // bias
    -0.35, // diff_easy
    0.00,  // diff_normal
    0.45,  // diff_hard
    0.10,  // view_mobile
    -0.05, // view_pc
    0.30,  // time_left_norm  (more time left -> slightly higher risk? can be reversed by training)
    1.25,  // miss_rate
    1.55,  // junk_rate
    -0.55, // combo_norm
    0.90,  // rt_good_norm
    0.35   // fever_norm
  ],
  // Calibration (optional)
  clamp: { min: 0.02, max: 0.98 },
  thresholds: {
    low: 0.33,
    mid: 0.60,
    high: 0.78
  }
};