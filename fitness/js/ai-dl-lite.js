'use strict';

/**
 * ai-dl-lite.js
 * - Compatibility shim: ให้ UI/engine เรียก “DL-lite Predictor” ได้
 * - IMPORTANT: AIPredictor ต้อง import จาก ai-predictor.js (ไม่ใช่ ai-director.js)
 */

export { AIPredictor } from './ai-predictor.js';