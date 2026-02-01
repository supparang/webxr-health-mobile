// === /fitness/js/dl-features.js ===
// Feature tracker for “DL-lite” analytics (no training here)
// Keeps rolling stats that can be exported later.

'use strict';

export class FeatureTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.n = 0;
    this.sumAcc = 0;
    this.sumHp = 0;
    this.sumMiss = 0;
    this.sumCombo = 0;

    this.last = {};
  }

  updateFromSnapshot(snap = {}) {
    const acc = Number(snap.accPct) || 0;
    const hp = Number(snap.hp) || 0;
    const miss = Number(snap.hitMiss) || 0;
    const combo = Number(snap.combo) || 0;

    this.n += 1;
    this.sumAcc += acc;
    this.sumHp += hp;
    this.sumMiss += miss;
    this.sumCombo += combo;

    this.last = {
      accPct: acc,
      hp,
      miss,
      combo,
      rtMean: Number(snap.rtMean) || 0,
      bossIndex: snap.bossIndex ?? 0,
      phase: snap.phase ?? 1,
      fever: Number(snap.fever) || 0,
      shield: Number(snap.shield) || 0,
      t: Number(snap.songTime) || 0,
    };
  }

  getAverages() {
    const n = Math.max(1, this.n);
    return {
      n: this.n,
      accPct_mean: this.sumAcc / n,
      hp_mean: this.sumHp / n,
      miss_mean: this.sumMiss / n,
      combo_mean: this.sumCombo / n,
      last: this.last,
    };
  }

  toRow() {
    const avg = this.getAverages();
    return {
      n: avg.n,
      accPct_mean: avg.accPct_mean.toFixed(2),
      hp_mean: avg.hp_mean.toFixed(2),
      miss_mean: avg.miss_mean.toFixed(2),
      combo_mean: avg.combo_mean.toFixed(2),
      last_accPct: (avg.last.accPct ?? 0).toFixed(2),
      last_hp: (avg.last.hp ?? 0).toFixed(2),
      last_miss: (avg.last.miss ?? 0),
      last_combo: (avg.last.combo ?? 0),
      last_rtMean: (avg.last.rtMean ?? 0).toFixed(2),
      last_phase: avg.last.phase ?? 1,
      last_bossIndex: avg.last.bossIndex ?? 0,
      last_fever: (avg.last.fever ?? 0),
      last_shield: (avg.last.shield ?? 0),
    };
  }
}