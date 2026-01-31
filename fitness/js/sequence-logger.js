// === /fitness/js/sequence-logger.js — DL-ready sequence logger (A-60) ===
'use strict';

/**
 * เก็บ step-level samples แล้วแปลงเป็น JSONL ของ sliding windows สำหรับ DL
 * - each step: { x:[...], y_miss:0/1, rt_ms:number|null, meta:{} }
 * - each window line: { window_x, window_y_miss, window_rt_ms, label_next_miss, label_next_rt_ms, meta }
 */
export class SequenceLogger {
  constructor() {
    this.steps = [];
    this.lastJsonl = '';
  }

  clear() {
    this.steps.length = 0;
    this.lastJsonl = '';
  }

  addStep(step) {
    if (!step || !Array.isArray(step.x)) return;
    this.steps.push(step);
  }

  /**
   * สร้าง JSONL สำหรับ DL
   * @param {number} windowLen เช่น 24
   * @param {number} stride เช่น 1
   * @param {Object} globalMeta meta ระดับ session/participant
   * @returns {string} JSONL
   */
  toJsonlWindows(windowLen = 24, stride = 1, globalMeta = null) {
    const n = this.steps.length;
    if (n < windowLen + 1) return '';

    const lines = [];
    for (let i = 0; i + windowLen < n; i += stride) {
      const w = this.steps.slice(i, i + windowLen);
      const next = this.steps[i + windowLen];

      const line = {
        window_len: windowLen,
        window_x: w.map(s => s.x),
        window_y_miss: w.map(s => s.y_miss),
        window_rt_ms: w.map(s => (typeof s.rt_ms === 'number' ? Math.round(s.rt_ms) : null)),
        label_next_miss: next.y_miss,
        label_next_rt_ms: (typeof next.rt_ms === 'number' ? Math.round(next.rt_ms) : null),
        // meta: ใส่บริบทที่จำเป็นสำหรับแยก condition/diff/phase
        meta: Object.assign(
          {},
          globalMeta || {},
          { start_index: i, end_index: i + windowLen - 1 },
          // เก็บ meta ของ step สุดท้ายของ window เป็นตัวแทนบริบท ณ ตอนนั้น
          (w[w.length - 1] && w[w.length - 1].meta) ? w[w.length - 1].meta : {}
        )
      };

      lines.push(JSON.stringify(line));
    }

    this.lastJsonl = lines.join('\n');
    return this.lastJsonl;
  }
}