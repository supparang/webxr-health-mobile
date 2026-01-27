// === /fitness/js/ai-director.js ===
'use strict';

/**
 * AI Director (hooks-only) — Phase A
 * - ตอนนี้ยังไม่ทำ ML/DL จริง: เป็น "policy hooks" เพื่อให้ต่อยอดได้แบบ deterministic/วิจัยได้
 * - ใช้ได้ทั้ง play และ research (แต่ใน research ควร lock policy คงที่)
 */

export class AIDirector {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;
    this.mode = opts.mode || 'play'; // play | research
    this.diffKey = opts.diffKey || 'normal';

    // runtime rolling stats
    this.window = [];
    this.windowMax = opts.windowMax || 24;

    // suggestion state
    this.lastSuggestionAt = 0;
    this.suggestionCooldownMs = opts.suggestionCooldownMs || 2500;
  }

  setEnabled(v) { this.enabled = !!v; }
  setMode(m) { this.mode = m || 'play'; }
  setDiffKey(k) { this.diffKey = k || 'normal'; }

  /** feed one event summary (hit/timeout) */
  observe(ev) {
    if (!ev) return;
    this.window.push(ev);
    if (this.window.length > this.windowMax) this.window.shift();
  }

  /** lightweight prediction: next-performance tendency (not ML, heuristic) */
  predict() {
    const w = this.window;
    if (!w.length) return { trend: 'unknown', conf: 0 };

    let hits = 0, miss = 0, bad = 0, perfect = 0;
    for (const e of w) {
      if (e.type === 'hit') hits++;
      else if (e.type === 'timeout') miss++;
      if (e.grade === 'bad') bad++;
      if (e.grade === 'perfect') perfect++;
    }

    const total = hits + miss;
    const acc = total ? hits / total : 0;
    const perf = (perfect + (hits - perfect - bad) * 0.6) / Math.max(1, hits);

    let trend = 'stable';
    if (acc < 0.65 || miss >= hits) trend = 'down';
    else if (acc > 0.85 && perf > 0.65) trend = 'up';

    const conf = Math.min(0.95, 0.35 + w.length / this.windowMax * 0.55);
    return { trend, conf, acc: +(acc * 100).toFixed(1) };
  }

  /** optional coach micro-tip */
  maybeSuggest(nowMs) {
    if (!this.enabled) return null;
    if (this.mode === 'research') return null; // research: ปิด micro-tip ได้ตามมาตรฐาน
    if (nowMs - this.lastSuggestionAt < this.suggestionCooldownMs) return null;

    const p = this.predict();
    if (p.trend === 'down' && p.conf > 0.6) {
      this.lastSuggestionAt = nowMs;
      return 'ลองโฟกัสที่ “เป้าจริง 🎯” ก่อน แล้วค่อยเสี่ยงเก็บ 🛡️/🩹 นะ';
    }
    if (p.trend === 'up' && p.conf > 0.6) {
      this.lastSuggestionAt = nowMs;
      return 'จังหวะดีมาก! ลองเร่งให้ได้ PERFECT ต่อเนื่อง 🔥';
    }
    return null;
  }

  /**
   * adjust difficulty recommendation
   * - เป็น recommendation เท่านั้น (ไม่บังคับ)
   */
  recommendDiff() {
    if (!this.enabled) return null;
    const p = this.predict();
    if (this.mode === 'research') return null;
    if (p.trend === 'up' && p.acc >= 88) return 'hard';
    if (p.trend === 'down' && p.acc <= 70) return 'easy';
    return null;
  }
}