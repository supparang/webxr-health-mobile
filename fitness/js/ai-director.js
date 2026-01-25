// === /fitness/js/ai-director.js — ML-lite AI Director (Pack B) ===
'use strict';

/**
 * เป้าหมาย:
 * - ทำนาย p(hit) แบบ online logistic regression (SGD)
 * - ปรับ spawn delay / TTL / mix ของชนิดเป้า ให้ "flow" (สนุก+ท้าทาย+ยุติธรรม)
 *
 * หมายเหตุ:
 * - เบามาก (ไม่มี TF.js) แต่ "เป็น ML จริง" เพราะมีโมเดล + update จากข้อมูล
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function sigmoid(z){
  // กัน overflow
  if (z > 12) return 0.999994;
  if (z < -12) return 0.000006;
  return 1 / (1 + Math.exp(-z));
}

export class AIDirector {
  constructor(opts = {}) {
    // เป้าหมาย hit-rate (flow zone)
    this.targetHit = opts.targetHit ?? 0.78;
    this.minHit = opts.minHit ?? 0.60;
    this.maxHit = opts.maxHit ?? 0.88;

    // smoothing
    this.emaHit = 0.75;   // ค่าเริ่ม
    this.emaRt = 420;     // ms ค่าเริ่ม
    this.alpha = 0.08;    // EMA update strength

    // online logistic regression weights
    // features: [bias, rt_norm, streak, boss_phase, fever_on, shield, miss_recent]
    this.w = new Float32Array(7);
    this.w[0] = 0.0;   // bias
    this.w[1] = -0.9;  // rt มาก -> hit น้อยลง
    this.w[2] = 0.35;  // streak ดี -> hit มากขึ้น
    this.w[3] = -0.25; // boss phase สูง -> ยากขึ้น
    this.w[4] = 0.18;  // fever on -> ง่ายขึ้นนิด
    this.w[5] = 0.10;  // shield มี -> มั่นใจขึ้นนิด
    this.w[6] = -0.28; // miss recent -> hit ลด

    this.lr = opts.lr ?? 0.06;          // learning rate
    this.l2 = opts.l2 ?? 0.001;         // weight decay
    this.streak = 0;
    this.missRecent = 0;                // 0..1 EMA miss
    this.lastPHit = 0.75;

    // mix base
    this.baseMix = {
      normal: 64, decoy: 10, bomb: 8, heal: 9, shield: 9
    };

    // multipliers ที่จะถูกปรับตาม difficulty flow
    this.spawnMul = 1.0;  // <1 = spawn ถี่ขึ้น
    this.ttlMul = 1.0;    // <1 = TTL สั้นลง
  }

  reset(){
    this.emaHit = 0.75;
    this.emaRt = 420;
    this.streak = 0;
    this.missRecent = 0;
    this.spawnMul = 1.0;
    this.ttlMul = 1.0;
  }

  // สร้าง feature vector จาก state + rt
  featurize(state, rtMs){
    const rt = clamp(rtMs ?? this.emaRt, 120, 1200);
    const rtNorm = (rt - 420) / 260; // roughly -1..+3
    const streak = clamp(state.combo ?? this.streak, 0, 18) / 10;
    const bossPhase = clamp(state.bossPhase ?? 1, 1, 3);
    const feverOn = state.feverOn ? 1 : 0;
    const shield = clamp(state.shield ?? 0, 0, 6) / 4;
    const missRecent = clamp(this.missRecent, 0, 1);

    return [
      1,
      rtNorm,
      streak,
      (bossPhase - 1) / 2, // 0..1
      feverOn,
      shield,
      missRecent
    ];
  }

  predictPHit(state, rtMs){
    const x = this.featurize(state, rtMs);
    let z = 0;
    for (let i = 0; i < this.w.length; i++) z += this.w[i] * x[i];
    const p = sigmoid(z);
    this.lastPHit = p;
    return p;
  }

  // update หลัง hit/timeout (label: 1=hit, 0=miss)
  observe(state, rtMs, label01){
    const y = label01 ? 1 : 0;

    // update EMAs
    this.emaHit = (1 - this.alpha) * this.emaHit + this.alpha * y;
    if (rtMs != null && rtMs !== '') {
      const r = clamp(rtMs, 120, 1200);
      this.emaRt = (1 - this.alpha) * this.emaRt + this.alpha * r;
    }
    // miss recent EMA
    const miss = y ? 0 : 1;
    this.missRecent = (1 - this.alpha) * this.missRecent + this.alpha * miss;

    // streak tracking (ใช้ช่วยเป็น feature)
    if (y) this.streak = Math.min(20, this.streak + 1);
    else this.streak = 0;

    // SGD update
    const x = this.featurize(state, rtMs);
    const p = this.predictPHit(state, rtMs);
    const err = (y - p); // gradient ascent for log-likelihood
    for (let i = 0; i < this.w.length; i++) {
      // L2
      const decay = this.l2 * this.w[i];
      this.w[i] += this.lr * (err * x[i] - decay);
    }

    // ปรับ pacing เพื่อเข้า flow
    this._adjustPacing();
  }

  _adjustPacing(){
    // ถ้า hit ต่ำเกิน -> ทำให้ง่ายขึ้น (spawn ช้าลง + TTL ยาวขึ้น)
    // ถ้า hit สูงเกิน -> ทำให้ยากขึ้น (spawn ถี่ขึ้น + TTL สั้นลง)
    const h = this.emaHit;
    if (h < this.minHit) {
      this.spawnMul = clamp(this.spawnMul * 1.05, 0.90, 1.35);
      this.ttlMul   = clamp(this.ttlMul   * 1.05, 0.88, 1.35);
    } else if (h > this.maxHit) {
      this.spawnMul = clamp(this.spawnMul * 0.96, 0.75, 1.25);
      this.ttlMul   = clamp(this.ttlMul   * 0.96, 0.70, 1.20);
    } else {
      // ค่อย ๆ กลับเข้าสู่ 1.0
      this.spawnMul = this.spawnMul + (1.0 - this.spawnMul) * 0.06;
      this.ttlMul   = this.ttlMul   + (1.0 - this.ttlMul)   * 0.06;
    }
  }

  // แนะนำ delay สำหรับ spawn next
  nextSpawnDelayMs(cfg){
    const base = this._rand(cfg.spawnIntervalMin, cfg.spawnIntervalMax);
    return Math.round(base * this.spawnMul);
  }

  // แนะนำ TTL
  nextTTLms(cfg){
    return Math.round(cfg.targetLifetime * this.ttlMul);
  }

  // เลือกชนิดเป้าตามสถานการณ์ + p(hit) คาดการณ์
  chooseKind(state){
    const p = this.lastPHit;

    // ปรับ mix แบบ adaptive
    const w = { ...this.baseMix };

    // ถ้าคาดว่าเริ่มพลาดเยอะ -> ลด bomb/decoy เพิ่ม heal/shield/normal
    if (p < 0.62 || this.emaHit < 0.65) {
      w.bomb  = Math.max(3, Math.round(w.bomb * 0.55));
      w.decoy = Math.max(5, Math.round(w.decoy * 0.70));
      w.heal  = Math.round(w.heal * 1.25);
      w.shield= Math.round(w.shield * 1.18);
      w.normal= Math.round(w.normal * 1.12);
    }

    // ถ้าคาดว่าเทพจัด -> เพิ่ม bomb/decoy ลด heal/shield
    if (p > 0.86 && this.emaHit > 0.86) {
      w.bomb  = Math.round(w.bomb * 1.35);
      w.decoy = Math.round(w.decoy * 1.30);
      w.heal  = Math.max(4, Math.round(w.heal * 0.75));
      w.shield= Math.max(4, Math.round(w.shield * 0.80));
      w.normal= Math.round(w.normal * 0.95);
    }

    // ถ้า HP ผู้เล่นต่ำ -> เพิ่ม heal/shield ลด bomb
    if ((state.playerHp ?? 1) < 0.42) {
      w.heal  = Math.round(w.heal * 1.35);
      w.shield= Math.round(w.shield * 1.15);
      w.bomb  = Math.max(3, Math.round(w.bomb * 0.65));
    }

    // boss phase 3 -> ลด heal นิด เพิ่ม normal เพื่อดันจบ
    if ((state.bossPhase ?? 1) >= 3) {
      w.heal = Math.max(4, Math.round(w.heal * 0.85));
      w.normal = Math.round(w.normal * 1.08);
    }

    return this._pickWeighted(w);
  }

  _pickWeighted(map){
    const keys = Object.keys(map);
    const total = keys.reduce((a,k)=>a+(map[k]||0),0);
    let r = Math.random() * total;
    for (const k of keys) {
      r -= (map[k]||0);
      if (r <= 0) return k;
    }
    return keys[keys.length-1] || 'normal';
  }

  _rand(min,max){ return min + Math.random() * (max - min); }
}