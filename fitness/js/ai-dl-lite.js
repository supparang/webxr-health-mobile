// === /fitness/js/ai-dl-lite.js ===
// Compatibility shim (older builds requested this file).
// Re-exports the lightweight predictor and feature helpers.

'use strict';

export { AIPredictor as SessionPredictor, AIPredictor, FEATURE_ORDER } from './ai-predictor.js';
export { FeatureTracker } from './dl-features.js';