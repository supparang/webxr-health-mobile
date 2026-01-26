// === /fitness/js/ai-director.js ===
// Pack B: Hybrid AI Director (LogReg + MiniDL) + Telemetry (fatigue/stability)
// ✅ Play only (engine controls)
// ✅ Coach tips (rate-limited), fair caps

'use strict';

import { AIPredictor } from './ai-predictor.js';
import { MiniDL } from './ai-dl-mini.js';
import { AITelemetry } from './ai-telemetry.js';

export class AIDirector {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      // fairness caps
      minDelayMul: 0.80,
      maxDelayMul: 1.22,
      minTtlMul: 0.84,
      maxTtlMul: 1.18,

      // mixing caps
      maxBombW: 13,
      minBombW: 4,
      maxDecoyW: 15,
      minDecoyW: 6,

      // coach
      tipCooldownMs: 2200,
      tipChance: 0.30,
      dangerTipChance: 0.55,

      // hybrid blending
      blendDL: 0.48, // 0..1 (DL weight)
    }, opts);

    this.lrModel = new AIPredictor();
    this.dlModel = new MiniDL();
    this.telemetry = new AITelemetry();

    this.lastTipAt = 0;

    this.lastP = 0.35;
    this.lastDelayMul = 1.0;
    this.lastTtlMul = 1.0;
  }

  // same feature mapping used by AIPredictor (8-dim)
  _feat({ rtMs, missStreak, bombStreak, hpLow, feverOn, phase, diffHard }) {
    const x = new Float32Array(8);
    x[0] = 1;
    // normalize RT
    const v = (rtMs == null || rtMs === '') ? 0.5 : Math.max(0, Math.min(1200, rtMs)) / 1200;
    x[1] = v;
    x[2] = missStreak;
    x[3] = bombStreak;
    x[4] = hpLow;
    x[5] = feverOn;
    x[6] = phase;
    x[7] = diffHard;
    return x;
  }

  _computeStreaks() {
    const H = this.telemetry.hist;
    let missStreak = 0;
    let bombStreak = 0;

    for (let i = H.length - 1; i >= 0; i--) {
      if (H[i].yMiss === 1) missStreak++;
      else break;
    }
    for (let i = H.length - 1; i >= 0; i--) {
      if (H[i].grade === 'bomb') bombStreak++;
      else break;
    }

    missStreak = Math.min(6, missStreak) / 6;
    bombStreak = Math.min(6, bombStreak) / 6;

    return { missStreak, bombStreak };
  }

  observeResolvedEvent(info) {
    const now = info?.now || performance.now();

    // telemetry first
    this.telemetry.observeResolved({
      now,
      type: info.type,
      grade: info.grade,
      rtMs: info.rtMs,
      playerHp: info.playerHp,
      feverOn: info.feverOn,
      bossPhase: info.bossPhase,
      diffKey: info.diffKey
    });

    // update LogReg model
    this.lrModel.observe(info);

    // build features for DL training
    const snap = this.telemetry.snapshot();
    const { missStreak, bombStreak } = this._computeStreaks();

    const hpLow = (info.playerHp != null && info.playerHp <= 0.32) ? 1 : 0;
    const feverOn = info.feverOn ? 1 : 0;
    const phase = Math.max(1, Math.min(3, info.bossPhase || 1)) / 3;
    const diffHard = (info.diffKey === 'hard') ? 1 : 0;

    const x = this._feat({
      rtMs: info.rtMs,
      missStreak,
      bombStreak,
      hpLow,
      feverOn,
      phase,
      diffHard
    });

    // label
    const y = (info.type === 'timeout' || info.grade === 'miss' || info.grade === 'bomb') ? 1 : 0;

    // train DL online
    const pDL = this.dlModel.trainOne(x, y);

    // blend predictions
    const pLR = this.lrModel.predict ? this.lrModel.predict() : this.lrModel.lastP;
    const blend = this.cfg.blendDL;

    // fatigue pushes p a bit higher (more assistance)
    const fatigue = snap.fatigue || 0;
    const p = (1 - blend) * pLR + blend * pDL;
    const pAdj = Math.max(0.02, Math.min(0.98, p + fatigue * 0.08));

    this.lastP = pAdj;
  }

  // pacing
  spawnDelayMul() {
    const p = this.lastP;
    const snap = this.telemetry.snapshot();
    const fatigue = snap.fatigue || 0;

    // struggling => slow down; strong => speed up
    let mul = 1.0 + (p - 0.45) * 0.40;

    // fatigue => slightly more generous
    mul *= (1 + fatigue * 0.10);

    mul = Math.max(this.cfg.minDelayMul, Math.min(this.cfg.maxDelayMul, mul));
    this.lastDelayMul = mul;
    return mul;
  }

  ttlMul() {
    const p = this.lastP;
    const snap = this.telemetry.snapshot();
    const fatigue = snap.fatigue || 0;

    let mul = 1.0 + (p - 0.45) * 0.32;
    mul *= (1 + fatigue * 0.08);

    mul = Math.max(this.cfg.minTtlMul, Math.min(this.cfg.maxTtlMul, mul));
    this.lastTtlMul = mul;
    return mul;
  }

  // spawn mixing
  weights() {
    const p = this.lastP;
    const snap = this.telemetry.snapshot();
    const fatigue = snap.fatigue || 0;
    const stability = snap.stability || 0.5;

    let normal = 64;
    let decoy  = 10;
    let bomb   = 8;
    let heal   = 9;
    let shield = 9;

    const struggling = (p >= 0.62) || (snap.lastHp != null && snap.lastHp <= 0.34);

    if (struggling) {
      heal += 3;
      shield += 3;
      bomb -= 2;
      decoy -= 2;
      normal += 1;
    } else if (p <= 0.30 && fatigue <= 0.35 && stability >= 0.55) {
      bomb += 2;
      decoy += 2;
      heal -= 2;
      shield -= 2;
    }

    // extra: if fatigue high => more heal/shield, reduce bomb/decoy
    if (fatigue >= 0.65) {
      heal += 2; shield += 2;
      bomb -= 2; decoy -= 1;
    }

    bomb = Math.max(this.cfg.minBombW, Math.min(this.cfg.maxBombW, bomb));
    decoy = Math.max(this.cfg.minDecoyW, Math.min(this.cfg.maxDecoyW, decoy));
    heal = Math.max(5, Math.min(14, heal));
    shield = Math.max(5, Math.min(14, shield));
    normal = Math.max(52, Math.min(74, normal));

    return [
      { v: 'normal', w: normal },
      { v: 'decoy',  w: decoy },
      { v: 'bomb',   w: bomb },
      { v: 'heal',   w: heal },
      { v: 'shield', w: shield }
    ];
  }

  // coach tips
  maybeTip(ctx) {
    const now = ctx?.now || performance.now();
    if (now - this.lastTipAt < this.cfg.tipCooldownMs) return null;

    const snap = this.telemetry.snapshot();
    const fatigue = snap.fatigue || 0;
    const p = this.lastP;

    const struggling = p >= 0.62 || (ctx && ctx.playerHp != null && ctx.playerHp <= 0.34) || fatigue >= 0.6;

    const r = Math.random();
    if (!struggling && r > this.cfg.tipChance) return null;
    if (struggling && r > this.cfg.dangerTipChance) return null;

    this.lastTipAt = now;

    if (ctx && ctx.hitType === 'bomb') return 'AI Coach: เห็น 💣/🎭 ให้ “ปล่อยผ่าน” จะคุม HP ได้ดีขึ้น!';
    if (ctx && ctx.missDelta > 0) return 'AI Coach: โฟกัส “กลางจอ” แล้วกวาดสายตา ลด Miss ได้เยอะ 👀';
    if (ctx && ctx.feverOn) return 'AI Coach: FEVER ON! ตอนนี้คะแนน ×1.5 รีบเก็บเป้าจริงต่อเนื่อง!';
    if (fatigue >= 0.65) return 'AI Coach: เหนื่อยขึ้นนิดนึงนะ ลองช้าลง 1 จังหวะ แล้วกลับมาไหลลื่น';
    if (struggling) return 'AI Coach: ตั้งหลักก่อน โฟกัสเป้าจริง 🥊 แล้วค่อยเพิ่มสปีด';
    return 'AI Coach: สายโปร! ลอง PERFECT ติด ๆ กันเพื่อปลด FEVER ไว';
  }

  debug() {
    const snap = this.telemetry.snapshot();
    return {
      pMiss: +this.lastP.toFixed(3),
      delayMul: +this.lastDelayMul.toFixed(3),
      ttlMul: +this.lastTtlMul.toFixed(3),
      fatigue: snap.fatigue,
      stability: snap.stability,
      dl: this.dlModel.debug()
    };
  }
}